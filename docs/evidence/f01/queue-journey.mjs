import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Shared browser actions for the synthetic rehearsal and a separately approved live run.
// Hooks belong to the caller; the live caller must never publish a synthetic result.
export async function queueJourney({ webUrl, token, nonce, read, output, evidence, beforeContinue, afterContinue = async () => {}, afterBrowserClose = async () => {}, prepareContext = async () => {} }) {
  let server, browser, page;
  const pane = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
  const queue = () => pane().getByRole('region', { name: 'Conversation queue', exact: true });
  const record = (name, value = {}) => evidence.steps.push({ name, at: new Date().toISOString(), ...value });
  async function open(hash = '') {
    server = await chromium.launchServer({ channel: 'chrome', headless: true });
    const child = server.process(); evidence.browsers.push({ pid: child.pid, openedAt: new Date().toISOString() });
    browser = await chromium.connect(server.wsEndpoint());
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    await prepareContext(context);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    await page.goto(`${webUrl}/${hash}`);
    const tokenInput = page.getByLabel('Owner token', { exact: true });
    if (await tokenInput.isVisible()) { await tokenInput.fill(token); await page.getByRole('button', { name: 'Connect workspace', exact: true }).click(); }
  }
  async function close() {
    if (!server) return;
    const child = server.process(); await browser?.close(); await server.close();
    Object.assign(evidence.browsers.at(-1), { closedAt: new Date().toISOString(), exitCode: child.exitCode, signal: child.signalCode });
    assert.ok(child.exitCode !== null || child.signalCode !== null, 'Dedicated browser process must exit.');
    server = browser = null;
  }
  async function command(name, suffix, click) {
    const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(suffix));
    await click(); const ack = await response; assert.ok(ack.ok(), `${name}: HTTP ${ack.status()}`);
    const receipt = await ack.json(); record(name, { receipt }); return receipt;
  }
  async function expandQueue() {
    await expect(queue()).toBeVisible(); const toggle = queue().locator('button[aria-expanded]').first();
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await expect(queue().getByRole('button', { name: 'Refresh queue', exact: true })).toBeVisible();
  }
  try {
    await open();
    await page.locator('.flow-workspace-bar button[aria-label="New chat"]').click();
    const input = () => pane().getByRole('textbox', { name: 'Message input', exact: true });
    await input().fill(`记住 ${nonce}，现在只回复“已记住”。`);
    await expect(pane().getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await input().press('Enter'); await page.waitForURL(/#conversation=/);
    const conversationId = decodeURIComponent(new URL(page.url()).hash.slice('#conversation='.length));
    evidence.conversationId = conversationId;
    const first = (await read(`/api/conversations/${conversationId}/turns`)).turns[0];
    evidence.firstTaskId = first.task.id;
    await expect.poll(async () => (await read(`/api/tasks/${first.task.id}`)).status).toBe('running');
    record('first-task-running', { taskId: first.task.id });
    await expandQueue();
    const pause = await command('pause-ack', '/queue/pause', () => queue().getByRole('button', { name: 'Pause queue', exact: true }).click());
    assert.equal(pause.paused, true);
    await expect(queue().getByRole('region', { name: 'pause receipt', exact: true })).toContainText('accepted');
    assert.equal((await read(`/api/tasks/${first.task.id}`)).status, 'running', 'First turn must still be running before enqueue.');
    await pane().getByRole('radio', { name: 'Queue next', exact: true }).check();
    const secondText = '只回复刚才记住的标记，不要任何其他文字。'; assert.ok(!secondText.includes(nonce));
    await input().fill(secondText);
    const enqueue = await command('enqueue-ack', '/queue', () => pane().getByRole('button', { name: 'Add to queue', exact: true }).click());
    evidence.queueItemId = enqueue.item.id;
    assert.equal((await read(`/api/tasks/${first.task.id}`)).status, 'running', 'First turn must still be running when enqueue is acknowledged.');
    const pending = await read(`/api/conversations/${conversationId}/queue`);
    assert.equal(pending.paused, true); assert.equal(pending.items.find(i => i.id === enqueue.item.id)?.state, 'waiting');
    record('queued-durably-while-first-running', { queueItemId: enqueue.item.id });
    // Live caller checks known SDK usage/terminal status and total budget before this returns.
    await beforeContinue({ conversationId, firstTaskId: first.task.id, queueItemId: enqueue.item.id });
    await queue().getByRole('button', { name: 'Refresh queue', exact: true }).click();
    await expect(queue().getByRole('button', { name: 'Continue queue', exact: true })).toBeEnabled();
    const resumed = await command('continue-ack', '/queue/resume', () => queue().getByRole('button', { name: 'Continue queue', exact: true }).click());
    assert.equal(resumed.promoted.id, enqueue.item.id);
    await afterContinue({ conversationId, receipt: resumed });
    const secondId = resumed.promoted.promoted.taskId; evidence.secondTaskId = secondId;
    await expect.poll(async () => (await read(`/api/tasks/${secondId}`)).status).toBe('running');
    record('second-task-running-before-browser-exit', { taskId: secondId });
    await close(); record('dedicated-browser-process-exited');
    await afterBrowserClose({ conversationId, secondTaskId: secondId });
    await open(`#conversation=${encodeURIComponent(conversationId)}`);
    const assistant = pane().locator('[data-slot="aui_assistant-message-root"] [data-slot="aui_assistant-message-content"]');
    await expect(assistant).toHaveCount(2, { timeout: 65000 });
    await expect(assistant.nth(1)).toBeVisible(); await expect(assistant.nth(1)).toHaveText(nonce);
    evidence.visibleAssistantTexts = await assistant.allTextContents();
    record('focused-second-assistant-exact-nonce');
    await page.screenshot({ path: `${output}/second-reply-light.png` });
    await page.getByRole('button', { name: 'Use dark theme', exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
    const sidebar = page.getByRole('button', { name: 'Hide chat list', exact: true }); if (await sidebar.isVisible()) await sidebar.click();
    await expect(assistant.nth(1)).toBeVisible(); await expect(assistant.nth(1)).toHaveText(nonce);
    await page.screenshot({ path: `${output}/second-reply-dark-narrow.png` });
    assert.deepEqual(evidence.pageErrors, []); record('narrow-dark-second-assistant-exact-nonce');
    return { conversationId, firstTaskId: first.task.id, secondTaskId: secondId };
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    throw error;
  } finally { await close(); }
}
