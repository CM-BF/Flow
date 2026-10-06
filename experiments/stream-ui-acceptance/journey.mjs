import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { recordGrowth, promptFor } from './evidence.mjs';

// The same actions serve synthetic rehearsal and a separately permitted one-query caller.
// The caller must reserve its budget and install a one-create/one-turn mutation guard first.
export async function streamJourney({ webUrl, token, nonce, read, output, evidence, prepareContext, checkpoint, afterAcceptance = async () => {}, afterSample = async () => {}, sourceRoot, dependencyRoot, profile, observationMs = 15000 }) {
  const require = createRequire(`${dependencyRoot}/package.json`);
  const { chromium, expect } = require("@playwright/test");
  const { readStreamMetadata, validateMetadataPartition, emptyPatchState, applyPatchPage } = await import(pathToFileURL(`${sourceRoot}/apps/web/src/conversation-stream/patches.ts`));
  const { readCanonicalFinal, streamMessageId } = await import(pathToFileURL(`${sourceRoot}/apps/web/src/conversation-stream/messages.ts`));
  let server, browser, page, responses = Promise.resolve(), responseFailure;
  const pane = () => page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
  const content = '[data-slot="aui_assistant-message-content"]';
  const root = '[data-slot="aui_assistant-message-root"]';
  const draftText = `Unsent draft ${nonce}`;
  const save = async (name, value = {}) => { evidence.steps.push({ name, at: new Date().toISOString(), ...value }); await checkpoint(); };
  const draftSamples = new Map();
  try {
    server = await chromium.launchServer({ channel: 'chrome', headless: true });
    evidence.browser = { pid: server.process().pid, openedAt: new Date().toISOString() };
    browser = await chromium.connect(server.wsEndpoint());
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    await prepareContext(context);
    page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => { evidence.pageErrors.push(error.message); });
    page.on('response', response => {
      const request = response.request(), path = new URL(response.url()).pathname;
      if (request.method() !== 'GET' || !response.ok() || !evidence.conversationId) return;
      if (path !== `/api/conversations/${evidence.conversationId}` && path !== `/api/conversations/${evidence.conversationId}/turns`
        && path !== `/api/tasks/${evidence.taskId}/assistant-stream` && path !== `/api/tasks/${evidence.taskId}/assistant-stream/patches`) return;
      responses = responses.then(async () => {
        const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 1_200_000, 'Whitelisted response exceeds evidence limit.');
        const value = JSON.parse(text), at = new Date().toISOString();
        if (path.endsWith('/turns')) {
          evidence.observedTurns = value.turns.filter(turn => turn.task.id === evidence.taskId).map(turn => ({ id: turn.id, task: turn.task, assistant: turn.assistant }));
        } else if (path.endsWith('/assistant-stream') || path.endsWith('/patches')) {
          assert.equal(value.taskId, evidence.taskId);
          evidence.network.push({ at, path, query: new URL(response.url()).search, value });
        } else evidence.negotiation = { at, protocol: request.headers()['x-flow-assistant-stream'] ?? null, liveAssistantText: value.capabilities?.liveAssistantText };
        assert.ok(evidence.network.length <= 256, 'Bounded network observation exceeded.');
      }).catch(error => { responseFailure ??= error; });
    });
    await page.goto(webUrl);
    const tokenInput = page.getByLabel('Owner token', { exact: true });
    if (await tokenInput.isVisible()) { await tokenInput.fill(token); await page.getByRole('button', { name: 'Connect workspace', exact: true }).click(); }
    await page.getByRole('button', { name: 'Extensions and appearance', exact: true }).click();
    const extension = page.locator('li').filter({ hasText: 'flow.assistant-stream' });
    await expect(extension).toHaveCount(1);
    const enable = extension.getByRole('button', { name: 'Enable flow.assistant-stream', exact: true });
    if (await enable.isVisible()) await enable.click();
    await page.keyboard.press('Escape');
    await page.locator('.flow-workspace-bar button[aria-label="New chat"]').click();
    await expect(pane()).toHaveCount(1); await expect(pane()).toBeVisible();
    assert.ok(profile?.reference?.id && profile.configuration.access === 'none', 'A fixed no-tools profile is required.');
    await pane().getByRole('button', { name: 'Execution profile: Runner default', exact: true }).click();
    const profileRow = page.locator('.ep-option').filter({ has: page.getByText(`Profile ${profile.reference.id}`, { exact: true }) });
    await expect(profileRow).toHaveCount(1); await profileRow.getByRole('radio').check();
    await page.keyboard.press('Escape');
    await expect(pane().getByRole('button', { name: `Execution profile: ${profile.configuration.model}`, exact: true })).toBeVisible();
    const input = () => pane().getByRole('textbox', { name: 'Message input', exact: true });
    const prompt = promptFor(nonce);
    await input().fill(prompt);
    await expect(pane().getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await save('before-only-send');
    await input().press('Enter'); await page.waitForURL(/#conversation=/);
    evidence.conversationId = decodeURIComponent(new URL(page.url()).hash.slice('#conversation='.length));
    let turn;
    await expect.poll(async () => { turn = (await read(`/api/conversations/${evidence.conversationId}/turns`)).turns[0]; return Boolean(turn); }).toBe(true);
    evidence.taskId = turn.task.id; evidence.turnId = turn.id;
    const accepted = await read(`/api/conversations/${evidence.conversationId}`);
    assert.deepEqual(accepted.conversation.executionProfile, profile.reference);
    assert.deepEqual(accepted.conversation.requested, { model: profile.configuration.model, thinking: 'disabled', tools: 'none' });
    evidence.acceptedConfiguration = { reference: accepted.conversation.executionProfile, requested: accepted.conversation.requested, directoryConfiguration: profile.configuration };
    await save('accepted-one-turn', { conversationId: evidence.conversationId, taskId: evidence.taskId, turnId: turn.id });
    await input().fill(draftText);
    await afterAcceptance({ conversationId: evidence.conversationId, taskId: evidence.taskId });
    const deadline = Date.now() + observationMs;
    let final;
    while (Date.now() < deadline) {
      if (responseFailure) throw responseFailure;
      await expect(pane()).toHaveCount(1); await expect(pane()).toBeVisible();
      turn = (await read(`/api/conversations/${evidence.conversationId}/turns`)).turns.find(value => value.id === evidence.turnId);
      assert.ok(turn, 'Accepted turn must stay present.');
      final = await readCanonicalFinal(turn);
      if (final) break;
      assert.equal(turn.task.status, 'running', 'A non-running task stops draft observation.');
      const snapshot = await pane().locator(root).evaluateAll(nodes => {
        const visible = nodes.map(node => {
          const marker = node.querySelector('[data-stream-status]'), body = node.querySelector('[data-slot="aui_assistant-message-content"]');
          const rect = body?.getBoundingClientRect();
          return body && rect && rect.width > 0 && rect.height > 0 ? { id: marker?.getAttribute('data-stream-status') ?? null, text: body.textContent ?? '' } : null;
        }).filter(Boolean);
        return { samples: visible.filter(value => value.id), canonicalVisible: visible.some(value => !value.id && value.text) };
      });
      // One DOM snapshot distinguishes drafts from an already visible final in this new conversation.
      if (snapshot.canonicalVisible) { await page.waitForTimeout(100); continue; }
      const samples = snapshot.samples;
      for (const sample of samples) {
        const record = recordGrowth(draftSamples, sample, { finalObserved: snapshot.canonicalVisible, taskStatus: turn.task.status, paneId: await pane().getAttribute('id'), taskId: evidence.taskId, turnId: evidence.turnId });
        if (!record) continue;
        evidence.growthSamples = [...draftSamples.values()].flat();
        await save('visible-draft-sample', { streamMessageId: sample.id, bytes: record.bytes, digest: record.digest });
        await afterSample({ record, count: draftSamples.get(sample.id).length, taskId: evidence.taskId });
      }
      turn = (await read(`/api/conversations/${evidence.conversationId}/turns`)).turns.find(value => value.id === evidence.turnId);
      assert.ok(turn, 'Accepted turn must stay present.');
      final = await readCanonicalFinal(turn);
      if (final) break;
      assert.ok(!['failed', 'cancelled', 'uncertain'].includes(turn.task.status), 'Unsuccessful task stops the observation.');
      await page.waitForTimeout(100);
    }
    assert.ok(final, 'No canonical final within the bounded observation.');
    assert.equal(final.taskId, evidence.taskId);
    assert.equal(final.text.trim().split('\n').at(-1), nonce);
    const metadata = await readStreamMetadata(await read(`/api/tasks/${evidence.taskId}/assistant-stream`), evidence.taskId);
    await responses; if (responseFailure) throw responseFailure;
    assert.equal(evidence.negotiation?.protocol, 'patch-v1');
    assert.equal(evidence.negotiation?.liveAssistantText, true);
    assert.equal(metadata.nextCursor, null, 'This short one-turn acceptance must fit one metadata page.');
    validateMetadataPartition(metadata);
    assert.ok(metadata.settlement, "A final needs explicit settlement evidence.");
    assert.equal(metadata.settlement.taskId, final.taskId);
    assert.equal(metadata.settlement.attemptId, final.attemptId);
    assert.equal(metadata.settlement.finalMessageId, final.messageId);
    const expectedIds = metadata.blocks.map(block => streamMessageId(turn.id, { attemptId: final.attemptId, streamId: block.id }));
    for (const id of draftSamples.keys()) assert.ok(expectedIds.includes(id), "Observed draft belongs to final attempt.");
    assert.equal(metadata.attemptId, final.attemptId); assert.equal(metadata.finalMessageId, final.messageId);
    assert.equal(metadata.settlement?.nativeSessionId, final.nativeSessionId);
    let state = emptyPatchState(evidence.taskId, final.attemptId), hasMore = true, pages = 0;
    while (hasMore) {
      assert.ok(++pages <= 512);
      const pageValue = await read(`/api/tasks/${evidence.taskId}/assistant-stream/patches?attemptId=${encodeURIComponent(final.attemptId)}&after=${state.cursor}`);
      ({ state, hasMore } = await applyPatchPage(state, pageValue, state.cursor, metadata.blocks));
    }
    for (const block of metadata.blocks) {
      const actual = state.blocks.find(value => value.streamId === block.id);
      assert.ok(actual); assert.equal(actual.revision, block.revision); assert.equal(actual.prefixDigest, block.prefixDigest); assert.equal(actual.bytes, block.bytes);
    }
    const assistant = pane().locator(root).locator(content);
    await expect(assistant.filter({ hasText: nonce }).last()).toHaveText(final.text);
    const visible = await assistant.allTextContents();
    assert.equal(visible.filter(text => text === final.text).length, 1);
    for (const id of metadata.settlement.replaceStreamIds) await expect(pane().locator(`[data-stream-status="${streamMessageId(turn.id, { attemptId: final.attemptId, streamId: id })}"]`)).toHaveCount(0);
    for (const id of metadata.settlement.retainStreamIds) {
      const block = state.blocks.find(value => value.streamId === id);
      if (block?.content) await expect(pane().locator(`[data-stream-status="${streamMessageId(turn.id, { attemptId: final.attemptId, streamId: id })}"]`)).toBeVisible();
    }
    await expect(pane().getByRole('button', { name: 'Previous', exact: true })).toHaveCount(0);
    await expect(pane().getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    await expect(input()).toHaveValue(draftText);
    evidence.final = { canonical: final, metadata, turnTaskStatus: turn.task.status, visibleTexts: visible, patches: state };
    evidence.incrementalVisible = [...draftSamples.values()].some(values => values.length >= 3) ? 'PROVEN' : 'NOT_PROVEN';
    await save('final-visible-once-and-settled', { incrementalVisible: evidence.incrementalVisible });
    await page.screenshot({ path: `${output}/final-light.png` });
    const dark = page.getByRole('button', { name: 'Use dark theme', exact: true }); if (await dark.isVisible()) await dark.click(); await page.setViewportSize({ width: 390, height: 844 });
    const hide = page.getByRole('button', { name: 'Hide chat list', exact: true }); if (await hide.isVisible()) await hide.click();
    await expect(assistant.filter({ hasText: nonce }).last()).toBeVisible(); await expect(input()).toHaveValue(draftText);
    await page.screenshot({ path: `${output}/final-dark-narrow.png` });
    await responses; if (responseFailure) throw responseFailure;
    assert.deepEqual(evidence.pageErrors, []);
    await save("before-browser-cleanup");
    return { conversationId: evidence.conversationId, taskId: evidence.taskId, attemptId: final.attemptId };
  } finally {
    // Preserve observations before closing our isolated browser; never touch the user's tabs or services.
    try { await checkpoint(); }
    finally {
      if (server) {
        const child = server.process(); await browser?.close(); await server.close();
        evidence.browser.closedAt = new Date().toISOString(); evidence.browser.exitCode = child.exitCode; evidence.browser.signal = child.signalCode;
        assert.ok(child.exitCode !== null || child.signalCode !== null, 'Dedicated browser exit is unconfirmed.');
      }
      await checkpoint();
    }
  }
}
