import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startContextFixture } from './fixture.js';
let f: Awaited<ReturnType<typeof startContextFixture>>;
beforeAll(async () => { f = await startContextFixture(process.env.FLOW_K02_RUN_LABEL ?? 'context'); });
afterAll(async () => { await f?.close(); });

test('freezes selected text privately while public prompt and bubble remain original', async () => {
  const projectId = await f.project();
  const source = await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Frozen material', text: 'material-secret-古😀' }); expect(source.status).toBe(201);
  const citation = { projectId, sourceId: source.body.source.id, version: 1, contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength('material-secret-古😀') } };
  const conversation = await f.http('/api/conversations', { title: 'Context turn', projectId }); expect(conversation.status).toBe(201);
  const id = conversation.body.conversation.id;
  const turn = await f.http(`/api/conversations/${id}/turns`, { expectedRevision: 0, text: 'Use the selected source.', knowledge: [citation] }); expect(turn.status, JSON.stringify(turn.body)).toBe(202);
  expect(turn.body.turn.user.text).toBe('Use the selected source.'); expect(JSON.stringify(turn.body)).not.toContain('material-secret');
  const snapshot = await f.http(`/api/tasks/${turn.body.turn.task.id}`); expect(snapshot.body.prompt).toBe('Use the selected source.'); expect(JSON.stringify(snapshot.body)).not.toContain('material-secret');
  const runner = await f.http('/api/runners', { name: 'Context fixture', harnesses: ['claude'], capacity: 1 });
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [turn.body.turn.task.id]);
  const claim = await f.http('/api/runner/claim', {}, { token: runner.body.token });
  expect(claim.status).toBe(200); expect(claim.body.assignment.task.prompt).toContain('material-secret-古😀');
  expect(claim.body.assignment.conversationContext.contextDigest).toBe(turn.body.turn.context.contextDigest);
  const detail = await f.http(`/api/conversations/${id}/contexts/${turn.body.turn.context.id}`); expect(detail.body.sources[0].text).toBe('material-secret-古😀');
  expect(detail.httpUtf8Bytes).toBeLessThanOrEqual(65536);
});

async function pendingContextTurn(text = 'context-secret') {
  const projectId = await f.project();
  const source = await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Material', text });
  const citation = { projectId, sourceId: source.body.source.id, version: 1, contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  const conversation = await f.http('/api/conversations', { title: 'Context pending', projectId });
  const id = conversation.body.conversation.id;
  const turn = await f.http(`/api/conversations/${id}/turns`, { expectedRevision: 0, text: 'raw user', knowledge: [citation] });
  expect(turn.status, JSON.stringify(turn.body)).toBe(202);
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [turn.body.turn.task.id]);
  return { projectId, source: source.body, citation, conversationId: id, turn: turn.body.turn };
}

test('claim rejects mismatched raw input or corrupted digest and rolls back assignment writes', async () => {
  const created = await pendingContextTurn(); const taskId = created.turn.task.id; const inputId = created.turn.context.executionInputId;
  const original = (await f.pool.query('SELECT * FROM flow.conversation_execution_inputs WHERE id=$1', [inputId])).rows[0];
  const runner = await f.http('/api/runners', { name: 'Fail closed', harnesses: ['claude'], capacity: 1 });
  for (const [column, value] of [['user_text','different public text'],['execution_input_digest','0'.repeat(64)]] as const) {
    await f.pool.query('ALTER TABLE flow.conversation_execution_inputs DISABLE TRIGGER conversation_execution_inputs_immutable');
    try { await f.pool.query(`UPDATE flow.conversation_execution_inputs SET ${column}=$2 WHERE id=$1`, [inputId, value]); }
    finally { await f.pool.query('ALTER TABLE flow.conversation_execution_inputs ENABLE TRIGGER conversation_execution_inputs_immutable'); }
    try {
      const claim = await f.http('/api/runner/claim', {}, { token: runner.body.token });
      expect(claim.status).toBe(409); expect(claim.body.error.code).toBe('conversation_context_invalid');
      expect((await f.pool.query('SELECT status,current_attempt_id,owner_version FROM flow.tasks WHERE id=$1', [taskId])).rows[0]).toEqual({ status: 'queued', current_attempt_id: null, owner_version: 0 });
      expect((await f.pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [taskId])).rowCount).toBe(0);
    } finally {
      await f.pool.query('ALTER TABLE flow.conversation_execution_inputs DISABLE TRIGGER conversation_execution_inputs_immutable');
      try { await f.pool.query('UPDATE flow.conversation_execution_inputs SET user_text=$2,execution_input_digest=$3 WHERE id=$1', [inputId, original.user_text, original.execution_input_digest]); }
      finally { await f.pool.query('ALTER TABLE flow.conversation_execution_inputs ENABLE TRIGGER conversation_execution_inputs_immutable'); }
    }
  }
  await expect(f.pool.query('UPDATE flow.tasks SET conversation_input_id=$2 WHERE id=$1', [taskId, randomUUID()])).rejects.toMatchObject({ code: '23503' });
  expect((await f.http('/api/runner/claim', {}, { token: runner.body.token })).body.assignment.task.prompt).toContain('context-secret');
});

test('zero-context legacy conversation claims the original prompt without private metadata', async () => {
  const conversation = await f.http('/api/conversations', { title: 'Legacy plain' }); expect(conversation.status).toBe(201);
  const turn = await f.http(`/api/conversations/${conversation.body.conversation.id}/turns`, { expectedRevision: 0, text: 'unchanged raw prompt' }); expect(turn.status).toBe(202);
  expect(turn.body.turn).not.toHaveProperty('context'); expect(conversation.body.conversation).not.toHaveProperty('projectId');
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [turn.body.turn.task.id]);
  const runner = await f.http('/api/runners', { name: 'Legacy', harnesses: ['claude'], capacity: 1 });
  const claimed = await f.http('/api/runner/claim', {}, { token: runner.body.token });
  expect(claimed.body.assignment.task.prompt).toBe('unchanged raw prompt'); expect(claimed.body.assignment).not.toHaveProperty('conversationContext');
});
