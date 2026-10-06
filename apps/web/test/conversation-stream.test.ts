import { describe, expect, it } from "vitest";
import type { AssistantStreamPatch, AssistantStreamReference, AssistantStreamPage, AssistantStreamSettlement, ConversationTurn } from "@flow/contracts";
import { applyPatchPage, emptyPatchState, readStreamMetadata, textDigest, utf8Bytes, validateMetadataPartition } from "../src/conversation-stream/patches";
import { readCanonicalFinal, streamConversationMessages, streamMessageId } from "../src/conversation-stream/messages";
import type { StreamState } from "../src/conversation-stream/projection";

const at = "2026-10-06T07:00:00Z";
const task = { id: "task", title: "Chat", harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at } as const;
const turn: ConversationTurn = { id: "turn", conversationId: "chat", number: 1, createdAt: at, user: { role: "user", text: "Hi" }, task,
  assistant: { state: "pending", reason: "execution-pending" }, effective: { model: null, thinking: "unknown", tools: null, source: null }, telemetry: { kind: "execution", taskId: "task", title: "Execution" } };
async function patch(text = "Hello", changes: Partial<AssistantStreamPatch> = {}, prefix = text): Promise<AssistantStreamPatch> {
  return { type: "assistant-stream", streamId: await textDigest(JSON.stringify(["session", "message", 0])), nativeSessionId: "session", nativeMessageId: "message", parentToolUseId: null,
    source: "claude.sdk.stream", sourceMessageId: "source-1", blockIndex: 0, revision: 1, fromBytes: 0, text, prefixDigest: await textDigest(prefix), phase: "streaming", reason: null,
    truncated: false, taskId: "task", attemptId: "attempt", eventId: "event-1", sequence: 1, createdAt: at, ...changes };
}
function reference(value: AssistantStreamPatch): AssistantStreamReference {
  const { type: _type, text, fromBytes, taskId, attemptId, eventId: _eventId, sequence, createdAt, ...header } = value;
  return { ...header, id: value.streamId, taskId, attemptId, firstSequence: 1, lastSequence: sequence, bytes: fromBytes + utf8Bytes(text), createdAt, updatedAt: createdAt, status: value.phase };
}
const page = (patches: AssistantStreamPatch[], after = 0, hasMore = false) => ({ taskId: "task", attemptId: "attempt", patches, nextCursor: patches.at(-1)?.sequence ?? after, hasMore });
const metadata = (blocks: AssistantStreamReference[], change: Partial<AssistantStreamPage> = {}): AssistantStreamPage => ({ taskId: "task", attemptId: "attempt", taskStatus: "running", taskUpdatedAt: at, blocks, nextCursor: null, finalMessageId: null, settlement: null, ...change });
async function complete() {
  const first = await patch("古😀"); const final = await patch("", { revision: 2, fromBytes: 7, sequence: 9, eventId: "event-2", sourceMessageId: "source-2", phase: "block-complete" }, "古😀");
  return { first, final, ref: reference(final) };
}
function state(meta: AssistantStreamPage, patches: StreamState["patches"], final: StreamState["final"] = null): StreamState {
  return { scope: { connectionId: "center-a", viewId: "view", conversationId: "chat", turnId: "turn", taskId: "task" }, enabled: true, visible: true, online: true,
    loading: false, stale: false, metadata: meta, patches, final, hasMore: false, error: null, retryAt: null };
}
async function finalTurn(text = "Canonical answer"): Promise<ConversationTurn> {
  return { ...turn, task: { ...task, status: "succeeded" }, assistant: { state: "available", role: "assistant", messageId: "final", text, truncated: false,
    contentRef: { kind: "detail", id: "final-detail", title: "Answer", taskId: "task", attemptId: "attempt" },
    source: { kind: "assistant-final", source: "claude.sdk.result", taskId: "task", attemptId: "attempt", nativeSessionId: "session", messageId: "final",
      eventId: "final-event", sourceMessageId: "final-source", contentDigest: await textDigest(text), detailId: "final-detail" } } };
}
const settlement = (ids: string[], change: Partial<AssistantStreamSettlement> = {}): AssistantStreamSettlement => ({ policy: "flow.assistant-draft", policyVersion: "1", correlation: "presentation-policy", unavailableReason: null,
  taskId: "task", attemptId: "attempt", nativeSessionId: "session", finalMessageId: "final", replaceStreamIds: ids, retainStreamIds: [], ...change });

describe("immutable assistant patches", () => {
  it("applies jumping sequence and UTF-8 bytes, preserves changing SDK source IDs, and applies empty terminal patches", async () => {
    const { first, final, ref } = await complete();
    const result = await applyPatchPage(emptyPatchState("task", "attempt"), page([first, final]), 0, [ref]);
    expect(result.state).toMatchObject({ cursor: 9, totalBytes: 7 });
    expect(result.state.blocks[0]).toMatchObject({ content: "古😀", revision: 2, phase: "block-complete", sourceMessageId: "source-2", eventId: "event-2" });
  });
  it("deduplicates exact sealed replay and rejects changed replay without mutation", async () => {
    const first = await patch(); const ref = reference(first), wire = page([first]);
    const { state: once } = await applyPatchPage(emptyPatchState("task", "attempt"), wire, 0, [ref]);
    const replay = await applyPatchPage(once, wire, 0, [ref]); expect(replay.state.blocks).toEqual(once.blocks); expect(replay.state.totalBytes).toBe(5);
    await expect(applyPatchPage(once, page([{ ...first, sourceMessageId: "changed" }]), 0, [ref])).rejects.toThrow("changed");
    expect(once.blocks[0]?.content).toBe("Hello");
  });
  it.each(["task", "attempt", "session", "source", "stream", "revision", "offset", "digest"])("rejects changed %s identity/integrity", async field => {
    const first = await patch(); const ref = reference(first); const bad: Record<string, unknown> = { ...first };
    const mutations: Record<string, unknown> = { task: "other", attempt: "other", session: "other", source: "other", stream: "0".repeat(64), revision: 2, offset: 1, digest: "0".repeat(64) };
    const keys: Record<string, string> = { task: "taskId", attempt: "attemptId", session: "nativeSessionId", source: "source", stream: "streamId", revision: "revision", offset: "fromBytes", digest: "prefixDigest" };
    bad[keys[field]!] = mutations[field];
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), { ...page([]), patches: [bad], nextCursor: 1 }, 0, [ref])).rejects.toThrow();
  });
  it("rejects a bad later patch atomically without publishing the valid prefix", async () => {
    const { first, final, ref } = await complete(); const initial = emptyPatchState("task", "attempt");
    await expect(applyPatchPage(initial, page([first, { ...final, prefixDigest: "0".repeat(64) }]), 0, [ref])).rejects.toThrow("digest");
    expect(initial.blocks).toEqual([]); expect(initial.cursor).toBe(0);
  });
  it.each(["中".repeat(2731), "\ud800", "\0", ""])("rejects oversized/invalid Unicode/NUL/empty open patch", async text => {
    const p = await patch(text); await expect(applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [reference(p)])).rejects.toThrow();
  });
  it("accepts the exact 8 KiB UTF-8 boundary and rejects a forged first sequence", async () => {
    const p = await patch("😀".repeat(2048)); const ref = reference(p);
    expect((await applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [ref])).state.totalBytes).toBe(8192);
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [{ ...ref, firstSequence: 2 }])).rejects.toThrow("First patch");
  });
  it("enforces attempt bytes and patch-count budgets", async () => {
    const first = await patch(); const initial = emptyPatchState("task", "attempt");
    await expect(applyPatchPage({ ...initial, totalBytes: 1048576 }, page([first]), 0, [reference(first)])).rejects.toThrow("MiB");
    const receipts = Object.fromEntries(Array.from({ length: 4096 }, (_, index) => [index + 10, "sealed"]));
    await expect(applyPatchPage({ ...initial, receipts }, page([first]), 0, [reference(first)])).rejects.toThrow("budget");
  });
  it("does not reopen closed or superseded blocks", async () => {
    const { first, final, ref } = await complete(); let current = (await applyPatchPage(emptyPatchState("task", "attempt"), page([first, final]), 0, [ref])).state;
    const reopened = await patch("more", { revision: 3, fromBytes: 7, sequence: 12, eventId: "e3" }, "古😀more");
    await expect(applyPatchPage(current, page([reopened]), 9, [ref])).rejects.toThrow("closed");
    const superseded = await patch("", { revision: 3, fromBytes: 7, sequence: 12, eventId: "e3", phase: "superseded", reason: "superseded" }, "古😀");
    current = (await applyPatchPage(current, page([superseded]), 9, [reference(superseded)])).state;
    const undo = { ...superseded, revision: 4, sequence: 14, eventId: "e4", phase: "incomplete", reason: "aborted" } as const;
    await expect(applyPatchPage(current, page([undo]), 12, [reference(undo)])).rejects.toThrow("superseded");
  });
  it.each([
    { patches: [], nextCursor: 0, hasMore: true }, { patches: [], nextCursor: 3, hasMore: false },
  ])("rejects nonadvancing or invented page cursor %j", async wire => {
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), { taskId: "task", attemptId: "attempt", ...wire }, 0, [])).rejects.toThrow("cursor");
  });
  it("bounds patch pages and rejects out-of-order sequences", async () => {
    const p = await patch(); const ref = reference(p);
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), page(Array(9).fill(p)), 0, [ref])).rejects.toThrow("eight");
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), page([p, p]), 0, [ref])).rejects.toThrow("sequence");
  });
});

describe("metadata and explicit final settlement", () => {
  it("marks an actual canonical final complete while the task remains running, including before stream metadata", async () => {
    const p = await patch(), ref = reference(p), patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [ref])).state;
    const t = { ...await finalTurn(), task };
    for (const current of [state(metadata([ref]), patches), state(metadata([]), null)]) {
      const messages = streamConversationMessages(t, current);
      expect(messages.at(-1)?.status).toEqual({ type: "complete", reason: "unknown" });
      expect(t.task.status).toBe("running");
    }
  });
  it("rejects metadata/patch disagreement at the same sealed revision", async () => {
    const p = await patch(); const ref = { ...reference(p), prefixDigest: "0".repeat(64) };
    await expect(applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [ref])).rejects.toThrow("metadata");
  });
  it("never overwrites a newly authoritative final with a same-ID stale digest result", async () => {
    const { first, final, ref } = await complete(); const patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([first, final]), 0, [ref])).state;
    const original = await finalTurn("Original final"), latest = await finalTurn("Correct final");
    const result = streamConversationMessages(latest, state(metadata([ref]), patches, await readCanonicalFinal(original)));
    expect(result.at(-1)?.content).toEqual([{ type: "text", text: "Correct final" }]);
  });
  it("does not mix a final from an older attempt with current-attempt stream body", async () => {
    const p = await patch(), ref = reference(p), patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [ref])).state;
    const t = await finalTurn(); if (t.assistant.state !== "available") throw Error("fixture");
    const old = { ...t, assistant: { ...t.assistant, source: { ...t.assistant.source, attemptId: "old" } } };
    expect(streamConversationMessages(old, state(metadata([ref]), patches)).some(message => message.id === "final")).toBe(false);
  });

  it("validates current metadata identity, ordering and complete settlement partitions", async () => {
    const { ref } = await complete(); const parsed = await readStreamMetadata(metadata([ref], { finalMessageId: "final", settlement: settlement([ref.id]) }), "task");
    expect(() => validateMetadataPartition(parsed)).not.toThrow();
    await expect(readStreamMetadata({ ...parsed, taskId: "other" }, "task")).rejects.toThrow("task");
    await expect(readStreamMetadata({ ...parsed, blocks: [ref, ref] }, "task")).rejects.toThrow("ordered");
    expect(() => validateMetadataPartition({ ...parsed, settlement: settlement([]) })).toThrow("exactly");
    await expect(readStreamMetadata({ ...parsed, settlement: settlement([ref.id], { retainStreamIds: [ref.id] }) }, "task")).rejects.toThrow("replacement");
  });
  it("does not accept presentation-policy replacement for incomplete or superseded blocks", async () => {
    const { ref } = await complete();
    for (const phase of ["incomplete", "superseded"] as const) {
      expect(() => validateMetadataPartition(metadata([{ ...ref, phase }], { finalMessageId: "final", settlement: settlement([ref.id]) }))).toThrow("history");
    }
  });
  it("replaces only an explicitly settled draft once full canonical text is verified", async () => {
    const { first, final, ref } = await complete(); const patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([first, final]), 0, [ref])).state;
    const t = await finalTurn(); const meta = metadata([ref], { finalMessageId: "final", settlement: settlement([ref.id]) });
    const pending = state(meta, patches);
    expect(streamConversationMessages(t, pending).map(x => x.id)).toEqual(["conversation-user:turn", streamMessageId("turn", patches.blocks[0]!), "final"]);
    pending.final = await readCanonicalFinal(t);
    expect(streamConversationMessages(t, pending).map(x => x.id)).toEqual(["conversation-user:turn", "final"]);
    expect(streamConversationMessages(t, pending).at(-1)?.content).toEqual([{ type: "text", text: "Canonical answer" }]);
    expect(patches.blocks).toHaveLength(1);
  });
  it("keeps retained tool-introduction and unavailable drafts beside the independent final", async () => {
    const { first, final, ref } = await complete(); const patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([first, final]), 0, [ref])).state;
    const t = await finalTurn(); const finalText = await readCanonicalFinal(t);
    for (const policy of [settlement([], { retainStreamIds: [ref.id] }), settlement([], { retainStreamIds: [ref.id], correlation: "unavailable", unavailableReason: "missing-tool-evidence" })]) {
      const messages = streamConversationMessages(t, state(metadata([ref], { finalMessageId: "final", settlement: policy }), patches, finalText));
      expect(messages.map(x => x.id)).toEqual(["conversation-user:turn", streamMessageId("turn", patches.blocks[0]!), "final"]);
    }
  });
  it("does not replace when final arrives before all patches or belongs to another attempt", async () => {
    const { first, ref } = await complete(); const patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([first]), 0, [ref])).state;
    const t = await finalTurn(), final = await readCanonicalFinal(t), meta = metadata([ref], { finalMessageId: "final", settlement: settlement([ref.id]) });
    expect(streamConversationMessages(t, state(meta, patches, final))).toHaveLength(3);
    expect(streamConversationMessages(t, state(meta, patches, final && { ...final, attemptId: "old" }))).toHaveLength(3);
  });
  it("does not guess truncated final text or accept wrong final digest", async () => {
    const t = await finalTurn(); if (t.assistant.state !== "available") throw Error("fixture");
    const preview = { ...t, assistant: { ...t.assistant, text: "Canonical", truncated: true } };
    expect(await readCanonicalFinal(preview)).toBeNull();
    expect((await readCanonicalFinal(preview, "Canonical answer"))?.text).toBe("Canonical answer");
    await expect(readCanonicalFinal(preview, "wrong")).rejects.toThrow("source");
  });
  it("keeps failed/cancelled drafts interrupted and offline drafts paused, without fake task success", async () => {
    const p = await patch(), ref = reference(p), patches = (await applyPatchPage(emptyPatchState("task", "attempt"), page([p]), 0, [ref])).state;
    for (const status of ["failed", "cancelled", "uncertain"] as const) expect(streamConversationMessages({ ...turn, task: { ...task, status } }, state(metadata([ref]), patches))[1]?.status).toEqual({ type: "incomplete", reason: "other" });
    expect(streamConversationMessages(turn, state(metadata([{ ...ref, status: "interrupted" }]), patches))[1]?.status).toEqual({ type: "incomplete", reason: "other" });
    expect(streamConversationMessages(turn, { ...state(metadata([ref]), patches), online: false })[1]?.metadata?.custom).toMatchObject({ flowStream: { observationPaused: true, canonical: false } });
  });
});
