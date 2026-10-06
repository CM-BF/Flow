import { CONTRACT, type RunContract } from './contract.js';
export type RecordValue = { kind: string; [key: string]: unknown };
export function childReporter(stop: () => void, limits: () => RunContract = () => CONTRACT) {
  let pending = 0; let total = 0; let dropped = 0; let closed = false;
  const send = (value: RecordValue) => {
    const contract = limits();
    const record = { ...value, childMs: performance.now(), pid: process.pid };
    const bytes = Buffer.byteLength(JSON.stringify(record));
    total += bytes;
    if (closed || bytes > contract.responseBytes || pending + bytes > contract.ipcPendingBytes || total > contract.softBytes) {
      dropped++; stop(); return;
    }
    pending += bytes;
    try { process.send?.(record, error => { pending -= bytes; if (error) { dropped++; stop(); } }); }
    catch { pending -= bytes; dropped++; stop(); }
  };
  return { send, get dropped() { return dropped; }, get pending() { return pending; }, close() { closed = true; } };
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
