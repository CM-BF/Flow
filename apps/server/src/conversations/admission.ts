import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { TaskSubmission } from '@flow/contracts';
import type { ConversationTurnAccepted } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';
import { assertTaskExecutionProfile } from '../execution-profiles/store.js';
import { acceptTask, loadTask } from '../tasks.js';
import { sessionEvidence } from './replies.js';
import { conversationView, lastTurn, loadConversation, turnView, type ConversationRow, type TurnRow } from './state.js';

/** Caller owns the conversation lock for admission; reads use a repeatable read snapshot. */
export async function prepareTurnAdmission(client: PoolClient, conversation: ConversationRow, text: string, automatic: boolean, lock = true): Promise<TaskSubmission> {
  if (conversation.revision >= 2_147_483_646) throw new HttpError(409, 'conversation_revision_exhausted', 'Conversation turn limit reached.');
  const previous = await lastTurn(client, conversation.id);
  let resumeSessionId: string | undefined;
  if (previous) {
    const task = await loadTask(client, previous.task_id, lock);
    if (automatic && ['failed', 'cancelled', 'uncertain'].includes(task.status)) {
      throw new HttpError(409, `conversation_previous_${task.status}`, 'Automatic queue promotion requires a successful previous turn.');
    }
    if (!(automatic ? ['succeeded'] : ['succeeded', 'failed', 'cancelled']).includes(task.status)) {
      throw new HttpError(409, 'conversation_busy', 'The previous turn is still active or uncertain.');
    }
    const session = await sessionEvidence(client, task);
    if (!session?.knownAdapter) throw new HttpError(409, 'conversation_resume_unavailable', 'The previous turn has no supported native session. Start a separate conversation.');
    if (session.activeTaskId) throw new HttpError(409, automatic ? 'conversation_session_busy' : 'conversation_busy', 'The native session is still occupied.');
    resumeSessionId = session.identity.nativeSessionId;
  }
  const input: TaskSubmission = { title: conversation.title, harness: 'claude', prompt: text,
    ...(conversation.execution_profile ? { executionProfile: conversation.execution_profile } : {}), ...(resumeSessionId ? { resumeSessionId } : {}) };
  await assertTaskExecutionProfile(client, input);
  return input;
}
/** Task, wake-up, immutable turn and admission revision share the caller's transaction. */
export async function acceptConversationTurn(client: PoolClient, boss: PgBoss, conversation: ConversationRow, input: TaskSubmission): Promise<Omit<ConversationTurnAccepted, 'replayed'>> {
  const task = await acceptTask(client, boss, input);
  const row = (await client.query<TurnRow>('INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text) VALUES($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), conversation.id, conversation.revision + 1, task.id, input.prompt])).rows[0]!;
  await client.query('UPDATE flow.conversations SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1', [conversation.id]);
  return { conversation: conversationView(await loadConversation(client, conversation.id)), turn: await turnView(client, row) };
}
