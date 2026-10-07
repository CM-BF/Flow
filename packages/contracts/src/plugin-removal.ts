import { z } from 'zod';
import { pluginRevisionSchema } from './plugins.js';

export const PLUGIN_REMOVAL_LIMITS = Object.freeze({ pageSize: 40, responseBytes: 64 * 1024 });
const cursor = z.string().min(1).max(768).regex(/^[A-Za-z0-9_-]+$/);
export const pluginRemovalQuerySchema = z.strictObject({ materialInstallOperationId: z.uuid(), cursor: cursor.optional() });
const taskState = z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain', 'unknown']);
export const pluginRemovalReferenceSchema = z.strictObject({
  bindingId: z.uuid(), taskId: z.uuid(), materialInstallOperationId: z.uuid(), createdAt: z.iso.datetime(), taskState,
  attemptId: z.uuid().nullable(), classification: z.enum(['active', 'uncertain', 'historical']),
  reason: z.enum(['task-active', 'outcome-uncertain', 'attempt-unsettled', 'state-unrecognized', 'terminal-history']),
});
/** Per-page observations do not authorize deletion, even when a page is empty. */
export const pluginRemovalPageSchema = z.strictObject({
  protocol: z.literal('flow.plugin-removal-references.v1'), registrationId: z.uuid(), currentRevision: pluginRevisionSchema,
  materialInstallOperationId: z.uuid(), versionId: z.uuid(), storeId: z.string().min(1).max(128),
  materialId: z.string().regex(/^[a-f0-9]{64}$/),
  purpose: z.literal('reference-observation'), coverage: z.literal('registration-tool-task-bindings'),
  consistency: z.literal('independent-page-snapshots'), hostRelease: z.literal('unknown'), physicalRemoval: z.literal('not-authorized'),
  references: z.array(pluginRemovalReferenceSchema).max(PLUGIN_REMOVAL_LIMITS.pageSize), nextCursor: cursor.nullable(),
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= PLUGIN_REMOVAL_LIMITS.responseBytes, 'Removal reference page exceeds its byte limit');
export type PluginRemovalQuery = z.infer<typeof pluginRemovalQuerySchema>;
export type PluginRemovalPage = z.infer<typeof pluginRemovalPageSchema>;
