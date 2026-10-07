import assert from "node:assert/strict";
import { test } from "node:test";
import { ContextHistoryController, type ContextHistoryReaders, type HistoryTarget } from "./controller.ts";
import { historyFixture } from "./fixture.ts";

const target: HistoryTarget = { connectionId: "connection-a", viewKey: "view-a", conversationId: "chat-a", taskId: "task-a", authorityGeneration: 1 };
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const turn = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function harness() {
  const lifetime = new AbortController(), responses: ReturnType<typeof deferred<ReturnType<typeof historyFixture>>>[] = [], signals: AbortSignal[] = [];
  let allowed = true, detailCalls = 0;
  const port: ContextHistoryReaders = {
    current: () => allowed,
    history: (_, signal) => { signals.push(signal); const response = deferred<ReturnType<typeof historyFixture>>(); responses.push(response); return response.promise; },
    detail: async (_, sample) => { detailCalls++; return { id: sample.detailRef.id, title: sample.detailRef.title, content: "real decoded detail", kind: "detail", mediaType: "text/plain" }; },
  };
  const controller = new ContextHistoryController(port, lifetime.signal); controller.configure(target, true);
  return { controller, lifetime, responses, signals, port, revoke: () => { allowed = false; }, detailCalls: () => detailCalls };
}
test("closed configuration makes no read and retains a stable snapshot", () => {
  const h = harness(), before = h.controller.getSnapshot(); h.controller.configure({ ...target }, true);
  assert.equal(h.controller.getSnapshot(), before); assert.equal(h.responses.length, 0); h.controller.dispose();
});
test("one explicit read, zero estimate and distinct historical identity stay unchanged", async () => {
  const h = harness(); h.controller.open(); h.controller.open(); await h.controller.refresh(); assert.equal(h.responses.length, 1);
  const response = historyFixture(); h.responses[0]!.resolve(response); await turn();
  const state = h.controller.getSnapshot(); assert.deepEqual(state.history, response); assert.equal(state.history!.latest!.observation.used.value, 0);
  assert.equal(state.history!.remaining.value, null); assert.equal(state.history!.latest!.materials.state, "unknown");
  assert.equal(Object.isFrozen(state.history!.latest!.observation.identity), true); assert.equal(h.detailCalls(), 0); h.controller.dispose();
});
test("switching A to B rejects a late A result and does not overlap an abort-ignoring read", async () => {
  const h = harness(); h.controller.open(); h.controller.configure({ ...target, taskId: "task-b" }, true); h.controller.open();
  assert.equal(h.signals[0]!.aborted, true); assert.equal(h.responses.length, 1);
  h.responses[0]!.resolve(historyFixture()); await turn(); assert.equal(h.controller.getSnapshot().history, null);
  await Promise.all([h.controller.refresh().then(() => undefined), Promise.resolve().then(() => { h.responses[1]!.resolve(historyFixture("task-b")); })]);
  assert.equal(h.controller.getSnapshot().history!.taskId, "task-b"); h.controller.dispose();
});
for (const reason of ["hide", "disable", "close", "dispose", "lifetime", "plugin"] as const) {
  test(`${reason} aborts and makes a late success inert`, async () => {
    const h = harness(), plugin = new AbortController(); h.controller.open(plugin.signal);
    if (reason === "hide" || reason === "disable") h.controller.configure(target, false);
    else if (reason === "close") h.controller.close(); else if (reason === "dispose") h.controller.dispose();
    else if (reason === "lifetime") h.lifetime.abort(); else plugin.abort();
    assert.equal(h.signals[0]!.aborted, true); h.responses[0]!.resolve(historyFixture()); await turn();
    assert.equal(h.controller.getSnapshot().open, false); assert.equal(h.controller.getSnapshot().history, null); h.controller.dispose();
  });
}
test("authority generation and known attempt changes invalidate the target", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.resolve(historyFixture()); await turn();
  h.controller.configure({ ...target, authorityGeneration: 2, expectedAttemptId: "attempt-2" }, true);
  assert.equal(h.controller.getSnapshot().history, null); h.controller.open(); h.responses[1]!.resolve(historyFixture()); await turn();
  assert.deepEqual(h.controller.getSnapshot().error, { kind: "invalid-response" }); h.controller.dispose();
});
test("no current attempt and no sample are different from zero or unsupported", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.resolve({ ...historyFixture(), attemptId: null, latest: null }); await turn();
  assert.equal(h.controller.getSnapshot().history!.attemptId, null); assert.equal(h.controller.getSnapshot().error, null);
  const next = h.controller.refresh(); h.responses[1]!.resolve({ ...historyFixture(), latest: null }); await next;
  assert.equal(h.controller.getSnapshot().history!.attemptId, "attempt-1"); assert.equal(h.controller.getSnapshot().history!.latest, null); h.controller.dispose();
});
test("failure stays error, never healthy unknown; retry is explicit and sanitizes metadata", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.reject({ status: 401, code: "unauthorized", message: "secret" }); await turn();
  assert.deepEqual(h.controller.getSnapshot().error, { kind: "http", status: 401, code: "unauthorized" }); assert.equal(h.responses.length, 1);
  const retry = h.controller.refresh(); h.responses[1]!.resolve(historyFixture()); await retry; assert.equal(h.controller.getSnapshot().error, null); h.controller.dispose();
});
test("revocation before or after the await cannot publish a result", async () => {
  const h = harness(); h.controller.open(); h.revoke(); h.responses[0]!.resolve(historyFixture()); await turn(); assert.equal(h.controller.getSnapshot().history, null);
  await h.controller.refresh(); assert.equal(h.responses.length, 1); h.controller.dispose();
});
test("task mismatch is rejected without publishing another task's history", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.resolve(historyFixture("other")); await turn();
  assert.deepEqual(h.controller.getSnapshot().error, { kind: "invalid-response" }); assert.equal(h.controller.getSnapshot().history, null); h.controller.dispose();
});
test("detail is lazy, once per sample and cleared by explicit refresh", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.resolve(historyFixture()); await turn(); assert.equal(h.detailCalls(), 0);
  await h.controller.readDetail(); await h.controller.readDetail(); assert.equal(h.detailCalls(), 1); assert.equal(h.controller.getSnapshot().detail!.id, "detail-1");
  const refresh = h.controller.refresh(); assert.equal(h.controller.getSnapshot().detail, null); h.responses[1]!.resolve(historyFixture()); await refresh; h.controller.dispose();
});
test("late detail after hide and mismatched detail cannot leak into another opening", async () => {
  const h = harness(); h.controller.open(); h.responses[0]!.resolve(historyFixture()); await turn();
  const body = deferred<Awaited<ReturnType<ContextHistoryReaders["detail"]>>>(); h.port.detail = () => body.promise;
  const read = h.controller.readDetail(); h.controller.close(); body.resolve({ id: "other", title: "wrong", content: "wrong", kind: "detail", mediaType: "text/plain" }); await read;
  assert.equal(h.controller.getSnapshot().detail, null); h.controller.open(); h.responses[1]!.resolve(historyFixture()); await turn();
  await h.controller.readDetail(); assert.deepEqual(h.controller.getSnapshot().error, { kind: "invalid-response" }); h.controller.dispose();
});
