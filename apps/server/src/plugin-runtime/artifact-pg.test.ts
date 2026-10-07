import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { sha256, transaction } from '../database.js';
import type { PluginArtifactSource } from '../../../../packages/contracts/src/plugin-artifact.js';
import type { RunnerEvent } from '@flow/contracts';
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
  if (counts) { expect(counts.tasks).toBeLessThanOrEqual(5); expect(counts.registrations).toBeLessThanOrEqual(5); }
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
// These five groups exercise real authenticated HTTP and SQL; material/old-phase metadata is controlled fixture input, not npm execution.
async function active() {
  const f=await enabled(); const {binding}=await bound(f);
  const end=Date.now()+3000;
  while (!(await pool.query<{ready:boolean}>('SELECT dispatch_ready AS ready FROM flow.tasks WHERE id=$1',[binding.taskId])).rows[0]?.ready) {
    databaseFixture.checkWork(); if(Date.now()>=end)throw new Error('Dispatch readiness timeout'); await sleep(15);
  }
  const input={protocol:PLUGIN_RUNNER_CLAIM_PROTOCOL,runnerId:f.runnerId,requestId:randomUUID(),
    pluginToolExecution:{bindingProtocol:PLUGIN_RUNTIME_PROTOCOL,storeId:'test-material',hostApiMajor:1 as const}};
  const claimed=await request('/api/runner/claim-opportunity',input,randomUUID(),f.token); expect(claimed.status).toBe(200);
  const result=decodePluginRunnerClaimResponse(claimed.body,input,'claim'); if(result.state!=='assigned')throw new Error('Expected assignment');
  const ownership={attemptId:result.assignment.attempt.id,ownerVersion:result.assignment.attempt.ownerVersion};
  const source:PluginArtifactSource={protocol:'flow.plugin-artifact.v1',bindingId:binding.bindingId,invocationId:binding.invocationId,
    taskId:binding.taskId,...ownership,installationId:binding.materialId,treeDigest:binding.treeDigest,
    artifactId:binding.artifact.artifactId,artifactSha256:binding.artifact.sha256,hostApiMajor:1};
  const phase=async(phase:'load'|'invoke')=>{
    const response=await request('/api/runner/plugin-tool/authorize',{...ownership,bindingId:binding.bindingId,invocationId:binding.invocationId,phase},randomUUID(),f.token);
    expect(response.status).toBe(200);expect(response.body.replayed).toBe(false);
  };
  const artifact:Extract<RunnerEvent,{type:'artifact'}>={id:randomUUID(),sequence:1,type:'artifact',artifactId:'plugin-'+binding.invocationId,
    title:'Controlled PG output',content:'-1',version:sha256('-1'),mediaType:'text/plain',pluginSource:source};
  const send=(events:RunnerEvent[])=>request('/api/runner/events',{...ownership,events},randomUUID(),f.token);
  return {...f,binding,ownership,source,phase,artifact,send};
}
async function snapshot(taskId:string) {
  return (await pool.query(`SELECT t.cursor,a.last_sequence,
    (SELECT count(*)::int FROM flow.artifacts WHERE task_id=t.id) AS artifacts,
    (SELECT count(*)::int FROM flow.details WHERE task_id=t.id) AS details,
    (SELECT count(*)::int FROM flow.timeline WHERE task_id=t.id) AS timeline,
    (SELECT count(*)::int FROM flow.runner_events WHERE attempt_id=a.id) AS events
    FROM flow.tasks t JOIN flow.attempts a ON a.id=t.current_attempt_id WHERE t.id=$1`,[taskId])).rows[0];
}
function batch(f:Awaited<ReturnType<typeof active>>, source=f.source):RunnerEvent[] {
  return [{id:randomUUID(),sequence:1,type:'message',text:'Prefix must roll back'}, {...f.artifact,sequence:2,pluginSource:source}];
}
async function rejectedUnchanged(f:Awaited<ReturnType<typeof active>>, events:RunnerEvent[], code:string) {
  const before=await snapshot(f.binding.taskId);const response=await f.send(events);
  expect(response.status).toBe(409);expect(response.body.error.code).toBe(code);
  expect(await snapshot(f.binding.taskId)).toEqual(before);
}

test('exact source is readable and same-sequence replay preserves a single artifact association',async()=>{
  const f=await active();await f.phase('load');await f.phase('invoke');
  expect((await f.send([f.artifact])).body).toEqual({accepted:1,lastSequence:1});
  const rows=(await pool.query('SELECT id,content,kind FROM flow.details WHERE task_id=$1 ORDER BY kind',[f.binding.taskId])).rows;
  const association=rows.find(row=>row.kind==='detail');expect(association).toBeDefined();
  const detail=await request('/api/details/'+association.id);expect(detail.status).toBe(200);
  expect(JSON.parse(detail.body.content)).toEqual({artifactId:f.artifact.artifactId,artifactVersion:f.artifact.version,pluginSource:f.source});
  const after=await snapshot(f.binding.taskId);expect(after).toMatchObject({last_sequence:1,artifacts:1,details:2,events:1});
  expect((await f.send([f.artifact])).body).toEqual({accepted:0,lastSequence:1});expect(await snapshot(f.binding.taskId)).toEqual(after);
  const changed={...f.artifact,pluginSource:{...f.source,treeDigest:'e'.repeat(64)}};
  await rejectedUnchanged(f,[changed],'event_conflict');
});
test('wrong frozen material rolls back the full batch prefix before artifact detail timeline and ACK',async()=>{
  const f=await active();await f.phase('load');await f.phase('invoke');
  const events=batch(f,{...f.source,artifactSha256:'e'.repeat(64)});
  await rejectedUnchanged(f,events,'plugin_artifact_identity');
  // The same uncommitted prefix IDs remain usable after correcting the rejected source.
  events[1]={...f.artifact,sequence:2};
  expect((await f.send(events)).body).toEqual({accepted:2,lastSequence:2});
});
test('missing invocation phase rejects source and rolls back prefix without discarding prior load authorization',async()=>{
  const f=await active();await f.phase('load');const events=batch(f);
  await rejectedUnchanged(f,events,'plugin_artifact_authorization');
  expect((await pool.query('SELECT phase FROM flow.plugin_tool_authorizations WHERE binding_id=$1',[f.binding.bindingId])).rows).toEqual([{phase:'load'}]);
  await f.phase('invoke');expect((await f.send(events)).body).toEqual({accepted:2,lastSequence:2});
});
test('phase receipts from a different historical attempt cannot authorize the current artifact association',async()=>{
  const f=await active();const historical=randomUUID();
  // Bounded historical seed satisfies existing FK/uniqueness. It is not an invocation or current phase grant.
  await transaction(pool,async client=>{
    await client.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at)
      VALUES($1,$2,$3,2,clock_timestamp(),clock_timestamp())`,[historical,f.binding.taskId,f.runnerId]);
    for(const phase of ['load','invoke'])await client.query(`INSERT INTO flow.plugin_tool_authorizations
      (binding_id,invocation_id,phase,task_id,attempt_id,owner_version,runner_id,registration_id,authorized_revision)
      VALUES($1,$2,$3,$4,$5,2,$6,$7,4)`,[f.binding.bindingId,f.binding.invocationId,phase,f.binding.taskId,historical,f.runnerId,f.registrationId]);
  });
  await rejectedUnchanged(f,batch(f),'plugin_artifact_authorization');
});
test('legacy artifact without source retains original storage and is not labelled verified plugin provenance',async()=>{
  const f=await active();const {pluginSource:_source,...legacy}=f.artifact;
  expect((await f.send([legacy])).body).toEqual({accepted:1,lastSequence:1});
  expect(await snapshot(f.binding.taskId)).toMatchObject({last_sequence:1,artifacts:1,details:1,events:1});
  expect((await pool.query('SELECT 1 FROM flow.plugin_tool_authorizations WHERE binding_id=$1',[f.binding.bindingId])).rowCount).toBe(0);
  expect((await pool.query("SELECT 1 FROM flow.details WHERE task_id=$1 AND kind='detail'",[f.binding.taskId])).rowCount).toBe(0);
});
