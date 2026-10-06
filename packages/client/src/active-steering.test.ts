import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { steeringCommandSchema, steeringReceiptSchema, steeringStateQuerySchema, steeringPageSchema } from '../../contracts/src/active-steering.js';
import { FlowClient } from './index.js';

it('preserves steering text, ownership, revisions and receipts without promoting their meaning or retrying', async () => {
  const calls: { path: string; method: string; key?: string; body: unknown }[] = [];
  const accepted = { command: { id: 'command/1', status: 'accepted', revision: 4 }, replayed: true };
  const state = { taskId: 'task/1', attemptId: 'attempt/1', revision: 4, sealed: false, attemptAvailable: false, commands: [], nextCursor: 6 };
  const original = '  保留原文😀\n不要把接收说成已执行  ';
  const text = { taskId: 'task/1', attemptId: 'attempt/1', commandId: 'command/1', text: original, bytes: Buffer.byteLength(original), digest: 'a'.repeat(64) };
  const audit = { entries: [{ ordinal: 8, action: 'unknown' }], nextCursor: 8 };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer steering-test');
    const url = new URL(request.url!, 'http://localhost');
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: unknown = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    calls.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    let value: unknown = accepted;
    if (url.pathname === '/api/runner/steering/receipts') {
      steeringReceiptSchema.parse(body);
      value = { ...accepted, command: { ...accepted.command, status: 'received', receiptRevision: 1 } };
    } else if (request.method === 'POST') steeringCommandSchema.parse(body);
    else if (url.pathname.endsWith('/text')) value = text;
    else if (url.pathname.endsWith('/audit')) { steeringPageSchema.parse(Object.fromEntries(url.searchParams)); value = audit; }
    else { steeringStateQuerySchema.parse(Object.fromEntries(url.searchParams)); value = state; }
    const denied = url.pathname.includes('denied');
    response.writeHead(denied ? 409 : request.method === 'POST' ? 202 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'steering_unavailable', message: 'Attempt unavailable.' } } : value));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'steering-test' });
  const input = { attemptId: 'attempt/1', ownerVersion: 2, expectedRevision: 3, text: original };
  const receipt = { attemptId: 'attempt/1', ownerVersion: 2, commandId: 'command/1', nativeSessionId: 'native/1',
    userMessageUuid: 'b6b17f92-4219-4e80-8ef1-1c74f4aaf0a8', receiptId: 'receipt/1', expectedReceiptRevision: 0, phase: 'received' as const };
  try {
    expect(await client.acceptSteering('task/1', input, 'same-key')).toEqual(accepted);
    expect(await client.steering('task/1', { attemptId: 'attempt/1', after: 3, limit: 2 })).toEqual(state);
    expect(await client.steeringText('task/1', 'command/1')).toEqual(text);
    expect(await client.steeringAudit('task/1', { after: 7, limit: 2 })).toEqual(audit);
    expect(await client.reportSteeringReceipt(receipt)).toEqual({ ...accepted, command: { ...accepted.command, status: 'received', receiptRevision: 1 } });
    await expect(client.acceptSteering('denied', input, 'same-key')).rejects.toMatchObject({ status: 409, code: 'steering_unavailable' });
    await expect(client.steering('task/1', {}, AbortSignal.abort())).rejects.toThrow();
    expect(calls.map(call => [call.method, call.path])).toEqual([
      ['POST', '/api/tasks/task%2F1/steering'], ['GET', '/api/tasks/task%2F1/steering?attemptId=attempt%2F1&after=3&limit=2'],
      ['GET', '/api/tasks/task%2F1/steering/command%2F1/text'], ['GET', '/api/tasks/task%2F1/steering/audit?after=7&limit=2'],
      ['POST', '/api/runner/steering/receipts'], ['POST', '/api/tasks/denied/steering'],
    ]);
    expect(calls[0]).toMatchObject({ key: 'same-key', body: input });
    expect(calls[4]).toMatchObject({ key: undefined, body: receipt });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
