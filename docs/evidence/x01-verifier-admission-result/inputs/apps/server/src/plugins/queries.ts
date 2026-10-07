import type { PoolClient } from 'pg';
import { MAX_PLUGIN_RESPONSE_BYTES, type PluginScope } from '../../../../packages/contracts/src/plugins.js';
import { HttpError } from '../database.js';
import { installationView, loadInstallation, operationView, versionView, type InstallationRecord, type OperationRecord, type VersionRecord } from './storage.js';

export function boundedResponse<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_PLUGIN_RESPONSE_BYTES) throw new HttpError(500, 'plugin_response_too_large', 'The plugin response exceeds its limit.');
  return value;
}
function page<T extends { id: string }, K extends string>(field: K, rows: T[], limit: number): Record<K, T[]> & { nextCursor: string | null } {
  const selected: T[] = [];
  for (const row of rows.slice(0, limit)) {
    const candidate = { [field]: [...selected, row], nextCursor: row.id };
    if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') > MAX_PLUGIN_RESPONSE_BYTES) break;
    selected.push(row);
  }
  if (rows.length && !selected.length) throw new HttpError(500, 'plugin_response_too_large', 'A plugin entry exceeds its limit.');
  return { [field]: selected, nextCursor: selected.length < rows.length ? selected.at(-1)!.id : null } as Record<K, T[]> & { nextCursor: string | null };
}
export async function listPlugins(client: PoolClient, scope: PluginScope, limit: number, after?: string) {
  if (scope.projectId && !(await client.query('SELECT id FROM flow.projects WHERE workspace_id=$1 AND id=$2', [scope.workspaceId, scope.projectId])).rowCount) {
    throw new HttpError(404, 'project_not_found', 'Project not found in the plugin workspace.');
  }
  if (after && !(await client.query('SELECT id FROM flow.plugin_installations WHERE workspace_id=$1 AND project_id IS NOT DISTINCT FROM $2 AND id=$3', [scope.workspaceId, scope.projectId, after])).rowCount) {
    throw new HttpError(400, 'invalid_cursor', 'Cursor is not in this plugin scope.');
  }
  const rows = (await client.query<InstallationRecord>(`SELECT * FROM flow.plugin_installations
    WHERE workspace_id=$1 AND project_id IS NOT DISTINCT FROM $2 AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT $4`, [scope.workspaceId, scope.projectId, after ?? null, limit + 1])).rows;
  return page('installations', rows.map(installationView), limit);
}
export async function listVersions(client: PoolClient, id: string, limit: number, after?: string) {
  await loadInstallation(client, id);
  if (after && !(await client.query('SELECT id FROM flow.plugin_versions WHERE installation_id=$1 AND id=$2', [id, after])).rowCount) {
    throw new HttpError(400, 'invalid_cursor', 'Cursor is not in this plugin registration.');
  }
  const rows = (await client.query<VersionRecord>('SELECT id,declaration,created_at FROM flow.plugin_versions WHERE installation_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3', [id, after ?? null, limit + 1])).rows;
  return page('versions', rows.map(versionView), limit);
}
export async function readOperation(client: PoolClient, id: string, operationId: string) {
  await loadInstallation(client, id);
  const row = (await client.query<OperationRecord>('SELECT * FROM flow.plugin_operations WHERE installation_id=$1 AND id=$2', [id, operationId])).rows[0];
  if (!row) throw new HttpError(404, 'plugin_operation_not_found', 'Plugin operation not found in this registration.');
  return operationView(row);
}
export async function listOperations(client: PoolClient, id: string, limit: number, after?: string) {
  await loadInstallation(client, id);
  const afterRevision = after ? (await readOperation(client, id, after)).afterRevision : 0;
  const rows = (await client.query<OperationRecord>('SELECT * FROM flow.plugin_operations WHERE installation_id=$1 AND after_revision>$2 ORDER BY after_revision LIMIT $3', [id, afterRevision, limit + 1])).rows;
  return page('operations', rows.map(operationView), limit);
}
