import assert from 'node:assert/strict';
import { open, lstat, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export const BACKEND = 'af51c621696230fbced12227670f014ca73bd8a1';
export const BACKEND_ROOT = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const retainedRoot = '/private/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-svc05-0FB4IE';
export const RETAINED = Object.freeze([
  { label: 'retained-0', directory: retainedRoot + '/retained-0', artifact: { artifactId: '461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90', sourceHead: 'b1c2e39837c2208e6fc2c59a80e16797f26448b5', manifestDigest: '461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90' }, bytes: 1442591, format: 1, releaseId: null },
  { label: 'retained-1', directory: retainedRoot + '/retained-1', artifact: { artifactId: 'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe', sourceHead: '8d8ab520a9d43c7b9dafb22911416ee799ebf665', manifestDigest: 'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe' }, bytes: 1507758, format: 2, releaseId: '8d8ab520a9d43c7b9dafb22911416ee7' },
]);
const execute = promisify(execFile);
/** Fixed local inputs only; FIFO and post-stat growth fail closed. */
export async function boundedFile(path, max) {
  const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await f.stat(); assert.ok(info.isFile() && info.uid === process.getuid() && info.size <= max);
    assert.equal(await realpath(path), resolve(path));
    const buffer = Buffer.alloc(max + 1); let length = 0;
    while (length < buffer.length) { const r = await f.read(buffer, length, buffer.length - length, null); if (!r.bytesRead) break; length += r.bytesRead; }
    assert.ok(length <= max, 'Input byte limit'); return buffer.subarray(0, length);
  } finally { await f.close(); }
}
/** Metadata HEAD may advance; every materialized runtime/SQL byte must match af51. */
export async function backendIdentity() {
  const prefixes = ['apps/server/src', 'apps/runner/src', 'packages', 'tools/personal-preview', 'package.json', 'apps/server/package.json', 'apps/runner/package.json', 'pnpm-lock.yaml', 'tsconfig.json'];
  const result = await execute('git', ['-C', BACKEND_ROOT, 'ls-tree', '-r', '-z', BACKEND, '--', ...prefixes], { timeout: 3000, maxBuffer: 1024 * 1024 });
  const rows = result.stdout.split('\0').filter(Boolean); assert.ok(rows.length > 0 && rows.length <= 3000);
  const files = []; let totalBytes = 0;
  for (const row of rows) {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row); assert.ok(match && match[1] === '100644');
    const [, , oid, path] = match; const bytes = await boundedFile(join(BACKEND_ROOT, path), 2 * 1024 * 1024);
    totalBytes += bytes.length; assert.ok(totalBytes <= 24 * 1024 * 1024);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), oid, `Backend changed: ${path}`);
    files.push({ path, bytes: bytes.length, sha256: sha(bytes), blob: oid });
  }
  return { backend: BACKEND, root: BACKEND_ROOT, files, totalBytes };
}
/** Only the two existing public artifact copies. Never reads personal installation state. */
export async function inventory() {
  const artifacts = [];
  for (const entry of RETAINED) {
    const directory = join(entry.directory, 'web-artifacts', entry.artifact.artifactId);
    const bytes = await boundedFile(join(directory, 'manifest.json'), 65536), manifest = JSON.parse(bytes);
    assert.equal(sha(bytes), entry.artifact.manifestDigest); assert.equal(manifest.sourceHead, entry.artifact.sourceHead);
    assert.equal(manifest.format, entry.format); assert.equal(manifest.releaseId ?? null, entry.releaseId);
    assert.equal(manifest.totalBytes, entry.bytes); assert.equal(manifest.files.length, 10);
    const dist = join(directory, 'dist'), found = []; let total = 0, visited = 0;
    async function scan(path, prefix = '') {
      for (const name of (await readdir(path)).sort()) {
        assert.ok(++visited <= 32, 'Artifact entry bound');
        const info = await lstat(join(path, name)); assert.equal(info.isSymbolicLink(), false);
        if (info.isDirectory()) { assert.ok(prefix.length < 128); await scan(join(path, name), prefix + name + '/'); }
        else { assert.ok(info.isFile() && found.length < 10); const body = await boundedFile(join(path, name), entry.bytes); total += body.length; assert.ok(total <= entry.bytes); found.push({ path: prefix + name, bytes: body.length, sha256: sha(body) }); }
      }
    }
    await scan(dist); assert.deepEqual(found, manifest.files); assert.equal(total, entry.bytes);
    artifacts.push({ ...entry, dist, manifest });
  }
  return { observedAt: new Date().toISOString(), targetBackend: BACKEND, artifacts, personalActions: 0, providerQueries: 0 };
}
