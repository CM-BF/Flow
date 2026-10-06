import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, expect, type Page } from "@playwright/test";
import { build } from "vite";
import { createPerformanceFixture, FIXTURE_TOKEN } from "./performance-fixture";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = join(root, "docs/evidence/wpf-perf02");
const frames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface ExpectedRecord { id: string; cursor: number; text: string | null }
/** Public window controls and visible DOM, never private projection/React hooks. */
export async function verifyAllRecords(page: Page, expected: ExpectedRecord[]) {
  await page.getByLabel("Task activity records", { exact: true }).evaluate(element => { element.scrollTop = 0; });
  await frames(page);
  const records = new Map<number, ExpectedRecord>();
  let windows = 0, maxMounted = 0;
  while (true) {
    const rows = await page.locator(".wf-records > [data-entry-id]").evaluateAll(elements => elements.map(element => ({ id: (element as HTMLElement).dataset.entryId!, cursor: Number((element as HTMLElement).dataset.cursor), text: element.querySelector("article > p")?.textContent ?? null })));
    maxMounted = Math.max(maxMounted, rows.length);
    rows.forEach(row => { const previous = records.get(row.cursor); if (previous) assert.deepEqual(previous, row); records.set(row.cursor, row); });
    assert(++windows < expected.length + 2, "Window traversal must advance");
    const next = page.getByRole("button", { name: "Later records", exact: true });
    if (await next.isDisabled()) break;
    const before = rows.at(-1)?.cursor;
    await next.click();
    await expect.poll(async () => Number(await page.locator(".wf-records > [data-entry-id]").last().getAttribute("data-cursor"))).toBeGreaterThan(before!);
    await frames(page);
  }
  const actual = [...records.values()].sort((a, b) => a.cursor - b.cursor);
  assert.deepEqual(actual, expected);
  assert(maxMounted < 60, `Mounted ${maxMounted} rows, expected a bounded viewport`);
  return { records: actual.length, windows, maxMounted, expectedSHA256: digest(expected), actualSHA256: digest(actual) };
}

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "flow-window-"));
  const dist = join(directory, "dist");
  const fixture = createPerformanceFixture(16, dist);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(15_000);
  const checks: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const record = async () => {
    await page.screenshot({ path: join(output, "window-current.png") });
    await writeFile(join(output, "window-browser.json"), JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2));
  };
  try {
    await build({ root: join(root, "apps/web"), build: { outDir: dist, emptyOutDir: true } });
    const url = await fixture.listen();
    await page.goto(url);
    await page.getByLabel("Owner token").fill(FIXTURE_TOKEN);
    await page.getByRole("button", { name: "Connect workspace" }).click();
    await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", "40");
    fixture.append(1000);
    for (const task of fixture.tasks.values()) for (const entry of task.entries) {
      if (entry.kind === "text" && Number(entry.id.split("-").at(-1)) > 40 && Number(entry.id.split("-").at(-1)) % 19 === 0) entry.text += "\nVariable height authorized fixture text.".repeat(8);
    }
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", "1040", { timeout: 30_000 });
    const expected: ExpectedRecord[] = [...fixture.tasks.values()].flatMap(task => task.entries.filter(entry => entry.kind === "text").map(entry => ({ id: `perf-record-${16 + Number(entry.id.split("-").at(-1))}`, cursor: 16 + Number(entry.id.split("-").at(-1)), text: entry.kind === "text" ? entry.text : null }))).sort((a, b) => a.cursor - b.cursor);
    const traversal = await verifyAllRecords(page, expected);
    await writeFile(join(output, "window-integrity.json"), JSON.stringify(traversal, null, 2));
    checks.push("1040 variable-height records: every cursor/id/body hash accessible through bounded public windows");
    await record();
    const feed = page.getByLabel("Task activity records", { exact: true });
    await feed.evaluate(element => { element.scrollTop = 0; });
    await expect(page.locator(".wf-records > [data-entry-id]").first()).toHaveAttribute("data-cursor", "17"); await frames(page);
    await page.locator(".wf-records > [data-entry-id]").first().getByRole("button").first().focus();
    let last = Number(await page.locator(":focus").evaluate(element => element.closest<HTMLElement>("[data-cursor]")!.dataset.cursor));
    for (let index = 0; index < 40; index++) {
      await page.keyboard.press("Tab");
      const current = Number(await page.locator(":focus").evaluate(element => element.closest<HTMLElement>("[data-cursor]")?.dataset.cursor));
      assert.equal(current, last + 1); last = current;
    }
    checks.push("Tab crosses virtual window boundaries through 40 consecutive record actions without focus loss");
    await feed.evaluate(element => { element.scrollTop += 10000; }); await frames(page);
    assert.equal(Number(await page.locator(":focus").evaluate(element => element.closest<HTMLElement>("[data-cursor]")?.dataset.cursor)), last);
    assert(await page.locator(".wf-records > [data-entry-id]").count() < 60);
    checks.push("Focused offscreen row remains mounted without expanding to all intervening rows");
    await feed.focus();
    await feed.evaluate(element => { element.scrollTop = 25000; }); await frames(page);
    const anchor = await visibleAnchor(page);
    fixture.append(80);
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.locator(".wf-feed-footer")).toContainText("80 new records");
    const after = await visibleAnchor(page); assert.equal(after.id, anchor.id); assert(Math.abs(after.offset - anchor.offset) < 2);
    await page.getByRole("button", { name: "Task index", exact: true }).click();
    await page.getByRole("button", { name: "Activity", exact: true }).click(); await frames(page);
    const restored = await visibleAnchor(page); assert.equal(restored.id, anchor.id); assert(Math.abs(restored.offset - anchor.offset) < 2);
    checks.push("Reading anchor/offset preserved while 80 live records buffer and after index roundtrip");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Hide chat list", exact: true }).click(); await frames(page);
    const narrow = await visibleAnchor(page); assert.equal(narrow.id, anchor.id);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, "window-light-narrow.png") });
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
    await page.screenshot({ path: join(output, "window-dark-narrow.png") });
    checks.push("390px reflow preserves anchor and has no horizontal page overflow; light/dark/reduced motion");
    await page.setViewportSize({ width: 1440, height: 1000 }); await frames(page);
    await page.getByRole("button", { name: /^Show latest activity/ }).click();
    await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", "1120");
    await expect(page.locator(".wf-feed-footer")).toContainText("Following latest activity");
    await expect.poll(async () => feed.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(2);
    checks.push("Explicit reveal retains all 1120 records and follows measured latest row");
    await feed.evaluate(element => { element.scrollTop = 0; }); await frames(page);
    const initial = await visibleAnchor(page);
    await page.getByRole("button", { name: "Load earlier records", exact: true }).click();
    await expect(page.locator(".wf-records")).toHaveAttribute("data-total-records", "1136"); await frames(page);
    const prepended = await feed.evaluate((element, id) => {
      const row = [...element.querySelectorAll<HTMLElement>("[data-entry-id]")].find(row => row.dataset.entryId === id)!;
      return { id: row.dataset.entryId, offset: row.getBoundingClientRect().top - element.getBoundingClientRect().top };
    }, initial.id);
    assert.equal(prepended.id, initial.id); assert(Math.abs(prepended.offset - initial.offset) < 2, JSON.stringify({ initial, prepended }));
    checks.push("Older HTTP page prepends 16 references without displacing the reading ID/offset");
    assert.equal(fixture.requests.filter(request => request.path.startsWith("/api/details/")).length, 0);
    assert.equal(fixture.requests.filter(request => request.path.endsWith("/cancel")).length, 0);
    assert.deepEqual(errors, []); checks.push("No detail prefetch, no cancel, no browser page error");
    await page.screenshot({ path: join(output, "window-dark-desktop.png") });
    await record();
    process.stdout.write(`PASS ${checks.length} Activity window browser groups\n`);
  } catch (error) { await record(); throw error; }
  finally { await browser.close(); await fixture.close(); await rm(directory, { recursive: true, force: true }); }
}
async function visibleAnchor(page: Page) {
  return page.getByLabel("Task activity records", { exact: true }).evaluate(feed => {
    const top = feed.getBoundingClientRect().top;
    const row = [...feed.querySelectorAll<HTMLElement>("[data-entry-id]")].find(element => element.getBoundingClientRect().bottom > top + 1)!;
    return { id: row.dataset.entryId, offset: row.getBoundingClientRect().top - top };
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
