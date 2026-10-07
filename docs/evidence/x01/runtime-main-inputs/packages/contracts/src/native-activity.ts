import { z } from 'zod';
import { idSchema, type Reference } from './tasks.js';

export const MAX_ACTIVITY_DETAIL_BYTES = 65_536;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
/** A truncated body is only a UTF-8 prefix, possibly invalid JSON; render as text.
 * sha256 identifies the full original but does not provide a retrieval path to omitted bytes. */
export const nativeActivityBodySchema = z.strictObject({
  content: z.string().refine(value => new TextEncoder().encode(value).byteLength <= MAX_ACTIVITY_DETAIL_BYTES, 'Activity detail exceeds byte limit'),
  mediaType: z.enum(['text/plain', 'application/json']),
  originalBytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  sha256: digest,
});
export const nativeActivityDataSchema = z.strictObject({
  type: z.literal('native-activity'),
  activityId: digest,
  nativeSessionId: idSchema,
  source: z.literal('claude.sdk.message'),
  sourceMessageId: idSchema,
  nativeMessageId: idSchema.nullable(),
  blockIndex: z.number().int().min(0).max(10_000),
  parentToolUseId: idSchema.nullable(),
  kind: z.enum(['assistant-text', 'thinking', 'tool', 'unsupported']),
  phase: z.enum(['observed', 'redacted', 'input-ready', 'running', 'succeeded', 'failed']),
  toolUseId: idSchema.nullable(),
  toolName: z.string().min(1).max(200).nullable(),
  body: nativeActivityBodySchema.nullable(),
}).superRefine((event, context) => {
  const tool = event.kind === 'tool';
  if (tool !== (event.toolUseId !== null) || tool !== ['input-ready', 'running', 'succeeded', 'failed'].includes(event.phase)) context.addIssue({ code: 'custom', message: 'Invalid tool activity phase or identity.' });
  if (event.phase === 'input-ready' && !event.toolName) context.addIssue({ code: 'custom', message: 'Tool input requires a tool name.' });
  if (!tool && event.toolName !== null) context.addIssue({ code: 'custom', message: 'Non-tool activity cannot carry a tool name.' });
  if (event.phase === 'redacted' && (event.kind !== 'thinking' || event.body !== null)) context.addIssue({ code: 'custom', message: 'Redacted thinking never carries a body.' });
  if (event.body) {
    const bytes = new TextEncoder().encode(event.body.content).byteLength;
    if (event.body.originalBytes < bytes || event.body.truncated !== (event.body.originalBytes > bytes)) context.addIssue({ code: 'custom', message: 'Inconsistent activity truncation metadata.' });
  }
});
export type NativeActivityData = z.infer<typeof nativeActivityDataSchema>;
export type NativeActivityBody = z.infer<typeof nativeActivityBodySchema>;
/** Each entry is an immutable observation, not an assistant final or task-completion signal. */
export interface NativeActivityReference extends Omit<NativeActivityData, 'type' | 'body'> {
  id: string;
  taskId: string;
  attemptId: string;
  eventId: string;
  sequence: number;
  createdAt: string;
  detail: Reference | null;
  /** Terminal tool results remain terminal despite late progress; unfinished ended attempts are unknown. */
  status: NativeActivityData['phase'] | 'unknown';
}
export interface NativeActivity extends NativeActivityReference { body: NativeActivityBody | null }
export interface NativeActivityPage { activities: NativeActivityReference[]; nextCursor: string | null }
