import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { cpus, freemem, platform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium, expect, type Browser, type Page, type CDPSession } from "@playwright/test";
import { build } from "vite";
import { FlowClient } from "@flow/client";
import { WorkspaceFeedProjection } from "../src/workspace-feed/projection";
import { createPerformanceFixture, FIXTURE_TOKEN, TEXT_LENGTH } from "./performance-fixture";
import { verifyAllRecords } from "./workspace-window.browser";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = join(root, "docs/evidence/wpf-perf02");
const appRoot = join(root, "apps/web");
const BASE = "cc33403cd9b357fcd85484b7bc6952dc1220d689";
const smoke = process.argv.includes("--smoke");
const selfTestOnly = process.argv.includes("--self-test");
const selectedTasks = process.argv.find(argument => argument.startsWith("--tasks="))?.slice(8);
const taskCounts = selectedTasks ? selectedTasks.split(",").map(Number) : smoke ? [1] : [1, 16, 128];
assert(taskCounts.length > 0 && new Set(taskCounts).size === taskCounts.length && taskCounts.every(count => [1, 16, 128].includes(count)), "--tasks must be a unique subset of 1,16,128");
assert(!smoke || (taskCounts.length === 1 && taskCounts[0] === 1), "Smoke uses one task");
const label = process.argv.find(argument => argument.startsWith("--label="))?.slice(8) ?? (smoke ? "smoke" : "window");
assert(/^[a-z0-9-]+$/.test(label), "--label must be a plain filename prefix");
const milestones = smoke ? [100, 240] : [100, 1000, 5000, 10000];
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const writeJson = (name: string, data: unknown) => writeFile(join(output, name), JSON.stringify(data, null, 2));
interface TimingEntry { name: string; startTime: number; duration: number; inputDelay?: number; processing?: number; interactionId?: number }
interface WheelSample { at: number; handlerAt: number; trusted: boolean; from: number; to?: number; scrollAt?: number; rafAt?: number }
interface KeySample { at: number; handlerAt: number; trusted: boolean; key: string; rafAt?: number }
interface Metrics { phase: string; phases: { name: string; at: number }[]; longTasks: TimingEntry[]; events: TimingEntry[]; keys: KeySample[]; wheels: WheelSample[]; supported: string[]; nextWheelFrom?: number }
declare global { interface Window { __flowPerf: Metrics } }

/** Browser-side measurement only; no React internals or application methods are replaced. */
function instrument() {
  const metrics: Metrics = { phase: "navigation", phases: [], longTasks: [], events: [], keys: [], wheels: [], supported: [...PerformanceObserver.supportedEntryTypes] };
  window.__flowPerf = metrics;
  if (metrics.supported.includes("longtask")) new PerformanceObserver(list => {
    for (const entry of list.getEntries()) metrics.longTasks.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
  if (metrics.supported.includes("event")) new PerformanceObserver(list => {
    for (const entry of list.getEntries() as (PerformanceEventTiming & { interactionId?: number })[]) {
      if (!["keydown", "keyup", "keypress", "input", "beforeinput"].includes(entry.name)) continue;
      metrics.events.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration, inputDelay: entry.processingStart - entry.startTime, processing: entry.processingEnd - entry.processingStart, interactionId: entry.interactionId });
    }
  }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  window.addEventListener("keydown", event => {
    if (!(event.target instanceof HTMLInputElement) || event.target.getAttribute("aria-label") !== "Find chats") return;
    const sample: KeySample = { at: event.timeStamp, handlerAt: performance.now(), trusted: event.isTrusted, key: event.key };
    metrics.keys.push(sample); requestAnimationFrame(() => { sample.rafAt = performance.now(); });
  }, { capture: true });
  window.addEventListener("wheel", event => {
    const target = (event.target as Element).closest<HTMLElement>(".wf-feed");
    if (!target) return;
    const sample: WheelSample = { at: event.timeStamp, handlerAt: performance.now(), trusted: event.isTrusted, from: metrics.nextWheelFrom ?? target.scrollTop };
    metrics.wheels.push(sample);
    // Compositor scrolling can precede the wheel handler. Origin was captured before dispatch.
    requestAnimationFrame(() => {
      if (target.scrollTop !== sample.from) { sample.to = target.scrollTop; sample.scrollAt = performance.now(); sample.rafAt = performance.now(); }
    });
  }, { capture: true, passive: true });
}
const phase = (page: Page, name: string) => page.evaluate(name => { window.__flowPerf.phase = name; window.__flowPerf.phases.push({ name, at: performance.now() }); }, name);
async function measure(page: Page, cdp: CDPSession, name: string) {
  const timing = await page.evaluate(() => {
    const feed = document.querySelector<HTMLElement>(".wf-feed");
    return { at: performance.now(), domElements: document.querySelectorAll("*").length, renderedRecords: document.querySelectorAll(".wf-records > [data-entry-id]").length, loadedRecords: Number(document.querySelector<HTMLElement>(".wf-records")?.dataset.totalRecords), scrollTop: feed?.scrollTop, scrollHeight: feed?.scrollHeight, following: document.querySelector(".wf-feed-footer")?.textContent, memoryAPI: { userAgentSpecific: "measureUserAgentSpecificMemory" in performance, legacyMemory: "memory" in performance, crossOriginIsolated }, renderCount: null, renderCountReason: "Ordinary production build has no React profiling instrumentation" };
  });
  const response = await cdp.send("Performance.getMetrics");
  const metrics = Object.fromEntries(response.metrics.filter(item => ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "LayoutCount", "RecalcStyleCount", "TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].includes(item.name)).map(item => [item.name, item.value]));
  return { name, ...timing, cdp: metrics, heapCaveat: "No forced GC; JS heap sample, not retained-object count or a leak proof" };
}

async function interactions(page: Page, repetitions = 12) {
  const input = page.getByRole("textbox", { name: "Find chats" });
  await input.click();
  for (let i = 0; i < repetitions; i++) { await page.keyboard.press(i % 2 ? "Backspace" : "p"); await pause(25); }
  await expect(input).toHaveValue("");
  const feed = page.getByLabel("Task activity records");
  await feed.hover();
  for (let index = 0; index < 4; index++) {
    const previous = await page.evaluate(() => { window.__flowPerf.nextWheelFrom = document.querySelector<HTMLElement>(".wf-feed")!.scrollTop; return window.__flowPerf.wheels.length; });
    await page.mouse.wheel(0, index % 2 ? 180 : -360);
    await page.waitForFunction(previous => window.__flowPerf.wheels.length > previous && window.__flowPerf.wheels.at(-1)?.rafAt !== undefined, previous, { timeout: 10_000 });
  }
}
async function follow(page: Page) {
  const latest = page.getByRole("button", { name: /^Show latest activity/ });
  if (await latest.isVisible()) await latest.click();
}

async function validityChecks() {
  const fixture = createPerformanceFixture(16);
  const url = await fixture.listen();
  const client = new FlowClient({ baseUrl: url, token: FIXTURE_TOKEN });
  const checks: string[] = [];
  try {
    const unauthorized = await fetch(`${url}/api/workspace`); assert.equal(unauthorized.status, 401);
    const snapshot = await client.workspace(); assert.equal(snapshot.entries.length, 40); assert.equal(snapshot.watermark, 56); assert.equal(snapshot.hasEarlier, true);
    fixture.append(90);
    const page = await client.workspace({ after: snapshot.nextCursor }); assert.equal(page.entries.length, 40); assert.equal(page.nextCursor, snapshot.nextCursor + 40); assert.equal(page.hasMore, true);
    const history = await client.workspace({ before: snapshot.previousCursor }); assert(history.entries.every(entry => entry.cursor < snapshot.previousCursor));
    const index = await client.queryTasks(); assert.equal(index.totalSize, 16);
    const task = await client.show(fixture.ids[0]!); const reference = task.entries.find(entry => entry.kind === "reference"); assert(reference?.kind === "reference");
    const detail = await client.detail(reference.reference.id); assert.equal(detail.id, reference.reference.id);
    checks.push("HTTP authorization / latest snapshot / nextCursor vs watermark / older page / exact task count / reference detail");
    const projection = new WorkspaceFeedProjection(client);
    await projection.refresh(); assert.equal(projection.getSnapshot().entries.length, 40);
    projection.setFollowing(false); fixture.append(100); await projection.refresh();
    assert.equal(projection.getSnapshot().entries.length, 40); assert.equal(projection.getSnapshot().buffered.length, 100);
    projection.revealNew(); assert.equal(projection.getSnapshot().entries.length, 140); assert.equal(projection.getSnapshot().buffered.length, 0); projection.stop();
    checks.push("Public projection fixture validity: paused buffer then explicit reveal; no private state hooks");
    await writeJson("fixture-checks.json", { at: new Date().toISOString(), checks, passed: checks.length });
  } finally { await fixture.close(); }
}

async function isolatedProjection() {
  const fixture = createPerformanceFixture(128); const url = await fixture.listen();
  const client = new FlowClient({ baseUrl: url, token: FIXTURE_TOKEN });
  const projection = new WorkspaceFeedProjection(client);
  const samples: unknown[] = [];
  try {
    await projection.refresh();
    for (let batch = 1; batch <= 100; batch++) {
      if (batch === 51) projection.setFollowing(false);
      fixture.append(100); const at = performance.now(); await projection.refresh();
      if ([1, 10, 50, 100].includes(batch)) { const state = projection.getSnapshot(); samples.push({ batch, refreshWallMs: performance.now() - at, entries: state.entries.length, buffered: state.buffered.length, deliveredCursor: state.deliveredCursor, watermark: state.watermark }); }
    }
    const before = projection.getSnapshot(); assert.equal(before.entries.length + before.buffered.length, 10040);
    projection.revealNew(); const after = projection.getSnapshot(); assert.equal(after.entries.length, 10040); assert.equal(after.buffered.length, 0);
    await writeJson("projection-retention.json", { at: new Date().toISOString(), scope: "Isolated Node public projection + actual HTTP fixture. NOT browser App heap or UI timing.", samples, afterReveal: { entries: after.entries.length, buffered: after.buffered.length }, requests: fixture.workspaceResponses.length });
  } finally { projection.stop(); await fixture.close(); }
}

async function behaviorChecks(page: Page, fixture: ReturnType<typeof createPerformanceFixture>) {
  const checks: string[] = [];
  const detailReads = () => fixture.requests.filter(request => request.path.startsWith("/api/details/")).length;
  assert.equal(detailReads(), 0);
  const select = async (id: string) => { await page.locator(".flow-chat-list button").filter({ hasText: `Performance task ${id}` }).click(); await expect(page.locator(".flow-tab-body:not([hidden]) .flow-status").first()).toBeVisible(); };
  const inspectedId = fixture.ids.at(-1)!;
  await select(inspectedId); await expect.poll(() => fixture.activeStreamCount()).toBe(1);
  assert.equal(detailReads(), 0);
  await page.getByRole("button", { name: `Open ${inspectedId} report.txt`, exact: true }).click();
  await expect(page.getByRole("tab", { name: `${inspectedId} report.txt`, exact: true })).toBeVisible();
  await expect.poll(detailReads).toBe(1);
  await page.getByRole("button", { name: "Close workspace", exact: true }).click();
  await page.getByRole("button", { name: `Open ${inspectedId} report.txt`, exact: true }).click();
  await expect(page.getByRole("tab", { name: `${inspectedId} report.txt`, exact: true })).toBeVisible(); assert.equal(detailReads(), 1);
  await page.getByRole("button", { name: "Close workspace", exact: true }).click();
  checks.push("Detail requests 0 before expansion, 1 on first expansion, 1 after cached reopen");
  const available = [inspectedId, ...fixture.ids.slice(-Math.min(8, fixture.ids.length)).filter(id => id !== inspectedId)];
  for (const id of available.slice(1)) { await select(id); await expect.poll(() => fixture.activeStreamCount()).toBe(1); }
  if (available.length > 1) {
    await page.getByRole("button", { name: "Split chat", exact: true }).click(); await expect.poll(() => fixture.activeStreamCount()).toBe(2);
    await page.getByRole("button", { name: "Merge tabs", exact: true }).click(); await expect.poll(() => fixture.activeStreamCount()).toBe(1);
  }
  await page.getByRole("button", { name: `Close Performance task ${inspectedId}`, exact: true }).click();
  await expect.poll(() => fixture.activeStreamCount()).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Work overview", exact: true }).click(); await expect.poll(() => fixture.activeStreamCount()).toBe(0);
  assert.equal(fixture.requests.filter(request => request.path.endsWith("/cancel")).length, 0);
  checks.push(`${available.length} retained chat(s): one visible stream; ${available.length > 1 ? "split two / merge one; " : ""}overview zero; no cancel`);
  return checks;
}

async function runScenario(browser: Browser, dist: string, count: number) {
  const fixture = createPerformanceFixture(count, dist); const url = await fixture.listen();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce" });
  await context.addInitScript(instrument);
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
  const pageErrors: string[] = []; page.on("pageerror", error => pageErrors.push(error.message));
  const requests: { path: string; type: string }[] = []; page.on("request", request => requests.push({ path: new URL(request.url()).pathname, type: request.resourceType() }));
  const checkpoints: Awaited<ReturnType<typeof measure>>[] = [];
  const stages: unknown[] = [];
  const result: Record<string, unknown> = { taskCount: count, environmentFile: `${label}-environment.json`, scriptHead: git("rev-parse", "HEAD"), liveEntries: milestones.at(-1), initialVisibleEntries: 40, url, checks: [], status: "running" };
  let aborted = false;
  try {
    const navigationStart = performance.now(); await page.goto(url);
    await expect(page.getByRole("heading", { name: "Connect to Flow" })).toBeVisible();
    result.connectionFormReadyAutomationMs = performance.now() - navigationStart;
    await page.getByLabel("Owner token").fill(FIXTURE_TOKEN);
    const connectStart = performance.now(); await page.getByRole("button", { name: "Connect workspace" }).click();
    await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", "40");
    result.workspaceReadyAutomationMs = performance.now() - connectStart;
    result.navigation = await page.evaluate(() => performance.getEntriesByType("navigation").map(entry => entry.toJSON()));
    const checks = await behaviorChecks(page, fixture); result.checks = checks;
    // Task snapshots use latest 100 entries. Run detail/observer validity before long histories hide old references.
    await page.getByRole("button", { name: "Task index", exact: true }).click();
    await expect(page.getByText(`${Math.min(40, count)} loaded · ${count} matching tasks`, { exact: true })).toBeVisible();
    for (let loaded = Math.min(40, count); loaded < count; loaded = Math.min(loaded + 40, count)) {
      await page.getByRole("button", { name: "Load more tasks", exact: true }).click();
      await expect(page.getByRole("article", { name: /^Task:/ })).toHaveCount(Math.min(loaded + 40, count));
    }
    await expect(page.getByRole("article", { name: /^Task:/ })).toHaveCount(count);
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    checkpoints.push(await measure(page, cdp, "initial"));
    let previous = 0;
    for (const target of milestones) {
      await phase(page, `delivery-${target}`); await follow(page);
      const started = performance.now(); const startCursor = fixture.watermark();
      const producer = (async () => { for (let added = previous; added < target && !aborted; added += 100) { fixture.append(Math.min(100, target - added)); await pause(50); } })();
      await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
      await interactions(page);
      await producer;
      const targetCursor = fixture.watermark();
      await expect.poll(() => fixture.workspaceResponses.some(response => response.nextCursor === targetCursor), { timeout: 180_000, intervals: [100, 250, 500] }).toBe(true);
      checkpoints.push(await measure(page, cdp, `before-reveal-${target}`));
      const revealStart = performance.now(); await follow(page);
      await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", String(40 + target), { timeout: 60_000 });
      await expect(page.locator(".wf-records")).toHaveAttribute("data-last-cursor", String(targetCursor));
      assert(await page.locator(".wf-records > [data-entry-id]").count() < 60);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      checkpoints.push(await measure(page, cdp, `revealed-${target}`));
      stages.push({ targetLiveEntries: target, startCursor, targetCursor, deliveryAndInteractionWallMs: performance.now() - started, revealAutomationMs: performance.now() - revealStart, totalLoadedRecords: 40 + target, mountedDOMRecords: await page.locator(".wf-records > [data-entry-id]").count() });
      await phase(page, `settled-${target}`); await interactions(page); await follow(page);
      previous = target;
      process.stdout.write(`PERF tasks=${count} live=${target} records=${40 + target}\n`);
      await writeJson(`${label}-${count}.json`, { ...result, stages, checkpoints, timing: await page.evaluate(() => window.__flowPerf), status: "running" });
    }
    await phase(page, "attention"); const attentionStart = performance.now(); fixture.waitForDecision();
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByRole("region", { name: "Work overview" }).getByText(`Review synthetic change for ${fixture.ids[0]}.`, { exact: true })).toBeVisible();
    result.attentionRefreshAutomationMs = performance.now() - attentionStart;
    await page.screenshot({ path: join(output, `${label}-${count}-light.png`) });
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
    await page.screenshot({ path: join(output, `${label}-${count}-dark.png`) });
    assert.equal(pageErrors.length, 0); result.status = "passed";
    const timing = await page.evaluate(() => window.__flowPerf);
    assert(timing.keys.length >= milestones.length * 24 && timing.keys.every(sample => sample.trusted));
    assert(timing.wheels.length >= milestones.length * 8 && timing.wheels.every(sample => sample.trusted && sample.to !== sample.from && sample.rafAt !== undefined));
    result.timing = timing;
    // Full DOM traversal has its own phase; it is not part of the baseline timing sample above.
    await phase(page, "integrity-traversal");
    const expected = Array.from({ length: 40 + milestones.at(-1)! }, (_, index) => {
      const number = index + 1, cursor = count + number, taskId = fixture.ids[index % count]!;
      return { id: `perf-record-${cursor}`, cursor, text: `Record ${number} for ${taskId}. `.padEnd(TEXT_LENGTH, "x") };
    });
    result.integrity = await verifyAllRecords(page, expected);
  } catch (error) {
    result.status = "failed"; result.error = error instanceof Error ? error.stack : String(error);
    result.timing = await page.evaluate(() => window.__flowPerf).catch(() => null);
    await page.screenshot({ path: join(output, `${label}-${count}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    aborted = true;
    Object.assign(result, { at: new Date().toISOString(), stages, checkpoints, requests, workspaceResponses: fixture.workspaceResponses, pageErrors, apiRequests: fixture.requests.map(({ method, path }) => ({ method, path })), memoryLimit: "measureUserAgentSpecificMemory support recorded, not called without isolation; no forced GC; separate projection counts are not this App heap", p95: null, p95Reason: "One scenario run per scale; threshold-filtered Event Timing is not an unbiased latency distribution", renderCount: null });
    try { await writeJson(`${label}-${count}.json`, result); }
    finally { try { await context.close(); } finally { await fixture.close(); } }
  }
}

async function main() {
  await validityChecks();
  if (selfTestOnly) { process.stdout.write("PASS 2 fixture/projection validity groups\n"); return; }
  const changed = git("diff", "--name-only", BASE, "--", "apps/web/src", "apps/web/package.json", "apps/web/vite.config.ts", "packages/client", "packages/contracts", "package.json", "pnpm-lock.yaml").split("\n").filter(Boolean);
  const allowed = ["apps/web/src/workspace-feed/ActivityWindow.tsx", "apps/web/src/workspace-feed/WorkspaceOverview.tsx", "apps/web/src/workspace-feed/workspace-feed.css"];
  assert(changed.every(path => allowed.includes(path)), "Only the claimed Activity display files may change production");
  const temporary = await mkdtemp(join(tmpdir(), "flow-perf-")); const dist = join(temporary, "dist");
  let browser: Browser | undefined;
  try {
    await build({ root: appRoot, build: { outDir: dist, emptyOutDir: true } });
    const assets = await readdir(join(dist, "assets"));
    const files = await Promise.all(assets.map(async name => { const data = await readFile(join(dist, "assets", name)); return { name, bytes: data.length, gzipBytes: gzipSync(data).length, sha256: createHash("sha256").update(data).digest("hex") }; }));
    browser = await chromium.launch({ channel: "chrome", headless: true });
    await writeJson(`${label}-environment.json`, { at: new Date().toISOString(), base: BASE, scriptHead: git("rev-parse", "HEAD"), scriptDirty: git("status", "--short"), mode: "Vite production; no fixture build flag, actual connection form", platform: platform(), osRelease: release(), arch: process.arch, cpu: cpus()[0]?.model, logicalCPUs: cpus().length, totalMemoryBytes: totalmem(), freeMemoryBeforeBytes: freemem(), loadAverage: execFileSync("sysctl", ["-n", "vm.loadavg"], { encoding: "utf8" }).trim(), node: process.version, browser: browser.version(), viewport: { width: 1440, height: 1000 }, headless: true, network: "Local HTTP/1.1 uncompressed static assets and synthetic in-memory fixture; no CPU/network throttle", reducedMotion: "reduce", textLength: TEXT_LENGTH, taskCounts, milestones, assets: files, html: await readFile(join(dist, "index.html"), "utf8"), versions: { web: JSON.parse(await readFile(join(appRoot, "package.json"), "utf8")), root: JSON.parse(await readFile(join(root, "package.json"), "utf8")) } });
    await isolatedProjection();
    const failures: { taskCount: number; error: string }[] = [];
    for (const count of taskCounts) {
      try { await runScenario(browser, dist, count); }
      catch (error) { failures.push({ taskCount: count, error: error instanceof Error ? error.message : String(error) }); process.stderr.write(`PERF tasks=${count} failed; evidence preserved\n`); }
    }
    await writeJson(`${label}-run.json`, { at: new Date().toISOString(), scenarios: taskCounts.length, failures });
    if (failures.length) process.exitCode = 1;
  } finally { try { await browser?.close(); } finally { await rm(temporary, { recursive: true, force: true }); } }
}
await main();
