import { readFile, writeFile, open, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { transaction } from '../../../apps/server/src/database.js';

const rawInput = await readFile(new URL('./pg-input.json', import.meta.url));
const input = JSON.parse(rawInput.toString()) as {
  database: string; marker: string; adminApplication: string; subjectApplication: string; sourceSha256: string;
};
if (!/^flow_svc07_[a-f0-9]{12}$/.test(input.database) || !/^[a-f0-9-]{36}$/.test(input.marker)) throw new Error('Invalid fixed SVC07 fixture identity');
for (const application of [input.adminApplication, input.subjectApplication]) {
  if (!/^svc07-(admin|subject)-[a-f0-9]{12}$/.test(application)) throw new Error('Invalid SVC07 application identity');
}
if (input.adminApplication === input.subjectApplication) throw new Error('Admin and subject must differ');
const waitingSql = 'SELECT pg_sleep(10)';
let admin: Pool | undefined, subject: Pool | undefined;
let reservationOwned = false, creationAcknowledged = false, markerAcknowledged = false, primaryFailure = false;
let unexpectedPoolErrors = 0;
const facts = {
  inputSha256: createHash('sha256').update(rawInput).digest('hex'), database: input.database, marker: input.marker,
  startedAt: '', endedAt: '', creationRequested: false, subjects: [] as unknown[], cases: [] as unknown[],
  terminationRequests: 0, caseCleanupFailures: [] as { mode: string; reason: string }[],
  cleanup: { status: 'NOT_STARTED', poolEndAcknowledged: false, connectionsZero: false, databaseAbsent: false, adminEndAcknowledged: false },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function preserveFailure<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) { primaryFailure = true; throw error; }
}
async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('SVC07 observation deadline')), milliseconds);
      timer.unref();
    })]);
  } finally { clearTimeout(timer); }
}

beforeAll(() => preserveFailure(async () => {
  const connectionString = process.env.FLOW_SVC07_TEST_ADMIN;
  if (!connectionString) throw new Error('SVC07 requires its authorized local admin configuration');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('SVC07 requires local PostgreSQL');
  const source = await readFile(new URL('../../../apps/server/src/database.ts', import.meta.url));
  if (createHash('sha256').update(source).digest('hex') !== input.sourceSha256) throw new Error('Fixed product source changed');
  await lstat(new URL('./pg-result.json', import.meta.url)).then(
    () => { throw new Error('Existing SVC07 result must be preserved'); },
    error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; },
  );
  const reservation = await open(new URL('./pg-run-reservation.json', import.meta.url), 'wx', 0o600);
  reservationOwned = true;
  facts.startedAt = new Date().toISOString();
  try { await reservation.writeFile(JSON.stringify({ startedAt: facts.startedAt, database: input.database, marker: input.marker, inputSha256: facts.inputSha256 }) + '\n'); }
  finally { await reservation.close(); }
  admin = new Pool({ connectionString, application_name: input.adminApplication, max: 1, connectionTimeoutMillis: 1_000, statement_timeout: 1_500, query_timeout: 2_000 });
  admin.on('error', () => { unexpectedPoolErrors++; });
  expect((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [input.database])).rowCount).toBe(0);
  facts.creationRequested = true;
  await admin.query(`CREATE DATABASE "${input.database}"`);
  creationAcknowledged = true;
  await admin.query(`COMMENT ON DATABASE "${input.database}" IS '${input.marker}'`);
  markerAcknowledged = true;
  url.pathname = `/${input.database}`;
  subject = new Pool({ connectionString: url.href, application_name: input.subjectApplication, max: 1, connectionTimeoutMillis: 1_000, statement_timeout: 3_000, query_timeout: 4_000 });
  subject.on('error', () => { unexpectedPoolErrors++; });
  await subject.query('CREATE TABLE svc07_receipts (id text PRIMARY KEY)');
}));

type Identity = { pid: number; backend_start: string; state: string; query: string };
async function observeSubject(pid: number): Promise<Identity> {
  const row = (await admin!.query<Identity>(`SELECT pid,backend_start::text,state,query FROM pg_stat_activity
    WHERE pid=$1 AND datname=$2 AND application_name=$3 AND usename=current_user`, [pid, input.database, input.subjectApplication])).rows[0];
  if (!row) throw new Error('Subject identity unavailable; no termination permitted');
  return row;
}
async function terminateSubject(identity: Identity): Promise<void> {
  // A single guarded statement rechecks the full identity at the mutation site.
  facts.terminationRequests++;
  const rows = (await admin!.query<{ terminated: boolean }>(`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
    WHERE pid=$1 AND datname=$2 AND application_name=$3 AND usename=current_user AND backend_start=$4::timestamptz`,
    [identity.pid, input.database, input.subjectApplication, identity.backend_start])).rows;
  expect(rows).toEqual([{ terminated: true }]);
}

it.each(['idle', 'query'] as const)('handles a real %s borrowed disconnect and a later transaction on the same pool', mode => preserveFailure(async () => {
  const entered = deferred<number>(), releaseWork = deferred<void>(), ended = deferred<void>();
  let settled = false, calls = 0, caseFailed = false;
  const pending = transaction(subject!, async client => {
    calls++;
    client.once('end', () => ended.resolve()); // Observe completion without adding an error listener.
    const pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
    await client.query('INSERT INTO svc07_receipts(id) VALUES($1)', [mode]);
    entered.resolve(pid);
    if (mode === 'idle') await releaseWork.promise;
    else await client.query(waitingSql);
    return 'unexpected success';
  }).then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error })).finally(() => { settled = true; });
  try {
    const pid = await bounded(entered.promise, 1_500);
    let identity = await observeSubject(pid);
    const deadline = performance.now() + 1_000;
    while (mode === 'query' && (identity.state !== 'active' || identity.query !== waitingSql)) {
      if (performance.now() >= deadline) throw new Error('Own pending query was not observed');
      await sleep(20); identity = await observeSubject(pid);
    }
    if (mode === 'idle') expect(identity.state).toBe('idle in transaction');
    facts.subjects.push({ mode, pid, backendStart: identity.backend_start, application: input.subjectApplication, stateBefore: identity.state });
    await terminateSubject(identity);
    await bounded(ended.promise, 1_500);
    if (mode === 'idle') {
      expect(settled).toBe(false);
      expect(subject!.idleCount).toBe(0);
      expect(subject!.totalCount).toBe(1);
    }
    releaseWork.resolve();
    const outcome = await bounded(pending, 1_500);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('Disconnected transaction reported success');
    expect(outcome.error).toBeInstanceOf(Error);
    expect(calls).toBe(1);
    expect(subject!.totalCount).toBe(0);
    const recoveredPid = await transaction(subject!, async client => {
      await client.query('INSERT INTO svc07_receipts(id) VALUES($1)', [`${mode}-recovered`]);
      return (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
    });
    const recoveredIdentity = await observeSubject(recoveredPid);
    expect(recoveredPid !== pid || recoveredIdentity.backend_start !== identity.backend_start).toBe(true);
    const ids = await transaction(subject!, async client => (await client.query<{ id: string }>('SELECT id FROM svc07_receipts WHERE id=$1 OR id=$2 ORDER BY id', [mode, `${mode}-recovered`])).rows.map(row => row.id), true);
    expect(ids).toEqual([`${mode}-recovered`]);
    expect(unexpectedPoolErrors).toBe(0);
    facts.cases.push({ mode, originalPid: pid, recoveredPid, recoveredBackendStart: recoveredIdentity.backend_start, calls, acknowledgedResult: false, publicEndObserved: true, originalWriteAbsent: true, subsequentCommitConfirmed: true });
  } catch (error) {
    caseFailed = true;
    throw error;
  } finally {
    releaseWork.resolve();
    try { await bounded(pending, 4_000); }
    catch (error) {
      facts.caseCleanupFailures.push({ mode, reason: 'Pending transaction cleanup did not settle within its bound' });
      if (!caseFailed) throw error;
    }
  }
}));

afterAll(async () => {
  if (!reservationOwned) return; // Never overwrite an earlier attempt's evidence.
  let cleanupFailed = false;
  try {
    if (subject) { await bounded(subject.end(), 4_000); facts.cleanup.poolEndAcknowledged = true; }
    if (admin && facts.creationRequested) {
      const observed = (await admin.query<{ marker: string | null }>("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [input.database])).rows;
      if (observed.length) {
        if (!creationAcknowledged || !markerAcknowledged || observed[0]!.marker !== input.marker) throw new Error('Database ownership is unconfirmed; retain');
        const deadline = performance.now() + 1_000;
        while (true) {
          const count = (await admin.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [input.database])).rows[0]!.count;
          if (count === 0) { facts.cleanup.connectionsZero = true; break; }
          if (performance.now() >= deadline) throw new Error('Own database still has connections; retain');
          await sleep(20);
        }
        await admin.query(`DROP DATABASE "${input.database}"`);
      }
      facts.cleanup.databaseAbsent = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [input.database])).rowCount === 0;
      if (!facts.cleanup.databaseAbsent) throw new Error('Database absence unconfirmed');
    }
    if (unexpectedPoolErrors) throw new Error('Unexpected pool error occurred');
    facts.cleanup.status = facts.creationRequested ? 'CONFIRMED' : 'NOT_CREATED';
  } catch { cleanupFailed = true; facts.cleanup.status = 'UNKNOWN'; }
  finally {
    try { if (admin) { await bounded(admin.end(), 4_000); facts.cleanup.adminEndAcknowledged = true; } }
    catch { cleanupFailed = true; facts.cleanup.status = 'UNKNOWN'; }
    facts.endedAt = new Date().toISOString();
    try { await writeFile(new URL('./pg-result.json', import.meta.url), JSON.stringify({ ...facts, primaryFailure, unexpectedPoolErrors }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch {
      cleanupFailed = true;
      console.error('SVC07 result was not saved; evidence remains UNKNOWN and existing output must be preserved.');
    }
  }
  if (cleanupFailed && !primaryFailure) throw new Error('SVC07 cleanup/evidence unknown; retain fixture identity');
});
