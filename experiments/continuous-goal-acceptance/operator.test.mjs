import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { supervise } from './operator.mjs';
async function peer(ignoreTerm = false) {
  const code = `${ignoreTerm ? "process.on('SIGTERM',()=>{});" : ''} console.log('ready'); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['-e', code], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  await once(child.stdout, 'data'); return child;
}
function gone(pgid) { assert.throws(() => process.kill(-pgid, 0), { code: 'ESRCH' }); }
test('operator retains a nonzero driver outcome and checks its entire owned group', async () => {
  const child = await peer();
  const result = supervise({ child, sample: async () => ({ groups: [], metrics: { bytes: 0 } }), persist: async () => {},
    markStop: async () => {}, outputFailure: () => false, bounds: { workMs: 1000, cleanupMs: 1100 } });
  child.kill('SIGTERM'); const report = await result;
  assert.equal(report.outcome, 'unknown-retain'); assert.equal(report.reason, 'driver-nonzero'); gone(child.pid);
});
test('independent work deadline stops a TERM-ignoring group within finite cleanup', async () => {
  const child = await peer(true); let marker;
  const report = await supervise({ child, sample: async () => ({ groups: [], metrics: {} }), persist: async () => {},
    markStop: async reason => { marker = reason; }, outputFailure: () => false, bounds: { workMs: 80, cleanupMs: 1200 } });
  assert.equal(report.outcome, 'unknown-retain'); assert.equal(marker, 'work-deadline'); assert(report.elapsedMs < 1500); gone(child.pid);
});
test('raw bound failure stops owned work and never turns cleanup into permission to delete resources', async () => {
  const child = await peer(); let marker;
  const report = await supervise({ child, sample: async () => ({ groups: [], metrics: {} }), persist: async () => {},
    markStop: async reason => { marker = reason; }, outputFailure: () => true, bounds: { workMs: 1000, cleanupMs: 1100 } });
  assert.equal(report.outcome, 'unknown-retain'); assert.equal(marker, 'raw-output-bound-or-write-failed'); gone(child.pid);
});
