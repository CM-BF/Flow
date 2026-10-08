/** Preparation only: a reviewed parent and a fresh single-use gate are mandatory. */
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gatePath = process.env.VISUAL_PICKER_BROWSER_GATE;
assert.equal(gatePath, join(base, 'child-gate.json'));
const gateStat = await lstat(gatePath);
assert(gateStat.isFile() && !gateStat.isSymbolicLink() && gateStat.size < 65536);
const gate = JSON.parse(await readFile(gatePath, 'utf8'));
assert.equal(gate.mode, 'visual-picker-browser');
assert.equal(gate.allowRun, true); assert.equal(gate.singleUse, true);
assert(Date.parse(gate.expiresAt) > Date.now());
const { parentPid, startedAtMs, workDeadlineMs, hardDeadlineMs, scratch, output,
  chromePid, chromePgid, chromeEndpoint, chromeOwnership } = gate.supervision;
assert.equal(parentPid, process.ppid); assert(parentPid > 1);
assert.equal(chromeOwnership, 'external-parent-native-sibling');
assert(Number.isSafeInteger(chromePid) && chromePid > 1 && chromePid !== process.pid && chromePid !== parentPid);
assert.equal(chromePgid, chromePid);
assert(/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(chromeEndpoint));
assert(Number(new URL(chromeEndpoint).port) > 0 && Number(new URL(chromeEndpoint).port) <= 65535);
assert([startedAtMs, workDeadlineMs, hardDeadlineMs, gate.previousRuntimeMs, gate.totalMs].every(Number.isSafeInteger));
assert.equal(gate.previousRuntimeMs, 0); assert.equal(gate.totalMs, 90000);
assert.equal(hardDeadlineMs, startedAtMs + gate.totalMs);
assert.equal(workDeadlineMs, hardDeadlineMs - 15000);
assert(startedAtMs <= Date.now() && Date.now() < workDeadlineMs);
for (const dir of [scratch, output]) assert.equal(await realpath(dir), dir);
assert.equal(scratch, join(base, 'scratch')); assert.equal(output, join(base, 'raw', gate.run));
assert(Buffer.byteLength(scratch, 'utf8') <= 40, 'Owned native socket temp prefix must remain short');
for (const key of ['TMPDIR', 'TMP', 'TEMP', 'MAC_CHROMIUM_TMPDIR', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE']) assert.equal(process.env[key], scratch);
assert.equal(process.env.TSX_DISABLE_CACHE, '1'); assert.equal(process.env.NODE_DISABLE_COMPILE_CACHE, '1');
const binding = JSON.parse(await readFile(join(base, 'binding.json'), 'utf8'));
assert.equal(hash(await readFile(join(base, 'binding.json'))), gate.bindingSha256);
assert.equal(binding.head, gate.sourceHead);
assert.equal(binding.task, 'WPF-VISUAL01');
assert.deepEqual(binding.sources, gate.sourceHashes);
const report = { sourceHead: gate.sourceHead, sourceHashes: gate.sourceHashes, implementation: binding.implementation,
  startedAt: new Date(startedAtMs).toISOString(), workerPid: process.pid, parentPid, chromePid,
  chromeProcessGroup: 'separate-parent-owned-session', chromeCleanupOwner: chromeOwnership, checks: [], pageErrors: [], cleanupErrors: [], outcome: 'failed', pg: 0,
  journeys: [], budgetOwner: 'external-parent', fixtureClosed: false, contextClosed: false, cdpConnectedAt: null };
let stopped = false, fixture, browser, context, page;
const stop = () => { stopped = true; };
const checkpoint = () => { if (stopped || Date.now() >= workDeadlineMs) throw new Error('Absolute work deadline; cleanup required'); };
process.on('SIGTERM', stop);
const workTimer = setTimeout(stop, Math.max(1, workDeadlineMs - Date.now()));
const hardTimer = setTimeout(() => {
  report.cleanupErrors.push('Hard deadline reached; parent owns both process groups');
  report.outcome = 'failed';
  try { writeFileSync(join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); } finally { process.exit(1); }
}, Math.max(1, hardDeadlineMs - Date.now()));
// An independent literal script: no serialized Node/TSX closure, no action or default cancellation.
const selectObserverSource = String.raw`(() => {
  if (window.top !== window || location.protocol !== "http:" || location.hostname !== "127.0.0.1" || !["/", "/native-select-control"].includes(location.pathname)) return;
  const state = { version: 1, state: "INSTALLED", eventLimit: 96, eventBytesLimit: 49152, perEventBytesLimit: 6144,
    optionsLimit: 8, textLimit: 192, events: [], eventBytes: 0, droppedEvents: 0, truncated: false, observerErrors: [] };
  Object.defineProperty(window, "__msgquickSelectTrace", { value: state, configurable: true });
  const encoder = new TextEncoder();
  let sequence = 0;
  function text(value, limit = 192) { return String(value ?? "").slice(0, limit); }
  function targetOf(event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return null;
    if (location.pathname === "/native-select-control" && document.title === "Message settings native control" && select.matches("[data-native-control]")) return { select, label: "模型" };
    if (document.title !== "Message settings fixture") return null;
    const dialog = select.closest('[role="dialog"]');
    const title = dialog && document.getElementById(dialog.getAttribute("aria-labelledby") || "");
    const fieldset = select.closest("fieldset");
    const label = select.closest("label");
    const labelText = label && Array.from(label.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim();
    if (!title || title.textContent !== "下一条消息设置" || fieldset?.querySelector(":scope > legend")?.textContent !== "快速筛选" || !["模型", "思考", "力度", "速度"].includes(labelText)) return null;
    return { select, label: labelText };
  }
  function record(event, target, phase, eventId) {
    if (state.events.length >= state.eventLimit || state.eventBytes >= state.eventBytesLimit) { state.droppedEvents++; state.truncated = true; return; }
    const select = target.select;
    const active = document.activeElement;
    const entry = { eventId, phase, type: event.type, key: text(event.key, 32), defaultPrevented: event.defaultPrevented,
      isTrusted: event.isTrusted, timestampMs: performance.now(), eventTimestampMs: event.timeStamp, label: target.label,
      value: text(select.value), selectedIndex: select.selectedIndex, connected: select.isConnected,
      disabled: select.disabled || !!select.closest("fieldset")?.disabled, focused: active === select,
      focus: active ? { tag: active.tagName, role: text(active.getAttribute("role"), 32), ariaLabel: text(active.getAttribute("aria-label"), 96) } : null,
      optionCount: select.options.length, optionsTruncated: select.options.length > state.optionsLimit,
      options: Array.from({ length: Math.min(select.options.length, state.optionsLimit) }, (_, index) => { const option = select.options[index]; return { value: text(option.value), text: text(option.text), selected: option.selected, disabled: option.disabled }; }) };
    const bytes = encoder.encode(JSON.stringify(entry)).byteLength;
    if (bytes > state.perEventBytesLimit || state.eventBytes + bytes > state.eventBytesLimit) { state.droppedEvents++; state.truncated = true; return; }
    state.events.push(entry); state.eventBytes += bytes;
  }
  for (const type of ["focusin", "focusout", "keydown", "keypress", "keyup", "input", "change"]) {
    document.addEventListener(type, event => {
      try {
        const target = targetOf(event); if (!target) return;
        const eventId = ++sequence;
        record(event, target, "capture", eventId);
        // Observes a later frame; it does not assert exactly when the native default ran.
        if (state.events.length < state.eventLimit && state.eventBytes < state.eventBytesLimit) requestAnimationFrame(() => {
          try { record(event, target, "next-animation-frame", eventId); }
          catch (error) { if (state.observerErrors.length < 4) state.observerErrors.push(text(error, 256)); }
        });
      } catch (error) { if (state.observerErrors.length < 4) state.observerErrors.push(text(error, 256)); }
    }, { capture: true, passive: true });
  }
})();`;

async function cleanupStep(name, action) {
  let timer;
  try {
    const ms = Math.max(1, Math.min(2000, hardDeadlineMs - Date.now() - 4000));
    await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} timeout`)), ms); })]);
  } catch (error) { report.cleanupErrors.push(`${name}: ${String(error).slice(0, 4096)}`); }
  finally { clearTimeout(timer); }
}
try {
  checkpoint();
  // Load actual own fixture and its public source dependencies through the pinned TSX mapping.
  const aliases = JSON.parse(await readFile(join(base, 'aliases.json'), 'utf8')).map(({ specifier, replacement }) => ({
    find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), replacement,
  }));
  const scenario = await import(pathToFileURL(binding.fixtureModule).href); checkpoint();
  fixture = await scenario.startMessageSettingsFixture({ cacheDir: join(scratch, 'vite'), aliases }); checkpoint();
  const { chromium } = await import(pathToFileURL(binding.playwrightModule).href); checkpoint();
  browser = await chromium.connectOverCDP(chromeEndpoint, { timeout: Math.min(3000, Math.max(1, workDeadlineMs - Date.now())) }); checkpoint();
  report.cdpConnectedAt = new Date().toISOString();
  context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); checkpoint();
  page = await context.newPage(); checkpoint();
  await page.addInitScript({ content: selectObserverSource }); checkpoint();
  page.on('pageerror', error => { if (report.pageErrors.length < 20) report.pageErrors.push(error.message.slice(0, 4096)); });
  const result = await scenario.checkMessageSettingsPicker(page, fixture, output); checkpoint();
  report.checks = result.checks; report.requests = result.requests; report.limitation = result.limitation;
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.checks, binding.expectedChecks.slice(0, 6)); assert.equal(report.checks.length, 6);
  // The presentation journey explicitly requires a fresh catalog/server and independent context.
  await cleanupStep('Behavior context close', async () => { await context.close(); report.contextClosed = true; });
  await cleanupStep('Behavior fixture close', async () => { await fixture.close(); report.fixtureClosed = true; });
  assert(report.contextClosed && report.fixtureClosed && report.cleanupErrors.length === 0);
  report.journeys.push({ name: 'behavior', checks: [...report.checks], contextClosed: true, fixtureClosed: true });
  context = undefined; fixture = undefined; page = undefined;
  report.contextClosed = false; report.fixtureClosed = false;
  checkpoint(); fixture = await scenario.startMessageSettingsFixture({ cacheDir: join(scratch, 'vite-overlay'), aliases }); checkpoint();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); checkpoint();
  page = await context.newPage(); checkpoint();
  page.on('pageerror', error => { if (report.pageErrors.length < 20) report.pageErrors.push(error.message.slice(0, 4096)); });
  const overlay = await scenario.checkMessageSettingsOverlays(page, fixture, output); checkpoint();
  report.checks.push(...overlay.checks); report.overlay = overlay;
  report.journeys.push({ name: 'overlay', checks: overlay.checks });
  assert.deepEqual(report.checks, binding.expectedChecks); assert.equal(report.checks.length, 8);
  assert.deepEqual(report.pageErrors, []); report.outcome = 'passed';
} catch (error) { report.failure = String(error.stack ?? error).slice(0, 16384); report.outcome = 'failed'; }
finally {
  clearTimeout(workTimer);
  // Capture before context close on both PASS and FAIL. Missing/failed observation is explicit JSON, never synthetic events.
  let trace = { version: 1, state: 'NOT_CAPTURED', reason: 'Page was not created' };
  await cleanupStep('Read select diagnostics', async () => {
    if (report.journeys.some(item => item.name === 'behavior')) { trace = { version: 1, state: 'BEHAVIOR_NATIVE_RECORD_SEPARATELY_SEALED' }; return; }
    if (!page) return;
    try {
      const encoded = await page.evaluate('JSON.stringify(globalThis.__msgquickSelectTrace ?? {version:1,state:"NOT_INSTALLED"})');
      assert.equal(typeof encoded, 'string'); assert(Buffer.byteLength(encoded, 'utf8') <= 65536, 'Bounded select diagnostic JSON');
      trace = JSON.parse(encoded);
    } catch (error) {
      trace = { version: 1, state: 'READ_FAILED', reason: String(error).slice(0, 2048) };
      report.cleanupErrors.push('Select diagnostics: ' + trace.reason);
    }
  });
  try {
    const encoded = JSON.stringify(trace) + '\n';
    assert(Buffer.byteLength(encoded, 'utf8') <= 65536, 'Bounded compact diagnostic JSON');
    await writeFile(join(output, 'select-diagnostics.json'), encoded);
    report.selectDiagnostics = { path: 'select-diagnostics.json', bytes: Buffer.byteLength(encoded, 'utf8'), sha256: hash(encoded), state: trace.state, truncated: trace.truncated ?? null };
  } catch (error) { report.cleanupErrors.push('Write select diagnostics: ' + String(error).slice(0, 2048)); }
  await cleanupStep('Context close', async () => { if (context) { await context.close(); report.contextClosed = true; } });
  // Pinned Playwright CDP close closes its transport; process signalling belongs solely to the parent.
  await cleanupStep('CDP disconnect', async () => { if (browser) await browser.close(); });
  await cleanupStep('Fixture close', async () => { if (fixture) { await fixture.close(); report.fixtureClosed = true; } });
  if (stopped || !report.contextClosed || !report.fixtureClosed || report.cleanupErrors.length || Date.now() >= hardDeadlineMs) report.outcome = 'failed';
  report.finishedAt = new Date().toISOString(); report.observedElapsedMs = Date.now() - startedAtMs;
  report.profileCleanupOwner = 'external-parent-after-both-process-groups-absent';
  await writeFile(join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  clearTimeout(hardTimer); process.off('SIGTERM', stop);
}
console.log(JSON.stringify({ outcome: report.outcome, checks: report.checks, cleanupErrors: report.cleanupErrors }));
if (report.outcome !== 'passed') process.exitCode = 1;
