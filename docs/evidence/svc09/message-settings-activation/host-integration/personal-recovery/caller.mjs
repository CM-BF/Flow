/** Fixed public entrypoints around the held operation; no maintenance FSM or supervisor. */
import assert from 'node:assert/strict';
import { lstat, realpath, mkdir } from 'node:fs/promises';
import { statfsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DIRECTORY, OPERATION, RUNNER, TARGET, OLD_BACKEND, CONTEXT, PHASES, FILES, ROLES,
  sha, fingerprint, validateMigration, validatePlan, assertHeldSnapshot, targetRequest, assertTargetBound, assertBoot } from './policy.mjs';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
import { record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';

const PEER = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-browser-recovery';
const at = path => import(pathToFileURL(path).href);
const json = async path => JSON.parse((await privateBytes(path, 131072)).bytes);
const pathFor = (plan, name) => join(plan.runDirectory, name + '.json');
async function directory(path, expected) {
  const info = await lstat(path, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(path), path);
  const identity = { dev: String(info.dev), ino: String(info.ino) };
  if (expected) assert.deepEqual(identity, expected); return identity;
}
async function pinnedPrivate(input, names = FILES) {
  const observed = {};
  await directory(DIRECTORY, input.installationIdentity);
  for (const name of names) {
    const pin = input.privateFiles[name], path = join(DIRECTORY, name), { bytes, info } = await privateBytes(path, pin.bytes);
    assert.equal(await realpath(path), path); assert.equal(info.mode & 0o777, 0o600);
    assert.equal(String(info.dev), pin.dev); assert.equal(String(info.ino), pin.ino);
    assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256);
    observed[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  return observed;
}
async function snapshot(mod) {
  return { state: await mod.preview.readPreviewJson(join(DIRECTORY, 'state.json')),
    operation: await mod.preview.readPreviewJson(join(DIRECTORY, 'maintenance.json')),
    release: await mod.preview.readPreviewJson(join(DIRECTORY, 'web-release.json')) };
}
// Called repeatedly INSIDE the existing migration lock, including before exclusive rename.
export function heldMigrationObserver(plan) {
  return async (mod, input) => {
    const files = await pinnedPrivate(input), value = await snapshot(mod);
    assertHeldSnapshot(plan, value);
    for (const role of ROLES) assert.equal(await mod.process.inspectOwnedProcess(value.state.processes[role]), 'stopped', 'OLD_OWNED_PROCESS_UNKNOWN');
    return { files, source: value.state.source, backendArtifact: value.state.backendArtifact,
      webHostArtifact: value.state.webHost.artifact, processDigests: input.processDigests };
  };
}
async function modules(plan, artifact) {
  const migration = await at(join(PEER, 'docs/evidence/svc06/browser-recovery/current-migration.mjs'));
  // The old legal loader remains the configuration authority until rebind is committed.
  const old = await migration.loadCurrentMigrationModules({ ...plan.migration, runIdentity: { dev: '0', ino: '0' } }, { validateInput: validateMigration });
  const verified = await old.backend.verifyBackendArtifact({ directory: DIRECTORY, artifact });
  assert.equal(verified.manifest.sourceRepository, plan.migration.repository);
  const root = join(DIRECTORY, 'backend-artifacts', artifact.artifactId, 'root'); assert.equal(verified.root, root);
  const tools = join(root, 'tools/personal-preview');
  const preview = await at(join(tools, 'preview.mjs'));
  return { ...old, migration, oldPreview: old.preview, preview,
    process: await at(join(tools, 'process.mjs')), web: await at(join(tools, 'web-release.mjs')),
    browser: await at(join(tools, 'browser-session-configuration.mjs')),
    maintain: (await at(join(tools, 'maintenance-host.mjs'))).maintainPreview,
    diagnostics: await at(join(tools, 'startup-diagnostics.mjs')),
    target: artifact === TARGET ? await at(join(tools, 'maintenance-target.mjs')) : null,
    Pool: createRequire(join(root, 'package.json'))('pg').Pool };
}
async function history(plan, mod, name, baseline) {
  const port = await at(join(PEER, 'docs/evidence/svc06/update-diagnostics-candidate/history-projection.mjs'));
  await port.snapshot(pathFor(plan, name), baseline && pathFor(plan, baseline),
    { Pool: mod.Pool, loadPreviewConfiguration: mod.preview.loadPreviewConfiguration, assertPreviewMarker: mod.preview.assertPreviewMarker });
  return json(pathFor(plan, name));
}
async function configured(plan, mod) {
  const config = await mod.preview.loadPreviewConfiguration(DIRECTORY);
  await mod.preview.assertPreviewMarker(config); assert.equal(config.runner.runnerId, RUNNER);
  const policy = await mod.browser.readBrowserSessionConfiguration(config); assert.deepEqual(policy.context, CONTEXT);
  assert.equal(policy.pin.file.sha256, plan.migration.privateFiles['browser-session.json'].sha256);
  const release = await mod.web.readWebRelease(DIRECTORY);
  const value = await mod.web.loadReleaseAssets({ directory: DIRECTORY, release, expectedBackendHead: TARGET.sourceHead, expectedContext: CONTEXT });
  const expected = Object.fromEntries(plan.reports.filter(item => release.artifacts.some(artifact => artifact.artifactId === item.artifactId))
    .map(item => [item.artifactId, item.compatibilityId]));
  assert.deepEqual(value.verifiedTuple.compatibilityIds, expected); return { config, tuple: value.verifiedTuple };
}
async function boot(plan, mod, final, historyName) {
  const before = (await json(pathFor(plan, 'fresh'))).snapshot;
  await pinnedPrivate(plan.migration, ['browser-session.json', 'claude.json', 'config.json', 'web-release.json']);
  const value = await snapshot(mod), processes = {}, oldGroups = {};
  for (const role of ROLES) {
    processes[role] = await mod.process.inspectOwnedProcess(value.state.processes[role]);
    const group = before.state.processes[role].group; assert.ok(Number.isSafeInteger(group) && group > 1);
    try { process.kill(-group, 0); oldGroups[role] = 'present'; }
    catch (error) { if (error.code !== 'ESRCH') throw error; oldGroups[role] = 'absent'; }
  }
  const view = await mod.maintain({ directory: DIRECTORY, action: 'status' });
  const initialization = await mod.diagnostics.readRunnerInitialization({ directory: DIRECTORY, recordKey: 'runner', record: value.state.processes.runner, runnerId: RUNNER });
  assertBoot(plan, before, { ...value, processes, oldGroups, view, initialization }, final);
  const tuple = await configured(plan, mod);
  if (!final) {
    const after = await history(plan, mod, historyName, 'history-before');
    const { preserveHistory } = await at(join(PEER, 'docs/evidence/svc06/browser-recovery/current-maintenance.mjs'));
    preserveHistory(await json(pathFor(plan, 'history-before')), after, 0);
  }
  return { outcome: final ? 'resumed-confirmed' : 'ready-paused-preservation-confirmed', view, processes, oldGroups,
    initialization, tuple: tuple.tuple, stateDigest: fingerprint(value.state), operationDigest: fingerprint(value.operation),
    actualClaim: 'NOT_OBSERVED', boundary: 'Initialization and accepting are separate from a user assignment; no synthetic work was submitted.' };
}
export async function executePhase(plan, phase, healthy = () => {}) {
  validatePlan(plan); assert.ok(PHASES.includes(phase)); await directory(plan.runDirectory);
  const index = PHASES.indexOf(phase);
  if (index) assert.equal((await json(pathFor(plan, PHASES[index - 1]))).complete, true, 'PREVIOUS_PHASE_UNCONFIRMED');
  await record(pathFor(plan, phase + '-intent'), { at: new Date().toISOString(), phase, operationId: OPERATION }); // Never replay a consumed phase.
  let value, primary;
  try {
    healthy(); const mod = await modules(plan, index <= PHASES.indexOf('import-reports') ? OLD_BACKEND : TARGET); healthy();
    if (phase === 'fresh') {
      await heldMigrationObserver(plan)(mod, plan.migration);
      const view = await mod.maintain({ directory: DIRECTORY, action: 'status' });
      assert.equal(view.state, 'maintenance'); assert.equal(view.version, 23); assert.equal(view.operationId, OPERATION);
      assert.equal(view.activeAttempts, 0); assert.equal(view.uncertainAttempts, 0);
      await history(plan, mod, 'history-before');
      value = { snapshot: await snapshot(mod), view };
    } else if (phase === 'import-artifact') {
      await mkdir(plan.migration.runDirectory, { mode: 0o700 });
      const input = { ...plan.migration, runIdentity: await directory(plan.migration.runDirectory) };
      await mod.migration.migrateCurrentArtifact(mod, input, healthy, { validateInput: validateMigration, observeInstallation: heldMigrationObserver(plan) });
      const result = await json(join(input.runDirectory, 'migration-result.json'));
      assert.ok(['migrated', 'already-present-exact'].includes(result.outcome), 'IMPORT_UNCONFIRMED');
      value = { outcome: 'new-artifact-imported', artifact: TARGET };
    } else if (phase === 'import-reports') {
      await heldMigrationObserver(plan)(mod, plan.migration);
      const ids = [];
      for (const item of plan.reports) {
        const { bytes } = await privateBytes(item.path, item.bytes); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256);
        const report = JSON.parse(bytes); assert.equal(report.backendHead, TARGET.sourceHead); assert.equal(report.artifact.artifactId, item.artifactId);
        assert.deepEqual(report.context, CONTEXT);
        const imported = await mod.preview.importPreviewCompatibility({ directory: DIRECTORY, reportDirectory: item.directory });
        assert.equal(imported.compatibilityId, item.compatibilityId); ids.push(imported.compatibilityId); healthy();
      }
      await heldMigrationObserver(plan)(mod, plan.migration); value = { outcome: 'four-fixed-reports-imported', ids, published: false };
    } else if (phase === 'rebind') {
      value = await mod.target.rebindHeldPreviewTarget(targetRequest(plan), { loadCurrentConfiguration: mod.oldPreview.loadPreviewConfiguration });
      await record(pathFor(plan, 'target-result'), value); assertTargetBound(value);
    } else if (phase === 'refresh') {
      assertTargetBound(await json(pathFor(plan, 'target-result')));
      value = await mod.maintain({ directory: DIRECTORY, action: 'refresh', target: TARGET.sourceHead });
      assert.equal(value.state, 'maintenance'); assert.equal(value.version, 23); assert.equal(value.operationId, OPERATION);
    } else if (phase === 'checkpoint') value = await boot(plan, mod, false, 'history-paused');
    else if (phase === 'resume') {
      const saved = await json(pathFor(plan, 'checkpoint')); assert.equal(saved.outcome, 'ready-paused-preservation-confirmed');
      const fresh = await boot(plan, mod, false, 'history-before-resume');
      assert.equal(fresh.stateDigest, saved.stateDigest); assert.equal(fresh.operationDigest, saved.operationDigest);
      value = await mod.maintain({ directory: DIRECTORY, action: 'resume' });
      assert.equal(value.state, 'accepting'); assert.equal(value.version, 24);
    } else value = await boot(plan, mod, true);
    healthy(); await record(pathFor(plan, phase), { ...value, phase, complete: true });
    return { phase, complete: true, providerQueries: 0 };
  } catch (error) { primary = error; }
  const code = /^[A-Z0-9_]{1,64}$/.test(primary?.code ?? '') ? primary.code : null;
  await record(pathFor(plan, phase + '-failure'), { phase, code, outcome: 'UNKNOWN_KEEP_NO_RETRY', cleanup: 'Not inferred from caller exit' }).catch(() => {});
  throw primary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [mode, phase, inputPath, digest, seconds, ...extra] = process.argv.slice(2);
    assert.equal(mode, '--phase'); assert.equal(extra.length, 0); assert.match(digest, /^[a-f0-9]{64}$/);
    const { bytes, info } = await privateBytes(inputPath, 131072); assert.equal(info.mode & 0o777, 0o600);
    assert.equal(sha(bytes), digest); assert.equal(await realpath(inputPath), inputPath);
    const plan = validatePlan(JSON.parse(bytes)), deadline = Number(seconds);
    assert.ok(Number.isFinite(deadline) && deadline > Date.now() && deadline - Date.now() <= 900000);
    const healthy = () => { assert.ok(Date.now() < deadline, 'DEADLINE_EXPIRED'); const space = statfsSync(DIRECTORY); assert.ok(Number(space.bavail) * Number(space.bsize) >= plan.migration.budget.liveBytes, 'LIVE_SPACE_GATE'); };
    console.log(JSON.stringify(await executePhase(plan, phase, healthy)));
  } catch (error) {
    console.error(JSON.stringify({ outcome: 'UNKNOWN_KEEP_NO_RETRY', code: /^[A-Z0-9_]{1,64}$/.test(error.code ?? '') ? error.code : null })); process.exitCode = 1;
  }
}
