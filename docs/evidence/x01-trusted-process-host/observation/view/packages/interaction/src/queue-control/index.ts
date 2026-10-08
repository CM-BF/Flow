import { z } from 'zod';
import type { FlowClient } from '@flow/client';
import { conversationQueuePauseSchema, conversationQueueResumeSchema, type ConversationQueuePage } from '@flow/contracts';

export type QueueControlPort = Pick<FlowClient, 'conversationQueue' | 'pauseConversationQueue' | 'resumeConversationQueue'>;
const identity = { version: z.literal(1), connectionId: z.string().min(1).max(160), key: z.uuid(), conversationId: z.uuid() };
export const queuePauseIntentSchema = z.strictObject({ ...identity, kind: z.literal('queue-pause'), input: conversationQueuePauseSchema });
export const queueResumeIntentSchema = z.strictObject({ ...identity, kind: z.literal('queue-resume'), input: conversationQueueResumeSchema });
export type QueueIntent = z.infer<typeof queuePauseIntentSchema> | z.infer<typeof queueResumeIntentSchema>;
const revision = z.number().int().min(0).max(2_147_483_647);
const id = z.string().min(1).max(128);
const turn = z.object({ taskId: id, taskStatus: z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain']), turnId: id, turnNumber: z.number().int().positive().max(2_147_483_647), queueItemId: id.nullable() });
const promoted = z.object({ taskId: id, turnId: id, turnNumber: z.number().int().positive().max(2_147_483_647) });
const item = z.object({ id, conversationId: id, sequence: z.number().int().positive().max(2_147_483_647), state: z.enum(['waiting', 'cancelled', 'promoted']),
  preview: z.string().max(512).refine(value => new TextEncoder().encode(value).byteLength <= 512), truncated: z.boolean(), promoted: promoted.nullable(), createdAt: z.string().max(64), updatedAt: z.string().max(64) });
const page = z.object({ conversationId: id, queueRevision: revision, items: z.array(item).max(20), nextCursor: revision.nullable(),
  blocked: z.enum(['queue-paused', 'previous-turn-active', 'previous-turn-failed', 'previous-turn-cancelled', 'previous-turn-uncertain', 'native-session-unavailable', 'native-session-busy', 'execution-profile-unavailable']).nullable(), paused: z.boolean(), currentTurn: turn.nullable() });

/** Only one bounded preview page is retained. Optional body/context fields are not copied. */
export function readQueuePage(value: unknown, conversationId: string, after: number): ConversationQueuePage {
  const parsed = page.parse(value); let cursor = after;
  if (parsed.conversationId !== conversationId) throw Error('Queue identity mismatch');
  for (const entry of parsed.items) {
    if (entry.conversationId !== conversationId || entry.sequence <= cursor) throw Error('Queue page identity or order mismatch');
    cursor = entry.sequence;
  }
  if (parsed.nextCursor !== null && (parsed.items.length === 0 || parsed.nextCursor !== cursor)) throw Error('Queue cursor mismatch');
  return parsed;
}

/** Validate the immutable receipt, not the latest queue state. The controller refreshes after ACK. */
export async function dispatchQueueIntent(port: QueueControlPort, intent: QueueIntent, signal: AbortSignal): Promise<void> {
  const value = intent.kind === 'queue-pause'
    ? await port.pauseConversationQueue(intent.conversationId, intent.input, intent.key, signal)
    : await port.resumeConversationQueue(intent.conversationId, intent.input, intent.key, signal);
  const receipt = (intent.kind === 'queue-pause'
    ? z.object({ conversationId: id, queueRevision: revision, paused: z.literal(true), currentTurn: turn.nullable(), replayed: z.boolean() })
    : z.object({ conversationId: id, queueRevision: revision, paused: z.literal(false), currentTurn: turn.nullable(), promoted: item.nullable(), replayed: z.boolean() })).parse(value);
  const advanced = receipt.queueRevision - intent.input.expectedQueueRevision;
  if (receipt.conversationId !== intent.conversationId || (intent.kind === 'queue-pause' ? advanced !== 0 && advanced !== 1 : advanced !== 1)) throw Error('Queue receipt identity mismatch');
  if (intent.kind === 'queue-resume' && 'promoted' in receipt && !receipt.promoted && (receipt.currentTurn?.taskId ?? null) !== intent.input.expectedTaskId) throw Error('Queue receipt changed task without promotion');
  if ('promoted' in receipt && receipt.promoted && (receipt.promoted.conversationId !== intent.conversationId || receipt.promoted.state !== 'promoted' ||
      !receipt.promoted.promoted || receipt.promoted.promoted.taskId !== receipt.currentTurn?.taskId || receipt.promoted.id !== receipt.currentTurn.queueItemId ||
      receipt.promoted.promoted.turnId !== receipt.currentTurn.turnId || receipt.promoted.promoted.turnNumber !== receipt.currentTurn.turnNumber)) throw Error('Queue promotion receipt mismatch');
}
