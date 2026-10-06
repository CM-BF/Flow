import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('reads explicit context through the owner client without changing IDs, detail text or abort semantics', async () => {
  const paths: string[] = [];
  const detail = { id: 'context/2', sources: [{ text: ' 精确原文\r\n中文😀 ', currentVersion: 2, isCurrent: false }] };
  const server = createServer((request, response) => {
    expect(request.headers.authorization).toBe('Bearer context-owner');
    expect(request.method).toBe('GET');
    paths.push(request.url!);
    response.writeHead(request.url!.includes('denied') ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(request.url!.includes('denied') ? { error: { code: 'wrong_role', message: 'Owner required.' } } : detail));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'context-owner' });
  try {
    expect(await client.conversationContext('conversation/1', 'context/2')).toEqual(detail);
    await expect(client.conversationContext('conversation/1', 'denied')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.conversationContext('conversation/1', 'context/2', AbortSignal.abort())).rejects.toThrow();
    expect(paths).toEqual(['/api/conversations/conversation%2F1/contexts/context%2F2', '/api/conversations/conversation%2F1/contexts/denied']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
