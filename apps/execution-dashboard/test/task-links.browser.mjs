import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fixture } from './fixture.mjs';

const output = path.resolve('docs/evidence/d08');
const sources = ['src/task-links.mjs', 'src/status.mjs', 'src/aggregate.mjs', 'public/app.js', 'public/styles.css', 'test/task-links.test.mjs', 'test/task-links.browser.mjs'].map(file => `apps/execution-dashboard/${file}`);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const cleanups = [];
const f = await fixture({ after: callback => cleanups.push(callback) });
const [sub, parent] = f.tasks;
const human = { 阶段: 'M2', 优先级: '1', 当前产出: '任务关系可从唯一记录核对', 下一可用交付: '核对父任务与责任人', 当前阻塞: 'NONE', 需用户决定: 'NONE' };
const parentRows = { ...human, 任务层级: '大task', '大task ID': '[T02](plan.md)', 'co-lead': 'Web /root（执行管理 d01_owner）' };
const subRows = { ...human, 所属大task: `[T02](${parent.worktree}/${parent.planDir}/plan.md)`, 'co-lead': 'Web /root（执行管理 d01_owner）' };
await f.writeStatus(parent, { human: parentRows }); await f.writeStatus(sub, { human: subRows });
if (process.argv.includes('--preview')) {
  console.log(JSON.stringify({ url: f.url, fixture: 'Temporary Git sources; no real owner status or coordination changes', sourceHead: git('rev-parse', 'HEAD') }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { for (const cleanup of cleanups.reverse()) await cleanup(); process.exit(0); });
} else {
  await mkdir(output, { recursive: true });
  const report = { at: new Date().toISOString(), sourceHead: git('rev-parse', 'HEAD'), sourceDirty: Boolean(git('status', '--porcelain')), sourceHashes: Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]))), url: f.url, checks: [], screenshots: [], errors: [], failure: null };
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(async error => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    throw error;
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  const requests = []; page.on('request', request => requests.push(request.url()));
  const ready = () => page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  const refresh = async () => { await page.locator('#refresh').click(); await page.waitForFunction(() => !document.querySelector('#refresh').disabled); await ready(); };
  const firstChild = () => page.locator('#active-work .task-row').filter({ has: page.locator('.task-code', { hasText: 'T01' }) });
  try {
    await page.goto(f.url); await ready();
    assert.match(await firstChild().innerText(), /查看所属大task T02/);
    assert.match(await firstChild().innerText(), /Web \/root（执行管理 d01_owner）/);
    assert.match(await page.locator('#active-work').innerText(), /大task · 无所属父任务/);
    const raw = firstChild().locator('.task-link-records');
    await raw.locator('summary').focus(); await page.keyboard.press('Enter'); assert.equal(await raw.getAttribute('open'), '');
    assert.match(await raw.innerText(), /\[T02\]/); assert.equal(await raw.locator('a').count(), 0);
    await page.keyboard.press('Space'); assert.equal(await raw.getAttribute('open'), null);
    report.checks.push('Explicit parent/co-lead on home; big task has no parent; Enter/Space toggles text-only raw declarations');
    const parentButton = firstChild().getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true });
    await parentButton.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor({ state: 'visible' }); assert.equal(await page.locator('#detail-id').textContent(), 'T02');
    await page.getByRole('button', { name: 'plan.md', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#document-text').textContent.includes('# 计划'));
    const documentReads = requests.filter(url => new URL(url).pathname === '/api/document');
    assert.equal(documentReads.length, 1); assert.equal(new URL(documentReads[0]).searchParams.get('task'), 'T02'); assert.equal(new URL(documentReads[0]).searchParams.get('path'), `${parent.planDir}/plan.md`);
    await page.keyboard.press('Escape'); assert.equal(await parentButton.evaluate(node => node === document.activeElement), true);
    report.checks.push('Parent Enter opens registered task; plan uses existing registered document endpoint; Escape returns invoker');
    const detailsButton = firstChild().getByRole('button', { name: '查看详情：T01 任务 T01', exact: true });
    await detailsButton.focus(); await page.keyboard.press('Enter');
    const nestedParent = page.locator('#detail-content').getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true });
    await nestedParent.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#detail-id').textContent(), 'T02'); assert.equal(await page.locator('#detail-title').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape'); assert.equal(await detailsButton.evaluate(node => node === document.activeElement), true);
    report.checks.push('Child detail to parent stays in one modal, focuses new title, and returns original child invoker on Escape');
    await f.writeStatus(parent, { human: parentRows, updated: '2026-10-01 00:00 UTC' }); await refresh();
    assert.match(await firstChild().innerText(), /关系未知.*登记资料/); assert.match(await firstChild().innerText(), /陈旧/);
    await f.writeStatus(parent, { human: parentRows });
    await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[NOT-REGISTERED](/private/secret)' } }); await refresh();
    assert.match(await firstChild().innerText(), /父任务未登记/); assert.equal(await firstChild().locator('[data-open-task="NOT-REGISTERED"]').count(), 0);
    await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[T02](/private/secret)' } }); await refresh();
    assert.match(await firstChild().innerText(), /链接不一致/); assert.equal(await firstChild().locator('.task-links button').count(), 0);
    const injection = '<img src=x onerror=alert(1)>';
    await f.writeStatus(sub, { human: { ...subRows, 所属大task: '[T02](https://attacker.invalid/secret)', 'co-lead': injection } }); await refresh();
    await firstChild().locator('.task-link-records summary').click();
    assert.match(await firstChild().innerText(), /attacker.invalid/); assert.match(await firstChild().innerText(), /<img/);
    assert.equal(await page.locator('img[src="x"],a[href*="attacker.invalid"]').count(), 0);
    assert.equal(requests.some(url => !url.startsWith(f.url)), false);
    report.checks.push('Stale parent stays explicitly unknown; unknown ID and wrong path cannot navigate; HTML/remote declarations stay text and cause zero remote reads');
    await f.writeStatus(sub, { human: subRows }); await refresh();
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
    await browser.close(); for (const cleanup of cleanups.reverse()) await cleanup();
    report.finishedAt = new Date().toISOString(); await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ outcome: report.outcome, checks: report.checks.length, screenshots: report.screenshots, errors: report.errors }));
}
