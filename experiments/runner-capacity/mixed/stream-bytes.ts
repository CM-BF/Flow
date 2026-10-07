/** Node stream counters, not TCP/IP packets, retransmits, or network-interface traffic. */
type CounterStream = { bytesRead: number; bytesWritten: number };
export class StreamBytes {
  private readonly streams = new Set<CounterStream>();
  private previous = 0;
  private unknown = false;
  constructor(private readonly maximum = 256) {}
  add(value: unknown) {
    if (!value || typeof value !== 'object' || !this.valid(value)) { this.unknown = true; return; }
    if (this.streams.has(value)) return;
    if (this.streams.size >= this.maximum) { this.unknown = true; return; }
    this.streams.add(value);
  }
  addPgClient(value: unknown) {
    // Version-bound pg8.23.1 seam. Feature-detection failure invalidates complete accounting.
    this.add((value as { connection?: { stream?: unknown } } | null)?.connection?.stream);
  }
  sample() {
    let total = 0;
    for (const stream of this.streams) {
      if (!this.valid(stream)) { this.unknown = true; continue; }
      total += stream.bytesRead + stream.bytesWritten;
    }
    if (!Number.isSafeInteger(total) || total < this.previous) this.unknown = true;
    const delta = Math.max(0, total - this.previous); this.previous = total;
    return { delta, total, streams: this.streams.size, complete: !this.unknown };
  }
  destroyOwned() {
    this.unknown = true;
    for (const stream of this.streams) {
      const destroy = (stream as CounterStream & { destroy?: () => void }).destroy;
      try { if (typeof destroy === 'function') destroy.call(stream); } catch { /* Accounting stays unknown. */ }
    }
  }
  private valid(value: object): value is CounterStream {
    const stream = value as CounterStream;
    return Number.isSafeInteger(stream.bytesRead) && stream.bytesRead >= 0 && Number.isSafeInteger(stream.bytesWritten) && stream.bytesWritten >= 0;
  }
}
