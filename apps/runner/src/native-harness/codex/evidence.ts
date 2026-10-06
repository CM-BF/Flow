import type { Json } from '../../codex/types.js';
import { createOrdinaryFinalProjection, type OrdinaryFinalObservation } from './projection.mjs';
import { assertOrdinaryItem } from './policy.js';
import { nativeId, nativeRecord } from './wire.js';

type Notification = { method: string; params: Json };
const ignoredDeltas = new Set(['item/agentMessage/delta', 'item/reasoning/summaryTextDelta', 'item/reasoning/textDelta', 'item/reasoning/summaryPartAdded']);

/** One continuous ordinary turn. Holds only bounded frames arriving before request IDs are bound. */
export class OrdinaryTurnEvidence {
  private threadId?: string;
  private turnId?: string;
  private projection?: ReturnType<typeof createOrdinaryFinalProjection>;
  private pending: Notification[] = [];
  private pendingBytes = 0;
  private notifications = 0;
  private decodedBytes = 0;
  observation: OrdinaryFinalObservation = { state: 'pending', final: null };

  bindThread(threadId: string) { this.threadId = nativeId.parse(threadId); this.drain(); }
  bindTurn(turn: { id: string; items: unknown[] }) {
    if (!this.threadId) throw new Error('Native thread is not bound.');
    this.turnId = nativeId.parse(turn.id);
    turn.items.forEach(assertOrdinaryItem);
    this.projection = createOrdinaryFinalProjection({ threadId: this.threadId, turnId: this.turnId });
    this.drain();
  }

  accept(notification: Notification) {
    this.notifications++;
    this.decodedBytes += Buffer.byteLength(JSON.stringify(notification));
    if (this.notifications > 256 || this.decodedBytes > 4 * 1024 * 1024) throw new Error('Native observation limit exceeded.');
    if (this.canRoute(notification)) this.route(notification);
    else {
      this.pendingBytes += Buffer.byteLength(JSON.stringify(notification));
      if (this.pending.length >= 64 || this.pendingBytes > 2 * 1024 * 1024) throw new Error('Unbound native evidence limit exceeded.');
      this.pending.push(notification);
    }
  }

  private canRoute(notification: Notification) { return Boolean(this.threadId && (notification.method === 'thread/started' || this.turnId)); }
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
        turn.items.forEach(assertOrdinaryItem);
        if (notification.method === 'turn/completed') this.observation = this.projection!.accept(notification);
        return;
      }
      case 'item/started':
      case 'item/completed':
        if (params.turnId !== this.turnId) throw new Error('Native turn mismatch.');
        assertOrdinaryItem(params.item);
        if (notification.method === 'item/completed') this.observation = this.projection!.accept(notification);
        return;
      default:
        if (!ignoredDeltas.has(notification.method) || params.turnId !== this.turnId || this.observation.state !== 'pending') {
          throw new Error('Unsupported native notification.');
        }
    }
  }
}
