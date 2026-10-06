import {
  conversationCreationSchema,
  conversationTurnSchema,
  type ConversationCreation,
  type ConversationTurnAdmission,
} from "@flow/contracts";

export interface OutgoingConversationTurn {
  conversationId: string | null;
  expectedRevision: number;
  text: string;
  creation?: ConversationCreation;
}
export interface OutboxEntry {
  readonly id: string;
  readonly conversationId: string | null;
  readonly creationKey: string;
  readonly turnKey: string;
  readonly creation: Readonly<ConversationCreation> | null;
  readonly request: Readonly<ConversationTurnAdmission>;
  readonly state: "sending" | "unknown" | "rejected";
  readonly error: string | null;
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

  begin(input: OutgoingConversationTurn): OutboxEntry {
    if (this.closed) throw Error("This conversation connection is closed.");
    if (this.entry && this.entry.state !== "rejected")
      throw Error("The previous admission is unresolved. Check or retry its receipt first.");
    const request = Object.freeze(conversationTurnSchema.parse({
      expectedRevision: input.expectedRevision, text: input.text, mode: "follow-up",
    }));
    const creation = input.creation ? conversationCreationSchema.parse(input.creation) : null;
    if (!input.conversationId && !creation) throw Error("New conversations require creation settings.");
    const id = this.nextId();
    this.publish({
      id, conversationId: input.conversationId,
      creationKey: `${id}:create`, turnKey: `${id}:turn`,
      creation: creation ? Object.freeze({ ...creation, requested: Object.freeze({ ...creation.requested }) }) : null,
      request, state: "sending", error: null,
    });
    return this.entry!;
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
    this.publish({ ...this.entry!, state: definitelyRejected ? "rejected" : "unknown", error });
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
