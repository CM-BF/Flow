import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, symlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from './evidence.mjs';
export async function prepareRuntime(dependencyRoot, runDirectory) {
  const worktree = fileURLToPath(new URL('../../', import.meta.url));
  const productCommit = '7106a35447bf43026ad7b5ad7c25dc530fd0c4f5';
  const sourceRoot = resolve(runDirectory, 'source');
  await mkdir(sourceRoot, { recursive: true });
  const paths = ['apps/web', 'packages/client', 'packages/contracts', 'package.json', 'tsconfig.json', 'pnpm-lock.yaml'];
  const archive = execFileSync('git', ['archive', productCommit, ...paths], { cwd: worktree, maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', sourceRoot], { input: archive });
  for (const path of ['', 'apps/web/', 'packages/client/', 'packages/contracts/']) await symlink(resolve(dependencyRoot, path, 'node_modules'), resolve(sourceRoot, path, 'node_modules'));
  for (const path of ['package.json', 'pnpm-lock.yaml', 'apps/web/package.json']) {
    assert.equal(sha256(await readFile(resolve(sourceRoot, path))), sha256(await readFile(resolve(dependencyRoot, path))), `Installed dependency definition differs: ${path}`);
  }
  const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', productCommit, ...paths], { cwd: worktree, encoding: 'utf8' }).trim().split('\n');
  const sourceFiles = Object.fromEntries(await Promise.all(tracked.map(async path => [path, sha256(await readFile(resolve(sourceRoot, path)))])));
  return { sourceRoot, productCommit, archiveDigest: sha256(archive), sourceFiles };
}
