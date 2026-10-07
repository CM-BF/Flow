import { beforeEach, expect, test, vi } from 'vitest';
import Fastify from 'fastify';
import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { pluginHostCandidatesPageSchema, pluginHostCandidatesQuerySchema } from '../../../../packages/contracts/src/plugin-runtime-hosts.js';
import { readPluginHostCandidates } from './host-candidates.js';
import { changePluginRuntime, admitPluginToolTask } from './commands.js';
import { registerPluginRuntimeRoutes } from './routes.js';
import { createBrowserSessionAuthentication } from '../browser-session/index.js';
import { HttpError } from '../database.js';

const mock = vi.hoisted(() => ({ snapshot: vi.fn(), install: vi.fn(), append: vi.fn(), lock: vi.fn() }));
vi.mock('../plugins/storage.js', () => ({ readSnapshot: mock.snapshot, loadInstallation: mock.snapshot, appendPluginRevision: mock.append }));
vi.mock('../plugin-installations/store.js', () => ({ loadInstall: mock.install }));
vi.mock('../runners.js', () => ({ lockRunner: mock.lock, ownedAttempt: vi.fn() }));
vi.mock('../tasks.js', () => ({ command: async (pool: Pool, _operation: string, _key: string, _input: unknown, run: (client: PoolClient) => unknown) => ({ value: await run(await pool.connect()), replayed: false }), commandInTransaction: vi.fn(), acceptTask: vi.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const registrationId = id(1000), materialInstallOperationId = id(1001), versionId = id(1002);
const query = { materialInstallOperationId };
const artifact = { artifactId: id(1003), sha256: 'a'.repeat(64), name: 'known-tool', version: '1.0.0', bytes: 10, integrity: 'fixed-integrity' };
const host = (n: number) => ({ runner_id: id(n), name: '同名后端', store_id: 'known-store', host_api_major: 1 as const, maintenance_state: 'accepting', harnesses: ['fixture'] });
let rows: ReturnType<typeof host>[]; let calls: { sql: string; args: unknown[] }[];
const client = Object.assign(new EventEmitter(), { query: async (sql: string, args: unknown[] = []) => {
  calls.push({ sql, args });
  if (sql.includes('token_hash')) return { rows: [{ id: id(1) }], rowCount: 1 };
  if (sql.includes('FROM flow.plugin_runtime_hosts h')) return { rows: rows.filter(row => !args[0] || row.runner_id > String(args[0])).slice(0, Number(args[1])), rowCount: rows.length };
  if (sql.includes('plugin_runtime_revisions')) return { rows: [{ desired_enabled: true, target_runner_id: id(1), store_id: 'known-store' }], rowCount: 1 };
  return { rows: [], rowCount: sql.includes('plugin_runtime_hosts') ? 1 : 0 };
}, release: () => undefined }) as unknown as PoolClient;
const pool = { connect: (callback?: (error: Error | null, value: PoolClient, release: () => void) => void) => {
  if (callback) callback(null, client, () => undefined);
  return Promise.resolve(client);
}, query: client.query } as unknown as Pool;
beforeEach(() => {
  vi.clearAllMocks(); calls = []; rows = [host(1), host(2)];
  mock.lock.mockResolvedValue({ maintenance_state: 'accepting', harnesses: ['fixture'] });
  mock.snapshot.mockResolvedValue({ installation: { id: registrationId }, revision: 2, configurationStatus: 'ready', grants: ['tool'], version: { id: versionId, declaredSha256: artifact.sha256, packageName: artifact.name, packageVersion: artifact.version } });
  mock.install.mockResolvedValue({ registration_id: registrationId, version_id: versionId, store_id: 'known-store', status: 'installed', artifact_id: artifact.artifactId, artifact, receipt: { schemaVersion: 1, storeId: 'known-store', installationId: 'b'.repeat(64), treeDigest: 'c'.repeat(64), artifact, manifest: { kind: 'tool', hostApiMajor: 1 } } });
});
test('same readable names retain distinct IDs without claiming liveness or loaded capability', async () => {
  const result = await readPluginHostCandidates(client, registrationId, query, identity => { expect(Object.isFrozen(identity)).toBe(true); return true; });
  expect(result.candidates.map(c => c.runnerId)).toEqual([id(1), id(2)]);
  expect(result.candidates[0]).toMatchObject({ runnerName: '同名后端', selectable: true, reason: 'compatible', online: 'unknown', loaded: 'unknown', callable: 'unknown' });
  expect(result).toMatchObject({ registrationId, currentRevision: 2, versionId, materialInstallOperationId, nextCursor: null });
  expect(pluginHostCandidatesPageSchema.safeParse(result).success).toBe(true);
});
test('trusted incompatible candidates expose finite reasons and revoked records are SQL-excluded', async () => {
  rows = [{ ...host(1), maintenance_state: 'draining' }, { ...host(2), store_id: 'other' }, { ...host(3), harnesses: ['claude'] }];
  const page = await readPluginHostCandidates(client, registrationId, query, () => true);
  expect(page.candidates.map(x => [x.selectable, x.reason])).toEqual([[false, 'maintenance'], [false, 'material-store-mismatch'], [false, 'harness-unsupported']]);
  expect(calls.find(x => x.sql.includes('FROM flow.plugin_runtime_hosts h'))).toMatchObject({ args: [null, 41] });
  expect(calls.at(-1)!.sql).toContain('WHERE NOT r.revoked');
});
test('empty policy-filtered page advances its bounded raw cursor to a later authorized host', async () => {
  rows = Array.from({ length: 42 }, (_, index) => host(index + 1));
  const policy = vi.fn(identity => identity.runnerId === id(41));
  const first = await readPluginHostCandidates(client, registrationId, query, policy);
  expect(first.candidates).toEqual([]); expect(first.nextCursor).not.toBeNull(); expect(policy).toHaveBeenCalledTimes(40);
  const second = await readPluginHostCandidates(client, registrationId, { ...query, cursor: first.nextCursor! }, policy);
  expect(second.candidates.map(x => x.runnerId)).toEqual([id(41)]); expect(second.nextCursor).toBeNull();
});
test('cursor binds registration material and revision; malformed query is rejected', async () => {
  rows = Array.from({ length: 41 }, (_, index) => host(index + 1));
  const first = await readPluginHostCandidates(client, registrationId, query, () => true);
  await expect(readPluginHostCandidates(client, id(2000), { ...query, cursor: first.nextCursor! }, () => true)).rejects.toMatchObject({ code: 'plugin_host_cursor_changed' });
  await expect(readPluginHostCandidates(client, registrationId, { materialInstallOperationId: id(2001), cursor: first.nextCursor! }, () => true)).rejects.toMatchObject({ code: 'plugin_host_cursor_changed' });
  mock.snapshot.mockResolvedValueOnce({ ...(await mock.snapshot()), revision: 3 });
  await expect(readPluginHostCandidates(client, registrationId, { ...query, cursor: first.nextCursor! }, () => true)).rejects.toMatchObject({ code: 'plugin_host_cursor_changed' });
  expect(pluginHostCandidatesQuerySchema.safeParse({ ...query, limit: 1000 }).success).toBe(false);
  await expect(readPluginHostCandidates(client, registrationId, { ...query, cursor: 'abc' }, () => true)).rejects.toMatchObject({ status: 400 });
});
test('foreign stale failed and inconsistent materials disclose no candidates', async () => {
  const original = await mock.install();
  for (const delta of [{ registration_id: id(2000) }, { version_id: id(2001) }, { status: 'failed' }, { store_id: 'wrong-store' }]) {
    mock.install.mockResolvedValueOnce({ ...original, ...delta });
    await expect(readPluginHostCandidates(client, registrationId, query, () => true)).rejects.toMatchObject({ code: 'plugin_material_mismatch' });
  }
  expect(calls).toEqual([]);
});
test('missing or throwing current policy returns no partial page', async () => {
  await expect(readPluginHostCandidates(client, registrationId, query)).rejects.toMatchObject({ status: 403 });
  await expect(readPluginHostCandidates(client, registrationId, query, () => { throw new Error('policy unavailable'); })).rejects.toThrow('policy unavailable');
});
test('trust removed after publication rejects new enable and admission before mutations', async () => {
  const policy = vi.fn(() => false);
  await expect(changePluginRuntime(pool, registrationId, { expectedRevision: 2, reason: 'Enable', change: { kind: 'enable', targetRunnerId: id(1), storeId: 'known-store', materialInstallOperationId } }, 'enable-key', policy)).rejects.toMatchObject({ code: 'plugin_host_not_trusted' });
  await expect(admitPluginToolTask(pool, {} as PgBoss, registrationId, { expectedRevision: 2, title: 'Task', input: 'text' }, 'admit-key', policy)).rejects.toMatchObject({ code: 'plugin_host_not_trusted' });
  expect(policy).toHaveBeenCalledTimes(2); expect(mock.append).not.toHaveBeenCalled(); expect(mock.install).not.toHaveBeenCalled();
  expect(calls.some(c => /INSERT|UPDATE/.test(c.sql))).toBe(false);
});
test('registered route uses real owner role authentication strict query and a no-store read-only transaction', async () => {
  const app = Fastify(); const authentication = await createBrowserSessionAuthentication(pool, { ownerToken: 'owner' });
  app.addHook('preHandler', authentication.authenticate);
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof HttpError ? error.status : 500).send({ code: error instanceof HttpError ? error.code : 'internal' }));
  registerPluginRuntimeRoutes(app, pool, {} as PgBoss, () => true);
  try {
    const url = `/api/plugins/${registrationId}/runtime/hosts?materialInstallOperationId=${materialInstallOperationId}`;
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { authorization: 'Bearer runner' } })).statusCode).toBe(403);
    expect((await app.inject({ url: url + '&limit=999', headers: { authorization: 'Bearer owner' } })).statusCode).toBe(400);
    const response = await app.inject({ url, headers: { authorization: 'Bearer owner' } });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().candidates).toHaveLength(2);
    expect(calls.map(x => x.sql)).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  } finally { await app.close(); }
});

test('incompatible acceptance is rechecked even when the caller skips the candidate page', async () => {
  mock.lock.mockResolvedValueOnce({ maintenance_state: 'accepting', harnesses: ['claude'] });
  await expect(changePluginRuntime(pool, registrationId, { expectedRevision: 2, reason: 'Enable', change: { kind: 'enable', targetRunnerId: id(1), storeId: 'known-store', materialInstallOperationId } }, 'enable-key', () => true)).rejects.toMatchObject({ code: 'plugin_host_unavailable' });
  expect(mock.append).not.toHaveBeenCalled();
});
