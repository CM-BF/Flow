import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { chromium, expect, type Browser } from "@playwright/test";
import { startAttachmentPreview, root, evidence } from "./attachment-integration.fixture";

const label = process.argv[2] ?? "production-first";
const plainOnly = process.argv[3] === "plain";
const longNamesOnly = process.argv[3] === "longnames";
if (!/^[a-z0-9-]+$/.test(label)) throw Error("Use a simple report label.");
const previous = await readdir(evidence);
const priorDurations = new Map<string, number>();
for (const file of previous.filter(name => name.endsWith("-budget.json"))) {
  const record = JSON.parse(await readFile(evidence + file, "utf8"));
  if (!record.endedAt) throw Error("An earlier run has no settled cleanup/budget record; reconcile it before another run.");
  priorDurations.set(file.replace("-budget.json", ""), record.wallMs);
}
for (const file of previous.filter(name => name.endsWith("-browser.json"))) {
  const key = file.replace("-browser.json", "");
  priorDurations.set(key, Math.max(priorDurations.get(key) ?? 0, JSON.parse(await readFile(evidence + file, "utf8")).wallMs ?? 0));
}
const usedMs = [...priorDurations.values()].reduce((total, duration) => total + duration, 0);
const available = 600_000 - usedMs;
if (available < 60_000) throw Error("Insufficient cumulative budget; obtain a new bounded decision.");
const began = Date.now(), checks: string[] = [], errors: string[] = [];
let fixture: Awaited<ReturnType<typeof startAttachmentPreview>> | undefined, browser: Browser | undefined, failure: string | null = null;
const budget = Math.min(longNamesOnly ? 25_000 : 220_000, available - 20_000);
const lifetime = new AbortController();
await writeFile(evidence + label + "-budget.json", JSON.stringify({ startedAt: new Date(began).toISOString(), priorMs: usedMs, workBudgetMs: budget, cleanupReserveMs: 20_000 }));
const timeout = setTimeout(() => { lifetime.abort(Error("Work deadline; cleanup reserved")); void browser?.close(); }, budget);
const work = async () => {
  fixture = await startAttachmentPreview(label, lifetime.signal); lifetime.signal.throwIfAborted(); browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 10_000 }); lifetime.signal.throwIfAborted();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(8000); page.on("pageerror", error => errors.push(error.message));
  const input = () => page.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
  const navigation = async () => {
    const toggle = page.getByRole("button", { name: "Chats", exact: true });
    await expect(toggle).toBeVisible();
    if (!await page.getByRole("complementary", { name: "Chats", exact: true }).isVisible()) await toggle.click();
    const nav = page.getByRole("navigation", { name: "Conversations", exact: true }); await expect(nav).toBeVisible(); return nav;
  };
  const files = () => page.locator("[data-composer-view]").getByRole("button", { name: "Files", exact: true }).filter({ visible: true });
  const dialog = () => page.getByRole("dialog", { name: "Project text files", exact: true });
  const posts = (pattern: RegExp) => fixture!.wire.filter(row => row.method === "POST" && pattern.test(row.path));
  const upload = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Add Attachment", exact: true }).filter({ visible: true }).first().click()]);
    await chooser.setFiles(file);
  };
  const contentReads = () => fixture!.wire.filter(row => /\/content\?/.test(row.path)).length;
  const check = async (name: string, operation: () => Promise<void>) => { lifetime.signal.throwIfAborted(); await operation(); checks.push(name); console.log("PASS", name); };
  try {
    await page.goto(fixture.url); await page.getByLabel("Owner token", { exact: true }).fill(fixture.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    if (!await input().count()) await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await expect(input()).toBeVisible();
    if (longNamesOnly) {
      const names = ["a".repeat(251) + ".txt", "文🙂".repeat(30) + "b".repeat(161) + ".txt"] as const;
      const nav = await navigation(); await nav.getByRole("button", { name: "Other project chat", exact: true }).click();
      await expect(page.getByRole("region", { name: "Locked execution profile", exact: true }).filter({ visible: true })).toBeVisible();
      await input().fill("Keep long-name draft");
      await files().click(); await expect(dialog()).toBeVisible(); await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Add Attachment", exact: true }).filter({ visible: true }).first()).toBeEnabled();
      for (const name of names) await upload({ name, mimeType: "text/plain", buffer: Buffer.from("Long name content") });
      await expect.poll(() => posts(/\/projects\/[^/]+\/attachments$/).filter(row => row.status === 201).length).toBe(2);
      if (await page.getByRole("complementary", { name: "Chats", exact: true }).isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      const observations = [];
      for (const theme of ["light", "dark"]) {
        if (theme === "dark") await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
        await files().click(); await dialog().getByRole("button", { name: "Browse files", exact: true }).click();
        await expect(dialog().getByRole("button", { name: "Use " + names[0], exact: true })).toBeVisible();
        const recovery = dialog().getByText(/Upload recovery \(/); if (!await recovery.evaluate(element => element.parentElement?.hasAttribute("open"))) await recovery.click();
        const receipt = dialog().getByRole("button", { name: "Check receipt for " + names[1], exact: true });
        await receipt.focus(); await page.keyboard.press("Enter");
        await expect(dialog().getByRole("button", { name: "Use recovered " + names[1], exact: true })).toBeEnabled();
        const geometry = await dialog().evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
          buttons: [...element.querySelectorAll("button")].filter(button => /^(Use |Remove |Check receipt for |Forget local record for )/.test(button.getAttribute("aria-label") ?? button.textContent ?? "")).map(button => ({
            text: button.textContent, accessibleName: button.getAttribute("aria-label") ?? button.textContent, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth,
            width: button.getBoundingClientRect().width, right: button.getBoundingClientRect().right, left: button.getBoundingClientRect().left,
            whiteSpace: getComputedStyle(button).whiteSpace, overflowWrap: getComputedStyle(button).overflowWrap,
          })) }));
        observations.push({ theme, geometry });
        await page.screenshot({ path: evidence + label + "-" + theme + "-390.png" });
        await page.keyboard.press("Escape"); await expect(files()).toBeFocused(); await expect(input()).toHaveValue("Keep long-name draft");
      }
      await writeFile(evidence + label + "-geometry.json", JSON.stringify({ names: names.map(name => ({ name, utf16Length: name.length, utf8Bytes: Buffer.byteLength(name) })), observations }, null, 2));
      checks.push("255-code-unit legal ASCII and Chinese/emoji names; actual upload, metadata, recovery Enter and Escape restore in both themes");
      expect(errors).toEqual([]);
      for (const { geometry } of observations) {
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.buttons.length).toBeGreaterThanOrEqual(10);
        for (const button of geometry.buttons) { expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth); expect(button.right).toBeLessThanOrEqual(390); expect(button.left).toBeGreaterThanOrEqual(0); }
      }
      checks.push("long-name Dialog and all material action buttons stay within 390px without horizontal overflow");
      return;
    }
    if (!plainOnly) {
    await check("explicit project preparation preserves the text and performs zero turns", async () => {
      await input().fill("Attachment production conversation"); await page.getByRole("button", { name: "Knowledge", exact: true }).filter({ visible: true }).click();
      const knowledge = page.getByRole("dialog", { name: "Conversation knowledge", exact: true });
      await knowledge.getByLabel("Conversation project").selectOption(fixture!.projectId);
      await knowledge.getByRole("button", { name: "Prepare conversation in project" }).click(); await expect(knowledge).toContainText("Conversation project locked");
      await page.keyboard.press("Escape"); await expect(input()).toHaveValue("Attachment production conversation"); expect(posts(/\/turns$/)).toHaveLength(0);
    });
    await check("P01 Files entry loads only explicit metadata; Enter preview is lazy and cached", async () => {
      await files().click(); await expect(dialog()).toBeVisible(); expect(contentReads()).toBe(0);
      await dialog().getByRole("button", { name: "Browse files", exact: true }).click(); await expect(dialog().getByRole("button", { name: "Use existing.txt", exact: true })).toBeVisible();
      expect(contentReads()).toBe(0); await dialog().getByText("Preview existing.txt", { exact: true }).focus(); await page.keyboard.press("Enter");
      await expect(dialog().locator("pre")).toContainText("<script>not executed</script>"); expect(contentReads()).toBe(1);
      await dialog().getByRole("button", { name: "Use existing.txt", exact: true }).click(); await page.keyboard.press("Escape"); await expect(files()).toBeFocused();
      await expect(page.locator(".aui-composer-attachments .aui-attachment-root")).toHaveCount(1);
    });
    await check("real Send v2 bad-200 becomes unknown; retry preserves key/body and next draft", async () => {
      fixture!.badTurn(); await input().fill("Send fixed attachment"); await page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true }).click();
      await expect(input()).toHaveValue(""); await input().fill("New text after send");
      await expect(page.getByRole("region", { name: "Message receipt" })).toContainText("Receipt unknown");
      const first = posts(/\/turns$/).at(-1)!; expect(JSON.parse(first.body).attachments).toEqual([fixture!.resource.reference]);
      await page.getByRole("button", { name: "Retry same message", exact: true }).click(); await expect(page.getByRole("region", { name: "Message receipt" })).toHaveCount(0);
      const retry = posts(/\/turns$/).at(-1)!; expect(retry.key).toBe(first.key); expect(retry.body).toBe(first.body); expect(JSON.parse(retry.response!).turn.context.templateVersion).toBe(2);
      await expect(input()).toHaveValue("New text after send");
      // ACK followed by the authoritative GET can replace the message tile once.
      // Re-find the real tile rather than asserting focus on the retired node.
      await expect(async () => {
        await page.getByRole("button", { name: "Chats", exact: true }).hover();
        await page.locator(".aui-user-message-attachments-end").getByRole("button").first().hover();
        await expect(page.getByRole("tooltip")).toContainText("existing.txt · v1", { timeout: 500 });
      }).toPass({ timeout: 4000 });
    });
    await check("official upload adapter and Queue Enter use a frozen v2 receipt, never cancel the task", async () => {
      const file = { name: "upload.txt", mimeType: "text/plain", buffer: Buffer.from("Upload exact text 中文\r\n") };
      await upload(file);
      await expect.poll(() => posts(/\/projects\/[^/]+\/attachments$/).length).toBe(1);
      await expect(page.locator(".aui-composer-attachments .aui-attachment-root")).toHaveCount(1);
      await page.getByRole("radio", { name: "Queue next", exact: true }).filter({ visible: true }).check(); await input().fill("Queue the uploaded file");
      fixture!.badQueue(); await input().press("Enter");
      await expect(page.getByRole("region", { name: "enqueue receipt" })).toContainText("Receipt unknown");
      const first = posts(/\/queue$/).at(-1)!; expect(JSON.parse(first.body).attachments).toHaveLength(1);
      await input().fill("Draft after queue"); await page.getByRole("button", { name: "Retry same enqueue", exact: true }).click(); await expect(page.getByRole("region", { name: "enqueue receipt" })).toContainText("accepted");
      const retry = posts(/\/queue$/).at(-1)!; expect(retry.key).toBe(first.key); expect(retry.body).toBe(first.body); expect(JSON.parse(retry.response!).item.context.templateVersion).toBe(2);
      expect(posts(/\/cancel$/)).toHaveLength(0); await expect(input()).toHaveValue("Draft after queue");
    });
    await check("offline before submit prevents receipt/POST and preserves original uploaded material", async () => {
      await upload({ name: "rollback.txt", mimeType: "text/plain", buffer: Buffer.from("rollback material") });
      await expect.poll(() => posts(/\/projects\/[^/]+\/attachments$/).length).toBe(2);
      await expect(page.locator(".aui-composer-attachments .aui-attachment-root")).toHaveCount(1); await input().fill("Original rollback draft");
      const before = posts(/\/queue$/).length;
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await expect(page.getByText("Reconnect before sending. You can keep writing your next message.", { exact: true })).toBeVisible();
      await input().press("Enter");
      await expect(input()).toHaveValue("Original rollback draft"); await expect(page.locator(".aui-composer-attachments .aui-attachment-root")).toHaveCount(1); expect(posts(/\/queue$/).length).toBe(before);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await files().click(); await expect(dialog().getByRole("region", { name: "Files in this draft" })).toContainText("rollback.txt"); await page.keyboard.press("Escape");
    });
    await check("disable/enable and native hidden retain materials without automatic reads; protected close is retained", async () => {
      await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click(); await page.getByRole("button", { name: "Disable flow.conversation-attachments", exact: true }).click(); await page.keyboard.press("Escape");
      const before = posts(/\/queue$/).length; await page.getByRole("button", { name: "Add to queue", exact: true }).filter({ visible: true }).click(); await expect(input()).toHaveValue("Original rollback draft"); expect(posts(/\/queue$/).length).toBe(before);
      await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click(); await page.getByRole("button", { name: "Enable flow.conversation-attachments", exact: true }).click(); await page.keyboard.press("Escape");
      const reads = contentReads(); await files().click(); await page.keyboard.press("Escape"); expect(contentReads()).toBe(reads);
      const nav = await navigation();
      await nav.getByRole("button", { name: "Other project chat", exact: true }).click(); await expect(input()).toHaveValue("");
      await page.getByRole("button", { name: "Split chat", exact: true }).click(); await expect(input()).toHaveCount(2);
      const original = page.getByRole("region", { name: "Attachment production conversation", exact: true }); await expect(original.getByRole("textbox", { name: "Message input", exact: true })).toHaveValue("Original rollback draft");
      await original.getByRole("button", { name: "Files", exact: true }).click(); await expect(dialog()).toContainText("rollback.txt"); await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Close Attachment production conversation", exact: true }).click(); await page.getByRole("button", { name: "Retained chats", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Retained chats", exact: true })).toContainText("Attachment draft"); await page.getByRole("dialog", { name: "Retained chats", exact: true }).getByRole("button", { name: "Attachment production conversation", exact: true }).click();
    });
    await check("390 light/dark keyboard and metadata-only retained material", async () => {
      if (await page.getByRole("button", { name: "Merge tabs", exact: true }).count()) await page.getByRole("button", { name: "Merge tabs", exact: true }).click();
      if (await page.getByRole("complementary", { name: "Chats", exact: true }).isVisible()) await page.getByRole("button", { name: "Chats", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 }); await files().first().click(); await page.screenshot({ path: evidence + label + "-light-390.png" });
      await page.keyboard.press("Tab"); expect(await dialog().evaluate(element => element.contains(document.activeElement))).toBe(true); await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Use dark theme", exact: true }).click(); await files().first().click(); await page.screenshot({ path: evidence + label + "-dark-390.png" });
      expect(await dialog().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true); await page.keyboard.press("Escape"); await page.setViewportSize({ width: 1280, height: 800 });
    });
    await check("unknown upload survives browser reload; sixth public receipt lookup recovers without a new POST or automatic attachment", async () => {
      const original = page.getByRole("region", { name: "Attachment production conversation", exact: true });
      await original.getByRole("textbox", { name: "Message input", exact: true }).click();
      fixture!.badUpload(); await upload({ name: "lost.txt", mimeType: "text/plain", buffer: Buffer.from("Exact original unknown upload") });
      await expect.poll(() => posts(/\/projects\/[^/]+\/attachments$/).some(row => row.fault === "bad accepted upload acknowledgement")).toBe(true);
      const sent = posts(/\/projects\/[^/]+\/attachments$/).at(-1)!;
      await original.getByRole("button", { name: "Files", exact: true }).click(); await expect(dialog()).toContainText("unknown"); await page.keyboard.press("Escape");
      page.once("dialog", dialog => void dialog.accept()); await page.reload(); await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
      const nav = await navigation();
      await nav.getByRole("button", { name: "Attachment production conversation", exact: true }).click(); await files().click();
      await dialog().getByText(/Upload recovery \(/).click(); await dialog().getByRole("button", { name: "Check receipt for lost.txt", exact: true }).click();
      await expect(dialog().getByRole("button", { name: "Use recovered lost.txt", exact: true })).toBeVisible();
      expect(posts(/\/projects\/[^/]+\/attachments$/).at(-1)).toBe(sent);
      const lookup = fixture!.wire.findLast(row => row.path.includes("/upload-receipt?")); expect(lookup?.path).toContain(encodeURIComponent(sent.key!)); expect(lookup?.status).toBe(200);
      expect(await page.locator(".aui-composer-attachments .aui-attachment-root").count()).toBe(0);
      await dialog().getByRole("button", { name: "Use recovered lost.txt", exact: true }).click(); await expect(dialog().getByRole("region", { name: "Files in this draft" })).toContainText("lost.txt"); await page.keyboard.press("Escape");
      const reference = JSON.parse(lookup!.response!).receipt.resource.reference;
      expect((await fixture!.client.attachment(fixture!.projectId, reference.resourceId)).reference).toEqual(reference);
    });
    await check("@file uses the same plugin panel; official drag input uploads and explicit chip removal preserves recovery", async () => {
      await input().fill("Refer to @file"); await input().press("Tab"); await expect(dialog()).toBeVisible();
      await dialog().getByRole("button", { name: "Browse files", exact: true }).click();
      await dialog().getByRole("button", { name: "Use existing.txt", exact: true }).click(); await page.keyboard.press("Escape");
      await expect(input()).toHaveValue("Refer to ");
      const data = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(["Drag exact text"], "drag.txt", { type: "text/plain" })); return data; });
      const count = posts(/\/projects\/[^/]+\/attachments$/).length;
      await page.locator('[data-slot="aui_composer-shell"]').filter({ visible: true }).dispatchEvent("drop", { dataTransfer: data }); await data.dispose();
      await expect.poll(() => posts(/\/projects\/[^/]+\/attachments$/).length).toBe(count + 1);
      await files().click(); await expect(dialog().getByRole("region", { name: "Files in this draft" })).toContainText("drag.txt"); await page.keyboard.press("Escape");
      const chips = page.locator(".aui-composer-attachments .aui-attachment-root"); const initial = await chips.count();
      await chips.last().getByRole("button", { name: "Remove file", exact: true }).click(); await expect(chips).toHaveCount(initial - 1);
      await files().click(); await expect(dialog().getByRole("region", { name: "Files in this draft" })).not.toContainText("drag.txt"); await page.keyboard.press("Escape");
      expect(fixture!.wire.some(row => row.method === "DELETE")).toBe(false);
    });
    await check("storage failure cannot tear down text-only conversations; empty attachment field stays omitted", async () => {
      await context.addInitScript(() => { const original = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key === "flow.attachment-recovery.v1") throw Error("Fixture storage refused"); return original.call(this, key); }; });
      page.once("dialog", dialog => void dialog.accept()); await page.reload(); await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
      const nav = await navigation();
      await nav.getByRole("button", { name: "Other project chat", exact: true }).click(); await expect(page.getByText(/Attachment recovery is unavailable:/).filter({ visible: true })).toBeVisible();
      await input().fill("Plain with storage failure"); await input().press("Enter"); await expect(input()).toHaveValue("");
      await expect.poll(() => posts(/\/turns$/).at(-1)?.body).toContain("Plain with storage failure");
      const sent = posts(/\/turns$/).at(-1)!; expect(JSON.parse(sent.body)).not.toHaveProperty("attachments"); expect(JSON.parse(sent.response!).turn.context).toBeUndefined();
    });
    }
    await check("unbound legacy conversation stays plain and sends no attachment field", async () => {
      const nav = await navigation();
      await nav.getByRole("button", { name: "Plain legacy conversation", exact: true }).click();
      await expect(page.getByRole("region", { name: "Locked execution profile", exact: true }).filter({ visible: true })).toBeVisible();
      await input().fill("Plain legacy send"); await expect(page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true })).toBeEnabled(); await input().press("Enter"); await expect(input()).toHaveValue("");
      await expect.poll(() => posts(/\/turns$/).at(-1)?.body).toContain("Plain legacy send");
      expect(JSON.parse(posts(/\/turns$/).at(-1)!.body)).not.toHaveProperty("attachments");
      expect(JSON.parse(posts(/\/turns$/).at(-1)!.response!).turn.context).toBeUndefined();
    });
    expect(errors).toEqual([]);
  } catch (error) { await page.screenshot({ path: evidence + label + "-failure.png" }); throw error; }
};
try { await work(); }
catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); console.error(failure); }
finally {
  clearTimeout(timeout); lifetime.abort();
  try { await browser?.close(); } catch (error) { failure ??= String(error); }
  try { await fixture?.close(); } catch (error) { failure ??= String(error); }
  await writeFile(evidence + label + "-budget.json", JSON.stringify({ startedAt: new Date(began).toISOString(), endedAt: new Date().toISOString(), wallMs: Date.now() - began, priorMs: usedMs, cumulativeMs: usedMs + Date.now() - began }));
  const claim = JSON.parse(await readFile(evidence + (previous.includes("longnames-claim-receipt.json") ? "longnames-claim-receipt.json" : "phase2-claim-receipt.json"), "utf8")).claim;
  const paths: string[] = claim.scopes ?? claim.scope;
  const hashes: Record<string, string> = {};
  for (const path of paths.filter((path: string) => path.startsWith("apps/"))) hashes[path] = createHash("sha256").update(await readFile(root + path)).digest("hex");
  await writeFile(evidence + label + "-browser.json", JSON.stringify({ startedAt: new Date(began).toISOString(), endedAt: new Date().toISOString(), wallMs: Date.now() - began, priorBudgetMs: usedMs, cumulativeBudgetMs: usedMs + Date.now() - began, checks, errors, failure, mode: longNamesOnly ? "long-names-only" : plainOnly ? "plain-only" : "full",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), workingSourceHashes: hashes, wire: fixture?.wire ?? [], providerQueries: 0 }, null, 2));
  const total = async (directory: string): Promise<number> => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async file => file.isDirectory() ? total(directory + "/" + file.name) : (await stat(directory + "/" + file.name)).size))).reduce((a,b) => a+b, 0);
  if (await total(evidence) > 16 * 1024 * 1024) failure ??= "Evidence budget exceeded";
}
if (failure) process.exitCode = 1;
