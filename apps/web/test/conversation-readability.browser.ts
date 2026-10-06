import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startReadabilityPreview } from "./conversation-readability.fixture";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = root + "docs/evidence/wpf-chat-readability/";
const baseline = process.argv.includes("--baseline"), production = process.argv.includes("--production");
const label = baseline ? "baseline" : production ? "production" : "development";
const preview = await startReadabilityPreview(production);
const paths: string[] = JSON.parse(await readFile(output + "take-receipt.json", "utf8")).claim.scope.filter((path: string) => path.startsWith("apps/"));
const sourceFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(10_000);
const errors: string[] = [], checks: string[] = [], measurements: unknown[] = [];
let failure: string | null = null;
page.on("pageerror", error => errors.push(error.message));
const pane = (n: number) => page.locator(`[id="panel-conversation:chat-${n}"]`);
const input = (n: number) => pane(n).getByRole("textbox", { name: "Message input" });
const open = async (n: number) => {
  if (!await page.getByRole("navigation", { name: "Conversations", exact: true }).isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
  await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${n}`, exact: true }).click();
  await expect(input(n)).toBeVisible();
};
const measure = async (width: number, height: number) => {
  await page.setViewportSize({ width, height }); await open(3);
  await expect(pane(3).getByRole("region", { name: "Conversation queue" })).toContainText("0 waiting loaded");
  await page.evaluate(() => document.fonts.ready);
  const rects = await pane(3).evaluate(element => {
    const boxes: Record<string, { top: number; bottom: number; height: number; width: number } | null> = {};
    for (const [key, selector] of Object.entries({ viewport: '[data-slot="aui_thread-viewport"]', footer: '.aui-thread-viewport-footer', profile: '.ep-picker, .ep-locked', queue: '[aria-label="Conversation queue"]', input: 'textarea', protocolFooter: '.flow-conversation-footer' })) {
      const r = element.querySelector(selector)?.getBoundingClientRect();
      boxes[key] = r ? { top: r.top, bottom: r.bottom, height: r.height, width: r.width } : null;
    }
    const viewport = boxes.viewport, footer = boxes.footer;
    return { ...boxes, bodyAboveComposer: viewport && footer ? Math.max(0, Math.min(footer.top, viewport.bottom) - viewport.top) : null, horizontalOverflow: element.scrollWidth > element.clientWidth };
  });
  measurements.push({ width, height, ...rects });
  await page.screenshot({ path: output + `${label}-light-${width}.png` });
};
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log("PASS", name); };
const queuePosts = () => preview.first.requests.filter(request => request.method === "POST" && /\/queue$/.test(request.path));
const conversationPosts = () => preview.first.requests.filter(request => request.method === "POST" && /\/turns$/.test(request.path));
const queueRegion = (n: number) => pane(n).getByRole("region", { name: "Conversation queue", exact: true });
const queueToggle = (n: number) => queueRegion(n).getByRole("button", { name: /waiting loaded|^Queue / }).first();
try {
  await page.goto(preview.url);
  await page.getByLabel("Owner token", { exact: true }).or(page.getByRole("textbox", { name: "Message input" })).first().waitFor();
  if (await page.getByLabel("Owner token", { exact: true }).isVisible()) { await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); }
  await expect(page.getByRole("textbox", { name: "Message input" })).toBeVisible();
  await measure(1280, 720); await measure(390, 844);
  checks.push("same completed conversation, loaded empty queue, light theme rects at 1280x720 and 390x844");
  if (!baseline) {
    await check("locked settings modal keeps draft, readable requested/effective details, keyboard loop and both return-focus paths", async () => {
      await page.setViewportSize({ width: 1280, height: 720 }); await open(3); await input(3).fill("Keep this new draft");
      const trigger = pane(3).getByRole("button", { name: /^Conversation settings:/ });
      await trigger.focus(); await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Conversation settings", exact: true });
      await expect(dialog).toBeVisible(); await expect(dialog.getByRole("region", { name: "Requested configuration", exact: true }).getByText("configured-readonly", { exact: true })).toBeVisible();
      await expect(dialog.getByText(/Steering and per-turn model, thinking and tool controls are unavailable/)).toBeVisible();
      await dialog.getByText("Execution history · 1 turn", { exact: true }).click();
      await dialog.getByText("Execution · turn 1", { exact: true }).click();
      await expect(dialog.getByText("Effective settings reported by the adapter", { exact: true })).toBeVisible();
      await expect(dialog.getByText("simulated-model", { exact: true })).toBeVisible();
      for (const key of ["Tab", "Shift+Tab", "Tab", "Tab"]) { await page.keyboard.press(key); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
      await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(input(3)).toHaveValue("Keep this new draft");
      await trigger.press("Space"); await dialog.getByRole("button", { name: "Close", exact: true }).click(); await expect(trigger).toBeFocused();
    });
    await check("execution navigation closes settings and hands focus to interactive workspace/task while preserving conversation draft", async () => {
      await open(3); await input(3).fill("Retain across execution navigation");
      const trigger = pane(3).getByRole("button", { name: /^Conversation settings:/ });
      await trigger.click(); let dialog = page.getByRole("dialog", { name: "Conversation settings", exact: true });
      await dialog.getByText("Execution history · 1 turn", { exact: true }).click(); await dialog.getByText("Execution · turn 1", { exact: true }).click();
      await dialog.getByRole("button", { name: "Inspect turn 1", exact: true }).click();
      await expect(dialog).toHaveCount(0); const terminal = page.getByRole("tab", { name: "Terminal", exact: true });
      await expect(terminal).toBeFocused(); await terminal.press("ArrowLeft"); await page.keyboard.press("Enter");
      await expect(page.getByRole("tab", { name: "Files", exact: true })).toBeFocused();
      await expect(input(3)).toHaveValue("Retain across execution navigation");
      await trigger.click(); dialog = page.getByRole("dialog", { name: "Conversation settings", exact: true });
      await dialog.getByText("Execution history · 1 turn", { exact: true }).click(); await dialog.getByText("Execution · turn 1", { exact: true }).click();
      const controls = dialog.getByRole("button", { name: "Open task controls", exact: true }); await controls.focus(); await controls.press("Enter");
      await expect(dialog).toHaveCount(0); const taskTab = page.locator('[id="tab-chat-3-task-1"]'); await expect(taskTab).toBeFocused();
      await expect(page).toHaveURL(/#task=chat-3-task-1/); await expect(page.locator('[id="panel-chat-3-task-1"]')).toBeVisible();
      await open(3); await expect(input(3)).toHaveValue("Retain across execution navigation");
      await page.getByRole("button", { name: "Close extensions", exact: true }).click();
    });
    await check("collapsed queue exposes stale error, pause and blockers; disclosure Enter/Space retains keyboard focus", async () => {
      await open(3); const toggle = queueToggle(3); await toggle.focus(); await toggle.press("Enter"); await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await queueRegion(3).getByRole("button", { name: "Pause queue", exact: true }).click();
      await expect(queueRegion(3).locator('.flow-queue-status')).toContainText("Queue paused");
      await toggle.focus(); await toggle.press("Space"); await expect(toggle).toHaveAttribute("aria-expanded", "false"); await expect(toggle).toBeFocused();
      await expect(queueRegion(3).locator('.flow-queue-status')).toBeVisible();
      preview.first.failQueueReads(true);
      await expect(queueRegion(3).getByRole("alert").filter({ hasText: /Open the queue/ })).toBeVisible();
      await expect(queueRegion(3).locator('.flow-queue-status')).toContainText("Refresh the queue");
      preview.first.failQueueReads(false); await toggle.press("Enter"); await queueRegion(3).getByRole("button", { name: "Refresh queue", exact: true }).click();
      await expect(queueRegion(3).getByRole("alert").filter({ hasText: /Open the queue/ })).toHaveCount(0);
      await queueRegion(3).getByRole("button", { name: "Continue queue", exact: true }).click();
      await expect(queueRegion(3).locator('.flow-queue-status')).toHaveCount(0); await toggle.click();
    });
    await check("official running queue input preserves IME and Shift+Enter and sends exactly once from Enter and button", async () => {
      await open(2); await expect(pane(2).getByText("A reply in progress", { exact: true })).toBeVisible();
      await pane(2).getByRole("radio", { name: "Queue next", exact: true }).check();
      const count = queuePosts().length; await input(2).fill("Queue keyboard draft");
      await input(2).dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
      await expect(input(2)).toHaveValue("Queue keyboard draft"); expect(queuePosts()).toHaveLength(count);
      await input(2).press("Shift+Enter"); await expect(input(2)).toHaveValue("Queue keyboard draft\n"); expect(queuePosts()).toHaveLength(count);
      await input(2).press("Enter"); await expect.poll(() => queuePosts().length).toBe(count + 1); await expect(input(2)).toHaveValue("");
      await expect(queueRegion(2).locator('.flow-queue-status')).toContainText("previous turn active");
      await input(2).fill("Queue button draft"); await pane(2).getByRole("button", { name: "Add to queue", exact: true }).click();
      await expect.poll(() => queuePosts().length).toBe(count + 2); await expect(input(2)).toHaveValue("");
    });
    await check("unknown queue receipt stays visible while collapsed, retry preserves original key/body and independent draft", async () => {
      await open(2); preview.first.loseNext("enqueue"); await input(2).fill("Uncertain queue command"); await input(2).press("Enter");
      const receipt = queueRegion(2).getByRole("region", { name: "enqueue receipt", exact: true }).filter({ hasText: "Receipt unknown" });
      await expect(receipt).toBeVisible(); const first = queuePosts().at(-1)!;
      await input(2).fill("My next thought"); await expect(queueToggle(2)).toHaveAttribute("aria-expanded", "false");
      await receipt.getByRole("button", { name: "Retry same enqueue", exact: true }).click();
      await expect(receipt).toHaveCount(0); const retried = queuePosts().at(-1)!; expect(retried.key).toBe(first.key); expect(retried.body).toBe(first.body);
      await expect(input(2)).toHaveValue("My next thought");
    });
    await check("new chat profile selection and Enter retain the draft and settle one canonical answer", async () => {
      await page.getByRole("button", { name: "New chat", exact: true }).first().click();
      const composer = page.getByRole("textbox", { name: "Message input" }).last(); await composer.fill("Hello compact conversation");
      const trigger = page.getByRole("button", { name: /^Execution profile:/ }).last(); await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Execution profile", exact: true }); await expect(dialog.getByRole("radio")).toHaveCount(2);
      await dialog.getByRole("radio").nth(1).check(); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(composer).toHaveValue("Hello compact conversation");
      const count = conversationPosts().length; await composer.press("Enter"); await expect.poll(() => conversationPosts().length).toBe(count + 1);
      await expect(page.getByRole("button", { name: /^Conversation settings: A-model/ })).toBeVisible();
      await expect(page.getByText(/^A: Thinking through your question/)).toBeVisible(); await composer.fill("A new draft beside the reply");
      await expect(page.getByText('A: Here is the complete reply to “Hello compact conversation”.', { exact: true })).toBeVisible();
      await expect(composer).toHaveValue("A new draft beside the reply"); await expect(page.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
    });
    await check("dual theme 390px settings and composer remain reachable without horizontal overflow", async () => {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width: 1280, height: 720 }); await open(3);
        const toggle = page.getByRole("button", { name: `Use ${theme} theme`, exact: true }); if (await toggle.isVisible()) await toggle.click();
        await page.screenshot({ path: output + `${label}-${theme}-1280.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        const hide = page.getByRole("button", { name: "Hide chat list", exact: true }); if (await hide.isVisible()) await hide.click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await input(3).focus(); await expect(input(3)).toBeInViewport(); await page.screenshot({ path: output + `${label}-${theme}-390.png` });
        const trigger = pane(3).getByRole("button", { name: /^Conversation settings:/ }); await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Conversation settings", exact: true }); await expect(dialog.getByRole("heading", { name: "Conversation settings", exact: true })).toBeInViewport();
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: output + `${label}-${theme}-390-settings.png` }); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      }
    });
  }

} catch (error) {
  failure = error instanceof Error ? error.stack ?? error.message : String(error);
  await page.screenshot({ path: output + `${label}-failure.png`, fullPage: true });
} finally {
  await writeFile(output + `${label}-browser.json`, JSON.stringify({ observedAt: new Date().toISOString(), sourceCommit, sourceFiles, fixture: "Public HTTP fixture; no model/DB. Not real-center acceptance.", checks, measurements, errors, failure }, null, 2) + "\n");
  await browser.close(); await preview.close();
}
if (failure || errors.length) throw Error(failure ?? errors.join("\n"));
