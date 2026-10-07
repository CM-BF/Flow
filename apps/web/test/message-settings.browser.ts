/** Fixture/scenarios only. An admitted external owner supplies Chrome, deadlines and cleanup supervision. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
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
        if (url.pathname === "/native-select-control") {
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end(`<!doctype html><html lang="zh-CN"><title>Message settings native control</title><label>模型<select data-native-control><option value="">全部模型</option><option value="${model}">${model}</option><option value="fast-model">fast-model</option></select></label></html>`); return;
        }
        if (url.pathname === "/") {
          response.setHeader("content-type", "text/html; charset=utf-8");
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
    // Establish the retained selection through this same HTTP directory and an actual explicit Apply.
    // The fixture changes conversation authority; keyed panes receive a new draft owner, not a fabricated C snapshot.
    await page.getByRole("button", { name: "后页配置会话", exact: true }).click();
    await left.getByLabel("Draft left", { exact: true }).fill("后页配置的草稿仍保留"); await open();
    await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 20"); await expect(apply).toBeDisabled();
    await dialog.getByRole("button", { name: "加载更多设置", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 40");
    const laterStandard = dialog.getByRole("radio", { name: /^another-profile-model/ });
    await laterStandard.check(); await applyAndClose(); await left.getByRole("button", { name: "冻结 A 样本", exact: true }).click();
    const laterSent = await page.getByTestId("left-sent").textContent(); assert(laterSent); assert.equal(JSON.parse(laterSent).profile.id, id(21));
    await open(); await dialog.getByRole("radio", { name: /^fast-model/ }).check(); await applyAndClose();
    await left.getByRole("button", { name: "冻结 B 样本", exact: true }).click();
    const laterQueued = await page.getByTestId("left-queued").textContent(); assert(laterQueued); assert.equal(JSON.parse(laterQueued).profile.id, id(21));
    const laterCurrent = await page.getByTestId("left-current").textContent(); assert.equal(laterCurrent, laterQueued);
    await expect(page.getByTestId("left-commits")).toHaveText("2");
    const laterGeneration = await page.getByTestId("left-generation").textContent(); assert(laterGeneration);
    const requestsBeforeRefresh = fixture.requests.length;
    await open(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 20");
    await expect(dialog).toContainText("已加载目录中没有会话的完整配置");
    await expect(apply).toBeDisabled(); await expect(combinations.getByRole("radio")).toHaveCount(1); // Only explicit omit remains; no page1 tuple is authorized.
    await expect(page.getByTestId("left-current")).toHaveText(laterCurrent!);
    await expect(page.getByTestId("left-sent")).toHaveText(laterSent); await expect(page.getByTestId("left-queued")).toHaveText(laterQueued);
    await expect(page.getByLabel("Draft left", { exact: true })).toHaveValue("后页配置的草稿仍保留");
    await expect(page.getByTestId("left-commits")).toHaveText("2");
    await dialog.getByRole("button", { name: "加载更多设置", exact: true }).click();
    await expect(page.getByTestId("catalog-state")).toContainText("current; 40");
    const paginationRequests = fixture.requests.slice(requestsBeforeRefresh).map(path => new URL(path, fixture.url));
    assert.equal(paginationRequests.length, 2);
    assert.equal(paginationRequests[0]!.pathname, "/connection-2/api/execution-profiles"); assert.equal(paginationRequests[0]!.searchParams.has("after"), false);
    assert.equal(paginationRequests[1]!.pathname, "/connection-2/api/execution-profiles"); assert.equal(paginationRequests[1]!.searchParams.get("after"), id(20));
    assert(paginationRequests.every(url => url.searchParams.get("limit") === "20"));
    await expect(combinations.getByRole("radio")).toHaveCount(3); await expect(laterStandard).toBeEnabled();
    await expect(dialog.getByRole("radio", { name: new RegExp(`^${model}`) })).toHaveCount(0);
    await expect(page.getByTestId("left-current")).toHaveText(laterCurrent!); await expect(page.getByTestId("left-commits")).toHaveText("2");
    await expect(page.getByTestId("left-generation")).toHaveText(laterGeneration);
    await laterStandard.check(); await expect(page.getByTestId("left-current")).toHaveText(laterCurrent!); await applyAndClose();
    await expect(page.getByTestId("left-commits")).toHaveText("3"); await expect(page.getByTestId("left-current")).toHaveText(laterSent);
    await expect(page.getByTestId("left-sent")).toHaveText(laterSent); await expect(page.getByTestId("left-queued")).toHaveText(laterQueued);
    await expect(left.getByLabel("Draft left", { exact: true })).toHaveValue("后页配置的草稿仍保留");
    checks.push("Already-applied authorized profile21 absent on page1 retains C/A/B/text and blocks Apply; actual after20 HTTP page exposes only exact profile21 tuples; no automatic write and exactly one explicit post-page Apply");
    assert.deepEqual(errors, []);
    return { checks, pageErrors: errors, requests: fixture.requests, limitation: "Independent controlled component + synthetic HTTP catalog; no App/send/queue/recovery/provider integration." };
  } finally { page.off("pageerror", onError); }
}


/** Measurement only. It never replaces the six acceptance groups or mutates a select value. */
export async function diagnoseMessageSettingsNativeSelect(page: Page, fixture: Awaited<ReturnType<typeof startMessageSettingsFixture>>, evidence: string, workDeadlineMs: number, selection: "popup" | "typeahead" = "popup") {
  type Snapshot = { value: string; selectedIndex: number; focused: boolean; connected: boolean; disabled: boolean; open: boolean | "unsupported"; options: { value: string; selected: boolean; disabled: boolean }[] };
  type PublicDocument = { characterSet: string; selectCount: number; labels: string[]; exactLocatorCount: number };
  type Trace = { state: string; events: { type: string; key: string; isTrusted: boolean; defaultPrevented: boolean; phase: string }[]; eventBytes: number; observerErrors: string[]; truncated: boolean; droppedEvents: number };
  const report: { mode: string; diagnosticComplete: boolean; conclusion: string; arms: { name: string; snapshots: { after: string; value: Snapshot }[]; document?: PublicDocument; trace?: Trace; traceFailure?: string; selectedWithNativeEvents?: boolean; failure?: string }[]; pageErrors: string[]; failure?: string } = {
    mode: selection === "typeahead" ? "native-typeahead-control" : "native-control", diagnosticComplete: false, conclusion: "INCONCLUSIVE", arms: [], pageErrors: [],
  };
  const onError = (error: Error) => { if (report.pageErrors.length < 8) report.pageErrors.push(error.message.slice(0, 1024)); };
  page.on("pageerror", onError);
  const checkpoint = () => { assert(Date.now() < workDeadlineMs, "Diagnostic work deadline"); };
  function snapshotSelect(element: Element): Snapshot {
    if (!(element instanceof HTMLSelectElement) || element.options.length > 8) throw new Error("Expected bounded native select");
    let open: Snapshot["open"] = "unsupported";
    try { if (CSS.supports("selector(:open)")) open = element.matches(":open"); } catch {}
    const options = [];
    for (const option of element.options) options.push({ value: option.value, selected: option.selected, disabled: option.disabled });
    return { value: element.value, selectedIndex: element.selectedIndex, focused: document.activeElement === element,
      connected: element.isConnected, disabled: element.matches(":disabled"), open, options };
  }
  // A frame is an observation boundary, not a claim that the OS popup is ready. No sleep or generated input.
  const frameScript = `new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Diagnostic animation-frame observation expired")), 1000);
    requestAnimationFrame(() => { clearTimeout(timeout); resolve(true); });
  })`;
  async function arm(name: string, keys: readonly string[], modal: boolean) {
    checkpoint();
    const record: (typeof report.arms)[number] = { name, snapshots: [] }; report.arms.push(record);
    const select = modal ? page.getByRole("dialog", { name: "下一条消息设置", exact: true }).getByRole("combobox", { name: "模型", exact: true }) : page.getByRole("combobox", { name: "模型", exact: true });
    try {
      const publicDocument = await page.evaluate<Omit<PublicDocument, "exactLocatorCount">>(`(() => {
        const scope = location.pathname === "/native-select-control" ? document : document.querySelector('[role="dialog"]');
        if (!scope) throw new Error("Expected own diagnostic document or dialog");
        const selects = Array.from(scope.querySelectorAll("select"));
        if (selects.length > 8) throw new Error("Diagnostic select count exceeded");
        return { characterSet: document.characterSet, selectCount: selects.length,
          labels: selects.map(select => Array.from(select.labels || [], label =>
            Array.from(label.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim()
          ).join(" ").slice(0, 192)) };
      })()`);
      record.document = { ...publicDocument, exactLocatorCount: await select.count() }; checkpoint();
      await expect(select).toHaveCount(1); await expect(select).toBeEnabled(); await select.focus(); checkpoint();
      record.snapshots.push({ after: "focus", value: await select.evaluate(snapshotSelect) });
      if (selection === "typeahead") {
        assert.equal(record.document.characterSet, "UTF-8"); assert(record.document.labels.includes("模型"));
        const initial = record.snapshots[0]!.value;
        assert.equal(initial.value, ""); assert.equal(initial.selectedIndex, 0);
        assert(initial.focused && initial.connected && !initial.disabled);
        assert.deepEqual(initial.options.map(option => option.value), ["", model, "fast-model"]);
        assert(initial.options.every(option => !option.disabled));
      }
      for (const key of keys) {
        checkpoint(); await page.keyboard.press(key); checkpoint();
        await page.evaluate(frameScript); checkpoint();
        record.snapshots.push({ after: key, value: await select.evaluate(snapshotSelect) });
      }
    } catch (error) { record.failure = String(error).slice(0, 1024); throw error; }
    finally {
      try {
        const encoded = await page.evaluate<string>('JSON.stringify(globalThis.__msgquickSelectTrace ?? {state:"NOT_CAPTURED"})');
        assert(Buffer.byteLength(encoded) <= 65536, "Bounded passive trace");
        const trace: Trace = JSON.parse(encoded); record.trace = trace;
        assert.equal(trace.state, "INSTALLED"); assert.equal(trace.truncated, false); assert.equal(trace.droppedEvents, 0); assert.deepEqual(trace.observerErrors, []);
        assert(trace.events.length > 0 && trace.events.length <= 96 && trace.eventBytes <= 49152);
        const traces = report.arms.flatMap(item => item.trace ? [item.trace] : []);
        assert(traces.reduce((sum, item) => sum + item.events.length, 0) <= 96 && traces.reduce((sum, item) => sum + item.eventBytes, 0) <= 49152, "Combined diagnostic trace limit");
      } catch (error) {
        record.traceFailure = String(error).slice(0, 1024);
        if (!record.failure) throw error; // Preserve the original precondition/action failure when trace capture also fails.
      }
    }
    const final = record.snapshots.at(-1)!.value;
    record.selectedWithNativeEvents = final.value === model && final.selectedIndex === 1 &&
      ["input", "change"].every(type => record.trace!.events.some(event => event.type === type && event.isTrusted && event.phase === "capture"));
    if (selection === "typeahead") record.selectedWithNativeEvents = record.selectedWithNativeEvents &&
      record.trace!.events.some(event => event.type === "keypress" && event.key === "m" && event.isTrusted && !event.defaultPrevented && event.phase === "capture");
    return record.selectedWithNativeEvents;
  }
  try {
    page.setDefaultTimeout(Math.max(1, Math.min(3000, workDeadlineMs - Date.now())));
    let plainSelected: boolean;
    if (selection === "typeahead") {
      await page.goto(`${fixture.url}/native-select-control?arm=C`); checkpoint();
      plainSelected = await arm("plain-C-Typeahead-m", ["m"], false);
    } else {
      await page.goto(`${fixture.url}/native-select-control?arm=A`); checkpoint();
      await arm("plain-A-ArrowDown-Enter", ["ArrowDown", "Enter"], false);
      await page.goto(`${fixture.url}/native-select-control?arm=B`); checkpoint(); // A distinct document, no assigned select value.
      plainSelected = await arm("plain-B-Space-ArrowDown-Enter", ["Space", "ArrowDown", "Enter"], false);
    }
    if (plainSelected) {
      await page.goto(fixture.url); checkpoint();
      const left = page.getByRole("region", { name: "Pane left", exact: true });
      await expect(page.getByTestId("catalog-state")).toContainText("stale; 0"); assert.equal(fixture.requests.length, 0);
      const preserved = new Map<string, string>();
      for (const id of ["left-current", "left-sent", "left-queued", "right-current", "left-commits"]) preserved.set(id, await page.getByTestId(id).innerText());
      await left.getByLabel("Draft left", { exact: true }).fill("诊断仍保留当前草稿");
      await left.getByRole("button", { name: /^消息设置：/ }).click();
      const dialog = page.getByRole("dialog", { name: "下一条消息设置", exact: true });
      await expect(dialog).toBeVisible(); await dialog.getByRole("button", { name: "刷新设置目录", exact: true }).click();
      await expect(page.getByTestId("catalog-state")).toContainText("current; 1"); checkpoint();
      const actualSelected = selection === "typeahead"
        ? await arm("actual-C-Typeahead-m", ["m"], true)
        : await arm("actual-B-Space-ArrowDown-Enter", ["Space", "ArrowDown", "Enter"], true);
      for (const [id, text] of preserved) await expect(page.getByTestId(id)).toHaveText(text);
      await expect(page.getByLabel("Draft left", { exact: true })).toHaveValue("诊断仍保留当前草稿");
      await expect(page.getByTestId("left-commits")).toHaveText("0");
      assert.equal(fixture.requests.length, 1); assert.deepEqual(report.pageErrors, []); checkpoint();
      report.diagnosticComplete = true;
      report.conclusion = actualSelected ? "SAME_NATIVE_SEQUENCE_SELECTS_IN_CONTROL_AND_MODAL" : "CONTROL_SELECTS_MODAL_DOES_NOT";
    }
  } catch (error) { report.failure = String(error).slice(0, 2048); throw error; }
  finally {
    page.off("pageerror", onError);
    const encoded = JSON.stringify(report) + "\n";
    assert(Buffer.byteLength(encoded) <= 65536, "Bounded full diagnostic report");
    await writeFile(join(evidence, "native-control.json"), encoded);
  }
  return report;
}
