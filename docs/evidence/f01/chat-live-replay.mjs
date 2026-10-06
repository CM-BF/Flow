// Zero-model UI evidence using saved real turn payloads. This is NOT the live run.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
const root = '/Users/citrine/Projects/AgentHarness/Flow';
const output = path.resolve('docs/evidence/f01/chat-live');
const inputNames = ['turn-1.json', 'turn-2.json'];
const texts = await Promise.all(inputNames.map(name => readFile(path.join(output, name), 'utf8')));
const inputs = texts.map(text => JSON.parse(text));
const { startConversationPreview } = await import(pathToFileURL(path.join(root, 'apps/web/test/conversation.fixture.ts')).href);
const preview = await startConversationPreview();
const fixture = preview.fixture;
const template = structuredClone(fixture.chats.get('chat-1').snapshot);
fixture.chats.clear();
const conversationId = inputs[0].turn.conversationId;
const turns = inputs.map(value => structuredClone(value.turn));
const final = structuredClone(turns[1]);
turns[1].assistant = { state: 'pending', reason: 'execution-pending' };
turns[1].task.status = 'running';
const snapshot = { ...template, conversation: { ...template.conversation, id: conversationId, title: 'Recorded real reply replay — zero model', revision: 2 }, lastTurn: turns[1], nativeSession: null };
fixture.chats.set(conversationId, { snapshot, turns });
for (const input of inputs) {
  fixture.tasks.set(input.task.id, structuredClone(input.task));
  for (const detail of input.details) fixture.details.set(detail.id, structuredClone(detail));
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const result = { kind: 'recorded-response replay', sourceMain: 'dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8', modelCalls: 0, liveRunRepeated: false, inputFiles: inputNames.map((name, i) => ({ name, sha256: createHash('sha256').update(texts[i]).digest('hex') })), checks: [] };
try {
  await page.goto(`${preview.url}/#conversation=${conversationId}`);
  const pane = page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
  const assistant = pane.locator('[data-slot="aui_assistant-message-root"] [data-slot="aui_assistant-message-content"]');
  await expect(assistant.first()).toHaveText(inputs[0].turn.assistant.text);
  await expect(pane.getByText('Reply pending. You can keep writing below.', { exact: true })).toBeVisible();
  result.checks.push({ name: 'Saved first final plus second pending rendered before transition', passed: true, at: new Date().toISOString() });
  Object.assign(turns[1], final); snapshot.lastTurn = turns[1];
  result.finalPublishedAt = new Date().toISOString();
  await expect(assistant).toHaveCount(2);
  await expect(assistant.nth(1)).toBeVisible();
  await expect(assistant.nth(1)).toHaveText(inputs[1].turn.assistant.text, { timeout: 12000 });
  await expect(pane.getByText('Reply pending. You can keep writing below.', { exact: true })).not.toBeVisible();
  result.visibleAssistantTexts = await assistant.allTextContents();
  result.checks.push({ name: 'Focused visible second assistant content equals saved exact nonce after poll', passed: true, at: new Date().toISOString() });
  await page.screenshot({ path: path.join(output, 'replay-two-rounds-light.png') });
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(assistant.nth(1)).toHaveText(inputs[1].turn.assistant.text);
  await expect(assistant.nth(1)).toBeVisible();
  await page.screenshot({ path: path.join(output, 'replay-two-rounds-dark-narrow.png') });
  expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(0);
  expect(pageErrors).toEqual([]);
  result.checks.push({ name: 'Narrow dark visible nonce; zero POST or model query; no page errors', passed: true, at: new Date().toISOString() });
  result.status = 'PASSED_REPLAY_ONLY';
} catch (error) {
  result.status = 'FAILED_REPLAY'; result.error = String(error.message); process.exitCode = 1;
} finally {
  await browser.close(); await preview.close();
  result.closedAt = new Date().toISOString(); result.pageErrors = pageErrors;
  await writeFile(path.join(output, 'replay-checks.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
