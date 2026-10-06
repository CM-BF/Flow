import { z } from 'zod';
import { idSchema } from './tasks.js';

export const ASSISTANT_PATCH_BYTES = 8192;
export const ASSISTANT_ATTEMPT_BYTES = 1048576;
export const ASSISTANT_FLUSH_MS = 250;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const assistantStreamPhaseSchema = z.enum(['streaming', 'block-complete', 'incomplete', 'superseded']);
export const assistantStreamReasonSchema = z.enum(['aborted', 'superseded', 'source-gap', 'source-mismatch', 'stream-ended', 'truncated']);
/** A sealed patch is immutable. Offsets and limits are UTF-8 bytes, never JS code units.
 * block-complete is a native block observation, NOT a successful Flow turn. */
export const assistantStreamDataSchema = z.strictObject({
  type: z.literal('assistant-stream'),
  streamId: digest,
  nativeSessionId: idSchema,
  nativeMessageId: idSchema,
  parentToolUseId: z.null(),
  source: z.literal('claude.sdk.stream'),
  sourceMessageId: idSchema,
  blockIndex: z.number().int().min(0).max(10000),
  revision: z.number().int().min(1).max(100000),
  fromBytes: z.number().int().min(0).max(ASSISTANT_ATTEMPT_BYTES),
  text: z.string().max(ASSISTANT_PATCH_BYTES).refine(value => new TextEncoder().encode(value).byteLength <= ASSISTANT_PATCH_BYTES, 'Patch exceeds byte limit').refine(value => !value.includes('\0') && new TextDecoder().decode(new TextEncoder().encode(value)) === value, 'Text must contain valid Unicode without NUL'),
  prefixDigest: digest,
  phase: assistantStreamPhaseSchema,
  reason: assistantStreamReasonSchema.nullable(),
  truncated: z.boolean(),
}).superRefine((patch, context) => {
  const problem = (message:string) => context.addIssue({code:'custom',message});
  if (['streaming','block-complete'].includes(patch.phase) && patch.reason !== null) problem('Open/complete blocks cannot carry an interruption reason.');
  if (patch.phase === 'incomplete' && (patch.reason === null || patch.reason === 'superseded')) problem('Incomplete blocks require an interruption reason.');
  if (patch.phase === 'superseded' && patch.reason !== 'superseded') problem('Replaced blocks require their explicit reason.');
  if (patch.truncated && !['incomplete','superseded'].includes(patch.phase)) problem('Truncated text cannot be declared complete.');
  if (patch.phase === 'streaming' && patch.text === '') problem('An open patch must add text.');
});
export type AssistantStreamData = z.infer<typeof assistantStreamDataSchema>;
export interface AssistantStreamReference extends Omit<AssistantStreamData, 'type' | 'text' | 'fromBytes'> {
  id: string;
  taskId: string;
  attemptId: string;
  firstSequence: number;
  lastSequence: number;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  /** interrupted comes from ended/uncertain task state; a final is not task completion. */
  status: AssistantStreamData['phase'] | 'interrupted' | 'final-available';
}
export interface AssistantStreamBlock extends AssistantStreamReference { content: string }
export interface AssistantStreamPage {
  blocks: AssistantStreamReference[];
  nextCursor: string | null;
  taskId: string;
  attemptId: string | null;
  taskStatus: string;
  taskUpdatedAt: string;
  /** Canonical final replaces the live draft display, never appends to its text.
   * Earlier message blocks (e.g. before tools) remain readable as history.
   * The final body is fetched through the existing assistant-message owner route. */
  finalMessageId: string | null;
  settlement: AssistantStreamSettlement | null;
}
/** Main reply UI consumes patches automatically; it must not poll growing full blocks. */
export interface AssistantStreamPatch extends AssistantStreamData {
  taskId: string;
  attemptId: string;
  eventId: string;
  sequence: number;
  createdAt: string;
}
export interface AssistantStreamPatchPage {
  taskId: string;
  attemptId: string;
  patches: AssistantStreamPatch[];
  /** Last included runner sequence, or the supplied cursor when empty. */
  nextCursor: number;
  hasMore: boolean;
}
/** Ordered marker: pending root text is sealed BEFORE its tool boundary is emitted. */
export const assistantStreamMarkerSchema = z.strictObject({
  type: z.literal('assistant-stream-marker'),
  markerId: digest,
  nativeSessionId: idSchema,
  sourceMessageId: idSchema,
  kind: z.enum(['tool-boundary', 'unavailable']),
  toolUseId: idSchema.nullable(),
  reason: assistantStreamReasonSchema.nullable(),
});
export type AssistantStreamMarker = z.infer<typeof assistantStreamMarkerSchema>;
export interface AssistantStreamSettlement {
  policy: 'flow.assistant-draft';
  policyVersion: '1';
  correlation: 'presentation-policy' | 'unavailable';
  unavailableReason: 'no-draft' | 'incomplete-stream' | 'missing-tool-evidence' | 'crossed-tool-boundary' | null;
  taskId: string;
  attemptId: string;
  nativeSessionId: string;
  finalMessageId: string;
  /** Complete disjoint partition of this attempt's durable blocks. No history is deleted. */
  replaceStreamIds: string[];
  retainStreamIds: string[];
}
