import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY, ROOT, OPERATION, RUNNER, TARGET, OLD_BACKEND, OLD_WEB, OLD_RETAINED, WEB_IDS, NEW_WEB,
  CONTEXT, PHASES, FILES, ROLES, sha, fingerprint, validatePlan, validateMigration, assertHeldSnapshot, assertTargetBound, assertBoot } from './policy.mjs';

export function example() {
  const processes = Object.fromEntries(ROLES.map((role, index) => [role, { pid: index + 100, group: index + 100, nonce: role }]));
  const state = { backendArtifact: OLD_BACKEND, source: { head: OLD_WEB.sourceHead, dirty: false }, webHost: { artifact: OLD_WEB }, processes };
  const operation = { operationId: OPERATION, phase: 'starting', backendArtifact: OLD_BACKEND, target: OLD_BACKEND.sourceHead };
  const release = { version: 3, current: WEB_IDS[2], artifacts: WEB_IDS.map(artifactId => ({ artifactId })) };
  const plan = { purpose: 'SVC06B_SAME_HELD_OPERATION_CONTINUATION', ready: true, operationId: OPERATION, version: 23,
    requestId: '11111111-1111-4111-8111-111111111111', runDirectory: '/private/tmp/flow-svc06-held-recovery-e15-continuation-20261007-once',
    operationDigest: fingerprint(operation), stateDigest: fingerprint(state), releaseDigest: fingerprint(release),
    context: CONTEXT, reports: [...WEB_IDS, NEW_WEB].map((artifactId, index) => ({ artifactId, sourceHead: TARGET.sourceHead,
      compatibilityId: String(index + 1).repeat(64), sha256: String(index + 1).repeat(64), bytes: 100,
      directory: '/private/tmp/reports/' + index, path: '/private/tmp/reports/' + index + '/report.json' })),
    publishNewWeb: false, providerQueries: 0, phases: PHASES,
    migration: { installationDirectory: DIRECTORY, repository: ROOT, sourceDirectory: '/private/tmp/flow-svc06b-recovery-r2-artifact-NXTN6t',
      runDirectory: '/private/tmp/flow-svc06-held-recovery-toy-migration', installationIdentity: { dev: '1', ino: '1' },
      sourceDirectoryIdentity: { dev: '16777234', ino: '124483635' }, runIdentity: null, artifact: TARGET, expectedBackendArtifact: OLD_BACKEND,
      expectedWebHostArtifact: OLD_WEB, expectedSource: { head: OLD_WEB.sourceHead, dirty: false },
      expectedRunner: { id: RUNNER, maintenance_state: 'maintenance', maintenance_version: 23, maintenance_operation_id: OPERATION },
      retainedArtifacts: [OLD_RETAINED, OLD_WEB, OLD_BACKEND], privateFiles: Object.fromEntries(FILES.map(name => [name, { bytes: 1, sha256: 'a'.repeat(64), dev: '1', ino: '1' }])),
      processDigests: Object.fromEntries(ROLES.map(role => [role, sha(JSON.stringify(processes[role]))])), ports: { center: 61227, web: 61228 },
      python: '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13',
      cloneDriver: { path: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/artifact-host-followup/clone-artifact.py', sha256: '05d19da5726ab251dcb3635bfc51514fd06c3c288e773913ba4ee427b587d3f6' },
      clone: { manifestBytes: 3196787, artifactEntries: 15629, artifactLogicalBytes: 363874705, cloneHelperSha256: 'c4911f0fc50009639a12fb8f24617916b1b8f2f116f0ba6ba7c55e74693cad62' },
      artifactTotalLogicalBytes: 367071492, budget: { freshBytes: 16635330560, liveBytes: 1073741824, addedBytes: 536870912, rawBytes: 2097152 } } };
  return { plan, before: { state, operation, release } };
}
test('fixed held contract separates selected backend, old Webhost and actual source', () => {
  const { plan, before } = example(); validatePlan(plan); assertHeldSnapshot(plan, before);
  const wrong = structuredClone(plan); wrong.migration.expectedWebHostArtifact = OLD_BACKEND;
  assert.throws(() => validatePlan(wrong));
  const changed = structuredClone(before); changed.operation.phase = 'resumed'; assert.throws(() => assertHeldSnapshot(plan, changed));
});
test('missing fresh inputs, report, changed operation/version, publish and replay phases are refused', () => {
  for (const mutate of [p => p.ready = false, p => p.reports.pop(), p => p.version++, p => p.operationId = 'x',
    p => p.publishNewWeb = true, p => p.phases = [...PHASES, 'bootstrap'], p => p.migration.expectedRunner.maintenance_state = 'accepting']) {
    const { plan } = example(); mutate(plan); assert.throws(() => validatePlan(plan));
  }
});
test('migration policy binds target bytes, exact identities and retained capacity input', () => {
  const { plan } = example(), input = { ...plan.migration, runIdentity: { dev: '1', ino: '2' } }; validateMigration(input);
  for (const change of [v => v.artifactTotalLogicalBytes++, v => v.clone.manifestBytes++, v => v.retainedArtifacts.pop(), v => delete v.privateFiles['state.json']]) {
    const value = structuredClone(input); change(value); assert.throws(() => validateMigration(value));
  }
});
test('operation write unknown and cleanup failure never permit refresh', () => {
  const value = { outcome: 'target-bound', mutation: 'observed-written', primary: null, cleanup: [], result: { operationId: OPERATION, version: 23, artifactId: TARGET.artifactId } };
  assertTargetBound(value);
  for (const change of [v => v.mutation = 'unknown', v => v.primary = { code: 'EIO' }, v => v.cleanup.push({ phase: 'pool-close' })]) {
    const input = structuredClone(value); change(input); assert.throws(() => assertTargetBound(input));
  }
});
test('checkpoint binds current boot, Web record, all roles and old groups; not a claim', () => {
  const { plan, before } = example(), state = structuredClone(before.state);
  state.backendArtifact = TARGET; state.source = { head: TARGET.sourceHead, dirty: false };
  state.webHost = { artifact: TARGET, selection: 'ready', recordSha256: sha(JSON.stringify(state.processes.web)) };
  const current = { state, release: before.release, operation: { operationId: OPERATION, phase: 'ready-paused', backendArtifact: TARGET },
    view: { runnerId: RUNNER, operationId: OPERATION, state: 'maintenance', version: 23, activeAttempts: 0, uncertainAttempts: 0 },
    initialization: true, processes: { center: 'running', runner: 'running', web: 'running' }, oldGroups: { center: 'absent', runner: 'absent', web: 'absent' } };
  assertBoot(plan, before, current);
  for (const change of [v => v.initialization = false, v => v.processes.runner = 'unknown', v => v.oldGroups.web = 'present',
    v => delete v.state.webHost.recordSha256, v => v.view.version++, v => v.release.current = NEW_WEB]) {
    const value = structuredClone(current); change(value); assert.throws(() => assertBoot(plan, before, value));
  }
});
test('actual caller imports without private reads, service launch, PG or native import', async () => {
  const value = await import('./caller.mjs'); assert.equal(typeof value.executePhase, 'function');
  assert.equal(typeof value.heldMigrationObserver, 'function');
  await assert.rejects(value.executePhase({ ready: false }, 'fresh'));
});
