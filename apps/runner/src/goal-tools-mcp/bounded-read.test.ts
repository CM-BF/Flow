import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { GoalDefinition, GoalSnapshot, GoalToolPort } from '../../../../packages/contracts/src/goals.js';
import { connectPeer, body } from './test-peer.js';

it('measures actual JSON-RPC bytes for 200 nodes, follows versioned details and never appends the explanation window', async () => {
  const nodes = Array.from({ length: 200 }, () => randomUUID());
  const now = '2026-10-06T00:00:00.000Z';
  const goalId = randomUUID();
  const input = { goal: '中文🙂'.repeat(800), constraints: '边界'.repeat(1000), acceptance: '验收'.repeat(500), verification: { kind: 'nonempty' as const } };
  const definitions = new Map<string, GoalDefinition>(nodes.map(nodeId => [nodeId, { nodeId, version: 1, input, createdAt: now, projectRevision: 201 }]));
  const snapshot: GoalSnapshot = {
    goal: { id: goalId, projectId: randomUUID(), originalGoal: input.goal, constraints: input.constraints, acceptance: input.acceptance, createdAt: now }, projectRevision: 201,
    nodes: nodes.map((nodeId, index) => ({ nodeId, title: `节点 ${index} 🙂`, dependsOn: nodes.slice(0, index), definition: { nodeId, version: 1, projectRevision: 201, createdAt: now }, execution: null, accepted: null, deliveryCurrent: false, dependenciesReady: index === 0, reason: 'Awaiting verified dependencies' })),
    explanations: Array.from({ length: 50 }, (_, index) => ({ version: index + 101, kind: 'define-input', text: `Explanation ${index}: ${'记'.repeat(900)}`, createdAt: now, source: { nodeId: nodes[index]!, inputVersion: 1, projectRevision: index + 1 } })),
  };
  const port: GoalToolPort = {
    async readGoal() { return snapshot; },
    async readGoalInput(_goal, node, version) { const definition = definitions.get(node); if (!definition || version !== 1) throw new Error('not found'); return definition; },
    async commandGoal() { throw new Error('not granted'); },
  };
  const peer = await connectPeer({ goalId, allowedNodeIds: [nodes[0]!], allowedCommands: [], port });
  try {
    const call = async (request: unknown) => {
      const response = await peer.client.callTool({ name: 'goal_read', arguments: { request } });
      expect(response.isError).not.toBe(true);
      return { response, data: body(response), frame: peer.frames.at(-1)! };
    };
    const overview = await call({ view: 'overview' });
    expect(overview.data.nodes).toHaveLength(5); expect(overview.data.totalNodes).toBe(200);
    expect(overview.frame.bytes).toBeLessThan(8_000);
    expect(JSON.stringify(overview.data)).not.toContain('Explanation 0:');
    expect(JSON.stringify(overview.data)).not.toContain(input.goal);
    const original = await call(overview.data.goalRef); expect(original.data.goal.originalGoal).toBe(input.goal);
    const exact = await call(overview.data.nodes[0].inputRef); expect(exact.data.definition.input).toEqual(input);
    const explanation = await call(overview.data.explanations.latestRef); expect(explanation.data.explanation).toEqual(snapshot.explanations.at(-1));
    const node = await call({ view: 'node', snapshotRef: overview.data.snapshotRef, nodeId: nodes[199] });
    expect(node.data.node.dependsOn).toEqual(nodes.slice(0, 199));
    const forbidden = await peer.client.callTool({ name: 'goal_read', arguments: { request: node.data.node.inputRef } });
    expect(body(forbidden).error).toBe('scope_denied');
    const seen: string[] = overview.data.nodes.map((entry: { nodeId: string }) => entry.nodeId);
    let next = overview.data.next; let pageCount = 1;
    while (next) { const page = await call(next); seen.push(...page.data.nodes.map((entry: { nodeId: string }) => entry.nodeId)); next = page.data.next; pageCount++; }
    expect(seen).toEqual(nodes); expect(pageCount).toBe(40);
    const old = await peer.client.callTool({ name: 'goal_read', arguments: { request: { view: 'explanation', snapshotRef: overview.data.snapshotRef, version: 1 } } });
    expect(old.isError).toBe(true); expect(body(old).error).toBe('not_available');
    const invalidLimit = await peer.client.callTool({ name: 'goal_read', arguments: { request: { view: 'overview', limit: 11 } } });
    expect(invalidLimit.isError).toBe(true);
    const initialization = peer.frames.find(frame => frame.direction === 'server' && 'result' in frame.message && typeof frame.message.result === 'object' && frame.message.result && 'protocolVersion' in frame.message.result);
    expect(initialization).toBeDefined();
    const evidence = {
      at: new Date().toISOString(), node: process.version, sdk: '0.3.290', mcpSdk: '1.32.1', zod: '4.6.5',
      initialization: initialization!.message, nodeCount: 200, explanationWindow: 50, pageCount,
      rawSnapshotJsonBytes: Buffer.byteLength(JSON.stringify(snapshot), 'utf8'),
      actualJsonRpcMessages: { overview: overview.frame, original: original.frame, input: exact.frame, explanation: explanation.frame, node: node.frame },
      maxObservedServerFrameBytes: Math.max(...peer.frames.filter(frame => frame.direction === 'server').map(frame => frame.bytes)),
      tokenEstimate: { measured: false, method: 'none', reason: 'No model tokenizer, request envelope or query was invoked. UTF-8 wire bytes are not tokens; no numeric saving or billing claim.' },
      limits: ['In-memory MCP transport, actual serialized JSON-RPC bytes, no TCP/TLS/compression', 'Synthetic bounded authority snapshot; complete snapshot still read and hashed by adapter', 'No query, model, natural-language planning or production mounting'],
    };
    const directory = process.env.FLOW_O02_EVIDENCE_DIR;
    if (directory) { await mkdir(directory, { recursive: true }); await writeFile(join(directory, 'wire.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' }); }
  } finally { await peer.close(); }
});
