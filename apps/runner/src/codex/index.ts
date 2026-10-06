import { spawn } from 'node:child_process';
import { createStderrCapture } from './stderr-capture.js';
import { JsonLineDecoder, encodeJsonLine } from './framing.js';
import { BoundedWriter, type WriteTicket } from './writer.js';
import { normalizeOptions, validText } from './options.js';
import { CodexTransportError, type CloseReport, type CodexTransport, type ErrorCode, type Inbound, type Json, type ReadyInfo, type Reply, type RequestId, type TransportOptions, type TransportSnapshot } from './types.js';
export { CodexTransportError } from './types.js';
export type { CloseReport, CodexTransport, Inbound, Json, Limits, ReadyInfo, Reply, RequestId, PrivateStderrSink, StderrCaptureReport, TransportOptions, TransportSnapshot } from './types.js';
interface Pending { sent: boolean; ticket?: WriteTicket; resolve: (result: Json) => void; reject: (error: CodexTransportError) => void; cleanup: () => void }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const idValid = (id: unknown): id is RequestId => typeof id === 'number' ? Number.isSafeInteger(id) : validText(id, 256);
const idKey = (id: RequestId) => `${typeof id}:${id}`;
const addCount = (total: number, next: number) => Math.min(Number.MAX_SAFE_INTEGER, total + next);

/** Owns only a local stdio connection. Model/turn, approvals, retry and Flow lifecycle belong to its consumer. */
export function createCodexTransport(rawOptions: TransportOptions): CodexTransport {
  const { options, limits } = normalizeOptions(rawOptions);
  if (options.signal?.aborted) throw new CodexTransportError('ABORTED', 'not-sent');
  const child = spawn(options.spawn.executable, options.spawn.args, { cwd: options.spawn.cwd, env: options.spawn.environment, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  const stderrCapture = options.privateStderr ? createStderrCapture(options.privateStderr) : undefined;
  let childCloseObserved = false;
  let state: TransportSnapshot['state'] = 'starting';
  let reason: ErrorCode = 'CLOSED';
  let nextId = 0; let ignoredResponses = 0; let stderrBytes = 0;
  let inboundBytes = 0; let peakInboundBytes = 0;
  const inbox: { value: Inbound; bytes: number }[] = [];
  const pending = new Map<number, Pending>();
  // Unknown sent requests still occupy remote concurrency; never refill by timing out repeatedly.
  const reservations = new Set<number>();
  const serverRequests = new Map<string, 'queued' | 'delivered' | 'responding'>();
  let receiver: ((value: Inbound | null) => void) | undefined;
  let terminateTimer: NodeJS.Timeout | undefined; let killTimer: NodeJS.Timeout | undefined;
  let drainTimer: NodeJS.Timeout | undefined;
  let resolveClosed!: (report: CloseReport) => void;
  const closed = new Promise<CloseReport>(resolve => { resolveClosed = resolve; });
  const writer = new BoundedWriter(child.stdin, limits.outboundBytes, limits.outboundFrames, limits.requestTimeoutMs, timeout => stop(timeout ? 'TIMEOUT' : 'WRITE_FAILED'));
  const decoder = new JsonLineDecoder(limits.frameBytes, accept);
  const initializationTimer = setTimeout(() => stop('TIMEOUT'), limits.initializeTimeoutMs);
  const onAbort = () => stop('ABORTED');
  options.signal?.addEventListener('abort', onAbort, { once: true });

  function finishClose(): void {
    if (state === 'closed') return;
    state = 'closed'; clearTimeout(terminateTimer); clearTimeout(killTimer); clearTimeout(drainTimer);
    options.signal?.removeEventListener('abort', onAbort);
    child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); decoder.clear();
    serverRequests.clear();
    receiver?.(null); receiver = undefined;
    resolveClosed({ reason, child: child.exitCode !== null || child.signalCode !== null ? 'confirmed-exited' : 'unconfirmed', exitCode: child.exitCode, signal: child.signalCode, remoteEffects: 'unknown',
      ...(stderrCapture ? { stderrCapture: stderrCapture.report(childCloseObserved) } : {}) });
  }
  function stop(code: ErrorCode): void {
    if (state === 'closing' || state === 'closed') return;
    state = 'closing'; reason = code; clearTimeout(initializationTimer);
    for (const [id, entry] of pending) settle(id, new CodexTransportError(code, entry.sent ? 'unknown' : 'not-sent'));
    reservations.clear(); writer.stop(); decoder.clear();
    receiver?.(null); receiver = undefined;
    child.stdin.destroy();
    if (stderrCapture) {
      // One absolute drain deadline from first stop; repeated close/chunks never extend it.
      drainTimer = setTimeout(finishClose, limits.terminateMs + limits.killMs);
      if (childCloseObserved) { finishClose(); return; }
      if (child.exitCode !== null || child.signalCode !== null) return;
    } else if (child.exitCode !== null || child.signalCode !== null) { finishClose(); return; }
    try { child.kill('SIGTERM'); } catch { /* Report unconfirmed if the owned handle cannot be signalled. */ }
    terminateTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) { if (!stderrCapture) finishClose(); return; }
      try { child.kill('SIGKILL'); } catch { /* The bounded deadline still settles closed as unconfirmed. */ }
      if (!stderrCapture) killTimer = setTimeout(finishClose, limits.killMs);
    }, limits.terminateMs);
  }
  function settle(id: number, error?: CodexTransportError, result?: Json): void {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id); entry.cleanup();
    if (!error || !entry.sent || error.delivery === 'remote-error') reservations.delete(id);
    if (error) { entry.ticket?.cancel(); entry.reject(error); } else entry.resolve(result!);
  }
  const encode = (value: unknown) => encodeJsonLine(value, limits.frameBytes);
  function sendRequest(method: string, params: Json, timeoutMs: number, signal?: AbortSignal): Promise<Json> {
    if (signal?.aborted) return Promise.reject(new CodexTransportError('ABORTED', 'not-sent'));
    if (!validText(method) || params === undefined || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 90_000) return Promise.reject(new CodexTransportError('INVALID_OPTIONS', 'not-sent'));
    if (reservations.size >= limits.pendingRequests || nextId === Number.MAX_SAFE_INTEGER) return Promise.reject(new CodexTransportError('LIMIT', 'not-sent'));
    const id = ++nextId;
    return new Promise<Json>((resolve, reject) => {
      const cancel = () => { const entry = pending.get(id); if (entry) settle(id, new CodexTransportError('ABORTED', entry.sent ? 'unknown' : 'not-sent')); };
      const timer = setTimeout(() => { const entry = pending.get(id); if (entry) settle(id, new CodexTransportError('TIMEOUT', entry.sent ? 'unknown' : 'not-sent')); }, timeoutMs);
      const entry: Pending = { sent: false, resolve, reject, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); } };
      pending.set(id, entry); reservations.add(id); signal?.addEventListener('abort', cancel, { once: true });
      try {
        entry.ticket = writer.enqueue(encode({ id, method, params }), () => { entry.sent = true; });
        entry.ticket.done.catch(() => { if (pending.has(id)) settle(id, new CodexTransportError('WRITE_FAILED', entry.sent ? 'unknown' : 'not-sent')); });
      } catch (error) { settle(id, error instanceof CodexTransportError ? error : new CodexTransportError('WRITE_FAILED', 'not-sent')); }
    });
  }
  function enqueue(value: Inbound, bytes: number): void {
    if (receiver) {
      if (value.kind === 'server-request') serverRequests.set(idKey(value.id), 'delivered');
      const resolve = receiver; receiver = undefined; resolve(value); return;
    }
    if (inbox.length >= limits.inboundFrames || inboundBytes + bytes > limits.inboundBytes) throw new CodexTransportError('LIMIT', 'unknown');
    inbox.push({ value, bytes }); inboundBytes += bytes; peakInboundBytes = Math.max(peakInboundBytes, inboundBytes);
  }
  function accept(value: unknown, bytes: number): void {
    if (state === 'closing' || state === 'closed') return;
    if (!object(value)) throw new CodexTransportError('PROTOCOL', 'unknown');
    if ('method' in value) {
      if (!validText(value.method) || 'result' in value || 'error' in value) throw new CodexTransportError('PROTOCOL', 'unknown');
      const params = (value.params ?? null) as Json;
      if ('id' in value) {
        if (!idValid(value.id) || serverRequests.has(idKey(value.id))) throw new CodexTransportError('PROTOCOL', 'unknown');
        if (serverRequests.size >= limits.serverRequests) throw new CodexTransportError('LIMIT', 'unknown');
        serverRequests.set(idKey(value.id), 'queued');
        enqueue({ kind: 'server-request', id: value.id, method: value.method, params }, bytes);
      } else enqueue({ kind: 'notification', method: value.method, params }, bytes);
      return;
    }
    if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0 || value.id > nextId || ('result' in value) === ('error' in value)) throw new CodexTransportError('PROTOCOL', 'unknown');
    if ('error' in value && (!object(value.error) || !Number.isSafeInteger(value.error.code) || typeof value.error.message !== 'string')) throw new CodexTransportError('PROTOCOL', 'unknown');
    if (pending.has(value.id) && !pending.get(value.id)!.sent) throw new CodexTransportError('PROTOCOL', 'unknown');
    if (!pending.has(value.id)) { reservations.delete(value.id); ignoredResponses = addCount(ignoredResponses, 1); return; }
    if ('error' in value) settle(value.id, new CodexTransportError('REMOTE_ERROR', 'remote-error', (value.error as { code: number }).code));
    else settle(value.id, undefined, value.result as Json);
  }
  child.stdout.on('data', (chunk: Buffer) => {
    if (state === 'closing' || state === 'closed') return;
    try { decoder.push(chunk); } catch (error) { stop(error instanceof CodexTransportError ? error.code : 'PROTOCOL'); }
  });
  child.stdout.on('end', () => {
    if (state === 'closing' || state === 'closed') return;
    try { decoder.end(); stop('DISCONNECTED'); } catch { stop('PROTOCOL'); }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes = addCount(stderrBytes, chunk.length);
    if (state !== 'closed') stderrCapture?.push(chunk);
  });
  if (stderrCapture) child.stderr.on('end', () => stderrCapture.end());
  child.stdin.on('error', () => stop('WRITE_FAILED'));
  child.stdout.on('error', () => stop('DISCONNECTED'));
  child.stderr.on('error', () => { stderrCapture?.error(); stop('DISCONNECTED'); });
  child.on('error', () => stop('SPAWN_FAILED'));
  if (stderrCapture) child.on('exit', () => stop('DISCONNECTED'));
  child.on('close', () => { childCloseObserved = true; stop('DISCONNECTED'); finishClose(); });
  const ready = (async (): Promise<ReadyInfo> => {
    try {
      const result = await sendRequest('initialize', options.initialize as unknown as Json, limits.initializeTimeoutMs);
      if (!object(result) || !validText(result.userAgent, 8192) || !validText(result.platformFamily) || !validText(result.platformOs) || !validText(result.codexHome, 4096)) throw new CodexTransportError('PROTOCOL', 'unknown');
      await writer.enqueue(encode({ method: 'initialized' })).done;
      if (state !== 'starting') throw new CodexTransportError(reason, 'unknown');
      state = 'ready'; clearTimeout(initializationTimer);
      return { userAgent: result.userAgent, platformFamily: result.platformFamily, platformOs: result.platformOs };
    } catch (error) { stop(error instanceof CodexTransportError ? error.code : 'PROTOCOL'); throw error; }
  })();
  // Consumers may observe closed before awaiting ready; always install a rejection handler.
  void ready.catch(() => {});
  return {
    ready, closed,
    request(method, params, requestOptions = {}) {
      if (state !== 'ready') return Promise.reject(new CodexTransportError(state === 'starting' ? 'NOT_READY' : 'CLOSED', 'not-sent'));
      if (method === 'initialize' || method === 'initialized') return Promise.reject(new CodexTransportError('INVALID_OPTIONS', 'not-sent'));
      return sendRequest(method, params, requestOptions.timeoutMs ?? limits.requestTimeoutMs, requestOptions.signal);
    },
    receive() {
      if (receiver) return Promise.reject(new CodexTransportError('CONCURRENT_RECEIVE', 'not-sent'));
      const item = inbox.shift();
      if (item) {
        inboundBytes -= item.bytes;
        if (item.value.kind === 'server-request' && state !== 'closed') serverRequests.set(idKey(item.value.id), 'delivered');
        return Promise.resolve(item.value);
      }
      if (state === 'closing' || state === 'closed') return Promise.resolve(null);
      return new Promise(resolve => { receiver = resolve; });
    },
    async respond(id: RequestId, reply: Reply) {
      if (state !== 'ready') throw new CodexTransportError(state === 'starting' ? 'NOT_READY' : 'CLOSED', 'not-sent');
      if (!idValid(id) || serverRequests.get(idKey(id)) !== 'delivered' || !object(reply) || ('result' in reply) === ('error' in reply)
        || 'error' in reply && (!object(reply.error) || !Number.isSafeInteger(reply.error.code) || !validText(reply.error.message, 4096))) throw new CodexTransportError('INVALID_OPTIONS', 'not-sent');
      let sent = false;
      try {
        const ticket = writer.enqueue(encode({ id, ...reply }), () => { sent = true; });
        serverRequests.set(idKey(id), 'responding'); await ticket.done; serverRequests.delete(idKey(id));
      } catch (error) {
        if (!sent && state === 'ready') serverRequests.set(idKey(id), 'delivered');
        throw new CodexTransportError(error instanceof CodexTransportError ? error.code : 'WRITE_FAILED', sent ? 'unknown' : 'not-sent');
      }
    },
    close() { stop('CLOSED'); return closed; },
    snapshot() { return { state, pid: child.pid ?? null, pendingRequests: pending.size, unansweredRequests: reservations.size, serverRequests: serverRequests.size, inboundBytes, inboundFrames: inbox.length,
      peakInboundBytes, ...writer.snapshot(), stderrBytes, ignoredResponses }; },
  };
}
