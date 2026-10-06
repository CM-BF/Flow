import { expect, it } from 'vitest';
import type { GoalCommand, GoalToolPort } from '../../../../packages/contracts/src/goals.js';
import { createGoalTools } from './index.js';

function setup() {
  const calls: unknown[][] = [];
  const port = {
    async readGoal(...args: unknown[]) { calls.push(['read', ...args]); return { id: 'allowed', nodes: [{ nodeId: 'A' }, { nodeId: 'B' }] }; },
    async readGoalInput(...args: unknown[]) { calls.push(['input', ...args]); return { version: 3 }; },
    async commandGoal(...args: unknown[]) { calls.push(['command', ...args]); return { accepted: true }; },
  } as unknown as GoalToolPort;
  const nodes = ['A']; const permissions: GoalCommand['kind'][] = ['define-input'];
  const tools = createGoalTools({ goalId: 'fixed-goal', allowedNodeIds: nodes, allowedCommands: permissions, port });
  nodes.push('B'); permissions.push('execute');
  return { calls, tools };
}
const definition = { kind: 'define-input', nodeId: 'A', expectedInputVersion: 0, input: { goal: 'A', constraints: '', acceptance: 'nonempty', verification: { kind: 'nonempty' } }, reason: 'Actual input' };
it('binds read/commands to host goal, preserves explicit key and snapshots capability lists', async () => {
  const { tools, calls } = setup();
  expect(await tools.read({})).toEqual({ id: 'allowed', nodes: [{ nodeId: 'A' }, { nodeId: 'B' }] });
  expect(await tools.read({ nodeId: 'A', version: 3 })).toEqual({ version: 3 });
  expect(await tools.command({ command: definition, idempotencyKey: 'stable-key' })).toEqual({ accepted: true });
  expect(calls).toEqual([['read', 'fixed-goal'], ['input', 'fixed-goal', 'A', 3], ['command', 'fixed-goal', definition, 'stable-key']]);
  await expect(tools.command({ command: { ...definition, nodeId: 'B' }, idempotencyKey: 'other' })).rejects.toMatchObject({ code: 'scope_denied' });
  expect(calls).toHaveLength(3);
});
it('rejects foreign goal/node, ungranted actions, unknown fields and malformed versions before any transport', async () => {
  const { tools, calls } = setup();
  await expect(tools.read({ goalId: 'foreign' })).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(tools.read({ nodeId: 'B' })).rejects.toMatchObject({ code: 'scope_denied' });
  await expect(tools.read({ version: 1 })).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(tools.command({ command: { ...definition, expectedInputVersion: -1 }, idempotencyKey: 'key' })).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(tools.command({ command: definition, idempotencyKey: 'key', token: 'injection' })).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(tools.command({ command: { kind: 'execute', nodeId: 'A', expectedInputVersion: 1, dependencies: [], previousExecutionId: null, fixture: { scenario: 'success' }, reason: 'Denied' }, idempotencyKey: 'key' })).rejects.toMatchObject({ code: 'scope_denied' });
  expect(calls).toEqual([]);
});
