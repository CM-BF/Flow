import {
  conversationCreationSchema,
  conversationTurnSchema,
  type ConversationCreation,
  type ConversationTurnAdmission, type AttachmentReference,
} from "@flow/contracts";
import { recoveryValue, type CommandRecord } from "../recovery/journal";
import { freezeMaterialRequest } from "../conversation-context/receipts";
import type { FrozenCitation } from "../conversation-context/selection";

export interface OutgoingConversationTurn {
  conversationId: string | null;
  expectedRevision: number;
  text: string;
  creation?: ConversationCreation;
  knowledge?: readonly FrozenCitation[];
  attachments?: readonly Readonly<AttachmentReference>[];
}
interface ReceiptBase {
  readonly id: string;
  readonly conversationId: string | null;
  readonly creationKey: string;
  readonly turnKey: string;
  readonly creation: Readonly<ConversationCreation> | null;
  readonly state: "sending" | "unknown" | "rejected";
  readonly error: string | null;
  readonly everUnknown: boolean;
  readonly locallyBlocked?: boolean;
  readonly recoveryVersion?: number;
}

export type TurnReceipt = ReceiptBase & { readonly kind: "turn"; readonly request: Readonly<ConversationTurnAdmission> };
export type CreationReceipt = ReceiptBase & { readonly kind: "creation"; readonly creation: Readonly<ConversationCreation>; readonly request: null };
export type OutboxEntry = TurnReceipt | CreationReceipt;

function freezeCreation(input: ConversationCreation) {
  const value = conversationCreationSchema.parse(input);
  return Object.freeze({ ...value, requested: Object.freeze({ ...value.requested }),
    ...(value.executionProfile ? { executionProfile: Object.freeze({ ...value.executionProfile }) } : {}) });
}

export function frozenOutbox(entry: OutboxEntry) {
  return recoveryValue({ kind: entry.kind, id: entry.id, conversationId: entry.creation ? null : entry.conversationId,
    creationKey: entry.creationKey, turnKey: entry.turnKey, creation: entry.creation, request: entry.request });
}
function storedObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid saved conversation receipt.");
  return value as Record<string, unknown>;
}
export function restoreOutbox(record: CommandRecord, terminalReconciliation = false): OutboxEntry {
  if (record.domain !== "outbox") throw Error("This is not a conversation receipt.");
  if (record.phase === "accepted" && !terminalReconciliation) throw Error("This receipt is already accepted. Open its bound conversation without resending.");
  const value = storedObject(record.frozen), checkpoint = record.checkpoint === null ? {} : storedObject(record.checkpoint);
  if (value.id !== record.id || typeof value.id !== "string" || typeof value.creationKey !== "string" || !value.creationKey || value.creationKey.length > 128
    || typeof value.turnKey !== "string" || !value.turnKey || value.turnKey.length > 128 || !["turn", "creation"].includes(String(value.kind))) throw Error("Invalid original receipt keys.");
  const creation = value.creation === null ? null : freezeCreation(conversationCreationSchema.parse(value.creation));
  const conversationId = checkpoint.conversationId ?? value.conversationId;
  if (conversationId !== null && (typeof conversationId !== "string" || !conversationId || conversationId.length > 128)) throw Error("Invalid restored conversation identity.");
  const base = { id: value.id, conversationId: conversationId as string | null, creationKey: value.creationKey, turnKey: value.turnKey, creation,
    recoveryVersion: record.version, state: record.phase === "rejected" ? "rejected" as const : "unknown" as const, error: record.phase === "prepared" ? "This original request was saved before sending. Retry explicitly to send it." : "Original receipt restored. Check or retry using the same keys.", everUnknown: record.phase === "dispatching" || record.phase === "unknown" };
  if (value.kind === "creation") { if (!creation || value.request !== null) throw Error("Invalid saved creation."); return Object.freeze({ ...base, kind: "creation", creation, request: null }); }
  return Object.freeze({ ...base, kind: "turn", request: freezeMaterialRequest(conversationTurnSchema.parse(value.request), creation?.projectId) });
}

/** A receipt owns its frozen input. It never owns or restores the next draft. */
export class ConversationOutbox {
  private entry: OutboxEntry | null = null;
  private closed = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly nextId: () => string = () => crypto.randomUUID()) {}
  getSnapshot = () => this.entry;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private assertReady() {
    if (this.closed) throw Error("This conversation connection is closed.");
    if (this.entry && this.entry.state !== "rejected")
      throw Error("The previous admission is unresolved. Check or retry its receipt first.");
  }

  beginCreation(input: ConversationCreation): CreationReceipt {
    this.assertReady();
    const creation = freezeCreation(input), id = this.nextId();
    const entry: CreationReceipt = { kind: "creation", id, conversationId: null, creationKey: `${id}:create`, turnKey: `${id}:turn`,
      creation, request: null, state: "sending", error: null, everUnknown: false };
    this.publish(entry);
    return entry;
  }

  begin(input: OutgoingConversationTurn): TurnReceipt {
    this.assertReady();
    const creation = input.creation ? freezeCreation(input.creation) : null;
    if (!input.conversationId && !creation) throw Error("New conversations require creation settings.");
    if (!input.conversationId && (input.knowledge?.length || input.attachments?.length) && !creation?.projectId)
      throw Error("Materials require a fixed conversation project.");
    const request = freezeMaterialRequest(conversationTurnSchema.parse({
      expectedRevision: input.expectedRevision, text: input.text, mode: "follow-up",
      ...(input.knowledge !== undefined ? { knowledge: input.knowledge } : {}),
      ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
    }), creation?.projectId);
    const id = this.nextId();
    const entry: TurnReceipt = {
      kind: "turn", id, conversationId: input.conversationId,
      creationKey: `${id}:create`, turnKey: `${id}:turn`,
      creation,
      request, state: "sending", error: null, everUnknown: false,
    };
    this.publish(entry);
    return entry;
  }

  restore(record: CommandRecord) {
    const restored = this.matchSaved(record);
    this.publish(record.phase === "accepted" ? null : restored);
  }
  matchSaved(record: CommandRecord) {
    if (this.closed) throw Error("This conversation connection is closed.");
    const restored = restoreOutbox(record, true);
    if (this.entry && (this.entry.state === "sending" || JSON.stringify(frozenOutbox(this.entry)) !== JSON.stringify(frozenOutbox(restored)))) throw Error("The saved receipt does not match the idle original request in this view.");
    return restored;
  }

  retry(id: string): OutboxEntry | null {
    if (!this.matches(id) || this.entry!.state !== "unknown") return null;
    this.publish({ ...this.entry!, state: "sending", error: null, locallyBlocked: false });
    return this.entry;
  }

  bindConversation(id: string, conversationId: string) {
    if (!this.matches(id)) return;
    if (this.entry!.conversationId && this.entry!.conversationId !== conversationId)
      throw Error("A receipt cannot change its conversation identity.");
    if (this.entry!.conversationId !== conversationId)
      this.publish({ ...this.entry!, conversationId });
  }

  fail(id: string, error: string, definitelyRejected: boolean, locallyBlocked = false) {
    if (!this.matches(id)) return;
    const unknown = this.entry!.everUnknown || !definitelyRejected;
    this.publish({ ...this.entry!, state: unknown ? "unknown" : "rejected", error, locallyBlocked, everUnknown: this.entry!.everUnknown || (!locallyBlocked && unknown) });
  }

  accept(id: string) { if (this.matches(id)) this.publish(null); }

  dismiss(id: string) {
    // Unknown is not proof that nothing happened at the center.
    if (this.matches(id) && this.entry!.state === "rejected") this.publish(null);
  }

  dispose() {
    this.closed = true;
    this.publish(null);
    this.listeners.clear();
  }

  private matches(id: string) { return !this.closed && this.entry?.id === id; }
  private publish(entry: OutboxEntry | null) {
    if (this.entry === entry) return;
    this.entry = entry ? Object.freeze(entry) : null;
    this.listeners.forEach(listener => listener());
  }
}
