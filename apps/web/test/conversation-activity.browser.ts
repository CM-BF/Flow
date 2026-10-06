import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { startActivityFixture } from "./conversation-activity.fixture";
const production = process.argv.includes("--production"), startedAt = new Date().toISOString();
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const paths = ["projection.ts", "ConversationActivity.tsx", "activity.css"].map(name => `apps/web/src/conversation-activity/${name}`).concat(["test.ts", "fixture.ts", "browser.ts"].map(ext => `apps/web/test/conversation-activity.${ext}`));
const sourceFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-activity01/", import.meta.url));
const fixture = await startActivityFixture(production), browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }); page.setDefaultTimeout(8000);
const errors: string[] = [], checks: string[] = []; let failure: string | null = null;
page.on("pageerror", error => errors.push(error.message));
const region = () => page.getByRole("region", { name: "Execution activity", exact: true });
const events = (center = fixture.first) => center.reads.filter(path => path.includes("/events"));
const details = (center = fixture.first) => center.reads.filter(path => path.includes("/details/"));
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
try {
  await page.goto(fixture.url); await page.getByRole("button", { name: "Show activity", exact: true }).waitFor();
  await check("collapsed zero reads; keyboard expansion reads one timeline and no detail", async () => {
    expect(fixture.first.reads).toHaveLength(0); await page.getByRole("button", { name: "Show activity", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(region().getByRole("button", { name: "A execution reference", exact: true })).toBeVisible(); expect(events()).toHaveLength(1); expect(details()).toHaveLength(0);
    expect(await region().locator('[data-activity-entry]').count()).toBe(25);
  });
  await check("reference is lazy/cached; text escaped and paged below the public 1 MiB limit", async () => {
    const button = region().getByRole("button", { name: "A execution reference", exact: true }); await button.focus(); await page.keyboard.press("Enter");
    await expect(region().locator("pre")).toContainText("<script>not executed</script>"); expect(details()).toHaveLength(1);
    expect((await region().locator("pre").textContent())!.length).toBeLessThanOrEqual(8192); await region().getByRole("button", { name: "Next text", exact: true }).click();
    await expect(region()).toContainText("Text page 2"); await button.click(); await button.click(); expect(details()).toHaveLength(1);
    await expect(button).toBeFocused();
  });
  await check("explicit pagination keeps at most 25 rows and updates source/stale without overriding host summary", async () => {
    await region().getByRole("button", { name: "Load more activity", exact: true }).click(); await expect(region()).toContainText("60 entries loaded");
    await region().getByRole("button", { name: "Next entries", exact: true }).click(); expect(await region().locator('[data-activity-entry]').count()).toBe(25);
    await page.getByRole("button", { name: "Host completes task", exact: true }).click(); await expect(region()).toContainText("succeeded"); await expect(region()).toContainText("Verification: pending"); await expect(region()).toContainText("May be out of date");
    await region().getByRole("button", { name: "Refresh activity", exact: true }).click(); await expect(region()).toContainText("61 entries loaded"); await expect(region()).toContainText("succeeded");
  });
  await check("errors preserve old entries and hide/offline stop new requests", async () => {
    fixture.first.fail(true); await region().getByRole("button", { name: "Refresh activity", exact: true }).click(); await expect(region().getByRole("alert")).toContainText("Simulated activity failure");
    await expect(region()).toContainText("61 entries loaded"); fixture.first.fail(false);
    await page.getByRole("button", { name: "Go offline", exact: true }).click(); await expect(region().getByRole("button", { name: "Refresh activity", exact: true })).toBeDisabled();
    const count = events().length; await page.getByRole("button", { name: "Hide activity", exact: true }).click(); await page.getByRole("button", { name: "Go online", exact: true }).click(); expect(events()).toHaveLength(count);
    await page.getByRole("button", { name: "Show activity", exact: true }).click(); await expect(region().getByRole("button", { name: "Refresh activity", exact: true })).toBeEnabled();
  });
  await check("same-ID center switch clears cached details and suppresses delayed old events", async () => {
    fixture.first.holdNextEvent(); await region().getByRole("button", { name: "Refresh activity", exact: true }).click();
    await page.getByRole("button", { name: "Switch center", exact: true }).click(); await expect(region().getByRole("button", { name: "B execution reference", exact: true })).toBeVisible(); fixture.first.release();
    expect(details(fixture.second)).toHaveLength(0); await expect(region().getByRole("button", { name: "A execution reference", exact: true })).toHaveCount(0);
    await region().getByRole("button", { name: "B execution reference", exact: true }).click(); await expect(region().locator("pre")).toContainText("B detail"); expect(details(fixture.second)).toHaveLength(1);
  });
  await check("detail pending across hidden view and new center cannot reveal old content", async () => {
    await page.getByRole("button", { name: "Switch center", exact: true }).click(); await expect(region().getByRole("button", { name: "A execution reference", exact: true })).toBeVisible();
    fixture.first.holdNextDetail(); await region().getByRole("button", { name: "A execution reference", exact: true }).click(); await expect(region()).toContainText("Loading detail");
    await page.getByRole("button", { name: "Hide activity", exact: true }).click(); await expect(region()).toHaveCount(0); fixture.first.release();
    await page.getByRole("button", { name: "Switch center", exact: true }).click(); await page.getByRole("button", { name: "Show activity", exact: true }).click();
    await expect(region().getByRole("button", { name: "B execution reference", exact: true })).toBeVisible(); await expect(region().locator("pre")).toHaveCount(0);
  });
  await check("light/dark narrow keyboard view has no overflow or animation and keeps one disclosure", async () => {
    await page.screenshot({ path: `${output}${production ? 'production-' : ''}desktop-light.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "Dark theme", exact: true }).click();
    await region().getByRole("button", { name: "B execution reference", exact: true }).focus(); await page.keyboard.press("Enter"); await expect(region().locator("pre")).toContainText("B detail");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const list = region().getByRole("list", { name: "Activity entries", exact: true });
    await list.focus(); await page.keyboard.press("End"); await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("Home"); await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);
    await region().locator("pre").focus(); await expect(region().locator("pre")).toBeFocused();
    expect(await region().locator("details").count()).toBe(0);
    expect(await region().getByRole("button", { name: "B execution reference", exact: true }).evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
    await page.screenshot({ path: `${output}${production ? 'production-' : ''}narrow-dark.png`, fullPage: true });
    await page.getByRole("button", { name: "Light theme", exact: true }).click(); await page.screenshot({ path: `${output}${production ? 'production-' : ''}narrow-light.png`, fullPage: true });
  });
  expect(errors).toEqual([]);
} catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); console.error(failure); }
finally {
  await writeFile(`${output}${production ? 'production-' : ''}browser-results.json`, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), sourceCommit, sourceDirty: true, sourceFiles, production, checks, errors, failure }, null, 2) + "\n");
  await browser.close(); await fixture.close();
}
if (failure) process.exitCode = 1;
