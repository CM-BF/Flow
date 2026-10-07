import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baseline, views } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-runtime/apps/execution-dashboard/public/architecture-data.js';

const publicRoot = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-runtime/apps/execution-dashboard/public';
const assets = new Map(['index.html', 'app.js', 'styles.css', 'architecture.js', 'architecture-data.js', 'architecture.css'].map(name => [`/${name}`, name]));
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css' };
const fixedMain = '0da869f7bad98771177472539b5a192365c15117';

// Reuses the viewport fixture's static allowlist and snapshot-aeb's empty snapshot shape.
// No server/aggregate/registry/ledger import; real six frontend assets are served unchanged.
async function startStaticPreview(requests) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    requests.push({ method: request.method, path: pathname });
    const send = (status, body, type = 'application/json') => response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
    if (request.method !== 'GET') return send(405, '{}');
    if (pathname === '/api/snapshot') return send(200, JSON.stringify({
      generatedAt: new Date().toISOString(), main: { available: false }, tasks: [],
      assignments: { state: 'unavailable', claims: [] }, unregisteredAssignments: [],
      overview: { phase: 'Fixture', activeIds: [], otherActiveIds: [], deliveryIds: [], decisionIds: [], blockerIds: [], unknownIds: [], historyIds: [] },
      milestones: { taskId: null, current: false, todos: [] },
    }));
    const asset = assets.get(pathname === '/' ? '/index.html' : pathname);
    if (!asset) return send(404, '{}');
    try { send(200, await readFile(join(publicRoot, asset)), mime[asset.split('.').at(-1)]); }
    catch { send(500, '{}'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

export async function checkArchitectureBrowser({ browser, expect, outputDirectory }) {
  const report = { state: 'FAILED', fixedMain, checks: [], observations: [], screenshots: [], requests: [], externalRequests: [], pageErrors: [], cleanupErrors: [], contextClosed: false, httpClosed: false };
  let fixture, context;
  try {
    assert.equal(baseline.commit, fixedMain);
    assert.deepEqual(views.map(view => view.id), ['runtime', 'modules', 'data', 'states', 'dependencies']);
    fixture = await startStaticPreview(report.requests);
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixture.origin) { report.externalRequests.push(url.origin); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(`${fixture.origin}/#architecture`);
    await expect(page.locator('#architecture-view option')).toHaveCount(5);
    await expect(page.locator('#architecture-baseline')).toContainText(fixedMain);
    await expect(page.locator('.architecture-heading p a')).toHaveAttribute('href', `https://github.com/CM-BF/Flow/tree/${fixedMain}`);

    for (const view of views) {
      for (const [width, height] of [[1280, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const theme of ['light', 'dark']) {
          await page.locator('#theme').selectOption(theme);
          await page.locator('#architecture-view').selectOption(view.id);
          await page.locator('#architecture-fit').click(); await settle(page);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const nodes = page.locator('#architecture-canvas [data-node]');
          await expect(nodes).toHaveCount(view.nodes.length);
          const labels = await nodes.evaluateAll(items => items.map(item => ({ id: item.dataset.node, title: item.querySelector('.node-title').textContent, subtitle: item.querySelector('.node-subtitle').textContent })));
          assert.deepEqual(labels, view.nodes.map(node => ({ id: node.id, title: node.label, subtitle: node.subtitle })));
          const geometry = await page.locator('#architecture-canvas').evaluate(canvas => {
            const outside = [];
            for (const node of canvas.querySelectorAll('[data-node]')) for (const text of node.querySelectorAll('text')) {
              const box = text.getBBox();
              if (box.x < 0 || box.y < 0 || box.x + box.width > 225 || box.y + box.height > 80) outside.push({ node: node.dataset.node, text: text.textContent });
            }
            const bounds = canvas.viewBox.baseVal;
            const contains = (outer, inner) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
            for (const node of canvas.querySelectorAll('[data-node]')) {
              const local = node.getBBox(), matrix = node.transform.baseVal.consolidate().matrix;
              if (!contains(bounds, { x: local.x + matrix.e, y: local.y + matrix.f, width: local.width, height: local.height })) outside.push({ node: node.dataset.node, reason: 'canvas boundary' });
            }
            const edges = [...canvas.querySelectorAll('.architecture-edge')].map(edge => {
              const text = edge.querySelector('text'), background = edge.querySelector('rect'), path = edge.querySelector('path');
              return { label: text.textContent, length: path.getTotalLength(), marker: path.getAttribute('marker-end'), textFitsBackground: contains(background.getBBox(), text.getBBox()), fitsCanvas: contains(bounds, edge.getBBox()) };
            });
            const viewport = document.querySelector('#architecture-viewport');
            return { outside, edges, pageOverflow: document.documentElement.scrollWidth > innerWidth, localScrollWidth: viewport.scrollWidth, localClientWidth: viewport.clientWidth, canvasWidth: Number(canvas.getAttribute('width')) };
          });
          assert.deepEqual(geometry.outside, [], `${view.id}/${theme}/${width} node labels fit 225x80`);
          assert.deepEqual(geometry.edges.map(edge => edge.label), view.edges.map(edge => edge.label));
          assert.ok(geometry.edges.every(edge => Number.isFinite(edge.length) && edge.length > 0 && edge.marker === 'url(#architecture-arrow)'));
          assert.deepEqual(geometry.edges.filter(edge => !edge.textFitsBackground || !edge.fitsCanvas), [], `${view.id}/${theme}/${width} edge text/background and canvas bounds`);
          assert.equal(geometry.pageOverflow, false, 'page must not overflow horizontally');
          if (width === 390) assert.ok(geometry.localScrollWidth > geometry.localClientWidth, 'graph retains local scroll at readable minimum');
          const last = nodes.last(); await last.focus(); await page.keyboard.press(theme === 'light' ? 'Enter' : 'Space');
          await expect(last).toHaveAttribute('aria-pressed', 'true');
          await expect(page.locator('#architecture-node-title')).toHaveText(view.nodes.at(-1).label);
          const disclosure = page.locator('#architecture-node-content details');
          if (!(await disclosure.getAttribute('open'))) await disclosure.locator('summary').click();
          await expect(page.locator('#architecture-node-content a')).toHaveAttribute('href', `https://github.com/CM-BF/Flow/blob/${fixedMain}/${view.nodes.at(-1).source}`);
          const png = `${view.id}-${width}-${theme}.png`;
          await page.screenshot({ path: join(outputDirectory, png), fullPage: true });
          report.screenshots.push(png); report.observations.push({ view: view.id, width, height, theme, nodes: labels.length, ...geometry });
        }
      }
      report.checks.push(`${view.id}: fixed labels/edges, 1280+390, light+dark, keyboard+source`);
    }
    for (const [view, id, text] of [
      ['modules', 'web', '私有附件host和上传身份journal已接真实Thread/Send/Queue。'],
      ['modules', 'checker', '中心已接v2声明/收据校验；嵌套check仍writerSettlement=not-attested。'],
      ['modules', 'nativewriter', '没有production NativeWriteAuthority或主入口绑定。'],
      ['data', 'history', '附件-only与mixed均显式unknown inventory/metadata-unavailable'],
      ['states', 'passed', 'flow.engineering.native-receipt.v1。'],
    ]) {
      await page.locator('#architecture-view').selectOption(view);
      await page.locator(`[data-node="${id}"]`).focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#architecture-node-content')).toContainText(text);
    }
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.ok(report.requests.every(request => request.method === 'GET' && (request.path === '/' || request.path === '/api/snapshot' || request.path === '/favicon.ico' || assets.has(request.path))));
    report.state = 'PASSED';
  } catch (error) { report.error = String(error.stack ?? error).slice(0, 8192); }
  finally {
    try { if (context) { await context.close(); report.contextClosed = true; } } catch (error) { report.cleanupErrors.push('context: ' + error.message); }
    try { if (fixture) { await fixture.close(); report.httpClosed = true; } } catch (error) { report.cleanupErrors.push('HTTP: ' + error.message); }
    if (report.cleanupErrors.length || !report.contextClosed || !report.httpClosed) report.state = 'FAILED';
    await writeFile(join(outputDirectory, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  // Return structured failure so the existing worker can retain the completed subset.
  return report;
}
