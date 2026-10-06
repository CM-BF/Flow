import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { ConversationQueuePause, ConversationQueuePaused, ConversationQueueResume, ConversationQueueResumed } from '../../../../packages/contracts/src/conversation-queue.js';
export async function pause(_pool: Pool, _conversationId: string, _input: ConversationQueuePause, _key: string): Promise<ConversationQueuePaused> { throw new Error('Queue pause is not implemented yet.'); }
export async function resume(_pool: Pool, _boss: PgBoss, _conversationId: string, _input: ConversationQueueResume, _key: string): Promise<ConversationQueueResumed> { throw new Error('Queue resume is not implemented yet.'); }
