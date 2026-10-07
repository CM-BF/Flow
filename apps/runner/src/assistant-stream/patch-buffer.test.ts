import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createPatchBuffer, sealPatches } from './patch-buffer.js';
it('seals Unicode prefixes incrementally without changing legacy completion semantics', () => {
  const buffer = createPatchBuffer(); buffer.content = '中🙂'.repeat(2000); buffer.dirty = true;
  const header = () => ({ type: 'assistant-stream' as const, source: 'claude.sdk.stream' as const, streamId: 'a'.repeat(64),
    nativeSessionId: 'session', nativeMessageId: 'message', sourceMessageId: 'frame', parentToolUseId: null, blockIndex: 0 });
  const patches = sealPatches(buffer, header); let text = '';
  for (const patch of patches) { expect(patch.fromBytes).toBe(Buffer.byteLength(text)); expect(Buffer.byteLength(patch.text)).toBeLessThanOrEqual(8192);
    text += patch.text; expect(patch.prefixDigest).toBe(createHash('sha256').update(text).digest('hex')); }
  expect(text).toBe(buffer.content); expect(sealPatches(buffer,header)).toEqual([]);
  buffer.phase = 'block-complete'; buffer.dirty = true;
  expect(sealPatches(buffer,header)).toMatchObject([{text:'',phase:'block-complete',fromBytes:Buffer.byteLength(text)}]);
});
