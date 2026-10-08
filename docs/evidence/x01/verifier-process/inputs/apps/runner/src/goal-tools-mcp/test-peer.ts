import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { GoalToolOptions } from '../goal-tools/index.js';
import { createGoalToolsMcp } from './index.js';

/** Real MCP requests and SDK dispatch, without Claude query or an auth subprocess. */
export async function connectPeer(options: GoalToolOptions) {
  const bridge = createGoalToolsMcp(options);
  const client = new Client({ name: 'o02-official-peer', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const frames: { direction: 'client' | 'server'; message: JSONRPCMessage; bytes: number }[] = [];
  for (const [direction, transport] of [['client', clientTransport], ['server', serverTransport]] as const) {
    const send = transport.send.bind(transport);
    transport.send = async (...args) => {
      const encoded = JSON.stringify(args[0]);
      frames.push({ direction, message: JSON.parse(encoded), bytes: Buffer.byteLength(encoded, 'utf8') });
      return send(...args);
    };
  }
  await bridge.instance.connect(serverTransport);
  try { await client.connect(clientTransport); } catch (error) { await bridge.instance.close(); throw error; }
  return { client, frames, async close() { await client.close(); await bridge.instance.close(); } };
}
export function body(result: Awaited<ReturnType<Client['callTool']>>) {
  return JSON.parse((result.content as { type: string; text: string }[])[0]!.text);
}
