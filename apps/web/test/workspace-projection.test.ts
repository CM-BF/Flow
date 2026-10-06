import { afterEach, expect, it, vi } from "vitest";
import { FlowApiError, type FlowClient } from "@flow/client";
import type { TaskSnapshot, WorkspaceEntry, WorkspacePage } from "@flow/contracts";
import { WorkspaceFeedProjection } from "../src/workspace-feed/projection";
import { TaskIndexProjection } from "../src/workspace-feed/task-index";

const entry = (cursor: number, text = `Record ${cursor}`): WorkspaceEntry => ({ id: `w-${cursor}`, cursor, task: { id: "a", title: "Task A" }, entry: { id: `e-${cursor}`, cursor: 1, kind: "text", text, createdAt: "2026-10-06T00:00:00Z" } });
const task: TaskSnapshot = { id: "a", title: "Task A", prompt: "Prompt", harness: "fixture", status: "waiting", verificationStatus: "pending", createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z", entries: [], watermark: 0, hasMore: false, pendingDecision: { id: "old", prompt: "Old decision" }, attempt: null, usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true } };
const page = (entries: WorkspaceEntry[], patch: Partial<WorkspacePage> = {}): WorkspacePage => ({ workspaceId: "personal", entries, nextCursor: entries.at(-1)?.cursor ?? 0, previousCursor: entries[0]?.cursor ?? 0, watermark: entries.at(-1)?.cursor ?? 0, hasMore: false, hasEarlier: false, projectionPending: false, tasks: [], attention: [], tasksTruncated: false, attentionTruncated: false, ...patch });
const api = () => ({ workspace: vi.fn<FlowClient["workspace"]>(async () => page([])), show: vi.fn<FlowClient["show"]>(async () => task), decide: vi.fn<FlowClient["decide"]>(async () => task), cancel: vi.fn<FlowClient["cancel"]>(async () => task) });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (value: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
afterEach(() => { vi.useRealTimers(); });

it("keeps live/history cursors separate and deduplicates by workspace cursor", async () => {
  const client = api();
  client.workspace.mockResolvedValueOnce(page([entry(40), entry(41)], { hasEarlier: true, watermark: 90 })).mockResolvedValueOnce(page([entry(38), entry(40)], { hasEarlier: true })).mockResolvedValueOnce(page([entry(41), entry(42, "Late commit")], { nextCursor: 42 }));
  const feed = new WorkspaceFeedProjection(client);
  await feed.refresh(); await feed.loadEarlier(); await feed.refresh();
  expect(client.workspace.mock.calls.map(args => (args as unknown[])[0])).toEqual([{}, { before: 40 }, { after: 41 }]);
  expect(feed.getSnapshot().entries.map(row => row.cursor)).toEqual([38, 40, 41]);
  expect(feed.getSnapshot().buffered.map(row => row.cursor)).toEqual([42]);
  feed.revealNew();
  expect(feed.getSnapshot().entries.map(row => row.cursor)).toEqual([38, 40, 41, 42]);
  expect(feed.getSnapshot().previousCursor).toBe(38);
  expect(feed.getSnapshot().deliveredCursor).toBe(42);
});
it("buffers new progress during historical reading and reveals it explicitly", async () => {
  const client = api(); client.workspace.mockResolvedValueOnce(page([entry(1)])).mockResolvedValueOnce(page([entry(2)]));
  const feed = new WorkspaceFeedProjection(client); await feed.refresh(); feed.setFollowing(false); await feed.refresh();
  expect(feed.getSnapshot().entries).toHaveLength(1); expect(feed.getSnapshot().buffered).toHaveLength(1);
  feed.revealNew(); expect(feed.getSnapshot().following).toBe(true); expect(feed.getSnapshot().entries).toHaveLength(2);
});
it("bounds catch-up, backs off after failures and stops polling offline", async () => {
  vi.useFakeTimers(); const client = api(); client.workspace.mockResolvedValue(page([entry(1)], { hasMore: true, projectionPending: true }));
  const feed = new WorkspaceFeedProjection(client); feed.start(); await vi.advanceTimersByTimeAsync(0);
  expect(client.workspace).toHaveBeenCalledTimes(3); await vi.advanceTimersByTimeAsync(249); expect(client.workspace).toHaveBeenCalledTimes(3);
  feed.setOnline(false); await vi.advanceTimersByTimeAsync(60_000); expect(client.workspace).toHaveBeenCalledTimes(3);
  client.workspace.mockRejectedValue(new Error("Unavailable")); feed.setOnline(true); await vi.advanceTimersByTimeAsync(0); expect(client.workspace).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(4999); expect(client.workspace).toHaveBeenCalledTimes(4); await vi.advanceTimersByTimeAsync(1); expect(client.workspace).toHaveBeenCalledTimes(5);
  feed.stop();
});
it("resets on 409 and ignores an older history request resolved after reset", async () => {
  vi.useFakeTimers(); const client = api(); const old = deferred<WorkspacePage>();
  client.workspace.mockResolvedValueOnce(page([entry(40)], { hasEarlier: true })).mockReturnValueOnce(old.promise).mockRejectedValueOnce(new FlowApiError(409, "workspace_cursor_reset", "Reset")).mockResolvedValue(page([entry(1)]));
  const feed = new WorkspaceFeedProjection(client); feed.start(); await vi.advanceTimersByTimeAsync(0);
  const history = feed.loadEarlier(); await feed.refresh(); await vi.advanceTimersByTimeAsync(0); old.resolve(page([entry(39)])); await history;
  expect(feed.getSnapshot().entries.map(row => row.cursor)).toEqual([1]); expect(feed.getSnapshot().notice).toContain("rebuilt"); feed.stop();
});
it("refreshes stale decisions without answering the replacement decision", async () => {
  const client = api(); client.decide.mockRejectedValue(new FlowApiError(409, "decision_conflict", "Expired")); client.show.mockResolvedValue({ ...task, pendingDecision: { id: "replacement", prompt: "New question" } });
  const feed = new WorkspaceFeedProjection(client); await feed.decide("a", "old", "approve");
  expect(client.decide).toHaveBeenCalledTimes(1); expect(client.decide.mock.calls[0]?.slice(0, 2)).toEqual(["a", { decisionId: "old", answer: "approve" }]);
  expect(feed.getSnapshot().reviewed.a?.pendingDecision?.id).toBe("replacement"); expect(feed.getSnapshot().actions.a?.error).toContain("nothing was automatically resubmitted");
});
it("keeps a lost-response command key and releases pending after offline; late results cannot update", async () => {
  const client = api(); const pending = deferred<TaskSnapshot>(); client.decide.mockReturnValueOnce(pending.promise);
  const feed = new WorkspaceFeedProjection(client); const request = feed.decide("a", "old", "approve");
  expect(feed.getSnapshot().actions.a?.pending).toBe(true); feed.setOnline(false); expect(feed.getSnapshot().actions.a?.pending).toBe(false);
  feed.setOnline(true); pending.reject(new Error("Lost response")); await request;
  expect(feed.getSnapshot().reviewed.a).toBeUndefined(); await feed.decide("a", "old", "approve");
  expect(client.decide.mock.calls[0]?.[2]).toBe(client.decide.mock.calls[1]?.[2]); expect(feed.getSnapshot().actions.a?.pending).toBe(false);
});
it("releases an in-flight show on stop and does not accept its stale result after restart", async () => {
  const client = api(); const pending = deferred<TaskSnapshot>(); client.show.mockReturnValueOnce(pending.promise);
  const feed = new WorkspaceFeedProjection(client); const request = feed.reviewTask("a"); feed.stop(); feed.start(false);
  pending.resolve(task); await request; expect(feed.getSnapshot().reviewed.a).toBeUndefined(); expect(feed.getSnapshot().actions.a?.pending).toBe(false);
  feed.setOnline(true); await feed.reviewTask("a"); expect(feed.getSnapshot().reviewed.a?.id).toBe("a"); feed.stop();
});
it("does not infer successful empty data from a failed initial request", async () => {
  const client = api(); client.workspace.mockRejectedValue(new Error("Unavailable")); const feed = new WorkspaceFeedProjection(client); await feed.refresh();
  expect(feed.getSnapshot().deliveredCursor).toBeNull(); expect(feed.getSnapshot().error).toBe("Unavailable");
  client.workspace.mockResolvedValue(page([])); await feed.refresh(); expect(feed.getSnapshot().deliveredCursor).toBe(0); expect(feed.getSnapshot().error).toBeNull();
});
it("combines abort cancellation with a bounded timeout and isolates a late connection response", async () => {
  const client = api(); const pending = deferred<WorkspacePage>(); client.workspace.mockReturnValueOnce(pending.promise); const feed = new WorkspaceFeedProjection(client);
  const request = feed.refresh(); const signal = (client.workspace.mock.calls[0] as unknown as [unknown, AbortSignal])[1]; expect(signal).toBeInstanceOf(AbortSignal);
  feed.stop(); expect(signal.aborted).toBe(true); pending.resolve(page([entry(1)])); await request; expect(feed.getSnapshot().entries).toEqual([]);
});
it("uses exact task index totals, deduplicates pages and isolates late filter results", async () => {
  const late = deferred<{ tasks: TaskSnapshot[]; totalSize: number; nextCursor: null }>();
  const client = { queryTasks: vi.fn().mockResolvedValueOnce({ tasks: [task], totalSize: 105, nextCursor: "next" }).mockResolvedValueOnce({ tasks: [task, { ...task, id: "b" }], totalSize: 106, nextCursor: null }).mockReturnValueOnce(late.promise).mockResolvedValueOnce({ tasks: [], totalSize: 0, nextCursor: null }) };
  const index = new TaskIndexProjection(client); await index.load(); await index.load(true);
  expect(index.getSnapshot().total).toBe(106); expect(index.getSnapshot().tasks).toHaveLength(2); expect(client.queryTasks.mock.calls[1]?.[0].cursor).toBe("next");
  const first = index.load(false, "waiting"); await index.load(false, "running"); late.resolve({ tasks: [task], totalSize: 1, nextCursor: null }); await first;
  expect(index.getSnapshot().tasks).toEqual([]); expect(index.getSnapshot().filter).toBe("running");
});
