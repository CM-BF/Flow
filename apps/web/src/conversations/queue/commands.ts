import { FlowApiError, type FlowClient } from "@flow/client";
import { conversationQueueEnqueueSchema, conversationQueuePauseSchema, conversationQueueResumeSchema, conversationQueueCancelSchema,
  type ConversationQueueItem, type ConversationQueueCurrentTurn, type ConversationQueueEnqueue } from "@flow/contracts";

import { assertContextReceiptMatches, freezeKnowledgeRequest } from "../../conversation-context/receipts";
import type { FrozenCitation } from "../../conversation-context/selection";

export type QueuePort = Pick<FlowClient, "enqueueConversationTurn" | "conversationQueue" | "conversationQueueItem" | "cancelConversationQueueItem" | "pauseConversationQueue" | "resumeConversationQueue" | "cancel">;
export function queuePort(client: object): QueuePort | null {
  return ["enqueueConversationTurn", "conversationQueue", "conversationQueueItem", "cancelConversationQueueItem", "pauseConversationQueue", "resumeConversationQueue", "cancel"]
    .every(key => typeof (client as Record<string, unknown>)[key] === "function") ? client as QueuePort : null;
}
export type QueueCommand =
  | { kind: "enqueue"; conversationId: string; input: { expectedQueueRevision: number; text: string; knowledge?: readonly FrozenCitation[] } }
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
  if (command.kind === "enqueue") return Object.freeze({ ...command, input: freezeKnowledgeRequest(conversationQueueEnqueueSchema.parse(command.input)) });
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
      assertContextReceiptMatches(command.input.knowledge, item.context);
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
function awaitSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener("abort", aborted);
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

/** Immutable local receipts. Observation stops never cancel or rewrite sent commands. */
export class QueueCommands {
  private state: readonly QueueReceipt[] = [];
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
    const entry = { ...previous, state: "sending" as const }; this.publish(entry); await this.dispatch(entry);
  }
  dismiss(key: string) { this.state = this.state.filter(entry => entry.key !== key || ["unknown", "sending"].includes(entry.state)); this.emit(); }
  dispose() { this.lifetime.abort(); this.state = []; this.listeners.clear(); }
  private publish(entry: QueueReceipt) { if (!this.lifetime.signal.aborted) { this.state = [...this.state.filter(previous => previous.slot !== entry.slot), Object.freeze(entry)]; this.emit(); } }
  private emit() { this.listeners.forEach(listener => listener()); }
  private async dispatch(entry: QueueReceipt) {
    const { command, key } = entry;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(this.timeoutMs)]);
    try {
      let operation: Promise<unknown>;
      switch (command.kind) {
        case "enqueue": operation = this.port.enqueueConversationTurn(command.conversationId, command.input, key, signal); break;
        case "pause": operation = this.port.pauseConversationQueue(command.conversationId, command.input, key, signal); break;
        case "resume": operation = this.port.resumeConversationQueue(command.conversationId, command.input, key, signal); break;
        case "cancel-item": operation = this.port.cancelConversationQueueItem(command.conversationId, command.itemId, command.input, key, signal); break;
        case "cancel-task": operation = this.port.cancel(command.taskId, key); break;
      }
      const result = await awaitSignal(operation, signal); if (this.lifetime.signal.aborted) return;
      this.publish({ ...entry, state: "accepted", message: receiptMessage(command, result) });
    } catch (error) {
      if (this.lifetime.signal.aborted) return;
      const rejected = error instanceof FlowApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && !error.code.includes("idempotency");
      const unknown = entry.everUnknown || !rejected;
      this.publish({ ...entry, state: unknown ? "unknown" : "rejected", everUnknown: unknown, message: queueError(error) });
    }
    if (!this.lifetime.signal.aborted) await this.settled();
  }
}
