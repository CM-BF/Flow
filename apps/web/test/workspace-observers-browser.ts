import { chromium, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startWorkspacePreview } from "./workspace-preview";
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-m02/", import.meta.url));
const preview = await startWorkspacePreview();
const fixture = preview.fixture;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
const checks: string[] = [];
const check = async (name: string, action: () => Promise<void>) => { await action(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const select = async (target: Page, id: string) => {
  await target.locator(".flow-chat-list button").filter({ hasText: fixture.tasks.get(id)!.title }).click();
  await expect(target.locator(`.flow-tab-body[id="panel-${id}"] .flow-status`)).toBeVisible();
};
const emit = (id: string, text: string) => {
  const task = fixture.tasks.get(id)!; const before = task.watermark; fixture.append(id, text);
  fixture.sendPage(id, { task, entries: task.entries.filter(entry => entry.cursor > before), nextCursor: task.watermark, watermark: task.watermark, hasMore: false, pendingDecision: task.pendingDecision, usage: task.usage });
};
try {
  await page.goto(preview.url);
  await check("eight retained chats keep at most one visible observer and leave HTTP/1 command budget", async () => {
    for (const id of ["demo-decision", "demo-completed", "demo-verification", "demo-failed", "demo-running", "demo-large", "demo-uncertain", "demo-queued"]) {
      await select(page, id); await expect.poll(() => fixture.activeStreamCount()).toBeLessThanOrEqual(1);
    }
    await expect(page.getByRole("tab")).toHaveCount(8);
    await select(page, "demo-decision");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.locator(".flow-tab-body:not([hidden]) .flow-status.status-succeeded")).toBeVisible();
    await expect(page.locator(".flow-tab-body:not([hidden])").getByText("This task has completed. Start a new chat for another task.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Field notes summary", exact: true })).toBeVisible();
    await expect.poll(() => fixture.requests.filter(request => request.path.includes("/api/details/demo-decision-artifact")).length).toBe(1);
    await page.getByRole("button", { name: "Close workspace", exact: true }).click();
  });
  await check("hidden task catches up from saved cursor without duplicate entries; two split panes remain live", async () => {
    emit("demo-running", "Hidden progress retained at the center.");
    await select(page, "demo-running");
    await expect(page.locator(".flow-tab-body:not([hidden])").getByText("Hidden progress retained at the center.", { exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Split chat", exact: true }).click();
    await expect.poll(() => fixture.activeStreamCount()).toBe(2);
    emit("demo-running", "Running pane received live progress."); emit("demo-queued", "Other split pane received live progress.");
    await expect(page.locator(".flow-tab-body:not([hidden])").getByText("Running pane received live progress.", { exact: true })).toBeVisible();
    await expect(page.locator(".flow-tab-body:not([hidden])").getByText("Other split pane received live progress.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${output}workspace-eight-chats-split.png` });
    await page.getByRole("button", { name: "Merge tabs", exact: true }).click();
    await expect.poll(() => fixture.activeStreamCount()).toBe(1);
  });
  await check("two browser pages pause hidden observers and preserve commands/details budget", async () => {
    const other = await page.context().newPage(); await other.goto(`${preview.url}/#task=demo-queued`); await other.bringToFront();
    // Headless Chrome may keep both documents visible; explicitly exercise the native visibility handler as well.
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await expect.poll(() => fixture.activeStreamCount()).toBe(1);
    emit("demo-running", "Progress while this document is hidden.");
    await other.getByRole("button", { name: "Cancel task", exact: true }).click(); await other.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
    await expect(other.locator(".flow-status.status-cancel_requested, .flow-status.status-cancelled")).toBeVisible();
    await other.close(); await page.bringToFront();
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await expect.poll(() => fixture.activeStreamCount()).toBe(1);
    await expect(page.locator(".flow-tab-body:not([hidden])").getByText("Progress while this document is hidden.", { exact: true })).toBeVisible();
  });
  await check("delayed acceptance remains attached to its hidden draft; closing never cancels", async () => {
    fixture.delaySubmissions(500);
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await page.getByLabel("Fixture scenario").selectOption("slow");
    const before = fixture.requests.filter(request => request.method === "POST" && request.path === "/api/tasks").length;
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await page.getByRole("button", { name: "Work overview", exact: true }).click();
    await expect.poll(() => fixture.requests.filter(request => request.method === "POST" && request.path === "/api/tasks").length).toBe(before + 1);
    await expect.poll(() => fixture.activeStreamCount()).toBe(0);
    await expect(page.getByRole("heading", { name: "Work overview", exact: true })).toBeVisible();
    await expect(page.locator(".flow-chat-list button").filter({ hasText: "Complete in the background." })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#workspace");
    await page.locator(".flow-chat-list button").filter({ hasText: "Complete in the background." }).click();
    await expect(page.locator(".flow-tab-body:not([hidden]) .flow-status")).toBeVisible();
    const cancels = fixture.requests.filter(request => request.path.endsWith("/cancel")).length;
    await page.getByRole("button", { name: "Close Complete in the background.", exact: true }).click();
    expect(fixture.requests.filter(request => request.path.endsWith("/cancel"))).toHaveLength(cancels);
    fixture.delaySubmissions(0);
  });
  await check("failed snapshot has an explicit retry and never becomes a new-chat composer", async () => {
    fixture.loseSnapshotResponse();
    await page.goto("about:blank");
    await page.goto(`${preview.url}/#task=demo-running`);
    await expect(page.getByRole("button", { name: "Retry task", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create task", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Retry task", exact: true }).click();
    await expect(page.locator(".flow-status.status-running")).toBeVisible();
  });
  await check("controlled workspace detail tab remains visible at 390px", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${preview.url}/#task=demo-completed`);
    await page.getByRole("button", { name: "Open Field notes summary", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Field notes summary", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close workspace", exact: true }).click();
    await page.getByRole("button", { name: "Open Verification evidence", exact: true }).click();
    const selected = page.locator('.flow-workspace-tabs [role="tab"][aria-selected="true"]');
    await expect(selected).toHaveAttribute("title", "Verification evidence");
    const bounds = await selected.evaluate(element => { const rect = element.getBoundingClientRect(); const parent = element.closest(".flow-workspace-tabs")!.getBoundingClientRect(); return { left: rect.left, right: rect.right, containerLeft: parent.left, containerRight: parent.right }; });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.containerLeft - 1); expect(bounds.right).toBeLessThanOrEqual(bounds.containerRight + 1);
    await page.screenshot({ path: `${output}workspace-controlled-tab-390.png` });
  });
  expect(errors).toEqual([]);
  await writeFile(`${output}observer-browser-results.json`, JSON.stringify({ at: new Date().toISOString(), scope: "HTTP/1 real browser + simulated HTTP fixture; visibility handler explicitly dispatched where headless documents remain visible", checks, pageErrors: errors }, null, 2));
} catch (error) { await page.screenshot({ path: `${output}observer-browser-failure.png` }); throw error; }
finally { await browser.close(); await preview.close(); }
