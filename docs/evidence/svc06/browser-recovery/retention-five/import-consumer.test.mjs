import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as backend from '../../../../../tools/personal-preview/backend-release/index.mjs';
import { digest, withStoreLock } from '../../../../../tools/personal-preview/backend-release/files.mjs';
import { nodeIdentity } from '../../../../../tools/personal-preview/backend-release/node-identity.mjs';
import { currentMigrationIO } from '../current-migration.mjs';

async function syntheticArtifact(directory, number, node) {
  const content = `fixed-${number}`;
  const manifest = { policy: backend.BACKEND_POLICY, sourceHead: String(number).repeat(40), node,
    inventory: { entries: [{ path: 'content.txt', kind: 'file', bytes: Buffer.byteLength(content),
      executable: false, sha256: digest(content) }], bytes: Buffer.byteLength(content) } };
  const encoded = `${JSON.stringify(manifest)}\n`, artifactId = digest(encoded);
  const path = join(directory, 'backend-artifacts', artifactId);
  await mkdir(path, { mode: 0o700 }); await mkdir(join(path, 'root'), { mode: 0o700 });
  await writeFile(join(path, 'root', 'content.txt'), content, { mode: 0o600 });
  await writeFile(join(path, 'manifest.json'), encoded, { mode: 0o600 });
  return { path, encoded, content, artifact: { policy: backend.BACKEND_POLICY, artifactId,
    manifestDigest: artifactId, sourceHead: manifest.sourceHead } };
}

test('retention migration consumer verifies a fifth artifact and preserves the old set through the real locked store port', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'svc06-five-consumer-')));
  try {
    const installation = join(root, 'installation'), source = join(root, 'source'), run = join(root, 'run');
    for (const directory of [installation, source, run]) await mkdir(directory, { mode: 0o700 });
    for (const directory of [installation, source]) await mkdir(join(directory, 'backend-artifacts'), { mode: 0o700 });
    const node = await nodeIdentity(), old = [];
    for (const n of [1, 2, 3, 4]) old.push(await syntheticArtifact(installation, n, node));
    const fifth = await syntheticArtifact(source, 5, node);
    const verified = await backend.verifyBackendArtifact({ directory: source, artifact: fifth.artifact });
    const input = { installationDirectory: installation, artifact: fifth.artifact,
      retainedArtifacts: old.map(item => item.artifact), artifactTotalLogicalBytes: verified.totalBytes };
    const store = join(installation, 'backend-artifacts'), modules = { backend };
    const ports = await currentMigrationIO(modules, input, run, () => {}).stage(store, verified);
    const inspect = () => withStoreLock(store, () => ports.inspectStore());
    assert.equal(await inspect(), false);
    assert.deepEqual(await readdir(run), []);
    // Materialize only this test's already verified fifth artifact; no real import or personal path.
    await rename(fifth.path, join(store, fifth.artifact.artifactId));
    assert.equal(await inspect(), true);
    const sixth = await syntheticArtifact(source, 6, node);
    const sixthVerified = await backend.verifyBackendArtifact({ directory: source, artifact: sixth.artifact });
    const sixthInput = { ...input, artifact: sixth.artifact, retainedArtifacts: [...input.retainedArtifacts, fifth.artifact],
      artifactTotalLogicalBytes: sixthVerified.totalBytes };
    const sixthPorts = await currentMigrationIO(modules, sixthInput, run, () => {}).stage(store, sixthVerified);
    await assert.rejects(withStoreLock(store, () => sixthPorts.inspectStore()), { code: 'BACKEND_RETENTION_FULL' });
    assert.deepEqual((await readdir(store)).sort(), [...old.map(item => item.artifact.artifactId), fifth.artifact.artifactId].sort());
    for (const item of old) {
      assert.equal(await readFile(join(item.path, 'manifest.json'), 'utf8'), item.encoded);
      assert.equal(await readFile(join(item.path, 'root', 'content.txt'), 'utf8'), item.content);
    }
    await writeFile(join(store, 'unknown'), 'keep', { mode: 0o600 });
    await assert.rejects(inspect(), /STORE_UNKNOWN/);
    assert.equal(await readFile(join(store, 'unknown'), 'utf8'), 'keep');
    await rm(join(store, 'unknown'));
    const failed = Object.assign(new Error('FIXED_VERIFICATION_UNKNOWN'), { code: 'FIXED_VERIFICATION_UNKNOWN' });
    modules.backend = { verifyBackendArtifact: async () => { throw failed; } };
    await assert.rejects(inspect(), error => error === failed);
    modules.backend = { verifyBackendArtifact: async () => ({ totalBytes: Number.NaN }) };
    await assert.rejects(inspect(), { code: 'BACKEND_RETENTION_INVALID' });
    modules.backend = { verifyBackendArtifact: async () => ({ totalBytes: 512 * 1024 ** 2 }) };
    await assert.rejects(inspect(), { code: 'BACKEND_RETENTION_FULL' });
    assert.ok(!(await readdir(store)).includes('prepare.lock'));
    assert.deepEqual(await readdir(run), []);
    for (const item of old) assert.equal(await readFile(join(item.path, 'manifest.json'), 'utf8'), item.encoded);
  } finally { await rm(root, { recursive: true }); }
});
