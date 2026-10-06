import { createHash } from 'node:crypto';

/** A whole 16-byte tile preserves CRLF, combining marks and a supplementary code point. */
export const UNICODE_TILE = 'A中🙂e\u0301\\_%\r\n';
export const PATCH_COUNTS = [4, 16, 64] as const;
export type PatchCount = typeof PATCH_COUNTS[number];
export interface PreparedPatch {
  revision: number;
  fromBytes: number;
  text: string;
  prefixDigest: string;
  phase: 'streaming' | 'block-complete';
}
export interface Workload {
  patchCount: PatchCount;
  text: string;
  inputUtf8Bytes: number;
  contentDigest: string;
  patches: PreparedPatch[];
  sourcePrediction: { kind: 'source-count-expectation-not-measurement'; priorPrefixReadUtf8Bytes: number; fullPrefixHashUtf8Bytes: number };
}

/** Pure preparation only. Run before installing request instrumentation or measuring latency. */
export function buildScenario(patchCount: PatchCount): Workload {
  if (!(PATCH_COUNTS as readonly number[]).includes(patchCount)) throw new RangeError('Only 4, 16 or 64 patches are authorized.');
  const text = UNICODE_TILE.repeat(2048);
  const patchText = UNICODE_TILE.repeat(2048 / patchCount);
  const patchBytes = Buffer.byteLength(patchText);
  const prefixHash = createHash('sha256');
  const patches: PreparedPatch[] = [];
  let priorPrefixReadUtf8Bytes = 0;
  let fullPrefixHashUtf8Bytes = 0;
  for (let index = 0; index < patchCount; index++) {
    const fromBytes = index * patchBytes;
    prefixHash.update(patchText);
    patches.push({ revision: index + 1, fromBytes, text: patchText, prefixDigest: prefixHash.copy().digest('hex'), phase: index === patchCount - 1 ? 'block-complete' : 'streaming' });
    priorPrefixReadUtf8Bytes += fromBytes;
    fullPrefixHashUtf8Bytes += fromBytes + patchBytes;
  }
  return { patchCount, text, inputUtf8Bytes: Buffer.byteLength(text), contentDigest: prefixHash.digest('hex'), patches,
    sourcePrediction: { kind: 'source-count-expectation-not-measurement', priorPrefixReadUtf8Bytes, fullPrefixHashUtf8Bytes } };
}
