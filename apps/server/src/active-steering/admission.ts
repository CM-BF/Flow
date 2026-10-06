import type { Pool, PoolClient } from 'pg';
import type { SteeringAdmission, SteeringAdmissionUnavailableReason } from '../../../../packages/contracts/src/active-steering.js';
import { HttpError, transaction } from '../database.js';
import { assertSteeringExecutionProfile } from '../execution-profiles/store.js';
import { loadTask, type TaskRecord } from '../tasks.js';
import { commandAdmissionBlock, readCommandAdmission } from './admission-policy.js';

interface AttemptFacts {
  id: string; owner_version: number; runner_id: string; native_session_id: string | null;
  completed_at: Date | null; revoked: boolean; live: boolean;
}
async function installed(client: PoolClient): Promise<boolean> {
  const row = (await client.query<{ installed: boolean }>(`SELECT
    EXISTS(SELECT 1 FROM flow.migrations WHERE version=24)
    AND to_regclass('flow.steering_attempts') IS NOT NULL
    AND to_regclass('flow.steering_commands') IS NOT NULL
    AND to_regclass('flow.steering_audit') IS NOT NULL
    AND to_regclass('flow.assistant_messages') IS NOT NULL
    AND to_regclass('flow.execution_profiles') IS NOT NULL AS installed`)).rows[0]!;
  return row.installed;
}
async function authorityBlock(client: PoolClient, task: TaskRecord, attempt: AttemptFacts): Promise<SteeringAdmissionUnavailableReason | null> {
  if (task.current_attempt_id !== attempt.id) return 'not-current';
  if (task.owner_version !== attempt.owner_version) return 'stale-owner';
  if (attempt.revoked) return 'runner-revoked';
  if (task.pending_decision) return 'decision-pending';
  if (!attempt.live) return 'lease-expired';
  if (task.status !== 'running' || attempt.completed_at) return 'not-running';
  if (task.submission.harness !== 'claude' || !attempt.native_session_id) return 'session-unavailable';
  const session = await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4', [attempt.native_session_id, 'claude', attempt.runner_id, task.id]);
  if (!session.rowCount) return 'session-unavailable';
  try { await assertSteeringExecutionProfile(client, task.submission, attempt.runner_id); }
  catch (error) {
    if (error instanceof HttpError && error.code === 'execution_profile_unavailable') return 'profile-unavailable';
    if (error instanceof HttpError && ['steering_profile_unsupported', 'goal_profile_requires_grant'].includes(error.code)) return 'profile-unsupported';
    throw error;
  }
  return null;
}

export async function steeringAdmission(pool: Pool, taskId: string, enabled = false, selectedAttempt?: string): Promise<SteeringAdmission> {
  return transaction(pool, async client => {
    const task = await loadTask(client, taskId);
    const attemptId = selectedAttempt ?? task.current_attempt_id;
    const attempt = attemptId ? (await client.query<AttemptFacts>(`SELECT a.id,a.owner_version,a.runner_id,a.native_session_id,a.completed_at,r.revoked,
      a.lease_expires_at>clock_timestamp() AS live FROM flow.attempts a JOIN flow.runners r ON r.id=a.runner_id WHERE a.id=$1 AND a.task_id=$2`, [attemptId, taskId])).rows[0] : undefined;
    if (attemptId && !attempt) throw new HttpError(404, 'steering_attempt', 'Attempt not found for this task.');
    const metadata = { taskId, attemptId, ownerVersion: attempt?.owner_version ?? null };
    const unavailable = (reason: SteeringAdmissionUnavailableReason, revision: number | null = null): SteeringAdmission => ({ ...metadata, revision, state: 'unavailable', reason });
    // Default-off remains safe on centers whose base schema predates steering storage.
    if (!enabled) return unavailable('disabled');
    if (!await installed(client)) return unavailable('not-installed');
    if (!attempt) return unavailable('no-attempt');
    const state = await readCommandAdmission(client, attempt.id);
    const reason = await authorityBlock(client, task, attempt) ?? commandAdmissionBlock(state);
    if (reason) {
      // Read snapshots do not supply an expected CAS revision.
      if (reason === 'stale-revision') throw new Error('Unexpected revision predicate in a read snapshot.');
      return unavailable(reason, state.revision);
    }
    return { taskId, attemptId: attempt.id, ownerVersion: attempt.owner_version, revision: state.revision, state: 'ready', reason: 'ready' };
  }, true);
}
