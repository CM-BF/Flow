import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { PgObservation } from './observe-pg.js';
import { deliveryReceipt, DELIVERY_ENVELOPE_BYTES, type DeliveryInput } from './pg-delivery-bridge.js';
import type { RecordValue } from './channel.js';

export type ReplayRow = Readonly<{ originalOrdinal: number; phase: 'measure'; event: PgObservation }>;
export type ReplayTrace = Readonly<{ epoch: string; rows: readonly ReplayRow[] }>;
type Sample = PgObservation & { epoch: string; phase: 'measure'; ordinal: number };
type SqlGroup = { phase: 'measure'; poolId: number; poolRole: string; category: string; outcome: PgObservation['outcome']; count: number; elapsedMs: number };
const eventKeys = ['backendPid', 'category', 'elapsedMs', 'idle', 'kind', 'outcome', 'poolId', 'poolRole', 'startedMs', 'total', 'waiting'];
const groupKeys = ['category', 'count', 'elapsedMs', 'outcome', 'phase', 'poolId', 'poolRole'];
const groupKey = (row: SqlGroup) => JSON.stringify([row.phase, row.poolId, row.poolRole, row.category, row.outcome]);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
export const encodedBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

/** Same offered batching for both modes; timing includes real waits, never subtracts an assumed timer. */
export async function feedReplay(trace: ReplayTrace, record: (event: PgObservation) => void,
  waitBatch: () => Promise<void>, now: () => number, assertActive: () => void) {
  const started = now(); let synchronousRecordMs = 0; let observedWaitMs = 0; let batches = 0;
  for (let index = 0; index < trace.rows.length; index += 32) {
    assertActive();
    for (const row of trace.rows.slice(index, index + 32)) {
      const before = now(); record(row.event); synchronousRecordMs += now() - before;
    }
    const before = now(); await waitBatch(); observedWaitMs += now() - before; batches++;
  }
  assertActive();
  return { recordPhaseWallMs: now() - started, synchronousRecordMs, observedWaitMs, batches };
}

/** Fixed-file decoder, not a new public stream or observer protocol. */
export function decodeReplayTrace(bytes: Buffer, sha256: string, expectedRows = 2048): ReplayTrace {
  assert(bytes.length <= 2 * 1024 * 1024, 'trace_byte_limit');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, 'trace_hash');
  const input = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  assert(input.version === 1 && typeof input.epoch === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input.epoch), 'trace_identity');
  assert(Array.isArray(input.rows) && input.rows.length === expectedRows && expectedRows > 0 && expectedRows <= 2048, 'trace_count');
  let last = 0;
  const rows: ReplayRow[] = input.rows.map((value: ReplayRow) => {
    assert(value && positive(value.originalOrdinal) && value.originalOrdinal > last && value.phase === 'measure', 'trace_order_phase');
    last = value.originalOrdinal;
    const event = value.event;
    assert(event && Object.keys(event).every(key => eventKeys.includes(key)), 'trace_event_keys');
    assert(['sql', 'pool-acquisition', 'transaction'].includes(event.kind) && event.poolRole === 'center' && positive(event.poolId), 'trace_event_identity');
    assert(event.backendPid === null || positive(event.backendPid), 'trace_backend');
    assert(['ok', 'error', 'throw'].includes(event.outcome) && finite(event.startedMs) && finite(event.elapsedMs), 'trace_numbers');
    assert([event.total, event.idle, event.waiting].every(n => Number.isSafeInteger(n) && n >= 0), 'trace_pool_counts');
    assert(event.category === undefined || ['begin', 'commit', 'rollback', 'runner-row', 'runner-row-share', 'other'].includes(event.category), 'trace_category');
    return Object.freeze({ originalOrdinal: value.originalOrdinal, phase: 'measure' as const, event: Object.freeze({ ...event }) });
  });
  const trace = Object.freeze({ epoch: input.epoch, rows: Object.freeze(rows) });
  const expected = expectedReplay(trace);
  assert(expected.nonSqlBytes <= 384 * 1024 && expected.sql.size <= 256 && expected.groupSlotBytes <= 128 * 1024, 'trace_buffer_preflight');
  return trace;
}

function expectedReplay(trace: ReplayTrace) {
  const samples = trace.rows.map((row, index): Sample => ({ ...row.event, epoch: trace.epoch, phase: row.phase, ordinal: index + 1 }));
  const sql = new Map<string, SqlGroup>();
  for (const sample of samples) if (sample.kind === 'sql') {
    const group: SqlGroup = { phase: sample.phase, poolId: sample.poolId, poolRole: sample.poolRole, category: sample.category ?? 'other', outcome: sample.outcome, count: 0, elapsedMs: 0 };
    const key = groupKey(group); const existing = sql.get(key) ?? group;
    existing.count++; existing.elapsedMs += sample.elapsedMs; sql.set(key, existing);
  }
  return { samples, sql, nonSqlBytes: samples.filter(row => row.kind !== 'sql').reduce((n, row) => n + encodedBytes(row), 0),
    groupSlotBytes: [...sql.values()].reduce((n, row) => n + encodedBytes({ ...row, count: Number.MAX_SAFE_INTEGER, elapsedMs: Number.MAX_VALUE }) + 32, 0) };
}

/** Complements the production experiment's count receipt with exact finite semantics. */
export function replayReceiver(trace: ReplayTrace, mode: DeliveryInput['mode']) {
  const expected = expectedReplay(trace); let fault: string | null = null;
  const base = deliveryReceipt({ mode, epoch: trace.epoch }, () => { fault ??= 'delivery_receipt'; });
  const receivedSamples = new Set<number>(); const receivedGroups = new Map<string, SqlGroup>();
  let phaseAck = false; let summary = false; let messages = 0; let bytes = 0;
  function sameSample(value: unknown, buffered: boolean) {
    const sample = value as Sample;
    assert(sample && positive(sample.ordinal), 'sample_ordinal');
    const wanted = expected.samples[sample.ordinal - 1];
    assert(wanted && (!buffered || wanted.kind !== 'sql') && !receivedSamples.has(sample.ordinal), 'sample_duplicate_or_extra');
    assert.deepEqual(sample, wanted, 'sample_semantics'); receivedSamples.add(sample.ordinal);
  }
  function sameGroup(value: unknown) {
    const group = value as SqlGroup;
    assert(group && Object.keys(group).sort().join(',') === groupKeys.join(','), 'group_keys');
    const key = groupKey(group); assert(!receivedGroups.has(key), 'group_duplicate');
    assert.deepEqual(group, expected.sql.get(key), 'group_semantics'); receivedGroups.set(key, group);
  }
  return {
    accept(message: RecordValue) {
      messages++; bytes += encodedBytes(message);
      try {
        assert(encodedBytes(message) <= DELIVERY_ENVELOPE_BYTES && bytes <= 2 * 1024 * 1024, 'full_envelope_limit');
        assert(!summary, 'message_after_summary');
        if (message.kind === 'pg-phase-ack') {
          assert(!phaseAck && message.epoch === trace.epoch && message.deliveryPhase === 'measure' && finite(message.localPhaseAtMs), 'phase_ack');
          phaseAck = true; return;
        }
        assert(phaseAck, 'sample_before_phase');
        if (message.kind === 'pg-observation') { assert.equal(mode, 'per-query'); sameSample(message.sample, false); }
        else if (message.kind === 'pg-observation-chunk') {
          assert.equal(mode, 'buffered'); assert(Array.isArray(message.samples) && Array.isArray(message.sql), 'chunk_shape');
          for (const sample of message.samples) sameSample(sample, true);
          for (const group of message.sql) sameGroup(group);
        } else { assert.equal(message.kind, 'pg-delivery-summary', 'unexpected_delivery_message'); summary = true; }
        base.accept(message);
      } catch (error) { fault ??= error instanceof Error ? error.message.split('\n')[0] ?? 'receipt_unknown' : 'receipt_unknown'; }
    },
    complete() {
      const baseComplete = base.complete();
      const wantedSamples = expected.samples.filter(row => mode === 'per-query' || row.kind !== 'sql');
      if (!phaseAck || !summary || !baseComplete || receivedSamples.size !== wantedSamples.length || mode === 'buffered' && receivedGroups.size !== expected.sql.size) fault ??= 'receipt_incomplete';
      return { known: fault === null, fault, inputRows: trace.rows.length, samples: receivedSamples.size, sqlGroups: receivedGroups.size, messages, jsonEnvelopeBytes: bytes,
        bytesBasis: 'UTF8 JSON.stringify of application envelopes, not OS IPC wire bytes' };
    },
  };
}
