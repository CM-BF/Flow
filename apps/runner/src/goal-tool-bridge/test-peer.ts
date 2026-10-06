import type { SDKMessage, Options, McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect } from 'vitest';
export function finalResult(sessionId = 'o04-native'): SDKMessage { return { type: 'result', subtype: 'success', is_error: false, uuid: 'o04-result', session_id: sessionId, result: '中文目标已记录🙂，子任务仍待执行。', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage; }
export async function mcpPeer(options: Options) {
  const server = options.mcpServers?.['flow-goal'] as McpSdkServerConfigWithInstance;
  expect(server).toMatchObject({ type: 'sdk', name: 'flow-goal' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  const peer = new Client({ name: 'o04-official-peer', version: '1.0.0' });
  await server.instance.connect(right); await peer.connect(left);
  return peer;
}
