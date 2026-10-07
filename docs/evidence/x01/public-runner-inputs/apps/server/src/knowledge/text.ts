import { KNOWLEDGE_LIMITS as limits } from '../../../../packages/contracts/src/knowledge.js';

export interface TextChunk { ordinal: number; start: number; end: number; text: string }
const continuation = (byte: number) => (byte & 0xc0) === 0x80;
export function boundaryBefore(bytes: Buffer, offset: number): number {
  while (offset > 0 && offset < bytes.length && continuation(bytes[offset]!)) offset--;
  return offset;
}
export function chunks(text: string): TextChunk[] {
  const bytes = Buffer.from(text); const result: TextChunk[] = [];
  let start = 0;
  do {
    const end = boundaryBefore(bytes, Math.min(start + limits.chunkBytes, bytes.length));
    result.push({ ordinal: result.length, start, end, text: bytes.subarray(start, end).toString('utf8') });
    if (end === bytes.length) return result;
    start = boundaryBefore(bytes, end - limits.overlapBytes);
  } while (start < bytes.length);
  return result;
}
