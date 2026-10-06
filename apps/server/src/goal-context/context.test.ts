import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startGoalContextFixture } from './fixture.js';
import { loadState } from '../goals/state.js';
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
const execution = (nodeId: string, version = 1, previousExecutionId: string | null = null) => ({ kind: 'execute', nodeId, expectedInputVersion: version, dependencies: [], previousExecutionId, reason: 'Owner execution', fixture: { scenario: 'success', delayMs: 0 } });
it('binds owner execution and blocks new work after any source version change including equal content', async () => {
  const s = await defined();
  const accepted = await f.http(`/api/goals/${s.goalId}/commands`, execution(s.nodeId)); expect(accepted.status).toBe(200);
  const publicTask = (await f.http(`/api/tasks/${accepted.body.task.id}`)).body;
  expect(publicTask.prompt).not.toContain('Private Ω');
  const privateInput = await transaction(f.pool, client => goalExecutionInputForTask(client, publicTask.id, publicTask.prompt));
  expect(privateInput).not.toBeNull();
  expect((await f.http(`/api/goals/${s.goalId}`)).body.nodes[0]).toMatchObject({ knowledgeCurrent: true, knowledgeReferenceCount: 1 });
  await f.http(`/api/projects/${s.projectId}/knowledge/sources/${s.citation.sourceId}/versions`, { expectedVersion: 1, text: s.text });
  expect((await f.http(`/api/goals/${s.goalId}`)).body.nodes[0]).toMatchObject({ knowledgeCurrent: false, knowledgeReferenceCount: 1 });
  const blocked = await f.http(`/api/goals/${s.goalId}/commands`, execution(s.nodeId, 1, accepted.body.executionId));
  expect(blocked.body.error.code).toBe('goal_knowledge_obsolete');
  expect(await transaction(f.pool, client => goalExecutionInputForTask(client, publicTask.id, publicTask.prompt))).toEqual(privateInput);
});
it('rejects safe JavaScript integers outside the PostgreSQL input-version range before querying', async () => {
  for (const version of ['2147483648', '9007199254740991']) {
    const result = await f.http(`/api/goals/${randomUUID()}/nodes/${randomUUID()}/inputs/${version}/context`);
    expect(result.status).toBe(400); expect(result.body.error.code).toBe('invalid_goal_context');
  }
});

it('uses one bounded source-head query for referenced definitions and no new context reads for plain definitions', async () => {
  const s = await setup();
  await transaction(f.pool, async client => {
    const spy = vi.spyOn(client, 'query');
    try { await loadState(client, s.goalId); expect(spy.mock.calls.filter(([sql]) => typeof sql === 'string' && /knowledge_sources|goal_contexts|goal_execution_inputs/.test(sql))).toHaveLength(0); }
    finally { spy.mockRestore(); }
  });
  expect((await f.http(`/api/goals/${s.goalId}/commands`, s.command)).status).toBe(200);
  await transaction(f.pool, async client => {
    const spy = vi.spyOn(client, 'query');
    try {
      await loadState(client, s.goalId);
      const heads = spy.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('flow.knowledge_sources'));
      expect(heads).toHaveLength(1); expect(heads[0]![0]).toBe('SELECT id,current_version FROM flow.knowledge_sources WHERE project_id=$1 AND id=ANY($2::uuid[])');
      expect(spy.mock.calls.filter(([sql]) => typeof sql === 'string' && /goal_contexts|goal_execution_inputs/.test(sql))).toHaveLength(0);
    } finally { spy.mockRestore(); }
  });
});
it('retains exact control characters within the real JSON detail budget and rolls back failed context insertion', async () => {
  const s = await setup('\u0001'.repeat(4096));
  const second = await f.http(`/api/projects/${s.projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Second escaped source', text: '\u0002'.repeat(4096) });
  const ref = { ...s.citation, sourceId: second.body.source.id, contentDigest: second.body.version.contentDigest };
  const define = { ...s.command, input: { ...s.command.input, knowledge: [s.citation, ref] } };
  await f.pool.query("CREATE FUNCTION flow.k03_fail_context() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Own fixture context insert failure'; END $$; CREATE TRIGGER k03_fail_context BEFORE INSERT ON flow.goal_contexts FOR EACH ROW EXECUTE FUNCTION flow.k03_fail_context()");
  try { expect((await f.http(`/api/goals/${s.goalId}/commands`, define)).status).toBe(500); }
  finally { await f.pool.query('DROP TRIGGER k03_fail_context ON flow.goal_contexts; DROP FUNCTION flow.k03_fail_context()'); }
  expect((await f.pool.query('SELECT count(*) FROM flow.goal_inputs WHERE goal_id=$1', [s.goalId])).rows[0].count).toBe('0');
  expect((await f.http(`/api/goals/${s.goalId}/commands`, define)).status).toBe(200);
  const detail = await f.http(s.detailPath); expect(detail.body.rawBytes).toBe(8192); expect(detail.httpUtf8Bytes).toBeGreaterThan(49152); expect(detail.httpUtf8Bytes).toBeLessThanOrEqual(65536);
  expect(detail.body.sources.map((item: { text: string }) => item.text)).toEqual(['\u0001'.repeat(4096), '\u0002'.repeat(4096)]);
});

it('freezes an explicitly selected old version without substituting the current source head', async () => {
  const s = await setup('Explicitly selected old bytes');
  expect((await f.http(`/api/projects/${s.projectId}/knowledge/sources/${s.citation.sourceId}/versions`, { expectedVersion: 1, text: 'New current bytes' })).status).toBe(201);
  expect((await f.http(`/api/goals/${s.goalId}/commands`, s.command)).status).toBe(200);
  const detail = await f.http(s.detailPath);
  expect(detail.body.sources[0]).toMatchObject({ citation: s.citation, text: s.text, currentVersionAtFreeze: 2, isCurrentAtFreeze: false, currentVersion: 2, isCurrent: false });
  const blocked = await f.http(`/api/goals/${s.goalId}/commands`, execution(s.nodeId)); expect(blocked.body.error.code).toBe('goal_knowledge_obsolete');
  expect((await f.pool.query('SELECT count(*) FROM flow.goal_executions WHERE goal_id=$1', [s.goalId])).rows[0].count).toBe('0');
});
