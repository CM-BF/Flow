import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { DirectoryProfile } from "../src/execution-profiles/selection";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = fileURLToPath(new URL("../../../docs/evidence/wpf-profileux/", import.meta.url));
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const longModel = "team-configured-" + "long-model-alias-".repeat(8);
function profile(value: number, connection: number): DirectoryProfile {
  const model = value === 21 ? longModel : connection === 1 ? "configured-alias" : "other-center-alias";
  return {
    reference: { id: id(value), runnerId: id(100 + value), configDigest: "a".repeat(64) },
    configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model, thinking: "disabled", permissionMode: "dontAsk", access: value === 1 ? "none" : value === 2 ? "goal-tools" : value === 3 ? "unsupported-fixture-access" : "configured-readonly", requireReadApproval: value > 3, materialScopeDigest: value === 2 ? "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" : "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 } },
    source: "runner-configured", availability: "not-probed",
    model: { value: model, resolvedModel: null, displayName: "Configured model", description: "Fixture declaration", providerCapabilities: "unknown" },
    controls: { model: "select-configured-profile", thinking: "fixed-disabled", effort: "unsupported", access: "configured-policy", queue: false, steer: false }, createdAt: "2026-10-06T04:00:00Z",
  };
}
async function startFixture() {
  let fail = 0, delay = 0;
  const requests: string[] = [];
  const server = await createServer({ root, configFile: false, plugins: [react(), tailwindcss(), {
    name: "profile-http-fixture", configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url!, "http://fixture");
        if (url.pathname === "/") {
          response.setHeader("content-type", "text/html"); void vite.transformIndexHtml("/", '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Execution profile fixture</title><div id="root"></div><script type="module" src="/test/execution-profiles.fixture.tsx"></script></html>').then(html => response.end(html), next); return;
        }
        if (url.pathname === "/fixture-control") { fail = Number(url.searchParams.get("fail") ?? 0); delay = Number(url.searchParams.get("delay") ?? 0); response.end("ok"); return; }
        const match = url.pathname.match(/^\/connection-(\d+)\/api\/execution-profiles$/);
        if (!match) return next();
        requests.push(request.url!);
        assert.equal(request.headers.authorization, "Bearer fixture-only");
        const status = fail, wait = delay; fail = 0;
        const profiles = Array.from({ length: 21 }, (_, index) => profile(index + 1, Number(match[1])));
        const after = url.searchParams.get("after"), page = profiles.filter(item => !after || item.reference.id > after).slice(0, 20);
        const payload = status ? { error: { code: "fixture-failure", message: "Fixture failure" } } : { profiles: page, nextCursor: page.length === 20 ? page.at(-1)!.reference.id : null };
        setTimeout(() => { response.statusCode = status || 200; response.setHeader("content-type", "application/json"); response.end(JSON.stringify(payload)); }, wait);
      });
    },
  }], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await server.listen();
  const address = server.httpServer!.address(); assert(address && typeof address !== "string");
  return { server, requests, url: `http://127.0.0.1:${address.port}` };
}
async function main() {
  const fixture = await startFixture();
  if (process.argv.includes("--serve")) { console.log(`PROFILEUX01_HTTP_FIXTURE=${fixture.url}`); return; }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [], checks: string[] = [];
  const geometry: Array<{ label: string; width: number; height: number }> = []; page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  const open = async () => { await page.getByRole("button", { name: /^Execution profile:/ }).click(); await expect(page.getByRole("dialog")).toBeVisible(); };
  const close = async () => { await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); };
  try {
    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    assert.equal(fixture.requests.length, 1);
    await page.getByLabel("Draft", { exact: true }).fill("Draft remains mine"); await open();
    await expect(page.getByRole("radio")).toHaveCount(21);
    await expect(page.getByRole("radio").nth(2)).toBeDisabled();
    await expect(page.getByRole("radio").nth(3)).toBeDisabled();
    await expect(page.getByText("Cannot be used for ordinary chat", { exact: true })).toHaveCount(2);
    await page.getByRole("radio").nth(1).focus(); await page.keyboard.press("Space");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await page.keyboard.press("ArrowDown"); await expect(page.getByRole("radio").nth(4)).toBeChecked();
    await page.getByRole("radio").nth(1).check();
    await page.screenshot({ path: `${evidence}profiles-light.png` });
    await page.request.get(`${fixture.url}/fixture-control?fail=503`);
    await page.getByRole("button", { name: "Load more profiles" }).click();
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    await expect(page.getByRole("radio")).toHaveCount(21);
    await page.getByRole("button", { name: "Load more profiles" }).click(); await expect(page.getByRole("radio")).toHaveCount(22);
    await expect(page.getByRole("button", { name: "Load more profiles" })).toHaveCount(0); assert.equal(fixture.requests.length, 3);
    checks.push("Failed later page retains choices and retry successfully fetches that page; Actual FlowClient HTTP pages: 20 then 1; identical model labels preserve distinct runner/profile declarations; goal-tools/unknown stay visible and disabled; keyboard skips disabled entries");
    await close(); await expect(page.getByRole("button", { name: /^Execution profile:/ })).toBeFocused();
    await expect(page.getByLabel("Draft", { exact: true })).toHaveValue("Draft remains mine");
    checks.push("Escape returns focus to trigger and changing selection preserves unsent draft; no send endpoint exists");

    await page.request.get(`${fixture.url}/fixture-control?fail=401`); await open(); await page.getByRole("button", { name: "Refresh profiles" }).click();
    await expect(page.getByRole("alert")).toContainText("Access expired"); await expect(page.getByRole("radio").nth(1)).toBeChecked(); await expect(page.getByRole("radio").nth(1)).toBeDisabled();
    await expect(page.getByRole("radio")).toHaveCount(22);
    await page.getByRole("button", { name: "Refresh profiles" }).click(); await expect(page.getByRole("alert")).toHaveCount(0); await expect(page.getByRole("radio").nth(1)).toBeEnabled();
    checks.push("401 keeps previous pages/selection visible, marks stale and prevents new configured selection; explicit refresh recovers");

    await close(); await page.getByRole("button", { name: "Dark", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await open();
    await expect(page.getByRole("dialog")).toHaveCSS("animation-name", "none");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${evidence}profiles-dark-390.png` }); await close();
    await page.getByRole("button", { name: "Freeze pending creation" }).click();
    await expect(page.getByRole("region", { name: "Locked execution profile" })).toContainText("Creation receipt pending");
    await expect(page.getByRole("button", { name: /^Execution profile:/ })).toHaveCount(0);
    await expect(page.getByTestId("selection")).toContainText('"model":"configured-alias"');
    await page.screenshot({ path: `${evidence}profiles-pending-dark-390.png` });
    checks.push("Dark 390px/reduced-motion dialog has no horizontal overflow; pending receipt locks exact frozen creation before any summary");

    await page.getByRole("button", { name: "New connection" }).click(); await expect(page.getByTestId("catalog-state")).toContainText("connection 2"); await expect(page.getByTestId("selection")).toHaveText("legacy-default");
    await open(); await expect(page.getByText("Requested model: other-center-alias")).toHaveCount(20); await page.getByRole("radio").nth(4).check(); await close();
    await page.getByRole("button", { name: "Show created lock" }).click(); await expect(page.getByRole("region", { name: "Locked execution profile" })).toContainText("Conversation profile locked");
    await expect(page.getByTestId("selection")).toContainText('"tools":"configured-readonly"');
    checks.push("New connection has new catalog and explicit default; created lock reports selected access without claiming effective settings");
    const locked = page.getByRole("region", { name: "Locked execution profile" });
    const disclosure = locked.locator("summary");
    const noSideEffects = async () => {
      const requestsBefore = fixture.requests.length;
      const selectionBefore = await page.getByTestId("selection").textContent();
      const draftBefore = await page.getByLabel("Draft", { exact: true }).inputValue();
      await disclosure.focus(); await page.keyboard.press("Enter");
      await expect(locked.locator("details")).toHaveAttribute("open", "");
      await expect(disclosure).toBeFocused();
      const creation = JSON.parse(selectionBefore!);
      if (creation.executionProfile) {
        await expect(locked.getByText(creation.executionProfile.id, { exact: true })).toBeVisible();
        await expect(locked.getByText(creation.executionProfile.runnerId, { exact: true })).toBeVisible();
        await expect(locked.getByText(creation.executionProfile.configDigest, { exact: true })).toBeVisible();
      }
      await expect(locked.getByText("Requested configuration only.", { exact: false })).toBeVisible();
      await page.keyboard.press("Space");
      await expect(locked.locator("details")).not.toHaveAttribute("open");
      await expect(disclosure).toBeFocused();
      assert.equal(fixture.requests.length, requestsBefore, "Disclosure must not refresh or send");
      assert.equal(await page.getByTestId("selection").textContent(), selectionBefore);
      assert.equal(await page.getByLabel("Draft", { exact: true }).inputValue(), draftBefore);
    };
    const measure = async (label: string, maximumHeight: number) => {
      const box = await locked.boundingBox(); assert(box);
      geometry.push({ label, width: box.width, height: box.height });
      assert(box.height <= maximumHeight, `${label}: ${box.height} > ${maximumHeight}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await expect(locked.getByText("Requested only · actual settings unknown", { exact: true })).toBeVisible();
    };
    // The frozen display works without a loaded directory and never exposes a reconfiguration action.
    await page.getByLabel("Draft", { exact: true }).fill("Still editing after creation");
    await expect(locked.locator("dl")).not.toBeVisible();
    await measure("created-dark-390", 110); await noSideEffects();
    await page.screenshot({ path: `${evidence}summary-created-dark-390.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    await measure("created-dark-1280", 90);
    await page.screenshot({ path: `${evidence}summary-created-dark.png` });
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await measure("created-light-1280", 90);
    await page.screenshot({ path: `${evidence}summary-created-light.png` });
    checks.push("Created compact summary preserves full pin/digest behind native disclosure; Enter/Space retain focus and emit zero HTTP, selection or draft changes; actual remains explicitly unknown");

    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    await page.getByRole("button", { name: "Show created lock" }).click();
    await expect(locked.getByText("Unpinned legacy default", { exact: false }).first()).toBeVisible();
    await expect(locked.locator("dl")).not.toBeVisible(); await noSideEffects();
    checks.push("Legacy created conversation stays visibly unpinned; details reveal the exact legacy request without inventing a profile");

    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    await open(); await page.getByRole("radio").nth(1).check(); await close();
    await page.getByLabel("Draft", { exact: true }).fill("Pending creation must preserve this draft");
    await page.getByRole("button", { name: "Freeze pending creation" }).click();
    await expect(locked).toContainText("Creation receipt pending");
    await expect(page.getByRole("button", { name: /^Execution profile:/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show created lock" })).toBeDisabled();
    await noSideEffects(); await measure("pending-light-1280", 90);
    await page.screenshot({ path: `${evidence}summary-pending-light.png` });
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 }); await measure("pending-dark-390", 110);
    await page.screenshot({ path: `${evidence}summary-pending-dark-390.png` });
    checks.push("Pending receipt cannot change profile; collapsing and expanding keeps the exact original reference and live unsent draft");

    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    await open(); await page.getByRole("button", { name: "Load more profiles" }).click();
    await expect(page.getByRole("radio")).toHaveCount(22); await page.getByRole("radio").nth(21).check(); await close();
    await page.getByRole("button", { name: "Show created lock" }).click();
    await expect(locked.getByText(`Requested: ${longModel}`, { exact: true })).toBeVisible();
    await measure("long-model-light-390", 180); await noSideEffects();
    await page.screenshot({ path: `${evidence}summary-long-model-light-390.png` });
    checks.push("Long declared model wraps at 390px without clipping or horizontal overflow; loaded duplicate display names retain separate full runner/profile labels");
    assert.deepEqual(errors, []);
  } finally {
    await writeFile(`${evidence}browser-results.json`, JSON.stringify({ at: new Date().toISOString(), url: fixture.url, checks, errors, geometry, requests: fixture.requests, browser: browser.version(), fixtureOnly: true }, null, 2));
    await browser.close(); await fixture.server.close();
  }
  console.log(JSON.stringify({ passed: checks.length, errors }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
