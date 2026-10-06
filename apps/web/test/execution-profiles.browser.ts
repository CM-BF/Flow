import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { ExecutionProfile } from "@flow/contracts";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = fileURLToPath(new URL("../../../docs/evidence/wpf-profile01/", import.meta.url));
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function profile(value: number, connection: number): ExecutionProfile {
  return {
    reference: { id: id(value), runnerId: id(100 + value), configDigest: "a".repeat(64) },
    configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: connection === 1 ? "configured-alias" : "other-center-alias", thinking: "disabled", permissionMode: "dontAsk", access: value === 1 ? "none" : "configured-readonly", requireReadApproval: value !== 1, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 } },
    source: "runner-configured", availability: "not-probed",
    model: { value: connection === 1 ? "configured-alias" : "other-center-alias", resolvedModel: null, displayName: "Configured model", description: "Fixture declaration", providerCapabilities: "unknown" },
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
  if (process.argv.includes("--serve")) { console.log(`PROFILE01_HTTP_FIXTURE=${fixture.url}`); return; }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [], checks: string[] = []; page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  const open = async () => { await page.getByRole("button", { name: /^Execution profile:/ }).click(); await expect(page.getByRole("dialog")).toBeVisible(); };
  const close = async () => { await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); };
  try {
    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    assert.equal(fixture.requests.length, 1);
    await page.getByLabel("Draft", { exact: true }).fill("Draft remains mine"); await open();
    await expect(page.getByRole("radio")).toHaveCount(21);
    await page.getByRole("radio").nth(1).focus(); await page.keyboard.press("Space");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await page.screenshot({ path: `${evidence}profiles-light.png` });
    await page.request.get(`${fixture.url}/fixture-control?fail=503`);
    await page.getByRole("button", { name: "Load more profiles" }).click();
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    await expect(page.getByRole("radio")).toHaveCount(21);
    await page.getByRole("button", { name: "Load more profiles" }).click(); await expect(page.getByRole("radio")).toHaveCount(22);
    await expect(page.getByRole("button", { name: "Load more profiles" })).toHaveCount(0); assert.equal(fixture.requests.length, 3);
    checks.push("Failed later page retains choices and retry successfully fetches that page; Actual FlowClient HTTP pages: 20 then 1; identical model labels preserve 21 distinct runner/profile choices; keyboard native radio selection");
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
    await open(); await expect(page.getByText("Requested model: other-center-alias")).toHaveCount(20); await page.getByRole("radio").nth(2).check(); await close();
    await page.getByRole("button", { name: "Show created lock" }).click(); await expect(page.getByRole("region", { name: "Locked execution profile" })).toContainText("Conversation profile locked");
    await expect(page.getByTestId("selection")).toContainText('"tools":"configured-readonly"');
    checks.push("New connection has new catalog and explicit default; created lock reports selected access without claiming effective settings");
    assert.deepEqual(errors, []);
  } finally {
    await writeFile(`${evidence}browser-results.json`, JSON.stringify({ at: new Date().toISOString(), url: fixture.url, checks, errors, requests: fixture.requests, browser: browser.version(), fixtureOnly: true }, null, 2));
    await browser.close(); await fixture.server.close();
  }
  console.log(JSON.stringify({ passed: checks.length, errors }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
