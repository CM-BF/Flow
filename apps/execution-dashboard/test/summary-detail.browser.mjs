import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, readdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createDashboardServer } from '../src/server.mjs';
import { validateRegistry } from '../src/registry.mjs';
import { status } from './fixture.mjs';

export const sourceFiles = ['src/read-model.mjs', 'src/aggregate.mjs', 'src/server.mjs', 'public/app.js', 'test/summary-detail.test.mjs', 'test/summary-detail.browser.mjs', 'test/task-links.browser.mjs'].map(file => `apps/execution-dashboard/${file}`);
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { timeout: 3000, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_OPTIONAL_LOCKS: '0' } }).trim();
const commit = directory => { git(directory, 'add', '.'); git(directory, '-c', 'user.name=Summary fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'); return git(directory, 'rev-parse', 'HEAD'); };
const hash = value => createHash('sha256').update(value).digest('hex');

/** Two owned temporary repositories, explicit synthetic ledger, no production registry/config. */
export async function summaryFixture(context, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'flow-summary-fixture-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const worktree = path.join(root, 'owner'), mainWorktree = path.join(root, 'main');
  for (const [directory, branch] of [[worktree, 'codex/summary-fixture'], [mainWorktree, 'main']]) {
    await mkdir(path.join(directory, 'apps/demo'), { recursive: true }); git(directory, 'init', '-q', '-b', branch);
    for (const id of ['T01', 'T02']) await writeFile(path.join(directory, `apps/demo/${id}.js`), `export const value = '${id}';\n`);
  }
  const tasks = ['T01', 'T02'].map(id => ({ id, title: `任务 ${id}`, role: '工作线', worktree, branch: 'codex/summary-fixture', planDir: `plans/${id.toLowerCase()}`, evidenceDir: `docs/evidence/${id.toLowerCase()}` }));
  const updated = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const baseHuman = { 本片段交付阶段: 'implementation', 阶段: 'M2', 优先级: '1', 当前产出: '任务关系可从唯一记录核对', 下一可用交付: '核对父任务与责任人', 当前阻塞: 'NONE', 需用户决定: 'NONE', 'co-lead': 'Web /root' };
  const human = task => task.id === 'T02' ? { ...baseHuman, 任务层级: '大task', '大task ID': '[T02](plan.md)' }
    : { ...baseHuman, 所属大task: `[T02](${worktree}/plans/t02/plan.md)`, 当前阻塞: 'ACTIVE: 子任务阻塞独立保留', 需用户决定: 'REQUIRED: 子任务决定独立保留' };
  for (const task of tasks) {
    await mkdir(path.join(worktree, task.planDir), { recursive: true }); await mkdir(path.join(worktree, task.evidenceDir), { recursive: true });
    await writeFile(path.join(worktree, task.planDir, 'plan.md'), '# 计划\n');
    await writeFile(path.join(worktree, task.planDir, 'status.md'), status(task, { human: human(task), updated }));
    await writeFile(path.join(worktree, task.planDir, 'review.md'), '**状态：NOT_STARTED**\n');
  }
  const target = commit(worktree); commit(mainWorktree);
  const writeStatus = (task, values = {}) => writeFile(path.join(worktree, task.planDir, 'status.md'), status(task, { updated, human: human(task), implementation: { target, scope: `apps/demo/${task.id}.js` }, checks: `PASSED ${target}`, review: 'APPROVED author record', ...values }));
  for (const task of tasks) { await writeStatus(task); await writeFile(path.join(worktree, task.planDir, 'review.md'), `**状态：APPROVED**\nReview target commit：${target}\n`); }
  const registry = validateRegistry({ tasks, mainWorktree, fallbackWorktree: worktree, frozenCommit: target, staleAfterHours: 24, phaseSourceId: 'T02' });
  const server = createDashboardServer(registry, { ...options, assignmentObserver: options.assignmentObserver ?? (async now => ({ state: 'unknown', observedAt: new Date(now).toISOString(), claims: [], message: 'Synthetic fixture; no PG authority' })) });
  context.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { root, tasks, registry, target, updated, server, writeStatus, url: `http://127.0.0.1:${server.address().port}` };
}

async function bytesIn(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes += await bytesIn(filename);
    else if (entry.isFile()) bytes += (await stat(filename)).size;
  }
  return bytes;
}

/** Shared cumulative allowance for both browser scripts. Requires a new external resource gate. */
export async function runBrowserCheck(name, check) {
  if (!process.env.DPERF04_BROWSER_GATE) throw new Error('Browser resource gate required; source-only is the default');
  const gate = JSON.parse(await readFile(process.env.DPERF04_BROWSER_GATE, 'utf8'));
  assert.equal(gate.allowRun, true); assert.ok(Date.parse(gate.expiresAt) > Date.now());
  assert.match(gate.run, /^[a-zA-Z0-9-]{1,80}$/); assert.ok(path.isAbsolute(gate.chromeExecutable));
  assert.equal(git(process.cwd(), 'rev-parse', 'HEAD'), gate.sourceHead);
  const outputRoot = path.resolve('docs/evidence/wpf-dperf04'), budgetFile = path.join(outputRoot, 'browser-budget.json');
  let spentMs = 0;
  try { const budget = JSON.parse(await readFile(budgetFile, 'utf8')); assert.equal(budget.complete, true, 'Previous browser cleanup unknown'); spentMs = budget.spentMs; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(Number.isFinite(spentMs) && spentMs >= 0 && spentMs < 45000);
  const started = Date.now(), limit = 60000, cleanupReserve = 15000;
  const output = path.join(outputRoot, 'browser-runs', gate.run); await mkdir(output, { recursive: false }).catch(async error => { if (error.code !== 'ENOENT') throw error; await mkdir(path.dirname(output), { recursive: true }); await mkdir(output); });
  const report = { name, startedAt: new Date(started).toISOString(), sourceHead: gate.sourceHead, sourceDirty: Boolean(git(process.cwd(), 'status', '--porcelain')), sourceHashes: {}, checks: [], screenshots: [], errors: [], cleanupErrors: [], pg: 0, outcome: 'failed' };
  for (const file of sourceFiles) { report.sourceHashes[file] = hash(await readFile(file)); assert.equal(report.sourceHashes[file], gate.sourceHashes[file], `Source gate mismatch: ${file}`); }
  await writeFile(budgetFile, JSON.stringify({ complete: false, spentMs, run: gate.run, startedAt: report.startedAt }) + '\n');
  let fixture, chrome, browser, stopped = false, profile;
  const cleanups = [];
  const groupAlive = () => { if (!chrome?.pid) return false; try { process.kill(-chrome.pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  const signalChrome = signal => { if (groupAlive()) process.kill(-chrome.pid, signal); };
  const checkpoint = () => { if (stopped || Date.now() - started > limit - spentMs - cleanupReserve) throw new Error('Browser work deadline reached'); };
  const workDeadline = setTimeout(() => { stopped = true; signalChrome('SIGTERM'); fixture?.server.closeAllConnections(); }, Math.max(1, limit - spentMs - cleanupReserve));
  const hardDeadline = setTimeout(() => {
    signalChrome('SIGKILL'); fixture?.server.closeAllConnections();
    report.cleanupErrors.push('Hard deadline: cleanup not confirmed'); report.elapsedMs = Date.now() - started;
    writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
    writeFileSync(budgetFile, JSON.stringify({ complete: false, spentMs: spentMs + report.elapsedMs, run: gate.run }));
    process.exit(1);
  }, limit - spentMs);
  try {
    checkpoint(); fixture = await summaryFixture({ after: cleanup => cleanups.push(cleanup) }); checkpoint();
    profile = await mkdtemp(path.join(tmpdir(), 'flow-summary-chrome-')); checkpoint();
    chrome = spawn(gate.chromeExecutable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    report.chromePid = chrome.pid; let chromeLog = '', launchError;
    chrome.on('error', error => { launchError = error; });
    for (const stream of [chrome.stdout, chrome.stderr]) stream.on('data', chunk => { if (chromeLog.length < 65536) chromeLog += chunk.toString().slice(0, 65536 - chromeLog.length); });
    let port;
    const launchDeadline = Math.min(started + limit - spentMs - cleanupReserve, Date.now() + 8000);
    while (!port) {
      checkpoint(); if (launchError) throw launchError; if (Date.now() >= launchDeadline) throw new Error('Owned Chrome did not become ready');
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!port) await delay(50);
    }
    const { chromium } = await import('@playwright/test'); checkpoint();
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 3000 }); checkpoint();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(2000);
    page.on('pageerror', error => report.errors.push(error.message));
    await check({ page, f: fixture, report, output, checkpoint }); checkpoint();
    assert.deepEqual(report.errors, []); report.outcome = 'passed';
    await writeFile(path.join(output, 'chrome.log'), chromeLog);
  } catch (error) { report.failure = error.stack; report.outcome = 'failed'; }
  finally {
    clearTimeout(workDeadline);
    try {
      signalChrome('SIGTERM');
      const until = Date.now() + 3000;
      while (groupAlive() && Date.now() < until) await delay(25);
      if (groupAlive()) signalChrome('SIGKILL');
      if (chrome?.pid && chrome.exitCode === null && chrome.signalCode === null) await once(chrome, 'exit');
      const reapUntil = Date.now() + 1000;
      while (groupAlive() && Date.now() < reapUntil) await delay(25);
      if (groupAlive()) report.cleanupErrors.push('Owned Chrome process group still present');
    } catch (error) { report.cleanupErrors.push(String(error)); }
    try { await browser?.close(); } catch (error) { report.cleanupErrors.push(String(error)); }
    for (const cleanup of cleanups.reverse()) try { await cleanup(); } catch (error) { report.cleanupErrors.push(String(error)); }
    try { if (profile) await rm(profile, { recursive: true, force: true }); } catch (error) { report.cleanupErrors.push(String(error)); }
    report.serverClosed = fixture ? !fixture.server.listening : null;
    report.fixtureRemoved = fixture ? await stat(fixture.root).then(() => false, error => { if (error.code === 'ENOENT') return true; throw error; }) : null;
    report.elapsedMs = Date.now() - started; report.cumulativeMs = spentMs + report.elapsedMs;
    report.finishedAt = new Date().toISOString();
    if (report.cleanupErrors.length || report.serverClosed === false || report.fixtureRemoved === false || report.cumulativeMs > limit) report.outcome = 'failed';
    await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    report.retainedBytes = await bytesIn(outputRoot);
    if (report.retainedBytes > 8 * 1024 * 1024) { report.outcome = 'failed'; report.errors.push('Retained evidence exceeds 8 MiB'); }
    await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    await writeFile(budgetFile, JSON.stringify({ complete: report.cleanupErrors.length === 0 && report.fixtureRemoved !== false && report.serverClosed !== false, spentMs: report.cumulativeMs, limitMs: limit, cleanupReserveMs: cleanupReserve }) + '\n');
    clearTimeout(hardDeadline);
  }
  console.log(JSON.stringify({ output, outcome: report.outcome, checks: report.checks, elapsedMs: report.elapsedMs, cumulativeMs: report.cumulativeMs, cleanupErrors: report.cleanupErrors }));
  if (report.outcome !== 'passed') process.exitCode = 1;
}

async function summaryChecks({ page, f, report, output }) {
  // Deliberately ignore cancellation for read responses, so generation guards carry the proof.
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, init) => String(url).startsWith('/api/') ? original(url, { ...init, signal: undefined }) : original(url, init);
  });
  report.transport = 'Synthetic late transport ignores AbortSignal; actual DOM must reject stale results';
  const requests = []; page.on('request', request => requests.push(new URL(request.url()).pathname));
  let finishAssignments;
  const assignmentRelease = new Promise(resolve => { finishAssignments = resolve; });
  await page.route('**/api/assignments', async route => {
    const response = await route.fetch(), value = await response.json(); await assignmentRelease;
    value.assignments = { state: 'available', observedAt: value.completedAt, claims: [] };
    value.byTask = Object.fromEntries(f.tasks.map(task => [task.id, []]));
    value.unregisteredAssignments = [{ claimId: 'unregistered-readonly-fixture', version: 7, taskId: 'U01', role: 'writer', state: 'handoff_pending', lead: '<script>lead</script>', worker: 'fixture-worker', branch: 'codex/unregistered', worktree: '/synthetic/unregistered', scope: ['apps/exact/component.js', 'plans/owned'], needsVerification: true, updatedAt: value.completedAt, next: { lead: 'next', worker: 'next-worker', worktree: '/synthetic/next', branch: 'codex/next' } }];
    await route.fulfill({ response, json: value });
  });
  await page.goto(f.url); await page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  assert.match(await page.locator('#active-work').innerText(), /领取状态未知/);
  assert.equal(requests.includes('/api/snapshot'), false); assert.equal(requests.includes('/api/task'), false);
  finishAssignments(); await page.locator('#unregistered-claims').waitFor({ state: 'visible' });
  const claim = page.getByText('查看领取详情：U01', { exact: true }); await claim.focus(); await page.keyboard.press('Enter');
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /apps\/exact\/component.js/);
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /仍占用/);
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /不适用.*进度来源尚未登记/);
  assert.equal(await page.locator('#unregistered-claim-items script').count(), 0);
  report.checks.push('Summary renders before ledger, requests no full snapshot/proof; unregistered claim exact scope and stale handoff are keyboard reachable');
  const open = id => page.locator(`#active-work [data-open-task="${id}"]`).last();
  await open('T02').click(); await page.locator('#selected-proof .documents').waitFor();
  await page.keyboard.press('Escape');
  // Intercept after the warm request: late success/error, including the same task reopened.
  let firstDetail, finishDetail;
  const detailStarted = new Promise(resolve => { firstDetail = resolve; });
  const detailRelease = new Promise(resolve => { finishDetail = resolve; });
  let delayOne = true;
  await page.route('**/api/task?*', async route => {
    if (!delayOne) return route.continue(); delayOne = false;
    const response = await route.fetch(), value = await response.json(); firstDetail(); await detailRelease;
    value.task.status.owner = 'STALE-DETAIL-MUST-NOT-RENDER'; await route.fulfill({ response, json: value }).catch(() => {});
  });
  await open('T02').click(); await detailStarted; await page.keyboard.press('Escape'); await open('T02').click();
  await page.locator('#selected-proof .documents').waitFor(); finishDetail();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.doesNotMatch(await page.locator('#detail-content').innerText(), /STALE-DETAIL/);
  report.checks.push('Same ID close/reopen refuses prior detail result independently of abort');
  await page.keyboard.press('Escape');
  delayOne = true;
  let finishABA, startABA;
  const abaStarted = new Promise(resolve => { startABA = resolve; });
  const abaRelease = new Promise(resolve => { finishABA = resolve; });
  await page.unroute('**/api/task?*');
  await page.route('**/api/task?*', async route => {
    if (!delayOne) return route.continue(); delayOne = false;
    const response = await route.fetch(), value = await response.json(); startABA(); await abaRelease;
    value.task.status.owner = 'STALE-ABA-MUST-NOT-RENDER'; await route.fulfill({ response, json: value });
  });
  await open('T02').click(); await abaStarted;
  await page.locator('.direct-children').getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await page.locator('#detail-content > .task-links').getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true }).click();
  await page.locator('#selected-proof .documents').waitFor(); finishABA();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.doesNotMatch(await page.locator('#detail-content').innerText(), /STALE-ABA/);
  report.checks.push('A→B→A navigation rejects the first A detail');
  let finishDocument, startDocument;
  const documentStarted = new Promise(resolve => { startDocument = resolve; });
  const documentRelease = new Promise(resolve => { finishDocument = resolve; });
  await page.route('**/api/document?*', async route => {
    if (!new URL(route.request().url()).searchParams.get('path').endsWith('plan.md')) return route.continue();
    startDocument(); await documentRelease; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'STALE-DOCUMENT-ERROR' }) }).catch(() => {});
  });
  await page.getByRole('button', { name: 'plan.md', exact: true }).click(); await documentStarted;
  await page.getByRole('button', { name: 'review.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.includes('APPROVED'));
  finishDocument(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#document-error').isVisible(), false);
  report.checks.push('Same-task plan→review rejects late document error and keeps new document');
  await page.keyboard.press('Escape');
  let finishOldAssignment, startOldAssignment, delayAssignment = true;
  const assignmentStarted = new Promise(resolve => { startOldAssignment = resolve; });
  const oldAssignmentRelease = new Promise(resolve => { finishOldAssignment = resolve; });
  await page.unroute('**/api/assignments');
  await page.route('**/api/assignments', async route => {
    if (delayAssignment) { delayAssignment = false; startOldAssignment(); await oldAssignmentRelease; return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); }
    const response = await route.fetch(), value = await response.json();
    value.assignments = { state: 'available', observedAt: value.completedAt, claims: [] };
    value.byTask = Object.fromEntries(f.tasks.map(task => [task.id, []]));
    await route.fulfill({ response, json: value });
  });
  await page.locator('#refresh').click(); await assignmentStarted;
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  const oldRead = await page.locator('#assignment-observation').getAttribute('data-read-id');
  await page.locator('#refresh').click();
  await page.waitForFunction(old => document.querySelector('#assignment-observation').dataset.readId !== old, oldRead);
  finishOldAssignment(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.doesNotMatch(await page.locator('#assignment-observation').innerText(), /本次失败/);
  assert.match(await page.locator('#active-work').innerText(), /尚无领取登记/);
  report.checks.push('Late previous assignment error cannot overwrite a newer available observation');
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  const oldTime = await page.locator('#sync-time').textContent();
  await page.route('**/api/summary', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.locator('#refresh').click(); await page.locator('#load-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#sync-time').textContent(), oldTime); assert.match(await page.locator('#load-error').innerText(), /保留上次摘要/);
  assert.equal(await page.locator('#active-work .task-row').count(), 1);
  report.checks.push('Summary failure keeps prior content/time without new proof freshness');
  await page.unroute('**/api/summary'); await page.locator('#refresh').click(); await page.locator('#load-error').waitFor({ state: 'hidden' });
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#theme').selectOption(theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await open('T02').click(); await page.locator('#selected-proof .documents').waitFor();
    assert.equal(await page.locator('#task-dialog').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    const name = `summary-detail-390-${theme}.png`; await page.screenshot({ path: path.join(output, name), animations: 'disabled' }); report.screenshots.push(name);
    await page.keyboard.press('Escape');
  }
  report.checks.push('390 light/dark selected detail is bounded, keyboard closes, reduced-motion context');
  report.requests = requests;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await runBrowserCheck('summary-detail', summaryChecks);
