/** Private recipe: ports own effects; this module owns only admission and phase ordering. */
export const LEVELS = [1, 2, 4] as const;
export interface Clock { now(): number; alarm(deadlineMs: number, expire: () => void): () => void }
export const realClock: Clock = {
  now: () => performance.now(),
  alarm(deadline, expire) { const timer = setTimeout(expire, Math.max(0, deadline - performance.now())); return () => clearTimeout(timer); },
};
export interface CloseFacts { exited: boolean; eof: boolean; hostWriteSettled: boolean; membersClosed: boolean }
export interface Instance { start(signal: AbortSignal): Promise<void>; close(signal: AbortSignal): Promise<CloseFacts> }
export interface Ports {
  // Allocate all cleanup handles before any asynchronous/native work starts.
  allocate(level: number): readonly Instance[];
  observe(level: number, durationMs: 2000, signal: AbortSignal): Promise<{ known: boolean }>;
  bytes(level: number): { total: number; instances: readonly number[] } | null;
  cleanup(level: number, signal: AbortSignal): Promise<boolean>;
}
export interface StageResult {
  level: number; startedMs: number; readyMs: number | null; observationEndMs: number | null;
  closedMs: number | null; finishedMs: number; failure: string | null; secondary: string[]; cleanup: 'removed' | 'keep';
}
class PhaseFailure extends Error { constructor(readonly code: string) { super(code); } }
async function bounded<T>(clock: Clock, deadline: number, outer: AbortSignal | undefined,
  action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (clock.now() >= deadline) throw new PhaseFailure('DEADLINE');
  if (outer?.aborted) throw new PhaseFailure('CANCELLED');
  const local = new AbortController();
  let reject!: (error: Error) => void;
  const stopped = new Promise<never>((_, r) => { reject = r; });
  const stop = (code: string) => { local.abort(); reject(new PhaseFailure(code)); };
  const cancel = () => stop('CANCELLED');
  outer?.addEventListener('abort', cancel, { once: true });
  const clear = clock.alarm(deadline, () => stop('DEADLINE'));
  let completed = false;
  try {
    const value = await Promise.race([Promise.resolve().then(() => action(local.signal)), stopped]);
    if (clock.now() >= deadline) throw new PhaseFailure('DEADLINE');
    if (outer?.aborted) throw new PhaseFailure('CANCELLED');
    completed = true; return value;
  } finally { clear(); outer?.removeEventListener('abort', cancel); if (!completed) local.abort(); }
}
function bytesKnown(ports: Ports, level: number): boolean {
  const value = ports.bytes(level);
  const valid = (n: number, cap: number) => Number.isSafeInteger(n) && n >= 0 && n <= cap;
  return value !== null && valid(value.total, 64 * 1024 * 1024) && value.instances.length === level
    && value.instances.every(n => valid(n, 8 * 1024 * 1024))
    && value.instances.reduce((a, b) => a + b, 0) <= value.total;
}
export async function runStages(ports: Ports, originMs: number, signal: AbortSignal, clock: Clock = realClock) {
  if (!Number.isFinite(originMs) || clock.now() < originMs || clock.now() > originMs + 10_000) throw new PhaseFailure('PREFLIGHT_TIME');
  const stages: StageResult[] = [];
  for (const level of LEVELS) {
    const start = clock.now(), deadline = Math.min(originMs + 64_000, start + 18_000);
    const row: StageResult = { level, startedMs: start, readyMs: null, observationEndMs: null, closedMs: null,
      finishedMs: start, failure: null, secondary: [], cleanup: 'keep' };
    stages.push(row);
    const running = new AbortController();
    let instances: readonly Instance[] = [];
    try {
      if (signal.aborted || deadline - start < 18_000) throw new PhaseFailure('ADMISSION');
      instances = ports.allocate(level);
      if (instances.length !== level) throw new PhaseFailure('INSTANCE_COUNT');
      await bounded(clock, start + 10_000, AbortSignal.any([signal, running.signal]), async phase => {
        await Promise.all(instances.map(instance => instance.start(AbortSignal.any([phase, running.signal, signal]))));
      });
      row.readyMs = clock.now();
      if (!bytesKnown(ports, level)) throw new PhaseFailure('BYTES_UNKNOWN');
      const observed = await bounded(clock, deadline - 6_000, signal, phase => ports.observe(level, 2000, phase));
      if (!observed.known || clock.now() - row.readyMs < 2000) throw new PhaseFailure('OBSERVATION_UNKNOWN');
      row.observationEndMs = clock.now();
      if (!bytesKnown(ports, level)) throw new PhaseFailure('BYTES_UNKNOWN');
    } catch (error) { row.failure = error instanceof PhaseFailure ? error.code : 'WORK_UNKNOWN'; }
    finally {
      running.abort();
      try {
        const closed = await bounded(clock, deadline - 3_000, undefined, async phase =>
          Promise.all(instances.map(instance => instance.close(phase))));
        if (instances.length !== level || !closed.every(x => x.exited && x.eof && x.hostWriteSettled && x.membersClosed))
          throw new PhaseFailure('CLOSE_UNKNOWN');
        row.closedMs = clock.now();
        if (!bytesKnown(ports, level)) throw new PhaseFailure('BYTES_UNKNOWN');
        if (await bounded(clock, deadline, undefined, phase => ports.cleanup(level, phase))) row.cleanup = 'removed';
        else throw new PhaseFailure('CLEANUP_UNKNOWN');
      } catch (error) {
        const code = error instanceof PhaseFailure ? error.code : 'CLEANUP_UNKNOWN';
        if (row.failure) row.secondary.push(code); else row.failure = code;
      }
      row.finishedMs = clock.now();
    }
    if (row.failure || row.cleanup !== 'removed') break;
  }
  return { known: stages.length === 3 && stages.every(x => !x.failure && x.cleanup === 'removed'), stages,
    deadlineMs: originMs + 70_000, intervalPeak: 'unknown' as const };
}
