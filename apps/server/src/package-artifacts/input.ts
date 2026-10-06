import npa from 'npm-package-arg';
import { isAbsolute } from 'node:path';
import { packageArtifactRequestSchema, type PackageArtifactRequest } from '../../../../packages/contracts/src/package-artifacts.js';
import { PackageArtifactError } from './errors.js';

export interface PackageArtifactOptions {
  root: string;
  /** Optional immutable publication identity, preallocated by the trusted host. */
  artifactId?: string;
  registry: string;
  allowInsecureLoopback?: boolean;
  /** May only reduce the production ceilings, including in tests. */
  timeoutMs?: number;
  maxBytes?: number;
  metadataBytes?: number;
}
export interface ArtifactLimits { timeoutMs: number; maxBytes: number; metadataBytes: number }

export function parseRequest(input: unknown): PackageArtifactRequest {
  const result = packageArtifactRequestSchema.safeParse(input);
  if (!result.success) throw new PackageArtifactError('INVALID_REQUEST');
  const value = result.data;
  try {
    const spec = npa.resolve(value.name, value.version);
    if (!spec.registry || spec.type !== 'version' || spec.name !== value.name
      || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.version)
      || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value.name)
      || Buffer.from(value.integrity.slice(7), 'base64').toString('base64') !== value.integrity.slice(7)) {
      throw new Error('invalid');
    }
  } catch { throw new PackageArtifactError('INVALID_REQUEST'); }
  return value;
}

export function configuredRegistry(options: PackageArtifactOptions): { registry: URL; limits: ArtifactLimits } {
  const bounded = (value: number | undefined, max: number) => {
    const actual = value ?? max;
    if (!Number.isSafeInteger(actual) || actual < 1 || actual > max) throw new PackageArtifactError('INVALID_CONFIGURATION');
    return actual;
  };
  let registry: URL;
  try { registry = new URL(options.registry); } catch { throw new PackageArtifactError('INVALID_CONFIGURATION'); }
  const local = options.allowInsecureLoopback && registry.protocol === 'http:'
    && ['127.0.0.1', '[::1]'].includes(registry.hostname);
  if ((options.artifactId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(options.artifactId))
    || registry.href.length > 1024 || !isAbsolute(options.root) || (registry.protocol !== 'https:' && !local)
    || registry.username || registry.password || registry.search || registry.hash) {
    throw new PackageArtifactError('INVALID_CONFIGURATION');
  }
  if (!registry.pathname.endsWith('/')) registry.pathname += '/';
  return { registry, limits: { timeoutMs: bounded(options.timeoutMs, 15_000),
    maxBytes: bounded(options.maxBytes, 8 * 1024 * 1024), metadataBytes: bounded(options.metadataBytes, 1024 * 1024) } };
}

export function allowedTarball(value: unknown, registry: URL): URL {
  try {
    if (typeof value !== 'string') throw new Error('invalid');
    const url = new URL(value);
    if (url.href.length > 1024 || url.origin !== registry.origin || url.username || url.password || url.search || url.hash) throw new Error('invalid');
    return url;
  } catch { throw new PackageArtifactError('SOURCE_REJECTED'); }
}
