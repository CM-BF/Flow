import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { transaction } from '../database.js';
import { PLUGIN_RUNTIME_PROTOCOL, type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import { migratePluginRuntime, publishPluginHost, type TrustedPluginHostPolicy } from './store.js';
import { registerPluginRuntimeRoutes } from './routes.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01-removal-references/enable-binding-pg-fixture.js';

const databaseFixture = new PluginDatabaseFixture('runtime', 4);
const { database, databaseUrl, pool } = databaseFixture;
const owner = `x01-${randomUUID()}`;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let boss: PgBoss | undefined; let base = ''; let startupConfirmed = true;
const facts: Record<string, unknown>[] = [];
const trustedHosts = new Set<string>();
const hostKey = (runnerId: string, storeId: string, hostApiMajor: number) => JSON.stringify([runnerId, storeId, hostApiMajor]);
const trustedHostPolicy: TrustedPluginHostPolicy = identity => {
  expect(Object.isFrozen(identity)).toBe(true);
  return identity.protocol === PLUGIN_RUNTIME_PROTOCOL && trustedHosts.has(hostKey(identity.runnerId, identity.storeId, identity.hostApiMajor));
};
async function request(path: string, body?: unknown, key = randomUUID(), token = owner) {
  return databaseFixture.request(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
async function openApp() {
  startupConfirmed = false;
  await databaseFixture.start(async () => {
    app = await createServer({ databaseUrl, ownerToken: owner, automaticQueueScan: false });
    await migratePluginRuntime(pool);
    // A real PgBoss client without another worker; createServer retains its existing task worker.
    boss = new PgBoss({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 1500 });
    boss.on('error', () => { facts.push({ kind: 'send-client-error' }); });
    await boss.start();
    registerPluginRuntimeRoutes(app, pool, boss, trustedHostPolicy);
    base = await app.listen({ host: '127.0.0.1', port: 0 });
    databaseFixture.listener(base); startupConfirmed = true;
  });
}
async function closeApp() {
  await app?.close();
  if (app?.server.listening) throw new Error('X01 server is still listening');
  if (base) databaseFixture.listenerClosed(base);
  base = '';
  app = undefined;
}
beforeAll(async () => {
  await databaseFixture.create();
  await openApp();
}, 30_000);
afterAll(async () => {
  const settled = await databaseFixture.settleStartup();
  const closed = settled ? await Promise.all([databaseFixture.close('server-close', closeApp),
    databaseFixture.close('boss-close', () => boss?.stop({ graceful: true, timeout: 5000 }) ?? Promise.resolve())]) : [false, false];
  const result = await databaseFixture.finish({ startup: startupConfirmed,
    server: closed[0] === true, boss: closed[1] === true }, facts);
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errors: [],
    cleanup: { ownersClosed: true, poolClosed: true, adminClosed: true, identityConfirmed: true,
      connections: 0, dropAcknowledged: true, databaseAbsent: true } });
}, 60_000);

/** Synthetic terminal material metadata exercises the real SQL source chain; no download/load is claimed here. */
async function fixture() {
  const name = `flow-binding-${randomUUID()}`;
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64), license: 'MIT', hostApiMajor: 1,
    capabilities: ['tool'], publicConfiguration: [{ key: 'prefix', kind: 'enum', required: true, values: ['v1', 'v2'] }] } });
  expect(registered.status).toBe(201);
  const registrationId: string = registered.body.snapshot.installation.id; const versionId: string = registered.body.snapshot.version.id;
  const runner = await request('/api/runners', { name: 'Plugin test host', harnesses: ['fixture'], capacity: 1 });
  expect(runner.status).toBe(200);
  const runnerId: string = runner.body.runnerId; const token: string = runner.body.token;
  trustedHosts.add(hostKey(runnerId, 'test-material', 1));
  expect((await request('/api/runner/plugin-host', { protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'test-material', hostApiMajor: 1 }, randomUUID(), token)).status).toBe(200);
  const materialId = randomUUID(); const fetchId = randomUUID(); const fetchAttempt = randomUUID(); const artifactId = randomUUID();
  const artifact = { artifactId, name, version: '1.0.0', bytes: 123, sha256: 'a'.repeat(64), integrity: 'sha512-' + 'a'.repeat(86) + '==',
    format: 'npm-tarball', verifiedAt: new Date().toISOString(), source: { registry: 'http://127.0.0.1:1/', tarball: 'http://127.0.0.1:1/test.tgz' } };
  const { format: _format, verifiedAt: _verified, source: _source, ...identity } = artifact;
  const receipt = { schemaVersion: 1, installationId: 'b'.repeat(64), storeId: 'test-material', artifact: identity,
    manifest: { schemaVersion: 1, hostApiMajor: 1, kind: 'tool', entrypoint: 'index.mjs' }, files: [], treeDigest: 'c'.repeat(64) };
  await transaction(pool, async client => {
    await client.query(`INSERT INTO flow.plugin_package_fetches(id,installation_id,version_id,admitted_revision,package_name,package_version,expected_sha256,
      integrity,store_id,registry_ref,registry_url,current_attempt_id) VALUES($1,$2,$3,1,$4,'1.0.0',$5,$6,'test-artifacts','own','http://127.0.0.1:1/',$7)`,
    [fetchId, registrationId, versionId, name, artifact.sha256, artifact.integrity, fetchAttempt]);
    await client.query(`INSERT INTO flow.plugin_package_fetch_attempts(id,operation_id,ordinal,artifact_id,status,artifact) VALUES($1,$2,1,$3,'succeeded',$4)`, [fetchAttempt, fetchId, artifactId, JSON.stringify(artifact)]);
    await client.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,
      artifact_id,artifact_store_id,store_id,artifact,input_digest,status,execution_id,receipt) VALUES($1,$2,$3,1,$4,$5,$6,'test-artifacts','test-material',$7,$8,'installed',$9,$10)`,
    [materialId, registrationId, versionId, fetchId, fetchAttempt, artifactId, JSON.stringify(artifact), 'd'.repeat(64), randomUUID(), JSON.stringify(receipt)]);
  });
  const command = async (expectedRevision: number, change: unknown) => request(`/api/plugins/${registrationId}/commands`, { expectedRevision, reason: 'Fixture registry change', change });
  expect((await command(1, { kind: 'configure', values: { prefix: 'v1' } })).status).toBe(200);
  expect((await command(2, { kind: 'set-grants', capabilities: ['tool'] })).status).toBe(200);
  const enable = { expectedRevision: 3, reason: 'Enable exact material', change: { kind: 'enable', materialInstallOperationId: materialId, targetRunnerId: runnerId, storeId: 'test-material' } };
  return { registrationId, versionId, runnerId, token, materialId, enable, command };
}
async function enabled() {
  const f = await fixture(); const result = await request(`/api/plugins/${f.registrationId}/runtime/commands`, f.enable);
  expect(result.status).toBe(200); return f;
}
async function bound(f: Awaited<ReturnType<typeof fixture>>) {
  const input = { expectedRevision: 4, title: 'Bound tool task', input: '1.0.0 2.0.0', verification: { kind: 'nonempty' } };
  const result = await request(`/api/plugins/${f.registrationId}/tool-tasks`, input);
  expect(result.status).toBe(201); return { input, binding: result.body.binding as PluginToolBinding };
}
async function active(f: Awaited<ReturnType<typeof fixture>>, binding: PluginToolBinding) {
  const attemptId = randomUUID();
  await transaction(pool, async client => {
    await client.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '1 hour')`, [attemptId, binding.taskId, f.runnerId]);
    await client.query("UPDATE flow.tasks SET status='running',owner_version=1,current_attempt_id=$2 WHERE id=$1", [binding.taskId, attemptId]);
  });
  return { attemptId, ownerVersion: 1, bindingId: binding.bindingId, invocationId: binding.invocationId };
}

test('removal references preserve bounded material aliases uncertain pins and immutable history', async () => {
  const f = await fixture();
  // Second synthetic material belongs to the same registration; no package filesystem is touched.
  const other = randomUUID();
  await pool.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,
    artifact_id,artifact_store_id,store_id,artifact,input_digest,status,execution_id,receipt)
    SELECT $2,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,artifact_id,artifact_store_id,store_id,artifact,
    input_digest,status,$3,jsonb_set(receipt,'{installationId}',to_jsonb($4::text)) FROM flow.plugin_material_installs WHERE id=$1`,
    [f.materialId, other, randomUUID(), 'e'.repeat(64)]);
  const otherEnable = { ...f.enable, change: { ...f.enable.change, materialInstallOperationId: other } };
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, otherEnable)).status).toBe(200);
  for (let n = 0; n < 40; n++) { databaseFixture.checkWork(); await bound(f); }
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, { ...f.enable, expectedRevision: 4 })).status).toBe(200);
  const bind = async () => {
    const response = await request(`/api/plugins/${f.registrationId}/tool-tasks`, { expectedRevision: 5, title: 'Retained reference', input: 'synthetic-ref' });
    expect(response.status).toBe(201); return response.body.binding as PluginToolBinding;
  };
  const queued = await bind(), uncertain = await bind(), historical = await bind();
  const owned = await active(f, uncertain);
  await pool.query("UPDATE flow.tasks SET status='uncertain' WHERE id=$1", [uncertain.taskId]);
  await pool.query("UPDATE flow.tasks SET status='cancelled' WHERE id=$1", [historical.taskId]);
  const before = (await pool.query('SELECT id,receipt,status FROM flow.plugin_material_installs WHERE registration_id=$1 ORDER BY id', [f.registrationId])).rows;
  const path = `/api/plugins/${f.registrationId}/removal-references?materialInstallOperationId=${f.materialId}`;
  expect((await databaseFixture.request(base + path, { method: 'GET' })).status).toBe(401);
  expect((await request(path, undefined, randomUUID(), f.token)).status).toBe(403);
  const first = await request(path);
  expect(first.status).toBe(200); expect(first.body.references).toEqual([]); expect(first.body.nextCursor).toBeTruthy();
  const second = await request(path + '&cursor=' + first.body.nextCursor);
  expect(second.status).toBe(200); expect(second.body.nextCursor).toBeNull();
  expect(second.body.references.map((r: { classification: string }) => r.classification).sort()).toEqual(['active','historical','uncertain']);
  expect(second.body).toMatchObject({ hostRelease: 'unknown', physicalRemoval: 'not-authorized', coverage: 'registration-tool-task-bindings' });
  expect(second.raw).not.toMatch(/synthetic-ref|configuration|token|removeAllowed/);
  expect((await request(`/api/tasks/${queued.taskId}/plugin-binding`)).body.bindingId).toBe(queued.bindingId);
  expect((await request(`/api/tasks/${historical.taskId}/plugin-binding`)).body.bindingId).toBe(historical.bindingId);
  expect((await pool.query('SELECT id,receipt,status FROM flow.plugin_material_installs WHERE registration_id=$1 ORDER BY id', [f.registrationId])).rows).toEqual(before);
  expect((await pool.query('SELECT completed_at FROM flow.attempts WHERE id=$1', [owned.attemptId])).rows[0].completed_at).toBeNull();
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, { expectedRevision: 5, reason: 'Disable preserves references', change: { kind: 'disable' } })).status).toBe(200);
  expect((await request(path + '&cursor=' + first.body.nextCursor)).status).toBe(409);
  expect((await request(`/api/plugins/${f.registrationId}/operations`)).status).toBe(200);
}, 60_000);
