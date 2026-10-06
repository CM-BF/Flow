import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { nativeExecutionProfileCatalogPageSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('reads the explicit native catalog on every page and rejects fallback or contradictory capability responses', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const page = nativeExecutionProfileCatalogPageSchema.parse({
    protocol: 'flow.native-execution-profile-catalog.v1', nextCursor: id, profiles: [{
      profile: {
        reference: { id, runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) },
        configuration: { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'configured-model',
          reasoningEffort: null, serviceTier: null, serviceTierForTurn: null, access: 'none', approvalPolicy: 'never',
          sandboxMode: 'read-only', hostLimits: { wallTimeMs: 30_000, maxOutputBytes: 4096 } },
        source: 'runner-configured', availability: 'not-probed',
        model: { value: 'configured-model', resolvedModel: null, displayName: 'Configured', description: '', providerCapabilities: 'unknown' },
        controls: { model: 'select-configured-profile', thinking: 'unsupported', effort: 'configured-request',
          serviceTier: 'configured-request', access: 'requested-none', queue: false, steer: false },
        createdAt: '2026-10-06T00:00:00.000Z',
      },
      conversation: { state: 'unsupported', reason: 'codex-conversation-unimplemented' },
    }],
  });
  const empty = { protocol: page.protocol, profiles: [], nextCursor: null };
  const calls: { path: string; method: string; auth: unknown; protocol: unknown }[] = [];
  const server = createServer((request, response) => {
    calls.push({ path: request.url!, method: request.method!, auth: request.headers.authorization, protocol: request.headers['x-flow-execution-profile'] });
    const after = new URL(request.url!, 'http://127.0.0.1').searchParams.get('after');
    response.writeHead(after === 'conflict' ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(after === 'conflict' ? { error: { code: 'profile_unavailable', message: 'Unavailable.' } }
      : after === 'legacy' ? { profiles: [], nextCursor: null }
      : after === 'contradictory' ? { ...page, profiles: [{ ...page.profiles[0], conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } }] }
      : after ? empty : page));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    expect(await client.nativeExecutionProfiles({ limit: 1 })).toEqual(page);
    expect(await client.nativeExecutionProfiles({ after: id, limit: 1 })).toEqual(empty);
    await expect(client.nativeExecutionProfiles({ after: 'legacy' })).rejects.toThrow();
    await expect(client.nativeExecutionProfiles({ after: 'contradictory' })).rejects.toThrow();
    await expect(client.nativeExecutionProfiles({ after: 'conflict' })).rejects.toMatchObject({ status: 409, code: 'profile_unavailable' });
    expect(await client.nativeExecutionProfiles({ after: 'a/b ?' })).toEqual(empty);
    await expect(client.nativeExecutionProfiles({}, AbortSignal.abort())).rejects.toThrow();
    expect(calls.map(call => call.path)).toEqual([
      '/api/execution-profiles?limit=1', `/api/execution-profiles?after=${id}&limit=1`,
      '/api/execution-profiles?after=legacy', '/api/execution-profiles?after=contradictory',
      '/api/execution-profiles?after=conflict', '/api/execution-profiles?after=a%2Fb+%3F',
    ]);
    expect(calls.every(call => call.method === 'GET' && call.auth === 'Bearer synthetic-owner' && call.protocol === 'native-v1')).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
