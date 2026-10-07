import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { pluginInstallRequestSchema, pluginInstallCommandSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('preserves static installation requests, accepted receipts, current state and bounded page cursors', async () => {
  const requests: { method: string; url: string; key: string | undefined; body: string }[] = [];
  const operationId = '22222222-2222-4222-8222-222222222222';
  let status = 200;
  let dropAcknowledgement = false;
  let replayed = false;
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer synthetic-owner');
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    requests.push({ method: request.method!, url: request.url!, key: request.headers['idempotency-key'] as string | undefined, body });
    if (request.method === 'POST') {
      const schema = request.url!.endsWith('/install') ? pluginInstallRequestSchema : pluginInstallCommandSchema;
      expect(schema.safeParse(JSON.parse(body)).success).toBe(true);
    }
    if (dropAcknowledgement) { response.destroy(); return; }
    const payload = status >= 400 ? { error: { code: 'synthetic', message: 'synthetic refusal' } }
      : request.method === 'POST' ? { operationId, replayed }
      : request.url!.includes('/history') ? { events: [], nextCursor: '41' }
      : request.url!.includes('/material-installs') ? { operations: [], nextCursor: operationId }
      : { schemaVersion: 1, id: operationId, status: 'unknown', materialId: null, error: 'lifecycle_unknown' };
    response.writeHead(status >= 400 ? status : request.method === 'POST' ? 202 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  const input = { expectedRevision: 7, fetchOperationId: operationId, fetchAttemptId: '33333333-3333-4333-8333-333333333333', reason: '  原样安装  ' };
  const command = { action: 'reconcile' as const, reason: '检查已保存材料' };
  try {
    expect(await client.installPluginVersion('plugin /中', 'version /?', input, 'install-key')).toEqual({ operationId, replayed: false });
    expect(await client.pluginMaterialInstall('install /?')).toMatchObject({ status: 'unknown', materialId: null, error: 'lifecycle_unknown' });
    expect(await client.pluginMaterialInstalls('plugin /中', { after: operationId, limit: 40 })).toEqual({ operations: [], nextCursor: operationId });
    expect(await client.pluginMaterialInstallHistory('install /?', { after: '40', limit: 1 })).toEqual({ events: [], nextCursor: '41' });
    replayed = true;
    expect(await client.commandPluginMaterialInstall('install /?', command, 'reconcile-key')).toEqual({ operationId, replayed: true });
    expect(requests).toEqual([
      { method: 'POST', url: '/api/plugins/plugin%20%2F%E4%B8%AD/versions/version%20%2F%3F/install', key: 'install-key', body: JSON.stringify(input) },
      { method: 'GET', url: '/api/plugin-installs/install%20%2F%3F', key: undefined, body: '' },
      { method: 'GET', url: `/api/plugins/plugin%20%2F%E4%B8%AD/material-installs?after=${operationId}&limit=40`, key: undefined, body: '' },
      { method: 'GET', url: '/api/plugin-installs/install%20%2F%3F/history?after=40&limit=1', key: undefined, body: '' },
      { method: 'POST', url: '/api/plugin-installs/install%20%2F%3F/commands', key: 'reconcile-key', body: JSON.stringify(command) },
    ]);
    status = 403;
    await expect(client.pluginMaterialInstall(operationId)).rejects.toMatchObject({ status: 403 });
    status = 409;
    await expect(client.commandPluginMaterialInstall(operationId, command, 'reconcile-key')).rejects.toMatchObject({ status: 409 });
    expect(requests).toHaveLength(7);
    const signal = AbortSignal.abort();
    await expect(client.installPluginVersion('p', 'v', input, 'install-key', signal)).rejects.toThrow();
    await expect(client.pluginMaterialInstall(operationId, signal)).rejects.toThrow();
    await expect(client.pluginMaterialInstalls('p', {}, signal)).rejects.toThrow();
    await expect(client.pluginMaterialInstallHistory(operationId, {}, signal)).rejects.toThrow();
    await expect(client.commandPluginMaterialInstall(operationId, command, 'reconcile-key', signal)).rejects.toThrow();
    expect(requests).toHaveLength(7);
    status = 200; dropAcknowledgement = true;
    await expect(client.installPluginVersion('p', 'v', input, 'unknown-key')).rejects.toThrow();
    expect(requests).toHaveLength(8);
    dropAcknowledgement = false;
    expect(await client.installPluginVersion('p', 'v', input, 'unknown-key')).toEqual({ operationId, replayed: true });
    expect(requests.at(-1)).toEqual(requests.at(-2));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
