import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir, cpus, platform, release } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { hash } from './host.mjs';

const execute = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] ?? 'docs/evidence/ctx01/measurements.json');
const temporary = await mkdtemp(join(tmpdir(), 'flow-ctx01-'));
const startedAt = new Date().toISOString(); const started = performance.now();
const samples = []; const failures = []; let originalBytesTotal = 0;
const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(p * values.length) - 1];
async function worker(mode, file, count, repetition) {
  const start = performance.now();
  const { stdout } = await execute(process.execPath, [join(here, 'worker.mjs'), mode, file, String(count), String(repetition)],
    { timeout: 10_000, maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, LANG: 'C' } });
  return { ...JSON.parse(stdout), processWallMs: performance.now() - start };
}
try {
  for (const sessions of [1, 10, 100]) {
    for (let repetition = 0; repetition < 20; repetition++) {
      assert.ok(performance.now() - started < 180_000, 'Run exceeded 180-second bound');
      const checkpoint = join(temporary, `checkpoint-${sessions}-${repetition}.json`);
      const prepare = await worker('prepare', checkpoint, sessions, repetition);
      originalBytesTotal += prepare.rawBytes;
      assert.ok(originalBytesTotal <= 20 * 1024 * 1024, 'Original-byte budget exceeded');
      assert.equal(hash(await readFile(checkpoint)), prepare.snapshotDigest);
      const restart = await worker('restart', checkpoint, sessions, repetition);
      assert.notEqual(prepare.pid, restart.pid); assert.equal(prepare.originalDigest, restart.originalDigest);
      assert.equal(prepare.verifiedRefs, 4 * sessions); assert.equal(restart.verifiedRefs, 4 * sessions);
      samples.push({ sessions, repetition, prepare, restart });
      await rm(checkpoint);
    }
  }
} catch (error) { failures.push({ message: error.message, code: error.code ?? null }); }
finally { await rm(temporary, { recursive: true, force: true }); }
const summaries = [1, 10, 100].map(sessions => {
  const selected = samples.filter(sample => sample.sessions === sessions);
  const steps = {};
  if (selected.length) for (const side of ['prepare', 'restart']) for (const name of Object.keys(selected[0][side].metrics)) {
    const observations = selected.map(sample => sample[side].metrics[name]);
    steps[name] = { N: observations.length, wallMs: { p50: quantile(observations.map(x => x.wallMs), 0.5), p95: quantile(observations.map(x => x.wallMs), 0.95) },
      cpuMs: { p50: quantile(observations.map(x => x.cpuUserMs + x.cpuSystemMs), 0.5), p95: quantile(observations.map(x => x.cpuUserMs + x.cpuSystemMs), 0.95) },
      sampledRssBytes: { min: Math.min(...observations.map(x => x.rssBeforeBytes)), max: Math.max(...observations.map(x => x.rssAfterBytes)) } };
  }
  return { sessions, repetitions: selected.length, steps, processPeakRssBytes: selected.length ? Math.max(...selected.flatMap(x => [x.prepare.peakRssBytes, x.restart.peakRssBytes])) : null };
});
const sourceFiles = (await readdir(here)).filter(name => name.endsWith('.mjs'));
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, hash(await readFile(join(here, name)))])));
const report = { format: 1, startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
  node: process.version, platform: platform(), osRelease: release(), cpu: cpus()[0]?.model, sourceHashes,
  repetitionsRequested: 20, counts: [1, 10, 100], originalByteLimit: 20 * 1024 * 1024, originalBytesTotal,
  modelCalls: 0, summarySource: 'fixed-handwritten', samples, summaries, failures,
  notes: ['Each step observation is one whole N-session batch, not per-session latency.', 'p50/p95 use nearest rank with N=20; short local shared-host sample, not SLO or agent capacity.',
    'CPU is process.cpuUsage per step; RSS sampled before/after, process maxRSS high-water also recorded.', 'Token estimator is synthetic UTF8 byte count /4; no provider tokens or billed cost.',
    'Checkpoint retains raw history plus separate content store, so storage can grow despite smaller visible context.', 'Restart uses a distinct OS process; version/CAS checks and fork lineage belong to this toy host only.'] };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
console.log(JSON.stringify({ output, samples: samples.length, originalBytesTotal, elapsedMs: report.elapsedMs, failures: failures.length }));
if (failures.length) process.exitCode = 1;
