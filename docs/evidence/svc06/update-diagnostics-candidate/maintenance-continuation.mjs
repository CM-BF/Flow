// Thin read-only gates around the existing public maintenance entrypoints; no service mutation here.
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { bounded, durable } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { loadPreviewConfiguration, readPreviewJson, inspectPreviewWebHostSource } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs';
import { backendById, backendRuntime } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/backend-release/host.mjs';
import { readBrowserSessionConfiguration } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/browser-session-configuration.mjs';
import { readWebRelease, loadReleaseAssets } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-release.mjs';
import { inspectOwnedProcess } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
import { checkRuntimeOnly } from './history-projection.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const json = async path => JSON.parse((await bounded(path, 131072)).bytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = assert.deepEqual;
const facts = async (run, name) => { const value = await json(join(run, name)); assert.equal(value.outcome, 'observed'); return value.facts; };

export function compareHistory(before, after, auditAdded, migrationsAdded = 8) {
  same(after.identity, before.identity); same(after.omittedColumns, before.omittedColumns);
  assert.equal(after.tables.length, before.tables.length);
  for (const prior of before.tables) {
    const current = after.tables.find(table => table.name === prior.name); assert.ok(current); same(current.columns, prior.columns);
    const expectedAdded = prior.name === 'migrations' ? migrationsAdded : prior.name === 'runner_maintenance_audit' ? auditAdded : 0;
    assert.equal(current.count, prior.count + expectedAdded, 'ROW_COUNT_CHANGED:' + prior.name);
    if (expectedAdded) {
      const remaining = [...current.row_hashes];
      for (const hash of prior.row_hashes) { const index = remaining.indexOf(hash); assert.ok(index >= 0, 'OLD_ROW_CHANGED:' + prior.name); remaining.splice(index, 1); }
      assert.equal(remaining.length, expectedAdded);
    } else assert.equal(current.digest, prior.digest, 'OLD_COLUMNS_CHANGED:' + prior.name);
  }
}

export async function configuredTuple(plan) {
  const config = await loadPreviewConfiguration(plan.directory);
  const browser = await readBrowserSessionConfiguration(config);
  same(browser.context, plan.context); assert.equal(browser.pin.file.sha256, plan.policySha256);
  same(browser.pin, plan.policyPin);
  const release = await readWebRelease(plan.directory);
  const loaded = await loadReleaseAssets({ directory: plan.directory, release, expectedBackendHead: plan.artifact.sourceHead, expectedContext: plan.context });
  same(Object.values(loaded.verifiedTuple.compatibilityIds).sort(), [...plan.reportIds].sort());
  assert.equal((await inspectPreviewWebHostSource({ directory: plan.directory })).digest, plan.hostSourceDigest);
  return { config, tuple: loaded.verifiedTuple, policyPin: browser.pin };
}

export function invariantFacts(before, after) {
  for (const key of ['rootIdentity', 'identity', 'release', 'retained']) same(after[key], before[key]);
  for (const name of ['config.json', 'claude.json', 'web-release.json']) same(after.files[name], before.files[name]);
  assert.ok(after.database.markerMatched && after.database.runnerIdentityMatched);
  assert.ok(Object.values(after.processes).every(process => process.identity === 'running'));
  assert.ok(Object.values(after.listeners).every(Boolean)); assert.equal(after.lock, 'absent');
}

async function preflight(plan, run) {
  const current = await facts(run, 'facts-before.json'), prior = await facts(join(base, 'personal-actual-r2'), 'after-replace.json');
  invariantFacts(prior, current);
  same(current.processes, prior.processes); same(current.runtimeSource, prior.runtimeSource);
  same(current.files['state.json'], prior.files['state.json']); same(current.files['maintenance.json'], prior.files['maintenance.json']);
  same(current.database.runner, prior.database.runner); same(current.database.tasks, prior.database.tasks);
  same(current.database.queue, prior.database.queue); assert.equal(current.database.unfinished.length, 0); assert.equal(current.database.uncertain.length, 0);
  for (const old of prior.database.tables) { const table = current.database.tables.find(value => value.name === old.name); assert.ok(table); assert.equal(table.protected_digest, old.protected_digest); }
  const state = await readPreviewJson(join(plan.directory, 'state.json'));
  assert.equal(state.backendArtifact ?? null, null); assert.equal(state.pendingWebHost ?? null, null); same(state.webHost.artifact, plan.artifact);
  const descriptor = await backendById(plan.directory, plan.artifact.artifactId); same(descriptor, plan.artifact);
  const checked = await configuredTuple(plan); await backendRuntime(checked.config, descriptor);
  return { outcome: 'preflight-confirmed', artifact: descriptor, tuple: checked.tuple, policyPin: checked.policyPin, completedStagesReplayed: 0 };
}

// No retirement exception: only strict v1 idle plus the exact previously retained files.
export function assertRunnerIdle(sample, expected) {
  same({ dev: sample.dev, ino: sample.ino, uid: sample.uid }, expected.identity);
  assert.equal(sample.admission?.idle, true, 'LOCAL_ADMISSION_NOT_IDLE');
  assert.equal(sample.admission.path, expected.namespace + '/admission.json');
  same(sample.files, expected.files); assert.equal(sample.totalBytes, expected.totalBytes);
}

async function localIdle(plan) {
  const expected = plan.runnerIdle;
  assert.equal(expected.root, join(plan.directory, 'runner'));
  assert.equal(expected.namespace, sha(expected.baseUrl));
  const namespace = join(expected.root, expected.namespace);
  const identity = async () => {
    const value = await lstat(namespace);
    assert.ok(value.isDirectory() && !value.isSymbolicLink() && value.uid === process.getuid());
    same({ dev: value.dev, ino: value.ino, uid: value.uid }, expected.namespaceIdentity);
  };
  await identity();
  const { runnerFiles } = await import(expected.module);
  const observation = await runnerFiles(expected.root, expected.baseUrl);
  assertRunnerIdle(observation, expected); await identity();
  return observation;
}

async function operation(plan, run) {
  const outer = await json(join(run, 'bootstrap-outer.json')), view = JSON.parse(outer.stdout);
  const op = await readPreviewJson(join(plan.directory, 'maintenance.json'));
  same(op.backendArtifact, plan.artifact); assert.equal(op.target, plan.artifact.sourceHead);
  assert.equal(op.operationId, view.operationId); assert.equal(op.phase, 'drain-requested');
  assert.equal(view.state, 'draining'); assert.equal(view.version, plan.initialVersion + 1);
  assert.equal(view.activeAttempts, 0); assert.equal(view.uncertainAttempts, 0);
  const state = await readPreviewJson(join(plan.directory, 'state.json'));
  assert.equal(state.backendArtifact ?? null, null);
  for (const record of Object.values(state.processes)) assert.equal(await inspectOwnedProcess(record), 'running');
  const config = await loadPreviewConfiguration(plan.directory);
  assert.equal(config.runner.runnerId, plan.runnerId); assert.equal('http://127.0.0.1:' + config.centerPort, plan.runnerIdle.baseUrl);
  const { maintainPreview } = await import(plan.rootMaintenanceModule);
  const freshView = await maintainPreview({ directory: plan.directory, action: 'status' });
  for (const key of ['operationId', 'state', 'version', 'activeAttempts', 'uncertainAttempts']) same(freshView[key], view[key]);
  const native = await localIdle(plan);
  const finalView = await maintainPreview({ directory: plan.directory, action: 'status' });
  for (const key of ['operationId', 'state', 'version', 'activeAttempts', 'uncertainAttempts']) same(finalView[key], freshView[key]);
  same(await readPreviewJson(join(plan.directory, 'maintenance.json')), op);
  same(await readPreviewJson(join(plan.directory, 'state.json')), state);
  return { native, freshView, finalView, localIdleBoundary: 'Non-atomic read-only observation after same-operation drain active=0, before public refresh; any unknown stops. No journal repair or task cancellation.', outcome: 'real-operation-confirmed', operationId: op.operationId, initialVersion: op.initialVersion, backendArtifact: op.backendArtifact, phase: op.phase };
}

export async function checkpoint(plan, run, final = false) {
  const before = await facts(run, 'facts-before.json'), current = await facts(run, final ? 'facts-final.json' : 'facts-paused.json');
  invariantFacts(before, current); assert.equal(current.runtimeSource.head, plan.artifact.sourceHead); assert.equal(current.runtimeSource.dirty, false);
  const captured = await json(join(run, 'operation.json')), op = await readPreviewJson(join(plan.directory, 'maintenance.json'));
  assert.equal(op.operationId, captured.operationId); same(op.backendArtifact, plan.artifact);
  assert.equal(op.phase, final ? 'resumed' : 'ready-paused');
  const runner = current.database.runner[0]; assert.equal(current.database.runner.length, 1);
  assert.equal(runner.maintenance_state, final ? 'accepting' : 'maintenance'); assert.equal(runner.maintenance_version, plan.initialVersion + (final ? 3 : 2));
  assert.equal(runner.maintenance_operation_id, final ? null : op.operationId);
  const state = await readPreviewJson(join(plan.directory, 'state.json')); same(state.backendArtifact, plan.artifact); same(state.webHost.artifact, plan.artifact); assert.equal(state.pendingWebHost ?? null, null);
  const oldGroups = [];
  for (const [role, record] of Object.entries(before.processes)) {
    let absent = false; try { process.kill(-record.group, 0); } catch (error) { if (error.code === 'ESRCH') absent = true; else throw error; }
    assert.ok(absent, 'OLD_GROUP_NOT_ABSENT:' + role); oldGroups.push({ role, group: record.group, absent });
  }
  assert.deepEqual(current.database.migrations.map(migration => migration.version), Array.from({ length: 35 }, (_, index) => index + 1));
  const tuple = await configuredTuple(plan);
  if (!final) {
    assert.equal(current.database.unfinished.length, 0); assert.equal(current.database.uncertain.length, 0); same(current.database.tasks, before.database.tasks);
    compareHistory(await json(join(run, 'history-before.json')), await json(join(run, 'history-paused.json')), 2);
  } else assert.equal((await json(join(run, 'checkpoint.json'))).outcome, 'ready-paused-preservation-confirmed');
  return { outcome: final ? 'resumed-confirmed' : 'ready-paused-preservation-confirmed', operationId: op.operationId, runner, oldGroups,
    processes: current.processes, runtimeSource: current.runtimeSource, tuple: tuple.tuple, policyPin: tuple.policyPin,
    finalTasksEqualPaused: final ? JSON.stringify(current.database.tasks) === JSON.stringify((await facts(run, 'facts-paused.json')).database.tasks) : null,
    boundary: final ? 'Preservation proved before explicit resume; subsequent user work is not reverted or suppressed.' : 'Old columns/rows preserved; only eight migration rows and two maintenance audit rows added; four runner maintenance fields and queue_checked_at checked separately/declared.' };
}

async function checkEntrypoints(plan) {
  const root = await import(plan.rootMaintenanceModule);
  const artifact = await import(plan.sourceArtifactMaintenanceModule);
  assert.equal(typeof root.maintainPreview, 'function'); assert.equal(typeof artifact.maintainPreview, 'function');
  assert.equal(typeof (await import(plan.factsModule)).snapshot, 'function');
  const runtime = await checkRuntimeOnly();
  const t = { name: 'tasks', columns: ['id'], count: 1, digest: 'a' }, example = { identity: {}, omittedColumns: {}, tables: [t] };
  compareHistory(example, structuredClone(example), 2);
  assert.throws(() => compareHistory(example, { ...example, tables: [{ ...t, digest: 'b' }] }, 2));
  return { outcome: 'entrypoints-and-guards-available', rootMaintenanceCallable: true, artifactMaintenanceCallable: true, factsCallable: true, runtime,
    privateInstallationRead: false, sourceArtifactOnly: true, publicMaintenanceCalled: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const plan = JSON.parse(await readFile(join(base, 'maintenance-continuation.json'), 'utf8'));
    const [phase, run] = process.argv.slice(2);
    if (phase === '--check-entrypoints' && !run) console.log(JSON.stringify(await checkEntrypoints(plan)));
    else {
      assert.equal(run, plan.runDirectory); assert.ok(['preflight', 'operation', 'checkpoint', 'final'].includes(phase));
      const value = phase === 'preflight' ? await preflight(plan, run) : phase === 'operation' ? await operation(plan, run) : await checkpoint(plan, run, phase === 'final');
      await durable(join(run, phase + '.json'), { at: new Date().toISOString(), ...value });
      console.log(JSON.stringify({ phase, outcome: value.outcome }));
    }
  } catch (error) { console.error(JSON.stringify({ outcome: 'unknown', code: /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'CONTINUATION_GATE_FAILED' })); process.exitCode = 1; }
}
