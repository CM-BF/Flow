import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';
import { FlowApiError, FlowClient } from './index.js';

const ready = { protocol: 'flow.browser-session.v1', state: 'ready', centerId: '550e8400-e29b-41d4-a716-446655440000',
  ownerPrincipalId: '550e8400-e29b-41d4-a716-446655440001', expiresAt: '2026-10-06T23:00:00Z', csrfToken: 'a'.repeat(64) };
async function http(handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>) {
  const server = createServer((request, response) => { void Promise.resolve(handler(request, response)).catch(() => response.destroy()); }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}
function json(response: ServerResponse, value: unknown, status = 200) { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); }

it('uses one explicit cookie mode for real HTTP and SSE, and reads the latest CSRF only for writes', async () => {
  const seen: { url: string; bearer: string | undefined; csrf: string | undefined; key: string | undefined; body: string }[] = [];
  const host = await http(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    seen.push({ url: request.url!, bearer: request.headers.authorization, csrf: request.headers['x-flow-csrf'] as string | undefined,
      key: request.headers['idempotency-key'] as string | undefined, body });
    if (request.url!.includes('/stream?')) { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end('data: {"watermark":2,"nextCursor":2,"hasMore":false,"entries":[]}\n\n'); }
    else json(response, request.url!.endsWith('/logout') ? { protocol: ready.protocol, state: 'unauthenticated' } : ready);
  });
  const realFetch = globalThis.fetch; const inits: RequestInit[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => { inits.push(init!); return realFetch(input, init); });
  let csrf: string | undefined;
  const client = new FlowClient({ baseUrl: host.baseUrl, browserSession: { csrfToken: () => csrf } });
  try {
    expect(await client.browserSession()).toEqual(ready);
    expect(await client.connectBrowserSession('one-login-token')).toEqual(ready);
    csrf = ready.csrfToken;
    await client.cancel('task/中文', 'stable-key');
    csrf = 'b'.repeat(64);
    for await (const page of client.watch('task/中文', 1)) expect(page.watermark).toBe(2);
    expect(await client.logoutBrowserSession()).toEqual({ protocol: ready.protocol, state: 'unauthenticated' });
    expect(inits.every(init => init.credentials === 'include')).toBe(true);
    expect(seen).toEqual([
      { url: '/api/browser-session', bearer: undefined, csrf: undefined, key: undefined, body: '' },
      { url: '/api/browser-session/connect', bearer: 'Bearer one-login-token', csrf: undefined, key: undefined, body: '{}' },
      { url: '/api/tasks/task%2F%E4%B8%AD%E6%96%87/cancel', bearer: undefined, csrf: 'a'.repeat(64), key: 'stable-key', body: '{}' },
      { url: '/api/tasks/task%2F%E4%B8%AD%E6%96%87/stream?after=1', bearer: undefined, csrf: undefined, key: undefined, body: '' },
      { url: '/api/browser-session/logout', bearer: undefined, csrf: 'b'.repeat(64), key: undefined, body: '{}' },
    ]);
  } finally { spy.mockRestore(); await host.close(); }
});

it('does not retry rejected or unknown session changes and rejects missing CSRF before sending', async () => {
  const seen: string[] = [];
  const host = await http(async (request, response) => {
    seen.push(request.url!);
    if (request.url!.endsWith('/connect')) response.destroy();
    else if (request.url!.includes('/cancel')) json(response, { error: { code: 'csrf_invalid', message: 'Rejected.' } }, 403);
    else json(response, { ...ready, csrfToken: 'invalid' });
  });
  let csrf: string | undefined;
  const client = new FlowClient({ baseUrl: host.baseUrl, browserSession: { csrfToken: () => csrf } });
  try {
    await expect(client.cancel('one', 'key')).rejects.not.toBeInstanceOf(FlowApiError);
    expect(seen).toEqual([]);
    await expect(client.connectBrowserSession('token')).rejects.toThrow();
    await expect(client.browserSession()).rejects.not.toBeInstanceOf(FlowApiError);
    csrf = 'c'.repeat(64);
    await expect(client.cancel('one', 'key')).rejects.toMatchObject({ status: 403, code: 'csrf_invalid' });
    await expect(client.browserSession(AbortSignal.abort())).rejects.toThrow();
    expect(seen).toEqual(['/api/browser-session/connect', '/api/browser-session', '/api/tasks/one/cancel']);
  } finally { await host.close(); }
});

it('preserves old Bearer HTTP and SSE without cookies or CSRF, and refuses mixed auth configuration', async () => {
  const seen: { bearer: string | undefined; csrf: unknown }[] = [];
  const host = await http(async (request, response) => {
    seen.push({ bearer: request.headers.authorization, csrf: request.headers['x-flow-csrf'] });
    if (request.url!.includes('/stream?')) { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end('data: {"watermark":0}\n\n'); }
    else json(response, {});
  });
  const realFetch = globalThis.fetch; const inits: RequestInit[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => { inits.push(init!); return realFetch(input, init); });
  try {
    const client = new FlowClient({ baseUrl: host.baseUrl, token: 'legacy-owner' });
    await client.cancel('old', 'original-key'); for await (const _page of client.watch('old')) { /* consume real stream */ }
    expect(seen).toEqual([{ bearer: 'Bearer legacy-owner', csrf: undefined }, { bearer: 'Bearer legacy-owner', csrf: undefined }]);
    expect(inits.every(init => init.credentials === 'omit')).toBe(true);
    // @ts-expect-error Runtime callers must not silently downgrade an explicit Bearer to cookies.
    expect(() => new FlowClient({ baseUrl: host.baseUrl, token: 'invalid-owner', browserSession: { csrfToken: () => undefined } })).toThrow();
    await expect(client.connectBrowserSession('token')).rejects.toThrow();
  } finally { spy.mockRestore(); await host.close(); }
});
