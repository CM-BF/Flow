import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, statfs, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMPARISON, type Side } from './ab-budget.js';

const INPUT_PATHS = ['apps/server', 'apps/runner', 'packages', 'package.json', 'tsconfig.json', 'pnpm-lock.yaml'];
export type InputFile = { path: string; oid: string; bytes: Buffer };
export type InputAccounting = { work(): void; remainingMs: number; chargeCommon(category: string, bytes: number): void };
export function inputPath(path: string) {
  assert(path && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..' || part === 'node_modules' || part === '.git'), 'invalid_input_path');
  assert(INPUT_PATHS.some(root => path === root || path.startsWith(root + '/')), 'unexpected_input_path');
  return path;
}
export function verifyPair(a: readonly InputFile[], b: readonly InputFile[]) {
  const before = new Map(a.map(file => [file.path, file]));
  const after = new Map(b.map(file => [file.path, file]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(path => before.get(path)?.oid !== after.get(path)?.oid).sort();
  assert.deepEqual(changed, ['apps/server/src/event-state.test.ts', 'apps/server/src/events.ts'], 'unexpected_production_difference');
}
export function productionModule(sourceDirectory: string | undefined, path: 'apps/server/src/index.js' | 'apps/runner/src/runtime.js' | 'apps/runner/src/fixture.js') {
  return sourceDirectory ? pathToFileURL(join(sourceDirectory, path)).href : new URL('../../../' + path, import.meta.url).href;
}
export async function checkDisk(directory: string, reserveBytes = COMPARISON.totalBytes) {
  const disk = await statfs(directory);
  const availableBytes = disk.bavail * disk.bsize;
  // Additional DB/WAL capacity must be reviewed before OPEN; stream bytes are not a disk bound.
  assert(availableBytes >= 1024 ** 3 + reserveBytes, 'comparison_disk_reserve_unavailable');
  return availableBytes;
}
function frozenFiles(repo: string, side: Side, accounting: InputAccounting): InputFile[] {
  const git = (args: string[], input?: string) => {
    accounting.work();
    const bytes = execFileSync('git', ['-C', repo, ...args], { input, maxBuffer: 12 * 1024 * 1024, timeout: Math.max(1, Math.min(5000, accounting.remainingMs)) });
    accounting.chargeCommon('git-output', bytes.length); return bytes;
  };
  const rows = git(['ls-tree', '-rz', COMPARISON.revisions[side], '--', ...INPUT_PATHS]).toString('utf8').split('\0').filter(Boolean);
  const entries = rows.map(row => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)$/.exec(row);
    assert(match, 'unexpected_input_mode'); return { oid: match[2]!, path: inputPath(match[3]!) };
  });
  assert(entries.length > 0 && entries.length <= 4000, 'input_file_count');
  const batch = git(['cat-file', '--batch'], entries.map(entry => entry.oid).join('\n') + '\n'); let offset = 0;
  const files = entries.map(entry => {
    const newline = batch.indexOf(10, offset); assert(newline >= offset, 'git_batch_header');
    const header = batch.subarray(offset, newline).toString('utf8').split(' ');
    assert.equal(header[0], entry.oid); assert.equal(header[1], 'blob');
    const size = Number(header[2]); assert(Number.isSafeInteger(size) && size >= 0 && size <= 2 * 1024 * 1024, 'git_blob_size');
    offset = newline + 1; const bytes = batch.subarray(offset, offset + size); offset += size;
    assert.equal(bytes.length, size); assert.equal(batch[offset++], 10);
    assert.equal(createHash('sha1').update('blob ' + size + '\0').update(bytes).digest('hex'), entry.oid);
    return { ...entry, bytes };
  });
  assert.equal(offset, batch.length); return files;
}
export async function materializeInput(repo: string, destination: string, files: readonly InputFile[], accounting: InputAccounting) {
  await mkdir(destination); // The caller owns this new root; never overwrite an earlier input.
  const manifests: { directory: string; value: { name?: string; dependencies?: Record<string, string> } }[] = [];
  for (const file of files) {
    accounting.work(); inputPath(file.path); accounting.chargeCommon('exported-input', file.bytes.length);
    const path = join(destination, file.path); await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.bytes, { flag: 'wx', mode: 0o444 });
    if (file.path.endsWith('/package.json')) manifests.push({ directory: dirname(file.path), value: JSON.parse(file.bytes.toString('utf8')) });
  }
  const workspace = new Map(manifests.filter(p => p.value.name).map(p => [p.value.name!, p.directory]));
  const dependencies: { declaringPackage: string; name: string; version: string; target: string; manifestSha256: string | null }[] = [];
  for (const pkg of manifests) for (const [name, version] of Object.entries(pkg.value.dependencies ?? {})) {
    accounting.work(); assert(/^(@[a-z0-9-]+\/)?[a-z0-9._-]+$/.test(name), 'invalid_dependency_name');
    let target: string; let manifestSha256: string | null = null;
    if (version === 'workspace:*') {
      const path = workspace.get(name); assert(path, 'workspace_dependency_missing'); target = join(destination, path);
    } else {
      target = await realpath(join(repo, pkg.directory, 'node_modules', name));
      const external = await readFile(join(target, 'package.json')); accounting.chargeCommon('external-manifests', external.length);
      const installed = JSON.parse(external.toString('utf8'));
      assert.equal(installed.name, name); assert.equal(installed.version, version, 'installed_dependency_version');
      manifestSha256 = createHash('sha256').update(external).digest('hex');
    }
    const link = join(destination, pkg.directory, 'node_modules', name); await mkdir(dirname(link), { recursive: true });
    await symlink(target, link);
    dependencies.push({ declaringPackage: pkg.directory, name, version, target: version === 'workspace:*' ? relative(destination, target) : target, manifestSha256 });
  }
  const pg = await realpath(join(destination, 'apps/server/node_modules/pg'));
  assert.equal(pg, await realpath(join(repo, 'node_modules/pg')), 'input_pg_prototype_mismatch');
  assert.equal(await realpath(join(dirname(await realpath(join(destination, 'apps/server/node_modules/pg-boss'))), 'pg')), pg, 'input_scheduler_pg_mismatch');
  return dependencies;
}
export async function exportInputs(repo: string, root: string, accounting: InputAccounting) {
  const a = frozenFiles(repo, 'A', accounting), b = frozenFiles(repo, 'B', accounting); verifyPair(a, b);
  const manifest = [];
  for (const [side, files] of [['A', a], ['B', b]] as const) {
    await checkDisk(repo);
    const directory = resolve(root, side); const dependencies = await materializeInput(repo, directory, files, accounting);
    manifest.push({ side, revision: COMPARISON.revisions[side], directory, dependencies,
      files: files.map(file => ({ path: file.path, oid: file.oid, bytes: file.bytes.length, sha256: createHash('sha256').update(file.bytes).digest('hex') })) });
  }
  return manifest;
}
