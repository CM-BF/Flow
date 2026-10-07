import { pathToFileURL } from 'node:url';
import { runBrowserCheck } from './summary-detail.browser.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseStatus } from '../src/status.mjs';
import { humanOverview } from '../src/human.mjs';

// Isolated rendering fixture: real parser and shipped UI, synthetic owner/Git
// observations. No registry, coordination database, provider, or default service.
const observedAt = '2026-10-07T03:00:00.000Z';
const source = { mode: 'live', stale: false, path: '/fixture/plans/t01/status.md', syncedAt: observedAt };
function ownerStatus(id, fields = {}) {
  const values = {
    '最近更新': observedAt, '单一 status owner': 'timing-fixture', Branch: 'codex/timing-fixture',
    '工作分支状态': 'in-progress', '检查状态': 'NOT_RUN', Review: 'NOT_STARTED', '已集成main状态': '尚未集成',
    '阶段': 'M2', '优先级': '1', '当前产出': '核对任务时间', '下一可用交付': '展示明确的时间来源',
    '当前阻塞': 'NONE', '需用户决定': 'NONE', '本片段交付阶段': 'implementation',
    '任务开工时间': '2026-10-07T01:00:00.000Z', '任务完成时间': 'NOT_COMPLETED',
    '任务时间来源': '开工：fixture-start 原始事件；完成：尚未发生', ...fields,
  };
  return `# ${id} 状态\n\n| 字段 | 值 |\n| --- | --- |\n${Object.entries(values).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\n| TODO ID | 状态 | Owner | 证据 |\n| --- | --- | --- | --- |\n| ${id}-01 | pending | timing-fixture | 本次尚未检查 |\n\n## 等待记录\n| ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源 |\n| --- | --- | --- | --- | --- | --- |\n| WAIT01 | UNKNOWN | OPEN | 审查 | 尚无结束证据 | fixture-wait |\n`;
}
function task(id, fields, overrides = {}) {
  return {
    id, title: `时间样本 ${id}`, branch: 'codex/timing-fixture', current: true,
    source: { ...source }, status: parseStatus(ownerStatus(id, fields), id), issues: [],
    progress: { completed: 0, total: 1 }, assignments: null, documents: [],
    git: { available: false, branch: null, head: null, dirty: null },
    review: { state: 'not_started', record: 'NOT_STARTED', target: null },
    main: { current: false, record: '尚未集成', reason: 'fixture 未核验 main', method: 'unknown', observedAt },
    links: { kind: 'big', parent: { state: 'none' }, coLead: { state: 'known', value: 'timing-fixture' } },
    ...overrides,
  };
}

export async function createTaskTimingFixture() {
  let state = { fields: {}, task: {}, generatedAt: observedAt, fail: false };
  let readId = 0;
  const registryFingerprint = 'isolated-timing-fixture';
  const assets = new Map([
    ['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']],
    ['/local-access.js', ['local-access.js', 'text/javascript']], ['/local-access.css', ['local-access.css', 'text/css']],
    ['/architecture.js', ['architecture.js', 'text/javascript']], ['/architecture-data.js', ['architecture-data.js', 'text/javascript']], ['/architecture.css', ['architecture.css', 'text/css']],
  ]);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://fixture.invalid');
      if (['/api/summary', '/api/task', '/api/assignments', '/api/snapshot'].includes(url.pathname)) {
        if (state.fail) { response.writeHead(503); response.end('fixture observation unavailable'); return; }
        const tasks = [task('T01', state.fields, state.task), task('T02', { '任务完成时间': '2026-10-07T02:30:00Z', '任务时间来源': '开工：fixture-start；完成：fixture-done' })];
        let overview = { phase: 'M2', activeIds: ['T01', 'T02'], deliveryIds: [], otherActiveIds: [], decisionIds: [], blockerIds: [], unknownIds: [], historyIds: [] };
        if (state.signals) {
          tasks[0].status = parseStatus(ownerStatus('T01', { 优先级: '8', 当前阻塞: 'ACTIVE: 同文 <img src=x>', 需用户决定: 'REQUIRED: 同文选择' }), 'T01');
          tasks[1].status = parseStatus(ownerStatus('T02', { 优先级: '1', 当前阻塞: 'ACTIVE: 同文 <img src=x>', 需用户决定: 'REQUIRED: 同文选择', 单一statusowner: 'child-owner' }), 'T02');
          tasks[1].status.owner = 'child-owner';
          tasks[1].links = { kind: 'subtask', parent: { state: state.unknownRelation ? 'unknown' : 'known', targetId: 'T01', reason: state.unknownRelation ? 'fixture 未核实关系' : '' }, coLead: { state: 'known', value: 'fixture' } };
          overview = humanOverview(tasks);
        }
        const digest = value => createHash('sha256').update(JSON.stringify(value.status)).digest('hex');
        const common = { version: 1, readId: String(++readId), registryFingerprint, generatedAt: state.generatedAt, startedAt: state.generatedAt, completedAt: state.generatedAt };
        let body;
        if (url.pathname === '/api/summary') body = { ...common, kind: 'summary', overview, tasks: tasks.map(value => {
          const { waiting, waitingTable, ...timing } = value.status.timing;
          return { id: value.id, title: value.title, sourceKey: `fixture:${value.id}`, sourceCurrent: value.current,
            source: { ...value.source, digest: digest(value), issues: [], readAt: state.generatedAt },
            declarations: { ...value.status, timing }, progress: value.progress, links: value.links,
            verification: { state: 'not_loaded' }, assignment: { state: 'pending' } };
        }) };
        else if (url.pathname === '/api/task') {
          const value = tasks.find(item => item.id === url.searchParams.get('task'));
          if (!value) { response.writeHead(404); response.end(); return; }
          body = { ...common, kind: 'task-detail', taskId: value.id, sourceKey: `fixture:${value.id}`,
            statusDigestBefore: digest(value), statusDigestAfter: digest(value), consistency: 'matched', task: value };
        } else if (url.pathname === '/api/assignments') body = { ...common, kind: 'assignments',
          assignments: { state: 'unknown', observedAt: state.generatedAt, claims: [], reason: 'isolated timing fixture; no PG authority' },
          byTask: { T01: null, T02: null }, unregisteredAssignments: [] };
        else body = { generatedAt: state.generatedAt, tasks, overview, unregisteredAssignments: [], main: { available: false, observedAt, worktree: '/fixture/main' } };
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(body)); return;
      }
      if (url.pathname === '/api/local-access') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ enabled: false, productUrl: 'http://127.0.0.1:61228/', centerUrl: '', centerMode: 'web-proxy' })); return;
      }
      const asset = assets.get(url.pathname);
      if (!asset) { response.writeHead(404); response.end(); return; }
      const body = await readFile(new URL(`../public/${asset[0]}`, import.meta.url));
      response.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store' }); response.end(body);
    } catch (error) { response.writeHead(500); response.end(error.message); }
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  } catch (error) { server.close(); throw error; }
  return {
    server, url: `http://127.0.0.1:${server.address().port}`,
    setState: next => { state = { fields: {}, task: {}, generatedAt: observedAt, fail: false, ...next }; },
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }),
  };
}

// Called by a separately admitted owner runner with an owned page/fixture/output.
// This file never launches Chrome or writes a budget. Caller owns the total
// deadline, scratch/output caps, source hashes, page/Chrome and fixture cleanup.
export async function runTaskTimingChecks({ page, fixture, outputDir, checkpoint }) {
  const checks = [], screenshots = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const closeDialog = async () => {
    await page.evaluate(() => {
      window.fixtureTimingClose = false;
      document.querySelector('#task-dialog').addEventListener('close', () => { window.fixtureTimingClose = true; }, { once: true });
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.fixtureTimingClose === true);
  };
  const row = id => page.locator('#active-work > .task-row').filter({ has: page.locator('.task-code', { hasText: new RegExp(`^${id}$`) }) });
  const elapsed = () => row('T01').locator('.task-elapsed');
  const refresh = async () => {
    await page.locator('#refresh').click();
    await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
    checkpoint();
  };
  try {
    await page.addInitScript(() => {
      const original = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 20000) { window.timingFixtureRefresh = callback; return 0; }
        return original(callback, delay, ...args);
      };
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(fixture.url);
    await page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor(); checkpoint();
    assert.equal(await row('T01').count(), 1);
    assert.match(await elapsed().innerText(), /已历时（含等待，截至本次同步）：2小时/);
    assert.match(await row('T02').innerText(), /负责人声明完成.*1小时 30分/);
    assert.equal(await row('T01').locator('time').getAttribute('datetime'), '2026-10-07T01:00:00.000Z');
    assert.match(await row('T01').innerText(), /本地时间.*UTC 偏移/);
    assert.match(await row('T01').innerText(), /尚未完成/);
    fixture.setState({ fields: { 工作分支状态: 'completed' } }); await refresh();
    assert.match(await elapsed().innerText(), /截至本次同步.*2小时/);
    checks.push('Explicit task start/end and inclusive elapsed; branch completion never ends the task');

    for (const [label, state] of [
      ['unknown end', { fields: { 任务完成时间: 'UNKNOWN' } }],
      ['missing provenance', { fields: { 任务时间来源: 'UNKNOWN' } }],
      ['future start', { fields: { 任务开工时间: '2099-10-07T01:00:00Z' } }],
      ['reverse', { fields: { 任务完成时间: '2026-10-07T00:00:00Z' } }],
      ['stale', { task: { current: false, source: { ...source, stale: true } } }],
      ['frozen', { task: { current: false, source: { ...source, mode: 'frozen', frozenCommit: 'fixture-old' } } }],
    ]) {
      fixture.setState(state); await refresh();
      assert.match(await elapsed().innerText(), /历时未知/, label);
      assert.doesNotMatch(await elapsed().innerText(), /截至本次同步/, label);
    }
    checks.push('Unknown, missing provenance, future, reverse, stale and frozen observations do not advance');

    fixture.setState({}); await refresh();
    const details = row('T01').getByRole('button', { name: '查看详情：T01 时间样本 T01', exact: true });
    await details.focus(); await page.keyboard.press('Enter');
    const region = page.getByRole('region', { name: '任务时间', exact: true });
    await region.waitFor();
    const basis = region.locator('.timing-basis');
    await basis.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await basis.evaluate(node => node.open), true);
    assert.match(await region.innerText(), /fixture-start/);
    assert.match(await region.innerText(), /WAIT01/);
    assert.match(await region.innerText(), /未求和/);
    assert.match(await region.locator('.waiting-state').innerText(), /^仍在等待/);
    await region.locator('.timing-waits td').first().evaluate(node => {
      window.timingReadingNode = node;
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      window.timingReadingText = selection.toString();
    });
    await page.locator('#close-dialog').focus();
    fixture.setState({ fail: true });
    await page.evaluate(() => window.timingFixtureRefresh());
    await page.waitForFunction(() => document.querySelector('#sync-state').textContent === '当前同步失败'); checkpoint();
    assert.match(await region.locator('.task-elapsed').innerText(), /历时未知/);
    assert.match(await region.innerText(), /2026-10-07T01:00:00.000Z/);
    assert.equal(await basis.evaluate(node => node.open), true);
    assert.equal(await page.evaluate(() => document.querySelector('.timing-waits td') === window.timingReadingNode && getSelection().toString() === window.timingReadingText), true);
    assert.match(await region.locator('.waiting-state').innerText(), /当前是否等待未知/);
    assert.equal(await page.locator('#close-dialog').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#task-dialog').evaluate(node => node.open), true);
    checks.push('Read failure marks open timing historical without replacing the dialog or stealing focus');

    fixture.setState({ generatedAt: '2026-10-07T04:00:00.000Z' });
    await page.evaluate(() => window.timingFixtureRefresh());
    await page.waitForFunction(() => document.querySelector('#sync-state').textContent.startsWith('已同步')); checkpoint();
    assert.match(await region.locator('.task-elapsed').innerText(), /历时未知/);
    assert.match(await region.innerText(), /2026-10-07T03:00:00.000Z/);
    assert.equal(await basis.evaluate(node => node.open), true);
    assert.equal(await page.evaluate(() => document.querySelector('.timing-waits td') === window.timingReadingNode && getSelection().toString() === window.timingReadingText), true);
    await closeDialog();
    assert.match(await elapsed().innerText(), /3小时/);
    await row('T01').getByRole('button', { name: '查看详情：T01 时间样本 T01', exact: true }).click();
    await region.waitFor();
    assert.match(await region.locator('.task-elapsed').innerText(), /3小时/);
    // Native close queues its event; reopen through the real button in the same task.
    await row('T01').locator('button[data-open-task="T01"]').evaluate(button => {
      const dialog = document.querySelector('#task-dialog');
      if (!dialog.open) throw new Error('Expected an open timing detail before queued-close regression');
      window.fixtureTimingReopenClose = false;
      dialog.addEventListener('close', () => { window.fixtureTimingReopenClose = true; }, { once: true });
      dialog.close();
      button.click();
    });
    await page.waitForFunction(() => window.fixtureTimingReopenClose === true);
    await region.waitFor();
    assert.equal(await page.locator('#task-dialog').evaluate(node => node.open), true);
    assert.match(await region.locator('.task-elapsed').innerText(), /3小时/);
    checks.push('New snapshot updates cards; an open detail retains its original observation until explicitly reopened');

    for (const theme of ['light', 'dark']) {
      await closeDialog();
      await page.locator('#theme').selectOption(theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await row('T01').getByRole('button', { name: '查看详情：T01 时间样本 T01', exact: true }).focus();
      await page.keyboard.press('Enter'); await region.waitFor(); checkpoint();
      await region.locator('.timing-basis > summary').focus(); await page.keyboard.press('Enter');
      assert.match(await region.innerText(), /fixture-start/);
      assert.match(await region.innerText(), /WAIT01/);
      assert.ok(await page.locator('#task-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      const name = `task-timing-${theme}-390.png`;
      await page.screenshot({ path: path.join(outputDir, name) }); screenshots.push(name);
    }
    checks.push('Both 390px themes preserve UTC/source/wait text, keyboard access and bounded layout');
    await closeDialog();
    fixture.setState({ signals: true }); await refresh();
    for (const selector of ['#blockers', '#decisions']) {
      const signals = page.locator(selector);
      assert.equal(await signals.locator('.signal-group').count(), 1);
      assert.deepEqual(await signals.locator('.task-row .task-code').allTextContents(), ['T02', 'T01']);
      assert.match(await signals.innerText(), /child-owner/);
      assert.match(await signals.innerText(), /timing-fixture/);
      assert.equal(await signals.locator('img').count(), 0);
    }
    fixture.setState({ signals: true, unknownRelation: true }); await refresh();
    assert.equal(await page.locator('#blockers .signal-group').count(), 2);
    assert.match(await page.locator('#blockers').innerText(), /关系未确认/);
    assert.match(await page.locator('#blockers').innerText(), /fixture 未核实关系/);
    checks.push('Priority signal groups retain both owners and literal text; unknown target relations remain separate');
    assert.deepEqual(errors, []); checkpoint();
    return { checks, screenshots, pageErrors: errors, observation: 'fixture-only parser/UI; no PG, registry, main proof or deployment validation' };
  } finally { page.off('pageerror', onError); }
}

// Followup captures actual timing text inside the scrollable dialog; it does not
// replay the accepted five semantic groups or replace their original screenshots.
async function timingVisualChecks({ page, f, report, output, checkpoint }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(f.url);
  await page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  for (const theme of ['light', 'dark']) {
    await page.locator('#theme').selectOption(theme);
    const button = page.locator('#active-work > .task-row button[data-open-task="T01"]');
    assert.equal(await button.count(), 1);
    await button.focus(); await page.keyboard.press('Enter');
    const region = page.getByRole('region', { name: '任务时间', exact: true });
    await region.waitFor();
    const basis = region.locator('.timing-basis');
    await basis.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await basis.evaluate(node => node.open), true);
    assert.match(await region.innerText(), /fixture-start/);
    assert.match(await region.innerText(), /WAIT01/);
    await region.getByRole('heading', { name: '任务时间', exact: true }).evaluate(node => node.scrollIntoView({ block: 'start' }));
    const view = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
      const region = document.querySelector('#task-timing-detail');
      const dialog = document.querySelector('#task-dialog');
      const heading = region.querySelector('h3').getBoundingClientRect();
      const start = region.querySelector('dd').getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      resolve({ width: innerWidth, height: innerHeight, regionTop: region.getBoundingClientRect().top,
        heading: { top: heading.top, bottom: heading.bottom }, start: { top: start.top, bottom: start.bottom },
        dialog: { top: bounds.top, bottom: bounds.bottom, scrollTop: dialog.scrollTop },
        contained: dialog.scrollWidth <= dialog.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth });
    })));
    assert.equal(view.contained, true);
    assert.ok(view.heading.top >= view.dialog.top && view.start.bottom <= Math.min(view.height, view.dialog.bottom));
    report.timingVisual ??= []; report.timingVisual.push({ theme, ...view, scope: 'Visible timing heading/start/elapsed/source viewport; full waiting text remains available by scrolling and DOM assertions.' });
    const filename = `task-timing-region-${theme}-390.png`;
    await page.screenshot({ path: path.join(output, filename), animations: 'disabled' }); report.screenshots.push(filename);
    await page.evaluate(() => {
      window.fixtureTimingVisualClose = false;
      document.querySelector('#task-dialog').addEventListener('close', () => { window.fixtureTimingVisualClose = true; }, { once: true });
    });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.fixtureTimingVisualClose === true); checkpoint();
  }
  report.checks.push('390 light/dark real timing-region text viewport, native keyboard opening and contained scrolling');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const visualOnly = process.argv.includes('--visual-followup');
  await runBrowserCheck(visualOnly ? 'task-timing-visual' : 'task-timing', visualOnly ? timingVisualChecks : async ({ page, f, report, output, checkpoint }) => {
    const result = await runTaskTimingChecks({ page, fixture: f, outputDir: output, checkpoint });
    report.checks.push(...result.checks); report.screenshots.push(...result.screenshots);
    report.errors.push(...result.pageErrors);
    assert.equal(result.checks.length, 5); assert.equal(result.screenshots.length, 2);
  }, { fixtureFactory: async owner => {
    const fixture = await createTaskTimingFixture(); owner.after(() => fixture.close()); return fixture;
  } });
}
