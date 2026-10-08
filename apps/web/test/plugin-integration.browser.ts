import { chromium, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
/** Selected by an owned browser caller; no legacy HTTP/PG entry is run on import. */
export async function checkPluginDiagnostics(page: Page, fixtureUrl: string) {
  const pageErrors: string[] = [];
  const onError = (error: Error) => { pageErrors.push(error.message); };
  page.on("pageerror", onError);
  let mounted = false;
  try {
    await page.goto(fixtureUrl);
    await page.evaluate(async () => {
      const path = "/src/plugin-integration/slot-fixture.tsx";
      const fixture = await import(path);
      const container = document.createElement("div");
      container.setAttribute("data-diagnostics-fixture", "");
      document.body.append(container);
      Reflect.set(window, "diagnosticsFixture", await fixture.mountPluginDiagnosticsFixture(container));
    });
    mounted = true;
    const trigger = page.getByRole("button", { name: "Extensions and appearance", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Extensions and appearance", exact: true });
    await expect(dialog.getByText("Extension diagnostics (0)", { exact: true })).toBeVisible();
    await dialog.getByText("Extension diagnostics (0)", { exact: true }).click();
    const before = await page.evaluate(() => Reflect.get(window, "diagnosticsFixture").observation());
    await dialog.getByRole("button", { name: "Fail diagnostic command", exact: true }).click();
    await expect(dialog.getByText("Extension diagnostics (1)", { exact: true })).toBeVisible();
    await expect(dialog.getByText("fixture.diagnostics · command: Fixture command failure", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "diagnosticsFixture").observation().commandResult)).toEqual({ ok: false, error: "Fixture command failure" });
    const command = await page.evaluate(() => Reflect.get(window, "diagnosticsFixture").observation());
    expect(command.ancestorRenders).toBe(before.ancestorRenders);
    expect(command.registryNotifications).toBe(0); expect(command.slotNotifications).toBe(0);
    expect(command.registryStable && command.slotStable).toBe(true);
    await dialog.getByRole("button", { name: "Fail local renderer", exact: true }).click();
    await expect(dialog.getByText("fixture.diagnostics · render: Fixture local renderer failure", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("Extension could not render.");
    const rendered = await page.evaluate(() => Reflect.get(window, "diagnosticsFixture").observation());
    expect(rendered.ancestorRenders).toBe(before.ancestorRenders);
    expect(rendered.registryNotifications).toBe(0); expect(rendered.slotNotifications).toBe(0);
    expect(rendered.registryStable && rendered.slotStable).toBe(true);
    // Development React may report the deliberate error, never unrelated failures.
    expect(pageErrors.filter(message => message !== "Fixture local renderer failure")).toEqual([]);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(trigger).toBeFocused();
    return { checks: ["active-command-notifies-open-production-settings", "local-render-error-notifies-without-ancestor-or-registry-publish", "settings-close-restores-focus"],
      before, command, rendered, pageErrors, input: "Real AppPluginSession/PluginProvider/PluginSettings with synthetic plugin faults; no center/auth/provider proof" };
  } finally {
    try {
      if (mounted) await page.evaluate(async () => { await Reflect.get(window, "diagnosticsFixture")?.dispose(); Reflect.deleteProperty(window, "diagnosticsFixture"); document.querySelector("[data-diagnostics-fixture]")?.remove(); });
    } finally { page.off("pageerror", onError); }
  }
}

// The future owned caller imports only the focused function. Legacy defaults stay explicit.
if (!process.argv.includes("--diagnostics-module")) {
const { startIntegrationFixture, runRealIntegration } = await import("./plugin-integration.config");

const output = fileURLToPath(new URL("../../../docs/evidence/wpf-i01/", import.meta.url));
if (process.argv.includes("--real")) {
  await runRealIntegration(output);
} else if (process.argv.includes("--production")) {
  const preview = await startIntegrationFixture(true);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; const modules: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\/assets\/(workspace|theme)-.*\.js/.test(request.url())) modules.push(new URL(request.url()).pathname); });
  try {
    await page.goto(`${preview.url}/#task=demo-completed`);
    await page.getByLabel("Center URL", { exact: true }).fill(preview.centers[0]!); await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(page.locator('.flow-task-bar .status-succeeded')).toBeVisible(); expect(modules).toHaveLength(0);
    await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click(); await expect(page.getByRole("tab", { name: "Field notes summary", exact: true })).toBeFocused();
    await expect(page.locator('.flow-workspace-detail-content')).toContainText("This is simulated fixture content.");
    await page.getByRole("tab", { name: "Notes", exact: true }).click(); await page.getByRole("button", { name: "Use Ocean theme", exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'sample.notes.ocean');
    await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click(); await page.getByRole("button", { name: "Disable sample.notes", exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click(); await expect(page.getByRole("button", { name: "Extensions and appearance", exact: true })).toBeFocused();
    expect(errors).toEqual([]); expect(modules.some(path => path.includes('/workspace-'))).toBe(true); expect(modules.some(path => path.includes('/theme-'))).toBe(true);
    await writeFile(`${output}production-smoke.json`, JSON.stringify({ at: new Date().toISOString(), checks: ["built production App with official Thread", "workspace and theme adapter chunks loaded on demand", "real builtin artifact through HTTP fixture", "sample custom theme and disable fallback", "Settings return focus"], modules, pageErrors: errors, input: "Production bundle against isolated HTTP fixture" }, null, 2));
    console.log("PASS production Thread, lazy adapter chunks, artifact, custom theme/disable and focus");
  } finally { await browser.close(); await preview.close(); }
} else {
const preview = await startIntegrationFixture();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
const checks: string[] = [];
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const tab = (name: string) => page.getByRole("tab", { name, exact: true });
const connect = async (target: Page, center: string) => {
  await target.getByLabel("Center URL", { exact: true }).fill(center);
  await target.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
  await target.getByRole("button", { name: "Connect workspace", exact: true }).click();
  await expect(target.getByRole("button", { name: "Extensions and appearance", exact: true })).toBeVisible();
};
const select = async (id: string, viaPlugin = false) => {
  const row = page.locator(".flow-chat-row").filter({ has: page.locator(`button[title=${JSON.stringify(preview.first.tasks.get(id)!.title)}]`) });
  await (viaPlugin ? row.getByRole("button", { name: "Open from plugin", exact: true }) : row.locator(":scope > button")).click();
  await expect(page.locator(`.flow-tab-body[id="panel-${id}"] .flow-status`)).toBeVisible();
};
const openSettings = () => page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
const closeSettings = async () => { await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click(); await expect(page.getByRole("button", { name: "Extensions and appearance", exact: true })).toBeFocused(); };
const reads = () => preview.first.requests.filter(request => request.path.startsWith("/api/details/")).length;
try {
  await page.goto(preview.url); await connect(page, preview.centers[0]!);
  await check("first view is lazy; sidebar B command and real Thread message action use local identities", async () => {
    expect(reads()).toBe(0); await select("demo-running"); await select("demo-completed", true);
    await expect(page.locator('.flow-tab-body:not([hidden]) .aui-thread-root')).toBeVisible();
    const action = page.locator('.flow-tab-body:not([hidden]) .aui-assistant-action-bar-root').getByRole("button", { name: "Task output", exact: true }).last();
    await action.click(); await expect(tab("Terminal")).toHaveAttribute("aria-selected", "true");
    expect(reads()).toBe(0);
    await page.getByRole("button", { name: "Close extensions", exact: true }).click();
    await expect(page.getByRole("button", { name: "Toggle workspace panel", exact: true })).toBeFocused();
  });
  await check("native reference request selects workspace from Notes and retains task layouts without re-reading cache", async () => {
    await select("demo-completed"); await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click();
    await expect(tab("Field notes summary")).toBeFocused(); await expect.poll(reads).toBe(1);
    await tab("Notes").click(); await page.getByRole("button", { name: "Open Verification evidence", exact: true }).click();
    await expect(tab("Verification evidence")).toBeFocused(); await expect.poll(reads).toBe(2);
    await select("demo-running"); await expect(tab("Field notes summary")).toHaveCount(0); await select("demo-completed");
    await expect(tab("Field notes summary")).toBeVisible(); await tab("Field notes summary").click();
    await tab("Notes").click(); await tab("Task workspace").click(); await expect(tab("Field notes summary")).toBeVisible(); expect(reads()).toBe(2);
    await page.screenshot({ path: `${output}integration-light.png` });
  });
  await check("settings Close and Escape return focus; disable sample removes actions/theme while preserving draft and native artifact", async () => {
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await page.getByRole("textbox", { name: "Message input", exact: true }).fill("Draft remains private");
    await page.getByRole("button", { name: "Insert note", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Composer insertion is not supported" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message input", exact: true })).toHaveValue("Draft remains private");
    await page.getByRole("button", { name: "Extension actions", exact: true }).click();
    await page.getByRole("button", { name: "More actions", exact: true }).click(); await page.getByRole("menuitem", { name: "Ocean theme", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sample.notes.ocean");
    await openSettings(); await page.getByRole("button", { name: "Disable sample.notes", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); await closeSettings();
    await expect(page.getByRole("button", { name: "Insert note", exact: true })).toHaveCount(0); await expect(page.getByRole("textbox", { name: "Message input", exact: true })).toHaveValue("Draft remains private");
    await openSettings(); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Extensions and appearance", exact: true })).toBeFocused();
    await openSettings(); await page.getByRole("button", { name: "Enable sample.notes", exact: true }).click(); await closeSettings();
    await select("demo-completed"); await expect(tab("Field notes summary")).toBeVisible();
  });
  await check("eight retained chats and two split panes retain HTTP/1 command/detail budget", async () => {
    for (const id of ["demo-decision", "demo-completed", "demo-verification", "demo-failed", "demo-running", "demo-large", "demo-uncertain", "demo-queued"]) { await select(id); await expect.poll(() => preview.first.activeStreamCount()).toBeLessThanOrEqual(1); }
    await page.getByRole("button", { name: "Split chat", exact: true }).click(); await expect.poll(() => preview.first.activeStreamCount()).toBe(2);
    await page.getByRole("button", { name: "Merge tabs", exact: true }).click(); await expect.poll(() => preview.first.activeStreamCount()).toBe(1);
    await select("demo-decision"); await page.getByRole("button", { name: "Approve", exact: true }).click(); await expect(page.locator('.flow-tab-body:not([hidden]) .status-succeeded')).toBeVisible();
  });
  await check("dark/light 390px keyboard tabs, focus visibility and reduced motion", async () => {
    await select("demo-completed"); await page.getByRole("button", { name: "Open Verification evidence", exact: true }).click();
    await page.screenshot({ path: `${output}integration-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.getByRole("button", { name: "Hide chat list", exact: true }).isVisible()) await page.getByRole("button", { name: "Hide chat list", exact: true }).click();
    const selected = page.locator('.flow-workspace-tabs [aria-selected="true"]'); await expect(selected).toBeVisible();
    const bounds = await selected.evaluate(node => { const tab = node.getBoundingClientRect(); const parent = node.closest('.flow-workspace-tabs')!.getBoundingClientRect(); return { left: tab.left, right: tab.right, parentLeft: parent.left, parentRight: parent.right }; });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.parentLeft - 1); expect(bounds.right).toBeLessThanOrEqual(bounds.parentRight + 1);
    await tab("Task workspace").focus(); await page.keyboard.press("ArrowRight"); await expect(tab("Notes")).toBeFocused(); await page.keyboard.press("Home"); await expect(tab("Task workspace")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}integration-dark-390.png` });
    await page.getByRole("button", { name: "Use light theme", exact: true }).click(); await page.screenshot({ path: `${output}integration-light-390.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check("changing centers clears active and hidden visited layouts even when task/reference IDs match", async () => {
    await tab("Notes").click();
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await connect(page, preview.centers[1]!);
    await expect(page.locator('.flow-tab-body:not([hidden])')).toContainText("CENTER B:");
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await expect(tab("Field notes summary")).toHaveCount(0); await expect(tab("Verification evidence")).toHaveCount(0); await expect(tab("Task workspace")).toHaveAttribute("aria-selected", "true");
    expect(preview.second.requests.filter(request => request.path.startsWith("/api/details/"))).toHaveLength(0);
    await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click(); await expect(page.locator('.flow-workspace-detail-content')).toContainText("CENTER B:");
    expect(preview.second.requests.filter(request => request.path.startsWith("/api/details/"))).toHaveLength(1);
  });
  await check("late plugin reference command from old center cannot populate the new connection", async () => {
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await connect(page, preview.centers[0]!);
    preview.first.delayDetails(600);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await page.getByRole("treeitem", { name: "Field notes summary", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Loading Field notes summary…", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await connect(page, preview.centers[1]!);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await expect(tab("Field notes summary")).toHaveCount(0);
    await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click(); await expect(page.locator('.flow-workspace-detail-content')).toContainText("CENTER B:");
    await expect.poll(async () => { await new Promise(resolve => setTimeout(resolve, 650)); return page.locator('.flow-workspace-detail-content').textContent(); }).toContain("CENTER B:");
    preview.first.delayDetails(0);
  });
  await check("a delayed plugin module cannot revive the old center after replacement", async () => {
    const late = await browser.newPage();
    late.on("pageerror", error => errors.push(error.message));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let loading = false;
    await late.route(/\/src\/plugins\/builtins\/workspace\.tsx(?:\?|$)/, async route => { loading = true; await gate; await route.continue(); });
    try {
      await late.goto(`${preview.url}/#task=demo-completed`); await connect(late, preview.centers[0]!);
      await expect(late.locator('.flow-task-bar .status-succeeded')).toBeVisible();
      await late.getByRole("button", { name: "Files", exact: true }).click();
      await expect.poll(() => loading).toBe(true);
      await late.getByRole("button", { name: "Change connection", exact: true }).click(); await connect(late, preview.centers[1]!);
      await late.getByRole("button", { name: "Files", exact: true }).click();
      release();
      await expect(late.getByRole("treeitem", { name: "Field notes summary", exact: true })).toBeVisible();
      await expect(late.locator('.flow-tab-body:not([hidden])')).toContainText("CENTER B:");
      await late.getByRole("button", { name: "Open Field notes summary", exact: true }).click();
      await expect(late.locator('.flow-workspace-detail-content')).toContainText("CENTER B:");
      await late.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
      await expect(late.getByText("Extension diagnostics (0)", { exact: true })).toBeVisible();
    } finally { release(); await late.close(); }
  });
  await check("workspace tabs consume button/menu outside tablist with local context and disable cleanup", async () => {
    const slots = await browser.newPage({ viewport: { width: 390, height: 844 } });
    slots.on("pageerror", error => errors.push(error.message));
    try {
      await slots.goto(preview.url);
      await slots.evaluate(async () => {
        const path = "/src/plugin-integration/slot-fixture.tsx";
        const fixture = await import(path);
        const container = document.createElement("div"); container.setAttribute("data-slot-fixture", "");
        container.style.cssText = "position:fixed;inset:0;background:var(--background);z-index:100"; document.body.append(container);
        Reflect.set(window, "slotFixture", fixture.mountWorkspaceSlotFixture(container));
      });
      const fixture = slots.locator("[data-slot-fixture]");
      const actions = fixture.locator('[data-plugin-slot="workspace.tabs"]');
      await expect(actions.getByRole("button", { name: "Workspace button", exact: true })).toBeVisible();
      expect(await actions.evaluate(node => Boolean(node.closest('[role="tablist"]')))).toBe(false);
      await actions.getByRole("button", { name: "Workspace button", exact: true }).click();
      await expect(slots.getByLabel("Slot invocation")).toHaveText(JSON.stringify({ value: "button", resource: { kind: "workspace", taskId: "B", tabId: "files" } }));
      await actions.getByRole("button", { name: "More actions", exact: true }).focus(); await slots.keyboard.press("ArrowDown");
      await expect(actions.getByRole("menuitem", { name: "Workspace menu action", exact: true })).toBeFocused(); await slots.keyboard.press("Enter");
      await expect(slots.getByLabel("Slot invocation")).toHaveText(JSON.stringify({ value: "menu", resource: { kind: "workspace", taskId: "B", tabId: "files" } }));
      await expect(actions.getByRole("button", { name: "More actions", exact: true })).toBeFocused();
      await slots.screenshot({ path: `${output}workspace-slot-actions.png` });
      await slots.evaluate(() => Reflect.get(window, "slotFixture").disable());
      await expect(actions.getByRole("button")).toHaveCount(0);
    } finally { await slots.evaluate(() => Reflect.get(window, "slotFixture")?.dispose()); await slots.close(); }
  });
  expect(errors).toEqual([]);
  await writeFile(`${output}browser-results.json`, JSON.stringify({ at: new Date().toISOString(), input: "I01 moving branch; two isolated HTTP fixtures, not real center", checks, pageErrors: errors, cleanup: "Only test-owned Vite, fixtures and browser closed" }, null, 2));
} catch (error) { await page.screenshot({ path: `${output}browser-failure.png` }); throw error; }
finally { await browser.close(); await preview.close(); }
}

}
