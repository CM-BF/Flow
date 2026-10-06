import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { ConversationCreated, ConversationCreation, ConversationTurnAccepted, ConversationTurnAdmission } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';
import { acceptTask, command, loadTask } from '../tasks.js';
import { sessionEvidence } from './replies.js';
import { capabilities, conversationView, loadConversation, lastTurn, turnView, type TurnRow } from './state.js';

export async function createConversation(pool: Pool, input: ConversationCreation, key: string): Promise<ConversationCreated> {
  const result = await command(pool, 'conversation.create', key, input, async client => {
    if (input.requested.model !== 'runner-default' || input.requested.thinking !== 'disabled' || input.requested.tools !== 'configured-readonly') {
      throw new HttpError(409, 'conversation_settings_unsupported', 'Per-conversation model, thinking and tool overrides are not supported by this adapter.');
    }
    const id = randomUUID();
    await client.query('INSERT INTO flow.conversations(id,title,harness,requested) VALUES($1,$2,$3,$4)', [id, input.title, input.harness, input.requested]);
    return { conversation: conversationView(await loadConversation(client, id)), capabilities };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function admitTurn(pool: Pool, boss: PgBoss, conversationId: string, input: ConversationTurnAdmission, key: string): Promise<ConversationTurnAccepted> {
  const result = await command(pool, 'conversation.turn', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    if (input.mode !== 'follow-up') throw new HttpError(409, 'conversation_mode_unsupported', 'Queue and steer require durable control support and are not available.');
    if (input.expectedRevision !== conversation.revision) throw new HttpError(409, 'conversation_revision_conflict', 'Refresh the conversation before sending another turn.');
    let resumeSessionId: string | undefined;
    const previous = await lastTurn(client, conversationId);
    if (previous) {
      const task = await loadTask(client, previous.task_id, true);
      if (!['succeeded', 'failed', 'cancelled'].includes(task.status)) throw new HttpError(409, 'conversation_busy', 'The previous turn is still active or uncertain.');
      const session = await sessionEvidence(client, task);
      if (!session?.knownAdapter) throw new HttpError(409, 'conversation_resume_unavailable', 'The previous turn has no supported native session. Start a separate conversation.');
      if (session.activeTaskId) throw new HttpError(409, 'conversation_busy', 'The native session is still occupied.');
      resumeSessionId = session.identity.nativeSessionId;
    }
    const task = await acceptTask(client, boss, { title: conversation.title, harness: 'claude', prompt: input.text, ...(resumeSessionId ? { resumeSessionId } : {}) });
    const row = (await client.query<TurnRow>('INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text) VALUES($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), conversationId, conversation.revision + 1, task.id, input.text])).rows[0]!;
    await client.query('UPDATE flow.conversations SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1', [conversationId]);
    return { conversation: conversationView(await loadConversation(client, conversationId)), turn: await turnView(client, row) };
  });
  return { ...result.value, replayed: result.replayed };
}
