import { CodexTransportError } from './types.js';

/** Accumulates bytes, never independently decodes chunks that may split UTF8 characters. */
export class JsonLineDecoder {
  private buffer: Buffer;
  private bytes = 0;
  constructor(private readonly maximum: number, private readonly accept: (value: unknown, bytes: number) => void) { this.buffer = Buffer.allocUnsafe(maximum); }
  push(chunk: Buffer): void {
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(start, end);
      if (this.bytes + part.length > this.maximum) throw new CodexTransportError('LIMIT', 'unknown');
      if (part.length) { part.copy(this.buffer, this.bytes); this.bytes += part.length; }
      if (newline < 0) return;
      const bytes = this.bytes;
      const frame = this.buffer.subarray(0, bytes);
      this.bytes = 0;
      let value: unknown;
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(frame)); }
      catch { throw new CodexTransportError('PROTOCOL', 'unknown'); }
      this.accept(value, bytes);
      start = newline + 1;
    }
  }
  end(): void { if (this.bytes) throw new CodexTransportError('PROTOCOL', 'unknown'); }
  clear(): void { this.bytes = 0; }
}

/** Serialize only validated data; toJSON/getters cannot bypass the encoded byte budget. */
export function encodeJsonLine(value: unknown, maximum: number): Buffer {
  let bytes = 0;
  const parts: string[] = [];
  const ancestors = new Set<object>();
  const add = (text: string) => {
    bytes += Buffer.byteLength(text);
    if (bytes > maximum) throw new CodexTransportError('LIMIT', 'not-sent');
    parts.push(text);
  };
  const invalid = () => { throw new CodexTransportError('INVALID_OPTIONS', 'not-sent'); };
  const string = (text: string) => {
    if (Buffer.byteLength(text) > maximum) throw new CodexTransportError('LIMIT', 'not-sent');
    add(JSON.stringify(text));
  };
  const visit = (item: unknown, depth: number): void => {
    if (depth > 64) invalid();
    if (item === null) { add('null'); return; }
    if (typeof item === 'boolean') { add(item ? 'true' : 'false'); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) invalid(); add(String(item)); return; }
    if (typeof item === 'string') { string(item); return; }
    if (typeof item !== 'object' || !item) invalid();
    const object = item as object;
    if (ancestors.has(object) || Object.getOwnPropertySymbols(object).length) invalid();
    ancestors.add(object);
    if (Array.isArray(item)) {
      add('[');
      for (let index = 0; index < item.length; index++) {
        if (index) add(',');
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !('value' in descriptor)) invalid();
        visit(descriptor!.value, depth + 1);
      }
      add(']');
    } else {
      if (Object.getPrototypeOf(object) !== Object.prototype && Object.getPrototypeOf(object) !== null) invalid();
      add('{'); let count = 0;
      for (const key in object) {
        if (!Object.hasOwn(object, key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
        if (!('value' in descriptor)) invalid();
        if (count++) add(','); string(key); add(':'); visit(descriptor.value, depth + 1);
      }
      add('}');
    }
    ancestors.delete(object);
  };
  visit(value, 0);
  return Buffer.from(`${parts.join('')}\n`);
}
