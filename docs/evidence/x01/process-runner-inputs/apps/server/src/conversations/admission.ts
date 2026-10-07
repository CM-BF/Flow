import type { ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { bindExecutionInput } from '../conversation-context/store.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { TaskSubmission } from '@flow/contracts';
import type { ConversationTurnAccepted } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';
import { assertTaskExecutionProfile, requireExecutionProfile } from '../execution-profiles/store.js';
import { acceptTask, loadTask } from '../tasks.js';
import { sessionEvidence } from './replies.js';
import { conversationView, lastTurn, loadConversation, turnView, type ConversationRow, type TurnRow } from './state.js';

/** Caller owns the conversation lock for admission; reads use a repeatable read snapshot. */
export async function prepareTurnAdmission(client: PoolClient, conversation: ConversationRow, text: string, mode: 'follow-up' | 'automatic-queue' | 'explicit-queue', lock = true, messageSettings?: ClaudeTurnSettings): Promise<TaskSubmission> {
  const resumeSessionId = await continuationSession(client, conversation, mode, lock);
  const input: TaskSubmission = { title: conversation.title, harness: conversation.harness, prompt: text,
    ...(conversation.execution_profile ? { executionProfile: conversation.execution_profile } : {}), ...(resumeSessionId ? { resumeSessionId } : {}),
    ...(messageSettings ? { messageSettings } : {}) };
  await assertTaskExecutionProfile(client, input);
  return input;
}
async function continuationSession(client: PoolClient, conversation: ConversationRow, mode: 'follow-up' | 'automatic-queue' | 'explicit-queue', lock: boolean): Promise<string | undefined> {
  const automatic = mode === 'automatic-queue';
  if (conversation.revision >= 2_147_483_646) throw new HttpError(409, 'conversation_revision_exhausted', 'Conversation turn limit reached.');
  const previous = await lastTurn(client, conversation.id);
  let resumeSessionId: string | undefined;
  if (previous) {
    const task = await loadTask(client, previous.task_id, lock);
    if (task.submission.harness !== conversation.harness) throw new HttpError(409, 'conversation_resume_unavailable', 'The previous task does not match this conversation harness.');
    if (automatic && ['failed', 'cancelled', 'uncertain'].includes(task.status)) {
      throw new HttpError(409, `conversation_previous_${task.status}`, 'Automatic queue promotion requires a successful previous turn.');
    }
    if (!(automatic ? ['succeeded'] : ['succeeded', 'failed', 'cancelled']).includes(task.status)) {
      throw new HttpError(409, 'conversation_busy', 'The previous turn is still active or uncertain.');
    }
    const session = await sessionEvidence(client, task);
    if (!session?.knownAdapter) throw new HttpError(409, 'conversation_resume_unavailable', 'The previous turn has no supported native session. Start a separate conversation.');
    // Runner writers acquire runner then task; never acquire a runner row lock here after task.
    if (mode !== 'follow-up' && !(await client.query('SELECT 1 FROM flow.runners WHERE id=$1 AND NOT revoked', [session.identity.runnerId])).rowCount) {
      throw new HttpError(409, 'conversation_resume_unavailable', 'The recorded session runner is no longer available.');
    }
    if (session.activeTaskId) throw new HttpError(409, automatic ? 'conversation_session_busy' : 'conversation_busy', 'The native session is still occupied.');
    resumeSessionId = session.identity.nativeSessionId;
  }
  return resumeSessionId;
}
/** Empty unpause checks continuation rights but does not invent a task or message settings. */
export async function assertEmptyQueueResume(client: PoolClient, conversation: ConversationRow): Promise<void> {
  const resumeSessionId = await continuationSession(client, conversation, 'explicit-queue', true);
  if (!conversation.execution_profile) return;
  const profile = await requireExecutionProfile(client, conversation.execution_profile);
  if (profile.configuration.harness !== conversation.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The selected profile does not support this conversation harness.');
  if (resumeSessionId) {
    const session = (await client.query<{ runner_id: string }>('SELECT runner_id FROM flow.sessions WHERE id=$1 AND harness=$2', [resumeSessionId, conversation.harness])).rows[0];
    if (!session || session.runner_id !== profile.reference.runnerId) throw new HttpError(409, 'profile_session_mismatch', 'A resumed session must use its original configured runner.');
  }
}
/** Task, wake-up, immutable turn and admission revision share the caller's transaction. */
export async function acceptConversationTurn(client: PoolClient, boss: PgBoss, conversation: ConversationRow, input: TaskSubmission, contextInputId?: string | null): Promise<Omit<ConversationTurnAccepted, 'replayed'>> {
  const task = await acceptTask(client, boss, input);
  await bindExecutionInput(client, task.id, contextInputId, conversation.id);
  const row = (await client.query<TurnRow>('INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text,conversation_input_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), conversation.id, conversation.revision + 1, task.id, input.prompt, contextInputId ?? null])).rows[0]!;
  await client.query('UPDATE flow.conversations SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1', [conversation.id]);
  return { conversation: conversationView(await loadConversation(client, conversation.id)), turn: await turnView(client, row, conversation.harness) };
}
