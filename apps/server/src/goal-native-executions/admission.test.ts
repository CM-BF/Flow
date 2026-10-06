import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { startNativeGoalFixture } from './fixture.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { createFixtureAdapter } from '../../../runner/src/fixture.js';

let f: Awaited<ReturnType<typeof startNativeGoalFixture>>;
beforeAll(async () => { f = await startNativeGoalFixture('admission'); });
afterAll(async () => { await f?.close(); });
const configured = (access: ExecutionProfileConfiguration['access'] = 'configured-readonly'): ExecutionProfileConfiguration => ({
  harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-o09', thinking: 'disabled', permissionMode: 'dontAsk', access,
  requireReadApproval: false, materialScopeDigest: access.startsWith('goal-') ? '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' : 'a'.repeat(64),
  limits: { maxTurns: 2, maxBudgetUsd: 0.1, timeoutMs: 2000 },
});
async function profile(access?: ExecutionProfileConfiguration['access']) {
  const runner = (await f.http('/api/runners', { name: 'O09 configured reader', harnesses: ['claude'], capacity: 1 })).body;
  const result = await f.http('/api/runner/execution-profile', { configuration: configured(access) }, { token: runner.token });
  expect(result.status).toBe(200); return { runner, reference: result.body.profile.reference };
}
const request = (nodeId: string, executionProfile: unknown) => ({ nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Owner authorizes one text execution', executionProfile });

it('durably admits one owner-selected readonly execution and recovers its receipt after an unread response and center restart', async () => {
  const goal = await f.goal(); const selected = await profile(); const input = request(goal.nodeId, selected.reference);
  const path = `/api/goals/${goal.goalId}/native-executions`; const key = randomUUID();
  expect(await f.discardReply(path, input, key)).toBe(201);
  await f.restart();
  const replay = await f.http(path, input, { key }); expect(replay.status).toBe(201);
  expect(replay.body).toMatchObject({ replayed: true, changed: true, executionProfile: selected.reference, task: { harness: 'claude', status: 'queued' }, inputVersion: 1 });
  const history = await f.http(`/api/goals/${goal.goalId}/executions?nodeId=${goal.nodeId}`);
  expect(history.body.executions).toHaveLength(1); expect(history.body.executions[0].task.id).toBe(replay.body.task.id);
  expect((await f.http(path, { ...input, reason: 'Changed input' }, { key })).status).toBe(409);
  const snapshot = (await f.http(`/api/goals/${goal.goalId}`)).body;
  expect(snapshot.nodes[0].accepted).toBeNull();
  await f.http(`/api/tasks/${replay.body.task.id}/cancel`, {});
});

it('rejects runner credentials, forged controls and non-readonly or invalid profile pins without consuming admission', async () => {
  const goal = await f.goal(); const selected = await profile();
  const path = `/api/goals/${goal.goalId}/native-executions`; const input = request(goal.nodeId, selected.reference); const key = randomUUID();
  expect((await f.http(path, input, { token: selected.runner.token })).status).toBe(403);
  for (const extra of [{ harness: 'claude' }, { prompt: 'bypass frozen input' }, { fixture: { scenario: 'success' } }, { access: 'goal-tools' }]) {
    expect((await f.http(path, { ...input, ...extra }, { key })).status).toBe(400);
  }
  for (const pin of [{ ...selected.reference, id: randomUUID() }, { ...selected.reference, runnerId: randomUUID() }, { ...selected.reference, configDigest: 'f'.repeat(64) }]) {
    expect((await f.http(path, { ...input, executionProfile: pin }, { key })).status).toBe(409);
  }
  for (const access of ['none', 'goal-tools', 'goal-graph-tools'] as const) {
    const denied = await profile(access);
    expect((await f.http(path, { ...input, executionProfile: denied.reference }, { key })).status).toBe(409);
  }
  const revoked = await profile(); await f.http(`/api/runners/${revoked.runner.runnerId}/revoke`, {});
  expect((await f.http(path, { ...input, executionProfile: revoked.reference }, { key })).status).toBe(409);
  const accepted = await f.http(path, input, { key }); expect(accepted.status).toBe(201); expect(accepted.body.replayed).toBe(false);
  await f.http(`/api/tasks/${accepted.body.task.id}/cancel`, {});
});

it('keeps current input, dependency and predecessor gates while serializing concurrent owner admissions', async () => {
  const goal = await f.goal(); const selected = await profile();
  const path = `/api/goals/${goal.goalId}/native-executions`; const input = request(goal.nodeId, selected.reference); const key = randomUUID();
  expect((await f.http(path, { ...input, expectedInputVersion: 2 }, { key })).body.error.code).toBe('input_version');
  expect((await f.http(path, { ...input, dependencies: [{ nodeId: randomUUID(), executionId: randomUUID(), taskId: randomUUID(), artifactId: randomUUID(), artifactVersion: 'a'.repeat(64), detailId: randomUUID() }] }, { key })).body.error.code).toBe('dependency_version');
  expect((await f.http(path, { ...input, previousExecutionId: randomUUID() }, { key })).body.error.code).toBe('execution_version');
  const parallel = await Promise.all([f.http(path, input, { key }), f.http(path, input)]);
  expect(parallel.map(value => value.status).sort()).toEqual([201, 409]);
  const accepted = parallel.find(value => value.status === 201)!.body;
  expect((await f.http(path, { ...input, previousExecutionId: accepted.executionId })).body.error.code).toBe('execution_unsettled');
  await f.http(`/api/tasks/${accepted.task.id}/cancel`, {});
  const next = await f.http(path, { ...input, previousExecutionId: accepted.executionId }); expect(next.status).toBe(201);
  expect(next.body.task.id).not.toBe(accepted.task.id); await f.http(`/api/tasks/${next.body.task.id}/cancel`, {});
});

it('claims only on the selected profile and preserves a committed receipt after the runner is revoked', async () => {
  const goal = await f.goal(); const selected = await profile(); const wrong = await profile();
  const path = `/api/goals/${goal.goalId}/native-executions`; const input = request(goal.nodeId, selected.reference); const key = randomUUID();
  const accepted = await f.http(path, input, { key }); expect(accepted.status).toBe(201);
  let claim: Awaited<ReturnType<typeof f.http>>;
  await expect.poll(async () => {
    expect((await f.http('/api/runner/claim', {}, { token: wrong.runner.token })).body.assignment).toBeNull();
    claim = await f.http('/api/runner/claim', {}, { token: selected.runner.token }); return claim.body.assignment;
  }, { timeout: 5000, interval: 20 }).toBeTruthy();
  expect(claim!.body.assignment.task).toMatchObject({ id: accepted.body.task.id, harness: 'claude', executionProfile: selected.reference });
  expect(claim!.body.assignment.goalTools).toBeUndefined(); expect(claim!.body.assignment.goalGraphTools).toBeUndefined();
  await f.http(`/api/runners/${selected.runner.runnerId}/revoke`, {});
  expect((await f.http(path, input, { key })).body).toMatchObject({ replayed: true, task: { id: accepted.body.task.id } });
  expect((await f.http('/api/runner/claim', {}, { token: selected.runner.token })).status).toBe(401);
  expect((await f.http(path, { ...input, previousExecutionId: accepted.body.executionId })).status).toBe(409);
});

it('keeps native execution and delivery owner-only while the old node grant still executes and accepts a fixture child', async () => {
  const goal = await f.goal(); const selected = await profile();
  const native = (await f.http(`/api/goals/${goal.goalId}/native-executions`, request(goal.nodeId, selected.reference))).body;
  const revision = (await f.http(`/api/projects/${goal.projectId}`)).body.project.revision;
  const added = (await f.http(`/api/projects/${goal.projectId}/commands`, { expectedRevision: revision, reason: 'Fixture compatibility', change: { kind: 'add-node', title: 'Fixture sibling' } })).body.changedNodeId;
  expect((await f.http(`/api/goals/${goal.goalId}/commands`, { kind: 'define-input', nodeId: added, expectedInputVersion: 0, reason: 'Owner fixture input', input: { goal: 'Deterministic sibling', constraints: '', acceptance: 'Known fixture', verification: { kind: 'nonempty' } } })).status).toBe(200);
  const admitted = await f.http(`/api/goals/${goal.goalId}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [goal.nodeId, added], allowedCommands: ['execute', 'accept-delivery'], maxCommands: 4 }, prompt: 'Only fixture authority', execution: { harness: 'fixture' } });
  expect(admitted.status).toBe(201);
  const planner = (await f.http('/api/runners', { name: 'Legacy scoped fixture planner', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: any;
  await expect.poll(async () => { assignment = (await f.http('/api/runner/claim', {}, { token: planner.token })).body.assignment; return assignment; }, { timeout: 5000, interval: 20 }).toBeTruthy();
  expect(assignment.task.id).toBe(admitted.body.task.id);
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const call = (command: unknown) => f.http('/api/runner/goal-tools/command', { ...ownership, grant: { id: admitted.body.run.id, version: 1 }, command }, { token: planner.token });
  expect((await f.http(`/api/goals/${goal.goalId}/native-executions`, request(added, selected.reference), { token: planner.token })).status).toBe(403);
  expect((await call({ kind: 'execute', ...request(added, selected.reference), fixture: { scenario: 'success' } })).status).toBe(400);
  expect((await call({ kind: 'accept-delivery', nodeId: goal.nodeId, executionId: native.executionId, expectedCurrentExecutionId: null, reason: 'Cannot declare native semantics' })).status).toBe(403);
  const execution = await call({ kind: 'execute', nodeId: added, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Existing fixture scope', fixture: { scenario: 'success', delayMs: 0 } });
  expect(execution.status).toBe(200); expect(execution.body.task.harness).toBe('fixture');
  const child = (await f.http('/api/runners', { name: 'Fixture child', harnesses: ['fixture'], capacity: 1 })).body;
  const directory = await mkdtemp(join(tmpdir(), 'flow-o09-fixture-')); const stop = new AbortController();
  const running = runRunner({ baseUrl: f.baseUrl, token: child.token, workingDirectory: directory, adapters: [createFixtureAdapter()], signal: stop.signal });
  try {
    await expect.poll(async () => (await f.http(`/api/tasks/${execution.body.task.id}`)).body.status, { timeout: 5000, interval: 20 }).toBe('succeeded');
    const accepted = await call({ kind: 'accept-delivery', nodeId: added, executionId: execution.body.executionId, expectedCurrentExecutionId: null, reason: 'Accept deterministic fixture' });
    expect(accepted.status).toBe(200); expect(accepted.body.delivery.taskId).toBe(execution.body.task.id);
    expect((await f.http(`/api/goal-tool-runs/${admitted.body.run.id}/calls`)).body.calls).toHaveLength(2);
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
  await f.http('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] }, { token: planner.token });
  await f.http(`/api/tasks/${native.task.id}/cancel`, {});
});

it('does not authorize another execution when a claimed native predecessor becomes uncertain', async () => {
  await f.restart(200);
  const goal = await f.goal(); const selected = await profile();
  const input = request(goal.nodeId, selected.reference); const path = `/api/goals/${goal.goalId}/native-executions`;
  const accepted = (await f.http(path, input)).body;
  let assignment: any;
  await expect.poll(async () => { assignment = (await f.http('/api/runner/claim', {}, { token: selected.runner.token })).body.assignment; return assignment; }, { timeout: 5000, interval: 20 }).toBeTruthy();
  await expect.poll(async () => (await f.http(`/api/tasks/${accepted.task.id}`)).body.status, { timeout: 3000, interval: 30 }).toBe('uncertain');
  expect((await f.http(path, { ...input, previousExecutionId: accepted.executionId })).body.error.code).toBe('execution_unsettled');
  await f.restart(30_000);
  expect((await f.http('/api/runner/claim', {}, { token: selected.runner.token })).body.assignment).toBeNull();
  const unchanged = (await f.http(`/api/tasks/${accepted.task.id}`)).body;
  expect(unchanged.status).toBe('uncertain'); expect(unchanged.attempt.id).toBe(assignment.attempt.id);
  expect((await f.http(`/api/goals/${goal.goalId}/executions?nodeId=${goal.nodeId}`)).body.executions).toHaveLength(1);
});
