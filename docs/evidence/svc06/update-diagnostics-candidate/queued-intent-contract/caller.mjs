// One fixed hold/retirement continuation; the maintenance FSM and commit primitive remain original.
import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { snapshot, durable } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { boundIntent, retireIntent, readRegular, source, sha, assertPreservedQueueContract } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/intent-retirement/retire.mjs';
import { exactHistory, withHostFence } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/intent-retirement/host-fence.mjs';
import { loadPreviewConfiguration, withPreviewLock, assertPreviewMarker } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs';
import { inspectOwnedProcess, stopOwnedProcess } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
import { readRunnerMaintenance, commandRunnerMaintenance } from '/Users/citrine/Projects/AgentHarness/Flow/apps/server/src/runner-maintenance/index.ts';
import { legacyCompatibility } from '../continuation-facts.mjs';
import { snapshot as historySnapshot, checkRuntimeOnly } from '../history-projection.mjs';
import { compareHistory, configuredTuple, invariantFacts, checkpoint } from '../maintenance-continuation.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const execute = promisify(execFile);
const read = async path => JSON.parse((await readRegular(path, 131072)).bytes);
const runFile = (plan, name) => join(plan.runDirectory, name + '.json');
const save = (plan, name, value) => durable(runFile(plan, name), { at: new Date().toISOString(), ...value });
const jsonEqual = assert.deepEqual;

export async function loadPlan() {
  const delta = JSON.parse(await readFile(join(base, 'plan.json')));
  const inheritedBytes = await readFile(delta.inherited.path); assert.equal(sha(inheritedBytes), delta.inherited.sha256);
  const inherited = JSON.parse(inheritedBytes);
  const inputBytes = await readFile(inherited.inputs.path); assert.equal(sha(inputBytes), inherited.inputs.sha256);
  const inputs = JSON.parse(inputBytes);
  return { ...inherited, ...delta, budget: { ...inherited.budget, freshBytes: delta.freshBytes },
    fixedPins: [...inputs.runtimePins, ...inherited.observerPins, inherited.factsReaderPin, ...delta.deltaPins] };
}

export async function verifySource(plan) {
  for (const pin of plan.fixedPins) {
    const before = await lstat(pin.path, { bigint: true });
    assert.ok(before.isFile() && !before.isSymbolicLink()); assert.equal(await realpath(pin.path), pin.realpath);
    for (const [key, expected] of Object.entries({ dev: pin.dev, ino: pin.ino, uid: pin.uid, nlink: pin.nlink, size: pin.bytes })) assert.equal(String(before[key]), String(expected));
    const bytes = await readFile(pin.path), after = await lstat(pin.path, { bigint: true });
    for (const key of ['dev', 'ino', 'uid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) assert.equal(before[key], after[key]);
    assert.equal(sha(bytes), pin.sha256);
  }
  for (const pin of plan.baselines) { const bytes = await readFile(pin.path); assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256); }
  const head = (await execute('/usr/bin/git', ['-C', plan.repository, 'rev-parse', 'HEAD'], { timeout: 1500 })).stdout.trim();
  assert.equal(head, plan.rootHead);
  assert.equal((await execute('/usr/bin/git', ['-C', plan.repository, 'status', '--porcelain'], { timeout: 1500 })).stdout, '');
}

export function assertSameOperation(op, plan) {
  assert.equal(op.operationId, plan.request.operationId); assert.equal(op.initialVersion, 18);
  assert.equal(op.target, plan.artifact.sourceHead); jsonEqual(op.backendArtifact, plan.artifact);
  assert.equal(op.phase, 'drain-requested'); assert.match(op.holdKey, /^[a-f0-9-]{36}$/);
}
function assertView(view, plan, state, version) {
  assert.equal(view.runnerId, plan.request.runnerId); assert.equal(view.operationId, plan.request.operationId);
  assert.equal(view.state, state); assert.equal(view.version, version); assert.equal(view.activeAttempts, 0); assert.equal(view.uncertainAttempts, 0);
}
async function boundState(plan) {
  const state = await readRegular(join(plan.directory, 'state.json'));
  assert.equal(sha(state.bytes), plan.request.stateSha256);
  assert.equal(sha((await readRegular(join(plan.directory, 'config.json'))).bytes), plan.request.configSha256);
  const value = JSON.parse(state.bytes); assert.equal(value.source.head, source); assert.equal(value.source.dirty, false);
  assert.equal(value.backendArtifact ?? null, null); jsonEqual(value.webHost.artifact, plan.artifact);
  return value;
}
function poolFor(config, plan) {
  const { Pool } = createRequire(join(plan.repository, 'package.json'))('pg');
  return new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000,
    application_name: 'svc06-held-intent-continuation' });
}
async function facts(plan, name) {
  const value = await snapshot({ findCompatibility: legacyCompatibility });
  await save(plan, name, { outcome: 'observed', facts: value }); return value;
}
async function history(plan, name) {
  await historySnapshot(runFile(plan, name), runFile(plan, 'history-before'));
  return read(runFile(plan, name));
}

async function fresh(plan) {
  const original = await read(plan.r4Facts), baseline = await read(plan.r4History);
  // Preserve the exact pre-drain old-column baseline; do not silently establish a new one.
  await durable(runFile(plan, 'history-before'), baseline);
  const current = await facts(plan, 'facts-before'); invariantFacts(original.facts, current);
  jsonEqual(current.processes, original.facts.processes); jsonEqual(current.runtimeSource, original.facts.runtimeSource);
  jsonEqual(current.files['state.json'], original.facts.files['state.json']);
  jsonEqual(current.database.tasks, original.facts.database.tasks); jsonEqual(current.database.queue, original.facts.database.queue);
  assert.equal(current.database.unfinished.length, 0); assert.equal(current.database.uncertain.length, 0);
  await boundState(plan); const op = await read(join(plan.directory, 'maintenance.json')); assertSameOperation(op, plan);
  const { maintainPreview } = await import(plan.rootMaintenanceModule);
  assertView(await maintainPreview({ directory: plan.directory, action: 'status' }), plan, 'draining', 19);
  await boundIntent(plan.request); await exactHistory(plan.request);
  const tuple = await configuredTuple(plan);
  compareHistory(baseline, await history(plan, 'history-fresh'), 1, 0);
  await save(plan, 'fresh', { outcome: 'fresh-held-continuation-ready', operationId: op.operationId, operationSha256: sha((await readRegular(join(plan.directory, 'maintenance.json'))).bytes), tuple: tuple.tuple });
}

async function holdStop(plan) {
  const fresh = await read(runFile(plan, 'fresh')); assert.equal(fresh.outcome, 'fresh-held-continuation-ready');
  const config = await loadPreviewConfiguration(plan.directory);
  return withPreviewLock(config, async () => {
    await verifySource(plan); await assertPreviewMarker(config);
    const state = await boundState(plan), opBytes = await readRegular(join(plan.directory, 'maintenance.json'));
    assert.equal(sha(opBytes.bytes), fresh.operationSha256); const op = JSON.parse(opBytes.bytes); assertSameOperation(op, plan);
    for (const record of Object.values(state.processes)) assert.equal(await inspectOwnedProcess(record), 'running');
    await boundIntent(plan.request); await exactHistory(plan.request);
    const pool = poolFor(config, plan);
    try {
      assertView(await readRunnerMaintenance(pool, plan.request.runnerId), plan, 'draining', 19);
      await save(plan, 'hold-intent', { operationId: op.operationId, expectedVersion: 19, stateSha256: plan.request.stateSha256, requested: 'same-operation-hold-then-owned-runner-stop', originalIntentSha256: plan.request.originalSha256 });
      await commandRunnerMaintenance(pool, plan.request.runnerId, 'hold', { version: 19, operationId: op.operationId, reason: 'No active attempts; reserve the local update.' }, op.holdKey, 'trusted-host');
      const held = await readRunnerMaintenance(pool, plan.request.runnerId); assertView(held, plan, 'maintenance', 20);
      await save(plan, 'hold', held);
    } finally { await pool.end(); }
    await boundState(plan);
    const stopped = await stopOwnedProcess(state.processes.runner), confirmed = await inspectOwnedProcess(state.processes.runner);
    await save(plan, 'hold-stop', { outcome: stopped === 'stopped' && confirmed === 'stopped' ? 'held-runner-stopped' : 'unknown', stopped, confirmed,
      runnerRecordSha256: sha(JSON.stringify(state.processes.runner)), otherRoleSignals: 0 });
    assert.equal(stopped, 'stopped'); assert.equal(confirmed, 'stopped');
  });
}
async function retire(plan) {
  assert.equal((await read(runFile(plan, 'hold-stop'))).outcome, 'held-runner-stopped');
  const result = await retireIntent(plan.request, { withFence: (request, use) => withHostFence(request, use, { verifySource: () => verifySource(plan) }) });
  await save(plan, 'retirement', result); assert.equal(result.outcome, 'retired'); assert.equal(result.renamed, true);
  const journal = await readRegular(join(plan.directory, 'runner', plan.request.namespace, 'admission.json'));
  assert.equal(journal.bytes.length, 46); assert.equal(sha(journal.bytes), plan.idleSha256);
  await exactHistory(plan.request);
  const baseline = await read(runFile(plan, 'history-before')); compareHistory(baseline, await history(plan, 'history-retired'), 2, 0);
  const op = await read(join(plan.directory, 'maintenance.json')); assertSameOperation(op, plan);
  // Capture only real operation fields. This is evidence, never a fabricated state or ACK.
  await save(plan, 'operation', { operationId: op.operationId, initialVersion: op.initialVersion, phase: op.phase, backendArtifact: op.backendArtifact, originalClaimOutcome: 'UNKNOWN' });
}

export function assertBoundJournal(value, runnerId) {
  assert.equal(Object.keys(value).sort().join(','), 'assignments,opportunityId,runnerId,version');
  assert.equal(value.version, 2); assert.equal(value.runnerId, runnerId);
  assert.match(value.opportunityId, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
  jsonEqual(value.assignments, []);
}
async function observeBinding(plan) {
  const journal = await readRegular(join(plan.directory, 'runner', plan.request.namespace, 'admission.json'));
  const value = JSON.parse(journal.bytes); assertBoundJournal(value, plan.request.runnerId);
  await exactHistory(plan.request);
  return { version: value.version, runnerId: value.runnerId, assignments: 0, opportunityIdSha256: sha(value.opportunityId), bytes: journal.bytes.length,
    sha256: sha(journal.bytes), dev: journal.stat.dev, ino: journal.stat.ino, meaning: 'Bound initialization only; not a successful empty claim HTTP receipt.' };
}
async function paused(plan) {
  assert.equal((await read(runFile(plan, 'retirement'))).outcome, 'retired');
  await facts(plan, 'facts-paused'); await history(plan, 'history-paused');
  const result = await checkpoint(plan, plan.runDirectory);
  // checkpoint also proves every old group, especially the old center, absent before resume.
  await save(plan, 'checkpoint', { ...result, admission: await observeBinding(plan), actualClaimRecovery: 'UNKNOWN' });
}
async function final(plan) {
  assert.equal((await read(runFile(plan, 'checkpoint'))).outcome, 'ready-paused-preservation-confirmed');
  await facts(plan, 'facts-final');
  const result = await checkpoint(plan, plan.runDirectory, true);
  // User work may begin naturally after resume. This final record makes no invented claim receipt.
  await save(plan, 'final', { ...result, startupConfirmed: true, acceptingConfirmed: true, actualClaimRecovery: 'UNKNOWN',
    claimBoundary: 'No operator claim/model/task. A clean v2 journal, accepting, or a saved configuredProfile does not prove this process completed a claim request.' });
}

export async function checkEntrypoints(plan) {
  assertPreservedQueueContract(plan.request.confirmation);
  const before = JSON.parse(await readFile(plan.r4History));
  for (const table of plan.request.confirmation.tables) jsonEqual(table, before.tables.find(item => item.name === table.name));
  const root = await import(plan.rootMaintenanceModule), artifact = await import(plan.sourceArtifactMaintenanceModule);
  assert.equal(typeof root.maintainPreview, 'function'); assert.equal(typeof artifact.maintainPreview, 'function');
  for (const method of [snapshot, commandRunnerMaintenance, readRunnerMaintenance, retireIntent, withHostFence]) assert.equal(typeof method, 'function');
  return { outcome: 'entrypoints-available', pg: await checkRuntimeOnly(), personalIO: 0, sideEffects: 0 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const plan = await loadPlan(), [phase, run] = process.argv.slice(2);
    if (phase === '--check-entrypoints' && run === undefined) console.log(JSON.stringify(await checkEntrypoints(plan)));
    else {
      assert.equal(run, plan.runDirectory); assert.ok(['fresh', 'hold-stop', 'retire', 'paused', 'final'].includes(phase));
      await verifySource(plan);
      await ({ fresh, 'hold-stop': holdStop, retire, paused, final })[phase](plan);
      console.log(JSON.stringify({ phase, outcome: 'completed', providerQueries: 0 }));
    }
  } catch (error) { console.error(JSON.stringify({ outcome: 'UNKNOWN_KEEP', code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'CONTINUATION_GATE_FAILED' })); process.exitCode = 1; }
}
