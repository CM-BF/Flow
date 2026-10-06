import { createHash, randomUUID } from 'node:crypto';
import { Client, Pool, type QueryResult } from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createServer } from '../index.js';
import type { StreamEvent } from './store.js';

const database = `flow_chat06p02_${randomUUID().replaceAll('-', '')}`;
// Existing local development fixture configuration; never a shared product database.
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const owner = 'chat06p02-synthetic-owner';
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let base: string, created = false;
const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const tile = 'A中🙂e\u0301\\_%\r\n';

beforeAll(async () => {
  expect((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows).toEqual([]);
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  console.log('CHAT06P02_DATABASE', JSON.stringify({ database, version: (await pool.query('SHOW server_version')).rows[0].server_version }));
  app = await createServer({ databaseUrl, ownerToken: owner, leaseMs: 300_000, automaticQueueScan: false });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => {
  try { if (app) { app.server.closeAllConnections(); await app.close(); } }
  finally {
    await pool.end();
    try {
      if (created) {
        const deadline = Date.now() + 2000;
        let connections: { pid: number }[];
        do {
          connections = (await admin.query<{ pid: number }>('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
          if (connections.length) await new Promise(resolve => setTimeout(resolve, 50));
        } while (connections.length && Date.now() < deadline);
        expect(connections).toEqual([]);
        await admin.query(`DROP DATABASE ${database}`);
        const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
        console.log('CHAT06P02_CLEANUP', JSON.stringify({ database, connections, remaining }));
        expect(remaining).toEqual([]);
      }
    } finally { await admin.end(); }
  }
});

async function request(path: string, body?: unknown, token = owner, status = 200) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(status);
  return value;
}
async function attempt() {
  const runner = await request('/api/runners', { name: 'Prefix hash fixture', harnesses: ['claude'], capacity: 1 });
  const task = (await request('/api/tasks', { title: 'Prefix hash behavior', prompt: 'No provider', harness: 'claude' }, owner, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const claim = await request('/api/runner/claim', {}, runner.token);
  expect(claim.assignment.task.id).toBe(task.id);
  const nativeSessionId = randomUUID(), nativeMessageId = randomUUID();
  return { taskId: task.id as string, token: runner.token as string, nativeSessionId, nativeMessageId,
    streamId: digest(JSON.stringify([nativeSessionId, nativeMessageId, 0])),
    ownership: { attemptId: claim.assignment.attempt.id as string, ownerVersion: claim.assignment.attempt.ownerVersion as number },
    session: { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v2' } };
}
type Attempt = Awaited<ReturnType<typeof attempt>>;
function patch(a: Attempt, text: string, prior = '', revision = 1, phase: StreamEvent['phase'] = 'streaming'): StreamEvent {
  return { id: randomUUID(), sequence: revision + 1, type: 'assistant-stream', streamId: a.streamId,
    nativeSessionId: a.nativeSessionId, nativeMessageId: a.nativeMessageId, parentToolUseId: null,
    source: 'claude.sdk.stream', sourceMessageId: randomUUID(), blockIndex: 0, revision,
    fromBytes: Buffer.byteLength(prior), text, prefixDigest: digest(prior + text), phase, reason: null, truncated: false };
}
const post = (a: Attempt, events: unknown[], status = 200) => request('/api/runner/events', { ...a.ownership, events }, a.token, status);
const block = (a: Attempt) => request(`/api/tasks/${a.taskId}/assistant-stream/${a.streamId}`);

it('returns only the verified digest while keeping the full Unicode block publicly readable', async () => {
  const a = await attempt(), prefix = tile.repeat(512), appended = '尾';
  await post(a, [a.session, patch(a, prefix)]);
  const original = Client.prototype.query;
  const aggregateResults: QueryResult[] = [];
  const observer = vi.spyOn(Client.prototype, 'query').mockImplementation(function (this: Client, ...args: unknown[]) {
    const result = Reflect.apply(original, this, args);
    const sql = args[0];
    if (typeof sql === 'string' && sql.includes('string_agg') && sql.includes('assistant_stream_patches')) {
      return result.then((value: QueryResult) => { aggregateResults.push(value); return value; });
    }
    return result;
  } as typeof original);
  try { await post(a, [patch(a, appended, prefix, 2)]); }
  finally { observer.mockRestore(); }
  expect((await block(a)).content).toBe(prefix + appended);
  expect(aggregateResults).toHaveLength(1);
  const values = Object.values(aggregateResults[0]!.rows[0]) as string[];
  console.log('CHAT06P02_DECODED_RETURN', JSON.stringify({ prefixUtf8Bytes: Buffer.byteLength(prefix), appendedUtf8Bytes: Buffer.byteLength(appended),
    queryCount: aggregateResults.length, fields: aggregateResults[0]!.fields.map(field => field.name),
    decodedValueUtf8Bytes: values.reduce((sum, value) => sum + Buffer.byteLength(value), 0), decodedRowsJsonUtf8Bytes: Buffer.byteLength(JSON.stringify(aggregateResults[0]!.rows)),
    unit: 'decoded UTF8 values/JSON, not PostgreSQL wire or CPU cost' }));
  expect(values).toEqual([digest(prefix + appended)]);
  expect(Buffer.byteLength(values[0]!)).toBe(64);
});

it.each([
  ['empty', '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['Unicode, CRLF and backslash', tile, '6c26c69a9b42ca0cee2e7b628d842c1f301d333b4d0f1681e3c54cdb46328857'],
  ['NFC', 'é', '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c'],
  ['NFD', 'e\u0301', 'bf12767b0f2a56b2190075bae8169f656e3ce8d6357d4aff184bc6c7ea48f9f6'],
])('preserves exact %s bytes from an empty prefix without normalization', async (_name, text, expectedDigest) => {
  const a = await attempt();
  const event = { ...patch(a, text!, '', 1, 'block-complete'), prefixDigest: expectedDigest! };
  await post(a, [a.session, event]);
  expect(await block(a)).toMatchObject({ content: text, bytes: Buffer.byteLength(text!), prefixDigest: expectedDigest, revision: 1 });
  const page = await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`);
  expect(page.patches.map((value: { text: string }) => value.text)).toEqual([text]);
});

it('sees earlier patches in its own batch and accepts an empty closing patch without re-normalizing', async () => {
  const a = await attempt();
  const first = { ...patch(a, tile), prefixDigest: '6c26c69a9b42ca0cee2e7b628d842c1f301d333b4d0f1681e3c54cdb46328857' };
  const next = { ...patch(a, '尾', tile, 2), prefixDigest: 'f7d38b52adfd83d5482d3793430c5201f6ef1947513b1fdcb1a383c634fdf3d2' };
  const closed = { ...patch(a, '', tile + '尾', 3, 'block-complete'), prefixDigest: next.prefixDigest };
  expect(await post(a, [a.session, first, next, closed])).toMatchObject({ accepted: 4, lastSequence: 4 });
  expect(await block(a)).toMatchObject({ content: tile + '尾', bytes: 19, revision: 3, phase: 'block-complete' });
});

async function facts(a: Attempt) {
  return (await pool.query(`SELECT t.cursor,t.status,a.last_sequence,a.native_session_id,
    (SELECT count(*)::int FROM flow.assistant_stream_blocks WHERE task_id=t.id) AS blocks,
    (SELECT count(*)::int FROM flow.assistant_stream_patches WHERE task_id=t.id) AS patches,
    (SELECT count(*)::int FROM flow.runner_events WHERE attempt_id=a.id) AS events,
    (SELECT count(*)::int FROM flow.timeline WHERE task_id=t.id) AS timeline
    FROM flow.tasks t JOIN flow.attempts a ON a.id=t.current_attempt_id WHERE t.id=$1`, [a.taskId])).rows[0];
}
it('rejects a bad full-prefix digest atomically, including earlier session and patch facts in that batch', async () => {
  const a = await attempt(), first = patch(a, tile);
  const before = await facts(a);
  const invalid = { ...patch(a, '尾', tile, 2), prefixDigest: '0'.repeat(64) };
  expect((await post(a, [a.session, first, invalid], 409)).error.code).toBe('stream_digest');
  expect(await facts(a)).toEqual(before);
  await post(a, [a.session, first, { ...invalid, prefixDigest: 'f7d38b52adfd83d5482d3793430c5201f6ef1947513b1fdcb1a383c634fdf3d2' }]);
  expect((await block(a)).content).toBe(tile + '尾');
});

it('still hashes the whole stored prefix and rejects corruption before its last patch', async () => {
  const a = await attempt();
  await post(a, [a.session, patch(a, 'first'), patch(a, 'second', 'first', 2)]);
  await pool.query("UPDATE flow.assistant_stream_patches SET data=jsonb_set(data,'{text}',to_jsonb('fIrst'::text)) WHERE stream_id=$1 AND revision=1", [a.streamId]);
  const before = await facts(a);
  expect((await post(a, [patch(a, 'tail', 'firstsecond', 3)], 409)).error.code).toBe('stream_digest');
  expect(await facts(a)).toEqual(before);
  await request(`/api/tasks/${a.taskId}/assistant-stream/${a.streamId}`, undefined, owner, 409);
});

it('retains offset, revision, session, ownership and sealed replay guards', async () => {
  const a = await attempt(), first = patch(a, tile);
  await post(a, [a.session, first]);
  const before = await facts(a), next = patch(a, '尾', tile, 2);
  for (const [change, code] of [
    [{ fromBytes: 1 }, 'stream_gap'],
    [{ revision: 3 }, 'stream_gap'],
    [{ nativeSessionId: randomUUID() }, 'stream_session'],
  ] as const) {
    expect((await post(a, [{ ...next, ...change }], 409)).error.code).toBe(code);
    expect(await facts(a)).toEqual(before);
  }
  expect((await request('/api/runner/events', { ...a.ownership, ownerVersion: a.ownership.ownerVersion + 1, events: [next] }, a.token, 409)).error.code).toBe('stale_owner');
  expect((await post(a, [{ ...next, prefixDigest: next.prefixDigest.toUpperCase() }], 400)).error.code).toBe('invalid_events');
  expect(await facts(a)).toEqual(before);
  expect(await post(a, [a.session, first])).toMatchObject({ accepted: 0, lastSequence: 2 });
  // A new envelope for exactly the same sealed revision remains the existing no-op.
  expect(await post(a, [{ ...first, id: randomUUID(), sequence: 3 }])).toMatchObject({ accepted: 1, lastSequence: 3 });
  expect((await post(a, [{ ...first, id: randomUUID(), sequence: 4, text: 'mutated' }], 409)).error.code).toBe('stream_conflict');
  expect((await block(a)).content).toBe(tile);
});

it('serializes two conflicting same-revision reports and commits only one full prefix', async () => {
  const a = await attempt(); await post(a, [a.session, patch(a, tile)]);
  const left = patch(a, '左', tile, 2), right = patch(a, '右', tile, 2);
  const send = async (event: StreamEvent) => {
    const response = await fetch(`${base}/api/runner/events`, { method: 'POST', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...a.ownership, events: [event] }), signal: AbortSignal.timeout(5000) });
    return { event, status: response.status, body: await response.json() };
  };
  const outcomes = await Promise.all([send(left), send(right)]);
  expect(outcomes.map(value => value.status).sort()).toEqual([200, 409]);
  const winner = outcomes.find(value => value.status === 200)!;
  expect(winner.body).toEqual({ accepted: 1, lastSequence: 3 });
  expect(outcomes.find(value => value.status === 409)!.body.error.code).toBe('event_conflict');
  expect(await block(a)).toMatchObject({ content: tile + winner.event.text, revision: 2, bytes: 19 });
  expect((await facts(a)).patches).toBe(2);
  expect(await post(a, [winner.event])).toEqual({ accepted: 0, lastSequence: 3 });
});
