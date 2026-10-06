import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('reads validated context history without inventing current capacity or retrying errors', async () => {
  const taskId = randomUUID();
  const empty = { protocol: 'flow.context-history.v1', taskId, attemptId: null, latest: null,
    current: { kind: 'unknown', value: null, reason: 'history-only' },
    remaining: { kind: 'unknown', value: null, reason: 'history-only' } };
  const calls: string[] = [];
  let body: unknown = empty;
  let status = 200;
  const server = createServer((request, response) => {
    expect(request.method).toBe('GET');
    expect(request.headers.authorization).toBe('Bearer synthetic-history-owner');
    expect(request.headers['idempotency-key']).toBeUndefined();
    calls.push(request.url!);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-history-owner' });
  try {
    expect(await client.contextHistory(taskId)).toEqual(empty);
    body = { ...empty, taskId: randomUUID() };
    await expect(client.contextHistory(taskId)).rejects.toThrow('Context history task identity mismatch');
    body = { ...empty, remaining: { kind: 'exact', value: 100 } };
    await expect(client.contextHistory(taskId)).rejects.toThrow();
    body = { ...empty, latest: { observation: { identity: { subject: { taskId } } } } };
    await expect(client.contextHistory(taskId)).rejects.toThrow();
    for (const code of [403, 404, 409]) {
      status = code; body = { error: { code: 'history_unavailable', message: 'synthetic' } };
      await expect(client.contextHistory(taskId)).rejects.toMatchObject({ status: code, code: 'history_unavailable' });
    }
    await expect(client.contextHistory('task /?')).rejects.toMatchObject({ status: 409 });
    expect(calls.at(-1)).toBe('/api/tasks/task%20%2F%3F/context/history');
    expect(calls.slice(0, -1)).toEqual(Array(7).fill(`/api/tasks/${taskId}/context/history`));
    await expect(client.contextHistory(taskId, AbortSignal.abort())).rejects.toThrow();
    expect(calls).toHaveLength(8);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
