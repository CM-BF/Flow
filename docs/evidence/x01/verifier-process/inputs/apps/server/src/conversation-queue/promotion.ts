import type { Pool, PoolClient } from 'pg';
import type { TaskSubmission } from '@flow/contracts';
import type { PgBoss } from 'pg-boss';
import type { ConversationQueueAccepted, ConversationQueueBlockReason } from '../../../../packages/contracts/src/conversation-queue.js';
import { HttpError, transaction } from '../database.js';
import { loadConversation, type ConversationRow } from '../conversations/state.js';
import { acceptConversationTurn } from '../conversations/admission.js';
import { prepareQueueAdmission } from './gate.js';
import { advanceQueueRevision, contextualItemView, requireQueueRevision, firstWaiting, type QueueRow } from './store.js';
export type QueuePromotion = { outcome: 'promoted'; receipt: Omit<ConversationQueueAccepted, 'replayed'> } | { outcome: 'blocked'; conversationId: string; reason: ConversationQueueBlockReason } | { outcome: 'empty'; conversationId: string };
export interface QueueScanResult { inspected: number; promoted: number; blocked: number; errors: { conversationId: string; code: 'promotion_failed' }[] }
/** One FIFO item at most; conversation then task lock; all acceptance writes share one transaction. */
export async function promoteReady(pool: Pool, boss: PgBoss, conversationId: string): Promise<QueuePromotion> {
  return transaction(pool, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    if (conversation.queue_paused) return { outcome: 'blocked', conversationId, reason: 'queue-paused' };
    const first = await firstWaiting(client, conversationId);
    if (!first) return { outcome: 'empty', conversationId };
    const admission = await prepareQueueAdmission(client, conversation, first.user_text, true, first.message_settings ?? undefined);
    if (!admission.input) return { outcome: 'blocked', conversationId, reason: admission.blocked! };
    requireQueueRevision(conversation.queue_revision, conversation.queue_revision);
    const row = await promoteItem(client, boss, conversation, first, admission.input);
    return { outcome: 'promoted', receipt: { conversationId, queueRevision: await advanceQueueRevision(client, conversationId), item: await contextualItemView(client, row) } };
  });
}
/** Fair PG-backed rotation; caller serializes its interval and awaits it on shutdown. */
export async function scanConversationQueue(pool: Pool, boss: PgBoss, limit = 20): Promise<QueueScanResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'invalid_queue_scan_limit', 'Queue scan limit must be between 1 and 100.');
  // Commit rotation before processing so even an unexpected promotion rollback cannot starve later conversations.
  const candidates = await transaction(pool, async client => (await client.query<{ id: string }>(`WITH candidates AS (
    SELECT c.id FROM flow.conversations c WHERE NOT c.queue_paused AND EXISTS (SELECT 1 FROM flow.conversation_queue q WHERE q.conversation_id=c.id AND q.state='waiting')
    ORDER BY c.queue_checked_at,c.id LIMIT $1 FOR UPDATE OF c SKIP LOCKED
  ) UPDATE flow.conversations c SET queue_checked_at=clock_timestamp() FROM candidates picked WHERE c.id=picked.id RETURNING c.id`, [limit])).rows);
  const result: QueueScanResult = { inspected: candidates.length, promoted: 0, blocked: 0, errors: [] };
  for (const { id } of candidates) {
    try {
      const item = await promoteReady(pool, boss, id);
      if (item.outcome === 'promoted') result.promoted += 1;
      if (item.outcome === 'blocked') result.blocked += 1;
    } catch { result.errors.push({ conversationId: id, code: 'promotion_failed' }); }
  }
  return result;
}

/** Internal acceptance seam shared by automatic promotion and explicit resume. Caller owns the conversation lock. */
export async function promoteItem(client: PoolClient, boss: PgBoss, conversation: ConversationRow, item: QueueRow, input: TaskSubmission): Promise<QueueRow> {
  const accepted = await acceptConversationTurn(client, boss, conversation, input, item.conversation_input_id);
  return (await client.query<QueueRow>("UPDATE flow.conversation_queue SET state='promoted',task_id=$2,turn_id=$3,turn_number=$4,updated_at=clock_timestamp() WHERE id=$1 RETURNING *", [item.id, accepted.turn.task.id, accepted.turn.id, accepted.turn.number])).rows[0]!;
}
