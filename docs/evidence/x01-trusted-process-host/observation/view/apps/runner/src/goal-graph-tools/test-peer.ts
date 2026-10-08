import type { SDKMessage, Options, McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect } from 'vitest';
export function finalResult(sessionId = 'o07-session'): SDKMessage { return { type: 'result', subtype: 'success', is_error: false, uuid: 'o07-result', session_id: sessionId, result: '计划已记录🙂，未执行子任务。', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage; }
export async function graphPeer(options: Options) {
  const server = options.mcpServers?.['flow-graph'] as McpSdkServerConfigWithInstance;
  expect(server).toMatchObject({ type: 'sdk', name: 'flow-graph' });
  const [left, right] = InMemoryTransport.createLinkedPair(); const peer = new Client({ name: 'o07-official-peer', version: '1.0.0' });
  await server.instance.connect(right); await peer.connect(left); return peer;
}
