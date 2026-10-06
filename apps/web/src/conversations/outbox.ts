import {
  conversationCreationSchema,
  conversationTurnSchema,
  type ConversationCreation,
  type ConversationTurnAdmission,
} from "@flow/contracts";
import { freezeKnowledgeRequest } from "../conversation-context/receipts";
import type { FrozenCitation } from "../conversation-context/selection";

export interface OutgoingConversationTurn {
  conversationId: string | null;
  expectedRevision: number;
  text: string;
  creation?: ConversationCreation;
  knowledge?: readonly FrozenCitation[];
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
}

export type TurnReceipt = ReceiptBase & { readonly kind: "turn"; readonly request: Readonly<ConversationTurnAdmission> };
export type CreationReceipt = ReceiptBase & { readonly kind: "creation"; readonly creation: Readonly<ConversationCreation>; readonly request: null };
export type OutboxEntry = TurnReceipt | CreationReceipt;

function freezeCreation(input: ConversationCreation) {
  const value = conversationCreationSchema.parse(input);
  return Object.freeze({ ...value, requested: Object.freeze({ ...value.requested }),
    ...(value.executionProfile ? { executionProfile: Object.freeze({ ...value.executionProfile }) } : {}) });
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
    if (!input.conversationId && input.knowledge?.length && !creation?.projectId)
      throw Error("Knowledge requires a fixed conversation project.");
    const request = freezeKnowledgeRequest(conversationTurnSchema.parse({
      expectedRevision: input.expectedRevision, text: input.text, mode: "follow-up",
      ...(input.knowledge !== undefined ? { knowledge: input.knowledge } : {}),
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

  retry(id: string): OutboxEntry | null {
    if (!this.matches(id) || this.entry!.state !== "unknown") return null;
    this.publish({ ...this.entry!, state: "sending", error: null });
    return this.entry;
  }

  bindConversation(id: string, conversationId: string) {
    if (!this.matches(id)) return;
    if (this.entry!.conversationId && this.entry!.conversationId !== conversationId)
      throw Error("A receipt cannot change its conversation identity.");
    if (this.entry!.conversationId !== conversationId)
      this.publish({ ...this.entry!, conversationId });
  }

  fail(id: string, error: string, definitelyRejected: boolean) {
    if (!this.matches(id)) return;
    const unknown = this.entry!.everUnknown || !definitelyRejected;
    this.publish({ ...this.entry!, state: unknown ? "unknown" : "rejected", error, everUnknown: unknown });
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
