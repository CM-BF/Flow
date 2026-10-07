import { describe, expect, it, vi } from 'vitest';
import { createPgDelivery, type DeliveryMessage } from './pg-delivery.js';
import type { PgObservation } from './observe-pg.js';

const event = (index: number): PgObservation => ({ kind: 'pool-acquisition', poolId: 1, poolRole: 'center',
  backendPid: 7, startedMs: index, elapsedMs: 0.125, outcome: 'ok', total: 8, idle: 0, waiting: 2 });
function collect(count: number, chunkBytes = 65536, epoch = 'packing') {
  const messages: DeliveryMessage[] = [];
  const delivery = createPgDelivery({ mode: 'buffered', epoch, limits: { chunkBytes },
    emit: message => { messages.push(message); return true; }, invalidate: () => {} });
  for (let index = 0; index < count; index++) delivery.record(event(index));
  return { delivery, messages };
}

describe('chunk packing', () => {
  it('bounds encoding work by output size without repeatedly encoding growing prefixes', () => {
    const { delivery, messages } = collect(512);
    for (let index = 0; index < 64; index++) delivery.record({ ...event(index), kind: 'sql', poolId: index + 1, category: 'other' });
    const stringify = JSON.stringify; let encodedWorkBytes = 0;
    const spy = vi.spyOn(JSON, 'stringify').mockImplementation(value => {
      const result = stringify(value); if (typeof result === 'string') encodedWorkBytes += Buffer.byteLength(result); return result;
    });
    let result: ReturnType<typeof delivery.finish>;
    try { result = delivery.finish(); } finally { spy.mockRestore(); }
    const outputBytes = messages.reduce((sum, message) => sum + Buffer.byteLength(stringify(message)), 0);
    console.log(JSON.stringify({ evidence: 'finish-encoding-work', rows: 576, encodedWorkBytes, outputBytes }));
    expect(result!.known).toBe(true);
    expect(result!.outputBytes).toBe(outputBytes);
    expect(encodedWorkBytes).toBeLessThanOrEqual(3 * outputBytes + 1024);
    const chunks = messages.filter(message => message.kind === 'pg-observation-chunk');
    expect(chunks.flatMap(message => message.samples).map(sample => sample.ordinal)).toEqual(Array.from({ length: 512 }, (_, i) => i + 1));
    expect(chunks.flatMap(message => message.sql).map(total => [total.poolId, total.count, total.elapsedMs])).toEqual(Array.from({ length: 64 }, (_, i) => [i + 1, 1, 0.125]));
    expect(delivery.finish()).toEqual(result!);
  });

  it('keeps exact-fit boundaries, comma bytes and chunk ordinal digit changes', () => {
    const boundaryEpoch = 'packing-boundary-fixture';
    const reference = collect(3, 65536, boundaryEpoch); reference.delivery.finish();
    const referenceChunk = reference.messages[0]!;
    if (referenceChunk.kind !== 'pg-observation-chunk') throw new Error('wrong message');
    const twoBytes = Buffer.byteLength(JSON.stringify({ ...referenceChunk, samples: referenceChunk.samples.slice(0, 2) }));
    expect(twoBytes).toBeGreaterThanOrEqual(512);
    const exact = collect(3, twoBytes, boundaryEpoch); exact.delivery.finish();
    expect(exact.messages.map(message => message.kind === 'pg-observation-chunk' ? message.samples.length : -1)).toEqual([2, 1]);
    const below = collect(3, twoBytes - 1, boundaryEpoch); below.delivery.finish();
    expect(below.messages.map(message => message.kind === 'pg-observation-chunk' ? message.samples.length : -1)).toEqual([1, 1, 1]);
    const many = collect(130, 512, boundaryEpoch); expect(many.delivery.finish().known).toBe(true);
    expect(many.messages.length).toBeGreaterThan(100);
    many.messages.forEach((message, index) => {
      expect(message).toMatchObject({ kind: 'pg-observation-chunk', ordinal: index });
      expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThanOrEqual(512);
    });
    const mixed = (limit: number) => {
      const value = collect(1, limit, 'two-array-boundary-'.repeat(4));
      for (const poolId of [1, 2]) value.delivery.record({ ...event(0), poolId, kind: 'sql', category: 'other' });
      expect(value.delivery.finish().known).toBe(true); return value.messages;
    };
    const full = mixed(65536)[0]!;
    if (full.kind !== 'pg-observation-chunk') throw new Error('wrong message');
    const mixedExactBytes = Buffer.byteLength(JSON.stringify({ ...full, sql: full.sql.slice(0, 1) }));
    expect(mixedExactBytes).toBeGreaterThanOrEqual(512);
    expect(mixed(mixedExactBytes).map(message => message.kind === 'pg-observation-chunk' && [message.samples.length, message.sql.length])).toEqual([[1, 1], [0, 1]]);
  });

  it('rejects an oversized item and does not admit private Unicode or escaped input fields', () => {
    const messages: DeliveryMessage[] = []; const invalid = vi.fn(); const toJSON = vi.fn();
    const delivery = createPgDelivery({ mode: 'buffered', epoch: 'unicode', emit: value => { messages.push(value); return true; }, invalidate: invalid });
    const input = { ...event(0), query: '私有😀\n"\\', toJSON };
    delivery.record(input); expect(delivery.finish().known).toBe(true);
    expect(JSON.stringify(messages)).not.toContain('私有'); expect(toJSON).not.toHaveBeenCalled();
    expect(() => collect(0, 512, 'illegal😀')).toThrow('pg_delivery_invalid_identity');
    const oversized = collect(1, 512, 'e'.repeat(128));
    expect(oversized.delivery.finish()).toMatchObject({ known: false, failure: 'chunk_limit', outputMessages: 0 });
    expect(oversized.messages).toEqual([]); expect(invalid).not.toHaveBeenCalled();
  });

  it('rechecks the complete encoded envelope before the sink even if its size differs from packing', () => {
    const { delivery, messages } = collect(1, 512);
    const stringify = JSON.stringify;
    const spy = vi.spyOn(JSON, 'stringify').mockImplementation(value => {
      const result = stringify(value);
      const message = value as Partial<DeliveryMessage>;
      // Synthetic final-encoding mismatch: never let packing arithmetic replace the final check.
      return message?.kind === 'pg-observation-chunk' && 'samples' in message && message.samples?.length ? result + ' '.repeat(512) : result;
    });
    try { expect(delivery.finish()).toMatchObject({ known: false, failure: 'chunk_limit', outputMessages: 0 }); }
    finally { spy.mockRestore(); }
    expect(messages).toEqual([]);
  });
});
