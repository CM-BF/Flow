/** One reviewed recovery target. Input JSON supplies observations, never implementations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';

export const ROOT = '/Users/citrine/Projects/AgentHarness/Flow';
export const DIRECTORY = '/Users/citrine/.flow-personal';
export const OPERATION = '35d5a7ff-5ef7-4938-9584-adb27f5357ff';
export const RUNNER = 'd22f4df2-8242-49f4-a1b4-77f8f08611ef';
const descriptor = (artifactId, sourceHead) => Object.freeze({ policy: 'flow.backend-artifact.v1', artifactId, manifestDigest: artifactId, sourceHead });
export const TARGET = descriptor('b69296ade85aa19a767a28ab53a25ddd7e37841538f0120b346bc8f03f45810d', 'f37a3612068c7215994750574a7451ede841bcce');
export const OLD_BACKEND = descriptor('cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b', '04da80692e79e2b7c3f6341c7fa76515a3f719a3');
export const OLD_WEB = descriptor('7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920', '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
export const OLD_RETAINED = descriptor('c7b85f49cf077460402083cfed577b034a19d256c8592020115d28512060542d', '422f4b150e5801d6010e5bbd6b53574e35384f87');
export const WEB_IDS = Object.freeze(['461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90',
  'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe',
  'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88']);
export const NEW_WEB = '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4';
export const CONTEXT = Object.freeze({ format: 1, publicOrigin: 'http://127.0.0.1:61228', policySha256: '81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638' });
export const PHASES = Object.freeze(['fresh', 'import-artifact', 'import-reports', 'rebind', 'refresh', 'checkpoint', 'resume', 'final']);
export const FILES = Object.freeze(['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json']);
export const ROLES = Object.freeze(['center', 'runner', 'web']);
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, (_, current) => current && !Array.isArray(current) && typeof current === 'object'
  ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current);
export const fingerprint = value => sha(canonical(value));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
export function identity(value) {
  assert.deepEqual(Object.keys(value).sort(), ['dev', 'ino']);
  for (const item of Object.values(value)) assert.match(item, /^(0|[1-9][0-9]*)$/);
}
export function validateMigration(input) {
  assert.equal(input.installationDirectory, DIRECTORY); assert.equal(input.repository, ROOT);
  assert.deepEqual(input.artifact, TARGET); assert.deepEqual(input.expectedBackendArtifact, OLD_BACKEND);
  assert.deepEqual(input.expectedWebHostArtifact, OLD_WEB);
  assert.deepEqual(input.expectedSource, { head: OLD_WEB.sourceHead, dirty: false });
  assert.deepEqual(input.expectedRunner, { id: RUNNER, maintenance_state: 'maintenance', maintenance_version: 23, maintenance_operation_id: OPERATION });
  assert.deepEqual(input.retainedArtifacts, [OLD_RETAINED, OLD_WEB, OLD_BACKEND]);
  for (const name of ['installationIdentity', 'sourceDirectoryIdentity', 'runIdentity']) identity(input[name]);
  assert.equal(input.sourceDirectory, '/private/tmp/flow-svc06b-recovery-artifact-6SJcHt');
  assert.ok(isAbsolute(input.runDirectory) && input.runDirectory.startsWith('/private/tmp/flow-svc06-held-recovery-'));
  assert.deepEqual(Object.keys(input.privateFiles).sort(), [...FILES]);
  for (const pin of Object.values(input.privateFiles)) {
    assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 65536); hash(pin.sha256);
    identity({ dev: pin.dev, ino: pin.ino });
  }
  assert.deepEqual(Object.keys(input.processDigests).sort(), [...ROLES]);
  for (const digest of Object.values(input.processDigests)) hash(digest);
  assert.deepEqual(input.ports, { center: 61227, web: 61228 });
  assert.equal(input.python, '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13');
  assert.equal(input.cloneDriver.path, '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/artifact-host-followup/clone-artifact.py');
  assert.equal(input.cloneDriver.sha256, '05d19da5726ab251dcb3635bfc51514fd06c3c288e773913ba4ee427b587d3f6');
  assert.deepEqual(input.clone, { manifestBytes: 3196787, artifactEntries: 15629, artifactLogicalBytes: 363874679,
    cloneHelperSha256: 'c4911f0fc50009639a12fb8f24617916b1b8f2f116f0ba6ba7c55e74693cad62' });
  assert.equal(input.artifactTotalLogicalBytes, 367071466);
  assert.ok(input.budget.freshBytes >= 2.5 * 1024 ** 3); assert.equal(input.budget.liveBytes, 1024 ** 3);
  assert.equal(input.budget.addedBytes, 512 * 1024 ** 2); assert.equal(input.budget.rawBytes, 2 * 1024 ** 2);
}
export function validatePlan(plan) {
  assert.equal(plan.purpose, 'SVC06B_SAME_HELD_OPERATION_RECOVERY');
  assert.equal(plan.ready, true, 'FRESH_FACTS_AND_FOUR_REPORTS_REQUIRED');
  assert.equal(plan.operationId, OPERATION); assert.equal(plan.version, 23);
  assert.match(plan.requestId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(plan.migration.runIdentity, null, 'MIGRATION_DIRECTORY_MUST_BE_EXCLUSIVE');
  validateMigration({ ...plan.migration, runIdentity: { dev: '0', ino: '0' } }); // No on-disk identity is manufactured.
  assert.ok(isAbsolute(plan.runDirectory) && plan.runDirectory.startsWith('/private/tmp/flow-svc06-held-recovery-'));
  assert.notEqual(plan.runDirectory, plan.migration.runDirectory);
  for (const name of ['operationDigest', 'stateDigest', 'releaseDigest']) hash(plan[name]);
  assert.deepEqual(plan.context, CONTEXT);
  assert.equal(plan.reports.length, 4); assert.equal(new Set(plan.reports.map(item => item.compatibilityId)).size, 4);
  assert.deepEqual(plan.reports.map(item => item.artifactId).sort(), [...WEB_IDS, NEW_WEB].sort());
  for (const item of plan.reports) {
    hash(item.compatibilityId); assert.equal(item.sourceHead, TARGET.sourceHead);
    assert.ok(isAbsolute(item.directory)); assert.equal(item.path, join(item.directory, 'report.json'));
    assert.equal(item.sha256, item.compatibilityId); assert.ok(item.bytes > 0 && item.bytes <= 65536);
  }
  assert.equal(plan.publishNewWeb, false); assert.equal(plan.providerQueries, 0);
  assert.deepEqual(plan.phases, PHASES); return plan;
}
export function assertHeldSnapshot(plan, value) {
  const { state, operation, release } = value;
  assert.equal(fingerprint(state), plan.stateDigest); assert.equal(fingerprint(operation), plan.operationDigest);
  assert.equal(fingerprint(release), plan.releaseDigest);
  assert.deepEqual(state.backendArtifact, OLD_BACKEND); assert.deepEqual(state.webHost.artifact, OLD_WEB);
  assert.deepEqual(state.source, { head: OLD_WEB.sourceHead, dirty: false }); assert.equal(state.pendingWebHost ?? null, null);
  assert.equal(operation.operationId, OPERATION); assert.equal(operation.phase, 'starting');
  assert.deepEqual(operation.backendArtifact, OLD_BACKEND); assert.equal(operation.target, OLD_BACKEND.sourceHead);
  assert.equal(operation.slots, undefined); assert.equal(operation.webHostTarget, undefined);
  assert.equal(release.version, 3); assert.equal(release.current, WEB_IDS[2]);
  assert.deepEqual(release.artifacts.map(item => item.artifactId).sort(), [...WEB_IDS].sort());
  assert.deepEqual(Object.keys(state.processes).sort(), ROLES);
  for (const role of ROLES) assert.equal(sha(JSON.stringify(state.processes[role])), plan.migration.processDigests[role]);
}
export function targetRequest(plan) {
  return { directory: DIRECTORY, operationId: OPERATION, requestId: plan.requestId, expectedVersion: 23,
    expectedOperationDigest: plan.operationDigest, expectedStateDigest: plan.stateDigest,
    expectedWebReleaseDigest: plan.releaseDigest, expectedBackendArtifact: OLD_BACKEND,
    expectedWebHostArtifact: OLD_WEB, targetArtifact: TARGET };
}
export function assertTargetBound(value) {
  assert.equal(value.outcome, 'target-bound'); assert.equal(value.mutation, 'observed-written');
  assert.equal(value.primary, null); assert.deepEqual(value.cleanup, []);
  assert.equal(value.result.operationId, OPERATION); assert.equal(value.result.version, 23);
  assert.equal(value.result.artifactId, TARGET.artifactId);
}
export function assertBoot(plan, before, current, final = false) {
  const { state, operation, release, view, initialization, processes, oldGroups } = current;
  assert.deepEqual(release, before.release); assert.equal(operation.operationId, OPERATION);
  assert.equal(operation.phase, final ? 'resumed' : 'ready-paused'); assert.deepEqual(operation.backendArtifact, TARGET);
  assert.deepEqual(state.backendArtifact, TARGET); assert.deepEqual(state.webHost.artifact, TARGET);
  assert.deepEqual(state.source, { head: TARGET.sourceHead, dirty: false }); assert.equal(state.pendingWebHost ?? null, null);
  assert.equal(state.webHost.selection, 'ready'); assert.equal(state.webHost.recordSha256, sha(JSON.stringify(state.processes.web)));
  assert.equal(view.state, final ? 'accepting' : 'maintenance'); assert.equal(view.version, final ? 24 : 23);
  assert.equal(view.runnerId, RUNNER); assert.equal(view.operationId, final ? null : OPERATION);
  if (!final) { assert.equal(view.activeAttempts, 0); assert.equal(view.uncertainAttempts, 0); }
  assert.deepEqual(Object.keys(state.processes).sort(), ROLES);
  for (const role of ROLES) { assert.equal(processes[role], 'running'); assert.equal(oldGroups[role], 'absent'); }
  assert.equal(initialization, true, 'CURRENT_RUNNER_INITIALIZATION_REQUIRED');
  assert.equal(fingerprint(release), plan.releaseDigest);
}
