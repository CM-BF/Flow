import { claudeTurnSettingsSchema, type ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import type { PoolClient } from 'pg';
import { CONVERSATION_QUEUE_PREVIEW_BYTES, type ConversationQueueItem } from '../../../../packages/contracts/src/conversation-queue.js';
import type { ConversationQueueCurrentTurn } from '../../../../packages/contracts/src/conversation-queue.js';
import { lastTurn } from '../conversations/state.js';
import { loadTask } from '../tasks.js';
import { contextReference } from '../conversation-context/store.js';
import { HttpError } from '../database.js';

export interface QueueRow {
  id: string; conversation_id: string; sequence: number; state: ConversationQueueItem['state']; user_text: string;
  message_settings?: ClaudeTurnSettings | null;
  conversation_input_id?: string | null; turn_id: string | null; task_id: string | null; turn_number: number | null; text_truncated?: boolean; created_at: Date; updated_at: Date;
}
export function itemView(row: QueueRow): ConversationQueueItem {
  let preview = ''; let bytes = 0;
  for (const character of row.user_text) {
    bytes += Buffer.byteLength(character);
    if (bytes > CONVERSATION_QUEUE_PREVIEW_BYTES) break;
    preview += character;
  }
  return { ...(row.message_settings != null ? { messageSettings: claudeTurnSettingsSchema.parse(row.message_settings) } : {}), id: row.id, conversationId: row.conversation_id, sequence: row.sequence, state: row.state,
    preview, truncated: row.text_truncated ?? preview.length < row.user_text.length,
    promoted: row.state === 'promoted' ? { taskId: row.task_id!, turnId: row.turn_id!, turnNumber: row.turn_number! } : null,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function contextualItemView(client: PoolClient, row: QueueRow): Promise<ConversationQueueItem> {
  const context = await contextReference(client, row.conversation_input_id);
  return { ...itemView(row), ...(context ? { context } : {}) };
}
export async function loadItem(client: PoolClient, conversationId: string, itemId: string): Promise<QueueRow> {
  const row = (await client.query<QueueRow>('SELECT * FROM flow.conversation_queue WHERE conversation_id=$1 AND id=$2', [conversationId, itemId])).rows[0];
  if (!row) throw new HttpError(404, 'conversation_queue_item_not_found', 'Queue item not found in this conversation.');
  return row;
}
export function requireQueueRevision(actual: number, expected: number): void {
  if (actual !== expected) throw new HttpError(409, 'conversation_queue_revision_conflict', 'Refresh the queue before changing waiting items.');
  if (actual >= 2_147_483_646) throw new HttpError(409, 'conversation_queue_revision_exhausted', 'This conversation queue has reached its revision limit.');
}
export async function advanceQueueRevision(client: PoolClient, conversationId: string): Promise<number> {
  return (await client.query<{ queue_revision: number }>('UPDATE flow.conversations SET queue_revision=queue_revision+1 WHERE id=$1 RETURNING queue_revision', [conversationId])).rows[0]!.queue_revision;
}

export async function currentTurn(client: PoolClient, conversationId: string, lock = false): Promise<ConversationQueueCurrentTurn | null> {
  const turn = await lastTurn(client, conversationId);
  if (!turn) return null;
  const task = await loadTask(client, turn.task_id, lock);
  const item = (await client.query<{ id: string }>('SELECT id FROM flow.conversation_queue WHERE turn_id=$1', [turn.id])).rows[0];
  return { taskId: task.id, taskStatus: task.status, turnId: turn.id, turnNumber: turn.number, queueItemId: item?.id ?? null };
}

export async function firstWaiting(client: PoolClient, conversationId: string): Promise<QueueRow | undefined> {
  return (await client.query<QueueRow>("SELECT * FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' ORDER BY sequence LIMIT 1", [conversationId])).rows[0];
}
