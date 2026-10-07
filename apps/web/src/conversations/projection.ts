import { decodeConversationCreated, decodeConversationTurnAccepted, FlowApiError, type FlowClient } from "@flow/client";
import {
  TERMINAL_STATUSES,
  conversationCreationSchema,
  conversationContextResponseSchema,
  type ConversationCreation,
  type ConversationSnapshot,
  type ConversationSummary,
  type ConversationTurn,
  type Detail,
  type AttachmentReference, type ClaudeTurnSettings,
} from "@flow/contracts";
import { freezeMaterialRequest } from "../conversation-context/receipts";
import { RecoveryError, recoveryValue, type CommandRecovery, type CommandRecord } from "../recovery/journal";
import { ReadCache, bodyBytes } from "./read-cache";
import { ConversationOutbox, frozenOutbox, type OutboxEntry } from "./outbox";
import { freezeContextSelection, type FrozenCitation } from "../conversation-context/selection";
import { assertCreationReceiptMatches } from "../execution-profiles/selection";
import { queuePort } from "./queue/commands";
import { ConversationQueueProjection } from "./queue/projection";

type ConversationPort = Pick<FlowClient, "createConversation" | "conversation" | "conversationTurns" | "submitConversationTurn" | "conversationDetail">;
type DetailState = { loading?: boolean; data?: Detail; error?: string };
export interface ConversationState {
  snapshot: ConversationSnapshot | null;
  turns: ConversationTurn[];
  nextCursor: number | null;
  loading: boolean;
  loadingMore: boolean;
  connection: "connecting" | "live" | "reconnecting" | "disconnected";
  error: string | null;
  outbox: OutboxEntry | null;
  details: Record<string, DetailState>;
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const requestSignal = (...signals: AbortSignal[]) => AbortSignal.any([...signals, AbortSignal.timeout(15_000)]);
export function replyDetailKey(conversationId: string, turn: ConversationTurn): string | null {
  if (turn.assistant.state !== "available") return null;
  const { contentRef, source } = turn.assistant;
  const identity = source.kind === "assistant-final"
    ? [source.kind, source.messageId, source.eventId, source.contentDigest]
    : [source.kind, source.artifactVersion];
  return JSON.stringify([conversationId, turn.id, turn.task.id, contentRef.attemptId, ...identity, contentRef.id]);
}

function assertSummary(value: ConversationSummary, expectedId?: string) {
  if (!value || typeof value.id !== "string" || !value.id || (expectedId && value.id !== expectedId)
    || !Number.isInteger(value.revision) || value.revision < 0 || !Number.isFinite(Date.parse(value.createdAt))
    || !Number.isFinite(Date.parse(value.updatedAt)) || !conversationCreationSchema.safeParse(creationFields(value)).success)
    throw Error("The center returned an invalid conversation identity. Its receipt is not confirmed.");
}
function creationFields(value: ConversationCreation): ConversationCreation {
  return { title: value.title, harness: value.harness, requested: value.requested,
    ...(value.projectId === undefined ? {} : { projectId: value.projectId }),
    ...(value.executionProfile === undefined ? {} : { executionProfile: value.executionProfile }) };
}
function assertTurn(value: ConversationTurn, conversationId: string) {
  if (!value || typeof value.id !== "string" || !value.id || value.conversationId !== conversationId
    || !Number.isInteger(value.number) || value.number < 1 || value.user?.role !== "user" || typeof value.user.text !== "string"
    || !value.task || typeof value.task.id !== "string" || !value.task.id
    || !["queued", "running", "waiting", "cancel_requested", "succeeded", "failed", "cancelled", "uncertain"].includes(value.task.status)
    || !["pending", "passed", "failed"].includes(value.task.verificationStatus)
    || value.telemetry?.taskId !== value.task.id || value.telemetry.kind !== "execution" || !value.effective
    || !value.assistant || !["pending", "unavailable", "available"].includes(value.assistant.state))
    throw Error("The center returned an invalid turn identity. Its receipt is not confirmed.");
  const reply = value.assistant;
  if (reply.state === "available" && (reply.role !== "assistant" || typeof reply.messageId !== "string" || typeof reply.text !== "string" || typeof reply.truncated !== "boolean"
    || !reply.contentRef?.id || reply.contentRef.taskId !== value.task.id || reply.source?.taskId !== value.task.id
    || reply.source.detailId !== reply.contentRef.id || reply.source.attemptId !== reply.contentRef.attemptId
    || (reply.source.kind === "assistant-final" ? !reply.source.contentDigest || reply.source.messageId !== reply.messageId : reply.source.kind !== "adapter-final-artifact" || !reply.source.artifactVersion)))
    throw Error("The assistant reply source does not match this turn.");
}
function readCapabilities(snapshot: Pick<ConversationSnapshot, "capabilities">) {
  const value = snapshot.capabilities;
  if (!value || value.followUp !== true || typeof value.queue !== "boolean"
    || (value.attachmentContext !== undefined && typeof value.attachmentContext !== "boolean")
    || (value.knowledgeContext !== undefined && typeof value.knowledgeContext !== "boolean")
    || (value.liveAssistantText !== undefined && typeof value.liveAssistantText !== "boolean")
    || [value.steer, value.perTurnModel, value.perTurnThinking, value.perTurnTools].some(value => value !== false))
    throw Error("This connection's conversation capabilities are not supported by this Web version.");
  return { ...value, liveAssistantText: value.liveAssistantText ?? false };
}

/** Conversation facts remain at the center; polling and receipt lifetimes are independent. */
export class ConversationProjection {
  readonly outbox = new ConversationOutbox();
  readonly queue: ConversationQueueProjection;
  private state: ConversationState;
  private readonly listeners = new Set<() => void>();
  private readonly lifetime = new AbortController();
  private observation = new AbortController();
  private visible = false;
  private online = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshFlight: Promise<void> | undefined;
  private readonly detailFlights = new Map<string, Promise<void>>();
  private reads = new AbortController();
  private readonly bodies = new ReadCache<DetailState>(value => value.data?.content, { entries: 2, bytes: 2 * 1024 * 1024 });
  private readonly turnVersions = new Map<string, number>();
  private readSequence = 0;
  private snapshotSequence = 0;
  private creation: ConversationCreation | null = null;
  private recovery?: CommandRecovery;
  configureRecovery(recovery: CommandRecovery) { this.recovery = recovery; this.queue.commands?.configureRecovery(recovery); }
  restoreReceipt(record: CommandRecord) {
    if (record.phase === "accepted") throw Error("An accepted receipt needs explicit terminal reconciliation.");
    this.outbox.restore(record); const entry = this.outbox.getSnapshot()!;
    if (this.id && entry.conversationId && this.id !== entry.conversationId) { this.outbox.accept(entry.id); throw Error("The receipt belongs to another conversation."); }
    if (entry.conversationId) this.id = entry.conversationId;
    this.creation = entry.creation;
  }
  async reconcileReceipt(record: CommandRecord) {
    const entry = this.outbox.matchSaved(record);
    if (record.phase !== "accepted" || !entry.conversationId || (this.id && this.id !== entry.conversationId)) throw Error("Invalid accepted conversation binding.");
    const value = record.checkpoint;
    if (!value || typeof value !== "object" || Array.isArray(value) || !("revision" in value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw Error("Invalid saved acknowledgement.");
    if (entry.kind === "turn" && (!("turnId" in value) || typeof value.turnId !== "string" || !value.turnId || value.turnId.length > 128 || !("taskId" in value) || typeof value.taskId !== "string" || !value.taskId || value.taskId.length > 128 || !("turnNumber" in value) || value.turnNumber !== entry.request.expectedRevision + 1)) throw Error("Invalid saved turn acknowledgement identity.");
    this.id = entry.conversationId; this.creation = entry.creation;
    await this.refresh();
    if (this.state.error || this.state.snapshot?.conversation.id !== entry.conversationId || (this.state.snapshot.conversation.projectId ?? null) !== (record.owner.projectId ?? null)) throw Error("The center did not confirm this receipt's conversation and project.");
    this.outbox.restore(record); // Matching terminal checkpoint only; no POST or next-draft mutation.
    return entry.conversationId;
  }

  constructor(private readonly client: ConversationPort, private id: string | null = null, private readonly pollMs = 2000) {
    this.queue = new ConversationQueueProjection(queuePort(client), pollMs);
    this.state = { snapshot: null, turns: [], nextCursor: null, loading: Boolean(id), loadingMore: false,
      connection: id ? "connecting" : "live", error: null, outbox: null, details: {} };
    this.outbox.subscribe(() => this.update({ outbox: this.outbox.getSnapshot() }));
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ConversationState>) {
    if (this.lifetime.signal.aborted) return;
    this.state = { ...this.state, ...patch };
    this.queue.configureAttachments(this.state.snapshot?.conversation.projectId ?? null, this.state.snapshot?.capabilities.attachmentContext === true);
    this.queue.configureKnowledge(this.state.snapshot?.conversation.projectId ?? null, this.state.snapshot?.capabilities.knowledgeContext === true);
    this.queue.configure(this.id, this.state.snapshot?.capabilities.queue === true);
    if (this.recovery) this.queue.commands?.configureRecovery(this.recovery);
    this.listeners.forEach(listener => listener());
  }
  private validateCreation(summary: ConversationSummary) {
    if (this.creation) assertCreationReceiptMatches(this.creation, summary);
  }

  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!visible) this.invalidateReads(false);
    this.queue.setVisible(visible);
    this.pauseObservation();
    if (visible && this.online) void this.refresh();
  }
  setOnline(online: boolean) {
    this.online = online;
    if (!online) this.invalidateReads(false);
    this.queue.setOnline(online);
    this.pauseObservation();
    if (!online) this.update({ connection: "disconnected" });
    else if (this.visible) void this.refresh();
  }
  private invalidateReads(clear: boolean) {
    this.reads.abort(); this.reads = new AbortController(); this.detailFlights.clear();
    this.update({ loadingMore: false, details: clear ? this.bodies.clear() : this.bodies.retain(value => !!value.data) });
  }
  /** Closing a retained view drops re-readable bodies, never its command receipts. */
  clearReadCache() { this.invalidateReads(true); this.queue.clearReadCache(); }
  private pauseObservation() {
    clearTimeout(this.timer);
    this.observation.abort(); this.observation = new AbortController();
    this.refreshFlight = undefined;
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.visible && this.online && this.id && !this.lifetime.signal.aborted)
      this.timer = setTimeout(() => { void this.refresh(); }, this.pollMs);
  }

  refresh(): Promise<void> {
    if (!this.id || !this.online || this.lifetime.signal.aborted) return Promise.resolve();
    if (this.refreshFlight) return this.refreshFlight;
    const id = this.id;
    const observation = this.observation.signal;
    const signal = requestSignal(this.lifetime.signal, observation);
    const sequence = ++this.readSequence;
    const initial = !this.state.snapshot;
    const pendingHistory = this.state.turns.find(turn => turn.assistant.state === "pending" && turn.id !== this.state.snapshot?.lastTurn?.id);
    const pageAfter = initial ? 0 : pendingHistory ? pendingHistory.number - 1 : null;
    const flight = (async () => {
      try {
        const [snapshot, page] = await Promise.all([
          this.client.conversation(id, signal),
          pageAfter !== null ? this.client.conversationTurns(id, { after: pageAfter, limit: 20 }, signal) : Promise.resolve(null),
        ]);
        if (signal.aborted || this.id !== id) return;
        assertSummary(snapshot.conversation, id); const capabilities = readCapabilities(snapshot);
        this.validateCreation(snapshot.conversation);
        if (snapshot.lastTurn) assertTurn(snapshot.lastTurn, id);
        if (page) { assertSummary(page.conversation, id); this.validateCreation(page.conversation); assertCreationReceiptMatches(creationFields(snapshot.conversation), page.conversation); page.turns.forEach(turn => assertTurn(turn, id)); }
        this.creation ??= conversationCreationSchema.parse(creationFields(snapshot.conversation));
        const turns = this.mergeTurns([...(page?.turns ?? []), ...(snapshot.lastTurn ? [snapshot.lastTurn] : [])], sequence);
        this.update({ snapshot: this.reconcileSnapshot({ ...snapshot, capabilities }, turns, sequence), turns, nextCursor: this.historyCursor(turns, page && initial ? page.nextCursor : this.state.nextCursor), loading: false, error: null, connection: "live" });
      } catch (error) {
        if (this.lifetime.signal.aborted || observation.aborted) return;
        this.update({ loading: false, error: errorMessage(error), connection: "reconnecting" });
      }
    })().finally(() => {
      if (this.refreshFlight === flight) { this.refreshFlight = undefined; this.schedule(); }
    });
    this.refreshFlight = flight;
    return flight;
  }

  async loadMore() {
    const after = this.state.nextCursor;
    if (!this.id || after === null || this.state.loadingMore || !this.visible || !this.online || this.lifetime.signal.aborted) return;
    const reads = this.reads;
    const current = () => reads === this.reads && !reads.signal.aborted && !this.lifetime.signal.aborted;
    const signal = requestSignal(this.lifetime.signal, reads.signal);
    const sequence = ++this.readSequence;
    this.update({ loadingMore: true });
    try {
      const page = await this.client.conversationTurns(this.id, { after, limit: 20 }, signal);
      if (!current()) return;
      if (signal.aborted) throw signal.reason;
      assertSummary(page.conversation, this.id); page.turns.forEach(turn => assertTurn(turn, this.id!));
      this.validateCreation(page.conversation);
      const turns = this.mergeTurns(page.turns, sequence);
      this.update({ turns, snapshot: this.state.snapshot ? this.reconcileSnapshot(this.state.snapshot, turns, this.snapshotSequence) : null, nextCursor: this.historyCursor(turns, page.nextCursor), error: null });
    } catch (error) {
      if (current()) this.update({ error: errorMessage(error) });
    } finally { if (current()) this.update({ loadingMore: false }); }
  }

  private mergeTurns(incoming: ConversationTurn[], sequence: number) {
    const turns = new Map(this.state.turns.map(turn => [turn.id, turn]));
    for (const turn of incoming) {
      if (sequence < (this.turnVersions.get(turn.id) ?? 0)) continue;
      this.turnVersions.set(turn.id, sequence);
      const previous = turns.get(turn.id);
      turns.set(turn.id, previous && JSON.stringify(previous) === JSON.stringify(turn) ? previous : turn);
    }
    return [...turns.values()].sort((a, b) => a.number - b.number);
  }

  private historyCursor(turns: ConversationTurn[], serverCursor: number | null) {
    let contiguous = 0;
    for (const turn of turns) { if (turn.number !== contiguous + 1) break; contiguous = turn.number; }
    return contiguous < (turns.at(-1)?.number ?? 0) ? contiguous : serverCursor;
  }

  private reconcileSnapshot(incoming: ConversationSnapshot, turns: ConversationTurn[], sequence: number): ConversationSnapshot {
    const current = this.state.snapshot;
    const useIncoming = !current || incoming.conversation.revision > current.conversation.revision
      || (incoming.conversation.revision === current.conversation.revision && sequence >= this.snapshotSequence);
    if (useIncoming) this.snapshotSequence = sequence;
    const snapshot = useIncoming ? incoming : current!;
    // Revision guards admissions; the merged turn guards asynchronous replies.
    return { ...snapshot, lastTurn: turns.at(-1) ?? snapshot.lastTurn };
  }

  sendDisabledReason(intent: "follow-up" | "queue" = "follow-up"): string | null {
    if (!this.online) return "Reconnect before sending. You can keep writing your next message.";
    if (this.state.loading || (this.id && !this.state.snapshot)) return "Wait for this conversation to load.";
    if (this.state.outbox && this.state.outbox.state !== "rejected") return "The previous message receipt is unresolved. Check or retry it first.";
    if (this.queue.commands?.unresolved("enqueue")) return "The queued message receipt is unresolved. Check or retry it first.";
    if (intent === "queue") return this.queue.actionDisabledReason("enqueue");
    const queue = this.queue.getSnapshot();
    if (queue.available && (!queue.page || queue.stale)) return "Wait for the current queue before sending a new turn.";
    if (queue.available && (queue.page?.paused || queue.page?.items.length)) return "The queue is paused or has waiting messages. Choose Queue next, or continue the queue.";
    const task = this.state.snapshot?.lastTurn?.task;
    if (task && !TERMINAL_STATUSES.includes(task.status)) return queue.available ? "This turn is active. Choose Queue next to save the next message at the center." : `This turn is ${task.status.replaceAll("_", " ")}. You can keep writing; queue and steering are not available in this Web version.`;
    return null;
  }

  async prepare(creation: ConversationCreation): Promise<string | undefined> {
    const reason = this.sendDisabledReason();
    if (reason) throw Error(reason);
    if (this.id) throw Error("This conversation already has a fixed project and execution configuration.");
    const id = await this.dispatch(this.outbox.beginCreation(creation));
    // CREATE advertises a conservative attachment capability. Negotiate the real GET before returning preparation.
    if (id) await this.refresh();
    return id;
  }

  validateKnowledge(knowledge?: readonly FrozenCitation[]) {
    if (!knowledge?.length) return;
    const snapshot = this.state.snapshot;
    if (!snapshot?.conversation.projectId || snapshot.capabilities.knowledgeContext !== true)
      throw Error("Prepare a supported project conversation before sending knowledge.");
    freezeContextSelection(knowledge, snapshot.conversation.projectId);
  }

  async send(text: string, creation?: ConversationCreation, knowledge?: readonly FrozenCitation[], attachments?: readonly AttachmentReference[], messageSettings?: Readonly<ClaudeTurnSettings>): Promise<string | undefined> {
    const reason = this.sendDisabledReason();
    if (reason) throw Error(reason);
    this.validateKnowledge(knowledge);
    if (attachments?.length && (!this.state.snapshot?.conversation.projectId || this.state.snapshot.capabilities.attachmentContext !== true)) throw Error("Prepare a supported project conversation before sending files.");
    freezeMaterialRequest({ knowledge, attachments }, this.state.snapshot?.conversation.projectId);
    const entry = this.outbox.begin({
      conversationId: this.id, expectedRevision: this.state.snapshot?.conversation.revision ?? 0, text,
      ...(messageSettings === undefined ? {} : { messageSettings }),
      ...(knowledge === undefined ? {} : { knowledge }),
      ...(attachments?.length ? { attachments } : {}),
      ...(!this.id ? { creation: creation ?? { title: text.trim().split("\n")[0]!.slice(0, 180), harness: "claude" as const,
        requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const } } } : {}),
    });
    return this.dispatch(entry);
  }
  async retry(): Promise<string | undefined> {
    const entry = this.state.outbox && this.online ? this.outbox.retry(this.state.outbox.id) : null;
    return entry ? this.dispatch(entry, true) : undefined;
  }

  private async dispatch(entry: OutboxEntry, explicitRetry = false): Promise<string | undefined> {
    const signal = requestSignal(this.lifetime.signal);
    const recovery = this.recovery;
    let sent = false;
    try {
      await recovery?.prepare({ id: entry.id, domain: "outbox", slot: entry.conversationId ? `turn:${entry.conversationId}` : `create:${entry.id}`, frozen: frozenOutbox(entry), stage: entry.conversationId ? "submit" : "create", expectedVersion: entry.recoveryVersion, explicitRetry });
      signal.throwIfAborted();
      let id = entry.conversationId;
      if (!id) {
        await recovery?.dispatch(entry.id, "create"); signal.throwIfAborted(); sent = true;
        const raw = await this.client.createConversation(entry.creation!, entry.creationKey, signal);
        if (this.lifetime.signal.aborted) return;
        const created = decodeConversationCreated(raw, entry.creation!);
        const capabilities = readCapabilities(created);
        this.creation = entry.creation!;
        id = created.conversation.id;
        await recovery?.checkpoint(entry.id, { phase: entry.kind === "creation" ? "accepted" : "prepared", stage: "submit", slot: `turn:${id}`, data: { conversationId: id, revision: created.conversation.revision } });
        signal.throwIfAborted();
        this.id = id; this.outbox.bindConversation(entry.id, id);
        this.update({ snapshot: { conversation: created.conversation, capabilities, nativeSession: null, lastTurn: null } });
      }
      if (entry.kind === "creation") {
        this.outbox.accept(entry.id);
        this.update({ loading: false, error: null }); this.schedule();
        return id;
      }
      await recovery?.dispatch(entry.id, "submit"); signal.throwIfAborted(); sent = true;
      const raw = await this.client.submitConversationTurn(id, entry.request, entry.turnKey, signal);
      if (this.lifetime.signal.aborted) return;
      const accepted = decodeConversationTurnAccepted(raw, id, entry.request);
      this.validateCreation(accepted.conversation);
      const current = this.state.snapshot!;
      const known = this.state.turns.find(turn => turn.number === accepted.turn.number);
      if (known && (known.id !== accepted.turn.id || known.task.id !== accepted.turn.task.id))
        throw Error("The saved receipt conflicts with this conversation's known turn identity.");
      await recovery?.checkpoint(entry.id, { phase: "accepted", data: recoveryValue({ conversationId: id, revision: accepted.conversation.revision, turnId: accepted.turn.id, turnNumber: accepted.turn.number, taskId: accepted.turn.task.id, context: accepted.turn.context === undefined ? undefined : conversationContextResponseSchema.parse(accepted.turn.context) }) });
      signal.throwIfAborted();
      // A receipt may be an old admission replay. It confirms delivery, never current execution state.
      const turns = known ? this.state.turns : this.mergeTurns([accepted.turn], 0);
      const snapshot = { ...current,
        conversation: accepted.conversation.revision > current.conversation.revision ? accepted.conversation : current.conversation,
        lastTurn: turns.at(-1) ?? current.lastTurn };
      this.update({ snapshot, turns, nextCursor: this.historyCursor(turns, this.state.nextCursor), loading: false, error: null });
      this.outbox.accept(entry.id);
      this.schedule();
      return id;
    } catch (error) {
      if (this.lifetime.signal.aborted) return;
      const rejected = error instanceof FlowApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && !error.code.includes("idempotency");
      this.outbox.fail(entry.id, !sent && error instanceof RecoveryError ? `Not sent: local recovery is blocked. Retry this original receipt after resolving storage. ${errorMessage(error)}` : errorMessage(error), rejected, !sent && error instanceof RecoveryError);
      if (!(error instanceof RecoveryError)) {
        try { await recovery?.checkpoint(entry.id, { phase: this.outbox.getSnapshot()?.everUnknown ? "unknown" : "rejected" }); }
        catch { /* Keep the original dispatching record: it must recover as unknown. */ }
      }
      if (error instanceof FlowApiError && error.status === 409) await this.refresh();
      return undefined;
    }
  }

  loadReply(turnId: string): Promise<void> {
    const turn = this.state.turns.find(item => item.id === turnId);
    if (!this.id || !turn || turn.assistant.state !== "available" || !this.visible || !this.online || this.lifetime.signal.aborted) return Promise.resolve();
    const key = replyDetailKey(this.id, turn)!;
    if (this.state.details[key]?.data) { this.update({ details: this.bodies.touch(key) }); return Promise.resolve(); }
    const existing = this.detailFlights.get(key); if (existing) return existing;
    const publish = (value: DetailState) => this.update({ details: this.bodies.put(key, value) });
    if (this.detailFlights.size) { publish({ error: "Another reply is loading. Retry after it finishes." }); return Promise.resolve(); }
    const id = this.id, reference = turn.assistant.contentRef, source = turn.assistant.source;
    const reads = this.reads, current = () => reads === this.reads && !reads.signal.aborted && !this.lifetime.signal.aborted;
    const signal = requestSignal(this.lifetime.signal, reads.signal);
    publish({ loading: true });
    const flight = Promise.resolve().then(() => {
      if (!current()) throw Error("Reply read ended.");
      return this.client.conversationDetail(id, turnId, reference.id, signal);
    }).then(async data => {
      if (!current()) return;
      if (signal.aborted) throw signal.reason;
      bodyBytes(data?.content, 1024 * 1024);
      const versionMatches = source.kind === "assistant-final"
        ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.content)))].map(byte => byte.toString(16).padStart(2, "0")).join("") === source.contentDigest
        : data.artifactVersion === source.artifactVersion;
      if (!current()) return;
      if (signal.aborted) throw signal.reason;
      if (data.id !== reference.id || data.kind !== reference.kind || !versionMatches)
        throw Error("The detail no longer matches this reply version. Refresh the conversation.");
      publish({ data });
    }).catch(error => { if (current()) publish({ error: errorMessage(error) }); })
      .finally(() => { if (this.detailFlights.get(key) === flight) this.detailFlights.delete(key); });
    this.detailFlights.set(key, flight); return flight;
  }

  dispose() {
    this.clearReadCache(); this.reads.abort(); this.queue.dispose();
    this.turnVersions.clear();
    this.state = { ...this.state, snapshot: null, turns: [], nextCursor: null, details: {} };
    this.lifetime.abort(); this.pauseObservation(); this.outbox.dispose(); this.detailFlights.clear(); this.listeners.clear();
  }
}

export class ConversationCatalog {
  private state: { items: ConversationSummary[]; nextCursor: string | null; loading: boolean; error: string | null } = { items: [], nextCursor: null, loading: false, error: null };
  private readonly listeners = new Set<() => void>();
  private readonly lifetime = new AbortController();
  private sequence = 0;
  constructor(private readonly client: Pick<FlowClient, "conversations">) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<typeof this.state>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  async refresh(more = false) {
    if (this.lifetime.signal.aborted || (more && !this.state.nextCursor)) return;
    const sequence = ++this.sequence;
    this.update({ loading: true });
    try {
      const result = await this.client.conversations({ limit: 50, ...(more ? { after: this.state.nextCursor! } : {}) }, requestSignal(this.lifetime.signal));
      if (this.lifetime.signal.aborted || sequence !== this.sequence) return;
      this.update({ items: [...new Map([...(more ? this.state.items : []), ...result.conversations].map(item => [item.id, item])).values()], nextCursor: result.nextCursor, error: null });
    } catch (error) { if (!this.lifetime.signal.aborted && sequence === this.sequence) this.update({ error: errorMessage(error) }); }
    finally { if (!this.lifetime.signal.aborted && sequence === this.sequence) this.update({ loading: false }); }
  }
  dispose() { this.lifetime.abort(); this.listeners.clear(); }
}
