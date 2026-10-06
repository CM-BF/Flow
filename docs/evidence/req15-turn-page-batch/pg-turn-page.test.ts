import { readFile, open, lstat } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate, sha256, transaction } from '../../../apps/server/src/database.js';
import { turnPage } from '../../../apps/server/src/conversations/queries.js';
import { readAssistantFinalPreviews } from '../../../apps/server/src/assistant/index.js';
import { seeds, seedReads, frozen, observed, mainConversation, foreignConversation, snapshotConversation } from './pg-fixture-data.js';
import { readObserver } from './pg-read-observer.js';

const rawInput = await readFile(new URL('./pg-input.json', import.meta.url));
const input = JSON.parse(rawInput.toString()) as { database: string; marker: string; adminApplication: string; subjectApplication: string; writerApplication: string };
const observer = readObserver();
const workDeadline = Number(process.env.FLOW_REQ15_WORK_DEADLINE), cleanupDeadline = Number(process.env.FLOW_REQ15_CLEANUP_DEADLINE);
let admin: Pool | undefined, subject: Pool | undefined, writer: Pool | undefined;
let reservationOwned = false, createAcknowledged = false, markerAcknowledged = false, primaryFailure = false;
let unexpectedPoolErrors = 0;
const pending = new Set<Promise<unknown>>();
const facts = {
  inputSha256: sha256(rawInput.toString()), database: input.database, marker: input.marker,
  startedAt: '', endedAt: '', creationRequested: false, databaseOid: null as number | null,
  subjectIdentity: null as { pid: number; backendStart: string; encoding: string } | null,
  writerIdentity: null as { pid: number; backend_start: string } | null,
  seed: null as Awaited<ReturnType<typeof seedReads>> | null, cases: [] as { id: string; passed: boolean; assertions: string[] }[],
  barrierCalls: 0, writerCommitAcknowledged: false,
  cleanup: { status: 'NOT_STARTED', originalsSettled: false, subjectEndAcknowledged: false, writerEndAcknowledged: false,
    connectionsZero: false, databaseAbsent: false, adminEndAcknowledged: false, secondaryFailures: [] as string[] },
};
function checkWork() { if (!Number.isFinite(workDeadline) || Date.now() >= workDeadline) throw new Error('REQ15 work deadline'); }
async function within<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!Number.isFinite(deadline) || Date.now() >= deadline) throw new Error('REQ15 observation deadline');
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('REQ15 observation deadline')), deadline - Date.now()); timer.unref(); })]);
  } finally { clearTimeout(timer); }
}
async function runWork(run: () => Promise<void>) {
  try {
    checkWork();
    if (primaryFailure || pending.size) throw new Error('Earlier operation failed or remains unsettled');
    const original = Promise.resolve().then(run); pending.add(original);
    void original.then(() => pending.delete(original), () => pending.delete(original));
    await within(original, workDeadline);
  } catch (error) { primaryFailure = true; throw error; }
}
async function exclusiveJson(name: string, value: unknown) {
  const body = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(body) > 32768) throw new Error('Evidence exceeds bounded JSON size');
  const file = await open(new URL(name, import.meta.url), 'wx', 0o600);
  try { await file.writeFile(body); await file.sync(); } finally { await file.close(); }
}
function pool(url: URL, application: string) {
  const ownUrl = new URL(url.href);
  ownUrl.searchParams.set('application_name', application);
  ownUrl.searchParams.set('statement_timeout', '2000');
  const value = new Pool({ connectionString: ownUrl.href, application_name: application, max: 1,
    connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 2500 });
  value.on('error', () => { unexpectedPoolErrors++; }); // Pool-owned idle errors are failures, not ignored successes.
  return value;
}
async function databaseIdentity() {
  return (await admin!.query<{ oid: number; marker: string | null; owned: boolean }>(
    "SELECT oid,shobj_description(oid,'pg_database') AS marker,datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned FROM pg_database WHERE datname=$1", [input.database])).rows;
}

beforeAll(() => runWork(async () => {
  if (process.env.FLOW_REQ15_PG_OPEN !== '1' || !process.env.FLOW_REQ15_TEST_ADMIN) throw new Error('Explicit REQ15 PG window required');
  if (!/^flow_req15_[a-f0-9]{12}$/.test(input.database) || !/^[a-f0-9-]{36}$/.test(input.marker)) throw new Error('Invalid fixed fixture identity');
  const suffix = input.database.slice('flow_req15_'.length);
  if (input.adminApplication !== `req15-admin-${suffix}` || input.subjectApplication !== `req15-subject-${suffix}` || input.writerApplication !== `req15-writer-${suffix}`) throw new Error('Application identities changed');
  if (!Number.isFinite(cleanupDeadline) || cleanupDeadline <= workDeadline) throw new Error('Invalid cleanup deadline');
  const url = new URL(process.env.FLOW_REQ15_TEST_ADMIN);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local PostgreSQL required');
  for (const name of ['pg-run-reservation.json', 'pg-database.json', 'pg-result.json']) {
    await lstat(new URL(name, import.meta.url)).then(() => { throw new Error('Existing output must be preserved'); }, error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
  }
  const reservation = await open(new URL('./pg-run-reservation.json', import.meta.url), 'wx', 0o600);
  reservationOwned = true; facts.startedAt = new Date().toISOString();
  try { await reservation.writeFile(JSON.stringify({ at: facts.startedAt, database: input.database, marker: input.marker, inputSha256: facts.inputSha256 }) + '\n'); await reservation.sync(); }
  finally { await reservation.close(); }
  url.pathname = '/postgres'; admin = pool(url, input.adminApplication);
  checkWork(); expect(await databaseIdentity()).toEqual([]);
  checkWork(); facts.creationRequested = true;
  await admin.query(`CREATE DATABASE "${input.database}"`); createAcknowledged = true;
  checkWork(); await admin.query(`COMMENT ON DATABASE "${input.database}" IS '${input.marker}'`); markerAcknowledged = true;
  checkWork(); const identity = (await databaseIdentity())[0];
  if (!identity || identity.marker !== input.marker || !identity.owned) throw new Error('New database identity unconfirmed');
  facts.databaseOid = identity.oid;
  await exclusiveJson('./pg-database.json', { database: input.database, marker: input.marker, oid: identity.oid, createAcknowledged, markerAcknowledged });
  checkWork(); url.pathname = `/${input.database}`;
  subject = pool(url, input.subjectApplication); writer = pool(url, input.writerApplication);
  const backend = (await subject.query<{ pid: number; backend_start: string; encoding: string }>(
    "SELECT pg_backend_pid() AS pid,backend_start::text,current_setting('client_encoding') AS encoding FROM pg_stat_activity WHERE pid=pg_backend_pid() AND datname=$1 AND application_name=$2", [input.database, input.subjectApplication])).rows[0];
  if (!backend || backend.encoding !== 'UTF8') throw new Error('Subject UTF8 identity unconfirmed');
  facts.subjectIdentity = { pid: backend.pid, backendStart: backend.backend_start, encoding: backend.encoding };
  checkWork(); await migrate(subject);
  await transaction(subject, async client => {
    for (const [version, name] of [[7, '007-conversations.sql'], [9, '009-assistant-messages.sql'], [25, '025-native-harness-sources.sql']] as const) {
      checkWork(); await client.query(await readFile(new URL(`../../../packages/storage/migrations/${name}`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO flow.migrations(version) VALUES($1)', [version]);
    }
    facts.seed = await seedReads(client, checkWork);
  });
  // Pool.query uses callback-form client.query internally. Observe only after setup,
  // when the subject consumer is exclusively Promise-form public transactions.
  checkWork(); const client = await subject.connect();
  try { observer.attach(client); } finally { client.release(); }
  subject.on('connect', observer.attach);
}));

function preview(value: string) { return value.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, ''); }
it('PG1 reads mixed 51-turn pages with paired identities, per-task ambiguity and measured UTF8 fields', () => runWork(async () => {
  const first = await observer.measure('mixed-first-50', () => turnPage(subject!, mainConversation, 0, 50));
  expect(first.value.turns.map(turn => turn.id)).toEqual(seeds.slice(0, 50).map(item => `req15-turn-${item.index}`));
  expect(first.value.nextCursor).toBe(50); expect(first.metric.turnLimits).toEqual([51]);
  expect(first.metric.taskProjectionIds).toEqual(seeds.slice(0, 50).map(item => item.taskId));
  expect(first.metric.queryCalls).toBeLessThanOrEqual(9);
  expect(first.metric.sqlControl).toEqual(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'COMMIT']);
  expect(first.metric.typedPrefixUtf8Bytes).toBeGreaterThan(0); expect(first.metric.legacyContentUtf8Bytes).toBeGreaterThan(0);
  expect(first.metric.fieldUtf8Bytes).toBe(first.metric.typedPrefixUtf8Bytes + first.metric.legacyContentUtf8Bytes + first.metric.otherFieldUtf8Bytes);
  for (const item of seeds.slice(0, 50)) {
    const turn = first.value.turns[item.index]!;
    expect(turn.task.title).toBe(`task-${item.index}`); expect(turn.user.text).toBe(`question-${item.index}`);
    if (item.reason) expect(turn.assistant).toEqual({ state: item.mode === 'pending' ? 'pending' : 'unavailable', reason: item.reason });
    else {
      expect(turn.assistant).toMatchObject({ state: 'available', text: preview(item.expectedText), truncated: preview(item.expectedText).length < item.expectedText.length });
      expect(turn.assistant).toMatchObject({ source: { taskId: item.taskId, attemptId: item.attemptId, kind: item.mode === 'legacy' ? 'adapter-final-artifact' : 'assistant-final' } });
    }
  }
  expect(first.value.turns[0]!.messageSettings).toEqual(frozen);
  expect(first.value.turns[0]!.effective).toMatchObject({ model: 'actual', messageSettings: { snapshot: frozen, observed } });
  expect(first.value.turns[3]!.effective).toMatchObject({ model: 'legacy-model', thinking: 'disabled', source: { kind: 'recorded-adapter-session' } });
  expect(first.value.turns[1]!.assistant).toMatchObject({ state: 'available', text: '汉'.repeat(4000), truncated: true });
  expect(first.value.turns[0]!.assistant).toMatchObject({ state: 'available', text: 'a'.repeat(3999), source: { contentDigest: sha256(seeds[0]!.body) } });
  checkWork();
  const second = await observer.measure('last-poisoned-turn', () => turnPage(subject!, mainConversation, 50, 50));
  expect(second.value.turns.map(turn => turn.number)).toEqual([51]); expect(second.value.nextCursor).toBeNull();
  expect(second.value.turns[0]!.assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
  const empty = await observer.measure('empty-page', () => turnPage(subject!, mainConversation, 51, 50));
  expect(empty.value.turns).toEqual([]); expect(empty.value.nextCursor).toBeNull(); expect(empty.metric.queryCalls).toBe(4);
  const foreign = await observer.measure('foreign-conversation', () => turnPage(subject!, foreignConversation, 0, 50));
  expect(foreign.value.turns.map(turn => turn.id)).toEqual(['req15-turn-51']);
  await expect(turnPage(subject!, 'missing-conversation', 0, 50)).rejects.toMatchObject({ status: 404, code: 'conversation_not_found' });
  checkWork();
  const a = seeds[0]!, b = seeds[1]!, corrupt = seeds[2]!;
  await transaction(subject!, async client => {
    const results = await readAssistantFinalPreviews(client, [
      { taskId: a.taskId, attemptId: b.attemptId }, { taskId: b.taskId, attemptId: a.attemptId },
      { taskId: a.taskId, attemptId: a.attemptId }, { taskId: corrupt.taskId, attemptId: corrupt.attemptId }, { taskId: b.taskId, attemptId: b.attemptId },
    ]);
    expect(results.slice(0, 2)).toEqual([{ preview: null }, { preview: null }]);
    expect(results[2]!.preview).toMatchObject({ taskId: a.taskId, text: 'a'.repeat(3999), contentDigest: sha256(a.body), truncated: true });
    expect(results[3]!.error).toMatchObject({ code: 'assistant_content_mismatch' });
    expect(results[4]!.preview).toMatchObject({ taskId: b.taskId, text: '汉'.repeat(4000), contentDigest: sha256(b.body) });
    const row = (await client.query<{ prefix_equal: boolean; digest_changed: boolean }>(`SELECT left(content,4000)=left($2,4000) AS prefix_equal,
      encode(sha256(convert_to(content,'UTF8')),'hex')<>$3 AS digest_changed FROM flow.details WHERE id=$1`, [corrupt.detailId, corrupt.body, sha256(corrupt.body)])).rows[0];
    expect(row).toEqual({ prefix_equal: true, digest_changed: true });
  }, true);
  expect(unexpectedPoolErrors).toBe(0);
  facts.cases.push({ id: 'PG1', passed: true, assertions: ['50+1/order/foreign/empty/404', 'paired task+attempt', 'per-task session/artifact LIMIT2',
    'current owner/session runner+harness', 'full digest with identical prefix', 'typed invalid has no legacy fallback', 'UTF16 and UTF8 distinction', 'frozen/observed settings', 'serial query/ReadyForQuery and field-byte measurements'] });
}));

it('PG2 retains the old task/reply pair in one RR snapshot after the writer COMMIT ACK', () => runWork(async () => {
  const item = seeds[52]!, newTitle = 'committed-title', newBody = 'committed-reply-🙂';
  observer.setBarrier(async () => {
    facts.barrierCalls++; checkWork();
    await transaction(writer!, async client => {
      const identity = (await client.query<{ pid: number; backend_start: string }>(
        'SELECT pid,backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid() AND datname=$1 AND application_name=$2', [input.database, input.writerApplication])).rows[0];
      if (!identity) throw new Error('Writer identity unconfirmed');
      facts.writerIdentity = identity;
      await client.query("UPDATE flow.tasks SET submission=jsonb_set(submission,'{title}',to_jsonb($2::text)) WHERE id=$1", [item.taskId, newTitle]);
      await client.query('UPDATE flow.details SET content=$2 WHERE id=$1', [item.detailId, newBody]);
      await client.query('UPDATE flow.assistant_messages SET content_digest=$2 WHERE task_id=$1', [item.taskId, sha256(newBody)]);
    });
    facts.writerCommitAcknowledged = true;
  });
  try {
    const old = await observer.measure('snapshot-before-writer', () => turnPage(subject!, snapshotConversation, 0, 50));
    expect(facts.barrierCalls).toBe(1); expect(facts.writerCommitAcknowledged).toBe(true);
    expect(old.value.turns).toHaveLength(1);
    expect(old.value.turns[0]!).toMatchObject({ task: { title: 'task-52' }, assistant: { state: 'available', text: item.body, source: { contentDigest: sha256(item.body) } } });
    checkWork();
    const current = await observer.measure('snapshot-after-writer', () => turnPage(subject!, snapshotConversation, 0, 50));
    expect(current.value.turns[0]!).toMatchObject({ task: { title: newTitle }, assistant: { state: 'available', text: newBody, source: { contentDigest: sha256(newBody) } } });
    expect(observer.connected).toBe(1); expect(unexpectedPoolErrors).toBe(0);
    facts.cases.push({ id: 'PG2', passed: true, assertions: ['real task-row read barrier', 'writer COMMIT ACK precedes later subject reads', 'same-client RR old pair', 'next transaction new pair'] });
  } finally { observer.setBarrier(); }
}));

function cleanupWork<T>(run: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(cleanupDeadline) || Date.now() >= cleanupDeadline) return Promise.reject(new Error('REQ15 cleanup deadline'));
  return within(run(), cleanupDeadline);
}
afterAll(async () => {
  if (!reservationOwned) return;
  let cleanupFailed = false;
  try {
    await cleanupWork(() => Promise.allSettled([...pending])); facts.cleanup.originalsSettled = true;
    if (subject) { await cleanupWork(() => subject!.end()); facts.cleanup.subjectEndAcknowledged = true; }
    if (writer) { await cleanupWork(() => writer!.end()); facts.cleanup.writerEndAcknowledged = true; }
    subject?.removeListener('connect', observer.attach);
    observer.detach(); // Only our own connection listeners/query wrapper; no driver listeners removed.
    if (admin && facts.creationRequested) {
      const rows = await cleanupWork(databaseIdentity);
      if (rows.length) {
        const row = rows[0]!;
        if (!createAcknowledged || !markerAcknowledged || facts.databaseOid === null || rows.length !== 1 || row.oid !== facts.databaseOid || row.marker !== input.marker || !row.owned) throw new Error('Database identity unknown; retain');
        const count = (await cleanupWork(() => admin!.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datid=$1', [facts.databaseOid]))).rows[0]!.count;
        if (count !== 0) throw new Error('Database connections remain; retain');
        facts.cleanup.connectionsZero = true;
        const again = await cleanupWork(databaseIdentity);
        if (again.length !== 1 || again[0]!.oid !== row.oid || again[0]!.marker !== input.marker || !again[0]!.owned) throw new Error('Database identity changed; retain');
        await cleanupWork(() => admin!.query(`DROP DATABASE "${input.database}"`));
      } else if (!createAcknowledged || !markerAcknowledged) throw new Error('CREATE/marker outcome unknown; retain identity');
      facts.cleanup.databaseAbsent = (await cleanupWork(databaseIdentity)).length === 0;
      if (!facts.cleanup.databaseAbsent) throw new Error('Database absence unconfirmed');
    }
    if (unexpectedPoolErrors) throw new Error('Unexpected pool error');
    facts.cleanup.status = facts.creationRequested ? 'CONFIRMED' : 'NOT_CREATED';
  } catch { cleanupFailed = true; facts.cleanup.status = 'UNKNOWN'; facts.cleanup.secondaryFailures.push('Original operations, pool close, ownership or DROP not confirmed'); }
  finally {
    // Do not close a resource still owned by an unsettled setup/case operation.
    if (admin && facts.cleanup.originalsSettled) {
      try { await cleanupWork(() => admin!.end()); facts.cleanup.adminEndAcknowledged = true; }
      catch { cleanupFailed = true; facts.cleanup.status = 'UNKNOWN'; facts.cleanup.secondaryFailures.push('Admin close not confirmed'); }
    }
    facts.endedAt = new Date().toISOString();
    try { await exclusiveJson('./pg-result.json', { ...facts, primaryFailure, unexpectedPoolErrors, subjectConnections: observer.connected, measurements: observer.measurements }); }
    catch { cleanupFailed = true; console.error('REQ15 result output is UNKNOWN; preserve existing evidence and fixture identity.'); }
  }
  if (cleanupFailed && !primaryFailure) throw new Error('REQ15 cleanup/evidence unknown; retain owned identity');
});
