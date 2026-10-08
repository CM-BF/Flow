import { z } from 'zod';

export const CLAUDE_TURN_SETTINGS_PROTOCOL = 'flow.claude-turn-settings.v1';
export const CLAUDE_TURN_SETTINGS_MAX_BYTES = 1024;
export const CLAUDE_TURN_CHOICES_MAX_BYTES = 16_384;
export const CLAUDE_TURN_CHOICES_MAX_COUNT = 32;

// Kept local: execution-profiles/tasks may later consume this leaf without an import cycle.
const profileSchema = z.strictObject({
  id: z.uuid(), runnerId: z.uuid(), configDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const effortSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('level'), value: z.enum(['low', 'medium', 'high', 'xhigh', 'max']) }),
  // This means no effort request. It does not promise reset, SDK default, or safe resume inheritance.
  z.strictObject({ kind: z.literal('not-requested') }),
]);
const choiceSchema = z.strictObject({
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/),
  thinking: z.enum(['disabled', 'adaptive']), effort: effortSchema, speed: z.enum(['standard', 'fast']),
});
function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Complete owner request; omission never silently selects a prior turn or a default. */
export const claudeTurnSettingsSchema = z.strictObject({
  protocol: z.literal(CLAUDE_TURN_SETTINGS_PROTOCOL), profile: profileSchema, requested: choiceSchema,
}).superRefine((value, context) => {
  if (jsonBytes(value) > CLAUDE_TURN_SETTINGS_MAX_BYTES) context.addIssue({ code: 'custom', message: 'Message settings exceed the canonical JSON byte limit.' });
});
export type ClaudeTurnSettings = z.infer<typeof claudeTurnSettingsSchema>;

/** A finite configured allowlist, not ModelInfo, account entitlement, or a provider probe. */
export const claudeTurnSettingsChoicesSchema = z.array(choiceSchema).max(CLAUDE_TURN_CHOICES_MAX_COUNT).superRefine((values, context) => {
  if (new Set(values.map(value => JSON.stringify(value))).size !== values.length) context.addIssue({ code: 'custom', message: 'Configured settings choices must be unique.' });
  if (jsonBytes(values) > CLAUDE_TURN_CHOICES_MAX_BYTES) context.addIssue({ code: 'custom', message: 'Configured settings choices exceed the canonical JSON byte limit.' });
});
export interface ClaudeTurnSettingsPolicy {
  profile: ClaudeTurnSettings['profile'];
  choices: z.infer<typeof claudeTurnSettingsChoicesSchema>;
}
export type ClaudeTurnSettingsDecision =
  | { decision: 'allowed' }
  | { decision: 'unknown'; reason: 'capability-evidence-unavailable' }
  | { decision: 'unsupported'; reason: 'combination-not-configured' }
  | { decision: 'profile-mismatch' };

/** Canonical parsed JSON bytes only; callers retain the existing command/body digest authority. */
export function claudeTurnSettingsJson(value: ClaudeTurnSettings): string {
  return JSON.stringify(claudeTurnSettingsSchema.parse(value));
}

/** Caller must authenticate policy provenance; pass null/undefined when it is absent or untrusted.
 * `allowed` authorizes this complete configured tuple, not provider support or SDK resume behavior.
 * A future bridge must separately reject not-requested on resume when inheritance is unproven.
 * Invalid requests/configurations throw ZodError; they are not downgraded into provider refusal.
 */
export function checkClaudeTurnSettingsAllowed(value: ClaudeTurnSettings, policy?: ClaudeTurnSettingsPolicy | null): ClaudeTurnSettingsDecision {
  const snapshot = claudeTurnSettingsSchema.parse(value);
  if (policy == null) return { decision: 'unknown', reason: 'capability-evidence-unavailable' };
  const profile = profileSchema.parse(policy.profile);
  if (snapshot.profile.id !== profile.id || snapshot.profile.runnerId !== profile.runnerId || snapshot.profile.configDigest !== profile.configDigest) {
    return { decision: 'profile-mismatch' };
  }
  const choices = claudeTurnSettingsChoicesSchema.parse(policy.choices);
  return choices.some(choice => JSON.stringify(choice) === JSON.stringify(snapshot.requested))
    ? { decision: 'allowed' } : { decision: 'unsupported', reason: 'combination-not-configured' };
}

export class ClaudeTurnSettingsMismatchError extends Error {
  constructor() {
    super('The acknowledgement did not confirm the exact frozen Claude message settings.');
    this.name = 'ClaudeTurnSettingsMismatchError';
  }
}

/** The client maps this failure to unknown admission and retains its original key/body. No IO. */
export function assertClaudeTurnSettingsMatch(expected: ClaudeTurnSettings, actual: unknown): ClaudeTurnSettings {
  const request = claudeTurnSettingsSchema.safeParse(expected);
  const receipt = claudeTurnSettingsSchema.safeParse(actual);
  if (!request.success || !receipt.success || JSON.stringify(request.data) !== JSON.stringify(receipt.data)) throw new ClaudeTurnSettingsMismatchError();
  return receipt.data;
}
