// Historical test fixture. Only relative import paths changed; see evidence manifest.
import { assertTaskExecutionProfile } from '../execution-profiles/store.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AttemptView, ClaimResponse, Ownership, RegisterRunner, RunnerRegistration, HeartbeatResponse, DecisionAnswer } from '@flow/contracts';
import { HttpError, sha256, transaction } from '../database.js';
import { loadTask } from '../tasks.js';

export interface RunnerRecord { id: string; harnesses: string[]; capacity: number; revoked: boolean }
export interface AttemptRecord {
  id: string; task_id: string; runner_id: string; owner_version: number; lease_expires_at: Date;
  last_heartbeat_at: Date | null; last_event_at: Date | null;
  last_sequence: number; native_session_id: string | null; completed_at: Date | null;
}
export function attemptView(attempt: AttemptRecord): AttemptView {
  return { id: attempt.id, runnerId: attempt.runner_id, ownerVersion: attempt.owner_version, leaseExpiresAt: attempt.lease_expires_at.toISOString(),
    ...(attempt.native_session_id ? { nativeSessionId: attempt.native_session_id } : {}) };
}
export async function lockRunner(client: PoolClient, id: string): Promise<RunnerRecord> {
  const result = await client.query<RunnerRecord>('SELECT * FROM flow.runners WHERE id=$1 FOR UPDATE', [id]);
  const runner = result.rows[0];
  if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
  return runner;
}
export async function ownedAttempt(client: PoolClient, runnerId: string, ownership: Ownership) {
  await lockRunner(client, runnerId);
  const result = await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [ownership.attemptId]);
  const found = result.rows[0];
  if (!found || found.runner_id !== runnerId) throw new HttpError(403, 'attempt_forbidden', 'This attempt belongs to another runner.');
  const task = await loadTask(client, found.task_id, true);
  const attempt = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1 FOR UPDATE', [found.id])).rows[0]!;
  if (attempt.owner_version !== ownership.ownerVersion || task.current_attempt_id !== attempt.id || task.owner_version !== ownership.ownerVersion) throw new HttpError(409, 'stale_owner', 'Attempt ownership changed.');
  return { attempt, task };
}
export async function registerRunner(pool: Pool, input: RegisterRunner): Promise<RunnerRegistration> {
  const runnerId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,$2,$3,$4,$5)', [runnerId, input.name, sha256(token), input.harnesses, input.capacity ?? 1]);
  return { runnerId, token };
}
export async function claim(pool: Pool, runnerId: string, leaseMs: number): Promise<ClaimResponse> {
  return transaction(pool, async client => {
    const runner = await lockRunner(client, runnerId);
    const busy = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM flow.attempts WHERE runner_id=$1 AND completed_at IS NULL", [runnerId]);
    if (busy.rows[0]!.count >= runner.capacity) return { assignment: null, remainingLeaseMs: 0 };
    const result = await client.query<{ id: string }>(`
      SELECT t.id FROM flow.tasks t LEFT JOIN flow.sessions s ON s.id=t.submission->>'resumeSessionId' AND s.harness=t.submission->>'harness'
      WHERE t.status='queued' AND t.dispatch_ready AND t.submission->>'harness'=ANY($1)
      AND (t.submission->'executionProfile' IS NULL OR t.submission->'executionProfile'->>'runnerId'=$2)
      AND (t.submission->>'resumeSessionId' IS NULL OR (s.runner_id=$2 AND s.active_task_id IS NULL))
      ORDER BY t.created_at,t.id FOR UPDATE OF t SKIP LOCKED LIMIT 1`, [runner.harnesses, runnerId]);
    if (!result.rows[0]) return { assignment: null, remainingLeaseMs: 0 };
    const task = await loadTask(client, result.rows[0].id);
    await assertTaskExecutionProfile(client, task.submission);
    if (task.submission.resumeSessionId) {
      const session = await client.query('UPDATE flow.sessions SET active_task_id=$3 WHERE id=$1 AND harness=$2 AND runner_id=$4 AND active_task_id IS NULL RETURNING id', [task.submission.resumeSessionId, task.submission.harness, task.id, runnerId]);
      if (!session.rowCount) return { assignment: null, remainingLeaseMs: 0 };
    }
    const id = randomUUID();
    const inserted = await client.query<AttemptRecord>("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+$5 * interval '1 millisecond') RETURNING *", [id, task.id, runnerId, task.owner_version + 1, leaseMs]);
    await client.query("UPDATE flow.tasks SET status='running',current_attempt_id=$2,owner_version=owner_version+1,updated_at=clock_timestamp() WHERE id=$1", [task.id, id]);
    return { assignment: { attempt: attemptView(inserted.rows[0]!), task: { ...task.submission, id: task.id } }, remainingLeaseMs: leaseMs };
  });
}
export async function heartbeat(pool: Pool, runnerId: string, ownership: Ownership, leaseMs: number): Promise<HeartbeatResponse> {
  return transaction(pool, async client => {
    const { attempt, task } = await ownedAttempt(client, runnerId, ownership);
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!live || attempt.completed_at || task.status === 'uncertain') {
      if (!attempt.completed_at) await client.query("UPDATE flow.tasks SET status='uncertain',updated_at=clock_timestamp() WHERE id=$1 AND status<>'uncertain'", [task.id]);
      return { action: 'stop', leaseExpiresAt: attempt.lease_expires_at.toISOString(), remainingLeaseMs: 0, decision: null };
    }
    const updated = await client.query<AttemptRecord>("UPDATE flow.attempts SET last_heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+$2 * interval '1 millisecond' WHERE id=$1 RETURNING *", [attempt.id, leaseMs]);
    const answer = task.pending_decision ? undefined : (await client.query<{ id: string; answer: DecisionAnswer['answer'] }>('SELECT id,answer FROM flow.decisions WHERE task_id=$1 AND answer IS NOT NULL ORDER BY answered_at DESC LIMIT 1', [task.id])).rows[0];
    return { action: task.status === 'cancel_requested' ? 'cancel' : 'continue', leaseExpiresAt: updated.rows[0]!.lease_expires_at.toISOString(), remainingLeaseMs: leaseMs, decision: answer ? { decisionId: answer.id, answer: answer.answer } : null };
  });
}
export async function revoke(pool: Pool, runnerId: string): Promise<{ revoked: true }> {
  return transaction(pool, async client => {
    const runner = await client.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [runnerId]);
    if (!runner.rowCount) throw new HttpError(404, 'runner_not_found', 'Runner not found.');
    await client.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [runnerId]);
    await client.query("UPDATE flow.tasks t SET status='uncertain',updated_at=clock_timestamp() FROM flow.attempts a WHERE t.current_attempt_id=a.id AND a.runner_id=$1 AND a.completed_at IS NULL AND t.status IN ('running','waiting','cancel_requested')", [runnerId]);
    return { revoked: true };
  });
}
export async function expireLeases(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    const tasks = await client.query<{ id: string; current_attempt_id: string }>(`SELECT t.id,t.current_attempt_id FROM flow.tasks t JOIN flow.attempts a ON t.current_attempt_id=a.id
      WHERE a.completed_at IS NULL AND a.lease_expires_at<=clock_timestamp() AND t.status IN ('running','waiting','cancel_requested')
      ORDER BY a.lease_expires_at LIMIT 100 FOR UPDATE OF t SKIP LOCKED`);
    for (const task of tasks.rows) {
      // Re-read after the task lock: a concurrent heartbeat may have renewed the lease.
      const expired = await client.query('SELECT id FROM flow.attempts WHERE id=$1 AND completed_at IS NULL AND lease_expires_at<=clock_timestamp() FOR UPDATE', [task.current_attempt_id]);
      if (expired.rowCount) await client.query("UPDATE flow.tasks SET status='uncertain',updated_at=clock_timestamp() WHERE id=$1", [task.id]);
    }
  });
}
