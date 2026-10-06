import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const watchdogModule = new URL('./operator-watchdog.mjs', import.meta.url).href;
function exists(pid, group = false) {
  try { process.kill(group ? -pid : pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function eventuallyGone(pid, group = false) {
  const deadline = Date.now() + 1000;
  while (exists(pid, group) && Date.now() < deadline) await delay(10);
  assert.equal(exists(pid, group), false, `Owned ${group ? 'group' : 'process'} ${pid} remains.`);
}
async function standIn(mode) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o16-watchdog-'));
  await writeFile(join(directory, 'retained-resource'), 'Do not remove on an unknown outcome.');
  const script = `
    import { startTotalDeadline } from ${JSON.stringify(watchdogModule)};
    import { spawn } from 'node:child_process';
    import { once } from 'node:events';
    const guard = await startTotalDeadline({ directory: process.env.OWN_DIRECTORY, run: 'owned-stand-in', sourceDigest: 'a'.repeat(64), totalMs: 1000, finalCheckpointMs: 150 });
    let pgid;
    if (process.env.OWN_MODE === 'persist') {
      const peer = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000);"], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
      await once(peer.stdout, 'data'); pgid = peer.pid; await guard.register([pgid]);
      process.send({ mode: 'persist-entered', watchdogPid: guard.pid, pgid });
      const persist = () => new Promise(() => {}); await persist();
    } else {
      await guard.complete();
      process.send({ mode: 'complete-reported', watchdogPid: guard.pid });
      if (process.env.OWN_MODE === 'blocked') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      else process.disconnect();
    }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { detached: true,
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, OWN_DIRECTORY: directory, OWN_MODE: mode } });
  let stderr = ''; child.stderr.on('data', value => { stderr += value; });
  const closed = once(child, 'close');
  const emergency = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 4000);
  let facts;
  try {
    [facts] = await Promise.race([once(child, 'message'), closed.then(() => { throw new Error(`Stand-in exited before setup: ${stderr}`); })]);
    const result = await closed;
    await eventuallyGone(child.pid, true); await eventuallyGone(facts.watchdogPid);
    if (facts.pgid) await eventuallyGone(facts.pgid, true);
    assert.equal(await readFile(join(directory, 'retained-resource'), 'utf8'), 'Do not remove on an unknown outcome.');
    const report = await readFile(join(directory, 'watchdog-unknown.json'), 'utf8').then(JSON.parse, error => { if (error.code === 'ENOENT') return null; throw error; });
    return { result, report, facts, stderr };
  } finally {
    clearTimeout(emergency);
    // Test-only cleanup after all owned processes were observed gone; the watchdog itself never deletes these files.
    if (!exists(child.pid, true) && (!facts?.pgid || !exists(facts.pgid, true)) && (!facts?.watchdogPid || !exists(facts.watchdogPid))) await rm(directory, { recursive: true });
  }
}
test('separate watchdog bounds a hanging persist and stops the registered owned group without resource deletion', { timeout: 5000 }, async () => {
  const { result, report, facts } = await standIn('persist');
  assert.deepEqual(result, [null, 'SIGKILL']); assert.equal(report.reason, 'parent-total-deadline');
  assert.equal(report.outcome, 'unknown-retain'); assert.equal(report.retainResources, true);
  assert.equal(report.ownedGroups[0].pgid, facts.pgid); assert.equal(report.ownedGroups[0].state, 'unconfirmed');
});
test('completion acknowledgement does not disarm the watchdog while the parent event loop remains blocked', { timeout: 5000 }, async () => {
  const { result, report } = await standIn('blocked');
  assert.deepEqual(result, [null, 'SIGKILL']); assert.equal(report.reason, 'parent-total-deadline');
});
test('durable completion followed by normal parent exit releases the independent watchdog', { timeout: 5000 }, async () => {
  const { result, report } = await standIn('normal');
  assert.deepEqual(result, [0, null]); assert.equal(report, null);
});
