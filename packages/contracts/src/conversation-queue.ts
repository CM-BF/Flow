import { z } from 'zod';

export const CONVERSATION_QUEUE_MAX_PENDING = 100;
export const CONVERSATION_QUEUE_TEXT_BYTES = 16_000;
export const CONVERSATION_QUEUE_PREVIEW_BYTES = 512;
const revision = z.number().int().min(0).max(2_147_483_646);
export const conversationQueueEnqueueSchema = z.strictObject({
  expectedQueueRevision: revision,
  text: z.string().min(1).max(CONVERSATION_QUEUE_TEXT_BYTES).refine(text => text.trim().length > 0 && new TextEncoder().encode(text).length <= CONVERSATION_QUEUE_TEXT_BYTES),
});
export const conversationQueueCancelSchema = z.strictObject({ expectedQueueRevision: revision });
export const conversationQueueQuerySchema = z.strictObject({
  after: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConversationQueueEnqueue = z.infer<typeof conversationQueueEnqueueSchema>;
export type ConversationQueueCancel = z.infer<typeof conversationQueueCancelSchema>;
export type ConversationQueueBlockReason = 'previous-turn-active' | 'previous-turn-failed' | 'previous-turn-cancelled' | 'previous-turn-uncertain' | 'native-session-unavailable' | 'native-session-busy' | 'execution-profile-unavailable';
export interface ConversationQueueItem {
  id: string;
  conversationId: string;
  sequence: number;
  state: 'waiting' | 'cancelled' | 'promoted';
  preview: string;
  truncated: boolean;
  promoted: { taskId: string; turnId: string; turnNumber: number } | null;
  createdAt: string;
  updatedAt: string;
}
export interface ConversationQueuePage {
  conversationId: string;
  queueRevision: number;
  items: ConversationQueueItem[];
  nextCursor: number | null;
  blocked: ConversationQueueBlockReason | null;
}
export interface ConversationQueueItemDetail {
  conversationId: string;
  queueRevision: number;
  item: ConversationQueueItem & { text: string };
  blocked: ConversationQueueBlockReason | null;
}
/** This receipt is immutable on replay; readItem returns current facts after promotion. */
export interface ConversationQueueAccepted {
  conversationId: string;
  queueRevision: number;
  item: ConversationQueueItem;
  replayed: boolean;
}
export interface ConversationQueueCancelled extends ConversationQueueAccepted {
  outcome: 'cancelled' | 'already-cancelled' | 'already-promoted';
}
