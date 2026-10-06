import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startExecutionProfilePreview } from "./execution-profile-integration.fixture";

const startedAt = new Date().toISOString();
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceFiles = Object.fromEntries(await Promise.all([
  "apps/web/src/App.tsx", "apps/web/src/conversations/ConversationThread.tsx", "apps/web/src/conversations/projection.ts", "apps/web/src/conversations/outbox.ts",
  "apps/web/test/conversation-projection.test.ts", "apps/web/test/conversation-outbox.test.ts", "apps/web/test/execution-profile-integration.fixture.ts", "apps/web/test/execution-profile-integration.browser.ts",
].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
const production = process.argv.includes("--production");
const output = fileURLToPath(new URL("../../../docs/evidence/wpf-profile-integration/", import.meta.url));
const preview = await startExecutionProfilePreview(production);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
page.setDefaultTimeout(8000);
const errors: string[] = [], checks: string[] = [];
let failure: string | undefined;
page.on("pageerror", error => errors.push(error.message));
const pane = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
const input = () => pane().getByRole("textbox", { name: "Message input", exact: true });
const send = () => pane().getByRole("button", { name: "Send message", exact: true });
const picker = () => pane().getByRole("button", { name: /^Execution profile:/ });
const locked = () => pane().getByRole("region", { name: "Locked execution profile", exact: true });
const creates = () => preview.first.requests.filter(request => request.method === "POST" && request.path === "/api/conversations");
const turns = () => preview.first.requests.filter(request => request.method === "POST" && /\/conversations\/[^/]+\/turns$/.test(request.path));
const newChat = async () => { await page.getByRole("button", { name: "New chat", exact: true }).first().click(); await expect(picker()).toBeVisible(); };
const openPicker = async () => { await picker().click(); await expect(page.getByRole("dialog", { name: "Execution profile", exact: true })).toBeVisible(); };
const closePicker = async () => { await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: "Execution profile", exact: true })).toHaveCount(0); await expect(picker()).toBeFocused(); };
const choose = async (n: number, label = "A") => {
  await openPicker();
  if (await page.getByText("Directory is stale. Refresh before choosing a configured profile.", { exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Refresh profiles", exact: true }).click();
    await expect(page.getByText("Directory is stale. Refresh before choosing a configured profile.", { exact: true })).toHaveCount(0);
  }
  if (n === 5 && !(await page.locator(".ep-option").filter({ hasText: `${label} profile 5` }).count())) await page.getByRole("button", { name: "Load more profiles", exact: true }).click();
  await page.locator(".ep-option").filter({ hasText: `${label} profile ${n}` }).getByRole("radio").check();
  await closePicker(); await expect(picker()).toBeFocused();
};
const reply = () => expect(pane().getByText("Hi! What would you like to talk about?", { exact: true })).toBeVisible();
const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
try {
  await page.goto(preview.url);
  await check("actual Thread opens a per-connection directory; unsupported profiles stay visible and disabled beside valid choices", async () => {
    await expect(picker()).toBeVisible(); await expect.poll(() => preview.first.directoryReads.length).toBe(1);
    await input().fill("A draft before profile choice"); await openPicker();
    await expect(page.locator(".ep-option")).toHaveCount(5);
    for (const n of [3, 4]) await expect(page.locator(".ep-option").filter({ hasText: `A profile ${n}` }).getByRole("radio")).toBeDisabled();
    await expect(page.locator(".ep-option").filter({ hasText: "A profile 2" }).getByRole("radio")).toBeEnabled();
    await page.getByRole("button", { name: "Load more profiles", exact: true }).click();
    await expect(page.locator(".ep-option")).toHaveCount(6); expect(preview.first.directoryReads).toHaveLength(2);
    await page.locator(".ep-option").filter({ hasText: "A profile 2" }).getByRole("radio").check();
    await closePicker(); await expect(picker()).toBeFocused(); await expect(input()).toHaveValue("A draft before profile choice");
    expect(creates()).toHaveLength(0);
  });
  await check("first Enter freezes the exact runner pin and requested settings; accepted route keeps focus and an independent next draft", async () => {
    preview.first.setCreationDelay(500);
    await input().fill("Profile selected hello"); await input().press("Enter");
    await expect(locked()).toContainText("Creation receipt pending");
    await input().fill("Next independent thought"); await expect(input()).toBeFocused();
    await reply(); await expect(input()).toHaveValue("Next independent thought"); await expect(input()).toBeFocused();
    await expect(locked()).toContainText("Conversation profile locked");
    expect(JSON.parse(creates()[0]!.body!)).toEqual({ title: "Profile selected hello", harness: "claude", requested: { model: "A-model", thinking: "disabled", tools: "configured-readonly" }, executionProfile: preview.first.profiles[1]!.reference });
    const route = page.url(); await input().press("Enter");
    await expect(pane().getByText("You said “Next independent thought”. We can keep exploring that together.", { exact: true })).toBeVisible();
    expect(creates()).toHaveLength(1); expect(page.url()).toBe(route); preview.first.setCreationDelay(0);
  });
  await check("unknown CREATE retries identical keys and pin while its new draft survives; no turn is sent before receipt identity is confirmed", async () => {
    await newChat(); await choose(1); preview.first.loseNextCreation(); const turnCount = turns().length;
    await input().fill("Lost creation receipt"); await send().click();
    await expect(pane().getByText("Receipt unknown", { exact: true })).toBeVisible(); await expect(locked()).toContainText("Creation receipt pending");
    const original = creates().at(-1)!; expect(turns()).toHaveLength(turnCount);
    await input().fill("Keep this newer draft"); preview.first.failDirectory(401);
    const pendingTab = await page.getByRole("tab", { selected: true }).getAttribute("id");
    await newChat(); await openPicker(); await page.getByRole("button", { name: "Refresh profiles", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible(); await closePicker();
    await page.locator(`[id="${pendingTab}"]`).click(); await expect(locked()).toContainText("Creation receipt pending");
    await pane().getByRole("button", { name: "Retry same message", exact: true }).click(); await reply();
    expect(creates().at(-1)).toEqual(original); await expect(input()).toHaveValue("Keep this newer draft");
    await expect(locked()).toContainText(preview.first.profiles[0]!.reference.runnerId);
    preview.first.failDirectory(0);
  });
  await check("a mismatched CREATE pin remains unknown without submitting a turn; correct replay recovers the original configuration", async () => {
    await newChat(); await choose(2); preview.first.wrongNextCreationPin(); const turnCount = turns().length;
    await input().fill("Wrong pin receipt"); await input().press("Enter");
    await expect(pane().getByText("Receipt unknown", { exact: true })).toBeVisible();
    expect(turns()).toHaveLength(turnCount); const original = creates().at(-1)!;
    await expect(locked()).toContainText(preview.first.profiles[1]!.reference.runnerId);
    await pane().getByRole("button", { name: "Retry same message", exact: true }).click(); await reply();
    expect(creates().at(-1)).toEqual(original);
  });
  await check("known CREATE plus lost turn ACK retries only that turn; a later rejected turn never unlocks the existing profile", async () => {
    await newChat(); await choose(1); preview.first.loseNextReceipt();
    await input().fill("Lost turn receipt"); await send().click();
    await expect(pane().getByText("Receipt unknown", { exact: true })).toBeVisible(); await expect(locked()).toContainText("Conversation profile locked");
    const createCount = creates().length, original = turns().at(-1)!;
    await input().fill("Draft alongside turn receipt"); await pane().getByRole("button", { name: "Retry same message", exact: true }).click(); await reply();
    expect(creates()).toHaveLength(createCount); expect(turns().at(-1)).toEqual(original);
    await expect(input()).toHaveValue("Draft alongside turn receipt"); preview.first.conflictNextTurn(); await send().click();
    await expect(pane().getByText("Message rejected", { exact: true })).toBeVisible(); await expect(locked()).toContainText("Conversation profile locked");
    await expect(picker()).toHaveCount(0); expect(creates()).toHaveLength(createCount);
  });
  await check("stale directory blocks first configured Send without clearing draft; refresh and explicit pagination confirm a retained selection", async () => {
    await newChat(); await choose(5); await input().fill("Stale selection draft"); await openPicker();
    preview.first.failDirectory(401); await page.getByRole("button", { name: "Refresh profiles", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible(); await closePicker(); await expect(send()).toBeDisabled();
    const count = creates().length; await input().press("Enter"); expect(creates()).toHaveLength(count); await expect(input()).toHaveValue("Stale selection draft");
    preview.first.failDirectory(0); preview.first.hideSelectionFromFirstPage(true); await openPicker();
    await page.getByRole("button", { name: "Refresh profiles", exact: true }).click(); await expect(page.locator(".ep-option")).toHaveCount(2);
    await expect(page.getByText("Your selection is not in the loaded directory.", { exact: false })).toBeVisible();
    await closePicker(); await expect(send()).toBeDisabled(); await expect(picker()).toContainText("A-model");
    await openPicker(); await page.getByRole("button", { name: "Load more profiles", exact: true }).click();
    await expect(page.locator(".ep-option").filter({ hasText: "A profile 5" }).getByRole("radio")).toBeChecked();
    await closePicker(); await expect(send()).toBeEnabled(); await expect(input()).toHaveValue("Stale selection draft");
    preview.first.hideSelectionFromFirstPage(false);
  });
  await check("each draft retains its selection across tabs, while an existing legacy conversation stays explicitly unpinned", async () => {
    await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: "Conversation 2", exact: true }).click();
    await expect(locked()).toContainText("Unpinned legacy default"); await expect(picker()).toHaveCount(0);
    const count = creates().length; await input().fill("Legacy continuation"); await input().press("Enter");
    await expect(pane().getByText("You said “Legacy continuation”. We can keep exploring that together.", { exact: true })).toBeVisible();
    expect(creates()).toHaveLength(count); expect(preview.first.chats.get("chat-2")!.snapshot.conversation.executionProfile).toBeUndefined();
    await page.getByRole("tab", { name: "New chat", exact: true }).last().click();
    await expect(picker()).toContainText("A-model"); await expect(input()).toHaveValue("Stale selection draft");
  });
  await check("changing connection discards old catalog delivery and draft selection even when profile identities match", async () => {
    await openPicker(); let ready!: () => void, release!: () => void;
    const received = new Promise<void>(resolve => { ready = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/execution-profiles?*", async route => { const response = await route.fetch(); ready(); await held; await route.fulfill({ response }).catch(() => {}); });
    await page.getByRole("button", { name: "Refresh profiles", exact: true }).click(); await received; await closePicker();
    await page.getByRole("button", { name: "Change connection", exact: true }).click();
    await page.getByLabel("Center URL", { exact: true }).fill(preview.centers[1]!); await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only");
    await page.unroute("**/api/execution-profiles?*");
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(picker()).toContainText("Runner default");
    await openPicker(); await expect(page.locator(".ep-option").filter({ hasText: "B profile 1" })).toBeVisible(); release();
    await expect(page.locator(".ep-option").filter({ hasText: "A profile 1" })).toHaveCount(0);
    await expect(page.locator(".ep-option").filter({ hasText: "B profile 1" })).toBeVisible();
    await closePicker(); await expect(input()).toBeEmpty();
  });
  await check("profile picker and locked configuration fit desktop and 390px in both themes with keyboard return focus", async () => {
    for (const theme of ["light", "dark"] as const) {
      const toggle = page.getByRole("button", { name: `Use ${theme} theme`, exact: true }); if (await toggle.isVisible()) await toggle.click();
      await page.setViewportSize({ width: 1440, height: 1000 }); await openPicker();
      await page.screenshot({ path: `${output}profile-${theme}.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: `${output}profile-${theme}-390.png` });
      await closePicker(); await expect(picker()).toBeFocused();
    }
    if (await page.getByRole("button", { name: "Hide chat list", exact: true }).isVisible()) await page.getByRole("button", { name: "Hide chat list", exact: true }).click();
    await choose(2, "B"); await input().fill("Mobile profile hello"); await input().press("Enter"); await reply();
    await expect(locked()).toContainText("B-model"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}profile-locked-dark-390.png` });
  });
  expect(errors).toEqual([]);
} catch (error) {
  failure = String(error); console.error(error); await page.screenshot({ path: `${output}browser-failure.png` }); process.exitCode = 1;
} finally {
  await browser.close(); await preview.close();
  await writeFile(`${output}${production ? "production-" : ""}browser-results.json`, JSON.stringify({ startedAt, endedAt: new Date().toISOString(), sourceCommit, production, sourceFiles, checks, pageErrors: errors, failure: failure ?? null, directoryReads: [preview.first.directoryReads, preview.second.directoryReads], scope: "Real Flow App via public HTTP fixture only; no model/DB/real center" }, null, 2) + "\n");
}
