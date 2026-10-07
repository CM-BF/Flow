import { readFile, lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { BACKEND_POLICY, verifyBackendArtifact } from './index.mjs';
import { fail } from './files.mjs';
async function optionalPrivateJson(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.size > 65536) fail('BACKEND_PRIVATE_STATE_INVALID');
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function backendById(directory, artifactId) {
  if (!/^[a-f0-9]{64}$/.test(artifactId ?? '')) fail('BACKEND_DESCRIPTOR_INVALID');
  const path = join(directory, 'backend-artifacts', artifactId, 'manifest.json');
  const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink() || info.size > 32 * 1024 ** 2) fail('BACKEND_MANIFEST_INVALID');
  const { sourceHead } = JSON.parse(await readFile(path, 'utf8'));
  const artifact = { policy: BACKEND_POLICY, artifactId, manifestDigest: artifactId, sourceHead };
  await verifyBackendArtifact({ directory, artifact }); return artifact;
}
export async function backendRuntime(config, artifact) {
  if (!artifact) return { root: config.repository, entry: join(config.repository, 'tools/personal-preview/cli.mjs'), artifact: null };
  const verified = await verifyBackendArtifact({ directory: config.directory, artifact });
  if (verified.manifest.sourceRepository !== config.repository) fail('BACKEND_INSTALLATION_SOURCE_MISMATCH');
  const entry = join(verified.root, 'tools/personal-preview/cli.mjs');
  if (!verified.manifest.inventory.entries.some(value => value.path === 'tools/personal-preview/backend-release/host.mjs')) fail('BACKEND_HOST_VERSION_UNSUPPORTED');
  return { root: verified.root, entry, artifact };
}
/** Web selection is separate from the artifact selected for center/runner/maintenance. */
export function webHostArtifactDescriptor(value) {
  if (!value || Object.keys(value).sort().join() !== 'artifactId,manifestDigest,policy,sourceHead'
    || value.policy !== BACKEND_POLICY || !/^[a-f0-9]{64}$/.test(value.artifactId ?? '')
    || value.manifestDigest !== value.artifactId || !/^[a-f0-9]{40}$/.test(value.sourceHead ?? '')) fail('BACKEND_DESCRIPTOR_INVALID');
  return { policy: value.policy, artifactId: value.artifactId, manifestDigest: value.manifestDigest, sourceHead: value.sourceHead };
}
export async function serviceRuntime(config, state, role, resolveRuntime = backendRuntime) {
  if (!['center', 'runner', 'web'].includes(role)) fail('UNKNOWN_SERVICE');
  const web = role === 'web' ? state.pendingWebHost ?? state.webHost : null;
  const artifact = web?.artifact == null ? state.backendArtifact : webHostArtifactDescriptor(web.artifact);
  return resolveRuntime(config, artifact);
}
/** An artifact wrapper must prove its own root against the installation's selected descriptor. */
export async function assertInstallationSource(config, moduleRepository, serviceRole = null, resolveRuntime = backendRuntime) {
  const moduleRoot = await realpath(moduleRepository);
  if (serviceRole === 'web') {
    const state = await optionalPrivateJson(join(config.directory, 'state.json'));
    const selected = state?.pendingWebHost ?? state?.webHost;
    if (selected?.artifact != null) {
      const runtime = await resolveRuntime(config, webHostArtifactDescriptor(selected.artifact));
      if (runtime.root !== moduleRoot) fail('CONFIGURATION_IDENTITY_MISMATCH');
      return;
    }
  }
  if (config.repository === moduleRoot) return;
  const state = await optionalPrivateJson(join(config.directory, 'state.json'));
  const operation = await optionalPrivateJson(join(config.directory, 'maintenance.json'));
  for (const artifact of [state?.backendArtifact, operation?.backendArtifact].filter(Boolean)) {
    const runtime = await resolveRuntime(config, artifact);
    if (runtime.root === moduleRoot) return;
  }
  fail('CONFIGURATION_IDENTITY_MISMATCH');
}
export async function maintenanceRuntime(config) {
  const operation = await optionalPrivateJson(join(config.directory, 'maintenance.json'));
  const state = await optionalPrivateJson(join(config.directory, 'state.json'));
  return backendRuntime(config, operation?.backendArtifact ?? state?.backendArtifact);
}
