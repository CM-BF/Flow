import type { Pool } from 'pg';
import type { SteeringAudit, SteeringAuditPage, SteeringState, SteeringText } from '../../../../packages/contracts/src/active-steering.js';
import { HttpError, sha256, transaction } from '../database.js';
import { loadTask } from '../tasks.js';
import { commandColumns, commandReference, type CommandRow, type ControlRow } from './storage.js';

export async function steeringState(pool: Pool, taskId: string, after: number, limit: number, selectedAttempt?: string): Promise<SteeringState> {
  return transaction(pool, async client => {
    const task = await loadTask(client, taskId);
    const attemptId = selectedAttempt ?? task.current_attempt_id;
    if (!attemptId) return { taskId, attemptId: null, revision: 0, sealed: false, attemptAvailable: false, commands: [], nextCursor: null };
    const attempt = (await client.query<{ available: boolean }>(`SELECT a.id,
      (a.id=$3 AND a.owner_version=$4 AND a.completed_at IS NULL AND a.lease_expires_at>clock_timestamp()
       AND NOT r.revoked AND a.native_session_id IS NOT NULL AND EXISTS
       (SELECT 1 FROM flow.sessions s WHERE s.id=a.native_session_id AND s.harness='claude' AND s.runner_id=a.runner_id AND s.active_task_id=a.task_id)) AS available
      FROM flow.attempts a JOIN flow.runners r ON r.id=a.runner_id WHERE a.id=$1 AND a.task_id=$2`, [attemptId, taskId, task.current_attempt_id, task.owner_version])).rows[0];
    if (!attempt) throw new HttpError(404, 'steering_attempt', 'Attempt not found for this task.');
    const state = (await client.query<ControlRow>('SELECT revision,seal FROM flow.steering_attempts WHERE attempt_id=$1', [attemptId])).rows[0];
    const rows = (await client.query<CommandRow>(`SELECT ${commandColumns} FROM flow.steering_commands WHERE task_id=$1 AND attempt_id=$2 AND revision>$3 ORDER BY revision LIMIT $4`, [taskId, attemptId, after, limit + 1])).rows;
    const page = rows.slice(0, limit);
    return { taskId, attemptId, revision: state?.revision ?? 0, sealed: !!state?.seal,
      attemptAvailable: attempt.available && task.status === 'running' && !task.pending_decision && task.submission.harness === 'claude',
      commands: page.map(commandReference), nextCursor: rows.length > limit ? page.at(-1)!.revision : null };
  }, true);
}
export async function steeringText(pool: Pool, taskId: string, commandId: string): Promise<SteeringText> {
  const row = (await pool.query<{ text: string; attempt_id: string; input_digest: string }>('SELECT text,attempt_id,input_digest FROM flow.steering_commands WHERE task_id=$1 AND id=$2', [taskId, commandId])).rows[0];
  if (!row) throw new HttpError(404, 'steering_command', 'Command not found for this task.');
  if (sha256(row.text) !== row.input_digest) throw new HttpError(409, 'steering_content', 'Stored text does not match the accepted input digest.');
  return { taskId, attemptId: row.attempt_id, commandId, text: row.text, bytes: Buffer.byteLength(row.text), digest: row.input_digest };
}
export async function steeringAudit(pool: Pool, taskId: string, after: number, limit: number): Promise<SteeringAuditPage> {
  return transaction(pool, async client => {
    await loadTask(client, taskId);
    const rows = (await client.query<{ id: string; ordinal: string; task_id: string; attempt_id: string; command_id: string | null;
      action: SteeringAudit['action']; actor: SteeringAudit['actor']; data: SteeringAudit['data']; created_at: Date }>(
      'SELECT * FROM flow.steering_audit WHERE task_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT $3', [taskId, after, limit + 1])).rows;
    const entries = rows.slice(0, limit).map(row => ({ id: row.id, ordinal: Number(row.ordinal), taskId: row.task_id, attemptId: row.attempt_id,
      commandId: row.command_id, action: row.action, actor: row.actor, data: row.data, createdAt: row.created_at.toISOString() }));
    return { entries, nextCursor: rows.length > limit ? entries.at(-1)!.ordinal : null };
  }, true);
}
