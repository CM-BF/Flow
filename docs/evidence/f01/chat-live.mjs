// One-shot approved acceptance, not a product runner or reusable budget engine.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { Pool } from 'pg';
import { chromium, expect } from '@playwright/test';

const root = process.env.FLOW_LIVE_SOURCE_ROOT ?? '/Users/citrine/Projects/AgentHarness/Flow';
const output = path.resolve(process.env.FLOW_LIVE_EVIDENCE_DIR ?? 'docs/evidence/f01/chat-live');
const manifest = { materialFiles: [], allowRead: false, requireReadApproval: false, model: 'claude-sonnet-5-5', maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60000 };
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Product source must be clean.');
const adapter = await readFile(path.join(root, 'apps/runner/src/claude.ts'), 'utf8');
for (const fragment of ['tools: materials.length ? [\'Read\'] : []', 'settingSources: []', 'plugins: [], skills: []', 'strictMcpConfig: true', "thinking: { type: 'disabled' }", 'maxBudgetUsd: limits.maxBudgetUsd', 'await emitUsage(context, final)', 'final.is_error']) assert.ok(adapter.includes(fragment), `Fixed adapter preflight failed: ${fragment}`);
assert.equal(JSON.parse(await readFile(path.join(root, 'apps/runner/package.json'), 'utf8')).dependencies['@anthropic-ai/claude-agent-sdk'], '0.3.290');
const prepareOnly = process.argv.includes('--prepare-resources');
if (!process.argv.includes('--execute-approved-two-query') && !prepareOnly) {
  console.log(JSON.stringify({ mode: 'preflight-only', revision, sdk: '0.3.290', manifest, modelCalls: 0 }));
  process.exit(0);
}
assert.equal(process.env.FLOW_LIVE_EXPECTED_HEAD, revision, 'Execution requires the explicitly frozen main SHA.');
await mkdir(output, { recursive: true });
const privateDir = await mkdtemp(path.join(tmpdir(), 'flow-chat-live-'));
const database = `flow_chat_live_${randomBytes(8).toString('hex')}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${database}`;
const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
const ownerToken = randomBytes(32).toString('hex');
const nonce = randomBytes(16).toString('hex');
const children = [];
const browserRecords = [];
const evidence = { revision, sdk: '0.3.290', manifest, startedAt: new Date().toISOString(), database, privateDir, nonce, checks: [], turns: [], browsers: browserRecords, submittedTurns: 0, modelCalls: 0, queryCountEvidence: 'Bounded admitted turns and distinct attempts; production adapter invokes query once per attempt.', status: 'RUNNING' };
let centerUrl, webUrl, browserServer, browser, activeTimer, runner, created = false;
let liveStartedAt = 0;
const browserRequests = [];
const allErrors = [];
function check(name, value) { assert.ok(value, name); evidence.checks.push({ name, passed: true, at: new Date().toISOString() }); }
async function freePort() { const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening'); const n = s.address().port; await new Promise(resolve => s.close(resolve)); return n; }
function launch(name, args, cwd, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.FLOW_A2A_ENDPOINTS_FILE;
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const item = { name, child, pid: child.pid, startedAt: new Date().toISOString(), logs: '' }; children.push(item);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { item.logs = (item.logs + chunk.toString()).slice(-8000); });
  child.on('error', () => {});
  return item;
}
async function stop(item) {
  if (item.child.exitCode === null && item.child.signalCode === null) {
    // Negative PID is only the isolated group created by this script, never a scanned port.
    try { process.kill(-item.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    let timer;
    const exited = await Promise.race([once(item.child, 'exit').then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 22000); })]);
    clearTimeout(timer);
    if (!exited) { item.forced = true; try { process.kill(-item.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } await once(item.child, 'exit'); }
  }
  return { name: item.name, pid: item.pid, startedAt: item.startedAt, exitCode: item.child.exitCode, signal: item.child.signalCode, forced: Boolean(item.forced) };
}
async function api(route, body, token = ownerToken) {
  const response = await fetch(`${centerUrl}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${route}`);
  return response.json();
}
async function ready(url, item) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (item.child.exitCode !== null || item.child.signalCode !== null) throw new Error(`${item.name} exited before ready`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${item.name} readiness timed out`);
}
async function openBrowser(hash = '') {
  browserServer = await chromium.launchServer({ channel: 'chrome', headless: true });
  const process = browserServer.process();
  browserRecords.push({ pid: process.pid, openedAt: new Date().toISOString(), exitCode: null, signal: null });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => allErrors.push(error.message));
  page.on('request', request => browserRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await page.route('**/api/conversations/*/turns', async route => {
    if (route.request().method() === 'POST') {
      if (evidence.submittedTurns >= 2 || (liveStartedAt && Date.now() - liveStartedAt > 180000)) return route.abort();
      evidence.submittedTurns++;
    }
    await route.continue();
  });
  await page.goto(`${webUrl}/${hash}`);
  await page.getByLabel('Owner token').fill(ownerToken);
  await page.getByRole('button', { name: 'Connect workspace', exact: true }).click();
  return page;
}
async function closeBrowser() {
  if (!browserServer) return;
  const process = browserServer.process();
  await browser?.close(); await browserServer.close();
  Object.assign(browserRecords.at(-1), { closedAt: new Date().toISOString(), exitCode: process.exitCode, signal: process.signalCode });
  assert.ok(process.exitCode !== null || process.signalCode !== null, 'Dedicated browser process exited.');
  browserServer = null; browser = null;
}
function pane(page) { return page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])'); }
async function send(page, text) {
  const input = pane(page).getByRole('textbox', { name: 'Message input' });
  await expect(input).toBeVisible();
  await input.fill(text);
  await expect(pane(page).getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await input.press('Enter');
  await page.waitForURL(/#conversation=/);
  return new URL(page.url()).hash.slice('#conversation='.length);
}
async function finishedTurn(conversationId, number) {
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline) {
    const page = await api(`/api/conversations/${conversationId}/turns`);
    const turn = page.turns.find(turn => turn.number === number);
    if (turn?.assistant.state === 'available') return turn;
    if (turn && ['failed', 'cancelled', 'uncertain'].includes(turn.task.status)) throw new Error(`Turn ${number} ended ${turn.task.status}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Turn ${number} did not complete within the bounded wait.`);
}
async function inspectTurn(turn) {
  const task = await api(`/api/tasks/${turn.task.id}`);
  const details = [];
  for (const entry of task.entries) if (entry.kind === 'reference') details.push(await api(`/api/details/${entry.reference.id}`));
  const events = details.flatMap(detail => { try { return [JSON.parse(detail.content)]; } catch { return []; } });
  const usage = events.filter(event => event.type === 'usage');
  const cost = usage.reduce((sum, event) => sum + event.costUsd, 0);
  check(`turn ${turn.number}: succeeded and independently verified`, task.status === 'succeeded' && task.verificationStatus === 'passed');
  check(`turn ${turn.number}: typed body belongs to current attempt`, turn.assistant.source.kind === 'assistant-final' && turn.assistant.source.taskId === task.id && turn.assistant.source.attemptId === task.attempt.id);
  check(`turn ${turn.number}: no tools reported or permission refusals`, Array.isArray(turn.effective.tools) && turn.effective.tools.length === 0 && !details.some(detail => /permission/i.test(detail.title)));
  check(`turn ${turn.number}: SDK usage and cost known`, usage.length > 0 && usage.every(event => event.costKind === 'sdk_estimate' && typeof event.costUsd === 'number' && Number.isFinite(event.costUsd) && event.inputTokens !== null && event.outputTokens !== null));
  check(`turn ${turn.number}: conservative cost threshold`, cost <= 0.20);
  const proof = { turn, task, usage, cost, details, normalizedSdkUsage: true };
  evidence.turns.push(proof); evidence.modelCalls = evidence.turns.length;
  await writeFile(path.join(output, `turn-${turn.number}.json`), JSON.stringify(proof, null, 2));
  return proof;
}
try {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  const centerPort = await freePort(); const webPort = await freePort();
  centerUrl = `http://127.0.0.1:${centerPort}`; webUrl = `http://127.0.0.1:${webPort}`;
  const manifestPath = path.join(privateDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600, flag: 'wx' });
  const center = launch('center', ['--import', 'tsx', 'apps/server/src/main.ts'], root, { DATABASE_URL: databaseUrl.href, FLOW_TOKEN: ownerToken, FLOW_HOST: '127.0.0.1', FLOW_PORT: String(centerPort) });
  await ready(`${centerUrl}/api/health`, center);
  const registration = await api('/api/runners', { name: 'Approved isolated two-query CHAT acceptance', harnesses: ['claude'], capacity: 1 });
  runner = launch('runner', ['--import', 'tsx', 'apps/runner/src/main.ts'], root, { FLOW_URL: centerUrl, FLOW_RUNNER_TOKEN: registration.token, FLOW_RUNNER_WORKDIR: path.join(privateDir, 'runner'), FLOW_CLAUDE_MATERIALS_FILE: manifestPath });
  // The new runner publishes its actual configured policy before claiming any work.
  await expect.poll(async () => (await api('/api/execution-profiles')).profiles.length, { timeout: 10000 }).toBe(1);
  evidence.configuredProfile = (await api('/api/execution-profiles')).profiles[0];
  check('configured profile equals isolated requested manifest', evidence.configuredProfile.configuration.model === manifest.model && evidence.configuredProfile.configuration.access === 'none' && evidence.configuredProfile.configuration.limits.maxBudgetUsd === 0.20);
  const vite = path.join(root, 'apps/web/node_modules/vite/bin/vite.js');
  const web = launch('web', [vite, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], path.join(root, 'apps/web'), { FLOW_CENTER_URL: centerUrl, VITE_FLOW_FIXTURE: 'false' });
  await ready(webUrl, web);
  evidence.resources = { centerUrl, webUrl, runnerId: registration.runnerId, processIds: children.map(item => ({ name: item.name, pid: item.pid })) };
  await writeFile(path.join(output, 'resource-receipt.json'), JSON.stringify({ revision, ...evidence.resources, database, privateDir, manifest, modelCalls: 0 }, null, 2));
  console.log('Isolated resources ready; no model has been called.');
  let page = await openBrowser();
  if (prepareOnly) {
    await expect(pane(page).getByRole('textbox', { name: 'Message input' })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'ready-zero-model.png') });
    evidence.status = 'PREPARED_ZERO_MODEL';
    throw Object.assign(new Error('Preparation complete without sending a message.'), { prepared: true });
  }
  liveStartedAt = Date.now();
  activeTimer = setTimeout(() => { try { process.kill(-runner.pid, 'SIGTERM'); } catch {} }, 180000);
  const conversationId = await send(page, `请在本次对话记住标记 ${nonce}，现在只回复“已记住”，不要复述标记。`);
  evidence.conversationId = conversationId;
  const first = await inspectTurn(await finishedTurn(conversationId, 1));
  check('first actual assistant body acknowledges memory', first.turn.assistant.text.includes('已记住'));
  await expect(pane(page).locator('[data-slot="aui_assistant-message-content"]')).toHaveText(first.turn.assistant.text, { timeout: 10000 });
  await page.screenshot({ path: path.join(output, 'first-reply.png') });
  check('no automatic browser detail requests before explicit inspection', !browserRequests.some(request => /\/details\//.test(request.path)));
  await closeBrowser(); check('first dedicated browser fully exited', browserRecords[0].closedAt);
  page = await openBrowser(`#conversation=${conversationId}`);
  await expect(pane(page).locator('[data-slot="aui_assistant-message-content"]')).toHaveText(first.turn.assistant.text, { timeout: 10000 });
  const sameId = await send(page, '刚才要求你记住的标记是什么？只回复该标记。');
  check('second turn remains in original durable conversation', sameId === conversationId);
  const second = await inspectTurn(await finishedTurn(conversationId, 2));
  check('real native resume recalls nonce without repeating it in second input', second.turn.assistant.text.trim() === nonce && !second.turn.user.text.includes(nonce));
  check('distinct tasks and attempts preserve native session', first.task.id !== second.task.id && first.task.attempt.id !== second.task.attempt.id && first.task.attempt.nativeSessionId === second.task.attempt.nativeSessionId);
  check('conservative sum of SDK session samples within approved total', first.cost + second.cost <= 0.40);
  evidence.costSemantics = 'SDK modelUsage normalized samples; resumed baseline unknown. Sum is a conservative bound, not incremental provider billing.';
  await expect(pane(page).locator('[data-slot="aui_assistant-message-content"]')).toHaveCount(2, { timeout: 10000 });
  await page.screenshot({ path: path.join(output, 'two-rounds.png') });
  check('exactly two admitted browser sends', evidence.submittedTurns === 2);
  const stored = await api(`/api/conversations/${conversationId}/turns`);
  check('exactly two durable ordered turns without duplicate replies', stored.turns.length === 2 && stored.turns.map(turn => turn.number).join(',') === '1,2');
  evidence.browserDetailRequests = browserRequests.filter(request => /\/details\//.test(request.path));
  evidence.lazyDetailBoundary = 'Short real replies do not expose Read full reply; observed zero automatic detail fetches. Explicit long-reply expansion remains the separately approved Web fixture test, not claimed here.';
  check('no browser page errors', allErrors.length === 0);
  evidence.status = 'PASSED';
} catch (error) {
  evidence.status = error.prepared ? 'PREPARED_ZERO_MODEL' : 'FAILED_STOPPED';
  evidence.failure = String(error.message).replaceAll(ownerToken, '[redacted]').slice(0, 2000);
  console.error(evidence.failure);
  if (!error.prepared) process.exitCode = 1;
} finally {
  clearTimeout(activeTimer);
  try { await closeBrowser(); } catch (error) { evidence.browserCleanupError = String(error.message); }
  evidence.processCleanup = [];
  for (const item of [...children].reverse()) evidence.processCleanup.push(await stop(item));
  if (created) { await admin.query(`DROP DATABASE ${database}`); evidence.databaseRemoved = true; }
  await admin.end();
  await rm(privateDir, { recursive: true, force: true });
  evidence.privateDirectoryRemoved = true;
  evidence.budgetCallsConsumedConservatively = evidence.submittedTurns;
  evidence.actualQueryCountIfFailed = evidence.status === 'FAILED_STOPPED' ? 'unknown; no further calls permitted without budget review' : evidence.modelCalls;
  evidence.endedAt = new Date().toISOString();
  evidence.activeElapsedMs = liveStartedAt ? Date.now() - liveStartedAt : 0;
  await writeFile(path.join(output, 'checks.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ status: evidence.status, completedQueryEvidence: evidence.modelCalls, submittedTurns: evidence.submittedTurns, evidence: output }));
}
