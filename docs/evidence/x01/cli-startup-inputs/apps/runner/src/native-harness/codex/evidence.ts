import { z } from 'zod';
import type { Json } from '../../codex/types.js';
import { createOrdinaryFinalProjection, type OrdinaryFinalObservation } from './projection.mjs';
import { assertOrdinaryItem } from './policy.js';
import { nativeId, nativeRecord } from './wire.js';

export type CodexItemPhase = 'initial' | 'started' | 'completed' | 'terminal';
type Notification = { method: string; params: Json };
export interface CodexStreamDelta {
  readonly kind: 'text' | 'reasoning-summary' | 'reasoning-text';
  readonly threadId: string; readonly turnId: string; readonly itemId: string;
  readonly index: number | null; readonly delta: string;
  /** Full text supplied by an item/completed observation, never inferred from turn success. */
  readonly completedText?: string;
}
const index = z.number().int().nonnegative().max(10_000);
const deltaIdentity = { threadId: nativeId, turnId: nativeId, itemId: nativeId };
const deltaText = z.string().max(4 * 1024 * 1024);
const agentDelta = z.strictObject({ ...deltaIdentity, delta: deltaText });
const summaryDelta = agentDelta.extend({ summaryIndex: index });
const reasoningDelta = agentDelta.extend({ contentIndex: index });
const summaryPart = z.strictObject({ ...deltaIdentity, summaryIndex: index });
const remoteStatus = z.strictObject({ status: z.enum(['disabled', 'connecting', 'connected', 'errored']),
  serverName: z.string(), installationId: z.string(), environmentId: z.string().nullable() });
const threadStatus = z.strictObject({ threadId: nativeId, status: z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('notLoaded') }), z.strictObject({ type: z.literal('idle') }), z.strictObject({ type: z.literal('systemError') }),
  z.strictObject({ type: z.literal('active'), activeFlags: z.array(z.enum(['waitingOnApproval', 'waitingOnUserInput'])).max(16) }),
]) });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const tokens = z.strictObject({ totalTokens: count, inputTokens: count, cachedInputTokens: count, cacheWriteInputTokens: count, outputTokens: count, reasoningOutputTokens: count });
const tokenUsage = z.strictObject({ threadId: nativeId, turnId: nativeId,
  tokenUsage: z.strictObject({ total: tokens, last: tokens, modelContextWindow: count.nullable() }) });

/** One continuous turn with a consumer-owned finite item policy. Holds only bounded frames arriving before request IDs are bound. */
export class CodexTurnEvidence {
  private threadId?: string;
  private turnId?: string;
  private projection?: ReturnType<typeof createOrdinaryFinalProjection>;
  private pending: Notification[] = [];
  private pendingBytes = 0;
  private stream: CodexStreamDelta[] = [];
  private streamBytes = 0;
  private readonly streamed = new Map<string, CodexStreamDelta>();
  private readonly completedItems = new Set<string>();
  private decodedBytes = 0;
  observation: OrdinaryFinalObservation = { state: 'pending', final: null };

  constructor(private readonly checkItem: (item: unknown, phase: CodexItemPhase) => void) {}

  matches(threadId: unknown, turnId: unknown): boolean { return Boolean(this.threadId && this.turnId && this.threadId === threadId && this.turnId === turnId); }
  bindThread(threadId: string) { this.threadId = nativeId.parse(threadId); this.drain(); }
  bindTurn(turn: { id: string; items: unknown[] }) {
    if (!this.threadId) throw new Error('Native thread is not bound.');
    this.turnId = nativeId.parse(turn.id);
    turn.items.forEach(item => this.checkItem(item, 'initial'));
    this.projection = createOrdinaryFinalProjection({ threadId: this.threadId, turnId: this.turnId });
    this.drain();
  }

  accept(notification: Notification) {
    const bytes = Buffer.byteLength(JSON.stringify(notification));
    this.decodedBytes += bytes;
    if (this.decodedBytes > 4 * 1024 * 1024) throw new Error('Native observation limit exceeded.');
    // Global status carries no turn evidence or public identity. Validate, then discard its private identity fields.
    if (notification.method === 'remoteControl/status/changed') { remoteStatus.parse(notification.params); return; }
    if (this.canRoute(notification)) this.route(notification);
    else {
      this.pendingBytes += bytes;
      if (this.pending.length >= 64 || this.pendingBytes > 2 * 1024 * 1024) throw new Error('Unbound native evidence limit exceeded.');
      this.pending.push(notification);
    }
  }

  /** The single receive consumer drains this bounded queue before reading another frame.
   * It awaits its downstream sink; no unbounded async fire-and-forget writes. */
  takeStreamDeltas(): readonly CodexStreamDelta[] { return this.takeStreamUpdates().filter(item => item.completedText === undefined); }
  takeStreamUpdates(): readonly CodexStreamDelta[] { const items = this.stream; this.stream = []; this.streamBytes = 0; return items; }
  private canRoute(notification: Notification) { return Boolean(this.threadId && (['thread/started', 'thread/status/changed'].includes(notification.method) || this.turnId)); }
  private drain() {
    const deferred: Notification[] = [];
    for (const notification of this.pending) {
      if (this.canRoute(notification)) this.route(notification); else deferred.push(notification);
    }
    this.pending = deferred;
    this.pendingBytes = deferred.reduce((size, item) => size + Buffer.byteLength(JSON.stringify(item)), 0);
  }
  private route(notification: Notification) {
    const params = nativeRecord.parse(notification.params);
    if (notification.method === 'thread/status/changed') {
      const value = threadStatus.parse(params);
      if (value.threadId !== this.threadId || value.status.type === 'systemError') throw new Error('Native thread status rejected.');
      return;
    }
    if (notification.method === 'thread/tokenUsage/updated') {
      const value = tokenUsage.parse(params);
      if (!this.matches(value.threadId, value.turnId)) throw new Error('Native token usage identity rejected.');
      return;
    }
    if (this.observation.state !== 'pending' && !['item/completed', 'turn/completed'].includes(notification.method)) {
      throw new Error('Native activity arrived after terminal.');
    }
    if (notification.method === 'thread/started') {
      if (nativeRecord.parse(params.thread).id !== this.threadId) throw new Error('Native thread receipt differs.');
      return;
    }
    if (params.threadId !== this.threadId) throw new Error('Native thread mismatch.');
    switch (notification.method) {
      case 'turn/started':
      case 'turn/completed': {
        const turn = nativeRecord.parse(params.turn);
        if (turn.id !== this.turnId || !Array.isArray(turn.items) || turn.items.length > 1000) throw new Error('Native turn mismatch.');
        turn.items.forEach(item => this.checkItem(item, notification.method === 'turn/completed' ? 'terminal' : 'initial'));
        if (notification.method === 'turn/completed') this.observation = this.projection!.accept(notification);
        return;
      }
      case 'item/started':
      case 'item/completed':
        if (params.turnId !== this.turnId) throw new Error('Native turn mismatch.');
        this.checkItem(params.item, notification.method === 'item/completed' ? 'completed' : 'started');
        if (notification.method === 'item/completed') {
          this.observation = this.projection!.accept(notification);
          this.completeStreams(nativeRecord.parse(params.item));
        }
        return;
      default:
        if (params.turnId !== this.turnId || this.observation.state !== 'pending') throw new Error('Unsupported native notification.');
        this.acceptDelta(notification.method, params);
    }
  }
  private acceptDelta(method: string, params: unknown) {
    if (method === 'item/reasoning/summaryPartAdded') { summaryPart.parse(params); return; }
    let value: CodexStreamDelta;
    if (method === 'item/agentMessage/delta') value = { ...agentDelta.parse(params), kind: 'text', index: null };
    else if (method === 'item/reasoning/summaryTextDelta') { const { summaryIndex, ...parsed } = summaryDelta.parse(params); value = { ...parsed, kind: 'reasoning-summary', index: summaryIndex }; }
    else if (method === 'item/reasoning/textDelta') { const { contentIndex, ...parsed } = reasoningDelta.parse(params); value = { ...parsed, kind: 'reasoning-text', index: contentIndex }; }
    else throw new Error('Unsupported native notification.');
    if (this.completedItems.has(value.itemId)) throw new Error('Stream arrived after item completion.');
    const key = JSON.stringify([value.itemId, value.kind, value.index]);
    if (!this.streamed.has(key) && this.streamed.size >= 256) throw new Error('Native stream block limit exceeded.');
    this.streamed.set(key, { ...value, delta: '' });
    this.enqueue(value);
  }
  private completeStreams(item: Record<string, unknown>) {
    const streams = [...this.streamed.values()].filter(value => value.itemId === item.id);
    if (!streams.length || this.completedItems.has(String(item.id))) return;
    for (const value of streams) {
      const text = value.kind === 'text' ? item.text : Array.isArray(item[value.kind === 'reasoning-summary' ? 'summary' : 'content'])
        ? (item[value.kind === 'reasoning-summary' ? 'summary' : 'content'] as unknown[])[value.index!] : undefined;
      if (typeof text !== 'string') throw new Error('Stream completion text missing.');
      this.enqueue({ ...value, completedText: text });
    }
    this.completedItems.add(String(item.id));
  }
  private enqueue(value: CodexStreamDelta) {
    this.streamBytes += Buffer.byteLength(value.completedText ?? value.delta);
    if (this.stream.length >= 64 || this.streamBytes > 2 * 1024 * 1024) throw new Error('Native stream queue limit exceeded.');
    this.stream.push(value);
  }
}

/** Keeps the ordinary consumer incapable of accepting file or tool items. */
export class OrdinaryTurnEvidence extends CodexTurnEvidence { constructor() { super(assertOrdinaryItem); } }
