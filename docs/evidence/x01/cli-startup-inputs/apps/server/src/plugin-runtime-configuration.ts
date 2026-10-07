import { z } from 'zod';
import { readPrivateJsonConfiguration } from './private-json-configuration.js';
import type { TrustedPluginHostPolicy } from './plugin-runtime/store.js';

const host = z.strictObject({ runnerId: z.string().uuid(), storeId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), hostApiMajor: z.literal(1) });
const policy = z.strictObject({ hosts: z.array(host).min(1).max(128)
  .refine(hosts => new Set(hosts.map(identity => JSON.stringify(identity))).size === hosts.length, 'Duplicate host tuple') });
const key = (identity: z.infer<typeof host>) => JSON.stringify([identity.runnerId, identity.storeId, identity.hostApiMajor]);

/** Operator configuration authorizes exact authenticated identities, never a runner-supplied store alone. */
export async function readPluginRuntimeConfiguration(filename: string | undefined): Promise<TrustedPluginHostPolicy | undefined> {
  if (filename === undefined) return undefined;
  try {
    const parsed = policy.parse(await readPrivateJsonConfiguration(filename));
    const allowed = new Set(parsed.hosts.map(key));
    return identity => allowed.has(key(identity));
  } catch { throw new Error('Plugin runtime configuration is invalid or unavailable. Use an owned 0600 regular JSON file.'); }
}
