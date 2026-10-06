import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { chromium, expect, type Browser, type BrowserServer, type Page } from '@playwright/test';
import { createServer } from '../apps/server/src/index.js';
import { FlowClient } from '../packages/client/src/index.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_web_i01';
if (process.argv.includes('--center-child')) {
  const server = await createServer({ databaseUrl, ownerToken: process.env.FLOW_TOKEN! });
  const url = await server.listen({ host: '127.0.0.1', port: Number(process.env.FLOW_PORT ?? 0) });
  process.send?.({ url, pid: process.pid });
  process.once('SIGTERM', () => { void server.close().finally(() => process.disconnect?.()); });
} else {
  await run();
}

async function run() {
  const output = resolve(process.env.FLOW_WEB_EVIDENCE_DIR ?? 'docs/evidence/i01/web-system');
  await mkdir(output, { recursive: true });
  const evidenceFile = join(output, 'checks.json');
  const evidence: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'running', paidModelCalls: 0, database: 'flow_web_i01', node: process.version, events: [], cli: [], browsers: [] };
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2), { flag: 'wx' });
  const token = randomUUID();
  const children: ChildProcess[] = [];
  const browsers: { server: BrowserServer; browser: Browser }[] = [];
  let temporary: string | undefined;
  let web: { close(): Promise<void> } | undefined;
  let setupPool: Pool | undefined;
  let baseUrl = '';
  const event = (name: string, facts: object = {}) => (evidence.events as unknown[]).push({ name, at: new Date().toISOString(), ...facts });
  const child = (args: string[], env: Record<string, string>) => {
    const result = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, ...env } });
    result.stdout!.resume(); result.stderr!.resume();
    children.push(result);
    return result;
  };
  const center = async (port = 0) => {
    const result = child(['--import', 'tsx', 'scripts/web-system-probe.ts', '--center-child'], { FLOW_TOKEN: token, FLOW_PORT: String(port) });
    const [message] = await bounded(once(result, 'message'), 10000);
    const ready = message as { url: string; pid: number };
    event('center ready', ready);
    return { process: result, ...ready };
  };
  const cli = async (args: string[], expectedCode = 0) => {
    const result = spawn(process.execPath, ['--import', 'tsx', 'apps/cli/src/main.ts', ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FLOW_URL: baseUrl, FLOW_TOKEN: token } });
    children.push(result);
    let stdout = ''; let stderr = '';
    result.stdout.on('data', chunk => { stdout += chunk; });
    result.stderr.on('data', chunk => { stderr += chunk; });
    const [code] = await bounded(once(result, 'exit'), 15000);
    assert.equal(code, expectedCode, stderr);
    const record = { args, pid: result.pid, code, stdout, stderr, at: new Date().toISOString() };
    (evidence.cli as unknown[]).push(record);
    return stdout;
  };
  const openBrowser = async (url: string) => {
    const server = await chromium.launchServer({ channel: 'chrome', headless: true });
    const browser = await chromium.connect(server.wsEndpoint());
    browsers.push({ server, browser });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.on('pageerror', error => (evidence.pageErrors as string[]).push(error.message));
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Connect to Flow' })).toBeVisible();
    await page.getByLabel('Owner token').fill(token);
    await page.getByRole('button', { name: 'Connect workspace' }).click();
    const record = { pid: server.process().pid, openedAt: new Date().toISOString(), closedAt: '', exitCode: null as number | null, signalCode: null as NodeJS.Signals | null };
    (evidence.browsers as unknown[]).push(record);
    event('whole browser opened', { pid: record.pid });
    return {
      page,
      async close() {
        await browser.close(); await server.close();
        record.closedAt = new Date().toISOString();
        record.exitCode = server.process().exitCode; record.signalCode = server.process().signalCode;
        assert.ok(record.exitCode !== null || record.signalCode !== null);
        event('whole browser exited', { pid: record.pid, exitCode: record.exitCode, signalCode: record.signalCode });
      },
    };
  };
  const screenshots = async (page: Page, state: string) => {
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: `Use ${theme} theme` }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.screenshot({ path: join(output, `${state}-${theme}.png`), fullPage: true });
    }
  };
  const submit = async (page: Page, scenario: string) => {
    await page.locator('.flow-workspace-bar button[aria-label="New chat"]').click();
    const pane = page.locator('.flow-tab-body:not([hidden])');
    await pane.getByLabel('Execution backend').selectOption('fixture');
    await pane.getByLabel('Fixture scenario').selectOption(scenario);
    const accepted = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/tasks');
    await pane.getByRole('button', { name: 'Create task', exact: true }).click();
    const response = await accepted;
    assert.equal(response.status(), 202);
    const body = await response.json();
    await expect(page).toHaveURL(new RegExp(`#task=${body.task.id}$`));
    event('Web durably accepted', { taskId: body.task.id, httpStatus: response.status(), harness: body.task.harness });
    return body.task.id as string;
  };
  try {
    evidence.pageErrors = [];
    temporary = await mkdtemp(join(tmpdir(), 'flow-web-i01-'));
    setupPool = new Pool({ connectionString: databaseUrl.replace('/flow_web_i01', '/postgres') });
    const exists = await setupPool.query("SELECT 1 FROM pg_database WHERE datname='flow_web_i01'");
    if (!exists.rowCount) await setupPool.query('CREATE DATABASE flow_web_i01');
    await setupPool.end();
    setupPool = new Pool({ connectionString: databaseUrl });
    await setupPool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;');
    await setupPool.end(); setupPool = undefined;
    let control = await center(); baseUrl = control.url;
    const webRequire = createRequire(resolve('apps/web/package.json'));
    const vite = await import(pathToFileURL(webRequire.resolve('vite')).href);
    delete process.env.VITE_FLOW_FIXTURE;
    process.env.FLOW_CENTER_URL = baseUrl;
    const webServer = await vite.createServer({ root: resolve('apps/web'), configFile: resolve('apps/web/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } });
    web = webServer;
    await webServer.listen();
    const webUrl = webServer.resolvedUrls.local[0] as string;
    evidence.webUrl = webUrl;
    evidence.centerUrl = baseUrl;
    evidence.probePid = process.pid;
    let client = new FlowClient({ baseUrl, token });
    const first = await openBrowser(webUrl);
    const id = await submit(first.page, 'decision');
    await expect(first.page.locator('.flow-status.status-queued')).toBeVisible();
    await screenshots(first.page, 'queued');
    await first.close();
    // Restart while still queued: this tests persisted acceptance without promising active SDK recovery.
    const previousCenterPid = control.pid;
    await stop(control.process);
    control = await center(Number(new URL(baseUrl).port));
    assert.notEqual(control.pid, previousCenterPid);
    client = new FlowClient({ baseUrl, token });
    assert.equal((await client.show(id)).status, 'queued');
    event('queued acceptance survived center restart with browser closed', { taskId: id, previousCenterPid, centerPid: control.pid });
    const registration = await client.registerRunner({ name: 'Web system fixture runner', harnesses: ['fixture'], capacity: 1 });
    const runner = child(['--import', 'tsx', 'apps/runner/src/main.ts'], { FLOW_URL: baseUrl, FLOW_RUNNER_TOKEN: registration.token, FLOW_RUNNER_WORKDIR: join(temporary, 'runner'), FLOW_CLAUDE_MATERIALS_FILE: '' });
    event('independent runner started with browser closed', { pid: runner.pid, runnerId: registration.runnerId });
    await expect.poll(async () => (await client.show(id)).status, { timeout: 12000 }).toBe('waiting');
    const waiting = JSON.parse(await cli(['show', id, '--json']));
    assert.equal(waiting.id, id); assert.equal(waiting.status, 'waiting');
    event('CLI observed decision with browser closed', { taskId: id, attemptId: waiting.attempt.id, decisionId: waiting.pendingDecision.id });
    await cli(['decision', id, 'approve', '--decision', waiting.pendingDecision.id, '--key', randomUUID(), '--json']);
    await cli(['watch', id, '--timeout', '10000', '--json']);
    const delivered = await client.show(id);
    assert.equal(delivered.attempt!.id, waiting.attempt.id);
    assert.equal(delivered.attempt!.runnerId, registration.runnerId);
    assert.equal(delivered.status, 'succeeded'); assert.equal(delivered.verificationStatus, 'passed');
    const details = await Promise.all(delivered.entries.filter(entry => entry.kind === 'reference').map(entry => client.detail(entry.reference.id)));
    const artifact = details.find(detail => detail.kind === 'artifact')!;
    const verification = details.find(detail => detail.kind === 'verification')!;
    assert.ok(artifact); assert.ok(verification);
    assert.equal(createHash('sha256').update(artifact.content).digest('hex'), artifact.artifactVersion);
    evidence.delivery = { taskId: id, attemptId: delivered.attempt!.id, runnerId: registration.runnerId, runnerPid: runner.pid, centerPid: control.pid, executionStatus: delivered.status, verificationStatus: delivered.verificationStatus, artifactVersion: artifact.artifactVersion, verification: JSON.parse(verification.content), artifactContent: artifact.content };
    const second = await openBrowser(`${webUrl}#task=${id}`);
    const detailRequests: string[] = [];
    second.page.on('request', request => { if (request.url().includes('/api/details/')) detailRequests.push(request.url()); });
    await expect(second.page).toHaveURL(new RegExp(`#task=${id}$`));
    await expect(second.page.locator('.flow-status.status-succeeded')).toBeVisible();
    await expect(second.page.locator('.verification-passed')).toBeVisible();
    assert.equal(detailRequests.length, 0);
    await screenshots(second.page, 'reconnected-completed');
    await second.page.getByRole('button', { name: /Fixture result/ }).click();
    await expect(second.page.locator('.flow-workspace-detail-content:visible')).toHaveText(artifact.content.trim());
    await expect(second.page.locator('.flow-workspace-artifact-meta:visible dd').first()).toHaveText(artifact.artifactVersion!);
    assert.equal(detailRequests.length, 1);
    await second.page.getByRole('button', { name: /Verification passed/ }).click();
    const displayedVerification = second.page.locator('.flow-workspace-detail-content:visible');
    await expect(displayedVerification).toContainText(artifact.artifactVersion!);
    await expect(displayedVerification).toContainText(JSON.parse(verification.content).inputDigest);
    assert.equal(JSON.parse(await displayedVerification.innerText()).result, 'passed');
    assert.equal(detailRequests.length, 2);
    await screenshots(second.page, 'artifact');
    await second.page.setViewportSize({ width: 390, height: 844 });
    await second.page.getByRole('button', { name: 'Hide chat list' }).click();
    await expect(second.page.locator('.flow-sidebar')).toHaveCount(0);
    await expect(displayedVerification).toBeVisible();
    assert.equal(await second.page.locator('body').evaluate(element => element.scrollWidth), 390);
    await second.page.screenshot({ path: join(output, 'artifact-dark-narrow.png'), fullPage: true });
    evidence.detailRequestsBeforeExpansion = 0;
    evidence.detailRequestsAfterArtifactExpansion = 1;
    evidence.detailRequestsAfterArtifactAndVerificationExpansion = detailRequests.length;
    event('fresh browser verified same task and versioned evidence', { taskId: id, attemptId: delivered.attempt!.id, artifactVersion: artifact.artifactVersion });
    await second.page.setViewportSize({ width: 1440, height: 1050 });
    const cancelId = await submit(second.page, 'slow');
    await expect.poll(async () => (await client.show(cancelId)).status).toBe('running');
    const cancelling = await client.show(cancelId);
    await second.close();
    await cli(['cancel', cancelId, '--key', randomUUID(), '--json']);
    await cli(['watch', cancelId, '--timeout', '10000', '--json'], 11);
    const cancelled = await client.show(cancelId);
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.attempt!.id, cancelling.attempt!.id);
    const cancelledDetails = await Promise.all(cancelled.entries.filter(entry => entry.kind === 'reference').map(entry => client.detail(entry.reference.id)));
    assert.equal(cancelledDetails.filter(detail => detail.kind === 'artifact').length, 0);
    const third = await openBrowser(`${webUrl}#task=${cancelId}`);
    await expect(third.page.locator('.flow-status.status-cancelled')).toBeVisible();
    await screenshots(third.page, 'cancelled');
    await third.close();
    evidence.cancellation = { taskId: cancelId, attemptId: cancelled.attempt!.id, status: cancelled.status, artifacts: 0 };
    assert.deepEqual(evidence.pageErrors, []);
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed'; evidence.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1;
  } finally {
    const cleanupErrors: string[] = [];
    const clean = async (name: string, action: () => Promise<unknown>) => { try { await bounded(action(), 10000); } catch { cleanupErrors.push(name); } };
    for (const entry of browsers) await clean('browser', async () => { await entry.browser.close(); await entry.server.close(); });
    for (const entry of children.reverse()) await clean(`child ${entry.pid}`, () => stop(entry));
    await clean('Web server', async () => { await web?.close(); });
    await clean('setup pool', async () => { await setupPool?.end(); });
    await clean('temporary runner files', async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); });
    evidence.cleanupErrors = cleanupErrors;
    if (cleanupErrors.length) { process.exitCode = 1; setTimeout(() => process.exit(1), 1000).unref(); }
    evidence.finishedAt = new Date().toISOString();
    evidence.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    evidence.sourceHashes = Object.fromEntries(await Promise.all(['scripts/web-system-probe.ts', 'apps/web/src/App.tsx', 'apps/web/src/projection.ts', 'apps/server/src/index.ts', 'apps/runner/src/fixture.ts'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
    evidence.limits = ['Real PostgreSQL, center, Web and independent runner/CLI/browser processes; deterministic adapter only', 'Queued center restart, not transparent recovery of an active native query', 'No new native model calls, cross-host validation, database power loss or capacity/SLO claim'];
    await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ status: evidence.status, evidenceFile, error: evidence.error, cleanupErrors })}\n`);
  }
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  try { await bounded(exited, 3000); }
  catch { child.kill('SIGKILL'); await bounded(exited, 3000); }
}
async function bounded<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([pending, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`Deadline ${milliseconds}ms exceeded`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
