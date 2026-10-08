import { FlowClient } from '@flow/client';
import type { Ownership } from '@flow/contracts';

/** A remote cancellation request does not stop execution until the peer confirms a terminal state. */
export class ProtocolLease {
  private readonly abort = new AbortController();
  readonly signal: AbortSignal;
  cancelRequested = false;
  private interval: ReturnType<typeof setInterval>;
  private expiry?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<void>;
  private closed = false;

  constructor(private client: FlowClient, readonly ownership: Ownership, private shutdown: AbortSignal, private timeoutMs: number, intervalMs: number) {
    this.signal = AbortSignal.any([shutdown, this.abort.signal]);
    this.interval = setInterval(() => { void this.check().catch(() => undefined); }, intervalMs);
  }
  async check(): Promise<void> {
    this.signal.throwIfAborted();
    if (this.closed) throw new Error('Protocol lease closed.');
    this.inFlight ??= this.heartbeat().finally(() => { this.inFlight = undefined; });
    await this.inFlight;
    this.signal.throwIfAborted();
  }
  requestSignal(): AbortSignal { return AbortSignal.any([this.signal, AbortSignal.timeout(this.timeoutMs)]); }
  interrupt() { this.abort.abort(new Error('Protocol ownership unavailable.')); }
  close() { this.closed = true; clearInterval(this.interval); clearTimeout(this.expiry); this.abort.abort(); }
  private async heartbeat() {
    const started = performance.now();
    try {
      const response = await this.client.heartbeat(this.ownership, AbortSignal.any([this.signal, AbortSignal.timeout(this.timeoutMs)]));
      if (this.closed) return;
      if (response.action === 'stop') { this.interrupt(); return; }
      const remaining = response.remainingLeaseMs;
      if (!Number.isFinite(remaining) || remaining <= 0) { this.interrupt(); return; }
      // Server reports duration at its response; charging the full request RTT is conservative.
      const budget = started + remaining - performance.now();
      if (budget <= 0) { this.interrupt(); return; }
      clearTimeout(this.expiry);
      this.expiry = setTimeout(() => this.interrupt(), budget);
      if (response.action === 'cancel') this.cancelRequested = true;
    } catch { this.interrupt(); }
  }
}
