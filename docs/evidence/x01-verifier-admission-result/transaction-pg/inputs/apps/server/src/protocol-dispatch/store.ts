import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ProtocolPrepare, ProtocolIntent, ProtocolState, ProtocolCommand, ProtocolBind, ProtocolUncertain, ProtocolRecoverResponse, ProtocolDispatchPermit, ProtocolArtifactReceipt } from '@flow/contracts';
import { transaction, HttpError } from '../database.js';
import { ownedAttempt, lockRunner, attemptView, type AttemptRecord } from '../runners.js';
import { loadTask, type TaskRecord } from '../tasks.js';
import { appendTimeline } from '../timeline.js';

interface IntentRow {
  task_id: string; attempt_id: string; owner_version: number; endpoint_ref: string; endpoint_digest: string; command_id: string;
  phase: ProtocolIntent['phase']; remote_task_id: string | null; cancel_started: boolean;
  reason: ProtocolIntent['reason']; created_at: Date; updated_at: Date;
}
function view(row: IntentRow): ProtocolIntent {
  return { taskId: row.task_id, attemptId: row.attempt_id, ownerVersion: row.owner_version, endpointRef: row.endpoint_ref, endpointDigest: row.endpoint_digest,
    commandId: row.command_id, phase: row.phase, remoteTaskId: row.remote_task_id, cancelStarted: row.cancel_started,
    reason: row.reason, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
async function intentFor(client: PoolClient, attemptId: string) {
  return (await client.query<IntentRow>('SELECT * FROM flow.protocol_intents WHERE attempt_id=$1', [attemptId])).rows[0];
}
async function remainingLease(client: PoolClient, attempt: AttemptRecord): Promise<number> {
  return Number((await client.query<{ remaining: number }>('SELECT GREATEST(0,FLOOR(EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp()))*1000))::integer remaining', [attempt.lease_expires_at])).rows[0]!.remaining);
}
async function requireLive(client: PoolClient, task: TaskRecord, attempt: AttemptRecord) {
  if (task.submission.harness !== 'a2a' || !task.submission.protocol) throw new HttpError(409, 'not_protocol_task', 'This attempt is not an A2A dispatch.');
  if (attempt.completed_at || !['running', 'waiting', 'cancel_requested'].includes(task.status) || await remainingLease(client, attempt) <= 0) throw new HttpError(409, 'stale_owner', 'Only a live current attempt can dispatch or recover.');
}
async function state(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, intent: IntentRow): Promise<ProtocolState> {
  const rows = await client.query<{ artifact_id: string; version: string; detail_id: string; title: string; verified: boolean }>(`SELECT a.artifact_id,a.version,a.detail_id,d.title,
    EXISTS(SELECT 1 FROM flow.details v WHERE v.attempt_id=a.attempt_id AND v.kind='verification'
      AND (CASE WHEN v.kind='verification' THEN v.content::jsonb END)->>'artifactId'=a.artifact_id
      AND (CASE WHEN v.kind='verification' THEN v.content::jsonb END)->>'artifactVersion'=a.version) verified
    FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id WHERE a.attempt_id=$1 ORDER BY a.artifact_id,a.version LIMIT 201`, [attempt.id]);
  if (rows.rows.length > 200) throw new HttpError(409, 'protocol_artifact_budget', 'Artifact receipt budget exceeded.');
  const artifacts: ProtocolArtifactReceipt[] = rows.rows.map(row => ({ artifactId: row.artifact_id, version: row.version, verified: row.verified, reference: { id: row.detail_id, title: row.title } }));
  return { intent: view(intent), taskStatus: task.status, lastSequence: attempt.last_sequence, remainingLeaseMs: await remainingLease(client, attempt), artifacts };
}
export function protocolState(pool: Pool, taskId: string): Promise<ProtocolState | null> {
  return transaction(pool, async client => {
    const task = await loadTask(client, taskId);
    if (!task.current_attempt_id) return null;
    const intent = await intentFor(client, task.current_attempt_id);
    if (!intent) return null;
    const attempt = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [task.current_attempt_id])).rows[0]!;
    return state(client, task, attempt, intent);
  }, true);
}
export function prepare(pool: Pool, runnerId: string, input: ProtocolPrepare): Promise<ProtocolState> {
  return transaction(pool, async client => {
    const { task, attempt } = await ownedAttempt(client, runnerId, input);
    await requireLive(client, task, attempt);
    let intent = await intentFor(client, attempt.id);
    if (!intent) intent = (await client.query<IntentRow>(`INSERT INTO flow.protocol_intents(task_id,attempt_id,owner_version,endpoint_ref,endpoint_digest,command_id,phase)
      VALUES($1,$2,$3,$4,$5,$6,'prepared') RETURNING *`, [task.id, attempt.id, input.ownerVersion, task.submission.protocol!.endpointRef, input.endpointDigest, randomUUID()])).rows[0]!;
    if (intent.endpoint_digest !== input.endpointDigest) throw new HttpError(409, 'protocol_endpoint_changed', 'The endpoint identity changed; reconcile the existing binding before changing configuration.');
    return state(client, task, attempt, intent);
  });
}
async function mutate<T>(pool: Pool, runnerId: string, input: ProtocolCommand, action: (client: PoolClient, task: TaskRecord, attempt: AttemptRecord, intent: IntentRow) => Promise<T>) {
  return transaction(pool, async client => {
    const { task, attempt } = await ownedAttempt(client, runnerId, input);
    await requireLive(client, task, attempt);
    const intent = await intentFor(client, attempt.id);
    if (!intent || intent.command_id !== input.commandId || intent.owner_version !== input.ownerVersion) throw new HttpError(409, 'protocol_command_conflict', 'Protocol intent does not match this command.');
    return action(client, task, attempt, intent);
  });
}
export function begin(pool: Pool, runnerId: string, input: ProtocolCommand, cancellation = false): Promise<ProtocolDispatchPermit> {
  return mutate(pool, runnerId, input, async (client, task, attempt, intent) => {
    if (cancellation && (intent.phase !== 'bound' || task.status !== 'cancel_requested')) throw new HttpError(409, 'protocol_cancel_conflict', 'A bound task with an active cancellation request is required.');
    const maySend = cancellation ? !intent.cancel_started : intent.phase === 'prepared' && task.status === 'running';
    if (maySend) intent = (await client.query<IntentRow>(cancellation
      ? 'UPDATE flow.protocol_intents SET cancel_started=true,updated_at=clock_timestamp() WHERE attempt_id=$1 RETURNING *'
      : "UPDATE flow.protocol_intents SET phase='sending',updated_at=clock_timestamp() WHERE attempt_id=$1 RETURNING *", [attempt.id])).rows[0]!;
    return { state: await state(client, task, attempt, intent), maySend };
  });
}
export function bind(pool: Pool, runnerId: string, input: ProtocolBind): Promise<ProtocolState> {
  return mutate(pool, runnerId, input, async (client, task, attempt, intent) => {
    if (!['sending', 'bound'].includes(intent.phase) || (intent.remote_task_id && intent.remote_task_id !== input.remoteTaskId)) throw new HttpError(409, 'protocol_binding_conflict', 'Remote binding cannot be replaced.');
    intent = (await client.query<IntentRow>("UPDATE flow.protocol_intents SET phase='bound',remote_task_id=$2,updated_at=clock_timestamp() WHERE attempt_id=$1 RETURNING *", [attempt.id, input.remoteTaskId])).rows[0]!;
    return state(client, task, attempt, intent);
  });
}
async function markUncertain(client: PoolClient, task: TaskRecord, intent: IntentRow, reason: ProtocolUncertain['reason']) {
  task.status = 'uncertain';
  await appendTimeline(client, task, { kind: 'text', text: `Remote dispatch outcome is uncertain (${reason}). Automatic resend is disabled.` });
  await client.query("UPDATE flow.tasks SET status='uncertain',cursor=$2,updated_at=clock_timestamp() WHERE id=$1", [task.id, task.cursor]);
  return (await client.query<IntentRow>("UPDATE flow.protocol_intents SET phase='uncertain',reason=$2,updated_at=clock_timestamp() WHERE attempt_id=$1 RETURNING *", [intent.attempt_id, reason])).rows[0]!;
}
export function uncertain(pool: Pool, runnerId: string, input: ProtocolUncertain): Promise<ProtocolState> {
  return mutate(pool, runnerId, input, async (client, task, attempt, intent) => state(client, task, attempt, await markUncertain(client, task, intent, input.reason)));
}
export function recover(pool: Pool, runnerId: string): Promise<ProtocolRecoverResponse> {
  return transaction(pool, async client => {
    await lockRunner(client, runnerId);
    const attempts = (await client.query<AttemptRecord>(`SELECT a.* FROM flow.attempts a JOIN flow.tasks t ON t.current_attempt_id=a.id
      WHERE a.runner_id=$1 AND a.completed_at IS NULL AND a.lease_expires_at>clock_timestamp()
      AND t.status IN ('running','waiting','cancel_requested') AND t.submission->>'harness'='a2a' ORDER BY a.id LIMIT 16`, [runnerId])).rows;
    const assignments: ProtocolRecoverResponse['assignments'] = [];
    for (const found of attempts) {
      const { task, attempt } = await ownedAttempt(client, runnerId, { attemptId: found.id, ownerVersion: found.owner_version });
      await requireLive(client, task, attempt);
      const intent = await intentFor(client, attempt.id);
      if (intent?.phase === 'sending' && !intent.remote_task_id) { await markUncertain(client, task, intent, 'recovered-inflight-send'); continue; }
      if (intent?.phase === 'uncertain') continue;
      assignments.push({ assignment: { task: { ...task.submission, id: task.id }, attempt: attemptView(attempt) }, lastSequence: attempt.last_sequence, remainingLeaseMs: await remainingLease(client, attempt) });
    }
    return { assignments };
  });
}
