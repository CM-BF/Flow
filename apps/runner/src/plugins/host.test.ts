import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { test, expect } from 'vitest';
import { prepareInstalledPackage } from '@flow/plugin-runtime';
import { invokeInstalledTool, type FrozenToolInvocation } from './host.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'flow-plugin-host-test-'));
  try {
  const source = join(root, 'source'); await mkdir(source); const storeRoot = join(root, 'store'); await mkdir(storeRoot, { mode: 0o700 });
  await cp(fileURLToPath(new URL('../../../../fixtures/plugins/text-tool', import.meta.url)), join(source, 'package'), { recursive: true });
  const tarballPath = join(root, 'package.tgz');
  // A three-file USTAR fixture builder, not a product parser or loader mock.
  const entries: Buffer[] = [];
  for (const name of ['package.json', 'flow-plugin.json', 'index.mjs']) {
    const body = await readFile(join(source, 'package', name));
    const header = Buffer.alloc(512); header.write('package/' + name);
    header.write('0000600\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
    header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    entries.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  await writeFile(tarballPath, gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])));
  const bytes = await readFile(tarballPath);
  const artifact = { artifactId: randomUUID(), name: '@flow-fixtures/text-tool', version: '1.0.0', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  const store = { root: storeRoot, storeId: 'self-owned', allowedDigests: [artifact.sha256] };
  const { receipt } = await prepareInstalledPackage({ artifact, tarballPath, store });
  const binding: FrozenToolInvocation = { bindingId: randomUUID(), invocationId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 1,
    material: { artifact, installationId: receipt.installationId, treeDigest: receipt.treeDigest, storeId: store.storeId }, configuration: { prefix: 'verified: ' } };
  return { root, store, binding };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

test('loads the installed real npm module after authorization and returns bounded text with frozen provenance', async () => {
  const f = await fixture();
  try {
    let authorized = 0; let owned = 0;
    const result = await invokeInstalledTool({ ...f, input: 'hello', signal: new AbortController().signal,
      authorize: async binding => { authorized++; expect(binding).toEqual(f.binding); }, assertOwnership: () => { owned++; } });
    expect(result).toEqual({ kind: 'text', content: 'verified: hello', provenance: {
      bindingId: f.binding.bindingId, invocationId: f.binding.invocationId, taskId: f.binding.taskId, attemptId: f.binding.attemptId, ownerVersion: 1,
      installationId: f.binding.material.installationId, artifactId: f.binding.material.artifact.artifactId,
      artifactSha256: f.binding.material.artifact.sha256, treeDigest: f.binding.material.treeDigest, hostApiMajor: 1 } });
    expect(authorized).toBe(1); expect(owned).toBeGreaterThanOrEqual(1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
