import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import pacote from 'pacote';
import type { PackageArtifactRequest } from '../../../../packages/contracts/src/package-artifacts.js';
import { PackageArtifactError } from './errors.js';
import { allowedTarball } from './input.js';

export interface SourceStream extends AsyncIterable<Uint8Array> {
  destroy(error?: Error): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}
export interface SourceContext { registry: URL; cache: string; signal: AbortSignal; metadataBytes: number }
export interface PackageSource {
  resolve(input: PackageArtifactRequest, context: SourceContext): Promise<string>;
  stream<T>(url: string, input: PackageArtifactRequest, context: SourceContext,
    consume: (stream: SourceStream) => Promise<T>): Promise<T>;
}

async function boundedPackument(url: URL, context: SourceContext): Promise<unknown> {
  const response = await fetch(url, { redirect: 'error', signal: context.signal,
    headers: { accept: 'application/vnd.npm.install-v1+json' } });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new PackageArtifactError('FETCH_FAILED');
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > context.metadataBytes) throw new PackageArtifactError('TOO_LARGE');
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

function baseOptions(context: SourceContext) {
  return { registry: context.registry.href, cache: context.cache, signal: context.signal,
    ignoreScripts: true, fetchRetries: 0, preferOnline: true, replaceRegistryHost: 'never',
    allowGit: 'none', allowFile: 'none', allowDirectory: 'none', npmCliConfig: [],
    // No npmrc/config/env object is read or passed. Each operation owns this cache.
    strictSSL: true, headers: { 'cache-control': 'no-store' } };
}

export const registrySource: PackageSource = {
  async resolve(input, context) {
    const escapedName = input.name.replace('/', '%2f');
    const url = new URL(escapedName, context.registry);
    const packument = await boundedPackument(url, context) as pacote.Packument;
    // npm-registry-fetch does not forward size/redirect. Bound bytes before
    // pacote sees metadata, while retaining pacote's exact manifest selection.
    const packumentCache = new Map([[`corgi:${url.href}`, packument], [`full:${url.href}`, packument]]);
    const manifest = await pacote.manifest(`${input.name}@${input.version}`, {
      ...baseOptions(context), packumentCache,
    });
    if (manifest.name !== input.name || manifest.version !== input.version) throw new PackageArtifactError('SOURCE_REJECTED');
    return allowedTarball(manifest._resolved, context.registry).href;
  },
  async stream(url, input, context, consume) {
    const target = allowedTarball(url, context.registry);
    const agent = target.protocol === 'https:' ? new HttpsAgent({ keepAlive: false }) : new HttpAgent({ keepAlive: false });
    // This function is called by the pinned minipass-fetch before EVERY network
    // request, including redirects. No proxy/env credentials or other URL pass.
    const selectAgent = (requested: URL) => {
      if (requested.href !== target.href) throw new PackageArtifactError('SOURCE_REJECTED');
      return agent;
    };
    try {
      return await pacote.tarball.stream(url, stream => consume(stream as unknown as SourceStream), {
        ...baseOptions(context), integrity: input.integrity,
        // @types/pacote models only Agent; pinned runtime also supports the
        // per-URL selector, exercised against real redirects in source tests.
        agent: selectAgent as unknown as NonNullable<pacote.Options['agent']>,
      });
    } finally { agent.destroy(); }
  },
};
