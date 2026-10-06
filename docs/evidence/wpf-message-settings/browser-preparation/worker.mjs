/** Preparation only: a reviewed parent and a fresh single-use gate are mandatory. */
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, lstat, mkdtemp } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const base = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gatePath = process.env.MESSAGE_SETTINGS_BROWSER_GATE;
assert.equal(gatePath, join(base, 'child-gate.json'));
const gateStat = await lstat(gatePath);
assert(gateStat.isFile() && !gateStat.isSymbolicLink() && gateStat.size < 65536);
const gate = JSON.parse(await readFile(gatePath, 'utf8'));
assert.equal(gate.mode, 'message-settings-browser');
assert.equal(gate.allowRun, true); assert.equal(gate.singleUse, true);
assert(Date.parse(gate.expiresAt) > Date.now());
const { parentPid, startedAtMs, workDeadlineMs, hardDeadlineMs, scratch, output } = gate.supervision;
assert.equal(parentPid, process.ppid); assert(parentPid > 1);
assert([startedAtMs, workDeadlineMs, hardDeadlineMs, gate.previousRuntimeMs, gate.totalMs].every(Number.isSafeInteger));
assert.equal(gate.previousRuntimeMs + gate.totalMs, 60000);
assert.equal(hardDeadlineMs, startedAtMs + gate.totalMs);
assert.equal(workDeadlineMs, hardDeadlineMs - 15000);
assert(startedAtMs <= Date.now() && Date.now() < workDeadlineMs);
for (const dir of [scratch, output]) assert.equal(await realpath(dir), dir);
assert.equal(scratch, join(base, 'scratch')); assert.equal(output, join(base, 'raw', gate.run));
for (const key of ['TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE']) assert.equal(process.env[key], scratch);
assert.equal(process.env.TSX_DISABLE_CACHE, '1'); assert.equal(process.env.NODE_DISABLE_COMPILE_CACHE, '1');
const binding = JSON.parse(await readFile(join(base, 'binding.json'), 'utf8'));
assert.equal(hash(await readFile(join(base, 'binding.json'))), gate.bindingSha256);
assert.equal(binding.head, gate.sourceHead);
const report = { sourceHead: gate.sourceHead, sourceHashes: gate.sourceHashes, implementation: binding.implementation,
  startedAt: new Date(startedAtMs).toISOString(), workerPid: process.pid, parentPid, chromePid: null,
  chromeProcessGroup: 'inherited-worker', checks: [], pageErrors: [], cleanupErrors: [], outcome: 'failed', pg: 0,
  budgetOwner: 'external-parent', fixtureClosed: false, chromeExited: false };
let stopped = false, fixture, chrome, browser, launchError;
const chromeChunks = []; let chromeLogBytes = 0;
const exited = () => Boolean(chrome?.pid) && (chrome.exitCode !== null || chrome.signalCode !== null);
const signalChrome = signal => { if (chrome?.pid && !exited()) chrome.kill(signal); };
const stop = () => { stopped = true; signalChrome('SIGTERM'); };
const checkpoint = () => { if (stopped || Date.now() >= workDeadlineMs) throw new Error('Absolute work deadline; cleanup required'); };
process.on('SIGTERM', stop);
const workTimer = setTimeout(stop, Math.max(1, workDeadlineMs - Date.now()));
const hardTimer = setTimeout(() => {
  signalChrome('SIGKILL'); report.cleanupErrors.push('Hard deadline reached; parent must confirm group cleanup');
  report.outcome = 'failed';
  try { writeFileSync(join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); } finally { process.exit(1); }
}, Math.max(1, hardDeadlineMs - Date.now()));
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
  const profile = await mkdtemp(join(scratch, 'chrome-')); checkpoint();
  chrome = spawn(binding.chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--disk-cache-dir=${join(profile, 'disk-cache')}`, 'about:blank'], { detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.on('error', error => { launchError = error; });
  report.chromePid = chrome.pid ?? null;
  for (const stream of [chrome.stdout, chrome.stderr]) stream.on('data', chunk => {
    const kept = chunk.subarray(0, Math.max(0, 65536 - chromeLogBytes)); if (kept.length) chromeChunks.push(kept); chromeLogBytes += kept.length;
  });
  await writeFile(join(output, 'owned-chrome.json'), JSON.stringify({ workerPid: process.pid, chromePid: report.chromePid, profile, processGroup: 'inherited-worker' }) + '\n');
  let port; const launchDeadline = Math.min(workDeadlineMs, Date.now() + 8000);
  while (!port) {
    checkpoint(); if (launchError) throw launchError;
    if (exited()) throw new Error('Owned Chrome exited before CDP readiness');
    if (Date.now() >= launchDeadline) throw new Error('Owned Chrome CDP readiness timeout');
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!port) await delay(50);
  }
  assert(Number.isInteger(port) && port > 0 && port <= 65535); checkpoint();
  const { chromium } = await import(pathToFileURL(binding.playwrightModule).href); checkpoint();
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: Math.min(3000, Math.max(1, workDeadlineMs - Date.now())) }); checkpoint();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); checkpoint();
  const page = await context.newPage(); checkpoint();
  page.on('pageerror', error => { if (report.pageErrors.length < 20) report.pageErrors.push(error.message.slice(0, 4096)); });
  const result = await scenario.checkMessageSettingsPicker(page, fixture, output); checkpoint();
  report.checks = result.checks; report.requests = result.requests; report.limitation = result.limitation;
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(report.pageErrors, []); assert.equal(report.checks.length, 4);
  report.outcome = 'passed';
} catch (error) { report.failure = String(error.stack ?? error).slice(0, 16384); report.outcome = 'failed'; }
finally {
  clearTimeout(workTimer);
  await cleanupStep('Browser close', async () => { if (browser) await browser.close(); });
  signalChrome('SIGTERM');
  const termUntil = Math.min(hardDeadlineMs - 4000, Date.now() + 3000);
  while (chrome?.pid && !exited() && Date.now() < termUntil) await delay(25);
  if (chrome?.pid && !exited()) signalChrome('SIGKILL');
  const killUntil = Math.min(hardDeadlineMs - 3000, Date.now() + 1000);
  while (chrome?.pid && !exited() && Date.now() < killUntil) await delay(25);
  report.chromeExited = exited();
  await cleanupStep('Fixture close', async () => { if (fixture) { await fixture.close(); report.fixtureClosed = true; } });
  if (!report.chromeExited || !report.fixtureClosed || report.cleanupErrors.length || Date.now() >= hardDeadlineMs) report.outcome = 'failed';
  report.finishedAt = new Date().toISOString(); report.observedElapsedMs = Date.now() - startedAtMs;
  report.profileCleanupOwner = 'external-parent-after-process-group-absence';
  await writeFile(join(output, 'chrome.log'), Buffer.concat(chromeChunks));
  await writeFile(join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  clearTimeout(hardTimer); process.off('SIGTERM', stop);
}
console.log(JSON.stringify({ outcome: report.outcome, checks: report.checks, cleanupErrors: report.cleanupErrors }));
if (report.outcome !== 'passed') process.exitCode = 1;
