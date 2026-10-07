import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, writeFile, lstat, mkdir, rm, rmdir, chmod, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { withPreviewLock } from '/private/tmp/flow-svc06b-recovery-r2-artifact-NXTN6t/backend-artifacts/e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd/root/tools/personal-preview/preview.mjs';
import { readRunnerMaintenance } from '/private/tmp/flow-svc06b-recovery-r2-artifact-NXTN6t/backend-artifacts/e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd/root/apps/server/src/runner-maintenance/index.ts';
import { transferWebArtifact } from './current-web-transfer.mjs';
import * as artifactModule from '../../../../tools/personal-preview/web-artifact.mjs';
import * as retentionPolicy from '../../../../tools/personal-preview/web-retention-policy.mjs';
import { renameExclusive } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';
import { canonical } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/apps/server/src/database.ts';
import { backend, artifact, reports, context, validateInput, assertRecoveryReceipt, assertPublished, publish, runWebOnly, createOutputDirectory, observe, readMaintenanceForWeb } from './recovery-web-publication.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const fingerprint = value => sha(canonical(value));
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
    finalReceipt: { path: '/private/tmp/flow-svc06-held-recovery-e15-continuation-r2-20261007-once/final.json', bytes: 2, sha256: 'a'.repeat(64) },
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
    let state = { source: value.expectedSource, backendArtifact: backend, webHost: { artifact: backend }, processes,
      declaration: { Z: 1, a: [{ '10': 2, '2': 3, aA: 4, 'a-': 5 }] } }, called = 0;
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
    const mod = { canonical, recovery: { ...receipt(), stateDigest: fingerprint(state), operationDigest: fingerprint(operation) },
      preview: { loadPreviewConfiguration: async () => ({ directory: root, databaseUrl: 'synthetic', runner: { runnerId: receipt().view.runnerId, token: 'synthetic' } }), assertPreviewMarker: async () => {}, readPreviewJson: async path => structuredClone(path.endsWith('state.json') ? state : operation),
      publishPreviewWeb: async request => { called++; assert.deepEqual(request, { directory: root, artifact, expectedVersion: 3, expectedBackendHead: backend.sourceHead, compatibilityId: reports[artifact.artifactId] });
        if (behavior === 'conflict') throw Object.assign(Error('fixture'), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
        state = { ...state, webReleaseOperation: { phase: 'committed' } };
        if (behavior === 'unknown') throw Object.assign(Error('fixture'), { code: 'WEB_RELEASE_COMMITTED_UNCONFIRMED' });
        return { web: 'ready', release: { version: 4, current: artifact.artifactId, artifacts: [...retainedArtifacts, artifact], compatibilityIds: reports } }; } },
      process: { inspectOwnedProcess: async () => 'running', ownsListener: async () => true },
      web: { readWebRelease: async () => release, verifyWebCompatibility: async request => { checked.push(request); assert.equal(request.backendHead, backend.sourceHead); assert.deepEqual(request.expectedContext, context); } },
      Pool: class { async query() { return { rowCount: 1 }; } async end() {} }, readRunnerMaintenance: async () => receipt().view, diagnostics: { readRunnerInitialization: async () => true } };
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
test('producer canonical actual publish refuses the legacy digest before public CAS', async () => {
  const source = await readFile('/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/apps/server/src/database.ts');
  assert.equal(sha(source), '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653');
  await fixture('success', async (value, mod, facts) => {
    const legacy = JSON.stringify(facts().state, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    assert.notEqual(sha(legacy), mod.recovery.stateDigest); mod.recovery.stateDigest = sha(legacy);
    await assert.rejects(publish(value, mod), /RECOVERED_LAUNCH_CHANGED/); assert.equal(facts().called, 0);
  });
});
test('continuation receipt path accepts only the new fixed successful predecessor', () => {
  assert.equal(validateInput(input()).finalReceipt.path, '/private/tmp/flow-svc06-held-recovery-e15-continuation-r2-20261007-once/final.json');
  const old = input(); old.finalReceipt.path = '/private/tmp/flow-svc06-held-recovery-e15-20261007-once/final.json';
  assert.throws(() => validateInput(old));
  old.finalReceipt.path = '/private/tmp/flow-svc06-held-recovery-e15-continuation-20261007-once/final.json';
  assert.throws(() => validateInput(old));
});
test('actual output creation accepts system sticky parent and refuses namespace reuse', async () => {
  const output = await realpath(await mkdtemp('/private/tmp/svc06b-web-entry-'));
  await rmdir(output); let created;
  try {
    created = await createOutputDirectory(output);
    const info = await lstat(output); assert.equal(info.uid, process.getuid()); assert.equal(info.mode & 0o7777, 0o700);
    assert.deepEqual(created, { dev: String(info.dev), ino: String(info.ino) });
    await assert.rejects(createOutputDirectory(output), { code: 'EEXIST' });
  } finally { if (created) { const info = await lstat(output); assert.equal(String(info.dev), created.dev); assert.equal(String(info.ino), created.ino); await rmdir(output); } }
});
test('actual output creation rejects writable owned and symlink parents', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'web-parent-')));
  try {
    const bad = join(root, 'bad'), alias = join(root, 'alias'); await mkdir(bad, { mode: 0o700 }); await chmod(bad, 0o777);
    await assert.rejects(createOutputDirectory(join(bad, 'output')), /UNTRUSTED_OUTPUT_PARENT/);
    await symlink(root, alias); await assert.rejects(createOutputDirectory(join(alias, 'output')));
  } finally { await rm(root, { recursive: true }); }
});


function databaseFixture(mode = 'ok') {
  const facts = { ended: 0, released: 0, queries: [], constructions: 0 };
  class Pool {
    constructor(options) { facts.constructions++; assert.equal(options.max, 1); assert.equal(options.statement_timeout, 3000); }
    async query(sql, args) {
      facts.queries.push(sql);
      if (sql === 'SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked') {
        assert.deepEqual(args, [receipt().view.runnerId, sha('synthetic')]);
        return { rowCount: ['revoked', 'identity-mismatch'].includes(mode) ? 0 : 1, rows: [] };
      }
      if (sql === 'SELECT * FROM flow.runners WHERE id=$1') return { rows: [{ maintenance_version: 24, maintenance_state: 'accepting', maintenance_operation_id: null, revoked: false }] };
      if (sql.includes('FROM flow.attempts')) {
        if (mode === 'unknown') throw Object.assign(new Error('synthetic'), { code: 'SYNTHETIC_STATUS_UNKNOWN' });
        return { rows: [{ active: 0, uncertain: 0 }] };
      }
      assert.ok(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'COMMIT', 'ROLLBACK'].includes(sql)); return { rows: [] };
    }
    connect(callback) {
      const client = new EventEmitter(); client.query = this.query.bind(this); client.release = () => facts.released++;
      callback(null, client);
    }
    async end() { facts.ended++; }
  }
  return { Pool, facts };
}
async function tinyArtifact(root, letter) {
  const content = Buffer.from(letter), manifest = { format: 2, policy: 'flow-static-web-v2', releaseId: letter.repeat(32), sourceHead: letter.repeat(40),
    files: [{ path: 'index.html', bytes: 1, sha256: sha(content) }], totalBytes: 1 };
  const bytes = Buffer.from(JSON.stringify(manifest) + '\n'), id = sha(bytes), path = join(root, 'web-artifacts', id);
  await mkdir(join(path, 'dist/assets'), { recursive: true, mode: 0o700 });
  await writeFile(join(path, 'dist/index.html'), content, { mode: 0o600 }); await writeFile(join(path, 'manifest.json'), bytes, { mode: 0o600 });
  return { descriptor: { artifactId: id, manifestDigest: id, sourceHead: manifest.sourceHead }, bytes: bytes.length, manifest };
}
async function lockedTransferFixture(mode, callback) {
  await fixture('success', async (value, mod, publication) => {
    const root = value.installationDirectory, source = join(root, 'source'), run = join(root, 'transfer-locked');
    await mkdir(source, { mode: 0o700 }); await mkdir(run, { mode: 0o700 });
    const fresh = await tinyArtifact(source, 'd'), old = [];
    for (const letter of ['a', 'b', 'c']) old.push((await tinyArtifact(root, letter)).descriptor);
    const id = async path => { const st = await lstat(path); return { dev: String(st.dev), ino: String(st.ino) }; };
    Object.assign(value, { sourceDirectory: source, sourceIdentity: await id(source), runDirectory: run, runIdentity: await id(run), artifact: fresh.descriptor,
      retainedArtifacts: old, expectedRelease: { version: 3, current: old[2].artifactId, artifacts: old }, manifestBytes: fresh.bytes,
      assetBytes: 1, artifactFiles: 1, releaseId: fresh.manifest.releaseId });
    mod.web.readWebRelease = async () => value.expectedRelease; mod.web.verifyWebCompatibility = async () => ({});
    mod.preview.withPreviewLock = withPreviewLock;
    const db = databaseFixture(mode); Object.assign(mod, { Pool: db.Pool, readRunnerMaintenance, artifact: artifactModule, policy: retentionPolicy, renameExclusive });
    mod.observe = () => observe(value, mod);
    await callback(value, mod, db.facts, publication);
    await assert.rejects(lstat(join(root, 'operation.lock')), { code: 'ENOENT' });
  });
}
test('lock integration reproduces old nested lock rejection with actual transfer and lock', async () => {
  await lockedTransferFixture('ok', async (value, mod, facts) => {
    const current = mod.observe;
    mod.observe = async () => { await withPreviewLock({ directory: value.installationDirectory }, async () => current()); };
    await assert.rejects(transferWebArtifact(value, mod), { code: 'OPERATION_IN_PROGRESS_OR_UNCONFIRMED' });
    assert.equal(facts.constructions, 0);
  });
});
test('lock integration actual transfer guard reads public status without lock reacquisition', async () => {
  await lockedTransferFixture('ok', async (value, mod, facts) => {
    const result = await transferWebArtifact(value, mod);
    assert.equal(result.outcome, 'web-artifact-imported-pointer-unchanged');
    assert.equal((await lstat(join(value.installationDirectory, 'web-artifacts', value.artifact.artifactId))).isDirectory(), true);
    assert.equal(facts.constructions, 3); assert.equal(facts.ended, 3); assert.equal(facts.released, 3);
    assert.equal(facts.queries.filter(sql => sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY').length, 3);
  });
});
test('lock integration real pre-existing lock is retained and refuses transfer', async () => {
  await lockedTransferFixture('ok', async (value, mod, facts) => {
    const lock = join(value.installationDirectory, 'operation.lock'); await mkdir(lock, { mode: 0o700 });
    try { await assert.rejects(transferWebArtifact(value, mod), { code: 'OPERATION_IN_PROGRESS_OR_UNCONFIRMED' });
      assert.equal((await lstat(lock)).isDirectory(), true); assert.equal(facts.constructions, 0);
    } finally { await rmdir(lock); }
  });
});
for (const mode of ['revoked', 'identity-mismatch', 'unknown']) test(`lock integration ${mode} refuses transfer and CAS and closes pool`, async () => {
  await lockedTransferFixture(mode, async (value, mod, facts, publication) => {
    await assert.rejects(transferWebArtifact(value, mod), mode === 'unknown' ? { code: 'SYNTHETIC_STATUS_UNKNOWN' } : /RUNNER_IDENTITY_UNAVAILABLE/);
    await writeFile(join(value.runDirectory, 'complete.json'), JSON.stringify({ outcome: 'web-artifact-imported-pointer-unchanged', artifact }), { mode: 0o600 });
    await assert.rejects(publish(value, mod), mode === 'unknown' ? { code: 'SYNTHETIC_STATUS_UNKNOWN' } : /RUNNER_IDENTITY_UNAVAILABLE/);
    assert.equal(publication().called, 0); assert.equal(facts.ended, 2);
    await assert.rejects(lstat(join(value.installationDirectory, 'web-artifacts', value.artifact.artifactId)), { code: 'ENOENT' });
  });
});
