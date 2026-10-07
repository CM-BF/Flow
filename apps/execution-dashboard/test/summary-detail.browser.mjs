import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, readdir, realpath, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDashboardServer } from '../src/server.mjs';
import { validateRegistry } from '../src/registry.mjs';
import { status } from './fixture.mjs';

export const sourceFiles = ['src/read-model.mjs', 'src/aggregate.mjs', 'src/server.mjs', 'public/app.js', 'test/summary-detail.test.mjs', 'test/summary-detail.browser.mjs', 'test/task-links.browser.mjs', 'test/task-timing.browser.mjs', 'test/local-access.browser.mjs', 'src/status.mjs', 'src/local-access.mjs', 'public/index.html', 'public/local-access.js', 'public/local-access.css', 'test/local-access.test.mjs', 'test/status-timestamps.test.mjs'].map(file => `apps/execution-dashboard/${file}`);
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
  const timingStart = new Date(Date.now() - 3600000).toISOString();
  const baseHuman = { 任务开工时间: timingStart, 任务完成时间: 'NOT_COMPLETED', 任务时间来源: 'fixture explicit event / not independently verified', 本片段交付阶段: 'implementation', 阶段: 'M2', 优先级: '1', 当前产出: '任务关系可从唯一记录核对', 下一可用交付: '核对父任务与责任人', 当前阻塞: 'NONE', 需用户决定: 'NONE', 'co-lead': 'Web /root' };
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

/** The reviewed parent owns the budget and two independent native-Chrome/Node process groups. */
export async function runBrowserCheck(name, check, { fixtureFactory = summaryFixture, useDefaultContext = false } = {}) {
  if (!process.env.DPERF04_BROWSER_GATE) throw new Error('Supervised browser resource gate required');
  const gatePath = process.env.DPERF04_BROWSER_GATE;
  const gateStat = await lstat(gatePath); assert.ok(gateStat.isFile() && !gateStat.isSymbolicLink() && gateStat.size <= 65536);
  const gate = JSON.parse(await readFile(gatePath, 'utf8')), supervision = gate.supervision;
  assert.equal(gate.allowRun, true); assert.equal(gate.mode, 'dperf-browser'); assert.equal(gate.singleUse, true); assert.equal(gate.entry, name);
  assert.equal(useDefaultContext, name === 'local-access', 'Only the owned ACCESS consumer receives the default context');
  assert.equal(fixtureFactory === null, name === 'local-access', 'ACCESS owns its HTTP fixture inside the existing check');
  assert.ok(Date.parse(gate.expiresAt) > Date.now()); assert.match(gate.run, /^[a-zA-Z0-9-]{1,80}$/);
  assert.ok(supervision && supervision.parentPid === process.ppid && process.ppid > 1, 'Owned supervisor parent required');
  const { startedAtMs: started, workDeadlineMs: workAt, hardDeadlineMs: hardAt, scratch, output,
    chromePid, chromePgid, chromeEndpoint, chromeOwnership } = supervision;
  assert.equal(chromeOwnership, 'external-parent-native-sibling');
  assert.ok(Number.isSafeInteger(chromePid) && chromePid > 1 && chromePid !== process.pid && chromePid !== process.ppid);
  assert.equal(chromePgid, chromePid); assert.match(chromeEndpoint, /^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/);
  assert.ok(Number(new URL(chromeEndpoint).port) > 0 && Number(new URL(chromeEndpoint).port) <= 65535);
  assert.ok([started, workAt, hardAt, gate.previousRuntimeMs, gate.totalMs].every(Number.isSafeInteger));
  assert.ok(started <= Date.now() && Date.now() < workAt && gate.previousRuntimeMs >= 0);
  const phaseLimit = gate.phase === 'remaining-consumers-20261007' ? 45000 : 60000;
  if (phaseLimit === 45000) assert.equal(gate.closedPriorRuntimeMs, 40551);
  assert.equal(gate.previousRuntimeMs + gate.totalMs, phaseLimit); assert.ok(gate.totalMs > 15000);
  assert.equal(hardAt, started + gate.totalMs); assert.equal(workAt, hardAt - 15000);
  assert.ok(path.isAbsolute(scratch)); assert.equal(await realpath(scratch), scratch);
  assert.equal(output, path.resolve('docs/evidence/wpf-dperf04/browser-runs', gate.run)); assert.equal(await realpath(output), output);
  for (const key of ['TMPDIR', 'TMP', 'TEMP', 'MAC_CHROMIUM_TMPDIR', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE']) assert.equal(await realpath(process.env[key] ?? ''), scratch);
  assert.equal(await realpath(tmpdir()), scratch); assert.equal(process.env.NODE_DISABLE_COMPILE_CACHE, '1');
  assert.ok(path.isAbsolute(gate.chromeExecutable) && path.isAbsolute(gate.playwrightModule));
  assert.equal(await realpath(gate.playwrightModule), gate.playwrightModule);
  assert.match(gate.playwrightSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(gate.sourceHashes).sort(), [...sourceFiles].sort());
  const report = { name, startedAt: new Date(started).toISOString(), workerStartedAt: new Date().toISOString(), parentPid: process.ppid,
    workerPid: process.pid, chromePid, chromeProcessGroup: 'separate-parent-owned-session', chromeCleanupOwner: chromeOwnership, sourceHead: gate.sourceHead, sourceHashes: {},
    checks: [], screenshots: [], errors: [], cleanupErrors: [], pg: 0, outcome: 'failed', budgetOwner: 'external-parent' };
  let fixture, browser, context, stopped = false;
  const cleanups = [];
  const stopWork = () => { stopped = true; fixture?.server.closeAllConnections(); };
  const checkpoint = () => { if (stopped || Date.now() >= workAt) throw new Error('Parent browser work deadline reached'); };
  process.on('SIGTERM', stopWork);
  const workDeadline = setTimeout(stopWork, Math.max(1, workAt - Date.now()));
  const hardDeadline = setTimeout(() => {
    fixture?.server.closeAllConnections();
    report.cleanupErrors.push('Parent hard deadline: child cleanup not confirmed'); report.observedElapsedMs = Date.now() - started;
    try { writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); } finally { process.exit(1); }
  }, Math.max(1, hardAt - Date.now()));
  try {
    checkpoint(); assert.equal(git(process.cwd(), 'rev-parse', 'HEAD'), gate.sourceHead); checkpoint();
    for (const file of sourceFiles) { report.sourceHashes[file] = hash(await readFile(file)); assert.equal(report.sourceHashes[file], gate.sourceHashes[file], `Source gate mismatch: ${file}`); checkpoint(); }
    assert.equal(hash(await readFile(gate.playwrightModule)), gate.playwrightSha256, 'Read-only Playwright entry changed'); checkpoint();
    if (fixtureFactory) fixture = await fixtureFactory({ after: cleanup => cleanups.push(cleanup) });
    checkpoint();
    const { chromium, expect } = await import(pathToFileURL(gate.playwrightModule).href); checkpoint();
    browser = await chromium.connectOverCDP(chromeEndpoint, { timeout: Math.min(3000, Math.max(1, workAt - Date.now())), ...(useDefaultContext ? { noDefaults: true } : {}) }); checkpoint();
    report.cdpConnectedAt = new Date().toISOString();
    if (useDefaultContext) {
      assert.equal(browser.contexts().length, 1, 'Fresh parent-owned Chrome has one default context');
      context = browser.contexts()[0];
    } else context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    checkpoint();
    const page = useDefaultContext ? undefined : await context.newPage();
    if (page) { page.setDefaultTimeout(2000); page.on('pageerror', error => report.errors.push(error.message)); }
    checkpoint();
    await check({ page, context, expect, f: fixture, report, output, checkpoint }); checkpoint();
    assert.deepEqual(report.errors, []); report.outcome = 'passed';
  } catch (error) { report.failure = error.stack ?? String(error); report.outcome = 'failed'; }
  finally {
    clearTimeout(workDeadline);
    try { if (context && !report.contextClosed) { await context.close(); report.contextClosed = true; } } catch (error) { report.cleanupErrors.push(String(error)); }
    // CDP close disconnects transport; Chrome lifecycle and signalling remain parent-owned.
    try { await browser?.close(); } catch (error) { report.cleanupErrors.push(String(error)); }
    for (const cleanup of cleanups.reverse()) try { await cleanup(); } catch (error) { report.cleanupErrors.push(String(error)); }
    // Never delete scratch before the parent confirms both owned groups absent.
    report.profileCleanupOwner = 'external-parent-after-both-groups-absence';
    report.serverClosed = fixture ? !fixture.server.listening : report.serverClosed ?? null;
    try {
      report.fixtureFilesystem = ['task-timing', 'task-timing-visual', 'local-access'].includes(name) ? 'not-created' : fixture?.root ? 'owned-temporary-repositories' : 'unknown';
      report.fixtureRemoved = fixture?.root ? await stat(fixture.root).then(() => false, error => { if (error.code === 'ENOENT') return true; throw error; }) : report.fixtureFilesystem === 'not-created' ? true : null;
    }
    catch (error) { report.cleanupErrors.push(String(error)); report.fixtureRemoved = false; }
    report.observedElapsedMs = Date.now() - started; report.finishedAt = new Date().toISOString();
    if (report.cleanupErrors.length || report.contextClosed !== true || report.serverClosed !== true || report.fixtureRemoved !== true || Date.now() >= hardAt) report.outcome = 'failed';
    report.retainedRunBytes = await bytesIn(output);
    if (report.retainedRunBytes > 8 * 1024 * 1024 - 128 * 1024) { report.outcome = 'failed'; report.errors.push('Run retained evidence reserve exceeded'); }
    await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    clearTimeout(hardDeadline); process.off('SIGTERM', stopWork);
  }
  console.log(JSON.stringify({ output, outcome: report.outcome, checks: report.checks, observedElapsedMs: report.observedElapsedMs, cleanupErrors: report.cleanupErrors, budgetOwner: 'external-parent' }));
  if (report.outcome !== 'passed') process.exitCode = 1;
}

async function summaryChecks({ page, f, report, output }) {
  // Deliberately ignore cancellation for read responses, so generation guards carry the proof.
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fixtureLateResponses = {};
    window.fetch = async (url, init) => {
      const response = await original(url, String(url).startsWith('/api/') ? { ...init, signal: undefined } : init);
      const id = response.headers.get('x-dperf04-late');
      if (!id) return response;
      const state = { delivered: true, status: response.status, body: 'pending' };
      window.fixtureLateResponses[id] = state;
      // Failed assignment responses are rejected before the product reads their body.
      // Drain that exact test response too, rather than treating headers as delivery.
      if (!response.ok) {
        try { await response.clone().text(); state.errorBody = 'fulfilled'; }
        catch (error) { state.errorBody = 'rejected'; state.error = String(error); throw error; }
      }
      for (const method of ['json', 'text', 'arrayBuffer']) {
        const read = response[method].bind(response);
        response[method] = async (...args) => {
          try { const value = await read(...args); state.body = 'fulfilled'; return value; }
          catch (error) { state.body = 'rejected'; state.error = String(error); throw error; }
        };
      }
      return response;
    };
    const interval = window.setInterval.bind(window);
    window.setInterval = (callback, ms, ...args) => {
      if (ms === 20000) { window.fixtureAutomaticRefresh = () => callback(...args); return 0; }
      return interval(callback, ms, ...args);
    };
  });
  report.transport = 'Synthetic late transport ignores AbortSignal; exact fulfill and body settlement precede DOM assertions. Production 20s callback is invoked explicitly by this fixture.';
  const deliveries = new Map();
  const deliveryFor = id => {
    if (!deliveries.has(id)) {
      let resolve; const promise = new Promise(done => { resolve = done; });
      deliveries.set(id, { promise, resolve });
    }
    return deliveries.get(id);
  };
  const deliverLate = async (route, id, options) => {
    try {
      await route.fulfill({ ...options, headers: { ...options.response?.headers(), ...options.headers, 'x-dperf04-late': id } });
      deliveryFor(id).resolve({ fulfilled: true });
    } catch (error) { deliveryFor(id).resolve({ fulfilled: false, error: String(error) }); }
  };
  const waitForLate = async (id, readsBody = true) => {
    const delivery = await deliveryFor(id).promise;
    assert.equal(delivery.fulfilled, true, `Late response was not delivered: ${id}: ${delivery.error ?? ''}`);
    const field = readsBody ? 'body' : 'errorBody';
    await page.waitForFunction(({ id, field }) => ['fulfilled', 'rejected'].includes(window.fixtureLateResponses[id]?.[field]), { id, field });
    const response = await page.evaluate(id => window.fixtureLateResponses[id], id);
    assert.equal(response[field], 'fulfilled', `Late response body failed: ${id}: ${response.error ?? ''}`);
    // Evaluation is a new browser task, after the consumer's fetch/body continuations.
    (report.lateResponses ??= []).push({ id, readsBody, ...delivery, ...response });
  };
  const requests = []; page.on('request', request => requests.push(new URL(request.url()).pathname));
  let finishAssignments;
  let claimVersion = 7, claimObservation = 'available';
  const claimScopes = ['apps/exact/component.js', 'plans/owned', '#owned/file', '-owned/file', 'literal`name/file', ...Array.from({ length: 95 }, (_, i) => `apps/exact/scope-${i}.js`)];
  const assignmentRelease = new Promise(resolve => { finishAssignments = resolve; });
  await page.route('**/api/assignments', async route => {
    const response = await route.fetch(), value = await response.json(); await assignmentRelease;
    value.assignments = { state: claimObservation === 'unknown' ? 'unknown' : 'available', observedAt: value.completedAt, claims: [] };
    value.byTask = Object.fromEntries(f.tasks.map(task => [task.id, []]));
    value.unregisteredAssignments = claimObservation !== 'available' ? [] : [{ claimId: 'unregistered-readonly-fixture', version: claimVersion, taskId: 'U01', role: 'writer', state: 'handoff_pending', lead: '<script>lead</script>', worker: 'fixture-worker', branch: 'codex/unregistered', worktree: '/synthetic/unregistered', scope: claimVersion === 7 ? claimScopes : ['apps/changed-after-review.js'], needsVerification: true, updatedAt: f.updated, next: { lead: 'next', worker: 'next-worker', worktree: '/synthetic/next', branch: 'codex/next' } }];
    await route.fulfill({ response, json: value });
  });
  await page.goto(f.url); await page.locator('#sync-state').filter({ hasText: '已同步' }).waitFor();
  assert.match(await page.locator('#active-work').innerText(), /领取状态未知/);
  assert.equal(requests.includes('/api/snapshot'), false); assert.equal(requests.includes('/api/task'), false);
  finishAssignments(); await page.locator('#unregistered-claims').waitFor({ state: 'visible' });
  const claim = page.getByText('查看领取详情：U01', { exact: true }); await claim.focus(); await page.keyboard.press('Enter');
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /apps\/exact\/component.js/);
  assert.equal(await page.locator('#unregistered-claim-items dt').filter({ hasText: '精确 scope' }).evaluate(node => node.nextElementSibling.textContent), claimScopes.join('\n'));
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /仍占用/);
  assert.match(await page.locator('#unregistered-claim-items').innerText(), /不适用.*进度来源尚未登记/);
  assert.equal(await page.locator('#unregistered-claim-items script').count(), 0);
  report.checks.push('Summary renders before ledger, requests no full snapshot/proof; unregistered claim exact scope and stale handoff are keyboard reachable');
  const automaticRefresh = async () => {
    const previous = await page.locator('#assignment-observation').getAttribute('data-read-id');
    await page.evaluate(() => window.fixtureAutomaticRefresh());
    await page.waitForFunction(previous => !document.querySelector('#refresh').disabled && document.querySelector('#assignment-observation').dataset.readId !== previous, previous);
  };
  await page.evaluate(() => {
    const row = document.querySelector('#unregistered-claim-items article');
    const scope = [...row.querySelectorAll('dt')].find(node => node.textContent === '精确 scope').nextElementSibling;
    const summary = row.querySelector('summary'); summary.focus();
    const range = document.createRange(); range.selectNodeContents(scope);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    window.fixtureClaimReading = { row, scope, summary, selection: selection.toString(), text: scope.textContent };
  });
  const assertClaimReading = async freshness => {
    assert.deepEqual(await page.evaluate(() => {
      const { row, scope, summary, selection, text } = window.fixtureClaimReading;
      return { sameRow: row === document.querySelector('#unregistered-claim-items article'), connected: scope.isConnected,
        open: row.querySelector('details').open, focus: document.activeElement === summary, selection: getSelection().toString() === selection,
        sameText: scope.textContent === text, freshness: row.dataset.freshness };
    }), { sameRow: true, connected: true, open: true, focus: true, selection: true, sameText: true, freshness });
  };
  await automaticRefresh(); await assertClaimReading('current-observation');
  claimVersion = 8;
  await automaticRefresh(); await assertClaimReading('prior-observation');
  assert.match(await page.locator('[data-claim-observation]').innerText(), /版本或内容已变化/);
  await page.locator('[data-claim-refresh]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#unregistered-claim-items dt').filter({ hasText: '精确 scope' }).evaluate(node => node.nextElementSibling.textContent), 'apps/changed-after-review.js');
  assert.equal(await claim.evaluate(node => node === document.activeElement), true);
  claimObservation = 'unknown'; await automaticRefresh();
  assert.equal(await page.locator('#unregistered-claim-items details').evaluate(node => node.open), true);
  assert.match(await page.locator('[data-claim-observation]').innerText(), /未知.*上次记录/);
  assert.match(await page.locator('#unregistered-claim-items .detail-facts').innerText(), /changed-after-review/);
  claimObservation = 'released'; await automaticRefresh();
  assert.match(await page.locator('[data-claim-observation]').innerText(), /仅为旧记录.*不代表仍占用或已释放/);
  await page.keyboard.press('Enter'); await page.locator('#refresh').focus(); await automaticRefresh();
  assert.equal(await page.locator('#unregistered-claims').isVisible(), false);
  report.checks.push('Unchanged unregistered claim preserves expanded 100 scopes, focus and selection during automatic sync; version changes require explicit update, unknown/released retain labelled old reading until closed');
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
    value.task.status.owner = 'STALE-DETAIL-MUST-NOT-RENDER'; await deliverLate(route, 'closed-detail', { response, json: value });
  });
  await open('T02').click(); await detailStarted; await page.keyboard.press('Escape'); await open('T02').click();
  await page.locator('#selected-proof .documents').waitFor(); finishDetail();
  await waitForLate('closed-detail');
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
    value.task.status.owner = 'STALE-ABA-MUST-NOT-RENDER'; await deliverLate(route, 'aba-detail', { response, json: value });
  });
  await open('T02').click(); await abaStarted;
  await page.locator('.direct-children').getByRole('button', { name: '查看详情：T01 任务 T01', exact: true }).click();
  await page.locator('#detail-content > .task-links').getByRole('button', { name: '查看所属大task T02：T02 任务 T02', exact: true }).click();
  await page.locator('#selected-proof .documents').waitFor(); finishABA();
  await waitForLate('aba-detail');
  assert.doesNotMatch(await page.locator('#detail-content').innerText(), /STALE-ABA/);
  report.checks.push('A→B→A navigation rejects the first A detail');
  let finishDocument, startDocument;
  const documentStarted = new Promise(resolve => { startDocument = resolve; });
  const documentRelease = new Promise(resolve => { finishDocument = resolve; });
  await page.route('**/api/document?*', async route => {
    if (!new URL(route.request().url()).searchParams.get('path').endsWith('plan.md')) return route.continue();
    startDocument(); await documentRelease; await deliverLate(route, 'old-document', { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'STALE-DOCUMENT-ERROR' }) });
  });
  await page.getByRole('button', { name: 'plan.md', exact: true }).click(); await documentStarted;
  await page.getByRole('button', { name: 'review.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.includes('APPROVED'));
  finishDocument(); await waitForLate('old-document');
  assert.equal(await page.locator('#document-error').isVisible(), false);
  report.checks.push('Same-task plan→review rejects late document error and keeps new document');
  await page.unroute('**/api/document?*');
  await page.keyboard.press('Escape');
  let finishOldAssignment, startOldAssignment, delayAssignment = true;
  const assignmentStarted = new Promise(resolve => { startOldAssignment = resolve; });
  const oldAssignmentRelease = new Promise(resolve => { finishOldAssignment = resolve; });
  await page.unroute('**/api/assignments');
  await page.route('**/api/assignments', async route => {
    if (delayAssignment) { delayAssignment = false; startOldAssignment(); await oldAssignmentRelease; return deliverLate(route, 'old-assignment', { status: 500, contentType: 'application/json', body: '{}' }); }
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
  finishOldAssignment(); await waitForLate('old-assignment', false);
  assert.doesNotMatch(await page.locator('#assignment-observation').innerText(), /本次失败/);
  assert.match(await page.locator('#active-work').innerText(), /尚无领取登记/);
  report.checks.push('Late previous assignment error cannot overwrite a newer available observation');
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  const parent = f.tasks.find(task => task.id === 'T02');
  const planText = '# 阅读中的计划\n' + '保留正文、焦点、选区与阅读位置。\n'.repeat(80);
  await writeFile(path.join(parent.worktree, parent.planDir, 'plan.md'), planText);
  await open('T02').click(); await page.locator('#selected-proof .documents').waitFor();
  await page.getByRole('button', { name: 'plan.md', exact: true }).click();
  assert.match(await page.locator('#task-timing-detail .task-elapsed').innerText(), /已历时（含等待，截至本次同步）/);
  await page.waitForFunction(text => document.querySelector('#document-text').textContent === text, planText);
  await page.evaluate(() => {
    const node = document.querySelector('#document-text'); node.focus();
    document.querySelector('#task-dialog').scrollTop += 80;
    const range = document.createRange(); range.setStart(node.firstChild, 2); range.setEnd(node.firstChild, 9);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const timing = document.querySelector('#task-timing-detail');
    window.fixtureReading = { node, text: node.textContent, selection: selection.toString(), top: node.getBoundingClientRect().top, timing, timingFacts: timing.querySelector('dl').textContent };
  });
  const readsBefore = requests.filter(url => ['/api/task', '/api/document'].includes(url)).length;
  const assertReading = async () => {
    const state = await page.evaluate(() => {
      const { node, text, selection, top, timing, timingFacts } = window.fixtureReading;
      return { sameNode: node === document.querySelector('#document-text'), visible: !document.querySelector('#document-view').hidden,
        focus: document.activeElement === node, sameText: node.textContent === text, selection: getSelection().toString() === selection,
        timingSame: timing === document.querySelector('#task-timing-detail') && timing.querySelector('dl').textContent === timingFacts, timingUnknown: timing.querySelector('.task-elapsed').textContent.includes('历时未知'),
        scrollDelta: Math.abs(node.getBoundingClientRect().top - top), freshness: document.querySelector('#selected-proof').dataset.freshness };
    });
    assert.deepEqual({ ...state, scrollDelta: undefined }, { sameNode: true, visible: true, focus: true, sameText: true, selection: true, timingSame: true, timingUnknown: true, scrollDelta: undefined, freshness: 'prior-observation' });
    assert.ok(state.scrollDelta <= 1, `Reading anchor moved ${state.scrollDelta}px`);
    assert.equal(requests.filter(url => ['/api/task', '/api/document'].includes(url)).length, readsBefore);
  };
  await page.evaluate(() => window.fixtureAutomaticRefresh());
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  await assertReading();
  await f.writeStatus(parent, { owner: 'changed-source-owner' });
  await writeFile(path.join(parent.worktree, parent.planDir, 'plan.md'), '# 显式刷新后的新计划\n');
  await page.evaluate(() => window.fixtureAutomaticRefresh());
  await page.waitForFunction(() => !document.querySelector('#refresh').disabled);
  await assertReading(); assert.match(await page.locator('#detail-update-notice').innerText(), /来源已变化/);
  await page.locator('#refresh-detail').focus(); await page.keyboard.press('Enter');
  await page.locator('#selected-proof .documents').waitFor();
  await page.getByRole('button', { name: 'plan.md', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#document-text').textContent.includes('显式刷新后的新计划'));
  await page.evaluate(() => {
    window.fixtureReadingClose = false;
    document.querySelector('#task-dialog').addEventListener('close', () => { window.fixtureReadingClose = true; }, { once: true });
  });
  await page.keyboard.press('Escape');
  // Observe the native close event after the product listener, without changing its focus target.
  await page.waitForFunction(() => window.fixtureReadingClose === true);
  report.readingCloseFocus = await page.evaluate(() => ({
    dialogClosed: !document.querySelector('#task-dialog').open,
    activeTask: document.activeElement?.dataset.openTask ?? null,
    activeLabel: document.activeElement?.getAttribute('aria-label') ?? null,
    activeInHeadline: !!document.activeElement?.closest('#active-work'),
  }));
  assert.equal(await open('T02').evaluate(node => node === document.activeElement), true);
  report.checks.push('Automatic refresh preserves the exact document node/focus/selection/reading anchor for unchanged and changed status; proof becomes old and explicit keyboard refresh reads new content');
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
