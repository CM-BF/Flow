import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { executionProfilePublicationSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('message settings reader leaves legacy steering and native readers unchanged on the same client', async () => {
  const headers: unknown[] = [];
  const server = createServer((request, response) => {
    const header = request.headers['x-flow-execution-profile']; headers.push(header);
    const protocol = header === 'native-v1' ? 'flow.native-execution-profile-catalog.v1'
      : header === 'flow.claude-turn-settings.v1' ? header : undefined;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ...(protocol ? { protocol } : {}), profiles: [], nextCursor: null }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    expect(await client.executionProfiles()).toEqual({ profiles: [], nextCursor: null });
    await client.executionProfiles({ profileProtocol: 'steering-v1' });
    expect((await client.nativeExecutionProfiles()).protocol).toBe('flow.native-execution-profile-catalog.v1');
    await client.claudeMessageSettingsProfiles();
    expect(await client.executionProfiles()).toEqual({ profiles: [], nextCursor: null });
    expect(headers).toEqual([undefined, 'steering-v1', 'native-v1', 'flow.claude-turn-settings.v1', undefined]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('message settings catalog validates configured choices, cursor and protocol on every page', async () => {
  const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) };
  const configuration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'configured-alias', thinking: 'disabled',
    permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'b'.repeat(64),
    turnSettings: { protocol: 'flow.claude-turn-settings.v1', choices: [{ model: 'configured-alias', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' }] },
    limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } };
  const entry = { profile: { reference, configuration, source: 'runner-configured', availability: 'not-probed',
    model: { value: 'configured-alias', displayName: 'configured-alias', resolvedModel: null, description: '', providerCapabilities: 'unknown' },
    controls: { access: 'configured-policy', queue: false, steer: false, messageSettings: { protocol: 'flow.claude-turn-settings.v1', choices: 'configuration.turnSettings.choices' } },
    createdAt: '2026-10-06T00:00:00Z' }, conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } };
  const page = { protocol: 'flow.claude-turn-settings.v1', profiles: [entry], nextCursor: reference.id };
  let responseBody: unknown = page; let status = 200;
  const requests: { path: string; header: unknown }[] = [];
  const server = createServer((request, response) => {
    requests.push({ path: request.url!, header: request.headers['x-flow-execution-profile'] });
    response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(responseBody));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    expect(await client.claudeMessageSettingsProfiles({ limit: 1 })).toEqual(page);
    responseBody = { ...page, profiles: [], nextCursor: null };
    await client.claudeMessageSettingsProfiles({ after: reference.id, limit: 1 });
    expect(requests.slice(0, 2)).toEqual([
      { path: '/api/execution-profiles?limit=1', header: page.protocol },
      { path: `/api/execution-profiles?after=${reference.id}&limit=1`, header: page.protocol },
    ]);
    const invalid = [
      { ...page, protocol: 'flow.native-execution-profile-catalog.v1' }, { ...page, protocol: 'steering-v1' },
      { ...page, nextCursor: randomUUID() }, { ...page, profiles: [entry, entry] }, { ...page, profiles: Array(101).fill(entry) },
      { ...page, profiles: [{ ...entry, profile: { ...entry.profile, model: { ...entry.profile.model, value: 'contradiction' } } }] },
      { ...page, profiles: [{ ...entry, profile: { ...entry.profile, configuration: { ...configuration, turnSettings: { ...configuration.turnSettings, choices: Array(33).fill(configuration.turnSettings.choices[0]) } } } }] },
    ];
    for (const bad of invalid) { responseBody = bad; await expect(client.claudeMessageSettingsProfiles()).rejects.toThrow(); }
    status = 409; responseBody = { error: { code: 'cursor-rejected', message: 'Refresh.' } };
    await expect(client.claudeMessageSettingsProfiles()).rejects.toMatchObject({ status: 409, code: 'cursor-rejected' });
    await expect(client.claudeMessageSettingsProfiles({}, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toHaveLength(3 + invalid.length);
    expect(requests.every(request => request.header === page.protocol)).toBe(true);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('message settings reader uses its exact protocol and rejects a legacy successful envelope', async () => {
  const headers: unknown[] = [];
  const server = createServer((request, response) => {
    headers.push(request.headers['x-flow-execution-profile']);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(request.url!.includes('after=legacy') ? { profiles: [], nextCursor: null }
      : { protocol: 'flow.claude-turn-settings.v1', profiles: [], nextCursor: null }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    expect(await client.claudeMessageSettingsProfiles()).toEqual({ protocol: 'flow.claude-turn-settings.v1', profiles: [], nextCursor: null });
    await expect(client.claudeMessageSettingsProfiles({ after: 'legacy' })).rejects.toThrow();
    expect(headers).toEqual(['flow.claude-turn-settings.v1', 'flow.claude-turn-settings.v1']);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

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

it('opts into the exact profile protocol on each requested page without leaking it to publication or fallback requests', async () => {
  const requests: { path: string; header: string | undefined; method: string }[] = [];
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer profile-protocol-owner');
    requests.push({ path: request.url!, header: request.headers['x-flow-execution-profile'] as string | undefined, method: request.method! });
    let body = ''; for await (const chunk of request) body += chunk;
    if (body) expect(executionProfilePublicationSchema.safeParse(JSON.parse(body)).success).toBe(true);
    const conflict = request.url!.includes('after=conflict');
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'profile_cursor', message: 'Cursor rejected.' } } : { profiles: [], nextCursor: 'next/id' }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'profile-protocol-owner' });
  const configuration = executionProfilePublicationSchema.parse({ configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'configured-alias', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 }, activeSteering: { protocol: 'flow.active-steering.v1' } } });
  try {
    const page = await client.executionProfiles({ limit: 1, profileProtocol: 'steering-v1' });
    await client.executionProfiles({ after: page.nextCursor!, limit: 1, profileProtocol: 'steering-v1' });
    await client.executionProfiles();
    await client.publishExecutionProfile(configuration);
    await expect(client.executionProfiles({ after: 'conflict', profileProtocol: 'steering-v1' })).rejects.toMatchObject({ status: 409, code: 'profile_cursor' });
    await expect(client.executionProfiles({ profileProtocol: 'steering-v1' }, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toEqual([
      { path: '/api/execution-profiles?limit=1', header: 'steering-v1', method: 'GET' },
      { path: '/api/execution-profiles?after=next%2Fid&limit=1', header: 'steering-v1', method: 'GET' },
      { path: '/api/execution-profiles', header: undefined, method: 'GET' },
      { path: '/api/runner/execution-profile', header: undefined, method: 'POST' },
      { path: '/api/execution-profiles?after=conflict', header: 'steering-v1', method: 'GET' },
    ]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
