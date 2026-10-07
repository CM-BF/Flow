import { z } from 'zod';
import { idSchema, taskSubmissionSchema } from './tasks.js';
import { goalToolRunReferenceSchema } from './goal-tool-runs.js';
import { goalGraphRunReferenceSchema } from './goal-graph-runs.js';

/** A key identifies an opportunity until its first assignment, never a cached empty result. */
export const RUNNER_CLAIM_PROTOCOL = 'flow.runner-claim.v2' as const;
export const runnerIdentitySchema = z.strictObject({ protocol: z.literal(RUNNER_CLAIM_PROTOCOL), runnerId: idSchema });
export type RunnerIdentity = z.infer<typeof runnerIdentitySchema>;
export const runnerClaimRequestSchema = runnerIdentitySchema.extend({ requestId: z.string().uuid() });
export type RunnerClaimRequest = z.infer<typeof runnerClaimRequestSchema>;
export const runnerClaimReceiptSchema = z.strictObject({ taskId: idSchema, attemptId: idSchema, runnerId: idSchema, ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export type RunnerClaimReceipt = z.infer<typeof runnerClaimReceiptSchema>;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const claimedTaskSchema = z.strictObject({
  attempt: z.strictObject({ id: idSchema, runnerId: idSchema, ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    leaseExpiresAt: z.iso.datetime(), nativeSessionId: idSchema.optional() }),
  // Both existing private-input builders enforce the same 16,000 code-unit limit.
  task: taskSubmissionSchema.safeExtend({ id: idSchema }),
  conversationContext: z.strictObject({ id: idSchema, contextDigest: digest, executionInputId: idSchema, executionInputDigest: digest }).optional(),
  goalToolRun: goalToolRunReferenceSchema.optional(),
  goalGraphRun: goalGraphRunReferenceSchema.optional(),
});

export const runnerClaimResponseSchema = z.discriminatedUnion('state', [
  runnerClaimRequestSchema.extend({ state: z.literal('empty') }),
  runnerClaimRequestSchema.extend({ state: z.literal('missing') }),
  runnerClaimRequestSchema.extend({ state: z.literal('unavailable'), identity: runnerClaimReceiptSchema, reason: z.literal('not-executable') }),
  runnerClaimRequestSchema.extend({ state: z.literal('assigned'), identity: runnerClaimReceiptSchema, assignment: claimedTaskSchema,
    /** Current center lease remainder; subtract transport time since this request began. Never a renewal. */
    remainingLeaseMs: z.number().int().min(1).max(300000) }),
]).superRefine((response, context) => {
  if (response.state === 'assigned' || response.state === 'unavailable') {
    if (response.identity.runnerId !== response.runnerId) context.addIssue({ code: 'custom', message: 'Receipt runner does not match the authenticated request.' });
  }
  if (response.state === 'assigned') {
    const { identity, assignment } = response;
    if (identity.taskId !== assignment.task.id || identity.attemptId !== assignment.attempt.id
      || identity.runnerId !== assignment.attempt.runnerId || identity.ownerVersion !== assignment.attempt.ownerVersion) {
      context.addIssue({ code: 'custom', message: 'Assignment does not match the compact allocation receipt.' });
    }
  }
}).refine(response => new TextEncoder().encode(JSON.stringify(response)).byteLength <= 131072, 'Claim response exceeds its canonical JSON byte limit.');
export type RunnerClaimResponse = z.infer<typeof runnerClaimResponseSchema>;

/** Parse failures are unknown acknowledgements, never evidence that allocation did not happen. */
export function decodeRunnerClaimResponse(value: unknown, expected: RunnerClaimRequest, operation: 'claim' | 'status'): RunnerClaimResponse {
  const response = runnerClaimResponseSchema.parse(value);
  if (response.runnerId !== expected.runnerId || response.requestId !== expected.requestId || response.protocol !== expected.protocol
    || (operation === 'claim' ? response.state === 'missing' : response.state === 'empty')) {
    throw new Error('Claim response identity or operation is unknown.');
  }
  return response;
}
