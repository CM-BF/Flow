import { z } from 'zod';
import { claudeTurnSettingsSchema, type ClaudeTurnSettings } from './claude-turn-settings.js';
import { attachmentSelectionSchema } from './attachments.js';
import { conversationContextSelectionSchema, type ConversationContextReference } from './conversation-context.js';
import { idSchema, type TaskSummary } from './tasks.js';

export const CONVERSATION_QUEUE_MAX_PENDING = 100;
export const CONVERSATION_QUEUE_TEXT_BYTES = 16_000;
export const CONVERSATION_QUEUE_PREVIEW_BYTES = 512;
const revision = z.number().int().min(0).max(2_147_483_646);
export const conversationQueueEnqueueSchema = z.strictObject({
  expectedQueueRevision: revision,
  knowledge: conversationContextSelectionSchema.optional(),
  attachments: attachmentSelectionSchema.optional(),
  messageSettings: claudeTurnSettingsSchema.optional(),
  text: z.string().min(1).max(CONVERSATION_QUEUE_TEXT_BYTES).refine(text => text.trim().length > 0 && new TextEncoder().encode(text).length <= CONVERSATION_QUEUE_TEXT_BYTES),
});
export const conversationQueueCancelSchema = z.strictObject({ expectedQueueRevision: revision });
export const conversationQueuePauseSchema = z.strictObject({ expectedQueueRevision: revision });
export const conversationQueueResumeSchema = z.strictObject({ expectedQueueRevision: revision, expectedTaskId: idSchema.nullable() });
export const conversationQueueQuerySchema = z.strictObject({
  after: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConversationQueueEnqueue = z.infer<typeof conversationQueueEnqueueSchema>;
export type ConversationQueueCancel = z.infer<typeof conversationQueueCancelSchema>;
export type ConversationQueuePause = z.infer<typeof conversationQueuePauseSchema>;
export type ConversationQueueResume = z.infer<typeof conversationQueueResumeSchema>;
export interface ConversationQueueCurrentTurn { taskId: string; taskStatus: TaskSummary['status']; turnId: string; turnNumber: number; queueItemId: string | null }
export type ConversationQueueBlockReason = 'queue-paused' | 'previous-turn-active' | 'previous-turn-failed' | 'previous-turn-cancelled' | 'previous-turn-uncertain' | 'native-session-unavailable' | 'native-session-busy' | 'execution-profile-unavailable' | 'message-settings-unsupported';
export interface ConversationQueueItem {
  messageSettings?: ClaudeTurnSettings;
  context?: ConversationContextReference;
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
  paused: boolean;
  currentTurn: ConversationQueueCurrentTurn | null;
}
export interface ConversationQueueItemDetail {
  conversationId: string;
  queueRevision: number;
  item: ConversationQueueItem & { text: string };
  blocked: ConversationQueueBlockReason | null;
  paused: boolean;
  currentTurn: ConversationQueueCurrentTurn | null;
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

export interface ConversationQueuePaused {
  conversationId: string;
  queueRevision: number;
  paused: true;
  /** Latest durable turn, including terminal states; this does not promise active execution. */
  currentTurn: ConversationQueueCurrentTurn | null;
  replayed: boolean;
}
export interface ConversationQueueResumed {
  conversationId: string;
  queueRevision: number;
  paused: false;
  currentTurn: ConversationQueueCurrentTurn | null;
  promoted: ConversationQueueItem | null;
  replayed: boolean;
}
