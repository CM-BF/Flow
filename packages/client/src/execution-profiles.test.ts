import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { executionProfilePublicationSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('publishes only explicit configured facts and preserves owner pagination, runner identity and conflict errors', async () => {
  const requests: { path: string; method: string; authorization: string; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ path: request.url!, method: request.method!, authorization: request.headers.authorization!, body });
    const rejected = body?.configuration.model === 'changed';
    response.writeHead(rejected ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(rejected ? { error: { code: 'execution_profile_conflict', message: 'Configuration is immutable.' } } : { source: 'runner-configured', availability: 'not-probed', resolvedModel: null }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const owner = new FlowClient({ baseUrl, token: 'profile-owner' });
  const runner = new FlowClient({ baseUrl, token: 'profile-runner' });
  const input = executionProfilePublicationSchema.parse({ configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'configured-alias', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } });
  try {
    expect(await runner.publishExecutionProfile(input)).toMatchObject({ availability: 'not-probed', resolvedModel: null });
    await owner.executionProfiles({ after: 'opaque/value', limit: 3 });
    await expect(runner.publishExecutionProfile({ configuration: { ...input.configuration, model: 'changed' } })).rejects.toMatchObject({ status: 409, code: 'execution_profile_conflict' });
    await expect(owner.executionProfiles({}, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toEqual([
      { path: '/api/runner/execution-profile', method: 'POST', authorization: 'Bearer profile-runner', body: input },
      { path: '/api/execution-profiles?after=opaque%2Fvalue&limit=3', method: 'GET', authorization: 'Bearer profile-owner', body: null },
      { path: '/api/runner/execution-profile', method: 'POST', authorization: 'Bearer profile-runner', body: { configuration: { ...input.configuration, model: 'changed' } } },
    ]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
