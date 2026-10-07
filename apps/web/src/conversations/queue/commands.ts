import { RecoveryError, recoveryValue, type CommandRecovery, type CommandRecord } from "../../recovery/journal";
import { FlowApiError, type FlowClient } from "@flow/client";
import { conversationContextResponseSchema, conversationQueueEnqueueSchema, conversationQueuePauseSchema, conversationQueueResumeSchema, conversationQueueCancelSchema,
  assertClaudeTurnSettingsMatch, type ClaudeTurnSettings, type AttachmentReference, type ConversationQueueItem, type ConversationQueueCurrentTurn, type ConversationQueueEnqueue } from "@flow/contracts";

import { assertContextReceiptMatches, freezeMaterialRequest } from "../../conversation-context/receipts";
import type { FrozenCitation } from "../../conversation-context/selection";

export type QueuePort = Pick<FlowClient, "enqueueConversationTurn" | "conversationQueue" | "conversationQueueItem" | "cancelConversationQueueItem" | "pauseConversationQueue" | "resumeConversationQueue" | "cancel">;
export function queuePort(client: object): QueuePort | null {
  return ["enqueueConversationTurn", "conversationQueue", "conversationQueueItem", "cancelConversationQueueItem", "pauseConversationQueue", "resumeConversationQueue", "cancel"]
    .every(key => typeof (client as Record<string, unknown>)[key] === "function") ? client as QueuePort : null;
}
export type QueueCommand =
  | { kind: "enqueue"; conversationId: string; input: { expectedQueueRevision: number; text: string; messageSettings?: Readonly<ClaudeTurnSettings>; knowledge?: readonly FrozenCitation[]; attachments?: readonly Readonly<AttachmentReference>[] } }
  | { kind: "pause"; conversationId: string; input: { expectedQueueRevision: number } }
  | { kind: "resume"; conversationId: string; input: { expectedQueueRevision: number; expectedTaskId: string | null } }
  | { kind: "cancel-item"; conversationId: string; itemId: string; input: { expectedQueueRevision: number } }
  | { kind: "cancel-task"; conversationId: string; taskId: string };
type FrozenQueueCommand = Exclude<QueueCommand, { kind: "enqueue" }> | {
  kind: "enqueue"; conversationId: string;
  input: ConversationQueueEnqueue;
};
export interface QueueReceipt {
  readonly slot: string;
  readonly key: string;
  readonly command: FrozenQueueCommand;
  readonly state: "sending" | "unknown" | "rejected" | "accepted";
  readonly everUnknown: boolean;
  readonly message: string;
  readonly recoveryVersion?: number;
}
const taskStatuses = ["queued", "running", "waiting", "cancel_requested", "succeeded", "failed", "cancelled", "uncertain"];
export const validRevision = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_647;
export function assertCurrentTurn(value: ConversationQueueCurrentTurn | null) {
  if (value !== null && (!value || typeof value.taskId !== "string" || !value.taskId || typeof value.turnId !== "string" || !value.turnId || !validRevision(value.turnNumber) || value.turnNumber < 1 || !taskStatuses.includes(value.taskStatus) || (value.queueItemId !== null && typeof value.queueItemId !== "string"))) throw Error("Invalid current queue task. Refresh before acting.");
}
export function assertQueueItem(item: ConversationQueueItem, conversationId: string, itemId?: string) {
  if (!item || typeof item.id !== "string" || !item.id || (itemId && item.id !== itemId) || item.conversationId !== conversationId || !validRevision(item.sequence) || item.sequence < 1 || !["waiting", "cancelled", "promoted"].includes(item.state) || typeof item.preview !== "string" || typeof item.truncated !== "boolean" || !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt))) throw Error("Invalid queue item identity. Its receipt is not confirmed.");
  if (item.state === "promoted" ? !item.promoted || typeof item.promoted.taskId !== "string" || typeof item.promoted.turnId !== "string" || !validRevision(item.promoted.turnNumber) || item.promoted.turnNumber < 1 : item.promoted !== null) throw Error("Invalid promoted queue item identity.");
}
export const queueError = (error: unknown) => error instanceof Error ? error.message : "Queue request failed. Refresh or check its receipt.";
function slot(command: QueueCommand) {
  return command.kind === "cancel-item" ? `item:${command.itemId}` : command.kind === "cancel-task" ? `task:${command.taskId}` : command.kind === "enqueue" ? "enqueue" : "control";
}
function freezeCommand(command: QueueCommand): FrozenQueueCommand {
  if (command.kind === "cancel-task") return Object.freeze({ ...command });
  if (command.kind === "enqueue") return Object.freeze({ ...command, input: freezeMaterialRequest(conversationQueueEnqueueSchema.parse(command.input)) });
  const schema = command.kind === "resume" ? conversationQueueResumeSchema : command.kind === "pause" ? conversationQueuePauseSchema : conversationQueueCancelSchema;
  return Object.freeze({ ...command, input: Object.freeze(schema.parse(command.input)) }) as FrozenQueueCommand;
}
function receiptMessage(command: QueueCommand, value: unknown): string {
  const result = value as Record<string, unknown>;
  if (command.kind === "cancel-task") {
    if (!result || result.id !== command.taskId || !taskStatuses.includes(String(result.status))) throw Error("Task cancellation receipt does not match the requested task.");
    return `Cancellation request accepted for ${command.taskId}. Execution status: ${String(result.status)}.`;
  }
  if (!result || result.conversationId !== command.conversationId || !validRevision(result.queueRevision) || typeof result.replayed !== "boolean") throw Error("Queue receipt identity is not confirmed. Retry the same request.");
  if (command.kind === "enqueue" || command.kind === "cancel-item") {
    const item = result.item as ConversationQueueItem;
    assertQueueItem(item, command.conversationId, command.kind === "cancel-item" ? command.itemId : undefined);
    if (command.kind === "enqueue") {
      if (item.state !== "waiting" || item.sequence !== result.queueRevision || result.queueRevision !== command.input.expectedQueueRevision + 1 || !command.input.text.startsWith(item.preview) || (!item.truncated && item.preview !== command.input.text)) throw Error("Queued message receipt does not match the frozen text.");
      if (command.input.messageSettings !== undefined) assertClaudeTurnSettingsMatch(command.input.messageSettings, item.messageSettings);
      else if (item.messageSettings !== undefined) throw Error("Queue receipt added settings that were not requested.");
      assertContextReceiptMatches(command.input.knowledge, item.context, command.input.attachments?.length
        ? { projectId: command.input.attachments[0]!.projectId, attachments: command.input.attachments } : undefined);
      return "Message accepted into the center queue. Current progress comes from the refreshed list.";
    }
    const outcome = result.outcome;
    if (!((outcome === "cancelled" || outcome === "already-cancelled") && item.state === "cancelled") && !(outcome === "already-promoted" && item.state === "promoted")) throw Error("Queue cancellation outcome is not confirmed.");
    return outcome === "already-promoted" ? "This item was already promoted. Its execution was not cancelled." : "Waiting item cancellation confirmed.";
  }
  assertCurrentTurn(result.currentTurn as ConversationQueueCurrentTurn | null);
  if (command.kind === "pause") {
    if (result.paused !== true || result.queueRevision < command.input.expectedQueueRevision || result.queueRevision > command.input.expectedQueueRevision + 1) throw Error("Pause receipt is not confirmed.");
    return "Pause accepted. Read current queue state before cancelling any execution.";
  }
  if (result.paused !== false || result.queueRevision !== command.input.expectedQueueRevision + 1) throw Error("Continue receipt is not confirmed.");
  if (result.promoted !== null) { assertQueueItem(result.promoted as ConversationQueueItem, command.conversationId); if ((result.promoted as ConversationQueueItem).state !== "promoted") throw Error("Continue promotion is not confirmed."); }
  return "Continue accepted. Current execution comes from the refreshed queue.";
}
function receiptCheckpoint(command: QueueCommand, value: Record<string, unknown>) {
  if (command.kind === "cancel-task") return recoveryValue({ taskId: command.taskId, status: value.status });
  const current = value.currentTurn as ConversationQueueCurrentTurn | null | undefined;
  const item = value.item as ConversationQueueItem | undefined, promoted = value.promoted as ConversationQueueItem | null | undefined;
  const promotion = (entry: ConversationQueueItem) => entry.promoted && ({ taskId: entry.promoted.taskId, turnId: entry.promoted.turnId, turnNumber: entry.promoted.turnNumber });
  return recoveryValue({ conversationId: command.conversationId, queueRevision: value.queueRevision, outcome: value.outcome, paused: value.paused,
    currentTurn: current ? { taskId: current.taskId, turnId: current.turnId, turnNumber: current.turnNumber, taskStatus: current.taskStatus, queueItemId: current.queueItemId } : current,
    promoted: promoted ? { id: promoted.id, promoted: promotion(promoted) } : promoted,
    item: item ? { id: item.id, sequence: item.sequence, state: item.state, promoted: promotion(item), context: item.context === undefined ? undefined : conversationContextResponseSchema.parse(item.context) } : undefined });
}
function awaitSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener("abort", aborted);
    if (signal.aborted) { operation.catch(() => undefined); aborted(); return; }
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

/** Immutable local receipts. Observation stops never cancel or rewrite sent commands. */
export class QueueCommands {
  private state: readonly QueueReceipt[] = [];
  private recovery?: CommandRecovery;
  configureRecovery(recovery: CommandRecovery) { this.recovery = recovery; }
  restore(record: CommandRecord) {
    if (record.domain !== "queue" || !record.frozen || typeof record.frozen !== "object" || Array.isArray(record.frozen)) throw Error("Invalid saved queue receipt.");
    const value = record.frozen as Record<string, unknown>;
    if (value.key !== record.id || typeof value.key !== "string" || !value.command || typeof value.command !== "object") throw Error("Invalid original queue identity.");
    const raw = value.command as Record<string, unknown>;
    if (typeof raw.conversationId !== "string" || !raw.conversationId || raw.conversationId.length > 128 || !["enqueue", "pause", "resume", "cancel-item", "cancel-task"].includes(String(raw.kind))) throw Error("Invalid saved queue target.");
    if (raw.kind === "cancel-item" && (typeof raw.itemId !== "string" || !raw.itemId || raw.itemId.length > 128)) throw Error("Invalid saved queue item.");
    if (raw.kind === "cancel-task" && (typeof raw.taskId !== "string" || !raw.taskId || raw.taskId.length > 128)) throw Error("Invalid saved cancellation target.");
    const command = freezeCommand(raw as unknown as QueueCommand), key = slot(command);
    const previous = this.state.find(receipt => receipt.slot === key);
    if (previous && (previous.key !== record.id || previous.state === "sending" || JSON.stringify(previous.command) !== JSON.stringify(command))) throw Error("Resolve this queue slot before restoring another receipt.");
    if (record.phase === "accepted") {
      const ack = record.checkpoint;
      if (!ack || typeof ack !== "object" || Array.isArray(ack) || (command.kind === "cancel-task" ? !("taskId" in ack) || ack.taskId !== command.taskId || !("status" in ack) || !taskStatuses.includes(String(ack.status)) : !("conversationId" in ack) || ack.conversationId !== command.conversationId || !("queueRevision" in ack) || !validRevision(ack.queueRevision))) throw Error("Invalid saved queue acknowledgement identity.");
    }
    this.publish({ slot: key, key: value.key, command, recoveryVersion: record.version, state: record.phase === "accepted" ? "accepted" : record.phase === "rejected" ? "rejected" : "unknown", everUnknown: record.phase === "unknown" || record.phase === "dispatching", message: record.phase === "accepted" ? "Previously accepted by the center; this checkpoint is historical, not current queue state." : record.phase === "rejected" ? "Previously rejected request; no retry was issued." : record.phase === "prepared" ? "Saved before sending. Retry this original request explicitly." : "Original queue receipt restored; no command was resent." });
  }
  private readonly lifetime = new AbortController();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly port: QueuePort, private readonly settled: () => Promise<void>, private readonly timeoutMs = 15_000) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  unresolved = (key: string) => this.state.some(entry => entry.slot === key && ["sending", "unknown"].includes(entry.state));
  async execute(input: QueueCommand) {
    if (this.lifetime.signal.aborted) throw Error("This queue connection is closed.");
    const key = slot(input); if (this.unresolved(key)) throw Error("Check or retry the unresolved command first.");
    const entry: QueueReceipt = Object.freeze({ slot: key, key: crypto.randomUUID(), command: freezeCommand(input), state: "sending", everUnknown: false, message: "Waiting for durable acceptance." });
    this.publish(entry); await this.dispatch(entry);
  }
  async retry(key: string) {
    const previous = this.state.find(entry => entry.key === key && entry.state === "unknown"); if (!previous || this.lifetime.signal.aborted) return;
    const entry = { ...previous, state: "sending" as const }; this.publish(entry); await this.dispatch(entry, true);
  }
  dismiss(key: string) { this.state = this.state.filter(entry => entry.key !== key || ["unknown", "sending"].includes(entry.state)); this.emit(); }
  dispose() { this.lifetime.abort(); this.state = []; this.listeners.clear(); }
  private publish(entry: QueueReceipt) { if (!this.lifetime.signal.aborted) { this.state = [...this.state.filter(previous => previous.slot !== entry.slot), Object.freeze(entry)]; this.emit(); } }
  private emit() { this.listeners.forEach(listener => listener()); }
  private async dispatch(entry: QueueReceipt, explicitRetry = false) {
    const { command, key } = entry;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(this.timeoutMs)]);
    const recovery = this.recovery;
    let sent = false;
    try {
      await recovery?.prepare({ id: key, domain: "queue", slot: `queue:${command.conversationId}:${entry.slot}`, frozen: recoveryValue({ key, command }), expectedVersion: entry.recoveryVersion, explicitRetry });
      await recovery?.dispatch(key); signal.throwIfAborted(); sent = true;
      let operation: Promise<unknown>;
      switch (command.kind) {
        case "enqueue": operation = this.port.enqueueConversationTurn(command.conversationId, command.input, key, signal); break;
        case "pause": operation = this.port.pauseConversationQueue(command.conversationId, command.input, key, signal); break;
        case "resume": operation = this.port.resumeConversationQueue(command.conversationId, command.input, key, signal); break;
        case "cancel-item": operation = this.port.cancelConversationQueueItem(command.conversationId, command.itemId, command.input, key, signal); break;
        case "cancel-task": operation = this.port.cancel(command.taskId, key); break;
      }
      const result = await awaitSignal(operation, signal); if (this.lifetime.signal.aborted) return;
      const message = receiptMessage(command, result);
      await recovery?.checkpoint(key, { phase: "accepted", data: receiptCheckpoint(command, result as Record<string, unknown>) });
      signal.throwIfAborted();
      this.publish({ ...entry, state: "accepted", message });
    } catch (error) {
      if (this.lifetime.signal.aborted) return;
      const rejected = error instanceof FlowApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && !error.code.includes("idempotency");
      const unknown = entry.everUnknown || !rejected;
      this.publish({ ...entry, state: unknown ? "unknown" : "rejected", everUnknown: entry.everUnknown || (sent && unknown), message: !sent && error instanceof RecoveryError ? `Not sent: local recovery is blocked. Retry this original key after resolving storage. ${queueError(error)}` : queueError(error) });
      if (!(error instanceof RecoveryError)) { try { await recovery?.checkpoint(key, { phase: unknown ? "unknown" : "rejected" }); } catch { /* Original dispatching checkpoint remains recoverable. */ } }
    }
    if (!this.lifetime.signal.aborted) await this.settled();
  }
}
