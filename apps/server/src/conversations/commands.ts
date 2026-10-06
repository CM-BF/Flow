import { requireExecutionProfile } from '../execution-profiles/store.js';
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
    const requestedModelSupported = input.requested.model === 'runner-default' || input.requested.model === profile?.configuration.model;
    const requestedToolsSupported = input.requested.tools === 'configured-readonly' || profile?.configuration.access === 'none';
    if (!requestedModelSupported || input.requested.thinking !== 'disabled' || !requestedToolsSupported) {
      throw new HttpError(409, 'conversation_settings_unsupported', 'The selected configuration cannot fulfill these requested controls.');
    }
    const id = randomUUID();
    if (profile) await client.query('INSERT INTO flow.conversations(id,title,harness,requested,execution_profile) VALUES($1,$2,$3,$4,$5)', [id, input.title, input.harness, input.requested, profile.reference]);
    else await client.query('INSERT INTO flow.conversations(id,title,harness,requested) VALUES($1,$2,$3,$4)', [id, input.title, input.harness, input.requested]);
    return { conversation: conversationView(await loadConversation(client, id)), capabilities };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function admitTurn(pool: Pool, boss: PgBoss, conversationId: string, input: ConversationTurnAdmission, key: string): Promise<ConversationTurnAccepted> {
  const result = await command(pool, 'conversation.turn', key, { conversationId, ...input }, async client => {
    const conversation = await loadConversation(client, conversationId, true);
    if (input.mode !== 'follow-up') throw new HttpError(409, 'conversation_mode_unsupported', 'Use the dedicated queue command; steering is not available.');
    if (input.expectedRevision !== conversation.revision) throw new HttpError(409, 'conversation_revision_conflict', 'Refresh the conversation before sending another turn.');
    if ((await client.query("SELECT 1 FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' LIMIT 1", [conversationId])).rowCount) {
      throw new HttpError(409, 'conversation_queue_pending', 'Waiting queue items must be processed or cancelled before a follow-up.');
    }
    return acceptConversationTurn(client, boss, conversation, await prepareTurnAdmission(client, conversation, input.text, false));
  });
  return { ...result.value, replayed: result.replayed };
}
