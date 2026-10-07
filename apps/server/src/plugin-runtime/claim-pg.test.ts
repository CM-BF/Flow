import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { transaction } from '../database.js';
import { appendPluginRevision, loadInstallation, readSnapshot } from '../plugins/storage.js';
import { PLUGIN_RUNNER_CLAIM_PROTOCOL, decodePluginRunnerClaimResponse } from '../../../../packages/contracts/src/plugin-runner-claim.js';
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
    app = await createServer({ databaseUrl, ownerToken: owner, automaticQueueScan: false, leaseMs: 300_000 });
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
  let counts: { tasks: number; registrations: number } | undefined;
  try { if (closed.every(Boolean)) counts = (await pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.plugin_installations) AS registrations')).rows[0]; }
  catch { facts.push({ kind: 'count-query-failed' }); }
  facts.push({ kind: 'bounded-fixture-counts', counts });
  const result = await databaseFixture.finish({ startup: startupConfirmed,
    server: closed[0] === true, boss: closed[1] === true }, facts);
  expect(counts).toBeDefined();
  if (counts) { expect(counts.tasks).toBeLessThanOrEqual(24); expect(counts.registrations).toBeLessThanOrEqual(8); }
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
// These six groups enter the real authenticated HTTP routes. Metadata setup is not package execution.
const opportunity = (f: { runnerId: string }, requestId = randomUUID(), storeId = 'test-material') => ({
  protocol: PLUGIN_RUNNER_CLAIM_PROTOCOL, runnerId: f.runnerId, requestId,
  pluginToolExecution: { bindingProtocol: PLUGIN_RUNTIME_PROTOCOL, storeId, hostApiMajor: 1 as const },
});
const claimRequest = (f: { token: string }, input: unknown, status = false) =>
  request('/api/runner/claim-opportunity' + (status ? '/status' : ''), input, randomUUID(), f.token);
async function assigned(f: { token: string }, input: ReturnType<typeof opportunity>) {
  const response = await claimRequest(f, input); expect(response.status).toBe(200);
  const body = decodePluginRunnerClaimResponse(response.body, input, 'claim');
  if (body.state !== 'assigned') throw new Error(`Expected assigned, got ${body.state}`);
  return body;
}
async function waitFor(read: () => Promise<boolean>) {
  const end = Date.now() + 3000;
  while (Date.now() < end) { databaseFixture.checkWork(); if (await read()) return; await sleep(15); }
  throw new Error('Bounded PG condition was not observed');
}
async function ready(taskId: string) {
  await waitFor(async () => (await pool.query<{ ready: boolean }>('SELECT dispatch_ready AS ready FROM flow.tasks WHERE id=$1', [taskId])).rows[0]?.ready === true);
}
async function pluginTask(f: Awaited<ReturnType<typeof fixture>>) {
  const { binding } = await bound(f); await ready(binding.taskId); return binding;
}
async function ordinary(f: { runnerId: string }, sessionId = randomUUID()) {
  await pool.query('INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,\'fixture\',$2) ON CONFLICT DO NOTHING', [sessionId, f.runnerId]);
  const result = await request('/api/tasks', { title: 'Ordinary session task', prompt: 'fixture input', harness: 'fixture', resumeSessionId: sessionId });
  expect(result.status).toBe(202); const taskId: string = result.body.task.id; await ready(taskId);
  return { taskId, sessionId };
}
async function releaseFixtureTask(taskId: string) {
  // Controlled terminal setup only; never claimed as a runner artifact or completion event.
  await transaction(pool, async client => {
    await client.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE task_id=$1', [taskId]);
    await client.query("UPDATE flow.tasks SET status='succeeded' WHERE id=$1", [taskId]);
    await client.query('UPDATE flow.sessions SET active_task_id=NULL WHERE active_task_id=$1', [taskId]);
  });
}
async function receiptRows(f: { runnerId: string }, key: string) {
  return (await pool.query('SELECT operation,response FROM flow.commands WHERE operation=ANY($1::text[]) AND key=$2',
    [['flow.runner-claim.v2', PLUGIN_RUNNER_CLAIM_PROTOCOL].map(p => `${p}:${f.runnerId}`), key])).rows;
}
const phase = (binding: PluginToolBinding, attempt: { id: string; ownerVersion: number }) => ({
  bindingId: binding.bindingId, invocationId: binding.invocationId, attemptId: attempt.id, ownerVersion: attempt.ownerVersion, phase: 'load',
});

test('legacy and v2 filter plugin tasks before LIMIT while v3 requires the exact live host', async () => {
  for (const legacy of [true, false]) {
    const f = await enabled(); const binding = await pluginTask(f); const normal = await ordinary(f);
    expect((await request('/api/runner/claim-opportunity', opportunity(f))).status).toBe(403);
    expect((await request('/api/runner/claim-opportunity', opportunity(f), randomUUID(), 'invalid-token')).status).toBe(401);
    const first = legacy ? await request('/api/runner/claim', {}, randomUUID(), f.token)
      : await claimRequest(f, { protocol: 'flow.runner-claim.v2', runnerId: f.runnerId, requestId: randomUUID() });
    expect(first.status).toBe(200); expect(first.body.assignment.task.id).toBe(normal.taskId);
    expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [binding.taskId])).rowCount).toBe(0);
    await releaseFixtureTask(normal.taskId);
    expect((await claimRequest(f, opportunity(f, randomUUID(), 'wrong-store'))).body.state).toBe('empty');
    const badApi = opportunity(f); expect((await claimRequest(f, { ...badApi, pluginToolExecution: { ...badApi.pluginToolExecution, hostApiMajor: 2 } })).status).toBe(400);
    const stranger = await request('/api/runners', { name: 'Other current host', harnesses: ['fixture'], capacity: 1 });
    expect(stranger.status).toBe(200); expect((await claimRequest(stranger.body, opportunity(stranger.body))).body.state).toBe('empty');
    expect((await claimRequest(f, { ...opportunity(f), runnerId: stranger.body.runnerId })).status).toBe(403);
    const got = await assigned(f, opportunity(f)); expect(got.assignment.pluginToolBinding).toEqual(binding);
    expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [binding.taskId])).rowCount).toBe(1);
    facts.push({ kind: 'sql-before-limit', legacy, plugin: binding.taskId, ordinary: normal.taskId, claimed: got.identity });
  }
});

test('concurrent v3 replay is one allocation and conflicts across both protocol namespaces', async () => {
  const f = await enabled(); const binding = await pluginTask(f); const input = opportunity(f);
  const responses = await Promise.all([assigned(f, input), assigned(f, input)]);
  expect(responses[0]!.identity).toEqual(responses[1]!.identity);
  expect((await receiptRows(f, input.requestId))).toEqual([{ operation: `${PLUGIN_RUNNER_CLAIM_PROTOCOL}:${f.runnerId}`, response: responses[0]!.identity }]);
  expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [binding.taskId])).rowCount).toBe(1);
  expect((await claimRequest(f, { protocol: 'flow.runner-claim.v2', runnerId: f.runnerId, requestId: input.requestId })).status).toBe(409);
  expect((await claimRequest(f, opportunity(f, input.requestId, 'changed-store'))).status).toBe(409);
  await releaseFixtureTask(binding.taskId); const normal = await ordinary(f); const reverseKey = randomUUID();
  const old = await claimRequest(f, { protocol: 'flow.runner-claim.v2', runnerId: f.runnerId, requestId: reverseKey });
  expect(old.body.assignment.task.id).toBe(normal.taskId);
  expect((await claimRequest(f, opportunity(f, reverseKey))).status).toBe(409);
  const missing = opportunity(f); expect((await claimRequest(f, missing, true)).body.state).toBe('missing');
  expect(await receiptRows(f, missing.requestId)).toEqual([]);
  facts.push({ kind: 'concurrent-receipt', identity: responses[0]!.identity, namespacesConflictBothDirections: true });
});

test('restart recovers the same pin without renewing its lease and preserves capacity and session fences', async () => {
  const f = await enabled(); const binding = await pluginTask(f); const input = opportunity(f); const first = await assigned(f, input);
  const lease = first.assignment.attempt.leaseExpiresAt;
  const waiting = await ordinary(f);
  expect((await claimRequest(f, opportunity(f))).body.state).toBe('empty');
  await closeApp(); await boss!.stop({ graceful: true, timeout: 5000 }); boss = undefined; await openApp();
  const replay = await claimRequest(f, input, true); expect(replay.status).toBe(200);
  expect(replay.body.identity).toEqual(first.identity); expect(replay.body.assignment.pluginToolBinding).toEqual(binding);
  expect(replay.body.assignment.attempt.leaseExpiresAt).toBe(lease);
  expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [binding.taskId])).rowCount).toBe(1);
  await releaseFixtureTask(binding.taskId); const sessionInput = opportunity(f); const current = await assigned(f, sessionInput);
  expect(current.assignment.task.id).toBe(waiting.taskId);
  const second = await ordinary(f, waiting.sessionId);
  await pool.query('UPDATE flow.runners SET capacity=2 WHERE id=$1', [f.runnerId]);
  expect((await claimRequest(f, opportunity(f))).body.state).toBe('empty');
  expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [second.taskId])).rowCount).toBe(0);
  await pool.query('UPDATE flow.sessions SET active_task_id=NULL WHERE id=$1', [waiting.sessionId]);
  expect((await claimRequest(f, sessionInput, true)).body.state).toBe('unavailable');
  facts.push({ kind: 'restart-and-fences', identity: first.identity, lease, sessionId: waiting.sessionId, listeners: 2 });
});

test('registration lock waiter observes committed grant revocation before creating attempt or receipt', async () => {
  const f = await enabled(); const binding = await pluginTask(f); const input = opportunity(f);
  const blocker = await pool.connect(); let pending: ReturnType<typeof claimRequest> | undefined;
  let primaryFailed = false;
  try {
    await blocker.query('BEGIN'); const blockerPid: number = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const installation = await loadInstallation(blocker, f.registrationId, true); const snapshot = await readSnapshot(blocker, f.registrationId);
    await appendPluginRevision(blocker, installation, { versionId: snapshot.version.id, configuration: snapshot.configuration,
      grants: [], kind: 'set-grants', inputDigest: 'e'.repeat(64) });
    pending = claimRequest(f, input); let waiterPid: number | undefined;
    await waitFor(async () => {
      waiterPid = (await pool.query<{ pid: number }>(`SELECT a.pid FROM pg_stat_activity a WHERE a.datname=$1
        AND a.wait_event_type='Lock' AND a.query LIKE '%FROM flow.plugin_installations WHERE id=$1 FOR UPDATE%'
        AND $2::int=ANY(pg_blocking_pids(a.pid)) AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND NOT l.granted)`, [database, blockerPid])).rows[0]?.pid;
      return waiterPid !== undefined;
    });
    await blocker.query('COMMIT'); const result = await pending; expect(result.status).toBe(409); expect(result.body.error.code).toBe('plugin_claim_unavailable');
    expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [binding.taskId])).rowCount).toBe(0);
    expect(await receiptRows(f, input.requestId)).toEqual([]);
    expect((await pool.query('SELECT 1 FROM flow.sessions WHERE active_task_id=$1', [binding.taskId])).rowCount).toBe(0);
    expect((await claimRequest(f, opportunity(f))).body.state).toBe('empty');
    facts.push({ kind: 'registration-barrier', blockerPid, waiterPid, grantCommitted: true, noAttemptOrReceipt: true });
  } catch (error) {
    primaryFailed = true;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    let rolledBack = false;
    try { await blocker.query('ROLLBACK'); rolledBack = true; } catch (error) { cleanupErrors.push(error); }
    try { blocker.release(!rolledBack); } catch (error) { cleanupErrors.push(error); }
    if (pending) await pending.catch(() => undefined);
    facts.push({ kind: 'barrier-client-closed', rolledBack, primaryFailed,
      cleanupErrors: cleanupErrors.map(error => ({ name: error instanceof Error ? error.name.slice(0, 128) : 'UnknownError' })) });
    // Cleanup is secondary to the original assertion/DB error; without one it must still fail the case.
    if (!primaryFailed && cleanupErrors.length) throw cleanupErrors[0];
  }
});

test('accepted pin survives config and disable but live grant and runner revocation deny recovery and phases', async () => {
  const f = await enabled(); const binding = await pluginTask(f); const input = opportunity(f); const first = await assigned(f, input);
  expect((await f.command(4, { kind: 'configure', values: { prefix: 'v2' } })).status).toBe(200);
  expect((await request(`/api/plugins/${f.registrationId}/runtime/commands`, { expectedRevision: 5, reason: 'No new pins', change: { kind: 'disable' } })).status).toBe(200);
  const replay = await claimRequest(f, input, true); expect(replay.body.assignment.pluginToolBinding).toEqual(binding);
  expect(replay.body.assignment.pluginToolBinding.configuration).toEqual({ prefix: 'v1' });
  const authorization = phase(binding, first.assignment.attempt);
  expect((await request('/api/runner/plugin-tool/authorize', authorization, randomUUID(), f.token)).status).toBe(200);
  expect((await f.command(6, { kind: 'set-grants', capabilities: [] })).status).toBe(200);
  expect((await claimRequest(f, input, true)).body.state).toBe('unavailable');
  expect((await request('/api/runner/plugin-tool/authorize', authorization, randomUUID(), f.token)).status).toBe(403);
  expect((await request(`/api/runners/${f.runnerId}/revoke`, {})).status).toBe(200);
  expect((await claimRequest(f, input, true)).status).toBe(401);
  expect((await request('/api/runner/plugin-tool/authorize', authorization, randomUUID(), f.token)).status).toBe(401);
});

test('saved receipts preserve cancel and maintenance semantics but expire or stale owners are unavailable', async () => {
  const f = await enabled(); const binding = await pluginTask(f); const input = opportunity(f); const first = await assigned(f, input);
  const operationId = randomUUID(); const drain = await request(`/api/runners/${f.runnerId}/maintenance/drain`, { version: 0, operationId, reason: 'Bounded claim test' });
  expect(drain.status).toBe(200); expect(drain.body.state.state).toBe('draining');
  expect((await claimRequest(f, opportunity(f))).body.state).toBe('empty');
  expect((await claimRequest(f, input, true)).body.identity).toEqual(first.identity);
  expect((await request(`/api/tasks/${binding.taskId}/cancel`, {})).status).toBe(200);
  const cancelled = await claimRequest(f, input, true); expect(cancelled.body.state).toBe('assigned');
  expect((await request('/api/runner/plugin-tool/authorize', phase(binding, first.assignment.attempt), randomUUID(), f.token)).status).toBe(409);
  await pool.query('UPDATE flow.tasks SET owner_version=owner_version+1 WHERE id=$1', [binding.taskId]);
  expect((await claimRequest(f, input, true)).body.state).toBe('unavailable');
  await pool.query('UPDATE flow.tasks SET owner_version=$2 WHERE id=$1', [binding.taskId, first.identity.ownerVersion]);
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [first.identity.attemptId]);
  expect((await claimRequest(f, input, true)).body.state).toBe('unavailable');
  expect((await receiptRows(f, input.requestId))[0].response).toEqual(first.identity);
});
