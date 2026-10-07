import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ClaimedTask } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';

const input = JSON.parse(await readFile(new URL('./http-input.json', import.meta.url), 'utf8')) as {
  database: string; marker: string; adminApplication: string; serverApplication: string; sourceSha256: string;
  workMilliseconds: number; cleanupMilliseconds: number; maxHttpRequests: number; maxResponseBytes: number;
};
if (!/^flow_svc07_http_[a-f0-9]{12}$/.test(input.database) || !/^[a-f0-9-]{36}$/.test(input.marker)) throw new Error('Invalid HTTP fixture identity');
let admin: Pool | undefined, app: Awaited<ReturnType<typeof createServer>> | undefined;
let startup: Promise<void> | undefined, closing: Promise<void> | undefined, startupSettled = true;
let reservationOwned = false, creationRequested = false, creationAcknowledged = false, primaryFailure = false;
let databaseIdentity: { oid: string; marker: string } | undefined;
let databaseUrl = '', baseUrl = '', workUntil = 0, cleanupUntil = 0;
const ownerToken = randomUUID();
const facts = { startedAt: '', endedAt: '', database: input.database, marker: input.marker, httpRequests: 0,
  listeners: [] as { origin: string; closed: boolean }[], assertions: [] as string[], primaryPhases: [] as string[], secondaryFailures: [] as string[],
  cleanup: { startupSettled: false, appClosed: false, connectionsZero: false, databaseAbsent: false, adminClosed: false, status: 'NOT_STARTED' }, unexpectedAdminErrors: 0 };

async function persist(name: string, value: unknown) {
  const file = await open(new URL(name, import.meta.url), 'wx', 0o600);
  let failed = false;
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  catch (error) { failed = true; throw error; }
  finally { try { await file.close(); } catch (error) { if (!failed) throw error; facts.secondaryFailures.push('EVIDENCE_CLOSE_UNKNOWN'); } }
}
async function bounded<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SVC07 HTTP operation deadline')), Math.max(1, deadline - Date.now())); })]); }
  finally { clearTimeout(timer); }
}
async function preserveFailure<T>(phase: string, action: () => Promise<T>) {
  try { return await action(); }
  catch (error) { primaryFailure = true; facts.primaryPhases.push(phase); throw error; }
}
async function identity() {
  return (await admin!.query<{ oid: string; marker: string | null }>("SELECT oid::text,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [input.database])).rows[0];
}
async function openServer() {
  startupSettled = false; closing = undefined;
  startup = (async () => {
    app = await createServer({ databaseUrl, ownerToken, automaticQueueScan: false, leaseMs: 300000 });
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    facts.listeners.push({ origin: baseUrl, closed: false });
    await persist(`./http-server-${facts.listeners.length}.json`, { database: input.database, identity: databaseIdentity, application: input.serverApplication, origin: baseUrl, at: new Date().toISOString() });
  })().finally(() => { startupSettled = true; });
  await bounded(startup, workUntil);
}
async function closeServer() {
  if (!app) return;
  return closing ??= (async () => {
    await app!.close();
    if (app!.server.listening) throw new Error('Owned listener closure was not confirmed');
    const listener = facts.listeners.at(-1); if (listener) listener.closed = true;
    app = undefined;
  })(); // A later cleanup waits on the same close operation; it does not retry unknown close.
}
async function request(path: string, method = 'GET', payload?: object, token: string = ownerToken, key?: string) {
  if (++facts.httpRequests > input.maxHttpRequests || Date.now() >= workUntil) throw new Error('HTTP request budget exhausted');
  const response = await fetch(baseUrl + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(payload ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(Math.max(1, Math.min(2000, workUntil - Date.now()))) });
  const chunks: Uint8Array[] = []; let bytes = 0;
  const reader = response.body!.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > input.maxResponseBytes) { await reader.cancel(); throw new Error('HTTP response exceeded the fixture budget'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return { status: response.status, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
}

beforeAll(() => preserveFailure('setup', async () => {
  if (process.env.FLOW_SVC07_HTTP_OPEN !== '1' || !process.env.FLOW_SVC07_TEST_ADMIN) throw new Error('SVC07 HTTP window is not open');
  let url: URL;
  try { url = new URL(process.env.FLOW_SVC07_TEST_ADMIN); } catch { throw new Error('Invalid authorized admin configuration'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('SVC07 HTTP requires local PostgreSQL');
  workUntil = Number(process.env.FLOW_SVC07_HTTP_WORK_UNTIL); cleanupUntil = Number(process.env.FLOW_SVC07_HTTP_CLEANUP_UNTIL);
  if (!Number.isSafeInteger(workUntil) || !Number.isSafeInteger(cleanupUntil) || workUntil <= Date.now() || cleanupUntil < workUntil || cleanupUntil - Date.now() > 60000) throw new Error('Explicit outer deadlines are required');
  const source = await readFile(new URL('../../../apps/server/src/database.ts', import.meta.url));
  if (createHash('sha256').update(source).digest('hex') !== input.sourceSha256) throw new Error('Reviewed transaction source changed');
  for (const name of ['http-result.json', 'http-database.json', 'http-server-1.json', 'http-server-2.json']) {
    await lstat(new URL(name, import.meta.url)).then(() => { throw new Error('Existing HTTP evidence must be preserved'); }, error => { if (error.code !== 'ENOENT') throw error; });
  }
  facts.startedAt = new Date().toISOString();
  await persist('./http-run-reservation.json', { database: input.database, marker: input.marker, at: facts.startedAt, pid: process.pid }); reservationOwned = true;
  url.pathname = '/postgres'; url.searchParams.set('application_name', input.adminApplication);
  admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 2500 });
  admin.on('error', () => { facts.unexpectedAdminErrors++; });
  if (await identity()) throw new Error('Refusing an existing database');
  creationRequested = true; await admin.query(`CREATE DATABASE "${input.database}"`); creationAcknowledged = true;
  await admin.query(`COMMENT ON DATABASE "${input.database}" IS '${input.marker}'`);
  const created = await identity(); if (!created || created.marker !== input.marker) throw new Error('Database ownership was not confirmed');
  databaseIdentity = { oid: created.oid, marker: created.marker };
  await persist('./http-database.json', { database: input.database, identity: databaseIdentity, creationAcknowledged, at: new Date().toISOString() });
  url.pathname = `/${input.database}`; url.searchParams.set('application_name', input.serverApplication); databaseUrl = url.href;
  await openServer();
}));

it('retains concurrent claim, command replay, restart and cancellation semantics over real HTTP', () => preserveFailure('consumer', async () => {
  const submission = { title: 'SVC07 owned HTTP consumer', prompt: 'No provider execution', harness: 'fixture' };
  const key = randomUUID();
  expect((await request('/api/tasks', 'GET', undefined, '')).status).toBe(401);
  const register = async () => {
    const response = await request('/api/runners', 'POST', { name: 'SVC07 fixture runner', harnesses: ['fixture'], capacity: 1 }, ownerToken, randomUUID());
    expect(response.status).toBe(200); return response.body as { runnerId: string; token: string };
  };
  const a = await register(), b = await register();
  const accepted = await Promise.all([request('/api/tasks', 'POST', submission, ownerToken, key), request('/api/tasks', 'POST', submission, ownerToken, key)]);
  expect(accepted.map(value => value.status)).toEqual([202, 202]);
  expect(accepted.map(value => value.body.replayed).sort()).toEqual([false, true]);
  const task = accepted[0]!.body.task; expect(accepted[1]!.body.task).toEqual(task); facts.assertions.push('concurrent-command-replay');
  await bounded(closeServer(), workUntil); await openServer();
  const replay = await request('/api/tasks', 'POST', submission, ownerToken, key);
  expect(replay.status).toBe(202); expect(replay.body).toEqual({ task, replayed: true });
  expect((await request('/api/tasks', 'POST', { ...submission, prompt: 'changed' }, ownerToken, key)).status).toBe(409);
  expect((await request(`/api/tasks/${task.id}`)).body).toMatchObject({ id: task.id, prompt: submission.prompt, status: 'queued' });
  expect((await request('/api/tasks')).body.tasks).toHaveLength(1); facts.assertions.push('same-db-restart-replay-and-changed-payload-rejected');
  const claims = await Promise.all([request('/api/runner/claim', 'POST', {}, a.token), request('/api/runner/claim', 'POST', {}, b.token)]);
  expect(claims.map(value => value.status)).toEqual([200, 200]);
  expect(claims.filter(value => value.body.assignment)).toHaveLength(1);
  const winner = claims[0]!.body.assignment ? a : b;
  const assignment = claims.find(value => value.body.assignment)!.body.assignment as ClaimedTask;
  expect(assignment.task.id).toBe(task.id); facts.assertions.push('two-runner-claim-exactly-once');
  expect((await request(`/api/tasks/${task.id}/cancel`, 'POST', {}, ownerToken, randomUUID())).status).toBe(200);
  const completed = await request('/api/runner/events', 'POST', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: [{ id: 'done', sequence: 1, type: 'completed', outcome: 'cancelled' }] }, winner.token);
  expect(completed.status).toBe(200);
  expect((await request(`/api/tasks/${task.id}`)).body).toMatchObject({ status: 'cancelled', entries: [{ text: 'Cancellation requested.' }] });
  const queued = (await request('/api/tasks', 'POST', submission, ownerToken, randomUUID())).body.task;
  expect((await request(`/api/tasks/${queued.id}/cancel`, 'POST', {}, ownerToken, randomUUID())).body.status).toBe('cancelled');
  expect((await request('/api/runner/claim', 'POST', {}, winner.token)).body.assignment).toBeNull();
  expect((await request(`/api/runners/${winner.runnerId}/revoke`, 'POST', {}, ownerToken, randomUUID())).body).toEqual({ revoked: true });
  expect((await request('/api/runner/claim', 'POST', {}, winner.token)).status).toBe(401); facts.assertions.push('cancellation-history-and-revoked-runner');
}));

afterAll(async () => {
  if (!reservationOwned) return;
  let cleanupFailed = false;
  const settle = async (phase: string, action: () => Promise<void>) => {
    try { if (Date.now() >= cleanupUntil) throw new Error('Cleanup deadline'); await bounded(action(), Math.min(cleanupUntil, Date.now() + input.cleanupMilliseconds)); return true; }
    catch { cleanupFailed = true; facts.secondaryFailures.push(phase); return false; }
  };
  if (startup && !startupSettled) await settle('STARTUP_UNKNOWN', async () => { await startup!.catch(() => undefined); });
  facts.cleanup.startupSettled = startupSettled;
  facts.cleanup.appClosed = startupSettled && await settle('APP_CLOSE_UNKNOWN', closeServer);
  if (admin && creationRequested && facts.cleanup.appClosed) await settle('DATABASE_CLEANUP_UNKNOWN', async () => {
    const current = await identity();
    if (!current) { facts.cleanup.databaseAbsent = true; return; }
    if (!creationAcknowledged || !databaseIdentity || current.oid !== databaseIdentity.oid || current.marker !== databaseIdentity.marker) throw new Error('Keep database with unknown ownership');
    const deadline = Math.min(cleanupUntil, Date.now() + 2000);
    while (true) {
      const count = (await admin!.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [input.database])).rows[0]!.count;
      if (count === 0) { facts.cleanup.connectionsZero = true; break; }
      if (Date.now() >= deadline) throw new Error('Keep database with live connections');
      await sleep(25);
    }
    const beforeDrop = await identity();
    if (!beforeDrop || beforeDrop.oid !== databaseIdentity.oid || beforeDrop.marker !== databaseIdentity.marker) throw new Error('Database identity changed');
    await admin!.query(`DROP DATABASE "${input.database}"`);
    facts.cleanup.databaseAbsent = !(await identity());
    if (!facts.cleanup.databaseAbsent) throw new Error('Database absence unconfirmed');
  });
  facts.cleanup.adminClosed = !admin || await settle('ADMIN_CLOSE_UNKNOWN', async () => { await admin!.end(); });
  facts.cleanup.status = !cleanupFailed && facts.cleanup.appClosed && (!creationRequested || facts.cleanup.databaseAbsent) && facts.cleanup.adminClosed && facts.unexpectedAdminErrors === 0
    ? creationRequested ? 'CONFIRMED' : 'NOT_CREATED' : 'UNKNOWN';
  facts.endedAt = new Date().toISOString();
  try { await writeFile(new URL('./http-result.json', import.meta.url), JSON.stringify({ ...facts, creationRequested, creationAcknowledged, databaseIdentity, primaryFailure }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch { cleanupFailed = true; console.error('SVC07 HTTP result UNKNOWN; preserve all existing outputs and owned identities.'); }
  if ((cleanupFailed || facts.cleanup.status !== 'CONFIRMED') && !primaryFailure) throw new Error('SVC07 HTTP cleanup/evidence UNKNOWN; retain owned identities');
});
