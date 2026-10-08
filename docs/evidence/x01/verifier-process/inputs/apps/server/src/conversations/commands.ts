import { assertConversationProfile } from './policy.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import { freezeContext } from '../conversation-context/store.js';
import { loadProject } from '../projects/storage.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { ConversationCreated, ConversationCreation, ConversationTurnAccepted, ConversationTurnAdmission } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';
import { command } from '../tasks.js';
import { acceptConversationTurn, prepareTurnAdmission } from './admission.js';
import { capabilities, conversationView, loadConversation } from './state.js';

export async function createConversation(pool: Pool, input: ConversationCreation, key: string): Promise<ConversationCreated> {
  const result = await command(pool, 'conversation.create', key, input, async client => {
    const profile = input.executionProfile ? await requireExecutionProfile(client, input.executionProfile) : undefined;
    if (profile && profile.configuration.harness !== input.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The selected profile does not support this conversation harness.');
    assertConversationProfile(input, profile);
    const id = randomUUID();
    if (input.projectId) await loadProject(client, input.projectId);
    await client.query('INSERT INTO flow.conversations(id,title,harness,requested,execution_profile,project_id) VALUES($1,$2,$3,$4,$5,$6)', [id, input.title, input.harness, input.requested, profile?.reference ?? null, input.projectId ?? null]);
    return { conversation: conversationView(await loadConversation(client, id)), capabilities };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function admitTurn(pool: Pool, boss: PgBoss, conversationId: string, input: ConversationTurnAdmission, key: string): Promise<ConversationTurnAccepted> {
  const result = await command(pool, 'conversation.turn', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    if (input.mode !== 'follow-up') throw new HttpError(409, 'conversation_mode_unsupported', 'Use the dedicated queue command; steering is not available.');
    if (input.expectedRevision !== conversation.revision) throw new HttpError(409, 'conversation_revision_conflict', 'Refresh the conversation before sending another turn.');
    if (conversation.queue_paused) throw new HttpError(409, 'conversation_queue_paused', 'Resume this conversation queue before sending a follow-up.');
    if ((await client.query("SELECT 1 FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' LIMIT 1", [conversationId])).rowCount) {
      throw new HttpError(409, 'conversation_queue_pending', 'Waiting queue items must be processed or cancelled before a follow-up.');
    }
    const admission = await prepareTurnAdmission(client, conversation, input.text, 'follow-up', true, input.messageSettings);
    const contextInputId = await freezeContext(client, conversationId, conversation.project_id, input.text, input.knowledge, input.attachments);
    return acceptConversationTurn(client, boss, conversation, admission, contextInputId);
  });
  return { ...result.value, replayed: result.replayed };
}
