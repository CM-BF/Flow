import { z } from 'zod';
import { isPersistablePluginText } from './plugin-runtime.js';

export const JSON_OBJECT_ALGORITHM = { id: 'flow.json-object.required-keys', version: 1 } as const;
export const PLUGIN_VERIFICATION_LIMITS = { sourceBytes: 8192, inputBytes: 16384, inputCodeUnits: 16000, keys: 32, keyBytes: 64 } as const;
const bytes = (text: string) => new TextEncoder().encode(text).length;
const key = z.string().min(1).max(64).refine(value => value.length <= 64 && isPersistablePluginText(value) && bytes(value) <= 64);
const identity = z.string().min(1).max(128).refine(isPersistablePluginText);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
function compareCodepoints(left: string, right: string): number {
  const a = [...left]; const b = [...right];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const difference = a[i]!.codePointAt(0)! - b[i]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return a.length - b.length;
}
export const jsonObjectRuleSchema = z.strictObject({
  schemaVersion: z.literal(1), algorithmId: z.literal(JSON_OBJECT_ALGORITHM.id), algorithmVersion: z.literal(1),
  requiredKeys: z.array(key).max(PLUGIN_VERIFICATION_LIMITS.keys)
    .refine(keys => new Set(keys).size === keys.length).transform(keys => [...keys].sort(compareCodepoints)),
});
export type JsonObjectRule = z.infer<typeof jsonObjectRuleSchema>;
export const pluginVerificationRequestSchema = z.strictObject({
  source: z.strictObject({ taskId: identity, attemptId: identity, artifactId: identity, version: digest,
    content: z.string().refine(value => value.length <= PLUGIN_VERIFICATION_LIMITS.sourceBytes && isPersistablePluginText(value) && bytes(value) <= PLUGIN_VERIFICATION_LIMITS.sourceBytes) }),
  rule: jsonObjectRuleSchema,
});
export type PluginVerificationRequest = z.infer<typeof pluginVerificationRequestSchema>;
export const jsonObjectVerdictSchema = z.strictObject({
  result: z.enum(['passed', 'failed']), reason: z.enum(['passed', 'invalid-json', 'not-object', 'missing-required-keys']),
  missingKeys: z.array(key).max(PLUGIN_VERIFICATION_LIMITS.keys).refine(keys => new Set(keys).size === keys.length),
}).superRefine((value, context) => {
  const valid = value.reason === 'passed' ? value.result === 'passed' && value.missingKeys.length === 0
    : value.result === 'failed' && (value.reason === 'missing-required-keys' ? value.missingKeys.length > 0 : value.missingKeys.length === 0);
  if (!valid) context.addIssue({ code: 'custom', message: 'Inconsistent verification verdict.' });
});
export type JsonObjectVerdict = z.infer<typeof jsonObjectVerdictSchema>;
/** Local package result only. This is not yet a RunnerEvent or a center-approved result. */
export const pluginVerificationOutputSchema = z.strictObject({
  schemaVersion: z.literal(1), algorithmId: z.literal(JSON_OBJECT_ALGORITHM.id), algorithmVersion: z.literal(1),
  inputDigest: digest, verdict: jsonObjectVerdictSchema,
});
export type PluginVerificationOutput = z.infer<typeof pluginVerificationOutputSchema>;
