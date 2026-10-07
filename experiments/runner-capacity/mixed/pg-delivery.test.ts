import { expect, test, vi } from 'vitest';
import { createPgDelivery, type DeliveryMessage, type DeliveryOptions } from './pg-delivery.js';
import { observePg, type PgObservation } from './observe-pg.js';
import { childReporter } from './channel.js';
import { CONTRACT } from './contract.js';

const event = (kind: PgObservation['kind'] = 'pool-acquisition'): PgObservation => ({ kind, poolId: 1, poolRole: 'center', backendPid: 7,
  startedMs: 12, elapsedMs: 3, outcome: 'ok', total: 8, idle: 0, waiting: 2, ...(kind === 'sql' ? { category: 'other' } : {}) });
function setup(mode: DeliveryOptions['mode'] = 'buffered', limits?: DeliveryOptions['limits']) {
  const messages: DeliveryMessage[] = []; const invalid = vi.fn();
  const delivery = createPgDelivery({ mode, epoch: 'one_epoch', limits, invalidate: invalid, emit(message) { messages.push(message); return true; } });
  return { delivery, messages, invalid };
}

test('per-query delivery preserves real observer promise and original rejection while carrying local phase', async () => {
  const { delivery, messages } = setup('per-query'); const failure = new Error('private'); let time = 0;
  const response = Promise.resolve({ rows: [] }); const rejected = Promise.reject(failure); void rejected.catch(() => {});
  const client = { query(this: unknown, sql: string) { expect(this).toBe(client); return sql === 'fail' ? rejected : response; } };
  const acquired = Promise.resolve(client); const prototype = { connect() { return acquired; } }; const pool = Object.create(prototype);
  const observer = observePg(prototype, delivery.record, () => time++);
  try {
    expect(pool.connect()).toBe(acquired); await acquired; delivery.setPhase('measure');
    expect(client.query('BEGIN')).toBe(response); await response;
    expect(client.query('COMMIT')).toBe(response); await response;
    expect(client.query('fail')).toBe(rejected); await expect(rejected).rejects.toBe(failure);
    expect(delivery.finish()).toMatchObject({ known: true, observed: 5, counts: { 'pool-acquisition': 1, sql: 3, transaction: 1 } });
    expect(messages.map(value => value.kind === 'pg-observation' && value.sample.phase)).toEqual(['before', 'measure', 'measure', 'measure', 'measure']);
    expect(JSON.stringify(messages)).not.toContain('private'); expect(observer.dropped).toBe(0);
  } finally { observer.restore(); }
});

test('buffered observer keeps callback this, release, return and error identity when the sink fails', () => {
  const failure = new Error('private failure'); const returned = {}; const receiver = {}; const release = vi.fn();
  let done = 0; const invalid = vi.fn();
  const delivery = createPgDelivery({ mode: 'buffered', epoch: 'callback', emit() { throw failure; }, invalidate: invalid });
  const client = { query(_sql: string, callback: (error: Error) => void) { callback.call(receiver, failure); return returned; } };
  const prototype = { connect(callback: (...args: unknown[]) => void) { callback.call(receiver, null, client, release); return returned; } };
  const observer = observePg(prototype, delivery.record);
  try {
    expect(Object.create(prototype).connect(function(this: unknown, error: unknown, value: unknown, free: unknown) {
      expect(this).toBe(receiver); expect(error).toBeNull(); expect(value).toBe(client); expect(free).toBe(release); done++;
    })).toBe(returned);
    expect(client.query('BEGIN', function(this: unknown, error) { expect(this).toBe(receiver); expect(error).toBe(failure); done++; })).toBe(returned);
    expect(done).toBe(2); expect(delivery.finish()).toMatchObject({ known: false, failure: 'sink_unknown' });
    expect(invalid).toHaveBeenCalledTimes(1); expect(release).not.toHaveBeenCalled();
  } finally { observer.restore(); }
});

test('buffered samples detach caller mutation, retain phase and exact timing, and aggregate finite SQL categories', () => {
  const { delivery, messages } = setup(); const input = event(); delivery.record(input); input.elapsedMs = 999;
  delivery.setPhase('measure'); delivery.record(event('transaction')); delivery.record(event('sql')); delivery.record(event('sql'));
  delivery.setPhase('after'); delivery.record(event('sql')); expect(messages).toEqual([]);
  const result = delivery.finish(); expect(result).toMatchObject({ known: true, observed: 5, sampleCount: 2, sqlGroups: 2 });
  const chunks = messages.filter(value => value.kind === 'pg-observation-chunk');
  expect(chunks.flatMap(value => value.samples).map(value => [value.phase, value.startedMs, value.elapsedMs])).toEqual([['before', 12, 3], ['measure', 12, 3]]);
  expect(chunks.flatMap(value => value.sql).map(value => [value.phase, value.count, value.elapsedMs])).toEqual([['measure', 2, 6], ['after', 1, 3]]);
  expect(delivery.finish()).toEqual(result); expect(messages).toHaveLength(1);
});

test('both delivery modes retain the same observed denominators without per-query IPC in buffered mode', () => {
  const a = setup('per-query'); const b = setup('buffered');
  const events = [event(), event('sql'), event('sql'), event('transaction')];
  for (const value of events) { a.delivery.record(value); b.delivery.record(value); }
  expect(a.messages).toHaveLength(4); expect(b.messages).toHaveLength(0);
  expect(a.delivery.finish().counts).toEqual(b.delivery.finish().counts);
  expect(b.messages).toHaveLength(1);
});

test.each([
  ['sample_limit', { samplesPerKind: 1 }, [event(), event()]],
  ['byte_limit', { bytes: 1 }, [event()]],
  ['group_limit', { sqlGroups: 1 }, [event('sql'), { ...event('sql'), category: 'begin' }]],
] as const)('capacity %s stays unknown without resending incomplete data', (failure, limits, events) => {
  const { delivery, messages, invalid } = setup('buffered', limits);
  for (const value of events) delivery.record(value);
  expect(delivery.finish()).toMatchObject({ known: false, failure }); expect(messages).toHaveLength(0);
  delivery.record(event()); delivery.finish(); expect(invalid).toHaveBeenCalledTimes(1);
});

test('bounded chunks retain every sample exactly once and obey the JSON payload byte bound', () => {
  const { delivery, messages } = setup('buffered', { chunkBytes: 512 });
  for (let i = 0; i < 10; i++) delivery.record({ ...event(), startedMs: i });
  const result = delivery.finish(); expect(result.known).toBe(true); expect(messages.length).toBeGreaterThan(1);
  expect(messages.every(value => Buffer.byteLength(JSON.stringify(value)) <= 512)).toBe(true);
  expect(messages.flatMap(value => value.kind === 'pg-observation-chunk' ? value.samples : []).map(value => value.ordinal)).toEqual([1,2,3,4,5,6,7,8,9,10]);
});

test('a partially accepted flush stays unknown and is never retried', () => {
  let calls = 0; const invalid = vi.fn();
  const delivery = createPgDelivery({ mode: 'buffered', epoch: 'partial', limits: { chunkBytes: 512 }, invalidate: invalid, emit: () => ++calls < 2 });
  for (let i = 0; i < 5; i++) delivery.record(event());
  expect(delivery.finish()).toMatchObject({ known: false, failure: 'sink_unknown', outputMessages: 1 });
  delivery.finish(); expect(calls).toBe(2); expect(invalid).toHaveBeenCalledTimes(1);
});

test('invalid time, phase reversal and post-finish observations fail closed without changing a first fault', () => {
  const { delivery, messages, invalid } = setup();
  delivery.setPhase('measure'); delivery.record({ ...event(), elapsedMs: Number.NaN }); delivery.setPhase('before');
  expect(delivery.finish()).toMatchObject({ known: false, failure: 'invalid_observation' }); expect(messages).toHaveLength(0); expect(invalid).toHaveBeenCalledTimes(1);
  const b = setup(); b.delivery.setPhase('after'); b.delivery.setPhase('measure'); expect(b.delivery.finish().failure).toBe('phase_order');
  const c = setup(); c.delivery.finish(); c.delivery.record(event()); expect(c.delivery.status().failure).toBe('closed');
});

test('childReporter accepts chunks on the existing bounded IPC seam; local acceptance is not an ACK', () => {
  const previous = process.send; const sent: unknown[] = []; const stop = vi.fn();
  const reporter = childReporter(stop, () => CONTRACT);
  process.send = ((message: unknown, callback: (error: Error | null) => void) => { sent.push(message); callback(null); return true; }) as typeof process.send;
  try {
    const delivery = createPgDelivery({ mode: 'buffered', epoch: 'ipc', invalidate: stop, emit(message) { reporter.send(message); return reporter.dropped === 0; } });
    delivery.record(event()); expect(delivery.finish().known).toBe(true); expect(sent).toHaveLength(1);
    expect(reporter.pending).toBe(0); expect(reporter.dropped).toBe(0); expect(stop).not.toHaveBeenCalled();
  } finally { process.send = previous; reporter.close(); }
});
