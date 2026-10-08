import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, realpath, rm, statfs } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { createServer } from '../../apps/server/src/index.ts';
import { FlowClient } from '../../packages/client/src/index.ts';
import { assertCleanupBudget, measureRun } from './operator-bounds.mjs';
import { readRecord, writeRecord } from './records.mjs';
import { stageSpec, pauseReceipt, validatePause, settleStage } from './stage-policy.mjs';
import { assertContinuation, continuationState, verifyContinuationDatabase } from './continuation.mjs';

const ADMIN = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const LIMITS = { max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 };
const MIN_FREE = 1024 ** 3 + 128 * 1024 ** 2;
export async function resourceGate() {
  const space = await statfs(process.cwd()), freeBytes = space.bavail * space.bsize;
  assert(freeBytes >= MIN_FREE, 'Resource reserve unavailable; no database or process may start.');
  return { freeBytes, requiredBytes: MIN_FREE };
}
async function assertDirectory(value) {
  const current = await lstat(value.path);
  assert(current.isDirectory() && !current.isSymbolicLink() && current.dev === value.dev && current.ino === value.ino);
}
/** No database or server work before the fixed review packet is validated and exclusively consumed. */
export async function claimPausedResources(output, source, facts, stage) {
  await assertDirectory(facts.directory);
  const receipt = await readRecord(join(output, 'pause.json'));
  const state = await readRecord(join(facts.directory.path, 'journey.json'));
  const report = await readRecord(join(output, stageSpec(receipt.phase).file), 262_144);
  validatePause(receipt, { run: output.split('/').at(-1), phase: stage, sourceDigest: source.digest, state, report, resources: facts });
  await writeRecord(join(output, `pause-consumed-${receipt.phase}.json`), { receipt, continuedAt: new Date().toISOString() }, { exclusive: true });
  return receipt;
}
/** Keep actual runtime outside the metadata driver's private import TMPDIR. No PG or deletion here. */
export async function allocateRuntimeDirectory(parent) {
  const fixedParent = await realpath(parent); assert((await lstat(fixedParent)).isDirectory());
  const path = await realpath(await mkdtemp(join(fixedParent, 'flow-o16-'))), info = await lstat(path);
  return { path, dev: info.dev, ino: info.ino };
}
/** Owns only a random marked DB and its recorded dev/ino temporary directory. No existing service is reconfigured. */
export async function privateCenter(output, source, { resume = false, stage, temporaryParent = tmpdir(), continuation } = {}) {
  if (continuation) { assert(!resume && stage === 'renew'); assertContinuation(continuation, source); }
  const gate = await resourceGate(), file = join(output, 'resources.json');
  let facts = resume ? await readRecord(file) : { kind: 'flow.o16.private-resources.v1', database: `flow_o16_${randomUUID().replaceAll('-', '')}`,
    marker: randomUUID(), sourceDigest: source.digest, startedAt: new Date().toISOString(), gate, creationRequested: false, created: false, marked: false };
  if (continuation) Object.assign(facts, { database: continuation.packet.resources.database, marker: continuation.packet.resources.marker,
    marked: true, origin: continuation.grant.origin, retention: continuation.grant.retention, created: false });
  assert(facts.kind === 'flow.o16.private-resources.v1' && /^flow_o16_[a-f0-9]{32}$/.test(facts.database)
    && /^[a-f0-9-]{36}$/.test(facts.marker) && facts.sourceDigest === source.digest && !facts.databaseDropped);
  // Validate review material before creating a pool or reconnecting. A partial claim stays consumed.
  const review = resume ? await claimPausedResources(output, source, facts, stage) : undefined;
  const checkpoint = async phase => { facts.phase = phase; await writeRecord(file, facts); };
  if (!resume) await writeRecord(file, facts, { exclusive: true }); // File and parent sync precede CREATE.
  const admin = new Pool({ connectionString: ADMIN, ...LIMITS });
  let app, credentials, client, origin;
  const databaseUrl = ADMIN.replace(/postgres$/, facts.database);
  async function ownership() {
    assert(facts.marked && (facts.directory || facts.origin));
    if (facts.directory) await assertDirectory(facts.directory);
    if (facts.origin) await assertDirectory(facts.origin.directory);
    const row = (await admin.query("SELECT shobj_description(oid,'pg_database') AS marker,pg_database_size(oid)::text AS bytes FROM pg_database WHERE datname=$1", [facts.database])).rows[0];
    assert.equal(row?.marker, facts.marker); facts.databaseBytes = Number(row.bytes);
  }
  async function closedConnections() {
    const started = performance.now(), deadline = started + 3000; facts.connectionObservations = [];
    for (;;) {
      const remaining = deadline - performance.now(); assert(remaining > 0);
      try {
        const rows = (await admin.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33',
          values: [facts.database], query_timeout: Math.min(500, Math.ceil(remaining)) })).rows;
        facts.connectionObservations.push({ elapsedMs: Math.floor(performance.now() - started), rows });
        assert(rows.length <= 32 && performance.now() <= deadline); if (!rows.length) return;
      } catch { facts.connectionObservations.push({ error: 'connection-observation-unconfirmed' }); throw new Error('Database closure unknown.'); }
      await delay(Math.min(100, Math.max(0, deadline - performance.now())));
    }
  }
  async function stopServer() {
    if (app) { const closing = app; app = undefined; await closing.close(); }
    facts.serverClosed = true; client = undefined; await checkpoint('server-closed');
  }
  async function start(automaticQueueScan) {
    if (review) assert(Date.now() < Date.parse(review.reviewUntil), 'Review expired before center restart; retain resources.');
    assert(!app && typeof automaticQueueScan === 'boolean'); await ownership();
    if (continuation) { assertContinuation(continuation, source); assert.equal(automaticQueueScan, false);
      await closedConnections(); await freshContinuation(); }
    facts.serverClosed = false;
    await checkpoint('before-center-start');
    app = await createServer({ databaseUrl, ownerToken: credentials.ownerToken, leaseMs: 20000, automaticQueueScan });
    origin = await app.listen({ host: '127.0.0.1', port: 0 });
    client = new FlowClient({ baseUrl: origin, token: credentials.ownerToken });
    return { client, origin };
  }
  async function finish({ destroy, workersStopped }) {
    // A new stage never acquires deletion rights over an archived origin by adopting it.
    assert(!destroy || !facts.origin, 'Adopted origin requires separate cleanup authorization.');
    const errors = []; facts.workersStopped = workersStopped;
    if (facts.workerProcess === 'allocation-unknown') errors.push('worker-allocation-unconfirmed');
    for (const row of facts.workerProcesses ?? []) {
      if (row.state === 'stopped') continue; // Do not probe old, already-settled PID identities after a pause.
      try { process.kill(-row.pgid, 0); row.state = 'present'; }
      catch (error) { row.state = error.code === 'ESRCH' ? 'stopped' : 'unknown'; }
      if (facts.workerProcess?.pgid === row.pgid) facts.workerProcess = { ...row };
      if (row.state !== 'stopped') errors.push('worker-process-group-unconfirmed');
    }
    try { await stopServer(); } catch { errors.push('center-close-unconfirmed'); }
    if (!workersStopped) errors.push('worker-process-group-unconfirmed');
    if (!errors.length) {
      try {
        await ownership(); await closedConnections();
        if (destroy) {
          facts.finalBudgetBeforeDrop = await assertCleanupBudget(output.split('/').at(-1), facts.directory);
          await checkpoint('before-normal-drop'); await admin.query(`DROP DATABASE "${facts.database}"`); facts.databaseDropped = true;
          facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [facts.database])).rows; assert.deepEqual(facts.remaining, []);
          await assertDirectory(facts.directory); facts.finalBudgetBeforeRemove = await assertCleanupBudget(output.split('/').at(-1), facts.directory); await checkpoint('before-owned-directory-remove');
          await rm(facts.directory.path, { recursive: true }); facts.directoryRemoved = true;
          await assert.rejects(lstat(facts.directory.path), { code: 'ENOENT' });
        }
      } catch { errors.push('resource-cleanup-or-retention-unconfirmed'); }
    }
    try { await admin.end(); facts.adminClosed = true; } catch { errors.push('admin-close-unconfirmed'); }
    facts.errors = errors; facts.endedAt = new Date().toISOString(); await checkpoint(errors.length ? 'unknown-retained' : destroy ? 'cleaned' : 'paused-owned-resources');
    assert.deepEqual(errors, []); return structuredClone(facts);
  }
  async function freshContinuation() {
    const pool = new Pool({ connectionString: databaseUrl, ...LIMITS }); let first;
    try { facts.continuationFresh = await verifyContinuationDatabase(pool, continuation); }
    catch (error) { first = error; throw error; }
    finally { try { await pool.end(); } catch (error) { if (!first) throw error; } }
  }
  try {
    if (resume) {
      assert(facts.phase === 'paused-owned-resources'); await ownership(); await closedConnections(); facts.adminClosed = false;
      credentials = await readRecord(join((facts.origin?.directory ?? facts.directory).path, 'credentials.json'));
    } else if (continuation) {
      await ownership(); await closedConnections(); await freshContinuation();
      credentials = await readRecord(join(facts.origin.directory.path, 'credentials.json')); // Existing synthetic Flow owner token, in memory only.
      facts.directory = await allocateRuntimeDirectory(temporaryParent); await checkpoint('continuation-directory-created');
      await mkdir(join(facts.directory.path, 'intents'), { mode: 0o700 });
      const state = continuationState(continuation, source);
      await writeRecord(join(facts.directory.path, 'journey.json'), state, { exclusive: true });
      await writeRecord(join(output, 'continuation.json'), { grant: continuation.grant,
        fresh: facts.continuationFresh, oldRecordsUnchanged: true, nativeQueries: 0 }, { exclusive: true });
    } else {
      assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [facts.database])).rows, []);
      facts.creationRequested = true; await checkpoint('before-create'); await admin.query(`CREATE DATABASE "${facts.database}"`);
      facts.created = true; await checkpoint('created-awaiting-marker');
      await admin.query(`COMMENT ON DATABASE "${facts.database}" IS '${facts.marker}'`); facts.marked = true; await checkpoint('marked');
      facts.directory = await allocateRuntimeDirectory(temporaryParent); const path = facts.directory.path; await checkpoint('owned-directory-created');
      credentials = { ownerToken: randomUUID() }; await writeRecord(join(path, 'credentials.json'), credentials, { exclusive: true });
      await mkdir(join(path, 'intents'), { mode: 0o700 });
    }
    return { root: facts.directory.path, start, stopServer, finish, checkpoint,
      async pause(phase, report) {
        const state = await readRecord(join(facts.directory.path, 'journey.json'));
        const receipt = pauseReceipt({ run: output.split('/').at(-1), phase, sourceDigest: source.digest, state, report, resources: facts });
        await writeRecord(join(output, `pause-${phase}.json`), receipt, { exclusive: true });
        await writeRecord(join(output, 'pause.json'), receipt);
      },
      measureResources() { return measureRun(output.split('/').at(-1), facts.directory); },
      async beforeWorker() { facts.workersStopped = false; facts.workerProcess = 'allocation-unknown'; await checkpoint('before-worker-spawn'); },
      async trackWorker(pgid) { assert(Number.isSafeInteger(pgid) && pgid > 1); facts.workerProcess = { pgid, groupLeader: true, state: 'unknown' }; facts.workerProcesses ??= []; assert(facts.workerProcesses.length < 2); facts.workerProcesses.push({ ...facts.workerProcess }); await checkpoint('worker-group-recorded'); },
      get client() { assert(client); return client; }, get origin() { assert(client); return origin; } };
  } catch {
    facts.errors = ['allocation-or-reopen-unconfirmed']; await checkpoint('unknown-retained'); await admin.end();
    throw new Error('Private allocation is unconfirmed; preserve its marker and resources.');
  }
}

/** Evidence durability is a prerequisite for irreversible cleanup, even after a successful owner ACK. */
export async function settleDecision(center, report, persist, destroy, primaryError, dispose) {
  return settleStage(report, { primaryError, persist, dispose, finish: options => center.finish(options), destroy });
}
