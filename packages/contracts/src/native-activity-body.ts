import { z } from 'zod';
import { idSchema } from './tasks.js';
import type { NativeActivityData } from './native-activity.js';

export const NATIVE_ACTIVITY_BODY_PROTOCOL = 'native-activity-body-v1' as const;
export const NATIVE_ACTIVITY_BODY_LIMITS = Object.freeze({
  bodyBytes: 8 * 1024 * 1024, attemptBytes: 16 * 1024 * 1024,
  bodies: 256, chunkBytes: 65_536, batchChunks: 8, pageChunks: 4,
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const bytes = z.number().int().min(0).max(NATIVE_ACTIVITY_BODY_LIMITS.bodyBytes);
const identity = {
  type: z.literal('native-activity-body'), protocol: z.literal(NATIVE_ACTIVITY_BODY_PROTOCOL),
  activityId: digest, nativeSessionId: idSchema,
};
export const nativeActivityBodyEventSchema = z.discriminatedUnion('action', [
  z.strictObject({ ...identity, action: z.literal('open'), bytes, sha256: digest,
    mediaType: z.enum(['application/json', 'text/plain']),
    representation: z.literal('sdk-public-material-utf8-v1') }),
  z.strictObject({ ...identity, action: z.literal('chunk'),
    index: z.number().int().min(0).max(127), offset: bytes,
    bytes: z.number().int().min(1).max(NATIVE_ACTIVITY_BODY_LIMITS.chunkBytes),
    sha256: digest,
    base64: z.string().min(4).max(87_384).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }),
  z.strictObject({ ...identity, action: z.literal('seal'), bytes, sha256: digest }),
]);
export type NativeActivityBodyEvent = z.infer<typeof nativeActivityBodyEventSchema>;

/** Available SDK public material, not the provider's original HTTP encoding.
 * The bounded legacy prefix must describe these same bytes. No hidden thinking. */
export interface NativeActivityBodyInput {
  activity: NativeActivityData;
  content: Uint8Array;
}
/** Host-provided opt-in only after a fixed compatible center is established.
 * Absent port means legacy prefix behavior. Route existence is not negotiation.
 * Resolves after durable sealed transport ACK, independently of tool success. */
export interface NativeActivityBodyPublisher {
  readonly protocol: typeof NATIVE_ACTIVITY_BODY_PROTOCOL;
  publish(input: NativeActivityBodyInput): Promise<void>;
}

export interface NativeActivityBodyDescriptor {
  taskId: string; attemptId: string; activityId: string;
  protocol: typeof NATIVE_ACTIVITY_BODY_PROTOCOL | null;
  representation: 'sdk-public-material-utf8-v1' | null;
  state: 'receiving' | 'complete' | 'interrupted' | 'legacy';
  mediaType: 'application/json' | 'text/plain' | null;
  bytes: number | null; sha256: string | null;
  receivedBytes: number; receivedChunks: number; chunkCount: number | null;
}
export interface NativeActivityBodyChunk {
  index: number; offset: number; bytes: number; sha256: string; base64: string;
}
/** The descriptor binds the cursor to immutable activity/attempt/content identity.
 * nextIndex may equal receivedChunks while receiving; callers choose when to poll. */
export interface NativeActivityBodyPage {
  descriptor: NativeActivityBodyDescriptor;
  chunks: NativeActivityBodyChunk[];
  nextIndex: number;
  hasMore: boolean;
}

/** Only the authenticated center, after successful production mounting, confirms support. */
export const nativeActivityBodySupportSchema = z.strictObject({
  protocol: z.literal(NATIVE_ACTIVITY_BODY_PROTOCOL),
  representation: z.literal('sdk-public-material-utf8-v1'),
  runnerId: idSchema,
  limits: z.strictObject({
    bodyBytes: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.bodyBytes),
    attemptBytes: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.attemptBytes),
    bodies: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.bodies),
    chunkBytes: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.chunkBytes),
    batchChunks: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.batchChunks),
    pageChunks: z.literal(NATIVE_ACTIVITY_BODY_LIMITS.pageChunks),
  }),
});
export type NativeActivityBodySupport = z.infer<typeof nativeActivityBodySupportSchema>;

const counts = z.number().int().min(0).max(128);
export const nativeActivityBodyDescriptorSchema = z.strictObject({
  taskId: idSchema, attemptId: idSchema, activityId: digest,
  protocol: z.literal(NATIVE_ACTIVITY_BODY_PROTOCOL).nullable(),
  representation: z.literal('sdk-public-material-utf8-v1').nullable(),
  state: z.enum(['receiving', 'complete', 'interrupted', 'legacy']),
  mediaType: z.enum(['application/json', 'text/plain']).nullable(),
  bytes: bytes.nullable(), sha256: digest.nullable(), receivedBytes: bytes,
  receivedChunks: counts, chunkCount: counts.nullable(),
}).superRefine((value, context) => {
  const invalid = () => context.addIssue({ code: 'custom', message: 'Inconsistent material descriptor.' });
  if (value.state === 'legacy') {
    if (value.protocol !== null || value.representation !== null || value.mediaType !== null
      || value.bytes !== null || value.sha256 !== null || value.chunkCount !== null
      || value.receivedBytes !== 0 || value.receivedChunks !== 0) invalid();
    return;
  }
  if (value.protocol === null || value.representation === null || value.mediaType === null
    || value.bytes === null || value.sha256 === null || value.chunkCount === null) { invalid(); return; }
  if (value.chunkCount !== Math.ceil(value.bytes / NATIVE_ACTIVITY_BODY_LIMITS.chunkBytes)
    || value.receivedChunks > value.chunkCount
    || value.receivedBytes !== Math.min(value.bytes, value.receivedChunks * NATIVE_ACTIVITY_BODY_LIMITS.chunkBytes)
    || value.state === 'complete' && value.receivedBytes !== value.bytes) invalid();
});

export const nativeActivityBodyPageSchema = z.strictObject({
  descriptor: nativeActivityBodyDescriptorSchema,
  chunks: z.array(z.strictObject({
    index: z.number().int().min(0).max(127), offset: bytes,
    bytes: z.number().int().min(1).max(NATIVE_ACTIVITY_BODY_LIMITS.chunkBytes), sha256: digest,
    base64: z.string().min(4).max(87_384).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })).max(NATIVE_ACTIVITY_BODY_LIMITS.pageChunks),
  nextIndex: counts, hasMore: z.boolean(),
});
