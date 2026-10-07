import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ClaimedTask, RunnerEventData } from './http-main/packages/contracts/src/index.js';
import { createServer } from './http-main/apps/server/src/index.js';

const input = JSON.parse(await readFile(new URL('./http-input.json', import.meta.url), 'utf8')) as {
  database: string; marker: string; adminApplication: string; serverApplication: string; fixtureApplication: string; sourceSha256: string;
  workMilliseconds: number; cleanupMilliseconds: number; maxHttpRequests: number; maxResponseBytes: number;
};
if (!/^flow_req15_http_[a-f0-9]{12}$/.test(input.database) || !/^[a-f0-9-]{36}$/.test(input.marker)) throw new Error('Invalid HTTP fixture identity');
let pool: Pool;
let admin: Pool | undefined, app: Awaited<ReturnType<typeof createServer>> | undefined;
let startup: Promise<void> | undefined, closing: Promise<void> | undefined, startupSettled = true;
let reservationOwned = false, creationRequested = false, creationAcknowledged = false, primaryFailure = false;
let databaseIdentity: { oid: string; marker: string } | undefined;
let databaseUrl = '', baseUrl = '', workUntil = 0, cleanupUntil = 0;
const ownerToken = randomUUID();
const facts = { startedAt: '', endedAt: '', database: input.database, marker: input.marker, httpRequests: 0,
  listeners: [] as { origin: string; closed: boolean }[], assertions: [] as string[], primaryPhases: [] as string[], secondaryFailures: [] as string[],
  cleanup: { startupSettled: false, appClosed: false, fixtureClosed: false, connectionsZero: false, databaseAbsent: false, adminClosed: false, status: 'NOT_STARTED' }, unexpectedAdminErrors: 0, unexpectedFixtureErrors: 0 };

async function persist(name: string, value: unknown) {
  const file = await open(new URL(name, import.meta.url), 'wx', 0o600);
  let failed = false;
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  catch (error) { failed = true; throw error; }
  finally { try { await file.close(); } catch (error) { if (!failed) throw error; facts.secondaryFailures.push('EVIDENCE_CLOSE_UNKNOWN'); } }
}
async function bounded<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('REQ15 HTTP operation deadline')), Math.max(1, deadline - Date.now())); })]); }
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
async function request(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
  if (++facts.httpRequests > input.maxHttpRequests || Date.now() >= workUntil) throw new Error('HTTP request budget exhausted');
  const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(1, Math.min(2000, workUntil - Date.now()))) });
  const chunks: Uint8Array[] = []; let bytes = 0;
  const reader = response.body!.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > input.maxResponseBytes) { await reader.cancel(); throw new Error('HTTP response budget exhausted'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return { status: response.status, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
}

beforeAll(() => preserveFailure('setup', async () => {
  if (process.env.FLOW_REQ15_HTTP_OPEN !== '1' || !process.env.FLOW_REQ15_TEST_ADMIN) throw new Error('REQ15 HTTP window is not open');
  let url: URL;
  try { url = new URL(process.env.FLOW_REQ15_TEST_ADMIN); } catch { throw new Error('Invalid authorized admin configuration'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('REQ15 HTTP requires local PostgreSQL');
  workUntil = Number(process.env.FLOW_REQ15_HTTP_WORK_UNTIL); cleanupUntil = Number(process.env.FLOW_REQ15_HTTP_CLEANUP_UNTIL);
  if (!Number.isSafeInteger(workUntil) || !Number.isSafeInteger(cleanupUntil) || workUntil <= Date.now() || cleanupUntil < workUntil || cleanupUntil - Date.now() > 60000) throw new Error('Explicit outer deadlines are required');
  const source = await readFile(new URL('./http-main/apps/server/src/database.ts', import.meta.url));
  if (createHash('sha256').update(source).digest('hex') !== input.sourceSha256) throw new Error('Reviewed transaction source changed');
  for (const name of ['http-result.json', 'http-database.json', 'http-server-1.json']) {
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
  url.searchParams.set('application_name', input.fixtureApplication);
  pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 2500 });
  pool.on('error', () => { facts.unexpectedFixtureErrors++; });
}));

const digest = (content: string) => createHash('sha256').update(content).digest('hex');
async function newTurn() {
  const conversation = (await request('/api/conversations', { title: 'Protocol conversation fixture' })).body.conversation;
  const accepted = (await request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 0, text: 'first user message' })).body;
  return { conversation: accepted.conversation, turn: accepted.turn };
}
async function newRunner() {
  return (await request('/api/runners', { name: 'CHAT01 protocol fixture', harnesses: ['claude'], capacity: 1 })).body as { runnerId: string; token: string };
}
async function claim(token: string): Promise<ClaimedTask> {
  let assignment: ClaimedTask | undefined;
  await expect.poll(async () => { assignment = (await request('/api/runner/claim', {}, { token })).body.assignment; return assignment; }, { timeout: 4000 }).toBeTruthy();
  return assignment!;
}
async function report(token: string, assignment: ClaimedTask, events: RunnerEventData[], start = 1) {
  return request('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: events.map((event, index) => ({ ...event, sequence: start + index, id: randomUUID() })) }, { token });
}
function finalEvents(nativeSessionId: string, content = 'actual final reply'): RunnerEventData[] {
  const version = digest(content);
  return [
    { type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['sdk:0.3.290', 'model:synthetic-test-model', 'tool:Read'] },
    { type: 'message', text: 'TELEMETRY MUST NOT BECOME ASSISTANT TEXT' },
    { type: 'artifact', artifactId: 'result', title: 'A title is not reply authority', content, version, mediaType: 'text/plain' },
    { type: 'verification', artifactId: 'result', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: digest(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Synthetic protocol result' },
    { type: 'completed', outcome: 'succeeded' },
  ];
}
it('pages immutable turns and returns long assistant content only through an owned lazy detail', () => preserveFailure('consumer', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  expect((await request(`/api/conversations/${conversation.id}/turns`, undefined, { token: 'invalid' })).status).toBe(401);
  expect((await request(`/api/conversations/${conversation.id}/turns`, undefined, { token: runner.token })).status).toBe(403);
  const assignment = await claim(runner.token);
  const content = 'x' + '中文🙂'.repeat(1800);
  expect((await report(runner.token, assignment, finalEvents(randomUUID(), content))).status).toBe(200);
  const page = await request(`/api/conversations/${conversation.id}/turns?limit=1`);
  expect(page.status).toBe(200);
  expect(page.body.turns).toHaveLength(1);
  expect(page.body.turns[0].assistant).toMatchObject({ state: 'available', truncated: true });
  expect(page.body.turns[0].assistant.text.length).toBeLessThanOrEqual(4000);
  expect(/[\uD800-\uDBFF]$/.test(page.body.turns[0].assistant.text)).toBe(false);
  const ref = page.body.turns[0].assistant.contentRef;
  expect((await request(`/api/conversations/${conversation.id}/turns/${turn.id}/details/${ref.id}`)).body.content).toBe(content);
  const other = (await request('/api/conversations', { title: 'Other conversation' })).body.conversation;
  expect((await request(`/api/conversations/${other.id}/turns/${turn.id}/details/${ref.id}`)).status).toBe(404);
  expect((await request(`/api/conversations/${conversation.id}/turns/${randomUUID()}/details/${ref.id}`)).status).toBe(404);
  expect((await request(`/api/conversations/${conversation.id}/turns?after=1`)).body.turns).toEqual([]);
  expect((await request(`/api/conversations/${conversation.id}/turns?limit=51`)).status).toBe(400);
  const list = await request('/api/conversations?limit=1');
  expect(list.status).toBe(200);
  expect(list.body.conversations).toHaveLength(1);
  expect(list.body.nextCursor).toBe(list.body.conversations[0].id);
  expect((await request(`/api/conversations?after=${list.body.nextCursor}&limit=50`)).body.conversations.every((item: { id: string }) => item.id > list.body.nextCursor)).toBe(true);
  await expect(pool.query('UPDATE flow.conversation_turns SET user_text=$1 WHERE id=$2', ['forged input', turn.id])).rejects.toMatchObject({ code: '23514' });
  expect((await request(`/api/conversations/${conversation.id}/turns`)).body.turns[0].user.text).toBe('first user message');
  facts.assertions.push('original-paging-lazy-detail-case', 'page-401-403');
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
  facts.cleanup.fixtureClosed = !pool || await settle('FIXTURE_CLOSE_UNKNOWN', async () => { await pool.end(); });
  if (admin && creationRequested && facts.cleanup.appClosed && facts.cleanup.fixtureClosed) await settle('DATABASE_CLEANUP_UNKNOWN', async () => {
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
  facts.cleanup.status = !cleanupFailed && facts.cleanup.appClosed && facts.cleanup.fixtureClosed && (!creationRequested || facts.cleanup.databaseAbsent) && facts.cleanup.adminClosed && facts.unexpectedAdminErrors === 0 && facts.unexpectedFixtureErrors === 0
    ? creationRequested ? 'CONFIRMED' : 'NOT_CREATED' : 'UNKNOWN';
  facts.endedAt = new Date().toISOString();
  try { await writeFile(new URL('./http-result.json', import.meta.url), JSON.stringify({ ...facts, creationRequested, creationAcknowledged, databaseIdentity, primaryFailure }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch { cleanupFailed = true; console.error('REQ15 HTTP result UNKNOWN; preserve all existing outputs and owned identities.'); }
  if ((cleanupFailed || facts.cleanup.status !== 'CONFIRMED') && !primaryFailure) throw new Error('REQ15 HTTP cleanup/evidence UNKNOWN; retain owned identities');
});
