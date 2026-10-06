import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const directory = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.FLOW_WORKSPACE_PREVIEW_URL;
if (!baseURL) throw new Error("Set FLOW_WORKSPACE_PREVIEW_URL to the component fixture Vite URL.");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
async function check(name, run) { await run(); checks.push({ name, result: "passed" }); }
try {
  await page.goto(`${baseURL}/preview.html`);
  await page.waitForLoadState("networkidle");
  await check("file tree starts with one tabstop and no detail requests", async () => {
    await expect(page.getByRole("treeitem")).toHaveCount(4);
    await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);
    await expect(page.getByLabel("Detail requests")).toHaveText("0");
  });
  await check("tree supports arrows, Home, End, Space without page scroll", async () => {
    const folder = page.getByRole("treeitem", { name: "Unopened references", exact: true });
    await folder.focus();
    await page.keyboard.press("Space");
    await expect(folder).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(folder).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("treeitem", { name: "report.md", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("treeitem", { name: "Unavailable reference", exact: true })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(folder).toBeFocused();
    await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);
  });
  await page.screenshot({ path: path.join(directory, "light-files.png") });
  await check("reference activation loads once and renders escaped artifact/version/verification", async () => {
    await page.getByRole("treeitem", { name: "report.md", exact: true }).press("Enter");
    await expect(page.getByText("Loading report.md…")).toBeVisible();
    await expect(page.getByRole("heading", { name: "report.md" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "report.md", exact: true })).toBeFocused();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();
    await expect(page.getByText("passed", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Detail requests")).toHaveText("1");
    if (await page.evaluate(() => window.injected)) throw new Error("Reference content executed");
  });
  await check("tabs use manual arrow activation and one tabstop", async () => {
    await page.getByRole("tab", { name: "report.md", exact: true }).focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Files", exact: true })).toBeFocused();
    await expect(page.getByRole("tab", { name: "report.md", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tree")).toBeVisible();
    await expect(page.getByLabel("Detail requests")).toHaveText("1");
  });
  await check("cached reference keyboard activation retains panel focus without refetch", async () => {
    await page.getByRole("treeitem", { name: "report.md", exact: true }).press("Space");
    await expect(page.getByRole("tab", { name: "report.md", exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: "report.md" })).toBeVisible();
    await expect(page.getByLabel("Detail requests")).toHaveText("1");
    await page.getByRole("tab", { name: "Files", exact: true }).click();
  });
  await check("second detail opens; closing selected detail focuses adjacent tab", async () => {
    await page.getByRole("treeitem", { name: "Verification results", exact: true }).press("Space");
    await expect(page.getByRole("heading", { name: "Verification results" })).toBeVisible();
    await page.getByRole("button", { name: "Close Verification results", exact: true }).click();
    await expect(page.getByRole("tab", { name: "report.md", exact: true })).toBeFocused();
    await expect(page.getByRole("tab", { name: "report.md", exact: true })).toHaveAttribute("aria-selected", "true");
  });
  await page.screenshot({ path: path.join(directory, "light-artifact.png") });
  await check("detail errors stay visible and explicit retry issues one new read", async () => {
    await page.getByRole("tab", { name: "Files", exact: true }).click();
    await page.getByRole("treeitem", { name: "Unavailable reference", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Reference unavailable");
    await expect(page.getByLabel("Detail requests")).toHaveText("3");
    await page.getByRole("button", { name: "Retry detail" }).click();
    await expect(page.getByLabel("Detail requests")).toHaveText("4");
  });
  await check("terminal is read-only, user scrolling pauses follow, resume follows output", async () => {
    await page.getByRole("tab", { name: "Terminal", exact: true }).click();
    const output = page.getByLabel("Read-only task output");
    await expect(output).toContainText("Processing output 80");
    await output.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll", { bubbles: true })); });
    await expect(page.getByRole("button", { name: "Follow latest output" })).toBeVisible();
    await page.getByRole("button", { name: "Append output" }).click();
    if (await output.evaluate((element) => element.scrollTop) !== 0) throw new Error("Output forcibly followed while paused");
    await page.getByRole("button", { name: "Follow latest output" }).click();
    await expect.poll(() => output.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(24);
    await expect(page.locator('input,textarea')).toHaveCount(0);
  });
  await page.screenshot({ path: path.join(directory, "light-terminal.png") });
  await check("copy reports clipboard denial and succeeds with an available clipboard", async () => {
    await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied in test"); } } }); });
    await page.getByRole("button", { name: "Copy output", exact: true }).click();
    await expect(page.getByRole("status", { name: "Clipboard feedback" })).toContainText("Copy failed");
    await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.copiedOutput = text; } } }); });
    await page.getByRole("button", { name: "Copy output", exact: true }).click();
    await expect(page.getByRole("status", { name: "Clipboard feedback" })).toContainText("Output copied");
    if (!(await page.evaluate(() => window.copiedOutput)).includes("New output arrived")) throw new Error("Copied wrong output");
  });
  await check("both themes and reduced motion apply to official terminal", async () => {
    const light = await page.locator(".flow-workspace-terminal").evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.getByRole("button", { name: "Toggle theme" }).click();
    const dark = await page.locator(".flow-workspace-terminal").evaluate((element) => getComputedStyle(element).backgroundColor);
    if (light === dark) throw new Error("Terminal did not switch theme");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animations = await page.locator(".flow-workspace-terminal span").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
    if (animations.some((name) => name !== "none")) throw new Error("Reduced motion still animates");
  });
  await page.screenshot({ path: path.join(directory, "dark-terminal.png") });
  await page.getByRole("tab", { name: "Files", exact: true }).click();
  await page.screenshot({ path: path.join(directory, "dark-files.png") });
  await check("A/B/A retains per-task layout and isolates equal reference ids", async () => {
    const artifacts = page.getByRole("treeitem", { name: "Artifacts", exact: true });
    await artifacts.focus();
    await page.keyboard.press("Space");
    await expect(artifacts).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("tab", { name: "Terminal", exact: true }).click();
    await page.getByLabel("Read-only task output").evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll", { bubbles: true })); });
    await expect(page.getByRole("button", { name: "Follow latest output" })).toBeVisible();
    await page.getByRole("button", { name: "Switch task" }).click();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await page.getByRole("treeitem", { name: "report.md", exact: true }).click();
    await expect(page.getByText("Task B reference bytes", { exact: true })).toBeVisible();
    await expect(page.getByText("# Workspace review", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Switch task" }).click();
    await expect(page.getByRole("tab", { name: "Terminal", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Terminal", exact: true })).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("button", { name: "Follow latest output" })).toBeVisible();
    await page.getByRole("tab", { name: "Files", exact: true }).click();
    await expect(artifacts).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("tab", { name: "report.md", exact: true }).click();
    await expect(page.locator(".flow-workspace-detail-content")).toContainText("# Workspace review");
    await expect(page.locator(".flow-workspace-detail-content")).not.toContainText("Task B reference bytes");
    await page.getByRole("tab", { name: "Files", exact: true }).click();
  });
  await check("narrow panel remains within viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Horizontal page overflow");
    await page.screenshot({ path: path.join(directory, "dark-narrow.png") });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.screenshot({ path: path.join(directory, "light-narrow.png") });
  });
  await check("clearing task removes its open reference tabs", async () => {
    await page.getByRole("button", { name: "Toggle task" }).click();
    await expect(page.getByText("Select a chat to see its files and output.")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ result: "passed", checks: checks.length, errors }, null, 2));
} finally {
  await writeFile(path.join(directory, "browser-results.json"), JSON.stringify({ timestamp: new Date().toISOString(), source: "isolated component fixture, not live center", baseURL, checks, errors }, null, 2));
  await browser.close();
}
