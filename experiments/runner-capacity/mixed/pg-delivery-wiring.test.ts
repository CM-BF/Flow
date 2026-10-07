import { expect, test, vi } from 'vitest';
import { centerDelivery, deliveryReceipt, DELIVERY_ENVELOPE_BYTES } from './pg-delivery-bridge.js';
import { createClaimObservation } from './claim-observation.js';
import { childReporter, type RecordValue } from './channel.js';
import { CONTRACT } from './contract.js';
import { launch, transmit } from './process.js';
import { stopProcess, type OwnedProcess } from '../processes.js';
import type { PgObservation } from './observe-pg.js';
const input = { epoch: 'local_epoch_1', mode: 'buffered' as const };
const event: PgObservation = { kind: 'pool-acquisition', poolId: 1, poolRole: 'center', backendPid: 123, startedMs: 10, elapsedMs: 2, total: 8, idle: 0, waiting: 3, outcome: 'ok' };
const request = { protocol: 'flow.runner-claim.v2', runnerId: 'runner', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const identity = { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 2 };
const assigned = () => ({ ...request, state: 'assigned', identity: { ...identity }, remainingLeaseMs: 9999,
  assignment: { task: { id: 'task' }, attempt: { id: 'attempt', runnerId: 'runner', ownerVersion: 2 } } });

test.each(['per-query', 'buffered'] as const)('actual center/reporter/driver seams preserve local phases and settle counts in %s', mode => {
  const previous = process.send; const messages: RecordValue[] = []; const failed = vi.fn(); const config = { ...input, mode };
  const receipt = deliveryReceipt(config, failed); const reporter = childReporter(failed, () => CONTRACT, () => DELIVERY_ENVELOPE_BYTES);
  process.send = ((message: RecordValue, callback: (error: Error | null) => void) => {
    messages.push(message); receipt.accept({ ...message, phase: 'driver-cleanup' }); callback(null); return true;
  }) as typeof process.send;
  try {
    const center = centerDelivery(config, reporter.send, failed);
    center.record(event); center.phase(config.epoch, 'measure'); center.record({ ...event, kind: 'sql', category: 'begin' }); center.record({ ...event, kind: 'transaction' });
    center.phase(config.epoch, 'after'); center.record(event); const summary = center.finish();
    expect(summary).toMatchObject({ known: true, observed: 4, counts: { 'pool-acquisition': 2, sql: 1, transaction: 1 } });
    const sentCount = messages.length; center.finish(); expect(messages).toHaveLength(sentCount);
    expect(receipt.complete()).toBe(true); expect(failed).not.toHaveBeenCalled(); expect(reporter.pending).toBe(0);
    const samples = messages.flatMap(value => value.kind === 'pg-observation' ? [value.sample] : value.kind === 'pg-observation-chunk' ? value.samples as unknown[] : []) as { phase: string }[];
    expect(samples.map(value => value.phase)).toEqual(mode === 'buffered' ? ['before', 'measure', 'after'] : ['before', 'measure', 'measure', 'after']);
    expect(messages.every(value => Buffer.byteLength(JSON.stringify(value)) <= DELIVERY_ENVELOPE_BYTES)).toBe(true);
  } finally { reporter.close(); process.send = previous; }
});

test('full envelope cap includes reporter fields and cumulative/pending charges retain failure', () => {
  const previous = process.send; const stop = vi.fn(); const callbacks: ((error: Error | null) => void)[] = [];
  process.send = ((_message: unknown, callback: (error: Error | null) => void) => { callbacks.push(callback); return false; }) as typeof process.send;
  try {
    const r = childReporter(stop, () => ({ ...CONTRACT, ipcPendingBytes: 150, softBytes: 300 }), () => 150);
    expect(r.send({ kind: 'sample', body: 'x'.repeat(145) })).toBe(false); expect(callbacks).toHaveLength(0);
    const pending = childReporter(stop, () => ({ ...CONTRACT, ipcPendingBytes: 150, softBytes: 300 }), () => 150);
    expect(pending.send({ kind: 'sample', body: 'x'.repeat(40) })).toBe(true);
    expect(pending.pending).toBeGreaterThan(0);
    expect(pending.send({ kind: 'sample', body: 'x'.repeat(40) })).toBe(false);
    callbacks[0]!(new Error('send failed')); expect(pending.pending).toBe(0); expect(pending.dropped).toBe(2);
    const cumulative = childReporter(stop, () => ({ ...CONTRACT, softBytes: 1 }));
    expect(cumulative.send({ kind: 'sample' })).toBe(false); expect(cumulative.total).toBeGreaterThan(1);
  } finally { process.send = previous; }
});

test('missing, partial, wrong epoch and duplicate finish receipts remain unknown', () => {
  for (const alteration of ['missing', 'partial', 'epoch', 'duplicate']) {
    const messages: RecordValue[] = []; const failed = vi.fn(); const center = centerDelivery(input, message => { messages.push(message); return true; }, failed);
    center.record(event); center.finish();
    const r = deliveryReceipt(input, failed);
    if (alteration === 'partial') messages.shift();
    if (alteration === 'missing') messages.pop();
    if (alteration === 'epoch') messages[0]!.epoch = 'other';
    for (const message of messages) r.accept(message);
    if (alteration === 'duplicate') r.accept(messages.at(-1)!);
    expect(r.complete()).toBe(false); expect(failed).toHaveBeenCalled();
  }
});

test('v2 empty opportunity and status replay retain one identity without treating replay as a new claim', () => {
  const observer = createClaimObservation(['task']);
  expect(observer.observe('/api/runner/claim-opportunity', request, { ...request, state: 'empty' }, 'runner')).toBeUndefined();
  expect(observer.observe('/api/runner/claim-opportunity/status', request, { ...request, state: 'missing' }, 'runner')).toBeUndefined();
  const first = observer.observe('/api/runner/claim-opportunity', request, assigned(), 'runner');
  expect(first).toMatchObject({ replay: false, claim: identity });
  expect(observer.observe('/api/runner/claim-opportunity/status', request, assigned(), 'runner')).toMatchObject({ replay: true, claim: identity });
  expect(observer.claims.size).toBe(1); first!.claim.ownerVersion = 99; expect(observer.claims.get('task')!.ownerVersion).toBe(2);
});

test('v2 conflicts, empty regression, wrong endpoint state and unowned identities fail observation', () => {
  const o = createClaimObservation(['task']); o.observe('/api/runner/claim-opportunity', request, assigned(), 'runner');
  const altered = assigned(); altered.assignment.attempt.ownerVersion++; altered.identity.ownerVersion++;
  expect(() => o.observe('/api/runner/claim-opportunity/status', request, altered, 'runner')).toThrow();
  expect(() => o.observe('/api/runner/claim-opportunity', request, { ...request, state: 'empty' }, 'runner')).toThrow();
  expect(() => o.observe('/api/runner/claim-opportunity', request, assigned(), 'other')).toThrow();
  expect(() => createClaimObservation(['task']).observe('/api/runner/claim-opportunity', request, { ...request, state: 'missing' }, 'runner')).toThrow();
  expect(() => createClaimObservation([]).observe('/api/runner/claim-opportunity', request, assigned(), 'runner')).toThrow();
  expect(o.observe('/api/runner/claim-opportunity/status', request, { ...request, state: 'unavailable', identity }, 'runner')).toBeUndefined();
  expect(() => o.observe('/api/runner/claim-opportunity/status', request, { ...request, state: 'unavailable', identity: { ...identity, attemptId: 'changed' } }, 'runner')).toThrow();
});

test('legacy claim/null stays compatible and duplicate assignment still fails', () => {
  const o = createClaimObservation(['task']); expect(o.observe('/api/runner/claim', {}, { assignment: null })).toBeUndefined();
  expect(o.observe('/api/runner/claim', {}, { assignment: assigned().assignment })).toMatchObject({ replay: false, claim: identity });
  expect(() => o.observe('/api/runner/claim', {}, { assignment: assigned().assignment })).toThrow();
});

test.each([false, true])('real existing child launch/reporter closes idle IPC with invalid epoch=%s and no runtime/PG', async badEpoch => {
  const owned: OwnedProcess[] = []; const messages: RecordValue[] = []; let ipcBytes = 0;
  try {
    const peer = await launch({ role: 'runner', pgDelivery: input }, owned, value => messages.push(value), (_kind, bytes) => { ipcBytes += bytes; }, 4000);
    if (badEpoch) { await transmit(peer, { kind: 'measure', epoch: 'wrong' }, () => {}); await peer.exited; }
    const closed = await stopProcess(peer, performance.now() + 4000);
    expect(closed).toMatchObject({ exited: true, forced: false, exitCode: badEpoch ? 1 : 0 });
    expect(messages.filter(value => value.kind === 'child-settled')).toHaveLength(1);
    expect(messages.find(value => value.kind === 'child-settled')).toMatchObject({ dropped: 0 });
    expect(messages.some(value => ['claim', 'adapter-enter'].includes(value.kind))).toBe(false);
    expect(messages.filter(value => value.kind === 'failure')).toHaveLength(badEpoch ? 1 : 0);
    expect(messages.some(value => value.kind === 'window-start')).toBe(false);
    expect(ipcBytes).toBeGreaterThan(0);
  } finally {
    for (const peer of owned) if (peer.child.exitCode === null) await stopProcess(peer, performance.now() + 1000);
  }
});


test('first unavailable pins history without claiming live execution or allowing empty regression', () => {
  for (const response of [{ ...request, state: 'missing' }, { ...request, state: 'unavailable', identity: { ...identity, ownerVersion: 3 } },
    { ...assigned(), identity: { ...identity, ownerVersion: 3 }, assignment: { task: { id: 'task' }, attempt: { id: 'attempt', runnerId: 'runner', ownerVersion: 3 } } }]) {
    const o = createClaimObservation(['task']);
    o.observe('/api/runner/claim-opportunity/status', request, { ...request, state: 'unavailable', identity }, 'runner');
    expect(o.claims.size).toBe(0);
    expect(() => o.observe('/api/runner/claim-opportunity/status', request, response, 'runner')).toThrow();
    expect(() => o.observe('/api/runner/claim-opportunity', request, { ...request, state: 'empty' }, 'runner')).toThrow();
  }
  const o = createClaimObservation(['task']); const historical = { ...identity };
  o.observe('/api/runner/claim-opportunity/status', request, { ...request, state: 'unavailable', identity: historical }, 'runner');
  historical.ownerVersion = 99;
  expect(o.observe('/api/runner/claim-opportunity/status', request, assigned(), 'runner')).toMatchObject({ replay: false, claim: identity });
  expect(o.observe('/api/runner/claim-opportunity/status', request, assigned(), 'runner')).toMatchObject({ replay: true, claim: identity });
  expect(o.claims.size).toBe(1);
});
