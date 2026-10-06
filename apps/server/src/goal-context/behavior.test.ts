import { beforeEach, afterEach, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { startGoalContextFixture } from './fixture.js';
import { verifyText } from '../../../runner/src/verifier.js';
import { transaction } from '../database.js';
import { goalExecutionInputForTask } from './store.js';

let f: Awaited<ReturnType<typeof startGoalContextFixture>>; let ordinal = 0;
beforeEach(async () => { f = await startGoalContextFixture((process.env.FLOW_K03_RUN_LABEL ?? 'behavior') + '-behavior-' + String.fromCharCode(97 + ordinal++)); });
afterEach(async () => { await f?.close(); });
const input = { goal: 'Exact work', constraints: 'No model', acceptance: 'Complete artifact', verification: { kind: 'nonempty' } };
async function graph(titles = ['A']) {
  const projectId = await f.project(); let snapshot = (await f.http(`/api/projects/${projectId}`)).body;
  const nodes: string[] = [];
  for (const title of titles) {
    const added = await f.http(`/api/projects/${projectId}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Test graph', change: { kind: 'add-node', title } });
    expect(added.status).toBe(200); snapshot = added.body.snapshot; nodes.push(added.body.changedNodeId);
  }
  const goalId = (await f.http('/api/goals', { projectId, originalGoal: 'Exact goal', constraints: 'No model', acceptance: 'Verified deliveries' })).body.goal.id;
  return { projectId, goalId, nodes, snapshot };
}
async function source(projectId: string, text = 'Confidential frozen knowledge Ω') {
  const created = await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Selected source', text }); expect(created.status).toBe(201);
  return { projectId, sourceId: created.body.source.id, version: 1, contentDigest: created.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
}
const command = (goalId: string, body: unknown, key?: string) => f.http(`/api/goals/${goalId}/commands`, body, { key });
const define = (nodeId: string, knowledge?: unknown[], expectedInputVersion = 0) => ({ kind: 'define-input', nodeId, expectedInputVersion, input: { ...input, ...(knowledge === undefined ? {} : { knowledge }) }, reason: 'Exact input' });
const execute = (nodeId: string, dependencies: unknown[] = [], previousExecutionId: string | null = null) => ({ kind: 'execute', nodeId, expectedInputVersion: 1, dependencies, previousExecutionId, reason: 'Owner execution', fixture: { scenario: 'success', delayMs: 0 } });
async function claim(token: string, taskId: string) {
  let result: any;
  await expect.poll(async () => { result = await f.http('/api/runner/claim', {}, { token }); expect(result.status).toBe(200); return result.body.assignment; }, { timeout: 3000, interval: 20 }).not.toBeNull();
  expect(result.body.assignment.task.id).toBe(taskId); return result.body.assignment;
}
async function completed(goalId: string, nodeId: string, dependencies: unknown[] = []) {
  const accepted = await command(goalId, execute(nodeId, dependencies)); expect(accepted.status).toBe(200);
  const runner = (await f.http('/api/runners', { name: 'Controlled fixture', harnesses: ['fixture'], capacity: 1 })).body;
  const assignment = await claim(runner.token, accepted.body.task.id); const content = 'Exact artifact for ' + nodeId;
  const result = await f.http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: [
    { type: 'artifact', sequence: 1, id: randomUUID(), artifactId: 'output', title: 'Fixture', content, version: createHash('sha256').update(content).digest('hex'), mediaType: 'text/plain' },
    { ...verifyText('output', content, { kind: 'nonempty' }), sequence: 2, id: randomUUID() },
    { type: 'completed', sequence: 3, id: randomUUID(), outcome: 'succeeded' },
  ] }, { token: runner.token }); expect(result.status).toBe(200);
  const delivered = await command(goalId, { kind: 'accept-delivery', nodeId, executionId: accepted.body.executionId, expectedCurrentExecutionId: null, reason: 'Verified exact artifact' }); expect(delivered.status).toBe(200);
  return { ...accepted.body, delivery: delivered.body.delivery, content };
}
it('propagates knowledge staleness through actual dependencies while preserving independent deliveries and old history', async () => {
  const g = await graph(['A', 'B', 'C']); const [a, b, c] = g.nodes as [string, string, string];
  const node = g.snapshot.graph.nodes.find((n: any) => n.id === b); const dependency = g.snapshot.graph.nodes.find((n: any) => n.id === a);
  expect((await f.http(`/api/projects/${g.projectId}/commands`, { expectedRevision: g.snapshot.project.revision, reason: 'B requires A', change: { kind: 'set-dependencies', nodeId: b, expectedNodeVersion: node.version, dependencies: [{ nodeId: a, expectedVersion: dependency.version }] } })).status).toBe(200);
  const ref = await source(g.projectId); const stableB = await source(g.projectId, 'Stable B knowledge');
  for (const [id, refs] of [[a, [ref]], [b, [stableB]], [c, undefined]] as const) expect((await command(g.goalId, define(id, refs as unknown[] | undefined))).status).toBe(200);
  const firstA = await completed(g.goalId, a); const firstB = await completed(g.goalId, b, [firstA.delivery]); const firstC = await completed(g.goalId, c);
  const publicB = (await f.http(`/api/tasks/${firstB.task.id}`)).body.prompt;
  const privateB = await transaction(f.pool, client => goalExecutionInputForTask(client, firstB.task.id, publicB));
  expect(privateB!.prompt).toContain(firstA.content); expect(privateB!.prompt).toContain('Stable B knowledge');
  expect((await f.http(`/api/projects/${g.projectId}/knowledge/sources/${ref.sourceId}/versions`, { expectedVersion: 1, text: 'New material' })).status).toBe(201);
  const view = (await f.http(`/api/goals/${g.goalId}`)).body;
  expect(view.nodes.find((n: any) => n.nodeId === a)).toMatchObject({ knowledgeCurrent: false, deliveryCurrent: false, accepted: firstA.delivery });
  expect(view.nodes.find((n: any) => n.nodeId === b)).toMatchObject({ knowledgeCurrent: true, deliveryCurrent: false, dependenciesReady: false, accepted: firstB.delivery });
  expect(view.nodes.find((n: any) => n.nodeId === c)).toMatchObject({ deliveryCurrent: true, accepted: firstC.delivery });
  expect(JSON.stringify(view)).not.toContain('Confidential frozen knowledge'); expect(view.nodes.every((n: any) => !n.definition?.input && !n.execution?.input)).toBe(true);
  expect((await command(g.goalId, { kind: 'accept-delivery', nodeId: a, executionId: firstA.executionId, expectedCurrentExecutionId: firstA.executionId, reason: 'Cannot revive obsolete source' })).body.error.code).toBe('execution_obsolete');
  expect((await command(g.goalId, execute(a, [], firstA.executionId))).body.error.code).toBe('goal_knowledge_obsolete');
  expect((await f.http(`/api/details/${firstA.delivery.detailId}`)).body.content).toBe(firstA.content);
  expect((await f.http(`/api/goals/${g.goalId}/executions?nodeId=${a}`)).body.executions[0].inputCurrent).toBe(false);
  expect(await transaction(f.pool, client => goalExecutionInputForTask(client, firstB.task.id, publicB))).toEqual(privateB);
});
it('restricts runner reference changes and execution inside the first command branch while replaying prior accepted receipts', async () => {
  const g = await graph(); const nodeId = g.nodes[0]!; const first = await source(g.projectId, 'Owner source one'); const second = await source(g.projectId, 'Owner source two');
  expect((await command(g.goalId, define(nodeId, [first, second]))).status).toBe(200);
  const run = await f.http(`/api/goals/${g.goalId}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [nodeId], allowedCommands: ['define-input', 'execute'], maxCommands: 5 }, prompt: 'Keep owner references', execution: { harness: 'fixture' } }); expect(run.status).toBe(201);
  const runner = (await f.http('/api/runners', { name: 'Planner', harnesses: ['fixture'], capacity: 1 })).body; const assignment = await claim(runner.token, run.body.task.id);
  const call = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, grant: { id: run.body.run.id, version: 1 } };
  const send = (cmd: unknown, key?: string) => f.http('/api/runner/goal-tools/command', { ...call, command: cmd }, { token: runner.token, key });
  for (const refs of [undefined, [], [first], [second, first]]) expect((await send(define(nodeId, refs, 1))).body.error.code).toBe('goal_knowledge_owner_required');
  expect((await send(execute(nodeId))).body.error.code).toBe('goal_knowledge_owner_required');
  const keep = { ...define(nodeId, [first, second], 1), input: { ...input, goal: 'Runner may refine text', knowledge: [first, second] } }; const key = randomUUID();
  const accepted = await send(keep, key); expect(accepted.status).toBe(200); expect(accepted.body.inputVersion).toBe(2);
  const read = await f.http('/api/runner/goal-tools/input', { ...call, nodeId, version: 2 }, { token: runner.token }); expect(read.status).toBe(200); expect(read.body.input.knowledge).toEqual([first, second]); expect(JSON.stringify(read.body)).not.toContain('Owner source one');
  expect((await command(g.goalId, define(nodeId, [second], 2))).status).toBe(200);
  expect((await send(keep, key)).body).toEqual({ ...accepted.body, replayed: true });
  expect((await send(keep)).body.error.code).toBe('goal_knowledge_owner_required');
});
it('keeps old no-reference request receipts stable and treats empty references as a semantic no-op', async () => {
  const g = await graph(); const nodeId = g.nodes[0]!; const old = define(nodeId); const key = randomUUID();
  const first = await command(g.goalId, old, key); expect(first.status).toBe(200);
  expect((await command(g.goalId, define(nodeId, [], 1))).body.changed).toBe(false);
  const ref = await source(g.projectId); expect((await command(g.goalId, define(nodeId, [ref], 1))).status).toBe(200);
  await f.restart(); expect((await command(g.goalId, old, key)).body).toEqual({ ...first.body, replayed: true });
  const stored = (await f.http(`/api/goals/${g.goalId}/inputs/${nodeId}?version=1`)).body.input; expect(Object.hasOwn(stored, 'knowledge')).toBe(false);
});
it('rejects cross-project, duplicate, bad-boundary and oversized selections without orphan inputs or receipts', async () => {
  const g = await graph(); const nodeId = g.nodes[0]!; const other = await graph(); const foreign = await source(other.projectId); const utf = await source(g.projectId, '😀 exact');
  const wide = await source(g.projectId, 'x'.repeat(4096)); const wideTwo = await source(g.projectId, 'y'.repeat(4096)); const more = await source(g.projectId, 'z');
  for (const refs of [[foreign], [utf, utf], [{ ...utf, locator: { ...utf.locator, start: 1 } }], [{ ...utf, contentDigest: '0'.repeat(64) }], [wide, wideTwo, more]]) {
    const result = await command(g.goalId, define(nodeId, refs)); expect([400, 404, 409]).toContain(result.status);
    expect((await f.pool.query('SELECT count(*) FROM flow.goal_inputs WHERE goal_id=$1', [g.goalId])).rows[0].count).toBe('0');
    expect((await f.pool.query('SELECT count(*) FROM flow.goal_contexts WHERE goal_id=$1', [g.goalId])).rows[0].count).toBe('0');
  }
  expect((await command(g.goalId, define(nodeId, [wide, wideTwo]))).status).toBe(200);
  const detail = await f.http(`/api/goals/${g.goalId}/nodes/${nodeId}/inputs/1/context`); expect(detail.body.rawBytes).toBe(8192); expect(detail.httpUtf8Bytes).toBeLessThanOrEqual(65536);
});
