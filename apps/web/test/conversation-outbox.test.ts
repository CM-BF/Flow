import { describe, expect, it } from "vitest";
import { ConversationOutbox } from "../src/conversations/outbox";

const creation = { title: "Hello", harness: "claude" as const, requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const } };
const input = { conversationId: "chat-a", expectedRevision: 2, text: "  hi\n" };
const setup = () => { let id = 0; return new ConversationOutbox(() => `command-${++id}`); };

describe("conversation admission outbox", () => {
  it("freezes sent payload and retries an unknown receipt with the same identity while a new draft remains independent", () => {
    const outbox = setup(); const draft = { ...input };
    const first = outbox.begin(draft);
    draft.text = "a new unsent question";
    outbox.fail(first.id, "Response lost", false);
    expect(() => outbox.begin(draft)).toThrow("unresolved");
    const retry = outbox.retry(first.id)!;
    expect(retry.request).toBe(first.request);
    expect(retry.request).toEqual({ expectedRevision: 2, text: "  hi\n", mode: "follow-up" });
    expect(retry.turnKey).toBe(first.turnKey);
    expect(Object.isFrozen(retry.request)).toBe(true);
    outbox.accept(first.id);
    expect(draft.text).toBe("a new unsent question");
    expect(outbox.getSnapshot()).toBeNull();
  });
  it("keeps creation and first turn keys separate and preserves an acknowledged conversation through a lost turn receipt", () => {
    const outbox = setup(); const first = outbox.begin({ ...input, conversationId: null, expectedRevision: 0, creation });
    expect(first.creationKey).not.toBe(first.turnKey);
    outbox.bindConversation(first.id, "new-chat"); outbox.fail(first.id, "Turn response lost", false);
    const retry = outbox.retry(first.id)!;
    expect(retry.conversationId).toBe("new-chat"); expect(retry.creationKey).toBe(first.creationKey); expect(retry.turnKey).toBe(first.turnKey);
    expect(Object.isFrozen(retry.creation?.requested)).toBe(true);
    expect(() => outbox.bindConversation(first.id, "different-chat")).toThrow("identity");
  });
  it("does not dispatch a second retry while the first attempt is pending", () => {
    const outbox = setup(); const first = outbox.begin(input);
    expect(outbox.retry(first.id)).toBeNull();
    outbox.fail(first.id, "Timeout", false);
    expect(outbox.retry(first.id)).not.toBeNull(); expect(outbox.retry(first.id)).toBeNull();
  });
  it("keeps a definite rejection visible and requires an explicit new submission to use a new revision/key", () => {
    const outbox = setup(); const first = outbox.begin(input);
    outbox.fail(first.id, "Revision conflict", true);
    expect(outbox.getSnapshot()?.state).toBe("rejected"); expect(outbox.retry(first.id)).toBeNull();
    expect(outbox.getSnapshot()?.request.expectedRevision).toBe(2);
    const next = outbox.begin({ ...input, expectedRevision: 3 });
    expect(next.turnKey).not.toBe(first.turnKey); expect(next.request.expectedRevision).toBe(3);
  });
  it("ignores stale acknowledgements/failures after a different explicit command", () => {
    const outbox = setup(); const first = outbox.begin(input); outbox.fail(first.id, "Rejected", true);
    const next = outbox.begin({ ...input, text: "next" });
    outbox.accept(first.id); outbox.fail(first.id, "Late failure", false);
    expect(outbox.getSnapshot()).toBe(next);
  });
  it("disposes the old connection without late callbacks reviving its command", () => {
    const outbox = setup(); const first = outbox.begin(input); outbox.dispose();
    outbox.accept(first.id); outbox.fail(first.id, "Late response", false); outbox.bindConversation(first.id, "other");
    expect(outbox.getSnapshot()).toBeNull(); expect(outbox.retry(first.id)).toBeNull(); expect(() => outbox.begin(input)).toThrow("closed");
  });
  it("validates before replacing an existing rejection and publishes stable snapshots", () => {
    const outbox = setup(); const first = outbox.begin(input); outbox.fail(first.id, "Rejected", true);
    const snapshot = outbox.getSnapshot(); let notices = 0; const unsubscribe = outbox.subscribe(() => notices++);
    expect(() => outbox.begin({ ...input, text: "  " })).toThrow();
    expect(outbox.getSnapshot()).toBe(snapshot); expect(notices).toBe(0);
    outbox.dismiss(first.id); expect(notices).toBe(1); unsubscribe();
  });
  it("does not let a pending or unknown admission be dismissed as if it never reached the center", () => {
    const outbox = setup(); const first = outbox.begin(input);
    outbox.dismiss(first.id); expect(outbox.getSnapshot()).toBe(first);
    outbox.fail(first.id, "Unknown", false); const unknown = outbox.getSnapshot(); outbox.dismiss(first.id); expect(outbox.getSnapshot()).toBe(unknown);
  });
});
