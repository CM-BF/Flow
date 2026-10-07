import { z } from 'zod';
import { idSchema } from './tasks.js';
import { pluginToolBindingSchema } from './plugin-runtime.js';
import { jsonObjectRuleSchema, pluginVerificationRequestSchema } from './plugin-verification.js';

/** Positive immutable kind; absence of this reference is never evidence of a tool. */
export const pluginVerifierBindingSchema = pluginToolBindingSchema.safeExtend({
  executionKind: z.literal('verifier'),
  verification: z.strictObject({
    projectId: idSchema,
    source: pluginVerificationRequestSchema.shape.source.omit({ content: true }),
    rule: jsonObjectRuleSchema,
  }),
});
export type PluginVerifierBinding = z.infer<typeof pluginVerifierBindingSchema>;
