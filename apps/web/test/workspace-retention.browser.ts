import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { startRetentionFixture } from "./workspace-retention.fixture";

const root = fileURLToPath(new URL("../../../", import.meta.url)), output = root + "docs/evidence/wpf-workspace-cache/";
const expect = baseExpect.configure({ timeout: 2500 });
const scope: string[] = JSON.parse(await readFile(output + "take-receipt.json", "utf8")).claim.scope;
const paths = scope.filter(path => path.startsWith("apps/"));
const all = execFileSync("git", ["ls-files", "apps/web/src", "packages/client/src", "packages/contracts/src", "packages/interaction/src", "apps/web/test/*fixture*.ts"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const hashes = async (files: string[]) => Object.fromEntries(await Promise.all(files.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceDirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
const sourceHashes = await hashes(paths), dependencyHashes = await hashes(all.filter(path => !paths.includes(path)));
// One total experiment allowance. A rerun must explicitly use only the remaining allowance.
const budgetMs = Number(process.env.FLOW_CACHE_BUDGET_MS ?? 90000);
if (!Number.isInteger(budgetMs) || budgetMs < 15000 || budgetMs > 90000) throw Error("Invalid 15–90 second experiment budget");
const started = Date.now(), prefix = output + new Date(started).toISOString().replaceAll(":", "-");
const checks: string[] = [], errors: string[] = [], samples: unknown[] = [], cleanup: unknown[] = [];
let failure: string | null = null, browser: Browser | undefined, page: Page | undefined, preview: Awaited<ReturnType<typeof startRetentionFixture>> | undefined;
const stopActions = setTimeout(() => { void browser?.close().catch(error => errors.push(String(error))); }, budgetMs - 10000);
const stopAll = setTimeout(() => { writeFileSync(prefix + "-timeout.json", JSON.stringify({ elapsedMs: Date.now() - started, checks, failure: "Hard experiment budget exhausted; cleanup unconfirmed" })); process.exit(2); }, budgetMs);
const available = () => { if (Date.now() - started >= budgetMs - 10000) throw Error("Actions stopped to reserve cleanup"); };
const pane = (n: number) => page!.locator(`[id="panel-conversation:chat-${n}"]`);
const input = (n: number) => pane(n).getByRole("textbox", { name: "Message input", exact: true });
const nav = () => page!.getByRole("navigation", { name: "Conversations", exact: true });
const detailPath = "/api/conversations/chat-1/turns/chat-1-turn-1/details/chat-1-task-1-reply";
const readCount = (path: string) => preview!.transport.filter(row => row.method === "GET" && row.path === path).length;
async function open(n: number) {
  available(); if (!await nav().isVisible()) await page!.getByRole("button", { name: "Chats", exact: true }).click();
  await nav().getByRole("button", { name: `Conversation ${n}`, exact: true }).click(); await expect(input(n)).toBeVisible();
}
async function close(n: number) { available(); await page!.getByRole("button", { name: `Close Conversation ${n}`, exact: true }).click(); await expect(pane(n)).toHaveCount(0); }
async function retained() { await page!.getByRole("button", { name: "Retained chats", exact: true }).click(); return page!.getByRole("dialog", { name: "Retained chats", exact: true }); }
async function check(name: string, action: () => Promise<void>, phase: "consumer" | "capacity" | "presentation" | "settlement" = "consumer") { if (process.argv.includes("--settlement-only") && phase !== "settlement") return; if (process.argv.includes("--presentation-only") && phase !== "presentation") return; if (process.argv.includes("--capacity-only") && phase === "consumer") return; available(); await action(); checks.push(name); console.log("PASS", name); }
async function sample(label: string) {
  samples.push({ label, elapsedMs: Date.now() - started, ...await page!.evaluate(() => ({ nodes: document.querySelectorAll("*").length, composers: document.querySelectorAll('textarea[aria-label="Message input"]').length, visible: [...document.querySelectorAll<HTMLElement>('.flow-tab-body[role="tabpanel"]')].filter(element => element.getClientRects().length && getComputedStyle(element).display !== "none").length, width: innerWidth, scrollWidth: document.documentElement.scrollWidth })) });
}
async function snapshot(name: string) {
  await page!.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  await sample(name); await page!.screenshot({ path: prefix + `-${name}.png` });
}
try {
  preview = await startRetentionFixture(); browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" }); page.setDefaultTimeout(2500); page.on("pageerror", error => errors.push(error.message));
  await page.goto(preview.url); const owner = page.getByLabel("Owner token", { exact: true });
  if (await owner.isVisible()) { await owner.fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); }
  await expect(nav()).toBeVisible({ timeout: 10000 });
  await check("closed-clean views release immediately, repeated reopen rereads history with no close cancellation", async () => {
    for (let n = 9; n <= 16; n++) { await open(n); await close(n); }
    const dialog = await retained(); await expect(dialog).toContainText("1 / 32"); await page!.keyboard.press("Escape"); await expect(page!.getByRole("button", { name: "Retained chats", exact: true })).toBeFocused();
    const before = readCount("/api/conversations/chat-9/turns?after=0&limit=20"); await open(9); await close(9); await open(9);
    expect(readCount("/api/conversations/chat-9/turns?after=0&limit=20") - before).toBe(2); await close(9); await sample("clean-close-loop");
  });
  await check("late reply and history reads cannot populate a closed view; reopen explicitly rereads", async () => {
    await open(1); preview!.delayNext(detailPath); await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click();
    await expect.poll(() => readCount(detailPath)).toBe(1); await close(1); await open(1);
    await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click(); await expect.poll(() => readCount(detailPath)).toBe(2);
    await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("longer explanation"); await close(1);
    await open(6); const path = "/api/conversations/chat-6/turns?after=20&limit=20"; preview!.delayNext(path);
    await pane(6).getByRole("button", { name: "Load more turns", exact: true }).click(); await expect.poll(() => readCount(path)).toBe(1); await close(6); await open(6);
    await expect(pane(6).getByRole("button", { name: "Load more turns", exact: true })).toBeEnabled(); await close(6);
  });
  await check("closed draft and selected knowledge retain identity and do not prefetch body", async () => {
    await open(3); await input(3).fill("Keep selected materials 🙂"); await pane(3).getByRole("button", { name: "Knowledge", exact: true }).click();
    const dialog = page!.getByRole("dialog", { name: "Conversation knowledge", exact: true }); await dialog.getByLabel("Search project knowledge").fill("Fixed"); await dialog.getByRole("button", { name: "Search", exact: true }).click(); await dialog.getByRole("checkbox").first().check(); await page!.keyboard.press("Escape");
    const reads = preview!.reads.filter(row => row.kind === "resolve").length; await close(3); await open(3);
    await expect(input(3)).toHaveValue("Keep selected materials 🙂"); await expect(pane(3).getByText("1 knowledge references selected for your next message.", { exact: true })).toBeVisible(); expect(preview!.reads.filter(row => row.kind === "resolve").length).toBe(reads); await close(3);
  });
  await check("unknown Send and Queue survive close with their original key/body and independent next draft", async () => {
    await open(4); preview!.first.loseNextReceipt(); await input(4).fill("Unknown original Send"); await input(4).press("Enter");
    await expect(pane(4).getByRole("region", { name: "Message receipt" })).toContainText("Receipt unknown");
    const sent = preview!.first.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")!;
    await input(4).fill("Next text"); await close(4); await open(4); await expect(input(4)).toHaveValue("Next text"); await pane(4).getByRole("button", { name: "Retry same message", exact: true }).click();
    await expect(pane(4).getByRole("region", { name: "Message receipt" })).toHaveCount(0); const replay = preview!.first.requests.findLast(row => row.path === sent.path && row.method === "POST")!; expect(replay.key).toBe(sent.key); expect(replay.body).toBe(sent.body); await close(4);
    await open(5); await pane(5).getByRole("radio", { name: "Queue next", exact: true }).check(); preview!.first.loseNext("enqueue"); await input(5).fill("Unknown queue"); await input(5).press("Enter");
    await expect(pane(5).getByRole("region", { name: "enqueue receipt", exact: true })).toContainText("Receipt unknown"); const queued = preview!.first.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-5/queue")!;
    await close(5); await open(5); await pane(5).getByRole("button", { name: "Retry same enqueue", exact: true }).click(); await expect.poll(() => preview!.first.requests.filter(row => row.path === queued.path && row.method === "POST").length).toBe(2);
    const retry = preview!.first.requests.findLast(row => row.path === queued.path && row.method === "POST")!; expect(retry.key).toBe(queued.key); expect(retry.body).toBe(queued.body); await close(5);
  });
  await check("32 resident protected views reject new allocation without changing route; existing protected view reopens", async () => {
    // The initial draft is also counted. All 31 conversations get explicit unsent material.
    for (let n = 1; n <= 31; n++) { await open(n); await input(n).fill(`Protected ${n}`); await close(n); }
    await page!.getByRole("button", { name: "Retained chats", exact: true }).click(); const dialog = page!.getByRole("dialog", { name: "Retained chats", exact: true }); await expect(dialog).toContainText("32 / 32");
    await dialog.getByRole("button", { name: "Conversation 3", exact: true }).click(); await expect(input(3)).toHaveValue("Protected 3");
    const route = page!.url(); await page!.locator(".flow-workspace-bar").getByRole("button", { name: "New chat", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("No place"); expect(page!.url()).toBe(route); await page!.keyboard.press("Escape");
    await open(10); await input(10).fill(""); await close(10); const free = await retained(); await expect(free).toContainText("31 / 32"); await page!.keyboard.press("Escape");
    await open(32); await expect(input(32)).toHaveValue(""); await sample("full-protected-and-one-released");
  }, "capacity");
  await check("two visible panes remain isolated; retained dialog keyboard and narrow themes stay usable", async () => {
    await open(32); await open(31); await input(31).fill("Protected 31"); await page!.getByRole("button", { name: "Split chat", exact: true }).click(); await expect(pane(32)).toBeVisible(); await expect(pane(31)).toBeVisible(); await expect(input(31)).toHaveValue("Protected 31"); await snapshot("desktop-light");
    await close(32); await page!.setViewportSize({ width: 390, height: 844 }); if (await nav().isVisible()) await page!.getByRole("button", { name: "Chats", exact: true }).click(); const dialog = await retained(); await snapshot("narrow-light"); await page!.keyboard.press("Escape");
    await page!.getByRole("button", { name: "Use dark theme", exact: true }).click(); await retained(); await snapshot("narrow-dark"); await dialog.getByRole("button", { name: "Conversation 31", exact: true }).click(); await expect(page!.locator('[id="tab-conversation:chat-31"]')).toBeFocused(); await expect(input(31)).toHaveValue("Protected 31");
  }, "presentation");
  await check("late accepted creation releases a closed clean alias, but preserves a newly typed draft", async () => {
    const composer = () => page!.getByRole("textbox", { name: "Message input", exact: true });
    await page!.getByRole("button", { name: /^Execution profile:/ }).click();
    const profile = page!.getByRole("dialog", { name: "Execution profile", exact: true });
    await profile.getByRole("radio").last().check(); await page!.keyboard.press("Escape");
    preview!.first.setAckDelay(700); await composer().fill("Release closed alias"); await composer().press("Enter");
    await expect.poll(() => preview!.first.requests.filter(row => row.method === "POST" && row.path.endsWith("/turns")).length).toBe(1);
    await page!.locator(".flow-tab.selected").getByRole("button", { name: /^Close / }).click();
    await page!.waitForTimeout(850); let dialog = await retained(); await expect(dialog).toContainText("0 / 32"); await page!.keyboard.press("Escape");
    await page!.locator(".flow-workspace-bar").getByRole("button", { name: "New chat", exact: true }).click();
    await composer().fill("Keep closed alias"); await composer().press("Enter");
    await expect.poll(() => preview!.first.requests.filter(row => row.method === "POST" && row.path.endsWith("/turns")).length).toBe(2);
    await composer().fill("New draft after send"); await page!.locator(".flow-tab.selected").getByRole("button", { name: /^Close / }).click(); await page!.waitForTimeout(850);
    dialog = await retained(); await expect(dialog).toContainText("1 / 32"); await dialog.getByRole("button", { name: "Keep closed alias", exact: true }).click(); await expect(composer()).toHaveValue("New draft after send");
  }, "settlement");
  expect(preview.first.requests.filter(row => row.method === "POST" && row.path.endsWith("/cancel"))).toHaveLength(0); expect(errors).toEqual([]);
} catch (error) { failure = String(error); console.error(error); }
finally {
  clearTimeout(stopActions); const cleanupAt = Date.now();
  for (const [name, action] of [["browser", () => browser?.close()], ["fixture", () => preview?.close()]] as const) {
    try { await action(); cleanup.push({ name, state: "fulfilled" }); } catch (error) { cleanup.push({ name, state: "rejected", error: String(error) }); }
  }
  const report = { sourceCommit, sourceDirty, sourceHashes, dependencyHashes, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, budgetMs, cleanupReservedMs: 10000, cleanupMs: Date.now() - cleanupAt, cleanup, checks, failure, errors, samples, reads: preview?.transport, limits: "HTTP fixture, no model/DB; JS heap and total runtime memory not measured; UTF8 body budgets are projection-owned only" };
  await writeFile(prefix + "-browser.json", JSON.stringify(report, null, 2) + "\n"); clearTimeout(stopAll);
  const evidenceBytes = (await Promise.all((await readdir(output)).map(async name => (await stat(output + name)).size))).reduce((a,b) => a+b,0);
  if (evidenceBytes > 8 * 1024 * 1024 || failure || cleanup.some(value => (value as { state: string }).state !== "fulfilled")) process.exitCode = 1;
  console.log(JSON.stringify({ checks: checks.length, failure, elapsedMs: report.elapsedMs, cleanup, evidenceBytes }));
}
