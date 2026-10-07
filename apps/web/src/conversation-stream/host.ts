import { ExportedMessageRepository, type ThreadMessageLike } from "@assistant-ui/react";
import { TERMINAL_STATUSES, type AssistantStreamPage, type AssistantStreamPatchPage, type ConversationTurn } from "@flow/contracts";
import type { ConversationProjection } from "../conversations/projection";
import { replyDetailKey } from "../conversations/projection";
import { userMessageId } from "../conversations/messages";
import { createConversationStreamProjection, type StreamState } from "./projection";
import { streamConversationMessages, streamMessageId } from "./messages";

export const STREAM_OWNER = "flow.assistant-stream";
export const STREAM_PANEL = "flow.assistant-stream.status";
export interface StreamIdentity { connectionId: string; viewId: string; conversationId: string; turnId: string; taskId: string; messageId: string }
export interface StreamReaders {
  metadata(identity: StreamIdentity, options: { after?: string; limit: number }, signal: AbortSignal): Promise<AssistantStreamPage>;
  patches(identity: StreamIdentity, options: { attemptId: string; after: number; limit: number }, signal: AbortSignal): Promise<AssistantStreamPatchPage>;
}
export interface StreamAuthority extends StreamReaders {
  id: string; signal: AbortSignal; allowed(identity: StreamIdentity): boolean;
  subscribe(listener: () => void): () => void;
}
interface Entry {
  identity: StreamIdentity; turn: ConversationTurn; module: ReturnType<typeof createConversationStreamProjection>;
  unsubscribe: () => void; inputTurn?: ConversationTurn; inputContent?: string; dirty: boolean; touched: number; active: boolean; failures: number;
}
export interface StreamMember { taskId: string; turnId: string; role: "user" | "assistant"; draft: boolean }
export interface StreamViewSnapshot {
  messages: readonly ThreadMessageLike[]; repository: ExportedMessageRepository; members: ReadonlyMap<string, StreamMember>;
  states: ReadonlyMap<string, StreamState>; evicted: boolean; enabled: boolean;
}
const terminal = (turn: ConversationTurn) => TERMINAL_STATUSES.includes(turn.task.status);
const bytes = (entry: Entry) => entry.module.getSnapshot().patches?.totalBytes ?? 0;
/** This is a display/read budget, not another plugin registry or polling loop. */
export class StreamConnectionBudget {
  private hosts = new Set<ConversationStreamHost>();
  private leases = new Set<ConversationStreamHost>();
  private waiting = new Set<ConversationStreamHost>();
  private clock = 0;
  touch() { return ++this.clock; }
  add(host: ConversationStreamHost) { this.hosts.add(host); }
  remove(host: ConversationStreamHost) { this.hosts.delete(host); this.withdraw(host); }
  acquire(host: ConversationStreamHost) {
    if (this.leases.has(host)) return true;
    if (!this.hosts.has(host) || !host.hasQueuedWork()) return false;
    this.waiting.add(host); this.grantWaiting(); return this.leases.has(host);
  }
  release(host: ConversationStreamHost) { if (this.leases.delete(host)) this.grantWaiting(); }
  withdraw(host: ConversationStreamHost) { this.waiting.delete(host); this.leases.delete(host); this.grantWaiting(); }
  private grantWaiting() {
    // Reserve the freed lease before waking: synchronous reacquire cannot pass an older waiter.
    for (const host of this.waiting) {
      if (!this.hosts.has(host) || !host.hasQueuedWork()) { this.waiting.delete(host); continue; }
      if (this.leases.size >= 2) break;
      this.waiting.delete(host); this.leases.add(host); host.requestPump();
    }
  }
  enforce() {
    const all = [...this.hosts].flatMap(host => host.cached().map(entry => ({ host, entry })));
    let size = all.reduce((sum, item) => sum + bytes(item.entry), 0), count = all.length;
    for (const { host, entry } of all.filter(item => !item.entry.active).sort((a, b) => a.entry.touched - b.entry.touched)) {
      if (count <= 8 && size <= 4 * 1024 * 1024) break;
      size -= bytes(entry); count--; host.evict(entry);
    }
  }
  ownsMessage(taskId: string, messageId: string, role: "user" | "assistant") {
    return [...this.hosts].some(host => { return host.ownsMessage(taskId, messageId, role); });
  }
}
/** One mounted pane. All history reads come from an explicit finite dirty set. */
export class ConversationStreamHost {
  private entries = new Map<string, Entry>();
  private state: StreamViewSnapshot = { messages: [], repository: { messages: [] }, members: new Map(), states: new Map(), evicted: false, enabled: false };
  private listeners = new Set<() => void>();
  private visible = false;
  private disposed = false;
  private evicted = false;
  private pumpQueued = false;
  private syncing = false;
  private unlisten: (() => void)[] = [];
  private mounted = 0;
  private online = false;
  private repositoryCache = new WeakMap<ThreadMessageLike, ExportedMessageRepository["messages"][number]["message"]>();
  private messageCache = new WeakMap<ConversationTurn, { stream: StreamState | undefined; visible: boolean; online: boolean; messages: readonly ThreadMessageLike[] }>();
  constructor(readonly viewId: string, private projection: ConversationProjection, private authority: StreamAuthority, private budget: StreamConnectionBudget) { this.publish(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  current() { return !this.disposed && !this.authority.signal.aborted; }
  cached() { return [...this.entries.values()]; }
  hasQueuedWork() { return this.current() && this.visible && [...this.entries.values()].some(entry => entry.dirty && entry.failures < 3 && this.readable(entry)); }
  ownsMessage(taskId: string, messageId: string, role: "user" | "assistant") { const member = this.state.members.get(messageId); return this.current() && member?.taskId === taskId && member.role === role && this.projection.getSnapshot().turns.some(turn => turn.id === member.turnId && turn.task.id === taskId); }
  attach() {
    this.mounted++;
    if (!this.unlisten.length && this.current()) {
      this.budget.add(this);
      const close = () => this.dispose(); this.authority.signal.addEventListener("abort", close, { once: true });
      this.unlisten = [this.projection.subscribe(() => this.sync()), this.authority.subscribe(() => this.sync()), () => this.authority.signal.removeEventListener("abort", close)];
      this.sync();
    }
    return () => { this.mounted--; this.setVisible(false); queueMicrotask(() => { if (!this.mounted) this.dispose(); }); };
  }
  setVisible(value: boolean) { if (this.visible === value) return; this.visible = value; if (value) for (const entry of this.entries.values()) if (!terminal(entry.turn) || !entry.module.getSnapshot().metadata?.settlement) entry.dirty = true; this.sync(); }
  private identity(turn: ConversationTurn): StreamIdentity { return Object.freeze({ connectionId: this.authority.id, viewId: this.viewId, conversationId: turn.conversationId, turnId: turn.id, taskId: turn.task.id, messageId: userMessageId(turn) }); }
  private readable(entry: Entry) {
    const state = this.projection.getSnapshot();
    return this.current() && this.visible && state.connection === "live" && state.snapshot?.capabilities.liveAssistantText === true
      && state.snapshot.conversation.id === entry.identity.conversationId && state.turns.some(turn => turn.id === entry.identity.turnId && turn.task.id === entry.identity.taskId)
      && this.authority.allowed(entry.identity);
  }
  private create(turn: ConversationTurn) {
    const identity = this.identity(turn);
    const module = createConversationStreamProjection(identity, {
      readMetadata: (options, signal) => this.read(entry, () => this.authority.metadata(identity, options, signal)),
      readPatches: (options, signal) => this.read(entry, () => this.authority.patches(identity, options, signal)),
    });
    const entry: Entry = { identity, turn, module, unsubscribe: () => {}, dirty: true, touched: this.budget.touch(), active: false, failures: 0 };
    entry.unsubscribe = module.subscribe(() => {
      if (this.syncing || !this.current()) return;
      this.enforce(); this.publish(); this.requestPump();
    });
    this.entries.set(turn.id, entry); return entry;
  }
  private async read<T>(entry: Entry, operation: () => Promise<T>): Promise<T> { if (!entry.active || !this.readable(entry)) throw Error("Stream reading is not authorized in this pane."); const result = await operation(); if (!entry.active || !this.readable(entry)) throw Error("Stream read belongs to an expired pane."); return result; }
  private fullContent(turn: ConversationTurn) { const key = replyDetailKey(turn.conversationId, turn); return key ? this.projection.getSnapshot().details[key]?.data?.content : undefined; }
  sync() {
    if (!this.current() || this.syncing) return;
    this.syncing = true;
    try {
      const state = this.projection.getSnapshot(), latest = state.snapshot?.lastTurn;
      const resumed = !this.online && state.connection === "live"; this.online = state.connection === "live";
      if (latest && (!terminal(latest) || latest.assistant.state === "pending") && state.snapshot?.capabilities.liveAssistantText === true
        && this.authority.allowed(this.identity(latest)) && !this.entries.has(latest.id)) this.create(latest);
      for (const entry of this.entries.values()) {
        const turn = state.turns.find(turn => turn.id === entry.identity.turnId && turn.task.id === entry.identity.taskId);
        if (!turn) { this.evict(entry); continue; }
        entry.turn = turn;
        const content = this.fullContent(turn);
        if (!entry.module.getSnapshot().enabled && this.readable(entry)) { entry.dirty = true; entry.failures = 0; }
        if (turn !== entry.inputTurn || content !== entry.inputContent || resumed) { entry.inputTurn = turn; entry.inputContent = content; entry.dirty = true; entry.touched = this.budget.touch(); }
        if (!this.readable(entry)) { this.deactivate(entry); if (!this.authority.allowed(entry.identity) || state.snapshot?.capabilities.liveAssistantText !== true) { entry.module.updateHost({ turn, capability: false, protocol: "patch-v1", visible: false, online: false }); } }
      }
      this.enforce(); this.publish();
    } finally { this.syncing = false; }
    this.requestPump();
  }
  private deactivate(entry: Entry) {
    if (!entry.active) return; entry.active = false;
    entry.module.updateHost({ turn: entry.turn, capability: true, protocol: "patch-v1", visible: false, online: this.projection.getSnapshot().connection === "live", finalContent: this.fullContent(entry.turn) });
    this.budget.release(this);
  }
  requestPump() { if (this.pumpQueued || !this.current()) return; this.pumpQueued = true; queueMicrotask(() => { this.pumpQueued = false; this.pump(); }); }
  private pump() {
    if (!this.current() || this.syncing) return;
    this.syncing = true;
    try {
      const active = [...this.entries.values()].find(entry => entry.active);
      if (active) {
        const state = active.module.getSnapshot();
        if (state.loading) return;
        active.failures = state.error ? active.failures + 1 : 0;
        // A projection flight already bounds its pages. Yield after each completed batch,
        // keeping continuation dirty so all visible hosts can progress through a backlog.
        active.dirty ||= state.hasMore && !state.error;
        this.deactivate(active);
      }
      const latestId = this.projection.getSnapshot().snapshot?.lastTurn?.id;
      const next = [...this.entries.values()].filter(entry => entry.dirty && entry.failures < 3 && this.readable(entry))
        .sort((a, b) => Number(b.identity.turnId === latestId) - Number(a.identity.turnId === latestId) || b.touched - a.touched)[0];
      if (next && this.budget.acquire(this)) {
        next.dirty = false; next.active = true;
        next.module.updateHost({ turn: next.turn, capability: true, protocol: "patch-v1", visible: true, online: true, finalContent: this.fullContent(next.turn) });
      } else if (!next) this.budget.withdraw(this);
      this.publish();
    } finally { this.syncing = false; }
  }
  retry(turnId: string) { const entry = this.entries.get(turnId); if (entry) { entry.failures = 0; entry.dirty = true; this.requestPump(); } }
  evict(entry: Entry) {
    this.deactivate(entry); entry.unsubscribe(); entry.module.dispose(); this.entries.delete(entry.identity.turnId);
    this.evicted = true; this.publish();
  }
  private enforce() {
    let count = this.entries.size, size = [...this.entries.values()].reduce((sum, entry) => sum + bytes(entry), 0);
    for (const entry of [...this.entries.values()].filter(entry => !entry.active).sort((a, b) => a.touched - b.touched)) {
      if (count <= 4 && size <= 2 * 1024 * 1024) break;
      size -= bytes(entry); count--; this.evict(entry);
    }
    this.budget.enforce();
  }
  private publish() {
    const source = this.projection.getSnapshot(), members = new Map<string, StreamMember>(), states = new Map<string, StreamState>();
    const messages = source.turns.flatMap(turn => {
      const stream = this.entries.get(turn.id)?.module.getSnapshot(); if (stream) states.set(turn.id, stream);
      const cached = this.messageCache.get(turn);
      let mapped = cached && cached.stream === stream && cached.visible === this.visible && cached.online === (source.connection === "live") ? cached.messages : undefined;
      if (!mapped) {
        const fallback: StreamState = { scope: this.identity(turn), enabled: false, visible: false, online: false, loading: false, stale: false, metadata: null, patches: null, final: null, hasMore: false, error: null, retryAt: null };
        mapped = streamConversationMessages(turn, stream ? { ...stream, visible: this.visible, online: source.connection === "live" } : fallback); this.messageCache.set(turn, { stream, visible: this.visible, online: source.connection === "live", messages: mapped });
      }
      for (const message of mapped) if (message.id && (message.role === "user" || message.role === "assistant")) members.set(message.id, { taskId: turn.task.id, turnId: turn.id, role: message.role, draft: Boolean(stream?.patches?.blocks.some(block => mapped && message.id === streamMessageId(turn.id, block))) });
      return [...mapped];
    });
    const enabled = source.snapshot?.capabilities.liveAssistantText === true && [...this.entries.values()].some(entry => this.authority.allowed(entry.identity));
    if (messages.length === this.state.messages.length && messages.every((message, index) => message === this.state.messages[index]) && enabled === this.state.enabled && this.evicted === this.state.evicted
      && states.size === this.state.states.size && [...states].every(([key, value]) => this.state.states.get(key) === value)) return;
    // The public repository adapter removes absent IDs; the plain messages adapter retains branches.
    const repository: ExportedMessageRepository = { messages: messages.map((message, index) => {
      let converted = this.repositoryCache.get(message);
      if (!converted) { converted = ExportedMessageRepository.fromArray([message]).messages[0]!.message; this.repositoryCache.set(message, converted); }
      return { message: converted, parentId: index ? messages[index - 1]!.id! : null };
    }) };
    this.state = { messages, repository, members, states, evicted: this.evicted, enabled }; this.listeners.forEach(listener => listener());
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.unlisten.splice(0).forEach(unlisten => unlisten()); for (const entry of this.entries.values()) { entry.unsubscribe(); entry.module.dispose(); } this.entries.clear(); this.budget.remove(this); this.listeners.clear(); }
}
