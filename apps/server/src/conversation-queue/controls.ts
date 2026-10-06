import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { HttpError } from '../database.js';
import { prepareTurnAdmission, assertEmptyQueueResume } from '../conversations/admission.js';
import { promoteItem } from './promotion.js';
import { command } from '../tasks.js';
import { loadConversation } from '../conversations/state.js';
import { advanceQueueRevision, currentTurn, requireQueueRevision, firstWaiting, contextualItemView } from './store.js';
import type { ConversationQueuePause, ConversationQueuePaused, ConversationQueueResume, ConversationQueueResumed } from '../../../../packages/contracts/src/conversation-queue.js';
export async function pause(pool: Pool, conversationId: string, input: ConversationQueuePause, key: string): Promise<ConversationQueuePaused> {
  const result = await command(pool, 'conversation.queue.pause', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    requireQueueRevision(conversation.queue_revision, input.expectedQueueRevision);
    const turn = await currentTurn(client, conversationId, true);
    let queueRevision = conversation.queue_revision;
    if (!conversation.queue_paused) {
      await client.query('UPDATE flow.conversations SET queue_paused=true WHERE id=$1', [conversationId]);
      queueRevision = await advanceQueueRevision(client, conversationId);
    }
    return { conversationId, queueRevision, paused: true as const, currentTurn: turn };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function resume(pool: Pool, boss: PgBoss, conversationId: string, input: ConversationQueueResume, key: string): Promise<ConversationQueueResumed> {
  const result = await command(pool, 'conversation.queue.resume', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    requireQueueRevision(conversation.queue_revision, input.expectedQueueRevision);
    const turn = await currentTurn(client, conversationId, true);
    if ((turn?.taskId ?? null) !== input.expectedTaskId) throw new HttpError(409, 'conversation_queue_task_conflict', 'The latest task changed. Refresh before continuing.');
    const first = await firstWaiting(client, conversationId);
    const admission = first ? await prepareTurnAdmission(client, conversation, first.user_text, 'explicit-queue', true, first.message_settings ?? undefined) : null;
    if (!first) await assertEmptyQueueResume(client, conversation);
    const promoted = first && admission ? await contextualItemView(client, await promoteItem(client, boss, conversation, first, admission)) : null;
    await client.query('UPDATE flow.conversations SET queue_paused=false WHERE id=$1', [conversationId]);
    const queueRevision = await advanceQueueRevision(client, conversationId);
    return { conversationId, queueRevision, paused: false as const, currentTurn: await currentTurn(client, conversationId), promoted };
  });
  return { ...result.value, replayed: result.replayed };
}
