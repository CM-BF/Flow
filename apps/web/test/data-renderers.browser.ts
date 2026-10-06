import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";
import { createConversationFixture } from "./conversation.fixture";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = fileURLToPath(new URL("../../../docs/evidence/wpf-renderer01/", import.meta.url));
async function start() {
  const fixture = createConversationFixture(); fixture.addTurn("chat-2", "Another long reply", true);
  await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
  const address = fixture.server.address(); assert(address && typeof address !== "string");
  const server = await createServer({ root, configFile: false, plugins: [react(), tailwindcss(), { name: "renderer-fixture", configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (req.url !== "/") return next();
      res.setHeader("content-type", "text/html"); void vite.transformIndexHtml("/", '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Trusted data renderers fixture</title><div id="root"></div><script type="module" src="/test/data-renderers.fixture.tsx"></script></html>').then(html => res.end(html), next);
    });
  } }], server: { host: "127.0.0.1", port: 0, proxy: { "/api": `http://127.0.0.1:${address.port}` } }, logLevel: "error" });
  await server.listen(); const web = server.httpServer!.address(); assert(web && typeof web !== "string");
  return { fixture, url: `http://127.0.0.1:${web.port}`, close: async () => { await server.close(); await fixture.close(); } };
}
async function main() {
  const environment = await start();
  if (process.argv.includes("--serve")) { console.log(`RENDERER01_HTTP_FIXTURE=${environment.url}`); return; }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [], checks: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); page.setDefaultTimeout(12_000);
  const details = () => environment.fixture.requests.filter(r => r.path.includes("/details/"));
  const pane = (n: number) => page.getByRole("region", { name: `Pane ${n}`, exact: true });
  try {
    await page.goto(environment.url); await expect(pane(1).getByRole("button", { name: "Read full reply" })).toBeVisible();
    await expect(pane(2).getByRole("button", { name: "Read full reply" })).toBeVisible();
    await expect(pane(1).getByLabel("Provider registrations")).toHaveText("1/1"); await expect(pane(2).getByLabel("Provider registrations")).toHaveText("1/1");
    assert.equal(details().length, 0); await page.getByRole("button", { name: "Activate renderer", exact: true }).click(); assert.equal(details().length, 0);
    checks.push("Official Thread + two isolated AssistantRuntimeProviders + StrictMode register one wrapper each; registration and P01 activation do not fetch details");
    await pane(1).getByPlaceholder("Draft 1").fill("Keep this new draft");
    await pane(1).getByRole("button", { name: "Read full reply" }).focus(); await page.keyboard.press("Enter");
    await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply"); assert.equal(details().length, 1);
    await pane(1).getByRole("button", { name: "Hide full reply" }).click(); await pane(1).getByRole("button", { name: "Read full reply" }).click(); assert.equal(details().length, 1);
    checks.push("Keyboard explicit expansion reads once through FlowClient + real ConversationProjection digest/cache; collapse/reopen reuses cache");
    await page.getByRole("button", { name: "Hide first pane", exact: true }).click(); await expect(pane(1)).toBeHidden(); await expect(pane(2).getByLabel("Provider registrations")).toHaveText("1/1");
    await page.getByRole("button", { name: "Show first pane", exact: true }).click(); await expect(pane(1).getByLabel("Provider registrations")).toHaveText("1/1");
    await expect(pane(1).getByPlaceholder("Draft 1")).toHaveValue("Keep this new draft"); await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply"); assert.equal(details().length, 1);
    checks.push("Real React Activity hide/restore cleans/re-registers only this provider, retains draft + full detail state, and makes zero new detail requests");
    await page.getByRole("button", { name: "Disable renderer", exact: true }).click(); await expect(pane(1).getByText(/Using the standard reply display/)).toBeVisible(); assert.equal(details().length, 1);
    await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply"); assert.equal(details().length, 1);
    await pane(2).getByRole("button", { name: "Read full reply" }).click(); await expect(pane(2).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply"); assert.equal(details().length, 2);
    checks.push("P01 disable falls back to the existing host-authorized detail path; cached A and independent B remain readable without extra privileges");
    await page.getByRole("button", { name: "Broken renderer", exact: true }).click(); await expect(pane(1).getByText(/Using the standard reply display/)).toBeVisible(); await expect(pane(1).getByRole("button", { name: "Hide full reply" })).toBeVisible();
    await page.getByRole("button", { name: "Activate renderer", exact: true }).click(); await expect(pane(1).getByText(/Using the standard reply display/)).toHaveCount(0); assert.equal(details().length, 2);
    checks.push("Throwing trusted renderer is isolated by a local boundary; standard readable fallback and P01 deactivate/reactivate recovery work");
    for (const mode of ["unknown", "version", "schema", "wrongturn"]) {
      await page.getByLabel("Data mode").selectOption(mode); await expect(pane(1).getByRole("button", { name: "Read full reply" })).toHaveCount(0); await expect(pane(1)).toContainText("A thoughtful reply"); assert.equal(details().length, 2);
    }
    await page.getByLabel("Data mode").selectOption("valid"); await expect(pane(1).getByRole("button", { name: "Hide full reply" })).toBeVisible();
    checks.push("Unknown name/version, invalid schema and wrong turn preserve original text but receive no read capability or request");
    await page.getByRole("button", { name: "Close first pane", exact: true }).click(); await expect(pane(1)).toHaveCount(0); await expect(pane(2).getByLabel("Provider registrations")).toHaveText("1/1");
    await page.getByRole("button", { name: "Reopen first pane", exact: true }).click(); await expect(pane(1).getByLabel("Provider registrations")).toHaveText("1/1"); assert.equal(details().length, 2);
    checks.push("Closing/remounting one provider does not unregister the other; remount does not prefetch");
    await page.screenshot({ path: `${evidence}renderers-light.png` });
    await page.getByRole("button", { name: "Change theme", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await pane(1).getByRole("button", { name: "Read full reply" }).scrollIntoViewIfNeeded(); await pane(1).getByRole("button", { name: "Read full reply" }).focus(); await page.keyboard.press("Enter"); await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply");
    await pane(1).getByRole("button", { name: "Hide full reply" }).focus(); await page.keyboard.press("Space"); await expect(pane(1).getByRole("button", { name: "Read full reply" })).toBeFocused();
    await pane(2).getByRole("button", { name: "Hide full reply" }).scrollIntoViewIfNeeded(); await pane(2).getByRole("button", { name: "Hide full reply" }).click();
    await page.screenshot({ path: `${evidence}renderers-dark-390.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); assert.equal(details().length, 2);
    checks.push("Light and dark/390px/reduced motion preserve readable official Thread, focus and bounded horizontal width; theme does not fetch");
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await expect(pane(1)).toContainText("connection 2"); await expect(pane(1).getByRole("button", { name: "Read full reply" })).toBeVisible();
    await expect(pane(1).locator(".flow-reply-detail pre")).toHaveCount(0); assert.equal(details().length, 2);
    environment.fixture.failConversationReads(true); await pane(1).getByRole("button", { name: "Read full reply" }).click(); await expect(pane(1).getByRole("alert")).toContainText("Simulated connection failure");
    environment.fixture.failConversationReads(false); await pane(1).getByRole("button", { name: "Retry reply" }).click(); await expect(pane(1).locator(".flow-reply-detail pre")).toContainText("A thoughtful reply");
    checks.push("New connection gets a new host/provider/port lifetime and empty UI cache; explicit HTTP failure and retry show local error then recover");
    let deliver!: () => void, done!: () => void;
    const delivery = new Promise<void>(resolve => { deliver = resolve; }), completed = new Promise<void>(resolve => { done = resolve; });
    const delayedPath = "**/api/conversations/chat-2/turns/**/details/**";
    await page.route(delayedPath, async route => {
      try { const response = await route.fetch(); await delivery; await route.fulfill({ response }).catch(() => {}); } finally { done(); }
    });
    await pane(2).getByRole("button", { name: "Read full reply" }).click(); await expect(pane(2).getByRole("status").filter({ hasText: "Loading full reply" })).toBeVisible();
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await expect(pane(2)).toContainText("connection 3");
    deliver(); await completed; await page.unroute(delayedPath);
    await expect(pane(2).getByRole("button", { name: "Read full reply" })).toBeVisible(); await expect(pane(2).locator(".flow-reply-detail pre")).toHaveCount(0);
    await expect(pane(2).getByRole("alert")).toHaveCount(0);
    checks.push("Delayed actual detail HTTP response after connection disposal cannot fill the new same-ID conversation/pane or inject a stale error");
    assert.deepEqual(errors, []);
    await writeFile(`${evidence}browser-results.json`, JSON.stringify({ at: new Date().toISOString(), checks, pageErrors: errors, detailRequests: details(), scope: "Dev HTTP fixture; actual public FlowClient/ConversationProjection and official Thread; no real center/model" }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, pageErrors: errors, detailRequests: details().length }));
  } finally { await browser.close(); await environment.close(); }
}
await main();
