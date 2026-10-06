import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { KnowledgeCitation, KnowledgeSearchHit } from "@flow/contracts";
const root = fileURLToPath(new URL("..", import.meta.url));
const evidence = fileURLToPath(new URL("../../../docs/evidence/wpf-context01/", import.meta.url));
const bytes = (value: string) => Buffer.byteLength(value);
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function body(n: number, connection: number) { return n === 3 ? '<script>globalThis.badContext=true</script> & literal text' : `Connection ${connection}. Source ${n}. 原文 e\u0301 🙂\n` + "An immutable project note. ".repeat(12); }
function hit(n: number, connection: number, projectId: string): KnowledgeSearchHit {
  const text = body(n, connection), excerpt = Array.from(text).slice(0, 36).join("");
  return { source: { projectId, id: uuid(n), title: n < 3 ? "Project notes" : `Source ${n}`, currentVersion: n === 2 ? 2 : 1, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" },
    citation: { projectId, sourceId: uuid(n), version: n === 2 ? 2 : 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes", start: 0, end: bytes(text) } },
    excerpt: { text: excerpt, locator: { kind: "utf8-bytes", start: 0, end: bytes(excerpt) } }, matchKind: "literal", rank: 1 };
}
async function startFixture() {
  const requests: { path: string; method: string }[] = [];
  let delay = 0, fail = 0, newer = false;
  const server = await createServer({ root, configFile: false, cacheDir: `${root}/node_modules/.vite-context-fixture`, plugins: [react(), tailwindcss(), {
    name: "knowledge-http-fixture", configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url!, "http://fixture");
        if (url.pathname === "/") { response.setHeader("content-type", "text/html"); void vite.transformIndexHtml("/", '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Knowledge fixture</title><div id="root"></div><script type="module" src="/test/conversation-context.fixture.tsx"></script></html>').then(html => response.end(html), next); return; }
        if (url.pathname === "/fixture-control") { delay = Number(url.searchParams.get("delay") ?? 0); fail = Number(url.searchParams.get("fail") ?? 0); newer = url.searchParams.get("newer") === "true"; response.end("ok"); return; }
        const match = url.pathname.match(/^\/connection-(\d+)\/api\/projects\/([^/]+)\/knowledge\/(search|resolve)$/);
        if (!match) return next();
        requests.push({ path: request.url!, method: request.method! }); assert.equal(request.headers.authorization, "Bearer fixture-only");
        const connection = Number(match[1]), projectId = decodeURIComponent(match[2]!), status = fail, wait = delay, observedNewer = newer;
        fail = 0;
        const send = (payload: unknown) => setTimeout(() => { response.statusCode = status || 200; response.setHeader("content-type", "application/json"); response.end(JSON.stringify(status ? { error: { code: "fixture-failure", message: "Fixture failure" } } : payload)); }, wait);
        if (match[3] === "search") { assert.equal(request.method, "GET"); assert.equal(url.searchParams.get("limit"), "20"); const q = url.searchParams.get("q"); send({ hits: q === "other" ? [hit(5, connection, projectId)] : [1, 2, 3].map(n => hit(n, connection, projectId)), hasMore: q !== "other" }); return; }
        assert.equal(request.method, "POST"); let raw = "";
        request.on("data", chunk => raw += String(chunk)); request.on("end", () => {
          const ref = (JSON.parse(raw) as { citation: KnowledgeCitation }).citation;
          assert.equal(ref.projectId, projectId); const n = Number(ref.sourceId.slice(-12));
          send({ citation: ref, text: body(n, connection), isCurrent: !observedNewer, currentVersion: observedNewer ? ref.version + 1 : ref.version });
        });
      });
    },
  }], server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await server.listen(); const address = server.httpServer!.address(); assert(address && typeof address !== "string");
  return { server, requests, url: `http://127.0.0.1:${address.port}` };
}
async function main() {
  const fixture = await startFixture();
  if (process.argv.includes("--serve")) { console.log(`CONTEXT01_HTTP_FIXTURE=${fixture.url}`); return; }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, reducedMotion: "reduce" });
  const errors: string[] = [], checks: string[] = []; page.on("pageerror", failure => errors.push(failure.message)); page.setDefaultTimeout(10000);
  const searches = () => fixture.requests.filter(item => item.path.includes("/search")).length, resolves = () => fixture.requests.filter(item => item.path.endsWith("/resolve")).length;
  const search = async (q = "notes") => { await page.getByLabel("Search project knowledge").fill(q); await page.getByRole("button", { name: "Search", exact: true }).click(); await expect(page.getByRole("status")).toContainText("results."); };
  const firstSummary = () => page.getByText("Read Project notes, version 1", { exact: true });
  try {
    await page.goto(fixture.url); await expect(page.getByLabel("Search project knowledge")).toBeVisible(); assert.equal(fixture.requests.length, 0);
    await page.getByLabel("Draft", { exact: true }).fill("Draft survives reference selection"); await search();
    await expect(page.getByRole("checkbox")).toHaveCount(3); assert.equal(searches(), 1); assert.equal(resolves(), 0);
    await page.getByRole("checkbox").nth(0).focus(); await page.keyboard.press("Space"); await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
    await page.getByRole("button", { name: "Freeze references locally" }).click();
    const frozen = JSON.parse((await page.getByTestId("frozen").textContent())!); assert.equal(frozen[0].locator.end, bytes(body(1, 1))); assert.equal(resolves(), 0);
    await expect(page.getByText("More sources match. Narrow your search to find other results.")).toBeVisible();
    checks.push("StrictMode initial 0 HTTP; native Space selects whole citation with zero resolve; hasMore never invents a page cursor/total");
    await firstSummary().focus(); await page.keyboard.press("Enter"); await expect(page.locator(".context-body")).toHaveCount(1); await expect(firstSummary()).toBeFocused(); assert.equal(resolves(), 1);
    await page.keyboard.press("Space"); await page.keyboard.press("Enter"); await expect(page.locator(".context-body")).toBeVisible(); assert.equal(resolves(), 1);
    await expect(page.getByLabel("Draft", { exact: true })).toHaveValue("Draft survives reference selection");
    await page.getByText("Reference identity", { exact: true }).first().click(); assert.equal(resolves(), 1);
    await page.getByText("Reference identity", { exact: true }).first().click();
    await page.screenshot({ path: `${evidence}knowledge-light.png`, fullPage: true });
    checks.push("Enter/Space disclosure retains focus; first read 1, cached reopen 0, immutable text and draft preserved");
    await page.getByRole("button", { name: "Hide picker" }).click(); const before = fixture.requests.length;
    await page.getByRole("button", { name: "Freeze references locally" }).click(); assert.equal(fixture.requests.length, before); assert.equal(JSON.parse((await page.getByTestId("frozen").textContent())!).length, 1);
    await page.getByRole("button", { name: "Show picker" }).click(); await expect(page.locator(".context-body")).toBeVisible(); assert.equal(fixture.requests.length, before);
    checks.push("Native hidden picker stops reads but permits local freeze; resume preserves disclosure/cache without a request");
    await page.request.get(`${fixture.url}/fixture-control?newer=true`); await page.getByRole("button", { name: "Check this reference again" }).click();
    await expect(page.getByText(/A newer version existed at last read/)).toBeVisible();
    await page.getByRole("button", { name: "Freeze references locally" }).click(); assert.equal(JSON.parse((await page.getByTestId("frozen").textContent())!)[0].version, 1);
    await page.request.get(`${fixture.url}/fixture-control`);
    await search("other"); await expect(page.getByRole("heading", { name: "Selected from earlier results" })).toBeVisible(); await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
    await expect(page.getByTestId("frozen")).toHaveText(JSON.stringify(frozen));
    checks.push("Explicit same-reference refresh observes newer version without pin replacement; new search retains selected old result and frozen request");
    await page.request.get(`${fixture.url}/fixture-control?fail=503`); await search(); await expect(page.getByRole("alert")).toContainText("previous results and selection are kept"); await expect(page.getByRole("checkbox").nth(0)).toBeChecked();
    await search(); await page.getByText("Read Source 3, version 1", { exact: true }).click(); await expect(page.locator(".context-body").last()).toContainText("<script>");
    assert.equal(await page.evaluate(() => (globalThis as unknown as Record<string, unknown>).badContext), undefined);
    checks.push("HTTP failure retains prior selection/results; returned markup remains escaped literal text");
    await page.getByRole("button", { name: "Dark", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await expect(page.locator(".context-picker input").first()).toHaveCSS("animation-name", "none");
    await page.screenshot({ path: `${evidence}knowledge-dark-390.png`, fullPage: true });
    await page.getByRole("button", { name: "Light", exact: true }).click(); await page.screenshot({ path: `${evidence}knowledge-light-390.png`, fullPage: true });
    checks.push("390px light/dark native controls, reduced-motion and no horizontal overflow; body excluded from live result announcements");
    await page.getByRole("button", { name: "Disable knowledge capability" }).click(); await page.getByRole("button", { name: "Freeze references locally" }).click(); await expect(page.getByRole("alert")).toContainText("not authorized to freeze");
    const count = fixture.requests.length; await expect(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: /^Remove Project/ })).toBeVisible(); assert.equal(fixture.requests.length, count);
    await page.getByRole("button", { name: "Enable knowledge capability" }).click(); await page.getByRole("button", { name: "Freeze references locally" }).click(); await expect(page.getByRole("alert")).toHaveCount(0);
    checks.push("Capability false refuses nonempty freeze without dropping references or draft; enabling never auto-reads");
    // A new connection starts clean; late old-body responses cannot refill it.
    await page.getByRole("button", { name: "New connection" }).click(); await search(); await page.request.get(`${fixture.url}/fixture-control?delay=250`);
    const beforeRead = resolves(); await firstSummary().click(); await expect.poll(resolves).toBe(beforeRead + 1);
    await page.getByRole("button", { name: "Go offline" }).click(); await expect(page.getByText(/Reconnect to search or read/).first()).toBeVisible();
    await page.waitForTimeout(300); await page.getByRole("button", { name: "Reconnect", exact: true }).click(); await expect(page.locator(".context-body")).toHaveCount(0); assert.equal(resolves(), beforeRead + 1);
    await page.request.get(`${fixture.url}/fixture-control`); await page.getByRole("button", { name: "Read content", exact: true }).click(); await expect(page.locator(".context-body")).toContainText("Connection 2");
    checks.push("In-flight HTTP body interrupted by offline cannot publish; same view explicit retry restores correct content without resume fetch");
    await page.request.get(`${fixture.url}/fixture-control?delay=250`); await page.getByText("Read Project notes, version 2", { exact: true }).click(); await expect.poll(resolves).toBe(beforeRead + 3);
    await page.getByRole("button", { name: "Other project" }).click(); await page.waitForTimeout(300); await expect(page.getByRole("checkbox")).toHaveCount(0); await expect(page.locator(".context-body")).toHaveCount(0);
    await page.request.get(`${fixture.url}/fixture-control`); await search(); await page.getByRole("checkbox").nth(0).check(); await page.getByRole("button", { name: "Freeze references locally" }).click();
    assert.equal(JSON.parse((await page.getByTestId("frozen").textContent())!)[0].projectId, "project-b");
    checks.push("Project replacement disposes old requests and starts empty; subsequent public FlowClient requests and frozen refs use bound new project");
    assert.deepEqual(errors, []);
  } finally {
    const files = ["src/conversation-context/selection.ts", "src/conversation-context/controller.ts", "src/conversation-context/ContextPicker.tsx", "src/conversation-context/context-picker.css", "test/conversation-context.test.ts", "test/conversation-context.fixture.tsx", "test/conversation-context.browser.ts"];
    const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(`${root}/${file}`)).digest("hex")])));
    await writeFile(`${evidence}browser-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base: "b54de1dbb08e3ccc7d33a27295a318f2799e76ae", source: "current working tree, exact hashes below", sourceHashes, url: fixture.url, checks, errors, requests: fixture.requests, browser: browser.version(), scope: "independent module HTTP fixture, no Send/Queue/real center/model" }, null, 2));
    await browser.close(); await fixture.server.close();
  }
  console.log(`${checks.length} browser groups passed; page errors=${errors.length}`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
