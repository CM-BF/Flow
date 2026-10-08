import { setImmediate as yieldToIO } from 'node:timers/promises';
import { CodexTransportError, type CodexTransport, type Json, type Reply } from '../../codex/types.js';
import { NativeExecutionError } from '../settlement.js';
import type { CodexStreamDelta, CodexTurnEvidence } from './evidence.js';
import { readTurnReceipt } from './wire.js';

/** Trusted host code owns process policy; there is no default executable or ambient environment. */
export type CodexTransportFactory = (options: { signal: AbortSignal; workingDirectory: string }) => CodexTransport;
export interface CodexExchangeInput {
  readonly workingDirectory: string;
  readonly signal: AbortSignal;
  assertOwnership(): Promise<void>;
}
/** Only buffered stream output arms a wakeup; the exchange owns and clears its one timer. */
export interface CodexStreamFlush {
  delayMs(): number | null;
  flush(signal: AbortSignal): Promise<void>;
}
/** Private composition seam for the ordinary and file-writer consumers, never task JSON. */
export interface CodexExchangeRecipe<Thread extends { threadId: string } = { threadId: string }> {
  readonly evidence: CodexTurnEvidence;
  readonly startThread: Json;
  /** Trusted sink observes cancellation; interrupted delivery has unknown effects, never terminal proof. */
  onStream?(delta: CodexStreamDelta, signal: AbortSignal): Promise<void>;
  onStreamComplete?(delta: CodexStreamDelta, signal: AbortSignal): Promise<void>;
  readonly streamFlush?: CodexStreamFlush;
  readonly threadMethod?: 'thread/start' | 'thread/resume';
  startTurn(threadId: string): Json;
  readThread(response: Json): Thread;
  checkCompletion(): void;
  respond(method: string, params: Json): { allowed: boolean; reply: Reply };
}
/** The trusted async recipe owns unfinished effects after an unknown reply. Keep the synchronous
 * recipe's direct-call contract intact. Transport close is never tool writer revocation. */
export type AsyncCodexExchangeRecipe<Thread extends { threadId: string } = { threadId: string }> = Omit<CodexExchangeRecipe<Thread>, 'respond'> & {
  respond(method: string, params: Json, signal: AbortSignal): Promise<{ allowed: boolean; reply: Reply }>;
};
export async function runCodexExchange<Thread extends { threadId: string }>(createTransport: CodexTransportFactory, input: CodexExchangeInput,
  limits: { wallTimeMs: number; maxOutputBytes: number }, recipe: Omit<CodexExchangeRecipe<Thread>, 'respond'> & {
    respond(method: string, params: Json, signal: AbortSignal): { allowed: boolean; reply: Reply } | Promise<{ allowed: boolean; reply: Reply }>;
  }) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), limits.wallTimeMs);
  const signal = AbortSignal.any([input.signal, deadline.signal]);
  const evidence = recipe.evidence;
  let transport: CodexTransport | undefined, pump: Promise<void> | undefined;
  let dispatched = false, violated = false, pumpFailed = false;
  let wake!: () => void;
  const terminal = new Promise<void>(resolve => { wake = resolve; });
  let streamDelivery = Promise.resolve();
  let wakeStream: (() => void) | undefined;
  async function flushStream() {
    const deltas = evidence.takeStreamUpdates();
    // Binding and receive can both release evidence; serialize the one downstream sink.
    streamDelivery = streamDelivery.then(async () => {
      for (const delta of deltas) {
        signal.throwIfAborted();
        const sink = delta.completedText === undefined ? recipe.onStream : recipe.onStreamComplete;
        if (sink) await deliverStream(() => sink(delta, signal));
      }
    });
    await streamDelivery;
    // Binding may have released a buffered delta while the pump was already waiting for input.
    wakeStream?.();
  }
  async function deliverStream(sink: () => Promise<void>) {
    signal.throwIfAborted();
    const delivery = sink();
    let abort!: () => void;
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason ?? new Error('Native stream interrupted.'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    // Stop waiting on an uncooperative sink. This does not assert that its effects stopped.
    try { await Promise.race([delivery, interrupted]); }
    finally { signal.removeEventListener('abort', abort); }
  }
  async function receiveOrFlush(pending: ReturnType<CodexTransport['receive']>) {
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const due = evidence.observation.state === 'pending' ? recipe.streamFlush?.delayMs() ?? null : null;
    const flush = new Promise<null>(resolve => {
      wakeStream = () => resolve(null);
      if (due !== null) flushTimer = setTimeout(wakeStream, Math.max(0, due));
    });
    const abort = () => wakeStream?.();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    try { return await Promise.race([pending.then(message => ({ message })), flush]); }
    finally { clearTimeout(flushTimer); wakeStream = undefined; signal.removeEventListener('abort', abort); }
  }
  function checkTerminal() { if (evidence.observation.state !== 'pending') wake(); }
  try {
    transport = createTransport({ signal, workingDirectory: input.workingDirectory });
    await transport.ready;
    const connected = transport;
    // Exactly one R06 consumer. No SDK loop, request retries, durable state or lifecycle events here.
    pump = (async () => {
      try {
        let observed = 0;
        let pending = connected.receive();
        for (;;) {
          const received = await receiveOrFlush(pending);
          signal.throwIfAborted();
          if (received === null) {
            streamDelivery = streamDelivery.then(async () => {
              if (evidence.observation.state === 'pending' && recipe.streamFlush) await deliverStream(() => recipe.streamFlush!.flush(signal));
            });
            await streamDelivery;
            continue; // Keep exactly the same pending receive across timer/dispatch wakeups.
          }
          const message = received.message;
          if (message === null) break;
          if (++observed % 32 === 0) await yieldToIO(undefined, { signal });
          if (message.kind === 'server-request') {
            const answer = await recipe.respond(message.method, message.params, signal);
            signal.throwIfAborted();
            violated ||= !answer.allowed;
            await connected.respond(message.id, answer.reply);
            if (violated) wake();
          } else { evidence.accept(message); await flushStream(); checkTerminal(); }
          pending = connected.receive();
        }
      } catch { pumpFailed = true; } // Discard AssertionError actual/expected and every raw native payload.
      finally { wake(); }
    })();
    dispatched = true;
    let response;
    try { response = await connected.request(recipe.threadMethod ?? 'thread/start', recipe.startThread, { signal }); }
    catch (error) { if (error instanceof CodexTransportError && error.delivery === 'not-sent') dispatched = false; throw error; }
    const thread = recipe.readThread(response);
    evidence.bindThread(thread.threadId); await flushStream();
    if (violated || pumpFailed) throw new Error('Native evidence rejected.');
    await input.assertOwnership(); signal.throwIfAborted();
    const started = await connected.request('turn/start', recipe.startTurn(thread.threadId), { signal });
    evidence.bindTurn(readTurnReceipt(started)); await flushStream(); checkTerminal();
    await terminal;
    const close = await connected.close();
    await pump;
    if (violated || pumpFailed || close.child !== 'confirmed-exited' || close.reason !== 'CLOSED') throw new NativeExecutionError('unknown');
    const observation = evidence.observation;
    if (observation.state !== 'completed') throw new NativeExecutionError(observation.state === 'failed' || observation.state === 'interrupted' ? 'settled' : 'unknown');
    if (Buffer.byteLength(observation.final.text) > limits.maxOutputBytes) throw new NativeExecutionError('settled');
    recipe.checkCompletion();
    signal.throwIfAborted();
    return { thread, observation };
  } catch (error) {
    if (error instanceof NativeExecutionError) throw error;
    throw new NativeExecutionError(dispatched ? 'unknown' : 'settled');
  } finally {
    clearTimeout(timer);
    let childConfirmed = true;
    if (transport) {
      try { childConfirmed = (await transport.close()).child === 'confirmed-exited'; }
      catch { childConfirmed = false; }
    }
    await pump;
    if (!childConfirmed) throw new NativeExecutionError('unknown');
  }
}
