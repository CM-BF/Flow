import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Ownership } from '@flow/contracts';
import type { SteeringCommandReference, SteeringSeal, SteeringStatus } from '../../../../packages/contracts/src/active-steering.js';
import { HttpError } from '../database.js';
import { ownedAttempt } from '../runners.js';

export interface CommandRow {
  id: string; task_id: string; attempt_id: string; owner_version: number; native_session_id: string;
  revision: number; user_message_uuid: string; status: SteeringStatus; receipt_revision: number;
  input_bytes: number; input_digest: string; created_at: Date; updated_at: Date;
}
export const commandColumns = 'id,task_id,attempt_id,owner_version,native_session_id,revision,user_message_uuid,status,receipt_revision,octet_length(text) AS input_bytes,input_digest,created_at,updated_at';
export function commandReference(row: CommandRow): SteeringCommandReference {
  return { id: row.id, taskId: row.task_id, attemptId: row.attempt_id, ownerVersion: row.owner_version,
    nativeSessionId: row.native_session_id, revision: row.revision, userMessageUuid: row.user_message_uuid,
    status: row.status, receiptRevision: row.receipt_revision, input: { bytes: row.input_bytes, digest: row.input_digest },
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export function conflict(code: string, message: string): never { throw new HttpError(409, code, message); }

/** All mutations use the existing runner -> task -> attempt lock order before idempotency. */
export async function liveAttempt(client: PoolClient, runnerId: string, ownership: Ownership) {
  const owned = await ownedAttempt(client, runnerId, ownership);
  const { task, attempt } = owned;
  const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
  if (!live || attempt.completed_at || task.status !== 'running' || task.pending_decision) conflict('steering_unavailable', 'The attempt is not available for active steering.');
  if (task.submission.harness !== 'claude' || !attempt.native_session_id) conflict('steering_session', 'A recorded Claude native session is required.');
  const session = await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4', [attempt.native_session_id, 'claude', runnerId, task.id]);
  if (!session.rowCount) conflict('steering_session', 'Native session ownership changed.');
  return owned;
}
export async function ownerAttempt(client: PoolClient, taskId: string, ownership: Ownership) {
  const row = (await client.query<{ runner_id: string; task_id: string }>('SELECT runner_id,task_id FROM flow.attempts WHERE id=$1', [ownership.attemptId])).rows[0];
  if (!row || row.task_id !== taskId) throw new HttpError(404, 'steering_attempt', 'Attempt not found for this task.');
  return liveAttempt(client, row.runner_id, ownership);
}
export interface ControlRow { revision: number; seal: SteeringSeal | null }
export async function control(client: PoolClient, taskId: string, attemptId: string): Promise<ControlRow> {
  await client.query('INSERT INTO flow.steering_attempts(attempt_id,task_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [attemptId, taskId]);
  return (await client.query<ControlRow>('SELECT revision,seal FROM flow.steering_attempts WHERE attempt_id=$1', [attemptId])).rows[0]!;
}
export async function assertNoPending(client: PoolClient, attemptId: string): Promise<void> {
  if ((await client.query("SELECT 1 FROM flow.steering_commands WHERE attempt_id=$1 AND status IN ('accepted','received','unknown')", [attemptId])).rowCount) {
    conflict('steering_pending', 'An unresolved steering command already exists.');
  }
}
export async function appendAudit(client: PoolClient, taskId: string, attemptId: string, commandId: string | null, action: string, actor: 'owner' | 'runner', data: unknown): Promise<void> {
  await client.query('INSERT INTO flow.steering_audit(id,task_id,attempt_id,command_id,action,actor,data) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), taskId, attemptId, commandId, action, actor, JSON.stringify(data)]);
}
