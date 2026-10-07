import { z } from 'zod';
import { claimedTaskSchema, runnerClaimReceiptSchema } from './runner-claim.js';
import { pluginVerifierBindingSchema } from './plugin-verification-binding.js';
import { idSchema } from './tasks.js';
import { pluginToolBindingSchema, pluginHostPublicationSchema } from './plugin-runtime.js';
import { pluginToolExecutionSchema } from './plugin-runner-claim.js';
import { pluginVerificationRequestSchema, JSON_OBJECT_ALGORITHM } from './plugin-verification.js';

/** Current-process capability, never inferred from a persisted host publication. */
export const VERIFIER_RUNNER_CLAIM_PROTOCOL = 'flow.runner-claim.v4' as const;
export const VERIFIER_BINDING_PROTOCOL = 'flow.plugin-verification.v1' as const;
const algorithmSchema = z.strictObject({ id: z.literal(JSON_OBJECT_ALGORITHM.id), version: z.literal(1) });
export const pluginVerifierExecutionSchema = z.strictObject({
  bindingProtocol: z.literal(VERIFIER_BINDING_PROTOCOL),
  storeId: pluginHostPublicationSchema.shape.storeId,
  hostApiMajor: z.literal(1),
  algorithms: z.array(algorithmSchema).min(1).max(8)
    .refine(values => new Set(values.map(value => `${value.id}:${value.version}`)).size === values.length),
});
export type PluginVerifierExecution = z.infer<typeof pluginVerifierExecutionSchema>;
/** No implicit tool opt-in. Omission must remain omission in the durable request. */
export const verifierRunnerClaimRequestSchema = z.strictObject({
  protocol: z.literal(VERIFIER_RUNNER_CLAIM_PROTOCOL), runnerId: idSchema, requestId: z.uuid(),
  pluginVerifierExecution: pluginVerifierExecutionSchema,
  pluginToolExecution: pluginToolExecutionSchema.optional(),
});
export type VerifierRunnerClaimRequest = z.infer<typeof verifierRunnerClaimRequestSchema>;
/** Fixed schema order and detached values make the complete request its replay identity. */
export function sameVerifierClaimRequest(left: VerifierRunnerClaimRequest, right: VerifierRunnerClaimRequest): boolean {
  return JSON.stringify(verifierRunnerClaimRequestSchema.parse(left)) === JSON.stringify(verifierRunnerClaimRequestSchema.parse(right));
}

/** The same compact identity must describe the assignment and its exact installed capability. */
const assignmentSchema = claimedTaskSchema.extend({ pluginToolBinding: pluginToolBindingSchema.optional(),
  pluginVerifierBinding: pluginVerifierBindingSchema.optional() });
export const verifierRunnerClaimResponseSchema = z.discriminatedUnion('state', [
  verifierRunnerClaimRequestSchema.extend({ state: z.literal('empty') }),
  verifierRunnerClaimRequestSchema.extend({ state: z.literal('missing') }),
  verifierRunnerClaimRequestSchema.extend({ state: z.literal('unavailable'), identity: runnerClaimReceiptSchema, reason: z.literal('not-executable') }),
  verifierRunnerClaimRequestSchema.extend({ state: z.literal('assigned'), identity: runnerClaimReceiptSchema,
    assignment: assignmentSchema, remainingLeaseMs: z.number().int().min(1).max(300000) }),
]).superRefine((response, context) => {
  const reject = () => context.addIssue({ code: 'custom', message: 'Verifier claim identity or qualification does not match.' });
  if (response.state !== 'assigned' && response.state !== 'unavailable') return;
  if (response.identity.runnerId !== response.runnerId) reject();
  if (response.state !== 'assigned') return;
  const { assignment: a, identity: i } = response;
  if (a.task.id !== i.taskId || a.attempt.id !== i.attemptId || a.attempt.runnerId !== i.runnerId || a.attempt.ownerVersion !== i.ownerVersion) reject();
  if (a.pluginToolBinding && a.pluginVerifierBinding) reject();
  const binding = a.pluginVerifierBinding ?? a.pluginToolBinding;
  if (!binding) return;
  const host = a.pluginVerifierBinding ? response.pluginVerifierExecution : response.pluginToolExecution;
  if (!host || binding.taskId !== a.task.id || binding.targetRunnerId !== response.runnerId || binding.storeId !== host.storeId
    || binding.hostApiMajor !== host.hostApiMajor || a.task.harness !== 'fixture' || a.task.fixture || a.task.protocol || a.task.executionProfile
    || a.task.engineering || a.task.resumeSessionId || a.task.messageSettings || a.conversationContext || a.goalToolRun || a.goalGraphRun) reject();
  if (a.pluginVerifierBinding) {
    const rule = a.pluginVerifierBinding.verification.rule;
    if (!response.pluginVerifierExecution.algorithms.some(value => value.id === rule.algorithmId && value.version === rule.algorithmVersion)) reject();
    const input = pluginVerificationRequestSchema.safeParse(parseJson(a.task.prompt));
    if (!input.success || JSON.stringify(input.data.source) !== JSON.stringify({ ...a.pluginVerifierBinding.verification.source, content: input.data.source.content })
      || JSON.stringify(input.data.rule) !== JSON.stringify(rule)) reject();
  }
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 131072, 'Claim response exceeds its canonical JSON byte limit.');
function parseJson(text: string): unknown { try { return JSON.parse(text); } catch { return null; } }
export type VerifierRunnerClaimResponse = z.infer<typeof verifierRunnerClaimResponseSchema>;
export function decodeVerifierRunnerClaimResponse(value: unknown, expected: VerifierRunnerClaimRequest, operation: 'claim' | 'status'): VerifierRunnerClaimResponse {
  const request = verifierRunnerClaimRequestSchema.parse(expected);
  const response = verifierRunnerClaimResponseSchema.parse(value);
  const echo = verifierRunnerClaimRequestSchema.parse({ protocol: response.protocol, runnerId: response.runnerId, requestId: response.requestId,
    pluginVerifierExecution: response.pluginVerifierExecution, ...(response.pluginToolExecution ? { pluginToolExecution: response.pluginToolExecution } : {}) });
  if (!sameVerifierClaimRequest(echo, request) || (operation === 'claim' ? response.state === 'missing' : response.state === 'empty')) {
    throw new Error('Verifier claim acknowledgement is unknown.');
  }
  return response;
}
