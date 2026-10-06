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
  let nextStatus = 200, empty = false, removeStandard = false, large = false;
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
        const first = entry(1);
        if (removeStandard) first.profile.configuration.turnSettings!.choices.splice(0, 1);
        if (large) first.profile.configuration.turnSettings!.choices.push(...Array.from({ length: 30 }, (_, index) => ({ model: `declared-model-${index}`, thinking: "disabled" as const, effort: { kind: "not-requested" as const }, speed: "standard" as const })));
        const after = url.searchParams.has("after");
        const profiles = large ? Array.from({ length: 20 }, (_, index) => !after && index === 0 ? first : entry(index + (after ? 21 : 1))) : after ? [entry(2)] : [first];
        response.end(JSON.stringify(status !== 200 ? { error: { code: "fixture-failure", message: "Fixture unavailable" } } : {
          protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: empty ? [] : profiles, nextCursor: empty || after ? null : id(large ? 20 : 1),
        }));
      });
    } }],
  });
  try {
    await server.listen();
    const address = server.httpServer?.address(); assert(address && typeof address !== "string");
    return { url: `http://127.0.0.1:${address.port}`, requests, failNext: () => { nextStatus = 401; }, showEmpty: (value: boolean) => { empty = value; }, removeStandard: (value: boolean) => { removeStandard = value; }, showLarge: () => { large = true; }, close: () => server.close() };
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
  const standard = dialog.getByRole("radio", { name: new RegExp(`^${model}`) });
  const apply = dialog.getByRole("button", { name: "应用", exact: true });
  const details = () => dialog.getByText("配置详情", { exact: true }).click();
  const applyAndClose = async () => { await apply.click(); await expect(dialog).toHaveCount(0); };
  try {
    await page.goto(fixture.url); await expect(page.getByTestId("catalog-state")).toContainText("stale; 0"); assert.equal(fixture.requests.length, 0);
    await left.getByLabel("Draft left", { exact: true }).fill("新草稿仍归我"); await open();
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 1");
    // Real native keyboard navigation changes only the local filters/candidate, never C before Apply.
    await dialog.getByRole("combobox", { name: "模型", exact: true }).focus();
    for (const [label, expected] of [["模型", model], ["思考", "adaptive"], ["力度", "high"], ["速度", "standard"]] as const) {
      await expect(dialog.getByRole("combobox", { name: label, exact: true })).toBeFocused();
      await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
      await expect(dialog.getByRole("combobox", { name: label, exact: true })).toHaveValue(expected);
      await page.keyboard.press("Tab");
    }
    await expect(dialog.getByRole("button", { name: "清除筛选", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); // Omit is the first native radio; ArrowDown reaches the only matching tuple.
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space"); await expect(standard).toBeChecked();
    await expect(page.getByTestId("left-current")).toHaveText("omitted"); await expect(page.getByTestId("left-commits")).toHaveText("0");
    const combinations = dialog.getByRole("group", { name: "完整消息设置组合", exact: true });
    await expect(combinations).toHaveCount(1); await expect(combinations).not.toContainText("Adapter"); await expect(combinations).not.toContainText("Runner");
    await page.keyboard.press("Tab"); await expect(apply).toBeFocused(); await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0); await expect(page.getByTestId("left-commits")).toHaveText("1");
    await expect(left.getByRole("button", { name: /^消息设置：/ })).toBeFocused();
    await expect(left.getByRole("button", { name: /^消息设置：/ })).toHaveAccessibleName(`消息设置：${model} · 自适应思考 · 力度高 · 标准速度`);
    await expect(right.getByRole("button", { name: /^消息设置：/ })).toContainText("不附加");
    await left.getByRole("button", { name: "冻结 A 样本", exact: true }).click();
    const sent = await page.getByTestId("left-sent").textContent(); assert(sent?.includes(model));
    await open(); await dialog.getByRole("radio", { name: /^fast-model/ }).check();
    await expect(page.getByTestId("left-current")).toHaveText(sent!); await expect(dialog.getByRole("region", { name: "待应用选择", exact: true })).toContainText("fast-model");
    await applyAndClose(); await left.getByRole("button", { name: "冻结 B 样本", exact: true }).click();
    const queued = await page.getByTestId("left-queued").textContent(); assert(queued?.includes('"kind":"not-requested"'));
    await open(); await dialog.getByRole("radio", { name: /^不附加消息设置/ }).check(); await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByTestId("left-current")).toHaveText(queued!); await expect(page.getByTestId("left-commits")).toHaveText("2");
    await open(); await dialog.getByRole("radio", { name: /^不附加消息设置/ }).check(); await applyAndClose();
    await expect(page.getByTestId("left-current")).toHaveText("omitted"); await expect(page.getByTestId("left-commits")).toHaveText("3");
    await expect(page.getByTestId("left-sent")).toHaveText(sent!); await expect(page.getByTestId("left-queued")).toHaveText(queued!);
    await expect(left.getByLabel("Draft left", { exact: true })).toHaveValue("新草稿仍归我");
    checks.push("Native Tab/Arrow/Space/Enter filters and explicit Apply commit once; staged versus applied labels, guarded omit/Cancel, two panes and immutable A/B snapshots");

    await open(); await standard.check(); await applyAndClose();
    await open(); await dialog.getByRole("combobox", { name: "模型", exact: true }).selectOption(model);
    await dialog.getByRole("combobox", { name: "速度", exact: true }).selectOption("fast");
    await expect(dialog).toContainText("没有匹配的已声明组合"); await expect(apply).toBeDisabled();
    await expect(page.getByTestId("left-current")).toHaveText(sent!);
    await dialog.getByRole("button", { name: "清除筛选", exact: true }).click(); await standard.check();
    await dialog.getByRole("button", { name: "加载更多设置", exact: true }).click(); await expect(page.getByTestId("catalog-state")).toContainText("current; 2");
    await expect(dialog.getByRole("radio", { name: /^another-profile-model/ })).toHaveCount(0); // Other loaded profiles never become selectable facets.
    fixture.failNext(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Access expired"); await expect(apply).toBeDisabled();
    await expect(page.getByTestId("left-current")).toHaveText(sent!);
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click(); await expect(standard).toBeEnabled();
    await close(); await page.getByRole("button", { name: "撤销设置能力", exact: true }).click(); await open();
    await expect(dialog.getByRole("radio", { name: new RegExp(`^${model}`) })).toHaveCount(0); await expect(dialog).toContainText("未提供逐条消息设置能力");
    await expect(page.getByTestId("left-current")).toHaveText(sent!); await close(); await page.getByRole("button", { name: "恢复设置能力", exact: true }).click();
    checks.push("No invented cross-product or automatic fallback; incompatible facets have a clear exit; pagination, failed refresh and capability loss preserve applied C");

    await open(); await dialog.getByRole("radio", { name: /^fast-model/ }).check(); await details();
    await dialog.getByRole("button", { name: "同设置新草稿", exact: true }).click();
    await expect(dialog).toContainText("本次选择已失效"); await expect(apply).toBeDisabled(); await expect(page.getByTestId("left-current")).toHaveText(sent!); await close();
    await expect(left.getByRole("button", { name: /^消息设置：/ })).toBeFocused();
    await open(); await dialog.getByRole("radio", { name: /^fast-model/ }).check(); await details();
    await dialog.getByRole("button", { name: "宿主更新但延迟 props", exact: true }).click();
    await apply.click(); await expect(dialog).toContainText("宿主草稿已更新，未应用旧选择");
    await expect(page.getByTestId("left-current")).toHaveText(sent!); await expect(page.getByTestId("left-commits")).toHaveText("4");
    await close(); await left.getByRole("button", { name: "同步宿主 props", exact: true }).click();
    await open(); await dialog.getByRole("radio", { name: /^不附加消息设置/ }).check(); await details();
    await dialog.getByRole("button", { name: "切换视图身份", exact: true }).click(); await expect(apply).toBeDisabled(); await close();
    await open(); await details(); await dialog.getByRole("button", { name: "卸载设置控件", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("left-current")).toHaveText(sent!); await left.getByRole("button", { name: "恢复编辑控件", exact: true }).click();
    await open(); await details(); await dialog.getByRole("button", { name: "撤销编辑权限", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(left.getByRole("button", { name: /^消息设置：/ })).toBeDisabled();
    await expect(page.getByTestId("left-current")).toHaveText(sent!); await left.getByRole("button", { name: "恢复编辑控件", exact: true }).click();
    checks.push("Actual fixture host CAS rejects lagging-props Apply; same-tuple new draft/view invalidates pending choice and omit; unmount preserves host C (production App remains unbound)");

    await open(); await details(); await dialog.getByRole("button", { name: "宿主详情操作", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(left.getByRole("button", { name: "宿主焦点目标", exact: true })).toBeFocused();
    await expect(page.getByTestId("navigation-left")).toHaveText("已由宿主导航");
    fixture.removeStandard(true); await open();
    // A controlled external refresh preserves the real candidate focus until that node disappears.
    await standard.focus();
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByTestId("catalog-state")).toContainText("current; 1");
    await expect(standard).toHaveCount(0); await expect(dialog.getByRole("status")).toBeFocused();
    await expect(page.getByTestId("left-current")).toHaveText(sent!);
    fixture.removeStandard(false); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click(); await expect(standard).toBeEnabled(); await close();
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["Light", "Dark"] as const) {
      await page.getByRole("button", { name: theme, exact: true }).click(); await open();
      const geometry = await dialog.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      assert(geometry.scroll <= geometry.width + 1 && geometry.left >= 0 && geometry.right <= 390);
      await standard.focus(); await expect(standard).toBeFocused(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(evidence, `message-settings-${theme.toLowerCase()}-390.png`) }); await close();
    }
    checks.push("Details close-before-navigation focus, removed-candidate recovery focus, light/dark390,180-character model and reduced-motion keyboard");

    fixture.showEmpty(true); await open(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(dialog).toContainText("目录没有可选组合"); await expect(dialog).toContainText("原选择不在当前可用目录");
    await expect(page.getByTestId("left-current")).toHaveText(sent!);
    fixture.showEmpty(false); fixture.showLarge(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 20"); await expect(combinations.getByRole("radio")).toHaveCount(33);
    await dialog.getByRole("button", { name: "加载更多设置", exact: true }).click(); await expect(page.getByTestId("catalog-state")).toContainText("current; 40");
    await expect(combinations.getByRole("radio")).toHaveCount(33); await expect(page.getByTestId("left-current")).toHaveText(sent!); await close();
    await page.getByRole("button", { name: /^Conversation settings:/ }).click();
    const legacy = page.getByRole("dialog", { name: "Conversation settings", exact: true });
    await expect(legacy).toContainText("creation-base"); await expect(legacy.getByRole("radio")).toHaveCount(0); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "新连接", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("stale; 0 profiles; connection 2"); await expect(page.getByTestId("left-current")).toHaveText("omitted");
    checks.push("Empty/missing selection retained; 40-profile paging still projects only the authorized32 tuples; legacy creation unchanged; new connection has independent controlled drafts");
    assert.deepEqual(errors, []);
    return { checks, pageErrors: errors, requests: fixture.requests, limitation: "Independent controlled component + synthetic HTTP catalog; no App/send/queue/recovery/provider integration." };
  } finally { page.off("pageerror", onError); }
}
