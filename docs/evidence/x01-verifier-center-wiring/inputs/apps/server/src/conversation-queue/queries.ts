import type { Pool } from 'pg';
import type { ConversationQueueItemDetail, ConversationQueuePage } from '../../../../packages/contracts/src/conversation-queue.js';
import { contextReferences } from '../conversation-context/store.js';
import { queueBlock } from './gate.js';
import { transaction } from '../database.js';
import { loadConversation } from '../conversations/state.js';
import { itemView, contextualItemView, loadItem, currentTurn, type QueueRow } from './store.js';
export async function list(pool: Pool, conversationId: string, after: number, limit: number): Promise<ConversationQueuePage> {
  return transaction(pool, async client => {
    const conversation = await loadConversation(client, conversationId);
    const rows = (await client.query<QueueRow>("SELECT id,conversation_id,conversation_input_id,message_settings,sequence,state,left(user_text,512) AS user_text,octet_length(user_text)>512 AS text_truncated,turn_id,task_id,turn_number,created_at,updated_at FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' AND sequence>$2 ORDER BY sequence LIMIT $3", [conversationId, after, limit + 1])).rows;
    const selected = rows.slice(0, limit);
    const contexts = await contextReferences(client, selected.flatMap(row => row.conversation_input_id ? [row.conversation_input_id] : []));
    const items = selected.map(row => { const context = contexts.get(row.conversation_input_id ?? ''); return { ...itemView(row), ...(context ? { context } : {}) }; });
    return { conversationId, queueRevision: conversation.queue_revision, items, nextCursor: rows.length > limit ? items.at(-1)!.sequence : null, blocked: await queueBlock(client, conversation), paused: conversation.queue_paused, currentTurn: await currentTurn(client, conversationId) };
  }, true);
}
export async function readItem(pool: Pool, conversationId: string, itemId: string): Promise<ConversationQueueItemDetail> {
  return transaction(pool, async client => {
    const conversation = await loadConversation(client, conversationId);
    const row = await loadItem(client, conversationId, itemId);
    return { conversationId, queueRevision: conversation.queue_revision, item: { ...await contextualItemView(client, row), text: row.user_text }, blocked: await queueBlock(client, conversation), paused: conversation.queue_paused, currentTurn: await currentTurn(client, conversationId) };
  }, true);
}
