import { constants } from 'node:fs';
import { open, lstat, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { digest, fail } from './files.mjs';
import { runtimeDependencyPlan } from './dependency-plan.mjs';
import { installationView, verifyInstallationView } from './installation-view.mjs';
import { runtimeCachePlan } from './cache-plan.mjs';

const documentLimit = 4 * 1024 ** 2;
const indexLimit = 2 * 1024 ** 2;
const aggregateLimit = 32 * 1024 ** 2;

/** Build-only dependency: importing the host does not load the YAML package. */
export async function parseBuildYaml(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > documentLimit) fail('BACKEND_LOCK_BUDGET');
  const [{ parseDocument }, { default: metadata }] = await Promise.all([
    import('yaml'), import('yaml/package.json', { with: { type: 'json' } }),
  ]);
  if (metadata.version !== '2.9.0') fail('BACKEND_YAML_VERSION');
  try {
    const document = parseDocument(text, { version: '1.2', schema: 'core', strict: true, uniqueKeys: true, stringKeys: true, prettyErrors: false });
    if (document.errors.length || document.warnings.length || document.directives.yaml.version !== '1.2') fail('BACKEND_LOCK_PARSE');
    return document.toJS({ maxAliasCount: 0 });
  } catch { fail('BACKEND_LOCK_PARSE'); }
}

function relativePath(path) {
  if (typeof path !== 'string' || !path || path.length > 1024 || /[\\\x00-\x1f]/.test(path) || path.startsWith('/') || path === '..' || path.startsWith('../') || posix.normalize(path) !== path) fail('BACKEND_INSTALLATION_PATH');
  return path;
}

async function readDocument(root, relative, maximumBytes) {
  relativePath(relative);
  let parent = root;
  for (const part of ['.', ...relative.split('/').slice(0, -1)]) {
    parent = join(parent, part);
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink()) fail('BACKEND_INSTALLATION_PATH');
  }
  const file = await open(join(root, relative), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > maximumBytes) fail('BACKEND_INSTALLATION_DOCUMENT_BUDGET');
    const buffer = Buffer.alloc(before.size + 1); let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const after = await file.stat();
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) fail('BACKEND_INSTALLATION_DOCUMENT_CHANGED');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset)); }
    catch { fail('BACKEND_INSTALLATION_DOCUMENT_ENCODING'); }
  } finally { await file.close(); }
}

async function workspaceManifests(root, lock) {
  const importers = lock?.importers;
  if (!importers || typeof importers !== 'object' || Array.isArray(importers) || Object.keys(importers).length > 64) fail('BACKEND_LOCK_SHAPE');
  const manifests = {}, originals = {}; let bytes = 0;
  for (const importer of Object.keys(importers).sort()) {
    relativePath(importer);
    const path = posix.join(importer, 'package.json');
    const text = await readDocument(root, path, documentLimit);
    bytes += Buffer.byteLength(text);
    if (bytes > documentLimit) fail('BACKEND_LOCK_BUDGET');
    try { manifests[importer] = JSON.parse(text); } catch { fail('BACKEND_MANIFEST_PARSE'); }
    originals[path] = text;
  }
  return { manifests, originals };
}

/** Own staging only. No clone, install, network, or runtime launch occurs here. */
export async function prepareRuntimeInstallation({ root, seed, stage, pnpmVersion, host = { os: process.platform, cpu: process.arch, libc: null } }) {
  const originalLock = await readDocument(root, 'pnpm-lock.yaml', documentLimit);
  const lock = await parseBuildYaml(originalLock);
  const { manifests, originals } = await workspaceManifests(root, lock);
  const plan = runtimeDependencyPlan({ lock, manifests, host, pnpmVersion });
  const indexes = {}; let indexBytes = 0;
  for (const pkg of plan.packages) {
    const text = await readDocument(seed, pkg.cacheIndex, indexLimit);
    indexBytes += Buffer.byteLength(text);
    if (indexBytes > aggregateLimit) fail('BACKEND_CACHE_BUDGET');
    indexes[pkg.cacheIndex] = text;
  }
  const cache = runtimeCachePlan(plan, indexes), view = installationView(plan);
  const cloneText = JSON.stringify({ policy: 'flow.backend-cache-clone.v1', files: cache.files });
  if (Buffer.byteLength(cloneText) > aggregateLimit) fail('BACKEND_CLONE_PLAN_BUDGET');
  const cloneManifest = join(stage, 'selected-cache.json');
  await writeFile(cloneManifest, cloneText, { flag: 'wx', mode: 0o600 });
  await writeFile(join(root, 'package.json'), view.manifest);
  await writeFile(join(root, 'pnpm-lock.yaml'), view.lock);
  return { root, plan, originals, originalLock, view, cloneManifest, cache,
    record: { policy: plan.policy, parser: { name: 'yaml', version: '2.9.0', buildOnly: true },
      sourceLockDigest: digest(originalLock), installationLockDigest: digest(view.lock),
      sourceManifestDigest: digest(originals['package.json']), installationSemanticDigest: plan.installationSemanticDigest,
      hostTools: plan.hostTools, importers: plan.importers, snapshots: plan.snapshots, cacheFiles: cache.files.length, cacheLogicalBytes: cache.logicalBytes } };
}

/** A successful frozen install must preserve the projection before original source bytes return. */
export async function restoreRuntimeSource(prepared) {
  const { root, plan, originals, originalLock } = prepared;
  const installedLock = await readDocument(root, 'pnpm-lock.yaml', documentLimit);
  const manifest = await readDocument(root, 'package.json', documentLimit);
  verifyInstallationView(plan, { manifest, lock: JSON.stringify(await parseBuildYaml(installedLock)) });
  for (const [path, text] of Object.entries(originals)) {
    if (path !== 'package.json' && await readDocument(root, path, documentLimit) !== text) fail('BACKEND_WORKSPACE_MANIFEST_CHANGED');
  }
  await writeFile(join(root, 'package.json'), originals['package.json']);
  await writeFile(join(root, 'pnpm-lock.yaml'), originalLock);
  if (await readDocument(root, 'package.json', documentLimit) !== originals['package.json'] || await readDocument(root, 'pnpm-lock.yaml', documentLimit) !== originalLock) fail('BACKEND_SOURCE_RESTORE_FAILED');
  return { ...prepared.record, sourceBytesRestored: true, installedProjectionVerified: true };
}
