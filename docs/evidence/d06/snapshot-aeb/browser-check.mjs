import { chromium } from '@playwright/test';
import { writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { startPreview } from './preview.mjs';
const started = performance.now();
let preview, browser, failure;
const report = {};
const deadline = setTimeout(() => { failure = new Error('80 second execution budget exhausted; cleanup reserved'); browser?.close().catch(() => {}); }, 80_000);
const sources = ['apps/execution-dashboard/public/architecture-data.js', 'apps/execution-dashboard/test/architecture.test.mjs', 'docs/evidence/d06/snapshot-aeb/browser-check.mjs', 'docs/evidence/d06/snapshot-aeb/preview.mjs', 'docs/evidence/d06/snapshot-aeb/source-audit.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const errors = [];
const requests = [];
const observations = [];
try {
  preview = await startPreview(); const base = preview.base; report.base = base;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('request', request => { if (request.url().includes('/api/')) requests.push(new URL(request.url()).pathname); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#architecture`);
  await page.locator('#architecture-canvas [data-node]').first().waitFor();
  assert.match(await page.locator('#architecture-baseline').textContent(), /aeb764e5d2c2ec043ae8673cde2724f5330db2ab/);
  const heading = page.locator('.architecture-heading p');
  assert.match(await heading.innerText(), /固定源码快照 aeb764e5.*源码核验于.*UTC.*非实时运行拓扑/);
  assert.equal(await heading.locator('a').getAttribute('href'), 'https://github.com/CM-BF/Flow/tree/aeb764e5d2c2ec043ae8673cde2724f5330db2ab');
  for (const id of ['runtime', 'modules', 'data', 'states', 'dependencies']) {
    await page.locator('#architecture-view').selectOption(id);
    const nodes = page.locator('#architecture-canvas [data-node]');
    const count = await nodes.count();
    assert.ok(count > 5);
    const overflow = await nodes.evaluateAll(items => items.flatMap(item => [...item.querySelectorAll('text')].filter(text => text.getBBox().x + text.getBBox().width > 222).map(text => text.textContent)));
    assert.deepEqual(overflow, [], `${id} node labels must fit their boxes`);
    await nodes.last().focus();
    await page.keyboard.press('Enter');
    assert.equal(await nodes.last().getAttribute('aria-pressed'), 'true');
    await page.locator('#architecture-node-content summary').click();
    const source = await page.locator('#architecture-node-content a').getAttribute('href');
    assert.ok(source.includes('/blob/aeb764e5d2c2ec043ae8673cde2724f5330db2ab/'));
    observations.push({ view: id, nodes: count, keyboardSelect: true, source });
  }
  await page.locator('#architecture-view').selectOption('runtime');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/runtime-light.png', fullPage: true });
  await page.locator('#architecture-view').selectOption('modules');
  for (const [id, expected] of [['goals', /统一读取有界plan/], ['interaction', /TUI goal consumer已挂载/], ['workspace', /synthetic/], ['nativewriter', /没有production NativeWriteAuthority/], ['checker', /尚未接中心/], ['activity', /input-ready不当作running/], ['stream', /patch-v1/], ['steering', /不证明模型遵循/], ['nativecontrol', /默认无配置关闭/], ['fetches', /不执行第三方/], ['renderers', /当前App按各pane/], ['web', /真实绑定与登录\/未决恢复尚未含/], ['codexadapter', /真实auth\/provider验收仍后继/], ['tui', /不声称与Web所有控件对等/]]) {
    const node = page.locator(`[data-node=${id}]`); await node.focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#architecture-node-content').innerText(), expected);
  }
  await page.locator('[data-node=proposals]').focus();
  await page.keyboard.press('Space');
  assert.match(await page.locator('#architecture-node-content').innerText(), /G01事务/);
  await page.locator('#architecture-fit').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('#architecture-viewport').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/modules-light.png', fullPage: true });
  await page.locator('#architecture-viewport').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/modules-bottom-light.png', fullPage: true });
  await page.locator('#architecture-view').selectOption('states');
  await page.locator('#architecture-fit').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/states-light.png', fullPage: true });
  await page.locator('#theme').selectOption('dark');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/states-dark.png', fullPage: true });
  await page.locator('#architecture-view').selectOption('data');
  await page.locator('#architecture-fit').click();
  for (const [id, expected] of [['attachments', /lookup404不证/], ['history', /attachment-only min1不兼容/]]) {
    await page.locator(`[data-node=${id}]`).focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#architecture-node-content').innerText(), expected);
  }
  await page.locator('[data-node="assistant"]').click();
  assert.match(await page.locator('#architecture-node-content').innerText(), /PG details/);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/data-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#architecture-fit').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/data-dark-narrow.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#theme').selectOption('light');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'docs/evidence/d06/snapshot-aeb/data-light-narrow.png', fullPage: true });
  await page.locator('#architecture-zoom-in').click();
  await page.locator('#architecture-zoom-out').click();
  assert.ok(await heading.isVisible());
  assert.equal(await heading.locator('a').getAttribute('title'), 'aeb764e5d2c2ec043ae8673cde2724f5330db2ab');
  assert.deepEqual(errors, []);
  assert.ok(requests.every(path => path === '/api/snapshot'), 'No product API is called by the architecture preview');
  Object.assign(report, { browser: await browser.version(), passed: true });
} catch (error) { failure = error; report.passed = false; report.error = { name: error.name, message: error.message, stack: error.stack }; }
finally {
  clearTimeout(deadline);
  const cleanupStarted = performance.now();
  const cleanup = await Promise.allSettled([browser?.close(), preview?.close()]);
  Object.assign(report, { at: new Date().toISOString(), sourceCommit, sourceDirty, sourceHashes, requests, observations, pageErrors: errors, narrowWidth: 390, reducedMotion: 'reduce', elapsedMs: performance.now() - started, cleanupMs: performance.now() - cleanupStarted, cleanup: cleanup.map(x => x.status), scope: 'actual local static renderer / synthetic empty snapshot; no registry, ledger, product DB, provider or personal service' });
  if (report.elapsedMs > 90_000 || cleanup.some(x => x.status === 'rejected')) { report.passed = false; failure ??= new Error('Bounded preview cleanup failed'); }
  let bytes = 0;
  for (const file of await readdir('docs/evidence/d06/snapshot-aeb')) bytes += (await stat(`docs/evidence/d06/snapshot-aeb/${file}`)).size;
  report.evidenceBytesBeforeReport = bytes;
  if (bytes > 8 * 1024 * 1024) { report.passed = false; failure ??= new Error('Evidence exceeds 8 MiB'); }
  await writeFile('docs/evidence/d06/snapshot-aeb/browser-checks.json', JSON.stringify(report, null, 2) + '\n');
}
if (failure) { console.error(failure); process.exitCode = 1; }
