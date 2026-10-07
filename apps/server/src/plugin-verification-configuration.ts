import { z } from 'zod';
import { readPrivateJsonConfiguration } from './private-json-configuration.js';
import { HttpError } from './database.js';

const identity = z.strictObject({ artifactSha256: z.string().regex(/^[a-f0-9]{64}$/), treeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  hostApiMajor: z.literal(1), algorithmId: z.literal('flow.json-object.required-keys'), algorithmVersion: z.literal(1) });
export type TrustedVerifierIdentity = z.infer<typeof identity>;
export type TrustedPluginVerifierPolicy = (material: Readonly<TrustedVerifierIdentity>) => boolean;
const key = (value: TrustedVerifierIdentity) => JSON.stringify([value.artifactSha256, value.treeDigest, value.hostApiMajor, value.algorithmId, value.algorithmVersion]);
export function verifierPolicy(input: unknown): TrustedPluginVerifierPolicy {
  const parsed = z.strictObject({ materials: z.array(identity).min(1).max(128) }).parse(input);
  const allowed = new Set(parsed.materials.map(key));
  if (allowed.size !== parsed.materials.length) throw new Error('Duplicate trusted verifier material.');
  return value => { const checked = identity.safeParse(value); return checked.success && allowed.has(key(checked.data)); };
}
export function assertTrustedVerifier(policy: TrustedPluginVerifierPolicy | undefined, material: TrustedVerifierIdentity): void {
  if (policy?.(Object.freeze({ ...material })) !== true) throw new HttpError(403, 'plugin_verifier_untrusted', 'This exact verifier material and algorithm are not authorized by the operator.');
}
export async function readPluginVerificationConfiguration(filename: string | undefined): Promise<TrustedPluginVerifierPolicy | undefined> {
  if (filename === undefined) return undefined;
  try { return verifierPolicy(await readPrivateJsonConfiguration(filename)); }
  catch { throw new Error('Plugin verification configuration requires an owned 0600 regular JSON file with exact trusted materials.'); }
}
