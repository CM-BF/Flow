import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { remoteUrl, type RemoteOptions } from '@flow/protocols';

export type ProtocolEndpoints = Record<string, RemoteOptions>;
export class ProtocolConfigurationError extends Error {}

export function configuredEndpoint(endpoints: ProtocolEndpoints, reference: string): RemoteOptions {
  if (!Object.hasOwn(endpoints, reference)) throw new ProtocolConfigurationError('The configured remote endpoint is unavailable.');
  const endpoint = endpoints[reference]!;
  try { return { ...endpoint, url: remoteUrl(endpoint).href }; }
  catch { throw new ProtocolConfigurationError('The configured remote endpoint URL is invalid.'); }
}

export async function loadProtocolEndpoints(file: string): Promise<ProtocolEndpoints> {
  if (!isAbsolute(file) || (await stat(file)).size > 32_768) throw new Error('Protocol endpoint manifest must be a small explicit absolute file.');
  const content = await readFile(file, 'utf8');
  if (Buffer.byteLength(content) > 32_768) throw new Error('Protocol endpoint manifest exceeds its size limit.');
  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 16) throw new Error('Invalid protocol endpoint manifest.');
  const endpoints: ProtocolEndpoints = Object.create(null);
  for (const [ref, candidate] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(ref) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Invalid protocol endpoint entry.');
    const config = candidate as Record<string, unknown>;
    if (Object.keys(config).some(key => !['url', 'token', 'allowLoopbackHttp', 'timeoutMs', 'maxResponseBytes'].includes(key)) || typeof config.url !== 'string') throw new Error('Invalid protocol endpoint configuration.');
    if (config.token !== undefined && (typeof config.token !== 'string' || !config.token.length || config.token.length > 8192)) throw new Error('Invalid protocol endpoint credential.');
    if (config.allowLoopbackHttp !== undefined && typeof config.allowLoopbackHttp !== 'boolean') throw new Error('Invalid protocol endpoint transport policy.');
    for (const key of ['timeoutMs', 'maxResponseBytes']) if (config[key] !== undefined && (!Number.isSafeInteger(config[key]) || Number(config[key]) < 1)) throw new Error('Invalid protocol endpoint budget.');
    endpoints[ref] = configuredEndpoint({ [ref]: config as unknown as RemoteOptions }, ref);
  }
  return endpoints;
}
