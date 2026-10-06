import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
// The public catalog carries model identifiers, never arbitrary paths, prompts or settings text.
const modelValue = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/);
export const executionProfileReferenceSchema = z.strictObject({ id: z.uuid(), runnerId: z.uuid(), configDigest: digest });
export type ExecutionProfileReference = z.infer<typeof executionProfileReferenceSchema>;
/** A configured request and gate policy, not a provider availability or effective-settings attestation. */
export const executionProfileConfigurationSchema = z.strictObject({
  harness: z.literal('claude'),
  adapterVersion: z.literal('claude-sdk-0.3.290-v2'),
  model: modelValue,
  thinking: z.literal('disabled'),
  permissionMode: z.literal('dontAsk'),
  access: z.enum(['none', 'configured-readonly', 'goal-tools']),
  requireReadApproval: z.boolean(),
  materialScopeDigest: digest,
  limits: z.strictObject({ maxTurns: z.number().int().min(1).max(4), maxBudgetUsd: z.number().positive().max(1), timeoutMs: z.number().int().min(1).max(90_000) }),
}).superRefine((profile, context) => {
  if (profile.access === 'goal-tools' && (profile.requireReadApproval || profile.materialScopeDigest !== '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')) {
    context.addIssue({ code: 'custom', message: 'Goal tools require an empty material scope and no read approval policy.' });
  }
});
export type ExecutionProfileConfiguration = z.infer<typeof executionProfileConfigurationSchema>;
export const executionProfilePublicationSchema = z.strictObject({ configuration: executionProfileConfigurationSchema });
export type ExecutionProfilePublication = z.infer<typeof executionProfilePublicationSchema>;
/** Stable JSON field order shared by the center and runner; hashing remains outside browser contracts. */
export function executionProfileConfigurationJson(value: ExecutionProfileConfiguration): string {
  return JSON.stringify(executionProfileConfigurationSchema.parse(value));
}
export interface ExecutionProfile {
  reference: ExecutionProfileReference;
  configuration: ExecutionProfileConfiguration;
  source: 'runner-configured';
  availability: 'not-probed';
  model: { value: string; resolvedModel: null; displayName: string; description: string; providerCapabilities: 'unknown' };
  controls: { model: 'select-configured-profile'; thinking: 'fixed-disabled'; effort: 'unsupported'; access: 'configured-policy'; queue: false; steer: false };
  createdAt: string;
}
export interface ExecutionProfilePublished { profile: ExecutionProfile; replayed: boolean }
export interface ExecutionProfilePage { profiles: ExecutionProfile[]; nextCursor: string | null }
