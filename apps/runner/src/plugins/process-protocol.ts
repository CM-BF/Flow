import { once } from 'node:events';
import type { Writable } from 'node:stream';
import { z } from 'zod';

export const PROCESS_PROTOCOL = 'flow.trusted-plugin-process.v2';
export const FRAME_TOTAL = 256 * 1024;
const identity = z.strictObject({ nonce: z.string().regex(/^[a-f0-9]{32}$/), bindingId: z.uuid(), invocationId: z.uuid(),
  taskId: z.uuid(), attemptId: z.uuid(), ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export type ProcessIdentity = z.infer<typeof identity>;
const envelope = { protocol: z.literal(PROCESS_PROTOCOL), identity, sequence: z.number().int().min(1).max(16) };
export const frameSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...envelope, kind: z.literal('init'), executionKind: z.enum(['tool', 'verifier']), value: z.unknown() }),
  z.strictObject({ ...envelope, kind: z.literal('check') }),
  z.strictObject({ ...envelope, kind: z.literal('authorize'), phase: z.enum(['load', 'invoke']) }),
  z.strictObject({ ...envelope, kind: z.literal('ack'), request: z.number().int().min(1).max(16), ok: z.boolean() }),
  z.strictObject({ ...envelope, kind: z.literal('result'), value: z.unknown() }),
  z.strictObject({ ...envelope, kind: z.literal('error'), code: z.enum(['PACKAGE_FAILED', 'OUTCOME_UNKNOWN', 'CANCELLED', 'INVALID_INPUT', 'MATERIAL_MISMATCH', 'PACKAGE_KIND_MISMATCH', 'HOST_API_MISMATCH', 'OUTPUT_REJECTED']) }),
  z.strictObject({ ...envelope, kind: z.literal('abort') }),
]);
export type ProcessFrame = z.infer<typeof frameSchema>;
export function sameIdentity(a: ProcessIdentity, b: ProcessIdentity): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key as keyof ProcessIdentity] === b[key as keyof ProcessIdentity]);
}
export function frameLimit(kind: ProcessFrame['kind']): number { return kind === 'init' ? 192 * 1024 : kind === 'result' ? 128 * 1024 : 4096; }

/** Prefix checked before frame allocation; no concatenation of an unbounded input chunk. */
export class FrameReader {
  private prefix = Buffer.alloc(4); private prefixUsed = 0; private body: Buffer | undefined; private used = 0;
  private total = 0; private sequence = 0;
  constructor(private readonly maximumFrame: number, private readonly accept: (frame: ProcessFrame) => void) {}
  push(chunk: Buffer): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (!this.body) {
        const n = Math.min(4 - this.prefixUsed, chunk.length - offset); chunk.copy(this.prefix, this.prefixUsed, offset, offset + n);
        offset += n; this.prefixUsed += n; if (this.prefixUsed < 4) continue;
        const length = this.prefix.readUInt32BE();
        if (!length || length > this.maximumFrame || this.total + length > FRAME_TOTAL || this.sequence >= 16) throw new Error('PROCESS_FRAME_LIMIT');
        this.total += length; this.body = Buffer.alloc(length); this.used = 0;
      }
      const n = Math.min(this.body.length - this.used, chunk.length - offset); chunk.copy(this.body, this.used, offset, offset + n);
      offset += n; this.used += n; if (this.used < this.body.length) continue;
      const bytes = this.body; this.body = undefined; this.prefixUsed = 0;
      const frame = frameSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      if (frame.sequence !== ++this.sequence || bytes.length > frameLimit(frame.kind)) throw new Error('PROCESS_FRAME_INVALID');
      this.accept(frame);
    }
  }
  end(): void { if (this.prefixUsed || this.body) throw new Error('PROCESS_FRAME_TRUNCATED'); }
}
export class FrameWriter {
  private sequence = 0; private total = 0;
  constructor(private readonly output: Writable, private readonly identity: ProcessIdentity) {}
  async send(value: Record<string, unknown>): Promise<void> {
    const frame = frameSchema.parse({ ...value, protocol: PROCESS_PROTOCOL, identity: this.identity, sequence: ++this.sequence });
    const body = Buffer.from(JSON.stringify(frame)); this.total += body.length;
    if (body.length > frameLimit(frame.kind) || this.total > FRAME_TOTAL) throw new Error('PROCESS_FRAME_LIMIT');
    const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
    if (!this.output.write(Buffer.concat([header, body]))) await once(this.output, 'drain');
  }
}
