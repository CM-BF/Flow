/** Counts decoded response UTF-8 bytes before decoding/parsing; not a wire or heap bound. */
export async function readBoundedJson(response: Response, maxBytes: number, signal?: AbortSignal, description = 'Response'): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid JSON response bound.');
  signal?.throwIfAborted();
  if (!response.body) throw new Error(`${description} has no body.`);
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  const parts: string[] = [], decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) throw new Error(`${description} exceeds its byte limit.`);
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return JSON.parse(parts.join('')) as unknown;
  } finally {
    signal?.removeEventListener('abort', abort);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
