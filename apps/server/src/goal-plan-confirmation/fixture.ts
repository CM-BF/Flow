import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdtemp, open, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { createServer } from '../index.js';
import { migrateGoalProgressions, registerGoalProgressionRoutes, scanGoalProgressions } from '../goal-progression/index.js';
import { migrateGoalPlanConfirmations, registerGoalPlanConfirmationRoutes } from './index.js';

/** Own marked database and evidence; no provider transport, shared DB, install or new scheduling loop. */
export async function confirmationFixture() {
  const allowance = Number(process.env.FLOW_O15_PG_ALLOWANCE_BYTES);
  assert(Number.isSafeInteger(allowance) && allowance >= 32 * 1024 ** 2, 'Lead/Web PG window and measured allowance required before DB creation.');
  const space = await statfs('.');
  assert(space.bavail * space.bsize >= 1024 ** 3 + allowance, 'O15 reserve gate: no DB created.');
  const name = `flow_o15_${randomUUID().replaceAll('-', '')}`, marker = randomUUID(), token = randomUUID();
  const evidencePath = `docs/evidence/o15/${name}-facts.json`;
  const evidence = await open(evidencePath, 'wx', 0o600);
  const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', database = new URL(adminUrl); database.pathname = '/' + name;
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 });
  const pool = new Pool({ connectionString: database.href, max: 3, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 });
  const boss = new PgBoss({ connectionString: database.href, max: 1 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, created = false, marked = false, directory = '', baseUrl = '', drop = '';
  let directoryIdentity: { dev: number; ino: number } | undefined;
  const runtimes: { stop: AbortController; promise: Promise<void> }[] = [];
  const facts: Record<string, unknown> = { database: name, marker, allowanceBytes: allowance, reserveBeforeBytes: space.bavail * space.bsize,
    providerCalls: 0, evidencePath, lifecycle: 'module routes and explicit sweep; not production automatic integration' };
  async function checkpoint(phase: string) {
    const bytes = Buffer.from(JSON.stringify({ ...facts, phase }, null, 2) + '\n');
    assert(bytes.length <= 32768, 'O15 evidence checkpoint exceeds its bound.');
    assert.equal((await evidence.write(bytes, 0, bytes.length, 0)).bytesWritten, bytes.length);
    await evidence.truncate(bytes.length); await evidence.sync();
  }
  async function observeClosedConnections() {
    const started = performance.now(), deadline = started + 3000;
    const observations: unknown[] = []; facts.connectionObservations = observations;
    for (;;) {
      const remaining = deadline - performance.now();
      assert(remaining > 0, 'O15 connections did not close within the observation bound.');
      try {
        const query = { text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', values: [name], query_timeout: Math.min(500, Math.ceil(remaining)) };
        const result = await admin.query(query); facts.connections = result.rows;
        observations.push({ elapsedMs: Math.floor(performance.now() - started), connections: result.rows });
        assert(result.rows.length <= 32, 'O15 connection observation exceeds its bound.');
        assert(performance.now() <= deadline, 'O15 connection observation deadline elapsed.');
        if (result.rows.length === 0) return;
      } catch {
        observations.push({ elapsedMs: Math.floor(performance.now() - started), error: 'connection-observation-failed' });
        throw new Error('O15 connection observation is unconfirmed.');
      }
      await delay(Math.min(100, Math.max(0, deadline - performance.now())));
    }
  }
  async function assertOwnedDirectory() {
    assert(directoryIdentity, 'O15 directory ownership is unconfirmed.');
    const current = await lstat(directory);
    assert(current.isDirectory() && current.dev === directoryIdentity.dev && current.ino === directoryIdentity.ino, 'O15 directory identity changed.');
  }
  async function start() {
    app = await createServer({ databaseUrl: database.href, ownerToken: token, automaticQueueScan: false, leaseMs: 30_000 });
    await migrateGoalProgressions(pool);
    if (!app.hasRoute({ method: 'POST', url: '/api/goals/:id/progressions' })) registerGoalProgressionRoutes(app, pool);
    await migrateGoalPlanConfirmations(pool);
    if (!app.hasRoute({ method: 'POST', url: '/api/goal-graph-proposals/:id/confirm-inputs' })) registerGoalPlanConfirmationRoutes(app, pool, boss);
    app.addHook('onError', async (_request, _reply, error) => { ((facts.errors ??= []) as unknown[]).push({ name: error.name, code: error.code, message: error.message }); });
    app.addHook('onSend', async (request, reply) => { if (drop && request.url === drop && reply.statusCode < 300) { drop = ''; reply.raw.destroy(); } });
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, key: string = randomUUID(), credential: string = token) {
    const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const text = await response.text(); return { status: response.status, body: JSON.parse(text), bytes: Buffer.byteLength(text) };
  }
  async function close() {
    try {
      for (const runtime of runtimes) runtime.stop.abort(); await Promise.all(runtimes.map(runtime => runtime.promise));
      facts.runtimeCount = runtimes.length; facts.runtimeStopped = true;
      await app?.close(); await boss.stop(); await pool.end();
      facts.appBossPoolClosed = true;
      if (directory) await assertOwnedDirectory();
      if (created) {
        assert(marked, 'O15 database marker was not confirmed.');
        facts.databaseBytesBeforeDrop = (await admin.query('SELECT pg_database_size($1) AS bytes', [name])).rows[0].bytes;
        const available = await statfs('.'); facts.freeBeforeDropBytes = available.bavail * available.bsize;
        assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [name])).rows[0].marker, marker);
        await observeClosedConnections(); await checkpoint('before-normal-drop');
        await admin.query(`DROP DATABASE "${name}"`);
        facts.databaseDropped = true;
      } else assert(!facts.creationRequested, 'O15 database creation outcome is unknown.');
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; assert.deepEqual(facts.remaining, []);
      if (directory) {
        await assertOwnedDirectory(); await checkpoint('before-owned-directory-remove');
        await rm(directory, { recursive: true });
        const remaining = await lstat(directory).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
        assert(!remaining); facts.directoryRemoved = true;
      }
      facts.cleanupComplete = true;
    } catch (error) {
      facts.cleanupError = 'resource-close-unconfirmed'; throw error;
    } finally {
      try { await admin.end(); facts.adminClosed = true; }
      finally { try { await checkpoint(facts.cleanupComplete && facts.adminClosed ? 'cleaned' : 'unknown-retain-resources'); } finally { await evidence.close(); } }
    }
  }
  try {
    await checkpoint('database-marker-reserved');
    const parent = await open(dirname(evidencePath), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
    facts.evidenceDirectorySynced = true; await checkpoint('reservation-durable');
    console.info(JSON.stringify({ o15Evidence: evidencePath, database: name }));
    assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows, []);
    facts.creationRequested = true; await checkpoint('before-create');
    await admin.query(`CREATE DATABASE "${name}"`); created = true; facts.created = true; await checkpoint('created-awaiting-marker');
    await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`); marked = true; facts.marked = true; await checkpoint('marked');
    directory = await mkdtemp(join(tmpdir(), 'flow-o15-'));
    const identity = await lstat(directory); directoryIdentity = { dev: identity.dev, ino: identity.ino };
    facts.directory = { path: directory, ...directoryIdentity }; await checkpoint('owned-directory-created');
    await boss.start(); await start();
  } catch (error) { await close(); throw error; }
  const owner = () => new FlowClient({ baseUrl, token });
  return { pool, http, owner, close, facts, sweep: () => scanGoalProgressions(pool, boss),
    restart: async () => { await app!.close(); await start(); }, loseReply(path: string) { drop = path; },
    async goal() {
      const project = (await owner().createProject({ title: 'O15 explicit complete plan', workspaceId: 'personal' }, randomUUID())).snapshot.project;
      const goal = (await owner().createGoal({ projectId: project.id, originalGoal: 'Produce a bounded draft and review from fixed material.', constraints: 'Readonly synthetic test', acceptance: 'Independent owner decides meaning.' }, randomUUID())).goal;
      return { projectId: project.id, goalId: goal.id };
    },
    async harness(query: ClaudeQuery, graphTools = false) {
      const runner = await owner().registerRunner({ name: 'O15 injected SDK', harnesses: ['claude'], capacity: 1 });
      const material = join(directory, `${runner.runnerId}.txt`); await writeFile(material, 'Synthetic local material.', { mode: 0o600 });
      const options = { materialFiles: graphTools ? [] : [material], allowRead: !graphTools, requireReadApproval: false, goalGraphTools: graphTools,
        model: 'synthetic-no-provider', timeoutMs: 8000, maxTurns: 4, maxBudgetUsd: 0.1, query };
      const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
      const pin = (await new FlowClient({ baseUrl, token: runner.token }).publishExecutionProfile({ configuration })).profile.reference;
      return { runner, pin, async start() {
        const stop = new AbortController(); const promise = runRunner({ baseUrl, token: runner.token, workingDirectory: join(directory, runner.runnerId), adapters: [guardExecutionProfile(adapter, pin, configuration)], signal: stop.signal, pollIntervalMs: 20, heartbeatIntervalMs: 50 });
        runtimes.push({ stop, promise }); return { async close() { stop.abort(); await promise; } };
      } };
    },
  };
}
