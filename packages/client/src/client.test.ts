import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { FlowClient, FlowApiError } from './index.js';

it('submits with authentication and idempotency, preserving an actionable conflict', async () => {
  const server = createServer((request, response) => {
    expect(request.headers.authorization).toBe('Bearer local-secret');
    expect(request.headers['idempotency-key']).toBe('request-1');
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'idempotency_conflict', message: 'Key already used for a different task.' } }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'local-secret' });
  try {
    await expect(client.submit({ title: 'Review', prompt: 'Read notes', harness: 'fixture' }, 'request-1')).rejects.toMatchObject({ status: 409, code: 'idempotency_conflict' } satisfies Partial<FlowApiError>);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it('reads an SSE update when CRLF separators span network chunks', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write('event: update\r\ndata: {"nextCursor":7}\r');
    setTimeout(() => response.end('\n\r\n'), 10);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'local-secret' });
  try {
    const pages = [];
    for await (const page of client.watch('task-1')) pages.push(page);
    expect(pages).toEqual([{ nextCursor: 7 }]);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
