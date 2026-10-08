import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HttpError, sha256 } from '../database.js';

const calls = vi.hoisted(() => ({ admit: vi.fn(), authorize: vi.fn(), store: vi.fn() }));
vi.mock('./verification-admission.js', () => ({ admitPluginVerification: calls.admit }));
vi.mock('./commands.js', () => ({ authorizePluginPhase: calls.authorize }));
vi.mock('../browser-session/store.js', () => ({ openBrowserSessionStore: calls.store }));
import { createBrowserSessionAuthentication } from '../browser-session/index.js';
import { registerPluginVerificationRoutes } from './verification-routes.js';

declare module 'fastify' { interface FastifyRequest { runnerId: string | null } }
const id = '11000000-0000-4000-8000-000000000001';
const runnerId = '22000000-0000-4000-8000-000000000002';
const ownerToken = 'owner-route-fixture';
const runnerToken = 'runner-route-fixture';
const origin = 'http://127.0.0.1:3000';
const token = 't'.repeat(43);
const cookieName = `flow-session-${sha256(JSON.stringify(['center-fixture', origin])).slice(0, 24)}`;
const ownerHeaders = { authorization: `Bearer ${ownerToken}`, 'idempotency-key': 'fixed-key' };
const runnerHeaders = { authorization: `Bearer ${runnerToken}`, 'idempotency-key': 'fixed-key' };
const input = { expectedRevision: 2, expectedSourceProjectRevision: 3, title: 'Verify JSON',
  source: { taskId: 'source', attemptId: 'attempt', artifactId: 'artifact', version: 'a'.repeat(64) },
  rule: { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['b', 'a'] } };
const phase = { attemptId: id, ownerVersion: 1, bindingId: id, invocationId: id, phase: 'load' };
const policy = { hosts: () => true, algorithms: () => true };
let app: FastifyInstance;
let pool: Pool;
const boss = {} as never;

beforeEach(async () => {
  vi.resetAllMocks();
  calls.store.mockResolvedValue({ identity: { centerId: 'center-fixture', epoch: 'epoch-fixture' },
    assertCurrent: vi.fn(), read: vi.fn().mockResolvedValue({ expiresAt: '2099-01-01T00:00:00.000Z' }) });
  pool = { query: vi.fn(async (_sql: string, values: unknown[]) => ({ rows: values[0] === sha256(runnerToken) ? [{ id: runnerId }] : [] })) } as unknown as Pool;
  app = Fastify();
  app.decorateRequest('runnerId', null);
  // Match the factory's error mapping so a leaked ZodError remains a visible 500.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: { code: error.code } });
    const candidate = error as { statusCode?: number };
    const status = candidate.statusCode === 413 ? 413 : candidate.statusCode === 400 ? 400 : 500;
    return reply.code(status).send({ error: { code: status === 413 ? 'body_too_large' : status === 400 ? 'invalid_request' : 'internal_error' } });
  });
  const auth = await createBrowserSessionAuthentication(pool, { ownerToken,
    browserSession: { cookieOrigin: origin, trustedOrigins: [origin], authEpoch: 'fixture' } });
  app.addHook('preHandler', auth.authenticate);
  registerPluginVerificationRoutes(app, pool, boss, policy);
});
afterEach(async () => { await app.close(); });

test('verifier routes reject invalid registration identity before calling admission', async () => {
  const result = await app.inject({ method: 'POST', url: '/api/plugins/not-a-uuid/verification-tasks', headers: ownerHeaders, payload: input });
  expect(result.statusCode).toBe(400); expect(result.json()).toEqual({ error: { code: 'invalid_plugin_runtime_id' } });
  expect(calls.admit).not.toHaveBeenCalled();
});
test.each([
  ['missing body fields', {}],
  ['foreign field', { ...input, projectId: id }],
  ['invalid exact artifact digest', { ...input, source: { ...input.source, version: 'wrong' } }],
  ['unsupported algorithm', { ...input, rule: { ...input.rule, algorithmVersion: 99 } }],
])('verifier routes reject admission schema: %s', async (_label, payload) => {
  const result = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: ownerHeaders, payload });
  expect(result.statusCode).toBe(400); expect(result.json()).toEqual({ error: { code: 'invalid_plugin_verification_admission' } });
  expect(calls.admit).not.toHaveBeenCalled();
});
test('verifier routes reject invalid runner phase schema before authorization', async () => {
  for (const payload of [{}, { ...phase, phase: 'execute' }, { ...phase, attemptId: 'wrong' }]) {
    const result = await app.inject({ method: 'POST', url: '/api/runner/plugin-verifier/authorize', headers: runnerHeaders, payload });
    expect(result.statusCode).toBe(400); expect(result.json()).toEqual({ error: { code: 'invalid_plugin_grant' } });
  }
  expect(calls.authorize).not.toHaveBeenCalled();
});
test('verifier routes preserve current owner and runner authentication roles', async () => {
  for (const [url, headers, payload] of [
    [`/api/plugins/${id}/verification-tasks`, runnerHeaders, input],
    ['/api/runner/plugin-verifier/authorize', ownerHeaders, phase],
  ] as const) {
    const result = await app.inject({ method: 'POST', url, headers, payload });
    expect(result.statusCode).toBe(403); expect(result.json().error.code).toBe('wrong_role');
  }
  const missing = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, payload: input });
  expect(missing.statusCode).toBe(403); // Browser mutations first require the configured trusted origin.
  expect(calls.admit).not.toHaveBeenCalled(); expect(calls.authorize).not.toHaveBeenCalled();
});
test('verifier admission preserves browser origin and CSRF checks', async () => {
  const headers = { host: '127.0.0.1:3000', origin, cookie: `${cookieName}=${token}`, 'idempotency-key': 'cookie-key' };
  const rejected = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers, payload: input });
  expect(rejected.statusCode).toBe(403); expect(rejected.json().error.code).toBe('csrf_required');
  const foreign = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: { ...headers, origin: 'http://localhost:3001' }, payload: input });
  expect(foreign.statusCode).toBe(403); expect(foreign.json().error.code).toBe('browser_origin_forbidden');
  expect(calls.admit).not.toHaveBeenCalled();
  calls.admit.mockResolvedValue({ task: { id }, replayed: false });
  const accepted = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: { ...headers, 'x-flow-csrf': sha256('flow.browser-session.csrf.v1\0' + token) }, payload: input });
  expect(accepted.statusCode).toBe(201); expect(calls.admit).toHaveBeenCalledTimes(1);
});
test('verifier admission preserves parsed contract, idempotency and first/replayed status', async () => {
  for (const replayed of [false, true]) {
    const response = { task: { id }, binding: { bindingId: id }, project: { id, revision: 4, nodeId: id }, replayed };
    calls.admit.mockResolvedValue(response);
    const result = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: ownerHeaders, payload: input });
    expect(result.statusCode).toBe(replayed ? 200 : 201); expect(result.headers['cache-control']).toBe('no-store'); expect(result.json()).toEqual(response);
    expect(calls.admit).toHaveBeenLastCalledWith(pool, boss, id, { ...input, rule: { ...input.rule, requiredKeys: ['a', 'b'] } }, 'fixed-key', policy.hosts, policy.algorithms);
  }
});
test('verifier phase forwards authenticated identity and exact verifier kind', async () => {
  const receipt = { ...phase, protocol: 'flow.plugin-runtime.v1', taskId: id, runnerId, authorizedRevision: 2, replayed: false };
  calls.authorize.mockResolvedValue(receipt);
  const result = await app.inject({ method: 'POST', url: '/api/runner/plugin-verifier/authorize', headers: runnerHeaders, payload: phase });
  expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store'); expect(result.json()).toEqual(receipt);
  expect(calls.authorize).toHaveBeenCalledWith(pool, runnerId, phase, 'fixed-key', 'verifier', policy.algorithms);
});
test('verifier routes retain missing-key and body-size boundaries', async () => {
  const missing = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: { authorization: ownerHeaders.authorization }, payload: input });
  expect(missing.statusCode).toBe(400); expect(missing.json().error.code).toBe('idempotency_key_required');
  const large = await app.inject({ method: 'POST', url: `/api/plugins/${id}/verification-tasks`, headers: ownerHeaders, payload: { ...input, title: 'x'.repeat(16384) } });
  expect(large.statusCode).toBe(413); expect(large.json().error.code).toBe('body_too_large');
  expect(calls.admit).not.toHaveBeenCalled();
});
