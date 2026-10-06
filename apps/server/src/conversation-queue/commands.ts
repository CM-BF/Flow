import type { Pool } from 'pg';
import type { ConversationQueueAccepted, ConversationQueueCancelled, ConversationQueueEnqueue, ConversationQueueCancel } from '../../../../packages/contracts/src/conversation-queue.js';
export async function enqueue(_pool: Pool, _conversationId: string, _input: ConversationQueueEnqueue, _key: string): Promise<ConversationQueueAccepted> { throw new Error('Queue enqueue is not implemented yet.'); }
export async function cancel(_pool: Pool, _conversationId: string, _itemId: string, _input: ConversationQueueCancel, _key: string): Promise<ConversationQueueCancelled> { throw new Error('Queue cancel is not implemented yet.'); }
