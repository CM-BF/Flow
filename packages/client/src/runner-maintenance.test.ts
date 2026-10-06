import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('preserves maintenance identity and CAS without turning observations or replays into stop permits', async () => {
  const calls: { path: string; body: unknown; key?: string }[] = [];
  const result = { state: { runnerId: 'runner/1', state: 'maintenance', version: 3 }, replayed: true };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer maintenance-owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ path: request.url!, body, key: request.headers['idempotency-key'] as string | undefined });
    const conflict = body?.version === 0;
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'maintenance_conflict', message: 'Changed' } } : result));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'maintenance-owner' });
  try {
    expect(await client.runnerMaintenance('runner/1')).toEqual(result);
    await client.runnerMaintenanceHistory('runner/1', { after: 'cursor/2' });
    const input = { version: 2, operationId: 'operation-1', reason: '  保存原文\n' };
    expect(await client.drainRunner('runner/1', input, 'drain-once')).toEqual(result);
    expect(await client.resumeRunner('runner/1', input, 'resume-once')).toEqual(result);
    await expect(client.resumeRunner('runner/1', { ...input, version: 0 }, 'conflict-once')).rejects.toMatchObject({ status: 409, code: 'maintenance_conflict' });
    expect(calls.map(call => call.path)).toEqual(['/api/runners/runner%2F1/maintenance', '/api/runners/runner%2F1/maintenance/history?after=cursor%2F2', '/api/runners/runner%2F1/maintenance/drain', '/api/runners/runner%2F1/maintenance/resume', '/api/runners/runner%2F1/maintenance/resume']);
    expect(calls[2]).toMatchObject({ body: input, key: 'drain-once' });
    expect(calls[3]).toMatchObject({ body: input, key: 'resume-once' });
    await expect(client.runnerMaintenance('runner/1', AbortSignal.abort())).rejects.toThrow();
    expect(calls).toHaveLength(5);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
