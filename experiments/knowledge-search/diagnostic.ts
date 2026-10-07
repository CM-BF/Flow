import { open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { StorageBudget } from './budget.js';

/** Small append-only stage/completed-result facts; never rewrites the growing final result. */
export class DiagnosticProgress {
  private records = 0;
  private bytes = 0;
  firstFailure?: unknown;
  constructor(readonly path: string, readonly budget?: StorageBudget) {}
  async record(phase: string, value?: unknown) {
    const data = Buffer.from(JSON.stringify({ phase, at: new Date().toISOString(), value }) + '\n');
    if (this.records >= 64 || data.length > 96 * 1024 || this.bytes + data.length > 768 * 1024) throw new Error('PROGRESS_LIMIT');
    this.budget?.write(data.length);
    const file = await open(this.path, this.records === 0 ? 'wx' : 'a', 0o600);
    try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
    if (this.records === 0) { const directory = await open(dirname(this.path), 'r'); try { await directory.sync(); } finally { await directory.close(); } }
    this.records++; this.bytes += data.length;
  }
  async failure(value: unknown) {
    if (this.firstFailure !== undefined) return;
    this.firstFailure = value;
    await this.record('first-failure', value);
  }
}

/** Driver round trip, not server execution time. Guard/observer cost stays outside it. */
export async function timedQuery<T>(guard: () => void, query: () => Promise<T>, clock: () => number = () => performance.now()) {
  const start = clock(); guard(); const sent = clock();
  const value = await query(); const received = clock();
  return { value, observerBeforeQueryMs: sent - start, clientSqlRoundTripMs: received - sent, clientEndToEndMs: received - start };
}
