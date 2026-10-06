import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('preserves goal-session detail/decision/cancel transport while allowing observation cancellation', async () => {
  const requests: { url: string; key?: string; body: string }[] = [];
  let status = 200;
  const server = createServer(async (req, res) => {
    expect(req.headers.authorization).toBe('Bearer synthetic-owner');
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({ url: req.url!, key: req.headers['idempotency-key'] as string | undefined, body: Buffer.concat(chunks).toString() });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { transport: true } : { error: { code: 'conflict', message: 'synthetic' } }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  const answer = { decisionId: 'decision', answer: 'approve' as const };
  try {
    await client.detail('detail /?');
    await client.decide('task /?', answer, 'frozen-decision-key');
    await client.cancel('task /?', 'frozen-cancel-key');
    expect(requests).toEqual([
      { url: '/api/details/detail%20%2F%3F', key: undefined, body: '' },
      { url: '/api/tasks/task%20%2F%3F/decision', key: 'frozen-decision-key', body: JSON.stringify(answer) },
      { url: '/api/tasks/task%20%2F%3F/cancel', key: 'frozen-cancel-key', body: '{}' },
    ]);
    status = 409;
    await expect(client.cancel('task', 'frozen-cancel-key')).rejects.toMatchObject({ status: 409 });
    status = 403;
    await expect(client.decide('task', answer, 'frozen-decision-key')).rejects.toMatchObject({ status: 403 });
    status = 200;
    const signal = AbortSignal.abort();
    await expect(client.detail('detail', signal)).rejects.toThrow();
    await expect(client.decide('task', answer, 'frozen-decision-key', signal)).rejects.toThrow();
    await expect(client.cancel('task', 'frozen-cancel-key', signal)).rejects.toThrow();
    expect(requests).toHaveLength(5);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
