import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startVisualPreview } from "./visual-shell.fixture";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = root + "docs/evidence/wpf-visual01/";
const baseline = process.argv.includes("--baseline"), production = process.argv.includes("--production");
const label = baseline ? "baseline" : production ? "production" : "development";
const preview = await startVisualPreview(production);
const paths: string[] = JSON.parse(await readFile(output + "amend-receipt.json", "utf8")).claim.scope.filter((p: string) => p.startsWith("apps/"));
const sourceFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceDirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(10_000);
const errors: string[] = [], checks: string[] = [], measurements: unknown[] = [];
let failure: string | null = null;
page.on("pageerror", error => errors.push(error.message));
const pane = (n: number) => page.locator(`[id="panel-conversation:chat-${n}"]`);
const input = (n: number) => pane(n).getByRole("textbox", { name: "Message input", exact: true });
const open = async (n: number) => {
  if (!await page.getByRole("navigation", { name: "Conversations", exact: true }).isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
  await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${n}`, exact: true }).click();
  await expect(input(n)).toBeVisible();
};
const connect = async () => {
  await page.getByLabel("Owner token", { exact: true }).or(page.getByRole("textbox", { name: "Message input" })).first().waitFor();
  if (await page.getByLabel("Owner token", { exact: true }).isVisible()) {
    await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
  }
  await expect(page.getByRole("textbox", { name: "Message input" })).toBeVisible();
};
const appearance = () => page.getByRole("dialog", { name: "Extensions and appearance", exact: true });
const theme = async (id: string, name: string) => {
  await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
  await appearance().getByRole("button", { name, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", id);
  await page.keyboard.press("Escape");
};
const capture = async (name: string) => {
  await page.evaluate(() => document.fonts.ready);
  measurements.push({ name, ...await page.evaluate(() => {
    const data: Record<string, unknown> = {};
    for (const [key, selector] of Object.entries({ shell: ".flow-shell", sidebar: ".flow-sidebar", pane: ".flow-chat-group", composer: ".aui-composer-root", text: '[data-slot="aui_assistant-message-content"]' })) {
      const element = document.querySelector(selector); if (!element) continue;
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      data[key] = { width: r.width, height: r.height, radius: style.borderRadius, shadow: style.boxShadow, background: style.backgroundColor, filter: style.backdropFilter, font: style.fontSize, lineHeight: style.lineHeight };
    }
    return { width: innerWidth, height: innerHeight, pageOverflow: document.documentElement.scrollWidth > innerWidth, data };
  }) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: output + `${label}-${name}.png` });
};
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log("PASS", name); };
try {
  await page.goto(preview.url); await connect();
  await check("actual empty App and long Markdown keep readable pane/code/table bounds at desktop and 390", async () => {
    await capture("empty-light-1280"); await open(3);
    await expect(pane(3).getByRole("heading", { name: "A quiet workspace for a long conversation" })).toBeVisible();
    await pane(3).locator('[data-slot="aui_thread-viewport"]').evaluate(element => { element.scrollTop = 0; });
    await capture("long-light-1280");
    await page.setViewportSize({ width: 390, height: 844 });
    const hide = page.getByRole("button", { name: "Hide chat list", exact: true }); if (await hide.isVisible()) await hide.click();
    await capture("long-light-390");
    await expect(pane(3).getByRole("table")).toBeVisible();
    const code = pane(3).locator("pre").first(); expect(await code.evaluate(e => e.clientWidth <= 390)).toBe(true);
    if (!baseline) expect(await pane(3).getByRole("table").evaluate(e => e.getBoundingClientRect().width <= e.parentElement!.clientWidth + 1)).toBe(true);
  });
  if (!baseline) {
    await check("four Appearance choices use scheme, opaque removes blur, persisted choice survives real reload", async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      if (!await page.getByRole("navigation", { name: "Conversations", exact: true }).isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
      for (const [id, name, scheme] of [["dark", "Dark", "dark"], ["light-opaque", "Light opaque", "light"], ["dark-opaque", "Dark opaque", "dark"], ["light", "Light", "light"]]) {
        await theme(id!, name!);
        expect(await page.locator("html").evaluate(e => getComputedStyle(e).colorScheme)).toBe(scheme);
        expect(await page.locator("html").evaluate(e => e.classList.contains("dark"))).toBe(scheme === "dark");
        if (id!.endsWith("opaque")) expect(await page.locator(".flow-rail").evaluate(e => getComputedStyle(e).backdropFilter)).toBe("none");
        await capture(`${id}-1280`);
      }
      await theme("dark-opaque", "Dark opaque"); await page.reload(); await connect();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-opaque");
      expect(await page.locator(".flow-rail").evaluate(e => getComputedStyle(e).backdropFilter)).toBe("none");
      await open(3); await input(3).fill("A separate draft stays here");
      await theme("dark", "Dark"); await expect(input(3)).toHaveValue("A separate draft stays here");
    });
    await check("plugin palette still applies and disabled contributed theme falls back by dark scheme", async () => {
      await page.getByRole("button", { name: "Extension actions", exact: true }).click();
      await page.locator(".flow-plugin-popover").getByRole("button", { name: "More actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "Ocean theme", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "sample.notes.ocean");
      expect(await page.locator(".flow-chat-group").first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(19, 33, 41)");
      await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
      await appearance().getByRole("button", { name: "Disable sample.notes", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.keyboard.press("Escape");
      expect(await page.locator(".flow-chat-group").first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(34, 36, 38)");
    });
    await check("real typed Tool and Reasoning stay lazy, readable and keyboard-operable", async () => {
      await open(3); expect(preview.activityReads.filter(p => p.startsWith("/api/native-activities/"))).toHaveLength(0);
      await pane(3).locator("summary").filter({ hasText: /^Activity ·/ }).press("Enter");
      const native = pane(3).getByRole("region", { name: "Native execution activity", exact: true });
      await native.getByRole("button", { name: /Read design notes/ }).press("Enter");
      await expect(native.getByLabel("Native activity content")).toContainText("docs/design-notes.md");
      await native.getByRole("button", { name: /Reasoning/ }).press("Enter");
      await expect(native.getByLabel("Native activity content")).toContainText("Synthetic provider thinking");
      await capture("activity-dark-1280");
      await expect(input(3)).toHaveValue("A separate draft stays here");
    });
    await check("streaming pane and split preserve independent drafts without page overflow", async () => {
      await open(2); await expect(pane(2).getByText("A reply in progress", { exact: true })).toBeVisible();
      await input(2).fill("Draft beside a stream"); await page.getByRole("button", { name: "Split chat", exact: true }).click(); await open(3);
      await expect(pane(2)).toBeVisible(); await expect(pane(3)).toBeVisible();
      const task = preview.first.chats.get("chat-2")!.turns[0]!.task.id;
      preview.streams[0]!.append(task, " · another visible increment");
      await expect(pane(2).getByText("A reply in progress · another visible increment", { exact: true })).toBeVisible();
      await expect(input(2)).toHaveValue("Draft beside a stream"); await expect(input(3)).toHaveValue("A separate draft stays here");
      await capture("split-dark-1280");
      await page.setViewportSize({ width: 390, height: 844 });
      const hide = page.getByRole("button", { name: "Hide chat list", exact: true }); if (await hide.isVisible()) await hide.click();
      const bounds = await page.locator(".flow-chat-groups.split").evaluate(element => {
        const parent = element.getBoundingClientRect();
        return { height: element.clientHeight, scrollHeight: element.scrollHeight,
          panes: [...element.children].map(child => {
            const box = child.getBoundingClientRect();
            const composer = [...child.querySelectorAll<HTMLElement>(".aui-composer-root")].find(node => node.offsetHeight > 0)!.getBoundingClientRect();
            return { top: box.top - parent.top, bottom: box.bottom - parent.top,
              composerTop: composer.top - parent.top, composerBottom: composer.bottom - parent.top };
          }) };
      });
      expect(bounds.panes).toHaveLength(2); expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.height + 1);
      for (const box of bounds.panes) {
        expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(bounds.height + 1);
        expect(box.composerTop).toBeGreaterThanOrEqual(box.top); expect(box.composerBottom).toBeLessThanOrEqual(box.bottom);
      }
      const groups = page.locator(".flow-chat-groups.split > .flow-chat-group");
      const upperInput = groups.first().getByRole("textbox", { name: "Message input", exact: true });
      const lowerInput = groups.last().getByRole("textbox", { name: "Message input", exact: true });
      const upperDraft = await upperInput.inputValue(); expect(upperDraft).not.toBe(await lowerInput.inputValue());
      await lowerInput.fill("Lower pane remains editable"); await expect(lowerInput).toBeFocused();
      await expect(upperInput).toHaveValue(upperDraft);
      const focusedLower = await groups.last().evaluate(element => {
        const active = document.activeElement!, pane = element.getBoundingClientRect(), input = active.getBoundingClientRect();
        return { belongs: element.contains(active), top: input.top - pane.top, bottom: input.bottom - pane.top, paneHeight: pane.height };
      });
      expect(focusedLower.belongs).toBe(true); expect(focusedLower.top).toBeGreaterThanOrEqual(0);
      expect(focusedLower.bottom).toBeLessThanOrEqual(focusedLower.paneHeight);
      measurements.push({ name: "narrow-split-bounds", ...bounds, focusedLower, upperDraft }); await capture("split-dark-390");
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByRole("button", { name: "Close Conversation 3", exact: true }).click();
    });
    await check("visible queue error and keyboard focus remain usable in both narrow themes", async () => {
      preview.first.failQueueReads(true); await open(4);
      await expect(pane(4).getByRole("alert").filter({ hasText: "Fixture unavailable" })).toBeVisible();
      for (const [id, name] of [["light", "Light"], ["dark", "Dark"]]) {
        await theme(id!, name!); await page.setViewportSize({ width: 390, height: 844 });
        const hide = page.getByRole("button", { name: "Hide chat list", exact: true }); if (await hide.isVisible()) await hide.click();
        await input(4).press("Shift+Enter"); await expect(input(4)).toBeFocused(); await capture(`error-${id}-390`);
        await page.setViewportSize({ width: 1280, height: 720 });
      }
      preview.first.failQueueReads(false);
    });
    await check("unsupported-backdrop CSS branch retains an opaque readable actual App", async () => {
      const fallback = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      let substituted = 0;
      await fallback.route(/(?:assistant-ui\.css|assets\/.*\.css)(?:\?|$)/, async route => {
        const response = await route.fetch(), original = await response.text();
        const body = original.replace(/@supports[^{]*backdrop-filter:\s*blur\(1px\)[^{]*\{/g, () => { substituted++; return "@supports not (display: block) {"; });
        await route.fulfill({ response, body });
      });
      const solid = await fallback.newPage(); await solid.goto(preview.url);
      if (production) { await solid.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only"); await solid.getByRole("button", { name: "Connect workspace", exact: true }).click(); }
      await expect(solid.getByRole("textbox", { name: "Message input" })).toBeVisible();
      expect(substituted).toBeGreaterThan(0);
      expect(await solid.locator(".flow-rail").evaluate(e => getComputedStyle(e).backdropFilter)).toBe("none");
      expect(await solid.locator(".flow-rail").evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(236, 238, 237)");
      await solid.screenshot({ path: output + `${label}-unsupported-backdrop-branch.png` }); await fallback.close();
    });
    await check("reduced transparency and forced colors preserve solid surfaces and visible boundaries", async () => {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-reduced-motion", value: "reduce" }] });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
      expect(await page.locator(".flow-rail").evaluate(e => getComputedStyle(e).backdropFilter)).toBe("none");
      await capture("reduced-transparency");
      await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
      expect(await page.locator(".flow-chat-group").first().evaluate(e => getComputedStyle(e).boxShadow)).toBe("none");
      await capture("forced-colors"); await cdp.detach();
    });
  }
} catch (error) { failure = String(error); console.error(error); await page.screenshot({ path: output + `${label}-failure.png`, fullPage: true }); }
finally {
  await writeFile(output + `${label}-browser.json`, JSON.stringify({ sourceCommit, sourceDirty, sourceFiles, at: new Date().toISOString(), production, baseline, checks, errors, failure, measurements, scope: "Actual Flow App with contract HTTP synthetic materials; no model, DB or personal service" }, null, 2) + "\n");
  await browser.close(); await preview.close();
}
if (failure || errors.length) process.exitCode = 1;
