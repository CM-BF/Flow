import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { startLifecycleFixture } from "./workspace-lifecycle.fixture";

const expect = baseExpect.configure({ timeout: 2500 });
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = root + "docs/evidence/wpf-workspace-lifecycle-baseline/";
const paths = ["apps/web/test/workspace-lifecycle.fixture.ts", "apps/web/test/workspace-lifecycle.browser.ts"];
const dependencies = execFileSync("git", ["ls-files", "apps/web/src", "packages/client/src", "packages/contracts/src", "apps/web/test/fixture-server.ts", "apps/web/test/workspace-fixture.ts", "apps/web/test/conversation.fixture.ts", "apps/web/test/conversation-queue.fixture.ts", "apps/web/test/conversation-stream-integration.fixture.ts", "apps/web/test/conversation-context-integration.fixture.ts", "apps/web/test/execution-profile-integration.fixture.ts"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const hashes = async (files: string[]) => Object.fromEntries(await Promise.all(files.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceDirty = execFileSync("git", ["status", "--porcelain=v1"], { cwd: root, encoding: "utf8" }).trim();
await mkdir(output, { recursive: true });
const sourceHashes = await hashes(paths), dependencyHashes = await hashes(dependencies);
const startedAt = Date.now(), actionDeadline = startedAt + 80_000;
const runId = new Date(startedAt).toISOString().replaceAll(":", "-");
const prefix = `${output}${runId}`;
const checks: string[] = [], failures: { name: string; error: string }[] = [], errors: string[] = [];
const samples: unknown[] = [], lifecycle: unknown[] = [], cleanupErrors: string[] = [];
let preview: Awaited<ReturnType<typeof startLifecycleFixture>> | undefined, browser: Browser | undefined, page: Page | undefined;
let deadlineReached = false, cleanupComplete = false;
const actionsTimer = setTimeout(() => { deadlineReached = true; void browser?.close().catch(error => cleanupErrors.push(String(error))); }, 80_000);
const hardTimer = setTimeout(() => { console.error("HARD BUDGET EXHAUSTED: cleanup incomplete"); writeFileSync(prefix + "-hard-timeout.json", JSON.stringify({ elapsedMs: Date.now() - startedAt, cleanupComplete: false, status: "partial", reason: "90 second hard stop; cleanup unconfirmed" })); process.exit(2); }, 90_000);
const remaining = () => Math.max(1, Math.min(3000, actionDeadline - Date.now()));
function available() { if (Date.now() >= actionDeadline || deadlineReached) throw Error("Action budget exhausted; reserving cleanup time."); }
async function check(name: string, run: () => Promise<void>) {
  available(); try { await run(); checks.push(name); console.log("PASS", name); }
  catch (error) { failures.push({ name, error: String(error) }); console.error("FAIL", name, String(error)); }
}
const pane = (n: number) => page!.locator(`[id="panel-conversation:chat-${n}"]`);
const input = (n: number) => pane(n).getByRole("textbox", { name: "Message input", exact: true });
async function open(n: number) {
  available(); await page!.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${n}`, exact: true }).click({ timeout: remaining() });
  await expect(input(n)).toBeVisible({ timeout: remaining() });
}
async function close(n: number) { available(); await page!.getByRole("button", { name: `Close Conversation ${n}`, exact: true }).click({ timeout: remaining() }); await expect(pane(n)).toHaveCount(0, { timeout: remaining() }); }
async function stable() { await page!.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); }); }
async function sample(label: string) {
  available(); await stable();
  const dom = await page!.evaluate(() => ({ totalNodes: document.querySelectorAll("*").length, viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
    panes: [...document.querySelectorAll<HTMLElement>('.flow-tab-body[role="tabpanel"]')].map(element => ({ id: element.id, hidden: element.hidden, visible: element.getClientRects().length > 0 && getComputedStyle(element).display !== "none", nodes: element.querySelectorAll("*").length })),
    composers: document.querySelectorAll('textarea[aria-label="Message input"]').length }));
  expect(dom.panes.filter(item => item.visible).length).toBeLessThanOrEqual(2);
  samples.push({ label, at: Date.now(), elapsedMs: Date.now() - startedAt, ...dom, activeSse: preview!.first.activeStreamCount(), readCount: preview!.reads.length });
}
function readsSince(at: number) { return preview!.reads.filter(row => row.startedAt >= at && row.method === "GET"); }
async function observe(label: string, allowed: number[]) {
  const at = Date.now(); await page!.waitForTimeout(2200); available();
  const rows = readsSince(at), allowedIds = new Set(allowed.map(n => `chat-${n}`));
  const perPane = rows.filter(row => /^\/api\/(?:conversations\/[^/?]+(?:[/?]|$)|tasks\/chat-)/.test(row.path));
  const unexpected = perPane.filter(row => { const match = row.path.match(/(?:conversations\/|tasks\/)(chat-\d+)(?:[/?-]|$)/); return match && !allowedIds.has(match[1]!); });
  const late = preview!.reads.filter(row => row.startedAt < at && (row.finishedAt ?? row.closedAt ?? 0) >= at);
  lifecycle.push({ label, at, end: Date.now(), allowed, reads: rows.map(row => row.id), late: late.map(row => row.id), unexpected: unexpected.map(row => row.id) });
  expect(unexpected).toHaveLength(0);
}
async function selectKnowledge(n: number) {
  await pane(n).getByRole("button", { name: "Knowledge", exact: true }).click();
  const dialog = page!.getByRole("dialog", { name: "Conversation knowledge", exact: true });
  await dialog.getByLabel("Search project knowledge").fill("Fixed"); await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await dialog.getByRole("checkbox").first().check(); await page!.keyboard.press("Escape");
}
try {
  preview = await startLifecycleFixture(); available();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  page = await context.newPage(); page.setDefaultTimeout(3000); page.on("pageerror", error => errors.push(error.message));
  await page.goto(preview.url, { waitUntil: "domcontentloaded", timeout: remaining() });
  await expect(page.getByRole("navigation", { name: "Conversations", exact: true })).toBeVisible({ timeout: 10_000 });
  await check("8/16/32 cumulative actual conversation panes; hidden reads pause", async () => {
    let previous = 0;
    for (const count of [8, 16, 32]) {
      for (let n = previous + 1; n <= count; n++) await open(n);
      await sample(`opened-${count}`); await observe(`opened-${count}`, [count]); previous = count;
    }
  });
  await check("two split panes remain independently visible and observed", async () => {
    await open(32); await page!.getByRole("button", { name: "Split chat", exact: true }).click(); await open(31);
    await expect(pane(32)).toBeVisible(); await expect(pane(31)).toBeVisible(); await sample("split-two"); await observe("split-two", [31, 32]);
  });
  await check("closed clean panes remove DOM, stop reads; reopen history requests are recorded", async () => {
    for (const n of [28, 29, 30]) await close(n);
    await sample("closed-clean"); await observe("closed-clean", [31, 32]);
    const at = Date.now(); await open(30); await sample("reopened-clean"); lifecycle.push({ label: "reopen-history", at, reads: readsSince(at).map(row => ({ id: row.id, path: row.path })) });
  });
  await check("closed protected draft and knowledge restore without eager body", async () => {
    await open(3); await input(3).fill("Protected new draft exact 🙂"); await selectKnowledge(3); const before = preview!.reads.length;
    await close(3); await open(3); await expect(input(3)).toHaveValue("Protected new draft exact 🙂");
    await expect(pane(3).getByText("1 knowledge references selected for your next message.", { exact: true })).toBeVisible();
    expect(preview!.reads.slice(before).filter(row => row.path.includes("/knowledge/resolve"))).toHaveLength(0); await sample("reopened-protected-selection");
  });
  await check("closed unknown Send restores original key/body and independent new draft", async () => {
    await open(4); preview!.first.loseNextReceipt(); await input(4).fill("Protected uncertain Send"); await input(4).press("Enter");
    await expect(pane(4).getByRole("region", { name: "Message receipt" })).toContainText("Receipt unknown");
    const first = preview!.first.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")!;
    await input(4).fill("Next text after unknown Send"); await close(4); await open(4);
    await expect(input(4)).toHaveValue("Next text after unknown Send"); await pane(4).getByRole("button", { name: "Retry same message", exact: true }).click();
    await expect(pane(4).getByRole("region", { name: "Message receipt" })).toHaveCount(0);
    const retry = preview!.first.requests.findLast(row => row.method === "POST" && row.path === first.path)!;
    expect(retry.key).toBe(first.key); expect(retry.body).toBe(first.body); await expect(input(4)).toHaveValue("Next text after unknown Send");
    lifecycle.push({ label: "send-identity", first, retry });
  });
  await check("closed unknown Queue restores original key/body without cancellation", async () => {
    await open(5); await pane(5).getByRole("radio", { name: "Queue next", exact: true }).check(); preview!.first.loseNext("enqueue");
    await input(5).fill("Protected uncertain Queue"); await input(5).press("Enter");
    await expect(pane(5).getByRole("region", { name: "enqueue receipt", exact: true })).toContainText("Receipt unknown");
    const first = preview!.first.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-5/queue")!;
    await input(5).fill("Next text after unknown Queue"); await close(5); await open(5); await expect(input(5)).toHaveValue("Next text after unknown Queue");
    await pane(5).getByRole("button", { name: "Retry same enqueue", exact: true }).click();
    await expect.poll(() => preview!.first.requests.filter(row => row.method === "POST" && row.path === first.path).length).toBe(2);
    const retry = preview!.first.requests.findLast(row => row.method === "POST" && row.path === first.path)!;
    expect(retry.key).toBe(first.key); expect(retry.body).toBe(first.body); lifecycle.push({ label: "queue-identity", first, retry });
    expect(preview!.first.requests.filter(row => row.method === "POST" && row.path.endsWith("/cancel"))).toHaveLength(0);
  });
  await check("late reply detail after closing is observed separately from DOM removal", async () => {
    await open(1); const path = "/api/conversations/chat-1/turns/chat-1-turn-1/details/chat-1-task-1-reply";
    preview!.delayNextRead(path, 900); const at = Date.now();
    await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click();
    await expect.poll(() => preview!.reads.some(row => row.path === path && row.startedAt >= at)).toBe(true);
    await close(1); await page!.waitForTimeout(1100); const afterClose = preview!.reads.filter(row => row.path === path).length;
    await open(1); const read = pane(1).getByRole("button", { name: "Read full reply", exact: true });
    if (await read.isVisible()) await read.click();
    await expect(pane(1).getByRole("button", { name: "Hide full reply", exact: true })).toBeVisible();
    lifecycle.push({ label: "closed-late-detail", path, afterClose, afterReopen: preview!.reads.filter(row => row.path === path).length, observations: preview!.reads.filter(row => row.path === path) });
    await sample("reopened-detail-cache-observation");
  });
  await check("late hidden read is isolated; overview stops per-pane reads", async () => {
    preview!.delayNextRead("/api/conversations/chat-6", 900); const at = Date.now(); await open(6); await expect.poll(() => preview!.reads.some(row => row.startedAt >= at && row.delayed)).toBe(true); await open(7); await page!.waitForTimeout(1100);
    const delayed = preview!.reads.find(row => row.startedAt >= at && row.delayed); expect(delayed).toBeDefined();
    await expect(input(7)).toBeVisible(); await expect(pane(6)).not.toBeVisible(); lifecycle.push({ label: "late-hidden", observation: delayed });
    await page!.getByRole("button", { name: "Work overview", exact: true }).click(); await observe("overview-hidden", []);
    await page!.getByRole("button", { name: "Chats", exact: true }).click(); await sample("returned-from-overview");
  });
  await check("stable viewport evidence and draft survives theme change", async () => {
    await open(3); await stable(); await page!.screenshot({ path: prefix + "-light.png" });
    await page!.getByRole("button", { name: "Use dark theme", exact: true }).click(); await expect(input(3)).toHaveValue("Protected new draft exact 🙂");
    await stable(); await page!.screenshot({ path: prefix + "-dark.png" });
  });
} catch (error) { failures.push({ name: "setup-or-budget", error: String(error) }); }
finally {
  clearTimeout(actionsTimer); const cleanupStartedAt = Date.now();
  const results = await Promise.allSettled([browser?.close(), preview?.close()]);
  for (const result of results) if (result.status === "rejected") cleanupErrors.push(String(result.reason));
  cleanupComplete = cleanupErrors.length === 0; clearTimeout(hardTimer);
  const finishedAt = Date.now(); const sourceAfter = await hashes(paths);
  const directoryBytes = async (): Promise<number> => { let sum = 0; for (const entry of await readdir(output, { withFileTypes: true })) if (entry.isFile()) sum += (await stat(output + entry.name)).size; return sum; };
  const report = { runId, sourceCommit, sourceDirty, sourceHashes, sourceAfter, dependencyHashes, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date(finishedAt).toISOString(), elapsedMs: finishedAt - startedAt,
    cleanupStartedAt: new Date(cleanupStartedAt).toISOString(), cleanupMs: finishedAt - cleanupStartedAt, cleanupComplete, cleanupErrors,
    status: failures.length || errors.length || deadlineReached || finishedAt - startedAt > 90_000 ? "partial" : "complete",
    checks, failures, errors, deadlineReached, samples, lifecycle, reads: preview?.reads ?? [],
    privateCacheObjects: "unknown; no private store instrumentation", heap: "unknown", interactionLatency: "unknown; no reliable latency benchmark", scope: "Actual fixed App; synthetic HTTP center only. No production changes/provider/DB/personal service." };
  await writeFile(prefix + "-report.json", JSON.stringify(report, null, 2) + "\n"); const evidenceBytes = await directoryBytes();
  await writeFile(prefix + "-budget.json", JSON.stringify({ evidenceBytes, maxBytes: 8 * 1024 * 1024, withinBytes: evidenceBytes < 8 * 1024 * 1024, elapsedMs: report.elapsedMs, withinTime: report.elapsedMs <= 90_000 }, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, checks: checks.length, failures, errors, elapsedMs: report.elapsedMs, cleanupComplete, evidenceBytes }));
  if (report.status !== "complete" || !cleanupComplete || evidenceBytes >= 8 * 1024 * 1024) process.exitCode = 1;
}
