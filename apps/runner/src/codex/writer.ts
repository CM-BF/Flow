import type { Writable } from 'node:stream';
import { CodexTransportError } from './types.js';
interface Entry {
  bytes: Buffer; started: boolean; beforeWrite: () => void;
  resolve: () => void; reject: (error: CodexTransportError) => void;
}
export interface WriteTicket { done: Promise<void>; cancel(): boolean }

/** The active write remains in the same byte/frame budget until callback AND drain. */
export class BoundedWriter {
  private queue: Entry[] = [];
  private bytes = 0;
  private peak = 0;
  private stopped = false;
  private pumping = false;
  private clearListeners: (() => void) | undefined;
  constructor(private readonly output: Writable, private readonly maxBytes: number, private readonly maxFrames: number,
    private readonly timeoutMs: number, private readonly failed: (timeout?: boolean) => void) {}
  snapshot() { return { outboundBytes: this.bytes, outboundFrames: this.queue.length, peakOutboundBytes: this.peak }; }
  enqueue(bytes: Buffer, beforeWrite = () => {}): WriteTicket {
    if (this.stopped) throw new CodexTransportError('CLOSED', 'not-sent');
    if (bytes.length + this.bytes > this.maxBytes || this.queue.length >= this.maxFrames) throw new CodexTransportError('LIMIT', 'not-sent');
    let entry!: Entry;
    const done = new Promise<void>((resolve, reject) => { entry = { bytes, beforeWrite, resolve, reject, started: false }; });
    this.queue.push(entry); this.bytes += bytes.length; this.peak = Math.max(this.peak, this.bytes);
    queueMicrotask(() => this.pump());
    return { done, cancel: () => {
      if (entry.started || !this.queue.includes(entry)) return false;
      this.queue.splice(this.queue.indexOf(entry), 1); this.bytes -= bytes.length;
      entry.reject(new CodexTransportError('ABORTED', 'not-sent'));
      return true;
    } };
  }
  stop(): void {
    this.stopped = true; this.clearListeners?.();
    for (const entry of this.queue) entry.reject(new CodexTransportError('CLOSED', entry.started ? 'unknown' : 'not-sent'));
    this.queue = []; this.bytes = 0;
  }
  private pump(): void {
    if (this.stopped || this.pumping || !this.queue.length) return;
    this.pumping = true;
    const entry = this.queue[0]!;
    entry.started = true; entry.beforeWrite();
    let callbackDone = false; let drained = false;
    const onDrain = () => { drained = true; finish(); };
    const finish = () => {
      if (!callbackDone || !drained || this.stopped) return;
      clearTimeout(timer); this.output.off('drain', onDrain); this.clearListeners = undefined;
      this.queue.shift(); this.bytes -= entry.bytes.length; this.pumping = false;
      entry.resolve(); this.pump();
    };
    const timer = setTimeout(() => this.failed(true), this.timeoutMs);
    this.output.once('drain', onDrain);
    this.clearListeners = () => { clearTimeout(timer); this.output.off('drain', onDrain); };
    try {
      const writable = this.output.write(entry.bytes, error => {
        if (error) { this.failed(); return; }
        callbackDone = true; finish();
      });
      if (writable) { drained = true; finish(); }
    } catch { this.failed(); }
  }
}
