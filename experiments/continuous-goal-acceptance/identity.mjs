import assert from 'node:assert/strict';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BASE } from './config.mjs';
import { digest, readRecord } from './records.mjs';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
export const RESERVATIONS = fileURLToPath(new URL('../../docs/evidence/o16/attempts/', import.meta.url));
export async function sourceIdentity({ requireClean = true } = {}) {
  const root = await realpath(ROOT);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 262_144 }).trim();
  assert.equal(git(['diff', '--name-only', BASE, '--', 'apps', 'packages', 'package.json', 'pnpm-lock.yaml']), '');
  if (requireClean) assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'experiments/continuous-goal-acceptance', 'apps', 'packages', 'package.json', 'pnpm-lock.yaml']), '');
  const prepared = await readRecord(new URL('../../docs/evidence/o16/product-entry-static-preflight.json', import.meta.url), 262_144);
  const expected = [...prepared.staticSources, ...prepared.externalSql, ...prepared.configs];
  const links = await readRecord(new URL('../../docs/evidence/o16/dependency-links.json', import.meta.url));
  assert.equal(links.worktree, root); assert(process.versions.node.startsWith('24.'));
  const dependencies = [];
  for (const row of links.created) {
    assert(row.destination.startsWith(root + '/'));
    const target = await realpath(row.destination); assert.equal(target, row.source);
    if (row.name.startsWith('@flow/')) assert(target.startsWith(root + '/'));
    const bytes = await readFile(target + '/package.json');
    const data = JSON.parse(bytes);
    if (row.kind === 'own-workspace') {
      assert.equal(row.versionFromFixedManifest, 'workspace:*');
      const fixed = JSON.parse(git(['show', BASE + ':' + target.slice(root.length + 1) + '/package.json']));
      assert.equal(data.version, fixed.version); assert.equal(data.name, row.name);
    } else assert.equal(data.version, row.installedVersion);
    dependencies.push({ path: row.destination.slice(root.length + 1), name: row.name, version: data.version, packageSha256: digest(bytes) });
  }
  const files = [];
  for (const row of expected) {
    assert(typeof row.path === 'string' && !row.path.includes('..') && !row.path.startsWith('/'));
    const bytes = await readFile(new URL('../../' + row.path, import.meta.url));
    assert.equal(digest(bytes), row.sha256); assert.equal(bytes.length, row.bytes); files.push(row);
  }
  for (const name of (await readdir(new URL('./', import.meta.url))).filter(n => n.endsWith('.mjs')).sort()) {
    const bytes = await readFile(new URL(name, import.meta.url)); files.push({ path: `experiments/continuous-goal-acceptance/${name}`, bytes: bytes.length, sha256: digest(bytes) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root, base: BASE, files, dependencies, digest: digest(JSON.stringify({ files, dependencies })) };
}
