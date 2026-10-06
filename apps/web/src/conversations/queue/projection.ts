import { ReadCache, bodyBytes } from "../read-cache";
import { freezeContextSelection, type FrozenCitation } from "../../conversation-context/selection";
import { TERMINAL_STATUSES, type ConversationQueuePage, type ConversationQueueItemDetail } from "@flow/contracts";
import { QueueCommands, assertCurrentTurn, assertQueueItem, queueError, validRevision, type QueuePort, type QueueReceipt } from "./commands";

export interface QueueState {
  available: boolean;
  page: ConversationQueuePage | null;
  loading: boolean;
  stale: boolean;
  online: boolean;
  error: string | null;
  receipts: readonly QueueReceipt[];
  details: Readonly<Record<string, { data?: ConversationQueueItemDetail; loading?: boolean; error?: string }>>;
}
type QueueDetailState = QueueState["details"][string];
const blockReasons = [null, "queue-paused", "previous-turn-active", "previous-turn-failed", "previous-turn-cancelled", "previous-turn-uncertain", "native-session-unavailable", "native-session-busy", "execution-profile-unavailable"];
function assertPage(page: ConversationQueuePage, id: string, after: number) {
  if (!page || page.conversationId !== id || !validRevision(page.queueRevision) || typeof page.paused !== "boolean" || !blockReasons.includes(page.blocked) || !Array.isArray(page.items) || page.items.length > 20 || (page.nextCursor !== null && (!validRevision(page.nextCursor) || page.nextCursor <= after))) throw Error("Invalid queue page. Refresh before acting.");
  assertCurrentTurn(page.currentTurn);
  let sequence = after; const ids = new Set<string>();
  for (const item of page.items) { assertQueueItem(item, id); if (item.state !== "waiting" || item.sequence <= sequence || ids.has(item.id)) throw Error("Queue page order or identity is invalid."); sequence = item.sequence; ids.add(item.id); }
  if (page.nextCursor !== null && page.nextCursor !== page.items.at(-1)?.sequence) throw Error("Queue cursor does not match its page.");
}

/** Read-model lifetime is independent from commands; a receipt never becomes current queue facts. */
export class ConversationQueueProjection {
  readonly commands: QueueCommands | null;
  private state: QueueState = { available: false, page: null, loading: false, stale: false, online: true, error: null, receipts: [], details: {} };
  private id: string | null = null;
  private knowledgeProject: string | null = null;
  private knowledgeSupported = false;
  private visible = false;
  private windowSize = 20;
  private generation = 0;
  private readonly lifetime = new AbortController();
  private observation = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flight: Promise<boolean> | undefined;
  private readonly detailFlights = new Map<string, Promise<void>>();
  private reads = new AbortController();
  private readonly bodies = new ReadCache<QueueDetailState>(value => value.data?.item.text, { entries: 4, bytes: 64 * 1024 });
  private readonly listeners = new Set<() => void>();
  constructor(private readonly port: QueuePort | null, private readonly pollMs = 2000, private readonly timeoutMs = 15_000) {
    this.commands = port ? new QueueCommands(port, async () => {
      if (this.visible) await this.refresh(true);
      else this.update({ stale: Boolean(this.state.page) });
    }, timeoutMs) : null;
    this.commands?.subscribe(() => this.update({ receipts: this.commands!.getSnapshot() }));
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<QueueState>) { if (!this.lifetime.signal.aborted) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  configure(id: string | null, supported: boolean) {
    if (this.id && id !== this.id) throw Error("A queue projection cannot change conversation identity.");
    const available = Boolean(this.port && id && supported); const changed = this.id !== id || available !== this.state.available;
    this.id = id; if (!changed) return;
    this.invalidate(); this.update({ available });
    if (available && this.visible && this.state.online) void this.refresh();
  }
  configureKnowledge(projectId: string | null, supported: boolean) { this.knowledgeProject = projectId; this.knowledgeSupported = supported; }
  setVisible(visible: boolean) { if (visible === this.visible) return; this.visible = visible; if (!visible) this.invalidateReads(false); this.invalidate(); if (visible) void this.refresh(); }
  setOnline(online: boolean) { if (online === this.state.online) return; if (!online) this.invalidateReads(false); this.invalidate(); this.update({ online, stale: Boolean(this.state.page) }); if (online && this.visible) void this.refresh(); }
  private invalidate() { this.generation++; this.observation.abort(); this.observation = new AbortController(); clearTimeout(this.timer); this.flight = undefined; this.update({ loading: false }); }
  private schedule() { clearTimeout(this.timer); if (this.visible && this.state.available && this.state.online && !this.lifetime.signal.aborted) this.timer = setTimeout(() => { void this.refresh(); }, this.pollMs); }
  refresh(force = false): Promise<boolean> {
    if (!this.port || !this.id || !this.state.available || !this.state.online || this.lifetime.signal.aborted) return Promise.resolve(false);
    if (force) this.invalidate();
    if (this.flight) return this.flight;
    const id = this.id, generation = this.generation;
    const signal = AbortSignal.any([this.lifetime.signal, this.observation.signal, AbortSignal.timeout(this.timeoutMs)]);
    this.update({ loading: true });
    const flight = (async () => {
      try {
        let after = 0; let combined: ConversationQueuePage | null = null;
        for (let pages = 0; pages < 5; pages++) {
          const page = await this.port!.conversationQueue(id, { after, limit: 20 }, signal);
          if (this.lifetime.signal.aborted || generation !== this.generation) return false;
          if (signal.aborted) throw signal.reason;
          assertPage(page, id, after);
          if (this.state.page && page.queueRevision < this.state.page.queueRevision) throw Error("The queue read is older than the last confirmed snapshot.");
          if (combined && combined.queueRevision !== page.queueRevision) throw Error("Queue changed while reading pages. Refresh to load a consistent list.");
          const items: ConversationQueuePage["items"] = [...(combined?.items ?? []), ...page.items];
          if (new Set(items.map(item => item.id)).size !== items.length) throw Error("Queue pages contain duplicate identities.");
          combined = { ...page, items };
          if (page.nextCursor === null || items.length >= this.windowSize) break;
          after = page.nextCursor;
        }
        this.update({ page: combined, error: null, stale: false }); return true;
      } catch (error) {
        if (generation === this.generation && !this.lifetime.signal.aborted) this.update({ error: queueError(error), stale: true });
        return false;
      } finally {
        if (generation === this.generation && !this.lifetime.signal.aborted) { this.flight = undefined; this.update({ loading: false }); this.schedule(); }
      }
    })(); this.flight = flight; return flight;
  }
  async loadMore() { if (!this.state.page?.nextCursor || this.state.loading) return; this.windowSize = Math.min(100, this.windowSize + 20); await this.refresh(true); }
  actionDisabledReason(slot?: string) {
    if (!this.state.available) return "Queue controls are unavailable on this connection.";
    if (!this.state.online) return "Reconnect before changing the queue. Your draft stays editable.";
    if (!this.state.page || this.state.stale) return "Refresh the queue before sending a new command.";
    if (slot && this.commands?.unresolved(slot)) return "Check or retry this command's unresolved receipt first.";
    return null;
  }
  private ready(slot: string) { const reason = this.actionDisabledReason(slot); if (reason) throw Error(reason); return this.state.page!; }
  async enqueue(text: string, knowledge?: readonly FrozenCitation[]) { const page = this.ready("enqueue"); if (knowledge?.length) { if (!this.knowledgeProject || !this.knowledgeSupported) throw Error("Knowledge requires a supported fixed conversation project."); freezeContextSelection(knowledge, this.knowledgeProject); } await this.commands!.execute({ kind: "enqueue", conversationId: this.id!, input: { expectedQueueRevision: page.queueRevision, text, ...(knowledge === undefined ? {} : { knowledge }) } }); }
  async pause() { const page = this.ready("control"); await this.commands!.execute({ kind: "pause", conversationId: this.id!, input: { expectedQueueRevision: page.queueRevision } }); }
  async resume() {
    this.ready("control"); if (!(await this.refresh(true))) return;
    const page = this.ready("control"); await this.commands!.execute({ kind: "resume", conversationId: this.id!, input: { expectedQueueRevision: page.queueRevision, expectedTaskId: page.currentTurn?.taskId ?? null } });
  }
  async cancelItem(itemId: string) { const page = this.ready(`item:${itemId}`); await this.commands!.execute({ kind: "cancel-item", conversationId: this.id!, itemId, input: { expectedQueueRevision: page.queueRevision } }); }
  async cancelCurrentTask(expectedTaskId: string) {
    this.ready(`task:${expectedTaskId}`); if (!(await this.refresh(true))) return;
    const page = this.ready(`task:${expectedTaskId}`);
    if (!page.paused || page.currentTurn?.taskId !== expectedTaskId || TERMINAL_STATUSES.includes(page.currentTurn.taskStatus)) throw Error("The paused queue's current execution changed. Review the latest task before cancelling.");
    await this.commands!.execute({ kind: "cancel-task", conversationId: this.id!, taskId: expectedTaskId });
  }
  async retry(key: string) { if (!this.state.online) return; await this.commands?.retry(key); }
  private invalidateReads(clear: boolean) {
    this.reads.abort(); this.reads = new AbortController(); this.detailFlights.clear();
    this.update({ details: clear ? this.bodies.clear() : this.bodies.retain(value => !!value.data) });
  }
  clearReadCache() { this.invalidateReads(true); }
  loadDetail(itemId: string): Promise<void> {
    if (!this.port || !this.id || !this.state.available || !this.state.online || !this.visible || this.lifetime.signal.aborted) return Promise.resolve();
    if (this.state.details[itemId]?.data) { this.update({ details: this.bodies.touch(itemId) }); return Promise.resolve(); }
    const existing = this.detailFlights.get(itemId); if (existing) return existing;
    const publish = (value: QueueDetailState) => this.update({ details: this.bodies.put(itemId, value) });
    if (this.detailFlights.size) { publish({ error: "Another message is loading. Retry after it finishes." }); return Promise.resolve(); }
    const reads = this.reads, current = () => reads === this.reads && !reads.signal.aborted && !this.lifetime.signal.aborted;
    const id = this.id, signal = AbortSignal.any([this.lifetime.signal, reads.signal, AbortSignal.timeout(this.timeoutMs)]);
    publish({ loading: true });
    const flight = Promise.resolve().then(() => {
      if (!current()) throw Error("Message read ended.");
      return this.port!.conversationQueueItem(id, itemId, signal);
    }).then(data => {
      if (!current()) return;
      if (signal.aborted) throw signal.reason;
      bodyBytes(data?.item?.text, 16_000);
      if (data.conversationId !== id) throw Error("Queue detail identity is invalid.");
      assertQueueItem(data.item, id, itemId);
      if (!data.item.text.startsWith(data.item.preview)) throw Error("Queue text does not match its preview.");
      publish({ data });
    }).catch(error => { if (current()) publish({ error: queueError(error) }); })
      .finally(() => { if (this.detailFlights.get(itemId) === flight) this.detailFlights.delete(itemId); });
    this.detailFlights.set(itemId, flight); return flight;
  }

  dispose() { this.clearReadCache(); this.reads.abort(); this.invalidate(); this.state = { ...this.state, page: null, details: {} }; this.commands?.dispose(); this.lifetime.abort(); this.listeners.clear(); this.detailFlights.clear(); }
}
