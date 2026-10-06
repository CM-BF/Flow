import { FlowApiError } from '@flow/client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, it } from 'vitest';
import type { GoalGraphCapability, GoalGraphCommand } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { createGraphToolsMcp } from './mcp.js';

function capability(): GoalGraphCapability {
  return { goalId: 'goal', runId: 'run', scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 }, port: {
    async readGraph() { return { goalId: 'goal', projectId: 'project', baseRevision: 1, currentRevision: 1, stale: false, nodes: [], nextCursor: null }; },
    async readProposal() { throw new Error('unused'); },
    async commandGraph() { throw new Error('unused'); },
  } };
}
async function connected(cap = capability()) {
  const server = createGraphToolsMcp(cap); const client = new Client({ name: 'o07-official-peer', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.instance.connect(b); await client.connect(a);
  return { server, client, async close() { await client.close(); await server.instance.close(); } };
}
it('exposes exactly two actual SDK MCP tools with bounded read and explicit write annotations', async () => {
  const peer = await connected();
  try {
    expect(peer.server).toMatchObject({ type: 'sdk', name: 'flow-graph' });
    const list = await peer.client.listTools(); expect(list.tools.map(tool => tool.name).sort()).toEqual(['graph_command', 'graph_read']);
    expect(list.tools.find(tool => tool.name === 'graph_read')!.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
    expect(list.tools.find(tool => tool.name === 'graph_command')!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    const result = await peer.client.callTool({ name: 'graph_read', arguments: { request: { view: 'graph' } } });
    expect(result.isError).not.toBe(true); expect(JSON.parse((result.content as any)[0].text)).toMatchObject({ baseRevision: 1, currentRevision: 1, nodes: [] });
  } finally { await peer.close(); }
});

it('forwards the exact stable command once and exposes uncertainty without leaking exception text', async () => {
  const cap = capability(); const seen: { command: GoalGraphCommand; key: string }[] = [];
  cap.port.commandGraph = async (command, key) => { seen.push({ command, key }); throw new Error('Bearer secret-token postgres://private'); };
  const peer = await connected(cap);
  try {
    const command: GoalGraphCommand = { kind: 'propose', proposal: { expectedProjectRevision: 1, reason: '中文🙂', additions: [{ key: 'A', title: 'Draft', dependencies: [] }] } };
    const result = await peer.client.callTool({ name: 'graph_command', arguments: { command, idempotencyKey: 'same-intent' } });
    expect(seen).toEqual([{ command, key: 'same-intent' }]); expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('outcome_unknown'); expect(JSON.stringify(result)).not.toMatch(/secret-token|postgres:/);
  } finally { await peer.close(); }
});
it('rejects oversized page and unknown write kinds before reaching the host port', async () => {
  const cap = capability(); let invoked = 0;
  cap.port.readGraph = async () => { invoked++; throw new Error('unexpected'); }; cap.port.commandGraph = async () => { invoked++; throw new Error('unexpected'); };
  const peer = await connected(cap);
  try {
    expect((await peer.client.callTool({ name: 'graph_read', arguments: { request: { view: 'graph', limit: 51 } } })).isError).toBe(true);
    expect((await peer.client.callTool({ name: 'graph_command', arguments: { command: { kind: 'execute' }, idempotencyKey: 'deny' } })).isError).toBe(true);
    expect(invoked).toBe(0);
  } finally { await peer.close(); }
});
it('reports known center rejection and refuses oversized encoded replies without truncation', async () => {
  const cap = capability(); cap.port.readGraph = async () => { throw new FlowApiError(403, 'forbidden', 'secret'); };
  const peer = await connected(cap);
  try {
    const rejected = await peer.client.callTool({ name: 'graph_read', arguments: { request: { view: 'graph' } } });
    expect(rejected.isError).toBe(true); expect(JSON.stringify(rejected)).toContain('center_rejected'); expect(JSON.stringify(rejected)).not.toContain('secret');
    cap.port.readGraph = async () => ({ goalId: 'goal', projectId: 'project', baseRevision: 1, currentRevision: 1, stale: false, nodes: [{ id: 'A', title: 'x'.repeat(70_000), version: 1 }], nextCursor: null });
    const bounded = await peer.client.callTool({ name: 'graph_read', arguments: { request: { view: 'graph' } } });
    expect(bounded.isError).toBe(true); expect(JSON.stringify(bounded)).toContain('response_too_large'); expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThan(1000);
  } finally { await peer.close(); }
});
