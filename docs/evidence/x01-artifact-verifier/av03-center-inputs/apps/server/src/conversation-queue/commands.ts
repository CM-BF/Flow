import { assertQueuedMessageSettings } from '../execution-profiles/store.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { CONVERSATION_QUEUE_MAX_PENDING, type ConversationQueueAccepted, type ConversationQueueCancelled, type ConversationQueueEnqueue, type ConversationQueueCancel } from '../../../../packages/contracts/src/conversation-queue.js';
import { HttpError } from '../database.js';
import { command } from '../tasks.js';
import { freezeContext } from '../conversation-context/store.js';
import { loadConversation } from '../conversations/state.js';
import { advanceQueueRevision, contextualItemView, loadItem, requireQueueRevision, type QueueRow } from './store.js';

export async function enqueue(pool: Pool, conversationId: string, input: ConversationQueueEnqueue, key: string): Promise<ConversationQueueAccepted> {
  const result = await command(pool, 'conversation.queue.enqueue', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    requireQueueRevision(conversation.queue_revision, input.expectedQueueRevision);
    const pending = (await client.query('SELECT id FROM flow.conversation_queue WHERE conversation_id=$1 AND state=\'waiting\' LIMIT $2', [conversationId, CONVERSATION_QUEUE_MAX_PENDING])).rowCount!;
    if (pending >= CONVERSATION_QUEUE_MAX_PENDING) throw new HttpError(409, 'conversation_queue_full', 'Cancel a waiting item before adding more.');
    // No future native session is guessed at enqueue time; promotion rechecks the frozen request.
    await assertQueuedMessageSettings(client, { title: conversation.title, prompt: input.text, harness: conversation.harness,
      ...(conversation.execution_profile ? { executionProfile: conversation.execution_profile } : {}),
      ...(input.messageSettings ? { messageSettings: input.messageSettings } : {}) });
    const inputId = await freezeContext(client, conversationId, conversation.project_id, input.text, input.knowledge, input.attachments);
    const queueRevision = await advanceQueueRevision(client, conversationId);
    const row = (await client.query<QueueRow>('INSERT INTO flow.conversation_queue(id,conversation_id,sequence,user_text,conversation_input_id,message_settings) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), conversationId, queueRevision, input.text, inputId, input.messageSettings ?? null])).rows[0]!;
    return { conversationId, queueRevision, item: await contextualItemView(client, row) };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function cancel(pool: Pool, conversationId: string, itemId: string, input: ConversationQueueCancel, key: string): Promise<ConversationQueueCancelled> {
  const result = await command(pool, 'conversation.queue.cancel', key, { conversationId, itemId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    const row = await loadItem(client, conversationId, itemId);
    if (row.state !== 'waiting') return { conversationId, queueRevision: conversation.queue_revision, item: await contextualItemView(client, row), outcome: row.state === 'promoted' ? 'already-promoted' as const : 'already-cancelled' as const };
    requireQueueRevision(conversation.queue_revision, input.expectedQueueRevision);
    const cancelled = (await client.query<QueueRow>("UPDATE flow.conversation_queue SET state='cancelled',updated_at=clock_timestamp() WHERE id=$1 RETURNING *", [itemId])).rows[0]!;
    return { conversationId, queueRevision: await advanceQueueRevision(client, conversationId), item: await contextualItemView(client, cancelled), outcome: 'cancelled' as const };
  });
  return { ...result.value, replayed: result.replayed };
}
