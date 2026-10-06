import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowClient } from "@flow/client";
import type { AssistantStreamPatch, AssistantStreamReference, AssistantStreamPage, AssistantStreamPatchPage, ConversationTurn } from "@flow/contracts";
import { createConversationStreamProjection, type StreamHost, type StreamPort } from "../src/conversation-stream/projection";
import { textDigest, utf8Bytes } from "../src/conversation-stream/patches";
import { streamConversationMessages } from "../src/conversation-stream/messages";

const at = "2026-10-06T07:00:00Z";
const task = { id: "task", title: "Chat", harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at } as const;
const turn: ConversationTurn = { id: "turn", conversationId: "chat", number: 1, createdAt: at, user: { role: "user", text: "Hi" }, task,
  assistant: { state: "pending", reason: "execution-pending" }, effective: { model: null, thinking: "unknown", tools: null, source: null }, telemetry: { kind: "execution", taskId: "task", title: "Execution" } };
const scope = { connectionId: "center", viewId: "view", conversationId: "chat", turnId: "turn", taskId: "task" };
const host: StreamHost = { turn, capability: true, protocol: "patch-v1", visible: true, online: true };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
async function fixture(text = "Hello", attemptId = "attempt", nativeMessageId = "message", sequence = 1) {
  const patch: AssistantStreamPatch = { type: "assistant-stream", streamId: await textDigest(JSON.stringify(["session", nativeMessageId, 0])), nativeSessionId: "session", nativeMessageId,
    parentToolUseId: null, source: "claude.sdk.stream", sourceMessageId: "source", blockIndex: 0, revision: 1, fromBytes: 0, text, prefixDigest: await textDigest(text), phase: "streaming", reason: null,
    truncated: false, taskId: "task", attemptId, eventId: `event-${sequence}`, sequence, createdAt: at };
  const { type: _type, fromBytes: _fromBytes, text: _text, eventId: _eventId, sequence: _sequence, createdAt: _createdAt, taskId: _taskId, attemptId: _attemptId, ...header } = patch;
  const ref: AssistantStreamReference = { ...header, id: patch.streamId, taskId: "task", attemptId, firstSequence: sequence, lastSequence: sequence, bytes: utf8Bytes(text), createdAt: at, updatedAt: at, status: "streaming" };
  const meta: AssistantStreamPage = { taskId: "task", attemptId, taskStatus: "running", taskUpdatedAt: at, blocks: [ref], nextCursor: null, finalMessageId: null, settlement: null };
  const page: AssistantStreamPatchPage = { taskId: "task", attemptId, patches: [patch], nextCursor: sequence, hasMore: false };
  return { patch, ref, meta, page };
}
const modules: ReturnType<typeof createConversationStreamProjection>[] = [];
afterEach(() => { modules.splice(0).forEach(module => module.dispose()); vi.restoreAllMocks(); vi.useRealTimers(); });
async function setup() {
  const f = await fixture();
  const port = { readMetadata: vi.fn<StreamPort["readMetadata"]>(async () => f.meta), readPatches: vi.fn<StreamPort["readPatches"]>(async options => options.after === 0 ? f.page : { ...f.page, patches: [], nextCursor: options.after }) };
  const projection = createConversationStreamProjection(scope, port); modules.push(projection); return { ...f, port, projection };
}
async function start(value: Awaited<ReturnType<typeof setup>>, initial = host) { value.projection.updateHost(initial); await value.projection.refresh(); }

describe("bound stream projection", () => {
  it.each([{ capability: false }, { capability: undefined }, { protocol: undefined }, { visible: false }, { online: false }])("does not read without eligibility %j", async change => {
    const value = await setup(); await start(value, { ...host, ...change }); value.projection.invalidate(); await value.projection.refresh();
    expect(value.port.readMetadata).not.toHaveBeenCalled(); expect(value.port.readPatches).not.toHaveBeenCalled();
  });
  it("does not dispatch a stale reader when a loading subscriber hides then restores the view", async () => {
    const value = await setup(); let switched = false;
    value.projection.subscribe(() => { if (value.projection.getSnapshot().loading && !switched) { switched = true; value.projection.updateHost({ ...host, visible: false }); value.projection.updateHost(host); } });
    await start(value); expect(value.port.readMetadata).toHaveBeenCalledTimes(1); expect(value.port.readPatches).toHaveBeenCalledTimes(1);
    expect(value.projection.getSnapshot()).toMatchObject({ loading: false, error: null });
  });
  it("serializes refresh, accumulates body, and resumes from the applied cursor", async () => {
    const value = await setup(); value.projection.updateHost(host); await Promise.all([value.projection.refresh(), value.projection.refresh()]);
    expect(value.port.readMetadata).toHaveBeenCalledTimes(1); expect(value.port.readPatches).toHaveBeenCalledTimes(1);
    expect(value.projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello"); await value.projection.refresh();
    expect(value.port.readPatches.mock.calls.map(([options]) => options.after)).toEqual([0, 1]);
  });
  it("refreshes metadata once when a block appears after the first metadata snapshot", async () => {
    const value = await setup(); value.port.readMetadata.mockResolvedValueOnce({ ...value.meta, blocks: [] });
    await start(value); expect(value.port.readMetadata).toHaveBeenCalledTimes(2);
    expect(value.projection.getSnapshot()).toMatchObject({ error: null }); expect(value.projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello");
  });
  it("shows a later patch revision even when the metadata revision is older", async () => {
    const value = await setup(); const second = { ...value.patch, sequence: 4, eventId: "e4", sourceMessageId: "source-4", revision: 2, fromBytes: 5, text: "!", prefixDigest: await textDigest("Hello!") };
    value.port.readPatches.mockResolvedValueOnce({ ...value.page, patches: [value.patch, second], nextCursor: 4 });
    await start(value); expect(value.projection.getSnapshot().patches?.blocks[0]).toMatchObject({ content: "Hello!", revision: 2 });
  });
  it("suppresses hidden/disposed responses and resumes the same attempt from the saved cursor", async () => {
    const value = await setup(); await start(value); const delayed = deferred<AssistantStreamPatchPage>(); value.port.readPatches.mockReturnValueOnce(delayed.promise);
    const reading = value.projection.refresh(); await vi.waitFor(() => expect(value.port.readPatches).toHaveBeenCalledTimes(2));
    value.projection.updateHost({ ...host, visible: false }); const signal = value.port.readPatches.mock.calls[1]![1]; expect(signal.aborted).toBe(true);
    delayed.resolve({ ...value.page, patches: [], nextCursor: 1 }); await reading;
    expect(value.projection.getSnapshot().patches?.cursor).toBe(1); expect(value.projection.getSnapshot().loading).toBe(false);
    await start(value); expect(value.port.readPatches.mock.calls.at(-1)?.[0].after).toBe(1);
    const fresh = await setup(); const old = deferred<AssistantStreamPage>(); value.port.readMetadata.mockReturnValueOnce(old.promise);
    const oldRead = value.projection.refresh(); value.projection.dispose(); await start(fresh); old.resolve(value.meta); await oldRead;
    expect(value.projection.getSnapshot().patches).toBeNull(); expect(fresh.projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello");
  });
  it("checks lifetime again after an in-flight crypto digest", async () => {
    const value = await setup(), reached = deferred<void>(), release = deferred<void>(); const original = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
      if (new TextDecoder().decode(data) === "Hello") { reached.resolve(); await release.promise; }
      return original(algorithm, data);
    });
    value.projection.updateHost(host); const reading = value.projection.refresh(); await reached.promise;
    value.projection.updateHost({ ...host, online: false }); release.resolve(); await reading;
    expect(value.projection.getSnapshot().patches?.blocks).toEqual([]); expect(value.projection.getSnapshot().loading).toBe(false);
  });
  it("clears old-attempt body before consuming a new current attempt", async () => {
    const value = await setup(); await start(value); const next = await fixture("New attempt", "attempt-2", "message-2");
    value.port.readMetadata.mockResolvedValueOnce(next.meta); value.port.readPatches.mockResolvedValueOnce(next.page);
    await value.projection.refresh(); expect(value.projection.getSnapshot().patches).toMatchObject({ attemptId: "attempt-2", cursor: 1 });
    expect(value.projection.getSnapshot().patches?.blocks.map(block => block.content)).toEqual(["New attempt"]);
    expect(value.port.readPatches.mock.calls.at(-1)?.[0]).toMatchObject({ attemptId: "attempt-2", after: 0 });
  });

  it("collects metadata pages before applying bodies and rejects repeated cursors", async () => {
    const value = await setup(), second = await fixture("Second", "attempt", "message-2", 5);
    value.port.readMetadata.mockResolvedValueOnce({ ...value.meta, nextCursor: value.ref.id }).mockResolvedValueOnce(second.meta);
    value.port.readPatches.mockResolvedValueOnce({ ...value.page, patches: [value.patch, second.patch], nextCursor: 5 });
    await start(value); expect(value.port.readMetadata.mock.calls.map(([options]) => options.after)).toEqual([undefined, value.ref.id]);
    expect(value.projection.getSnapshot().patches?.blocks.map(block => block.content)).toEqual(["Hello", "Second"]);
    value.port.readMetadata.mockResolvedValue({ ...value.meta, nextCursor: value.ref.id }); await value.projection.refresh();
    expect(value.projection.getSnapshot().error).toContain("overlaps"); expect(value.port.readPatches).toHaveBeenCalledTimes(1);
  });
  it("rejects metadata pagination crossing attempts and preserves the previous verified body", async () => {
    const value = await setup(); await start(value); const next = await fixture("Other", "attempt-2", "message-2", 5);
    value.port.readMetadata.mockResolvedValueOnce({ ...value.meta, nextCursor: value.ref.id }).mockResolvedValueOnce(next.meta);
    await value.projection.refresh(); expect(value.projection.getSnapshot().error).toContain("changed");
    expect(value.projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello"); expect(value.port.readPatches).toHaveBeenCalledTimes(1);
  });
  it("reports missing patch history instead of treating incomplete body as caught up", async () => {
    const value = await setup(); value.port.readPatches.mockResolvedValueOnce({ ...value.page, patches: [], nextCursor: 0 });
    await start(value); expect(value.projection.getSnapshot()).toMatchObject({ stale: true });
    expect(value.projection.getSnapshot().error).toContain("not reached"); expect(value.projection.getSnapshot().patches?.blocks).toEqual([]);
  });
  it("does not read patches for wrong-task metadata or a malformed partition", async () => {
    const value = await setup(); value.port.readMetadata.mockResolvedValueOnce({ ...value.meta, taskId: "other" }); await start(value);
    expect(value.port.readPatches).not.toHaveBeenCalled(); expect(value.projection.getSnapshot().error).toContain("task");
    expect(() => value.projection.updateHost({ ...host, turn: { ...turn, id: "wrong" } })).toThrow("turn");
  });
  it("treats timeout as an error and preserves body, rather than silently staying loading", async () => {
    const value = await setup(); await start(value); value.port.readMetadata.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await value.projection.refresh(); expect(value.projection.getSnapshot()).toMatchObject({ loading: false, stale: true, error: "Timed out" });
    expect(value.projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello");
  });
  it("bounds repeated failures and requires explicit retry after the error budget", async () => {
    vi.useFakeTimers(); const value = await setup(); value.port.readMetadata.mockRejectedValue(Error("Offline")); await start(value);
    value.projection.invalidate(); await vi.advanceTimersByTimeAsync(500); value.projection.invalidate(); await vi.advanceTimersByTimeAsync(1000);
    value.projection.invalidate(); await vi.advanceTimersByTimeAsync(10_000); expect(value.port.readMetadata).toHaveBeenCalledTimes(3);
    await value.projection.refresh(); expect(value.port.readMetadata).toHaveBeenCalledTimes(4);
  });
  it("does not reset the failure budget after a valid prefix followed by missing patch history", async () => {
    vi.useFakeTimers(); const value = await setup();
    value.port.readPatches.mockResolvedValue({ ...value.page, patches: [], nextCursor: 0 }); await start(value);
    for (let attempt = 0; attempt < 4; attempt++) {
      value.projection.invalidate(); await vi.advanceTimersByTimeAsync(8000);
      await vi.waitFor(() => expect(value.projection.getSnapshot().loading).toBe(false));
    }
    expect(value.port.readPatches).toHaveBeenCalledTimes(3);
    expect(value.projection.getSnapshot().error).toContain("not reached");
  });
  it("drains at most four patch pages per flight and yields before continuing", async () => {
    vi.useFakeTimers(); const value = await setup(); const fixtures = await Promise.all(Array.from({ length: 5 }, (_, index) => fixture(`Block ${index}`, "attempt", `message-${index}`, index * 3 + 1)));
    value.port.readMetadata.mockResolvedValue({ ...value.meta, blocks: fixtures.map(f => f.ref) });
    value.port.readPatches.mockImplementation(async options => {
      const next = fixtures.find(f => f.patch.sequence > options.after); return next ? { ...next.page, hasMore: next !== fixtures.at(-1) } : { ...value.page, patches: [], nextCursor: options.after };
    });
    await start(value); expect(value.port.readPatches).toHaveBeenCalledTimes(4); expect(value.projection.getSnapshot().hasMore).toBe(true);
    await vi.advanceTimersByTimeAsync(250); await value.projection.refresh();
    expect(value.projection.getSnapshot().patches?.blocks).toHaveLength(5); expect(value.projection.getSnapshot().hasMore).toBe(false);
  });
  it("waits for final patches and canonical source before replacing the explicit draft partition", async () => {
    const value = await setup(), text = "Final answer", contentDigest = await textDigest(text);
    const t: ConversationTurn = { ...turn, assistant: { state: "available", role: "assistant", messageId: "final", text, truncated: false,
      contentRef: { id: "final-detail", title: "Final", kind: "detail", taskId: "task", attemptId: "attempt" },
      source: { kind: "assistant-final", source: "claude.sdk.result", taskId: "task", attemptId: "attempt", nativeSessionId: "session", messageId: "final", eventId: "final-event", sourceMessageId: "final-source", contentDigest, detailId: "final-detail" } } };
    const terminal = { ...value.patch, revision: 2, fromBytes: 5, text: "", phase: "block-complete", sequence: 9, eventId: "event-9" } as const;
    const ref = { ...value.ref, revision: 2, lastSequence: 9, phase: "block-complete" } as const;
    value.port.readMetadata.mockResolvedValue({ ...value.meta, blocks: [ref], finalMessageId: "final", settlement: { policy: "flow.assistant-draft", policyVersion: "1", correlation: "presentation-policy", unavailableReason: null,
      taskId: "task", attemptId: "attempt", nativeSessionId: "session", finalMessageId: "final", replaceStreamIds: [ref.id], retainStreamIds: [] } });
    const finalPage = deferred<AssistantStreamPatchPage>();
    value.port.readPatches.mockResolvedValueOnce({ ...value.page, hasMore: true }).mockReturnValueOnce(finalPage.promise);
    value.projection.updateHost({ ...host, turn: t }); const reading = value.projection.refresh();
    await vi.waitFor(() => expect(value.projection.getSnapshot().patches?.blocks).toHaveLength(1));
    expect(streamConversationMessages(t, value.projection.getSnapshot())).toHaveLength(3);
    finalPage.resolve({ ...value.page, patches: [terminal], nextCursor: 9 }); await reading;
    expect(streamConversationMessages(t, value.projection.getSnapshot()).map(message => message.id)).toEqual(["conversation-user:turn", "final"]);
  });
  it("binds the public client readers without requesting full block/detail or adding a second fetch layer", async () => {
    const value = await setup(); const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => { const url = String(input); urls.push(url); return new Response(JSON.stringify(url.includes("/patches") ? value.page : value.meta), { headers: { "content-type": "application/json" } }); });
    const client = new FlowClient({ baseUrl: "https://fixture.invalid", token: "public-fixture", assistantStreamProtocol: "patch-v1" });
    const projection = createConversationStreamProjection(scope, { readMetadata: (options, signal) => client.assistantStream(scope.taskId, options, signal), readPatches: (options, signal) => client.assistantStreamPatches(scope.taskId, options, signal) }); modules.push(projection);
    projection.updateHost(host); await projection.refresh(); expect(projection.getSnapshot().patches?.blocks[0]?.content).toBe("Hello");
    expect(urls).toEqual(["https://fixture.invalid/api/tasks/task/assistant-stream?limit=100", "https://fixture.invalid/api/tasks/task/assistant-stream/patches?attemptId=attempt&after=0&limit=8"]);
  });
});
