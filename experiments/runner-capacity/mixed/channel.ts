import { CONTRACT, type RunContract } from './contract.js';
export type RecordValue = { kind: string; [key: string]: unknown };
export type DrainOptions = { deadlineMs: number; signal: AbortSignal };
type SendFailure = 'closed' | 'envelope_limit' | 'pending_limit' | 'total_limit' | 'disconnected' | 'send_callback' | 'send_throw' | 'cancelled' | 'deadline';
export function childReporter(stop: () => void, limits: () => RunContract = () => CONTRACT, messageLimit: () => number = () => limits().responseBytes) {
  let pending = 0; let total = 0; let dropped = 0; let closed = false;
  let firstFailure: SendFailure | null = null;
  const listeners = new Set<() => void>();
  const changed = () => { for (const listener of [...listeners]) listener(); };
  function fail(code: SendFailure) { firstFailure ??= code; dropped++; stop(); changed(); return false; }
  const send = (value: RecordValue) => {
    const contract = limits();
    const record = { ...value, childMs: performance.now(), pid: process.pid };
    const bytes = Buffer.byteLength(JSON.stringify(record));
    total += bytes;
    if (closed) return fail('closed');
    if (bytes > Math.min(contract.responseBytes, messageLimit())) return fail('envelope_limit');
    if (pending + bytes > contract.ipcPendingBytes) return fail('pending_limit');
    if (total > contract.softBytes) return fail('total_limit');
    if (!process.send) return fail('disconnected');
    pending += bytes;
    let settled = false;
    const settledSend = (error: Error | null) => {
      if (settled) return;
      settled = true; pending -= bytes;
      if (error) fail('send_callback');
      changed();
    };
    try {
      // false means flow control; the callback remains authoritative for local completion.
      process.send(record, settledSend);
      return dropped === 0;
    } catch {
      if (!settled) { settled = true; pending -= bytes; }
      return fail('send_throw');
    }
  };
  function drain({ deadlineMs, signal }: DrainOptions): Promise<boolean> {
    return new Promise(resolve => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: boolean) => {
        if (done) return; done = true;
        clearTimeout(timer); listeners.delete(check); signal.removeEventListener('abort', check); resolve(result);
      };
      const check = () => {
        if (done) return;
        if (firstFailure || closed) { finish(false); return; }
        if (signal.aborted) { finish(false); fail('cancelled'); return; }
        if (!Number.isFinite(deadlineMs) || performance.now() >= deadlineMs) { finish(false); fail('deadline'); return; }
        if (pending === 0) finish(true);
      };
      listeners.add(check); signal.addEventListener('abort', check, { once: true });
      timer = setTimeout(() => { if (!done) { finish(false); fail('deadline'); } }, Math.max(0, Math.ceil(deadlineMs - performance.now())));
      check();
    });
  }
  // One center flush awaits each callback; no extra queue, retries, or raised pending budget.
  async function sendAsync(value: RecordValue, options: DrainOptions) {
    if (!await drain(options) || !send(value)) return false;
    return drain(options);
  }
  return { send, sendAsync, drain, get firstFailure() { return firstFailure; }, get dropped() { return dropped; },
    get pending() { return pending; }, get total() { return total; }, close() { closed = true; changed(); } };
}
export async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const interrupted = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); });
  try { return await Promise.race([promise, interrupted]); }
  finally { signal.removeEventListener('abort', abort); }
}

export function memoryObservation() {
  const memory = process.memoryUsage();
  return { kind: 'memory', rss: memory.rss, heapUsed: memory.heapUsed, external: memory.external,
    arrayBuffers: memory.arrayBuffers, maxRssKiB: process.resourceUsage().maxRSS };
}
