/** One completion subscription per attempt, consumed by the single admission loop. */
export class AttemptWakeup {
  private pending = false;
  private closed = false;
  private release: (() => void) | undefined;

  constructor(private readonly signal: AbortSignal, private readonly pollIntervalMs: number) {}

  track(completion: Promise<void>): void {
    if (!this.closed) void completion.then(() => this.notify(), () => this.notify());
  }

  wait(): Promise<void> {
    if (this.closed || this.signal.aborted) return Promise.resolve();
    if (this.pending) { this.pending = false; return Promise.resolve(); }
    if (this.release) throw new Error('AttemptWakeup requires a single waiting admission loop.');
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        this.signal.removeEventListener('abort', finish);
        this.release = undefined;
        resolve();
      };
      const timer = setTimeout(finish, this.pollIntervalMs);
      this.release = finish;
      this.signal.addEventListener('abort', finish, { once: true });
    });
  }

  close(): void {
    this.closed = true;
    this.pending = false;
    this.release?.();
  }

  private notify(): void {
    if (this.closed) return;
    if (this.release) this.release();
    else this.pending = true;
  }
}
