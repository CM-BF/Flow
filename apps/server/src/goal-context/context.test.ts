import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startGoalContextFixture } from './fixture.js';
import { transaction } from '../database.js';
import { acceptTask } from '../tasks.js';
import { bindGoalExecutionInput, copyGoalRecoveryInput, goalExecutionInputForTask } from './store.js';

let f: Awaited<ReturnType<typeof startGoalContextFixture>>;
beforeAll(async () => { f = await startGoalContextFixture(process.env.FLOW_K03_RUN_LABEL ?? 'context'); });
afterAll(async () => { await f?.close(); });
const plainInput = { goal: 'Use exact selected text', constraints: 'No model', acceptance: 'Verified result', verification: { kind: 'nonempty' } };
async function setup(text = 'Private Ω😀\r\nsource') {
  const projectId = await f.project();
  const p = (await f.http(`/api/projects/${projectId}`)).body;
  const added = await f.http(`/api/projects/${projectId}/commands`, { expectedRevision: p.project.revision, reason: 'Context fixture', change: { kind: 'add-node', title: 'Node A' } });
  expect(added.status).toBe(200); const nodeId = added.body.changedNodeId;
  const goal = await f.http('/api/goals', { projectId, originalGoal: 'Original goal', constraints: 'No model', acceptance: 'Exact frozen execution' });
  expect(goal.status).toBe(201); const goalId = goal.body.goal.id;
  const source = await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Private source', text });
  expect(source.status).toBe(201);
  const citation = { projectId, sourceId: source.body.source.id, version: 1, contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  const command = { kind: 'define-input', nodeId, expectedInputVersion: 0, input: { ...plainInput, knowledge: [citation] }, reason: 'Freeze exact source' };
  return { projectId, nodeId, goalId, text, citation, command, detailPath: `/api/goals/${goalId}/nodes/${nodeId}/inputs/1/context` };
}
it('freezes owner-defined references atomically and serves exact detail across restart and immutable ACK replay', async () => {
  const s = await setup(); const key = randomUUID();
  const accepted = await f.http(`/api/goals/${s.goalId}/commands`, s.command, { key }); expect(accepted.status).toBe(200);
  const detail = await f.http(s.detailPath); expect(detail.status).toBe(200);
  expect(detail.body.sources).toEqual([{ citation: s.citation, text: s.text, byteLength: Buffer.byteLength(s.text), currentVersionAtFreeze: 1, isCurrentAtFreeze: true, currentVersion: 1, isCurrent: true }]);
  expect(detail.body).toMatchObject({ goalId: s.goalId, nodeId: s.nodeId, inputVersion: 1, referenceCount: 1, rawBytes: Buffer.byteLength(s.text) });
  await f.restart(); expect((await f.http(s.detailPath)).body).toEqual(detail.body);
  expect((await f.http(`/api/goals/${s.goalId}/commands`, s.command, { key })).body).toEqual({ ...accepted.body, replayed: true });
});
async function defined() {
  const s = await setup(); expect((await f.http(`/api/goals/${s.goalId}/commands`, s.command)).status).toBe(200); return s;
}
async function bound(s: Awaited<ReturnType<typeof setup>>, publicPrompt = 'Public business prompt') {
  return transaction(f.pool, async client => {
    const task = await acceptTask(client, f.boss, { title: 'Bound execution', prompt: publicPrompt, harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 }, verification: { kind: 'nonempty' } });
    await bindGoalExecutionInput(client, task.id, s.goalId, s.nodeId, 1, publicPrompt); return { ...task, prompt: publicPrompt };
  });
}
it('projects frozen execution privately and recompiles recovery without creating a goal execution', async () => {
  const s = await defined(); const task = await bound(s);
  const before = await transaction(f.pool, client => goalExecutionInputForTask(client, task.id, task.prompt));
  expect(before!.prompt).toContain(s.text.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
  expect(before!.context).toMatchObject({ templateVersion: 1, referenceCount: 1, rawBytes: Buffer.byteLength(s.text) });
  const publicTask = await f.http(`/api/tasks/${task.id}`);
  expect(publicTask.body.prompt).toBe('Public business prompt');
  expect(JSON.stringify(publicTask.body)).not.toContain('Private Ω');
  expect((await f.initialStream(task.id)).text).not.toContain('Private Ω');
  expect((await f.http(`/api/projects/${s.projectId}/knowledge/sources/${s.citation.sourceId}/versions`, { expectedVersion: 1, text: 'Changed source' })).status).toBe(201);
  expect(await transaction(f.pool, client => goalExecutionInputForTask(client, task.id, task.prompt))).toEqual(before);
  const detail = (await f.http(s.detailPath)).body; expect(detail.sources[0]).toMatchObject({ text: s.text, currentVersion: 2, isCurrent: false });
  const recovered = await transaction(f.pool, async client => {
    const next = await acceptTask(client, f.boss, { title: 'Recovery', prompt: 'Revised work + complete recovery evidence', harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 }, verification: { kind: 'nonempty' } });
    await copyGoalRecoveryInput(client, task.id, next.id, task.prompt, 'Revised work + complete recovery evidence'); return goalExecutionInputForTask(client, next.id, 'Revised work + complete recovery evidence');
  });
  expect(recovered!.context.contextDigest).toBe(before!.context.contextDigest);
  expect(recovered!.context.executionInputDigest).not.toBe(before!.context.executionInputDigest);
  expect(recovered!.prompt).toContain('Revised work + complete recovery evidence');
  expect(recovered!.prompt).not.toContain('Changed source');
  expect((await f.pool.query('SELECT count(*) FROM flow.goal_executions WHERE goal_id=$1', [s.goalId])).rows[0].count).toBe('0');
});
it('fails closed for mismatched raw prompts, corrupt records and declared bindings while preserving immutable rows', async () => {
  const s = await defined(); const task = await bound(s);
  await expect(transaction(f.pool, client => goalExecutionInputForTask(client, task.id, 'Different public prompt'))).rejects.toMatchObject({ code: 'goal_context_invalid' });
  await expect(f.pool.query('UPDATE flow.tasks SET goal_input_id=NULL WHERE id=$1', [task.id])).rejects.toMatchObject({ code: '23514' });
  const inputId = (await f.pool.query('SELECT goal_input_id FROM flow.tasks WHERE id=$1', [task.id])).rows[0].goal_input_id;
  await expect(f.pool.query('DELETE FROM flow.goal_execution_inputs WHERE id=$1', [inputId])).rejects.toMatchObject({ code: '23514' });
  await f.pool.query('ALTER TABLE flow.goal_execution_inputs DISABLE TRIGGER goal_execution_inputs_immutable');
  try { await f.pool.query("UPDATE flow.goal_execution_inputs SET execution_input_digest=repeat('0',64) WHERE id=$1", [inputId]); }
  finally { await f.pool.query('ALTER TABLE flow.goal_execution_inputs ENABLE TRIGGER goal_execution_inputs_immutable'); }
  await expect(transaction(f.pool, client => goalExecutionInputForTask(client, task.id, task.prompt))).rejects.toMatchObject({ code: 'goal_context_invalid' });
  const plain = await transaction(f.pool, client => acceptTask(client, f.boss, { title: 'Plain', prompt: 'No context', harness: 'fixture', verification: { kind: 'nonempty' } }));
  expect(await transaction(f.pool, client => goalExecutionInputForTask(client, plain.id, 'No context'))).toBeNull();
  await expect(f.pool.query('UPDATE flow.tasks SET goal_input_id=$2 WHERE id=$1', [plain.id, randomUUID()])).rejects.toMatchObject({ code: '23503' });
});
it('rolls back task and input allocation on private budget failure and rejects detail outside its owner tuple', async () => {
  const s = await defined(); const before = (await f.pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count;
  await expect(bound(s, 'x'.repeat(15900))).rejects.toMatchObject({ code: 'goal_context_budget' });
  expect((await f.pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count).toBe(before);
  expect((await f.pool.query('SELECT count(*) FROM flow.goal_execution_inputs i JOIN flow.goal_contexts c ON c.id=i.context_id WHERE c.goal_id=$1', [s.goalId])).rows[0].count).toBe('0');
  expect((await f.http(s.detailPath.replace(s.goalId, randomUUID()))).status).toBe(404);
  expect((await f.http(s.detailPath.replace(s.nodeId, randomUUID()))).status).toBe(404);
  const runner = (await f.http('/api/runners', { name: 'Context role', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await f.http(s.detailPath, undefined, { token: runner.token })).status).toBe(403);
  expect((await f.http(s.detailPath, undefined, { token: '' })).status).toBe(401);
});
