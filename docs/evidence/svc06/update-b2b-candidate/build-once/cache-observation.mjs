// Read-only selected-cache metadata preparation. No payload hashing, clone or installation.
import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseBuildYaml } from '../../../../../tools/personal-preview/backend-release/runtime-installation.mjs';
import { runtimeDependencyPlan } from '../../../../../tools/personal-preview/backend-release/dependency-plan.mjs';
import { runtimeCachePlan } from '../../../../../tools/personal-preview/backend-release/cache-plan.mjs';
const source = 'b2b5612b2a63106ad0e674ddf12b2e8f96cf3388';
const seed = '/Users/citrine/Library/pnpm/store/v3';
const startedAt = new Date().toISOString(), deadline = Date.now() + 25000;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readGit = path => execFileSync('/usr/bin/git', ['show', `${source}:${path}`], { timeout: 3000, maxBuffer: 4 * 1024 ** 2 }).toString('utf8');
const lockText = readGit('pnpm-lock.yaml'), lock = await parseBuildYaml(lockText);
const manifests = Object.fromEntries(Object.keys(lock.importers).map(path => [path, JSON.parse(readGit(path === '.' ? 'package.json' : `${path}/package.json`))]));
const plan = runtimeDependencyPlan({ lock, manifests, pnpmVersion: '9.15.4', host: { os: 'darwin', cpu: 'arm64', libc: null } });
const parents = new Map();
async function parent(path) {
  if (parents.has(path)) return;
  const value = await lstat(path);
  if (!value.isDirectory() || value.isSymbolicLink() || value.uid !== process.getuid()) throw new Error('SEED_PARENT_UNKNOWN');
  parents.set(path, { dev: value.dev, ino: value.ino });
}
await parent(seed); await parent(join(seed, 'files'));
const indexes = {}, bindings = [], errors = [], modeObservations = []; let indexBytes = 0, installedLogicalBytes = 0, installedFileReferences = 0;
for (const pkg of plan.packages) {
  if (Date.now() >= deadline) throw new Error('OBSERVATION_DEADLINE');
  await parent(join(seed, 'files', pkg.cacheIndex.split('/')[1]));
  let file;
  try {
    file = await open(join(seed, pkg.cacheIndex), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await file.stat();
    if (!before.isFile() || before.size > 2 * 1024 ** 2) throw new Error('INDEX_REGULAR_BUDGET');
    const bytes = Buffer.alloc(before.size + 1); let offset = 0;
    while (offset < bytes.length) { const result = await file.read(bytes, offset, bytes.length - offset, offset); if (!result.bytesRead) break; offset += result.bytesRead; }
    const after = await file.stat();
    if (offset !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('INDEX_CHANGED');
    const body = bytes.subarray(0, offset); indexBytes += body.length;
    if (indexBytes > 32 * 1024 ** 2) throw new Error('INDEX_TOTAL_BUDGET');
    indexes[pkg.cacheIndex] = body.toString('utf8');
    bindings.push({ key: pkg.key, path: pkg.cacheIndex, bytes: body.length, sha256: hash(body), dev: before.dev, ino: before.ino });
    const values = Object.values(JSON.parse(indexes[pkg.cacheIndex]).files);
    installedFileReferences += values.length; installedLogicalBytes += values.reduce((sum, value) => sum + value.size, 0);
  } catch (error) { errors.push({ key: pkg.key, code: error.code ?? error.message }); }
  finally { await file?.close(); }
}
let cache = null, allocatedBytes = 0, fileMetadataDigest = null;
const observed = [], inodes = new Set();
if (!errors.length) {
  cache = runtimeCachePlan(plan, indexes);
  for (const file of cache.files) {
    if (Date.now() >= deadline) throw new Error('OBSERVATION_DEADLINE');
    try {
      await parent(join(seed, 'files', file.path.split('/')[1]));
      const info = await lstat(join(seed, file.path));
      if (!info.isFile() || info.isSymbolicLink() || info.size !== file.bytes) throw new Error('CONTENT_METADATA_MISMATCH');
      if (file.kind === 'content' && Boolean(info.mode & 0o111) !== file.executable) modeObservations.push({ path: file.path, executableExpected: file.executable, mode: info.mode & 0o777 });
      const id = `${info.dev}:${info.ino}`;
      if (!inodes.has(id)) allocatedBytes += info.blocks * 512;
      inodes.add(id); observed.push([file.path, info.dev, info.ino, info.size, info.blocks, info.nlink]);
    } catch (error) { errors.push({ path: file.path, code: error.code ?? error.message }); }
  }
  fileMetadataDigest = hash(JSON.stringify(observed));
}
for (const [path, before] of parents) { const after = await lstat(path); if (before.dev !== after.dev || before.ino !== after.ino || !after.isDirectory() || after.isSymbolicLink()) errors.push({ path, code: 'SEED_PARENT_CHANGED' }); }
console.log(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), source, lockSha256: hash(lockText), seed, realSeed: await realpath(seed), seedIdentity: parents.get(seed), hostTools: plan.hostTools, importers: plan.importers, snapshots: plan.snapshots.length, snapshotKeys: plan.snapshots, packages: plan.packages.length, indexBytes, selectedFiles: cache?.files.length ?? null, cacheLogicalBytes: cache?.logicalBytes ?? null, selectedAllocatedBytesDeduplicatedByDeviceInode: allocatedBytes, installedFileReferences, installedLogicalBytesBeforeLayout: installedLogicalBytes, contentMetadataCount: observed.length, fileMetadataDigest, errors, modeObservations, modeObservationMeaning: "Informational only: existing clone contract verifies regular file/content and applies manifest executable mode; old mode-probe failures remain unchanged", indexBindings: bindings, contentIntegrity: 'NOT_HASHED; actual build verifies every selected source and cloned destination', physicalPeak: 'NOT_MEASURED; st_blocks is not clone-exclusive allocation or reclaimable space', install: 'NOT_RUN' }, null, 2));
if (errors.length) process.exitCode = 1;
