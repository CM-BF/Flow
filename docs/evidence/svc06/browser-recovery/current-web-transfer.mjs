/** Web payload transfer only. The existing migration procedure owns publication order and unknown outcomes. */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, realpath, mkdir, readdir, open, statfs } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrateOnce } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/procedure.mjs';
import { boundedFile, writeExclusive, renameExclusive } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';
import { record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';
import { verifyBackendArtifact } from '../../../../tools/personal-preview/backend-release/index.mjs';
import { observeCurrentInstallation } from './current-migration.mjs';
import { readInstance } from './current-import.mjs';

const backendId = 'cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b';
const backendHead = '04da80692e79e2b7c3f6341c7fa76515a3f719a3';
const webId = '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4';
const retainedIds = ['461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90',
  'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe',
  'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88'];

async function directory(path, expected) {
  const info = await lstat(path, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(path), path);
  const identity = { dev: String(info.dev), ino: String(info.ino) };
  if (expected) assert.deepEqual(identity, expected, 'DIRECTORY_CHANGED');
  return identity;
}
async function absent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.fail('DESTINATION_EXISTS_KEEP');
}
async function sync(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const info = await file.stat(); assert.ok(info.isFile() || info.isDirectory()); await file.sync(); }
  finally { await file.close(); }
}
async function space(path, limit) {
  const info = await statfs(path); assert.ok(Number(info.bavail) * Number(info.bsize) >= limit, 'SPACE_GATE');
}
function manifestContract(manifest, input) {
  assert.equal(manifest.format, 2); assert.equal(manifest.policy, 'flow-static-web-v2');
  assert.equal(manifest.sourceHead, input.artifact.sourceHead); assert.equal(manifest.releaseId, input.releaseId);
  assert.equal(manifest.totalBytes, input.assetBytes); assert.equal(manifest.files.length, input.artifactFiles);
  // Reuse the old bounded reader only within its verified per-file ceiling; never enlarge that reader.
  for (const file of manifest.files) {
    assert.ok(file.path === 'index.html' || /^assets\/[A-Za-z0-9_.-]+$/.test(file.path), 'FIXED_ASSET_PATH');
    assert.ok(file.bytes <= 1_588_311, 'FIXED_READER_FILE_BOUND');
  }
}

export function validateWebTransferInput(input) {
  assert.equal(input.ready, true, 'POST_MAINTENANCE_INSTANCE_REQUIRED');
  assert.equal(input.installationDirectory, '/Users/citrine/.flow-personal');
  assert.equal(input.repository, '/Users/citrine/Projects/AgentHarness/Flow');
  assert.equal(input.sourceDirectory, '/private/tmp/release01-web-artifact-prepared-20261007/actual/artifact-store');
  assert.ok(isAbsolute(input.runDirectory) && input.runDirectory.startsWith('/private/tmp/flow-svc06b-'));
  assert.equal(input.runIdentity, null, 'EXCLUSIVE_RUN_REQUIRED');
  assert.equal(input.artifact.artifactId, webId); assert.equal(input.artifact.manifestDigest, webId);
  assert.equal(input.artifact.sourceHead, 'c2311b6bd44a2a8e73e3b066be5f12bc8b153b37');
  assert.equal(input.expectedBackendArtifact.artifactId, backendId); assert.equal(input.expectedBackendArtifact.manifestDigest, backendId);
  assert.equal(input.expectedBackendArtifact.sourceHead, backendHead);
  assert.deepEqual(input.expectedSource, { head: backendHead, dirty: false });
  assert.equal(input.expectedWebHostArtifact.artifactId, '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920');
  assert.equal(input.expectedWebHostArtifact.manifestDigest, input.expectedWebHostArtifact.artifactId);
  assert.equal(input.expectedWebHostArtifact.sourceHead, '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
  assert.deepEqual(input.retainedArtifacts.map(value => value.artifactId), retainedIds);
  assert.equal(input.expectedRelease.version, 3); assert.equal(input.expectedRelease.current, retainedIds[2]);
  assert.deepEqual(input.expectedRelease.artifacts, input.retainedArtifacts);
  assert.equal(input.artifactFiles, 10); assert.equal(input.assetBytes, 1700569); assert.equal(input.manifestBytes, 1651);
  assert.equal(input.releaseId, '52a261e294324a11aead58a554f547db');
  assert.deepEqual(Object.keys(input.privateFiles).sort(), ['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json']);
  assert.deepEqual(input.ports, { center: 61227, web: 61228 });
  for (const id of [input.installationIdentity, input.sourceIdentity]) for (const key of ['dev', 'ino']) assert.match(id[key], /^\d+$/);
  assert.ok(input.budget.freshBytes >= 2.5 * 1024 ** 3); assert.equal(input.budget.liveBytes, 1024 ** 3);
  assert.equal(input.budget.rawBytes, 2097152); assert.equal(input.budget.addedBytes, 512 * 1024 ** 2);
  assert.ok(isAbsolute(input.finalReceipt.path)); assert.match(input.finalReceipt.sha256, /^[a-f0-9]{64}$/);
  assert.ok(input.finalReceipt.bytes > 0 && input.finalReceipt.bytes <= 65536);
  return input;
}

/** Internal seam: tests supply only host observations/lock; byte verification and file transfer remain real. */
export async function transferWebArtifact(input, mod) {
  const config = await mod.preview.loadPreviewConfiguration(input.installationDirectory);
  return mod.preview.withPreviewLock(config, async () => {
    await mod.preview.assertPreviewMarker(config);
    await directory(input.installationDirectory, input.installationIdentity);
    await directory(input.sourceDirectory, input.sourceIdentity);
    await directory(input.runDirectory, input.runIdentity);
    const guard = async () => {
      await mod.observe();
      assert.deepEqual(await mod.web.readWebRelease(input.installationDirectory), input.expectedRelease, 'WEB_POINTER_CHANGED');
    };
    await guard(); await space(input.installationDirectory, input.budget.freshBytes);
    const original = await mod.artifact.verifyWebArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
    manifestContract(original.manifest, input);
    const source = join(input.sourceDirectory, 'web-artifacts', input.artifact.artifactId);
    const manifestBytes = await boundedFile(join(source, 'manifest.json'), input.manifestBytes, input.artifact.manifestDigest);
    const store = join(input.installationDirectory, 'web-artifacts'), storeIdentity = await directory(store);
    const stageRoot = join(input.runDirectory, 'stage'), staged = join(stageRoot, 'web-artifacts', input.artifact.artifactId);
    const destination = join(store, input.artifact.artifactId); let stageIdentity;
    const rec = (name, value) => record(join(input.runDirectory, name), value);
    await migrateOnce({
      intent: () => rec('intent.json', { artifact: input.artifact, storeIdentity, staged, destination, pointerChange: false }),
      inspectStore: async () => {
        assert.deepEqual((await readdir(store)).sort(), input.retainedArtifacts.map(value => value.artifactId).sort(), 'EXACT_RETAINED_STORE_REQUIRED');
        mod.policy.assertArtifactStorageSlots(input.retainedArtifacts.length, true);
        let bytes = original.manifest.totalBytes;
        for (const artifact of input.retainedArtifacts) bytes += (await mod.artifact.verifyWebArtifact({ directory: input.installationDirectory, artifact })).manifest.totalBytes;
        mod.policy.assertRetainedAssetBytes(bytes); await absent(destination); return false;
      },
      clone: async () => {
        await mkdir(stageRoot, { mode: 0o700 }); stageIdentity = await directory(stageRoot);
        assert.equal(stageIdentity.dev, storeIdentity.dev, 'SAME_VOLUME_REQUIRED');
        for (const part of [join(stageRoot, 'web-artifacts'), staged, join(staged, 'dist'), join(staged, 'dist/assets')]) await mkdir(part, { mode: 0o700 });
        for (const file of original.manifest.files) {
          await space(input.runDirectory, input.budget.liveBytes);
          await writeExclusive(join(staged, 'dist', file.path), await boundedFile(join(source, 'dist', file.path), file.bytes, file.sha256));
        }
        await writeExclusive(join(staged, 'manifest.json'), manifestBytes);
      },
      verify: location => mod.artifact.verifyWebArtifact({ directory: location === 'stage' ? stageRoot : input.installationDirectory, artifact: input.artifact }),
      syncStage: async () => { for (const path of ['dist/assets', 'dist', '']) await sync(join(staged, path)); await sync(join(stageRoot, 'web-artifacts')); await sync(stageRoot); },
      checkpoint: async () => {
        await directory(store, storeIdentity); await directory(stageRoot, stageIdentity); await absent(destination);
        await space(store, input.budget.liveBytes); await guard();
        await rec('checkpoint.json', { outcome: 'verified-synced-pointer-unchanged', storeIdentity, stageIdentity, artifact: input.artifact });
      },
      publishExclusive: () => mod.renameExclusive(staged, destination),
      syncParents: async () => { await sync(store); await sync(dirname(staged)); },
      result: value => rec('result.json', { ...value, artifact: input.artifact, pointerChanged: false }),
    });
    await guard();
    await rec('complete.json', { outcome: 'web-artifact-imported-pointer-unchanged', artifact: input.artifact });
    return { outcome: 'web-artifact-imported-pointer-unchanged', artifact: input.artifact };
  });
}

export async function runWebTransfer(input) {
  validateWebTransferInput(input);
  const parent = await directory(dirname(input.runDirectory));
  await mkdir(input.runDirectory, { mode: 0o700 });
  const identity = await directory(input.runDirectory); assert.equal(identity.dev, parent.dev);
  await record(join(input.runDirectory, 'reservation.json'), { at: new Date().toISOString(), identity, artifact: input.artifact });
  const prior = JSON.parse(await boundedFile(input.finalReceipt.path, input.finalReceipt.bytes, input.finalReceipt.sha256));
  assert.equal(prior.outcome, 'resumed-confirmed'); assert.equal(prior.runtimeSource.head, backendHead);
  assert.equal(prior.runner.maintenance_state, 'accepting'); assert.equal(prior.runner.maintenance_operation_id, null);
  const verified = await verifyBackendArtifact({ directory: input.installationDirectory, artifact: input.expectedBackendArtifact });
  assert.equal(verified.manifest.sourceRepository, input.repository);
  const at = name => import(pathToFileURL(join(verified.root, 'tools/personal-preview', name)).href);
  const preview = await at('preview.mjs'), process = await at('process.mjs');
  const mod = { preview, process, artifact: await at('web-artifact.mjs'), web: await at('web-release.mjs'),
    policy: await at('web-retention-policy.mjs'), renameExclusive };
  mod.observe = () => observeCurrentInstallation(mod, input);
  return transferWebArtifact({ ...input, runIdentity: identity }, mod);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, path, digest, ...extra] = process.argv.slice(2);
    assert.equal(action, '--execute-fixed-web-import'); assert.equal(extra.length, 0);
    console.log(JSON.stringify(await runWebTransfer(await readInstance(path, digest))));
  } catch (error) {
    console.error(JSON.stringify({ outcome: 'unknown-keep', code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'WEB_TRANSFER_UNCONFIRMED' })); process.exitCode = 1;
  }
}
