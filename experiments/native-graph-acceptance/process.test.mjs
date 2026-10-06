import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { stopWorker } from './driver.mjs';

function groupExists(pgid) {
  try { process.kill(-pgid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function awaitExit(child) {
  if (child.exitCode !== null || child.signalCode) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture leader did not exit')), 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
}
test('stops its detached group after the leader exits while a grandchild ignores TERM', { timeout: 12_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'flow-o08-group-test-'));
  const ready = join(root, 'ready.json');
  const child = spawn(process.execPath, [fileURLToPath(new URL('./process-fixture.mjs', import.meta.url)), 'leader', ready], { detached: true, stdio: 'ignore' });
  try {
    await awaitExit(child); assert.equal(child.exitCode, 0);
    const { grandchildPid } = JSON.parse(await readFile(ready, 'utf8'));
    assert.equal(groupExists(child.pid), true);
    const report = { workerForcedKill: false }; const started = performance.now();
    await stopWorker(child, report);
    const present = groupExists(child.pid);
    t.diagnostic(JSON.stringify({ node: process.version, leaderPid: child.pid, leaderExit: child.exitCode, grandchildPid, groupPresentAfterStop: present, elapsedMs: performance.now() - started, report }));
    assert.equal(present, false, 'An exited leader must not hide a live descendant');
    assert.equal(report.workerForcedKill, true);
  } finally {
    if (groupExists(child.pid)) process.kill(-child.pid, 'SIGKILL');
    for (let tries = 0; tries < 100 && groupExists(child.pid); tries++) await delay(20);
    assert.equal(groupExists(child.pid), false, 'Test must remove its own detached group');
    await rm(root, { recursive: true, force: true });
  }
});
test('an already absent group is confirmed without forced killing', { timeout: 4000 }, async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { detached: true, stdio: 'ignore' });
  await awaitExit(child);
  const report = { workerForcedKill: false };
  await stopWorker(child, report);
  assert.equal(groupExists(child.pid), false);
  assert.equal(report.workerProcessGroup.state, 'stopped');
  assert.equal(report.workerForcedKill, false);
});
test('an unobservable group remains unknown and rejects instead of authorizing temporary cleanup', async t => {
  const child = { pid: process.pid, exitCode: 0 };
  const report = { workerForcedKill: false };
  t.mock.method(process, 'kill', (pid, signal) => {
    assert.equal(pid, -child.pid); assert.equal(signal, 0);
    throw Object.assign(new Error('Synthetic permission uncertainty'), { code: 'EPERM' });
  });
  await assert.rejects(stopWorker(child, report), { code: 'EPERM' });
  assert.equal(report.workerProcessGroup.state, 'unknown');
  assert.equal(report.workerForcedKill, false);
});
