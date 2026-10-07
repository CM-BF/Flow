import { createPgDelivery, type DeliveryOptions, type DeliveryPhase } from './pg-delivery.js';
import type { RecordValue } from './channel.js';
export const DELIVERY_ENVELOPE_BYTES = 64 * 1024;
export const DELIVERY_BASELINE = '4fdd856293a502209d7509ea37da901bbfd89f72';
export type DeliveryInput = { mode: DeliveryOptions['mode']; epoch: string };
export function deliveryInput(value: DeliveryInput): DeliveryInput {
  if (!value || !['per-query', 'buffered'].includes(value.mode) || !/^[A-Za-z0-9_-]{1,128}$/.test(value.epoch)) throw new Error('pg_delivery_invalid_identity');
  return { mode: value.mode, epoch: value.epoch };
}
/** The actual center consumes this seam. Reporter enforces the complete envelope bound. */
export function centerDelivery(input: DeliveryInput, send: (message: RecordValue) => boolean, fail: () => void) {
  const config = deliveryInput(input);
  const delivery = createPgDelivery({ ...config, emit: send, invalidate: fail,
    limits: { chunkBytes: DELIVERY_ENVELOPE_BYTES - 256 } }); // Includes margin for reporter pid/childMs; actual cap is checked again.
  let finished = false;
  let finishing: Promise<ReturnType<typeof delivery.status>> | undefined;
  return { record: delivery.record, phase(epoch: unknown, next: unknown) {
    if (epoch !== config.epoch || !['measure', 'after'].includes(String(next))) { fail(); return; }
    delivery.setPhase(next as DeliveryPhase);
    if (!delivery.status().known || !send({ kind: 'pg-phase-ack', epoch, deliveryPhase: next, localPhaseAtMs: performance.now() })) fail();
  }, finishAsync(sendAsync: (message: RecordValue) => Promise<boolean>) {
    if (finishing) return finishing;
    if (finished) return Promise.resolve(delivery.status());
    finished = true;
    finishing = (async () => {
      const summary = await delivery.finishAsync(sendAsync);
      if (!summary.known) { fail(); return summary; }
      try {
        if (await sendAsync({ kind: 'pg-delivery-summary', ...summary, deliveryPhase: summary.phase })) return summary;
      } catch { /* Transport failure leaves the receiver authoritative and incomplete. */ }
      fail();
      return { ...summary, known: false, failure: 'sink_unknown' as const };
    })();
    return finishing;
  }, finish() {
    if (finished) return delivery.status();
    const summary = delivery.finish();
    finished = true;
    if (!summary.known || !send({ kind: 'pg-delivery-summary', ...summary, deliveryPhase: summary.phase })) fail();
    return summary;
  } };
}
/** Driver receipt accounting. Does not restamp nested samples with IPC arrival phase. */
export function deliveryReceipt(input: DeliveryInput, fail: () => void) {
  const config = deliveryInput(input); let messages = 0; let ordinal = 0; let sampleOrdinal = 0; let summarySeen = false; let invalid = false;
  const counts = { 'pool-acquisition': 0, sql: 0, transaction: 0 };
  function reject() { invalid = true; fail(); }
  function sample(value: Record<string, unknown>, buffered: boolean) {
    if (value.epoch !== config.epoch || !['before', 'measure', 'after'].includes(String(value.phase)) ||
        !Number.isSafeInteger(value.ordinal) || Number(value.ordinal) <= sampleOrdinal || !buffered && value.ordinal !== sampleOrdinal + 1 ||
        !['pool-acquisition', 'transaction', ...(buffered ? [] : ['sql'])].includes(String(value.kind))) throw new Error('pg_delivery_sample_unknown');
    sampleOrdinal = Number(value.ordinal); counts[value.kind as keyof typeof counts]++;
  }
  function accept(value: RecordValue) {
    if (!['pg-observation', 'pg-observation-chunk', 'pg-delivery-summary'].includes(value.kind)) return;
    try {
      if (summarySeen || invalid) throw new Error('pg_delivery_after_summary');
      if (value.kind === 'pg-observation') {
        if (config.mode !== 'per-query') throw new Error('pg_delivery_mode');
        sample(value.sample as Record<string, unknown>, false); messages++;
      } else if (value.kind === 'pg-observation-chunk') {
        if (config.mode !== 'buffered' || value.epoch !== config.epoch || value.ordinal !== ordinal++ || !Array.isArray(value.samples) || !Array.isArray(value.sql)) throw new Error('pg_delivery_chunk_unknown');
        for (const item of value.samples) sample(item, true);
        for (const item of value.sql) {
          if (!['before', 'measure', 'after'].includes(item.phase) || !Number.isSafeInteger(item.count) || item.count < 1 || !Number.isFinite(item.elapsedMs) || item.elapsedMs < 0) throw new Error('pg_delivery_total_unknown');
          if (!Number.isSafeInteger(counts.sql + item.count)) throw new Error('pg_delivery_count_unknown');
          counts.sql += item.count;
        }
        messages++;
      } else {
        const expected = value.counts as typeof counts;
        if (value.mode !== config.mode || value.epoch !== config.epoch || value.known !== true || value.closed !== true || value.outputMessages !== messages ||
            !Object.keys(counts).every(key => counts[key as keyof typeof counts] === expected[key as keyof typeof counts]) ||
            value.observed !== counts.sql + counts.transaction + counts['pool-acquisition']) throw new Error('pg_delivery_summary_unknown');
        summarySeen = true;
      }
    } catch { reject(); }
  }
  return { accept, complete() { if (!summarySeen || invalid) reject(); return summarySeen && !invalid; } };
}
