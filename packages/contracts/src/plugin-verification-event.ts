import { z } from 'zod';
import { idSchema } from './tasks.js';
import { pluginArtifactSourceSchema } from './plugin-artifact.js';
import { jsonObjectVerdictSchema } from './plugin-verification.js';

export const pluginVerificationEventDataSchema = z.strictObject({
  type: z.literal('verification'), verifierId: z.literal('flow.plugin-json-object'), verifierVersion: z.literal('1'),
  artifactId: idSchema, artifactVersion: z.string().regex(/^[a-f0-9]{64}$/),
  inputDigest: z.string().regex(/^[a-f0-9]{64}$/), result: z.enum(['passed', 'failed']),
  verdict: jsonObjectVerdictSchema, pluginSource: pluginArtifactSourceSchema,
});
/** Trusted runtime declaration after its existing resource/unknown gate, not an OS isolation proof. */
export const pluginCompletionSchema = z.strictObject({ state: z.literal('settled') });
export type PluginVerificationEventData = z.infer<typeof pluginVerificationEventDataSchema>;
