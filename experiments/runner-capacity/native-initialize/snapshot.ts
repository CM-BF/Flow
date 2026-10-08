/** Numeric-only decoding; all untrusted fields are detached, exact keys are required. */
export interface Member { pid: number; ppid: number; pgid: number; start: bigint; user: bigint; system: bigint; rss: bigint; t0: bigint; t1: bigint }
export interface Sample { stage: number; ordinal: number; begin: bigint; end: bigint; numer: bigint; denom: bigint; members: readonly Member[] }
const U64 = (1n << 64n) - 1n;
function uint(value: unknown, positive = false): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw Error('INTEGER_ENCODING');
  const n = BigInt(value); if (n > U64 || (positive && n === 0n)) throw Error('INTEGER_RANGE'); return n;
}
function pid(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > 0x7fffffff) throw Error('PID_RANGE');
  return value as number;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('SHAPE');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== keys.sort().join(',')) throw Error('FIELDS'); return v;
}
export function decodeSample(header: unknown, rows: readonly unknown[], stage: number): Sample {
  const h = object(header, ['kind', 'ordinal', 'begin', 'end', 'numer', 'denom', 'count']);
  if (h.kind !== 'sample' || !Number.isInteger(stage) || ![1, 2, 4].includes(stage)
    || !Number.isInteger(h.ordinal) || (h.ordinal as number) < 1 || (h.ordinal as number) > 64
    || h.count !== rows.length || rows.length < 1 || rows.length > 32) throw Error('SAMPLE_LIMIT');
  const begin = uint(h.begin), end = uint(h.end), numer = uint(h.numer, true), denom = uint(h.denom, true);
  if (end < begin || numer > 0xffffffffn || denom > 0xffffffffn) throw Error('CLOCK_RANGE');
  const seen = new Set<number>();
  const members = rows.map(row => {
    if (Buffer.byteLength(JSON.stringify(row)) > 256) throw Error('ROW_LIMIT');
    const r = object(row, ['pid','ppid','pgid','start','user','system','rss','t0','t1']);
    const value: Member = { pid: pid(r.pid), ppid: pid(r.ppid), pgid: pid(r.pgid), start: uint(r.start, true),
      user: uint(r.user), system: uint(r.system), rss: uint(r.rss), t0: uint(r.t0), t1: uint(r.t1) };
    if (seen.has(value.pid) || value.t0 < begin || value.t1 < value.t0 || value.t1 > end) throw Error('IDENTITY_OR_TIME');
    seen.add(value.pid); return Object.freeze(value);
  });
  return Object.freeze({ stage, ordinal: h.ordinal as number, begin, end, numer, denom, members: Object.freeze(members) });
}
function ns(ticks: bigint, sample: Sample): bigint {
  const product = ticks * sample.numer;
  if (product > U64) throw Error('TIMEBASE_OVERFLOW'); return product / sample.denom;
}
export function compareSamples(before: Sample, after: Sample) {
  const reject = () => ({ known: false as const, reason: 'IDENTITY_COVERAGE_OR_CLOCK_UNKNOWN' });
  if (before.stage !== after.stage || after.ordinal <= before.ordinal || after.begin < before.end
    || before.numer !== after.numer || before.denom !== after.denom || before.members.length !== after.members.length) return reject();
  const previous = new Map(before.members.map(row => [row.pid, row]));
  let user = 0n, system = 0n, rss = 0n;
  const intervals: { pid: number; from: string; to: string }[] = [];
  try {
    for (const current of after.members) {
      const old = previous.get(current.pid);
      if (!old || current.start !== old.start || current.ppid !== old.ppid || current.pgid !== old.pgid
        || current.user < old.user || current.system < old.system) return reject();
      user += ns(current.user - old.user, after); system += ns(current.system - old.system, after); rss += current.rss;
      if (user > U64 || system > U64 || rss > U64) return reject();
      intervals.push({ pid: current.pid, from: old.t1.toString(), to: current.t1.toString() });
    }
    return { known: true as const, userNs: user.toString(), systemNs: system.toString(), rssBytes: rss.toString(),
      sampleIntervalNs: ns(after.end - before.begin, after).toString(), memberIntervals: intervals,
      sharedPagesDoubleCounted: true, betweenSamplesCoverage: 'unknown' as const, peak: 'unknown' as const };
  } catch { return reject(); }
}
export function createSampleLedger() {
  let ordinal = 0, bytes = 0, unknown = false;
  return { accept(header: unknown, rows: readonly unknown[], stage: number): Sample {
    if (unknown) throw Error('SAMPLING_UNKNOWN');
    try {
      const size = Buffer.byteLength(JSON.stringify(header) + '\n' + rows.map(row => JSON.stringify(row) + '\n').join(''));
      if (bytes + size > 524288) throw Error('OUTPUT_LIMIT');
      const sample = decodeSample(header, rows, stage);
      if (sample.ordinal !== ordinal + 1) throw Error('ORDINAL');
      ordinal = sample.ordinal; bytes += size; return sample;
    } catch (error) { unknown = true; throw error; }
  }, facts: () => ({ samples: ordinal, bytes, unknown }) };
}
