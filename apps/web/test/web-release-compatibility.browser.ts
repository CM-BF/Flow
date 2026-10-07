import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, type Browser, type Request, type Response } from "@playwright/test";
import { assertRecoveryAdmission, errorCode, hash, saveJson, startReleaseFixture, until, type RecoveryAdmission, type Admission, type Lifetime, type ReleaseFixture, type LoadedApp } from "./web-release-compatibility.fixture";

/** No top-level launch. The existing supervised caller must bind its actual Chrome lifetime and budget. */
export type OwnedBrowserLifetime = Lifetime & {
  launchOwnedChrome(input: { proxyUrl: string; proxyBypassList: "<-loopback>" }): Promise<{
    browser: Browser;
    receipt: { pid: number; pgid: number; argv: string[]; executableSha256: string };
    close(): Promise<void>;
  }>;
};
type Phase = "not-started" | "fixture" | "chrome" | "canary" | "cookie-connect" | "cookie-flags" | "cookie-csrf"
  | "app-connect" | "cookie-reload" | "late-logout" | "durable-retry" | "profile" | "ack-loss" | "task-completion" | "explicit-retry" | "legacy-read" | "asset-observation" | "reports" | "done";
type CookieStep = "unknown-reload" | "original-retry" | "accepted-identity" | "running-task" | "cookie-stream" | "held-response" | "old-read-revoked" | "old-streams-closed" | "reconnect" | "release-old-response" | "new-session-ready" | "draft-restore";
type Progress = { phase: Phase; app: string | null; step: CookieStep | null; completed: Array<{ phase: Phase; app: string | null }> };
function advance(progress: Progress, phase: Phase, app: string | null = progress.app) {
  assert.ok(progress.completed.length < 96);
  if (progress.phase !== "not-started") progress.completed.push({ phase: progress.phase, app: progress.app });
  progress.phase = phase; progress.app = app; progress.step = null;
}
const inputBox = (page: Page) => page.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
async function connect(page: Page, fixture: ReleaseFixture) {
  await page.goto(fixture.input.context.publicOrigin, { waitUntil: "domcontentloaded" });
  assert.equal(await page.evaluate(() => location.origin), fixture.input.context.publicOrigin);
  const token = page.getByLabel("Owner token", { exact: true }); await expect(token).toHaveCount(1); await token.fill(fixture.token);
  await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(inputBox(page)).toBeVisible();
}
/** Read-only observation installed before clicking; no APIRequestContext or request modification. */
function observeFault(page: Page, bodyText: string, life: Lifetime) {
  let selected: Request | undefined, response: Response | undefined, failure: string | null = null, matches = 0;
  const requested = (request: Request) => {
    if (request.method() !== "POST" || !/\/api\/conversations\/[^/]+\/turns$/.test(new URL(request.url()).pathname)) return;
    let body: unknown; try { body = JSON.parse(request.postData() ?? "null"); } catch { return; }
    if (JSON.stringify(body).includes(bodyText)) { matches++; selected ??= request; }
  };
  const responded = (value: Response) => { if (value.request() === selected) response = value; };
  const failed = (request: Request) => { if (request === selected) failure = request.failure()?.errorText ?? "UNKNOWN_REQUEST_FAILURE"; };
  page.on("request", requested); page.on("response", responded); page.on("requestfailed", failed);
  return {
    async read() {
      await until(async () => Boolean(selected && response && failure), Boolean, life);
      assert.ok(selected && response && failure); assert.equal(matches, 1, "No automatic second POST before explicit Retry");
      const headers = await response.allHeaders();
      assert.ok(response.status() >= 200 && response.status() < 300); assert.match(headers["content-length"] ?? "", /^[1-9]\d*$/);
      assert.equal(headers["transfer-encoding"], undefined); assert.equal(headers.connection, "close");
      assert.match(failure, /ERR_CONTENT_LENGTH_MISMATCH|ERR_FAILED|ERR_CONNECTION_CLOSED/);
      return { path: new URL(selected.url()).pathname, key: selected.headers()["idempotency-key"], bodySha256: hash(selected.postData() ?? ""),
        status: response.status(), contentLength: Number(headers["content-length"]), contentType: headers["content-type"], failure, sameRequest: true, matches };
    },
    stop() { page.off("request", requested); page.off("response", responded); page.off("requestfailed", failed); },
  };
}
async function cookiePolicy(browser: Browser, fixture: ReleaseFixture, life: Lifetime, progress: Progress, correctedLogout = false) {
  const context = await browser.newContext({ serviceWorkers: "block" }); const page = await context.newPage();
  try {
    // Dedicated non-product page on the same exact public origin. No scripts are injected into an App.
    await page.goto(fixture.input.context.publicOrigin + "/__flow_compat_probe", { waitUntil: "domcontentloaded" });
    assert.equal(await page.evaluate(() => location.origin), fixture.input.context.publicOrigin);
    advance(progress, "cookie-connect", null);
    const connection = await page.evaluate(async token => {
      const initial = await fetch("/api/browser-session"); const before = await initial.json();
      const connected = await fetch("/api/browser-session/connect", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
      const ready = await connected.json();
      return { initial: initial.status, before: before.state, connect: connected.status, ready: ready.state, protocol: ready.protocol };
    }, fixture.token);
    assert.deepEqual(connection, { initial: 200, before: "unauthenticated", connect: 200, ready: "ready", protocol: "flow.browser-session.v1" });
    advance(progress, "cookie-flags");
    const cookies = (await context.cookies()).filter(cookie => cookie.name.startsWith("flow-session-")); assert.equal(cookies.length, 1);
    const cookie = cookies[0]!; const flags = { domain: cookie.domain, path: cookie.path, httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite };
    assert.deepEqual(flags, { domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Strict" });
    advance(progress, "cookie-csrf");
    const result = await page.evaluate(async () => {
      const reading = await fetch("/api/browser-session"); const ready = await reading.json();
      const noCsrf = await fetch("/api/browser-session/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      // CSRF remains inside the page. A rejected mutation must leave the same authenticated principal.
      const retained = await (await fetch("/api/browser-session")).json();
      const logout = await fetch("/api/browser-session/logout", { method: "POST", headers: { "content-type": "application/json", "X-Flow-CSRF": ready.csrfToken }, body: "{}" });
      const loggedOut = await logout.json(); const final = await fetch("/api/browser-session"); const after = await final.json();
      return { read: reading.status, authenticated: ready.state, noCsrf: noCsrf.status, logout: logout.status, loggedOut: loggedOut.state,
        after: after.state, samePrincipal: retained.state === "ready" && retained.centerId === ready.centerId && retained.ownerPrincipalId === ready.ownerPrincipalId };
    });
    assert.deepEqual(result, { read: 200, authenticated: "ready", noCsrf: 403, logout: 200, loggedOut: "unauthenticated", after: "unauthenticated", samePrincipal: true });
    const afterCookies = (await context.cookies()).filter(value => value.name.startsWith("flow-session-"));
    if (correctedLogout) {
      assert.equal(afterCookies.length, 1); assert.equal(afterCookies[0]!.value, cookie.value, "Logout revokes server authority without deleting a possibly newer cookie");
    } else assert.equal(afterCookies.length, 0);
    await life.checkpoint(); await saveJson(fixture.input.output, "cookie-policy.json", { connection, ...result, flags, context: fixture.input.context,
      scope: "Independent real public Cookie/CSRF probe; retained Apps remain native Bearer clients", correctedLogout, secretsPersisted: false });
  } finally { await context.close(); }
}

async function openRecovery(page: Page) {
  const trigger = page.getByRole("button", { name: "Saved drafts and receipts", exact: true });
  if (!await trigger.isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
  await trigger.click(); const dialog = page.getByRole("dialog", { name: "Saved drafts and receipts", exact: true });
  await expect(dialog).toBeVisible(); return dialog;
}
async function savedDraft(page: Page, text: string) {
  const dialog = await openRecovery(page);
  const row = dialog.locator("li[data-recovery-record-id]").filter({ hasText: "Saved draft" }).filter({ hasText: text });
  await expect(row).toHaveCount(1); const id = await row.getAttribute("data-recovery-record-id"); assert.ok(id);
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); return id;
}
async function cookieReload(page: Page, fixture: ReleaseFixture, draft: string, progress: Progress) {
  advance(progress, "cookie-reload");
  const cookies = (await page.context().cookies()).filter(cookie => cookie.name.startsWith("flow-session-"));
  assert.equal(cookies.length, 1); assert.equal(cookies[0]!.httpOnly, true);
  const clean = await page.evaluate(token => ({
    cookieHidden: !document.cookie.includes("flow-session-"),
    tokenNotStored: ![localStorage, sessionStorage].some(store => Object.values(store).some(value => typeof value === "string" && value.includes(token))),
  }), fixture.token); assert.deepEqual(clean, { cookieHidden: true, tokenNotStored: true });
  await inputBox(page).fill(draft); const id = await savedDraft(page, draft);
  const posts = fixture.proxy.records.filter(record => record.method === "POST").length, start = fixture.proxy.records.length;
  await page.reload({ waitUntil: "domcontentloaded" }); await expect(inputBox(page)).toBeVisible();
  await expect(page.getByLabel("Owner token", { exact: true })).toHaveCount(0);
  assert.ok(fixture.proxy.records.slice(start).some(row => row.path === "/api/browser-session" && row.cookie && !row.bearer && row.status === 200));
  const dialog = await openRecovery(page), row = dialog.locator("li[data-recovery-record-id]").filter({ hasText: id });
  await expect(row).toHaveCount(1); await expect(row).toContainText(draft);
  await row.getByRole("button", { name: "Restore without sending", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(inputBox(page)).toHaveValue(draft);
  assert.equal(fixture.proxy.records.filter(record => record.method === "POST").length, posts, "Reload/restore cannot send");
  return { cookieHidden: clean.cookieHidden, tokenNotStored: clean.tokenNotStored, cookieRead: true, explicitRestoreNoPost: true };
}
/** A separate real page keeps the first request alive while the mounted App reconnects. No mocked response or cookie assignment. */
async function lateLogout(page: Page, fixture: ReleaseFixture, life: Lifetime, taskId: string, progress: Progress) {
  advance(progress, "late-logout"); progress.step = "running-task";
  assert.equal((await fixture.request(`/api/tasks/${taskId}`)).status, "running");
  progress.step = "cookie-stream";
  await until(async () => fixture.proxy.records.some(row => row.sse && row.cookie && !row.bearer && row.sse.chunks > 0 && !row.sse.closedAt), Boolean, life);
  const oldStreams = fixture.proxy.records.filter(row => row.sse && row.cookie && !row.bearer && !row.sse.closedAt);
  const probe = await page.context().newPage(); let pending: Promise<{ status: number; state: string }> | undefined;
  const recordStart = fixture.proxy.records.length;
  try {
    await probe.goto(fixture.input.context.publicOrigin + "/__flow_compat_probe");
    progress.step = "held-response";
    fixture.proxy.holdNextLogout();
    pending = probe.evaluate(async () => {
      const ready = await (await fetch("/api/browser-session")).json();
      if (ready.state !== "ready") throw Error("Expected old ready session");
      const response = await fetch("/api/browser-session/logout", { method: "POST", headers: { "content-type": "application/json", "X-Flow-CSRF": ready.csrfToken }, body: "{}" });
      return { status: response.status, state: (await response.json()).state };
    }); void pending.catch(() => {});
    const held = await until(async () => fixture.proxy.records.slice(recordStart).find(row => row.logoutHold?.received), Boolean, life);
    assert.ok(held?.logoutHold); assert.equal(held.logoutHold.released, false);
    progress.step = "old-read-revoked";
    const revoked = await probe.evaluate(async () => (await (await fetch("/api/browser-session")).json()).state);
    assert.equal(revoked, "unauthenticated");
    progress.step = "old-streams-closed";
    await until(async () => oldStreams.every(row => row.sse!.closedAt !== null), Boolean, life);
    progress.step = "reconnect";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByLabel("Owner token", { exact: true }).fill(fixture.token);
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(inputBox(page)).toBeVisible();
    const before = (await page.context().cookies()).filter(cookie => cookie.name.startsWith("flow-session-")); assert.equal(before.length, 1);
    progress.step = "release-old-response";
    fixture.proxy.releaseLogout(); assert.deepEqual(await pending, { status: 200, state: "unauthenticated" });
    await until(async () => held.logoutHold!.downstreamFinished, Boolean, life);
    assert.equal(held.logoutHold.setCookie, false, "Real corrected logout response must not delete a newer cookie");
    const after = (await page.context().cookies()).filter(cookie => cookie.name.startsWith("flow-session-"));
    assert.equal(after.length, 1); assert.equal(after[0]!.value, before[0]!.value);
    progress.step = "new-session-ready";
    const ready = await page.evaluate(async () => (await (await fetch("/api/browser-session")).json()).state); assert.equal(ready, "ready");
    assert.equal((await fixture.request(`/api/tasks/${taskId}`)).status, "running", "Logout must not cancel the running task");
    return { actualHeldHeaders: true, oldReadRevoked: true, oldStreamsClosed: true, newerCookiePreserved: true, newerReadReady: true, runningTaskPreserved: true };
  } finally { await probe.close(); if (pending) await pending.catch(() => {}); }
}
async function retryCookieReceipt(page: Page, fixture: ReleaseFixture, id: string, draft: string, originalPosts: number) {
  const dialog = await openRecovery(page);
  const row = dialog.locator("li[data-recovery-record-id]").filter({ hasText: "outbox receipt" }).filter({ hasText: id });
  await expect(row).toHaveCount(1); await expect(row).toContainText("unknown");
  assert.equal(fixture.proxy.records.filter(record => record.method === "POST" && /\/turns$/.test(record.path)).length, originalPosts);
  await row.getByRole("button", { name: "Retry original request", exact: true }).click();
  await expect(row).toContainText("accepted"); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  await restoreSavedDraft(page, draft);
}
async function restoreSavedDraft(page: Page, draft: string) {
  const saved = await openRecovery(page), next = saved.locator("li[data-recovery-record-id]").filter({ hasText: "Saved draft" }).filter({ hasText: draft });
  await expect(next).toHaveCount(1); await next.getByRole("button", { name: "Restore without sending", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(saved).not.toBeVisible(); await expect(inputBox(page)).toHaveValue(draft);
}

async function checkApp(browser: Browser, fixture: ReleaseFixture, app: LoadedApp, life: Lifetime, progress: Progress, cookieApp = false, diagnosticOnly = false) {
  assert.ok(!diagnosticOnly || cookieApp, "Only the real Cookie App is admitted to this diagnostic");
  fixture.proxy.select(app); const start = fixture.proxy.records.length;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage(); page.setDefaultTimeout(10_000);
  const pageErrors: string[] = [], consoleErrors: Array<{ text: string; path: string }> = [], loadedAssets: Array<{ path: string; sha256: string }> = [];
  const assetReads: Promise<void>[] = []; let selectedObservation: ReturnType<typeof observeFault> | undefined;
  const text = `Release ${app.label} durable message`, draft = `Independent ${app.label} draft`;
  page.on("pageerror", error => pageErrors.push(error.name));
  page.on("console", message => { if (message.type() === "error" && consoleErrors.length < 64) { const url = message.location().url;
    consoleErrors.push({ text: message.text().slice(0, 300), path: url ? new URL(url).pathname : "" }); } });
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === fixture.input.context.publicOrigin && response.status() === 200 && /\.(js|css)$/.test(url.pathname)) {
      const read = response.body().then(bytes => { assert.ok(loadedAssets.length < (cookieApp ? 128 : 40)); loadedAssets.push({ path: url.pathname, sha256: hash(bytes) }); });
      // Attach a rejection handler immediately, preserving the original promise for later failure.
      void read.catch(() => {}); assetReads.push(read);
    }
  });
  let completed: Record<string, unknown> | undefined;
  let cookieEvidence: unknown = null, logoutEvidence: unknown = null;
  try {
    advance(progress, "app-connect", app.label);
    await life.checkpoint(); await connect(page, fixture);
    if (cookieApp) cookieEvidence = await cookieReload(page, fixture, `Saved before release ${app.label}`, progress);
    // This is Chrome page fetch, never page.request/context.request/route.fetch/Node fetch(publicOrigin).
    const index = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch("/", { cache: "no-store" })).arrayBuffer())));
    assert.equal(hash(Buffer.from(index)), app.files.find(file => file.path === "index.html")!.sha256);
    advance(progress, "profile");
    await page.getByRole("button", { name: "Execution profile: Runner default", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Execution profile", exact: true });
    const profile = dialog.getByRole("radio", { name: /release-synthetic/ }); await expect(profile).toHaveCount(1); await profile.check();
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    advance(progress, "ack-loss");
    await inputBox(page).fill(text); selectedObservation = observeFault(page, text, life); fixture.proxy.arm();
    await page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true }).click();
    await expect(inputBox(page)).toHaveValue(""); await inputBox(page).fill(draft);
    const receipt = page.getByRole("region", { name: "Message receipt", exact: true }); await expect(receipt).toContainText("Receipt unknown"); await expect(inputBox(page)).toHaveValue(draft);
    const lost = await selectedObservation.read(); selectedObservation.stop(); selectedObservation = undefined;
    const first = fixture.proxy.records.slice(start).find(record => record.fault); assert.ok(first?.fault && first.response && first.key && first.body);
    await until(async () => first.fault!.socketClosed, Boolean, life);
    assert.ok(first.complete && (cookieApp ? first.cookie && first.csrf && !first.bearer : first.bearer) && first.fault.headersFlushed && first.fault.prefixFlushed && first.fault.endFlushed && !first.fault.error);
    assert.equal(lost.path, first.path); assert.equal(lost.key, first.key); assert.equal(lost.bodySha256, hash(first.body)); assert.equal(lost.contentLength, first.fault.contentLength);
    assert.equal(first.fault.prefixBytes, 1); assert.ok(first.fault.prefixBytes < first.fault.contentLength);
    const posts = () => fixture.proxy.records.slice(start).filter(record => record.method === "POST" && record.path === first.path);
    assert.equal(posts().length, 1, "Exactly one POST before explicit Retry");
    const accepted = first.response, conversationId = accepted.conversation.id, taskId = accepted.turn.task.id;
    assert.equal(typeof taskId, "string"); assert.ok(taskId.length); let recoveryId: string | undefined;
    if (cookieApp) {
      await savedDraft(page, draft); const dialog = await openRecovery(page);
      const row = dialog.locator("li[data-recovery-record-id]").filter({ hasText: "outbox receipt" }).filter({ hasText: "unknown" });
      await expect(row).toHaveCount(1); recoveryId = (await row.getAttribute("data-recovery-record-id"))!;
      assert.ok(recoveryId); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    }
    advance(progress, "task-completion"); await fixture.completeTask(taskId, text, cookieApp ? async () => {
      advance(progress, "durable-retry"); assert.ok(recoveryId); progress.step = "unknown-reload";
      await page.reload({ waitUntil: "domcontentloaded" }); await expect(inputBox(page)).toBeVisible();
      assert.equal(posts().length, 1, "Reload must not retry the unknown turn");
      progress.step = "original-retry";
      await retryCookieReceipt(page, fixture, recoveryId, draft,
        fixture.proxy.records.filter(record => record.method === "POST" && /\/turns$/.test(record.path)).length);
      progress.step = "accepted-identity";
      assert.equal(posts().length, 2); const recovered = posts()[1]!;
      assert.ok(recovered.cookie && recovered.csrf && !recovered.bearer);
      assert.equal(recovered.key, first.key); assert.equal(recovered.body, first.body);
      assert.equal(recovered.response?.replayed, true); assert.equal(recovered.response?.turn.id, accepted.turn.id);
      assert.equal(recovered.response?.turn.task.id, taskId); await expect(receipt).toHaveCount(0); await expect(inputBox(page)).toHaveValue(draft);
      logoutEvidence = await lateLogout(page, fixture, life, taskId, progress);
      assert.equal(posts().length, 2, "Re-authentication must not create another turn request");
      progress.step = "draft-restore"; await restoreSavedDraft(page, draft);
      assert.equal(posts().length, 2, "Restoring the independent draft cannot send");
    } : undefined);
    const finalTask = await until(() => fixture.request(`/api/tasks/${taskId}`), value => value.status === "succeeded", life); assert.equal(finalTask.verificationStatus, "passed");
    if (diagnosticOnly) {
      // Capture the exact public chain; console failures remain observations, never a formal compatibility allowance.
      await Promise.all(assetReads); assert.deepEqual(pageErrors, []); assert.ok(cookieEvidence && logoutEvidence);
      completed = { diagnosticOnly: true, label: app.label, artifact: app.artifact, conversationId, taskId,
        cookieEvidence, logoutEvidence, originalRequestRecovered: true, finalTaskSucceeded: true, consoleErrors, providerQueries: 0 };
      return completed;
    }
    advance(progress, "explicit-retry");
    if (!cookieApp) await page.getByRole("button", { name: "Retry same message", exact: true }).click();
    await expect(receipt).toHaveCount(0); await expect(inputBox(page)).toHaveValue(draft);
    await expect(page.getByText(`Release fixture reply: ${text}`, { exact: true })).toBeVisible();
    assert.equal(posts().length, 2); const recovered = posts()[1]!;
    if (cookieApp) assert.ok(recovered.cookie && recovered.csrf && !recovered.bearer, "Recovered mutation requires Cookie and CSRF browser-session authority");
    assert.equal(recovered.key, first.key); assert.equal(recovered.body, first.body);
    assert.equal(recovered.response?.replayed, true); assert.equal(recovered.response?.turn.id, accepted.turn.id); assert.equal(recovered.response?.turn.task.id, taskId);
    assert.equal((await fixture.request(`/api/conversations/${conversationId}/turns`)).turns.length, 1);
    const negotiated = await until(async () => fixture.proxy.records.slice(start).find(record => record.path === `/api/conversations/${conversationId}` && record.forwardedStream === "patch-v1" && record.response?.conversation?.id === conversationId), Boolean, life);
    assert.ok(negotiated); assert.equal(negotiated.response!.capabilities.liveAssistantText, true);
    await until(async () => fixture.proxy.records.slice(start).some(record => record.sse && record.sse.chunks > 0 && record.sse.firstChunkAt !== null && (cookieApp ? record.cookie && !record.bearer : record.bearer)), Boolean, life);
    advance(progress, "legacy-read");
    fixture.proxy.setLegacy(true);
    if (cookieApp) { await page.reload({ waitUntil: "domcontentloaded" }); await expect(inputBox(page)).toBeVisible(); }
    else await connect(page, fixture);
    const nav = page.getByRole("navigation", { name: "Conversations", exact: true }); const chats = page.getByRole("button", { name: "Chats", exact: true });
    if (!/\bactive\b/.test(await chats.getAttribute("class") ?? "")) await chats.click(); await expect(nav).toBeVisible();
    await nav.getByRole("button", { name: text, exact: true }).click(); await expect(page.getByText(`Release fixture reply: ${text}`, { exact: true })).toBeVisible();
    const legacy = fixture.proxy.records.slice(start).findLast(record => record.path === `/api/conversations/${conversationId}` && !record.forwardedStream && record.response?.conversation?.id === conversationId);
    assert.ok(legacy); assert.equal(legacy.response!.capabilities.liveAssistantText, false);
    const directory = fixture.proxy.records.slice(start).find(record => record.path.startsWith("/api/execution-profiles") && !record.profile && record.response?.profiles);
    assert.ok(directory?.response!.profiles.some((value: { reference: { id: string } }) => value.reference.id === fixture.profile.reference.id));
    const negotiation = await page.evaluate(async ({ token, id, cookieApp }) => {
      const denied = await fetch(`/api/conversations/${id}`);
      const explicit = await fetch("/api/execution-profiles", { headers: { ...(cookieApp ? {} : { authorization: `Bearer ${token}` }), "X-Flow-Execution-Profile": "steering-v1" } });
      return { denied: denied.status, status: explicit.status, profiles: (await explicit.json()).profiles };
    }, { token: cookieApp ? "" : fixture.token, id: conversationId, cookieApp });
    assert.equal(negotiation.denied, cookieApp ? 200 : 401); assert.equal(negotiation.status, 200);
    assert.ok(negotiation.profiles.some((value: { reference: { id: string; configDigest: string } }) => value.reference.id === fixture.profile.reference.id && value.reference.configDigest === fixture.profile.reference.configDigest));
    advance(progress, "asset-observation");
    await Promise.all(assetReads); assert.deepEqual(pageErrors, []);
    assert.ok(consoleErrors.every(error => error.path === first.path && /ERR_CONTENT_LENGTH_MISMATCH|ERR_FAILED|ERR_CONNECTION_CLOSED/.test(error.text)
      || error.path === `/api/conversations/${conversationId}` && /401/.test(error.text)
      || cookieApp && /401/.test(error.text) && fixture.proxy.records.slice(start).some(row => row.path === error.path && row.cookie && !row.bearer && row.status === 401)
      || error.path === "/favicon.ico" && /404/.test(error.text)), "Unexpected console errors");
    for (const asset of loadedAssets) { const expected = app.snapshot.assets.get(asset.path); assert.ok(expected, "Loaded asset is not in exact manifest namespace"); assert.equal(asset.sha256, expected.sha256); }
    assert.ok(loadedAssets.some(asset => asset.path.endsWith(".js")) && loadedAssets.some(asset => asset.path.endsWith(".css")));
    const observations = {
      read: { ownerAuthenticated: cookieApp ? negotiation.denied === 200 && first.cookie && !first.bearer : negotiation.denied === 401 && first.bearer, conversationBound: legacy.response!.conversation.id === conversationId, taskBound: legacy.response!.lastTurn.task.id === taskId },
      send: { acceptedTurnBound: accepted.turn.conversationId === conversationId && accepted.turn.user.text === text && accepted.turn.number === 1, requestedProfilePreserved: JSON.stringify(accepted.conversation.executionProfile) === JSON.stringify(fixture.profile.reference) },
      recover: { sameKey: recovered.key === first.key, sameBody: recovered.body === first.body, sameTurn: recovered.response!.turn.id === accepted.turn.id },
      negotiation: { legacyReadable: legacy.response!.capabilities.liveAssistantText === false, streamHeaderHandled: negotiated.response!.capabilities.liveAssistantText === true, profileHeaderHandled: negotiation.status === 200 && negotiation.profiles.some((value: { reference: { id: string } }) => value.reference.id === fixture.profile.reference.id) },
    };
    completed = { label: app.label, artifact: app.artifact, observations, conversationId, taskId, fault: lost, loadedAssets, pageErrors, consoleErrors, auth: cookieApp ? "new immutable App HttpOnly session and CSRF" : "original retained App Bearer", cookieEvidence, logoutEvidence, providerQueries: 0 };
  } finally {
    selectedObservation?.stop(); await context.close();
    await saveJson(fixture.input.output, `${app.label}-wire.json`, fixture.proxy.records.slice(start));
    await saveJson(fixture.input.output, `${app.label}-page.json`, { pageErrors, consoleErrors, loadedAssets, completed: Boolean(completed), diagnosticOnly });
  }
  assert.ok(completed); return completed;
}
async function importReports(fixture: ReleaseFixture, results: Awaited<ReturnType<typeof checkApp>>[]) {
  const state = join(fixture.input.output, "compatibility-state"); await mkdir(state, { mode: 0o700 }); const records = [];
  for (const result of results) {
    const label = String(result.label), artifact = result.artifact as LoadedApp["artifact"];
    const directory = join(fixture.input.output, label); await mkdir(directory, { mode: 0o700 }); const checks: Record<string, string> = {};
    for (const [check, observations] of Object.entries(result.observations as Record<string, Record<string, boolean>>)) {
      assert.ok(Object.values(observations).every(value => value === true));
      const raw = JSON.stringify({ format: 2, check, backendHead: fixture.input.finalBackend.artifact.sourceHead, artifactId: artifact.artifactId, context: fixture.input.context, observations });
      assert.ok(Buffer.byteLength(raw) <= 4096); checks[check] = hash(raw); await writeFile(join(directory, `${check}.json`), raw, { flag: "wx", mode: 0o600 });
    }
    const report = { format: 2, policy: "flow-web-api-v2", backendHead: fixture.input.finalBackend.artifact.sourceHead, artifact, context: fixture.input.context, checks };
    assert.ok(Buffer.byteLength(JSON.stringify(report)) <= 4096); await writeFile(join(directory, "report.json"), JSON.stringify(report), { flag: "wx", mode: 0o600 });
    const compatibilityId = await fixture.tools.importWebCompatibility({ directory: state, reportDirectory: directory });
    await fixture.tools.verifyWebCompatibility({ directory: state, artifact, backendHead: report.backendHead, compatibilityId, expectedContext: fixture.input.context });
    records.push({ label, artifact, compatibilityId });
  }
  return records;
}
/** Called only by an admitted owned-process caller; importing this file never starts PG/Chrome/HTTP. */
export async function runReleaseCompatibility(admission: Admission, adminUrl: string, life: OwnedBrowserLifetime) {
  return runApps(admission, adminUrl, life);
}
/** New candidate entry: descriptors absent/wrong fails before fixture/PG/Chrome, never falls back to historical three-App evidence. */
export async function runRecoveryReleaseCompatibility(admission: RecoveryAdmission, adminUrl: string, life: OwnedBrowserLifetime) {
  assertRecoveryAdmission(admission); return runApps(admission, adminUrl, life, admission.recoveryApp);
}
/** No legacy App journey or report import. Completion means bounded diagnostic capture, not compatibility approval. */
export async function runRecoveryCookieDiagnostic(admission: RecoveryAdmission, adminUrl: string, life: OwnedBrowserLifetime) {
  assertRecoveryAdmission(admission); return runApps(admission, adminUrl, life, admission.recoveryApp, true);
}
async function runApps(admission: Admission, adminUrl: string, life: OwnedBrowserLifetime, recoveryApp?: RecoveryAdmission["recoveryApp"], diagnosticOnly = false) {
  assert.ok(!diagnosticOnly || recoveryApp);
  const expected = diagnosticOnly ? 1 : recoveryApp ? 4 : 3;
  const startedAt = new Date().toISOString(); await life.checkpoint();
  let fixture: ReleaseFixture | undefined, chrome: Awaited<ReturnType<OwnedBrowserLifetime["launchOwnedChrome"]>> | undefined;
  const results: Awaited<ReturnType<typeof checkApp>>[] = [], errors: string[] = []; let cleanup: unknown, reports: unknown = null;
  const progress: Progress = { phase: "not-started", app: null, step: null, completed: [] }; let failedAt: { phase: Phase; app: string | null; step: CookieStep | null } | null = null;
  try {
    advance(progress, "fixture");
    fixture = await startReleaseFixture(admission, adminUrl, life, recoveryApp,
      diagnosticOnly ? () => ({ phase: progress.phase, step: progress.step }) : undefined); await life.checkpoint();
    advance(progress, "chrome");
    chrome = await life.launchOwnedChrome({ proxyUrl: fixture.proxy.url, proxyBypassList: "<-loopback>" }); await life.checkpoint();
    assert.ok(chrome.receipt.pid > 0 && chrome.receipt.pgid > 0); assert.match(chrome.receipt.executableSha256, /^[a-f0-9]{64}$/);
    assert.ok(chrome.receipt.argv.includes(`--proxy-server=${fixture.proxy.url}`) && chrome.receipt.argv.includes("--proxy-bypass-list=<-loopback>"));
    assert.ok(!chrome.receipt.argv.some(arg => /^(--no-sandbox|--proxy-pac-url|--no-proxy-server)(=|$)/.test(arg)));
    await saveJson(admission.output, "owned-chrome.json", chrome.receipt);
    advance(progress, "canary");
    const canary = await chrome.browser.newContext({ serviceWorkers: "block" });
    try { const page = await canary.newPage(); await page.goto(fixture.proxy.canaryUrl, { waitUntil: "domcontentloaded" }); await expect(page.locator("body")).toHaveText("OWNED_PROXY_ROUTE"); fixture.proxy.assertCanary(); }
    finally { await canary.close(); }
    if (!diagnosticOnly) await cookiePolicy(chrome.browser, fixture, life, progress, Boolean(recoveryApp));
    const selected = diagnosticOnly ? fixture.apps.filter(app => app.artifact.artifactId === recoveryApp!.artifact.artifactId) : fixture.apps;
    assert.equal(selected.length, expected);
    for (const app of selected) { await life.checkpoint(); results.push(await checkApp(chrome.browser, fixture, app, life, progress, app.artifact.artifactId === recoveryApp?.artifact.artifactId, diagnosticOnly)); }
    assert.equal(results.length, expected);
  } catch (error) { failedAt = { phase: progress.phase, app: progress.app, step: progress.step }; errors.push(errorCode(error)); }
  finally {
    if (chrome) try { await chrome.close(); } catch (error) { errors.push("chrome-cleanup:" + errorCode(error)); }
    if (fixture) {
      try { cleanup = await fixture.close(); assert.deepEqual((cleanup as { errors: string[] }).errors, []); } catch (error) { errors.push("fixture-cleanup:" + errorCode(error)); }
      try { await fixture.proxy.settle(); } catch (error) { errors.push("proxy-observation:" + errorCode(error)); }
      try { await saveJson(admission.output, "all-wire.json", fixture.proxy.records); } catch (error) { errors.push("wire-evidence:" + errorCode(error)); }
    }
  }
  // No success reports are imported before Chrome/HTTP/DB cleanup has completed successfully.
  if (!diagnosticOnly && fixture && errors.length === 0 && results.length === expected) {
    try { advance(progress, "reports", null); await life.checkpoint(); reports = await importReports(fixture, results); await life.checkpoint(); advance(progress, "done", null); } catch (error) { failedAt = { phase: progress.phase, app: progress.app, step: progress.step }; errors.push("report:" + errorCode(error)); }
  }
  const diagnosticEvidence = diagnosticOnly ? fixture?.diagnosticEvidence() ?? null : null;
  const result = { startedAt, finishedAt: new Date().toISOString(), results, errors, progress, failedAt, reports, cleanup: cleanup ?? null,
    diagnosticOnly, diagnosticComplete: diagnosticOnly && errors.length === 0 && results.length === 1 && diagnosticEvidence?.complete === true,
    diagnosticEvidence, passed: !diagnosticOnly && errors.length === 0 && results.length === expected && reports !== null, publicContext: admission.context, providerQueries: 0 };
  await saveJson(admission.output, "browser-results.json", result);
  assert.equal(diagnosticOnly ? result.diagnosticComplete : result.passed, true,
    diagnosticOnly ? "Diagnostic incomplete; preserve raw and owned cleanup" : "Compatibility incomplete; preserve failed raw and owned cleanup"); return result;
}
