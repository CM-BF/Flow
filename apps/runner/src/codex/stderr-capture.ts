import type { PrivateStderrSink, StderrCaptureReport } from './types.js';

/** Bounded byte delivery only. Process, stream lifetime and private file ownership stay outside. */
export function createStderrCapture(sink: PrivateStderrSink) {
  const { maxBytes, write } = sink;
  let observedBytes = 0; let copiedBytes = 0; let writtenBytes = 0;
  let observerFailed = false; let delivering = false; let streamEnded = false; let streamFailed = false;
  return {
    push(chunk: Uint8Array): void {
      observedBytes = Math.min(Number.MAX_SAFE_INTEGER, observedBytes + chunk.byteLength);
      if (delivering) { observerFailed = true; return; }
      if (observerFailed || copiedBytes === maxBytes) return;
      const length = Math.min(chunk.byteLength, maxBytes - copiedBytes);
      if (!length) return;
      // Reserve before calling trusted host code, including reentrant close/error paths.
      copiedBytes += length;
      const bytes = Buffer.from(chunk.subarray(0, length));
      delivering = true;
      try {
        const result = write(bytes);
        if (result !== undefined) {
          observerFailed = true;
          // Assimilate rejecting Promises/thenables safely; never keep or report their error.
          void Promise.resolve(result).catch(() => {});
        } else writtenBytes += length;
      } catch { observerFailed = true; }
      finally { delivering = false; }
    },
    end(): void { streamEnded = true; },
    error(): void { streamFailed = true; },
    report(childCloseObserved: boolean): StderrCaptureReport {
      return { observedBytes, writtenBytes, truncated: observedBytes > maxBytes, observerFailed,
        streamEnded, childCloseObserved, incomplete: !streamEnded || streamFailed || !childCloseObserved };
    },
  };
}
