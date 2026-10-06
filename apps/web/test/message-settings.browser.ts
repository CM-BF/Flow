/** Fixture/scenarios only. An admitted external owner supplies Chrome, deadlines and cleanup supervision. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createServer, type AliasOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { CLAUDE_TURN_SETTINGS_PROTOCOL, EXECUTION_PROFILE_HEADER, claudeMessageSettingsCatalogEntrySchema } from "@flow/contracts";

const root = fileURLToPath(new URL("..", import.meta.url));
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const model = "model-" + "x".repeat(174);
function entry(number: number) {
  return claudeMessageSettingsCatalogEntrySchema.parse({
    profile: {
      reference: { id: id(number), runnerId: id(101), configDigest: "a".repeat(64) },
      configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "creation-base", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [
        { model: number === 1 ? model : "another-profile-model", thinking: "adaptive", effort: { kind: "level", value: "high" }, speed: "standard" },
        { model: "fast-model", thinking: "disabled", effort: { kind: "not-requested" }, speed: "fast" },
      ] } },
      source: "runner-configured", availability: "not-probed", model: { value: "creation-base", resolvedModel: null, displayName: "creation-base", description: "Fixture intent only", providerCapabilities: "unknown" },
      controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } }, createdAt: "2026-10-06T00:00:00Z",
    }, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" },
  });
}

/** Own HTTP fixture, not a center. The caller must close this and its separately owned browser in finally. */
export async function startMessageSettingsFixture(options: { cacheDir: string; aliases: AliasOptions }) {
  const requests: string[] = [];
  let nextStatus = 200, empty = false;
  const server = await createServer({
    root, configFile: false, cacheDir: options.cacheDir, resolve: { alias: options.aliases }, logLevel: "error", server: { host: "127.0.0.1", port: 0 },
    optimizeDeps: { entries: ["test/message-settings.fixture.tsx"] },
    plugins: [react(), tailwindcss(), { name: "message-settings-http-fixture", configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://fixture");
        if (url.pathname === "/") {
          response.setHeader("content-type", "text/html");
          void vite.transformIndexHtml("/", '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Message settings fixture</title><div id="root"></div><script type="module" src="/test/message-settings.fixture.tsx"></script></html>').then(html => response.end(html), next); return;
        }
        if (!/^\/connection-\d+\/api\/execution-profiles$/.test(url.pathname)) return next();
        requests.push(request.url ?? "");
        const status = nextStatus; nextStatus = 200;
        if (request.method !== "GET" || request.headers[EXECUTION_PROFILE_HEADER.toLowerCase()] !== CLAUDE_TURN_SETTINGS_PROTOCOL || url.searchParams.get("limit") !== "20") {
          response.statusCode = 400; response.end('Fixture protocol mismatch'); return;
        }
        response.statusCode = status; response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(status !== 200 ? { error: { code: "fixture-failure", message: "Fixture unavailable" } } : {
          protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: empty ? [] : [entry(url.searchParams.has("after") ? 2 : 1)], nextCursor: empty || url.searchParams.has("after") ? null : id(1),
        }));
      });
    } }],
  });
  try {
    await server.listen();
    const address = server.httpServer?.address(); assert(address && typeof address !== "string");
    return { url: `http://127.0.0.1:${address.port}`, requests, failNext: () => { nextStatus = 401; }, showEmpty: (value: boolean) => { empty = value; }, close: () => server.close() };
  } catch (error) { await server.close(); throw error; }
}

/** No launcher/budget reset here. Future admitted runner invokes this once using one owned Page. */
export async function checkMessageSettingsPicker(page: Page, fixture: Awaited<ReturnType<typeof startMessageSettingsFixture>>, evidence: string) {
  const checks: string[] = [];
  const errors: string[] = [];
  const onError = (error: Error) => { errors.push(error.message); };
  page.on("pageerror", onError);
  page.setDefaultTimeout(5000);
  const left = page.getByRole("region", { name: "Pane left", exact: true });
  const right = page.getByRole("region", { name: "Pane right", exact: true });
  const dialog = page.getByRole("dialog", { name: "下一条消息设置", exact: true });
  const open = async () => { await left.getByRole("button", { name: /^消息设置：/ }).click(); await expect(dialog).toBeVisible(); };
  const close = async () => { await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); };
  try {
    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("stale; 0"); assert.equal(fixture.requests.length, 0);
    await left.getByLabel("Draft left", { exact: true }).fill("新草稿仍归我"); await open();
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 1");
    const standard = dialog.getByRole("radio", { name: new RegExp(`^${model}`) });
    await standard.focus(); await page.keyboard.press("Space"); await expect(standard).toBeChecked();
    await expect(dialog.getByRole("group")).not.toContainText("Adapter");
    await expect(dialog.getByText(`Runner ${id(101)}`, { exact: true }).first()).not.toBeVisible();
    await close(); await expect(left.getByRole("button", { name: /^消息设置：/ })).toBeFocused();
    await expect(left.getByRole("button", { name: /^消息设置：/ })).toContainText("力度高");
    await expect(right.getByRole("button", { name: /^消息设置：/ })).toContainText("不附加");
    await left.getByRole("button", { name: "冻结 A 样本", exact: true }).click();
    const sent = await page.getByTestId("left-sent").textContent(); assert(sent?.includes(model));
    await open(); await dialog.getByRole("radio", { name: /^fast-model/ }).check(); await close();
    await left.getByRole("button", { name: "冻结 B 样本", exact: true }).click();
    const queued = await page.getByTestId("left-queued").textContent(); assert(queued?.includes('"kind":"not-requested"'));
    await open(); await dialog.getByRole("radio", { name: /^不附加消息设置/ }).check(); await close();
    await expect(page.getByTestId("left-sent")).toHaveText(sent!); await expect(page.getByTestId("left-queued")).toHaveText(queued!);
    await expect(left.getByLabel("Draft left", { exact: true })).toHaveValue("新草稿仍归我");
    checks.push("Explicit public-client read; controlled whole tuples, keyboard/Escape, independent panes and detached A/B/current snapshots; no command endpoint");

    await open(); await standard.check();
    await dialog.getByRole("button", { name: "加载更多设置", exact: true }).click(); await expect(page.getByTestId("catalog-state")).toContainText("current; 2");
    await expect(dialog.getByRole("radio", { name: /^another-profile-model/ })).toBeDisabled();
    fixture.failNext(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Access expired"); await expect(standard).toBeChecked(); await expect(standard).toBeDisabled();
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click(); await expect(standard).toBeEnabled();
    await close(); await page.getByRole("button", { name: "撤销设置能力", exact: true }).click(); await open();
    await expect(standard).toBeChecked(); await expect(standard).toBeDisabled(); await expect(dialog).toContainText("未提供逐条消息设置能力");
    await close(); await page.getByRole("button", { name: "恢复设置能力", exact: true }).click();
    checks.push("Pagination does not authorize another profile; failed refresh and revoked capability keep the original choice without fallback");

    await open(); await dialog.getByRole("button", { name: "宿主详情操作", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(left.getByRole("button", { name: "宿主焦点目标", exact: true })).toBeFocused();
    await expect(page.getByTestId("navigation-left")).toHaveText("已由宿主导航");
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["Light", "Dark"] as const) {
      await page.getByRole("button", { name: theme, exact: true }).click(); await open();
      const geometry = await dialog.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      assert(geometry.scroll <= geometry.width + 1 && geometry.left >= 0 && geometry.right <= 390);
      await standard.focus(); await expect(standard).toBeFocused();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(evidence, `message-settings-${theme.toLowerCase()}-390.png`) }); await close();
    }
    checks.push("Existing details callback closes before host focus handoff; real controlled picker light/dark390,180-character requested model, reduced-motion and keyboard");

    fixture.showEmpty(true); await open(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(dialog).toContainText("目录没有可选组合"); await expect(dialog).toContainText("原选择不在已加载目录");
    await expect(page.getByTestId("left-current")).toContainText(model); await close();
    await page.getByRole("button", { name: /^Conversation settings:/ }).click();
    const legacy = page.getByRole("dialog", { name: "Conversation settings", exact: true });
    await expect(legacy).toContainText("creation-base"); await expect(legacy.getByRole("radio")).toHaveCount(0); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "新连接", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("stale; 0 profiles; connection 2");
    await expect(page.getByTestId("left-current")).toHaveText("omitted");
    checks.push("Empty pages preserve selected intent; old locked creation remains unchanged; a new fixture connection owns fresh catalogs and drafts");
    assert.deepEqual(errors, []);
    return { checks, pageErrors: errors, requests: fixture.requests, limitation: "Independent controlled component + synthetic HTTP catalog; no App/send/queue/recovery/provider integration." };
  } finally { page.off("pageerror", onError); }
}
