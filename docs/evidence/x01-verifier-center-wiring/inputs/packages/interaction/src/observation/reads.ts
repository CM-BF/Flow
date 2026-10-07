/** Two actual reads at a time; at most four queued. Aborted callers never dispatch later. */
export class ObservationReads {
  private active = 0;
  private waiting: (() => void)[] = [];
  async run<T>(signal: AbortSignal, read: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw signal.reason;
    if (this.active >= 2) {
      if (this.waiting.length >= 4) throw Error('Observation read budget is full.');
      await new Promise<void>((resolve, reject) => {
        const abort = () => { this.waiting = this.waiting.filter(item => item !== ready); reject(signal.reason); };
        const ready = () => { signal.removeEventListener('abort', abort); resolve(); };
        signal.addEventListener('abort', abort, {once:true}); this.waiting.push(ready);
      });
    } else this.active++;
    try { if (signal.aborted) throw signal.reason; return await read(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}
