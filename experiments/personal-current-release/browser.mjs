import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fork, spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { BACKEND, BACKEND_ROOT, RETAINED, inventory, backendIdentity, boundedFile, sha } from './inventory.mjs';
import { createFixture, save, allocateResources, initializeDatabase, cleanupResources, freeBytes, diskBytes, cleanError, runPreviewWithCleanup } from './fixture.mjs';
import { until } from './transport.mjs';
const entry = fileURLToPath(import.meta.url), repository = resolve(dirname(entry), '../..');
const evidenceRoot = join(repository, 'docs/evidence/svc05-retained-web-compatibility/runs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const reserveBytes = 1024 ** 3, rawLimit = 8 * 1024 ** 2, tmpLimit = 64 * 1024 ** 2;
const execute = promisify(execFile);
const input = page => page.getByRole('textbox', { name: 'Message input', exact: true }).filter({ visible: true });
const decoded = record => JSON.parse(record.responseBody);
async function sourceDigest() {
  const files = [];
  for (const name of ['browser', 'fixture', 'inventory', 'transport']) { const bytes = await readFile(join(dirname(entry), name + '.mjs')); files.push({ path: `experiments/personal-current-release/${name}.mjs`, bytes: bytes.length, sha256: sha(bytes) }); }
  return { files, digest: sha(JSON.stringify(files)) };
}
function observeLoss(page, preview, text) {
  let selected;
  const fact = { path: null, key: null, bodySha256: null, events: [], status: null, headers: null, failure: null, finished: false };
  const request = value => { if (selected || value.method() !== 'POST' || !/\/turns$/.test(new URL(value.url()).pathname)) return; const body = value.postData(); if (!body || JSON.parse(body).text !== text) return; selected = value; fact.path = new URL(value.url()).pathname; fact.key = value.headers()['idempotency-key']; fact.bodySha256 = sha(body); fact.events.push('request'); };
  const response = value => { if (value.request() !== selected) return; fact.status = value.status(); const h = value.headers(); fact.headers = Object.fromEntries(['content-type', 'content-length', 'connection', 'transfer-encoding'].map(n => [n, h[n] ?? ''])); fact.events.push('response-headers'); };
  const failed = value => { if (value === selected) { fact.failure = value.failure()?.errorText ?? null; fact.events.push('requestfailed'); } };
  const finished = value => { if (value === selected) { fact.finished = true; fact.events.push('requestfinished'); } };
  page.on('request', request); page.on('response', response); page.on('requestfailed', failed); page.on('requestfinished', finished);
  preview.loseNextTurn();
  return { fact, close() { page.off('request', request); page.off('response', response); page.off('requestfailed', failed); page.off('requestfinished', finished); }, async verify(record, signal) {
    await until(() => fact, x => !!x.failure && record.fault?.socketClosed, signal, 2000);
    assert.deepEqual(fact.events, ['request', 'response-headers', 'requestfailed']); assert.equal(fact.finished, false);
    assert.equal(fact.path, record.path); assert.equal(fact.key, record.key); assert.equal(fact.bodySha256, sha(record.body));
    assert.match(fact.failure, /^net::ERR_(?:CONTENT_LENGTH_MISMATCH|FAILED)$/);
    const fault = record.fault; assert.ok(fault.headersFlushed && fault.prefixFlushed && fault.endFlushed && fault.socketClosed); assert.equal(fault.error, undefined);
    assert.equal(fact.status, record.status); assert.deepEqual(fact.headers, { 'content-type': fault.contentType, 'content-length': String(fault.contentLength), connection: 'close', 'transfer-encoding': '' });
    const bytes = Buffer.from(record.responseBody); assert.equal(fault.contentLength, bytes.length); assert.equal(fault.prefixSha256, sha(bytes.subarray(0, fault.prefixBytes))); assert.ok(fault.prefixBytes > 0 && fault.prefixBytes < bytes.length);
  } };
}
async function actualApp(fixture, browser, preview, signal, directory) {
  const { expect } = await import('@playwright/test');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(8000);
  const pageErrors = [], assets = [], assetReads = []; let loss;
  page.on('pageerror', error => pageErrors.push(fixture.redact(error)));
  page.on('response', response => { const path = new URL(response.url()).pathname; if (response.status() === 200 && /\.(js|css)$/.test(path)) assetReads.push(response.body().then(bytes => assets.push({ path, bytes: bytes.length, sha256: sha(bytes) })).catch(() => pageErrors.push('Asset read failed'))); });
  const text = `SVC05 ${preview.label} durable message`, draft = `Unsent ${preview.label} draft`;
  const connect = async () => { await page.goto(preview.url, { waitUntil: 'domcontentloaded' }); await page.getByLabel('Owner token', { exact: true }).fill(fixture.token); await page.getByRole('button', { name: 'Connect workspace', exact: true }).click(); await expect(input(page)).toBeVisible(); };
  try {
    signal.throwIfAborted(); await connect();
    const html = Buffer.from(await (await fetch(preview.url, { signal })).arrayBuffer()); assert.equal(sha(html), preview.manifest.files.find(x => x.path === 'index.html').sha256);
    await page.getByRole('button', { name: 'Execution profile: Runner default', exact: true }).filter({ visible: true }).click();
    await page.getByRole('dialog', { name: 'Execution profile', exact: true }).getByRole('radio', { name: /svc05-synthetic/ }).check(); await page.keyboard.press('Escape');
    await input(page).fill(text); loss = observeLoss(page, preview, text);
    await page.getByRole('button', { name: 'Send message', exact: true }).filter({ visible: true }).click(); await expect(input(page)).toHaveValue(''); await input(page).fill(draft);
    const receipt = page.getByRole('region', { name: 'Message receipt', exact: true }); await expect(receipt).toContainText('Receipt unknown'); await expect(input(page)).toHaveValue(draft);
    const first = preview.records.find(x => x.dropped); assert.ok(first?.key && first.body); await loss.verify(first, signal); loss.close();
    const posts = () => preview.records.filter(x => x.method === 'POST' && x.path === first.path); assert.equal(posts().length, 1, 'No implicit retry before explicit App action');
    const accepted = decoded(first), conversationId = accepted.conversation.id, taskId = accepted.turn.task.id;
    const final = await until(() => fixture.request(`/api/tasks/${taskId}`), value => value.status === 'succeeded', signal); assert.equal(final.verificationStatus, 'passed');
    await page.getByRole('button', { name: 'Retry same message', exact: true }).click(); await expect(receipt).toHaveCount(0); await expect(input(page)).toHaveValue(draft);
    await expect(page.getByText('SVC05 synthetic reply: ' + text, { exact: true })).toBeVisible();
    assert.equal(posts().length, 2); const recovered = posts()[1], replay = decoded(recovered);
    assert.equal(recovered.key, first.key); assert.equal(recovered.body, first.body); assert.equal(replay.replayed, true); assert.equal(replay.turn.id, accepted.turn.id); assert.equal(replay.turn.task.id, taskId);
    assert.equal((await fixture.request(`/api/conversations/${conversationId}/turns`)).turns.length, 1);
    await until(() => preview.records, rows => rows.some(x => x.path === `/api/tasks/${taskId}` && x.responseBody && decoded(x).id === taskId), signal);
    const negotiated = preview.records.find(x => x.path === `/api/conversations/${conversationId}` && x.forwardedStream === 'patch-v1' && x.responseBody && decoded(x).conversation?.id === conversationId); assert.ok(negotiated); assert.equal(decoded(negotiated).capabilities.liveAssistantText, true);
    preview.setLegacy(true); await connect();
    const chats = page.getByRole('button', { name: 'Chats', exact: true }); if (!/\bactive\b/.test(await chats.getAttribute('class') ?? '')) await chats.click();
    await page.getByRole('navigation', { name: 'Conversations', exact: true }).getByRole('button', { name: text, exact: true }).click();
    await expect(page.getByText('SVC05 synthetic reply: ' + text, { exact: true })).toBeVisible();
    const legacy = (await until(() => preview.records, rows => rows.some(x => x.path === `/api/conversations/${conversationId}` && !x.forwardedStream && x.responseBody), signal)).findLast(x => x.path === `/api/conversations/${conversationId}` && !x.forwardedStream && x.responseBody);
    const negotiation = await page.evaluate(async ({ token, id, profileId }) => { const denied = await fetch(`/api/conversations/${id}`); const response = await fetch('/api/execution-profiles', { headers: { authorization: `Bearer ${token}`, 'X-Flow-Execution-Profile': 'steering-v1' } }); const body = await response.json(); return { denied: denied.status, status: response.status, profileFound: body.profiles?.some(x => x.reference.id === profileId) }; }, { token: fixture.token, id: conversationId, profileId: fixture.profile.reference.id });
    await Promise.all(assetReads); assert.deepEqual(pageErrors, []); assert.deepEqual(preview.problems, []);
    assert.ok(assets.some(x => x.path.endsWith('.js')) && assets.some(x => x.path.endsWith('.css')));
    for (const asset of assets) { const prefix = preview.manifest.format === 2 ? `/__flow_releases/${preview.manifest.releaseId}/` : '/'; assert.ok(asset.path.startsWith(prefix)); const source = preview.manifest.files.find(x => x.path === asset.path.slice(prefix.length)); assert.ok(source); assert.equal(asset.sha256, source.sha256); assert.equal(asset.bytes, source.bytes); }
    const legacyBody = decoded(legacy), observations = {
      read: { ownerAuthenticated: negotiation.denied === 401, conversationBound: legacyBody.conversation.id === conversationId, taskBound: legacyBody.lastTurn.task.id === taskId },
      send: { acceptedTurnBound: accepted.turn.conversationId === conversationId && accepted.turn.user.text === text && accepted.turn.number === 1, requestedProfilePreserved: JSON.stringify(accepted.conversation.executionProfile) === JSON.stringify(fixture.profile.reference) },
      recover: { sameKey: first.key === recovered.key, sameBody: first.body === recovered.body, sameTurn: accepted.turn.id === replay.turn.id },
      negotiation: { legacyReadable: legacyBody.capabilities.liveAssistantText === false, streamHeaderHandled: decoded(negotiated).capabilities.liveAssistantText === true, profileHeaderHandled: negotiation.status === 200 && negotiation.profileFound },
    };
    assert.ok(Object.values(observations).every(values => Object.values(values).every(x => x === true)));
    const result = { label: preview.label, artifact: preview.artifact, observations, faultObservation: loss.fact, conversationId, taskId, assets, pageErrors, posts: 2, sameTask: true, draftPreservedBeforeReload: true };
    await save(join(directory, preview.label + '-app.json'), result); return result;
  } catch (e) { await save(join(directory, preview.label + '-failure.json'), { error: fixture.redact(e), faultObservation: loss?.fact, pageErrors, assets }); throw e; }
  finally { loss?.close(); try { await context.close(); } finally { await save(join(directory, preview.label + '-wire.json'), preview.records); } }
}
async function worker() {
  const init = await new Promise(resolve => process.once('message', resolve)); assert.equal(init.kind, 'start');
  const controller = new AbortController(), signal = controller.signal;
  const timer = setTimeout(() => controller.abort(Error('Work deadline')), Math.max(0, init.workDeadline - Date.now()));
  process.once('SIGTERM', () => controller.abort(Error('Owned cleanup requested')));
  const report = { results: [], passed: false, errors: [], providerQueries: 0, personalActions: 0 }; let fixture, browser;
  try {
    fixture = await createFixture(init.owned, init.token, signal, report);
    const endpoint = new Promise((resolve, reject) => { process.on('message', value => { if (value.kind === 'chrome-ready') resolve(value.endpoint); }); signal.addEventListener('abort', () => reject(signal.reason), { once: true }); });
    process.send({ kind: 'chrome' }); const { chromium } = await import('@playwright/test'); browser = await chromium.connectOverCDP(await endpoint, { timeout: 8000 }); report.browserVersion = browser.version();
    for (const item of init.inventory.artifacts) {
      signal.throwIfAborted(); const preview = await fixture.openPreview(item); report.previewPorts ??= []; report.previewPorts.push(preview.port);
      const completed = await runPreviewWithCleanup(() => actualApp(fixture, browser, preview, signal, init.directory), () => fixture.closePreview());
      if (completed.cleanupError) { report.previewCleanupErrors ??= []; report.previewCleanupErrors.push(fixture.redact(completed.cleanupError)); }
      if (completed.workError) throw completed.workError;
      if (completed.cleanupError) throw completed.cleanupError;
      report.results.push(completed.value);
    }
    assert.equal(report.results.length, 2); assert.equal(new Set(report.results.map(x => x.taskId)).size, 2); assert.equal(new Set(report.results.map(x => x.conversationId)).size, 2); report.passed = true;
  } catch (e) { report.errors.push(fixture ? fixture.redact(e) : cleanError(e, [init.token])); }
  finally {
    clearTimeout(timer); try { await browser?.close(); } catch (e) { report.errors.push(cleanError(e, [init.token])); }
    try { await fixture?.close(); } catch (e) { report.errors.push(cleanError(e, [init.token])); }
    report.passed &&= report.errors.length === 0;
    await save(join(init.directory, 'worker-checkpoint.json'), report); process.send?.({ kind: 'result', report }); process.disconnect?.();
  }
}
function groupState(pid) { try { process.kill(-pid, 0); return 'present'; } catch (e) { return e.code === 'ESRCH' ? 'absent' : 'unknown'; } }
async function stopGroup(child, deadline) {
  const actions = []; if (groupState(child.pid) === 'absent') return { pid: child.pid, state: 'absent', actions };
  // These groups were created detached and captured by this supervisor, never discovered from ports.
  for (const [signal, ms] of [['SIGTERM', 3000], ['SIGKILL', 1000]]) {
    if (Date.now() >= deadline) break;
    try { process.kill(-child.pid, signal); actions.push(signal); } catch (e) { if (e.code !== 'ESRCH') return { pid: child.pid, state: 'unknown', actions }; }
    const end = Math.min(deadline, Date.now() + ms);
    while (groupState(child.pid) === 'present' && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 25));
    if (groupState(child.pid) === 'absent') return { pid: child.pid, state: 'absent', actions };
  }
  return { pid: child.pid, state: groupState(child.pid), actions };
}
async function closedPorts(values) {
  const observations = [];
  for (const port of [...new Set(values.filter(x => Number.isSafeInteger(x) && x > 0 && x < 65536))]) {
    try { const value = await execute('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { timeout: 1000, maxBuffer: 8192 }); observations.push({ port, state: 'present', pids: value.stdout.split('\n').filter(x => /^p[0-9]+$/.test(x)).map(x => Number(x.slice(1))) }); }
    catch (e) { observations.push({ port, state: e.code === 1 && !e.stdout && !e.stderr ? 'absent' : 'unknown', errorCode: String(e.code ?? 'UNKNOWN') }); }
  }
  return observations;
}
async function supervisor(gatePath) {
  // Gate must be a reviewed regular file at its canonical path; no gate is generated by this program.
  const gate = JSON.parse((await boundedFile(resolve(gatePath), 8192)).toString('utf8'));
  assert.equal(gate.kind, 'flow-svc05r01-once'); assert.equal(gate.backend, BACKEND); assert.deepEqual(gate.artifactIds, RETAINED.map(x => x.artifact.artifactId));
  assert.match(gate.run, /^[a-z0-9-]{1,64}$/); assert.ok(typeof gate.approvalId === 'string' && gate.approvalId.length < 160 && Date.parse(gate.expiresAt) > Date.now());
  assert.ok(Number.isInteger(gate.workMs) && gate.workMs > 0 && gate.workMs <= 90000); assert.equal(gate.cleanupMs, 20000);
  assert.ok(gate.minimumFreeBytes >= reserveBytes + 128 * 1024 ** 2);
  const sources = await sourceDigest(); assert.equal(sources.digest, gate.sourceDigest); assert.ok(await freeBytes(repository) >= gate.minimumFreeBytes);
  await mkdir(evidenceRoot, { recursive: true }); const directory = join(evidenceRoot, gate.run); await mkdir(directory, { mode: 0o700 });
  const started = Date.now(), workDeadline = started + gate.workMs, hardDeadline = workDeadline + gate.cleanupMs;
  await save(join(directory, 'reservation.json'), { gate, sources, startedAt: new Date(started).toISOString(), state: 'one-shot-reserved' });
  const children = [], ports = [], errors = [], metrics = { minimumFree: null, peakRaw: 0, peakTemp: 0 }, token = 'svc05r01-' + randomUUID();
  let owned, result, workerChild, chromeStarted = false, chromeTask, finishing = false, monitoring, monitor, workTimer, stopWork = false, checkpoint = false; const logs = new Map();
  const hardStop = setTimeout(() => {
    for (const child of children) if (groupState(child.pid) === 'present') { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    try { const fd = openSync(join(directory, 'hard-stop.json'), 'wx', 0o600); writeSync(fd, JSON.stringify({ at: new Date().toISOString(), owned, groups: children.map(x => ({ pid: x.pid, state: groupState(x.pid) })), cleanupConfirmed: false })); fsyncSync(fd); closeSync(fd); } catch {}
    // No irreversible cleanup follows an unfinished checkpoint. The original run reservation remains sealed.
    process.exit(1);
  }, hardDeadline - Date.now());
  const sampleResources = async () => {
    const free = await freeBytes(repository), raw = await diskBytes(directory), temp = owned ? await diskBytes(owned.parent) : { bytes: 0, files: 0 };
    metrics.minimumFree = Math.min(metrics.minimumFree ?? free, free); metrics.peakRaw = Math.max(metrics.peakRaw, raw.bytes); metrics.peakTemp = Math.max(metrics.peakTemp, temp.bytes);
    const withinThresholds = free >= reserveBytes + 64 * 1024 ** 2 && raw.bytes <= rawLimit && temp.bytes <= tmpLimit;
    if (!withinThresholds) stopWork = true;
    return { at: new Date().toISOString(), free, raw, temp, withinThresholds };
  };
  const remember = async (child, role) => {
    assert.ok(child.pid > 1); children.push(child); const log = { chunks: [], observedBytes: 0 }; logs.set(role, log);
    const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))); child.exited = exited;
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', bytes => {
      const remaining = Math.max(0, 65536 - log.observedBytes); log.observedBytes += bytes.length; if (remaining) log.chunks.push(bytes.subarray(0, remaining));
      if (log.observedBytes > 65536) { if (!log.exceeded) errors.push('Child output bound'); log.exceeded = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    });
    child.once('error', e => errors.push(cleanError(e, [token])));
    const ps = await execute('ps', ['-p', String(child.pid), '-o', 'pgid=', '-o', 'lstart='], { timeout: 1500 });
    assert.equal(Number(ps.stdout.trim().split(/\s+/)[0]), child.pid, 'Own detached group required');
    await save(join(directory, role + '-process.json'), { pid: child.pid, group: child.pid, observed: ps.stdout.trim(), role }); return child;
  };
  try {
    const sources = await backendIdentity(), facts = await inventory(); await save(join(directory, 'backend-source.json'), sources); await save(join(directory, 'inventory.json'), facts);
    assert.ok(Date.now() < workDeadline); owned = await allocateResources(); await save(join(directory, 'resource-reservation.json'), { ...owned, backend: BACKEND }); await initializeDatabase(owned, directory);
    const environment = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'].filter(n => process.env[n] !== undefined).map(n => [n, process.env[n]]));
    workerChild = await remember(fork(entry, ['--worker'], { cwd: repository, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: ['--import', 'tsx'], env: environment }), 'worker');
    const done = new Promise(resolve => {
      workerChild.on('message', value => {
        if (value.kind === 'result') { result = value.report; ports.push(result.centerPort, ...(result.previewPorts ?? [])); resolve(); }
        else if (value.kind === 'chrome' && !chromeStarted) {
          chromeStarted = true;
          chromeTask = (async () => {
            assert.equal(finishing, false); const chromeRoot = join(owned.parent, 'chrome'); await mkdir(chromeRoot, { mode: 0o700 });
            assert.equal(finishing, false);
            const chrome = await remember(spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + chromeRoot, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps', 'about:blank'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: environment }), 'chrome');
            const port = await until(async () => { try { const b = await boundedFile(join(chromeRoot, 'DevToolsActivePort'), 4096); const n = Number(b.toString().split('\n')[0]); return Number.isSafeInteger(n) && n > 0 && n < 65536 ? n : null; } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }, x => x !== null, undefined, 8000);
            ports.push(port); assert.equal(groupState(chrome.pid), 'present'); assert.equal(finishing, false); assert.equal(workerChild.connected, true); workerChild.send({ kind: 'chrome-ready', endpoint: `http://127.0.0.1:${port}` });
          })().catch(e => { errors.push(cleanError(e, [token])); resolve(); });
        }
      });
      workerChild.once('exit', resolve); workerChild.once('error', resolve);
    });
    workerChild.send({ kind: 'start', owned, token, inventory: facts, directory, workDeadline });
    monitor = setInterval(() => { if (monitoring) return; monitoring = (async () => {
      const sample = await sampleResources();
      if (!sample.withinThresholds || Date.now() >= workDeadline) { stopWork = true; try { process.kill(-workerChild.pid, 'SIGTERM'); } catch {} }
    })().catch(e => { errors.push(cleanError(e, [token])); stopWork = true; try { process.kill(-workerChild.pid, 'SIGTERM'); } catch {} }).finally(() => { monitoring = undefined; }); }, 200);
    await Promise.race([done, new Promise(resolve => { workTimer = setTimeout(resolve, Math.max(0, workDeadline - Date.now())); })]);
  } catch (e) { errors.push(cleanError(e, [token])); }
  finally {
    finishing = true; clearTimeout(workTimer); clearInterval(monitor); await monitoring; await chromeTask;
    const groups = []; for (const child of [...children].reverse()) groups.push(await stopGroup(child, hardDeadline - 6000));
    for (const [role, log] of logs) await save(join(directory, role + '-output.json'), { text: cleanError(Buffer.concat(log.chunks).toString(), [token]), observedBytes: log.observedBytes, capturedBytes: Buffer.concat(log.chunks).length, truncated: log.observedBytes > 4096 });
    const portObservations = await closedPorts(ports); if (portObservations.some(x => x.state !== 'absent')) errors.push('Owned listening port cleanup unknown');
    // Includes the last worker outputs and Chrome exit writes, before any DROP/removal.
    let finalSample; try { finalSample = await sampleResources(); } catch (e) { stopWork = true; errors.push(cleanError(e, [token])); }
    const initial = { result: result ?? null, errors, groups, portObservations, owned, metrics, finalSample: finalSample ?? null, elapsedMs: Date.now() - started, providerQueries: 0, personalActions: 0, stopWork };
    try { await save(join(directory, 'before-cleanup-checkpoint.json'), initial); checkpoint = true; } catch { errors.push('Checkpoint failed; DB/tmp retained'); }
    let cleanup = { state: 'retained', errors: [] };
    if (checkpoint && owned && result) cleanup = await cleanupResources(owned, directory, groups.every(x => x.state === 'absent') && portObservations.every(x => x.state === 'absent'));
    const finalRawBeforeReports = await diskBytes(directory);
    let passed = Boolean(finalRawBeforeReports.bytes <= rawLimit - 65536 && result?.passed && !stopWork && !errors.length && checkpoint && cleanup.removedDatabase && cleanup.removedTemp && !cleanup.errors.length);
    const verifiedReports = [];
    if (passed) {
      try {
        const { importWebCompatibility, verifyWebCompatibility } = await import(pathToFileURL(join(BACKEND_ROOT, 'tools/personal-preview/web-release.mjs')).href);
        const privateReports = join(directory, 'verified-reports'); await mkdir(privateReports, { mode: 0o700 });
        for (const item of result.results) {
        const dest = join(directory, item.label); await mkdir(dest); const checks = {};
        for (const [name, observations] of Object.entries(item.observations)) { const body = { format: 1, check: name, backendHead: BACKEND, artifactId: item.artifact.artifactId, observations }; await save(join(dest, name + '.json'), body); checks[name] = sha(await readFile(join(dest, name + '.json'))); }
        await save(join(dest, 'report.json'), { format: 1, policy: 'flow-web-api-v1', backendHead: BACKEND, artifact: item.artifact, checks });
        const compatibilityId = await importWebCompatibility({ directory: privateReports, reportDirectory: dest });
        await verifyWebCompatibility({ directory: privateReports, artifact: item.artifact, backendHead: BACKEND, compatibilityId });
        verifiedReports.push({ label: item.label, compatibilityId, artifact: item.artifact });
        }
      } catch (e) { passed = false; errors.push(cleanError(e, [token])); }
    }
    await save(join(directory, 'outcome.json'), { ...initial, errors, checkpoint, cleanup, passed, verifiedReports, finalRawBeforeReports, elapsedMs: Date.now() - started, limits: 'Sampling thresholds are observations, not OS quotas. PG/WAL bytes are outside private temp accounting.' });
    clearTimeout(hardStop); process.exitCode = passed ? 0 : 1; console.log(JSON.stringify({ passed, selectedApps: result?.results?.length ?? 0, databaseRemoved: cleanup.removedDatabase ?? false, tempRemoved: cleanup.removedTemp ?? false, groups, directory }));
  }
}
if (process.argv[2] === '--worker') await worker();
else if (process.argv[2] === '--run' && process.argv.length === 4) await supervisor(process.argv[3]);
else console.log(JSON.stringify({ state: 'NOT_RUN', requires: 'Explicit reviewed one-shot gate; source-only preparation is not execution permission.' }));
