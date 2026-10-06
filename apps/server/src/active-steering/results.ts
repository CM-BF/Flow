import type { PoolClient } from 'pg';
import { MAX_STEERING_RESULTS_PER_ATTEMPT, type SteeringResultObservation } from '../../../../packages/contracts/src/active-steering.js';
import { sha256 } from '../database.js';
import { commandInTransaction, type TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { appendAudit, conflict, control } from './storage.js';

export async function recordSteeringResult(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, result: SteeringResultObservation): Promise<void> {
  if (task.submission.harness !== 'claude' || result.nativeSessionId !== attempt.native_session_id) conflict('steering_identity', 'Result must match the recorded native session.');
  if ((await client.query('SELECT 1 FROM flow.steering_attempts WHERE attempt_id=$1 AND seal IS NOT NULL', [attempt.id])).rowCount) conflict('steering_sealed', 'A sealed attempt cannot observe another result.');
  await commandInTransaction(client, `steering.result:${attempt.id}`, result.sourceMessageId, result, async () => {
    const count = (await client.query<{ count: string }>("SELECT count(*) FROM flow.steering_audit WHERE attempt_id=$1 AND action='result-observed'", [attempt.id])).rows[0]!;
    if (Number(count.count) >= MAX_STEERING_RESULTS_PER_ATTEMPT) conflict('steering_result_limit', 'This attempt reached its bounded result limit.');
    await control(client, task.id, attempt.id);
    await appendAudit(client, task.id, attempt.id, null, 'result-observed', 'runner', result);
    return { recorded: true };
  });
}
export async function resultHistory(client: PoolClient, attemptId: string): Promise<SteeringResultObservation[]> {
  return (await client.query<{ data: SteeringResultObservation }>("SELECT data FROM flow.steering_audit WHERE attempt_id=$1 AND action='result-observed' ORDER BY ordinal", [attemptId])).rows.map(row => row.data);
}

/** A new steering-aware attempt cannot bypass the conditional endpoint via ordinary final reporting. */
export async function assertControlledFinal(client: PoolClient, attempt: AttemptRecord, final: { nativeSessionId: string; sourceMessageId: string; content: string }): Promise<void> {
  if (!(await client.query("SELECT to_regclass('flow.steering_attempts') AS relation")).rows[0]?.relation) return;
  const state = (await client.query('SELECT seal FROM flow.steering_attempts WHERE attempt_id=$1', [attempt.id])).rows[0];
  if (!state) return; // Existing, non-steering runners keep the previous path.
  const seal = state.seal?.final;
  if (!seal || seal.nativeSessionId !== final.nativeSessionId || seal.sourceMessageId !== final.sourceMessageId || seal.contentDigest !== sha256(final.content)) conflict('steering_final_unsealed', 'Controlled attempts must commit their final through conditional finalization.');
}
export async function closePendingSteering(client: PoolClient, task: TaskRecord, attempt: AttemptRecord): Promise<void> {
  if (!(await client.query("SELECT to_regclass('flow.steering_commands') AS relation")).rows[0]?.relation) return;
  const rows = (await client.query<{ id: string; status: string; receipt_revision: number }>("UPDATE flow.steering_commands SET status=CASE WHEN status='accepted' THEN 'rejected' ELSE 'unknown' END,receipt_revision=receipt_revision+1,updated_at=clock_timestamp() WHERE attempt_id=$1 AND status IN ('accepted','received') RETURNING id,status,receipt_revision", [attempt.id])).rows;
  for (const row of rows) await appendAudit(client, task.id, attempt.id, row.id, row.status, 'runner', { receiptRevision: row.receipt_revision, reason: 'Attempt ended before native consumption was confirmed.' });
}
