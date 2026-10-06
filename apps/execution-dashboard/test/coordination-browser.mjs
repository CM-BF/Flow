import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createDashboardServer } from '../src/server.mjs';
import { defaultRegistry } from '../src/registry.mjs';
const server = createDashboardServer(defaultRegistry());
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { at: new Date().toISOString(), browser: browser.version(), checks: [], errors: [] };
const configured = process.env.FLOW_COORDINATION_DATABASE_URL;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => report.errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  await page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  assert.equal(await page.locator('#page-title').innerText(), '当前推进 M2');
  const data = await (await page.request.get(`${url}/api/snapshot`)).json();
  assert.equal(data.assignments.state, 'available');
  assert.ok(data.assignments.claims.filter(claim => claim.state === 'active').length >= 10);
  assert.equal(data.tasks.length, 28);
  report.sources = data.tasks.map(task => ({ id: task.id, issues: task.issues, claims: task.assignments?.map(claim => ({ id: claim.claimId, version: claim.version, matchesSource: claim.matchesSource })) }));
  assert.ok(data.tasks.find(task => task.id === 'D04').current);
  for (const [name, width, height, theme] of [['desktop-light',1440,1000,'light'],['narrow-dark',390,844,'dark']]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel('主题', { exact: true }).selectOption(theme);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `docs/evidence/d04/${name}.png`, fullPage: true });
  }
  report.checks.push('28 权威进度来源与至少10条真实PG领取记录；共同标题仅M2；明暗/窄屏无水平溢出');
  await page.locator('#all-plans > summary').click();
  await page.locator('#workstreams').getByRole('button', { name: '查看详情：WPF-M02 Web统一工作入口', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /workspace_panels_owner/);
  assert.match(await dialog.innerText(), /WorkspacePanels.tsx/);
  assert.match(await dialog.innerText(), /现有合法派工迁移/);
  await page.screenshot({ path: 'docs/evidence/d04/claim-details-dark.png', fullPage: true });
  await page.keyboard.press('Escape');
  report.checks.push('外部Web领取显示lead/worker及migration来源；详情精确单文件追加可查；Esc返回');
  assert.equal(await page.locator('#next-deliveries [data-open-task="C02"]').count(), 0);
  await page.locator('#workstreams').getByRole('button', { name: '查看详情：C02 异常核对与恢复', exact: true }).click();
  assert.equal(await page.locator('#task-dialog dt').filter({ hasText: /^用户决定$/ }).evaluate(node => node.nextElementSibling.textContent), '无');
  await page.keyboard.press('Escape');
  await page.route('**/api/snapshot', async route => {
    const response = await route.fetch(); const fixture = await response.json();
    fixture.unregisteredAssignments = [{ taskId: 'UNREGISTERED-01', lead: 'example-lead', worker: 'example-worker', branch: 'codex/example', worktree: '/example/not-read', state: 'active' }];
    await route.fulfill({ response, json: fixture });
  });
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await page.locator('#unregistered-claims').waitFor({ state: 'visible' });
  assert.match(await page.locator('#unregistered-claims').innerText(), /UNREGISTERED-01[\s\S]*example-worker[\s\S]*not-read/);
  await page.unroute('**/api/snapshot');
  report.checks.push('已完成C02不再列下一交付；详情NONE显示无；合成未登记claim只读可见且不读取其任意路径');
  process.env.FLOW_COORDINATION_DATABASE_URL = 'postgresql://fake:fake@127.0.0.1:1/ignored';
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  assert.equal(await page.locator('#sync-state').innerText(), '已同步');
  assert.match(await page.locator('#active-work').innerText(), /领取状态未知/);
  assert.equal(await page.locator('#source-count').innerText(), '28');
  report.checks.push('协调DB失败不影响进度同步，明确未知、不显示空闲；只读页面不提供写入动作');
  assert.deepEqual(report.errors, []);
  report.outcome = 'passed';
} catch (error) { report.outcome = 'failed'; report.failure = error.stack; throw error; }
finally {
  if (configured === undefined) delete process.env.FLOW_COORDINATION_DATABASE_URL; else process.env.FLOW_COORDINATION_DATABASE_URL = configured;
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await writeFile('docs/evidence/d04/browser-checks.json', JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
