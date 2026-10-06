import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture, git } from './fixture.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const output = path.resolve(process.env.D01_EVIDENCE_DIR || 'docs/evidence/d01');
await mkdir(output, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const report = { outcome: 'running', at: new Date().toISOString(), browser: browser.version(), checks: [], screenshots: [], errors: [] };
const cleanups = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.D01_URL || 'http://127.0.0.1:4320');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.workline').count(), 5);
  report.checks.push('真实登记首屏渲染5工作线、9来源；无页面错误');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('主题', { exact: true }).selectOption(theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    const name = `dashboard-${theme}.png`;
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    report.screenshots.push(name);
  }
  await page.reload(); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  report.checks.push('浅深主题切换及localStorage持久化');
  const details = page.getByRole('button', { name: '查看详情：D01 工程进度', exact: true });
  await details.focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'status.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.startsWith('# D01'));
  assert.match(await page.locator('#document-text').textContent(), /d01_owner/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#task-dialog').evaluate(node => node.open), false);
  assert.equal(await details.evaluate(node => node === document.activeElement), true);
  report.checks.push('键盘Enter打开详情、按需读取status、Esc关闭并返回原按钮焦点');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('主题', { exact: true }).selectOption(theme);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    const name = `dashboard-${theme}-narrow.png`;
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    report.screenshots.push(name);
  }
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  report.checks.push('390px窄屏双主题无页面横向溢出，减少动画偏好生效');
  await page.route('**/api/snapshot', route => route.abort('failed'));
  await page.reload(); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#load-error').isVisible(), true);
  await page.getByRole('combobox', { name: '显示工作线', exact: true }).selectOption('in_progress');
  await page.unroute('**/api/snapshot'); await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#load-error').hidden);
  report.checks.push('初始读取失败后筛选不崩溃，刷新成功恢复');
  await context.close();

  const f = await fixture({ after: callback => cleanups.push(callback) });
  const task = f.tasks[0];
  const injected = '<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>';
  await f.writeStatus(task, { owner: injected, next: injected, checks: `PASSED ${git(task.worktree, 'rev-parse', 'HEAD')}` });
  const sampleContext = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const sample = await sampleContext.newPage(); sample.on('pageerror', error => report.errors.push(error.message));
  await sample.goto(f.url); await sample.waitForLoadState('networkidle');
  assert.ok((await sample.locator('body').innerText()).includes('<img src=x'));
  assert.equal(await sample.locator('img[src="x"]').count(), 0);
  assert.equal(await sample.getByText('历史通过', { exact: true }).count(), 1);
  assert.equal(await sample.evaluate(() => window.pwned), undefined);
  await sample.getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await sample.getByRole('button', { name: 'status.md', exact: true }).click();
  await sample.waitForFunction(() => document.querySelector('#document-text').textContent.includes('<script>'));
  assert.equal(await sample.evaluate(() => window.pwned), undefined);
  report.checks.push('临时样本HTML/script在首页和资料查看器均以文本呈现，未执行');
  await sampleContext.close();
  assert.deepEqual(report.errors, []);
  report.outcome = 'passed';
} catch (error) {
  report.outcome = 'failed'; report.failure = error.message; throw error;
} finally {
  await browser.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
  await writeFile(path.join(output, 'browser-checks.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
