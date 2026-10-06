import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowApiError, FlowClient } from "@flow/client";
import { conversationCreationSchema, conversationTurnSchema, type ConversationCreation, type ConversationSnapshot, type ConversationTurn } from "@flow/contracts";
import { ConversationProjection, replyDetailKey } from "../src/conversations/projection";
import { conversationMessages } from "../src/conversations/messages";

const at = "2026-10-06T03:40:00Z";
const capabilities = { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } as const;
const pin = { id: "10000000-0000-4000-8000-000000000001", runnerId: "10000000-0000-4000-8000-000000000002", configDigest: "a".repeat(64) };
const configuredCreation: ConversationCreation = { title: "hi", harness: "claude", executionProfile: pin, requested: { model: "configured-model", thinking: "disabled", tools: "none" } };
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
function setup(initial = snapshot(), id: string | null = "chat", withQueue = false) {
  let current = initial;
  const client = {
    conversation: vi.fn<FlowClient["conversation"]>(async () => current),
    conversationTurns: vi.fn<FlowClient["conversationTurns"]>(async () => ({ conversation: current.conversation, turns: current.lastTurn ? [current.lastTurn] : [], nextCursor: null as number | null })),
    createConversation: vi.fn<FlowClient["createConversation"]>(async input => { current = { ...current, conversation: { ...current.conversation, ...input } }; return { conversation: current.conversation, capabilities: current.capabilities, replayed: false }; }),
    submitConversationTurn: vi.fn<FlowClient["submitConversationTurn"]>(async (_id, input) => ({ conversation: { ...current.conversation, revision: input.expectedRevision + 1 }, turn: turn(input.expectedRevision + 1, input.text), replayed: false })),
    conversationDetail: vi.fn<FlowClient["conversationDetail"]>(async () => ({ id: "detail", title: "Full reply", kind: "artifact" as const, content: "Complete reply", mediaType: "text/plain", artifactVersion: "v1" })),
  };
  const queueApi = {
    conversationQueue: vi.fn<FlowClient["conversationQueue"]>(async () => ({ conversationId: "chat", queueRevision: 1, paused: false, currentTurn: null, items: [], nextCursor: null, blocked: null })),
    conversationQueueItem: vi.fn(), enqueueConversationTurn: vi.fn(), cancelConversationQueueItem: vi.fn(), pauseConversationQueue: vi.fn(), resumeConversationQueue: vi.fn(), cancel: vi.fn(),
  };
  if (withQueue) Object.assign(client, queueApi);
  const projection = new ConversationProjection(client, id, 100_000);
  projections.push(projection);
  return { projection, client, queueApi, set: (next: ConversationSnapshot) => { current = next; } };
}

describe("public conversation projection", () => {
  it.each(["revision", "task timestamp", "effective source"])("uses the shared decoder for a non-HTTP port's invalid %s success", async field => {
    const { projection, client } = setup(); await projection.refresh();
    const value = { conversation: snapshot(turn()).conversation, turn: turn(), replayed: false };
    if (field === "revision") value.conversation.revision = 2;
    else if (field === "task timestamp") value.turn.task.updatedAt = "invalid";
    else value.turn.effective.source = { kind: "recorded-adapter-session", taskId: "different-task", attemptId: "attempt", detailId: "detail", adapterVersion: "fixture" };
    client.submitConversationTurn.mockResolvedValueOnce(value);
    await projection.send("hi"); const pending = projection.getSnapshot().outbox!;
    expect(pending).toMatchObject({ state: "unknown", everUnknown: true }); expect(projection.getSnapshot().turns).toEqual([]);
    await projection.retry(); expect(client.submitConversationTurn.mock.calls[1]!.slice(0, 3)).toEqual(client.submitConversationTurn.mock.calls[0]!.slice(0, 3));
    expect(projection.getSnapshot().outbox).toBeNull();
  });

  it("prepares zero-turn conversation using one CREATE receipt, then sends without recreating", async () => {
    const { projection, client } = setup(snapshot(), null);
    const creation = { ...configuredCreation, projectId: "project-a" };
    client.createConversation.mockRejectedValueOnce(Error("lost"));
    await projection.prepare(creation);
    expect(projection.getSnapshot().outbox).toMatchObject({ kind: "creation", state: "unknown", request: null });
    const receipt = projection.getSnapshot().outbox!; await projection.retry();
    expect(client.createConversation.mock.calls[1]![1]).toBe(receipt.creationKey);
    expect(client.submitConversationTurn).not.toHaveBeenCalled(); expect(projection.getSnapshot().turns).toEqual([]);
    await projection.send("first real message"); expect(client.createConversation).toHaveBeenCalledTimes(2); expect(client.submitConversationTurn).toHaveBeenCalledTimes(1);
  });
  it("requires a supported fixed project and checks full ordered knowledge in Send ACK", async () => {
    const initial = snapshot(); initial.conversation.projectId = "project-a"; initial.capabilities = { ...initial.capabilities, knowledgeContext: true };
    const { projection, client } = setup(initial); await projection.refresh();
    const ref = { projectId: "project-a", sourceId: pin.id, version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes" as const, start: 0, end: 4 } };
    await projection.send("with knowledge", undefined, [ref]);
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "unknown", request: { knowledge: [ref] } });
    const first = client.submitConversationTurn.mock.calls[0]!;
    await projection.retry(); expect(client.submitConversationTurn.mock.calls[1]!.slice(0,3)).toEqual(first.slice(0,3));
    const unsupported = setup(snapshot()); await unsupported.projection.refresh();
    await expect(unsupported.projection.send("text", undefined, [ref])).rejects.toThrow("supported project"); expect(unsupported.client.submitConversationTurn).not.toHaveBeenCalled();
  });
  it.each([undefined, "project-a"])("retains project %s and rejects changed GET identity without replacing known facts", async projectId => {
    const initial = snapshot(reply(turn())); initial.conversation = { ...initial.conversation, ...(projectId === undefined ? {} : { projectId }) };
    const { projection, set } = setup(initial); await projection.refresh();
    expect(projection.getSnapshot().error).toBeNull(); expect(projection.getSnapshot().snapshot?.conversation).toEqual(initial.conversation);
    for (const changed of projectId === undefined ? ["project-a"] : [undefined, "project-b"]) {
      set({ ...initial, conversation: { ...initial.conversation, projectId: changed } }); await projection.refresh();
      expect(projection.getSnapshot().error).toContain("frozen creation configuration");
      expect(projection.getSnapshot().snapshot?.conversation).toEqual(initial.conversation);
    }
  });
  it.each([["project-a", "project-b"], ["project-a", undefined], [undefined, "project-a"]])("rejects snapshot/page project mismatch %s / %s", async (projectId, pageProjectId) => {
    const initial = snapshot(); initial.conversation.projectId = projectId;
    const { projection, client } = setup(initial);
    client.conversationTurns.mockResolvedValueOnce({ conversation: { ...initial.conversation, projectId: pageProjectId }, turns: [], nextCursor: null });
    await projection.refresh(); expect(projection.getSnapshot().snapshot).toBeNull(); expect(projection.getSnapshot().error).toContain("frozen creation configuration");
  });
  it.each([undefined, "project-a"])("accepts matching project %s CREATE and first turn receipts", async projectId => {
    const creation: ConversationCreation = { ...configuredCreation, ...(projectId === undefined ? {} : { projectId }) };
    const { projection, client } = setup(snapshot(), null); await projection.send("hi", creation);
    expect(projection.getSnapshot().outbox).toBeNull(); expect(projection.getSnapshot().snapshot?.conversation.projectId).toBe(projectId);
    expect(client.submitConversationTurn).toHaveBeenCalledTimes(1);
    expect(client.submitConversationTurn.mock.calls[0]![1]).not.toHaveProperty("knowledge");
  });
  it("keeps known project identity when a later history page or turn receipt omits it", async () => {
    const initial = snapshot(reply(turn())); initial.conversation.projectId = "project-a";
    const { projection, client } = setup(initial);
    client.conversationTurns.mockResolvedValueOnce({ conversation: initial.conversation, turns: [initial.lastTurn!], nextCursor: 1 });
    await projection.refresh(); const known = projection.getSnapshot().snapshot;
    const unbound = { ...initial.conversation, projectId: undefined };
    client.conversationTurns.mockResolvedValueOnce({ conversation: unbound, turns: [reply(turn(2))], nextCursor: null });
    await projection.loadMore();
    expect(projection.getSnapshot().error).toContain("frozen creation configuration");
    expect(projection.getSnapshot().turns).toHaveLength(1); expect(projection.getSnapshot().snapshot).toBe(known);
    client.submitConversationTurn.mockResolvedValueOnce({ conversation: { ...unbound, revision: 2 }, turn: turn(2, "next"), replayed: false });
    await projection.send("next");
    expect(projection.getSnapshot().outbox?.state).toBe("unknown");
    expect(projection.getSnapshot().snapshot?.conversation.projectId).toBe("project-a");
    await projection.retry();
    expect(client.submitConversationTurn.mock.calls[1]!.slice(0,3)).toEqual(client.submitConversationTurn.mock.calls[0]!.slice(0,3));
    expect(projection.getSnapshot().outbox).toBeNull();
  });
  it.each([["project-a", undefined], ["project-a", "project-b"], [undefined, "project-a"]])("keeps mismatched project CREATE %s / %s unknown and retries the original identity", async (expectedProject, receivedProject) => {
    const creation: ConversationCreation = { ...configuredCreation, ...(expectedProject === undefined ? {} : { projectId: expectedProject }) };
    const { projection, client } = setup(snapshot(), null);
    client.createConversation.mockResolvedValueOnce({ conversation: { ...snapshot().conversation, ...creation, projectId: receivedProject }, capabilities, replayed: false });
    await projection.send("hi", creation);
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "unknown", conversationId: null, creation });
    expect(client.submitConversationTurn).not.toHaveBeenCalled(); expect(projection.getSnapshot().snapshot).toBeNull();
    await projection.retry();
    expect(client.createConversation.mock.calls[1]!.slice(0,2)).toEqual(client.createConversation.mock.calls[0]!.slice(0,2));
    expect(projection.getSnapshot().outbox).toBeNull(); expect(client.submitConversationTurn).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, false, true])("accepts optional knowledgeContext=%s without fetching context or reply details", async knowledgeContext => {
    const initial = snapshot(reply(turn())); initial.capabilities = { ...capabilities, ...(knowledgeContext === undefined ? {} : { knowledgeContext }) };
    const { projection, client } = setup(initial); await projection.refresh();
    expect(projection.getSnapshot()).toMatchObject({ connection: "live", error: null });
    expect(projection.getSnapshot().snapshot?.capabilities.knowledgeContext).toBe(knowledgeContext);
    expect(client.conversationDetail).not.toHaveBeenCalled();
  });
  it.each([null, "true", 1])("rejects malformed knowledgeContext=%s instead of inferring support", async knowledgeContext => {
    const initial = { ...snapshot(), capabilities: { ...capabilities, knowledgeContext } } as unknown as ConversationSnapshot;
    const { projection } = setup(initial); await projection.refresh();
    expect(projection.getSnapshot().snapshot).toBeNull(); expect(projection.getSnapshot().error).toContain("capabilities are not supported");
  });
  it("retains context metadata in snapshots and history while only actual user/assistant text becomes messages", async () => {
    const context: NonNullable<ConversationTurn["context"]> = { id: "context-only", contextDigest: "a".repeat(64), executionInputId: "private-input-id", executionInputDigest: "b".repeat(64), templateVersion: 1,
      sources: [{ citation: { projectId: "project-a", sourceId: "10000000-0000-4000-8000-000000000010", version: 1, contentDigest: "c".repeat(64), locator: { kind: "utf8-bytes", start: 0, end: 5 } }, byteLength: 5, currentVersionAtFreeze: 1, isCurrentAtFreeze: true }] };
    const first = { ...reply(turn()), context }, last = { ...reply(turn(2)), context };
    const { projection, client } = setup(snapshot(last));
    client.conversationTurns.mockResolvedValueOnce({ conversation: snapshot(last).conversation, turns: [first, last], nextCursor: null });
    await projection.refresh();
    expect(projection.getSnapshot().turns.map(value => value.context)).toEqual([context, context]);
    expect(projection.getSnapshot().snapshot?.lastTurn?.context).toEqual(context);
    expect(conversationMessages(projection.getSnapshot().turns)).toEqual(conversationMessages([reply(turn()), reply(turn(2))]));
    expect(client.conversationDetail).not.toHaveBeenCalled();
    expect(client.conversation).toHaveBeenCalledTimes(1); expect(client.conversationTurns).toHaveBeenCalledTimes(1);
  });
  it("uses explicit queue intent while preserving active execution and the visible observer lifecycle", async () => {
    const { projection, queueApi, client } = setup(wireSnapshot(true, turn()), "chat", true);
    projection.setVisible(true); await projection.refresh(); await projection.queue.refresh();
    expect(projection.sendDisabledReason()).toContain("Choose Queue next"); expect(projection.sendDisabledReason("queue")).toBeNull();
    expect(client.submitConversationTurn).not.toHaveBeenCalled(); expect(projection.getSnapshot().snapshot?.lastTurn?.task.status).toBe("running");
    projection.setOnline(false); expect(projection.sendDisabledReason("queue")).toContain("Reconnect"); projection.setVisible(false);
    const reads = queueApi.conversationQueue.mock.calls.length; projection.setOnline(true); expect(queueApi.conversationQueue).toHaveBeenCalledTimes(reads);
    projection.setVisible(true); await projection.queue.refresh(); expect(queueApi.conversationQueue.mock.calls.length).toBeGreaterThan(reads);
  });
  it("does not activate queue methods for a false capability even when the public client supports them", async () => {
    const { projection, queueApi } = setup(wireSnapshot(false), "chat", true); projection.setVisible(true); await projection.refresh();
    await projection.queue.refresh(); expect(queueApi.conversationQueue).not.toHaveBeenCalled(); expect(projection.sendDisabledReason("queue")).toContain("unavailable");
    expect(projection.sendDisabledReason()).toBeNull();
  });
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
    set({ ...wireSnapshot(queue, reply(turn())), conversation: { ...projection.getSnapshot().snapshot!.conversation, revision: 1 } }); await projection.refresh();
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
  it.each(["missing", "id", "runnerId", "configDigest"] as const)("keeps a %s pin mismatch in a CREATE receipt unknown and does not submit a turn", async field => {
    const { projection, client } = setup(snapshot(), null);
    const wrong = { ...pin, ...(field !== "missing" ? { [field]: field === "configDigest" ? "b".repeat(64) : "10000000-0000-4000-8000-000000000099" } : {}) };
    client.createConversation.mockResolvedValueOnce({ conversation: { ...snapshot().conversation, ...configuredCreation, executionProfile: field === "missing" ? undefined : wrong }, capabilities, replayed: false });
    await projection.send("hi", configuredCreation);
    const pending = projection.getSnapshot().outbox!;
    expect(pending).toMatchObject({ state: "unknown", conversationId: null, creation: configuredCreation });
    expect(projection.getSnapshot().snapshot).toBeNull(); expect(client.submitConversationTurn).not.toHaveBeenCalled();
    await projection.retry();
    expect(client.createConversation.mock.calls[1]?.slice(0, 2)).toEqual(client.createConversation.mock.calls[0]?.slice(0, 2));
    expect(projection.getSnapshot().outbox).toBeNull();
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toEqual(pin);
  });
  it("rejects an unexpected CREATE pin for an explicit legacy conversation", async () => {
    const { projection, client } = setup(snapshot(), null);
    client.createConversation.mockImplementationOnce(async input => ({ conversation: { ...snapshot().conversation, ...input, executionProfile: pin }, capabilities, replayed: false }));
    await projection.send("hi");
    expect(projection.getSnapshot().outbox?.state).toBe("unknown");
    expect(client.submitConversationTurn).not.toHaveBeenCalled();
  });
  it("keeps the acknowledged creation locked after a rejected first turn and never creates with the later selection", async () => {
    const { projection, client } = setup(snapshot(), null);
    client.submitConversationTurn.mockRejectedValueOnce(new FlowApiError(409, "conflict", "Refresh"));
    await projection.send("hi", configuredCreation);
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toEqual(pin);
    expect(projection.getSnapshot().outbox?.state).toBe("rejected");
    await projection.send("new text", { ...configuredCreation, executionProfile: { ...pin, configDigest: "b".repeat(64) } });
    expect(client.createConversation).toHaveBeenCalledTimes(1);
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toEqual(pin);
  });
  it("checks pinned creation on later GET pages and turn receipts without overwriting accepted configuration", async () => {
    const { projection, client, set } = setup(snapshot(), null); await projection.send("hi", configuredCreation);
    const original = projection.getSnapshot().snapshot!.conversation;
    set({ ...snapshot(reply(turn())), conversation: { ...original, executionProfile: { ...pin, configDigest: "b".repeat(64) } } });
    await projection.refresh();
    expect(projection.getSnapshot().error).toContain("frozen creation configuration");
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toEqual(pin);
    set({ ...snapshot(reply(turn())), conversation: original }); await projection.refresh();
    client.submitConversationTurn.mockResolvedValueOnce({ conversation: { ...original, revision: 2, executionProfile: undefined }, turn: turn(2, "next"), replayed: false });
    await projection.send("next");
    expect(projection.getSnapshot().outbox?.state).toBe("unknown");
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toEqual(pin);
  });
  it("retains legacy unpinned configuration on an existing conversation", async () => {
    const { projection, client } = setup(snapshot(reply(turn()))); await projection.refresh();
    await projection.send("next", configuredCreation);
    expect(client.createConversation).not.toHaveBeenCalled();
    expect(projection.getSnapshot().snapshot?.conversation.executionProfile).toBeUndefined();
    expect(client.submitConversationTurn.mock.calls[0]?.[1]).toEqual({ expectedRevision: 1, text: "next", mode: "follow-up" });
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


describe("live text capability wire compatibility", () => {
  afterEach(() => vi.restoreAllMocks());

  function wire(liveAssistantText: unknown, queue = false, id: string | null = "chat") {
    let current: ConversationSnapshot = { ...snapshot(), capabilities: { ...capabilities, queue } } satisfies ConversationSnapshot;
    let live = liveAssistantText;
    let createResponse: ((value: unknown) => unknown) | undefined;
    const requests: { path: string; method: string; body: string | undefined; key: string | null; optIn: string | null }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = init?.method ?? "GET", headers = new Headers(init?.headers);
      const body = typeof init?.body === "string" ? init.body : undefined;
      requests.push({ path: url.pathname, method, body, key: headers.get("Idempotency-Key"), optIn: headers.get("X-Flow-Assistant-Stream") });
      const wireCapabilities = () => ({ ...current.capabilities, liveAssistantText: live });
      if (url.pathname === "/api/conversations" && method === "POST") {
        const creation = conversationCreationSchema.parse(JSON.parse(body ?? "null"));
        current = { ...current, conversation: { ...current.conversation, ...creation } };
        const receipt = { conversation: current.conversation, capabilities: wireCapabilities(), replayed: requests.filter(request => request.path === url.pathname && request.method === method).length > 1 };
        return Response.json(createResponse ? createResponse(receipt) : receipt);
      }
      if (url.pathname === "/api/conversations/chat/turns" && method === "POST") {
        const admission = conversationTurnSchema.parse(JSON.parse(body ?? "null"));
        const accepted = turn(admission.expectedRevision + 1, admission.text);
        current = { ...current, conversation: { ...current.conversation, revision: accepted.number }, lastTurn: accepted };
        return Response.json({ conversation: current.conversation, turn: accepted, replayed: false });
      }
      if (url.pathname === "/api/conversations/chat" && method === "GET") return Response.json({ ...current, capabilities: wireCapabilities() });
      if (url.pathname === "/api/conversations/chat/turns" && method === "GET") return Response.json({ conversation: current.conversation, turns: current.lastTurn ? [current.lastTurn] : [], nextCursor: null });
      if (url.pathname === "/api/conversations/chat/queue" && method === "GET") return Response.json({ conversationId: "chat", queueRevision: 0, paused: false, currentTurn: null, items: [], nextCursor: null, blocked: null });
      throw Error(`Unexpected compatibility request: ${method} ${url.pathname}`);
    });
    const projection = new ConversationProjection(new FlowClient({ baseUrl: "http://compatibility.fixture", token: "public-fixture-token" }), id, 100_000);
    projections.push(projection);
    return { projection, requests, setLive(value: unknown) { live = value; }, setCurrent(value: ConversationSnapshot) { current = value; },
      setCreateResponse(value: typeof createResponse) { createResponse = value; } };
  }

  function expectNoNewConsumer(requests: ReturnType<typeof wire>["requests"]) {
    expect(requests.every(request => request.optIn === null)).toBe(true);
    expect(requests.some(request => /assistant-stream|details|native-activit/.test(request.path))).toBe(false);
  }

  for (const queue of [false, true]) {
    it.each([undefined, false, true])(`reads live=%s with queue=${queue} without enabling a stream consumer`, async live => {
      const { projection, requests } = wire(live, queue); await projection.refresh();
      if (queue) await projection.queue.refresh();
      expect(projection.getSnapshot()).toMatchObject({ error: null, connection: "live", snapshot: { capabilities: { liveAssistantText: live ?? false, queue } } });
      expect(projection.queue.getSnapshot().available).toBe(queue);
      expect(requests.filter(request => request.path.endsWith("/queue")).length > 0).toBe(queue);
      expect(projection.getSnapshot().outbox).toBeNull(); expect(requests.every(request => request.method === "GET")).toBe(true);
      expectNoNewConsumer(requests);
    });
    it.each([undefined, false, true])(`accepts CREATE live=%s with queue=${queue}, then submits one ordinary turn`, async live => {
      const { projection, requests } = wire(live, queue, null);
      expect(await projection.send("hello")).toBe("chat");
      expect(projection.getSnapshot()).toMatchObject({ outbox: null, snapshot: { capabilities: { liveAssistantText: live ?? false, queue }, conversation: { revision: 1 } } });
      expect(requests.filter(request => request.method === "POST").map(request => request.path)).toEqual(["/api/conversations", "/api/conversations/chat/turns"]);
      const sent = requests.find(request => request.path.endsWith("/turns") && request.method === "POST")!;
      expect(JSON.parse(sent.body!)).toEqual({ expectedRevision: 0, text: "hello", mode: "follow-up" });
      expectNoNewConsumer(requests);
    });
  }

  it.each([null, "true", 1, {}])("rejects malformed GET live=%j without replacing known facts", async bad => {
    const { projection, requests, setLive } = wire(false); await projection.refresh();
    const known = projection.getSnapshot().snapshot; setLive(bad); await projection.refresh();
    expect(projection.getSnapshot().snapshot).toBe(known); expect(projection.getSnapshot().error).toContain("capabilities are not supported");
    expect(projection.getSnapshot().connection).toBe("reconnecting"); expectNoNewConsumer(requests);
  });

  it.each([null, "true", 1, {}])("keeps malformed CREATE live=%j unknown and retries the frozen receipt", async bad => {
    const { projection, requests, setLive } = wire(bad, false, null);
    await projection.send("hello"); const pending = projection.getSnapshot().outbox;
    expect(pending?.state).toBe("unknown"); expect(projection.getSnapshot().snapshot).toBeNull();
    expect(requests.filter(request => request.method === "POST")).toHaveLength(1);
    setLive(true); expect(await projection.retry()).toBe("chat");
    const creates = requests.filter(request => request.path === "/api/conversations");
    expect(creates).toHaveLength(2); expect(creates[1]?.body).toBe(creates[0]?.body); expect(creates[1]?.key).toBe(pending?.creationKey);
    expect(projection.getSnapshot().outbox).toBeNull(); expectNoNewConsumer(requests);
  });

  it("does not let true bypass GET conversation, turn or task identities", async () => {
    const { projection, requests, setCurrent } = wire(true); await projection.refresh(); const known = projection.getSnapshot().snapshot;
    const valid = { ...snapshot(reply(turn())), capabilities: { ...capabilities, liveAssistantText: true } } satisfies ConversationSnapshot;
    const wrong = [
      { ...valid, conversation: { ...valid.conversation, id: "other" } },
      { ...valid, lastTurn: { ...valid.lastTurn!, conversationId: "other" } },
      { ...valid, lastTurn: { ...valid.lastTurn!, telemetry: { kind: "execution", taskId: "other", title: "Execution" } } } satisfies ConversationSnapshot,
    ];
    for (const value of wrong) { setCurrent(value); await projection.refresh(); expect(projection.getSnapshot().snapshot).toBe(known); expect(projection.getSnapshot().error).not.toBeNull(); }
    expectNoNewConsumer(requests);
  });

  it.each(["project", "profile"])("does not let true bypass a mismatched %s CREATE identity", async field => {
    const { projection, requests, setCreateResponse } = wire(true, false, null);
    const creation = { ...configuredCreation, projectId: "project-a" } satisfies ConversationCreation;
    setCreateResponse(() => ({ conversation: { ...snapshot().conversation, ...creation,
      ...(field === "project" ? { projectId: "project-b" } : { executionProfile: { ...pin, configDigest: "b".repeat(64) } }) }, capabilities: { ...capabilities, liveAssistantText: true }, replayed: false }));
    await projection.send("hi", creation);
    expect(projection.getSnapshot().outbox).toMatchObject({ state: "unknown", conversationId: null, creation });
    expect(requests.filter(request => request.method === "POST")).toHaveLength(1); expectNoNewConsumer(requests);
    setCreateResponse(undefined); expect(await projection.retry()).toBe("chat");
    const creates = requests.filter(request => request.path === "/api/conversations");
    expect(creates[1]?.key).toBe(creates[0]?.key); expect(creates[1]?.body).toBe(creates[0]?.body);
  });
});
