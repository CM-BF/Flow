import { z } from 'zod';

/** Static material receipts only; no enabled, loaded, callable or isolation claim. */
export const PLUGIN_INSTALL_LIMITS = { bodyBytes: 4096, responseBytes: 65_536, pageSize: 40 } as const;
const reason = z.string().trim().min(1).max(512);
export const pluginInstallRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive().max(2_147_483_647),
  fetchOperationId: z.uuid(), fetchAttemptId: z.uuid(), reason,
});
export const pluginInstallCommandSchema = z.strictObject({ action: z.enum(['start', 'reconcile']), reason });
export type PluginInstallRequest = z.infer<typeof pluginInstallRequestSchema>;
export type PluginInstallCommand = z.infer<typeof pluginInstallCommandSchema>;
export type PluginInstallStatus = 'accepted' | 'preparing' | 'installed' | 'failed' | 'unknown';
export type PluginInstallError = 'material_rejected' | 'artifact_unavailable' | 'cancelled' | 'outcome_unknown' | 'lifecycle_unknown';
export interface PluginMaterialInstall {
  schemaVersion: 1;
  id: string; registrationId: string; versionId: string; admittedRevision: number;
  fetchOperationId: string; fetchAttemptId: string; artifactId: string;
  storeId: string; status: PluginInstallStatus;
  /** 64 hex leaf material identity, distinct from the registration UUID. */
  materialId: string | null; treeDigest: string | null; hostApiMajor: 1 | null;
  error: PluginInstallError | null; createdAt: string; updatedAt: string;
}
export interface PluginInstallAccepted { operationId: string; replayed: boolean }
export interface PluginInstallList { operations: PluginMaterialInstall[]; nextCursor: string | null }
export interface PluginInstallAudit {
  cursor: number; operationId: string;
  kind: 'admitted' | 'start' | 'reconcile' | 'preparing' | 'installed' | 'failed' | 'unknown';
  actor: { kind: 'owner' } | { kind: 'center'; executionId: string };
  reason: string | null; error: PluginInstallError | null; createdAt: string;
}
export interface PluginInstallHistory { events: PluginInstallAudit[]; nextCursor: string | null }
