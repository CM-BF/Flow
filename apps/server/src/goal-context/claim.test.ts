import { beforeEach, afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startGoalContextFixture } from './fixture.js';
import { transaction } from '../database.js';
import { goalExecutionInputForTask } from './store.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { createFixtureAdapter } from '../../../runner/src/fixture.js';
let f: Awaited<ReturnType<typeof startGoalContextFixture>>; let ordinal = 0;
beforeEach(async () => { f = await startGoalContextFixture((process.env.FLOW_K03_RUN_LABEL ?? 'claim') + '-claim-' + String.fromCharCode(97 + ordinal++)); });
afterEach(async () => { await f?.close(); });
async function pending() {
  const projectId = await f.project(); const project = (await f.http(`/api/projects/${projectId}`)).body;
  const nodeId = (await f.http(`/api/projects/${projectId}/commands`, { expectedRevision: project.project.revision, reason: 'Claim test', change: { kind: 'add-node', title: 'Private execution' } })).body.changedNodeId;
  const goalId = (await f.http('/api/goals', { projectId, originalGoal: 'Exact goal', constraints: 'No model', acceptance: 'Verified' })).body.goal.id;
  const source = (await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Private material', text: 'Only private claim sees this knowledge 古😀' })).body;
  const ref = { projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength('Only private claim sees this knowledge 古😀') } };
  expect((await f.http(`/api/goals/${goalId}/commands`, { kind: 'define-input', nodeId, expectedInputVersion: 0, input: { goal: 'Use selected reference', constraints: '', acceptance: 'Verified', verification: { kind: 'nonempty' }, knowledge: [ref] }, reason: 'Freeze' })).status).toBe(200);
  const accepted = await f.http(`/api/goals/${goalId}/commands`, { kind: 'execute', nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Execute fixed context', fixture: { scenario: 'success', delayMs: 0 } }); expect(accepted.status).toBe(200);
  const task = (await f.http(`/api/tasks/${accepted.body.task.id}`)).body;
  const privateInput = await transaction(f.pool, client => goalExecutionInputForTask(client, task.id, task.prompt));
  return { projectId, goalId, nodeId, task, privateInput: privateInput! };
}
it('returns the complete frozen private prompt from the real authenticated claim while public projections stay raw', async () => {
  const s = await pending(); const runner = (await f.http('/api/runners', { name: 'Goal claim', harnesses: ['fixture'], capacity: 1 })).body;
  expect(JSON.stringify(s.task)).not.toContain('Only private claim sees'); expect((await f.initialStream(s.task.id)).text).not.toContain('Only private claim sees');
  let claimed: any;
  await expect.poll(async () => { claimed = await f.http('/api/runner/claim', {}, { token: runner.token }); expect(claimed.status).toBe(200); return claimed.body.assignment; }, { timeout: 3000, interval: 20 }).not.toBeNull();
  expect(claimed.body.assignment.task.prompt).toBe(s.privateInput.prompt);
  expect(claimed.body.assignment).not.toHaveProperty('conversationContext'); expect(claimed.body.assignment).not.toHaveProperty('goalContext');
  expect((await f.http(`/api/tasks/${s.task.id}`)).body.prompt).toBe(s.task.prompt);
});
it('rolls back attempt and ownership writes when the declared goal input is corrupt', async () => {
  const s = await pending(); const runner = (await f.http('/api/runners', { name: 'Invalid goal input', harnesses: ['fixture'], capacity: 1 })).body;
  const id = s.privateInput.context.executionInputId;
  await f.pool.query('ALTER TABLE flow.goal_execution_inputs DISABLE TRIGGER goal_execution_inputs_immutable');
  try { await f.pool.query("UPDATE flow.goal_execution_inputs SET execution_input_digest=repeat('0',64) WHERE id=$1", [id]); }
  finally { await f.pool.query('ALTER TABLE flow.goal_execution_inputs ENABLE TRIGGER goal_execution_inputs_immutable'); }
  await expect.poll(async () => (await f.pool.query('SELECT dispatch_ready FROM flow.tasks WHERE id=$1',[s.task.id])).rows[0].dispatch_ready).toBe(true);
  const claim = await f.http('/api/runner/claim', {}, { token: runner.token }); expect(claim.status).toBe(409); expect(claim.body.error.code).toBe('goal_context_invalid');
  expect((await f.pool.query('SELECT status,current_attempt_id,owner_version FROM flow.tasks WHERE id=$1',[s.task.id])).rows[0]).toEqual({status:'queued',current_attempt_id:null,owner_version:0});
  expect((await f.pool.query('SELECT count(*) FROM flow.attempts WHERE task_id=$1',[s.task.id])).rows[0].count).toBe('0');
});
it('executes the frozen prompt through the existing runner and fixture adapter without adding a runner field', async () => {
  const s = await pending(); const runner = (await f.http('/api/runners', { name: 'Actual goal fixture runtime', harnesses: ['fixture'], capacity: 1 })).body;
  const directory = await mkdtemp(join(tmpdir(),'flow-k03-runner-')); const controller = new AbortController();
  const running = runRunner({ baseUrl:f.baseUrl, token:runner.token, workingDirectory:directory, adapters:[createFixtureAdapter()], signal:controller.signal });
  try {
    await expect.poll(async () => (await f.http(`/api/tasks/${s.task.id}`)).body.status, {timeout:8000, interval:30}).toBe('succeeded');
    const snapshot = (await f.http(`/api/tasks/${s.task.id}`)).body; expect(snapshot.prompt).toBe(s.task.prompt);
    const detailId = (await f.pool.query('SELECT detail_id FROM flow.artifacts WHERE task_id=$1',[s.task.id])).rows[0].detail_id;
    expect((await f.http(`/api/details/${detailId}`)).body.content).toBe(`Flow fixture result\n${s.privateInput.prompt}\n`);
  } finally { controller.abort(); await running; await rm(directory,{recursive:true,force:true}); }
});
