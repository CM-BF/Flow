import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readAssistantFinalPreview, readAssistantFinal } from './index.js';
import { addTyped, startFixture } from '../../../../experiments/bounded-preview/fixture.js';
let fixture: Awaited<ReturnType<typeof startFixture>>;
beforeAll(async () => { fixture = await startFixture('preview'); });
afterAll(async () => { await fixture?.close(); });
it('returns a bounded preview from PostgreSQL without transferring the full typed body to the page reader', async () => {
  const [turn] = await fixture.seed(['x'.repeat(131072)]);
  const page = await fixture.http('/api/conversations/' + turn!.conversationId + '/turns?limit=1', undefined, true);
  expect(page.status).toBe(200);
  expect(page.body.turns[0].assistant).toMatchObject({ state: 'available', text: 'x'.repeat(4000), truncated: true });
  const decodedBytes = Object.values(page.work!.sql).reduce((sum,value) => sum + value.decodedRowsJsonUtf8Bytes, 0);
  expect(decodedBytes).toBeLessThan(20_000);
});

it.each([
  ['empty', '', '', false],
  ['short escapes', 'Backslash \\ and literal \\x41\nNew line\t中文🙂', 'Backslash \\ and literal \\x41\nNew line\t中文🙂', false],
  ['4000 ASCII', 'a'.repeat(4000), 'a'.repeat(4000), false],
  ['4001 ASCII', 'a'.repeat(4001), 'a'.repeat(4000), true],
  ['4001 BMP', '汉'.repeat(4001), '汉'.repeat(4000), true],
  ['4000 UTF16 emoji', '🙂'.repeat(2000), '🙂'.repeat(2000), false],
  ['4002 UTF16 emoji', '🙂'.repeat(2001), '🙂'.repeat(2000), true],
  ['4000 codepoint emoji', '🙂'.repeat(4000), '🙂'.repeat(2000), true],
  ['split surrogate', 'a'.repeat(3999) + '🙂', 'a'.repeat(3999), true],
  ['combining exact', 'e\u0301'.repeat(2000), 'e\u0301'.repeat(2000), false],
  ['combining overflow', 'e\u0301'.repeat(2001), 'e\u0301'.repeat(2000), true],
  ['ZWJ sequence', '👩‍💻'.repeat(801), '👩‍💻'.repeat(800), true],
] as const)('preserves the existing preview and complete detail for %s', async (_name, content, expected, truncated) => {
  const [f] = await fixture.seed([content]);
  const response = await fixture.http('/api/conversations/' + f!.conversationId + '/turns?limit=1', undefined, true);
  expect(response.status).toBe(200);
  const reply = response.body.turns[0].assistant;
  expect(reply).toMatchObject({ state: 'available', text: expected, truncated, source: { taskId: f!.taskId, attemptId: f!.attemptId, nativeSessionId: f!.sessionId } });
  const full = await fixture.http('/api/assistant-messages/' + f!.messageId);
  expect(full.status).toBe(200); expect(full.body.content).toBe(content);
  expect(reply.source.contentDigest).toBe(full.body.contentDigest);
  expect(reply.source.messageId).toBe(full.body.id);
  const detail = await fixture.http('/api/conversations/' + f!.conversationId + '/turns/' + f!.turnId + '/details/' + f!.detailId);
  expect(detail.status).toBe(200); expect(detail.body.content).toBe(content);
});

async function projected(f: { conversationId: string }) {
  const response = await fixture.http('/api/conversations/' + f.conversationId + '/turns?limit=1');
  expect(response.status).toBe(200); return response.body.turns[0];
}
it('rejects a corruption beyond the transferred prefix and keeps digest comparison case-sensitive', async () => {
  const [f] = await fixture.seed(['x'.repeat(131072)]);
  const before = await projected(f!); expect(before.assistant.state).toBe('available');
  await fixture.pool.query('UPDATE flow.details SET content=$2 WHERE id=$1', [f!.detailId, 'x'.repeat(131071) + 'y']);
  expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
  expect((await fixture.http('/api/assistant-messages/' + f!.messageId)).status).toBe(409);
  await fixture.pool.query('UPDATE flow.details SET content=$2 WHERE id=$1', [f!.detailId, f!.content]);
  await fixture.pool.query('UPDATE flow.assistant_messages SET content_digest=upper(content_digest) WHERE id=$1', [f!.messageId]);
  expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
});
it.each(['task', 'attempt', 'native-session'] as const)('rejects a foreign %s binding even with an intact body digest', async binding => {
  const [f] = await fixture.seed(['Identity A']); const [other] = await fixture.seed(['Identity B']);
  if (binding === 'task') await fixture.pool.query('UPDATE flow.details SET task_id=$2 WHERE id=$1', [f!.detailId, other!.taskId]);
  if (binding === 'attempt') await fixture.pool.query('UPDATE flow.details SET attempt_id=$2 WHERE id=$1', [f!.detailId, other!.attemptId]);
  if (binding === 'native-session') await fixture.pool.query('UPDATE flow.assistant_messages SET native_session_id=$2 WHERE id=$1', [f!.messageId, other!.sessionId]);
  expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
});
it('keeps missing typed data, unknown adapter, failed verification and non-success terminal states unavailable', async () => {
  const [missing] = await fixture.seed(['Not inserted'], { typed: false });
  expect((await projected(missing!)).assistant).toEqual({ state: 'unavailable', reason: 'missing-result' });
  const [unknown] = await fixture.seed(['Unknown body'], { adapter: 'unknown-adapter' });
  expect((await projected(unknown!)).assistant).toEqual({ state: 'unavailable', reason: 'unknown-adapter' });
  const [unverified] = await fixture.seed(['Unverified body']);
  await fixture.pool.query("UPDATE flow.tasks SET verification_status='failed' WHERE id=$1", [unverified!.taskId]);
  expect((await projected(unverified!)).assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
  for (const status of ['failed', 'cancelled', 'uncertain']) {
    const [f] = await fixture.seed(['Non-success body'], { status });
    expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'execution-not-succeeded' });
  }
});
it('keeps pending typed settings and exposes the final only after success in the recorded late-commit sequence', async () => {
  const [f] = await fixture.seed(['Late typed body'], { typed: false, status: 'running' });
  const writer = await fixture.pool.connect();
  try {
    await writer.query('BEGIN'); await addTyped(writer, f!);
    const before = await projected(f!);
    expect(before.assistant).toEqual({ state: 'pending', reason: 'execution-pending' });
    expect(before.effective.model).toBeNull();
    await writer.query('COMMIT');
    const committed = await projected(f!);
    expect(committed.assistant).toEqual({ state: 'pending', reason: 'execution-pending' });
    expect(committed.effective).toMatchObject({ model: 'fixture', thinking: 'unknown', runnerRequested: { model: 'fixture' }, source: { kind: 'assistant-final', taskId: f!.taskId, attemptId: f!.attemptId } });
  } catch (error) { await writer.query('ROLLBACK'); throw error; } finally { writer.release(); }
  await fixture.pool.query("UPDATE flow.tasks SET status='succeeded' WHERE id=$1", [f!.taskId]);
  expect((await projected(f!)).assistant).toMatchObject({ state: 'available', text: f!.content, truncated: false });
});
it('rejects a stale owner fence and does not reuse a previous attempt final', async () => {
  const [f] = await fixture.seed(['Previous attempt body']);
  await fixture.pool.query('UPDATE flow.tasks SET owner_version=2 WHERE id=$1', [f!.taskId]);
  expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'missing-session' });
  const attemptId = randomUUID();
  await fixture.pool.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,native_session_id,lease_expires_at,completed_at) VALUES($1,$2,$3,2,$4,clock_timestamp(),clock_timestamp())', [attemptId, f!.taskId, f!.runnerId, f!.sessionId]);
  await fixture.pool.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Session','session',$4,'application/json')", [randomUUID(), f!.taskId, attemptId, JSON.stringify({ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: f!.sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' })]);
  await fixture.pool.query('UPDATE flow.tasks SET current_attempt_id=$2 WHERE id=$1', [f!.taskId, attemptId]);
  expect((await projected(f!)).assistant).toEqual({ state: 'unavailable', reason: 'missing-result' });
});
it('returns an explicit preview type and retains the complete reader without mutating settings or provenance', async () => {
  const [f] = await fixture.seed(['汉🙂'.repeat(10000)]);
  const client = await fixture.pool.connect();
  try {
    const full = await readAssistantFinal(client, f!.taskId, f!.attemptId);
    const preview = await readAssistantFinalPreview(client, f!.taskId, f!.attemptId);
    expect(full?.content).toBe(f!.content);
    expect(preview).not.toHaveProperty('content');
    expect(preview).toMatchObject({ text: '汉🙂'.repeat(1333) + '汉', truncated: true });
    const { content: _content, ...reference } = full!;
    const { text: _text, truncated: _truncated, ...previewReference } = preview!;
    expect(previewReference).toEqual(reference);
    expect(await readAssistantFinalPreview(client, f!.taskId, randomUUID())).toBeNull();
  } finally { client.release(); }
});
