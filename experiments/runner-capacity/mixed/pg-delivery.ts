import type { PgObservation } from './observe-pg.js';

export type DeliveryPhase = 'before' | 'measure' | 'after';
type Failure = 'invalid_observation' | 'phase_order' | 'closed' | 'sample_limit' | 'group_limit' | 'byte_limit' | 'chunk_limit' | 'sink_unknown';
type Sample = PgObservation & { epoch: string; phase: DeliveryPhase; ordinal: number };
type SqlTotal = { phase: DeliveryPhase; poolId: number; poolRole: string; category: string; outcome: PgObservation['outcome']; count: number; elapsedMs: number };
export type DeliveryMessage = { kind: 'pg-observation'; sample: Sample } |
  { kind: 'pg-observation-chunk'; epoch: string; ordinal: number; samples: Sample[]; sql: SqlTotal[] };
export interface DeliveryOptions {
  mode: 'per-query' | 'buffered'; epoch: string;
  /** true means accepted locally, not IPC ACK. Caller still checks reporter pending/dropped. */
  emit(message: DeliveryMessage): boolean;
  invalidate(failure: Failure): void;
  limits?: { samplesPerKind?: number; bytes?: number; chunkBytes?: number; sqlGroups?: number };
}
const PHASES: DeliveryPhase[] = ['before', 'measure', 'after'];
const CATEGORIES = ['begin', 'commit', 'rollback', 'runner-row', 'runner-row-share', 'other'];
const ROLES = ['center', 'scheduler-candidate', 'unknown'];
const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
function bound(value: number | undefined, maximum: number, minimum = 1) {
  const result = value ?? maximum;
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw new Error('pg_delivery_invalid_limit');
  return result;
}
/** Private experiment sink: no SQL, timers, retries, process ownership, or product policy. */
export function createPgDelivery(options: DeliveryOptions) {
  if (!['per-query', 'buffered'].includes(options.mode) || !/^[A-Za-z0-9_-]{1,128}$/.test(options.epoch)) throw new Error('pg_delivery_invalid_identity');
  const limits = { samples: bound(options.limits?.samplesPerKind, 16384), bytes: bound(options.limits?.bytes, 4 * 1024 * 1024),
    chunk: bound(options.limits?.chunkBytes, 64 * 1024, 512), groups: bound(options.limits?.sqlGroups, 256) };
  const mode = options.mode; const epoch = options.epoch; const emit = options.emit; const onInvalid = options.invalidate;
  let phase: DeliveryPhase = 'before'; let closed = false; let failure: Failure | null = null;
  let observed = 0; let outputMessages = 0; let outputBytes = 0; let retainedBytes = 0;
  const counts = { 'pool-acquisition': 0, sql: 0, transaction: 0 };
  const samples: Sample[] = []; const totals = new Map<string, SqlTotal>();
  function invalidate(reason: Failure) {
    if (failure) return;
    failure = reason;
    try { onInvalid(reason); } catch { /* Keep the first failure; never affect the observed operation. */ }
  }
  function send(message: DeliveryMessage) {
    const bytes = jsonBytes(message);
    if (bytes > limits.chunk) { invalidate('chunk_limit'); return false; }
    try {
      if (emit(message) !== true) { invalidate('sink_unknown'); return false; }
      outputMessages++; outputBytes += bytes; return true;
    } catch { invalidate('sink_unknown'); return false; }
  }
  function reserve(bytes: number) {
    if (retainedBytes + bytes > limits.bytes) { invalidate('byte_limit'); return false; }
    retainedBytes += bytes; return true;
  }
  function valid(event: PgObservation) {
    return ['pool-acquisition', 'sql', 'transaction'].includes(event.kind) && ROLES.includes(event.poolRole) &&
      Number.isSafeInteger(event.poolId) && event.poolId > 0 && (event.backendPid === null || Number.isSafeInteger(event.backendPid) && event.backendPid > 0) &&
      ['ok', 'error', 'throw'].includes(event.outcome) && [event.startedMs, event.elapsedMs].every(value => Number.isFinite(value) && value >= 0) &&
      [event.total, event.idle, event.waiting].every(value => Number.isSafeInteger(value) && value >= 0) &&
      (event.category === undefined || CATEGORIES.includes(event.category));
  }
  function record(event: PgObservation) {
    if (closed) { invalidate('closed'); return; }
    if (failure) return;
    observed++;
    if (!valid(event)) { invalidate('invalid_observation'); return; }
    counts[event.kind]++;
    // Explicit copy: caller mutation and unexpected private fields never reach retained/output data.
    const sample: Sample = { epoch, phase, ordinal: observed, kind: event.kind, poolId: event.poolId, poolRole: event.poolRole,
      backendPid: event.backendPid, startedMs: event.startedMs, elapsedMs: event.elapsedMs, outcome: event.outcome,
      total: event.total, idle: event.idle, waiting: event.waiting, ...(event.category === undefined ? {} : { category: event.category }) };
    if (mode === 'per-query') { send({ kind: 'pg-observation', sample }); return; }
    if (event.kind === 'sql') {
      const key = [phase, event.poolId, event.poolRole, event.category ?? 'other', event.outcome].join(':');
      let total = totals.get(key);
      if (!total) {
        if (totals.size >= limits.groups) { invalidate('group_limit'); return; }
        total = { phase, poolId: event.poolId, poolRole: event.poolRole, category: event.category ?? 'other', outcome: event.outcome, count: 0, elapsedMs: 0 };
        // Bounded numeric slots, independent of changing decimal lengths; not a JS heap/RSS cap.
        if (!reserve(jsonBytes({ ...total, count: Number.MAX_SAFE_INTEGER, elapsedMs: Number.MAX_VALUE }) + 32)) return;
        totals.set(key, total);
      }
      if (!Number.isSafeInteger(total.count + 1) || !Number.isFinite(total.elapsedMs + event.elapsedMs)) { invalidate('invalid_observation'); return; }
      total.count++; total.elapsedMs += event.elapsedMs; return;
    }
    if (counts[event.kind] > limits.samples) { invalidate('sample_limit'); return; }
    if (reserve(jsonBytes(sample))) samples.push(sample);
  }
  function status() {
    return { mode, epoch, phase, closed, known: failure === null, failure, observed, counts: { ...counts },
      retainedBytes, outputMessages, outputBytes, sampleCount: samples.length, sqlGroups: totals.size };
  }
  // A single lazy packer serves synchronous offline callers and callback-paced IPC.
  function* chunks(): Generator<DeliveryMessage> {
    if (mode !== 'buffered' || failure) return;
    let ordinal = 0;
    let chunk: Extract<DeliveryMessage, { kind: 'pg-observation-chunk' }> = { kind: 'pg-observation-chunk', epoch, ordinal: ordinal++, samples: [], sql: [] };
    let chunkBytes = jsonBytes(chunk);
    function* append(array: 'samples' | 'sql', entry: Sample | SqlTotal): Generator<DeliveryMessage> {
      const bytes = jsonBytes(entry);
      if (chunkBytes + bytes + (chunk[array].length ? 1 : 0) > limits.chunk) {
        if (chunk.samples.length || chunk.sql.length) yield chunk;
        if (failure) return;
        chunk = { kind: 'pg-observation-chunk', epoch, ordinal: ordinal++, samples: [], sql: [] };
        chunkBytes = jsonBytes(chunk);
      }
      const added = bytes + (chunk[array].length ? 1 : 0);
      if (chunkBytes + added > limits.chunk) { invalidate('chunk_limit'); return; }
      chunkBytes += added;
      if (array === 'samples') chunk.samples.push(entry as Sample);
      else chunk.sql.push(entry as SqlTotal);
    }
    for (const sample of samples) { yield* append('samples', sample); if (failure) return; }
    for (const total of totals.values()) { yield* append('sql', { ...total }); if (failure) return; }
    if (chunk.samples.length || chunk.sql.length) yield chunk;
  }
  let finishing: Promise<ReturnType<typeof status>> | undefined;
  function finish() {
    if (closed) return status();
    closed = true;
    for (const chunk of chunks()) if (!send(chunk)) break;
    return status();
  }
  function finishAsync(emitAsync: (message: DeliveryMessage) => Promise<boolean>) {
    if (finishing) return finishing;
    if (closed) return Promise.resolve(status());
    closed = true;
    finishing = (async () => {
      for (const chunk of chunks()) {
        const bytes = jsonBytes(chunk); // Always validate the actual complete encoded envelope.
        if (bytes > limits.chunk) { invalidate('chunk_limit'); break; }
        try {
          if (await emitAsync(chunk) !== true) { invalidate('sink_unknown'); break; }
          outputMessages++; outputBytes += bytes;
        } catch { invalidate('sink_unknown'); break; }
      }
      return status();
    })();
    return finishing;
  }
  return { record, finish, finishAsync, status, setPhase(next: DeliveryPhase) {
    if (closed) { invalidate('closed'); return; }
    if (!PHASES.includes(next) || PHASES.indexOf(next) < PHASES.indexOf(phase)) { invalidate('phase_order'); return; }
    phase = next;
  } };
}
