import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, lstat, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { backend, artifact, reports, context, validateInput, assertRecoveryReceipt, assertPublished, publish, runWebOnly } from './recovery-web-publication.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const fingerprint = value => sha(JSON.stringify(value, (_, current) => current && !Array.isArray(current) && typeof current === 'object'
  ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current));
const ids = Object.keys(reports).slice(0, 3), roles = ['center', 'runner', 'web'];
const retainedArtifacts = ids.map(artifactId => ({ artifactId, manifestDigest: artifactId, sourceHead: 'a'.repeat(40) }));
const release = { version: 3, current: ids[2], artifacts: retainedArtifacts };
const identity = { dev: '1', ino: '2' };
const files = ['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json'];
function input() {
  return { ready: true, installationDirectory: '/Users/citrine/.flow-personal', repository: '/Users/citrine/Projects/AgentHarness/Flow',
    sourceDirectory: '/private/tmp/release01-web-artifact-prepared-20261007/actual/artifact-store',
    runDirectory: '/private/tmp/flow-svc06b-e15-web779-transfer-once', publicationDirectory: '/private/tmp/flow-svc06b-e15-web779-publish-once', runIdentity: null,
    expectedBackendArtifact: backend, expectedWebHostArtifact: backend, expectedSource: { head: backend.sourceHead, dirty: false }, artifact, context, reportIds: reports,
    retainedArtifacts, expectedRelease: release, privateFiles: Object.fromEntries(files.map(name => [name, { ...identity, bytes: 2, sha256: sha('{}') }])),
    installationIdentity: identity, sourceIdentity: identity, processDigests: Object.fromEntries(roles.map(role => [role, 'a'.repeat(64)])), ports: { center: 61227, web: 61228 },
    finalReceipt: { path: '/private/tmp/flow-svc06-held-recovery-e15-20261007-once/final.json', bytes: 2, sha256: 'a'.repeat(64) },
    artifactFiles: 10, assetBytes: 1700569, manifestBytes: 1651, releaseId: '52a261e294324a11aead58a554f547db',
    budget: { freshBytes: 3 * 1024 ** 3, liveBytes: 1024 ** 3, addedBytes: 512 * 1024 ** 2, rawBytes: 2 * 1024 ** 2 } };
}
function receipt() {
  return { outcome: 'resumed-confirmed', complete: true, phase: 'final', initialization: true,
    view: { state: 'accepting', version: 24, operationId: null, runnerId: 'd22f4df2-8242-49f4-a1b4-77f8f08611ef' },
    stateDigest: 'a'.repeat(64), operationDigest: 'b'.repeat(64), processes: Object.fromEntries(roles.map(role => [role, 'running'])),
    oldGroups: Object.fromEntries(roles.map(role => [role, 'absent'])), actualClaim: 'NOT_OBSERVED',
    tuple: { backendHead: backend.sourceHead, context, compatibilityIds: Object.fromEntries(ids.map(id => [id, reports[id]])) } };
}
test('pending instance rejects before any private observation', async () => {
  await assert.rejects(runWebOnly({ ready: false }, 'transfer'), /FRESH_POST_RECOVERY_INSTANCE_REQUIRED/);
});
test('fixed e15 and four new-source report input accepts while stale identities reject', () => {
  assert.equal(validateInput(input()).artifact.artifactId, artifact.artifactId);
  for (const change of [v => { v.expectedBackendArtifact = { ...backend, sourceHead: 'a'.repeat(40) }; },
    v => { v.expectedWebHostArtifact = { ...backend, artifactId: 'b'.repeat(64) }; },
    v => { v.reportIds = { ...reports, [artifact.artifactId]: 'c'.repeat(64) }; },
    v => { v.expectedRelease = { ...release, version: 4 }; }]) {
    const value = input(); change(value); assert.throws(() => validateInput(value));
  }
});
test('recovery final exact shape accepts no assignment but refuses old receipt or missing initialization', () => {
  assertRecoveryReceipt(receipt());
  for (const value of [{ outcome: 'resumed-confirmed', runtimeSource: backend.sourceHead }, { ...receipt(), initialization: false },
    { ...receipt(), view: { ...receipt().view, version: 23 } }]) assert.throws(() => assertRecoveryReceipt(value));
});
test('post-publication assertions retain old artifacts and every process/config field', () => {
  const before = { processes: { runner: { pid: 100 } }, source: backend.sourceHead };
  const result = { web: 'ready', release: { version: 4, current: artifact.artifactId, artifacts: [...retainedArtifacts, artifact], compatibilityIds: reports } };
  assertPublished(input(), result, before, { ...before, webReleaseOperation: { phase: 'committed' } });
  assert.throws(() => assertPublished(input(), result, before, { ...before, processes: { runner: { pid: 101 } } }), /WEB_ONLY_STATE_CHANGED/);
  assert.throws(() => assertPublished(input(), { ...result, release: { ...result.release, artifacts: [artifact] } }, before, before));
});
async function fixture(behavior, body) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'web-only-')));
  try {
    const value = input(); value.installationDirectory = root; value.runDirectory = join(root, 'transfer');
    await mkdir(value.runDirectory, { mode: 0o700 });
    const info = await lstat(root); value.installationIdentity = { dev: String(info.dev), ino: String(info.ino) };
    const processes = Object.fromEntries(roles.map((role, index) => [role, { role, pid: index + 100, nonce: role }]));
    let state = { source: value.expectedSource, backendArtifact: backend, webHost: { artifact: backend }, processes }, called = 0;
    const operation = { operationId: '35d5a7ff-5ef7-4938-9584-adb27f5357ff', phase: 'resumed', backendArtifact: backend };
    const values = { 'state.json': state, 'maintenance.json': operation, 'web-release.json': release };
    for (const name of files) {
      const bytes = Buffer.from(JSON.stringify(values[name] ?? {})), path = join(root, name);
      await writeFile(path, bytes, { mode: 0o600 }); const st = await lstat(path);
      value.privateFiles[name] = { dev: String(st.dev), ino: String(st.ino), bytes: bytes.length, sha256: sha(bytes) };
    }
    value.processDigests = Object.fromEntries(roles.map(role => [role, sha(JSON.stringify(processes[role]))]));
    await writeFile(join(value.runDirectory, 'complete.json'), JSON.stringify({ outcome: 'web-artifact-imported-pointer-unchanged', artifact }), { mode: 0o600 });
    const checked = [];
    const mod = { recovery: { ...receipt(), stateDigest: fingerprint(state), operationDigest: fingerprint(operation) },
      preview: { readPreviewJson: async path => structuredClone(path.endsWith('state.json') ? state : operation),
      publishPreviewWeb: async request => { called++; assert.deepEqual(request, { directory: root, artifact, expectedVersion: 3, expectedBackendHead: backend.sourceHead, compatibilityId: reports[artifact.artifactId] });
        if (behavior === 'conflict') throw Object.assign(Error('fixture'), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
        state = { ...state, webReleaseOperation: { phase: 'committed' } };
        if (behavior === 'unknown') throw Object.assign(Error('fixture'), { code: 'WEB_RELEASE_COMMITTED_UNCONFIRMED' });
        return { web: 'ready', release: { version: 4, current: artifact.artifactId, artifacts: [...retainedArtifacts, artifact], compatibilityIds: reports } }; } },
      process: { inspectOwnedProcess: async () => 'running', ownsListener: async () => true },
      web: { readWebRelease: async () => release, verifyWebCompatibility: async request => { checked.push(request); assert.equal(request.backendHead, backend.sourceHead); assert.deepEqual(request.expectedContext, context); } },
      maintenance: { maintainPreview: async () => receipt().view }, diagnostics: { readRunnerInitialization: async () => true } };
    await body(value, mod, () => ({ called, checked, state }));
  } finally { await rm(root, { recursive: true }); }
}
test('actual publish consumer observes six owned files/four reports and makes one exact public CAS', async () => {
  await fixture('success', async (value, mod, facts) => { const result = await publish(value, mod); assert.equal(result.outcome, 'web-published-confirmed'); assert.equal(facts().called, 1); assert.equal(facts().checked.length, 4); });
});
test('public conflict stops without replay or pointer replacement', async () => {
  await fixture('conflict', async (value, mod, facts) => { await assert.rejects(publish(value, mod), { code: 'WEB_RELEASE_VERSION_CONFLICT' }); assert.equal(facts().called, 1); assert.equal(facts().state.webReleaseOperation, undefined); });
});
test('post-commit unknown stays primary and never triggers rollback or retry', async () => {
  await fixture('unknown', async (value, mod, facts) => { await assert.rejects(publish(value, mod), { code: 'WEB_RELEASE_COMMITTED_UNCONFIRMED' }); assert.equal(facts().called, 1); assert.equal(facts().state.webReleaseOperation.phase, 'committed'); });
});
test('a different launch since the recovery receipt is refused before public CAS', async () => {
  await fixture('success', async (value, mod, facts) => { mod.recovery.stateDigest = 'a'.repeat(64);
    await assert.rejects(publish(value, mod), /RECOVERED_LAUNCH_CHANGED/); assert.equal(facts().called, 0); });
});
