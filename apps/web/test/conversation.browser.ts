import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createConversationFixture, startConversationPreview } from "./conversation.fixture";
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-chat01/", import.meta.url));
await mkdir(output, { recursive: true });
const production = process.argv.includes("--production");
const composerOnly = process.argv.includes("--composer-only");
const preview = await startConversationPreview(production);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
const checks: string[] = []; const check = async (name: string, run: () => Promise<void>) => { if (composerOnly && !name.startsWith("composer extension")) return; await run(); checks.push(name); console.log(`PASS ${name}`); };
const pane = () => page.locator('.flow-tab-body:not([hidden])');
const input = () => pane().getByRole("textbox", { name: "Message input" });
const send = () => pane().getByRole("button", { name: "Send message", exact: true });
const turns = () => preview.fixture.requests.filter(request => request.method === "POST" && /\/conversations\/[^/]+\/turns$/.test(request.path));
const select = async (id: string) => { await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${id}`, exact: true }).click(); await expect(input()).toBeVisible(); };
try {
  await page.goto(preview.url);
  await check("official Thread opens as the homepage and two natural replies stay in one conversation", async () => {
    await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
    await input().fill("hi"); await input().press("Enter"); await expect(pane().getByText("Hi! What would you like to talk about?", { exact: true })).toBeVisible();
    await expect(input()).toBeFocused();
    const route = page.url(); await input().fill("Tell me about design"); await input().press("Enter");
    await expect(pane().getByText("You said “Tell me about design”. We can keep exploring that together.", { exact: true })).toBeVisible();
    expect(page.url()).toBe(route); expect(new URL(route).hash).toContain("conversation=");
    await expect(pane().getByText("Runner accepted this execution.", { exact: false })).not.toBeVisible();
    await page.screenshot({ path: `${output}conversation-light.png` });
  });
  await check("late admission preserves a separately edited draft; unsupported Enter and steer keys send nothing while running", async () => {
    preview.fixture.setAckDelay(600); preview.fixture.setReplyDelay(2500);
    await page.getByRole("button", { name: "New chat", exact: true }).first().click(); await input().fill("slow hello"); await send().click();
    await input().fill("my independent next question");
    await expect(pane().getByText("Reply pending. You can keep writing below.", { exact: true })).toBeVisible(); const before = turns().length;
    await expect(input()).toHaveValue("my independent next question"); await expect(send()).toBeDisabled();
    await input().press("Enter"); await input().press("Meta+Shift+Enter"); expect(turns()).toHaveLength(before);
    await expect(pane().getByText("Hi! What would you like to talk about?", { exact: true })).toBeVisible();
    expect((await input().inputValue()).trim()).toBe("my independent next question");
    preview.fixture.setAckDelay(0); preview.fixture.setReplyDelay(100);
  });
  await check("lost receipt retries the exact original turn while keeping the next draft editable", async () => {
    preview.fixture.loseNextReceipt(); await input().fill("receipt unknown message"); await send().click();
    await expect(pane().getByText("Receipt unknown", { exact: true })).toBeVisible(); const original = turns().at(-1)!;
    await input().fill("a new unsent thought"); await pane().getByRole("button", { name: "Retry same message", exact: true }).click();
    await expect(pane().getByText("Receipt unknown", { exact: true })).not.toBeVisible();
    const retried = turns().at(-1)!; expect({ path: retried.path, key: retried.key, body: retried.body }).toEqual({ path: original.path, key: original.key, body: original.body });
    await expect(input()).toHaveValue("a new unsent thought"); await expect(pane().getByText("You said “receipt unknown message”. We can keep exploring that together.", { exact: true })).toBeVisible();
  });
  await check("local oversized message is never sent and is restored; 409 is shown without automatic resend", async () => {
    const before = turns().length; await input().fill("x".repeat(16001)); await input().press("Enter");
    await expect(pane().getByRole("alert")).toContainText("This message was not sent"); await expect(input()).toHaveValue("x".repeat(16001)); expect(turns()).toHaveLength(before);
    preview.fixture.conflictNextTurn(); await input().fill("conflicting turn"); await send().click();
    await expect(pane().getByText("Message rejected", { exact: true })).toBeVisible(); expect(turns()).toHaveLength(before + 1);
    await input().fill("another independent draft"); await expect(input()).toHaveValue("another independent draft");
    await pane().getByRole("button", { name: "Dismiss rejected receipt" }).click();
  });
  await check("typed shortened reply loads only on demand and reopens from its verified cache", async () => {
    await select("1"); const details = () => preview.fixture.requests.filter(request => request.path.includes("/conversations/chat-1/turns/chat-1-turn-1/details/"));
    expect(details()).toHaveLength(0); await pane().getByRole("button", { name: "Read full reply" }).click();
    await expect(pane().locator(".flow-reply-detail pre")).toBeVisible(); expect(details()).toHaveLength(1);
    await pane().getByRole("button", { name: "Hide full reply" }).click(); await pane().getByRole("button", { name: "Read full reply" }).click(); expect(details()).toHaveLength(1);
    await pane().getByRole("button", { name: "Hide full reply" }).click();
  });
  await check("eight retained conversations respect visible-pane observers; split and merge remain functional", async () => {
    for (let i = 1; i <= 8; i++) { await select(String(i)); await expect.poll(() => preview.fixture.activeStreamCount()).toBeLessThanOrEqual(1); }
    await page.getByRole("button", { name: "Split chat", exact: true }).click(); await expect.poll(() => preview.fixture.activeStreamCount()).toBe(2);
    await expect(page.locator('.flow-tab-body:not([hidden]) .aui-thread-root')).toHaveCount(2);
    await page.getByRole("button", { name: "Merge tabs", exact: true }).click(); await expect.poll(() => preview.fixture.activeStreamCount()).toBe(1);
  });
  await check("first failed snapshot is unknown; reconnect and retry restore the actual conversation", async () => {
    preview.fixture.failConversationReads(true); await page.goto(`${preview.url}/#conversation=chat-2`);
    await expect(pane().getByRole("button", { name: "Retry conversation" })).toBeVisible(); await expect(send()).toBeDisabled();
    await expect(pane().getByRole("heading", { name: "What’s on your mind?" })).not.toBeVisible();
    preview.fixture.failConversationReads(false); await pane().getByRole("button", { name: "Retry conversation" }).click();
    await expect(pane().getByText("Hi! What would you like to talk about?", { exact: true })).toBeVisible();
    await context.setOffline(true); await input().fill("draft kept offline"); await expect(send()).toBeDisabled();
    await context.setOffline(false); await expect(input()).toHaveValue("draft kept offline"); await expect(send()).toBeEnabled();
  });
  await check("message action uses the actual turn task and execution controls preserve explicit cancellation", async () => {
    await pane().locator('[data-slot="aui_assistant-message-root"]').last().hover();
    await pane().getByRole("button", { name: "Task output", exact: true }).last().click();
    await expect(page.getByRole("tab", { name: "Terminal", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Runner accepted this execution. This is telemetry, not the assistant reply.", { exact: false }).last()).toBeVisible();
    await page.getByRole("button", { name: "Close workspace", exact: true }).click();
    await pane().locator('.flow-conversation-execution > summary').click(); await pane().locator('.flow-conversation-turn-status summary').click();
    await pane().getByRole("button", { name: "Open task controls", exact: true }).click();
    await expect(pane().locator('.flow-task-bar')).toBeVisible();
    const waiting = preview.fixture.chats.get("chat-4")!.turns[0]!;
    waiting.assistant = { state: "pending", reason: "execution-pending" }; waiting.task.status = "running";
    preview.fixture.tasks.get(waiting.task.id)!.status = "running";
    await select("4"); await pane().locator('.flow-conversation-execution > summary').click(); await pane().locator('.flow-conversation-turn-status summary').click();
    await pane().getByRole("button", { name: "Open task controls", exact: true }).click();
    await pane().getByRole("button", { name: "Cancel task", exact: true }).click();
    const before = preview.fixture.requests.filter(request => request.path.endsWith('/cancel')).length;
    await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
    await expect.poll(() => preview.fixture.requests.filter(request => request.path.endsWith('/cancel')).length).toBe(before + 1);
  });
  await check("hidden draft admission never steals focus or reopens a closed chat", async () => {
    const cancels = preview.fixture.requests.filter(request => request.path.endsWith("/cancel")).length;
    preview.fixture.setAckDelay(700);
    await page.getByRole("button", { name: "New chat", exact: true }).first().click(); await input().fill("hidden receipt"); await input().press("Enter");
    await select("3"); await input().fill("visible draft stays focused");
    await expect.poll(() => preview.fixture.requests.filter(request => request.body?.includes("hidden receipt") && request.path.endsWith("/turns")).length).toBe(1);
    await expect(page.getByRole("tab", { name: "hidden receipt", exact: true })).toBeVisible(); await expect(input()).toBeFocused(); await expect(input()).toHaveValue("visible draft stays focused");
    await page.getByRole("button", { name: "New chat", exact: true }).first().click(); await input().fill("close before receipt"); await input().press("Enter");
    await page.locator('.flow-tab.selected button[aria-label^="Close "]').last().click();
    await page.getByRole("button", { name: "Refresh conversations", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: "close before receipt", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "close before receipt", exact: true })).not.toBeVisible();
    expect(preview.fixture.requests.filter(request => request.path.endsWith("/cancel"))).toHaveLength(cancels);
    preview.fixture.setAckDelay(0);
  });
  await check("changing centers clears active and hidden same-ID drafts and reply caches", async () => {
    await select("1"); await pane().getByRole("button", { name: "Read full reply" }).click(); await expect(pane().locator('.flow-reply-detail pre')).toBeVisible();
    await select("2"); await input().fill("old center draft");
    const other = createConversationFixture(); await new Promise<void>(resolve => other.server.listen(0, "127.0.0.1", resolve));
    const address = other.server.address(); if (!address || typeof address === "string") throw Error("Fixture address missing");
    const old = other.chats.get("chat-1")!.turns[0]!; if (old.assistant.state !== "available") throw Error("Seed missing reply");
    old.assistant.text = "Center B reply preview";
    try {
      await page.getByRole("button", { name: "Change connection", exact: true }).click();
      await page.getByLabel("Center URL").fill(`http://127.0.0.1:${address.port}`); await page.getByLabel("Owner token").fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
      await expect(input()).toHaveValue(""); await select("1"); await expect(pane().getByText("Center B reply preview", { exact: true })).toBeVisible();
      await expect(pane().locator('.flow-reply-detail pre')).not.toBeVisible(); expect(other.requests.filter(request => request.path.includes('/details/'))).toHaveLength(0);
      await pane().getByRole("button", { name: "Read full reply" }).click(); await expect(pane().locator('.flow-reply-detail pre')).toBeVisible(); expect(other.requests.filter(request => request.path.includes('/details/'))).toHaveLength(1);
      await page.getByRole("button", { name: "Change connection", exact: true }).click();
      await page.getByLabel("Center URL").fill(preview.url); await page.getByLabel("Owner token").fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    } finally { await other.close(); }
  });
  await check("composer extension remains scoped to the editable draft and reports unsupported insertion honestly", async () => {
    await page.goto(preview.url); await input().fill("untouched draft");
    await pane().getByRole("button", { name: "Insert note", exact: true }).click();
    await expect(pane().getByRole("alert")).toContainText("Composer insertion is not supported"); await expect(input()).toHaveValue("untouched draft");
    await input().press("Enter"); await expect(pane().getByText("Hi! What would you like to talk about?", { exact: true })).toBeVisible();
    await input().fill("next editable draft"); await pane().getByRole("button", { name: "Insert note", exact: true }).click();
    await expect(pane().getByRole("alert")).toContainText("Composer insertion is not supported"); await expect(input()).toHaveValue("next editable draft");
    await pane().locator('.flow-conversation-execution > summary').click(); await pane().locator('.flow-conversation-turn-status summary').click();
    await expect(pane().getByRole("heading", { name: "Conversation requested", exact: true })).toBeVisible();
    await expect(pane().getByRole("heading", { name: "Runner requested", exact: true })).toBeVisible();
    await expect(pane().getByRole("heading", { name: "Effective settings reported by the adapter", exact: true })).toBeVisible();
    await expect(pane().getByText("simulated-model", { exact: true })).toBeVisible();
    await expect(pane().getByText("configured-readonly", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${output}conversation-settings.png` });
  });
  await check("light and dark 390px keyboard layout remains bounded with reduced motion", async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${preview.url}/#conversation=chat-2`); await expect(input()).toBeVisible(); await input().fill("Narrow draft"); await input().press("Tab");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}conversation-light-390.png` });
    await page.getByRole("button", { name: "Use dark theme" }).click(); await page.screenshot({ path: `${output}conversation-dark-390.png` });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${output}conversation-dark.png` });
  });
  expect(errors).toEqual([]);
  await writeFile(`${output}${composerOnly ? "composer-" : ""}${production ? "production-" : ""}browser-results.json`, JSON.stringify({ at: new Date().toISOString(), source: `${production ? "Built production Web" : "Moving dev Web"}; isolated HTTP fixture via public FlowClient; no center/SDK/model calls`, checks, pageErrors: errors }, null, 2));
} catch (error) { await page.screenshot({ path: `${output}browser-failure.png` }); throw error; }
finally { await browser.close(); await preview.close(); }
