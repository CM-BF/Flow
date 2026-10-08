import { z } from 'zod';
import { pluginVerificationRequestSchema, jsonObjectRuleSchema } from './plugin-verification.js';

/** Body and project identity come from the center, never the caller. */
export const pluginVerificationAdmissionSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(2_147_483_647),
  expectedSourceProjectRevision: z.number().int().min(1).max(2_147_483_647),
  title: z.string().trim().min(1).max(180),
  source: pluginVerificationRequestSchema.shape.source.omit({ content: true }),
  rule: jsonObjectRuleSchema,
});
export type PluginVerificationAdmission = z.infer<typeof pluginVerificationAdmissionSchema>;
