import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { TERMINAL_STATUSES, type DecisionAnswer, type TaskSummary } from '@flow/contracts';
import { HttpError } from './database.js';
import { command, loadTask, summary, wake } from './tasks.js';
import { appendTimeline } from './timeline.js';

export async function decide(pool: Pool, boss: PgBoss, id: string, input: DecisionAnswer, key: string): Promise<TaskSummary> {
  const result = await command(pool, `decision:${id}`, key, input, async client => {
    const task = await loadTask(client, id, true);
    if (task.status !== 'waiting' || task.pending_decision?.id !== input.decisionId) throw new HttpError(409, 'decision_not_pending', 'This decision is no longer pending.');
    const attempt = await client.query('SELECT id FROM flow.attempts WHERE id=$1 AND completed_at IS NULL AND lease_expires_at>clock_timestamp() FOR UPDATE', [task.current_attempt_id]);
    if (!attempt.rowCount) throw new HttpError(409, 'stale_owner', 'This decision belongs to an expired attempt.');
    await client.query('UPDATE flow.decisions SET answer=$3,answered_at=clock_timestamp() WHERE task_id=$1 AND id=$2', [id, input.decisionId, input.answer]);
    await client.query("UPDATE flow.tasks SET status='running',pending_decision=NULL,updated_at=clock_timestamp() WHERE id=$1", [id]);
    await wake(boss, client, id);
    return summary(await loadTask(client, id));
  });
  return result.value;
}
export async function cancel(pool: Pool, boss: PgBoss, id: string, key: string): Promise<TaskSummary> {
  const result = await command(pool, `cancel:${id}`, key, {}, async client => {
    const task = await loadTask(client, id, true);
    if (TERMINAL_STATUSES.includes(task.status) || task.status === 'uncertain' || task.status === 'cancel_requested') return summary(task);
    const status = task.current_attempt_id ? 'cancel_requested' : 'cancelled';
    await appendTimeline(client, task, { kind: 'text', text: task.current_attempt_id ? 'Cancellation requested.' : 'Cancelled before execution.' });
    await client.query('UPDATE flow.tasks SET status=$2,cursor=$3,updated_at=clock_timestamp() WHERE id=$1', [id, status, task.cursor]);
    await wake(boss, client, id);
    return summary(await loadTask(client, id));
  });
  return result.value;
}
