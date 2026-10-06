import type { Pool } from 'pg';
import type { ConversationQueueItemDetail, ConversationQueuePage } from '../../../../packages/contracts/src/conversation-queue.js';
import { queueBlock } from './gate.js';
import { transaction } from '../database.js';
import { loadConversation } from '../conversations/state.js';
import { itemView, loadItem, type QueueRow } from './store.js';
export async function list(pool: Pool, conversationId: string, after: number, limit: number): Promise<ConversationQueuePage> {
  return transaction(pool, async client => {
    const conversation = await loadConversation(client, conversationId);
    const rows = (await client.query<QueueRow>("SELECT id,conversation_id,sequence,state,left(user_text,512) AS user_text,octet_length(user_text)>512 AS text_truncated,turn_id,task_id,turn_number,created_at,updated_at FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' AND sequence>$2 ORDER BY sequence LIMIT $3", [conversationId, after, limit + 1])).rows;
    const items = rows.slice(0, limit).map(itemView);
    return { conversationId, queueRevision: conversation.queue_revision, items, nextCursor: rows.length > limit ? items.at(-1)!.sequence : null, blocked: await queueBlock(client, conversation) };
  }, true);
}
export async function readItem(pool: Pool, conversationId: string, itemId: string): Promise<ConversationQueueItemDetail> {
  return transaction(pool, async client => {
    const conversation = await loadConversation(client, conversationId);
    const row = await loadItem(client, conversationId, itemId);
    return { conversationId, queueRevision: conversation.queue_revision, item: { ...itemView(row), text: row.user_text }, blocked: await queueBlock(client, conversation) };
  }, true);
}
