/** Preparation only: a reviewed parent and a fresh single-use gate are mandatory. */
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gatePath = process.env.CONNECTION_UX_BROWSER_GATE;
assert.equal(gatePath, join(base, 'child-gate.json'));
const gateStat = await lstat(gatePath);
assert(gateStat.isFile() && !gateStat.isSymbolicLink() && gateStat.size < 65536);
const gate = JSON.parse(await readFile(gatePath, 'utf8'));
assert.equal(gate.mode, 'connection-ux-browser');
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
assert.equal(gate.previousRuntimeMs, 0); assert.equal(gate.totalMs, 60000);
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
assert.equal(binding.task, 'MATURE06-04');
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
  fixture = await scenario.startConnectionFixture({ cacheDir: join(scratch, 'vite'), aliases }); checkpoint();
  const { chromium } = await import(pathToFileURL(binding.playwrightModule).href); checkpoint();
  browser = await chromium.connectOverCDP(chromeEndpoint, { timeout: Math.min(3000, Math.max(1, workDeadlineMs - Date.now())) }); checkpoint();
  report.cdpConnectedAt = new Date().toISOString();
  context = await browser.newContext({ viewport: { width: 1280, height: 844 }, reducedMotion: 'reduce' }); checkpoint();
  page = await context.newPage(); checkpoint();
  page.on('pageerror', error => { if (report.pageErrors.length < 20) report.pageErrors.push(error.name); });
  const result = await scenario.checkConnection(page, fixture, output); checkpoint();
  report.checks = result.checks; report.component = result;
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.checks, binding.expectedChecks); assert.equal(report.checks.length, 6);
  report.outcome = 'passed';
} catch (error) { report.failure = /^[A-Za-z]{1,64}$/.test(error?.name ?? "") ? error.name : "Error"; report.outcome = 'failed'; }
finally {
  clearTimeout(workTimer);
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
