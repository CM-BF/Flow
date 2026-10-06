import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { evidence, root, startRecoveryFixture } from "./conversation-recovery.fixture";

if (process.env.FLOW_RECOVERY_BROWSER !== "1") throw Error("Separate real browser/PG resource approval is required.");
const label = process.argv[2] ?? "first";
if (!/^[a-z0-9-]+$/.test(label)) throw Error("Use a simple, unique evidence label.");
const entries = await readdir(evidence), budgets = entries.filter(name => name.endsWith("-browser-budget.json"));
let priorMs = 0;
for (const file of budgets) {
  const old = JSON.parse(await readFile(evidence + file, "utf8"));
  if (!old.endedAt || !Number.isFinite(old.elapsedMs)) throw Error("Prior experiment has no settled budget/cleanup record. Reconcile it before another run.");
  priorMs += old.elapsedMs;
}
if (entries.includes(label + "-browser-budget.json")) throw Error("Evidence label already exists; never overwrite a prior run.");
const availableMs = 90_000 - priorMs, cleanupReserveMs = 15_000;
if (availableMs < 30_000) throw Error("Insufficient remaining cumulative budget. No automatic extension.");
const started = Date.now(), checks: string[] = [], pageErrors: string[] = [], limitations = ["Development App through real production createServer and isolated PG; no production build/provider.", "Cross-center namespace/CAS failure injection uses direct controlled tests; this browser run uses one real center.", "Center caller-Origin/late logout cookie/repeated-connect semantics require their independent frozen input acceptance."];
let fixture: Awaited<ReturnType<typeof startRecoveryFixture>> | undefined, browser: Browser | undefined, failure: string | null = null;
const lifetime = new AbortController(), workMs = availableMs - cleanupReserveMs;
const sourcePaths = ["apps/web/src/App.tsx", "apps/web/src/connection/session.ts", "apps/web/src/recovery/journal.ts", "apps/web/src/recovery/binding.tsx", "apps/web/src/conversations/ConversationThread.tsx", "apps/web/src/conversations/outbox.ts", "apps/web/src/conversations/projection.ts", "apps/web/src/conversations/queue/commands.ts", "apps/web/src/conversation-steering/control.ts", "apps/web/src/conversation-steering/SteeringControl.tsx", "apps/web/src/conversation-context/controller.ts", "apps/web/src/attachments/controller.ts", "apps/web/src/plugin-integration/attachments.tsx", "apps/web/src/plugin-integration/knowledge.tsx", "apps/web/src/plugin-integration/session.ts", "apps/web/src/plugin-integration/steering.tsx", "apps/web/test/conversation-recovery.test.ts", "apps/web/test/conversation-recovery.fixture.ts", "apps/web/test/conversation-recovery.browser.ts"];
const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const provenance = { sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), dirty: !!execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(), sourceHashes };
await writeFile(evidence + label + "-browser-budget.json", JSON.stringify({ startedAt: new Date(started).toISOString(), priorMs, workMs, cleanupReserveMs }));
const deadline = setTimeout(() => { lifetime.abort(Error("Work budget ended; cleanup time is reserved.")); void browser?.close().catch(() => {}); }, workMs);
const postRows = () => fixture!.wire.filter(row => row.method === "POST" && !row.path.includes("browser-session"));
async function records(page: Page): Promise<{ id: string; kind: string; phase?: string; version: number; owner: { viewKey: string; routeId: string }; data?: { text?: string; intent?: string }; frozen?: unknown }[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("flow.conversation-recovery.v1", 1);
    request.onerror = () => reject(Error("Cannot read test journal."));
    request.onsuccess = () => { const database = request.result, transaction = database.transaction("records", "readonly"), get = transaction.objectStore("records").getAll(); transaction.oncomplete = () => { const result = get.result; database.close(); resolve(result); }; transaction.onabort = () => { database.close(); reject(Error("Test readonly transaction aborted.")); }; };
  }));
}
const run = async (name: string, operation: () => Promise<void>) => { lifetime.signal.throwIfAborted(); await operation(); checks.push(name); };
try {
  fixture = await startRecoveryFixture(label, lifetime.signal); lifetime.signal.throwIfAborted();
  browser = await chromium.launch({ channel: "chrome", headless: true, timeout: Math.min(10_000, workMs) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(4500); page.on("pageerror", error => pageErrors.push(error.message));
  const input = (target = page) => target.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
  const openRecovery = async (target = page) => {
    const trigger = target.getByRole("button", { name: "Saved drafts and receipts", exact: true });
    if (!await trigger.isVisible()) await target.getByRole("button", { name: "Chats", exact: true }).click();
    await trigger.click(); const dialog = target.getByRole("dialog", { name: "Saved drafts and receipts", exact: true }); await expect(dialog).toBeVisible(); return dialog;
  };
  await run("actual browser stores HttpOnly cookie; public cookie-only session read opens original center", async () => {
    await page.goto(fixture!.url + `#conversation=${fixture!.conversationId}`);
    await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(input()).toBeVisible();
    expect((await context.cookies()).some(cookie => cookie.name.startsWith("flow-session-") && cookie.httpOnly)).toBe(true);
    expect(fixture!.wire.some(row => row.path === "/api/browser-session" && row.cookie && !row.bearer && row.status === 200)).toBe(true);
  });
  let draftId = "";
  await run("complete text and delivery intent survive reload and explicit restore without mutation", async () => {
    await input().fill("Original recovery draft 中文🙂"); await page.getByRole("radio", { name: "Queue next", exact: true }).check();
    await expect.poll(async () => (await records(page)).some(record => record.kind === "draft" && record.data?.text === "Original recovery draft 中文🙂" && record.data.intent === "queue")).toBe(true);
    draftId = (await records(page)).find(record => record.data?.text === "Original recovery draft 中文🙂")!.id;
    const posts = postRows().length; await page.reload(); await expect(input()).toBeVisible();
    const dialog = await openRecovery(), row = dialog.locator("li").filter({ hasText: "Saved draft" }).filter({ hasText: `conversation:${fixture!.conversationId}` });
    await row.getByRole("button", { name: "Restore without sending", exact: true }).click(); await page.keyboard.press("Escape");
    await expect(input()).toHaveValue("Original recovery draft 中文🙂"); await expect(page.getByRole("radio", { name: "Queue next", exact: true })).toBeChecked(); expect(postRows()).toHaveLength(posts);
  });
  await run("two actual tabs cannot overwrite the same restored draft version", async () => {
    const other = await context.newPage(); other.setDefaultTimeout(4500); other.on("pageerror", error => pageErrors.push(error.message));
    await other.goto(fixture!.url + `#conversation=${fixture!.conversationId}`); await expect(input(other)).toBeVisible();
    const dialog = await openRecovery(other); await dialog.locator("li").filter({ hasText: "Saved draft" }).filter({ hasText: `conversation:${fixture!.conversationId}` }).getByRole("button", { name: "Restore without sending", exact: true }).click(); await other.keyboard.press("Escape");
    await page.bringToFront(); await input().fill("Tab A protected draft"); await expect.poll(async () => (await records(page)).find(record => record.id === draftId)?.data?.text).toBe("Tab A protected draft");
    await other.bringToFront(); await input(other).fill("Tab B conflict stays local"); await expect(other.getByRole("alert").filter({ hasText: "another tab" }).first()).toBeVisible();
    expect((await records(page)).find(record => record.id === draftId)?.data?.text).toBe("Tab A protected draft"); await other.close(); await page.bringToFront();
  });
  await run("lost turn ACK preserves exact key/body; reload and re-auth read never submit; explicit retry replays", async () => {
    await page.getByRole("radio", { name: "Send now", exact: true }).check(); fixture!.dropNext("turn"); await input().press("Enter");
    await expect(page.getByRole("region", { name: "Message receipt", exact: true })).toContainText("Receipt unknown");
    const first = postRows().find(row => /\/turns$/.test(row.path))!; expect(first.fault).toBeTruthy();
    await input().fill("Next draft stays independent"); await expect.poll(async () => (await records(page)).some(record => record.data?.text === "Next draft stays independent")).toBe(true);
    const posts = postRows().length; await page.reload(); await expect(input()).toBeVisible(); expect(postRows()).toHaveLength(posts);
    const dialog = await openRecovery(); const command = dialog.locator("li").filter({ hasText: "outbox receipt" }); await expect(command).toHaveCount(1);
    await command.getByRole("button", { name: "Retry original request", exact: true }).click(); await expect.poll(() => postRows().filter(row => /\/turns$/.test(row.path)).length).toBe(2);
    const retry = postRows().filter(row => /\/turns$/.test(row.path))[1]!; expect({ key: retry.key, body: retry.body }).toEqual({ key: first.key, body: first.body });
    await expect.poll(async () => (await records(page)).find(record => record.kind === "command")?.phase).toBe("accepted");
    await page.keyboard.press("Escape"); expect((await records(page)).some(record => record.data?.text === "Next draft stays independent")).toBe(true);
    expect(fixture!.wire.some(row => /\/stream/.test(row.path) && row.cookie && !row.bearer && row.status === 200)).toBe(true);
  });
  await run("expiry hides prior principal material; explicit reconnect does not replay; CSRF remains required", async () => {
    const posts = postRows().length; await fixture!.expireSessions(); await page.reload(); await expect(page.getByRole("heading", { name: "Connect to Flow", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Saved drafts and receipts", exact: true })).not.toBeVisible();
    await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(input()).toBeVisible(); expect(postRows()).toHaveLength(posts);
    const status = await page.evaluate(async () => (await fetch("/api/conversations", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" })).status); expect(status).toBe(403);
    await context.setOffline(true); await expect(page.getByText("Offline. Drafts and pending commands have not been cancelled.", { exact: true })).toBeVisible(); await context.setOffline(false); await expect(input()).toBeVisible();
  });
  await run("recovery disclosure is keyboard reachable and readable at 390 in both themes", async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
      const dialog = await openRecovery(); await expect(dialog).toBeVisible();
      const rect = await dialog.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, width: element.getBoundingClientRect().width })); expect(rect.scroll).toBeLessThanOrEqual(rect.client + 1);
      await page.screenshot({ path: evidence + label + "-" + theme + "-390.png" }); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Saved drafts and receipts", exact: true })).toBeFocused();
    }
  });
  expect(pageErrors).toEqual([]);
} catch (error) { failure = String(error); }
finally {
  clearTimeout(deadline); lifetime.abort(); const cleanupErrors: string[] = [];
  try { await browser?.close(); } catch (error) { cleanupErrors.push("browser: " + String(error)); }
  try { await fixture?.close(); } catch (error) { cleanupErrors.push("fixture: " + String(error)); }
  const elapsedMs = Date.now() - started;
  await writeFile(evidence + label + "-browser.json", JSON.stringify({ ...provenance, checks, pageErrors, failure, limitations, wire: fixture?.wire ?? [], elapsedMs, priorMs, cleanupErrors }, null, 2));
  await writeFile(evidence + label + "-browser-budget.json", JSON.stringify({ startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(), elapsedMs, priorMs, cumulativeMs: priorMs + elapsedMs, workMs, cleanupReserveMs, cleanupErrors }, null, 2));
  let bytes = 0; for (const file of await readdir(evidence)) { const entry = await stat(evidence + file); if (entry.isFile()) bytes += entry.size; }
  if (failure || cleanupErrors.length || priorMs + elapsedMs > 90_000 || bytes > 8 * 1024 * 1024) { process.exitCode = 1; console.error(JSON.stringify({ failure, cleanupErrors, cumulativeMs: priorMs + elapsedMs, evidenceBytes: bytes })); }
  else console.log(JSON.stringify({ checks, cumulativeMs: priorMs + elapsedMs, evidenceBytes: bytes }));
}
