import { isAbsolute } from 'node:path';
import type { PackageFetchHost } from './plugin-package-fetches/index.js';
import { readPrivateJsonConfiguration } from './private-json-configuration.js';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

/** Trusted local policy only. The public command accepts a configured registry reference. */
export async function readPackageFetchConfiguration(filename: string | undefined): Promise<PackageFetchHost | undefined> {
  if (filename === undefined) return undefined;
  try {
    const parsed = await readPrivateJsonConfiguration(filename);
    if (!record(parsed) || !exactKeys(parsed, ['storeId', 'root', 'registries']) || typeof parsed.storeId !== 'string'
      || !/^[a-z][a-z0-9-]{0,63}$/.test(parsed.storeId) || typeof parsed.root !== 'string' || !isAbsolute(parsed.root)
      || !record(parsed.registries) || Object.keys(parsed.registries).length < 1 || Object.keys(parsed.registries).length > 16) throw new Error();
    const registries: PackageFetchHost['registries'] = Object.create(null);
    for (const [ref, value] of Object.entries(parsed.registries)) {
      if (!/^[a-z][a-z0-9-]{0,47}$/.test(ref) || !record(value) || !exactKeys(value, ['url', 'allowInsecureLoopback'])
        || typeof value.url !== 'string' || value.url.length > 2048
        || (value.allowInsecureLoopback !== undefined && typeof value.allowInsecureLoopback !== 'boolean')) throw new Error();
      registries[ref] = { url: value.url, ...(typeof value.allowInsecureLoopback === 'boolean' ? { allowInsecureLoopback: value.allowInsecureLoopback } : {}) };
    }
    // The existing X04 policy validates URLs, origin and canonical store during worker startup.
    return { storeId: parsed.storeId, root: parsed.root, registries };
  } catch { throw new Error('Package fetch configuration is invalid or unavailable. Use an owned 0600 regular JSON file.'); }
}
