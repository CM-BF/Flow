export interface ReadCacheLimits { entries: number; bytes: number }

/** Count verified text, never a TypeScript assertion or a truncated replacement. */
export function bodyBytes(text: unknown, limit: number): number {
  if (typeof text !== "string") throw Error("The center returned invalid body text.");
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > limit) throw Error("The body exceeds this reader's byte limit.");
  return bytes;
}

/** Owned by a projection; publishes its existing details snapshot, without a second lifecycle. */
export class ReadCache<T> {
  private readonly entries = new Map<string, T>();
  constructor(private readonly text: (value: T) => string | undefined, private readonly limits: ReadCacheLimits) {}
  put(key: string, value: T): Record<string, T> {
    const incoming = this.text(value);
    if (incoming !== undefined) bodyBytes(incoming, this.limits.bytes);
    this.entries.delete(key); this.entries.set(key, value);
    let bytes = [...this.entries.values()].reduce((sum, item) => sum + this.bytes(item), 0);
    while (this.entries.size > this.limits.entries || bytes > this.limits.bytes) {
      const [oldest, removed] = this.entries.entries().next().value!;
      this.entries.delete(oldest); bytes -= this.bytes(removed);
    }
    return this.snapshot();
  }
  touch(key: string): Record<string, T> {
    const value = this.entries.get(key);
    if (value !== undefined) { this.entries.delete(key); this.entries.set(key, value); }
    return this.snapshot();
  }
  retain(keep: (value: T) => boolean): Record<string, T> { for (const [key, value] of this.entries) if (!keep(value)) this.entries.delete(key); return this.snapshot(); }
  clear(): Record<string, T> { this.entries.clear(); return this.snapshot(); }
  private snapshot(): Record<string, T> { return Object.fromEntries(this.entries); }
  private bytes(value: T) { const text = this.text(value); return text === undefined ? 0 : bodyBytes(text, this.limits.bytes); }
}
