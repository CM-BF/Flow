/** One metadata-only observation for the fixed held operation; never an execution permit. */
import assert from 'node:assert/strict';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTORY, ROOT, OLD_BACKEND, OPERATION, RUNNER, FILES, ROLES, sha, fingerprint, assertHeldSnapshot } from './policy.mjs';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
import { record, confirmMigrationRunner } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';

const expectedRunner = Object.freeze({ id: RUNNER, maintenance_state: 'maintenance', maintenance_version: 23, maintenance_operation_id: OPERATION });
const safe = error => ({ name: ['Error', 'TypeError', 'AssertionError'].includes(error?.name) ? error.name : 'UnknownError',
  code: /^(?:[A-Z0-9]{5}|ERR_ASSERTION|ENOENT|EACCES|EIO|ABORT_ERR)$/.test(error?.code ?? '') ? error.code : null });
export function freshArguments(argv) {
  assert.equal(argv.length, 2); assert.equal(argv[0], '--observe-held-once');
  assert.match(argv[1], /^\/private\/tmp\/flow-svc06-held-facts-[A-Za-z0-9_-]{1,48}\/facts\.json$/);
  return argv[1];
}
async function identity(path) {
  const info = await lstat(path, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(path), path); return { dev: String(info.dev), ino: String(info.ino) };
}
async function readBundle() {
  const installationIdentity = await identity(DIRECTORY), pins = {}, values = {};
  for (const name of FILES) {
    const path = join(DIRECTORY, name), { bytes, info } = await privateBytes(path, 65536);
    assert.equal(info.mode & 0o777, 0o600); assert.equal(await realpath(path), path);
    pins[name] = { dev: String(info.dev), ino: String(info.ino), bytes: bytes.length, sha256: sha(bytes) };
    // Authentication/policy files are hashed only; they are never parsed or projected.
    if (['config.json', 'state.json', 'maintenance.json', 'web-release.json'].includes(name)) values[name] = JSON.parse(bytes);
  }
  return { installationIdentity, pins, values };
}
export function projectHeldFacts(bundle) {
  assert.deepEqual(Object.keys(bundle.pins).sort(), [...FILES]);
  const config = bundle.values['config.json'], state = bundle.values['state.json'];
  assert.equal(config.directory, DIRECTORY); assert.equal(config.repository, ROOT);
  assert.equal(config.runner.runnerId, RUNNER); assert.equal(config.centerPort, 61227); assert.equal(config.webPort, 61228);
  const value = { state, operation: bundle.values['maintenance.json'], release: bundle.values['web-release.json'] };
  const processDigests = Object.fromEntries(ROLES.map(role => [role, sha(JSON.stringify(state.processes[role]))]));
  const digests = { stateDigest: fingerprint(state), operationDigest: fingerprint(value.operation), releaseDigest: fingerprint(value.release) };
  assertHeldSnapshot({ ...digests, migration: { processDigests } }, value);
  return { installationIdentity: bundle.installationIdentity, privateFiles: bundle.pins, ...digests, processDigests,
    operationId: OPERATION, version: 23, expectedRunner, source: state.source, backendArtifact: OLD_BACKEND,
    webHostArtifact: state.webHost.artifact, releaseVersion: value.release.version, currentWebArtifact: value.release.current };
}
async function loadModules() {
  const { loadCurrentMigrationModules } = await import('/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-browser-recovery/docs/evidence/svc06/browser-recovery/current-migration.mjs');
  const mod = await loadCurrentMigrationModules({ installationDirectory: DIRECTORY, repository: ROOT, expectedBackendArtifact: OLD_BACKEND },
    { validateInput(input) { assert.equal(input.installationDirectory, DIRECTORY); assert.equal(input.repository, ROOT); assert.deepEqual(input.expectedBackendArtifact, OLD_BACKEND); } });
  // The original verified cd27 public loader retains configuration/source authority.
  const config = await mod.preview.loadPreviewConfiguration(DIRECTORY);
  assert.equal(config.runner.runnerId, RUNNER); return { ...mod, config };
}
export async function collectHeldFacts({ read = readBundle, load = loadModules, confirmRunner = confirmMigrationRunner, now = () => performance.now() } = {}) {
  const started = now(), deadline = started + 27000;
  const remaining = () => assert.ok(now() < deadline, 'READ_DEADLINE');
  const result = { kind: 'SVC06B_HELD23_READONLY_FACTS', ready: false, at: new Date().toISOString(),
    outcome: 'UNKNOWN_KEEP', phase: 'files-before', databasePoolClosed: null, cleanup: [], personalWrites: 0, providerQueries: 0,
    databaseMarker: 'NOT_OBSERVED_THIS_ENTRY', actualClaim: 'NOT_OBSERVED' };
  try {
    remaining(); const before = await read(), projected = projectHeldFacts(before);
    result.phase = 'verified-old-loader'; remaining(); const mod = await load();
    const processes = {};
    for (const role of ROLES) {
      result.phase = 'stopped-' + role; remaining();
      processes[role] = await mod.process.inspectOwnedProcess(before.values['state.json'].processes[role]);
      assert.equal(processes[role], 'stopped', 'OLD_PROCESS_NOT_STOPPED');
    }
    result.phase = 'runner-readonly'; remaining();
    // Reuse its max1/SQL/timeouts/primary+end handling, without constructing another observer.
    await confirmRunner(mod.Pool, mod.config, expectedRunner); result.databasePoolClosed = true;
    result.phase = 'files-after'; remaining(); const after = await read();
    assert.deepEqual(after.installationIdentity, before.installationIdentity); assert.deepEqual(after.pins, before.pins, 'PRIVATE_CHANGED');
    assert.deepEqual(projectHeldFacts(after), projected);
    for (const role of ROLES) { remaining(); assert.equal(await mod.process.inspectOwnedProcess(after.values['state.json'].processes[role]), 'stopped'); }
    remaining(); Object.assign(result, projected, { processes, outcome: 'OBSERVED_HELD23_NOT_EXECUTION_AUTHORIZATION', phase: 'complete' });
  } catch (error) {
    result.primary = { phase: result.phase, ...safe(error) };
    // Existing confirmMigrationRunner preserves a secondary end error separately.
    if (error?.recordError) result.cleanup.push({ phase: 'pool-end', state: 'UNKNOWN' });
  }
  result.finishedAt = new Date().toISOString(); result.elapsedMs = Math.round(now() - started);
  result.boundary = 'Stable six-file observation and stopped old roles are point facts; actual recovery rechecks them under its locks. Missing/error remains unknown, no retry or service action.';
  return result;
}
export async function observeHeldOnce(output) {
  freshArguments(['--observe-held-once', output]); await identity(dirname(output));
  await lstat(output).then(() => { throw Error('OUTPUT_EXISTS'); }, error => { if (error.code !== 'ENOENT') throw error; });
  await record(join(dirname(output), 'intent.json'), { at: new Date().toISOString(), purpose: 'HELD23_READONLY_ONCE' });
  const result = await collectHeldFacts();
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 16384); await record(output, result);
  return { outcome: result.outcome, ready: false, databasePoolClosed: result.databasePoolClosed, primary: result.primary ?? null };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const result = await observeHeldOnce(freshArguments(process.argv.slice(2))); console.log(JSON.stringify(result));
    if (result.outcome !== 'OBSERVED_HELD23_NOT_EXECUTION_AUTHORIZATION') process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ outcome: 'UNKNOWN_KEEP', error: safe(error), evidencePersistence: 'NOT_CONFIRMED' })); process.exitCode = 1; }
}
