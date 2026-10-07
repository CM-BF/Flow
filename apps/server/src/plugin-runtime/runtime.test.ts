import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { transaction } from '../database.js';
import { PLUGIN_RUNTIME_PROTOCOL, type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import { migratePluginRuntime, publishPluginHost, type TrustedPluginHostPolicy } from './store.js';
import { registerPluginRuntimeRoutes } from './routes.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01/enable-binding-pg-fixture.js';

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
    capabilities: ['tool'], publicConfiguration: [{ key: 'prefix', kind: 'enum', required: true, values: ['v1:', 'v2:'] }] } });
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
  expect((await command(1, { kind: 'configure', values: { prefix: 'v1:' } })).status).toBe(200);
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

test('host publication requires an exact operator tuple before the first immutable insert', async () => {
  const runner = await request('/api/runners', { name: 'Publication policy host', harnesses: ['fixture'], capacity: 1 });
  expect(runner.status).toBe(200);
  const runnerId: string = runner.body.runnerId; const token: string = runner.body.token;
  const publication = { protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'operator-material', hostApiMajor: 1 } as const;
  const absent = async () => expect((await pool.query('SELECT 1 FROM flow.plugin_runtime_hosts WHERE runner_id=$1', [runnerId])).rowCount).toBe(0);
  await expect(publishPluginHost(pool, runnerId, publication)).rejects.toMatchObject({ status: 403, code: 'plugin_host_not_trusted' });
  await absent();
  expect((await request('/api/runner/plugin-host', publication, randomUUID(), token)).status).toBe(403);
  await absent();
  trustedHosts.add(hostKey(runnerId, publication.storeId, publication.hostApiMajor));
  expect((await request('/api/runner/plugin-host', { ...publication, storeId: 'wrong-first-store' }, randomUUID(), token)).status).toBe(403);
  await absent();
  expect((await request('/api/runner/plugin-host', publication, randomUUID(), token)).status).toBe(200);
  expect((await pool.query('SELECT store_id,host_api_major FROM flow.plugin_runtime_hosts WHERE runner_id=$1', [runnerId])).rows).toEqual([{ store_id: publication.storeId, host_api_major: 1 }]);
  expect((await request('/api/runner/plugin-host', publication, randomUUID(), token)).status).toBe(200);
});
test('enable advances the same revision, preserves old operation readback and replays the original receipt', async () => {
  const f = await fixture(); const path = `/api/plugins/${f.registrationId}/runtime/commands`; const key = randomUUID();
  const result = await request(path, f.enable, key);
  expect(result.status).toBe(200); expect(result.body).toMatchObject({ snapshot: { revision: 4, configuration: { prefix: 'v1:' }, grants: ['tool'] }, operation: { kind: 'enable', beforeRevision: 3, afterRevision: 4 }, runtime: { bindingAllowed: true, loaded: 'unknown', callable: 'unknown' } });
  expect((await request(path, f.enable, key)).body).toEqual({ ...result.body, replayed: true });
  expect((await request(path, { ...f.enable, reason: 'Different' }, key)).status).toBe(409);
  const disabled = await request(path, { expectedRevision: 4, reason: 'No new tasks', change: { kind: 'disable' } });
  expect(disabled.body).toMatchObject({ snapshot: { revision: 5 }, operation: { kind: 'disable' }, runtime: { bindingAllowed: false, desiredEnabled: false } });
  const operations = (await request(`/api/plugins/${f.registrationId}/operations`)).body.operations;
  expect(operations.map((row: { kind: string }) => row.kind).sort()).toEqual(['configure', 'disable', 'enable', 'register', 'set-grants']);
  expect((await request(`/api/plugins/${f.registrationId}`)).body.installation.runtimeStatus).toBe('unavailable');
});
test('owner and runner roles, exact host/store/material and strict public bodies reject without revision changes', async () => {
  const f = await fixture(); const other = await fixture(); const path = `/api/plugins/${f.registrationId}/runtime/commands`;
  expect((await request(path, f.enable, randomUUID(), f.token)).status).toBe(403);
  expect((await request('/api/runner/plugin-host', { protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'test-material', hostApiMajor: 1 })).status).toBe(403);
  for (const change of [{ ...f.enable.change, materialInstallOperationId: other.materialId }, { ...f.enable.change, storeId: 'another' }]) expect((await request(path, { ...f.enable, change })).status).toBe(409);
  expect((await request(path, { ...f.enable, root: '/private' })).status).toBe(400);
  for (const invalid of ['\0', '\ud800', '\udc00']) {
    expect((await request(path, { ...f.enable, reason: invalid })).status).toBe(400);
    const body = { expectedRevision: 3, title: 'Tool', input: 'input' };
    for (const value of [{ ...body, input: invalid }, { ...body, title: 'title' + invalid }, { ...body, verification: { kind: 'contains', expected: invalid } }]) {
      expect((await request(`/api/plugins/${f.registrationId}/tool-tasks`, value)).status).toBe(400);
    }
  }
  expect((await request(`/api/plugins/${f.registrationId}`)).body.revision).toBe(3);
});
test('configuration changes invalidate new bindings while an accepted binding and original key survive disable and restart', async () => {
  const f = await enabled(); const input = { expectedRevision: 4, title: 'Frozen task', input: 'before' }; const key = randomUUID(); const path = `/api/plugins/${f.registrationId}/tool-tasks`;
  const accepted = await request(path, input, key); expect(accepted.status).toBe(201);
  const binding = accepted.body.binding;
  expect((await f.command(4, { kind: 'configure', values: { prefix: 'v2:' } })).status).toBe(200);
  expect((await request(`/api/plugins/${f.registrationId}/runtime`)).body).toMatchObject({ currentRevision: 5, enabledRevision: 4, bindingAllowed: false, reason: 'revision-changed' });
  expect((await request(path, { ...input, expectedRevision: 5 })).status).toBe(409);
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, { expectedRevision: 5, reason: 'Stop new binding', change: { kind: 'disable' } })).status).toBe(200);
  await closeApp(); await boss!.stop({ graceful: true, timeout: 5000 }); await openApp();
  expect((await request(path, input, key)).body).toEqual({ ...accepted.body, replayed: true });
  const read = await request(`/api/tasks/${binding.taskId}/plugin-binding`);
  expect(read.body).toEqual(binding); expect(read.headers.get('cache-control')).toBe('no-store'); expect(read.body.configuration).toEqual({ prefix: 'v1:' });
});
test('phase replay rechecks grant/fence and changing key cannot authorize a second package action', async () => {
  const f = await enabled(); const { binding } = await bound(f); const identity = await active(f, binding); const path = '/api/runner/plugin-tool/authorize'; const key = randomUUID();
  const load = { ...identity, phase: 'load' };
  expect((await request(path, { ...identity, phase: 'invoke' }, randomUUID(), f.token)).status).toBe(409);
  const first = await request(path, load, key, f.token); expect(first.body).toMatchObject({ replayed: false, authorizedRevision: 4 });
  expect((await request(path, load, key, f.token)).body).toEqual({ ...first.body, replayed: true });
  expect((await request(path, load, randomUUID(), f.token)).body.replayed).toBe(true);
  expect((await f.command(4, { kind: 'set-grants', capabilities: [] })).status).toBe(200);
  expect((await request(path, load, key, f.token)).status).toBe(403);
  expect((await request(path, { ...identity, phase: 'invoke' }, randomUUID(), f.token)).status).toBe(403);
  expect((await pool.query('SELECT 1 FROM flow.plugin_tool_authorizations WHERE binding_id=$1', [binding.bindingId])).rowCount).toBe(1);
});
test('disable preserves accepted pin permission, maintenance drains, and cancellation/expired/stale/revoked fences reject', async () => {
  const f = await enabled(); const { binding } = await bound(f); const identity = await active(f, binding); const path = '/api/runner/plugin-tool/authorize';
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, { expectedRevision: 4, reason: 'No new binding', change: { kind: 'disable' } })).status).toBe(200);
  await pool.query("UPDATE flow.runners SET maintenance_state='draining' WHERE id=$1", [f.runnerId]);
  expect((await request(path, { ...identity, phase: 'load' }, randomUUID(), f.token)).status).toBe(200);
  expect((await request(path, { ...identity, phase: 'invoke', ownerVersion: 2 }, randomUUID(), f.token)).status).toBe(409);
  await pool.query("UPDATE flow.tasks SET status='cancel_requested' WHERE id=$1", [binding.taskId]);
  expect((await request(path, { ...identity, phase: 'invoke' }, randomUUID(), f.token)).status).toBe(409);
  await pool.query("UPDATE flow.tasks SET status='running' WHERE id=$1", [binding.taskId]);
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [identity.attemptId]);
  expect((await request(path, { ...identity, phase: 'invoke' }, randomUUID(), f.token)).status).toBe(409);
  await pool.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [f.runnerId]);
  expect((await request(path, { ...identity, phase: 'load' }, randomUUID(), f.token)).status).toBe(401);
});
test('binding constraint failure rolls back task and command, and immutable rows reject edits', async () => {
  const f = await enabled(); const before = (await pool.query('SELECT count(*)::int AS count FROM flow.tasks')).rows[0].count;
  await pool.query(`CREATE FUNCTION flow.x01_reject_binding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END; $$;
    CREATE TRIGGER x01_reject_binding BEFORE INSERT ON flow.plugin_tool_bindings FOR EACH ROW EXECUTE FUNCTION flow.x01_reject_binding()`);
  const key = randomUUID();
  try { expect((await request(`/api/plugins/${f.registrationId}/tool-tasks`, { expectedRevision: 4, title: 'Rollback', input: 'input' }, key)).status).toBe(500); }
  finally { await pool.query('DROP TRIGGER x01_reject_binding ON flow.plugin_tool_bindings; DROP FUNCTION flow.x01_reject_binding()'); }
  expect((await pool.query('SELECT count(*)::int AS count FROM flow.tasks')).rows[0].count).toBe(before);
  expect((await pool.query('SELECT 1 FROM flow.commands WHERE operation=$1 AND key=$2', [`plugin.tool-task:${f.registrationId}`, key])).rowCount).toBe(0);
  const { binding } = await bound(f);
  await expect(pool.query("UPDATE flow.plugin_tool_bindings SET configuration='{}' WHERE id=$1", [binding.bindingId])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.plugin_runtime_hosts WHERE runner_id=$1', [f.runnerId])).rejects.toMatchObject({ code: '23514' });
  expect((await request(`/api/tasks/${binding.taskId}/plugin-binding`)).body).toEqual(binding);
});

test.each(['registration-first', 'command-first', 'command-replay'] as const)('lease expiry while waiting for %s rolls back positive authority, including cached replay', async gate => {
  const f = await enabled(); const { binding } = await bound(f); const identity = await active(f, binding);
  const input = { ...identity, phase: 'load' }; const key = randomUUID(); const operation = `plugin.tool-phase:${f.runnerId}`;
  const path = '/api/runner/plugin-tool/authorize';
  if (gate === 'command-replay') expect((await request(path, input, key, f.token)).body.replayed).toBe(false);
  const blocker = await pool.connect(); let pending: ReturnType<typeof request> | undefined;
  const waitUntil = async (read: () => Promise<boolean>) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) { databaseFixture.checkWork(); if (await read()) return; await sleep(15); }
    throw new Error('Owned lock-wait condition was not observed');
  };
  try {
    await blocker.query('BEGIN');
    if (gate === 'registration-first') await blocker.query('SELECT 1 FROM flow.plugin_installations WHERE id=$1 FOR UPDATE', [f.registrationId]);
    else await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([operation, key])]);
    const originalLease = (await pool.query<{ lease_expires_at: Date }>("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1 RETURNING lease_expires_at", [identity.attemptId])).rows[0]!.lease_expires_at;
    pending = request(path, input, key, f.token);
    const pattern = gate === 'registration-first' ? '%FROM flow.plugin_installations WHERE id=$1 FOR UPDATE%' : '%pg_advisory_xact_lock%';
    let blockedPid: number | undefined;
    await waitUntil(async () => {
      blockedPid = (await pool.query<{ pid: number }>(`SELECT a.pid FROM pg_stat_activity a WHERE a.datname=$1 AND a.application_name='flow-x01-binding'
        AND a.wait_event_type='Lock' AND a.query LIKE $2 AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND NOT l.granted)`, [database, pattern])).rows[0]?.pid;
      return blockedPid !== undefined;
    });
    await waitUntil(async () => (await pool.query<{ expired: boolean }>('SELECT $1::timestamptz<=clock_timestamp() AS expired', [originalLease])).rows[0]!.expired);
    await blocker.query('COMMIT');
    const result = await pending; expect(result.status).toBe(409); expect(result.body.error.code).toBe('plugin_attempt_inactive');
    const expected = gate === 'command-replay' ? 1 : 0;
    expect((await pool.query('SELECT 1 FROM flow.plugin_tool_authorizations WHERE binding_id=$1', [binding.bindingId])).rowCount).toBe(expected);
    expect((await pool.query('SELECT 1 FROM flow.commands WHERE operation=$1 AND key=$2', [operation, key])).rowCount).toBe(expected);
    facts.push({ kind: 'lease-expired-under-lock', gate, blockedPid, originalLease: originalLease.toISOString(), observedWait: true,
      committedPositiveRows: expected, replayWasPreexisting: gate === 'command-replay' });
  } finally {
    const rolledBack = await blocker.query('ROLLBACK').then(() => true, () => false);
    blocker.release(!rolledBack);
    facts.push({ kind: 'owned-lock-client-release', gate, rolledBack, destroyed: !rolledBack });
    if (pending) await pending.catch(() => undefined);
    expect(rolledBack).toBe(true);
  }
});
