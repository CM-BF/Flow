import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pluginHostCandidatesPageSchema, type PluginHostCandidatesQuery, type PluginHostCandidatesPage } from '../../../../packages/contracts/src/plugin-runtime-hosts.js';
import { PLUGIN_RUNTIME_LIMITS, PLUGIN_RUNTIME_PROTOCOL } from '../../../../packages/contracts/src/plugin-runtime.js';
import { HttpError } from '../database.js';
import { readSnapshot } from '../plugins/storage.js';
import { installedMaterial, type TrustedPluginHostPolicy } from './store.js';

const cursorSchema = z.strictObject({ registrationId: z.uuid(), materialInstallOperationId: z.uuid(), revision: z.number().int().positive().max(2_147_483_647), runnerId: z.uuid() });
function readCursor(value: string | undefined): z.infer<typeof cursorSchema> | null {
  if (value === undefined) return null;
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw new Error('Non-canonical cursor');
    return cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch { throw new HttpError(400, 'invalid_plugin_host_cursor', 'Invalid plugin host cursor.'); }
}
interface HostRow { runner_id: string; name: string; store_id: string; host_api_major: 1; maintenance_state: string; harnesses: string[] }
/** Owner-only advisory projection; no locks, probes, credentials, paths, or new authority. */
export async function readPluginHostCandidates(client: PoolClient, registrationId: string, input: PluginHostCandidatesQuery,
  policy?: TrustedPluginHostPolicy): Promise<PluginHostCandidatesPage> {
  if (!policy) throw new HttpError(403, 'plugin_host_policy_required', 'The operator has not configured trusted plugin hosts.');
  const cursor = readCursor(input.cursor);
  const current = await readSnapshot(client, registrationId);
  if (cursor && (cursor.registrationId !== registrationId || cursor.materialInstallOperationId !== input.materialInstallOperationId || cursor.revision !== current.revision)) {
    throw new HttpError(409, 'plugin_host_cursor_changed', 'Plugin selection changed. Read candidates again from the first page.');
  }
  const material = await installedMaterial(client, current, input.materialInstallOperationId);
  const rows = (await client.query<HostRow>(`SELECT h.runner_id,r.name,h.store_id,h.host_api_major,r.maintenance_state,r.harnesses
    FROM flow.plugin_runtime_hosts h JOIN flow.runners r ON r.id=h.runner_id
    WHERE NOT r.revoked AND ($1::text IS NULL OR h.runner_id>$1)
    ORDER BY h.runner_id LIMIT $2`, [cursor?.runnerId ?? null, PLUGIN_RUNTIME_LIMITS.pageSize + 1])).rows;
  const scanned = rows.slice(0, PLUGIN_RUNTIME_LIMITS.pageSize);
  const candidates = scanned.flatMap(row => {
    const identity = Object.freeze({ protocol: PLUGIN_RUNTIME_PROTOCOL, runnerId: row.runner_id, storeId: row.store_id, hostApiMajor: row.host_api_major });
    const reason = row.maintenance_state !== 'accepting' ? 'maintenance' : row.store_id !== material.storeId ? 'material-store-mismatch'
      : !row.harnesses.includes('fixture') ? 'harness-unsupported' : 'compatible';
    return policy(identity) === true ? [{ ...identity, runnerName: row.name, selectable: reason === 'compatible', reason, online: 'unknown' as const, loaded: 'unknown' as const, callable: 'unknown' as const }] : [];
  });
  return pluginHostCandidatesPageSchema.parse({ protocol: PLUGIN_RUNTIME_PROTOCOL, registrationId, currentRevision: current.revision,
    versionId: current.version.id, materialInstallOperationId: input.materialInstallOperationId, candidates,
    nextCursor: rows.length > scanned.length ? Buffer.from(JSON.stringify({ registrationId, materialInstallOperationId: input.materialInstallOperationId, revision: current.revision, runnerId: scanned.at(-1)!.runner_id })).toString('base64url') : null });
}
