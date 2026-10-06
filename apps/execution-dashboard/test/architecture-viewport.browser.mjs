import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const publicDir = path.join(root, 'apps/execution-dashboard/public');
const assets = new Map(['index.html', 'app.js', 'styles.css', 'architecture.js', 'architecture-data.js', 'architecture.css'].map(name => [`/${name}`, name]));
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css' };
let snapshots = 0;
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method !== 'GET') { response.writeHead(405).end(); return; }
  if (pathname === '/api/snapshot') {
    snapshots++;
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({
      generatedAt: new Date().toISOString(), tasks: [], main: { available: false, worktree: 'isolated static fixture' },
      overview: { phase: 'Fixture', activeIds: [], otherActiveIds: [], deliveryIds: [], decisionIds: [], blockerIds: [], unknownIds: [], historyIds: [] },
    })); return;
  }
  const filename = assets.get(pathname === '/' ? '/index.html' : pathname);
  if (!filename) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(path.join(publicDir, filename));
    response.writeHead(200, { 'content-type': mime[filename.split('.').at(-1)], 'cache-control': 'no-store' }).end(content);
  } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--preview')) {
  console.log(`D05FIT01 isolated static fixture ${origin}/#architecture`);
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} else {
  const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
  const label = process.env.D05FIT_LABEL || 'browser';
  assert.match(label, /^[a-z0-9-]+$/);
  const output = path.join(root, 'docs/evidence/d05-first-fit');
  await mkdir(output, { recursive: true });
  const sources = ['apps/execution-dashboard/public/architecture.js', 'apps/execution-dashboard/test/architecture-viewport.browser.mjs'];
  const report = {
    at: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    sourceHashes: Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')]))),
    checks: [], observations: [], pageErrors: [], requests: [], screenshots: [], passed: false,
  };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browser = browser.version();
  const geometry = page => page.locator('#architecture-viewport').evaluate(viewport => {
    const canvas = viewport.querySelector('svg'), style = getComputedStyle(viewport);
    return { available: viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), width: Number(canvas.getAttribute('width')), viewWidth: canvas.viewBox.baseVal.width, zoom: document.querySelector('#architecture-zoom').textContent, pageOverflow: document.documentElement.scrollWidth > innerWidth, scrollWidth: viewport.scrollWidth, clientWidth: viewport.clientWidth };
  });
  const expectFit = async page => {
    await expect.poll(async () => {
      const g = await geometry(page);
      return Math.abs(g.width - Math.round(g.viewWidth * Math.min(1, Math.max(.42, g.available / g.viewWidth))));
    }).toBeLessThanOrEqual(1);
  };
  const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/')) report.requests.push(new URL(request.url()).pathname); });
    await page.clock.install();
    await page.goto(`${origin}/#architecture`);
    await page.locator('#architecture-canvas [data-node]').first().waitFor();
    await expectFit(page);
    const initial = await geometry(page);
    assert.ok(initial.width <= initial.available + 1 && initial.width < initial.viewWidth, 'first desktop visit fits without clicking Fit');
    report.observations.push({ scenario: 'first desktop', ...initial });
    report.checks.push('direct #architecture first positive-width layout fits at1280x720');
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme').selectOption(theme);
      const file = `desktop-${theme}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file);
    }
    const zoomIn = page.getByRole('button', { name: '放大架构图' });
    await zoomIn.focus(); await page.keyboard.press('Enter');
    const manual = (await geometry(page)).width;
    assert.ok(manual > initial.width);
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(page);
    assert.equal((await geometry(page)).width, manual, 'manual zoom survives resize');
    const options = await page.locator('#architecture-view option').evaluateAll(items => items.map(item => item.value));
    for (const id of options.slice(1)) { await page.locator('#architecture-view').selectOption(id); await expectFit(page); }
    await page.locator('#architecture-view').selectOption(options[0]);
    assert.equal((await geometry(page)).width, manual, 'manual zoom survives visiting all other views');
    const node = page.locator('#architecture-canvas [data-node]').last();
    await node.focus(); await page.keyboard.press('Space');
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    const detail = await page.locator('#architecture-node-title').textContent();
    await page.getByRole('link', { name: '进度', exact: true }).click();
    await page.getByRole('button', { name: '刷新状态', exact: true }).click();
    await expect(page.locator('#sync-state')).toHaveText('已同步');
    await page.getByRole('link', { name: '架构', exact: true }).click();
    assert.equal((await geometry(page)).width, manual);
    assert.equal(await page.locator('#architecture-node-title').textContent(), detail);
    const beforeRefresh = snapshots; await page.clock.fastForward(21_000);
    await expect.poll(() => snapshots).toBeGreaterThan(beforeRefresh);
    assert.equal((await geometry(page)).width, manual, 'automatic progress snapshot preserves manual zoom');
    report.checks.push('manual keyboard zoom survives resize, five-view return, tab and manual/automatic snapshot refresh; selected node retained across tab');
    await page.locator('#architecture-fit').click(); await expectFit(page);
    await page.setViewportSize({ width: 1280, height: 720 }); await expectFit(page);
    await page.locator('#architecture-zoom-out').focus(); await page.keyboard.press('Space');
    const smaller = (await geometry(page)).width;
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(page);
    assert.equal((await geometry(page)).width, smaller, 'manual zoom-out remains manual');
    await page.locator('#architecture-fit').click(); await expectFit(page);
    report.checks.push('Fit restores responsive mode, zoom-out returns to manual mode');
    await page.close();

    const hidden = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    hidden.on('pageerror', error => report.pageErrors.push(error.message));
    await hidden.goto(`${origin}/#progress`); await expect(hidden.locator('#sync-state')).toHaveText('已同步');
    assert.equal(await hidden.locator('#architecture-viewport').evaluate(v => v.clientWidth), 0);
    await hidden.setViewportSize({ width: 1440, height: 900 });
    await hidden.getByRole('link', { name: '架构', exact: true }).click(); await expectFit(hidden);
    assert.ok((await geometry(hidden)).width > (await geometry(hidden)).viewWidth * .42 + 1, 'hidden layout did not freeze minimumzoom');
    await hidden.locator('#architecture-zoom-in').click();
    await hidden.reload(); await expectFit(hidden);
    report.checks.push('initial hidden progress page defers fit until visible; full page reload is a new visit');
    await hidden.close();

    const narrow = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    narrow.on('pageerror', error => report.pageErrors.push(error.message));
    await narrow.goto(`${origin}/#architecture`); await expectFit(narrow);
    for (const id of options) {
      await narrow.locator('#architecture-view').selectOption(id); await expectFit(narrow);
      const g = await geometry(narrow); assert.equal(g.pageOverflow, false); assert.equal(g.zoom, '42%');
      assert.ok(g.scrollWidth > g.clientWidth, 'minimum readable scale retains local scrolling');
      const last = narrow.locator('#architecture-canvas [data-node]').last(); await last.focus(); await narrow.keyboard.press('Enter');
      assert.equal(await last.getAttribute('aria-pressed'), 'true');
      report.observations.push({ scenario: `narrow ${id}`, ...g });
    }
    await narrow.locator('#architecture-view').selectOption(options[0]);
    for (const theme of ['light', 'dark']) {
      await narrow.locator('#theme').selectOption(theme);
      const file = `narrow-${theme}.png`; await narrow.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file);
    }
    report.checks.push('390x844 five views preserve42% minimum with local scrolling/no page overflow; keyboard node selection and both themes/reducedmotion');
    await narrow.close();
    assert.deepEqual(report.pageErrors, []);
    assert.ok(report.requests.every(p => p === '/api/snapshot'));
    report.passed = true;
  } catch (error) { report.failure = error.stack; throw error; }
  finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
    await writeFile(path.join(output, `${label}.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks, failure: report.failure ?? null }));
  }
}
