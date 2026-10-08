import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import type { PluginInstallHost } from './plugin-installations/commands.js';
import { readPrivateJsonConfiguration } from './private-json-configuration.js';

const root = z.string().min(1).max(4096).refine(path => isAbsolute(path) && resolve(path) === path);
const policy = z.strictObject({
  artifactStore: z.strictObject({ root, storeId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/) }),
  materialStore: z.strictObject({ root, storeId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    allowedDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(512),
  }),
});

/** Static material policy only. No lifecycle proof or plugin execution authority comes from JSON. */
export async function readPluginInstallationConfiguration(filename: string | undefined): Promise<PluginInstallHost | undefined> {
  if (filename === undefined) return undefined;
  try { return policy.parse(await readPrivateJsonConfiguration(filename)); }
  catch { throw new Error('Plugin installation configuration is invalid or unavailable. Use an owned 0600 regular JSON file.'); }
}
