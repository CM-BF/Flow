import type { PoolClient } from 'pg';
import { claudeTurnSettingsSchema } from '../../../../packages/contracts/src/claude-turn-settings.js';
import type { ConversationTurn } from '../../../../packages/contracts/src/conversations.js';
import { contextReferences } from '../conversation-context/store.js';
import { HttpError } from '../database.js';
import { summary, type TaskRecord } from '../tasks.js';
import { assistantProjections } from './replies.js';
import type { TurnRow } from './state.js';

/** At most 50 rows, in caller order. The caller owns this client's transaction/snapshot. */
export async function turnViews(client: PoolClient, rows: readonly TurnRow[], expectedHarness?: 'claude' | 'codex'): Promise<ConversationTurn[]> {
  if (rows.length > 50) throw new HttpError(400, 'conversation_turn_batch_limit', 'At most 50 turns can be read together.');
  if (!rows.length) return [];
  const taskRows = (await client.query<TaskRecord>('SELECT * FROM flow.tasks WHERE id=ANY($1::text[])', [[...new Set(rows.map(row => row.task_id))]])).rows;
  const byId = new Map(taskRows.map(task => [task.id, task]));
  const tasks = rows.map(row => {
    const task = byId.get(row.task_id);
    if (!task) throw new HttpError(404, 'not_found', 'Task not found.');
    if (expectedHarness && task.submission.harness !== expectedHarness) throw new HttpError(409, 'conversation_task_mismatch', 'A turn must retain its conversation harness.');
    return task;
  });
  const contexts = await contextReferences(client, rows.flatMap(row => row.conversation_input_id ? [row.conversation_input_id] : []));
  const projections = await assistantProjections(client, tasks);
  return rows.map((row, index) => {
    const task = tasks[index]!, context = row.conversation_input_id ? contexts.get(row.conversation_input_id) : undefined;
    return { id: row.id, conversationId: row.conversation_id, number: row.number, createdAt: row.created_at.toISOString(),
      ...(context ? { context } : {}), ...(task.submission.messageSettings ? { messageSettings: claudeTurnSettingsSchema.parse(task.submission.messageSettings) } : {}),
      user: { role: 'user', text: row.user_text }, task: summary(task), ...projections[index]!,
      telemetry: { kind: 'execution', taskId: task.id, title: 'Execution details' } };
  });
}
export async function turnView(client: PoolClient, row: TurnRow, expectedHarness?: 'claude' | 'codex'): Promise<ConversationTurn> {
  return (await turnViews(client, [row], expectedHarness))[0]!;
}
