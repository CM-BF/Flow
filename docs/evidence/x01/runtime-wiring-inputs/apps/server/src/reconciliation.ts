import { assertTaskExecutionProfile } from './execution-profiles/store.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { taskSubmissionSchema } from '@flow/contracts';
import type { Ownership, ReconciliationAudit, ReconciliationObservation, ReconciliationResolution, ReconciliationResult, ReconciliationRetry, ReconciliationRetryResult, ReconciliationState, ReconciliationView, Reference, RetryProvenance } from '@flow/contracts';
import { HttpError, transaction } from './database.js';
import { command, loadTask, summary, wake, type TaskRecord } from './tasks.js';
import { attemptView, type AttemptRecord } from './runners.js';
import { copyGoalRecoveryInput } from './goal-context/store.js';
import { copyRecoveryInput } from './conversation-context/store.js';
import { appendTimeline } from './timeline.js';

interface AuditRow {
  ordinal: string; id: string; task_id: string; attempt_id: string; actor: 'owner';
  action: ReconciliationAudit['action']; request: ReconciliationAudit['request'];
  before_state: ReconciliationState; after_state: ReconciliationState; created_at: Date;
}
function auditView(row: AuditRow): ReconciliationAudit {
  return { id: row.id, cursor: Number(row.ordinal), taskId: row.task_id, attemptId: row.attempt_id,
    actor: row.actor, action: row.action, request: row.request, before: row.before_state,
    after: row.after_state, createdAt: row.created_at.toISOString() } as ReconciliationAudit;
}
function state(task: TaskRecord): ReconciliationState {
  return { status: task.status, ownerVersion: task.owner_version };
}

export async function reconciliation(pool: Pool, taskId: string, after = 0): Promise<ReconciliationView> {
  return transaction(pool, async client => {
    const task = await loadTask(client, taskId);
    const attempt = task.current_attempt_id
      ? (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [task.current_attempt_id])).rows[0]
      : undefined;
    const evidence = (await client.query<{ reference: Reference }>(
      "SELECT entry->'reference' AS reference FROM flow.timeline WHERE task_id=$1 AND entry->>'kind'='reference' ORDER BY cursor DESC LIMIT 101", [taskId],
    )).rows;
    const rows = (await client.query<AuditRow>('SELECT * FROM flow.reconciliation_audit WHERE task_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 101', [taskId, after])).rows;
    const audit = rows.slice(0, 100).map(auditView);
    const provenance = (await client.query<RetryProvenance>(
      'SELECT source_task_id AS "taskId",source_attempt_id AS "attemptId",resolution_id AS "resolutionId",retry_audit_id AS "auditId" FROM flow.reconciliation_retries WHERE task_id=$1', [taskId],
    )).rows[0] ?? null;
    return {
      task: summary(task), attempt: attempt ? attemptView(attempt) : null,
      currentOwnerVersion: task.owner_version, reservationHeld: Boolean(attempt && !attempt.completed_at),
      lastSequence: attempt?.last_sequence ?? null,
      lastHeartbeatAt: attempt?.last_heartbeat_at?.toISOString() ?? null,
      lastEventAt: attempt?.last_event_at?.toISOString() ?? null,
      completedAt: attempt?.completed_at?.toISOString() ?? null,
      evidence: evidence.slice(0, 100).map(row => row.reference), evidenceHasMore: evidence.length > 100,
      audit, hasMore: rows.length > 100, nextCursor: rows.length > 100 ? audit.at(-1)!.cursor : null, provenance,
    };
  }, true);
}

/** Match the runner → task → attempt lock order used by reports and claims. */
async function lockExpectedAttempt(client: PoolClient, taskId: string, expected: Ownership) {
  const found = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [expected.attemptId])).rows[0];
  if (!found || found.task_id !== taskId) throw new HttpError(409, 'stale_owner', 'The expected attempt does not belong to this task.');
  // Revoked runners still need operator reconciliation; do not use credential validation here.
  await client.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [found.runner_id]);
  const task = await loadTask(client, taskId, true);
  const attempt = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1 FOR UPDATE', [found.id])).rows[0]!;
  if (task.current_attempt_id !== expected.attemptId || attempt.owner_version !== expected.ownerVersion) throw new HttpError(409, 'stale_owner', 'Attempt ownership changed.');
  return { task, attempt };
}
function requireUncertain(task: TaskRecord, attempt: AttemptRecord, expected: Ownership): void {
  if (task.owner_version !== expected.ownerVersion) throw new HttpError(409, 'stale_owner', 'Attempt ownership changed.');
  if (task.status !== 'uncertain' || attempt.completed_at) throw new HttpError(409, 'reconciliation_conflict', 'Only an unresolved uncertain attempt can be reconciled.');
}
async function appendAudit(client: PoolClient, task: TaskRecord, input: {
  id?: string; action: ReconciliationAudit['action']; request: ReconciliationAudit['request'];
  before: ReconciliationState; after: ReconciliationState;
}): Promise<ReconciliationAudit> {
  const row = (await client.query<AuditRow>(
    `INSERT INTO flow.reconciliation_audit(id,task_id,attempt_id,actor,action,request,before_state,after_state)
     VALUES($1,$2,$3,'owner',$4,$5,$6,$7) RETURNING *`,
    [input.id ?? randomUUID(), task.id, task.current_attempt_id, input.action, input.request, input.before, input.after],
  )).rows[0]!;
  return auditView(row);
}

export async function observeUncertain(pool: Pool, taskId: string, input: ReconciliationObservation, key: string): Promise<ReconciliationResult> {
  const result = await command(pool, `reconciliation:observation:${taskId}`, key, input, async client => {
    const { task, attempt } = await lockExpectedAttempt(client, taskId, input);
    requireUncertain(task, attempt, input);
    const audit = await appendAudit(client, task, { action: 'observation', request: input, before: state(task), after: state(task) });
    return { task: summary(task), audit };
  });
  return { ...result.value, replayed: result.replayed };
}

export async function resolveUncertain(pool: Pool, taskId: string, input: ReconciliationResolution, key: string): Promise<ReconciliationResult> {
  const result = await command(pool, `reconciliation:resolution:${taskId}`, key, input, async client => {
    const { task, attempt } = await lockExpectedAttempt(client, taskId, input);
    requireUncertain(task, attempt, input);
    const before = state(task);
    task.status = input.outcome;
    task.owner_version += 1;
    task.pending_decision = null;
    const audit = await appendAudit(client, task, { action: 'resolution', request: input, before, after: state(task) });
    await client.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE id=$1', [attempt.id]);
    await client.query('UPDATE flow.sessions SET active_task_id=NULL WHERE active_task_id=$1', [task.id]);
    await appendTimeline(client, task, { kind: 'text', text: `Operator recorded stop confirmation and reconciled this task as ${input.outcome}.` });
    await client.query('UPDATE flow.tasks SET status=$2,owner_version=$3,pending_decision=NULL,cursor=$4,updated_at=clock_timestamp() WHERE id=$1', [task.id, task.status, task.owner_version, task.cursor]);
    return { task: summary(await loadTask(client, taskId)), audit };
  });
  return { ...result.value, replayed: result.replayed };
}

export async function retryReconciled(pool: Pool, boss: PgBoss, taskId: string, input: ReconciliationRetry, key: string): Promise<ReconciliationRetryResult> {
  const result = await command(pool, `reconciliation:retry:${taskId}`, key, input, async client => {
    const { task, attempt } = await lockExpectedAttempt(client, taskId, input);
    // Generic recovery cannot discard frozen package identity or authorize another invocation.
    if ((await client.query('SELECT 1 FROM flow.plugin_tool_bindings WHERE task_id=$1', [taskId])).rowCount) {
      throw new HttpError(409, 'plugin_recovery_requires_binding', "Generic retry cannot preserve this plugin task's package and configuration. The original task is retained; automatic re-execution is blocked.");
    }

    const resolution = (await client.query<AuditRow>(
      "SELECT * FROM flow.reconciliation_audit WHERE id=$1 AND task_id=$2 AND attempt_id=$3 AND action='resolution'", [input.resolutionId, taskId, attempt.id],
    )).rows[0];
    if (!resolution || !attempt.completed_at || !['failed', 'cancelled'].includes(task.status)
      || resolution.before_state.ownerVersion !== input.ownerVersion || resolution.after_state.ownerVersion !== task.owner_version) {
      throw new HttpError(409, 'resolution_required', 'An audited stop resolution for this exact attempt is required before retry.');
    }
    if ((await client.query('SELECT 1 FROM flow.reconciliation_retries WHERE resolution_id=$1', [resolution.id])).rowCount) {
      throw new HttpError(409, 'resolution_already_retried', 'This resolution already created a retry task.');
    }
    const resolutionAudit = auditView(resolution);
    if (resolutionAudit.action !== 'resolution') throw new HttpError(409, 'resolution_required', 'A stop resolution is required.');
    const newTaskId = randomUUID();
    const auditId = randomUUID();
    const submission = recoverySubmission(task, resolutionAudit, input, auditId);
    if (submission.messageSettings) await assertTaskExecutionProfile(client, submission);
    await client.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [newTaskId, JSON.stringify(submission)]);
    await copyRecoveryInput(client, task.id, newTaskId, task.submission.prompt, submission.prompt);
    await copyGoalRecoveryInput(client, task.id, newTaskId, task.submission.prompt, submission.prompt);
    const audit = await appendAudit(client, task, { id: auditId, action: 'retry', request: input, before: state(task), after: { ...state(task), retryTaskId: newTaskId } });
    const provenance: RetryProvenance = { taskId, attemptId: attempt.id, resolutionId: resolution.id, auditId: audit.id };
    await client.query('INSERT INTO flow.reconciliation_retries(task_id,source_task_id,source_attempt_id,resolution_id,retry_audit_id) VALUES($1,$2,$3,$4,$5)', [newTaskId, taskId, attempt.id, resolution.id, audit.id]);
    await wake(boss, client, newTaskId);
    return { task: summary(await loadTask(client, newTaskId)), audit, provenance };
  });
  return { ...result.value, replayed: result.replayed };
}

function recoverySubmission(task: TaskRecord, resolution: Extract<ReconciliationAudit, { action: 'resolution' }>, input: ReconciliationRetry, auditId: string) {
  const safety = input.safety;
  if (safety.strategy === 'no-side-effects' && resolution.request.sideEffects !== 'none-confirmed') {
    throw new HttpError(409, 'revised_work_required', 'Known side effects require explicit instructions for remaining work.');
  }
  if (safety.strategy === 'revised-work' && safety.prompt.trim() === task.submission.prompt.trim()) {
    throw new HttpError(409, 'unchanged_recovery_work', 'Revised work must not repeat the original instructions unchanged.');
  }
  const instructions = safety.strategy === 'revised-work' ? safety.prompt : task.submission.prompt;
  const context = { sourceTaskId: task.id, sourceAttemptId: input.attemptId, resolutionId: resolution.id, retryAuditId: auditId,
    strategy: safety.strategy, sideEffects: resolution.request.sideEffects, effectsEvidence: resolution.request.effectsEvidence, safetyEvidence: safety.evidence };
  const prompt = `Recovery work instructions:\n${instructions}\n\nRecorded recovery context (owner assertion; not an automatic safety verification):\n${JSON.stringify(context, null, 2)}`;
  // Never silently truncate the evidence or implicitly resume the old native session.
  const { resumeSessionId: _resumeSessionId, ...original } = task.submission;
  const parsed = taskSubmissionSchema.safeParse({ ...original, prompt });
  if (!parsed.success) throw new HttpError(400, 'recovery_context_too_large', 'Recovery instructions and complete evidence must fit the task prompt limit. Shorten them without omitting known effects.');
  return parsed.data;
}
