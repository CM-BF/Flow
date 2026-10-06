import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('transports bounded attachment identities and recovery queries without mutation retries', async () => {
  const calls: { method: string; path: string; body: unknown; key: unknown }[] = [];
  const receipt = { synthetic: 'transparent transport' };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer synthetic-attachment-owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    calls.push({ method: request.method!, path: request.url!, body: raw ? JSON.parse(raw) : null, key: request.headers['idempotency-key'] });
    const conflict = request.headers['idempotency-key'] === 'conflict';
    const missing = request.url?.includes('key=unknown');
    response.writeHead(conflict ? 409 : missing ? 404 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict || missing ? { error: { code: conflict ? 'attachment_scope_mismatch' : 'attachment_upload_receipt_not_found', message: 'Unconfirmed' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-attachment-owner' });
  try {
    const text = '\uFEFF 原文\r\n中文🙂';
    const input = { recoveryScopeId: randomUUID(), name: '原文.txt', mediaType: 'text/plain' as const, text,
      byteLength: Buffer.byteLength(text), contentDigest: createHash('sha256').update(text).digest('hex') };
    expect(await client.attachmentCapabilities('project/1')).toEqual(receipt);
    expect(await client.uploadAttachment('project/1', input, 'stable-key')).toEqual(receipt);
    await client.attachments('project/1', { after: 'resource/2', limit: 3, q: '中文 %_path/x' });
    await client.attachment('project/1', 'resource/1');
    await client.attachmentContent('project/1', 'resource/1', 1, input.contentDigest);
    await client.attachmentUploadReceipt('project/1', { scope: input.recoveryScopeId, key: 'stable/key' });
    await expect(client.uploadAttachment('project/1', input, 'conflict')).rejects.toMatchObject({ status: 409, code: 'attachment_scope_mismatch' });
    await expect(client.attachmentUploadReceipt('project/1', { scope: input.recoveryScopeId, key: 'unknown' })).rejects.toMatchObject({ status: 404, code: 'attachment_upload_receipt_not_found' });
    expect(calls.slice(0, 6).map(call => call.path)).toEqual([
      '/api/projects/project%2F1/attachments/capabilities', '/api/projects/project%2F1/attachments',
      '/api/projects/project%2F1/attachments?after=resource%2F2&limit=3&q=%E4%B8%AD%E6%96%87+%25_path%2Fx',
      '/api/projects/project%2F1/attachments/resource%2F1',
      '/api/projects/project%2F1/attachments/resource%2F1/versions/1/content?digest=' + input.contentDigest,
      '/api/projects/project%2F1/attachments/upload-receipt?scope=' + input.recoveryScopeId + '&key=stable%2Fkey',
    ]);
    expect(calls[1]).toMatchObject({ method: 'POST', body: input, key: 'stable-key' });
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(2);
    await expect(client.attachment('project/1', 'resource/1', AbortSignal.abort())).rejects.toThrow();
    expect(calls).toHaveLength(8);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
