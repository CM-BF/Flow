import { z } from 'zod';
import { idSchema } from './tasks.js';
import { pluginHostPublicationSchema } from './plugin-runtime.js';
import { pluginToolExecutionSchema } from './plugin-runner-claim.js';
import { JSON_OBJECT_ALGORITHM } from './plugin-verification.js';

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
