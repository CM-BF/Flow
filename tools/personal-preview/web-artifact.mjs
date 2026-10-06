import { mkdir, lstat, realpath, readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildEnvironment } from './environment.mjs';
const execute = promisify(execFile);
const entry = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES = 64 * 1024 * 1024;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
async function privateDirectory(path) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0) fail('PRIVATE_ARTIFACT_DIRECTORY_REQUIRED');
  if (await realpath(path) !== resolve(path)) fail('ARTIFACT_SYMLINK_REJECTED');
}
async function artifactRoot(directory) {
  if (!isAbsolute(directory)) fail('ABSOLUTE_ARTIFACT_DIRECTORY_REQUIRED');
  await privateDirectory(directory);
  const root = join(directory, 'web-artifacts');
  await mkdir(root, { mode: 0o700, recursive: true }); await privateDirectory(root);
  return root;
}
async function sourceIdentity(repository, target) {
  if (!/^[a-f0-9]{40}$/.test(target ?? '')) fail('EXPLICIT_SOURCE_TARGET_REQUIRED');
  const git = async (...args) => (await execute('git', ['-C', repository, ...args], { timeout: 2000, maxBuffer: 1024 * 1024 })).stdout.trim();
  if (await git('rev-parse', 'HEAD') !== target || await git('status', '--porcelain')) fail('SOURCE_TARGET_NOT_CLEAN');
  return { sourceHead: target, sourceTree: await git('rev-parse', 'HEAD^{tree}'), lockDigest: sha(await readFile(join(repository, 'pnpm-lock.yaml'))) };
}
async function filesAt(dist) {
  const files = []; let totalBytes = 0;
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name); const relative = prefix + name; const info = await lstat(path);
      if (info.isSymbolicLink() || !info.isDirectory() && !info.isFile()) fail('ARTIFACT_SYMLINK_REJECTED');
      if (info.isDirectory()) { await visit(path, `${relative}/`); continue; }
      totalBytes += info.size;
      if (files.length >= 4096 || totalBytes > MAX_BYTES || info.size > 32 * 1024 * 1024) fail('WEB_ARTIFACT_TOO_LARGE');
      files.push({ path: relative, bytes: info.size, sha256: sha(await readFile(path)) });
    }
  }
  const root = await lstat(dist);
  if (!root.isDirectory() || root.isSymbolicLink()) fail('ARTIFACT_SYMLINK_REJECTED');
  await visit(dist);
  if (!files.some(file => file.path === 'index.html')) fail('WEB_ARTIFACT_INDEX_REQUIRED');
  return { files, totalBytes };
}
function validateDescriptor(artifact) {
  if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.artifactId ?? '') || artifact.manifestDigest !== artifact.artifactId || !/^[a-f0-9]{40}$/.test(artifact.sourceHead ?? '')) fail('WEB_ARTIFACT_DESCRIPTOR_INVALID');
}
async function manifestBytes(path) {
  await privateDirectory(path);
  const file = join(path, 'manifest.json'); const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) fail('WEB_ARTIFACT_INTEGRITY_MISMATCH');
  return readFile(file);
}
/** Verifies every served byte and the complete file set, not just the entry HTML. */
export async function verifyWebArtifact({ directory, artifact }) {
  validateDescriptor(artifact);
  const root = await artifactRoot(directory); const path = join(root, artifact.artifactId);
  await privateDirectory(path);
  if (JSON.stringify((await readdir(path)).sort()) !== JSON.stringify(['dist', 'manifest.json'])) fail('WEB_ARTIFACT_INTEGRITY_MISMATCH');
  const bytes = await manifestBytes(path);
  if (sha(bytes) !== artifact.manifestDigest) fail('WEB_ARTIFACT_INTEGRITY_MISMATCH');
  const manifest = JSON.parse(bytes);
  if (!(manifest.format === 1 && manifest.policy === 'flow-static-web-v1' || manifest.format === 2 && manifest.policy === 'flow-static-web-v2'
    && /^[a-f0-9]{32}$/.test(manifest.releaseId ?? '')) || manifest.sourceHead !== artifact.sourceHead) fail('WEB_ARTIFACT_INTEGRITY_MISMATCH');
  const dist = join(path, 'dist'); const actual = await filesAt(dist);
  if (JSON.stringify(actual.files) !== JSON.stringify(manifest.files) || actual.totalBytes !== manifest.totalBytes) fail('WEB_ARTIFACT_INTEGRITY_MISMATCH');
  return { dist, manifest };
}
/** Trusted frozen worktree build. Installation and the current published pointer are untouched. */
export async function prepareWebArtifact({ repository, target, directory, releaseId }) {
  if (releaseId !== undefined && !/^[a-f0-9]{32}$/.test(releaseId)) fail('WEB_RELEASE_NAMESPACE_INVALID');
  const source = await sourceIdentity(repository, target); const root = await artifactRoot(directory);
  const require = createRequire(join(repository, 'apps/web/package.json'));
  const vite = JSON.parse(await readFile(require.resolve('vite/package.json'))).version;
  // Reuse only fully verified bytes for this exact source and toolchain; never adopt a partial stage.
  for (const artifactId of await readdir(root)) {
    if (!/^[a-f0-9]{64}$/.test(artifactId)) continue;
    const candidate = { artifactId, manifestDigest: artifactId, sourceHead: target };
    const manifest = JSON.parse(await manifestBytes(join(root, artifactId)));
    if (manifest.releaseId !== releaseId || manifest.sourceHead !== target || manifest.sourceTree !== source.sourceTree || manifest.lockDigest !== source.lockDigest
      || manifest.toolchain?.node !== process.versions.node || manifest.toolchain?.vite !== vite) continue;
    await verifyWebArtifact({ directory, artifact: candidate }); return candidate;
  }
  const stage = join(root, `.stage-${randomUUID()}`); await mkdir(stage, { mode: 0o700 });
  try {
    try {
      await execute(process.execPath, [entry, 'internal-build', repository, join(stage, 'dist'), ...(releaseId ? [releaseId] : [])], {
        cwd: repository, env: buildEnvironment(), timeout: 90_000, killSignal: 'SIGKILL', maxBuffer: 65_536,
      });
    } catch { fail('WEB_BUILD_FAILED'); }
    if (JSON.stringify(await sourceIdentity(repository, target)) !== JSON.stringify(source)) fail('SOURCE_CHANGED_DURING_BUILD');
    const content = await filesAt(join(stage, 'dist'));
    const manifest = { format: releaseId ? 2 : 1, policy: releaseId ? 'flow-static-web-v2' : 'flow-static-web-v1', ...(releaseId ? { releaseId } : {}), ...source, toolchain: { node: process.versions.node, vite }, ...content };
    const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`); const digest = sha(bytes);
    const artifact = { artifactId: digest, sourceHead: target, manifestDigest: digest };
    await writeFile(join(stage, 'manifest.json'), bytes, { flag: 'wx', mode: 0o600 });
    try { await rename(stage, join(root, digest)); }
    catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error; }
    await verifyWebArtifact({ directory, artifact }); return artifact;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
async function build(repository, outDir, releaseId) {
  const require = createRequire(join(repository, 'apps/web/package.json'));
  const vite = await import(pathToFileURL(require.resolve('vite')).href);
  await vite.build({ ...(releaseId ? { base: `/__flow_releases/${releaseId}/` } : {}), root: join(repository, 'apps/web'), envDir: false, mode: 'production', logLevel: 'silent',
    define: { 'import.meta.env.VITE_FLOW_FIXTURE': JSON.stringify('false') },
    build: { outDir, emptyOutDir: true, sourcemap: false } });
}
if (process.argv[1] === entry && process.argv[2] === 'internal-build') {
  try { await build(process.argv[3], process.argv[4], process.argv[5]); }
  catch { process.stderr.write('WEB_BUILD_FAILED\n'); process.exitCode = 1; }
}
