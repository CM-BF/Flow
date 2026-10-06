import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_DETAIL_BYTES, type Detail, type EventPage, type TaskSummary, type TimelineEntry } from "@flow/contracts";
import { createConversationActivity, type ActivityPort } from "../src/conversation-activity/projection";

const at = "2026-10-06T06:00:00Z";
const task: TaskSummary = { id: "task", title: "A task", harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at };
const scope = { connectionId: "connection-a", viewId: "view", conversationId: "chat", turnId: "turn", taskId: "task" };
const entry = (cursor: number): Extract<TimelineEntry, { kind: "reference" }> => ({ id: `event-${cursor}`, cursor, createdAt: at, kind: "reference", reference: { id: `detail-${cursor}`, title: `Reference ${cursor}` } });
const page = (entries: TimelineEntry[] = [entry(1)], patch: Partial<EventPage> = {}): EventPage => ({ task, entries, nextCursor: entries.at(-1)?.cursor ?? 0, watermark: entries.at(-1)?.cursor ?? 0, hasMore: false, pendingDecision: null, usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true }, ...patch });
const detail = (id = "detail-1"): Detail => ({ id, title: "Detail", kind: "detail", mediaType: "text/plain", content: "Returned detail" });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const modules: ReturnType<typeof createConversationActivity>[] = [];
afterEach(() => { modules.splice(0).forEach(module => module.dispose()); });
function setup() {
  const port = { readEvents: vi.fn<ActivityPort["readEvents"]>(async () => page()), readDetail: vi.fn<ActivityPort["readDetail"]>(async id => detail(id)) };
  const projection = createConversationActivity(scope, task, port); modules.push(projection); return { port, projection };
}
async function open(value: ReturnType<typeof setup>) { value.projection.setActive(true); await value.projection.refresh(); }

describe("host-bound lazy conversation activity", () => {
  it("does not start a reader after its loading subscriber already hid the view", async () => {
    const value = setup(); value.projection.subscribe(() => { if (value.projection.getSnapshot().loading) value.projection.setActive(false); });
    await open(value); expect(value.port.readEvents).not.toHaveBeenCalled();
  });
  it("consumes a reader rejection that arrives after synchronous lifetime invalidation", async () => {
    const value = setup(); value.port.readEvents.mockImplementationOnce(() => { value.projection.setActive(false); return Promise.reject(Error("Late rejection")); });
    await open(value); await new Promise(resolve => setTimeout(resolve, 0));
    expect(value.projection.getSnapshot().error).toBeNull(); expect(value.projection.getSnapshot().loaded).toBe(false);
  });
  it.each([123, "r".repeat(129)])("rejects malformed reference identity %s", async id => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page([{ ...entry(1), reference: { id, title: "Bad" } } as unknown as TimelineEntry]));
    await open(value); expect(value.projection.getSnapshot().loaded).toBe(false); expect(value.projection.getSnapshot().error).toBeTruthy();
  });
  it("rejects a response exceeding the public page bound", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page(Array.from({ length: 101 }, (_, i) => entry(i + 1))));
    await open(value); expect(value.projection.getSnapshot().loaded).toBe(false); expect(value.projection.getSnapshot().error).toBeTruthy();
  });
  it("reset aborts a pending detail and cannot revive it when the new history reuses its reference ID", async () => {
    const value = setup(); await open(value); const pending = deferred<Detail>(); value.port.readDetail.mockReturnValueOnce(pending.promise);
    const loading = value.projection.loadDetail("detail-1"); const signal = value.port.readDetail.mock.calls[0]![1];
    value.port.readEvents.mockResolvedValueOnce(page([], { reset: true })).mockResolvedValueOnce(page());
    await value.projection.refresh(); expect(signal.aborted).toBe(true); pending.resolve({ ...detail(), content: "Old history" }); await loading;
    expect(value.projection.getSnapshot().details).toEqual({}); await value.projection.loadDetail("detail-1");
    expect(value.projection.getSnapshot().details["detail-1"]?.data?.content).toBe("Returned detail");
  });
  it("keeps construction/hidden views at zero reads and deduplicates the first explicit expansion", async () => {
    const value = setup(); await value.projection.refresh(); await value.projection.loadMore();
    expect(value.port.readEvents).not.toHaveBeenCalled(); expect(value.projection.getSnapshot().loaded).toBe(false);
    await open(value); expect(value.port.readEvents).toHaveBeenCalledExactlyOnceWith(0); expect(value.port.readDetail).not.toHaveBeenCalled();
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: true, stale: false, error: null, cursor: 1 });
    expect(value.projection.getSnapshot().loadedAt).toBeTruthy();
  });
  it("loads a known reference once, caches it, and refuses arbitrary IDs", async () => {
    const value = setup(); await open(value);
    await expect(value.projection.loadDetail("outside")).rejects.toThrow("reference"); expect(value.port.readDetail).not.toHaveBeenCalled();
    await Promise.all([value.projection.loadDetail("detail-1"), value.projection.loadDetail("detail-1")]);
    expect(value.port.readDetail).toHaveBeenCalledTimes(1); await value.projection.loadDetail("detail-1"); expect(value.port.readDetail).toHaveBeenCalledTimes(1);
    expect(value.projection.getSnapshot().details["detail-1"]?.data?.content).toBe("Returned detail");
  });
  it("uses host TaskSummary updates and never replaces a newer host with an older events task", async () => {
    const value = setup(); const newer = { ...task, status: "succeeded" as const, updatedAt: "2026-10-06T06:01:00Z" };
    value.projection.updateTask(newer); await open(value);
    expect(value.projection.getSnapshot()).toMatchObject({ task: newer, stale: true });
    expect(value.projection.getSnapshot().task.verificationStatus).toBe("pending");
    expect(() => value.projection.updateTask({ ...newer, id: "other" })).toThrow("task");
  });
  it("rejects a wrong task page without accepting its references", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { task: { ...task, id: "wrong" } })); await open(value);
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: false, entries: [] }); expect(value.projection.getSnapshot().error).toContain("task");
    await expect(value.projection.loadDetail("detail-1")).rejects.toThrow("reference");
  });
  it("paginates explicitly, deduplicates identical overlapping entries, and stops at the watermark", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { watermark: 2, hasMore: true })); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([entry(1), entry(2)])); await value.projection.loadMore();
    expect(value.projection.getSnapshot().entries.map(item => item.id)).toEqual(["event-1", "event-2"]);
    await value.projection.loadMore(); expect(value.port.readEvents.mock.calls.map(call => call[0])).toEqual([0, 1]);
  });
  it.each([{ nextCursor: 0, watermark: 2, hasMore: true }, { nextCursor: 1, watermark: 0 }, { nextCursor: -1 }, { nextCursor: 99 }])("rejects invalid/nonadvancing cursor facts %j without looping", async patch => {
    const value = setup(); value.port.readEvents.mockResolvedValue(page([entry(1)], patch)); await open(value);
    expect(value.projection.getSnapshot().error).toBeTruthy(); expect(value.port.readEvents).toHaveBeenCalledTimes(1);
  });
  it("reset clears old references/details then rebuilds once from zero", async () => {
    const value = setup(); await open(value); await value.projection.loadDetail("detail-1");
    value.port.readEvents.mockResolvedValueOnce(page([], { reset: true, nextCursor: 0, watermark: 0 })).mockResolvedValueOnce(page([{ ...entry(1), id: "new-event", reference: { id: "new-detail", title: "New reference" } }]));
    await value.projection.refresh();
    expect(value.port.readEvents.mock.calls.map(call => call[0])).toEqual([0, 1, 0]); expect(value.projection.getSnapshot().details).toEqual({});
    await expect(value.projection.loadDetail("detail-1")).rejects.toThrow("reference");
    expect(value.projection.getSnapshot().entries[0]?.id).toBe("new-event");
  });
  it("rejects repeated reset at zero instead of looping", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValue(page([], { reset: true })); await open(value);
    expect(value.port.readEvents).toHaveBeenCalledTimes(1); expect(value.projection.getSnapshot().error).toContain("reset");
  });
  it("preserves previous entries after errors, distinguishes unknown from empty, and retries explicitly", async () => {
    const value = setup(); value.port.readEvents.mockRejectedValueOnce(Error("Unauthorized")); await open(value);
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: false, error: "Unauthorized" });
    await value.projection.refresh(); expect(value.projection.getSnapshot().entries).toHaveLength(1);
    value.port.readEvents.mockRejectedValueOnce(Error("Offline")); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: true, stale: true, error: "Offline" }); expect(value.projection.getSnapshot().entries).toHaveLength(1);
  });
  it("hiding suppresses late events and cancels detail signals; reopening never auto-loads details", async () => {
    const value = setup(); await open(value); const pending = deferred<Detail>(); value.port.readDetail.mockReturnValueOnce(pending.promise);
    const loading = value.projection.loadDetail("detail-1"); const signal = value.port.readDetail.mock.calls[0]![1]; value.projection.setActive(false);
    expect(signal.aborted).toBe(true); pending.resolve(detail()); await loading; expect(value.projection.getSnapshot().details["detail-1"]?.data).toBeUndefined();
    const late = deferred<EventPage>(); value.port.readEvents.mockReturnValueOnce(late.promise); value.projection.setActive(true); const reading = value.projection.refresh(); value.projection.setActive(false);
    late.resolve(page([entry(1), entry(2)])); await reading; expect(value.projection.getSnapshot().entries).toHaveLength(1);
    value.port.readEvents.mockResolvedValue(page([], { nextCursor: 1, watermark: 1 })); value.projection.setActive(true); await value.projection.refresh();
    expect(value.port.readDetail).toHaveBeenCalledTimes(1);
  });
  it("offline/online reads resume from the known cursor without cancelling execution", async () => {
    const value = setup(); await open(value); value.projection.setOnline(false); await value.projection.refresh();
    expect(value.port.readEvents).toHaveBeenCalledTimes(1); value.port.readEvents.mockResolvedValue(page([entry(2)])); value.projection.setOnline(true); await value.projection.refresh();
    expect(value.port.readEvents.mock.calls[1]![0]).toBe(1); expect(value.projection.getSnapshot().entries).toHaveLength(2);
  });
  it("a disposed connection cannot return details into a same-ID new connection", async () => {
    const old = setup(); await open(old); const pending = deferred<Detail>(); old.port.readDetail.mockReturnValueOnce(pending.promise); const reading = old.projection.loadDetail("detail-1"); old.projection.dispose();
    const fresh = setup(); await open(fresh); pending.resolve({ ...detail(), content: "Old center" }); await reading;
    expect(fresh.projection.getSnapshot().details).toEqual({}); expect(old.projection.getSnapshot().details).toEqual({});
  });
  it("validates returned detail identity/bytes and supports the public 1 MiB limit rather than 64 KiB", async () => {
    const value = setup(); await open(value); value.port.readDetail.mockResolvedValueOnce(detail("wrong")); await value.projection.loadDetail("detail-1");
    expect(value.projection.getSnapshot().details["detail-1"]?.error).toContain("identity");
    value.port.readDetail.mockResolvedValueOnce({ ...detail(), content: "x".repeat(MAX_DETAIL_BYTES) }); await value.projection.loadDetail("detail-1");
    expect(value.projection.getSnapshot().details["detail-1"]?.data?.content).toHaveLength(MAX_DETAIL_BYTES);
  });
});


// Contract fixtures mirror passed C02 HTTP/SSE assertions at 309be086 (compatibility.test.ts:113–138).
// These use the actual reader via a mock port; they are not historical raw HTTP captures.
describe("filtered raw-scan cursor compatibility", () => {
  it("crosses the HTTP hidden-only page after 1 → 3 and reaches ordinary cursor 5", async () => {
    const value = setup();
    value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { watermark: 5, hasMore: true }))
      .mockResolvedValueOnce(page([], { nextCursor: 3, watermark: 5, hasMore: true }))
      .mockResolvedValueOnce(page([{ id: "ordinary-5", cursor: 5, createdAt: at, kind: "text", text: "Visible after hidden stream" }]));
    await open(value); await value.projection.loadMore();
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 3, watermark: 5, hasMore: true, error: null });
    expect(value.projection.getSnapshot().entries).toEqual([entry(1)]);
    await value.projection.loadMore(); await value.projection.loadMore();
    expect(value.port.readEvents.mock.calls.map(([after]) => after)).toEqual([0, 1, 3]);
    expect(value.projection.getSnapshot().entries.map(item => item.cursor)).toEqual([1, 5]);
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 5, hasMore: false, error: null });
    expect(value.port.readDetail).not.toHaveBeenCalled();
  });
  it("resumes from the SSE hidden-only raw cursor 33 and reaches ordinary cursor 37", async () => {
    const value = setup();
    value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { watermark: 36, hasMore: true }))
      .mockResolvedValueOnce(page([], { nextCursor: 33, watermark: 36, hasMore: true }))
      .mockResolvedValueOnce(page([{ id: "ordinary-37", cursor: 37, createdAt: at, kind: "text", text: "Visible after hidden stream" }]));
    await open(value); await value.projection.loadMore(); value.projection.setOnline(false);
    await value.projection.refresh(); expect(value.port.readEvents).toHaveBeenCalledTimes(2);
    value.projection.setOnline(true); await value.projection.refresh();
    expect(value.port.readEvents.mock.calls.map(([after]) => after)).toEqual([0, 1, 33]);
    expect(value.projection.getSnapshot().entries.map(item => item.cursor)).toEqual([1, 37]);
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 37, hasMore: false, error: null });
    expect(value.port.readDetail).not.toHaveBeenCalled();
  });
  it("accepts a visible page with a filtered tail and a final empty scanned page", async () => {
    const value = setup();
    value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { nextCursor: 3, watermark: 5, hasMore: true }))
      .mockResolvedValueOnce(page([], { nextCursor: 5, watermark: 5 }));
    await open(value); expect(value.projection.getSnapshot()).toMatchObject({ cursor: 3, error: null });
    await value.projection.loadMore(); await value.projection.loadMore();
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 5, hasMore: false, error: null, entries: [entry(1)] });
    expect(value.port.readEvents.mock.calls.map(([after]) => after)).toEqual([0, 3]);
    expect(value.port.readDetail).not.toHaveBeenCalled();
  });
  it("accepts an entirely filtered terminal page and refreshes at the same exhausted cursor", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValue(page([], { nextCursor: 3, watermark: 3 }));
    await open(value); await value.projection.loadMore(); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: true, entries: [], cursor: 3, hasMore: false, error: null });
    expect(value.port.readEvents.mock.calls.map(([after]) => after)).toEqual([0, 3]);
  });
  it("deduplicates known overlaps while advancing beyond the last returned entry", async () => {
    const value = setup(); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([entry(1)], { nextCursor: 3, watermark: 3 })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ entries: [entry(1)], cursor: 3, error: null });
  });
  it.each([
    { entries: [entry(1), entry(1)], nextCursor: 3, watermark: 3 },
    { entries: [entry(2), entry(1)], nextCursor: 3, watermark: 3 },
    { entries: [entry(4)], nextCursor: 3, watermark: 3 },
    { entries: [], nextCursor: 4, watermark: 3 },
    { entries: [], nextCursor: 0, watermark: 3, hasMore: true },
    { entries: [], nextCursor: 2, watermark: 3, hasMore: false },
    { entries: [], nextCursor: 3, watermark: 3, hasMore: true },
    { entries: [], nextCursor: 3, watermark: 3, task: { ...task, id: "other" } },
  ])("rejects malformed filtered page %j without retry loops", async patch => {
    const value = setup(); value.port.readEvents.mockResolvedValue(page([], patch)); await open(value);
    expect(value.projection.getSnapshot()).toMatchObject({ loaded: false, cursor: 0, entries: [] });
    expect(value.projection.getSnapshot().error).toBeTruthy(); expect(value.port.readEvents).toHaveBeenCalledTimes(1);
    expect(value.port.readDetail).not.toHaveBeenCalled();
  });
  it("rejects a scan cursor moving behind after without replacing previous state", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page([entry(2)])); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([], { nextCursor: 1, watermark: 1 })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 2, entries: [entry(2)], stale: true });
    expect(value.projection.getSnapshot().error).toBeTruthy(); expect(value.port.readEvents).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...entry(1), reference: { id: "different", title: "Changed payload" } },
    { ...entry(1), id: "different-event" },
  ])("retains previous entries when overlapping identities conflict %j", async conflict => {
    const value = setup(); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([conflict], { nextCursor: 3, watermark: 3 })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ entries: [entry(1)], cursor: 1 });
    expect(value.projection.getSnapshot().error).toContain("conflicts");
  });
  it("refuses to backfill an unknown entry behind an already scanned filtered cursor", async () => {
    const value = setup(); value.port.readEvents.mockResolvedValueOnce(page([], { nextCursor: 3, watermark: 3 })); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([entry(2)], { nextCursor: 4, watermark: 4 })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ entries: [], cursor: 3 });
    expect(value.projection.getSnapshot().error).toContain("conflicts");
  });
  it.each([1, 2])("rejects reset when after 1 is not beyond watermark %s", async watermark => {
    const value = setup(); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([], { reset: true, nextCursor: 0, watermark })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 1, entries: [entry(1)] });
    expect(value.projection.getSnapshot().error).toContain("reset"); expect(value.port.readEvents).toHaveBeenCalledTimes(2);
  });
  it.each([
    { entries: [entry(1)] }, { nextCursor: 1 }, { hasMore: true },
  ])("rejects malformed reset even when after exceeds watermark %j", async patch => {
    const value = setup(); await open(value);
    value.port.readEvents.mockResolvedValueOnce(page([], { reset: true, nextCursor: 0, watermark: 0, ...patch })); await value.projection.refresh();
    expect(value.projection.getSnapshot()).toMatchObject({ cursor: 1, entries: [entry(1)] });
    expect(value.projection.getSnapshot().error).toContain("reset"); expect(value.port.readEvents).toHaveBeenCalledTimes(2);
  });
});
