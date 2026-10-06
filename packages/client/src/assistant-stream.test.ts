import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { conversationCreationSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('opts in only snapshot reads and keeps stable creation receipts, task bindings, patch cursors and errors', async () => {
  const requests: { url: string; protocol: string | undefined; key: string | undefined; body: unknown }[] = [];
  const responseBody = { taskId: 'task/1', attemptId: 'attempt/1', patches: [], nextCursor: 9, hasMore: false };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer stream-owner');
    const chunks: Buffer[] = []; for await (const part of request) chunks.push(Buffer.from(part));
    requests.push({ url: request.url!, protocol: request.headers['x-flow-assistant-stream'] as string | undefined,
      key: request.headers['idempotency-key'] as string | undefined, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined });
    const denied = request.url!.includes('denied');
    const creationReceipt = request.method === 'POST' && request.url === '/api/conversations'
      ? { conversation: { ...conversationCreationSchema.parse(requests.at(-1)!.body), id: 'chat/1', revision: 0,
        createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }, replayed: false,
        capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false,
          perTurnModel: false, perTurnThinking: false, perTurnTools: false } }
      : undefined;
    response.writeHead(denied ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'wrong_role', message: 'Owner only.' } } : creationReceipt ?? responseBody));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const options = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'stream-owner' };
  const old = new FlowClient(options); const client = new FlowClient({ ...options, assistantStreamProtocol: 'patch-v1' });
  const input = conversationCreationSchema.parse({ title: 'Exact original title 古😀' });
  try {
    await old.conversation('chat/1'); await client.conversation('chat/1');
    await client.createConversation(input, 'stable-create');
    expect(await client.assistantStream('task/1', { after: 'block/0', limit: 2 })).toEqual(responseBody);
    expect(await client.assistantStreamPatches('task/1', { attemptId: 'attempt/1', after: 9, limit: 8 })).toEqual(responseBody);
    expect(await client.assistantStreamBlock('task/1', 'block/1')).toEqual(responseBody);
    await expect(client.assistantStreamBlock('denied', 'block/1')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.assistantStreamPatches('task/1', { attemptId: 'attempt/1' }, AbortSignal.abort())).rejects.toThrow();
    expect(requests.map(r => r.url)).toEqual(['/api/conversations/chat%2F1', '/api/conversations/chat%2F1', '/api/conversations',
      '/api/tasks/task%2F1/assistant-stream?after=block%2F0&limit=2', '/api/tasks/task%2F1/assistant-stream/patches?attemptId=attempt%2F1&after=9&limit=8',
      '/api/tasks/task%2F1/assistant-stream/block%2F1', '/api/tasks/denied/assistant-stream/block%2F1']);
    expect(requests.map(r => r.protocol)).toEqual([undefined, 'patch-v1', undefined, undefined, undefined, undefined, undefined]);
    expect(requests[2]).toMatchObject({ key: 'stable-create', body: input });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
