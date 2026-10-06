import { lstat, readFile, realpath, open, rename, rm, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { verifyWebArtifact } from './web-artifact.mjs';
const MAX_ARTIFACTS = 3;
const MAX_RETAINED_BYTES = 192 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function descriptor(value) { return value && /^[a-f0-9]{64}$/.test(value.artifactId) && value.manifestDigest === value.artifactId && /^[a-f0-9]{40}$/.test(value.sourceHead); }
const requiredChecks = Object.freeze({
  read: ['ownerAuthenticated', 'conversationBound', 'taskBound'],
  send: ['acceptedTurnBound', 'requestedProfilePreserved'],
  recover: ['sameKey', 'sameBody', 'sameTurn'],
  negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'],
});
function exactKeys(value, keys) { return value && typeof value === 'object' && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()); }
function reportValid(report) {
  return exactKeys(report, ['format', 'policy', 'backendHead', 'artifact', 'checks']) && report.format === 1 && report.policy === 'flow-web-api-v1'
    && /^[a-f0-9]{40}$/.test(report.backendHead ?? '') && descriptor(report.artifact)
    && exactKeys(report.checks, Object.keys(requiredChecks)) && Object.values(report.checks).every(value => /^[a-f0-9]{64}$/.test(value));
}
async function boundedFile(path, limit = 4096) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.size > limit || await realpath(path) !== path) fail('WEB_COMPATIBILITY_INVALID');
  return readFile(path);
}
async function verifiedReport(path, id) {
  const bytes = await boundedFile(join(path, 'report.json'));
  if (id && sha(bytes) !== id) fail('WEB_COMPATIBILITY_INVALID');
  const report = JSON.parse(bytes);
  if (!reportValid(report)) fail('WEB_COMPATIBILITY_INVALID');
  for (const [name, observations] of Object.entries(requiredChecks)) {
    const raw = await boundedFile(join(path, `${name}.json`));
    if (sha(raw) !== report.checks[name]) fail('WEB_COMPATIBILITY_INVALID');
    const check = JSON.parse(raw);
    if (!exactKeys(check, ['format', 'check', 'backendHead', 'artifactId', 'observations']) || check.format !== 1 || check.check !== name
      || check.backendHead !== report.backendHead || check.artifactId !== report.artifact.artifactId
      || !exactKeys(check.observations, observations) || !Object.values(check.observations).every(value => value === true)) fail('WEB_COMPATIBILITY_INCOMPLETE');
  }
  return { report, bytes, id: sha(bytes) };
}
/** Imports bounded, hash-bound local test attestations, not a provider or semantic compatibility oracle. */
export async function importWebCompatibility({ directory, reportDirectory }) {
  const rootInfo = await lstat(directory);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || rootInfo.uid !== process.getuid() || rootInfo.mode & 0o077 || await realpath(directory) !== directory) fail('WEB_COMPATIBILITY_INVALID');
  const verified = await verifiedReport(await realpath(reportDirectory));
  const root = join(directory, 'web-compatibility'); await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== root || (await lstat(root)).mode & 0o077) fail('WEB_COMPATIBILITY_INVALID');
  const destination = join(root, verified.id);
  try { await verifiedReport(destination, verified.id); return verified.id; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if ((await readdir(root)).filter(name => /^[a-f0-9]{64}$/.test(name)).length >= 32) fail('WEB_COMPATIBILITY_BUDGET_EXCEEDED');
  const stage = join(root, `.stage-${randomUUID()}`); await mkdir(stage, { mode: 0o700 });
  try {
    for (const name of ['report', ...Object.keys(requiredChecks)]) {
      const file = await open(join(stage, `${name}.json`), 'wx', 0o600);
      try { await file.writeFile(await boundedFile(join(await realpath(reportDirectory), `${name}.json`))); await file.sync(); } finally { await file.close(); }
    }
    await verifiedReport(stage, verified.id);
    await rename(stage, destination); return verified.id;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
export async function verifyWebCompatibility({ directory, artifact, backendHead, compatibilityId }) {
  if (!/^[a-f0-9]{64}$/.test(compatibilityId ?? '')) fail('WEB_COMPATIBILITY_REQUIRED');
  let report;
  try { ({ report } = await verifiedReport(join(directory, 'web-compatibility', compatibilityId), compatibilityId)); }
  catch { fail('WEB_COMPATIBILITY_INVALID'); }
  if (report.backendHead !== backendHead || ['artifactId', 'sourceHead', 'manifestDigest'].some(key => report.artifact[key] !== artifact[key])) fail('WEB_COMPATIBILITY_COMBINATION_UNKNOWN');
  return report;
}
/** Backend refresh must have an explicit report for every retained Web artifact before stopping services. */
export async function findWebCompatibility({ directory, artifact, backendHead }) {
  for (const id of (await readdir(join(directory, 'web-compatibility'))).sort()) {
    if (!/^[a-f0-9]{64}$/.test(id)) continue;
    try { await verifyWebCompatibility({ directory, artifact, backendHead, compatibilityId: id }); return id; }
    catch (error) { if (error.code !== 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN') throw error; }
  }
  fail('WEB_COMPATIBILITY_COMBINATION_UNKNOWN');
}
function validateRelease(value) {
  if (!value || value.format !== 1 || value.policy !== 'flow-web-release-v1' || !Number.isSafeInteger(value.version) || value.version < 1
    || !Array.isArray(value.artifacts) || value.artifacts.length < 1 || value.artifacts.length > MAX_ARTIFACTS || !value.artifacts.every(descriptor)
    || new Set(value.artifacts.map(item => item.artifactId)).size !== value.artifacts.length
    || !value.artifacts.some(item => item.artifactId === value.current) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) fail('WEB_RELEASE_METADATA_INVALID');
  if (!/^[a-f0-9]{40}$/.test(value.backendHead ?? '') || !exactKeys(value.compatibilityIds, value.artifacts.map(item => item.artifactId))
    || !Object.values(value.compatibilityIds).every(id => /^[a-f0-9]{64}$/.test(id))) fail('WEB_RELEASE_METADATA_INVALID');
  return value;
}
/** Small authoritative pointer; malformed or insecure metadata never falls back to legacy state. */
export async function readWebRelease(directory) {
  const path = join(directory, 'web-release.json');
  try {
    const root = await lstat(directory); const info = await lstat(path);
    if (!root.isDirectory() || root.isSymbolicLink() || await realpath(directory) !== resolve(directory)
      || root.uid !== process.getuid() || (root.mode & 0o077) || !info.isFile() || info.isSymbolicLink()
      || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.size > 16_384) fail('WEB_RELEASE_METADATA_INVALID');
    return validateRelease(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) { if (error.code === 'ENOENT') return null; fail('WEB_RELEASE_METADATA_INVALID'); }
}
export function currentWebArtifact(release) { return release.artifacts.find(item => item.artifactId === release.current); }
function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.includes('\\') && !/[\x00-\x1f\x7f]/.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..');
}
/** Verifies the bounded retained set once per new pointer, including legacy URL collisions. */
export async function loadReleaseAssets({ directory, release }) {
  validateRelease(release);
  const assets = new Map(); const namespaces = new Set(); let totalBytes = 0; let index;
  for (const artifact of release.artifacts) {
    await verifyWebCompatibility({ directory, artifact, backendHead: release.backendHead, compatibilityId: release.compatibilityIds[artifact.artifactId] });
    const { dist, manifest } = await verifyWebArtifact({ directory, artifact });
    totalBytes += manifest.totalBytes;
    if (totalBytes > MAX_RETAINED_BYTES) fail('WEB_RETENTION_BUDGET_EXCEEDED');
    const namespace = manifest.format === 2 ? `/__flow_releases/${manifest.releaseId}/` : '/';
    if (namespace !== '/' && namespaces.has(namespace)) fail('WEB_RELEASE_NAMESPACE_CONFLICT');
    namespaces.add(namespace);
    for (const file of manifest.files) {
      if (!safePath(file.path) || file.path.startsWith('__flow_') || file.path === 'api' || file.path.startsWith('api/')) fail('WEB_ASSET_PATH_INVALID');
      const entry = { path: join(dist, file.path), bytes: file.bytes, sha256: file.sha256 };
      if (file.path === 'index.html' && artifact.artifactId === release.current) index = entry;
      if (namespace === '/' && file.path === 'index.html') continue;
      const key = namespace + file.path; const old = assets.get(key);
      if (old && (old.sha256 !== entry.sha256 || old.bytes !== entry.bytes)) fail('WEB_LEGACY_ASSET_CONFLICT');
      assets.set(key, entry);
    }
  }
  return { assets, index, artifact: currentWebArtifact(release), version: release.version, totalBytes };
}
/** Pure plan under the caller's existing operation.lock; caller commits it with atomic rename. */
export async function planWebRelease({ directory, artifact, expectedVersion, action, backendHead, compatibilityId }) {
  if (!/^[a-f0-9]{40}$/.test(backendHead ?? '')) fail('WEB_COMPATIBILITY_REQUIRED');
  if (!descriptor(artifact) || !['bootstrap', 'publish', 'rollback'].includes(action)) fail('WEB_RELEASE_INPUT_INVALID');
  const previous = await readWebRelease(directory);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== (previous?.version ?? 0)) fail('WEB_RELEASE_VERSION_CONFLICT');
  if ((action === 'bootstrap') !== !previous) fail('WEB_RELEASE_BOOTSTRAP_REQUIRED');
  const artifacts = [...(previous?.artifacts ?? [])];
  if (!artifacts.some(value => value.artifactId === artifact.artifactId)) {
    if (action === 'rollback') fail('WEB_ROLLBACK_NOT_RETAINED');
    artifacts.push(artifact);
  }
  if (artifacts.length > MAX_ARTIFACTS) fail('WEB_RETENTION_BUDGET_EXCEEDED');
  const compatibilityIds = {};
  for (const item of artifacts) {
    const id = item.artifactId === artifact.artifactId ? compatibilityId : previous?.backendHead === backendHead
      ? previous.compatibilityIds[item.artifactId] : await findWebCompatibility({ directory, artifact: item, backendHead });
    await verifyWebCompatibility({ directory, artifact: item, backendHead, compatibilityId: id });
    compatibilityIds[item.artifactId] = id;
  }
  const release = { format: 1, policy: 'flow-web-release-v1', version: expectedVersion + 1, backendHead,
    compatibilityIds, current: artifact.artifactId, artifacts, updatedAt: new Date().toISOString() };
  await loadReleaseAssets({ directory, release });
  return release;
}
/** Exact allowlisted bytes; encoded traversal and unknown assets never become SPA fallback. */
export async function releaseAsset(snapshot, rawPath, acceptsHtml = false) {
  let path;
  try { if (/%2f|%5c/i.test(rawPath)) return null; path = decodeURIComponent(rawPath); } catch { return null; }
  if (!path.startsWith('/') || path !== '/' && !safePath(path.slice(1))) return null;
  let file = path === '/' ? snapshot.index : snapshot.assets.get(path);
  if (!file && acceptsHtml && !path.startsWith('/__flow_') && !path.split('/').at(-1).includes('.')) file = snapshot.index;
  if (!file) return null;
  const info = await lstat(file.path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== file.bytes || await realpath(file.path) !== file.path) fail('WEB_ASSET_CHANGED');
  const bytes = await readFile(file.path);
  if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) fail('WEB_ASSET_CHANGED');
  return { bytes, path: file.path };
}

/** Commit only while holding the installation operation.lock. Failure may be after rename: read status before another command. */
export async function commitWebRelease(directory, release) {
  validateRelease(release);
  if (Buffer.byteLength(JSON.stringify(release)) > 16_384) fail('WEB_RELEASE_METADATA_INVALID');
  const temporary = join(directory, `.web-release-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(`${JSON.stringify(release)}\n`); await file.sync(); } finally { await file.close(); }
    await rename(temporary, join(directory, 'web-release.json'));
    const folder = await open(directory, 'r'); try { await folder.sync(); } finally { await folder.close(); }
  } finally { await rm(temporary, { force: true }); }
}
