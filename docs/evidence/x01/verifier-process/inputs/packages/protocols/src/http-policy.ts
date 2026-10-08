export interface RemoteOptions {
  url: string;
  token?: string;
  allowLoopbackHttp?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

/** A mutation may have reached the peer; callers must reconcile, never blind-retry. */
export class RemoteOutcomeUncertainError extends Error {
  constructor(public readonly operation: string, public readonly reference: string | undefined, cause: unknown) {
    super(`${operation} acknowledgement was lost; reconcile the remote task before retrying.`, { cause });
    this.name = 'RemoteOutcomeUncertainError';
  }
}

export function remoteUrl(options: RemoteOptions): URL {
  const url = new URL(options.url);
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && options.allowLoopbackHttp))) {
    throw new Error('Remote endpoint requires HTTPS (or explicitly allowed loopback HTTP), without embedded credentials or fragments.');
  }
  return url;
}

/** SDK owns wire parsing; this wrapper only enforces host policy and resource limits. */
export function guardedFetch(options: RemoteOptions): typeof fetch {
  const endpoint = remoteUrl(options);
  const timeout = options.timeoutMs ?? 15_000;
  const limit = options.maxResponseBytes ?? 4 * 1024 * 1024;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || !Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid transport limits.');
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== endpoint.origin) throw new Error('Agent endpoint origin is not authorized.');
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    const existingSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = existingSignal ? AbortSignal.any([existingSignal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
    const response = await fetch(input, { ...init, headers, signal, redirect: 'error' });
    if (!response.body) return response;
    const reader = response.body.getReader();
    let received = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { controller.close(); reader.releaseLock(); return; }
          received += chunk.value.byteLength;
          if (received > limit) { await reader.cancel(); throw new Error('Protocol response exceeded its byte budget.'); }
          controller.enqueue(chunk.value);
        } catch (error) { controller.error(error); }
      },
      async cancel(reason) { await reader.cancel(reason); },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
