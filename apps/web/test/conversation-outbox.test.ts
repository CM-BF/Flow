import { describe, expect, it } from "vitest";
import { ConversationOutbox } from "../src/conversations/outbox";

const creation = { title: "Hello", harness: "claude" as const, requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const } };
const input = { conversationId: "chat-a", expectedRevision: 2, text: "  hi\n" };
const setup = () => { let id = 0; return new ConversationOutbox(() => `command-${++id}`); };

describe("conversation admission outbox", () => {
  it("prepares creation with one frozen key and no synthetic turn, preserving unknown retries", () => {
    const box = setup(), source = { ...creation, projectId: "project-a" };
    const entry = box.beginCreation(source); source.projectId = "project-b";
    expect(entry.kind).toBe("creation"); expect(entry.request).toBeNull(); expect(entry.creation.projectId).toBe("project-a");
    box.fail(entry.id, "lost CREATE", false); expect(box.retry(entry.id)).toMatchObject({ kind: "creation", creationKey: entry.creationKey, request: null });
    expect(() => box.begin({ ...input, creation })).toThrow("unresolved");
    box.bindConversation(entry.id, "prepared"); box.accept(entry.id);
    expect(box.begin({ ...input, conversationId: "prepared" })).toMatchObject({ kind: "turn", conversationId: "prepared", creation: null });
  });
  it("freezes knowledge independently of the next draft and reuses it after a lost receipt", () => {
    const ref = { projectId: "project-a", sourceId: "10000000-0000-4000-8000-000000000001", version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes" as const, start: 0, end: 4 } };
    const knowledge = [ref], draft = { ...input, knowledge };
    const box = setup(), first = box.begin(draft);
    draft.text = "next unsent"; ref.locator.end = 6; knowledge.splice(0);
    expect(first.request.knowledge?.[0]?.locator.end).toBe(4);
    expect(Object.isFrozen(first.request.knowledge)).toBe(true); expect(Object.isFrozen(first.request.knowledge?.[0]?.locator)).toBe(true);
    box.fail(first.id, "lost", false); const retry = box.retry(first.id)!;
    expect(retry.request).toBe(first.request); expect(retry.turnKey).toBe(first.turnKey);
    box.fail(first.id, "budget rejection on retry", true); expect(box.getSnapshot()?.state).toBe("unknown");
    box.accept(first.id); expect(draft.text).toBe("next unsent"); expect(draft.knowledge).toEqual([]);
  });
  it("requires a matching frozen creation project for new turns with knowledge before allocating a key", () => {
    const ref = { projectId: "project-a", sourceId: "10000000-0000-4000-8000-000000000001", version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes" as const, start: 0, end: 4 } };
    let keys = 0; const box = new ConversationOutbox(() => String(++keys));
    for (const settings of [creation, { ...creation, projectId: "project-b" }])
      expect(() => box.begin({ ...input, conversationId: null, creation: settings, knowledge: [ref] })).toThrow("project");
    expect(keys).toBe(0); expect(box.getSnapshot()).toBeNull();
    const first = box.begin({ ...input, conversationId: null, creation: { ...creation, projectId: "project-a" }, knowledge: [ref] });
    box.fail(first.id, "CREATE lost", false); expect(box.retry(first.id)?.creationKey).toBe(first.creationKey);
    box.bindConversation(first.id, "created"); box.fail(first.id, "turn lost", false);
    expect(box.retry(first.id)?.request).toBe(first.request);
  });
  it("keeps explicit empty knowledge distinct from an omitted field", () => {
    const box = setup(), entry = box.begin({ ...input, knowledge: [] });
    expect(entry.request.knowledge).toEqual([]); expect(Object.isFrozen(entry.request.knowledge)).toBe(true);
    box.accept(entry.id); expect(box.begin(input).request).not.toHaveProperty("knowledge");
  });

  it("detaches and freezes project identity through unknown CREATE and turn retries without adding knowledge", () => {
    const source = { ...creation, projectId: "project-a" };
    const outbox = setup(); const first = outbox.begin({ ...input, conversationId: null, expectedRevision: 0, creation: source });
    source.projectId = "project-b";
    expect(first.creation?.projectId).toBe("project-a");
    expect(Reflect.set(first.creation!, "projectId", "project-c")).toBe(false);
    outbox.fail(first.id, "CREATE response lost", false);
    expect(outbox.retry(first.id)).toMatchObject({ creationKey: first.creationKey, creation: { projectId: "project-a" } });
    outbox.bindConversation(first.id, "created"); outbox.fail(first.id, "Turn response lost", false);
    const retry = outbox.retry(first.id)!;
    expect(retry.creation).toBe(first.creation); expect(retry.turnKey).toBe(first.turnKey); expect(retry.request).toBe(first.request);
    expect(retry.request).toEqual({ expectedRevision: 0, text: input.text, mode: "follow-up" });
    expect(retry.request).not.toHaveProperty("knowledge");
  });
  it("deep-freezes the cloned execution profile pin through unknown CREATE and turn retries", () => {
    const pin = { id: "10000000-0000-4000-8000-000000000001", runnerId: "10000000-0000-4000-8000-000000000002", configDigest: "a".repeat(64) };
    const source = { ...creation, executionProfile: pin };
    const outbox = setup(); const first = outbox.begin({ ...input, conversationId: null, expectedRevision: 0, creation: source });
    pin.configDigest = "b".repeat(64); source.requested = { ...source.requested, model: "new selection" };
    expect(first.creation?.executionProfile?.configDigest).toBe("a".repeat(64));
    expect(Object.isFrozen(first.creation?.executionProfile)).toBe(true);
    expect(Reflect.set(first.creation!.executionProfile!, "runnerId", pin.id)).toBe(false);
    outbox.fail(first.id, "Unknown CREATE", false);
    const retry = outbox.retry(first.id)!;
    expect(retry.creation).toBe(first.creation); expect(retry.creationKey).toBe(first.creationKey);
    outbox.bindConversation(first.id, "created"); outbox.fail(first.id, "Unknown turn", false);
    expect(outbox.retry(first.id)).toMatchObject({ conversationId: "created", turnKey: first.turnKey, creation: first.creation });
  });
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
    expect(outbox.getSnapshot()?.request?.expectedRevision).toBe(2);
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
  it("preserves earlier receipt uncertainty when a later retry is definitely rejected", () => {
    const outbox = setup(); const first = outbox.begin(input); outbox.fail(first.id, "Lost", false); outbox.retry(first.id);
    outbox.fail(first.id, "Retry forbidden", true); expect(outbox.getSnapshot()).toMatchObject({ state: "unknown", everUnknown: true });
    outbox.dismiss(first.id); expect(outbox.getSnapshot()).not.toBeNull();
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


describe("attachment material admission", () => {
  const ref = (n = 1) => ({ kind: "upload" as const, projectId: "project-a", resourceId: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`, version: 1 as const, contentDigest: "d".repeat(64) });
  it("detaches ordered attachment references at local handoff and preserves unknown request identity", () => {
    const box = setup(), attachments = [ref(2), ref(1)];
    const first = box.begin({ ...input, attachments });
    attachments[0]!.contentDigest = "f".repeat(64); attachments.reverse(); attachments.length = 0;
    expect(first.request.attachments).toEqual([ref(2), ref(1)]);
    expect(Object.isFrozen(first.request.attachments)).toBe(true);
    expect(Object.isFrozen(first.request.attachments?.[0])).toBe(true);
    box.fail(first.id, "bad 200", false);
    expect(box.retry(first.id)?.request).toBe(first.request);
    expect(box.getSnapshot()?.turnKey).toBe(first.turnKey);
  });
  it("rejects absent or wrong new conversation project and mixed material projects before allocating identity", () => {
    let keys = 0; const box = new ConversationOutbox(() => String(++keys));
    for (const settings of [creation, { ...creation, projectId: "project-b" }])
      expect(() => box.begin({ ...input, conversationId: null, creation: settings, attachments: [ref()] })).toThrow("project");
    expect(() => box.begin({ ...input, attachments: [ref(), { ...ref(2), projectId: "project-b" }] })).toThrow("project");
    expect(keys).toBe(0); expect(box.getSnapshot()).toBeNull();
  });
  it("preserves omitted and explicitly empty attachments", () => {
    const box = setup(), first = box.begin({ ...input, attachments: [] });
    expect(first.request.attachments).toEqual([]); expect(Object.isFrozen(first.request.attachments)).toBe(true);
    box.accept(first.id); expect(box.begin(input).request).not.toHaveProperty("attachments");
  });
});
