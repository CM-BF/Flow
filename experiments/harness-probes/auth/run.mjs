import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const scenarios = ['priority', 'threshold', 'rotate-once-2', 'rotate-once-16', 'shared-temp-2', 'shared-temp-16', 'unbounded-refresh', 'injected-timeout', 'injected-cancel'];
const [filename] = process.argv.slice(2);
if (!filename) throw new Error('Pass a new output JSON path; existing evidence will never be overwritten.');
const provenance = JSON.parse(await readFile(new URL('./provenance.json', import.meta.url), 'utf8'));
for (const file of provenance.files) {
  const bytes = await readFile(path.join(directory, 'upstream', file.package, file.path));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Upstream copy hash mismatch: ${file.path}`);
}
async function runCase(scenario) {
  const root = await mkdtemp(path.join(tmpdir(), 'flow-e01-synthetic-'));
  const started = performance.now();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--no-warnings', path.join(directory, 'worker.mjs'), scenario, root], {
        env: { PATH: path.dirname(process.execPath), LANG: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '', timedOut = false, forceKill;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); forceKill = setTimeout(() => child.kill('SIGKILL'), 300); }, scenario === 'unbounded-refresh' ? 700 : 3000);
      child.stdout.on('data', chunk => { stdout += chunk; if (Buffer.byteLength(stdout) > 64 * 1024) child.kill('SIGKILL'); });
      child.stderr.on('data', chunk => { stderr += chunk; if (Buffer.byteLength(stderr) > 8192) child.kill('SIGKILL'); });
      child.on('error', reject);
      child.on('close', (code, signal) => {
        clearTimeout(timer); clearTimeout(forceKill);
        let messages;
        try { messages = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
        catch { reject(new Error('Unexpected child output')); return; }
        resolve({ scenario, elapsedMs: performance.now() - started, code, signal, timedOut, stderr, messages });
      });
    });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const startedAt = new Date().toISOString();
const observations = [];
for (const scenario of scenarios) observations.push(await runCase(scenario));
const passed = observations.every(item => item.messages.length === 1 && !item.messages[0].failure &&
  (item.scenario === 'unbounded-refresh' ? item.timedOut && item.signal === 'SIGTERM' && item.messages[0].observation.helperSettledAfter150ms === false : item.code === 0 && !item.timedOut));
const report = { startedAt, finishedAt: new Date().toISOString(), node: process.version, packages: provenance.packages,
  modelCalls: 0, realRefreshCalls: 0, realKeychainCalls: 0, syntheticOnly: true, result: passed ? 'passed' : 'failed', observations };
await writeFile(filename, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ result: report.result, scenarios: observations.length, output: filename }));
if (!passed) process.exitCode = 1;
