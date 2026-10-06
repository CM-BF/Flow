import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, expect, it } from 'vitest';
import type { GoalSnapshot, GoalToolPort } from '../../../../packages/contracts/src/goals.js';
import { createGoalToolsMcp } from './index.js';

const goalId = randomUUID();
const nodeId = randomUUID();
const snapshot: GoalSnapshot = {
  goal: { id: goalId, projectId: randomUUID(), originalGoal: '中文目标🙂', constraints: 'No models', acceptance: 'Exact input', createdAt: '2026-10-06T00:00:00.000Z' },
  projectRevision: 1,
  nodes: [{ nodeId, title: 'Node A', dependsOn: [], definition: null, execution: null, accepted: null, deliveryCurrent: false, dependenciesReady: true, reason: 'input undefined' }],
  explanations: [],
};
const close: (() => Promise<void>)[] = [];
afterEach(async () => { for (const stop of close.splice(0)) await stop(); });
async function peer(port: GoalToolPort) {
  const bridge = createGoalToolsMcp({ goalId, allowedNodeIds: [nodeId], allowedCommands: ['define-input'], port });
  const client = new Client({ name: 'o02-official-peer', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  close.push(async () => { await client.close(); await bridge.instance.close(); });
  await bridge.instance.connect(serverTransport); await client.connect(clientTransport);
  return client;
}
const port: GoalToolPort = {
  async readGoal(id) { expect(id).toBe(goalId); return structuredClone(snapshot); },
  async readGoalInput() { throw new Error('unused'); },
  async commandGoal() { throw new Error('unused'); },
};
it('exposes real SDK tools through initialize/list/call with truthful annotations and a compact overview', async () => {
  const client = await peer(port);
  const list = await client.listTools();
  expect(list.tools.map(value => value.name)).toEqual(['goal_read', 'goal_command']);
  expect(list.tools[0]!.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
  expect(list.tools[1]!.annotations).toMatchObject({ readOnlyHint: false });
  const result = await client.callTool({ name: 'goal_read', arguments: { request: { view: 'overview' } } });
  expect(result.isError).not.toBe(true);
  const content = result.content as { type: string; text: string }[];
  const value = JSON.parse(content[0]!.text);
  expect(value.goalId).toBe(goalId);
  expect(value.nodes[0]).toMatchObject({ nodeId, title: 'Node A' });
  expect(value.omitted).toContain('original goal text');
  expect(JSON.stringify(value)).not.toContain('中文目标');
  expect(value.snapshotRef).toMatch(/^[a-f0-9]{64}$/);
});
function value(result: Awaited<ReturnType<Client['callTool']>>) { return JSON.parse((result.content as { text: string }[])[0]!.text); }
it('pages bounded summaries, resolves exact text refs and rejects stale snapshot refs', async () => {
  let current = { ...structuredClone(snapshot), nodes: Array.from({ length: 12 }, (_, index) => ({ ...snapshot.nodes[0]!, nodeId: randomUUID(), title: `Node ${index}` })) };
  const client = await peer({ ...port, async readGoal() { return structuredClone(current); } });
  const first = value(await client.callTool({ name: 'goal_read', arguments: { request: { view: 'overview' } } }));
  expect(first.nodes).toHaveLength(5); expect(first.totalNodes).toBe(12); expect(first.next).toBeTruthy();
  const second = value(await client.callTool({ name: 'goal_read', arguments: { request: first.next } }));
  expect(second.nodes[0].title).toBe('Node 5');
  const full = value(await client.callTool({ name: 'goal_read', arguments: { request: first.goalRef } }));
  expect(full.goal.originalGoal).toBe('中文目标🙂');
  current = { ...current, projectRevision: 2 };
  const stale = await client.callTool({ name: 'goal_read', arguments: { request: first.next } });
  expect(stale.isError).toBe(true); expect(value(stale).error).toBe('stale_snapshot');
});
it('restricts versioned full inputs and commands through the existing host handler', async () => {
  const calls: unknown[] = [];
  const input = { goal: '原文🙂', constraints: '', acceptance: 'Exact', verification: { kind: 'nonempty' as const } };
  const client = await peer({ ...port,
    async readGoalInput(id, node, version) { calls.push([id, node, version]); return { nodeId: node, version: version!, input, projectRevision: 1, createdAt: '2026-10-06T00:00:00Z' }; },
    async commandGoal() { throw new Error('credential=TOP_SECRET'); },
  });
  const allowed = value(await client.callTool({ name: 'goal_read', arguments: { request: { view: 'input', nodeId, version: 1 } } }));
  expect(allowed.definition.input).toEqual(input); expect(calls).toEqual([[goalId, nodeId, 1]]);
  const denied = await client.callTool({ name: 'goal_read', arguments: { request: { view: 'input', nodeId: randomUUID(), version: 1 } } });
  expect(denied.isError).toBe(true); expect(value(denied).error).toBe('scope_denied'); expect(calls).toHaveLength(1);
  const command = { kind: 'define-input', nodeId, expectedInputVersion: 0, input, reason: 'Define' };
  const unknown = await client.callTool({ name: 'goal_command', arguments: { command, idempotencyKey: 'stable-key' } });
  expect(unknown.isError).toBe(true); expect(value(unknown).error).toBe('outcome_unknown'); expect(JSON.stringify(unknown)).not.toContain('TOP_SECRET');
  const forbidden = await client.callTool({ name: 'goal_command', arguments: { command: { kind: 'execute', nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Run', fixture: { scenario: 'success' } }, idempotencyKey: 'key' } });
  expect(forbidden.isError).toBe(true); expect(value(forbidden).error).toBe('scope_denied');
});
it('reports unavailable explanations and rejects oversized responses without silent truncation', async () => {
  const client = await peer({ ...port, async readGoal() { return { ...snapshot, goal: { ...snapshot.goal, originalGoal: 'x'.repeat(100_000) } }; } });
  const overview = value(await client.callTool({ name: 'goal_read', arguments: { request: { view: 'overview' } } }));
  const unavailable = await client.callTool({ name: 'goal_read', arguments: { request: { view: 'explanation', snapshotRef: overview.snapshotRef, version: 1 } } });
  expect(unavailable.isError).toBe(true); expect(value(unavailable).error).toBe('not_available');
  const oversized = await client.callTool({ name: 'goal_read', arguments: { request: overview.goalRef } });
  expect(oversized.isError).toBe(true); expect(value(oversized).error).toBe('response_too_large');
});
