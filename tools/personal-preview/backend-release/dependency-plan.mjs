import { posix } from 'node:path';
import { digest, fail } from './files.mjs';

export const RUNTIME_CLOSURE_POLICY = 'flow.backend-runtime-closure.v1';
const maximumBytes = 4 * 1024 ** 2;
const maximumEntries = 4096;
const roots = ['apps/server', 'apps/runner'];
const has = (record, key) => Object.hasOwn(record, key);
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('BACKEND_LOCK_SHAPE');
  if (Object.keys(value).length > maximumEntries) fail('BACKEND_LOCK_BUDGET');
  return value;
}
function map(value) { return value === undefined ? {} : record(value); }
function encoded(value) {
  let result;
  try { result = JSON.stringify(value); } catch { fail('BACKEND_LOCK_SHAPE'); }
  if (!result || Buffer.byteLength(result) > maximumBytes) fail('BACKEND_LOCK_BUDGET');
  return result;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function semanticDigest(value) { return digest(JSON.stringify(canonical(value))); }
function workspacePath(path) {
  if (typeof path !== 'string' || path.length > 512 || /[\\\x00-\x1f]/.test(path) || path.startsWith('/') || path === '..' || path.startsWith('../') || posix.normalize(path) !== path) fail('BACKEND_WORKSPACE_PATH');
  return path;
}
function snapshotKey(name, version) {
  if (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) || typeof version !== 'string' || version.length > 2048 || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\(.+\))?$/.test(version) || /[\x00-\x1f]/.test(version)) fail('BACKEND_DEPENDENCY_UNSUPPORTED');
  return `${name}@${version}`;
}
function platformAllows(values, actual) {
  if (values === undefined) return true;
  if (!Array.isArray(values) || !values.length || values.length > 32 || values.some(value => typeof value !== 'string' || !/^!?[a-z0-9_-]+$/.test(value))) fail('BACKEND_PLATFORM_UNSUPPORTED');
  if (!actual) fail('BACKEND_PLATFORM_UNKNOWN');
  if (values.includes(`!${actual}`)) return false;
  const included = values.filter(value => !value.startsWith('!'));
  return !included.length || included.includes(actual) || included.includes('any');
}
function packageIdentity(lock, key) {
  const base = key.split('(')[0];
  if (!has(lock.snapshots, key) || !has(lock.packages, base)) fail('BACKEND_LOCK_REFERENCE_MISSING');
  const metadata = record(lock.packages[base]);
  const resolution = record(metadata.resolution);
  if (Object.keys(resolution).some(key => key !== 'integrity') || typeof resolution.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(resolution.integrity)) fail('BACKEND_RESOLUTION_UNSUPPORTED');
  const bytes = Buffer.from(resolution.integrity.slice(7), 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== resolution.integrity.slice(7)) fail('BACKEND_RESOLUTION_UNSUPPORTED');
  const hex = bytes.toString('hex');
  return { base, metadata, integrity: resolution.integrity, cacheIndex: `files/${hex.slice(0, 2)}/${hex.slice(2)}-index.json` };
}
function validatedInput(input) {
  // The caller must use a real YAML parser. This module neither parses text nor reads/install packages.
  record(input); encoded(input);
  const { lock, manifests, host, pnpmVersion } = input;
  record(lock); record(manifests); record(host);
  if (pnpmVersion !== '9.15.4' || lock.lockfileVersion !== '9.0' || record(manifests['.']).packageManager !== 'pnpm@9.15.4') fail('BACKEND_LOCK_TOOL_MISMATCH');
  if (Object.keys(lock).some(key => !['lockfileVersion', 'settings', 'importers', 'packages', 'snapshots', 'overrides'].includes(key))) fail('BACKEND_LOCK_FEATURE_UNSUPPORTED');
  if (Object.keys(map(lock.overrides)).length) fail('BACKEND_LOCK_FEATURE_UNSUPPORTED');
  record(lock.importers); record(lock.packages); record(lock.snapshots);
  if (!/^[a-z0-9_-]+$/.test(host.os ?? '') || !/^[a-z0-9_-]+$/.test(host.cpu ?? '') || !(host.libc === null || /^[a-z0-9_-]+$/.test(host.libc ?? ''))) fail('BACKEND_PLATFORM_UNKNOWN');
  return input;
}
function validateDependencies(importer, manifest, kind) {
  const locked = map(importer[kind]), declared = map(manifest[kind]);
  if (JSON.stringify(Object.keys(locked).sort()) !== JSON.stringify(Object.keys(declared).sort())) fail('BACKEND_MANIFEST_LOCK_MISMATCH');
  for (const [name, value] of Object.entries(locked)) {
    if (record(value).specifier !== declared[name] || typeof declared[name] !== 'string' || typeof value.version !== 'string') fail('BACKEND_MANIFEST_LOCK_MISMATCH');
  }
  return locked;
}

/** Pure, bounded build plan. Full peer-qualified keys are identities; pnpm remains the installer. */
export function runtimeDependencyPlan(raw) {
  const { lock, manifests, host } = validatedInput(raw);
  const importers = new Set(['.']), queue = [], selected = new Map(), skipped = new Set();
  let traversedEdges = 0;
  function enqueue(name, version, required) {
    if (++traversedEdges > 32768) fail('BACKEND_LOCK_BUDGET');
    queue.push({ key: snapshotKey(name, version), required });
  }
  function visitWorkspace(path, expectedName) {
    workspacePath(path);
    if (!has(lock.importers, path) || !has(manifests, path) || manifests[path].name !== expectedName) fail('BACKEND_WORKSPACE_MISMATCH');
    if (importers.has(path)) return;
    if (importers.size >= 64) fail('BACKEND_LOCK_BUDGET');
    importers.add(path);
    const importer = record(lock.importers[path]), manifest = record(manifests[path]);
    for (const kind of ['dependencies', 'optionalDependencies']) {
      for (const [name, value] of Object.entries(validateDependencies(importer, manifest, kind))) {
        if (value.version.startsWith('link:')) {
          if (value.specifier !== 'workspace:*') fail('BACKEND_WORKSPACE_MISMATCH');
          const suffix = value.version.slice(5);
          if (!suffix || suffix.startsWith('/') || /[\\\x00-\x1f]/.test(suffix)) fail('BACKEND_WORKSPACE_PATH');
          visitWorkspace(workspacePath(posix.join(path, suffix)), name);
        } else enqueue(name, value.version, kind === 'dependencies');
      }
    }
  }
  const sourceManifest = record(manifests['.']), sourceRoot = record(lock.importers['.']);
  // Root is a build-tool importer, not permission to install every development tool.
  if (sourceManifest.name !== 'flow' || Object.keys(map(sourceManifest.dependencies)).length || Object.keys(map(sourceManifest.optionalDependencies)).length || Object.keys(map(sourceRoot.dependencies)).length || Object.keys(map(sourceRoot.optionalDependencies)).length) fail('BACKEND_ROOT_RUNTIME_AMBIGUOUS');
  const tsx = map(sourceRoot.devDependencies).tsx;
  if (!tsx || record(tsx).specifier !== map(sourceManifest.devDependencies).tsx) fail('BACKEND_MANIFEST_LOCK_MISMATCH');
  enqueue('tsx', tsx.version, true);
  for (const root of roots) visitWorkspace(root, `@flow/${posix.basename(root)}`);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { key, required } = queue[cursor];
    if (selected.has(key) && (selected.get(key) || !required)) continue;
    const identity = packageIdentity(lock, key), { metadata } = identity;
    const compatible = platformAllows(metadata.os, host.os) && platformAllows(metadata.cpu, host.cpu) && platformAllows(metadata.libc, host.libc);
    if (!compatible) { if (required) fail('BACKEND_REQUIRED_PLATFORM_MISMATCH'); skipped.add(key); continue; }
    selected.set(key, required); skipped.delete(key);
    if (selected.size > maximumEntries) fail('BACKEND_LOCK_BUDGET');
    const snapshot = record(lock.snapshots[key]);
    if (Object.keys(snapshot).some(key => !['dependencies', 'optionalDependencies', 'transitivePeerDependencies', 'optional'].includes(key))) fail('BACKEND_SNAPSHOT_UNSUPPORTED');
    for (const [name, version] of Object.entries(map(snapshot.dependencies))) enqueue(name, version, required);
    for (const [name, version] of Object.entries(map(snapshot.optionalDependencies))) enqueue(name, version, false);
  }
  const installationLock = structuredClone(lock), installationManifest = structuredClone(sourceManifest);
  delete installationLock.importers['.'].devDependencies.tsx;
  installationLock.importers['.'].dependencies = { tsx: structuredClone(tsx) };
  delete installationManifest.devDependencies.tsx;
  installationManifest.dependencies = { tsx: sourceManifest.devDependencies.tsx };
  const snapshots = [...selected.keys()].sort();
  const packages = [...new Map(snapshots.map(key => { const value = packageIdentity(lock, key); return [value.base, { key: value.base, integrity: value.integrity, cacheIndex: value.cacheIndex }]; })).values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  return {
    policy: RUNTIME_CLOSURE_POLICY, pnpmVersion: '9.15.4', host: { ...host }, importers: [...importers].sort(), snapshots, packages,
    skippedOptionalSnapshots: [...skipped].sort(), sourceSemanticDigest: semanticDigest({ lock, manifest: sourceManifest }),
    installationSemanticDigest: semanticDigest({ lock: installationLock, manifest: installationManifest }),
    installationManifest, installationLock,
    installArguments: ['install', '--filter-prod=@flow/server...', '--filter-prod=@flow/runner...', '--filter=flow', '--prod', '--config.optional=true', '--offline', '--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--package-import-method=copy', '--config.manage-package-manager-versions=false'],
  };
}
