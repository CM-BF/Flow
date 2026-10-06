import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowApiError, type FlowClient } from "@flow/client";
import type { ConversationSnapshot, ConversationTurn } from "@flow/contracts";
import { ConversationProjection, replyDetailKey } from "../src/conversations/projection";

const at = "2026-10-06T03:40:00Z";
const capabilities = { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } as const;
function turn(number = 1, text = "hi"): ConversationTurn {
  return { id: `turn-${number}`, conversationId: "chat", number, createdAt: at, user: { role: "user", text },
    task: { id: `task-${number}`, title: "hi", harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at },
    assistant: { state: "pending", reason: "execution-pending" }, effective: { model: null, thinking: "unknown", tools: "unknown", source: null },
    telemetry: { kind: "execution", taskId: `task-${number}`, title: "Execution details" } };
}
function reply(input: ConversationTurn, text = "Hello", version = "v1"): ConversationTurn {
  return { ...input, task: { ...input.task, status: "succeeded" }, assistant: { state: "available", role: "assistant", messageId: `reply-${input.id}`, text, truncated: true,
    contentRef: { kind: "artifact", id: "detail", title: "Full reply", taskId: input.task.id, attemptId: "attempt" },
    source: { kind: "adapter-final-artifact", adapterVersion: "claude-sdk-0.3.290-v1", taskId: input.task.id, attemptId: "attempt", artifactId: "artifact", artifactVersion: version, detailId: "detail" } } };
}
function snapshot(lastTurn: ConversationTurn | null = null): ConversationSnapshot {
  return { conversation: { id: "chat", title: "Chat", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, revision: lastTurn?.number ?? 0, createdAt: at, updatedAt: at }, capabilities, nativeSession: null, lastTurn };
}
function wireSnapshot(queue: unknown, lastTurn: ConversationTurn | null = null): ConversationSnapshot {
  // Simulate the additive wire capability before the shared type permits true.
  return { ...snapshot(lastTurn), capabilities: { ...capabilities, queue } } as ConversationSnapshot;
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const projections: ConversationProjection[] = [];
afterEach(() => { projections.splice(0).forEach(projection => projection.dispose()); });
function setup(initial = snapshot(), id: string | null = "chat") {
  let current = initial;
  const client = {
    conversation: vi.fn<FlowClient["conversation"]>(async () => current),
    conversationTurns: vi.fn<FlowClient["conversationTurns"]>(async () => ({ conversation: current.conversation, turns: current.lastTurn ? [current.lastTurn] : [], nextCursor: null as number | null })),
    createConversation: vi.fn<FlowClient["createConversation"]>(async input => { current = { ...current, conversation: { ...current.conversation, ...input } }; return { conversation: current.conversation, capabilities: current.capabilities, replayed: false }; }),
    submitConversationTurn: vi.fn<FlowClient["submitConversationTurn"]>(async (_id, input) => ({ conversation: { ...current.conversation, revision: input.expectedRevision + 1 }, turn: turn(input.expectedRevision + 1, input.text), replayed: false })),
    conversationDetail: vi.fn<FlowClient["conversationDetail"]>(async () => ({ id: "detail", title: "Full reply", kind: "artifact" as const, content: "Complete reply", mediaType: "text/plain", artifactVersion: "v1" })),
  };
  const projection = new ConversationProjection(client, id, 100_000);
  projections.push(projection);
  return { projection, client, set: (next: ConversationSnapshot) => { current = next; } };
}

describe("public conversation projection", () => {
  it.each([false, true])("reads queue=%s while keeping active-turn sending unavailable in this Web version", async queue => {
    const { projection, client } = setup(wireSnapshot(queue, turn()));
    await projection.refresh();
    expect(projection.getSnapshot()).toMatchObject({ loading: false, connection: "live", error: null, snapshot: { capabilities: { queue } } });
    expect(projection.getSnapshot().turns[0]?.id).toBe("turn-1");
    expect(projection.sendDisabledReason()).toContain("not available in this Web version");
    await expect(projection.send("Keep this as a draft")).rejects.toThrow("not available in this Web version");
    expect(projection.getSnapshot().outbox).toBeNull();
    expect(client.submitConversationTurn).not.toHaveBeenCalled();
    expect(client.conversationDetail).not.toHaveBeenCalled();
  });
  it.each([false, true])("accepts queue=%s CREATE receipts and submits only explicit follow-up turns", async queue => {
    const { projection, client, set } = setup(wireSnapshot(queue), null);
    expect(await projection.send("hi")).toBe("chat");
    expect(projection.getSnapshot()).toMatchObject({ outbox: null, snapshot: { capabilities: { queue }, conversation: { revision: 1 } } });
    expect(client.createConversation).toHaveBeenCalledTimes(1);
    expect(client.submitConversationTurn.mock.calls[0]?.[1]).toEqual({ expectedRevision: 0, text: "hi", mode: "follow-up" });
    set(wireSnapshot(queue, reply(turn()))); await projection.refresh();
    expect(projection.sendDisabledReason()).toBeNull();
    await projection.send("next");
    expect(client.submitConversationTurn.mock.calls[1]?.[1]).toEqual({ expectedRevision: 1, text: "next", mode: "follow-up" });
    expect(client.createConversation).toHaveBeenCalledTimes(1);
    expect(projection.getSnapshot().outbox).toBeNull();
  });
  it.each([undefined, null, "true", 1])("rejects non-boolean queue capability %s instead of treating it as supported", async queue => {
    const { projection, client } = setup(wireSnapshot(queue)); await projection.refresh();
    expect(projection.getSnapshot()).toMatchObject({ snapshot: null, connection: "reconnecting" });
    expect(projection.getSnapshot().error).toContain("capabilities are not supported");
    expect(client.submitConversationTurn).not.toHaveBeenCalled();
  });
  it("does not widen other unsupported capabilities while accepting a boolean queue flag", async () => {
    const input = wireSnapshot(true);
    const { projection } = setup({ ...input, capabilities: { ...input.capabilities, steer: true } } as unknown as ConversationSnapshot);
    await projection.refresh();
    expect(projection.getSnapshot().snapshot).toBeNull();
    expect(projection.getSnapshot().error).toContain("capabilities are not supported");
  });
  it("refreshes a same-revision asynchronous reply and reads its exact version only on demand", async () => {
    const { projection, client, set } = setup(snapshot(turn())); await projection.refresh();
    expect(client.conversationDetail).not.toHaveBeenCalled();
    set(snapshot(reply(turn()))); await projection.refresh();
    expect(projection.getSnapshot().turns[0]!.assistant).toMatchObject({ state: "available", text: "Hello" });
    await projection.loadReply("turn-1"); await projection.loadReply("turn-1"); expect(client.conversationDetail).toHaveBeenCalledTimes(1);
    const first = replyDetailKey("chat", projection.getSnapshot().turns[0]!)!;
    set(snapshot(reply(turn(), "Updated", "v2"))); await projection.refresh();
    expect(replyDetailKey("chat", projection.getSnapshot().turns[0]!)).not.toBe(first);
    expect(projection.getSnapshot().details[replyDetailKey("chat", projection.getSnapshot().turns[0]!)!]).toBeUndefined();
  });
  it("keeps a failed initial snapshot unknown and blocks send until it is loaded", async () => {
    const { projection, client } = setup(); client.conversation.mockRejectedValueOnce(Error("Offline")); await projection.refresh();
    expect(projection.getSnapshot().snapshot).toBeNull(); expect(projection.getSnapshot().error).toBe("Offline");
    expect(projection.sendDisabledReason()).not.toBeNull(); expect(client.submitConversationTurn).not.toHaveBeenCalled();
  });
  it("does not recreate an acknowledged conversation when the first turn response is lost", async () => {
    const { projection, client } = setup(snapshot(), null);
    client.submitConversationTurn.mockRejectedValueOnce(Error("Lost receipt")); await projection.send("  hi\n");
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "unknown", conversationId: "chat" });
    const first = client.submitConversationTurn.mock.calls[0]; await projection.retry();
    expect(client.createConversation).toHaveBeenCalledTimes(1); expect(client.submitConversationTurn.mock.calls[1]?.slice(0, 3)).toEqual(first?.slice(0, 3));
    expect(projection.getSnapshot().outbox).toBeNull();
  });
  it("treats 409 as a definite rejection and refreshes without changing the key/revision or automatically resending", async () => {
    const { projection, client, set } = setup(); await projection.refresh();
    client.submitConversationTurn.mockRejectedValueOnce(new FlowApiError(409, "revision_conflict", "Refresh required"));
    set(snapshot(turn(2))); await projection.send("next");
    expect(client.submitConversationTurn).toHaveBeenCalledTimes(1);
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "rejected", request: { expectedRevision: 0 } });
    expect(projection.getSnapshot().snapshot?.conversation.revision).toBe(2); await projection.retry(); expect(client.submitConversationTurn).toHaveBeenCalledTimes(1);
  });
  it("pauses observations without aborting an already sent command or its late receipt", async () => {
    const { projection, client } = setup(); await projection.refresh();
    const pending = deferred<Awaited<ReturnType<FlowClient["submitConversationTurn"]>>>(); client.submitConversationTurn.mockImplementationOnce(() => pending.promise);
    const sending = projection.send("hi"); const signal = client.submitConversationTurn.mock.calls[0]?.[3];
    projection.setVisible(false); projection.setOnline(false); expect(signal?.aborted).toBe(false);
    pending.resolve({ conversation: snapshot(turn()).conversation, turn: turn(), replayed: false }); await sending;
    expect(projection.getSnapshot().outbox).toBeNull(); expect(projection.getSnapshot().turns).toHaveLength(1);
  });
  it("does not let an older in-flight snapshot overwrite a newly accepted turn/revision", async () => {
    const { projection, client } = setup(); await projection.refresh(); const pending = deferred<ConversationSnapshot>();
    client.conversation.mockImplementationOnce(() => pending.promise); const refreshing = projection.refresh();
    await projection.send("new"); pending.resolve(snapshot()); await refreshing;
    expect(projection.getSnapshot().snapshot?.conversation.revision).toBe(1);
    expect(projection.getSnapshot().snapshot?.lastTurn?.id).toBe("turn-1");
  });
  it("does not downgrade a final reply when an older admission ACK arrives last", async () => {
    const { projection, client, set } = setup(); await projection.refresh();
    const pending = deferred<Awaited<ReturnType<FlowClient["submitConversationTurn"]>>>();
    client.submitConversationTurn.mockImplementationOnce(() => pending.promise); const sending = projection.send("hi");
    set(snapshot(reply(turn()))); await projection.refresh();
    pending.resolve({ conversation: snapshot(turn()).conversation, turn: turn(), replayed: false }); await sending;
    expect(projection.getSnapshot().snapshot?.lastTurn?.assistant.state).toBe("available");
    expect(projection.getSnapshot().turns[0]?.assistant.state).toBe("available");
    expect(projection.sendDisabledReason()).toBeNull();
  });
  it.each([false, true])("confirms queue=%s retried saved receipts without regressing a final reply already read from the center", async queue => {
    const { projection, client, set } = setup(wireSnapshot(queue)); await projection.refresh();
    client.submitConversationTurn.mockRejectedValueOnce(Error("ACK lost")); await projection.send("hi");
    const frozenKey = projection.getSnapshot().outbox!.turnKey;
    set(wireSnapshot(queue, reply(turn(), "Final authoritative reply"))); await projection.refresh();
    const before = projection.getSnapshot().turns[0];
    client.submitConversationTurn.mockResolvedValueOnce({ conversation: snapshot(turn()).conversation, turn: turn(), replayed: true });
    await projection.retry();
    expect(client.submitConversationTurn.mock.calls[1]?.[2]).toBe(frozenKey);
    expect(projection.getSnapshot().outbox).toBeNull();
    expect(projection.getSnapshot().turns[0]).toBe(before);
    expect(projection.getSnapshot().snapshot?.lastTurn?.assistant).toMatchObject({ state: "available", text: "Final authoritative reply" });
    expect(projection.sendDisabledReason()).toBeNull();
  });
  it("surfaces a request timeout instead of treating it as a visibility cancellation", async () => {
    const { projection, client } = setup();
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    client.conversation.mockImplementationOnce((_id, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason));
    }));
    const loading = projection.refresh(); controller.abort(new DOMException("Request timed out", "TimeoutError")); await loading;
    timeout.mockRestore(); expect(projection.getSnapshot()).toMatchObject({ loading: false, connection: "reconnecting", error: "Request timed out" });
  });
  it("deduplicates overlapping turn pages and preserves typed user/assistant entries", async () => {
    const { projection, client } = setup(snapshot(reply(turn(2))));
    client.conversationTurns.mockResolvedValueOnce({ conversation: snapshot(turn(2)).conversation, turns: [reply(turn())], nextCursor: 1 });
    await projection.refresh(); client.conversationTurns.mockResolvedValueOnce({ conversation: snapshot(turn(2)).conversation, turns: [reply(turn()), reply(turn(2))], nextCursor: null });
    await projection.loadMore(); expect(projection.getSnapshot().turns.map(item => item.number)).toEqual([1, 2]);
    expect(projection.getSnapshot().nextCursor).toBeNull();
  });
  it("exposes a loadable middle gap after another tab admits several turns while this view is hidden", async () => {
    const { projection, client, set } = setup(snapshot(reply(turn()))); await projection.refresh();
    expect(projection.getSnapshot().nextCursor).toBeNull();
    set(snapshot(reply(turn(3)))); await projection.refresh(); await projection.refresh();
    expect(projection.getSnapshot().turns.map(turn => turn.number)).toEqual([1, 3]);
    expect(projection.getSnapshot().nextCursor).toBe(1);
    client.conversationTurns.mockResolvedValueOnce({ conversation: snapshot(turn(3)).conversation, turns: [reply(turn(2)), reply(turn(3))], nextCursor: null });
    await projection.loadMore();
    expect(client.conversationTurns).toHaveBeenLastCalledWith("chat", { after: 1, limit: 20 }, expect.any(AbortSignal));
    expect(projection.getSnapshot().turns.map(turn => turn.number)).toEqual([1, 2, 3]);
    expect(projection.getSnapshot().nextCursor).toBeNull();
  });
  it("rejects mismatched lazy detail versions and lets explicit retry succeed", async () => {
    const { projection, client } = setup(snapshot(reply(turn()))); await projection.refresh();
    client.conversationDetail.mockResolvedValueOnce({ id: "detail", title: "Wrong", kind: "artifact", content: "wrong", mediaType: "text/plain", artifactVersion: "v0" });
    await projection.loadReply("turn-1"); const key = replyDetailKey("chat", projection.getSnapshot().turns[0]!)!;
    expect(projection.getSnapshot().details[key]?.error).toContain("version"); await projection.loadReply("turn-1"); expect(projection.getSnapshot().details[key]?.data?.content).toBe("Complete reply");
  });
  it("keeps a previously unknown result unknown after a retry authentication failure", async () => {
    const { projection, client } = setup(); await projection.refresh();
    client.submitConversationTurn.mockRejectedValueOnce(Error("Receipt lost")); await projection.send("hi");
    const entry = projection.getSnapshot().outbox!;
    client.submitConversationTurn.mockRejectedValueOnce(new FlowApiError(403, "forbidden", "Permission changed")); await projection.retry();
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "unknown", turnKey: entry.turnKey, everUnknown: true });
    projection.outbox.dismiss(entry.id); expect(projection.getSnapshot().outbox).not.toBeNull();
  });
  it("does not accept malformed or mismatched success receipts as proof of admission", async () => {
    const { projection, client } = setup(); await projection.refresh();
    client.submitConversationTurn.mockResolvedValueOnce({ conversation: snapshot(turn()).conversation, turn: turn(1, "someone else's message"), replayed: false });
    await projection.send("hi"); expect(projection.getSnapshot().outbox?.state).toBe("unknown"); expect(projection.getSnapshot().turns).toHaveLength(0);
    client.submitConversationTurn.mockResolvedValueOnce({} as Awaited<ReturnType<FlowClient["submitConversationTurn"]>>);
    await projection.retry(); expect(projection.getSnapshot().outbox?.state).toBe("unknown");
    await projection.retry(); expect(projection.getSnapshot().outbox).toBeNull();
  });
  it("validates typed source digests and namespaces identical detail IDs by source identity", async () => {
    const input = reply(turn()); const content = "Typed assistant reply";
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (input.assistant.state !== "available") throw Error("Invalid test setup");
    input.assistant = { ...input.assistant, contentRef: { ...input.assistant.contentRef, kind: "detail" }, source: { kind: "assistant-final", source: "claude.sdk.result", messageId: input.assistant.messageId, taskId: input.task.id, attemptId: "attempt", nativeSessionId: "session", eventId: "event", sourceMessageId: "source", contentDigest: digest, detailId: "detail" } };
    const { projection, client } = setup(snapshot(input)); await projection.refresh();
    client.conversationDetail.mockResolvedValueOnce({ id: "detail", title: "Reply", kind: "detail", content: "wrong", mediaType: "text/plain" });
    await projection.loadReply(input.id); const key = replyDetailKey("chat", input)!; expect(projection.getSnapshot().details[key]?.error).toContain("version");
    client.conversationDetail.mockResolvedValueOnce({ id: "detail", title: "Reply", kind: "detail", content, mediaType: "text/plain" }); await projection.loadReply(input.id);
    expect(projection.getSnapshot().details[key]?.data?.content).toBe(content);
  });
  it("does not move a disposed connection's delayed receipt or detail into a same-ID new connection", async () => {
    const old = setup(snapshot(reply(turn()))); await old.projection.refresh();
    const pending = deferred<Awaited<ReturnType<FlowClient["conversationDetail"]>>>(); old.client.conversationDetail.mockImplementationOnce(() => pending.promise);
    const loading = old.projection.loadReply("turn-1"); old.projection.dispose();
    const next = setup(snapshot(reply(turn(), "Center B"))); await next.projection.refresh();
    pending.resolve({ id: "detail", title: "A", kind: "artifact", content: "Center A", mediaType: "text/plain", artifactVersion: "v1" }); await loading;
    expect(next.projection.getSnapshot().details).toEqual({}); expect(next.projection.getSnapshot().turns[0]!.assistant).toMatchObject({ text: "Center B" });
  });
});
