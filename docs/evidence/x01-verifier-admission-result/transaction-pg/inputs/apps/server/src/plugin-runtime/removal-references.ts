import type { PoolClient } from 'pg';
import { z } from 'zod';
import { PLUGIN_REMOVAL_LIMITS, pluginRemovalPageSchema, pluginRemovalQuerySchema, type PluginRemovalPage, type PluginRemovalQuery } from '../../../../packages/contracts/src/plugin-removal.js';
import { HttpError } from '../database.js';
import { loadInstall } from '../plugin-installations/store.js';
import { loadInstallation } from '../plugins/storage.js';

const cursorSchema = z.strictObject({ registrationId: z.uuid(), materialInstallOperationId: z.uuid(),
  revision: z.number().int().positive().max(2_147_483_647), createdAt: z.iso.datetime(), bindingId: z.uuid() });
function readCursor(value: string | undefined): z.infer<typeof cursorSchema> | null {
  if (value === undefined) return null;
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw new Error('Non-canonical cursor');
    return cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch { throw new HttpError(400, 'invalid_plugin_removal_cursor', 'Invalid removal reference cursor.'); }
}
interface ReferenceRow {
  id: string; task_id: string; material_install_operation_id: string; store_id: string; material_id: string; created_at: Date; cursor_created_at: string;
  status: string | null; current_attempt_id: string | null; open_attempt_id: string | null;
}
function project(row: ReferenceRow): PluginRemovalPage['references'][number] {
  const active = ['queued', 'running', 'waiting', 'cancel_requested'].includes(row.status ?? '');
  const terminal = ['succeeded', 'failed', 'cancelled'].includes(row.status ?? '');
  const reason = row.status === 'uncertain' ? 'outcome-uncertain' : active ? 'task-active'
    : row.open_attempt_id ? 'attempt-unsettled' : terminal ? 'terminal-history' : 'state-unrecognized';
  return { bindingId: row.id, taskId: row.task_id, materialInstallOperationId: row.material_install_operation_id, createdAt: row.created_at.toISOString(),
    taskState: active || terminal || row.status === 'uncertain' ? row.status as PluginRemovalPage['references'][number]['taskState'] : 'unknown',
    attemptId: row.open_attempt_id ?? row.current_attempt_id,
    classification: reason === 'task-active' ? 'active' : reason === 'terminal-history' ? 'historical' : 'uncertain', reason };
}
/** Observes existing authority only. No host probes, mutation, deletion grant, or cross-page snapshot promise. */
export async function readPluginRemovalReferences(client: PoolClient, registrationId: string, query: PluginRemovalQuery): Promise<PluginRemovalPage> {
  const input = pluginRemovalQuerySchema.parse(query);
  const cursor = readCursor(input.cursor);
  const registration = await loadInstallation(client, registrationId);
  const material = await loadInstall(client, input.materialInstallOperationId);
  if (material.registration_id !== registrationId || material.status !== 'installed' || !material.receipt
    || material.receipt.storeId !== material.store_id || !/^[a-f0-9]{64}$/.test(material.receipt.installationId)) {
    throw new HttpError(409, 'plugin_removal_material_mismatch', 'Reference inspection requires exact installed material from this registration.');
  }
  if (cursor && (cursor.registrationId !== registrationId || cursor.materialInstallOperationId !== material.id || cursor.revision !== registration.revision)) {
    throw new HttpError(409, 'plugin_removal_cursor_changed', 'Plugin selection changed. Read references again from the first page.');
  }
  // Match the existing registration/created_at/id index; filter material AFTER the finite raw scan.
  const rows = (await client.query<ReferenceRow>(`SELECT b.id,b.task_id,b.material_install_operation_id,b.store_id,b.material_id,b.created_at,
    to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
    t.status,t.current_attempt_id,a.id AS open_attempt_id
    FROM (SELECT id,task_id,material_install_operation_id,store_id,material_id,created_at FROM flow.plugin_tool_bindings
      WHERE registration_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::text))
      ORDER BY created_at,id LIMIT $4) b
    LEFT JOIN flow.tasks t ON t.id=b.task_id
    LEFT JOIN flow.attempts a ON a.task_id=b.task_id AND a.completed_at IS NULL
    ORDER BY b.created_at,b.id`, [registrationId, cursor?.createdAt ?? null, cursor?.bindingId ?? null, PLUGIN_REMOVAL_LIMITS.pageSize + 1])).rows;
  const scanned = rows.slice(0, PLUGIN_REMOVAL_LIMITS.pageSize);
  const last = scanned.at(-1);
  return pluginRemovalPageSchema.parse({ protocol: 'flow.plugin-removal-references.v1', registrationId, currentRevision: registration.revision,
    materialInstallOperationId: material.id, versionId: material.version_id, storeId: material.store_id, materialId: material.receipt.installationId,
    purpose: 'reference-observation', coverage: 'registration-tool-task-bindings', consistency: 'independent-page-snapshots', hostRelease: 'unknown', physicalRemoval: 'not-authorized',
    references: scanned.filter(row => row.store_id === material.store_id && row.material_id === material.receipt!.installationId).map(project),
    nextCursor: rows.length > scanned.length && last ? Buffer.from(JSON.stringify({ registrationId, materialInstallOperationId: material.id,
      revision: registration.revision, createdAt: last.cursor_created_at, bindingId: last.id })).toString('base64url') : null });
}
