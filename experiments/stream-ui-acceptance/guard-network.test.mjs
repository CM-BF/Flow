import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mutationGuard } from './evidence.mjs';
const dependencyRoot = resolve(process.env.FLOW_DEPENDENCY_ROOT ?? '.');
const { chromium } = createRequire(`${dependencyRoot}/package.json`)('@playwright/test');
const creation = { harness: 'claude', requested: { model: 'fixed', thinking: 'disabled', tools: 'none' }, executionProfile: { id: 'fixed', runnerId: 'runner', configDigest: 'digest' } };
const createdId = '11111111-1111-4111-8111-111111111111';
let browserServer, browser;
before(async () => { browserServer = await chromium.launchServer({ channel: 'chrome', headless: true }); browser = await chromium.connect(browserServer.wsEndpoint()); });
after(async () => { await browser?.close(); await browserServer?.close(); assert.equal(browserServer.process().exitCode, 0); });
async function withServer(mode, run) {
  const requests = [], steps = [], evidence = { mutations: [] };
  const server = createServer(async (request, response) => {
    if (request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<title>Guard network fixture</title>'); return; }
    let body = ''; for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, body });
    if (request.url === '/api/conversations') {
      if (mode === 'lost-response') { request.socket.destroy(); return; }
      if (mode === 'http-503') { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"error":"unavailable"}'); return; }
      if (mode === 'bad-json') { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{broken'); return; }
      const conversation = { ...JSON.parse(body), id: createdId, revision: 0 };
      if (mode === 'wrong-profile') conversation.executionProfile = { ...creation.executionProfile, id: 'wrong-profile' };
      response.writeHead(201, { 'content-type': 'application/json' }); response.end(JSON.stringify({ conversation, replayed: false })); return;
    }
    if (mode === 'lost-turn-response') { request.socket.destroy(); return; }
    if (mode === 'turn-http-503') { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"error":"unavailable"}'); return; }
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ conversation: { id: createdId, revision: 1 }, turn: { id: 'turn-1', conversationId: createdId, number: 1, user: { text: 'prompt' }, task: { id: 'task-1' } }, replayed: false }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, context = await browser.newContext();
  try {
    await mutationGuard({ origin, evidence, checkpoint: async () => { steps.push(structuredClone(evidence)); }, expectedPrompt: 'prompt', expectedCreation: creation })(context);
    const page = await context.newPage(); await page.goto(origin);
    const post = (path, body) => page.evaluate(async ({ path, body }) => {
      try { const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'only-key' }, body: JSON.stringify(body) }); return { received: true, status: response.status }; }
      catch { return { received: false }; }
    }, { path, body });
    await run({ requests, steps, evidence, post });
  } finally { await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
for (const mode of ['lost-response', 'http-503', 'bad-json', 'wrong-profile']) {
  test(`actual POST ${mode} cannot unlock a turn or a second create`, async () => {
    await withServer(mode, async ({ requests, evidence, post }) => {
      const result = await post('/api/conversations', { ...creation, title: 'One conversation' });
      await post(`/api/conversations/${createdId}/turns`, { text: 'prompt', expectedRevision: 0 });
      await post('/api/conversations', { ...creation, title: 'One conversation' });
      assert.equal(requests.length, 1, 'Only the original create may reach the server.');
      assert.equal(result.received, false, 'An unverified receipt cannot be fulfilled to the page.');
      assert.equal(evidence.mutationFailure?.kind, 'create');
    });
  });
}
test('actual successful create binds turn identity and persists receipt before the page receives it', async () => {
  await withServer('success', async ({ requests, steps, evidence, post }) => {
    assert.deepEqual(await post('/api/conversations', { ...creation, title: 'One conversation' }), { received: true, status: 201 });
    assert.equal(steps.some(value => value.creationReceipt?.conversationId === createdId), true);
    assert.equal(evidence.creationReceipt.conversationId, createdId);
    assert.deepEqual(await post('/api/conversations/different-conversation/turns', { text: 'prompt', expectedRevision: 0 }), { received: false });
    assert.equal(requests.length, 1);
    assert.deepEqual(await post(`/api/conversations/${createdId}/turns`, { text: 'prompt', expectedRevision: 0 }), { received: true, status: 200 });
    await post(`/api/conversations/${createdId}/turns`, { text: 'prompt', expectedRevision: 0 });
    assert.equal(requests.length, 2);
  });
});

for (const mode of ['lost-turn-response', 'turn-http-503']) {
  test(`actual turn ${mode} reaches the server exactly once after successful creation`, async () => {
    await withServer(mode, async ({ requests, evidence, post }) => {
      assert.deepEqual(await post('/api/conversations', { ...creation, title: 'One conversation' }), { received: true, status: 201 });
      const result = await post(`/api/conversations/${createdId}/turns`, { text: 'prompt', expectedRevision: 0 });
      assert.equal(requests.length, 2, 'Exactly one create and one turn POST, including implicit transport retry.');
      assert.equal(requests.filter(request => request.path.endsWith('/turns')).length, 1);
      assert.equal(result.received, false);
      assert.equal(evidence.mutationFailure?.kind, 'turn');
      await post(`/api/conversations/${createdId}/turns`, { text: 'prompt', expectedRevision: 0 });
      await post('/api/conversations', { ...creation, title: 'One conversation' });
      assert.equal(requests.length, 2, 'Unknown turn budget remains spent.');
    });
  });
}
