import { z } from 'zod';
import { claimedTaskSchema, runnerClaimReceiptSchema } from './runner-claim.js';
import { idSchema } from './tasks.js';
import { PLUGIN_RUNTIME_PROTOCOL, pluginHostPublicationSchema, pluginToolBindingSchema } from './plugin-runtime.js';

/** Explicit current-process opt-in. Durable host publication alone cannot produce this request. */
export const PLUGIN_RUNNER_CLAIM_PROTOCOL = 'flow.runner-claim.v3' as const;
export const pluginToolExecutionSchema = z.strictObject({
  bindingProtocol: z.literal(PLUGIN_RUNTIME_PROTOCOL),
  storeId: pluginHostPublicationSchema.shape.storeId,
  hostApiMajor: z.literal(1),
});
export type PluginToolExecution = z.infer<typeof pluginToolExecutionSchema>;
export const pluginRunnerClaimRequestSchema = z.strictObject({
  protocol: z.literal(PLUGIN_RUNNER_CLAIM_PROTOCOL), runnerId: idSchema, requestId: z.uuid(),
  pluginToolExecution: pluginToolExecutionSchema,
});
export type PluginRunnerClaimRequest = z.infer<typeof pluginRunnerClaimRequestSchema>;

const assignmentSchema = claimedTaskSchema.extend({ pluginToolBinding: pluginToolBindingSchema.optional() });
export const pluginRunnerClaimResponseSchema = z.discriminatedUnion('state', [
  pluginRunnerClaimRequestSchema.extend({ state: z.literal('empty') }),
  pluginRunnerClaimRequestSchema.extend({ state: z.literal('missing') }),
  pluginRunnerClaimRequestSchema.extend({ state: z.literal('unavailable'), identity: runnerClaimReceiptSchema, reason: z.literal('not-executable') }),
  pluginRunnerClaimRequestSchema.extend({ state: z.literal('assigned'), identity: runnerClaimReceiptSchema,
    assignment: assignmentSchema, remainingLeaseMs: z.number().int().min(1).max(300_000) }),
]).superRefine((response, context) => {
  const reject = () => context.addIssue({ code: 'custom', message: 'Plugin claim identity or execution qualification does not match.' });
  if (response.state !== 'assigned' && response.state !== 'unavailable') return;
  if (response.identity.runnerId !== response.runnerId) reject();
  if (response.state !== 'assigned') return;
  const { assignment, identity, pluginToolExecution: host } = response;
  if (identity.taskId !== assignment.task.id || identity.attemptId !== assignment.attempt.id
    || identity.runnerId !== assignment.attempt.runnerId || identity.ownerVersion !== assignment.attempt.ownerVersion) reject();
  const binding = assignment.pluginToolBinding;
  if (!binding) return; // Opted-in runners may also receive an ordinary existing task.
  const task = assignment.task;
  if (binding.taskId !== task.id || binding.targetRunnerId !== response.runnerId
    || binding.protocol !== host.bindingProtocol || binding.storeId !== host.storeId || binding.hostApiMajor !== host.hostApiMajor
    || task.harness !== 'fixture' || task.fixture || task.protocol || task.executionProfile || task.engineering
    || task.resumeSessionId || task.messageSettings || assignment.conversationContext || assignment.goalToolRun || assignment.goalGraphRun) reject();
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 131_072,
  'Claim response exceeds its canonical JSON byte limit.');
export type PluginRunnerClaimResponse = z.infer<typeof pluginRunnerClaimResponseSchema>;

/** A mismatch is an unknown ACK, not permission to replace the durable key or rerun an invocation. */
export function decodePluginRunnerClaimResponse(value: unknown, expected: PluginRunnerClaimRequest,
  operation: 'claim' | 'status'): PluginRunnerClaimResponse {
  const request = pluginRunnerClaimRequestSchema.parse(expected);
  const response = pluginRunnerClaimResponseSchema.parse(value);
  if (response.runnerId !== request.runnerId || response.requestId !== request.requestId
    || response.pluginToolExecution.bindingProtocol !== request.pluginToolExecution.bindingProtocol
    || response.pluginToolExecution.storeId !== request.pluginToolExecution.storeId
    || response.pluginToolExecution.hostApiMajor !== request.pluginToolExecution.hostApiMajor
    || (operation === 'claim' ? response.state === 'missing' : response.state === 'empty')) {
    throw new Error('Plugin claim acknowledgement is unknown.');
  }
  return response;
}
