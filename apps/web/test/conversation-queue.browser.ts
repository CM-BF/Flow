import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startQueuePreview } from "./conversation-queue.fixture";

const startedAt = new Date().toISOString(), production = process.argv.includes("--production");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const paths = ["apps/web/src/components/assistant-ui/elements/thread.aui.tsx", "apps/web/src/conversations/ConversationThread.tsx", "apps/web/src/conversations/projection.ts", ...["ConversationQueue.tsx", "commands.ts", "projection.ts", "queue-elements.tsx"].map(name => `apps/web/src/conversations/queue/${name}`), ...["conversation-projection.test.ts", "conversation-queue.test.ts", "conversation-queue.fixture.ts", "conversation-queue.browser.ts"].map(name => `apps/web/test/${name}`)];
const sourceFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-queue01/", import.meta.url));
const preview = await startQueuePreview(production), browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(8000);
const errors: string[] = [], checks: string[] = []; let failure: string | undefined;
page.on("pageerror", error => errors.push(error.message));
const pane = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
const input = () => pane().getByRole("textbox", { name: "Message input", exact: true });
const queue = () => pane().getByRole("region", { name: "Conversation queue", exact: true });
const requests = (method: string, suffix: string, chat = "chat-2") => preview.first.requests.filter(request => request.method === method && request.path.split("?")[0] === `/api/conversations/${chat}/queue${suffix}`);
const openChat = async (n: number) => { await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${n}`, exact: true }).click(); await expect(input()).toBeVisible(); };
const expand = async () => { const trigger = queue().locator('button[aria-expanded]').first(); if (await trigger.getAttribute("aria-expanded") === "false") await trigger.click(); await expect(queue().getByRole("button", { name: "Refresh queue", exact: true })).toBeVisible(); };
const refresh = async () => { await expand(); await queue().getByRole("button", { name: "Refresh queue", exact: true }).click(); await expect(queue().getByRole("button", { name: "Refresh queue", exact: true })).toBeEnabled(); };
const enqueue = () => pane().getByRole("button", { name: "Add to queue", exact: true });
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
try {
  await page.goto(preview.url);
  await check("legacy false makes no queue reads and leaves queue delivery disabled", async () => {
    await openChat(8); await expect(pane().getByRole("radio", { name: "Queue next", exact: true })).toBeDisabled();
    await expect(queue()).toHaveCount(0); expect(preview.first.requests.filter(request => request.path.includes("chat-8/queue"))).toHaveLength(0);
  });
  await check("running official Thread accepts explicit queue intent by Enter and button without turning it into steering", async () => {
    await openChat(2); await expect(queue()).toBeVisible(); await expand();
    await pane().getByRole("radio", { name: "Queue next", exact: true }).check(); await expect(enqueue()).toBeDisabled();
    await input().fill("First queued from Enter"); await expect(enqueue()).toBeEnabled(); await input().press("Enter");
    await expect(queue().getByRole("region", { name: "enqueue receipt", exact: true })).toContainText("accepted"); await expect(input()).toBeEmpty();
    await input().fill("Second queued from button"); await enqueue().click();
    await expect(queue().getByRole("list", { name: "Waiting messages" })).toContainText("Second queued from button");
    expect(requests("POST", "")).toHaveLength(2); expect(preview.first.chats.get("chat-2")!.turns).toHaveLength(1);
    await input().fill("Independent next draft"); await expect(input()).toBeEditable();
  });
  await check("Shift Enter, composition and unsupported steer do not send; oversized UTF-8 draft stays intact before any HTTP allocation", async () => {
    const before = requests("POST", "").length;
    await input().fill("Two lines"); await input().press("Shift+Enter"); await expect(input()).toHaveValue("Two lines\n");
    await input().dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 229, bubbles: true });
    await input().press("Control+Shift+Enter"); await expect(pane().getByRole("alert").filter({ hasText: "Steering is not supported" })).toBeVisible();
    expect(requests("POST", "")).toHaveLength(before);
    const long = "你".repeat(6000); await input().fill(long); await input().press("Enter");
    await expect(input()).toHaveValue(long); await expect(pane().getByRole("alert").filter({ hasText: "16,000 UTF-8 bytes" })).toBeVisible();
    expect(requests("POST", "")).toHaveLength(before);
    await input().fill("Valid long message " + "x".repeat(600)); await enqueue().click();
    await expect.poll(() => requests("POST", "").length).toBe(before + 1); await expect(input()).toBeEmpty();
  });
  await check("unknown admission keeps its original identity through offline reconnect and a separate editable draft", async () => {
    preview.first.loseNext("enqueue"); await input().fill("Lost queue ACK"); await expect(enqueue()).toBeEnabled(); await input().press("Enter");
    const receipt = queue().getByRole("region", { name: "enqueue receipt", exact: true }); await expect(receipt).toContainText("Receipt unknown");
    const original = requests("POST", "").at(-1)!; await input().fill("Keep my later draft");
    await context.setOffline(true); await expect(receipt.getByRole("button", { name: "Retry same enqueue" })).toBeDisabled();
    await context.setOffline(false); await expect(receipt.getByRole("button", { name: "Retry same enqueue" })).toBeEnabled();
    await expect(receipt).toContainText("Receipt unknown"); await receipt.getByRole("button", { name: "Retry same enqueue" }).click();
    await expect(receipt).toContainText("accepted"); expect(requests("POST", "").at(-1)).toEqual(original); await expect(input()).toHaveValue("Keep my later draft");
    expect(preview.first.chats.get("chat-2")!.turns).toHaveLength(1);
  });
  await check("pause replay is historical; fresh current execution is confirmed and cancelled with a separate receipt", async () => {
    preview.first.loseNext("pause"); await queue().getByRole("button", { name: "Pause queue", exact: true }).click();
    const pause = queue().getByRole("region", { name: "pause receipt", exact: true }); await expect(pause).toContainText("Receipt unknown");
    const original = requests("POST", "/pause").at(-1)!, oldTask = preview.first.chats.get("chat-2")!.snapshot.lastTurn!.task.id;
    const currentTask = preview.first.replaceCurrent("chat-2"); await pause.getByRole("button", { name: "Retry same pause" }).click();
    await expect(pause).toContainText("accepted"); await expect(queue()).toContainText(`Current execution: ${currentTask}`); expect(requests("POST", "/pause").at(-1)).toEqual(original);
    await queue().getByRole("button", { name: "Cancel current execution…", exact: true }).click();
    expect(preview.first.requests.filter(request => /\/cancel$/.test(request.path) && request.path.includes("/tasks/"))).toHaveLength(0);
    await queue().getByRole("button", { name: "Confirm execution cancellation", exact: true }).click();
    await expect(queue().getByRole("region", { name: "cancel-task receipt", exact: true })).toContainText("accepted");
    await expect(queue().getByRole("button", { name: "Refresh queue", exact: true })).toBeFocused();
    expect(preview.first.requests.filter(request => request.path === `/api/tasks/${oldTask}/cancel`)).toHaveLength(0);
    expect(preview.first.requests.filter(request => request.path === `/api/tasks/${currentTask}/cancel`)).toHaveLength(1);
    expect(preview.first.requests.find(request => request.path === `/api/tasks/${currentTask}/cancel`)!.key).not.toBe(original.key);
  });
  await check("same-revision terminal state enables explicit Continue; only server promotion adds a turn", async () => {
    const previousRevision = preview.first.queues.get("chat-2")!.revision, before = preview.first.chats.get("chat-2")!.turns.length;
    preview.first.setCurrentStatus("chat-2", "failed"); await refresh();
    expect(preview.first.queues.get("chat-2")!.revision).toBe(previousRevision); await expect(queue().getByRole("button", { name: "Continue queue", exact: true })).toBeEnabled();
    await queue().getByRole("button", { name: "Continue queue", exact: true }).click();
    await expect(queue().getByRole("region", { name: "resume receipt", exact: true })).toContainText("accepted"); expect(preview.first.chats.get("chat-2")!.turns).toHaveLength(before + 1);
    const body = JSON.parse(requests("POST", "/resume").at(-1)!.body!); expect(body.expectedQueueRevision).toBe(previousRevision); expect(body.expectedTaskId).toBe(preview.first.chats.get("chat-2")!.turns[before - 1]!.task.id);
    const cancel = queue().getByRole("button", { name: "Cancel waiting message", exact: true }).first(); await cancel.focus(); await cancel.press("Enter"); await expect(queue().getByRole("region", { name: "cancel-item receipt", exact: true })).toContainText("accepted");
    await expect(queue().getByRole("button", { name: "Refresh queue", exact: true })).toBeFocused();
  });
  await check("cancelling an item already promoted reports that outcome without cancelling its execution", async () => {
    const cancellations = preview.first.requests.filter(request => request.path.includes("/api/tasks/") && request.path.endsWith("/cancel")).length;
    preview.first.promoteOnNextCancel(); await queue().getByRole("button", { name: "Cancel waiting message", exact: true }).first().click();
    await expect(queue().getByText("This item was already promoted. Its execution was not cancelled.", { exact: true })).toBeVisible();
    expect(preview.first.requests.filter(request => request.path.includes("/api/tasks/") && request.path.endsWith("/cancel"))).toHaveLength(cancellations);
  });
  await check("waiting pagination is explicit, message content is lazy and cached, and failed refresh preserves marked stale facts", async () => {
    await openChat(1); await expand(); const list = queue().getByRole("list", { name: "Waiting messages", exact: true }); await expect(list.getByRole("listitem")).toHaveCount(20);
    const details = () => preview.first.requests.filter(request => request.method === "GET" && /\/chat-1\/queue\/chat-1-queued-/.test(request.path)); expect(details()).toHaveLength(0);
    await queue().getByRole("button", { name: "Load more waiting messages", exact: true }).click(); await expect(list.getByRole("listitem")).toHaveCount(25);
    await list.getByRole("button", { name: "Read full message", exact: true }).first().click(); await expect(list.locator("pre")).toContainText("A waiting message 1"); expect(details()).toHaveLength(1);
    await list.getByRole("button", { name: "Hide message", exact: true }).click(); await list.getByRole("button", { name: "Read full message", exact: true }).first().click(); expect(details()).toHaveLength(1);
    preview.first.failQueueReads(true); await refresh(); await expect(queue().getByRole("alert")).toBeVisible(); await expect(queue()).toContainText("Needs refresh"); await expect(list.getByRole("listitem")).toHaveCount(25);
    preview.first.failQueueReads(false); await refresh(); await expect(queue().getByRole("alert")).toHaveCount(0);
  });
  await check("reload restores durable waiting and paused facts, without claiming page-local receipt recovery", async () => {
    await queue().getByRole("button", { name: "Pause queue", exact: true }).click(); await expect(queue().getByRole("region", { name: "pause receipt", exact: true })).toContainText("accepted");
    await page.reload(); await expand(); await expect(queue()).toContainText("Paused:"); await expect(queue().getByRole("list", { name: "Waiting messages" }).getByRole("listitem")).toHaveCount(20);
    await expect(queue().getByRole("region", { name: "pause receipt", exact: true })).toHaveCount(0);
  });
  await check("connection replacement isolates same-id queue details and ignores the previous connection's late response", async () => {
    let ready!: () => void, release!: () => void; const received = new Promise<void>(resolve => { ready = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/conversations/chat-1/queue/chat-1-queued-2", async route => { const response = await route.fetch(); ready(); await held; await route.fulfill({ response }).catch(() => {}); });
    await queue().getByRole("button", { name: "Read full message", exact: true }).first().click(); await received;
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await page.getByLabel("Center URL", { exact: true }).fill(preview.centers[1]!); await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
    await page.unroute("**/api/conversations/chat-1/queue/chat-1-queued-2"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await openChat(1); await expand(); release(); await queue().getByRole("button", { name: "Read full message", exact: true }).first().click();
    await expect(queue().locator("pre")).toContainText("B waiting message 1"); await expect(queue().locator("pre")).not.toContainText("A waiting message 1");
  });
  await check("compact queue actions and official composer fit both themes at 390px with reduced motion and keyboard operation", async () => {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 1440, height: 1100 }); const toggle = page.getByRole("button", { name: `Use ${theme} theme`, exact: true }); if (await toggle.isVisible()) await toggle.click();
      await page.screenshot({ path: `${output}queue-${theme}.png` }); await page.setViewportSize({ width: 390, height: 844 });
      if (await page.getByRole("button", { name: "Hide chat list", exact: true }).isVisible()) await page.getByRole("button", { name: "Hide chat list", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await queue().evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      const trigger = queue().locator('button[aria-expanded]').first(); await trigger.focus(); await trigger.press("Enter"); await expect(trigger).toHaveAttribute("aria-expanded", "false"); await trigger.press("Enter"); await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const refreshButton = queue().getByRole("button", { name: "Refresh queue", exact: true }); await refreshButton.focus();
      await expect.poll(() => refreshButton.evaluate(node => { const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
      await refreshButton.press("Enter"); await expect(refreshButton).toBeEnabled();
      await page.screenshot({ path: `${output}queue-${theme}-390.png` });
    }
  });
  expect(errors).toEqual([]);
} catch (error) { failure = String(error); console.error(error); await page.screenshot({ path: `${output}${production ? "production-" : ""}browser-failure.png` }); process.exitCode = 1; }
finally {
  await browser.close(); await preview.close();
  await writeFile(`${output}${production ? "production-" : ""}browser-results.json`, JSON.stringify({ startedAt, endedAt: new Date().toISOString(), sourceCommit, sourceFiles, production, checks, pageErrors: errors, failure: failure ?? null, scope: "Actual Flow App via private HTTP fixtures; no model, real center or DB; receipt recovery across reload explicitly not implemented" }, null, 2) + "\n");
}
