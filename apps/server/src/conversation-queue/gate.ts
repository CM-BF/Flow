import type { PoolClient } from 'pg';
import type { ConversationQueueBlockReason } from '../../../../packages/contracts/src/conversation-queue.js';
import { HttpError } from '../database.js';
import { prepareTurnAdmission } from '../conversations/admission.js';
import type { ConversationRow } from '../conversations/state.js';

const reasons: Record<string, ConversationQueueBlockReason> = {
  conversation_busy: 'previous-turn-active', conversation_previous_failed: 'previous-turn-failed',
  conversation_previous_cancelled: 'previous-turn-cancelled', conversation_previous_uncertain: 'previous-turn-uncertain',
  conversation_resume_unavailable: 'native-session-unavailable', conversation_session_busy: 'native-session-busy',
  execution_profile_unavailable: 'execution-profile-unavailable', profile_session_mismatch: 'execution-profile-unavailable', profile_harness_mismatch: 'execution-profile-unavailable',
};
export async function prepareQueueAdmission(client: PoolClient, conversation: ConversationRow, text: string, lock: boolean) {
  try { return { input: await prepareTurnAdmission(client, conversation, text, true, lock), blocked: null }; }
  catch (error) {
    const blocked = error instanceof HttpError ? reasons[error.code] : undefined;
    if (!blocked) throw error;
    return { input: null, blocked };
  }
}
/** One shared conversation check per page, independent of item count. */
export async function queueBlock(client: PoolClient, conversation: ConversationRow): Promise<ConversationQueueBlockReason | null> {
  if (!(await client.query("SELECT 1 FROM flow.conversation_queue WHERE conversation_id=$1 AND state='waiting' LIMIT 1", [conversation.id])).rowCount) return null;
  return (await prepareQueueAdmission(client, conversation, '', false)).blocked;
}
