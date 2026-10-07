import type { ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { firstWaiting } from './store.js';
import type { PoolClient } from 'pg';
import type { ConversationQueueBlockReason } from '../../../../packages/contracts/src/conversation-queue.js';
import { HttpError } from '../database.js';
import { prepareTurnAdmission } from '../conversations/admission.js';
import type { ConversationRow } from '../conversations/state.js';

const reasons: Record<string, ConversationQueueBlockReason> = {
  message_settings_required: 'message-settings-unsupported', message_settings_invalid: 'message-settings-unsupported',
  message_settings_unavailable: 'message-settings-unsupported', message_settings_unsupported: 'message-settings-unsupported',
  message_settings_profile_mismatch: 'message-settings-unsupported', message_settings_resume_unsupported: 'message-settings-unsupported',
  conversation_busy: 'previous-turn-active', conversation_previous_failed: 'previous-turn-failed',
  conversation_previous_cancelled: 'previous-turn-cancelled', conversation_previous_uncertain: 'previous-turn-uncertain',
  conversation_resume_unavailable: 'native-session-unavailable', conversation_session_busy: 'native-session-busy',
  execution_profile_unavailable: 'execution-profile-unavailable', profile_session_mismatch: 'execution-profile-unavailable', profile_harness_mismatch: 'execution-profile-unavailable',
};
export async function prepareQueueAdmission(client: PoolClient, conversation: ConversationRow, text: string, lock: boolean, messageSettings?: ClaudeTurnSettings) {
  try { return { input: await prepareTurnAdmission(client, conversation, text, 'automatic-queue', lock, messageSettings), blocked: null }; }
  catch (error) {
    const blocked = error instanceof HttpError ? reasons[error.code] : undefined;
    if (!blocked) throw error;
    return { input: null, blocked };
  }
}
/** One shared conversation check per page, independent of item count. */
export async function queueBlock(client: PoolClient, conversation: ConversationRow): Promise<ConversationQueueBlockReason | null> {
  if (conversation.queue_paused) return 'queue-paused';
  const first = await firstWaiting(client, conversation.id);
  if (!first) return null;
  return (await prepareQueueAdmission(client, conversation, first.user_text, false, first.message_settings ?? undefined)).blocked;
}
