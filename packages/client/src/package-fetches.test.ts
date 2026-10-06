import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { packageFetchRequestSchema, packageFetchCommandSchema } from '../../contracts/src/plugin-package-fetches.js';
import { FlowClient } from './index.js';

it('transports durable package fetch commands and reads without retrying or converting receipts to mutable state', async () => {
  const requests: { url: string; method: string; key: string | undefined; body: unknown }[] = [];
  const receipt = { operationId: 'op/1', attemptId: 'attempt/1', replayed: true };
  const responseBody = { status: 'interrupted', artifact: null };
  const input = packageFetchRequestSchema.parse({ expectedRevision: 7, integrity: `sha512-${'A'.repeat(86)}==`, registryRef: 'npm' });
  const command = packageFetchCommandSchema.parse({ action: 'reconcile', reason: 'Check committed local bytes' });
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer fetch-owner');
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    if (request.method === 'POST') {
      if (request.url!.endsWith('/fetch')) expect(packageFetchRequestSchema.parse(body)).toEqual(input);
      else expect(packageFetchCommandSchema.parse(body)).toEqual(command);
    }
    requests.push({ url: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    const conflict = request.url!.includes('conflict');
    response.writeHead(conflict ? 409 : request.method === 'POST' ? 202 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'wrong_store', message: 'Different host.' } } : request.method === 'POST' ? receipt : responseBody));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'fetch-owner' });
  try {
    expect(await client.fetchPluginPackage('plugin/1', 'version/1', input, 'fixed-fetch-key')).toEqual(receipt);
    expect(await client.packageFetch('op/1')).toEqual(responseBody);
    expect(await client.pluginPackageFetches('plugin/1', { after: 'op/0', limit: 2 })).toEqual(responseBody);
    expect(await client.packageFetchHistory('op/1', { after: '9', limit: 2 })).toEqual(responseBody);
    expect(await client.commandPackageFetch('op/1', command, 'fixed-command-key')).toEqual(receipt);
    await expect(client.commandPackageFetch('conflict', command, 'conflict-key')).rejects.toMatchObject({ status: 409, code: 'wrong_store' });
    await expect(client.packageFetch('op/1', AbortSignal.abort())).rejects.toThrow();
    expect(requests.map(r => r.url)).toEqual(['/api/plugins/plugin%2F1/versions/version%2F1/fetch', '/api/package-fetches/op%2F1', '/api/plugins/plugin%2F1/package-fetches?after=op%2F0&limit=2', '/api/package-fetches/op%2F1/history?after=9&limit=2', '/api/package-fetches/op%2F1/commands', '/api/package-fetches/conflict/commands']);
    expect(requests.filter(r => r.method === 'POST').map(r => r.key)).toEqual(['fixed-fetch-key', 'fixed-command-key', 'conflict-key']);
    expect(requests[0]!.body).toEqual(input); expect(requests[4]!.body).toEqual(command);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
