import { test, expect } from 'vitest';
import { decodeSample, compareSamples, createSampleLedger } from './snapshot.js';
const header = (ordinal = 1, begin = '100', end = '110') => ({ kind: 'sample', ordinal, begin, end, numer: '125', denom: '3', count: 1 });
const row = (t0 = '101', t1 = '109') => ({ pid: 12, ppid: 10, pgid: 10, start: '9007199254740993', user: '100', system: '200', rss: '4096', t0, t1 });
test('preserves uint64 identity and converts same-member CPU using Mach timebase without Number loss', () => {
  const a = decodeSample(header(), [row()], 1), b = decodeSample(header(2,'200','210'), [{ ...row('201','209'), user: '103', system: '206' }], 1);
  expect(a.members[0]?.start).toBe(9007199254740993n);
  expect(compareSamples(a,b)).toMatchObject({ known: true, userNs: '125', systemNs: '250', rssBytes: '4096', sharedPagesDoubleCounted: true, peak: 'unknown' });
});
test.each(['start','ppid','pgid','user','stage','missing'] as const)('%s drift or missing endpoint is unknown, never a zero CPU delta', kind => {
  const a = decodeSample(header(), [row()], 1);
  const r = { ...row('201','209') };
  if (kind === 'start') r.start = '9007199254740994';
  if (kind === 'ppid') r.ppid = 9;
  if (kind === 'pgid') r.pgid = 9;
  if (kind === 'user') r.user = '99';
  if (kind === 'missing') r.pid = 13;
  const b = decodeSample(header(2,'200','210'), [r], kind === 'stage' ? 2 : 1);
  expect(compareSamples(a,b).known).toBe(false);
});
test('rejects opaque comm/errors, unsafe numbers, oversized rows, duplicate PIDs and 33-member census', () => {
  expect(() => decodeSample(header(), [{ ...row(), comm: 'private malicious text' }], 1)).toThrow();
  expect(() => decodeSample(header(), [{ ...row(), start: 9007199254740993 }], 1)).toThrow();
  expect(() => decodeSample(header(), [{ ...row(), user: '9'.repeat(300) }], 1)).toThrow();
  expect(() => decodeSample({ ...header(), count: 2 }, [row(),row()], 1)).toThrow();
  expect(() => decodeSample({ ...header(), count: 33 }, Array(33).fill(row()), 1)).toThrow();
  expect(() => decodeSample({ kind: 'unknown', errno: 1 }, [], 1)).toThrow();
});
test('limits sample ordinals and makes malformed input sticky unknown without retaining private payload', () => {
  const ledger = createSampleLedger(); ledger.accept(header(), [row()], 1);
  expect(() => ledger.accept(header(3),[row()],1)).toThrow();
  expect(() => ledger.accept(header(2),[row()],1)).toThrow('SAMPLING_UNKNOWN');
  expect(ledger.facts()).toMatchObject({ samples: 1, unknown: true });
  expect(() => decodeSample(header(65),[row()],1)).toThrow();
});
test('rejects timebase overflow and inverted sample windows', () => {
  const a = decodeSample(header(),[row()],1);
  const b = decodeSample(header(2,'200','210'),[{ ...row('201','209'), user: '18446744073709551615' }],1);
  expect(compareSamples(a,b).known).toBe(false);
  expect(() => decodeSample(header(2,'210','200'),[row()],1)).toThrow();
});
