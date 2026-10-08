import assert from "node:assert/strict";
import { test } from "node:test";
import { connectionPresentation, submitConnection } from "../src/connection/presentation";

test("an existing session can be checked before asking for a credential", () => {
  assert.equal(connectionPresentation("idle", true).primary, "check");
  assert.equal(connectionPresentation(undefined, false).primary, "connect");
  assert.equal(connectionPresentation("ready", true).primary, "check");
});

test("unauthenticated never invents first-login or expiry history", () => {
  const state = connectionPresentation("unauthenticated", true);
  assert.equal(state.primary, "connect");
  assert.match(state.message, /not signed in/);
  assert.doesNotMatch(state.message + state.nextStep, /expired|first time|again|reconnect/i);
});

test("offline preserves work while rejected and unsupported access require administrator action", () => {
  const offline = connectionPresentation("offline", true);
  assert.equal(offline.primary, "check");
  assert.match(offline.nextStep, /not been cancelled/);
  for (const phase of ["forbidden", "unsupported"]) {
    const state = connectionPresentation(phase, true);
    assert.equal(state.primary, "contact");
    assert.match(state.nextStep, /administrator/);
  }
});

test("only the known checking phase suspends form actions", () => {
  assert.equal(connectionPresentation("checking", true).pending, true);
  assert.equal(connectionPresentation("checking", true).primary, "wait");
  for (const phase of ["idle", "ready", "offline", "unauthenticated", "unsupported", "forbidden", "error", "future-phase"]) {
    assert.equal(connectionPresentation(phase, true).pending, false);
  }
  assert.equal(connectionPresentation("error", true).primary, "check");
  assert.doesNotMatch(connectionPresentation("future-phase", false).message, /signed in|expired/i);
});

test("an explicit connection clears the credential before calling the existing callback exactly once", () => {
  let held = " synthetic-token ";
  const order: string[] = [];
  const accepted = submitConnection({ phase: "unauthenticated", address: "https://workspace.example/center", token: held }, {
    clearToken() { held = ""; order.push("cleared"); },
    connect(address, token) {
      assert.equal(held, "");
      assert.equal(address, "https://workspace.example/center");
      assert.equal(token, " synthetic-token ");
      order.push("connected");
    },
  });
  assert.equal(accepted, true);
  assert.deepEqual(order, ["cleared", "connected"]);
});

test("pending or empty submissions neither clear a new entry nor dispatch another connection", () => {
  let calls = 0;
  const actions = { clearToken() { calls++; }, connect() { calls++; } };
  assert.equal(submitConnection({ phase: "checking", address: "", token: "next credential" }, actions), false);
  assert.equal(submitConnection({ address: "", token: "   " }, actions), false);
  assert.equal(calls, 0);
});

test("a callback error propagates after clearing and does not trigger a retry", () => {
  const failure = new Error("controlled failure");
  let cleared = false, calls = 0;
  assert.throws(() => submitConnection({ address: "", token: "synthetic" }, {
    clearToken() { cleared = true; },
    connect() { calls++; throw failure; },
  }), error => error === failure);
  assert.equal(cleared, true);
  assert.equal(calls, 1);
});
