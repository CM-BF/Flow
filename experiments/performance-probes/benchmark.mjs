import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { cpus, totalmem, loadavg, platform, release, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startToyServer } from './server.mjs';

const smoke = process.argv.includes('--smoke');
const repetitions = smoke ? 1 : 20, warmups = smoke ? 0 : 2;
const directory = new URL('../../docs/evidence/lab01/', import.meta.url);
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_MODULE ?? '@playwright/test');
const raw = { schema: 1, observedAt: new Date().toISOString(), smoke, repetitions, warmups, samples: [], validity: [], screenshots: [], failures: [] };
const sourceFiles = ['server.mjs', 'app.js', 'style.css', 'index.html', 'benchmark.mjs'];
raw.source = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), files: Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex')])) ) };
raw.environment = { node: process.version, playwrightModule: process.env.LAB_PLAYWRIGHT_MODULE ?? '@playwright/test', platform: platform(), release: release(), arch: arch(), cpu: cpus()[0].model, logicalCpus: cpus().length, memoryGiB: totalmem() / 1024 ** 3, loadAverageStart: loadavg(), browserChannel: 'chrome', headless: true, viewport: { width: 1365, height: 1000 }, noise: 'Shared workstation; other Flow agents and background apps may run concurrently. No CPU/network throttling, no claim of isolation.' };
raw.boundaries = { a: 'HTTP localhost gzip/no-store; JSON.parse only for parseMs; expandDomMs ends at DOM text assignment, not paint; hash verification excluded from expansion timer. encodedBodyBytes is browser-observed compressed body; transferBytes is Resource Timing header+body counter, not TCP/TLS packet capture.', b: 'Same 8192 deterministic events, 128 agents. Immediate writes once/event; batched processes all events in chunks of 1024 and coalesces display writes per agent. MutationObserver counts real characterData mutations only inside grid. queuedControlDelayMs is in-browser setTimeout(0)->synthetic button handler; not Playwright command latency, human input, or INP. completionMs ends at final DOM assignment; batching includes frame waits. Long tasks overlap this window; no forced layout/busy-wait. Two final rAFs only flush observer delivery, not paint measurements.', percentiles: 'Nearest-rank p50/p95 of 20 valid measurements per mode; warmups excluded. No p99/SLO.', budgets: { sampleMsLessThan: 10000, benchmarkMsTargetMax: 120000, dataBytesMax: 64 * 1024 ** 2, modelCalls: 0, cloudCalls: 0 } };
let browser, toy;
const totalStart = performance.now();
function check(condition, message) { if (!condition) throw new Error(message); }
function quantile(values, fraction) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * fraction) - 1]; }
function summarize(samples, mode, fields) {
  const valid = samples.filter(sample => sample.mode === mode && !sample.warmup && sample.correct);
  return { validSamples: valid.length, metrics: Object.fromEntries(fields.map(field => {
    const values = valid.map(sample => field.split('.').reduce((value, key) => value[key], sample));
    return [field, { p50: quantile(values, .5), p95: quantile(values, .95), min: Math.min(...values), max: Math.max(...values) }];
  })) };
}
async function measured(page, toyName, mode, iteration, warmup) {
  const started = performance.now();
  let timer;
  try {
    const result = await Promise.race([
      page.evaluate(({ toyName, mode }) => window.lab[toyName](mode), { toyName, mode }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Sample exceeded 9s: ${toyName}/${mode}`)), 9000); }),
    ]);
    const elapsedMs = performance.now() - started;
    check(elapsedMs < 10000 && result.correct, 'Invalid sample');
    raw.samples.push({ toy: toyName, iteration, warmup, sampleWallMs: elapsedMs, ...result });
    check(performance.now() - totalStart < 120000, 'Total benchmark budget exceeded');
    return result;
  } finally { clearTimeout(timer); }
}
try {
  toy = await startToyServer(); raw.parameters = toy.parameters; raw.url = toy.url;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  raw.environment.browser = await browser.version();
  const context = await browser.newContext({ viewport: raw.environment.viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => raw.failures.push(error.message));
  await page.goto(toy.url, { waitUntil: 'domcontentloaded' });
  await page.locator('body[data-ready="true"]').waitFor();
  await page.waitForFunction(() => window.lab?.ready === true);
  raw.environment.observedTimerStepMs = await page.evaluate(() => {
    let previous = performance.now(), minimum = Infinity;
    for (let index = 0; index < 20000; index++) { const current = performance.now(); if (current > previous) minimum = Math.min(minimum, current - previous); previous = current; }
    return Number.isFinite(minimum) ? minimum : null;
  });
  for (let index = -warmups; index < repetitions; index++) {
    const orderA = index % 2 === 0 ? ['full', 'folded'] : ['folded', 'full'];
    const orderB = index % 2 === 0 ? ['immediate', 'batched'] : ['batched', 'immediate'];
    const a = [];
    for (const mode of orderA) a.push(await measured(page, 'runA', mode, index, index < 0));
    check(a[0].contentDigest === a[1].contentDigest, 'Expanded content differs by strategy');
    check(a[0].timelineDigest === a[1].timelineDigest, 'Timeline body/reference identity differs by strategy');
    const b = [];
    for (const mode of orderB) b.push(await measured(page, 'runB', mode, index, index < 0));
    check(b[0].checksum === b[1].checksum && JSON.stringify(b[0].finalState) === JSON.stringify(b[1].finalState), 'Final states differ by strategy');
    raw.validity.push({ iteration: index, warmup: index < 0, timelineDigestMatches: true, expandedDigestMatches: true, finalStateMatches: true, allLogicalEventsRetained: b.every(value => value.logicalEvents === 8192), domCountsMatch: b.every(value => value.writes === value.domMutations) });
  }
  raw.benchmarkWallMs = performance.now() - totalStart;
  raw.summary = {
    A: Object.fromEntries(['full', 'folded'].map(mode => [mode, summarize(raw.samples, mode, ['timeline.uncompressedBytes', 'timeline.encodedBodyBytes', 'timeline.transferBytes', 'timeline.parseMs', 'timeline.fetchTextMs', 'expandedTotal.uncompressedBytes', 'expandedTotal.encodedBodyBytes', 'expandedTotal.transferBytes', 'expandedTotal.parseMs', 'expandDomMs', 'requests'])])),
    B: Object.fromEntries(['immediate', 'batched'].map(mode => [mode, summarize(raw.samples, mode, ['domMutations', 'completionMs', 'queuedControlDelayMs', 'longTaskCount', 'longTaskTotalMs'])])),
  };
  await mkdir(directory, { recursive: true });
  if (!smoke) {
    // UI correctness and screenshots happen after timing, outside benchmark samples.
    await page.getByRole('button', { name: '按需详情', exact: true }).click();
    await page.getByRole('button', { name: '展开第一条详情', exact: true }).click();
    await page.locator('#detail').waitFor({ state: 'visible' });
    for (const width of [1365, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.getElementById('theme').textContent = theme === 'dark' ? '切换浅色' : '切换深色'; }, theme);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
        const file = `${width === 390 ? 'narrow' : 'desktop'}-${theme}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(file, directory)), fullPage: true });
        raw.screenshots.push(file);
      }
    }
  }
  check(raw.failures.length === 0, 'Browser runtime errors occurred');
} catch (error) { raw.failures.push(error.stack ?? String(error)); process.exitCode = 1; }
finally {
  raw.environment.loadAverageEnd = loadavg();
  raw.traffic = toy ? { ...toy.traffic } : null;
  raw.totalWallMs = performance.now() - totalStart;
  await browser?.close(); await toy?.close();
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(smoke ? 'smoke.json' : 'results.json', directory), JSON.stringify(raw, null, 2) + '\n');
  const savedBytes = (await Promise.all((await readdir(directory)).map(name => stat(new URL(name, directory))))).reduce((sum, file) => sum + file.size, 0);
  check(savedBytes < 64 * 1024 ** 2, 'Saved evidence exceeded data budget');
  console.log(JSON.stringify({ smoke, validSamples: raw.samples.filter(sample => !sample.warmup && sample.correct).length, benchmarkWallMs: raw.benchmarkWallMs, savedBytes, failures: raw.failures, summary: raw.summary }, null, 2));
}
