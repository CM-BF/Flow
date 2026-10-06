import { mkdtemp, mkdir, cp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { create } from 'tar';
import { test, expect } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage, type PackagePrepareInput } from './package-store.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'flow-plugin-material-test-'));
  try {
  const source = join(root, 'source'); const storeRoot = join(root, 'store');
  await mkdir(source); await mkdir(storeRoot, { mode: 0o700 });
  await cp(fileURLToPath(new URL('../../../fixtures/plugins/text-tool', import.meta.url)), join(source, 'package'), { recursive: true });
  const tarballPath = join(root, 'package.tgz');
  await create({ cwd: source, file: tarballPath, gzip: true, portable: true, noMtime: true }, ['package']);
  const bytes = await readFile(tarballPath);
  const artifact = { artifactId: randomUUID(), name: '@flow-fixtures/text-tool', version: '1.0.0', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  const input: PackagePrepareInput = { artifact, tarballPath, store: { root: storeRoot, storeId: 'self-owned', allowedDigests: [artifact.sha256] } };
  return { root, input };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

test('a real npm fixture is installed once and independently read with exact identity after restart', async () => {
  const f = await fixture();
  try {
    const installed = await prepareInstalledPackage(f.input);
    expect(installed.receipt.artifact).toEqual(f.input.artifact);
    expect(installed.receipt.files.map(file => file.path)).toEqual(['flow-plugin.json', 'index.mjs', 'package.json']);
    expect(installed.receipt.manifest).toEqual({ schemaVersion: 1, hostApiMajor: 1, kind: 'tool', entrypoint: 'index.mjs' });
    expect(await readFile(installed.entrypoint, 'utf8')).toContain('export function invoke');
    expect(await prepareInstalledPackage(f.input)).toEqual(installed);
    expect(await readInstalledPackage(structuredClone(f.input))).toEqual(installed);
    expect(await readdir(f.input.store.root)).toEqual([installed.receipt.installationId]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
