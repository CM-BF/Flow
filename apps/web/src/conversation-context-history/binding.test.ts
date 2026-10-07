import assert from "node:assert/strict";
import { test } from "node:test";
import { ConversationContextHistory, createContextHistoryPort } from "./binding.ts";
import type { HistoryTarget } from "./controller.ts";
import { historyFixture } from "./fixture.ts";

const initial: HistoryTarget = { connectionId: "connection-a", viewKey: "view-a", conversationId: "chat-a", taskId: "task-a", authorityGeneration: 1 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture() {
  let target: HistoryTarget | null = initial, authorized = true, enabled = true, reads = 0, details = 0;
  const pending = deferred<ReturnType<typeof historyFixture>>(), signals: AbortSignal[] = [], lifetime = new AbortController();
  const port = createContextHistoryPort({
    contextHistory: (_, signal) => { reads++; signals.push(signal!); return pending.promise; },
    detail: async id => { details++; return { kind: "detail", id, title: "Context", content: "bounded detail", mediaType: "text/plain" }; },
  }, () => target, () => authorized);
  const binding = new ConversationContextHistory("view-a", { connectionId: "connection-a", signal: lifetime.signal, enabled: () => enabled }, () => port);
  binding.configure("route-a", true);
  return { port, binding, pending, signals, lifetime, reads: () => reads, details: () => details,
    target: (next: HistoryTarget | null) => { target = next; }, authorize: (next: boolean) => { authorized = next; }, enable: (next: boolean) => { enabled = next; } };
}
test("private reader rejects before HTTP when App authorization is absent", async () => {
  const h = fixture(); h.authorize(false);
  await assert.rejects(h.port.history(initial, new AbortController().signal)); assert.equal(h.reads(), 0); h.binding.dispose();
});
for (const field of ["connectionId", "viewKey", "conversationId", "taskId", "authorityGeneration"] as const) {
  test(`private reader rechecks ${field} after await`, async () => {
    const h = fixture(); const read = h.port.history(initial, new AbortController().signal);
    h.target({ ...initial, [field]: field === "authorityGeneration" ? 2 : "changed" });
    h.pending.resolve(historyFixture()); await assert.rejects(read); h.binding.dispose();
  });
}
test("no turn yields an explicit command error and zero reads", () => {
  const h = fixture(); h.target(null);
  assert.throws(() => h.binding.open(new AbortController().signal), /No execution observation/);
  assert.equal(h.reads(), 0); assert.equal(h.binding.controller.getSnapshot().open, false); h.binding.dispose();
});
test("host disable and hidden view abort the registered session binding", async () => {
  for (const hide of [false, true]) {
    const h = fixture(); h.binding.open(new AbortController().signal); assert.equal(h.reads(), 1);
    if (hide) h.binding.configure("route-a", false); else { h.enable(false); h.binding.sync(); }
    assert.equal(h.signals[0]!.aborted, true); h.pending.resolve(historyFixture()); await settle();
    assert.equal(h.binding.controller.getSnapshot().history, null); assert.equal(h.binding.controller.getSnapshot().open, false); h.binding.dispose();
  }
});
test("view release and session lifetime prevent late history publication", async () => {
  for (const release of [false, true]) {
    const h = fixture(); h.binding.open(new AbortController().signal);
    if (release) h.binding.dispose(); else h.lifetime.abort();
    assert.equal(h.signals[0]!.aborted, true); h.pending.resolve(historyFixture()); await settle();
    assert.equal(h.binding.controller.getSnapshot().history, null); assert.equal(h.binding.controller.getSnapshot().available, false); h.binding.dispose();
  }
});
test("same-target reconfiguration preserves opening without another read", async () => {
  const h = fixture(); h.binding.open(new AbortController().signal); h.binding.configure("route-a", true); h.binding.sync();
  assert.equal(h.reads(), 1); h.pending.resolve(historyFixture()); await settle();
  assert.equal(h.binding.controller.getSnapshot().history?.taskId, "task-a"); h.binding.dispose();
});
test("detail requires the same task and known attempt before any request", async () => {
  const h = fixture(), signal = new AbortController().signal;
  await assert.rejects(h.port.detail(initial, historyFixture("other-task").latest!, signal));
  h.target({ ...initial, expectedAttemptId: "other-attempt" });
  await assert.rejects(h.port.detail({ ...initial, expectedAttemptId: "other-attempt" }, historyFixture().latest!, signal));
  assert.equal(h.details(), 0); h.binding.dispose();
});
test("authorization revoked during the real private-port await rejects the result", async () => {
  const h = fixture(); const read = h.port.history(initial, new AbortController().signal);
  h.authorize(false); h.pending.resolve(historyFixture()); await assert.rejects(read);
  assert.equal(h.reads(), 1); h.binding.dispose();
});
