import { z } from 'zod';
import { packageArtifactSchema } from './package-artifacts.js';
import { pluginConfigurationSchema, pluginRevisionSchema, pluginScopeSchema } from './plugins.js';
import { verificationRuleSchema } from './tasks.js';

/** Host publication is durable identity, never proof of this process's claim capability. */
export const PLUGIN_RUNTIME_PROTOCOL = 'flow.plugin-runtime.v1' as const;
export const PLUGIN_RUNTIME_LIMITS = { bodyBytes: 32_768, responseBytes: 65_536, inputBytes: 16_384, pageSize: 40 } as const;
const uuid = z.uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const storeId = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const reason = z.string().trim().min(1).max(512).refine(isPersistablePluginText, 'Invalid persisted reason');
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const bounded = (value: unknown) => jsonBytes(value) <= PLUGIN_RUNTIME_LIMITS.bodyBytes;
/** Text ultimately persisted in PostgreSQL text/jsonb: no NUL or unpaired UTF-16 surrogate. */
export function isPersistablePluginText(value: string): boolean {
  if (value.includes('\0')) return false;
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    }
  }
  return true;
}

export const pluginHostPublicationSchema = z.strictObject({
  protocol: z.literal(PLUGIN_RUNTIME_PROTOCOL), storeId, hostApiMajor: z.literal(1),
});
export const pluginHostIdentitySchema = pluginHostPublicationSchema.extend({ runnerId: uuid });
/** Separate endpoint; the legacy registry command codec keeps its original four changes. */
export const pluginRuntimeCommandSchema = z.strictObject({
  expectedRevision: pluginRevisionSchema, reason,
  change: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('enable'), materialInstallOperationId: uuid, targetRunnerId: uuid, storeId }),
    z.strictObject({ kind: z.literal('disable') }),
  ]),
}).refine(bounded, 'Plugin runtime command exceeds its byte limit');
export const pluginToolTaskRequestSchema = z.strictObject({
  expectedRevision: pluginRevisionSchema,
  title: z.string().trim().min(1).max(180).refine(isPersistablePluginText, 'Invalid persisted title'),
  input: z.string().min(1).max(16_000).refine(value => isPersistablePluginText(value)
    && new TextEncoder().encode(value).byteLength <= PLUGIN_RUNTIME_LIMITS.inputBytes, 'Invalid or oversized UTF-8 tool input'),
  verification: verificationRuleSchema.refine(rule => rule.kind !== 'contains' || isPersistablePluginText(rule.expected), 'Invalid persisted verification text').optional(),
}).refine(bounded, 'Plugin task request exceeds its byte limit');
const artifactIdentity = packageArtifactSchema.pick({ artifactId: true, name: true, version: true, integrity: true, bytes: true, sha256: true });
/** No paths, full input, mutable defaults, or caller-created attempt identity. */
export const pluginToolBindingSchema = z.strictObject({
  protocol: z.literal(PLUGIN_RUNTIME_PROTOCOL),
  bindingId: uuid, invocationId: uuid, taskId: uuid,
  registrationId: uuid, registrationRevision: pluginRevisionSchema, versionId: uuid,
  scope: pluginScopeSchema,
  materialInstallOperationId: uuid, targetRunnerId: uuid, storeId,
  materialId: digest, treeDigest: digest, hostApiMajor: z.literal(1),
  artifact: artifactIdentity, configuration: pluginConfigurationSchema, inputDigest: digest,
  createdAt: z.iso.datetime(),
}).refine(bounded, 'Plugin binding exceeds its byte limit');
export const pluginGrantRequestSchema = z.strictObject({
  attemptId: uuid, ownerVersion: z.number().int().positive().max(2_147_483_647),
  bindingId: uuid, invocationId: uuid, phase: z.enum(['load', 'invoke']),
});
/** A replay is historical evidence only. It does not authorize executing a package action again. */
export const pluginGrantReceiptSchema = pluginGrantRequestSchema.extend({
  protocol: z.literal(PLUGIN_RUNTIME_PROTOCOL), taskId: uuid, runnerId: uuid,
  authorizedRevision: pluginRevisionSchema, replayed: z.boolean(),
});
export const pluginRuntimeViewSchema = z.strictObject({
  protocol: z.literal(PLUGIN_RUNTIME_PROTOCOL), registrationId: uuid, currentRevision: pluginRevisionSchema,
  enabledRevision: pluginRevisionSchema.nullable(), desiredEnabled: z.boolean(), bindingAllowed: z.boolean(),
  reason: z.enum(['not-enabled', 'revision-changed', 'configuration-incomplete', 'grant-missing', 'host-unavailable', 'ready']),
  targetRunnerId: uuid.nullable(), storeId: storeId.nullable(), materialInstallOperationId: uuid.nullable(),
  loaded: z.literal('unknown'), callable: z.literal('unknown'),
}).superRefine((value, context) => {
  const complete = value.enabledRevision !== null && value.targetRunnerId !== null && value.storeId !== null && value.materialInstallOperationId !== null;
  const empty = value.enabledRevision === null && value.targetRunnerId === null && value.storeId === null && value.materialInstallOperationId === null;
  if (value.bindingAllowed !== (value.reason === 'ready') || value.bindingAllowed && (!value.desiredEnabled || !complete || value.enabledRevision !== value.currentRevision)
    || value.desiredEnabled !== complete || !value.desiredEnabled && (!empty || value.reason !== 'not-enabled')) {
    context.addIssue({ code: 'custom', message: 'Runtime projection does not describe one coherent enable revision' });
  }
});
export type PluginHostPublication = z.infer<typeof pluginHostPublicationSchema>;
export type PluginHostIdentity = z.infer<typeof pluginHostIdentitySchema>;
export type PluginRuntimeCommand = z.infer<typeof pluginRuntimeCommandSchema>;
export type PluginToolTaskRequest = z.infer<typeof pluginToolTaskRequestSchema>;
export type PluginToolBinding = z.infer<typeof pluginToolBindingSchema>;
export type PluginGrantRequest = z.infer<typeof pluginGrantRequestSchema>;
export type PluginGrantReceipt = z.infer<typeof pluginGrantReceiptSchema>;
export type PluginRuntimeView = z.infer<typeof pluginRuntimeViewSchema>;
