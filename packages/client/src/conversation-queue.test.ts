import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('preserves queue command identity, independent revisions and pause/resume semantics without retries', async () => {
  const seen: { path: string; method: string; key?: string; body: unknown }[] = [];
  const receipt = { conversationId: 'conversation/1', queueRevision: 3, replayed: true };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer queue-owner');
    let raw = ''; for await (const part of request) raw += part;
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    const conflict = body?.expectedQueueRevision === 99;
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'queue_revision_conflict', message: 'Reload queue.' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'queue-owner' });
  try {
    expect(await client.enqueueConversationTurn('conversation/1', { expectedQueueRevision: 3, text: '  下一轮🙂\n' }, 'enqueue-once')).toEqual(receipt);
    await client.conversationQueue('conversation/1', { after: 0, limit: 4 });
    await client.conversationQueueItem('conversation/1', 'item/2');
    await client.cancelConversationQueueItem('conversation/1', 'item/2', { expectedQueueRevision: 4 }, 'cancel-once');
    await client.pauseConversationQueue('conversation/1', { expectedQueueRevision: 5 }, 'pause-once');
    await client.resumeConversationQueue('conversation/1', { expectedQueueRevision: 6, expectedTaskId: null }, 'resume-once');
    await expect(client.resumeConversationQueue('conversation/1', { expectedQueueRevision: 99, expectedTaskId: 'task-1' }, 'resume-conflict')).rejects.toMatchObject({ status: 409, code: 'queue_revision_conflict' });
    expect(seen.map(r => r.path)).toEqual([
      '/api/conversations/conversation%2F1/queue', '/api/conversations/conversation%2F1/queue?after=0&limit=4',
      '/api/conversations/conversation%2F1/queue/item%2F2', '/api/conversations/conversation%2F1/queue/item%2F2/cancel',
      '/api/conversations/conversation%2F1/queue/pause', '/api/conversations/conversation%2F1/queue/resume',
      '/api/conversations/conversation%2F1/queue/resume',
    ]);
    expect(seen.map(r => r.method)).toEqual(['POST', 'GET', 'GET', 'POST', 'POST', 'POST', 'POST']);
    expect(seen[0]).toMatchObject({ key: 'enqueue-once', body: { expectedQueueRevision: 3, text: '  下一轮🙂\n' } });
    expect(seen[3]).toMatchObject({ key: 'cancel-once', body: { expectedQueueRevision: 4 } });
    expect(seen[4]).toMatchObject({ key: 'pause-once', body: { expectedQueueRevision: 5 } });
    expect(seen[5]).toMatchObject({ key: 'resume-once', body: { expectedQueueRevision: 6, expectedTaskId: null } });
    await expect(client.conversationQueue('conversation/1', {}, AbortSignal.abort())).rejects.toThrow();
    expect(seen).toHaveLength(7); // No automatic retry, task cancellation, promotion or fresh-key substitution.
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
