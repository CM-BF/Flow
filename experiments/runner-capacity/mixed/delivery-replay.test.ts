import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PgObservation } from './observe-pg.js';
import type { RecordValue } from './channel.js';
import { centerDelivery, type DeliveryInput } from './pg-delivery-bridge.js';
import { decodeReplayTrace, feedReplay, replayReceiver, type ReplayTrace } from './delivery-replay.js';

const event = (kind: PgObservation['kind'], elapsedMs: number): PgObservation => ({ kind, poolId: 1,
  poolRole: 'center', backendPid: 42, startedMs: 100, elapsedMs, outcome: 'ok', total: 8, idle: 0, waiting: 12,
  ...(kind === 'sql' ? { category: 'other' } : {}) });
function traceOf(events = [event('sql', 1.25), event('pool-acquisition', 3), event('sql', 2.5), event('transaction', 4)]) {
  const bytes = Buffer.from(JSON.stringify({ version: 1, epoch: 'replay-test',
    rows: events.map((value, index) => ({ originalOrdinal: index * 3 + 11, phase: 'measure', event: value })) }));
  return decodeReplayTrace(bytes, createHash('sha256').update(bytes).digest('hex'), events.length);
}
function messages(trace: ReplayTrace, mode: DeliveryInput['mode']) {
  const output: RecordValue[] = [];
  const delivery = centerDelivery({ mode, epoch: trace.epoch }, value => {
    output.push(structuredClone({ ...value, pid: 12, childMs: 1 })); return true;
  }, () => { throw new Error('unexpected delivery failure'); });
  delivery.phase(trace.epoch, 'measure');
  trace.rows.forEach(row => delivery.record(row.event));
  delivery.finish();
  return output;
}
function received(trace: ReplayTrace, mode: DeliveryInput['mode'], output: RecordValue[]) {
  const receiver = replayReceiver(trace, mode); output.forEach(receiver.accept); return receiver.complete();
}

describe('finite observation delivery replay', () => {
  it.each(['per-query', 'buffered'] as const)('validates full semantics and new ordinal mapping for %s', mode => {
    const trace = traceOf(); const output = messages(trace, mode);
    expect(received(trace, mode, output).known).toBe(true);
    expect(trace.rows.map(row => row.originalOrdinal)).toEqual([11, 14, 17, 20]);
    const sample = mode === 'per-query' ? output[1]!.sample : (output[1]!.samples as unknown[])[0];
    expect(sample).toMatchObject({ ordinal: mode === 'per-query' ? 1 : 2, phase: 'measure', epoch: trace.epoch });
    if (mode === 'buffered') expect(output[1]!.sql).toEqual([{ phase: 'measure', poolId: 1, poolRole: 'center', category: 'other', outcome: 'ok', count: 2, elapsedMs: 3.75 }]);
    expect(received(trace, mode, [...output, output.at(-1)!]).known).toBe(false);
  });

  it('rejects altered group keys, elapsed totals, counts and duplicates even when total SQL count could agree', () => {
    const trace = traceOf();
    for (const change of [{ category: 'begin' }, { elapsedMs: 3.5 }, { poolId: 2 }, { count: 1 }, { outcome: 'error' }]) {
      const output = messages(trace, 'buffered');
      Object.assign((output[1]!.sql as Record<string, unknown>[])[0]!, change);
      expect(received(trace, 'buffered', output).known).toBe(false);
    }
    const output = messages(trace, 'buffered'); const groups = output[1]!.sql as Record<string, unknown>[];
    groups.push(structuredClone(groups[0]!));
    expect(received(trace, 'buffered', output).known).toBe(false);
  });

  it('rejects nonSQL field drift, gaps, duplicates and reordered samples', () => {
    const trace = traceOf();
    for (const mutation of ['elapsed', 'missing', 'duplicate', 'reorder']) {
      const output = messages(trace, 'buffered'); const rows = output[1]!.samples as Record<string, unknown>[];
      if (mutation === 'elapsed') rows[0]!.elapsedMs = 100;
      if (mutation === 'missing') rows.pop();
      if (mutation === 'duplicate') rows.push(structuredClone(rows[0]!));
      if (mutation === 'reorder') rows.reverse();
      expect(received(trace, 'buffered', output).known).toBe(false);
    }
  });

  it('requires one phase ACK before data and bounds the complete JSON envelope', () => {
    const trace = traceOf(); const output = messages(trace, 'per-query');
    expect(received(trace, 'per-query', output.slice(1)).known).toBe(false);
    expect(received(trace, 'per-query', [output[0]!, output[0]!, ...output.slice(1)]).known).toBe(false);
    expect(received(trace, 'per-query', [{ kind: 'unrecognized' }, ...output]).known).toBe(false);
    expect(received(trace, 'per-query', [output[0]!, { ...output[1]!, padding: 'x'.repeat(65536) }, ...output.slice(2)]).known).toBe(false);
  });

  it('rejects trace hash mismatch, nonmeasure rows, duplicate original ordinals and extra private fields', () => {
    const base = { version: 1, epoch: 'replay-test', rows: [{ originalOrdinal: 1, phase: 'measure', event: event('sql', 1) }] };
    const bytes = Buffer.from(JSON.stringify(base));
    expect(() => decodeReplayTrace(bytes, '0'.repeat(64), 1)).toThrow('trace_hash');
    const variants = [
      { ...base, rows: [{ ...base.rows[0]!, phase: 'before' }] },
      { ...base, rows: [base.rows[0]!, base.rows[0]!] },
      { ...base, rows: [{ ...base.rows[0]!, event: { ...base.rows[0]!.event, query: 'private' } }] },
    ];
    for (const variant of variants) {
      const payload = Buffer.from(JSON.stringify(variant));
      expect(() => decodeReplayTrace(payload, createHash('sha256').update(payload).digest('hex'), variant.rows.length)).toThrow();
    }
  });

  it('uses 64 equal batches and records real synchronous time and waited time separately', async () => {
    const trace = traceOf(Array.from({ length: 2048 }, () => event('sql', 1)));
    let clock = 0; let count = 0; let waits = 0;
    const result = await feedReplay(trace, () => { clock += 0.25; count++; },
      async () => { expect(count % 32).toBe(0); waits++; clock += 2; }, () => clock, () => {});
    expect(result).toEqual({ recordPhaseWallMs: 640, synchronousRecordMs: 512, observedWaitMs: 128, batches: 64 });
    expect(count).toBe(2048); expect(waits).toBe(64);
  });

  it('stops before the next batch after cancellation without dropping rows to manufacture completeness', async () => {
    const trace = traceOf(Array.from({ length: 64 }, () => event('sql', 1))); let count = 0; let cancelled = false;
    await expect(feedReplay(trace, () => { count++; }, async () => { cancelled = true; }, () => 0,
      () => { if (cancelled) throw new Error('cancelled'); })).rejects.toThrow('cancelled');
    expect(count).toBe(32);
  });
});
