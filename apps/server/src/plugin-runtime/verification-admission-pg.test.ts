import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { PgBoss } from 'pg-boss';
import { eventBatchSchema, type EventBatch } from '@flow/contracts';
import { createServer } from '../index.js';
import { startScheduler } from '../scheduler.js';
import { reportEvents } from '../events.js';
import { claimOpportunity } from '../runners.js';
import { cancel } from '../commands.js';
import { sha256, transaction } from '../database.js';
import { changeProject } from '../projects/commands.js';
import { readProject } from '../projects/storage.js';
import { changePlugin } from '../plugins/commands.js';
import { readSnapshot } from '../plugins/storage.js';
import { admitPluginVerification } from './verification-admission.js';
import { authorizePluginPhase, changePluginRuntime } from './commands.js';
import { verifierPolicy } from '../plugin-verification-configuration.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01-verifier-admission-result/transaction-pg/fixture.js';
import { verificationInput } from '../../../../packages/plugin-runtime/src/verification-input.js';
import { verifyJsonObject } from '../../../../packages/plugin-runtime/src/json-object-verifier.js';
import { pluginVerificationRequestSchema, type JsonObjectVerdict } from '../../../../packages/contracts/src/plugin-verification.js';
import type { PluginVerificationAdmission } from '../../../../packages/contracts/src/plugin-verification-admission.js';
import type { VerifierRunnerClaimRequest } from '../../../../packages/contracts/src/verifier-runner-claim.js';
import type { PluginVerifierBinding } from '../../../../packages/contracts/src/plugin-verification-binding.js';
import type { PluginVerificationRequest } from '../../../../packages/contracts/src/plugin-verification.js';

// Real public source setup, then real domain commands/transactions. No public verifier mount is claimed.
const fixture = new PluginDatabaseFixture('runtime', 4), pool = fixture.pool;
const owner = randomUUID(), storeId = 'var-transaction-material';
const facts: unknown[] = [];
const rule = { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['id'] };
const hosts = () => true;
const algorithms = verifierPolicy({ materials: [{ artifactSha256: 'a'.repeat(64), treeDigest: 'c'.repeat(64), hostApiMajor: 1, algorithmId: rule.algorithmId, algorithmVersion: 1 }] });
let app: Awaited<ReturnType<typeof createServer>> | undefined, boss: PgBoss | undefined;
let base = '', project = '', sourceNode = '', http = 0, responseBytes = 0, startupCompleted = false;
let host: { id: string; token: string }, source: PluginVerificationAdmission['source'], material: { registration: string; install: string };
let firstFailure: Error | undefined;
const recordFailure = (error: Error) => { firstFailure ??= error; };
fixture.pool.on('error', recordFailure);
function checkWork() { fixture.checkWork(); if (firstFailure) throw firstFailure; }
let sourceBefore: unknown, firstAdmission: Awaited<ReturnType<typeof admitPluginVerification>>;

async function request(path: string, body?: unknown, token = owner) {
  checkWork();
  return fixture.request(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function closeApp() {
  if (!app) return;
  await app.close();
  if (app.server.listening) throw Error('Source setup listener remains active');
  fixture.listenerClosed(base); app = undefined;
}
async function projectSnapshot() { checkWork(); return transaction(pool, client => readProject(client, project), true); }
async function registrationSnapshot() { checkWork(); return transaction(pool, client => readSnapshot(client, material.registration), true); }
async function admissionInput(requiredKeys = ['id']): Promise<PluginVerificationAdmission> {
  return { expectedRevision: (await registrationSnapshot()).revision, expectedSourceProjectRevision: (await projectSnapshot()).project.revision,
    title: 'Verify saved JSON object', source: { ...source }, rule: { ...rule, requiredKeys } };
}
function admit(input: PluginVerificationAdmission, key = randomUUID(), policy = algorithms) {
  checkWork(); if (!boss) throw Error('Domain scheduler is not ready');
  return admitPluginVerification(pool, boss, material.registration, input, key, hosts, policy);
}
async function enable() {
  checkWork(); const current = await registrationSnapshot();
  await changePluginRuntime(pool, material.registration, { expectedRevision: current.revision, reason: 'Enable controlled verifier',
    change: { kind: 'enable', materialInstallOperationId: material.install, targetRunnerId: host.id, storeId } }, randomUUID(), hosts, algorithms);
}
async function setGrant(enabled: boolean) {
  const current = await registrationSnapshot();
  await changePlugin(pool, material.registration, { expectedRevision: current.revision, reason: 'Controlled grant transition', change: { kind: 'set-grants', capabilities: enabled ? ['verifier'] : [] } }, randomUUID());
}

/** The sole SQL fixture seed: installed material identity, explicitly not an actual install or invocation. */
async function installedMaterial() {
  const name = 'var-' + randomUUID();
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: project }, version: { packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64), license: 'ISC', hostApiMajor: 1, capabilities: ['verifier'], publicConfiguration: [] } });
  expect(registered.status).toBe(201);
  const registration = registered.body.snapshot.installation.id as string, version = registered.body.snapshot.version.id as string;
  const granted = await request(`/api/plugins/${registration}/commands`, { expectedRevision: 1, reason: 'Fixture verifier grant', change: { kind: 'set-grants', capabilities: ['verifier'] } });
  expect(granted.status).toBe(200);
  const install = randomUUID(), fetch = randomUUID(), attempt = randomUUID(), artifactId = randomUUID();
  const artifact = { artifactId, name, version: '1.0.0', bytes: 123, sha256: 'a'.repeat(64), integrity: 'sha512-' + 'a'.repeat(86) + '==' };
  const full = { ...artifact, format: 'npm-tarball', verifiedAt: new Date().toISOString(), source: { registry: 'http://127.0.0.1:1/', tarball: 'http://127.0.0.1:1/fixture.tgz' } };
  const receipt = { schemaVersion: 1, installationId: 'b'.repeat(64), storeId, artifact, manifest: { schemaVersion: 1, hostApiMajor: 1, kind: 'verifier', entrypoint: 'index.mjs' }, files: [], treeDigest: 'c'.repeat(64) };
  await transaction(pool, async client => {
    await client.query(`INSERT INTO flow.plugin_package_fetches(id,installation_id,version_id,admitted_revision,package_name,package_version,expected_sha256,integrity,store_id,registry_ref,registry_url,current_attempt_id) VALUES($1,$2,$3,1,$4,'1.0.0',$5,$6,'artifacts','own','http://127.0.0.1:1/',$7)`, [fetch, registration, version, name, artifact.sha256, artifact.integrity, attempt]);
    await client.query(`INSERT INTO flow.plugin_package_fetch_attempts(id,operation_id,ordinal,artifact_id,status,artifact) VALUES($1,$2,1,$3,'succeeded',$4)`, [attempt, fetch, artifactId, JSON.stringify(full)]);
    await client.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,artifact_id,artifact_store_id,store_id,artifact,input_digest,status,execution_id,receipt) VALUES($1,$2,$3,1,$4,$5,$6,'artifacts',$7,$8,$9,'installed',$10,$11)`, [install, registration, version, fetch, attempt, artifactId, storeId, JSON.stringify(full), 'd'.repeat(64), randomUUID(), JSON.stringify(receipt)]);
  });
  return { registration, install };
}
async function createSource() {
  const p = await request('/api/projects', { workspaceId: 'personal', title: 'VAR source authority' }); expect(p.status).toBe(201);
  project = p.body.snapshot.project.id;
  const r = await request('/api/runners', { name: 'VAR transaction host', harnesses: ['fixture'], capacity: 16 }); expect(r.status).toBe(200);
  host = { id: r.body.runnerId, token: r.body.token };
  expect((await request('/api/runner/plugin-host', { protocol: 'flow.plugin-runtime.v1', storeId, hostApiMajor: 1 }, host.token)).status).toBe(200);
  const submitted = await request('/api/tasks', { title: 'Saved JSON source', prompt: 'Produce controlled JSON', harness: 'fixture' }); expect(submitted.status).toBe(202);
  const taskId = submitted.body.task.id as string;
  const linked = await request(`/api/projects/${project}/commands`, { expectedRevision: 1, reason: 'Bind public source', change: { kind: 'add-node', title: 'Source', taskId, parent: null } }); expect(linked.status).toBe(200); sourceNode = linked.body.changedNodeId;
  let assignment;
  for (let n = 0; n < 80; n++) {
    const response = await request('/api/runner/claim', {}, host.token); expect(response.status).toBe(200);
    assignment = response.body.assignment; if (assignment) break; await delay(10);
  }
  if (!assignment) throw Error('Public source claim did not become ready');
  expect(assignment.task.id).toBe(taskId);
  const content = '{"id":1}', version = sha256(content), attempt = assignment.attempt;
  const saved = await request('/api/runner/events', { attemptId: attempt.id, ownerVersion: attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'artifact', artifactId: 'source', title: 'JSON source', version, content, mediaType: 'application/json' },
    { id: randomUUID(), sequence: 2, type: 'completed', outcome: 'succeeded' },
  ] }, host.token); expect(saved.status).toBe(200); expect(saved.body.accepted).toBe(2);
  source = { taskId, attemptId: attempt.id, artifactId: 'source', version };
}
async function taskState(taskId: string) {
  checkWork();
  return transaction(pool, async client => ({
    task: (await client.query('SELECT status,verification_status,cursor,owner_version,current_attempt_id,latest_artifact_id,latest_artifact_version FROM flow.tasks WHERE id=$1', [taskId])).rows,
    attempts: (await client.query('SELECT id,last_sequence,completed_at,owner_version FROM flow.attempts WHERE task_id=$1 ORDER BY id', [taskId])).rows,
    events: (await client.query('SELECT e.* FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1 ORDER BY e.sequence', [taskId])).rows,
    artifacts: (await client.query('SELECT * FROM flow.artifacts WHERE task_id=$1 ORDER BY artifact_id,version', [taskId])).rows,
    details: (await client.query('SELECT * FROM flow.details WHERE task_id=$1 ORDER BY id', [taskId])).rows,
    timeline: (await client.query('SELECT * FROM flow.timeline WHERE task_id=$1 ORDER BY cursor', [taskId])).rows,
  }), true);
}
async function creationState() {
  checkWork();
  return transaction(pool, async client => ({ project: await readProject(client, project), counts: (await client.query(`SELECT
    (SELECT count(*)::int FROM flow.tasks) tasks,
    (SELECT count(*)::int FROM flow.plugin_tool_bindings) bindings,
    (SELECT count(*)::int FROM flow.plugin_verification_references) refs,
    (SELECT count(*)::int FROM flow.commands) receipts,
    (SELECT count(*)::int FROM pgboss.job WHERE name='flow-wake') wakes`)).rows[0] }), true);
}
type Execution = { taskId: string; attemptId: string; ownerVersion: number; binding: PluginVerifierBinding; verification: PluginVerificationRequest };
async function allocate(taskId: string, phases = true): Promise<Execution> {
  const input: VerifierRunnerClaimRequest = { protocol: 'flow.runner-claim.v4', runnerId: host.id, requestId: randomUUID(), pluginVerifierExecution: {
    bindingProtocol: 'flow.plugin-verification.v1', storeId, hostApiMajor: 1, algorithms: [{ id: rule.algorithmId, version: 1 }] } };
  for (let n = 0; n < 100; n++) {
    checkWork(); const response = await claimOpportunity(pool, host.id, input, 300000);
    if (response.state === 'assigned') {
      expect(response.assignment.task.id).toBe(taskId);
      const binding = 'pluginVerifierBinding' in response.assignment ? response.assignment.pluginVerifierBinding : undefined;
      if (!binding) throw Error('Missing positive verifier binding');
      const execution = { taskId, attemptId: response.assignment.attempt.id, ownerVersion: response.assignment.attempt.ownerVersion, binding, verification: pluginVerificationRequestSchema.parse(JSON.parse(response.assignment.task.prompt)) };
      if (phases) for (const phase of ['load', 'invoke'] as const) {
        const receipt = await authorizePluginPhase(pool, host.id, { attemptId: execution.attemptId, ownerVersion: execution.ownerVersion, bindingId: binding.bindingId, invocationId: binding.invocationId, phase }, randomUUID(), 'verifier', algorithms);
        expect(receipt.replayed).toBe(false); expect(receipt.taskId).toBe(taskId);
      }
      return execution;
    }
    expect(response.state).toBe('empty'); await delay(10);
  }
  throw Error('Bounded verifier allocation did not become ready');
}
function terminal(execution: Execution, outcome: 'succeeded' | 'failed' | 'cancelled', settled = true): EventBatch {
  return eventBatchSchema.parse({ attemptId: execution.attemptId, ownerVersion: execution.ownerVersion,
    events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome, ...(settled ? { pluginCompletion: { state: 'settled' } } : {}) }] });
}
function bundle(execution: Execution, override?: JsonObjectVerdict): EventBatch {
  const binding = execution.binding, request = execution.verification;
  const verdict = override ?? verifyJsonObject(request.source.content, request.rule);
  const { inputDigest } = verificationInput({ ...execution, bindingId: binding.bindingId, invocationId: binding.invocationId,
    material: { installationId: binding.materialId, storeId: binding.storeId, treeDigest: binding.treeDigest, artifact: binding.artifact }, configuration: {} }, request);
  const content = JSON.stringify({ schemaVersion: 1, algorithmId: rule.algorithmId, algorithmVersion: 1, inputDigest, verdict });
  const version = sha256(content), pluginSource = { protocol: 'flow.plugin-artifact.v1', bindingId: binding.bindingId, invocationId: binding.invocationId,
    taskId: execution.taskId, attemptId: execution.attemptId, ownerVersion: execution.ownerVersion, installationId: binding.materialId,
    artifactId: binding.artifact.artifactId, artifactSha256: binding.artifact.sha256, treeDigest: binding.treeDigest, hostApiMajor: 1 };
  return eventBatchSchema.parse({ attemptId: execution.attemptId, ownerVersion: execution.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'artifact', artifactId: 'verdict', title: 'Verifier output', version, content, mediaType: 'application/json', pluginSource },
    { id: randomUUID(), sequence: 2, type: 'verification', verifierId: 'flow.plugin-json-object', verifierVersion: '1', artifactId: 'verdict', artifactVersion: version, inputDigest, result: verdict.result, verdict, pluginSource },
    { id: randomUUID(), sequence: 3, type: 'completed', outcome: verdict.result === 'passed' ? 'succeeded' : 'failed', pluginCompletion: { state: 'settled' } },
  ] });
}
async function report(batch: EventBatch, policy = algorithms) { checkWork(); return reportEvents(pool, host.id, batch, policy); }

beforeEach(checkWork); afterEach(checkWork);
beforeAll(async () => {
  await fixture.create(); await fixture.stage('database-created');
  await fixture.start(async () => {
    app = await createServer({ databaseUrl: fixture.databaseUrl, ownerToken: owner, leaseMs: 300000, automaticQueueScan: false, pluginRuntimeHostPolicy: hosts });
    app.addHook('onRequest', async () => { checkWork(); if (++http > 160) throw Error('HTTP bound'); });
    app.addHook('onSend', async (_request, _reply, payload) => {
      const size = typeof payload === 'string' ? Buffer.byteLength(payload) : Buffer.isBuffer(payload) ? payload.length : 0;
      if (size > 131072 || (responseBytes += size) > 4194304) throw Error('Response bytes bound'); return payload;
    });
    base = await app.listen({ host: '127.0.0.1', port: 0 }); fixture.listener(base);
  });
  await fixture.stage('public-source-setup'); await createSource(); material = await installedMaterial(); sourceBefore = await taskState(source.taskId);
  // Stop the factory's scheduler before reusing the same production scheduler with the fixture pool.
  await fixture.start(closeApp); await fixture.stage('factory-closed');
  await fixture.start(async () => { boss = await startScheduler(fixture.databaseUrl, pool); boss.on('error', recordFailure); });
  await enable(); startupCompleted = true; await fixture.stage('domain-ready');
}, 30000);
afterAll(async () => {
  const settled = await fixture.settleStartup();
  const serverClosed = settled && await fixture.close('server-close', closeApp);
  const bossClosed = settled && await fixture.close('domain-boss-close', async () => { if (boss) { await boss.stop({ graceful: true, timeout: 5000 }); boss = undefined; } });
  let counts: Record<string, number> | undefined;
  try { if (serverClosed && bossClosed) counts = (await pool.query(`SELECT (SELECT count(*)::int FROM flow.tasks) tasks,(SELECT count(*)::int FROM flow.attempts) attempts,(SELECT count(*)::int FROM flow.runners) runners,(SELECT count(*)::int FROM flow.plugin_installations) registrations`)).rows[0]; }
  catch { facts.push({ kind: 'count-query-failed' }); }
  facts.push({ kind: 'background-failure', firstFailure: firstFailure ? { name: firstFailure.name } : null });
  facts.push({ kind: 'limits', counts, http, responseBytes, source: 'public task/claim/events/project', material: 'synthetic installed-only', transaction: 'real domain functions; verifier routes not mounted' });
  const result = await fixture.finish({ startup: settled && startupCompleted, server: serverClosed, boss: bossClosed }, facts);
  expect(counts).toBeDefined(); expect(counts!.tasks).toBeLessThanOrEqual(16); expect(counts!.attempts).toBeLessThanOrEqual(14); expect(counts!.runners).toBeLessThanOrEqual(4); expect(counts!.registrations).toBeLessThanOrEqual(2);
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errorCount: 0 }); expect(firstFailure).toBeUndefined();
}, 60000);

describe.sequential('VAR real transaction', () => {
  test('same-key concurrent admission creates one task node reference wake and receipt', async () => {
    const input = await admissionInput(), key = randomUUID(), before = await creationState();
    const results = await Promise.all([admit(input, key), admit(input, key)]); firstAdmission = results[0]!;
    expect(results.map(item => item.replayed).sort()).toEqual([false, true]);
    expect({ ...results[0], replayed: false }).toEqual({ ...results[1], replayed: false });
    const after = await creationState();
    expect(after.project.project.revision).toBe(before.project.project.revision + 1);
    expect(after.project.graph.nodes.filter(node => node.taskId === firstAdmission.task.id)).toHaveLength(1);
    for (const name of ['tasks', 'bindings', 'refs', 'receipts', 'wakes']) expect(after.counts[name]).toBe(before.counts[name] + 1);
    expect((await pool.query('SELECT 1 FROM flow.commands WHERE operation=$1 AND key=$2', ['plugin.verification-task:' + material.registration, key])).rowCount).toBe(1);
    expect(await admit(input, key)).toEqual({ ...firstAdmission, replayed: true });
    await expect(admit({ ...input, title: 'Changed' }, key)).rejects.toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(await creationState()).toEqual(after);
  });
  test('stale CAS removed project authority revoked grant and denied trust leave no creation residue', async () => {
    let input = await admissionInput(), before = await creationState();
    await expect(admit({ ...input, expectedSourceProjectRevision: input.expectedSourceProjectRevision - 1 })).rejects.toMatchObject({ status: 409, code: 'stale_source_project' });
    await expect(admit(input, randomUUID(), () => false)).rejects.toMatchObject({ status: 403, code: 'plugin_verifier_untrusted' });
    expect(await creationState()).toEqual(before);
    await setGrant(false); input = await admissionInput(); before = await creationState();
    await expect(admit(input)).rejects.toMatchObject({ status: 409, code: 'plugin_revision_conflict' });
    expect(await creationState()).toEqual(before); await setGrant(true); await enable();
    const current = await projectSnapshot(); const node = current.graph.nodes.find(row => row.id === sourceNode)!;
    await changeProject(pool, project, { expectedRevision: current.project.revision, reason: 'Remove source authority', change: { kind: 'remove-node', nodeId: node.id, expectedNodeVersion: node.version } }, randomUUID());
    input = await admissionInput(); before = await creationState();
    await expect(admit(input)).rejects.toMatchObject({ status: 409, code: 'verification_source_project' }); expect(await creationState()).toEqual(before);
    const restored = await changeProject(pool, project, { expectedRevision: before.project.project.revision, reason: 'Restore source authority', change: { kind: 'add-node', title: 'Source', taskId: source.taskId, parent: null } }, randomUUID()); sourceNode = restored.changedNodeId!;
  });
  test('artifact typed passed verdict and completion commit together and exact replay writes nothing', async () => {
    const execution = await allocate(firstAdmission.task.id), batch = bundle(execution);
    expect(await report(batch)).toEqual({ accepted: 3, lastSequence: 3 });
    const saved = await taskState(execution.taskId); expect(saved.task[0]).toMatchObject({ status: 'succeeded', verification_status: 'passed' });
    expect(saved.events).toHaveLength(3); expect(saved.artifacts).toHaveLength(1); expect(saved.attempts[0].completed_at).not.toBeNull();
    expect(saved.details.filter(row => row.kind === 'verification')).toHaveLength(1);
    expect(await report(batch, () => false)).toEqual({ accepted: 0, lastSequence: 3 });
    expect(await taskState(execution.taskId)).toEqual(saved); expect(await taskState(source.taskId)).toEqual(sourceBefore);
  });
  test('forged passed and late invalid completion roll back the whole artifact verdict event batch', async () => {
    const accepted = await admit(await admissionInput(['missing'])), execution = await allocate(accepted.task.id), before = await taskState(accepted.task.id);
    const forged = bundle(execution, { result: 'passed', reason: 'passed', missingKeys: [] });
    await expect(report(forged)).rejects.toMatchObject({ status: 409, code: 'plugin_verification_conflict' });
    expect(await taskState(accepted.task.id)).toEqual(before);
    const valid = bundle(execution), invalid = structuredClone(valid); invalid.events[2] = { ...invalid.events[2]!, type: 'completed', outcome: 'succeeded', pluginCompletion: { state: 'settled' } } as EventBatch['events'][number];
    await expect(report(invalid)).rejects.toMatchObject({ status: 409, code: 'plugin_verification_conflict' });
    expect(await taskState(accepted.task.id)).toEqual(before);
    expect(await report(valid)).toEqual({ accepted: 3, lastSequence: 3 });
    expect((await taskState(accepted.task.id)).task[0]).toMatchObject({ status: 'failed', verification_status: 'failed' });
  });
  test('settled failure cancellation UNKNOWN and project capacity preserve their distinct transaction gates', async () => {
    for (const outcome of ['failed', 'cancelled'] as const) {
      const accepted = await admit(await admissionInput()), execution = await allocate(accepted.task.id, false);
      if (outcome === 'cancelled') await cancel(pool, boss!, accepted.task.id, randomUUID());
      const before = await taskState(accepted.task.id);
      await expect(report(terminal(execution, outcome, false))).rejects.toMatchObject({ status: 409, code: 'plugin_execution_unsettled' });
      expect(await taskState(accepted.task.id)).toEqual(before);
      await expect(report({ ...terminal(execution, outcome), ownerVersion: execution.ownerVersion + 1 })).rejects.toMatchObject({ status: 409 });
      expect(await taskState(accepted.task.id)).toEqual(before);
      expect(await report(terminal(execution, outcome))).toEqual({ accepted: 1, lastSequence: 1 });
      const saved = await taskState(accepted.task.id); expect(saved.task[0]).toMatchObject({ status: outcome, verification_status: 'pending' });
      expect(saved.artifacts).toHaveLength(0); expect(saved.details.filter(row => row.kind === 'verification')).toHaveLength(0);
    }
    // Use the actual project command; a late graph-limit error must roll back acceptTask AND wake.
    let current = await projectSnapshot();
    while (current.graph.nodes.length < 200) {
      checkWork(); const changed = await changeProject(pool, project, { expectedRevision: current.project.revision, reason: 'Controlled graph capacity', change: { kind: 'add-node', title: 'Unbound capacity node', taskId: null, parent: null } }, randomUUID()); current = changed.snapshot;
    }
    const input = await admissionInput(), before = await creationState();
    await expect(admit(input)).rejects.toMatchObject({ status: 409 });
    expect(await creationState()).toEqual(before); expect(await taskState(source.taskId)).toEqual(sourceBefore);
    facts.push({ kind: 'five-domain-cases', publicVerifierMount: false, workerInvocation: false }); await fixture.stage('work-complete');
  });
});
