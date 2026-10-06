import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fixture } from './fixture.mjs';

const output = path.resolve('docs/evidence/wpf-dashboard-summary');
const started = Date.now(), budgetMs = 90_000, cleanupReserveMs = 10_000;
let spentMs = 0;
try { spentMs = JSON.parse(await readFile(path.join(output, 'browser-budget.json'), 'utf8')).spentMs; } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!Number.isFinite(spentMs) || spentMs >= budgetMs - cleanupReserveMs) throw Error('Cumulative browser budget exhausted; do not start another run.');
const sources = ['src/human.mjs', 'public/app.js', 'test/human-summary.test.mjs', 'test/task-links.browser.mjs'].map(file => `apps/execution-dashboard/${file}`);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const cleanups = [];
await mkdir(output, { recursive: true });
const report = { at: new Date().toISOString(), sourceHead: git('rev-parse', 'HEAD'), sourceDirty: Boolean(git('status', '--porcelain')), sourceHashes: Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]))), checks: [], screenshots: [], errors: [], failure: null };
let browser, f, deadline;
try {
  f = await fixture({ after: callback => cleanups.push(callback) });
  const [sub, parent] = f.tasks;
  const human = { 本片段交付阶段: 'implementation', 阶段: 'M2', 优先级: '1', 当前产出: '任务关系可从唯一记录核对', 下一可用交付: '核对父任务与责任人', 当前阻塞: 'NONE', 需用户决定: 'NONE' };
  const parentRows = { ...human, 任务层级: '大task', '大task ID': '[T02](plan.md)', 'co-lead': 'Web /root（执行管理 d01_owner）/ technical-owner-context /Users/example/long-owner-identity' };
  const subRows = { ...human, 本片段交付阶段: 'review', 所属大task: `[T02](${parent.worktree}/${parent.planDir}/plan.md)`, 'co-lead': 'Web /root（执行管理 d01_owner）/ technical-owner-context /Users/example/long-owner-identity' };
  await f.writeStatus(parent, { human: parentRows }); await f.writeStatus(sub, { human: subRows });
  report.url = f.url;
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 10_000 });
  deadline = setTimeout(() => { void browser.close(); }, Math.max(1, budgetMs - spentMs - cleanupReserveMs - (Date.now() - started)));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(3500);
  let knownAssignments = true;
  const technicalLead = '/Users/example/long-technical-lead', technicalWorker = 'agent-technical-worker-123456';
  await page.route('**/api/snapshot', async route => {
    const response = await route.fetch(), body = await response.json();
    for (const task of body.tasks) task.assignments = knownAssignments ? [{ claimId: 'fixture-only', version: 1, role: 'writer', state: 'active', lead: technicalLead, worker: technicalWorker, branch: task.branch, worktree: task.worktree, scope: [], needsVerification: true, matchesSource: false }] : null;
    await route.fulfill({ response, json: body });
  });
  report.assignmentFixture = 'Rendering-only injected claims; no coordination database read or write.';
  page.on('pageerror', error => report.errors.push(error.message));
  const requests = []; page.on('request', request => requests.push(request.url()));
  const ready = () => page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  const refresh = async () => { await page.locator('#refresh').click(); await page.waitForFunction(() => !document.querySelector('#refresh').disabled); await ready(); };
  const firstChild = () => page.locator('#active-work .task-row, #other-activity-items .task-row').filter({ has: page.locator('.task-code', { hasText: 'T01' }) });
  const parentRow = () => page.locator('#active-work .task-row').filter({ has: page.locator('.task-code', { hasText: 'T02' }) });
  const showOther = async () => { const details = page.locator('#other-activity'); if (!(await details.evaluate(node => node.open))) await details.locator('summary').click(); };
  await page.goto(f.url); await ready();
  assert.equal(await page.locator('#active-work .task-row').count(), 1);
  assert.equal(await page.locator('#next-deliveries .task-row').count(), 1);
  assert.match(await parentRow().innerText(), /T02/);
  assert.doesNotMatch(await parentRow().innerText(), /technical-owner|long-technical-lead|agent-technical-worker/);
  assert.match(await parentRow().innerText(), /已领取.*待核对.*进度来源待对齐/);
  await showOther();
  assert.match(await firstChild().innerText(), /查看所属大task T02/);
  assert.equal(await firstChild().locator('.task-link-records').count(), 0);
  const parentButton = firstChild().getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true });
  await parentButton.focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#detail-id').textContent(), 'T02');
  assert.match(await page.locator('#detail-content').innerText(), /technical-owner-context/);
  assert.match(await page.locator('#detail-content').innerText(), new RegExp(technicalWorker));
  const childSection = page.getByRole('region', { name: '直属子任务' });
  assert.match(await childSection.innerText(), /任务关系可从唯一记录核对/);
  assert.match(await childSection.innerText(), /本片段阶段：审查中/);
  const childButton = childSection.getByRole('button', { name: '查看详情：T01 任务 T01', exact: true });
  await childButton.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#detail-id').textContent(), 'T01');
  assert.equal(await page.locator('#detail-title').evaluate(node => node === document.activeElement), true);
  const raw = page.locator('#detail-content > .task-links .task-link-records');
  await raw.locator('summary').focus(); await page.keyboard.press('Enter'); assert.equal(await raw.getAttribute('open'), '');
  assert.match(await raw.innerText(), /\[T02\]/); assert.equal(await raw.locator('a').count(), 0);
  await page.keyboard.press('Space'); assert.equal(await raw.getAttribute('open'), null);
  await page.keyboard.press('Escape'); assert.equal(await parentButton.evaluate(node => node === document.activeElement), true);
  report.checks.push('Parent occupies one headline/delivery slot; child remains reachable; technical identities live in details; parent→child Enter and Escape focus work');
  await parentButton.click();
  await page.getByRole('button', { name: 'plan.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.includes('# 计划'));
  const documentReads = requests.filter(url => new URL(url).pathname === '/api/document');
  assert.equal(documentReads.length, 1); assert.equal(new URL(documentReads[0]).searchParams.get('task'), 'T02'); assert.equal(new URL(documentReads[0]).searchParams.get('path'), `${parent.planDir}/plan.md`);
  await page.keyboard.press('Escape');
  report.checks.push('Parent plan still uses the existing registered-document endpoint');
  const detailsButton = firstChild().getByRole('button', { name: '查看详情：T01 任务 T01', exact: true });
  await detailsButton.focus(); await page.keyboard.press('Enter');
  const nestedParent = page.locator('#detail-content').getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true });
  await nestedParent.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#detail-id').textContent(), 'T02'); assert.equal(await page.locator('#detail-title').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.equal(await detailsButton.evaluate(node => node === document.activeElement), true);
  report.checks.push('Child detail to parent stays in one modal, focuses new title, and returns original child invoker on Escape');
  knownAssignments = false; await refresh(); assert.match(await page.locator('#active-work').innerText(), /领取状态未知/);
  await f.writeStatus(parent, { human: parentRows, updated: '2026-10-01 00:00 UTC' }); await refresh();
  assert.match(await firstChild().innerText(), /关系未知.*登记资料/); assert.match(await firstChild().innerText(), /陈旧/);
  await f.writeStatus(parent, { human: parentRows });
  await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[NOT-REGISTERED](/private/secret)' } }); await refresh();
  assert.match(await firstChild().innerText(), /父任务未登记/); assert.equal(await firstChild().locator('[data-open-task="NOT-REGISTERED"]').count(), 0);
  await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[T02](/private/secret)' } }); await refresh();
  assert.match(await firstChild().innerText(), /链接不一致/); assert.equal(await firstChild().locator('.task-links button').count(), 0);
  const injection = '<img src=x onerror=alert(1)>';
  await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[T02](https://attacker.invalid/secret)', 'co-lead': injection } }); await refresh();
  await firstChild().getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await page.locator('#detail-content .task-link-records summary').click();
  assert.match(await page.locator('#detail-content').innerText(), /attacker.invalid/); assert.match(await page.locator('#detail-content').innerText(), /<img/);
  assert.equal(await page.locator('img[src="x"],a[href*="attacker.invalid"]').count(), 0);
  assert.equal(requests.some(url => !url.startsWith(f.url)), false);
  await page.keyboard.press('Escape');
  report.checks.push('Stale parent stays explicitly unknown; unknown ID and wrong path cannot navigate; HTML/remote declarations stay text and cause zero remote reads');
  await f.writeStatus(sub, { human: { ...subRows, 当前阻塞: 'ACTIVE: 子任务待资料', 需用户决定: 'REQUIRED: 子任务需选择' } }); await refresh();
  assert.match(await page.locator('#blockers').innerText(), /子任务待资料/);
  assert.match(await page.locator('#decisions').innerText(), /子任务需选择/);
  assert.equal(await page.locator('#active-work .task-row').count(), 1);
  await showOther();
  report.checks.push('Independent child blocker/decision stay visible; unknown allocation label retained');
  for (const viewport of [{ label: 'desktop', width: 1280, height: 720 }, { label: 'narrow', width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme').selectOption(theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const name = `home-${viewport.label}-${theme}.png`;
      await page.screenshot({ path: path.join(output, name), fullPage: false, animations: 'disabled' }); report.screenshots.push(name);
    }
  }
  await firstChild().getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await page.locator('#detail-content .task-link-records summary').focus(); await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.locator('#task-dialog').evaluate(node => node.scrollWidth <= node.clientWidth), true);
  const detailShot = 'detail-narrow-dark.png'; await page.screenshot({ path: path.join(output, detailShot), animations: 'disabled' }); report.screenshots.push(detailShot);
  await page.keyboard.press('Escape');
  report.checks.push('1280×720 and 390×844 light/dark home and narrow detail: no horizontal overflow, reduced-motion, keyboard raw record');
  assert.deepEqual(report.errors, []); report.outcome = 'passed';
} catch (error) { report.failure = error.stack; report.outcome = 'failed'; throw error; }
finally {
  clearTimeout(deadline);
  const cleanupErrors = [];
  try { await browser?.close(); } catch (error) { cleanupErrors.push(String(error)); }
  for (const cleanup of cleanups.reverse()) try { await cleanup(); } catch (error) { cleanupErrors.push(String(error)); }
  report.fixtureRemoved = f ? await stat(f.root).then(() => false, error => { if (error.code === 'ENOENT') return true; throw error; }) : null;
  report.serverClosed = f ? !f.server.listening : null;
  report.cleanupErrors = cleanupErrors;
  report.elapsedMs = Date.now() - started;
  report.cumulativeMs = spentMs + report.elapsedMs;
  await writeFile(path.join(output, 'browser-budget.json'), JSON.stringify({ spentMs: report.cumulativeMs, limitMs: budgetMs, cleanupReserveMs }) + '\n');
  if (cleanupErrors.length || report.fixtureRemoved === false || report.serverClosed === false || report.cumulativeMs > budgetMs) { report.outcome = 'failed'; process.exitCode = 1; }
  report.evidenceBytes = (await Promise.all((await readdir(output)).map(async name => (await stat(path.join(output, name))).size))).reduce((a,b) => a+b, 0);
  if (report.evidenceBytes > 8 * 1024 * 1024) { report.outcome = 'failed'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString(); await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ outcome: report.outcome, checks: report.checks.length, screenshots: report.screenshots, errors: report.errors }));
