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
/** Private composition seam for the ordinary and file-writer consumers, never task JSON. */
export interface CodexExchangeRecipe<Thread extends { threadId: string } = { threadId: string }> {
  readonly evidence: CodexTurnEvidence;
  readonly startThread: Json;
  /** Trusted sink observes cancellation; interrupted delivery has unknown effects, never terminal proof. */
  onStream?(delta: CodexStreamDelta, signal: AbortSignal): Promise<void>;
  readonly threadMethod?: 'thread/start' | 'thread/resume';
  startTurn(threadId: string): Json;
  readThread(response: Json): Thread;
  checkCompletion(): void;
  respond(method: string, params: Json): { allowed: boolean; reply: Reply };
}
export async function runCodexExchange<Thread extends { threadId: string }>(createTransport: CodexTransportFactory, input: CodexExchangeInput,
  limits: { wallTimeMs: number; maxOutputBytes: number }, recipe: CodexExchangeRecipe<Thread>) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), limits.wallTimeMs);
  const signal = AbortSignal.any([input.signal, deadline.signal]);
  const evidence = recipe.evidence;
  let transport: CodexTransport | undefined, pump: Promise<void> | undefined;
  let dispatched = false, violated = false, pumpFailed = false;
  let wake!: () => void;
  const terminal = new Promise<void>(resolve => { wake = resolve; });
  let streamDelivery = Promise.resolve();
  async function flushStream() {
    const deltas = evidence.takeStreamDeltas();
    // Binding and receive can both release evidence; serialize the one downstream sink.
    streamDelivery = streamDelivery.then(async () => {
      for (const delta of deltas) {
        signal.throwIfAborted();
        if (recipe.onStream) await deliverStream(delta);
      }
    });
    await streamDelivery;
  }
  async function deliverStream(delta: CodexStreamDelta) {
    const delivery = recipe.onStream!(delta, signal);
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
  function checkTerminal() { if (evidence.observation.state !== 'pending') wake(); }
  try {
    transport = createTransport({ signal, workingDirectory: input.workingDirectory });
    await transport.ready;
    const connected = transport;
    // Exactly one R06 consumer. No SDK loop, request retries, durable state or lifecycle events here.
    pump = (async () => {
      try {
        let observed = 0;
        for (let message = await connected.receive(); message !== null; message = await connected.receive()) {
          signal.throwIfAborted();
          if (++observed % 32 === 0) await yieldToIO(undefined, { signal });
          if (message.kind === 'server-request') {
            const answer = recipe.respond(message.method, message.params);
            violated ||= !answer.allowed;
            await connected.respond(message.id, answer.reply);
            if (violated) wake();
          } else { evidence.accept(message); await flushStream(); checkTerminal(); }
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
