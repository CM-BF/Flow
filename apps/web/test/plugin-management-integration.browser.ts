import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startPluginManagementPreview } from "./plugin-management-integration.fixture";

declare global {
  interface Window {
    __X03_HOLD_NEXT_DETAIL__?: boolean;
    __X03_DETAIL_READY__?: boolean;
    __X03_RELEASE_DETAIL__?: () => void;
  }
}
const startedAt = new Date().toISOString();
const sourceFiles = Object.fromEntries(await Promise.all([
  "apps/web/src/App.tsx", "apps/web/src/plugin-integration/react.tsx", "apps/web/src/plugin-integration/integration.css",
  "apps/web/test/plugin-management-integration.fixture.ts", "apps/web/test/plugin-management-integration.browser.ts",
].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
const production = process.argv.includes("--production");
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-x03/", import.meta.url));
const preview = await startPluginManagementPreview(production);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
page.setDefaultTimeout(8000);
const errors: string[] = [], checks: string[] = [], modules: string[] = [];
let failure: string | undefined;
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.url().includes("PluginManagement")) modules.push(request.url()); });
await page.addInitScript(() => {
  const fetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!window.__X03_HOLD_NEXT_DETAIL__ || !/^\/api\/plugins\/[^/]+$/.test(url.pathname)) return fetch(...args);
    window.__X03_HOLD_NEXT_DETAIL__ = false;
    const response = await fetch(...args), body = await response.text();
    window.__X03_DETAIL_READY__ = true;
    await new Promise<void>(resolve => { window.__X03_RELEASE_DETAIL__ = resolve; });
    // Test-only late delivery ignores abort after the real HTTP response has arrived.
    return new Response(body, { status: response.status, headers: response.headers });
  };
});
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
const settings = page.getByRole("button", { name: "Extensions and appearance", exact: true });
const summary = page.locator(".flow-plugin-management-disclosure > summary");
const registry = page.getByRole("region", { name: "Center registry", exact: true });
const local = page.getByRole("region", { name: "Browser extensions", exact: true });
const target = () => registry.getByRole("button", { name: "View sample.notes", exact: true });
const draft = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])').getByRole("textbox", { name: "Message input", exact: true });
const reads = () => [...preview.first.registryReads, ...preview.second.registryReads];
const open = async () => { await settings.click(); await expect(summary).toBeVisible(); };
const expand = async () => { if (!(await page.locator(".flow-plugin-management-disclosure").getAttribute("open") !== null)) await summary.click(); await expect(target()).toBeVisible(); };
const close = async (escape = false) => { if (escape) await page.keyboard.press("Escape"); else await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click(); await expect(settings).toBeFocused(); };
try {
  await page.goto(preview.url);
  await expect(draft()).toBeVisible(); await draft().fill("This draft survives plugin management.");
  await check("App and collapsed Settings read no registry or lazy module; first expansion reads one personal page", async () => {
    expect(reads()).toHaveLength(0); expect(modules).toHaveLength(0);
    await open(); expect(reads()).toHaveLength(0); expect(modules).toHaveLength(0);
    await summary.focus(); await page.keyboard.press("Enter"); await expect(target()).toBeVisible();
    expect(reads()).toHaveLength(1); expect(reads()[0]!.path).toBe("/api/plugins?limit=10");
    await expect(registry.locator(".flow-plugin-rows > li")).toHaveCount(10);
    await expect(registry).toContainText("Personal workspace registrations");
    expect(modules.length).toBeGreaterThan(0);
  });
  await check("real App details, versions and audit are explicit and paginated without settings CSS contamination", async () => {
    await target().click(); await expect(page.getByLabel("Public configuration", { exact: true })).toContainText("centerA");
    expect(reads()).toHaveLength(2);
    await page.getByRole("button", { name: "Show versions", exact: true }).click();
    await expect(page.getByRole("region", { name: "Registered versions", exact: true }).locator("li")).toHaveCount(10);
    await page.getByRole("button", { name: "Next versions page", exact: true }).click();
    await expect(page.getByRole("region", { name: "Registered versions", exact: true }).locator("li")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Next versions page", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Show audit history", exact: true }).click();
    await expect(page.getByRole("region", { name: "Registration audit", exact: true }).locator("li")).toHaveCount(10);
    expect(await registry.locator(".flow-plugin-rows > li").first().evaluate(node => getComputedStyle(node).display)).toBe("list-item");
    expect(reads().filter(read => read.path.includes("/versions"))).toHaveLength(2);
    expect(reads().filter(read => read.path.includes("/operations"))).toHaveLength(1);
  });
  await check("same-named center registration remains unavailable while local disable/enable changes only the live host", async () => {
    const before = reads().length;
    await page.getByRole("region", { name: "Local extension controls", exact: true }).getByRole("button", { name: "Disable sample.notes", exact: true }).click();
    await expect(local.getByRole("listitem").filter({ hasText: "sample.notes" }).locator(".flow-plugin-status")).toHaveText("disabled");
    await expect(registry).toContainText("Registered · runtime unavailable");
    await expect(page.getByLabel("Public configuration", { exact: true })).toContainText("centerA");
    await page.getByRole("button", { name: "Enable sample.notes", exact: true }).click();
    await expect(local.getByRole("listitem").filter({ hasText: "sample.notes" }).locator(".flow-plugin-status")).toHaveText("active");
    expect(reads()).toHaveLength(before); expect(reads().every(read => read.method === "GET")).toBe(true);
    await close(); await expect(draft()).toHaveValue("This draft survives plugin management.");
    await expect(page.locator('.flow-chat-group.focused .aui-thread-root')).toBeVisible();
  });
  await check("Close and Escape return focus; collapsing aborts a pending detail and removes its reading subtree", async () => {
    await open(); await expand(); await close(true);
    await open(); await expand(); preview.first.holdNextDetail(); const before = preview.first.registryReads.length;
    await target().click(); await expect.poll(() => preview.first.registryReads.length).toBe(before + 1);
    await expect(page.getByRole("status").filter({ hasText: "Loading registration" })).toBeVisible();
    await summary.focus(); await page.keyboard.press("Space"); await expect(registry).toHaveCount(0); await expect(summary).toBeFocused();
    await expect.poll(() => preview.first.abortedReads()).toBe(1); preview.first.releaseDetail();
    const stopped = reads().length;
    await page.getByRole("button", { name: "Disable sample.notes", exact: true }).click();
    expect(reads()).toHaveLength(stopped);
    await close(); await expect(draft()).toHaveValue("This draft survives plugin management.");
  });
  await check("center replacement rejects a late old detail with identical plugin ID and resets the disclosure", async () => {
    await open(); await expand();
    await page.evaluate(() => { window.__X03_HOLD_NEXT_DETAIL__ = true; window.__X03_DETAIL_READY__ = false; });
    await target().click(); await expect.poll(() => page.evaluate(() => window.__X03_DETAIL_READY__)).toBe(true);
    await close(); await page.getByRole("button", { name: "Change connection", exact: true }).click();
    await page.getByLabel("Center URL", { exact: true }).fill(preview.centers[1]!);
    await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(settings).toBeVisible(); await open(); expect(preview.second.registryReads).toHaveLength(0);
    await expand(); await target().click(); await expect(page.getByLabel("Public configuration", { exact: true })).toContainText("centerB");
    await page.evaluate(() => window.__X03_RELEASE_DETAIL__?.());
    await expect(page.getByLabel("Public configuration", { exact: true })).toHaveText("centerB");
    await expect(page.getByRole("button", { name: "Disable sample.notes", exact: true })).toBeVisible();
  });
  await check("registry read failure is visible and retry preserves Settings and its independent local controls", async () => {
    const route = /\/api\/plugins\?/;
    await page.route(route, request => request.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"code":"unavailable","message":"Fixture failure"}}' }));
    await page.getByRole("button", { name: "Refresh registry", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not load registry" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Local extension controls", exact: true })).toBeVisible();
    await page.unroute(route); await page.getByRole("button", { name: "Retry registry", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0); await expect(target()).toBeVisible();
  });
  await check("desktop and 390px light/dark Settings keep keyboard focus, readable registry and no horizontal overflow", async () => {
    await close();
    if (await page.getByRole("button", { name: "Use light theme", exact: true }).isVisible()) await page.getByRole("button", { name: "Use light theme", exact: true }).click();
    await open(); await expand(); await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}integration-light.png` });
    await close(); await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
    await open(); await expand(); await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}integration-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const scheme of ["dark", "light"] as const) {
      if (scheme === "light") { await close(); await page.getByRole("button", { name: "Use light theme", exact: true }).click(); await open(); await expand(); }
      await target().click(); await expect(page.getByLabel("Public configuration", { exact: true })).toContainText("centerB");
      await summary.focus(); await summary.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: `${output}integration-${scheme}-390.png` });
      await expect(summary).toBeFocused(); await close(true);
      if (scheme === "dark") { await open(); await expand(); }
    }
  });
  if (!production) await check("failed lazy module stays local with an honest reload message; disclosure and original draft remain usable", async () => {
    const isolated = await browser.newPage(); isolated.setDefaultTimeout(8000);
    isolated.on("pageerror", error => errors.push(error.message));
    try {
      await isolated.route("**/src/plugin-management/PluginManagement.tsx", route => route.abort("failed"));
      await isolated.goto(preview.url);
      await isolated.getByRole("textbox", { name: "Message input", exact: true }).fill("Keep this draft after chunk failure");
      await isolated.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
      const disclosure = isolated.locator(".flow-plugin-management-disclosure > summary");
      await disclosure.click();
      await expect(isolated.getByRole("alert")).toContainText("Plugin management could not load");
      await expect(isolated.getByRole("alert")).toContainText("Copy unsent text before you reload this page");
      await isolated.unroute("**/src/plugin-management/PluginManagement.tsx");
      await disclosure.focus(); await isolated.keyboard.press("Space");
      await expect(isolated.getByRole("alert")).toHaveCount(0);
      await expect(disclosure).toBeFocused();
      await isolated.keyboard.press("Escape");
      await expect(isolated.getByRole("textbox", { name: "Message input", exact: true })).toHaveValue("Keep this draft after chunk failure");
    } finally { await isolated.close(); }
  });
  expect(errors).toEqual([]);
} catch (error) {
  failure = String(error); console.error(error);
  await page.screenshot({ path: `${output}browser-failure.png` });
  process.exitCode = 1;
} finally {
  await browser.close(); await preview.close();
  await writeFile(`${output}${production ? "production-" : ""}browser-results.json`, JSON.stringify({ startedAt, endedAt: new Date().toISOString(), sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), production, sourceFiles, checks, pageErrors: errors, failure, registryReads: reads(), modules, scope: "Actual Flow App through public HTTP fixture; no center/DB/SDK/model executed" }, null, 2) + "\n");
}
