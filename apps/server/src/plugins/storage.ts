import type { PoolClient } from 'pg';
import type { PluginCapability, PluginConfiguration, PluginInstallation, PluginOperation, PluginSnapshot, PluginVersion, PluginVersionDeclaration } from '../../../../packages/contracts/src/plugins.js';
import { HttpError } from '../database.js';

export interface InstallationRecord { id: string; workspace_id: string; project_id: string | null; package_name: string; revision: number; created_at: Date; updated_at: Date }
export interface VersionRecord { id: string; declaration: PluginVersionDeclaration; created_at: Date }
export interface OperationRecord { id: string; installation_id: string; kind: PluginOperation['kind']; input_digest: string; before_revision: number | null; after_revision: number; created_at: Date }
export function installationView(row: InstallationRecord): PluginInstallation {
  return { id: row.id, scope: { workspaceId: row.workspace_id as 'personal', projectId: row.project_id }, packageName: row.package_name, revision: row.revision,
    registrationStatus: 'registered', runtimeStatus: 'unavailable', runtimeReason: 'package_not_verified_or_loaded', createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export function versionView(row: VersionRecord): PluginVersion { return { ...row.declaration, id: row.id, createdAt: row.created_at.toISOString() }; }
export function operationView(row: OperationRecord): PluginOperation {
  return { id: row.id, installationId: row.installation_id, kind: row.kind, status: 'succeeded', actor: 'owner', inputDigest: row.input_digest,
    beforeRevision: row.before_revision, afterRevision: row.after_revision, createdAt: row.created_at.toISOString() };
}
export async function loadInstallation(client: PoolClient, id: string, lock = false): Promise<InstallationRecord> {
  const row = (await client.query<InstallationRecord>(`SELECT * FROM flow.plugin_installations WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'plugin_not_found', 'Plugin registration not found.');
  return row;
}
export async function readSnapshot(client: PoolClient, id: string, revision?: number): Promise<PluginSnapshot> {
  const row = await loadInstallation(client, id);
  const selected = (await client.query<{ revision: number; configuration: PluginConfiguration; grants: PluginCapability[] } & VersionRecord>(`
    SELECT r.revision,r.configuration,r.grants,v.id,v.declaration,v.created_at
    FROM flow.plugin_revisions r JOIN flow.plugin_versions v ON v.id=r.version_id AND v.installation_id=r.installation_id
    WHERE r.installation_id=$1 AND r.revision=$2`, [id, revision ?? row.revision])).rows[0];
  if (!selected) throw new HttpError(404, 'plugin_revision_not_found', 'Plugin revision not found.');
  const missing = selected.declaration.publicConfiguration.some(field => field.required && !(field.key in selected.configuration));
  return { installation: installationView(row), revision: selected.revision, version: versionView(selected), configuration: selected.configuration,
    grants: selected.grants, configurationStatus: missing ? 'incomplete' : 'ready' };
}
