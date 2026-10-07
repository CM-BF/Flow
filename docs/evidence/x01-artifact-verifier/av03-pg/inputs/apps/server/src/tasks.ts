import { TASK_SUMMARY_COLUMNS, toTaskSummary, type TaskSummaryRow } from './task-read-projection.js';
import { legacyTimelineEntries } from './assistant-stream-compatibility/index.js';
import { assertTaskExecutionProfile } from './execution-profiles/store.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { AcceptedTask, TaskSubmission, TaskSummary, TaskSnapshot, UsageTotals, DecisionRequest, TimelineEntry, TaskList } from '@flow/contracts';
import { canonical, HttpError, sha256, transaction } from './database.js';
import { attemptView, type AttemptRecord } from './runners.js';

export interface TaskRecord {
  id: string; submission: TaskSubmission; status: TaskSummary['status']; verification_status: TaskSummary['verificationStatus'];
  created_at: Date; updated_at: Date; cursor: number; owner_version: number; current_attempt_id: string | null;
  pending_decision: DecisionRequest | null; usage: UsageTotals; latest_artifact_id: string | null; latest_artifact_version: string | null;
}
export function summary(task: TaskRecord): TaskSummary {
  return toTaskSummary({ id: task.id, title: task.submission.title, harness: task.submission.harness, status: task.status,
    verification_status: task.verification_status, created_at: task.created_at, updated_at: task.updated_at });
}
export async function loadTask(client: PoolClient, id: string, lock = false): Promise<TaskRecord> {
  const result = await client.query<TaskRecord>(`SELECT * FROM flow.tasks WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!result.rows[0]) throw new HttpError(404, 'not_found', 'Task not found.');
  return result.rows[0];
}
export async function command<T>(pool: Pool, operation: string, key: string, input: unknown, run: (client: PoolClient) => Promise<T>): Promise<{ value: T; replayed: boolean }> {
  return transaction(pool, client => commandInTransaction(client, operation, key, input, run));
}

/** Caller owns the transaction and must authorize before entering, including replays. */
export async function commandInTransaction<T>(client: PoolClient, operation: string, key: string, input: unknown, run: (client: PoolClient) => Promise<T>): Promise<{ value: T; replayed: boolean }> {
  if (!key || key.length > 200) throw new HttpError(400, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
  const digest = sha256(canonical(input));
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([operation, key])]);
  const previous = await client.query<{ digest: string; response: T }>('SELECT digest,response FROM flow.commands WHERE operation=$1 AND key=$2', [operation, key]);
  const saved = previous.rows[0];
  if (saved) {
    if (saved.digest !== digest) throw new HttpError(409, 'idempotency_conflict', 'This key was used for different content.');
    return { value: saved.response, replayed: true };
  }
  const value = await run(client);
  await client.query('INSERT INTO flow.commands(operation,key,digest,response) VALUES($1,$2,$3,$4)', [operation, key, digest, JSON.stringify(value)]);
  return { value, replayed: false };
}

export async function wake(boss: PgBoss, client: PoolClient, taskId: string): Promise<void> {
  const id = await boss.send('flow-wake', { taskId }, { db: { executeSql: (text, values) => client.query(text, values) } });
  if (!id) throw new Error('Task wake-up was not persisted.');
}
export async function acceptTask(client: PoolClient, boss: PgBoss, input: TaskSubmission, purpose: 'ordinary' | 'goal-tools' | 'goal-graph-tools' = 'ordinary'): Promise<TaskSummary> {
  await assertTaskExecutionProfile(client, input, purpose);
  if (input.resumeSessionId) {
    const session = await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2', [input.resumeSessionId, input.harness]);
    if (!session.rowCount) throw new HttpError(409, 'unknown_session', 'This session is not recorded for this harness.');
  }
  const id = randomUUID();
  await client.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [id, JSON.stringify(input)]);
  await wake(boss, client, id);
  return summary(await loadTask(client, id));
}
export async function submit(pool: Pool, boss: PgBoss, input: TaskSubmission, key: string): Promise<AcceptedTask> {
  const result = await command(pool, 'submit', key, input, client => acceptTask(client, boss, input));
  return { task: result.value, replayed: result.replayed };
}
export async function snapshot(pool: Pool, id: string): Promise<TaskSnapshot> {
  return transaction(pool, async client => {
    const task = await loadTask(client, id);
    const result = await client.query<{ entry: TimelineEntry }>('SELECT entry FROM flow.timeline WHERE task_id=$1 ORDER BY cursor DESC LIMIT 100', [id]);
    const attempt = task.current_attempt_id ? (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [task.current_attempt_id])).rows[0] : undefined;
    return { ...summary(task), prompt: task.submission.prompt, entries: legacyTimelineEntries(result.rows.map(row => row.entry).reverse(), entry => entry), watermark: task.cursor,
      hasMore: task.cursor > result.rows.length, pendingDecision: task.pending_decision, attempt: attempt ? attemptView(attempt) : null, usage: task.usage };
  }, true);
}
export async function list(pool: Pool, limit: number, before?: string): Promise<TaskList> {
  let cursor: { date: string; id: string } | null = null;
  if (before) {
    if (before.length > 1024) throw new HttpError(400, 'invalid_cursor', 'Invalid task cursor.');
    try { cursor = JSON.parse(Buffer.from(before, 'base64url').toString()); } catch { throw new HttpError(400, 'invalid_cursor', 'Invalid task cursor.'); }
    if (!cursor || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 200 || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)) || new Date(cursor.date).toISOString() !== cursor.date) throw new HttpError(400, 'invalid_cursor', 'Invalid task cursor.');
  }
  const result = await pool.query<TaskSummaryRow>(`SELECT ${TASK_SUMMARY_COLUMNS} FROM flow.tasks WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1::timestamptz,$2)) ORDER BY created_at DESC,id DESC LIMIT $3`, [cursor?.date ?? null, cursor?.id ?? null, limit + 1]);
  const rows = result.rows.slice(0, limit);
  const last = rows.at(-1);
  return { tasks: rows.map(toTaskSummary), nextCursor: result.rows.length > limit && last ? Buffer.from(JSON.stringify({ date: last.created_at.toISOString(), id: last.id })).toString('base64url') : null };
}
