import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath, lstat, rm, symlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { transferWebArtifact, validateWebTransferInput, runWebTransfer } from './current-web-transfer.mjs';
import { webActionParameters, runWebAction } from './current-web-actions.mjs';
import * as artifactModule from '../../../../tools/personal-preview/web-artifact.mjs';
import * as web from '../../../../tools/personal-preview/web-release.mjs';
import * as policy from '../../../../tools/personal-preview/web-retention-policy.mjs';
import { renameExclusive } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = async path => { const info = await lstat(path); return { dev: String(info.dev), ino: String(info.ino) }; };
async function artifact(directory, letter) {
  const content = Buffer.from(letter), files = ['assets/tiny.js', 'index.html'].map(path => ({ path, bytes: 1, sha256: sha(content) }));
  const manifest = { format: 2, policy: 'flow-static-web-v2', releaseId: letter.repeat(32), sourceHead: letter.repeat(40), files, totalBytes: 2 };
  const bytes = Buffer.from(JSON.stringify(manifest) + '\n'), id = sha(bytes), root = join(directory, 'web-artifacts', id);
  await mkdir(join(root, 'dist/assets'), { recursive: true, mode: 0o700 });
  for (const file of files) await writeFile(join(root, 'dist', file.path), content, { mode: 0o600 });
  await writeFile(join(root, 'manifest.json'), bytes, { mode: 0o600 });
  return { descriptor: { artifactId: id, manifestDigest: id, sourceHead: manifest.sourceHead }, manifest, bytes: bytes.length, root };
}
async function fixture(callback) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'svc06b-web-test-')));
  try {
    for (const name of ['installation', 'source', 'run']) await mkdir(join(root, name), { mode: 0o700 });
    const installation = join(root, 'installation'), source = join(root, 'source'), run = join(root, 'run');
    const retained = [];
    for (const letter of ['a', 'b', 'c']) retained.push((await artifact(installation, letter)).descriptor);
    const original = await artifact(source, 'd');
    const release = { format: 1, policy: 'flow-web-release-v1', version: 3, current: retained[2].artifactId, artifacts: retained,
      backendHead: 'e'.repeat(40), compatibilityIds: Object.fromEntries(retained.map(row => [row.artifactId, 'f'.repeat(64)])), updatedAt: '2026-10-07T00:00:00.000Z' };
    const pointer = Buffer.from(JSON.stringify(release) + '\n'); await writeFile(join(installation, 'web-release.json'), pointer, { mode: 0o600 });
    const input = { installationDirectory: installation, installationIdentity: await identity(installation), sourceDirectory: source,
      sourceIdentity: await identity(source), runDirectory: run, runIdentity: await identity(run), artifact: original.descriptor,
      artifactFiles: 2, assetBytes: 2, manifestBytes: original.bytes, releaseId: original.manifest.releaseId,
      expectedRelease: release, retainedArtifacts: retained, budget: { freshBytes: 0, liveBytes: 0 } };
    let locked = false, observations = 0;
    const mod = { artifact: artifactModule, web, policy, renameExclusive,
      preview: { loadPreviewConfiguration: async () => ({ directory: installation }),
        withPreviewLock: async (_, work) => { assert.equal(locked, false); locked = true; try { return await work(); } finally { locked = false; } },
        assertPreviewMarker: async () => assert.equal(locked, true) },
      observe: async () => { assert.equal(locked, true); observations++; } };
    await callback({ root, input, mod, original, pointer, observations: () => observations, locked: () => locked });
  } finally { await rm(root, { recursive: true }); }
}

test('web transfer copies verified tiny bytes under the host lock and leaves pointer/source unchanged', async () => fixture(async f => {
  const result = await transferWebArtifact(f.input, f.mod);
  assert.equal(result.outcome, 'web-artifact-imported-pointer-unchanged'); assert.equal(f.locked(), false); assert.equal(f.observations(), 3);
  assert.deepEqual(await readFile(join(f.input.installationDirectory, 'web-release.json')), f.pointer);
  assert.equal((await artifactModule.verifyWebArtifact({ directory: f.input.installationDirectory, artifact: f.input.artifact })).manifest.totalBytes, 2);
  assert.equal((await artifactModule.verifyWebArtifact({ directory: f.input.sourceDirectory, artifact: f.input.artifact })).manifest.totalBytes, 2);
  assert.equal((await readdir(join(f.input.installationDirectory, 'web-artifacts'))).length, 4);
}));

test('web transfer rejects changed source bytes before staging', async () => fixture(async f => {
  await writeFile(join(f.original.root, 'dist/index.html'), 'x');
  await assert.rejects(transferWebArtifact(f.input, f.mod), /WEB_ARTIFACT_INTEGRITY_MISMATCH/);
  await assert.rejects(lstat(join(f.input.runDirectory, 'stage')), { code: 'ENOENT' });
  assert.deepEqual(await readFile(join(f.input.installationDirectory, 'web-release.json')), f.pointer); assert.equal(f.locked(), false);
}));

test('web transfer refuses an existing destination and preserves its bytes', async () => fixture(async f => {
  const destination = join(f.input.installationDirectory, 'web-artifacts', f.input.artifact.artifactId);
  await mkdir(destination, { mode: 0o700 }); await writeFile(join(destination, 'keep'), 'original');
  await assert.rejects(transferWebArtifact(f.input, f.mod), /EXACT_RETAINED_STORE_REQUIRED/);
  assert.equal(await readFile(join(destination, 'keep'), 'utf8'), 'original');
  assert.equal(JSON.parse(await readFile(join(f.input.runDirectory, 'result.json'))).outcome, 'unknown');
  assert.equal(f.locked(), false);
}));

test('web transfer rejects source identity drift and symlink input', async () => fixture(async f => {
  await assert.rejects(transferWebArtifact({ ...f.input, sourceIdentity: { ...f.input.sourceIdentity, ino: '0' } }, f.mod), /DIRECTORY_CHANGED/);
  const link = join(f.root, 'alias'); await symlink(f.input.sourceDirectory, link);
  await assert.rejects(transferWebArtifact({ ...f.input, sourceDirectory: link }, f.mod));
  await assert.rejects(lstat(join(f.input.runDirectory, 'stage')), { code: 'ENOENT' });
}));

test('web transfer does not copy a symlink inside the artifact', async () => fixture(async f => {
  const file = join(f.original.root, 'dist/assets/tiny.js'); await rm(file); await symlink(join(f.original.root, 'dist/index.html'), file);
  await assert.rejects(transferWebArtifact(f.input, f.mod), /ARTIFACT_SYMLINK_REJECTED/);
  await assert.rejects(lstat(join(f.input.runDirectory, 'stage')), { code: 'ENOENT' });
}));

test('web transfer keeps a renamed destination on unknown post-rename outcome without changing pointer', async () => fixture(async f => {
  f.mod.renameExclusive = async (from, to) => { await renameExclusive(from, to); throw Object.assign(new Error('injected'), { code: 'INJECTED_AFTER_RENAME' }); };
  await assert.rejects(transferWebArtifact(f.input, f.mod), /injected/);
  assert.equal((await artifactModule.verifyWebArtifact({ directory: f.input.installationDirectory, artifact: f.input.artifact })).manifest.totalBytes, 2);
  assert.equal(JSON.parse(await readFile(join(f.input.runDirectory, 'result.json'))).outcome, 'unknown');
  await assert.rejects(lstat(join(f.input.runDirectory, 'complete.json')), { code: 'ENOENT' });
  assert.deepEqual(await readFile(join(f.input.installationDirectory, 'web-release.json')), f.pointer); assert.equal(f.locked(), false);
}));

test('web transfer preserves the verified stage when the pre-rename identity gate changes', async () => fixture(async f => {
  const original = f.mod.observe; let count = 0;
  f.mod.observe = async () => { await original(); if (++count === 2) throw new Error('IDENTITY_CHANGED'); };
  await assert.rejects(transferWebArtifact(f.input, f.mod), /IDENTITY_CHANGED/);
  assert.equal((await artifactModule.verifyWebArtifact({ directory: join(f.input.runDirectory, 'stage'), artifact: f.input.artifact })).manifest.totalBytes, 2);
  await assert.rejects(lstat(join(f.input.installationDirectory, 'web-artifacts', f.input.artifact.artifactId)), { code: 'ENOENT' });
  assert.deepEqual(await readFile(join(f.input.installationDirectory, 'web-release.json')), f.pointer);
}));

test('web public parameters refuse incomplete instances before personal I/O and keep callable imports pure', async () => {
  const template = JSON.parse(await readFile(new URL('./current-update-template.json', import.meta.url)));
  assert.throws(() => webActionParameters(template, 'publish-web'), /FRESH_INSTANCE_AND_REPORTS_REQUIRED/);
  assert.throws(() => validateWebTransferInput({ ready: false }), /POST_MAINTENANCE_INSTANCE_REQUIRED/);
  assert.equal(typeof runWebAction, 'function'); assert.equal(typeof runWebTransfer, 'function');
});

test('web public parameters keep three backend reports and a separate fixed publication request', async () => {
  const plan = JSON.parse(await readFile(new URL('./current-update-template.json', import.meta.url))), i = plan.migration;
  plan.ready = i.ready = true; plan.runDirectory = '/private/tmp/flow-svc06b-test-maintenance'; i.runDirectory = '/private/tmp/flow-svc06b-test-import';
  i.installationIdentity = i.sourceDirectoryIdentity = { dev: '1', ino: '2' };
  for (const name of Object.keys(i.privateFiles)) i.privateFiles[name] = { bytes: 2, sha256: 'a'.repeat(64), ...(i.privateFiles[name] ?? {}), dev: '1', ino: '3' };
  plan.runnerId = i.expectedRunner.id = 'cfdbf4d4-a6e4-4151-b67d-4f2e59d3dc0a'; plan.initialVersion = i.expectedRunner.maintenance_version = 21;
  for (const role of Object.keys(i.processDigests)) i.processDigests[role] = 'b'.repeat(64);
  plan.policyPin = { file: { sha256: i.privateFiles['browser-session.json'].sha256 } }; plan.runnerDirectoryIdentity = { dev: '1', ino: '4' };
  plan.webPublication.actions = Object.fromEntries(['import-retained-reports', 'import-new-report', 'publish-web'].map(name =>
    [name, { directory: '/private/tmp/flow-svc06b-test-' + name, outer: '/private/tmp/flow-svc06b-test-' + name + '.json' }]));
  assert.equal(webActionParameters(plan, 'import-retained-reports').reports.length, 3);
  assert.equal(webActionParameters(plan, 'import-new-report').reports.length, 1);
  assert.equal(webActionParameters(plan, 'publish-web').artifact.artifactId, i.artifact.artifactId);
  const bad = structuredClone(plan); bad.webPublication.request.expectedVersion = 4;
  assert.throws(() => webActionParameters(bad, 'publish-web'));
  const intake = JSON.parse(await readFile(new URL('./managed-update-inputs.json', import.meta.url))).formalFourAppIntake;
  const transfer = { ...i, ready: true, sourceDirectory: plan.webPublication.sourceDirectory, sourceIdentity: i.sourceDirectoryIdentity,
    artifact: plan.webPublication.artifact, expectedBackendArtifact: i.artifact, expectedSource: { head: i.artifact.sourceHead, dirty: false },
    retainedArtifacts: intake.reports.slice(0, 3).map(row => row.artifact), artifactFiles: 10, assetBytes: 1700569, manifestBytes: 1651,
    releaseId: plan.webPublication.releaseId, finalReceipt: { path: '/private/tmp/flow-svc06b-test-maintenance/final.json', bytes: 1000, sha256: 'c'.repeat(64) } };
  transfer.expectedRelease = { version: 3, current: plan.retainedWebIds[2], artifacts: transfer.retainedArtifacts };
  assert.equal(validateWebTransferInput(transfer), transfer);
  assert.throws(() => validateWebTransferInput({ ...transfer, artifact: { ...transfer.artifact, sourceHead: i.artifact.sourceHead } }));
});
