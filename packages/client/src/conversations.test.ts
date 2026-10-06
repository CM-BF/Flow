import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { conversationCreationSchema, conversationTurnSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('preserves conversation identity, admission key and revision, lazy detail ownership and explicit unsupported errors', async () => {
  const requests: { path: string; method: string; key?: string; body: unknown }[] = [];
  const at = '2026-10-06T00:00:00Z';
  const capabilities = { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false };
  let conversation = { ...conversationCreationSchema.parse({ title: 'Conversation' }), id: 'chat/1', revision: 0, createdAt: at, updatedAt: at };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer chat-owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    response.writeHead(body?.mode === 'steer' ? 409 : 200, { 'content-type': 'application/json' });
    let value: unknown = {};
    if (request.method === 'POST' && request.url === '/api/conversations') {
      conversation = { ...conversation, ...conversationCreationSchema.parse(body) }; value = { conversation, capabilities, replayed: false };
    } else if (request.method === 'POST' && body?.mode !== 'steer') {
      value = { conversation: { ...conversation, revision: 1 }, replayed: false, turn: { id: 'turn/1', conversationId: conversation.id, number: 1, createdAt: at,
        user: { role: 'user', text: body.text }, task: { id: 'task/1', title: conversation.title, harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: at, updatedAt: at },
        assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null }, telemetry: { kind: 'execution', taskId: 'task/1', title: 'Execution' } } };
    }
    response.end(JSON.stringify(body?.mode === 'steer' ? { error: { code: 'unsupported_conversation_mode', message: 'Steering is not supported.' } } : value));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'chat-owner' });
  try {
    const creation = conversationCreationSchema.parse({ title: 'Conversation' });
    const turn = conversationTurnSchema.parse({ expectedRevision: 0, text: '  hi\n' });
    await client.createConversation(creation, 'create-once');
    await client.conversations({ after: 'a/b', limit: 5 });
    await client.conversation('chat/1');
    await client.submitConversationTurn('chat/1', turn, 'turn-once');
    await client.conversationTurns('chat/1', { after: 2, limit: 3 });
    await client.conversationDetail('chat/1', 'turn/2', 'detail/3');
    await expect(client.submitConversationTurn('chat/1', { ...turn, mode: 'steer' }, 'steer-once')).rejects.toMatchObject({ status: 409, code: 'unsupported_conversation_mode' });
    expect(requests.map(r => r.path)).toEqual(['/api/conversations', '/api/conversations?after=a%2Fb&limit=5', '/api/conversations/chat%2F1', '/api/conversations/chat%2F1/turns', '/api/conversations/chat%2F1/turns?after=2&limit=3', '/api/conversations/chat%2F1/turns/turn%2F2/details/detail%2F3', '/api/conversations/chat%2F1/turns']);
    expect(requests[0]).toMatchObject({ method: 'POST', key: 'create-once', body: creation });
    expect(requests[3]).toMatchObject({ method: 'POST', key: 'turn-once', body: turn });
    await expect(client.conversation('chat/1', AbortSignal.abort())).rejects.toThrow();
    expect(requests).toHaveLength(7); // Unsupported mode is neither retried nor changed to a new task/queue.
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
