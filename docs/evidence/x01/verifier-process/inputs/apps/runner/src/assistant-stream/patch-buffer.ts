import { createHash, type Hash } from 'node:crypto';
import { ASSISTANT_PATCH_BYTES, type AssistantStreamData } from '../../../../packages/contracts/src/assistant-stream.js';

export interface PatchBuffer {
  content: string; sent: number; sentBytes: number; prefixHash: Hash; revision: number;
  phase: AssistantStreamData['phase']; reason: AssistantStreamData['reason']; dirty: boolean; truncated: boolean;
}
export function createPatchBuffer(): PatchBuffer {
  return { content: '', sent: 0, sentBytes: 0, prefixHash: createHash('sha256'), revision: 0,
    phase: 'streaming', reason: null, dirty: false, truncated: false };
}
export function utf8Prefix(value: string, limit: number): string {
  if (Buffer.byteLength(value) <= limit) return value;
  let result = '', bytes = 0;
  for (const point of value) { const next = Buffer.byteLength(point); if (bytes + next > limit) break; bytes += next; result += point; }
  return result;
}
type Header = Omit<AssistantStreamData, 'revision' | 'fromBytes' | 'text' | 'prefixDigest' | 'phase' | 'reason' | 'truncated'>;
/** Shared sealing mechanics only. Native identity, ordering and completion remain owned by each mapper. */
export function sealPatches(block: PatchBuffer, header: (revision: number) => Header): AssistantStreamData[] {
  if (!block.dirty) return [];
  const patches: AssistantStreamData[] = [];
  do {
    const text = utf8Prefix(block.content.slice(block.sent), ASSISTANT_PATCH_BYTES), fromBytes = block.sentBytes;
    block.sent += text.length; block.sentBytes += Buffer.byteLength(text); block.prefixHash.update(text);
    const last = block.sent === block.content.length;
    patches.push({ ...header(++block.revision), revision: block.revision, fromBytes, text,
      prefixDigest: block.prefixHash.copy().digest('hex'), phase: last ? block.phase : 'streaming',
      reason: last ? block.reason : null, truncated: last && block.truncated });
  } while (block.sent < block.content.length);
  block.dirty = false;
  return patches;
}
