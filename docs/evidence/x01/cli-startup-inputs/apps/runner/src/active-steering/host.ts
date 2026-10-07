import { FlowApiError } from '@flow/client';
import { randomUUID } from 'node:crypto';
import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import type { SteeringCommandReference, SteeringMailbox } from '../../../../packages/contracts/src/active-steering.js';
import { textDigest } from '../verifier.js';
import { SteeringInput } from './input.js';
import { consumedUuids, isRootFrame, NativeResults } from './state.js';

/** Adds one input mailbox to the existing SDK query. It neither starts a second query nor retries a native send. */
export class NativeSteeringHost {
  readonly input: SteeringInput;
  private readonly results = new NativeResults();
  private readonly commands = new Map<string, SteeringCommandReference>();
  private mailbox: SteeringMailbox = { revision: 0, sealed: false, commands: [], delivery: null };
  private tail: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private session: string | undefined;
  private stopped = false;
  private failure: unknown;
  committed = false;
  constructor(private context: HarnessContext, private controller: AbortController, prompt: string) {
    this.input = new SteeringInput(controller.signal, { type: 'user', uuid: randomUUID(), message: { role: 'user', content: prompt }, parent_tool_use_id: null, session_id: context.task.resumeSessionId ?? '' });
  }
  start(session: string): void {
    if (this.session && this.session !== session) throw new Error('Steering native session changed.');
    if (this.session) return;
    this.session = session;
    const poll = async () => {
      if (this.stopped) return;
      try { await this.serial(() => this.readMailbox()); }
      catch (error) { this.failure = error; this.controller.abort(error); }
      if (!this.stopped && !this.controller.signal.aborted) this.timer = setTimeout(() => { void poll(); }, 100);
    };
    void poll();
  }
  async observe(frame: SDKMessage): Promise<{ freshResult: boolean; rootResult: boolean }> {
    return this.serial(async () => {
      this.check();
      if (!isRootFrame(frame)) return { freshResult: false, rootResult: false };
      if ('session_id' in frame && frame.session_id && frame.session_id !== this.session) throw new Error('Steering observation belongs to another session.');
      const uuids = consumedUuids(frame);
      for (const command of this.commands.values()) {
        if (command.status !== 'received' || !uuids.includes(command.userMessageUuid)) continue;
        if (!('uuid' in frame) || typeof frame.uuid !== 'string' || !['assistant', 'stream_event', 'result'].includes(frame.type)) continue;
        await this.context.emit({ type: 'steering-receipt', receipt: { ...receipt(command), receiptId: textDigest(`consumed:${command.id}:${frame.uuid}`), expectedReceiptRevision: command.receiptRevision, phase: 'observed-consumed', sourceMessageId: frame.uuid, sourceType: frame.type as 'assistant' | 'stream_event' | 'result', parentToolUseId: null, consumedUserMessageUuids: uuids } });
        this.commands.set(command.id, { ...command, status: 'observed-consumed', receiptRevision: command.receiptRevision + 1 });
      }
      if (frame.type !== 'result') return { freshResult: false, rootResult: false };
      const result = this.results.observe(frame);
      if (result) await this.context.emit({ type: 'steering-result', result });
      return { freshResult: result !== null, rootResult: true };
    });
  }
  async finalize(result: SDKResultMessage, events: () => Promise<RunnerEventData[]>): Promise<boolean> {
    return this.serial(async () => {
      this.check(); if (!await this.readMailbox()) return false;
      const latest = this.results.latest;
      if (!latest || latest.sourceMessageId !== result.uuid || latest.outcome !== 'success' || latest.queuedTurnCount !== 0 || this.input.pending) return false;
      if (this.mailbox.commands.some(command => ['accepted', 'received', 'unknown'].includes(command.status)
        || command.status === 'observed-consumed' && !this.results.covered.has(command.userMessageUuid))) return false;
      const response = await this.context.steering!.finalize({ expectedRevision: this.mailbox.revision, nativeSessionId: result.session_id, resultId: result.uuid, events: await events() });
      if (response.state === 'not-committed') { await this.readMailbox(); return false; }
      this.committed = true; this.stopped = true; clearTimeout(this.timer); this.input.close(); return true;
    });
  }
  async close(): Promise<void> { this.stopped = true; clearTimeout(this.timer); this.input.close(); await this.tail.catch(() => undefined); }
  private check() { if (this.failure) throw this.failure; this.controller.signal.throwIfAborted(); }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work); this.tail = next.catch(() => undefined); return next;
  }
  private async readMailbox(): Promise<boolean> {
    if (this.stopped) return false;
    this.check();
    try { this.mailbox = await this.context.steering!.mailbox(); }
    catch (error) {
      // A still-owned attempt may be waiting for a tool decision. Do not send input or finalize then.
      if (error instanceof FlowApiError && error.status === 409 && error.code === 'steering_unavailable') return false;
      throw error;
    }
    this.check();
    if (this.mailbox.sealed) throw new Error('The attempt was sealed before this host confirmed its proposal.');
    for (const command of this.mailbox.commands) {
      const previous = this.commands.get(command.id);
      if (previous && previous.receiptRevision > command.receiptRevision) throw new Error('Steering receipt moved backwards.');
      this.commands.set(command.id, command);
      if (command.status !== 'accepted') continue;
      const delivery = this.mailbox.delivery;
      if (!delivery || delivery.commandId !== command.id || textDigest(delivery.text) !== command.input.digest || Buffer.byteLength(delivery.text) !== command.input.bytes) throw new Error('Steering delivery does not match its bounded metadata.');
      await this.context.emit({ type: 'steering-receipt', receipt: { ...receipt(command), receiptId: textDigest(`received:${command.id}`), expectedReceiptRevision: command.receiptRevision, phase: 'received' } });
      const received = { ...command, status: 'received' as const, receiptRevision: command.receiptRevision + 1 };
      this.commands.set(command.id, received);
      // Durable received ACK precedes the one and only insertion into the SDK input source.
      this.input.push({ type: 'user', uuid: command.userMessageUuid as ReturnType<typeof randomUUID>, message: { role: 'user', content: delivery.text }, parent_tool_use_id: null, session_id: command.nativeSessionId });
    }
    return true;
  }
}
function receipt(command: SteeringCommandReference) { return { attemptId: command.attemptId, ownerVersion: command.ownerVersion, commandId: command.id, nativeSessionId: command.nativeSessionId, userMessageUuid: command.userMessageUuid }; }
