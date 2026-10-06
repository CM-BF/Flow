import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fixture, git, commit } from './fixture.mjs';
import { createDashboardServer } from '../src/server.mjs';
import { defaultRegistry } from '../src/registry.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const output = path.resolve(process.env.D03_EVIDENCE_DIR || 'docs/evidence/d03');
await mkdir(output, { recursive: true });
const cleanups = [];
const report = { outcome: 'running', at: new Date().toISOString(), sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()), checks: [], screenshots: [], errors: [] };
const browser = await playwright.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
report.browser = browser.version();
const ready = page => page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
async function refresh(page) { await page.getByRole('button', { name: '刷新状态', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#refresh').disabled); }
try {
  const server = createDashboardServer(defaultRegistry());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  report.livePort = server.address().port;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${report.livePort}`); await ready(page);
  assert.equal(await page.locator('#source-count').textContent(), '20');
  assert.equal(await page.locator('#history-section').getAttribute('open'), null);
  assert.equal(await page.locator('#unknown-section').getAttribute('open'), null);
  assert.ok(await page.locator('#active-work .task-row').count() <= 3);
  const live = await (await page.request.get(`http://127.0.0.1:${report.livePort}/api/snapshot`)).json();
  report.liveSources = live.tasks.map(task => ({ id: task.id, head: task.git.head, dirty: task.git.dirty, current: task.current, missing: task.status.human?.missing, reviewTarget: task.review.target, review: task.review.state, mainMethod: task.main.method }));
  if (live.overview.otherActiveIds.length) {
    await page.locator('#other-activity > summary').click();
    assert.equal(await page.locator('#other-activity-items .task-row').count(), live.overview.otherActiveIds.length);
    await page.locator('#other-activity > summary').click();
  }
  report.checks.push('top3 以外活动任务可展开，历史缺摘要不计当前缺口；实际 20 权威源；当前工作最多 3 项；完成历史和摘要缺口默认收起');
  for (const size of [{ label: 'desktop', width: 1440, height: 1000 }, { label: 'narrow', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('主题', { exact: true }).selectOption(theme);
      await page.reload(); await ready(page);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const name = `live-${size.label}-${theme}.png`;
      await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' }); report.screenshots.push(name);
    }
  }
  report.checks.push('1440px / 390px 浅深主题；页面无横向溢出，四张实际源截图');
  await page.reload(); await ready(page); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#all-plans > summary').click();
  const details = page.locator('#workstreams').getByRole('button', { name: '查看详情：D03 进度的人类视图', exact: true });
  await details.focus(); await page.keyboard.press('Enter'); await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'status.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.startsWith('# D03'));
  assert.match(await page.locator('#document-text').textContent(), /runner_owner/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.keyboard.press('Escape'); assert.equal(await details.evaluate(node => node === document.activeElement), true);
  report.checks.push('主题持久化；窄屏键盘 Enter 打开、读取权威 status、Esc 关闭并恢复焦点；详情不溢出');
  await page.route('**/api/snapshot', route => route.abort('failed'));
  await page.reload(); await page.locator('#load-error').waitFor({ state: 'visible' });
  await page.unroute('**/api/snapshot'); await refresh(page); await ready(page);
  assert.equal(await page.locator('#load-error').isVisible(), false);
  report.checks.push('首次读取失败明确提示，手动刷新恢复');
  await context.close();

  const f = await fixture({ after: callback => cleanups.push(callback) }); const task = f.tasks[0];
  await mkdir(path.join(task.worktree, 'apps/demo'), { recursive: true });
  await writeFile(path.join(task.worktree, 'apps/demo/main.js'), 'export const value=1;');
  const target = commit(task);
  const human = { 阶段: 'M2', 优先级: '1', 当前产出: '恢复流程已完成，等待隔离环境核对', 下一可用交付: '通过核对后接入统一入口', 当前阻塞: 'ACTIVE: 等待隔离环境测试文件', 需用户决定: 'NONE' };
  const options = { human, implementation: { target, scope: 'apps/demo/' }, checks: `PASSED ${target}`, next: 'DO_NOT_SHOW_ENGINEERING_TEXT', risks: '历史已解除 cap=1', decisions: '无新增事项' };
  await f.writeStatus(task, options);
  await f.writeStatus(f.tasks[1], { branchState: 'completed', todo: 'completed' });
  await writeFile(path.join(task.worktree, task.planDir, 'review.md'), `**状态：APPROVED**\nReview target commit：${target}\n`);
  git(f.registry.mainWorktree, 'fetch', task.worktree, target);
  git(f.registry.mainWorktree, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'merge', '--allow-unrelated-histories', '--no-edit', 'FETCH_HEAD');
  const sampleContext = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const sample = await sampleContext.newPage(); sample.on('pageerror', error => report.errors.push(error.message));
  await sample.goto(f.url); await ready(sample);
  assert.equal(await sample.locator('#decisions .task-row').count(), 0);
  assert.match(await sample.locator('#blockers').innerText(), /等待隔离环境测试文件/);
  assert.equal(await sample.locator('#unknown-count').textContent(), '0');
  assert.equal(await sample.locator('#history-count').textContent(), '1');
  assert.doesNotMatch(await sample.locator('body').innerText(), /DO_NOT_SHOW_ENGINEERING_TEXT|历史已解除|cap=1/);
  await sample.locator('#all-plans > summary').click();
  assert.equal(await sample.getByText('已审范围未变', { exact: true }).count(), 1);
  assert.equal(await sample.getByText('已合入，范围未变', { exact: true }).count(), 1);
  await sample.locator('#all-plans > summary').click();
  const sampleShot = 'fixture-current-blocker.png'; await sample.screenshot({ path: path.join(output, sampleShot), fullPage: true }); report.screenshots.push(sampleShot);
  await sample.locator('#history-section > summary').click(); assert.match(await sample.locator('#history-items').innerText(), /任务 T02/);
  await f.writeStatus(task, { ...options, human: { ...human, 当前阻塞: 'UNKNOWN', 需用户决定: 'REQUIRED: 选择用于交付的区域' } });
  await refresh(sample); assert.equal(await sample.locator('#unknown-count').textContent(), '1');
  await sample.locator('#unknown-section > summary').click(); assert.match(await sample.locator('#unknown-items').innerText(), /摘要待补/);
  assert.equal(await sample.locator('#blockers .task-row').count(), 0); assert.match(await sample.locator('#decisions').innerText(), /选择用于交付的区域/);
  await f.writeStatus(task, options); commit(task); await refresh(sample); await sample.locator('#all-plans > summary').click();
  assert.equal(await sample.getByText('已审范围未变', { exact: true }).count(), 1);
  await writeFile(path.join(task.worktree, 'apps/demo/new.js'), 'new untracked implementation'); await refresh(sample);
  assert.equal(await sample.getByText('待复审', { exact: true }).count(), 1);
  await rm(path.join(task.worktree, 'apps/demo/new.js')); await refresh(sample);
  assert.equal(await sample.getByText('已审范围未变', { exact: true }).count(), 1);
  await writeFile(path.join(f.registry.mainWorktree, 'apps/demo/main.js'), 'changed successor implementation');
  commit({ worktree: f.registry.mainWorktree }); await refresh(sample);
  assert.equal(await sample.getByText('曾合入，当前待核验', { exact: true }).count(), 1);
  assert.equal(await sample.getByText('已合入，范围未变', { exact: true }).count(), 0);
  report.checks.push('隔离真实 HTTP/Git 样本：NONE 不算决定，ACTIVE 才是阻塞，UNKNOWN 不算阻塞，REQUIRED 决定；历史折叠、缺字段待补；metadata 保留审查、未跟踪实现变更要求复审、main 祖先+范围证明、后继实现变化不继承绿色');
  const injected = '<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>';
  await f.writeStatus(task, { ...options, human: { ...human, 当前产出: injected }, owner: injected }); await refresh(sample);
  assert.match(await sample.locator('#active-work').innerText(), /<script>/); assert.equal(await sample.locator('img[src="x"]').count(), 0);
  await sample.locator('#active-work').getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await sample.getByRole('button', { name: 'status.md', exact: true }).click();
  await sample.waitForFunction(() => document.querySelector('#document-text').textContent.includes('<script>'));
  assert.equal(await sample.evaluate(() => window.pwned), undefined);
  report.checks.push('HTML/script 在摘要和原始资料中作为文本，不执行');
  await sampleContext.close(); assert.deepEqual(report.errors, []); report.outcome = 'passed';
} catch (error) { report.outcome = 'failed'; report.failure = error.stack; throw error; }
finally {
  await browser.close(); for (const cleanup of cleanups.reverse()) await cleanup();
  await writeFile(path.join(output, 'browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ outcome: report.outcome, checks: report.checks, screenshots: report.screenshots }, null, 2));
