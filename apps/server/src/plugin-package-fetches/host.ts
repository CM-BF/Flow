import { realpath, mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configuredRegistry } from '../package-artifacts/input.js';
import { HttpError } from '../database.js';

export interface PackageFetchHost {
  storeId: string;
  root: string;
  registries: Record<string, { url: string; allowInsecureLoopback?: boolean }>;
}
export function registryFor(host: PackageFetchHost, ref: string) {
  if (!Object.hasOwn(host.registries, ref)) throw new HttpError(409, 'registry_unavailable', 'Registry is not configured on this host.');
  const entry = host.registries[ref]!;
  const { registry } = configuredRegistry({ root: host.root, registry: entry.url, allowInsecureLoopback: entry.allowInsecureLoopback });
  return { url: registry.href, allowInsecureLoopback: entry.allowInsecureLoopback };
}
export async function prepareHost(host: PackageFetchHost): Promise<void> {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(host.storeId)) throw new Error('Invalid package store identity.');
  for (const ref of Object.keys(host.registries)) registryFor(host, ref);
  await mkdir(host.root, { recursive: true, mode: 0o700 });
  if (await realpath(host.root) !== host.root) throw new Error('Package store must use its canonical absolute path.');
  const marker = join(host.root, '.flow-package-store.json');
  try {
    const file = await open(marker, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ storeId: host.storeId })); await file.sync(); } finally { await file.close(); }
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw new Error('Package store initialization failed.');
    if (JSON.parse(await readFile(marker, 'utf8')).storeId !== host.storeId) throw new Error('Package store identity does not match.');
  }
}
