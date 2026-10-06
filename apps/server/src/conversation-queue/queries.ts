import type { Pool } from 'pg';
import type { ConversationQueueItemDetail, ConversationQueuePage } from '../../../../packages/contracts/src/conversation-queue.js';
export async function list(_pool: Pool, _conversationId: string, _after: number, _limit: number): Promise<ConversationQueuePage> { throw new Error('Queue list is not implemented yet.'); }
export async function readItem(_pool: Pool, _conversationId: string, _itemId: string): Promise<ConversationQueueItemDetail> { throw new Error('Queue read is not implemented yet.'); }
