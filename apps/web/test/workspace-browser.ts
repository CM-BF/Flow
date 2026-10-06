import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startWorkspacePreview } from "./workspace-preview";

const output = fileURLToPath(new URL("../../../docs/evidence/wpf-m02/", import.meta.url));
await mkdir(output, { recursive: true });
const preview = await startWorkspacePreview();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
const checks: string[] = [];
const check = async (name: string, action: () => Promise<void>) => { await action(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const fixture = preview.fixture;
try {
  await check("initial workspace and attention with zero unopened detail reads", async () => {
    await page.goto(preview.url); await expect(page.getByRole("heading", { name: "Work overview", exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: /^Attention:/ })).toHaveCount(8);
    await expect(page.locator(".wf-records > li")).toHaveCount(40);
    expect(fixture.requests.filter(request => request.path.startsWith("/api/details/"))).toHaveLength(0);
    await page.screenshot({ path: `${output}workspace-light.png` });
  });
  await check("historical reading buffers new records, preserves anchor through prepend and resize", async () => {
    const feed = page.getByRole("region", { name: "Work overview" }).locator(".wf-feed");
    await feed.evaluate(element => { element.scrollTop = 250; element.dispatchEvent(new Event("scroll")); });
    const anchor = await feed.evaluate(element => { const top = element.getBoundingClientRect().top; const row = [...element.querySelectorAll<HTMLElement>("[data-entry-id]")].find(row => row.getBoundingClientRect().bottom > top + 1)!; return { id: row.dataset.entryId!, offset: row.getBoundingClientRect().top - top }; });
    fixture.append("demo-running", "A new record while the user reads history.");
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show latest activity (1)" })).toBeVisible();
    const before = await feed.evaluate(element => element.scrollTop);
    // Invoke the explicit history control without scrolling it into view first.
    await page.getByRole("button", { name: "Load earlier records", exact: true }).evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.locator(".wf-records > li")).toHaveCount(80);
    const delta = await feed.evaluate((element, old) => { const row = [...element.querySelectorAll<HTMLElement>("[data-entry-id]")].find(row => row.dataset.entryId === old.id)!; return Math.abs(row.getBoundingClientRect().top - element.getBoundingClientRect().top - old.offset); }, anchor);
    expect(delta).toBeLessThan(2); expect(await feed.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect.poll(async () => feed.evaluate((element, old) => { const row = [...element.querySelectorAll<HTMLElement>("[data-entry-id]")].find(row => row.dataset.entryId === old.id)!; return Math.abs(row.getBoundingClientRect().top - element.getBoundingClientRect().top - old.offset); }, anchor)).toBeLessThan(2);
    await page.getByRole("button", { name: "Show latest activity (1)" }).click();
    await expect(page.getByText("A new record while the user reads history.", { exact: true })).toBeVisible();
  });
  await check("inline decision conflict refreshes without automatically answering a replacement", async () => {
    fixture.conflictNextDecision();
    const card = page.getByRole("article", { name: "Attention: Review launch checklist" });
    // Fixture titles come from the shared contract fixtures.
    const target = await card.count() ? card : page.getByRole("article", { name: /^Attention:/ }).filter({ has: page.getByRole("button", { name: "Approve", exact: true }) }).first();
    const before = fixture.requests.filter(request => request.path.endsWith("/decision")).length;
    await target.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(target.getByText(/nothing was automatically resubmitted/)).toBeVisible();
    await expect(target.getByText("The previous request expired. Review this new decision separately.")).toBeVisible();
    expect(fixture.requests.filter(request => request.path.endsWith("/decision"))).toHaveLength(before + 1);
    await target.getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(() => fixture.requests.filter(request => request.path.endsWith("/decision")).length).toBe(before + 2);
  });
  await check("explicit cancellation from attention", async () => {
    const target = page.getByRole("article", { name: "Attention: Reconcile runner connection", exact: true });
    await target.getByRole("button", { name: "Cancel task", exact: true }).click();
    await target.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
    await expect.poll(() => fixture.requests.filter(request => request.path.endsWith("/cancel")).length).toBe(1);
  });
  await check("over-100 attention window and exact complete index pagination", async () => {
    fixture.seed(105, true);
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show all attention tasks" })).toBeVisible();
    await page.getByRole("button", { name: "Task index", exact: true }).click();
    await expect(page.getByText(`40 loaded · ${fixture.tasks.size} matching tasks`, { exact: true })).toBeVisible();
    while (await page.getByRole("button", { name: "Load more tasks", exact: true }).count()) {
      await page.getByRole("button", { name: "Load more tasks", exact: true }).click();
      await expect(page.getByText("Loading task index…", { exact: true })).not.toBeVisible();
    }
    await expect(page.getByRole("article", { name: /^Task:/ })).toHaveCount(fixture.tasks.size);
    await page.getByRole("combobox").selectOption("attention");
    await expect(page.getByText("Loading task index…", { exact: true })).not.toBeVisible();
    const target = page.getByRole("article", { name: /^Task:/ }).first();
    expect(await target.getByRole("button", { name: "Approve", exact: true }).count()).toBe(0);
    const shows = fixture.requests.filter(request => /^\/api\/tasks\/[^/?]+$/.test(request.path)).length;
    await target.getByRole("button", { name: "Review current state", exact: true }).click();
    await expect(target.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    expect(fixture.requests.filter(request => /^\/api\/tasks\/[^/?]+$/.test(request.path))).toHaveLength(shows + 1);
  });
  await check("cross-task reference opens the existing task and lazy workspace detail", async () => {
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    const reveal = page.getByRole("button", { name: /Show latest activity/ }); if (await reveal.count()) await reveal.click();
    // Add a shared-contract reference to the live fixture task.
    const task = fixture.tasks.get("demo-running")!;
    fixture.details.set("workspace-proof", { id: "workspace-proof", title: "Workspace proof", kind: "artifact", mediaType: "text/plain", content: "Artifact only read after activation." });
    task.entries.push({ id: "workspace-proof-entry", cursor: ++task.watermark, createdAt: new Date().toISOString(), kind: "reference", reference: { id: "workspace-proof", title: "Workspace proof" } });
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    const latest = page.getByRole("button", { name: /Show latest activity/ }); if (await latest.count()) await latest.click();
    await page.getByRole("button", { name: "Workspace proof", exact: true }).click();
    await expect(page.getByText("Artifact only read after activation.", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Workspace proof", exact: true })).toBeFocused();
    expect(fixture.requests.filter(request => request.path === "/api/details/workspace-proof")).toHaveLength(1);
    await page.getByRole("button", { name: "Work overview", exact: true }).click();
  });
  await check("offline pauses reads and recovers; reset obtains an explained fresh snapshot", async () => {
    await page.context().setOffline(true); await expect(page.getByText("Offline · tasks continue", { exact: true })).toBeVisible();
    const before = fixture.requests.filter(request => request.path.startsWith("/api/workspace")).length;
    await page.waitForTimeout(2800); expect(fixture.requests.filter(request => request.path.startsWith("/api/workspace"))).toHaveLength(before);
    fixture.resetProjection(); await page.context().setOffline(false);
    await expect(page.getByText(/center rebuilt its workspace history/)).toBeVisible();
    await expect(page.getByText("Fresh workspace after projection reset.", { exact: true })).toBeVisible();
  });
  await check("dark and narrow light layouts, keyboard and reduced motion", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
    await page.screenshot({ path: `${output}workspace-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Work overview", exact: true }).click();
    await page.screenshot({ path: `${output}workspace-dark-390.png` });
    await page.getByRole("button", { name: "Use light theme", exact: true }).click();
    await page.screenshot({ path: `${output}workspace-light-390.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole("button", { name: "Task index", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Complete task index" })).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  });
  await check("first-request failure is unknown, then recovers to a confirmed snapshot", async () => {
    fixture.failReads(true); await page.reload();
    await expect(page.getByText(/Attention state has not been loaded/)).toBeVisible();
    await expect(page.getByText(/Activity has not been loaded/)).toBeVisible();
    await expect(page.getByText(/No tasks needed your attention/)).not.toBeVisible();
    fixture.failReads(false); await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByText("Fresh workspace after projection reset.", { exact: true })).toBeVisible();
  });
  expect(errors).toEqual([]);
  await writeFile(`${output}browser-results.json`, JSON.stringify({ type: "HTTP fixture; not real center", at: new Date().toISOString(), checks, pageErrors: errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}browser-failure.png` });
  await writeFile(`${output}browser-failure.txt`, `${String(error)}\nChecks: ${checks.join(", ")}\nPage errors: ${errors.join("; ")}`);
  throw error;
} finally { await browser.close(); await preview.close(); }
