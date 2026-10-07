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
  source: z.enum(['claude.sdk.stream', 'codex.app-server.stream']),
  nativeTurnId: idSchema.optional(),
  channel: z.enum(['text', 'reasoning-summary', 'reasoning-text']).optional(),
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
  if (patch.source === 'claude.sdk.stream' && (patch.nativeTurnId !== undefined || patch.channel !== undefined)) problem('Claude source does not carry Codex identity.');
  if (patch.source === 'codex.app-server.stream' && (!patch.nativeTurnId || !patch.channel)) problem('Codex source requires its observed turn and channel.');
  if (patch.source === 'codex.app-server.stream' && patch.channel === 'text' && patch.blockIndex !== 0) problem('Agent text has one block per item.');
  if (['streaming','block-complete'].includes(patch.phase) && patch.reason !== null) problem('Open/complete blocks cannot carry an interruption reason.');
  if (patch.phase === 'incomplete' && (patch.reason === null || patch.reason === 'superseded')) problem('Incomplete blocks require an interruption reason.');
  if (patch.phase === 'superseded' && patch.reason !== 'superseded') problem('Replaced blocks require their explicit reason.');
  if (patch.truncated && !['incomplete','superseded'].includes(patch.phase)) problem('Truncated text cannot be declared complete.');
  if (patch.phase === 'streaming' && patch.text === '') problem('An open patch must add text.');
});
export type AssistantStreamData = z.infer<typeof assistantStreamDataSchema>;
/** The old Claude identity is byte-for-byte stable. Codex item IDs are scoped by turn and channel. */
export function assistantStreamIdentity(value: Pick<AssistantStreamData, 'source' | 'nativeSessionId' | 'nativeMessageId' | 'blockIndex' | 'nativeTurnId' | 'channel'>): string {
  return JSON.stringify(value.source === 'claude.sdk.stream'
    ? [value.nativeSessionId, value.nativeMessageId, value.blockIndex]
    : [value.source, value.nativeSessionId, value.nativeTurnId, value.nativeMessageId, value.channel, value.blockIndex]);
}
export type AssistantStreamProtocol = 'patch-v1' | 'patch-v2' | 'patch-select-v1';
/** Finite protocol negotiation: duplicates and unknown names never opt in. */
export function assistantStreamProtocol(rawHeaders: readonly string[]): AssistantStreamProtocol | null {
  const values: string[] = [];
  for (let index = 0; index < rawHeaders.length; index += 2)
    if (rawHeaders[index]?.toLowerCase() === 'x-flow-assistant-stream') values.push(rawHeaders[index + 1] ?? '');
  return values.length === 1 && (values[0] === 'patch-v1' || values[0] === 'patch-v2' || values[0] === 'patch-select-v1') ? values[0] : null;
}
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

/** Selection reads are explicitly acknowledged; old servers may ignore query fields. */
export const ASSISTANT_SELECTION_PROTOCOL = 'patch-select-v1' as const;
export const assistantStreamSelectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('text') }),
  z.strictObject({ kind: z.literal('block'), streamId: digest }),
]);
export type AssistantStreamSelection = z.infer<typeof assistantStreamSelectionSchema>;
export interface AssistantStreamSelectedPage extends AssistantStreamPage { protocol: typeof ASSISTANT_SELECTION_PROTOCOL }
export interface AssistantStreamSelectedPatchPage extends AssistantStreamPatchPage {
  protocol: typeof ASSISTANT_SELECTION_PROTOCOL;
  selection: AssistantStreamSelection;
}
export function assistantStreamSelectionQuery(selection: unknown, streamId: unknown): AssistantStreamSelection {
  if (selection === undefined || selection === 'text') {
    if (streamId !== undefined) throw Error('Text selection cannot carry a block identity.');
    return Object.freeze({ kind: 'text' });
  }
  if (selection !== 'block') throw Error('Unknown stream selection.');
  return Object.freeze(assistantStreamSelectionSchema.parse({ kind: 'block', streamId }));
}
