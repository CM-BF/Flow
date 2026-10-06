import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { FlowClient, FlowApiError } from './index.js';

it('queries audit pages and sends explicit fenced recovery commands with authentication and replay keys', async () => {
  const requests: { url: string; key?: string; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer owner-secret');
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ url: request.url!, key: request.headers['idempotency-key'] as string | undefined, body: body ? JSON.parse(body) : null });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'owner-secret' });
  const ownership = { attemptId: 'old-attempt', ownerVersion: 2 };
  const evidence = { explanation: 'Checked runner process and output directory.', references: [] };
  try {
    await client.reconciliation('task/1', 12);
    await client.recordReconciliation('task/1', { ...ownership, evidence }, 'observe-1');
    await client.resolveReconciliation('task/1', { ...ownership, stoppedConfirmed: true, stopEvidence: evidence, sideEffects: 'none-confirmed', effectsEvidence: evidence, outcome: 'cancelled' }, 'resolve-1');
    await client.retryReconciledTask('task/1', { ...ownership, resolutionId: 'audit-1', safety: { strategy: 'no-side-effects', evidence } }, 'retry-1');
    expect(requests.map(({ url, key }) => ({ url, key }))).toEqual([
      { url: '/api/tasks/task%2F1/reconciliation?after=12', key: undefined },
      { url: '/api/tasks/task%2F1/reconciliation/observations', key: 'observe-1' },
      { url: '/api/tasks/task%2F1/reconciliation/resolve', key: 'resolve-1' },
      { url: '/api/tasks/task%2F1/reconciliation/retry', key: 'retry-1' },
    ]);
    expect(requests[1]!.body).toEqual({ ...ownership, evidence });
    expect(requests[3]!.body).toEqual({ ...ownership, resolutionId: 'audit-1', safety: { strategy: 'no-side-effects', evidence } });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

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

it('carries protocol ownership and command correlation without retrying an uncertain response', async () => {
  const requests: { path: string; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer runner-secret');
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url!, body: body ? JSON.parse(body) : null });
    response.writeHead(request.url?.endsWith('/begin') ? 409 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url?.endsWith('/begin') ? { error: { code: 'dispatch_uncertain', message: 'Reconcile dispatch.' } } : {}));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'runner-secret' });
  const ownership = { attemptId: 'attempt-1', ownerVersion: 2 };
  const command = { ...ownership, commandId: 'command-1' };
  try {
    await client.protocolPrepare(ownership);
    await expect(client.protocolBegin(command)).rejects.toMatchObject({ code: 'dispatch_uncertain', status: 409 });
    await client.protocolBind({ ...command, remoteTaskId: 'remote-1' });
    await client.protocolUncertain({ ...command, reason: 'send-result-unknown' });
    await client.protocolStartCancel(command);
    await client.protocolRecover();
    await client.protocolState('task/1');
    expect(requests).toEqual([
      { path: '/api/runner/protocol/prepare', body: ownership },
      { path: '/api/runner/protocol/begin', body: command },
      { path: '/api/runner/protocol/bind', body: { ...command, remoteTaskId: 'remote-1' } },
      { path: '/api/runner/protocol/uncertain', body: { ...command, reason: 'send-result-unknown' } },
      { path: '/api/runner/protocol/cancel-start', body: command },
      { path: '/api/runner/protocol/recover', body: {} },
      { path: '/api/tasks/task%2F1/protocol', body: null },
    ]);
    await expect(client.protocolRecover(AbortSignal.abort())).rejects.toThrow();
    expect(requests).toHaveLength(7);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
