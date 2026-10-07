import { z } from 'zod';
import { idSchema, WORKSPACE_ID } from './tasks.js';

export const MAX_PLUGIN_REQUEST_BYTES = 32_768;
export const MAX_PLUGIN_RESPONSE_BYTES = 65_536;
export const MAX_PLUGIN_PAGE_SIZE = 40;
export const pluginRevisionSchema = z.number().int().min(1).max(2_147_483_647);
const fieldKey = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,47}$/)
  .refine(value => !/secret|token|password|credential|api_?key|authorization/i.test(value), 'Secret fields are not public configuration.');
const capability = z.enum(['tool', 'renderer', 'verifier', 'context']);
const uniqueCapabilities = z.array(capability).max(4).refine(items => new Set(items).size === items.length);
const publicField = z.discriminatedUnion('kind', [
  z.strictObject({ key: fieldKey, kind: z.literal('boolean'), required: z.boolean() }),
  z.strictObject({ key: fieldKey, kind: z.literal('integer'), required: z.boolean(), min: z.number().int().min(-1_000_000), max: z.number().int().max(1_000_000) })
    .refine(field => field.min <= field.max),
  z.strictObject({ key: fieldKey, kind: z.literal('enum'), required: z.boolean(), values: z.array(z.string().regex(/^[a-zA-Z0-9_.-]{1,64}$/)).min(1).max(16) })
    .refine(field => new Set(field.values).size === field.values.length),
]);
export const pluginVersionSchema = z.strictObject({
  packageName: z.string().max(214).regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  packageVersion: z.string().max(128).regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
    .refine(value => value.split('+')[0]!.split('-').slice(1).join('-').split('.').every(identifier => !/^0[0-9]+$/.test(identifier))),
  source: z.literal('npm'),
  /** Operator declaration only; registry does not fetch or verify package bytes. */
  declaredSha256: z.string().regex(/^[a-f0-9]{64}$/),
  license: z.string().trim().min(1).max(80),
  hostApiMajor: z.literal(1),
  capabilities: uniqueCapabilities,
  publicConfiguration: z.array(publicField).max(16).refine(fields => new Set(fields.map(field => field.key)).size === fields.length),
});
export const pluginScopeSchema = z.strictObject({ workspaceId: z.literal(WORKSPACE_ID), projectId: idSchema.nullable() });
export const pluginRegistrationSchema = z.strictObject({ scope: pluginScopeSchema, version: pluginVersionSchema });
export const pluginConfigurationSchema = z.record(fieldKey, z.union([z.boolean(), z.number().int().min(-1_000_000).max(1_000_000), z.string().max(64)]))
  .refine(value => Object.keys(value).length <= 16);
export const pluginCommandSchema = z.strictObject({
  expectedRevision: pluginRevisionSchema,
  reason: z.string().trim().min(1).max(512),
  change: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('configure'), values: pluginConfigurationSchema }),
    z.strictObject({ kind: z.literal('set-grants'), capabilities: uniqueCapabilities }),
    z.strictObject({ kind: z.literal('register-version'), version: pluginVersionSchema }),
    z.strictObject({ kind: z.literal('select-version'), versionId: idSchema }),
  ]),
});
export type PluginVersionDeclaration = z.infer<typeof pluginVersionSchema>;
export type PluginRegistration = z.infer<typeof pluginRegistrationSchema>;
export type PluginCommand = z.infer<typeof pluginCommandSchema>;
export type PluginScope = z.infer<typeof pluginScopeSchema>;
export type PluginConfiguration = z.infer<typeof pluginConfigurationSchema>;
export type PluginCapability = z.infer<typeof capability>;
export interface PluginVersion extends PluginVersionDeclaration { id: string; createdAt: string }
export interface PluginInstallation {
  id: string; scope: PluginScope; packageName: string; revision: number;
  registrationStatus: 'registered'; runtimeStatus: 'unavailable'; runtimeReason: 'package_not_verified_or_loaded';
  createdAt: string; updatedAt: string;
}
export interface PluginSnapshot {
  installation: PluginInstallation;
  /** Fixed revision/config/grants/version; installation.revision remains the current pointer. */
  revision: number;
  version: PluginVersion;
  configuration: PluginConfiguration;
  configurationStatus: 'ready' | 'incomplete';
  grants: PluginCapability[];
}
export interface PluginOperation {
  id: string; installationId: string; kind: 'register' | PluginCommand['change']['kind'] | 'enable' | 'disable';
  status: 'succeeded'; actor: 'owner'; inputDigest: string;
  beforeRevision: number | null; afterRevision: number; createdAt: string;
}
export interface PluginMutationResult { snapshot: PluginSnapshot; operation: PluginOperation; replayed: boolean }
export interface PluginList { installations: PluginInstallation[]; nextCursor: string | null }
export interface PluginVersions { versions: PluginVersion[]; nextCursor: string | null }
export interface PluginOperations { operations: PluginOperation[]; nextCursor: string | null }
