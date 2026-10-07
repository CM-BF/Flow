import { beforeEach, expect, test, vi } from 'vitest';
import Fastify from 'fastify';
import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { pluginRemovalPageSchema, pluginRemovalQuerySchema } from '../../../../packages/contracts/src/plugin-removal.js';
import { readPluginRemovalReferences } from './removal-references.js';
import { registerPluginRuntimeRoutes } from './routes.js';
import { createBrowserSessionAuthentication } from '../browser-session/index.js';
import { HttpError } from '../database.js';
const mock = vi.hoisted(() => ({ registration: vi.fn(), install: vi.fn() }));
vi.mock('../plugins/storage.js', () => ({ loadInstallation: mock.registration, readSnapshot: vi.fn(), appendPluginRevision: vi.fn() }));
vi.mock('../plugin-installations/store.js', () => ({ loadInstall: mock.install }));
vi.mock('../runners.js', () => ({ lockRunner: vi.fn(), ownedAttempt: vi.fn() }));
vi.mock('../tasks.js', () => ({ command: vi.fn(), commandInTransaction: vi.fn(), acceptTask: vi.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const registrationId = id(1000), materialId = id(1001), versionId = id(1002), query = { materialInstallOperationId: materialId };
const row = (n: number, status = 'queued', material = materialId, open: string | null = null) => ({ id: id(n), task_id: id(n + 100), material_install_operation_id: material,
  store_id: 'test-store', material_id: material === materialId ? 'a'.repeat(64) : 'b'.repeat(64), created_at: new Date('2026-10-07T00:00:00.000Z'), cursor_created_at: '2026-10-07T00:00:00.000123Z', status, current_attempt_id: open, open_attempt_id: open });
let rows: ReturnType<typeof row>[]; let calls: { sql: string; args: unknown[] }[];
const client = Object.assign(new EventEmitter(), { query: async (sql: string, args: unknown[] = []) => {
  calls.push({ sql, args });
  if (sql.includes('token_hash')) return { rows: [{ id: id(1) }], rowCount: 1 };
  if (sql.includes('FROM (SELECT')) return { rows: rows.filter(r => !args[2] || r.id > String(args[2])).slice(0, Number(args[3])) };
  return { rows: [], rowCount: 0 };
}, release: () => undefined }) as unknown as PoolClient;
const pool = { connect: (callback?: (error: Error | null, value: PoolClient, release: () => void) => void) => {
  if (callback) callback(null, client, () => undefined); return Promise.resolve(client);
}, query: client.query } as unknown as Pool;
beforeEach(() => {
  vi.clearAllMocks(); calls = []; rows = [row(1)];
  mock.registration.mockResolvedValue({ id: registrationId, revision: 4 });
  mock.install.mockResolvedValue({ id: materialId, registration_id: registrationId, version_id: versionId, store_id: 'test-store', status: 'installed',
    receipt: { storeId: 'test-store', installationId: 'a'.repeat(64) } });
});
test('classifies active uncertain and historical without granting removal or disclosing payloads', async () => {
  rows = [row(1), row(2, 'running', materialId, id(202)), row(3, 'waiting'), row(4, 'cancel_requested'),
    row(5, 'uncertain', materialId, id(205)), row(6, 'cancelled'), row(7, 'succeeded'), row(8, 'failed', materialId, id(208)), row(9, 'future-state')];
  const page = await readPluginRemovalReferences(client, registrationId, query);
  expect(page.references.map(r => r.classification)).toEqual(['active','active','active','active','uncertain','historical','historical','uncertain','uncertain']);
  expect(page.references[7]?.reason).toBe('attempt-unsettled');
  expect(page).toMatchObject({ hostRelease: 'unknown', physicalRemoval: 'not-authorized', consistency: 'independent-page-snapshots' });
  expect(JSON.stringify(page)).not.toMatch(/configuration|token|submission|removeAllowed/);
  expect(pluginRemovalPageSchema.safeParse({ ...page, removeAllowed: true }).success).toBe(false);
});
test('empty material-filtered page advances the bounded raw index cursor', async () => {
  rows = [...Array.from({ length: 40 }, (_, n) => row(n + 1, 'queued', id(999))), row(41)];
  const first = await readPluginRemovalReferences(client, registrationId, query);
  expect(first.references).toEqual([]); expect(first.nextCursor).not.toBeNull();
  const second = await readPluginRemovalReferences(client, registrationId, { ...query, cursor: first.nextCursor! });
  expect(second.references.map(r => r.bindingId)).toEqual([id(41)]); expect(second.nextCursor).toBeNull();
  const scan = calls.find(c => c.sql.includes('FROM (SELECT'))!;
  expect(scan.args).toEqual([registrationId,null,null,41]);
  expect(scan.sql).toContain('ORDER BY created_at,id LIMIT $4');
  expect(scan.sql).toContain('HH24:MI:SS.US');
  expect(calls.filter(c => c.sql.includes('FROM (SELECT'))[1]?.args).toEqual([registrationId,'2026-10-07T00:00:00.000123Z',id(40),41]);
  expect(scan.sql).not.toMatch(/WHERE[^\n]*material_install_operation_id|COUNT\(/);
});
test('historical installed version remains inspectable after selection changes', async () => {
  mock.registration.mockResolvedValue({ id: registrationId, revision: 50 });
  expect(await readPluginRemovalReferences(client, registrationId, query)).toMatchObject({ currentRevision: 50, versionId });
});
test('foreign unsettled and missing receipts fail before reference scan', async () => {
  const original = await mock.install();
  for (const delta of [{ registration_id: id(888) }, { status: 'preparing' }, { status: 'unknown' }, { receipt: null }, { store_id: 'other' }]) {
    mock.install.mockResolvedValueOnce({ ...original, ...delta });
    await expect(readPluginRemovalReferences(client, registrationId, query)).rejects.toMatchObject({ code: 'plugin_removal_material_mismatch' });
  }
  expect(calls).toEqual([]);
});
test('cursor query identity and registration revision cannot be changed', async () => {
  rows = Array.from({ length: 41 }, (_, n) => row(n + 1));
  const first = await readPluginRemovalReferences(client, registrationId, query);
  mock.registration.mockResolvedValueOnce({ id: registrationId, revision: 5 });
  await expect(readPluginRemovalReferences(client, registrationId, { ...query, cursor: first.nextCursor! })).rejects.toMatchObject({ status: 409 });
  mock.install.mockResolvedValueOnce({ ...await mock.install(), id: id(998) });
  await expect(readPluginRemovalReferences(client, registrationId, { materialInstallOperationId: id(998), cursor: first.nextCursor! })).rejects.toMatchObject({ status: 409 });
  await expect(readPluginRemovalReferences(client, registrationId, { ...query, cursor: 'abc' })).rejects.toMatchObject({ status: 400 });
  expect(pluginRemovalQuerySchema.safeParse({ ...query, limit: 999 }).success).toBe(false);
});
test('empty observation still cannot certify host release', async () => {
  rows = []; const page = await readPluginRemovalReferences(client, registrationId, query);
  expect(page).toMatchObject({ references: [], nextCursor: null, hostRelease: 'unknown', physicalRemoval: 'not-authorized' });
});
test('owner route preserves authentication strict query and read-only no-store transaction', async () => {
  const app = Fastify(); const auth = await createBrowserSessionAuthentication(pool, { ownerToken: 'owner' });
  app.addHook('preHandler', auth.authenticate);
  app.setErrorHandler((e, _req, reply) => reply.code(e instanceof HttpError ? e.status : 500).send({ code: e instanceof HttpError ? e.code : 'internal' }));
  registerPluginRuntimeRoutes(app, pool, {} as PgBoss, () => true);
  try {
    const url = `/api/plugins/${registrationId}/removal-references?materialInstallOperationId=${materialId}`;
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { authorization: 'Bearer runner' } })).statusCode).toBe(403);
    expect((await app.inject({ url: url + '&limit=10', headers: { authorization: 'Bearer owner' } })).statusCode).toBe(400);
    const response = await app.inject({ url, headers: { authorization: 'Bearer owner' } });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().references).toHaveLength(1);
    expect(calls.map(c => c.sql)).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(calls.some(c => /INSERT|UPDATE|DELETE/.test(c.sql))).toBe(false);
  } finally { await app.close(); }
});

test('different install operation aliases of the same physical material remain visible', async () => {
  rows = [{ ...row(1), material_install_operation_id: id(888) }];
  expect((await readPluginRemovalReferences(client, registrationId, query)).references[0]).toMatchObject({ materialInstallOperationId: id(888) });
});
