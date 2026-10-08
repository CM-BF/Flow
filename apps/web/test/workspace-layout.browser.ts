import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Browser, type BrowserContext, type Page, type Request as BrowserRequest, type Response as BrowserResponse } from "@playwright/test";
import { startWorkspaceLayoutFixture, workspaceReadKind } from "./workspace-layout.fixture";
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
        request.onsuccess = () => { clearTimeout(timer); database.close(); const matches = request.result.filter(value => value.kind === "draft" && value.owner.routeId === routeId); if (matches.length > 1) { reject(Error("Ambiguous route draft observation")); return; } resolve(matches[0] ?? null); };
        request.onerror = () => { clearTimeout(timer); database.close(); reject(request.error); };
      };
    });
  }, route);
  return record ? { ...record, data: readRecoveryDraft(record.data) } : null;
}

/** Passive public request lifecycle; issued does not claim a socket has been acquired. */
function observeBodyRequests(page: Page, origin: string, expected: readonly string[]) {
  const started = performance.now(), errors: string[] = [];
  let phase = "connection";
  type Row = { id: number; kind: "body" | "stream"; method: string; path: string; issuedMs: number; phase: string; status?: number; finishedMs?: number; failedMs?: number };
  const rows: Row[] = [], requests = new Map<BrowserRequest, Row>();
  const events: { sequence: number; elapsedMs: number; phase: string; event: string; path: string; requestId?: number; status?: number }[] = [];
  const error = (message: string) => { if (errors.length < 8) errors.push(message); };
  const event = (name: string, path: string, row?: Row) => {
    if (events.length >= 256) { error("Client read event bound"); return; }
    events.push({ sequence: events.length + 1, elapsedMs: performance.now() - started, phase, event: name, path, requestId: row?.id, status: row?.status });
  };
  const requested = (request: BrowserRequest) => {
    const url = new URL(request.url()); if (url.origin !== origin) return;
    const kind = workspaceReadKind(url.pathname);
    if (!kind) return;
    if (rows.length >= 64) { error("Client read identity bound"); return; }
    if (kind === "body" && (request.method() !== "GET" || !expected.includes(url.pathname) || rows.some(row => row.kind === "body" && row.path === url.pathname))) error("Unexpected or duplicate body request");
    const row: Row = { id: rows.length + 1, kind, method: request.method(), path: url.pathname, issuedMs: performance.now() - started, phase };
    rows.push(row); requests.set(request, row); event("issued", row.path, row);
  };
  const responded = (response: BrowserResponse) => { const row = requests.get(response.request()); if (row) { row.status = response.status(); event("response", row.path, row); } };
  const finished = (request: BrowserRequest) => { const row = requests.get(request); if (row) { row.finishedMs = performance.now() - started; event("finished", row.path, row); } };
  const failed = (request: BrowserRequest) => { const row = requests.get(request); if (row) { row.failedMs = performance.now() - started; event("failed", row.path, row); } };
  page.on("request", requested); page.on("response", responded); page.on("requestfinished", finished); page.on("requestfailed", failed);
  return {
    phase(value: string) { phase = value; }, action(value: string) { event(value, ""); },
    bodies: () => rows.filter(row => row.kind === "body").map(row => ({ ...row })),
    pending: () => rows.filter(row => row.kind === "body" && row.finishedMs === undefined && row.failedMs === undefined).map(row => row.path),
    snapshot: () => ({ semantics: "Page issued/response/body-finished/failed; not socket admission", rows: rows.map(row => ({ ...row })), events: events.map(row => ({ ...row })), errors: [...errors], maxRows: 64, maxEvents: 256 }),
    close() { page.removeListener("request", requested); page.removeListener("response", responded); page.removeListener("requestfinished", finished); page.removeListener("requestfailed", failed); requests.clear(); },
  };
}

/** Invoked only by an admitted owned-Chrome caller. No launch/import side effects. */
export async function checkWorkspaceLayout({ browser, outputDirectory, cacheDirectory, signal }: {
  browser: Browser; outputDirectory: string; cacheDirectory: string; signal: AbortSignal;
}) {
  const result = { startedAt: new Date().toISOString(), selected: ["layout-navigation", "three-pane-reads", "prepare-await-stable", "refresh-theme"],
    passed: [] as string[], screenshots: [] as string[], observations: {} as Record<string, unknown>, error: null as string | null, cleanupErrors: [] as string[],
    cleanup: { contextClosed: false, httpClosed: false } };
  let fixture: Awaited<ReturnType<typeof startWorkspaceLayoutFixture>> | undefined, context: BrowserContext | undefined;
  let bodyObserver: ReturnType<typeof observeBodyRequests> | undefined;
  const abort = () => { void context?.close().catch(error => result.cleanupErrors.push(String(error).slice(0, 256))); };
  try {
    signal.throwIfAborted(); fixture = await startWorkspaceLayoutFixture({ cacheDirectory }); signal.throwIfAborted();
    context = await browser.newContext({ viewport: { width: 1500, height: 960 } }); signal.addEventListener("abort", abort, { once: true });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    const expectedBodies = [1, 2, 3].flatMap(number => [`/api/conversations/chat-${number}/turns/chat-${number}-turn-1/details/chat-${number}-task-1-reply`, `/api/conversations/chat-${number}/queue/chat-${number}-queue`]);
    bodyObserver = observeBodyRequests(page, new URL(fixture.url).origin, expectedBodies);
    const pane = (number: number) => page.locator(`.flow-tab-body[id="panel-conversation:chat-${number}"]`);
    const input = (number: number) => pane(number).getByRole("textbox", { name: "Message input", exact: true });
    const tab = (number: number) => page.getByRole("tab", { name: `Conversation ${number}`, exact: true });
    const chooseChat = (number: number) => page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${number}`, exact: true }).click();
    const run = async (name: string, operation: () => Promise<void>) => { signal.throwIfAborted(); bodyObserver!.phase(name); fixture!.setObservationPhase(name); await operation(); signal.throwIfAborted(); result.passed.push(name); };
    await page.goto(fixture.url + "?recovery=1#conversation=chat-1");
    await expect(page.getByRole("heading", { name: "Connect to Flow", exact: true })).toBeVisible();
    await page.getByLabel("Owner token", { exact: true }).fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(input(1)).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const desktop = await page.screenshot({ fullPage: false }); expect(desktop.length).toBeLessThanOrEqual(512 * 1024);
    const desktopPath = join(outputDirectory, "arc-desktop-ready.png"); await writeFile(desktopPath, desktop);
    result.observations.desktopStage = { stage: "connected-before-layout-actions", path: desktopPath, bytes: desktop.length, viewport: page.viewportSize(), at: new Date().toISOString() };
    await run("layout-navigation", async () => {
      const navigation = page.locator(".flow-arc-workspace-tabs");
      const navigationBox = async () => navigation.evaluate(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        const contentHeight = Math.max(...[...node.children].map(child => child.getBoundingClientRect().height));
        return { top: rect.top, height: rect.height, flexGrow: style.flexGrow,
          naturalHeight: contentHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) };
      });
      const beforePanel = await navigationBox();
      expect(beforePanel.flexGrow).toBe("0"); expect(beforePanel.height).toBeLessThanOrEqual(beforePanel.naturalHeight + 1);
      await page.getByRole("button", { name: "Toggle workspace panel", exact: true }).click();
      const side = page.getByRole("complementary", { name: "Task workspace", exact: true }); await expect(side).toBeVisible();
      const sideTabs = side.getByRole("tablist", { name: "Workspace panels", exact: true });
      await expect(sideTabs).toHaveCSS("flex-grow", "1");
      await side.getByRole("tab", { name: "Terminal", exact: true }).click();
      await expect(side.getByRole("tab", { name: "Terminal", exact: true })).toHaveAttribute("aria-selected", "true");
      const openPanel = await navigationBox(); expect(Math.abs(openPanel.height - beforePanel.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(openPanel.top - beforePanel.top)).toBeLessThanOrEqual(1);
      await side.getByRole("button", { name: "Close workspace", exact: true }).click(); await expect(side).toBeHidden();
      const closedPanel = await navigationBox(); expect(Math.abs(closedPanel.height - beforePanel.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(closedPanel.top - beforePanel.top)).toBeLessThanOrEqual(1);
      result.observations.workspaceNamespace = { beforePanel, openPanel, closedPanel, rightTab: "Terminal", scope: "Arc navigation stays intrinsic; right Workspace panels keeps its own flex rule" };
      await chooseChat(2); await chooseChat(3);
      await tab(1).focus(); await tab(1).press("ArrowRight"); await expect(tab(2)).toBeFocused(); await expect(tab(3)).toHaveAttribute("aria-selected", "true");
      await tab(2).press("Enter"); await expect(tab(2)).toHaveAttribute("aria-selected", "true");
      await chooseChat(7); // Retain a second tab in the focused pane at the three-pane limit.
      await tab(3).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      await tab(2).click(); await page.getByRole("button", { name: "Split chat", exact: true }).click();
      await tab(1).click();
      const focusedTabs = page.locator(".flow-pane-header.focused").getByRole("tab");
      await expect(focusedTabs).toHaveCount(2);
      await expect(tab(1)).toHaveAttribute("aria-selected", "true"); await expect(tab(7)).toHaveAttribute("aria-selected", "false");
      await expect(page.getByRole("button", { name: "Split chat", exact: true })).toBeDisabled();
      await expect(page.locator(".flow-pane-header")).toHaveCount(3);
      await expect(page.locator(".flow-tab-body:not([hidden])")).toHaveCount(3); await expect(pane(7)).toBeHidden();
      await tab(7).press("Delete"); await expect(tab(7)).toHaveCount(0); await tab(1).click();
      await expect(page.locator(".flow-pane-header").getByRole("tab")).toHaveCount(3);
      for (const number of [1, 2, 3]) await expect(tab(number)).toHaveAttribute("aria-selected", "true");
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
      expect(detailReads()).toHaveLength(0); expect(bodyObserver!.bodies()).toHaveLength(0);
      // Prepare public controls before holding bodies; index/stream requests remain normal.
      for (const number of [1, 2, 3]) {
        await expect(pane(number).getByRole("button", { name: "Read full reply", exact: true })).toBeVisible();
        const queue = pane(number).getByRole("region", { name: "Conversation queue", exact: true });
        await queue.getByRole("button", { name: /waiting loaded/ }).click();
        await expect(queue.getByRole("button", { name: "Read full message", exact: true })).toBeVisible();
      }
      fixture!.holdBodyReads(expectedBodies);
      for (const number of [1, 2, 3]) {
        bodyObserver!.action(`reply-${number}-begin`);
        await pane(number).getByRole("button", { name: "Read full reply", exact: true }).click();
        bodyObserver!.action(`reply-${number}-end`);
        bodyObserver!.action(`queue-${number}-begin`);
        await pane(number).getByRole("region", { name: "Conversation queue", exact: true }).getByRole("button", { name: "Read full message", exact: true }).click();
        bodyObserver!.action(`queue-${number}-end`);
      }
      await expect.poll(() => bodyObserver!.pending().sort()).toEqual([...expectedBodies].sort());
      for (const number of [1, 2, 3]) {
        await expect(pane(number).getByRole("status").filter({ hasText: /^Loading full reply…$/ })).toBeVisible();
        await expect(pane(number).getByRole("status").filter({ hasText: /^Loading message…$/ })).toBeVisible();
      }
      expect(bodyObserver!.pending().sort()).toEqual([...expectedBodies].sort());
      const logicalPending = bodyObserver!.bodies(); expect(logicalPending).toHaveLength(6);
      result.observations.bodyAdmission = { logicalPending, client: bodyObserver!.snapshot(), server: fixture!.bodyMetrics() };
      // HTTP/1/SSE can use the other sockets. Drain whichever real response is available,
      // then let transport admit the next request; never wait for six server arrivals.
      for (let released = 0; released < 6; released++) {
        await expect.poll(() => fixture!.heldBodyPaths().length).toBeGreaterThan(0);
        const path = fixture!.releaseNextBody();
        await expect.poll(() => bodyObserver!.bodies().some(row => row.path === path && row.finishedMs !== undefined)).toBe(true);
      }
      await expect.poll(() => fixture!.bodyMetrics().bodyInFlight).toBe(0); fixture!.finishBodyReads();
      expect(fixture!.bodyMetrics().bodyPeak).toBeLessThanOrEqual(6);
      expect(detailReads().map(row => row.path).sort()).toEqual([...expectedBodies].sort());
      for (const row of bodyObserver!.bodies()) { expect(row.status).toBe(200); expect(row.finishedMs).toBeDefined(); expect(row.failedMs).toBeUndefined(); }
      expect(bodyObserver!.snapshot().errors).toEqual([]);
      for (const number of [1, 2, 3]) {
        await expect.poll(() => pane(number).locator(".flow-reply-detail pre").textContent()).toBe("A thoughtful reply with a longer explanation.\n".repeat(130));
        await expect(pane(number).getByRole("region", { name: "Conversation queue", exact: true }).locator("pre")).toHaveText(`Waiting chat-${number} ` + "body ".repeat(240));
      }
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
      const paused = fixture!.stream.reads.length, bodies = detailReads().length, issuedBodies = bodyObserver!.bodies().length;
      fixture!.streamTasks.forEach(task => fixture!.stream.append(task, " hidden update"));
      await expect(page.locator(".flow-tab-body:not([hidden])")).toHaveCount(0);
      await page.getByRole("tab", { name: "Workspace 1", exact: true }).focus();
      // A bounded browser event turn witnesses that merely focusing a manual tab does not reactivate it.
      await page.keyboard.press("ArrowRight"); await expect(page.getByRole("tab", { name: "Workspace 2", exact: true })).toBeFocused();
      expect(fixture!.stream.reads).toHaveLength(paused); expect(detailReads()).toHaveLength(bodies); expect(bodyObserver!.bodies()).toHaveLength(issuedBodies);
      result.observations.bodyReads = { ...fixture!.bodyMetrics(), count: bodies, limit: 6, semantics: "six browser-issued and UI-loading logical body reads; server socket concurrency recorded separately" };
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
      try { await expect(pane(4).getByRole("button", { name: "Send message", exact: true })).toBeEnabled(); }
      catch (error) {
        try { result.observations.materialReadiness = { paneText: (await pane(4).innerText({ timeout: 1000 })).slice(-4096),
          lastTaskStatus: fixture!.fixture.chats.get("chat-4")!.snapshot.lastTurn?.task.status }; }
        catch (diagnostic) { result.observations.materialReadiness = { observationError: String(diagnostic).slice(0, 256) }; }
        throw error;
      }
      await probe("arm"); await input(4).press("Enter"); await expect.poll(async () => (await probe("snapshot")).pending).toBe(true);
      await settings("arc-B"); await input(4).fill("Independent B while A prepares"); await upload("arc-next.txt");
      const nextFile = (await probe("snapshot")).ready.find((item: { name: string }) => item.name === "arc-next.txt");
      expect(nextFile).toBeTruthy();
      const expectNextDraft = async () => {
        await expect(input(4)).toHaveValue("Independent B while A prepares");
        await expect(pane(4).locator(".ep-settings-summary").filter({ hasText: "下一条消息设置" })).toContainText("arc-B");
        const nextAttachment = pane(4).locator(".aui-composer-root").getByRole("button", { name: "File attachment", exact: true });
        await expect(nextAttachment).toHaveCount(1);
        await input(4).focus(); await page.keyboard.press("Shift+Tab");
        await expect(pane(4).locator(".aui-composer-root").getByRole("button", { name: "Remove file", exact: true })).toBeFocused();
        await page.keyboard.press("Shift+Tab"); await expect(nextAttachment).toBeFocused();
        const filename = page.getByRole("tooltip", { name: "arc-next.txt", exact: true });
        await expect(filename).toBeVisible(); await input(4).focus(); await expect(filename).not.toBeVisible();
        expect((await probe("snapshot")).ready.find((item: { name: string }) => item.name === "arc-next.txt")).toEqual(nextFile);
      };
      // While A prepares, Recovery deliberately retains A and defers B in-page.
      // B becomes durable only after the original command handoff below.
      await expectNextDraft();
      const writes = fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns").length;
      await page.getByRole("button", { name: "Move pane 1 right", exact: true }).click();
      await page.getByRole("slider", { name: "Resize panes 1 and 2", exact: true }).fill("65");
      await tab(4).click(); await page.getByRole("button", { name: "Merge tabs", exact: true }).click();
      await expect(page.locator(".flow-pane-header")).toHaveCount(1);
      await expect(page.locator(".flow-tab-body:not([hidden])")).toHaveCount(1);
      await expect(page.locator('.flow-pane-header [role="tab"][aria-selected="true"]')).toHaveAttribute("id", "tab-conversation:chat-4");
      await expect(input(4)).toBeVisible(); await expectNextDraft();
      await page.getByRole("button", { name: "Split chat", exact: true }).click();
      expect(await input(4).evaluate((node, original) => node === original, originalInput!)).toBe(true);
      expect((await probe("snapshot")).rows[0]).toMatchObject({ validated: true, aborted: false, returned: false });
      await expectNextDraft();
      expect(fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")).toHaveLength(writes);
      await probe("settle"); await expect.poll(() => fixture!.fixture.requests.filter(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns").length).toBe(writes + 1);
      const sent = fixture!.fixture.requests.findLast(row => row.method === "POST" && row.path === "/api/conversations/chat-4/turns")!;
      const request = JSON.parse(sent.body!), observed = await probe("snapshot");
      expect(request.text).toBe("Frozen A through actual material preparation"); expect(request.messageSettings.requested.model).toBe("arc-A");
      expect(request.attachments).toEqual(observed.ready.slice(0, 2).map((item: { reference: unknown }) => item.reference)); expect(sent.key).toBeTruthy();
      await expectNextDraft();
      await expect.poll(async () => {
        const draft = (await draftRecord(page, "conversation:chat-4"))?.data;
        return draft && { model: draft.messageSettings?.requested.model, text: draft.text,
          files: draft.attachments.map(item => ({ id: item.id, name: item.name, reference: item.metadata?.reference })) };
      }).toEqual({ model: "arc-B", text: "Independent B while A prepares",
        files: [{ id: nextFile.id, name: nextFile.name, reference: nextFile.reference }] });
      const saved = (await draftRecord(page, "conversation:chat-4"))!;
      await expect(pane(4).locator(".ep-settings-summary").filter({ hasText: "下一条消息设置" })).toContainText("arc-B");
      result.observations.material = { key: sent.key, frozen: request, nextDraft: saved.data, probe: observed };
    });
    await run("refresh-theme", async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      const closeFromPlugin = async () => {
        const owner = page.locator('.flow-tab').filter({ has: tab(4) });
        await owner.getByRole("button", { name: "More actions", exact: true }).click();
        await owner.getByRole("menuitem", { name: "Close this chat", exact: true }).click();
        return page.getByRole("dialog", { name: "Leave attachment drafts?", exact: true });
      };
      const retained = (await draftRecord(page, "conversation:chat-4"))!.data;
      await expect(await closeFromPlugin()).toBeVisible();
      await page.getByRole("button", { name: "Keep this page", exact: true }).click();
      await expect(input(4)).toHaveValue("Independent B while A prepares");
      await expect(await closeFromPlugin()).toBeVisible();
      await page.getByRole("button", { name: "Leave view and retain saved records", exact: true }).click();
      await expect(tab(4)).toHaveCount(0);
      expect((await draftRecord(page, "conversation:chat-4"))!.data).toEqual(retained);
      await chooseChat(4); await expect(input(4)).toHaveValue("Independent B while A prepares");
      result.observations.protectedClose = "Public plugin close: cancel kept view; fresh confirmed close retained complete saved B; reopen kept text. Revoked confirmations are tested separately through actual host/port.";
      const workspace2 = page.getByRole("tab", { name: "Workspace 2", exact: true });
      await page.getByRole("tab", { name: "Workspace 1", exact: true }).click(); await workspace2.focus(); await workspace2.press("Space"); await expect(workspace2).toHaveAttribute("aria-selected", "true");
      // Empty workspace close has a deterministic adjacent focus, no nested button or reordered draft owner.
      await page.getByRole("button", { name: "New workspace", exact: true }).click(); await page.getByRole("button", { name: "Close Workspace 3", exact: true }).click();
      await expect(workspace2).toBeFocused();
      const motion = await page.locator('.flow-tab-body:not([hidden]), .flow-tab, [role="separator"]').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { animationName: style.animationName, animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
      }));
      expect(motion.length).toBeGreaterThan(0);
      for (const style of motion) {
        expect(style.animationName === "none" || style.animationDuration.split(",").every(value => parseFloat(value) === 0)).toBe(true);
        expect(style.transitionDuration.split(",").every(value => parseFloat(value) === 0)).toBe(true);
      }
      result.observations.reducedMotion = { preference: "reduce", layoutStyles: motion, scope: "Visible panes, tabs and separators; protected-close and workspace keyboard actions above ran with reduced motion." };
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
    expect(fixture.errors).toEqual([]); expect(bodyObserver!.snapshot().errors).toEqual([]); expect(result.passed).toEqual(result.selected);
  } catch (error) { result.error = error instanceof Error ? error.stack ?? error.message : String(error); }
  finally {
    signal.removeEventListener("abort", abort); bodyObserver?.phase("cleanup"); fixture?.setObservationPhase("cleanup");
    const closed = await Promise.allSettled([context?.close(), fixture?.close()]);
    result.cleanup.contextClosed = Boolean(context) && closed[0]!.status === "fulfilled";
    result.cleanup.httpClosed = Boolean(fixture) && closed[1]!.status === "fulfilled";
    for (const item of closed) if (item.status === "rejected") result.cleanupErrors.push(String(item.reason).slice(0, 256));
    if (fixture) result.observations.http = { reads: fixture.reads, errors: fixture.errors, body: fixture.bodyMetrics(), bodyEvents: fixture.bodyEvents, ports: fixture.ports };
    if (bodyObserver) { result.observations.clientReads = bodyObserver.snapshot(); bodyObserver.close(); }
    await writeFile(join(outputDirectory, "arc-browser.json"), JSON.stringify(result, null, 2));
  }
  if (result.error || result.cleanupErrors.length) throw Error(result.error ?? result.cleanupErrors.join("; "));
  return result;
}
