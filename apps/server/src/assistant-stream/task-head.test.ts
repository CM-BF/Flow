import { afterAll, beforeAll, expect, test } from 'vitest';
import { TaskReadFixture } from '../../../../experiments/bounded-reads/task-projections/fixture.js';
import { assistantStreams } from './queries.js';
import { loadTask } from '../tasks.js';
import { transaction, sha256 } from '../database.js';
import { randomUUID } from 'node:crypto';

const fixture = new TaskReadFixture();
const prompt = '界🙂'.repeat(5333);
let taskId = '';
beforeAll(async () => {
  await fixture.start(); fixture.accountTask(prompt);
  const accepted = await fixture.http('/api/tasks', { title: 'Assistant head Unicode', prompt, harness: 'claude' });
  expect(accepted.status).toBe(202); taskId = accepted.data.task.id;
}, 20_000);
afterAll(() => fixture.close(), 15_000);

test('reads an unclaimed task without decoding its legal public prompt', async () => {
  const old = await fixture.sample('head:old-full-task', () => transaction(fixture.pool, client => loadTask(client, taskId), true));
  const current = await fixture.sample('head:unclaimed', () => assistantStreams(fixture.pool, taskId, 1));
  expect(current.value).toEqual({ taskId, attemptId: null, taskStatus: 'queued', taskUpdatedAt: old.value.updated_at.toISOString(), blocks: [], nextCursor: null, finalMessageId: null, settlement: null });
  expect(current.measurement.taskFields).toEqual(['current_attempt_id', 'status', 'updated_at']);
  expect(current.measurement.selectCalls).toBe(1);
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(old.measurement.taskRowJsonBytes - Buffer.byteLength(prompt));
  const http = await fixture.http(`/api/tasks/${taskId}/assistant-stream?limit=1`);
  expect(http.status).toBe(200); expect(http.data).toEqual(current.value);
});

type BoundAttempt = { taskId: string; attemptId: string; ownerVersion: number; token: string; sessionId: string };
let active: BoundAttempt;
let firstStream = '', secondStream = '';
async function claim(id: string, token: string): Promise<BoundAttempt> {
  await fixture.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [id]);
  const response = await fixture.http('/api/runner/claim', {}, token);
  expect(response.status).toBe(200); expect(response.data.assignment.task.id).toBe(id);
  return { taskId: id, attemptId: response.data.assignment.attempt.id, ownerVersion: response.data.assignment.attempt.ownerVersion, token, sessionId: randomUUID() };
}
function patch(a: BoundAttempt, sequence: number, text: string) {
  const nativeMessageId = randomUUID();
  return { type: 'assistant-stream', id: randomUUID(), sequence, streamId: sha256(JSON.stringify([a.sessionId, nativeMessageId, 0])), nativeSessionId: a.sessionId,
    nativeMessageId, parentToolUseId: null, source: 'claude.sdk.stream', sourceMessageId: randomUUID(), blockIndex: 0, revision: 1, fromBytes: 0,
    text, prefixDigest: sha256(text), phase: 'block-complete', reason: null, truncated: false };
}
const session = (a: BoundAttempt) => ({ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: a.sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' });
async function report(a: BoundAttempt, events: unknown[]) {
  const result = await fixture.http('/api/runner/events', { attemptId: a.attemptId, ownerVersion: a.ownerVersion, events }, a.token);
  expect(result.status).toBe(200); return result.data;
}

test('keeps active block pagination and HTTP output with four selects and no submission', async () => {
  const runner = await fixture.http('/api/runners', { name: 'Head-only synthetic', harnesses: ['claude'], capacity: 2 });
  expect(runner.status).toBe(200); active = await claim(taskId, runner.data.token);
  const first = patch(active, 2, 'First draft🙂'), second = patch(active, 3, 'Second draft');
  firstStream = first.streamId; secondStream = second.streamId;
  expect(await report(active, [session(active), first, second])).toMatchObject({ accepted: 3, lastSequence: 3 });
  const page = await fixture.sample('head:active-first-page', () => assistantStreams(fixture.pool, taskId, 1));
  expect(page.value).toMatchObject({ taskId, attemptId: active.attemptId, taskStatus: 'running', nextCursor: firstStream, finalMessageId: null, settlement: null });
  expect(page.value.blocks).toHaveLength(1); expect(page.value.blocks[0]).toMatchObject({ id: firstStream, status: 'block-complete', firstSequence: 2, bytes: Buffer.byteLength(first.text) });
  expect(page.measurement.taskFields).not.toContain('submission'); expect(page.measurement.selectCalls).toBe(4);
  const next = await fixture.sample('head:active-after-cursor', () => assistantStreams(fixture.pool, taskId, 1, firstStream));
  expect(next.value.blocks.map(block => block.id)).toEqual([secondStream]); expect(next.value.nextCursor).toBeNull();
  expect(next.measurement.selectCalls).toBe(5);
  expect((await assistantStreams(fixture.pool, taskId, 1, secondStream)).blocks).toEqual([]);
  const http = await fixture.http(`/api/tasks/${taskId}/assistant-stream?limit=1`);
  expect(http.status).toBe(200); expect(http.data).toEqual(page.value); expect(JSON.stringify(http.data)).not.toContain(first.text);
});

test('rejects cursors from a different task or historical attempt and preserves read authorization', async () => {
  fixture.accountTask('Other task');
  const other = await fixture.http('/api/tasks', { title: 'Other head', prompt: 'Other task', harness: 'claude' });
  expect(other.status).toBe(202); const bound = await claim(other.data.task.id, active.token);
  const foreign = patch(bound, 2, 'Other draft'); await report(bound, [session(bound), foreign]);
  await expect(assistantStreams(fixture.pool, taskId, 1, foreign.streamId)).rejects.toMatchObject({ status: 400, code: 'stream_cursor' });
  // Explicit SQL historical fixture; not a claim that production creates ownerVersion 0 attempts.
  const historicalAttempt = randomUUID(), historicalBlock = sha256(randomUUID());
  await fixture.pool.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at) SELECT $1,task_id,runner_id,0,clock_timestamp(),clock_timestamp() FROM flow.attempts WHERE id=$2', [historicalAttempt, active.attemptId]);
  await fixture.pool.query("INSERT INTO flow.assistant_stream_blocks(id,task_id,attempt_id,first_sequence,last_sequence,revision,bytes,header) SELECT $1,task_id,$2,first_sequence,last_sequence,revision,bytes,jsonb_set(header,'{streamId}',to_jsonb($1::text)) FROM flow.assistant_stream_blocks WHERE id=$3", [historicalBlock, historicalAttempt, firstStream]);
  await expect(assistantStreams(fixture.pool, taskId, 1, historicalBlock)).rejects.toMatchObject({ status: 400, code: 'stream_cursor' });
  expect((await fixture.http(`/api/tasks/${taskId}/assistant-stream?after=${historicalBlock}`)).status).toBe(400);
  for (const [token, status] of [['invalid', 401], [active.token, 403]] as const) {
    expect((await fixture.http(`/api/tasks/${taskId}/assistant-stream`, undefined, token)).status).toBe(status);
  }
  await expect(assistantStreams(fixture.pool, 'missing-head', 1)).rejects.toMatchObject({ status: 404, code: 'not_found', message: 'Task not found.' });
  expect((await fixture.http('/api/tasks/missing-head/assistant-stream')).status).toBe(404);
});

test('updates task status and date without inventing a canonical final or losing existing blocks', async () => {
  const at = '2026-01-02T03:04:05.000Z';
  for (const status of ['failed', 'cancelled', 'uncertain']) {
    await fixture.pool.query('UPDATE flow.tasks SET status=$2,updated_at=$3 WHERE id=$1', [taskId, status, at]);
    const page = await assistantStreams(fixture.pool, taskId, 2);
    expect(page).toMatchObject({ taskStatus: status, taskUpdatedAt: at, finalMessageId: null, settlement: null, nextCursor: null });
    expect(page.blocks.map(block => block.id)).toEqual([firstStream, secondStream]);
    expect(page.blocks.every(block => block.status === 'interrupted' && block.phase === 'block-complete')).toBe(true);
  }
  await fixture.pool.query("UPDATE flow.tasks SET status='running' WHERE id=$1", [taskId]);
});

test('preserves final settlement, completed state and explicit body retrieval', async () => {
  const sourceMessageId = randomUUID(), messageId = sha256(JSON.stringify([active.sessionId, sourceMessageId]));
  const final = { type: 'assistant-final', id: randomUUID(), sequence: 4, messageId, nativeSessionId: active.sessionId, source: 'claude.sdk.result', sourceMessageId,
    content: 'Canonical head fixture final', settings: { requested: { model: 'synthetic', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: 'synthetic', permissionMode: 'dontAsk', tools: [], thinking: 'unknown' } } };
  expect(await report(active, [final, { type: 'completed', id: randomUUID(), sequence: 5, outcome: 'succeeded' }])).toMatchObject({ accepted: 2, lastSequence: 5 });
  const page = await fixture.sample('head:completed-with-final', () => assistantStreams(fixture.pool, taskId, 2));
  expect(page.value).toMatchObject({ taskId, attemptId: active.attemptId, taskStatus: 'succeeded', finalMessageId: messageId, nextCursor: null,
    settlement: { policy: 'flow.assistant-draft', policyVersion: '1', correlation: 'presentation-policy', unavailableReason: null, replaceStreamIds: [firstStream, secondStream], retainStreamIds: [] } });
  expect(page.value.blocks.every(block => block.status === 'final-available')).toBe(true);
  expect(page.measurement.selectCalls).toBe(4); expect(page.measurement.taskFields).not.toContain('submission');
  expect((await fixture.http(`/api/tasks/${taskId}/assistant-stream?limit=2`)).data).toEqual(page.value);
  expect((await fixture.http(`/api/assistant-messages/${messageId}`)).data.content).toBe(final.content);
  expect((await fixture.http(`/api/tasks/${taskId}/assistant-stream/${firstStream}`)).data.content).toBe('First draft🙂');
  expect((await fixture.http(`/api/tasks/${taskId}`)).data.prompt).toBe(prompt);
});
