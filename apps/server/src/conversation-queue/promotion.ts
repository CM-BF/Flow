import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { ConversationQueueAccepted, ConversationQueueBlockReason } from '../../../../packages/contracts/src/conversation-queue.js';
export type QueuePromotion = { outcome: 'promoted'; receipt: Omit<ConversationQueueAccepted, 'replayed'> } | { outcome: 'blocked'; conversationId: string; reason: ConversationQueueBlockReason } | { outcome: 'empty'; conversationId: string };
export interface QueueScanResult { inspected: number; promoted: number; blocked: number; errors: { conversationId: string; code: 'promotion_failed' }[] }
/** One FIFO item at most; conversation then task lock; all acceptance writes share one transaction. */
export async function promoteReady(_pool: Pool, _boss: PgBoss, _conversationId: string): Promise<QueuePromotion> { throw new Error('Queue promotion is not implemented yet.'); }
/** Fair PG-backed rotation; limit 1..100, default 20. Caller serializes its own interval and awaits it on shutdown. */
export async function scanConversationQueue(_pool: Pool, _boss: PgBoss, _limit = 20): Promise<QueueScanResult> { throw new Error('Queue scan is not implemented yet.'); }
