import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, expect, type Browser, type BrowserContext } from "@playwright/test";
import { startPluginManagementPreview, startPluginRuntimePreview } from "./plugin-management-integration.fixture";

declare global {
  interface Window {
    __X03_HOLD_NEXT_DETAIL__?: boolean;
    __X03_DETAIL_READY__?: boolean;
    __X03_RELEASE_DETAIL__?: () => void;
  }
}
async function runLegacyRegistryBrowser() {
const startedAt = new Date().toISOString();
const sourceFiles = Object.fromEntries(await Promise.all([
  "apps/web/src/App.tsx", "apps/web/src/plugin-integration/react.tsx", "apps/web/src/plugin-integration/integration.css",
  "apps/web/test/plugin-management-integration.fixture.ts", "apps/web/test/plugin-management-integration.browser.ts",
].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
const production = process.argv.includes("--production");
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-i01/runtime-app/", import.meta.url));
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

}
if (process.argv.includes("--legacy-registry-browser")) await runLegacyRegistryBrowser();


/** The bounded external caller owns Chrome/OS cleanup. This function owns its fresh context and two dynamic HTTP listeners. */
export async function checkPluginRuntimeApp({ browser, outputDirectory, signal }: { browser: Browser; outputDirectory: string; signal: AbortSignal }) {
  const checks: { name: string; startedAt: number; elapsedMs: number }[] = [];
  const pageErrors: string[] = [];
  const screenshots: { path: string; bytes: number; sha256: string }[] = [];
  let preview: Awaited<ReturnType<typeof startPluginRuntimePreview>> | undefined;
  let context: BrowserContext | undefined;
  let failure: string | undefined;
  const cleanupErrors: string[] = [];
  let contextClosed = false, httpClosed = false;
  const abort = () => { void context?.close().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    preview = await startPluginRuntimePreview();
    signal.throwIfAborted();
    context = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
    signal.throwIfAborted();
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    page.on("pageerror", error => { if (pageErrors.length < 16) pageErrors.push(error.message.slice(0, 512)); });
    const fixture = preview.fixture;
    const draft = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])').getByRole("textbox", { name: "Message input", exact: true });
    const trigger = page.getByRole("button", { name: "Extensions and appearance", exact: true });
    const summary = page.locator(".flow-plugin-management-disclosure > summary");
    const registry = page.getByRole("region", { name: "Center registry", exact: true });
    const command = () => page.getByRole("region", { name: "插件启停命令", exact: true });
    const open = async () => {
      await trigger.click(); await expect(summary).toBeVisible();
      if (await page.locator(".flow-plugin-management-disclosure").getAttribute("open") === null) await summary.click();
      await expect(registry.getByRole("button", { name: "View sample.notes", exact: true })).toBeVisible();
    };
    const details = async () => {
      const target = registry.getByRole("button", { name: "View sample.notes", exact: true });
      if (await target.getAttribute("aria-expanded") !== "true") await target.click();
      await expect(page.getByRole("region", { name: "中心插件运行时", exact: true })).toBeVisible();
      await expect(page.getByLabel("变更原因", { exact: true })).toBeVisible();
    };
    const close = async () => { await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); };
    const savedDraft = () => page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("flow.conversation-recovery.v1"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        const records = await new Promise<any[]>((resolve, reject) => { const request = database.transaction("records", "readonly").objectStore("records").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const record = records.find(item => item.kind === "draft" && item.owner.routeId === "conversation:chat-1" && item.data.text === "Keep my complete I01 draft");
        return record ? { id: record.id, owner: record.owner, data: record.data } : null;
      } finally { database.close(); }
    });
    const check = async (name: string, operation: () => Promise<void>) => { signal.throwIfAborted(); const start = performance.now(); await operation(); signal.throwIfAborted(); checks.push({ name, startedAt: start, elapsedMs: performance.now() - start }); };
    let originalDraft: Awaited<ReturnType<typeof savedDraft>>;
    await check("real BrowserWorkspace cookie connection and complete current draft", async () => {
      await page.goto(`${preview!.url}/?recovery#conversation=chat-1`);
      await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
      await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
      await expect(draft()).toBeVisible(); await draft().fill("Keep my complete I01 draft");
      const settings = page.getByRole("button", { name: "消息设置", exact: true });
      await settings.click();
      await page.locator(".ep-option").filter({ hasText: "i01-model" }).getByRole("radio").check();
      await page.getByRole("button", { name: "应用", exact: true }).click(); await expect(settings).toBeFocused();
      const files = page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden]) [data-composer-view="conversation:chat-1"]').getByRole("button", { name: "Files", exact: true });
      await files.click(); await expect(page.getByRole("dialog", { name: "Project text files", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Browse files", exact: true }).click();
      for (const file of fixture.files) await page.getByRole("button", { name: `Use ${file.name}`, exact: true }).click();
      await page.keyboard.press("Escape"); await expect(files).toBeFocused();
      await expect.poll(async () => (await savedDraft())?.data.attachments.map((item: any) => item.metadata?.reference)).toEqual(fixture.files.map(file => file.reference));
      originalDraft = await savedDraft();
      expect(originalDraft?.data.messageSettings.profile).toEqual(fixture.profile.reference);
      expect(originalDraft?.data.messageSettings.requested.model).toBe("i01-model");
      expect(fixture.registryReads).toHaveLength(0); expect(fixture.runtimeWrites).toHaveLength(0);
      expect(fixture.sessionConnects()).toBe(1); expect(fixture.sessionReads()).toBeGreaterThanOrEqual(2);
    });
    await check("UNKNOWN survives collapse and close; explicit retry keeps original HTTP key/body and current draft", async () => {
      await open(); await details();
      const local = page.getByRole("region", { name: "Local extension controls", exact: true });
      await local.getByRole("button", { name: "Disable sample.notes", exact: true }).click();
      expect(fixture.runtimeWrites).toHaveLength(0);
      fixture.loseNextRuntimeAck();
      await page.getByLabel("变更原因", { exact: true }).fill("Controlled stop of new tool bindings");
      await page.getByRole("button", { name: "确认停用", exact: true }).click();
      await expect(command()).toContainText("启停结果未知"); expect(fixture.runtimeWrites).toHaveLength(1);
      await summary.focus(); await page.keyboard.press("Space"); await expect(registry).toHaveCount(0); await expect(summary).toBeFocused();
      await close(); await expect(draft()).toHaveValue("Keep my complete I01 draft"); expect(await savedDraft()).toEqual(originalDraft);
      await open(); await expect(command()).toContainText("启停结果未知");
      await details(); await page.getByRole("button", { name: "刷新启停状态（只读）", exact: true }).click();
      await expect(command()).toContainText("启停结果未知"); expect(fixture.runtimeWrites).toHaveLength(1);
      await page.getByRole("button", { name: "重试原启停命令", exact: true }).click();
      await expect(command()).toContainText("中心已确认启停命令"); expect(fixture.runtimeWrites).toHaveLength(2);
      const [first, retry] = fixture.runtimeWrites;
      expect([retry!.key, retry!.body]).toEqual([first!.key, first!.body]); expect(retry!.replayed).toBe(true);
      expect(fixture.runtimeWrites.every(write => write.cookie && write.csrf)).toBe(true);
      await expect(local.getByRole("button", { name: "Enable sample.notes", exact: true })).toBeVisible();
      await close(); expect(await savedDraft()).toEqual(originalDraft); expect(fixture.contentReads()).toBe(0);
    });
    await check("active workspace loss revokes held command, reconnect keeps drafts but does not reuse old command authority", async () => {
      await open(); await details();
      await page.getByText("高级执行后端与完整安装身份", { exact: true }).click();
      await page.getByLabel("执行后端 UUID", { exact: true }).fill(fixture.runnerId);
      await page.getByRole("radio").check();
      await page.getByLabel("变更原因", { exact: true }).fill("Controlled re-enable request");
      fixture.holdNextRuntimeAck(); await page.getByRole("button", { name: "确认启用", exact: true }).click();
      await expect.poll(() => fixture.runtimeWrites.length).toBe(3);
      await expect(command()).toContainText("正在提交"); await close();
      await page.getByRole("button", { name: "Change connection", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Connect to Flow", exact: true })).toBeVisible();
      fixture.releaseRuntime();
      await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
      await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
      await expect(draft()).toHaveValue("Keep my complete I01 draft");
      expect(await savedDraft()).toEqual(originalDraft);
      await open(); await expect(command()).toHaveCount(0); await details();
      await expect(page.getByRole("region", { name: "中心插件运行时", exact: true })).toContainText("未知 / 未知");
      expect(fixture.runtimeWrites).toHaveLength(3); expect(fixture.contentReads()).toBe(0);
      await close();
    });
    await check("real theme controls and narrow Settings preserve focus and layout", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const theme of ["light", "dark"] as const) {
        const toggle = page.getByRole("button", { name: `Use ${theme} theme`, exact: true });
        if (await toggle.isVisible()) await toggle.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await open(); await details(); await summary.scrollIntoViewIfNeeded(); await summary.focus();
        expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        const path = `${outputDirectory}/runtime-app-${theme}-390.png`;
        const bytes = await page.screenshot({ path }); if (bytes.length > 512 * 1024) throw Error("I01 screenshot exceeds 512 KiB");
        screenshots.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
        await close();
      }
    });
    expect(pageErrors).toEqual([]);
  } catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); }
  finally {
    signal.removeEventListener("abort", abort);
    const closed = await Promise.allSettled([context?.close(), preview?.close()]);
    contextClosed = closed[0]!.status === "fulfilled"; httpClosed = closed[1]!.status === "fulfilled";
    closed.forEach(result => { if (result.status === "rejected") cleanupErrors.push(String(result.reason)); });
  }
  return { passed: !failure && !signal.aborted && checks.length === 4 && cleanupErrors.length === 0, checks, pageErrors, failure,
    screenshots, cleanup: { contextClosed, httpClosed, errors: cleanupErrors }, runtimeWrites: preview?.fixture.runtimeWrites ?? [],
    scope: "Real App/BrowserWorkspace and public FlowClient against controlled Cookie/registry HTTP fixture; no real center/PG/runner/package loading/provider, no server-session security attestation." };
}
