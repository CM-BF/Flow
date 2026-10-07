import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { startWorkspaceLayoutFixture } from "./workspace-layout.fixture";
import type { DraftRecord } from "../src/recovery/journal";
import { readRecoveryDraft } from "../src/recovery/binding";

async function draftRecord(page: Page, route: string) {
  const record = await page.evaluate(async routeId => {
    const names = await indexedDB.databases();
    if (!names.some(item => item.name === "flow.conversation-recovery.v1")) return null;
    return new Promise<DraftRecord | null>((resolve, reject) => {
      const open = indexedDB.open("flow.conversation-recovery.v1", 1);
      let expired = false;
      const timer = setTimeout(() => { expired = true; reject(Error("Readonly draft observation deadline")); }, 1500);
      open.onerror = () => { clearTimeout(timer); reject(open.error); };
      open.onupgradeneeded = () => { open.transaction?.abort(); };
      open.onsuccess = () => {
        if (expired) { open.result.close(); return; }
        const database = open.result, tx = database.transaction("records", "readonly"), request = tx.objectStore("records").getAll();
        request.onsuccess = () => { clearTimeout(timer); database.close(); resolve(request.result.find(value => value.kind === "draft" && value.owner.routeId === routeId) ?? null); };
        request.onerror = () => { clearTimeout(timer); database.close(); reject(request.error); };
      };
    });
  }, route);
  return record ? { ...record, data: readRecoveryDraft(record.data) } : null;
}

/** Invoked only by an admitted owned-Chrome caller. No launch/import side effects. */
export async function checkWorkspaceLayout({ browser, outputDirectory, cacheDirectory, signal }: {
  browser: Browser; outputDirectory: string; cacheDirectory: string; signal: AbortSignal;
}) {
  const result = { startedAt: new Date().toISOString(), selected: ["layout-navigation", "three-pane-reads", "prepare-await-stable", "refresh-theme"],
    passed: [] as string[], screenshots: [] as string[], observations: {} as Record<string, unknown>, error: null as string | null, cleanupErrors: [] as string[] };
  let fixture: Awaited<ReturnType<typeof startWorkspaceLayoutFixture>> | undefined, context: BrowserContext | undefined;
  const abort = () => { void context?.close().catch(error => result.cleanupErrors.push(String(error).slice(0, 256))); };
  try {
    signal.throwIfAborted(); fixture = await startWorkspaceLayoutFixture({ cacheDirectory }); signal.throwIfAborted();
    context = await browser.newContext({ viewport: { width: 1500, height: 960 } }); signal.addEventListener("abort", abort, { once: true });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    const pane = (number: number) => page.locator(`.flow-tab-body[id="panel-conversation:chat-${number}"]`);
    const input = (number: number) => pane(number).getByRole("textbox", { name: "Message input", exact: true });
    const tab = (number: number) => page.getByRole("tab", { name: `Conversation ${number}`, exact: true });
    const chooseChat = (number: number) => page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${number}`, exact: true }).click();
    const run = async (name: string, operation: () => Promise<void>) => { signal.throwIfAborted(); await operation(); signal.throwIfAborted(); result.passed.push(name); };
    await page.goto(fixture.url + "#conversation=chat-1");
    await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(input(1)).toBeVisible();
    await run("layout-navigation", async () => {
      await chooseChat(2); await chooseChat(3);
      await tab(1).focus(); await tab(1).press("ArrowRight"); await expect(tab(2)).toBeFocused(); await expect(tab(3)).toHaveAttribute("aria-selected", "true");
      await tab(2).press("Enter"); await expect(tab(2)).toHaveAttribute("aria-selected", "true");
      await tab(3).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      await tab(2).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      await expect(page.locator(".flow-tab-body:not([hidden])")).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Split chat", exact: true })).toBeDisabled();
      for (const number of [1, 2, 3]) await input(number).fill(`Independent draft ${number}`);
      const handles = await Promise.all([1, 2, 3].map(number => input(number).elementHandle()));
      await page.getByRole("button", { name: "Move pane 3 left", exact: true }).click();
      for (let index = 0; index < 3; index++) expect(await input(index + 1).evaluate((node, original) => node === original, handles[index]!)).toBe(true);
      const ratio = page.getByRole("slider", { name: "Resize panes 1 and 2", exact: true });
      await ratio.focus(); await ratio.press("Home"); await expect(ratio).toHaveValue("15"); await ratio.press("End"); await expect(ratio).toHaveValue("85");
      await ratio.fill("50"); await expect(ratio).toHaveValue("50");
      for (const number of [1, 2, 3]) await expect(input(number)).toHaveValue(`Independent draft ${number}`);
      expect(await page.locator('button button').count()).toBe(0);
      result.observations.maxVisible = 3;
    });
    await run("three-pane-reads", async () => {
      await expect.poll(() => fixture!.streamTasks.every(task => fixture!.stream.reads.filter(row => row.taskId === task && row.kind === "patches").length >= 11)).toBe(true);
      expect(fixture!.stream.peak).toBeLessThanOrEqual(2);
      const detailReads = () => fixture!.reads.filter(row => row.bodyRead);
      expect(detailReads()).toHaveLength(0); fixture!.delayBodies(1200);
      for (const number of [1, 2, 3]) {
        const target = pane(number).locator('[data-slot="aui_assistant-message-root"]').filter({ hasText: "This reply is shortened." });
        await expect(target).toHaveCount(1); await target.getByRole("button", { name: "Read full reply", exact: true }).click();
        const queue = pane(number).getByRole("region", { name: "Conversation queue", exact: true });
        await queue.getByRole("button", { name: /waiting loaded/ }).click();
        await queue.getByRole("button", { name: "Read full message", exact: true }).click();
      }
      await expect.poll(() => fixture!.bodyMetrics().bodyPeak).toBe(6);
      await expect.poll(() => fixture!.bodyMetrics().bodyInFlight).toBe(0); expect(detailReads()).toHaveLength(6);
      fixture!.delayBodies(0);
      const viewport = pane(1).locator('[data-slot="aui_thread-viewport"]'), anchor = pane(1).getByText("long reply 1", { exact: true });
      await anchor.scrollIntoViewIfNeeded();
      const before = await viewport.evaluate((node, anchor) => {
        if (!anchor) throw Error("Missing transcript anchor"); const target = anchor as HTMLElement;
        node.scrollTop += target.getBoundingClientRect().top - node.getBoundingClientRect().top - node.clientHeight / 3;
        return { overflow: node.scrollHeight - node.clientHeight, anchor: target.textContent };
      }, await anchor.elementHandle());
      expect(before.overflow).toBeGreaterThan(400);
      await input(2).focus(); fixture!.stream.append(fixture!.streamTasks[1]!, " another pane update");
      await expect.poll(() => fixture!.stream.reads.some(row => row.taskId === fixture!.streamTasks[1] && row.kind === "patches" && row.after >= 243)).toBe(true);
      await expect(input(2)).toBeFocused();
      await page.getByRole("slider", { name: "Resize panes 1 and 2", exact: true }).fill("60");
      expect(await anchor.evaluate(node => node.textContent)).toBe(before.anchor);
      const position = await anchor.evaluate(node => { const viewport = node.closest('[data-slot="aui_thread-viewport"]')!; return { top: node.getBoundingClientRect().top - viewport.getBoundingClientRect().top, height: viewport.clientHeight }; });
      expect(position.top).toBeGreaterThanOrEqual(-40); expect(position.top).toBeLessThan(position.height);
      await page.getByRole("button", { name: "New workspace", exact: true }).click();
      const paused = fixture!.stream.reads.length, bodies = detailReads().length;
      fixture!.streamTasks.forEach(task => fixture!.stream.append(task, " hidden update"));
      await expect(page.locator(".flow-tab-body:not([hidden])")).toHaveCount(0);
      await page.getByRole("tab", { name: "Workspace 1", exact: true }).focus();
      // A bounded browser event turn witnesses that merely focusing a manual tab does not reactivate it.
      await page.keyboard.press("ArrowRight"); await expect(page.getByRole("tab", { name: "Workspace 2", exact: true })).toBeFocused();
      expect(fixture!.stream.reads).toHaveLength(paused); expect(detailReads()).toHaveLength(bodies);
      result.observations.bodyReads = { ...fixture!.bodyMetrics(), count: bodies, limit: 6, semantics: "explicit body flights, not all HTTP" };
      result.observations.streamReads = fixture!.stream.reads.map(row => ({ ...row }));
    });
    await run("prepare-await-stable", async () => {
      for (const number of [4, 5, 6]) await chooseChat(number);
      await page.getByRole("button", { name: "Split chat", exact: true }).click(); await tab(5).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      const originalInput = await input(4).elementHandle();
      const settings = async (model: string) => {
        const action = pane(4).getByRole("button", { name: "消息设置", exact: true }); await action.click();
        const dialog = page.getByRole("dialog", { name: "下一条消息设置", exact: true });
        await dialog.locator(".ep-option").filter({ hasText: model }).getByRole("radio").check(); await dialog.getByRole("button", { name: "应用", exact: true }).click();
        await expect(dialog).not.toBeVisible(); await expect(action).toBeFocused();
      };
      const probe = (operation: "arm" | "snapshot" | "settle") => page.evaluate(async operation => {
        const path = "/@id/__x00__virtual:arc-material-probe";
        const module = await import(/* @vite-ignore */ path);
        if (operation !== "snapshot") module[operation](); return module.snapshot();
      }, operation);
      const upload = async (name: string) => {
        const add = pane(4).getByRole("button", { name: "Add Attachment", exact: true }); await expect(add).toBeEnabled();
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), add.click()]); await chooser.setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(`Arc ${name}`) });
        await expect.poll(async () => (await probe("snapshot")).ready.some((row: { name: string }) => row.name === name)).toBe(true);
      };
      const files = pane(4).getByRole("button", { name: "Files", exact: true }); await files.click();
      const picker = page.getByRole("dialog", { name: "Project text files", exact: true }); await expect(picker).toBeVisible(); await page.keyboard.press("Escape"); await expect(picker).not.toBeVisible(); await expect(files).toBeFocused();
      await settings("arc-A"); await input(4).fill("Frozen A through actual material preparation"); await upload("arc-one.txt"); await upload("arc-two.txt");
      await expect(pane(4).getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
      await probe("arm"); await input(4).press("Enter"); await expect.poll(async () => (await probe("snapshot")).pending).toBe(true);
      await settings("arc-B"); await input(4).fill("Independent B while A prepares"); await upload("arc-next.txt");
      await expect.poll(async () => (await draftRecord(page, "conversation:chat-4"))?.data?.messageSettings?.requested?.model).toBe("arc-B");
      const saved = (await draftRecord(page, "conversation:chat-4"))!; expect(saved.data.attachments.map((item: { name: string }) => item.name)).toEqual(["arc-next.txt"]);
      const writes = fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns").length;
      await page.getByRole("button", { name: "Move pane 1 right", exact: true }).click();
      await page.getByRole("slider", { name: "Resize panes 1 and 2", exact: true }).fill("65");
      await tab(4).click(); await page.getByRole("button", { name: "Merge tabs", exact: true }).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      expect(await input(4).evaluate((node, original) => node === original, originalInput!)).toBe(true);
      expect((await probe("snapshot")).rows[0]).toMatchObject({ validated: true, aborted: false, returned: false });
      await expect(input(4)).toHaveValue("Independent B while A prepares");
      expect(fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")).toHaveLength(writes);
      await probe("settle"); await expect.poll(() => fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns").length).toBe(writes + 1);
      const sent = fixture!.fixture.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")!;
      const request = JSON.parse(sent.body!), observed = await probe("snapshot");
      expect(request.text).toBe("Frozen A through actual material preparation"); expect(request.messageSettings.requested.model).toBe("arc-A");
      expect(request.attachments).toEqual(observed.ready.slice(0, 2).map((item: { reference: unknown }) => item.reference)); expect(sent.key).toBeTruthy();
      await expect(input(4)).toHaveValue("Independent B while A prepares");
      await expect.poll(async () => (await draftRecord(page, "conversation:chat-4"))?.data?.attachments).toEqual(saved.data.attachments);
      await expect(pane(4).locator(".ep-settings-summary").filter({ hasText: "下一条消息设置" })).toContainText("arc-B");
      result.observations.material = { key: sent.key, frozen: request, nextDraft: saved.data, probe: observed };
    });
    await run("refresh-theme", async () => {
      const workspace2 = page.getByRole("tab", { name: "Workspace 2", exact: true });
      await page.getByRole("tab", { name: "Workspace 1", exact: true }).click(); await workspace2.focus(); await workspace2.press("Space"); await expect(workspace2).toHaveAttribute("aria-selected", "true");
      // Empty workspace close has a deterministic adjacent focus, no nested button or reordered draft owner.
      await page.getByRole("button", { name: "New workspace", exact: true }).click(); await page.getByRole("button", { name: "Close Workspace 3", exact: true }).click();
      await expect(workspace2).toBeFocused();
      await page.setViewportSize({ width: 390, height: 844 });
      for (const scheme of ["light", "dark"] as const) {
        const current = await page.locator("html").getAttribute("data-theme"); if (current !== scheme) await page.getByRole("button", { name: `Use ${scheme} theme`, exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
        const bytes = await page.screenshot({ fullPage: false }); expect(bytes.length).toBeLessThanOrEqual(512 * 1024);
        const path = join(outputDirectory, `arc-${scheme}-390.png`); await writeFile(path, bytes); result.screenshots.push(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
      const before = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("flow.workspace-layout.v1:")));
      expect(before).toHaveLength(1); const publicLayout = JSON.parse(before[0]![1]);
      expect(JSON.stringify(publicLayout)).not.toContain("Independent B");
      const writes = fixture!.fixture.requests.filter(row => row.method === "POST").length;
      await page.reload(); await expect(page.getByRole("tab", { name: "Workspace 2", exact: true })).toHaveAttribute("aria-selected", "true");
      expect(fixture!.fixture.requests.filter(row => row.method === "POST")).toHaveLength(writes);
      expect(await draftRecord(page, "conversation:chat-4")).not.toBeNull();
      result.observations.persistedLayout = publicLayout;
    });
    expect(fixture.errors).toEqual([]); expect(result.passed).toEqual(result.selected);
  } catch (error) { result.error = error instanceof Error ? error.stack ?? error.message : String(error); }
  finally {
    signal.removeEventListener("abort", abort);
    const closed = await Promise.allSettled([context?.close(), fixture?.close()]);
    for (const item of closed) if (item.status === "rejected") result.cleanupErrors.push(String(item.reason).slice(0, 256));
    if (fixture) result.observations.http = { reads: fixture.reads, errors: fixture.errors, body: fixture.bodyMetrics(), ports: fixture.ports };
    await writeFile(join(outputDirectory, "arc-browser.json"), JSON.stringify(result, null, 2));
  }
  if (result.error || result.cleanupErrors.length) throw Error(result.error ?? result.cleanupErrors.join("; "));
  return result;
}
