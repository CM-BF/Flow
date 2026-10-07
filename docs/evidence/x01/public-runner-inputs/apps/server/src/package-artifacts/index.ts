import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { packageArtifactSchema, type PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import { parseRequest, configuredRegistry, allowedTarball, type PackageArtifactOptions } from './input.js';
import { PackageArtifactError, sanitizedFailure } from './errors.js';
import { registrySource, type PackageSource } from './source.js';
import { stageStream, publishArtifact } from './storage.js';

export { readPackageArtifact } from './storage.js';
export { PackageArtifactError } from './errors.js';
export type { PackageArtifactOptions } from './input.js';
export type { PackageSource, SourceStream, SourceContext } from './source.js';

export async function fetchPackageArtifact(options: PackageArtifactOptions, input: unknown,
  signal?: AbortSignal, source: PackageSource = registrySource): Promise<PackageArtifact> {
  const request = parseRequest(input);
  const { registry, limits } = configuredRegistry(options);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new PackageArtifactError('TIMEOUT')), limits.timeoutMs);
  const stopped = AbortSignal.any([timeout.signal, ...(signal ? [signal] : [])]);
  let working: string | undefined;
  try {
    stopped.throwIfAborted();
    await mkdir(join(options.root, 'staging'), { recursive: true, mode: 0o700 });
    working = await mkdtemp(join(options.root, 'staging', 'fetch-'));
    const context = { registry, cache: join(working, 'cache'), signal: stopped, metadataBytes: limits.metadataBytes };
    const url = allowedTarball(await source.resolve(request, context), registry);
    stopped.throwIfAborted();
    const staged = await source.stream(url.href, request, context,
      stream => stageStream(working!, stream, request.integrity, limits.maxBytes, stopped));
    stopped.throwIfAborted();
    const receipt = packageArtifactSchema.parse({ ...request, artifactId: options.artifactId ?? randomUUID(), format: 'npm-tarball',
      bytes: staged.bytes, sha256: staged.sha256, verifiedAt: new Date().toISOString(),
      source: { registry: registry.href, tarball: url.href } });
    try { await publishArtifact(options.root, staged, receipt, stopped); }
    catch { throw new PackageArtifactError('STORAGE_FAILED'); }
    return receipt;
  } catch (error) { throw sanitizedFailure(error, stopped); }
  finally {
    clearTimeout(timer);
    if (working) await rm(working, { recursive: true, force: true }).catch(() => { throw new PackageArtifactError('STORAGE_FAILED'); });
  }
}
