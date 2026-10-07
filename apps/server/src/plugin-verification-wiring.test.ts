import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { HttpError, sha256 } from './database.js';
import { createServer } from './index.js';

// Exercise the real factory, Fastify routes and authentication; replace only database/domain work.
const domain = vi.hoisted(() => ({
  admit: vi.fn(), authorize: vi.fn(), change: vi.fn(), runtime: vi.fn(), events: vi.fn(),
  migrateRuntime: vi.fn(), migrateVerification: vi.fn(), scheduler: vi.fn(), stop: vi.fn(), end: vi.fn(),
  migrations: [] as number[], runnerId: '11111111-1111-4111-8111-111111111111', runnerHash: '',
}));
vi.mock('pg', async () => {
  const { EventEmitter } = await import('node:events');
  class Pool extends EventEmitter {
    async query(sql: string, values?: unknown[]) {
      if (sql.includes('token_hash')) return { rows: values?.[0] === domain.runnerHash ? [{ id: domain.runnerId }] : [], rowCount: 1 };
      return { rows: [{ version: 1 }], rowCount: 1 };
    }
    connect(callback?: (error: null, client: Pool & { release(): void }) => void) {
      const client = Object.assign(new Pool(), { release() {} });
      if (callback) { callback(null, client); return; }
      return Promise.resolve(client);
    }
    end = domain.end;
  }
  return { Pool };
});
vi.mock('./scheduler.js', () => ({ startScheduler: domain.scheduler }));
vi.mock('./events.js', async original => ({ ...await original<typeof import('./events.js')>(), reportEvents: domain.events }));
vi.mock('./plugin-runtime/verification-admission.js', () => ({ admitPluginVerification: domain.admit }));
vi.mock('./plugin-runtime/commands.js', () => ({ authorizePluginPhase: domain.authorize, changePluginRuntime: domain.change, admitPluginToolTask: vi.fn() }));
vi.mock('./plugin-runtime/store.js', async original => ({
  ...await original<typeof import('./plugin-runtime/store.js')>(),
  migratePluginRuntime: domain.migrateRuntime, readRuntime: domain.runtime,
}));
vi.mock('./plugin-runtime/verification.js', async original => ({
  ...await original<typeof import('./plugin-runtime/verification.js')>(), migratePluginVerification: domain.migrateVerification,
}));
vi.mock('./browser-session/store.js', () => ({
  migrateBrowserSessions: vi.fn(),
  openBrowserSessionStore: async () => ({
    identity: { centerId: 'synthetic-center', authEpoch: 'synthetic-epoch' },
    assertCurrent: async () => {}, create: async () => ({ expiresAt: '2099-01-01T00:00:00.000Z' }),
    read: async () => ({ expiresAt: '2099-01-01T00:00:00.000Z' }), revoke: async () => {},
  }),
}));

const owner = 'synthetic-owner', runnerToken = 'synthetic-runner';
const registration = '22222222-2222-4222-8222-222222222222';
const ownerHeaders = { authorization: `Bearer ${owner}`, 'idempotency-key': 'fixed-request' };
const runnerHeaders = { authorization: `Bearer ${runnerToken}`, 'idempotency-key': 'fixed-phase' };
const hosts = () => true, algorithms = () => false;
const admission = {
  expectedRevision: 2, expectedSourceProjectRevision: 3, title: 'Verify saved artifact',
  source: { taskId: 'source-task', attemptId: 'source-attempt', artifactId: 'source-artifact', version: 'a'.repeat(64) },
  rule: { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['id'] },
};
const grant = { attemptId: randomUUID(), ownerVersion: 1, bindingId: randomUUID(), invocationId: randomUUID(), phase: 'invoke' };
const batch = { attemptId: 'attempt', ownerVersion: 1, events: [{ id: 'message', sequence: 1, type: 'message', text: 'hello' }] };
const apps: FastifyInstance[] = [];
async function factory(extra: Partial<Parameters<typeof createServer>[0]> = {}) {
  const app = await createServer({ databaseUrl: 'synthetic-only', ownerToken: owner, automaticQueueScan: false, ...extra });
  apps.push(app); return app;
}
beforeEach(() => {
  vi.clearAllMocks(); domain.migrations.length = 0; domain.runnerHash = sha256(runnerToken);
  domain.end.mockResolvedValue(undefined); domain.stop.mockResolvedValue(undefined);
  domain.scheduler.mockResolvedValue({ stop: domain.stop });
  domain.migrateRuntime.mockImplementation(async () => { domain.migrations.push(34); });
  domain.migrateVerification.mockImplementation(async () => { domain.migrations.push(36); });
  domain.admit.mockResolvedValue({ replayed: false, task: { id: 'new-task' }, binding: { bindingId: 'binding' }, project: { id: 'project', revision: 4, nodeId: 'node' } });
  domain.authorize.mockResolvedValue({ ...grant, authorized: true }); domain.change.mockResolvedValue({ changed: true });
  domain.runtime.mockResolvedValue({ enabled: false }); domain.events.mockResolvedValue({ acknowledged: 1 });
});
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); vi.unstubAllEnvs(); });

test('factory keeps verifier routes disabled by default and rejects a partial explicit policy', async () => {
  const app = await factory();
  expect((await app.inject({ method: 'POST', url: `/api/plugins/${registration}/verification-tasks`, headers: ownerHeaders, payload: admission })).statusCode).toBe(404);
  expect((await app.inject({ method: 'POST', url: '/api/runner/plugin-verifier/authorize', headers: runnerHeaders, payload: grant })).statusCode).toBe(404);
  await expect(factory({ pluginVerifierPolicy: algorithms })).rejects.toThrow('host policy');
  expect(domain.admit).not.toHaveBeenCalled(); expect(domain.authorize).not.toHaveBeenCalled();
});

test('factory migrates plugin runtime then verification under the existing observed phase and closes on failure', async () => {
  const observations: unknown[] = [];
  await factory({ startupObserver: observation => { observations.push(observation); } });
  expect(domain.migrations).toEqual([34, 36]);
  expect(observations).toContainEqual(expect.objectContaining({ phase: 'migratePluginRuntime', event: 'settled' }));
  domain.migrateVerification.mockRejectedValueOnce(new Error('migration rejected'));
  const schedulers = domain.scheduler.mock.calls.length, endings = domain.end.mock.calls.length;
  await expect(factory()).rejects.toThrow('migration rejected');
  expect(domain.scheduler).toHaveBeenCalledTimes(schedulers); expect(domain.end).toHaveBeenCalledTimes(endings + 1);
});

test('mounted owner admission preserves authentication, stable key, replay ACK and both exact policies', async () => {
  const app = await factory({ pluginRuntimeHostPolicy: hosts, pluginVerifierPolicy: algorithms });
  const request = { method: 'POST' as const, url: `/api/plugins/${registration}/verification-tasks`, payload: admission };
  expect((await app.inject(request)).statusCode).toBe(401);
  expect((await app.inject({ ...request, headers: runnerHeaders })).statusCode).toBe(403);
  expect(domain.admit).not.toHaveBeenCalled();
  const accepted = await app.inject({ ...request, headers: ownerHeaders });
  expect(accepted.statusCode).toBe(201); expect(accepted.headers['cache-control']).toBe('no-store');
  expect(accepted.json()).toEqual(await domain.admit.mock.results[0]!.value);
  expect(domain.admit.mock.calls[0]!.slice(2)).toEqual([registration, admission, 'fixed-request', hosts, algorithms]);
  domain.admit.mockResolvedValueOnce({ ...accepted.json(), replayed: true });
  expect((await app.inject({ ...request, headers: ownerHeaders })).statusCode).toBe(200);
  expect(domain.admit.mock.calls[1]![4]).toBe('fixed-request');
});

test('mounted verifier phase uses authenticated runner identity and keeps tool authorization separate', async () => {
  const app = await factory({ pluginRuntimeHostPolicy: hosts, pluginVerifierPolicy: algorithms });
  const request = { method: 'POST' as const, url: '/api/runner/plugin-verifier/authorize', payload: grant };
  expect((await app.inject({ ...request, headers: ownerHeaders })).statusCode).toBe(403);
  expect((await app.inject(request)).statusCode).toBe(401);
  const authorized = await app.inject({ ...request, headers: runnerHeaders });
  expect(authorized.statusCode).toBe(200); expect(authorized.headers['cache-control']).toBe('no-store');
  expect(domain.authorize.mock.calls[0]!.slice(1)).toEqual([domain.runnerId, grant, 'fixed-phase', 'verifier', algorithms]);
  expect((await app.inject({ ...request, url: '/api/runner/plugin-tool/authorize', headers: runnerHeaders })).statusCode).toBe(200);
  expect(domain.authorize.mock.calls[1]!.slice(1)).toEqual([domain.runnerId, grant, 'fixed-phase']);
});

test('owner browser mutation inherits the same Origin and CSRF gate', async () => {
  const origin = 'http://localhost';
  const app = await factory({ pluginRuntimeHostPolicy: hosts, pluginVerifierPolicy: algorithms,
    browserSession: { cookieOrigin: origin, trustedOrigins: [origin], authEpoch: 'test' } });
  const connected = await app.inject({ method: 'POST', url: '/api/browser-session/connect', headers: { ...ownerHeaders, host: 'localhost', origin }, payload: {} });
  expect(connected.statusCode).toBe(200);
  const cookie = String(connected.headers['set-cookie']).split(';')[0]!;
  const request = { method: 'POST' as const, url: `/api/plugins/${registration}/verification-tasks`, payload: admission };
  const headers = { host: 'localhost', origin, cookie, 'idempotency-key': 'browser-key' };
  expect((await app.inject({ ...request, headers })).statusCode).toBe(403);
  expect((await app.inject({ ...request, headers: { ...headers, origin: 'http://evil.invalid', 'x-flow-csrf': connected.json().csrfToken } })).statusCode).toBe(403);
  expect(domain.admit).not.toHaveBeenCalled();
  expect((await app.inject({ ...request, headers: { ...headers, 'x-flow-csrf': connected.json().csrfToken } })).statusCode).toBe(201);
});

test('mounted admission enforces its existing input and response bounds without repeating unknown commands', async () => {
  const app = await factory({ pluginRuntimeHostPolicy: hosts, pluginVerifierPolicy: algorithms });
  const request = { method: 'POST' as const, url: `/api/plugins/${registration}/verification-tasks`, headers: ownerHeaders, payload: admission };
  expect((await app.inject({ ...request, payload: { ...admission, title: 'x'.repeat(17000) } })).statusCode).toBe(413);
  expect(domain.admit).not.toHaveBeenCalled();
  domain.admit.mockResolvedValueOnce({ replayed: false, tooLarge: 'x'.repeat(65537) });
  expect((await app.inject(request)).statusCode).toBe(413); expect(domain.admit).toHaveBeenCalledOnce();
  domain.admit.mockRejectedValueOnce(new Error('unknown command acknowledgement'));
  expect((await app.inject(request)).statusCode).toBe(500); expect(domain.admit).toHaveBeenCalledTimes(2);
});

test('runtime enable, runtime read and event terminal gate receive the identical private verifier policy', async () => {
  const app = await factory({ pluginRuntimeHostPolicy: hosts, pluginVerifierPolicy: algorithms });
  const command = { expectedRevision: 2, reason: 'enable exact material', change: { kind: 'enable', materialInstallOperationId: randomUUID(), targetRunnerId: domain.runnerId, storeId: 'installed' } };
  expect((await app.inject({ method: 'POST', url: `/api/plugins/${registration}/runtime/commands`, headers: ownerHeaders, payload: command })).statusCode).toBe(200);
  expect(domain.change.mock.calls[0]!.slice(1)).toEqual([registration, command, 'fixed-request', hosts, algorithms]);
  expect((await app.inject({ url: `/api/plugins/${registration}/runtime`, headers: ownerHeaders })).statusCode).toBe(200);
  expect(domain.runtime.mock.calls[0]!.slice(1)).toEqual([registration, hosts, algorithms]);
  domain.events.mockRejectedValueOnce(new HttpError(409, 'plugin_verification_required', 'Verifier result required.'));
  const result = await app.inject({ method: 'POST', url: '/api/runner/events', headers: runnerHeaders, payload: batch });
  expect(result.statusCode).toBe(409); expect(result.json().error.code).toBe('plugin_verification_required');
  expect(domain.events.mock.calls[0]!.slice(1)).toEqual([domain.runnerId, batch, algorithms]);
});

async function loadMain(filename: string | undefined, configurationFailure?: Error) {
  vi.resetModules();
  for (const name of ['FLOW_PACKAGE_FETCH_CONFIG', 'FLOW_PLUGIN_INSTALL_CONFIG', 'FLOW_PLUGIN_RUNTIME_CONFIG',
    'FLOW_ACTIVE_STEERING', 'FLOW_BROWSER_SESSION_JSON', 'FLOW_ORIGIN', 'FLOW_STARTUP_DIAGNOSTICS']) vi.stubEnv(name, undefined);
  vi.stubEnv('DATABASE_URL', 'synthetic-only'); vi.stubEnv('FLOW_TOKEN', owner); vi.stubEnv('FLOW_PORT', '4310');
  vi.stubEnv('FLOW_PLUGIN_VERIFICATION_CONFIG', filename);
  const read = vi.fn(async () => { if (configurationFailure) throw configurationFailure; return filename === undefined ? undefined : algorithms; });
  const listen = vi.fn(async () => {}), close = vi.fn(async () => {});
  const create = vi.fn(async (_options: Parameters<typeof createServer>[0]) => ({ listen, close }));
  vi.doMock('./plugin-verification-configuration.js', () => ({ readPluginVerificationConfiguration: read }));
  vi.doMock('./plugin-runtime-configuration.js', () => ({ readPluginRuntimeConfiguration: async () => filename === undefined ? undefined : hosts }));
  vi.doMock('./index.js', () => ({ createServer: create }));
  const on = vi.spyOn(process, 'on');
  let failure: unknown;
  try {
    try { await import('./main.js'); } catch (error) { failure = error; }
    const stop = on.mock.calls.find(([event]) => event === 'SIGTERM')?.[1];
    if (stop) { stop(); await vi.waitFor(() => expect(close).toHaveBeenCalledOnce()); }
    return { read, create, listen, close, failure };
  } finally {
    for (const [event, listener] of on.mock.calls) if (event === 'SIGINT' || event === 'SIGTERM') process.off(event, listener);
    on.mockRestore(); vi.doUnmock('./index.js'); vi.doUnmock('./plugin-verification-configuration.js'); vi.doUnmock('./plugin-runtime-configuration.js');
  }
}

test('actual main loads the explicit verifier policy at configuration and forwards the exact function', async () => {
  const result = await loadMain('/synthetic/private-policy.json');
  expect(result.failure).toBeUndefined(); expect(result.read).toHaveBeenCalledExactlyOnceWith('/synthetic/private-policy.json');
  expect(result.create).toHaveBeenCalledOnce(); expect(result.create.mock.calls[0]![0]).toHaveProperty('pluginVerifierPolicy', algorithms);
  expect(result.listen).toHaveBeenCalledOnce(); expect(result.close).toHaveBeenCalledOnce();
});

test('actual main keeps omitted verifier configuration absent and fails explicit bad configuration before factory', async () => {
  const omitted = await loadMain(undefined);
  expect(omitted.failure).toBeUndefined(); expect(omitted.create.mock.calls[0]![0]).not.toHaveProperty('pluginVerifierPolicy');
  const error = new Error('Verifier policy is invalid or unavailable.');
  const invalid = await loadMain('', error);
  expect(invalid.read).toHaveBeenCalledExactlyOnceWith(''); expect(invalid.failure).toBe(error);
  expect(invalid.create).not.toHaveBeenCalled(); expect(invalid.listen).not.toHaveBeenCalled();
});
