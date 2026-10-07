import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, BrowserContext } from "@playwright/test";
import type { HistoryFixtureOptions, ContextWire } from "./context-history-fixture";

export const contextHistoryGroups = ["cookie-no-task", "decoded-read-states", "lazy-detail", "close-late-read", "task-and-visibility", "plugin-revoke", "themes-keyboard", "authority-revoke"] as const;
/** Called only by the owned native worker after its gate. No top-level launch or server. */
export async function runContextHistoryBrowser(browser: Browser, options: HistoryFixtureOptions, signal: AbortSignal) {
  const { expect } = await import("@playwright/test");
  const { startContextHistoryFixture } = await import("./context-history-fixture");
  const checks: string[] = [], pageErrors: string[] = [], consoleErrors: { path: string; text: string; expected: boolean }[] = [], cleanupErrors: string[] = [];
  let fixture: Awaited<ReturnType<typeof startContextHistoryFixture>> | undefined, context: BrowserContext | undefined;
  let failure: string | null = null, phase = "initialization", allowReadError = false, errorOverflow = false, timeOrigin: number | null = null;
  const checkpoint = async () => { signal.throwIfAborted(); await options.checkpoint(); };
  try {
    await checkpoint(); fixture = await startContextHistoryFixture(options, signal);
    context = await browser.newContext({ viewport: { width: 1100, height: 850 }, reducedMotion: "reduce" });
    const page = await context.newPage(); page.setDefaultTimeout(4000);
    page.on("pageerror", error => { if (pageErrors.length < 16) pageErrors.push(error.name + ":" + error.message.slice(0, 384)); else errorOverflow = true; });
    page.on("console", message => {
      if (message.type() !== "error") return;
      const location = message.location().url; let path = "UNKNOWN";
      try { const url = new URL(location); if (url.origin === new URL(fixture!.url).origin) path = url.pathname; } catch { /* non-URL messages remain unknown */ }
      const text = message.text().slice(0, 384);
      if (consoleErrors.length < 16) consoleErrors.push({ path, text, expected: allowReadError && /^\/api\/tasks\/[^/]+\/context\/history$/.test(path) && /503/.test(text) });
      else errorOverflow = true;
    });
    const input = () => page.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
    const trigger = () => page.getByRole("button", { name: "Context", exact: true });
    const dialog = () => page.getByRole("dialog", { name: "Context observation", exact: true });
    const historyRows = () => fixture!.wire.filter(row => /^\/api\/tasks\/[^/]+\/context\/history$/.test(row.path));
    const detailRows = () => fixture!.wire.filter(row => row.path.startsWith("/api/details/context-history-fixture-"));
    const navigate = async (conversationId: string) => {
      await page.evaluate(id => { location.hash = "conversation=" + encodeURIComponent(id); }, conversationId);
      await expect(input()).toBeVisible(); await expect(trigger()).toBeVisible();
    };
    const open = async () => { await trigger().click(); await expect(dialog()).toBeVisible(); };
    const settled = async () => { await expect(dialog().getByRole("button", { name: "Refresh observation", exact: true })).toHaveAttribute("aria-disabled", "false"); };
    const close = async () => { await page.keyboard.press("Escape"); await expect(dialog()).toBeHidden(); };
    const run = async (group: typeof contextHistoryGroups[number], body: () => Promise<void>) => { phase = group; await checkpoint(); await body(); checks.push(group); await checkpoint(); };

    await run("cookie-no-task", async () => {
      await page.goto(fixture!.url + "#conversation=" + fixture!.emptyConversationId);
      timeOrigin = await page.evaluate(() => performance.timeOrigin);
      await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token);
      await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(input()).toBeVisible();
      assert.ok((await context!.cookies()).some(cookie => cookie.name.startsWith("flow-session-") && cookie.httpOnly));
      await expect.poll(() => fixture!.wire.some(row => row.path === "/api/browser-session" && row.cookie && !row.bearer && row.status === 200)).toBe(true);
      await trigger().click(); await expect(page.getByRole("alert").filter({ hasText: "No execution observation is available yet" })).toBeVisible();
      await expect(dialog()).toBeHidden(); assert.equal(historyRows().length, 0);
    });
    await navigate(fixture.a.conversationId);
    await run("decoded-read-states", async () => {
      fixture!.select("zero"); await open(); await settled();
      await expect(dialog().getByText("Last observed use", { exact: true }).locator(".." )).toContainText("0 tokens · estimate");
      await expect(dialog()).toContainText("Current use and remaining space are unknown");
      assert.equal(detailRows().length, 0);
      for (const value of ["unknown", "empty", "invalid", "error", "estimate"] as const) {
        fixture!.select(value); allowReadError = value === "error";
        const before = historyRows().length; await dialog().getByRole("button", { name: "Refresh observation", exact: true }).click();
        await expect.poll(() => historyRows().length).toBe(before + 1); await settled();
        if (value === "unknown") { await expect(dialog()).toContainText("Last observation · values unknown"); await expect(dialog()).not.toContainText("0 tokens"); }
        if (value === "empty") { await expect(dialog()).toContainText("No observation was reported for this attempt"); await expect(dialog()).not.toContainText("0 tokens"); }
        if (value === "invalid" || value === "error") { await expect(dialog().getByRole("alert")).toContainText("Observation read failed"); await expect(dialog()).not.toContainText("999"); }
        if (value === "estimate") { await expect(dialog().getByText("Last observed use", { exact: true }).locator("..")).toContainText("2,048 tokens · estimate"); }
      }
      allowReadError = false; assert.equal(detailRows().length, 0);
    });
    await run("lazy-detail", async () => {
      await dialog().getByRole("button", { name: "Read observation detail", exact: true }).click();
      await expect(dialog().getByRole("region", { name: "Observation detail" })).toContainText("Synthetic historical detail");
      assert.equal(detailRows().length, 1); await close(); await expect(trigger()).toBeFocused();
    });
    await run("close-late-read", async () => {
      const held = fixture!.holdNext(), before = historyRows().length; await open(); await expect.poll(() => held.arrived).toBe(true);
      const refresh = dialog().getByRole("button", { name: "Refresh observation", exact: true });
      await expect(refresh).toHaveAttribute("aria-disabled", "true"); await refresh.focus(); await refresh.press("Enter"); assert.equal(historyRows().length, before + 1);
      await close(); await expect(trigger()).toBeFocused(); held.release(); await expect.poll(() => held.settled).toBe(true);
      await expect(dialog()).toBeHidden(); assert.equal(historyRows().length, before + 1);
      await open(); await settled(); assert.equal(historyRows().length, before + 2); await close(); await expect(trigger()).toBeFocused();
    });
    await run("task-and-visibility", async () => {
      const held = fixture!.holdNext(); await open(); await expect.poll(() => held.arrived).toBe(true);
      await page.evaluate(() => { location.hash = "workspace"; }); await expect(dialog()).toBeHidden();
      held.release(); await expect.poll(() => held.settled).toBe(true); await expect(dialog()).toBeHidden();
      const count = historyRows().length; await navigate(fixture!.b.conversationId); assert.equal(historyRows().length, count);
      assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin);
      await open(); await settled(); assert.equal(historyRows().at(-1)?.path, `/api/tasks/${fixture!.b.taskId}/context/history`); await close();
    });
    await run("plugin-revoke", async () => {
      await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
      const settings = page.getByRole("dialog", { name: "Extensions and appearance", exact: true });
      await settings.getByRole("button", { name: "Disable flow.context-history", exact: true }).click();
      await expect(settings.getByRole("button", { name: "Enable flow.context-history", exact: true })).toBeVisible();
      await page.keyboard.press("Escape"); await expect(settings).toBeHidden(); await expect(trigger()).toHaveCount(0);
      const count = historyRows().length;
      await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
      await settings.getByRole("button", { name: "Enable flow.context-history", exact: true }).click();
      await page.keyboard.press("Escape"); await expect(trigger()).toBeVisible(); assert.equal(historyRows().length, count);
    });
    await run("themes-keyboard", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const theme of ["light", "dark"] as const) {
        const toggle = page.getByRole("button", { name: theme === "light" ? "Use light theme" : "Use dark theme", exact: true });
        if (await toggle.isVisible()) await toggle.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        assert.equal(await page.evaluate(() => document.documentElement.style.colorScheme), theme);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), theme === "dark");
        assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
        await trigger().focus(); await trigger().press("Enter"); await expect(dialog()).toBeVisible(); await settled();
        await expect(dialog()).toContainText("observed-" + "M".repeat(170));
        const geometry = await dialog().evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, viewport: innerWidth }));
        assert.ok(geometry.scroll <= geometry.client + 1 && geometry.left >= 0 && geometry.right <= geometry.viewport);
        await page.keyboard.press("Tab"); assert.ok(await dialog().evaluate(element => element.contains(document.activeElement)));
        await writeFile(join(options.directory, `${theme}-geometry.json`), JSON.stringify(geometry, null, 2) + "\n", { mode: 0o600 });
        const png = await page.screenshot(); assert.ok(png.length > 0 && png.length <= 1024 * 1024);
        await writeFile(join(options.directory, `${theme}-390.png`), png, { flag: "wx", mode: 0o600 }); await close(); await expect(trigger()).toBeFocused();
      }
    });
    await run("authority-revoke", async () => {
      // Real owner UI changes the live authority; no synthetic session object or hidden host command.
      await page.getByRole("button", { name: "Change connection", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Connect to Flow", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Sign out of this center", exact: true }).click();
      await expect(page.getByRole("button", { name: "Sign out of this center", exact: true })).toBeHidden();
      await expect(dialog()).toBeHidden(); await expect(trigger()).toBeHidden();
      assert.ok(fixture!.wire.some(row => row.path === "/api/browser-session/logout" && row.status === 200 && row.cookie && !row.bearer));
    });
    assert.equal(errorOverflow, false); assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors.filter(row => !row.expected), []);
    assert.ok(historyRows().every(row => row.cookie && !row.bearer));
    assert.equal(fixture.wire.filter(row => row.method === "POST" && /\/turns$/.test(row.path)).length, 0, "Reading history must never submit a browser turn");
  } catch (error) { failure = error instanceof Error ? error.name + ": " + error.message.slice(0, 1024) : "Unknown browser failure"; }
  finally {
    try { await context?.close(); } catch { cleanupErrors.push("context-close"); }
    try { await fixture?.close(); } catch { cleanupErrors.push("fixture-close"); }
    const wire: ContextWire[] = fixture?.wire ?? [];
    const result = { passed: failure === null && cleanupErrors.length === 0 && checks.length === contextHistoryGroups.length, phase, checks,
      requiredGroups: contextHistoryGroups, failure, pageErrors, consoleErrors, errorOverflow, cleanupErrors, wire, heldReads: fixture?.heldReads() ?? [], timeOrigin,
      scope: "b129 independent App with synthetic history DTOs behind real Cookie authentication; not Arc-combined or backend observation production",
      limits: { sameViewTaskReplacement: "NOT_COVERED", heldDetail: "NOT_COVERED", hiddenArcWorkspace: "NOT_COVERED", pluginDisableDuringModalRead: "NOT_COVERED", authorityRevocationDuringRead: "NOT_COVERED" } };
    await writeFile(join(options.directory, "context-browser.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  }
  if (failure || cleanupErrors.length) throw Error(failure ?? "Context browser cleanup failed");
}
