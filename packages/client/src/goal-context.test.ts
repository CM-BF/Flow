import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('reads one fixed goal input context with encoded identities and preserves owner errors and cancellation', async () => {
  const requests: string[] = [];
  const detail = { goalId: 'goal/一', nodeId: 'node/二', inputVersion: 7, contextDigest: 'sha256:fixed', sources: [{ text: ' 原文😀\r\n', currentVersion: 8, isCurrent: false }] };
  const server = createServer((request, response) => {
    expect(request.method).toBe('GET');
    expect(request.headers.authorization).toBe('Bearer context-owner');
    requests.push(request.url!);
    const denied = request.url!.includes('/denied/');
    response.writeHead(denied ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'wrong_role', message: 'Owner required.' } } : detail));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'context-owner' });
  try {
    expect(await client.goalContext('goal/一', 'node/二', 7)).toEqual(detail);
    await expect(client.goalContext('denied', 'node/二', 7)).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.goalContext('goal/一', 'node/二', 7, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toEqual(['/api/goals/goal%2F%E4%B8%80/nodes/node%2F%E4%BA%8C/inputs/7/context', '/api/goals/denied/nodes/node%2F%E4%BA%8C/inputs/7/context']);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
