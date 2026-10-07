import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindChildAssignment, bindPlannerAssignment } from './assignment.mjs';
const profile = { id: 'pin', runnerId: 'runner', configDigest: 'a'.repeat(64) };
const identity = { taskId: 'task-2', attemptId: 'attempt-2', runnerId: 'runner', ownerVersion: 7 };
const expected = { goalId: 'goal', projectId: 'project', progressionId: 'progression', authorizationDigest: 'b'.repeat(64),
  nodes: [{ nodeId: 'node-1', inputVersion: 1, executionProfile: profile }, { nodeId: 'node-2', inputVersion: 1, executionProfile: profile }] };
const current = { progression: { id: 'progression', goalId: 'goal', authorizationDigest: expected.authorizationDigest, state: 'active',
  nodes: [{ nodeId: 'node-1', executionId: 'exec-1', task: { id: 'task-1', status: 'succeeded' } }, { nodeId: 'node-2', executionId: 'exec-2', task: { id: 'task-2', status: 'running' } }] },
  delivery: { goalId: 'goal', projectId: 'project', nodes: [{ nodeId: 'node-2', inputRef: { goalId: 'goal', nodeId: 'node-2', version: 1 }, knowledgeCurrent: true,
    execution: { id: 'exec-2', inputCurrent: true, inputRef: { goalId: 'goal', nodeId: 'node-2', version: 1 }, task: { id: 'task-2', status: 'running', attemptId: 'attempt-2', ownerVersion: 7 } } }] } };

test('child slots bind public progression and current attempt, never prompt or claim order', () => {
  assert.equal(bindChildAssignment(expected, current, identity, profile).slot, 'child-2');
  const mutations = [x => x.progression.authorizationDigest = 'c'.repeat(64), x => x.progression.goalId = 'other',
    x => x.progression.state = 'revoked', x => x.progression.nodes[1].executionId = 'old-execution',
    x => x.delivery.nodes[0].execution.task.attemptId = 'old-attempt', x => x.delivery.nodes[0].execution.task.ownerVersion++,
    x => x.delivery.nodes[0].inputRef.version++, x => x.delivery.nodes[0].execution.inputCurrent = false,
    x => x.delivery.nodes[0].knowledgeCurrent = false, x => x.delivery.projectId = 'other'];
  for (const change of mutations) { const copy = structuredClone(current); change(copy); assert.throws(() => bindChildAssignment(expected, copy, identity, profile), /assignment/i); }
  assert.throws(() => bindChildAssignment(expected, current, { ...identity, runnerId: 'other' }, profile), /assignment/i);
  assert.throws(() => bindChildAssignment(expected, current, identity, { ...profile, id: 'other' }), /assignment/i);
});

test('planner identity binds the original admitted task and configured runner', () => {
  const admitted = { goalId: 'goal', runId: 'run', taskId: 'planner', executionProfile: profile };
  const actual = { taskId: 'planner', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 };
  assert.equal(bindPlannerAssignment(admitted, actual, { goalId: 'goal', runId: 'run' }, profile).slot, 'planner');
  assert.throws(() => bindPlannerAssignment(admitted, { ...actual, taskId: 'other' }, { goalId: 'goal', runId: 'run' }, profile), /assignment/i);
  assert.throws(() => bindPlannerAssignment(admitted, actual, { goalId: 'goal', runId: 'other' }, profile), /assignment/i);
});
