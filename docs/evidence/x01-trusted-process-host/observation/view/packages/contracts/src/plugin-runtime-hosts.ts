import { z } from 'zod';
import { pluginRevisionSchema } from './plugins.js';
import { isPersistablePluginText, PLUGIN_RUNTIME_LIMITS, PLUGIN_RUNTIME_PROTOCOL, pluginHostIdentitySchema } from './plugin-runtime.js';

export const pluginHostCandidatesQuerySchema = z.strictObject({
  materialInstallOperationId: z.uuid(), cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
});
export const pluginHostCandidateSchema = pluginHostIdentitySchema.extend({
  runnerName: z.string().min(1).max(120).refine(isPersistablePluginText),
  selectable: z.boolean(), reason: z.enum(['compatible', 'maintenance', 'material-store-mismatch', 'harness-unsupported']),
  online: z.literal('unknown'), loaded: z.literal('unknown'), callable: z.literal('unknown'),
}).refine(value => value.selectable === (value.reason === 'compatible'), 'Candidate selection reason is inconsistent');
/** A scanned page can be empty but still have a next cursor after policy filtering. */
export const pluginHostCandidatesPageSchema = z.strictObject({
  protocol: z.literal(PLUGIN_RUNTIME_PROTOCOL), registrationId: z.uuid(), currentRevision: pluginRevisionSchema,
  versionId: z.uuid(), materialInstallOperationId: z.uuid(),
  candidates: z.array(pluginHostCandidateSchema).max(PLUGIN_RUNTIME_LIMITS.pageSize), nextCursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).nullable(),
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= PLUGIN_RUNTIME_LIMITS.responseBytes, 'Candidate page exceeds its byte limit');
export type PluginHostCandidatesQuery = z.infer<typeof pluginHostCandidatesQuerySchema>;
export type PluginHostCandidatesPage = z.infer<typeof pluginHostCandidatesPageSchema>;
