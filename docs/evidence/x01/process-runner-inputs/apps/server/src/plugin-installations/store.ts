import type { PoolClient } from 'pg';
import type { InstalledPackageReceipt } from '@flow/plugin-runtime';
import type { PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import type { PluginInstallAudit, PluginInstallError, PluginInstallStatus, PluginMaterialInstall } from '../../../../packages/contracts/src/plugin-installations.js';
import { HttpError } from '../database.js';

export interface InstallRecord {
  id: string; registration_id: string; version_id: string; admitted_revision: number;
  fetch_operation_id: string; fetch_attempt_id: string; artifact_id: string; artifact_store_id: string;
  store_id: string; artifact: PackageArtifact; input_digest: string; status: PluginInstallStatus;
  execution_id: string | null; receipt: InstalledPackageReceipt | null; error: PluginInstallError | null;
  created_at: Date; updated_at: Date;
}
export async function loadInstall(client: PoolClient, id: string, lock = false): Promise<InstallRecord> {
  const row = (await client.query<InstallRecord>(`SELECT * FROM flow.plugin_material_installs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'plugin_install_not_found', 'Material installation not found.');
  return row;
}
export function installView(row: InstallRecord): PluginMaterialInstall {
  return { schemaVersion: 1, id: row.id, registrationId: row.registration_id, versionId: row.version_id, admittedRevision: row.admitted_revision,
    fetchOperationId: row.fetch_operation_id, fetchAttemptId: row.fetch_attempt_id, artifactId: row.artifact_id,
    storeId: row.store_id, status: row.status, materialId: row.receipt?.installationId ?? null, treeDigest: row.receipt?.treeDigest ?? null,
    hostApiMajor: row.receipt?.manifest.hostApiMajor ?? null, error: row.error, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function readInstall(client: PoolClient, id: string): Promise<PluginMaterialInstall> { return installView(await loadInstall(client, id)); }
export async function installAudit(client: PoolClient, id: string, kind: PluginInstallAudit['kind'], actor: PluginInstallAudit['actor'], reason: string | null = null, error: PluginInstallError | null = null): Promise<void> {
  await client.query('INSERT INTO flow.plugin_material_install_audit(operation_id,kind,actor,reason,error) VALUES($1,$2,$3,$4,$5)', [id, kind, JSON.stringify(actor), reason, error]);
}
