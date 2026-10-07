import { mkdir, readFile, readdir, lstat, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildBackend } from './build.mjs';
import { nodeIdentity } from './node-identity.mjs';
import { LIMITS, fail, digest, inventory, ensureStore, withStoreLock, saveJson, privateDirectory } from './files.mjs';
export const BACKEND_POLICY = 'flow.backend-artifact.v1';
/** Capacity only: callers verify every retained artifact under the store lock first.
 * Builds reserve the maximum; imports must supply a fully verified artifact's total bytes.
 * This neither verifies an import nor authorizes deleting or replacing retained artifacts. */
export function assertBackendRetention({ count, bytes }, addition = null) {
  if (![count, bytes].every(value => Number.isSafeInteger(value) && value >= 0)) fail('BACKEND_RETENTION_INVALID');
  let addedBytes = 0;
  if (addition !== null) {
    const keys = Object.keys(addition).sort().join();
    if (addition.kind === 'build' && keys === 'kind') addedBytes = LIMITS.bytes;
    else if (addition.kind === 'import' && keys === 'bytes,kind'
      && Number.isSafeInteger(addition.bytes) && addition.bytes > 0 && addition.bytes <= LIMITS.bytes) addedBytes = addition.bytes;
    else fail('BACKEND_RETENTION_INVALID');
  }
  if (count + (addition === null ? 0 : 1) > LIMITS.artifacts
    || bytes > LIMITS.retainedBytes - addedBytes) fail('BACKEND_RETENTION_FULL');
}
function validateDescriptor(value) {
  if (!value || value.policy !== BACKEND_POLICY || !/^[a-f0-9]{64}$/.test(value.artifactId ?? '') || value.artifactId !== value.manifestDigest || !/^[a-f0-9]{40}$/.test(value.sourceHead ?? '')) fail('BACKEND_DESCRIPTOR_INVALID');
}
export async function verifyBackendArtifact({ directory, artifact }) {
  validateDescriptor(artifact); await privateDirectory(directory);
  const store = join(directory, 'backend-artifacts'); await privateDirectory(store);
  const path = join(store, artifact.artifactId); await privateDirectory(path);
  const manifestPath = join(path, 'manifest.json'), info = await lstat(manifestPath);
  if (!info.isFile() || info.nlink !== 1 || info.size > 32 * 1024 ** 2) fail('BACKEND_MANIFEST_INVALID');
  const bytes = await readFile(manifestPath); if (digest(bytes) !== artifact.manifestDigest) fail('BACKEND_MANIFEST_MISMATCH');
  const manifest = JSON.parse(bytes);
  if (manifest.policy !== BACKEND_POLICY || manifest.sourceHead !== artifact.sourceHead) fail('BACKEND_MANIFEST_MISMATCH');
  const root = join(path, 'root'); const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('BACKEND_ROOT_INVALID');
  const actual = await inventory(root);
  if (actual.bytes + bytes.length > LIMITS.bytes) fail('BACKEND_BYTE_BUDGET');
  if (JSON.stringify(actual) !== JSON.stringify(manifest.inventory)) fail('BACKEND_CONTENT_MISMATCH');
  const node = await nodeIdentity(); if (JSON.stringify(node) !== JSON.stringify(manifest.node)) fail('BACKEND_NODE_IDENTITY_CHANGED');
  return { root, node: node.executable, artifact, manifest, totalBytes: actual.bytes + bytes.length };
}
export async function prepareBackendArtifact({ repository, target, directory, offlineStore, pnpmCli }) {
  if (!/^[a-f0-9]{40}$/.test(target ?? '')) fail('BACKEND_TARGET_REQUIRED');
  const store = await ensureStore(directory);
  return withStoreLock(store, async () => {
    const names = await readdir(store);
    if (names.some(name => name !== 'prepare.lock' && !/^stage-[a-f0-9-]+(?:\.json)?$/.test(name) && !/^[a-f0-9]{64}$/.test(name))) fail('BACKEND_STORE_UNCONFIRMED');
    if (names.filter(name => /^stage-.*\.json$/.test(name)).length >= 32) fail('BACKEND_BUILD_RECORD_BUDGET');
    if (names.some(name => name.startsWith('stage-') && !name.endsWith('.json'))) fail('BACKEND_PREVIOUS_STAGE_UNCONFIRMED');
    const retained = names.filter(name => /^[a-f0-9]{64}$/.test(name)); let bytes = 0, reusable = null;
    if (retained.length > LIMITS.artifacts) fail('BACKEND_RETENTION_FULL');
    for (const id of retained) {
      await privateDirectory(join(store, id));
      const path = join(store, id, 'manifest.json'), info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 32 * 1024 ** 2) fail('BACKEND_MANIFEST_INVALID');
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      const artifact = { policy: BACKEND_POLICY, artifactId: id, manifestDigest: id, sourceHead: manifest.sourceHead };
      const verified = await verifyBackendArtifact({ directory, artifact }); bytes += verified.totalBytes;
      if (manifest.sourceHead === target) reusable = artifact;
    }
    assertBackendRetention({ count: retained.length, bytes });
    if (reusable) return reusable;
    assertBackendRetention({ count: retained.length, bytes }, { kind: 'build' });
    const stage = join(store, `stage-${randomUUID()}`), record = `${stage}.json`;
    await mkdir(stage, { mode: 0o700 });
    await saveJson(record, { phase: 'building', target, stage, at: new Date().toISOString() });
    let publishedArtifact = null, buildOutput = null;
    try {
      const built = await buildBackend({ repository, target, stage, offlineStore, pnpmCli });
      buildOutput = built.buildOutput;
      const node = await nodeIdentity(), content = await inventory(built.root);
      const manifest = { policy: BACKEND_POLICY, sourceHead: target, sourceRepository: built.sourceRepository, sourceTree: built.sourceTree, lockDigest: built.lockDigest, pnpm: built.pnpm, installation: built.installation, node, inventory: content };
      const encoded = `${JSON.stringify(manifest)}\n`;
      if (content.bytes + Buffer.byteLength(encoded) > LIMITS.bytes) fail('BACKEND_BYTE_BUDGET');
      const id = digest(encoded), published = join(store, id);
      const output = join(stage, 'artifact'); await mkdir(output, { mode: 0o700 });
      await rename(built.root, join(output, 'root')); await saveJson(join(output, 'manifest.json'), manifest);
      const artifact = { policy: BACKEND_POLICY, artifactId: id, manifestDigest: id, sourceHead: target };
      // This checkpoint precedes irreversible removal. A later cleanup failure can leave a published artifact.
      await saveJson(record, { phase: 'publishing', target, stage, artifact, at: new Date().toISOString() });
      await rename(output, published); publishedArtifact = artifact;
      await verifyBackendArtifact({ directory, artifact });
      await saveJson(record, { phase: 'published', target, stage, artifact, cleanup: 'pending', at: new Date().toISOString() });
      await rm(stage, { recursive: true });
      await saveJson(record, { phase: 'published', target, artifact, buildOutput, cleanup: 'complete', at: new Date().toISOString() });
      return artifact;
    } catch (error) {
      // Saving failure facts must succeed before deleting the only remaining preparation evidence.
      await saveJson(record, { phase: 'failed-or-unknown', target, stage, artifact: publishedArtifact, buildOutput: error.buildOutput ?? buildOutput, code: /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'BACKEND_PREPARATION_FAILED', at: new Date().toISOString() });
      await rm(stage, { recursive: true, force: true }); throw error;
    }
  });
}
