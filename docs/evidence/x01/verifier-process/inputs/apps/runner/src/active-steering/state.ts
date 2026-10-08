import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { MAX_STEERING_RESULTS_PER_ATTEMPT, type SteeringResultObservation } from '../../../../packages/contracts/src/active-steering.js';
import { textDigest } from '../verifier.js';

export const MAX_NATIVE_RESULTS = MAX_STEERING_RESULTS_PER_ATTEMPT;
/** Evidence from the documented root fields only. No text matching or inferred SDK queue length. */
export function isRootFrame(frame: SDKMessage): boolean {
  return (frame as unknown as { parent_tool_use_id?: unknown }).parent_tool_use_id == null;
}
export function consumedUuids(frame: SDKMessage): string[] {
  if (!['assistant', 'stream_event', 'result'].includes(frame.type)) return [];
  const root = frame as unknown as { parent_tool_use_id?: unknown; user_message_uuid?: string; user_message_uuids?: string[] };
  if (root.parent_tool_use_id != null) return [];
  const values = root.user_message_uuids ?? (root.user_message_uuid ? [root.user_message_uuid] : []);
  if (!Array.isArray(values) || values.length > 64 || values.some(value => typeof value !== 'string')) throw new Error('Invalid native consumption evidence.');
  return [...new Set(values)];
}
export class NativeResults {
  private readonly seen = new Map<string, string>();
  readonly covered = new Set<string>();
  latest: SteeringResultObservation | undefined;
  observe(frame: SDKResultMessage): SteeringResultObservation | null {
    if (!isRootFrame(frame)) return null;
    const result: SteeringResultObservation = { nativeSessionId: frame.session_id, sourceMessageId: frame.uuid,
      consumedUserMessageUuids: consumedUuids(frame), queuedTurnCount: frame.queued_turn_count ?? null,
      outcome: frame.subtype === 'success' && !frame.is_error ? 'success' : 'error',
      contentDigest: textDigest(frame.subtype === 'success' ? frame.result : '') };
    // Include cumulative usage in identity: the same result UUID cannot carry changed accounting.
    const identity = JSON.stringify([result, frame.modelUsage]);
    const previous = this.seen.get(frame.uuid);
    if (previous) { if (previous !== identity) throw new Error('Native result UUID changed content.'); return null; }
    if (this.seen.size >= MAX_NATIVE_RESULTS) throw new Error('Native result observation limit reached.');
    this.seen.set(frame.uuid, identity); this.latest = result;
    if (result.outcome === 'success') for (const uuid of result.consumedUserMessageUuids) this.covered.add(uuid);
    return result;
  }
}
