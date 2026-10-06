import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { steeringAdmissionQuerySchema, type SteeringAdmission } from '../../contracts/src/active-steering.js';
import { FlowClient } from './index.js';

it('reads task-bound steering admission without inferring permission or retrying denied reads', async () => {
  const calls: string[] = [];
  const ready: SteeringAdmission = { taskId: 'task/中文', attemptId: 'attempt/😀', ownerVersion: 7, revision: 3, state: 'ready', reason: 'ready' };
  const disabled: SteeringAdmission = { taskId: 'task/中文', attemptId: null, ownerVersion: null, revision: null, state: 'unavailable', reason: 'disabled' };
  const server = createServer(async (request, response) => {
    expect(request.method).toBe('GET');
    expect(request.headers.authorization).toBe('Bearer admission-test');
    expect(request.headers['idempotency-key']).toBeUndefined();
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).length).toBe(0);
    calls.push(request.url!);
    const url = new URL(request.url!, 'http://localhost');
    const query = steeringAdmissionQuerySchema.parse(Object.fromEntries(url.searchParams));
    const error = /\/tasks\/(403|404|409)\//.exec(url.pathname)?.[1];
    response.writeHead(error ? Number(error) : 200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(error ? { error: { code: 'admission_unavailable', message: 'Not available.' } } : query.attemptId ? ready : disabled));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'admission-test' });
  try {
    expect(await client.steeringAdmission('task/中文')).toEqual(disabled);
    expect(await client.steeringAdmission('task/中文', { attemptId: 'attempt/😀' })).toEqual(ready);
    for (const status of [403, 404, 409]) await expect(client.steeringAdmission(String(status))).rejects.toMatchObject({ status, code: 'admission_unavailable' });
    await expect(client.steeringAdmission('task/中文', {}, AbortSignal.abort())).rejects.toThrow();
    expect(calls).toEqual([
      '/api/tasks/task%2F%E4%B8%AD%E6%96%87/steering/admission',
      '/api/tasks/task%2F%E4%B8%AD%E6%96%87/steering/admission?attemptId=attempt%2F%F0%9F%98%80',
      '/api/tasks/403/steering/admission', '/api/tasks/404/steering/admission', '/api/tasks/409/steering/admission',
    ]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
