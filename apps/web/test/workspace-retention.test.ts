import { describe, expect, it } from "vitest";
import { canOpenConversation, retentionReasons } from "../src/workspace-retention";
import { ReadCache, bodyBytes } from "../src/conversations/read-cache";

describe("conversation retention policy", () => {
  it("counts the initial draft and all open/protected resident views, but always permits reopening", () => {
    expect(canOpenConversation(31, false)).toBe(true);
    expect(canOpenConversation(32, false)).toBe(false);
    expect(canOpenConversation(32, true)).toBe(true);
  });
  it("does not trim an unsent draft or discard any undismissed receipt", () => {
    expect(retentionReasons({ text: " ", unsubmittedProfile: false, hasOutbox: false, queueReceipts: 0, host: [] })).toEqual(["Unsent draft"]);
    expect(retentionReasons({ text: "", unsubmittedProfile: true, hasOutbox: true, queueReceipts: 2, host: ["Selected knowledge", "Attachment preparation"] })).toEqual(["Execution selection", "Message receipt", "Queue receipts", "Selected knowledge", "Attachment preparation"]);
  });
  it("allows a committed profile to be reconstructed and protects a pending submission even after selection removal", () => {
    const facts = { text: "", unsubmittedProfile: false, hasOutbox: false, queueReceipts: 0, host: [] };
    expect(retentionReasons(facts)).toEqual([]);
    expect(retentionReasons({ ...facts, pendingSubmission: true })).toEqual(["Message preparation"]);
  });
});

describe("projection read cache limits", () => {
  const limits = { entries: 2, bytes: 8 };
  const text = (value: { content?: string; loading?: boolean; error?: string }) => value.content;
  it("bounds every record, including loading/errors, and evicts by read recency", () => {
    const cache = new ReadCache(text, limits);
    let state = cache.put("a", { content: "1234" });
    state = cache.put("b", { content: "5678" });
    state = cache.touch("a");
    state = cache.put("c", { loading: true });
    expect(Object.keys(state)).toEqual(["a", "c"]);
    state = cache.put("d", { error: "failed" });
    expect(Object.keys(state)).toEqual(["c", "d"]);
  });
  it("counts actual UTF8 bytes without truncating and keeps the newly requested legal body", () => {
    const cache = new ReadCache(text, limits);
    const first = cache.put("a", { content: "你你" });
    expect(Object.keys(cache.put("b", { content: "你" }))).toEqual(["b"]);
    expect(() => cache.put("bad", { content: "你你你" })).toThrow("limit");
    expect(first.a?.content).toBe("你你");
  });
  it("uses true recency even for numeric-looking opaque IDs", () => {
    const cache = new ReadCache(text, limits); cache.put("9", { content: "a" }); cache.put("1", { content: "b" }); cache.touch("9");
    expect(cache.put("2", { content: "c" })).toEqual({ "9": { content: "a" }, "2": { content: "c" } });
  });
  it("rejects malformed body values before encoding", () => {
    expect(() => bodyBytes(12, 8)).toThrow("text");
    expect(bodyBytes("💬", 4)).toBe(4);
    expect(() => bodyBytes("💬", 3)).toThrow("limit");
  });
});
