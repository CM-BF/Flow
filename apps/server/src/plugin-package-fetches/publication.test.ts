import { afterEach, expect, test } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPackageArtifact, readPackageArtifact, type PackageSource } from '../package-artifacts/index.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test('a host-preallocated artifact ID cannot replace a published receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-x05-publication-')); roots.push(root);
  const body = Buffer.from('known compressed fixture bytes');
  const source: PackageSource = {
    resolve: async () => 'https://registry.invalid/package.tgz',
    stream: async (_url, _request, _context, consume) => consume(Readable.from([body])),
  };
  const options = { root, registry: 'https://registry.invalid/', artifactId: randomUUID() };
  const input = { name: 'flow-x05-fixture', version: '1.0.0', integrity: 'sha512-' + createHash('sha512').update(body).digest('base64') };
  const receipt = await fetchPackageArtifact(options, input, undefined, source);
  expect(receipt.artifactId).toBe(options.artifactId);
  await expect(fetchPackageArtifact(options, input, undefined, source)).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  expect(await readPackageArtifact(root, options.artifactId)).toEqual(receipt);
  expect(await readdir(join(root, 'staging'))).toEqual([]);
  await expect(fetchPackageArtifact({ ...options, artifactId: '../not-a-path' }, input, undefined, source))
    .rejects.toMatchObject({ code: 'INVALID_CONFIGURATION' });
});
