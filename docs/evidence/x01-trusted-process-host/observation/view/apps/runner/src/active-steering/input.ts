import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

/** A single SDK input source. A yielded UUID is never inserted again. */
export class SteeringInput implements AsyncIterable<SDKUserMessage> {
  private values: SDKUserMessage[] = [];
  private wake: (() => void) | undefined;
  private closed = false;
  private readonly sent = new Set<string>();
  constructor(private signal: AbortSignal, first: SDKUserMessage) { this.push(first); }
  push(message: SDKUserMessage): void {
    if (this.closed || this.signal.aborted || !message.uuid || this.sent.has(message.uuid)) throw new Error('Native input is closed or this UUID was already delivered.');
    this.sent.add(message.uuid); this.values.push(message); this.wake?.();
  }
  get pending(): number { return this.values.length; }
  close(): void { this.closed = true; this.wake?.(); }
  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    const abort = () => this.wake?.();
    this.signal.addEventListener('abort', abort);
    try {
      while (true) {
        this.signal.throwIfAborted();
        const value = this.values.shift();
        if (value) { yield value; continue; }
        if (this.closed) return;
        await new Promise<void>(resolve => { this.wake = resolve; if (this.signal.aborted || this.closed || this.values.length) resolve(); });
        this.wake = undefined;
      }
    } finally { this.signal.removeEventListener('abort', abort); }
  }
}
