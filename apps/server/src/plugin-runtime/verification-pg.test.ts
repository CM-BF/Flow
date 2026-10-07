import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PoolClient } from 'pg';
import { FlowClient } from '@flow/client';
import { createServer } from '../index.js';
import { createServer as createPre036Server } from '@av03/pre036-server';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01-artifact-verifier/av03-pg/fixture.js';
import { sha256, transaction } from '../database.js';
import { recordBinding } from './store.js';
import { migratePluginVerification } from './verification.js';
import { appendPluginRevision, loadInstallation, readSnapshot } from '../plugins/storage.js';
import type { PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import type { VerifierRunnerClaimRequest } from '../../../../packages/contracts/src/verifier-runner-claim.js';

const fixture = new PluginDatabaseFixture('runtime', 4), pool = fixture.pool;
const owner = randomUUID(), project = randomUUID();
let app: Awaited<ReturnType<typeof createServer>> | undefined, base = '', startup = true;
let http = 0, bytes = 0;
const facts: unknown[] = [];
const rule = { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['id'] };
const cap = { bindingProtocol: 'flow.plugin-verification.v1' as const, storeId: 'av03-material', hostApiMajor: 1 as const, algorithms: [{ id: rule.algorithmId, version: 1 as const }] };
const toolCap = { bindingProtocol: 'flow.plugin-runtime.v1' as const, storeId: cap.storeId, hostApiMajor: 1 as const };
async function request(path: string, body?: unknown, token: string = owner) {
  return fixture.request(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function openApp(prior = false) {
  startup = false;
  await fixture.stage(prior ? 'baseline-start' : 'current-start');
  await fixture.start(async () => {
    app = await (prior ? createPre036Server : createServer)({ databaseUrl: fixture.databaseUrl, ownerToken: owner, leaseMs: 300000, automaticQueueScan: false,
      pluginRuntimeHostPolicy: () => true });
    app.addHook('onRequest', async () => { fixture.checkWork(); if (++http > 160) throw Error('HTTP count bound'); });
    app.addHook('onSend', async (_req, _reply, payload) => {
      const size = typeof payload === 'string' ? Buffer.byteLength(payload) : Buffer.isBuffer(payload) ? payload.length : 0;
      if (size > 131072 || (bytes += size) > 4194304) throw Error('Response bound'); return payload;
    });
    base = await app.listen({ host: '127.0.0.1', port: 0 }); fixture.listener(base); startup = true;
  });
  await fixture.stage(prior ? 'baseline-ready' : 'current-ready');
}
async function closeApp() {
  if (!app) return;
  await app.close(); if (app.server.listening) throw Error('Listener still active');
  fixture.listenerClosed(base); app = undefined; base = '';
}
async function runner() {
  const r = await request('/api/runners', { name: 'Verifier PG host', harnesses: ['fixture'], capacity: 8 }); expect(r.status).toBe(200);
  expect((await request('/api/runner/plugin-host', { protocol: toolCap.bindingProtocol, storeId: cap.storeId, hostApiMajor: 1 }, r.body.token)).status).toBe(200);
  return { id: r.body.runnerId as string, token: r.body.token as string };
}
type Host = Awaited<ReturnType<typeof runner>>;
async function task(client: PoolClient, prompt = 'ordinary', status = 'queued') {
  const id = randomUUID();
  await client.query('INSERT INTO flow.tasks(id,submission,status,dispatch_ready) VALUES($1,$2,$3,true)', [id, JSON.stringify({ title: 'AV03 controlled task', harness: 'fixture', prompt }), status]);
  await client.query('INSERT INTO flow.project_task_bindings(task_id,project_id,node_id) VALUES($1,$2,$3)', [id, project, randomUUID()]);
  return id;
}
/** Controlled installed terminal metadata, not a package download/import/invoke. */
async function material(kind: 'tool' | 'verifier', host: Host) {
  const name = 'av03-' + randomUUID();
  const r = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: project }, version: { packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64), license: 'ISC', hostApiMajor: 1, capabilities: [kind], publicConfiguration: [] } });
  expect(r.status).toBe(201); const registration = r.body.snapshot.installation.id as string, version = r.body.snapshot.version.id as string;
  expect((await request(`/api/plugins/${registration}/commands`, { expectedRevision: 1, reason: 'Controlled grant', change: { kind: 'set-grants', capabilities: [kind] } })).status).toBe(200);
  const install = randomUUID(), fetch = randomUUID(), attempt = randomUUID(), artifactId = randomUUID();
  const artifact = { artifactId, name, version: '1.0.0', bytes: 123, sha256: 'a'.repeat(64), integrity: 'sha512-' + 'a'.repeat(86) + '==' };
  const full = { ...artifact, format: 'npm-tarball', verifiedAt: new Date().toISOString(), source: { registry: 'http://127.0.0.1:1/', tarball: 'http://127.0.0.1:1/fixture.tgz' } };
  const receipt = { schemaVersion: 1, installationId: 'b'.repeat(64), storeId: cap.storeId, artifact, manifest: { schemaVersion: 1, hostApiMajor: 1, kind, entrypoint: 'index.mjs' }, files: [], treeDigest: 'c'.repeat(64) };
  await transaction(pool, async c => {
    await c.query(`INSERT INTO flow.plugin_package_fetches(id,installation_id,version_id,admitted_revision,package_name,package_version,expected_sha256,integrity,store_id,registry_ref,registry_url,current_attempt_id) VALUES($1,$2,$3,1,$4,'1.0.0',$5,$6,'artifacts','own','http://127.0.0.1:1/',$7)`, [fetch, registration, version, name, artifact.sha256, artifact.integrity, attempt]);
    await c.query(`INSERT INTO flow.plugin_package_fetch_attempts(id,operation_id,ordinal,artifact_id,status,artifact) VALUES($1,$2,1,$3,'succeeded',$4)`, [attempt, fetch, artifactId, JSON.stringify(full)]);
    await c.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,artifact_id,artifact_store_id,store_id,artifact,input_digest,status,execution_id,receipt) VALUES($1,$2,$3,1,$4,$5,$6,'artifacts',$7,$8,$9,'installed',$10,$11)`, [install, registration, version, fetch, attempt, artifactId, cap.storeId, JSON.stringify(full), 'd'.repeat(64), randomUUID(), JSON.stringify(receipt)]);
    await c.query(`INSERT INTO flow.plugin_runtime_revisions(registration_id,revision,version_id,desired_enabled,material_install_operation_id,target_runner_id,store_id,host_api_major) VALUES($1,2,$2,true,$3,$4,$5,1)`, [registration, version, install, host.id, cap.storeId]);
  });
  return { registration, version, install, host, artifact, kind };
}
type Material = Awaited<ReturnType<typeof material>>;
async function binding(c: PoolClient, m: Material, options: { reference?: boolean; wrongAttempt?: boolean; badTree?: boolean } = {}) {
  let source: { taskId: string; attemptId: string; artifactId: string; version: string; content: string } | undefined;
  if (m.kind === 'verifier') {
    const sid = await task(c, 'saved source', 'succeeded'), attempt = randomUUID(), detail = randomUUID(), content = '{"id":1}';
    await c.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at) VALUES($1,$2,$3,1,clock_timestamp(),clock_timestamp())', [attempt, sid, m.host.id]);
    await c.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type,artifact_version) VALUES($1,$2,$3,'Source','artifact',$4,'application/json',$5)", [detail, sid, attempt, content, sha256(content)]);
    await c.query('INSERT INTO flow.artifacts(task_id,artifact_id,version,attempt_id,detail_id) VALUES($1,\'source\',$2,$3,$4)', [sid, sha256(content), attempt, detail]);
    source = { taskId: sid, attemptId: attempt, artifactId: 'source', version: sha256(content), content };
  }
  const prompt = source ? JSON.stringify({ source, rule }) : 'tool input', taskId = await task(c, prompt);
  const b = await recordBinding(c, { protocol: toolCap.bindingProtocol, bindingId: randomUUID(), invocationId: randomUUID(), taskId, registrationId: m.registration, registrationRevision: 2, versionId: m.version, scope: { workspaceId: 'personal', projectId: project }, materialInstallOperationId: m.install, targetRunnerId: m.host.id, storeId: cap.storeId, materialId: 'b'.repeat(64), treeDigest: (options.badTree ? 'e' : 'c').repeat(64), hostApiMajor: 1, artifact: m.artifact, configuration: {}, inputDigest: sha256(prompt) });
  if (source && options.reference !== false) await c.query('INSERT INTO flow.plugin_verification_references(binding_id,source_task_id,source_attempt_id,artifact_id,artifact_version,project_id,rule) VALUES($1,$2,$3,$4,$5,$6,$7)', [b.bindingId, source.taskId, options.wrongAttempt ? randomUUID() : source.attemptId, source.artifactId, source.version, project, JSON.stringify(rule)]);
  return { b, source };
}
const makeBinding = (m: Material, o?: Parameters<typeof binding>[2]) => transaction(pool, c => binding(c, m, o));
const v4 = (host: Host): VerifierRunnerClaimRequest => ({ protocol: 'flow.runner-claim.v4', runnerId: host.id, requestId: randomUUID(), pluginVerifierExecution: cap });
const client = (host: Host) => new FlowClient({ baseUrl: base, token: host.token });
const clearQueue = () => pool.query("UPDATE flow.tasks SET status='cancelled' WHERE status='queued'");
let old: Material, historical: PluginToolBinding;
beforeAll(async () => {
  await fixture.create(); await fixture.stage('database-created'); await openApp(true);
  await pool.query("INSERT INTO flow.projects(id,workspace_id,title,revision) VALUES($1,'personal','Verifier scope',1)", [project]);
  old = await material('tool', await runner()); historical = (await makeBinding(old)).b;
  await fixture.start(closeApp); await fixture.stage('baseline-closed');
}, 30000);
afterAll(async () => {
  const settled = await fixture.settleStartup();
  const closed = settled && await fixture.close('server-close', closeApp);
  let counts: Record<string, number> | undefined;
  try { if (closed) counts = (await pool.query(`SELECT (SELECT count(*)::int FROM flow.tasks) tasks,(SELECT count(*)::int FROM flow.attempts) attempts,(SELECT count(*)::int FROM flow.runners) runners,(SELECT count(*)::int FROM flow.plugin_installations) registrations`)).rows[0]; } catch { facts.push({ kind: 'count-query-failed' }); }
  facts.push({ kind: 'bounded-counts', counts, http, bytes });
  const result = await fixture.finish({ startup: settled && startup, server: closed }, facts);
  expect(counts).toBeDefined(); expect(counts!.tasks).toBeLessThanOrEqual(32); expect(counts!.attempts).toBeLessThanOrEqual(20); expect(counts!.runners).toBeLessThanOrEqual(10); expect(counts!.registrations).toBeLessThanOrEqual(6);
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errorCount: 0 });
}, 60000);

describe.sequential('AV03 real PostgreSQL', () => {
  test('036 rejects unverifiable history atomically and positively backfills compatible old tool writers', async () => {
    const sql = await readFile(new URL('../../../../packages/storage/migrations/036-plugin-verification-bindings.sql', import.meta.url), 'utf8');
    await expect(transaction(pool, async c => { await binding(c, old, { badTree: true }); await c.query(sql); })).rejects.toMatchObject({ code: '23514' });
    expect((await pool.query("SELECT to_regclass('flow.plugin_binding_executions') AS name")).rows[0].name).toBeNull();
    expect((await pool.query('SELECT 1 FROM flow.migrations WHERE version=36')).rowCount).toBe(0);
    await migratePluginVerification(pool);
    expect((await pool.query('SELECT kind FROM flow.plugin_binding_executions WHERE binding_id=$1', [historical.bindingId])).rows).toEqual([{ kind: 'tool' }]);
    const added = await makeBinding(old); expect((await pool.query('SELECT kind FROM flow.plugin_binding_executions WHERE binding_id=$1', [added.b.bindingId])).rows).toEqual([{ kind: 'tool' }]);
    expect((await pool.query('SELECT input_digest FROM flow.plugin_tool_bindings WHERE id=$1', [historical.bindingId])).rows[0].input_digest).toBe(historical.inputDigest);
    await openApp(); await fixture.stage('migration-checked');
  });
  test('036 enforces immutable kind and exact source attempt with deferred mandatory verifier reference', async () => {
    await clearQueue(); const m = await material('verifier', await runner()), good = await makeBinding(m);
    for (const sql of ['UPDATE flow.plugin_binding_executions SET kind=kind WHERE binding_id=$1', 'DELETE FROM flow.plugin_binding_executions WHERE binding_id=$1', 'UPDATE flow.plugin_verification_references SET project_id=project_id WHERE binding_id=$1', 'DELETE FROM flow.plugin_verification_references WHERE binding_id=$1']) await expect(pool.query(sql, [good.b.bindingId])).rejects.toBeDefined();
    await expect(makeBinding(m, { reference: false })).rejects.toMatchObject({ code: '23514' });
    await expect(makeBinding(m, { wrongAttempt: true })).rejects.toMatchObject({ code: '23503' });
    await expect(pool.query('INSERT INTO flow.plugin_verification_references SELECT $1,kind,source_task_id,source_attempt_id,artifact_id,artifact_version,project_id,rule FROM flow.plugin_verification_references WHERE binding_id=$2', [historical.bindingId, good.b.bindingId])).rejects.toMatchObject({ code: '23503' });
    facts.push({ kind: 'constraints', assertions: 7 });
  });
  test('v1 v2 v3 and explicit v4 filter the mixed queue before LIMIT', async () => {
    await clearQueue(); const h = await runner(), t = await material('tool', h), v = await material('verifier', h);
    const tool = await makeBinding(t), verifier = await makeBinding(v);
    const ordinary = await transaction(pool, async c => [await task(c), await task(c)]);
    const legacy = await request('/api/runner/claim', {}, h.token); expect(legacy.status).toBe(200); expect(legacy.body.task.id).toBe(ordinary[0]);
    const second = await request('/api/runner/claim-opportunity', { protocol: 'flow.runner-claim.v2', runnerId: h.id, requestId: randomUUID() }, h.token); expect(second.body.assignment.task.id).toBe(ordinary[1]);
    const third = await client(h).pluginRunner.claim({ protocol: 'flow.runner-claim.v3', runnerId: h.id, requestId: randomUUID(), pluginToolExecution: toolCap }); expect(third.state).toBe('assigned'); if (third.state === 'assigned') expect(third.assignment.task.id).toBe(tool.b.taskId);
    const anotherTool = await makeBinding(t); await pool.query("UPDATE flow.tasks SET created_at='2000-01-01' WHERE id=$1", [anotherTool.b.taskId]);
    const wrong = await client(h).pluginRunner.claimVerifier({ ...v4(h), pluginVerifierExecution: { ...cap, storeId: 'different' } }); expect(wrong.state).toBe('empty');
    const fourth = await client(h).pluginRunner.claimVerifier(v4(h)); expect(fourth.state).toBe('assigned'); if (fourth.state === 'assigned') expect(fourth.assignment.pluginVerifierBinding?.bindingId).toBe(verifier.b.bindingId);
  });
  test('v4 concurrent receipt identity survives server restart and refuses changed protocol or qualification', async () => {
    await clearQueue(); const h = await runner(), m = await material('verifier', h), b = await makeBinding(m), input = v4(h);
    const results = await Promise.all([client(h).pluginRunner.claimVerifier(input), client(h).pluginRunner.claimVerifier(input)]);
    expect(results[0].state).toBe('assigned'); expect(results[1]).toMatchObject({ identity: 'identity' in results[0] ? results[0].identity : null });
    expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [b.b.taskId])).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM flow.commands WHERE key=$1', [input.requestId])).rowCount).toBe(1);
    expect((await request('/api/runner/claim-opportunity', { protocol: 'flow.runner-claim.v2', runnerId: h.id, requestId: input.requestId }, h.token)).status).toBe(409);
    await expect(client(h).pluginRunner.claimVerifier({ ...input, pluginToolExecution: toolCap })).rejects.toMatchObject({ status: 409, code: 'claim_key_conflict' });
    const lease = (await pool.query('SELECT lease_expires_at FROM flow.attempts WHERE task_id=$1', [b.b.taskId])).rows[0].lease_expires_at;
    await fixture.start(closeApp); await openApp();
    const replay = await client(h).pluginRunner.statusVerifier(input); expect(replay).toMatchObject({ identity: 'identity' in results[0] ? results[0].identity : null });
    expect((await pool.query('SELECT lease_expires_at FROM flow.attempts WHERE task_id=$1', [b.b.taskId])).rows[0].lease_expires_at).toEqual(lease);
  });
  test('source project and grant writer lock fence allocation without attempt or receipt residue', async () => {
    await clearQueue(); const h = await runner(), m = await material('verifier', h), b = await makeBinding(m);
    await pool.query('DELETE FROM flow.project_task_bindings WHERE task_id=$1', [b.source!.taskId]);
    await expect(client(h).pluginRunner.claimVerifier(v4(h))).rejects.toMatchObject({ status: 409, code: 'plugin_claim_unavailable' });
    await pool.query('INSERT INTO flow.project_task_bindings(task_id,project_id,node_id) VALUES($1,$2,$3)', [b.source!.taskId, project, randomUUID()]);
    const writer = await pool.connect(); let pending: Promise<unknown> | undefined; let primary: unknown;
    try {
      await writer.query('BEGIN'); const installation = await loadInstallation(writer, m.registration, true), snap = await readSnapshot(writer, m.registration);
      const pid = (await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      pending = client(h).pluginRunner.claimVerifier(v4(h)); const observed = pending.then(value => ({ value }), error => ({ error }));
      let blocked = false;
      for (let n = 0; n < 30 && !blocked; n++) { fixture.checkWork(); blocked = !!(await pool.query('SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) LIMIT 1', [pid])).rowCount; if (!blocked) await delay(10); }
      expect(blocked).toBe(true);
      await appendPluginRevision(writer, installation, { versionId: snap.version.id, configuration: snap.configuration, grants: [], kind: 'set-grants', inputDigest: sha256('controlled revoke') });
      await writer.query('COMMIT'); expect(await observed).toMatchObject({ error: { status: 409, code: 'plugin_claim_unavailable' } });
    } catch (error) { primary = error; throw error; }
    finally {
      try { await writer.query('ROLLBACK'); } catch (error) { if (!primary) throw error; facts.push({ kind: 'secondary-rollback-error' }); }
      finally { writer.release(); if (pending) await pending.catch(() => undefined); }
    }
    expect((await pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [b.b.taskId])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM flow.commands WHERE operation=$1", ['flow.runner-claim.v4:' + h.id])).rowCount).toBe(0);
    expect((await request('/api/runner/claim-opportunity', v4(h), owner)).status).toBe(403);
    await fixture.stage('work-complete');
  });
});
