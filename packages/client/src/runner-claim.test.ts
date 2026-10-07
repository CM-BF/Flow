import { createServer, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { RUNNER_CLAIM_PROTOCOL, type RunnerClaimRequest } from '@flow/contracts';
import { FlowClient } from './index.js';

const closes: (() => Promise<void>)[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const close of closes.splice(0)) await close(); });
async function peer() {
  const calls: { path: string; method: string; authorization?: string; body: unknown }[] = [];
  let reply = (path: string, body: RunnerClaimRequest, response: ServerResponse) => {
    response.end(JSON.stringify(path.endsWith('/identity') ? { protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'runner-client' }
      : { ...body, state: path.endsWith('/status') ? 'missing' : 'empty' }));
  };
  const server = createServer(async (request, response) => {
    const parts: Buffer[] = []; for await (const part of request) parts.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(parts).toString() || '{}'), path = request.url ?? '';
    calls.push({ path, method: request.method ?? '', authorization: request.headers.authorization, body });
    response.setHeader('content-type', 'application/json'); reply(path, body, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing private HTTP port.');
  closes.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return { calls, client: new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-token' }), onReply(fn: typeof reply) { reply = fn; } };
}
function request(): RunnerClaimRequest { return { protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'runner-client', requestId: randomUUID() }; }

it('uses the existing bearer transport and sends exact versioned claim/status identities once', async () => {
  const api = await peer(), input = request(); const fetchSpy = vi.spyOn(globalThis, 'fetch'); const signal = new AbortController().signal;
  expect(await api.client.runnerIdentity(signal)).toEqual({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: input.runnerId });
  expect(await api.client.claimOpportunity(input, signal)).toEqual({ ...input, state: 'empty' });
  expect(await api.client.claimOpportunityStatus(input, signal)).toEqual({ ...input, state: 'missing' });
  expect(api.calls).toEqual([
    { path: '/api/runner/identity', method: 'GET', authorization: 'Bearer synthetic-token', body: {} },
    { path: '/api/runner/claim-opportunity', method: 'POST', authorization: 'Bearer synthetic-token', body: input },
    { path: '/api/runner/claim-opportunity/status', method: 'POST', authorization: 'Bearer synthetic-token', body: input },
  ]);
  for (const [, init] of fetchSpy.mock.calls) { expect(init?.credentials).toBe('omit'); expect(init?.signal).toBe(signal); }
});

it('treats malformed, mismatched and lost acknowledgements as unknown without hidden retries', async () => {
  const api = await peer(), input = request();
  api.onReply((_path, _body, response) => response.end('{}'));
  await expect(api.client.claimOpportunity(input)).rejects.toThrow();
  api.onReply((_path, body, response) => response.end(JSON.stringify({ ...body, requestId: randomUUID(), state: 'empty' })));
  await expect(api.client.claimOpportunity(input)).rejects.toThrow();
  api.onReply((_path, _body, response) => response.destroy());
  await expect(api.client.claimOpportunity(input)).rejects.toThrow();
  expect(api.calls).toHaveLength(3); expect(api.calls.every(call => JSON.stringify(call.body) === JSON.stringify(input))).toBe(true);
});

it('preserves HTTP authorization/conflict errors and abort on the status transport', async () => {
  const api = await peer(), input = request();
  for (const status of [403, 409]) {
    api.onReply((_path, _body, response) => response.writeHead(status).end(JSON.stringify({ error: { code: status === 403 ? 'wrong_role' : 'conflict', message: 'Synthetic failure' } })));
    await expect(api.client.claimOpportunityStatus(input)).rejects.toMatchObject({ status, message: 'Synthetic failure' });
  }
  let received!: () => void; const ready = new Promise<void>(resolve => { received = resolve; });
  api.onReply(() => received()); const stop = new AbortController(); const pending = api.client.claimOpportunityStatus(input, stop.signal);
  await ready; stop.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(api.calls).toHaveLength(3);
});
