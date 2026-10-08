import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { nativeActivityDataSchema } from '../../../../packages/contracts/src/native-activity.js';
import { NATIVE_ACTIVITY_BODY_LIMITS as limits, NATIVE_ACTIVITY_BODY_PROTOCOL as protocol,
  type NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import { eventBatchSchema, ownershipSchema, type EventBatch, type Ownership, type RunnerEvent } from '../../../../packages/contracts/src/runner.js';

export const bodyDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const bodyJobSchema = z.strictObject({
  protocol: z.literal(protocol), ownership: ownershipSchema,
  activity: nativeActivityDataSchema, bytes: z.number().int().min(0).max(limits.bodyBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  firstSequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 131),
  eventIds: z.array(z.uuid()).min(3).max(131),
}).superRefine((job, context) => {
  if (job.eventIds.length !== Math.ceil(job.bytes / limits.chunkBytes) + 3 || new Set(job.eventIds).size !== job.eventIds.length
      || job.activity.kind !== 'tool' || !['input-ready', 'succeeded', 'failed', 'running'].includes(job.activity.phase)
      || !job.activity.body || job.activity.body.sha256 !== job.sha256 || job.activity.body.originalBytes !== job.bytes) {
    context.addIssue({ code: 'custom', message: 'Invalid material job identity or envelope plan.' });
  }
});
export type BodyJob = z.infer<typeof bodyJobSchema>;

export function planBody(input: NativeActivityBodyInput, ownership: Ownership, firstSequence: number): BodyJob {
  if (input.content.byteLength > limits.bodyBytes) throw new Error('Native activity body exceeds the declared limit.');
  const activity = nativeActivityDataSchema.parse(input.activity);
  const original = Buffer.from(input.content);
  if (!activity.body || bodyDigest(original) !== activity.body.sha256
      || activity.body.originalBytes !== original.byteLength
      || !original.subarray(0, Buffer.byteLength(activity.body.content)).equals(Buffer.from(activity.body.content))) {
    throw new Error('Activity prefix and complete material differ.');
  }
  return bodyJobSchema.parse({ protocol, ownership, activity, bytes: original.length, sha256: bodyDigest(original),
    firstSequence, eventIds: Array.from({ length: Math.ceil(original.length / limits.chunkBytes) + 3 }, () => randomUUID()) });
}

/** Reconstruct only the immutable envelopes already allocated before first send. */
export function* bodyBatches(job: BodyJob, content: Uint8Array): Generator<EventBatch> {
  if (content.byteLength !== job.bytes || bodyDigest(content) !== job.sha256) throw new Error('Saved complete material is corrupt.');
  const common = { type: 'native-activity-body' as const, protocol, activityId: job.activity.activityId,
    nativeSessionId: job.activity.nativeSessionId };
  let cursor = 0;
  const envelope = () => ({ id: job.eventIds[cursor]!, sequence: job.firstSequence + cursor++ });
  let events: RunnerEvent[] = [{ ...job.activity, ...envelope() }, { ...common, action: 'open', bytes: job.bytes,
    sha256: job.sha256, mediaType: job.activity.body!.mediaType, representation: 'sdk-public-material-utf8-v1', ...envelope() }];
  for (let offset = 0, index = 0; offset < content.byteLength; offset += limits.chunkBytes, index++) {
    const chunk = Buffer.from(content.subarray(offset, offset + limits.chunkBytes));
    events.push({ ...common, action: 'chunk', index, offset, bytes: chunk.length,
      base64: chunk.toString('base64'), sha256: bodyDigest(chunk), ...envelope() });
    if (events.length === limits.batchChunks) {
      yield eventBatchSchema.parse({ ...job.ownership, events }); events = [];
    }
  }
  events.push({ ...common, action: 'seal', bytes: job.bytes, sha256: job.sha256, ...envelope() });
  yield eventBatchSchema.parse({ ...job.ownership, events });
}
