import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { runnerMaintenanceCommandSchema, type RunnerMaintenanceAudit, type RunnerMaintenanceCommand, type RunnerMaintenanceHistory, type RunnerMaintenanceResult, type RunnerMaintenanceState, type RunnerMaintenanceView } from '../../../../packages/contracts/src/runner-maintenance.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';

type Identity = { id: string; revoked: boolean; maintenance_state: RunnerMaintenanceState; maintenance_version: number; maintenance_operation_id: string | null; maintenance_updated_at: Date | null };
type Action = RunnerMaintenanceAudit['action'];
type Source = RunnerMaintenanceAudit['source'];
async function identity(client: PoolClient, runnerId: string, lock = false): Promise<Identity> {
  const row = (await client.query<Identity>(`SELECT * FROM flow.runners WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [runnerId])).rows[0];
  if (!row) throw new HttpError(404, 'runner_not_found', 'Runner not found.');
  if (row.revoked) throw new HttpError(409, 'runner_revoked', 'Revoked runners cannot resume admission.');
  return row;
}
async function active(client: PoolClient, runnerId: string) {
  return (await client.query<{ active: number; uncertain: number }>(`SELECT count(*)::int AS active,count(*) FILTER(WHERE t.status='uncertain')::int AS uncertain
    FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id WHERE a.runner_id=$1 AND a.completed_at IS NULL`, [runnerId])).rows[0]!;
}
export async function readRunnerMaintenance(pool: Pool, runnerId: string): Promise<RunnerMaintenanceView> {
  return transaction(pool, async client => {
    const row = await identity(client, runnerId); const counts = await active(client, runnerId);
    return { runnerId, version: row.maintenance_version, state: row.maintenance_state, operationId: row.maintenance_operation_id,
      activeAttempts: counts.active, uncertainAttempts: counts.uncertain, updatedAt: row.maintenance_updated_at?.toISOString() ?? null, stopPermitted: false };
  }, true);
}
export async function readRunnerMaintenanceHistory(pool: Pool, runnerId: string, after = '0'): Promise<RunnerMaintenanceHistory> {
  if (!/^\d{1,18}$/.test(after)) throw new HttpError(400, 'maintenance_cursor', 'Invalid audit cursor.');
  return transaction(pool, async client => {
    await identity(client, runnerId);
    const rows = (await client.query<{ ordinal: string; result: RunnerMaintenanceResult }>('SELECT ordinal,result FROM flow.runner_maintenance_audit WHERE runner_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 101', [runnerId, after])).rows;
    const page = rows.slice(0, 100);
    return { audits: page.map(row => row.result.audit), nextCursor: rows.length > 100 ? page.at(-1)!.ordinal : null };
  }, true);
}
/** Both HTTP and explicitly trusted local maintenance use this one transaction. No PID authority is exposed over HTTP. */
export async function commandRunnerMaintenance(pool: Pool, runnerId: string, action: Action, input: RunnerMaintenanceCommand, requestId: string, source: Source): Promise<RunnerMaintenanceResult> {
  const parsed = runnerMaintenanceCommandSchema.safeParse(input);
  if (!parsed.success || !requestId.trim() || requestId.length > 128) throw new HttpError(400, 'maintenance_input', 'Invalid maintenance command.');
  input = parsed.data;
  const digest = sha256(canonical({ action, input, source }));
  return transaction(pool, async client => {
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='3s'");
    const row = await identity(client, runnerId, true);
    const prior = (await client.query<{ digest: string; result: RunnerMaintenanceResult }>('SELECT digest,result FROM flow.runner_maintenance_audit WHERE runner_id=$1 AND request_id=$2', [runnerId, requestId])).rows[0];
    if (prior) {
      if (prior.digest !== digest) throw new HttpError(409, 'maintenance_key_conflict', 'Idempotency key was used for a different command.');
      return { ...prior.result, replayed: true };
    }
    if (row.maintenance_version !== input.version) throw new HttpError(409, 'maintenance_version', 'Maintenance version changed. Refresh before issuing another command.');
    const state = await transition(client, row, action, input, source);
    const updated = (await client.query<{ at: Date }>(`UPDATE flow.runners SET maintenance_state=$2,maintenance_version=maintenance_version+1,
      maintenance_operation_id=$3,maintenance_updated_at=clock_timestamp() WHERE id=$1 RETURNING maintenance_updated_at AS at`, [runnerId, state, state === 'accepting' ? null : input.operationId])).rows[0]!;
    const audit: RunnerMaintenanceAudit = { id: randomUUID(), runnerId, requestId, action, source, operationId: input.operationId, reason: input.reason,
      before: { state: row.maintenance_state, version: row.maintenance_version }, after: { state, version: row.maintenance_version + 1 }, createdAt: updated.at.toISOString() };
    const result: RunnerMaintenanceResult = { state: { runnerId, state, version: audit.after.version, operationId: state === 'accepting' ? null : input.operationId }, audit, replayed: false };
    await client.query('INSERT INTO flow.runner_maintenance_audit(id,runner_id,request_id,digest,result) VALUES($1,$2,$3,$4,$5)', [audit.id, runnerId, requestId, digest, result]);
    return result;
  });
}
async function transition(client: PoolClient, row: Identity, action: Action, input: RunnerMaintenanceCommand, source: Source): Promise<RunnerMaintenanceState> {
  if (action === 'drain' && row.maintenance_state === 'accepting') return 'draining';
  if (row.maintenance_operation_id !== input.operationId) throw new HttpError(409, 'maintenance_operation', 'This command does not own the maintenance operation.');
  if (action === 'hold' && source === 'trusted-host' && row.maintenance_state === 'draining') {
    if ((await active(client, row.id)).active > 0) throw new HttpError(409, 'maintenance_busy', 'Existing or uncertain attempts still occupy this runner.');
    return 'maintenance';
  }
  if (action === 'resume' && (row.maintenance_state === 'draining' || row.maintenance_state === 'maintenance' && source === 'trusted-host')) return 'accepting';
  throw new HttpError(409, 'maintenance_state', 'This maintenance transition requires a different state or the trusted local host.');
}
