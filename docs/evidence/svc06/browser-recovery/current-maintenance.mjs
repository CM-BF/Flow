/** Fixed artifact calls plus read-only gates. The product maintenance Module owns its FSM. */
import assert from 'node:assert/strict';
import { lstat, realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { invocationInput, readInstance } from './current-import.mjs';
import { admissionValidator, assertNoPendingRunnerFiles } from './runner-idle.mjs';
import { runnerFiles } from '../../svc05-history-compatibility/release-operation/runner-files.mjs';
import { snapshot as history } from '../update-diagnostics-candidate/history-projection.mjs';
import { snapshot as historicalFacts, bounded, durable } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { observeCurrentInstallation } from './current-migration.mjs';
import { verifyBackendArtifact } from '../../../../tools/personal-preview/backend-release/index.mjs';

export const phases = Object.freeze(['facts-before', 'preflight', 'history-before', 'bootstrap', 'operation', 'refresh',
  'facts-paused', 'history-paused', 'checkpoint', 'resume', 'facts-final', 'final']);
const json = async path => JSON.parse((await bounded(path, 131072)).bytes);
const at = path => import(pathToFileURL(path).href);
const same = assert.deepEqual;
export function artifactForPhase(plan, phase) {
  assert.ok(phases.includes(phase));
  return phases.indexOf(phase) >= phases.indexOf('refresh') ? plan.migration.artifact : plan.migration.expectedBackendArtifact;
}

export function validatePlan(plan) {
  assert.equal(plan.ready, true, 'FRESH_INSTANCE_AND_REPORTS_REQUIRED');
  invocationInput(plan.migration, { dev: '0', ino: '0' }); // Only validates parameters; no manufactured on-disk identity.
  assert.equal(plan.migration.installationDirectory, '/Users/citrine/.flow-personal');
  assert.equal(plan.migration.repository, '/Users/citrine/Projects/AgentHarness/Flow');
  assert.ok(isAbsolute(plan.runDirectory) && plan.runDirectory.startsWith('/private/tmp/flow-svc06b-'));
  assert.notEqual(plan.runDirectory, plan.migration.runDirectory);
  same(plan.context, { format: 1, publicOrigin: 'http://127.0.0.1:61228',
    policySha256: '81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638' });
  assert.equal(plan.reportIds.length, 3); assert.equal(new Set(plan.reportIds).size, 3);
  for (const id of plan.reportIds) assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(plan.initialVersion, plan.migration.expectedRunner.maintenance_version);
  assert.equal(plan.runnerId, plan.migration.expectedRunner.id);
  admissionValidator(plan.runnerId);
  same(Object.keys(plan.runnerDirectoryIdentity).sort(), ['dev', 'ino']);
  for (const value of Object.values(plan.runnerDirectoryIdentity)) assert.match(value, /^(0|[1-9][0-9]*)$/);
  assert.equal(plan.migration.privateFiles['browser-session.json'].sha256, plan.policyPin.file.sha256);
  same(plan.retainedWebIds, ['461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90',
    'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe',
    'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88']);
  assert.equal(plan.budget.rawBytes, 2 * 1024 ** 2); assert.equal(plan.budget.liveBytes, 1024 ** 3);
  assert.ok(plan.budget.freshBytes >= 2.5 * 1024 ** 3);
  assert.equal(plan.budget.perPhaseOutputBytes, 65536);
  return plan;
}

export function invocation(plan, phase, node, planPath, digest) {
  assert.ok(phases.includes(phase)); assert.ok(isAbsolute(planPath)); assert.match(digest, /^[a-f0-9]{64}$/);
  const artifact = artifactForPhase(plan, phase);
  const root = join(plan.migration.installationDirectory, 'backend-artifacts', artifact.artifactId, 'root');
  return { name: phase, argv: [node, '--import', join(root, 'node_modules/tsx/dist/loader.mjs'),
    fileURLToPath(import.meta.url), '--phase', phase, planPath, digest], cwd: root,
    ownership: 'childPidOnly', maximumWorkSeconds: phase === 'refresh' ? 180 : 60 };
}

async function modules(plan, phase) {
  const input = plan.migration, artifact = artifactForPhase(plan, phase);
  const root = join(input.installationDirectory, 'backend-artifacts', artifact.artifactId, 'root');
  const verified = await verifyBackendArtifact({ directory: input.installationDirectory, artifact });
  assert.equal(verified.root, root); assert.equal(verified.manifest.sourceRepository, input.repository);
  const tools = join(root, 'tools/personal-preview');
  const preview = await at(join(tools, 'preview.mjs'));
  return { preview, process: await at(join(tools, 'process.mjs')), web: await at(join(tools, 'web-release.mjs')),
    browser: await at(join(tools, 'browser-session-configuration.mjs')),
    history: { Pool: createRequire(join(root, 'package.json'))('pg').Pool, loadPreviewConfiguration: preview.loadPreviewConfiguration,
      assertPreviewMarker: preview.assertPreviewMarker } };
}

async function maintain(plan, action) {
  const input = plan.migration, next = ['refresh', 'resume'].includes(action);
  const artifact = next ? input.artifact : input.expectedBackendArtifact;
  const verified = await verifyBackendArtifact({ directory: input.installationDirectory, artifact });
  assert.equal(verified.manifest.sourceRepository, input.repository);
  const { maintainPreview } = await at(join(verified.root, 'tools/personal-preview/maintenance-host.mjs'));
  return maintainPreview({ directory: input.installationDirectory, action,
    ...(action === 'bootstrap' ? { backendId: input.artifact.artifactId } : {}),
    ...(action === 'refresh' ? { target: input.artifact.sourceHead } : {}) });
}

async function configured(plan, mod) {
  const directory = plan.migration.installationDirectory, config = await mod.preview.loadPreviewConfiguration(directory);
  const browser = await mod.browser.readBrowserSessionConfiguration(config);
  same(browser.context, plan.context); same(browser.pin, plan.policyPin);
  const release = await mod.web.readWebRelease(directory);
  same(release.artifacts.map(artifact => artifact.artifactId).sort(), [...plan.retainedWebIds].sort());
  const loaded = await mod.web.loadReleaseAssets({ directory, release,
    expectedBackendHead: plan.migration.artifact.sourceHead, expectedContext: plan.context });
  same(Object.values(loaded.verifiedTuple.compatibilityIds).sort(), [...plan.reportIds].sort());
  return { tuple: loaded.verifiedTuple, policyPin: browser.pin };
}

export function preserveHistory(before, after, auditAdded) {
  same(after.identity, before.identity); same(after.omittedColumns, before.omittedColumns);
  assert.equal(after.tables.length, before.tables.length);
  for (const prior of before.tables) {
    const current = after.tables.find(row => row.name === prior.name); assert.ok(current); same(current.columns, prior.columns);
    const added = prior.name === 'runner_maintenance_audit' ? auditAdded : 0;
    assert.equal(current.count, prior.count + added, 'HISTORY_ROW_COUNT_CHANGED:' + prior.name);
    if (added) {
      const remaining = [...current.row_hashes];
      for (const hash of prior.row_hashes) { const index = remaining.indexOf(hash); assert.ok(index >= 0, 'OLD_HISTORY_ROW_CHANGED'); remaining.splice(index, 1); }
      assert.equal(remaining.length, added);
    } else assert.equal(current.digest, prior.digest, 'HISTORY_OLD_COLUMNS_CHANGED:' + prior.name);
  }
}

function preserveFacts(before, after) {
  for (const name of ['rootIdentity', 'identity', 'release', 'retained']) same(after[name], before[name]);
  for (const name of ['config.json', 'claude.json', 'web-release.json']) same(after.files[name], before.files[name]);
  assert.ok(after.database.markerMatched && after.database.runnerIdentityMatched);
  assert.ok(Object.values(after.processes).every(value => value.identity === 'running'));
  assert.ok(Object.values(after.listeners).every(Boolean)); assert.equal(after.lock, 'absent');
}

async function operation(plan, mod) {
  const directory = plan.migration.installationDirectory, op = await mod.preview.readPreviewJson(join(directory, 'maintenance.json'));
  const view = (await json(join(plan.runDirectory, 'bootstrap.json'))).view;
  same(op.backendArtifact, plan.migration.artifact); assert.equal(op.target, plan.migration.artifact.sourceHead);
  assert.equal(op.operationId, view.operationId); assert.equal(op.initialVersion, plan.initialVersion); assert.equal(op.phase, 'drain-requested');
  assert.equal(view.state, 'draining'); assert.equal(view.version, plan.initialVersion + 1);
  assert.equal(view.activeAttempts, 0); assert.equal(view.uncertainAttempts, 0);
  const first = await maintain(plan, 'status'); same(first, view);
  const baseUrl = 'http://127.0.0.1:61227', root = join(directory, 'runner');
  const sample = await runnerFiles(root, baseUrl, undefined, { validateAdmission: admissionValidator(plan.runnerId) });
  same({ dev: String(sample.dev), ino: String(sample.ino) }, plan.runnerDirectoryIdentity);
  const admission = assertNoPendingRunnerFiles(sample);
  const second = await runnerFiles(root, baseUrl, undefined, { validateAdmission: admissionValidator(plan.runnerId) });
  same(second.files, sample.files); same({ dev: second.dev, ino: second.ino }, { dev: sample.dev, ino: sample.ino });
  same(await maintain(plan, 'status'), first); same(await mod.preview.readPreviewJson(join(directory, 'maintenance.json')), op);
  return { outcome: 'new-operation-confirmed-idle', operationId: op.operationId, view: first, native: sample, admission,
    boundary: 'Complete bounded non-atomic inventory; v2 opportunity is not a claim receipt. No retirement or replay.' };
}

async function checkpoint(plan, mod, final) {
  const directory = plan.migration.installationDirectory;
  const before = (await json(join(plan.runDirectory, 'facts-before.json'))).facts;
  const current = (await json(join(plan.runDirectory, final ? 'facts-final.json' : 'facts-paused.json'))).facts;
  preserveFacts(before, current);
  same(current.runtimeSource, { head: plan.migration.artifact.sourceHead, dirty: false });
  const op = await mod.preview.readPreviewJson(join(directory, 'maintenance.json'));
  const confirmed = await json(join(plan.runDirectory, 'operation.json'));
  assert.equal(op.operationId, confirmed.operationId); same(op.backendArtifact, plan.migration.artifact);
  assert.equal(op.phase, final ? 'resumed' : 'ready-paused');
  const state = await mod.preview.readPreviewJson(join(directory, 'state.json'));
  same(state.backendArtifact, plan.migration.artifact); same(state.webHost.artifact, plan.migration.expectedWebHostArtifact);
  assert.equal(state.pendingWebHost ?? null, null);
  assert.equal(current.database.runner.length, 1); const runner = current.database.runner[0];
  assert.equal(runner.id, plan.runnerId); assert.equal(runner.maintenance_state, final ? 'accepting' : 'maintenance');
  assert.equal(runner.maintenance_version, plan.initialVersion + (final ? 3 : 2));
  assert.equal(runner.maintenance_operation_id, final ? null : op.operationId);
  const oldGroups = [];
  for (const [role, record] of Object.entries(before.processes)) {
    let absent = false; try { process.kill(-record.group, 0); } catch (error) { if (error.code === 'ESRCH') absent = true; else throw error; }
    assert.ok(absent, 'OLD_GROUP_NOT_ABSENT:' + role); oldGroups.push({ role, group: record.group, absent });
  }
  same(current.database.migrations, before.database.migrations);
  if (!final) {
    assert.equal(current.database.unfinished.length, 0); assert.equal(current.database.uncertain.length, 0);
    preserveHistory(await json(join(plan.runDirectory, 'history-before.json')), await json(join(plan.runDirectory, 'history-paused.json')), 2);
  } else assert.equal((await json(join(plan.runDirectory, 'checkpoint.json'))).outcome, 'ready-paused-preservation-confirmed');
  return { outcome: final ? 'resumed-confirmed' : 'ready-paused-preservation-confirmed', operationId: op.operationId,
    runner, oldGroups, configured: await configured(plan, mod), processes: current.processes, runtimeSource: current.runtimeSource,
    actualClaimRecovery: 'UNKNOWN', boundary: final ? 'User work after explicit resume is observed separately; no synthetic claim/model request.'
      : 'Same old columns and rows; no new migrations, exactly drain+hold audit rows. Any unexplained change stops before resume.' };
}

export async function runPhase(plan, phase) {
  validatePlan(plan); assert.ok(phases.includes(phase));
  const st = await lstat(plan.runDirectory); assert.ok(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid() && (st.mode & 0o777) === 0o700);
  assert.equal(await realpath(plan.runDirectory), plan.runDirectory);
  const mod = await modules(plan, phase), output = join(plan.runDirectory, phase + '.json');
  let value;
  if (phase.startsWith('facts-')) {
    // The helper's af51 report lookup only preserves the historical pointer. configured() checks actual new backend04da/context separately.
    value = { outcome: 'observed', facts: await historicalFacts({ findCompatibility: mod.web.findWebCompatibility }) };
  } else if (phase.startsWith('history-')) {
    return history(output, phase === 'history-paused' ? join(plan.runDirectory, 'history-before.json') : undefined, mod.history);
  } else if (phase === 'preflight') {
    value = { outcome: 'preflight-confirmed', installation: await observeCurrentInstallation(mod, plan.migration), configured: await configured(plan, mod) };
  } else if (phase === 'operation') value = await operation(plan, mod);
  else if (phase === 'checkpoint' || phase === 'final') value = await checkpoint(plan, mod, phase === 'final');
  else {
    if (phase === 'resume') {
      const saved = await json(join(plan.runDirectory, 'checkpoint.json'));
      assert.equal(saved.outcome, 'ready-paused-preservation-confirmed');
      const fresh = await checkpoint(plan, mod, false); assert.equal(fresh.operationId, saved.operationId);
    }
    value = { outcome: 'public-maintenance-returned', action: phase, view: await maintain(plan, phase) };
  }
  await durable(output, { at: new Date().toISOString(), ...value });
  return { phase, outcome: value.outcome };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, phase, path, digest, ...extra] = process.argv.slice(2);
    assert.equal(action, '--phase'); assert.equal(extra.length, 0);
    console.log(JSON.stringify(await runPhase(await readInstance(path, digest), phase)));
  } catch (error) { console.error(JSON.stringify({ outcome: 'unknown-keep', code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'CURRENT_MAINTENANCE_GATE_FAILED' })); process.exitCode = 1; }
}
