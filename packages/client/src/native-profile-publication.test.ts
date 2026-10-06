import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { nativeExecutionProfilePublicationSchema, type NativeExecutionProfilePublished } from '@flow/contracts';
import { FlowClient } from './index.js';

it('publishes a native profile unchanged and keeps conflicts and aborted requests explicit', async () => {
  const calls: { method: string; path: string; authorization: string; body: unknown; protocol: unknown }[] = [];
  const input = nativeExecutionProfilePublicationSchema.parse({ configuration: {
    harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'configured-model',
    reasoningEffort: null, serviceTier: null, serviceTierForTurn: null, access: 'none',
    approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 30_000, maxOutputBytes: 4096 },
  } });
  if (input.configuration.harness !== 'codex') throw new Error('Fixture must remain Codex.');
  const published: NativeExecutionProfilePublished = { replayed: true, profile: {
    reference: { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) },
    configuration: input.configuration, source: 'runner-configured', availability: 'not-probed',
    model: { value: 'configured-model', resolvedModel: null, displayName: 'Configured', description: '', providerCapabilities: 'unknown' },
    controls: { model: 'select-configured-profile', thinking: 'unsupported', effort: 'configured-request', serviceTier: 'configured-request', access: 'requested-none', queue: false, steer: false },
    createdAt: '2026-10-06T00:00:00.000Z',
  } };
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    calls.push({ method: request.method!, path: request.url!, authorization: request.headers.authorization!, body, protocol: request.headers['x-flow-execution-profile'] });
    const valid = nativeExecutionProfilePublicationSchema.safeParse(body);
    const conflict = valid.success && valid.data.configuration.model === 'changed';
    response.writeHead(!valid.success ? 400 : conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'execution_profile_conflict', message: 'Immutable configuration.' } } : published));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-runner-token' });
  try {
    expect(await client.publishNativeExecutionProfile(input)).toEqual(published);
    await expect(client.publishNativeExecutionProfile({ configuration: { ...input.configuration, model: 'changed' } })).rejects.toMatchObject({ status: 409, code: 'execution_profile_conflict' });
    await expect(client.publishNativeExecutionProfile(input, AbortSignal.abort())).rejects.toThrow();
    expect(calls).toEqual([input, { configuration: { ...input.configuration, model: 'changed' } }].map(body => ({
      method: 'POST', path: '/api/runner/execution-profile', authorization: 'Bearer synthetic-runner-token', body, protocol: undefined,
    })));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
