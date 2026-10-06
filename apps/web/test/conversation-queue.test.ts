import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowApiError } from "@flow/client";
import type { ConversationQueueItem, ConversationQueuePage } from "@flow/contracts";
import { QueueCommands, type QueuePort } from "../src/conversations/queue/commands";
import { ConversationQueueProjection } from "../src/conversations/queue/projection";
const at = "2026-10-06T05:20:00Z";
const item = (n: number): ConversationQueueItem => ({ id: `item-${n}`, conversationId: "chat", sequence: n, state: "waiting", preview: `message ${n}`, truncated: false, promoted: null, createdAt: at, updatedAt: at });
const page = (patch: Partial<ConversationQueuePage> = {}): ConversationQueuePage => ({ conversationId: "chat", queueRevision: 1, items: [], nextCursor: null, blocked: null, paused: false, currentTurn: null, ...patch });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function port() {
  return {
    conversationQueue: vi.fn<QueuePort["conversationQueue"]>(async () => page()),
    conversationQueueItem: vi.fn<QueuePort["conversationQueueItem"]>(async () => ({ ...page(), item: { ...item(1), text: "message 1" } })),
    enqueueConversationTurn: vi.fn<QueuePort["enqueueConversationTurn"]>(async (_id, input) => ({ conversationId: "chat", queueRevision: input.expectedQueueRevision + 1, replayed: false, item: { ...item(input.expectedQueueRevision + 1), preview: input.text } })),
    cancelConversationQueueItem: vi.fn<QueuePort["cancelConversationQueueItem"]>(async (_id,id) => ({ conversationId: "chat", queueRevision: 2, replayed: false, item: { ...item(1), id, state: "cancelled" }, outcome: "cancelled" })),
    pauseConversationQueue: vi.fn<QueuePort["pauseConversationQueue"]>(async () => ({ conversationId: "chat", queueRevision: 2, replayed: false, paused: true, currentTurn: null })),
    resumeConversationQueue: vi.fn<QueuePort["resumeConversationQueue"]>(async () => ({ conversationId: "chat", queueRevision: 2, replayed: false, paused: false, currentTurn: null, promoted: null })),
    cancel: vi.fn<QueuePort["cancel"]>(async id => ({ id, status: "cancel_requested", title: "Task", harness: "claude", verificationStatus: "pending", createdAt: at, updatedAt: at })),
  };
}
const disposables: { dispose(): void }[] = [];
afterEach(() => { disposables.splice(0).forEach(value => value.dispose()); vi.useRealTimers(); });
function setup() { const api = port(); const queue = new ConversationQueueProjection(api, 100000); disposables.push(queue); queue.configure("chat", true); return { api, queue }; }
describe("queue commands and current projection", () => {
  it("rejects 16000 UTF-8 byte overflow before allocating a receipt or HTTP command", async () => {
    const api = port(), commands = new QueueCommands(api, async () => {}); disposables.push(commands);
    await expect(commands.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 1, text: "你".repeat(6000) } })).rejects.toThrow();
    expect(commands.getSnapshot()).toEqual([]); expect(api.enqueueConversationTurn).not.toHaveBeenCalled();
  });
  it("freezes each payload/key; unknown followed by unauthorized stays unknown and original enqueue retries unchanged", async () => {
    const api = port(), commands = new QueueCommands(api, async () => {}); disposables.push(commands);
    const input = { expectedQueueRevision: 1, text: "original" };
    api.enqueueConversationTurn.mockRejectedValueOnce(Error("lost")).mockRejectedValueOnce(new FlowApiError(401, "unauthorized", "expired"));
    await commands.execute({ kind: "enqueue", conversationId: "chat", input }); input.text = "next draft";
    const first = commands.getSnapshot()[0]!; expect(first.state).toBe("unknown"); expect(Object.isFrozen(first.command)).toBe(true);
    await commands.retry(first.key); expect(commands.getSnapshot()[0]).toMatchObject({ state: "unknown", everUnknown: true });
    await commands.retry(first.key); expect(commands.getSnapshot()[0]?.state).toBe("accepted");
    for (const call of api.enqueueConversationTurn.mock.calls) expect(call.slice(0,3)).toEqual(["chat", { expectedQueueRevision: 1, text: "original" }, first.key]);
  });
  it("rejects malformed success receipts as unknown without applying their alleged queue facts", async () => {
    const { api, queue } = setup(); await queue.refresh();
    api.enqueueConversationTurn.mockResolvedValueOnce({ conversationId: "wrong", queueRevision: 999, replayed: false, item: item(999) });
    await queue.enqueue("message"); expect(queue.getSnapshot().receipts[0]?.state).toBe("unknown"); expect(queue.getSnapshot().page?.queueRevision).toBe(1);
  });
  it("does not treat immutable old admission replay as current waiting membership", async () => {
    const { api, queue } = setup(); api.conversationQueue.mockResolvedValue(page({ queueRevision: 5, items: [] })); await queue.refresh();
    queue.setVisible(true); await queue.refresh();
    api.enqueueConversationTurn.mockRejectedValueOnce(Error("lost")); await queue.enqueue("message 6"); const original = queue.getSnapshot().receipts[0]!;
    api.conversationQueue.mockResolvedValue(page({ queueRevision: 7, items: [], currentTurn: { taskId: "new", taskStatus: "succeeded", turnId: "new-turn", turnNumber: 2, queueItemId: "item-6" } }));
    api.enqueueConversationTurn.mockResolvedValue({ conversationId: "chat", queueRevision: 6, item: item(6), replayed: true });
    await queue.retry(original.key); expect(queue.getSnapshot().page).toMatchObject({ queueRevision: 7, items: [], currentTurn: { taskId: "new" } });
  });
  it("accepts changing currentTurn/blocked at the same revision and rejects lower-revision reads", async () => {
    const { api, queue } = setup(); await queue.refresh();
    api.conversationQueue.mockResolvedValue(page({ currentTurn: { taskId: "task", taskStatus: "failed", turnId: "turn", turnNumber: 1, queueItemId: null }, blocked: "previous-turn-failed" }));
    await queue.refresh(); expect(queue.getSnapshot().page?.currentTurn?.taskStatus).toBe("failed");
    api.conversationQueue.mockResolvedValue(page({ queueRevision: 0 })); await queue.refresh(); expect(queue.getSnapshot().page?.queueRevision).toBe(1); expect(queue.getSnapshot().stale).toBe(true);
  });
  it("keeps pages ordered without guessing total and replaces removed items on a refreshed loaded window", async () => {
    const { api, queue } = setup(); let items = Array.from({ length: 43 }, (_, i) => item(i + 1));
    api.conversationQueue.mockImplementation(async (_id, opts) => { const next = items.filter(value => value.sequence > (opts?.after ?? 0)); return page({ queueRevision: 50, items: next.slice(0,20), nextCursor: next.length > 20 ? next[19]!.sequence : null }); });
    await queue.refresh(); expect(queue.getSnapshot().page?.items).toHaveLength(20); await queue.loadMore(); expect(queue.getSnapshot().page?.items).toHaveLength(40);
    items = items.filter(value => value.id !== "item-1"); await queue.refresh(); expect(queue.getSnapshot().page?.items[0]?.id).toBe("item-2");
    await queue.loadMore(); expect(queue.getSnapshot().page?.items).toHaveLength(42); expect(queue.getSnapshot().page?.nextCursor).toBeNull();
  });
  it("serializes refresh, pauses hidden reads, and ignores an old generation after a forced read", async () => {
    const { api, queue } = setup(); const slow = deferred<ConversationQueuePage>(); api.conversationQueue.mockReturnValueOnce(slow.promise);
    const first = queue.refresh(); expect(queue.refresh()).toBe(first); expect(api.conversationQueue).toHaveBeenCalledTimes(1);
    api.conversationQueue.mockResolvedValue(page({ queueRevision: 3 })); await queue.refresh(true); slow.resolve(page()); await first;
    expect(queue.getSnapshot().page?.queueRevision).toBe(3);
    queue.setVisible(true); await queue.refresh(); queue.setVisible(false); const calls = api.conversationQueue.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 5)); expect(api.conversationQueue).toHaveBeenCalledTimes(calls);
  });
  it("capability false performs no queue or detail reads and does not offer enqueue", async () => {
    const api = port(), queue = new ConversationQueueProjection(api); disposables.push(queue); queue.configure("chat", false); queue.setVisible(true);
    await queue.refresh(); await queue.loadDetail("item-1"); expect(api.conversationQueue).not.toHaveBeenCalled(); expect(api.conversationQueueItem).not.toHaveBeenCalled(); expect(queue.actionDisabledReason()).toContain("unavailable");
  });
  it("loads detail only on demand, caches its text, and rejects a different conversation identity", async () => {
    const { api, queue } = setup(); await queue.refresh(); expect(api.conversationQueueItem).not.toHaveBeenCalled();
    await queue.loadDetail("item-1"); await queue.loadDetail("item-1"); expect(api.conversationQueueItem).toHaveBeenCalledTimes(1);
    api.conversationQueueItem.mockResolvedValueOnce({ ...page({ conversationId: "wrong" }), item: { ...item(2), text: "message 2" } });
    await queue.loadDetail("item-2"); expect(queue.getSnapshot().details["item-2"]?.error).toBeTruthy();
  });
  it("unknown pause replay is historical; fresh GET selects current task and cancel is a separate key/result", async () => {
    const { api, queue } = setup(); queue.setVisible(true); await queue.refresh(); api.pauseConversationQueue.mockRejectedValueOnce(Error("lost")); await queue.pause();
    const receipt = queue.getSnapshot().receipts[0]!;
    const latest = { taskId: "latest", taskStatus: "running" as const, turnId: "turn-latest", turnNumber: 2, queueItemId: null };
    api.pauseConversationQueue.mockResolvedValueOnce({ conversationId: "chat", queueRevision: 2, paused: true, replayed: true, currentTurn: { ...latest, taskId: "old" } });
    api.conversationQueue.mockResolvedValue(page({ queueRevision: 4, paused: true, currentTurn: latest }));
    await queue.retry(receipt.key); expect(queue.getSnapshot().page?.currentTurn?.taskId).toBe("latest"); expect(api.cancel).not.toHaveBeenCalled();
    await expect(queue.cancelCurrentTask("old")).rejects.toThrow("changed"); expect(api.cancel).not.toHaveBeenCalled();
    await queue.cancelCurrentTask("latest"); expect(api.cancel.mock.calls[0]![0]).toBe("latest"); expect(api.cancel.mock.calls[0]![1]).not.toBe(receipt.key); expect(queue.getSnapshot().receipts).toHaveLength(2);
  });
  it("a newer task between confirmation and cancellation stops the stale cancellation", async () => {
    const { api, queue } = setup(); const current = { taskId: "first", taskStatus: "running" as const, turnId: "turn", turnNumber: 1, queueItemId: null };
    api.conversationQueue.mockResolvedValue(page({ paused: true, currentTurn: current })); await queue.refresh();
    api.conversationQueue.mockResolvedValue(page({ paused: true, currentTurn: { ...current, taskId: "second", turnNumber: 2 } }));
    await expect(queue.cancelCurrentTask("first")).rejects.toThrow("changed"); expect(api.cancel).not.toHaveBeenCalled();
  });
  it("continue freezes task identity from a fresh GET and 409 only refreshes without a fresh-key resend", async () => {
    const { api, queue } = setup(); await queue.refresh(); api.conversationQueue.mockResolvedValue(page({ queueRevision: 9, paused: true, currentTurn: { taskId: "latest", taskStatus: "failed", turnId: "turn", turnNumber: 1, queueItemId: null } }));
    api.resumeConversationQueue.mockRejectedValueOnce(new FlowApiError(409, "conversation_queue_task_conflict", "changed")); await queue.resume();
    expect(api.resumeConversationQueue.mock.calls[0]![1]).toEqual({ expectedQueueRevision: 9, expectedTaskId: "latest" }); expect(api.resumeConversationQueue).toHaveBeenCalledTimes(1); expect(queue.getSnapshot().receipts[0]?.state).toBe("rejected");
  });
  it("same-page offline/visible changes preserve unknown payload/key and never cancel the task", async () => {
    const { api, queue } = setup(); await queue.refresh(); api.enqueueConversationTurn.mockRejectedValueOnce(Error("lost")); await queue.enqueue("message 2"); const receipt = queue.getSnapshot().receipts[0]!;
    queue.setOnline(false); queue.setVisible(false); await queue.retry(receipt.key); expect(api.enqueueConversationTurn).toHaveBeenCalledTimes(1);
    queue.setOnline(true); queue.setVisible(true); await queue.refresh(); await queue.retry(receipt.key);
    expect(api.enqueueConversationTurn.mock.calls[1]!.slice(0,3)).toEqual(api.enqueueConversationTurn.mock.calls[0]!.slice(0,3)); expect(api.cancel).not.toHaveBeenCalled();
  });
  it("a hidden page receives an already-sent command receipt without starting background queue reads", async () => {
    const { api, queue } = setup(); queue.setVisible(true); await queue.refresh();
    const pending = deferred<Awaited<ReturnType<QueuePort["enqueueConversationTurn"]>>>(); api.enqueueConversationTurn.mockReturnValueOnce(pending.promise);
    const sending = queue.enqueue("message 2"); queue.setVisible(false); const reads = api.conversationQueue.mock.calls.length;
    pending.resolve({ conversationId: "chat", queueRevision: 2, replayed: false, item: item(2) }); await sending;
    expect(queue.getSnapshot().receipts[0]?.state).toBe("accepted"); expect(api.conversationQueue).toHaveBeenCalledTimes(reads); expect(queue.getSnapshot().stale).toBe(true);
    api.conversationQueue.mockResolvedValue(page({ queueRevision: 2, items: [item(2)] })); queue.setVisible(true); await queue.refresh(); expect(queue.getSnapshot().page?.items).toHaveLength(1);
  });
  it("timeout becomes visible unknown while dispose ignores a late response", async () => {
    const api = port(), slow = deferred<Awaited<ReturnType<QueuePort["enqueueConversationTurn"]>>>(); api.enqueueConversationTurn.mockReturnValue(slow.promise);
    const commands = new QueueCommands(api, async () => {}, 5); disposables.push(commands);
    await commands.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 1, text: "hi" } }); expect(commands.getSnapshot()[0]?.state).toBe("unknown");
    commands.dispose(); slow.resolve({ conversationId: "chat", queueRevision: 2, replayed: false, item: { ...item(2), preview: "hi" } }); await Promise.resolve(); expect(commands.getSnapshot()).toEqual([]);
  });
});
