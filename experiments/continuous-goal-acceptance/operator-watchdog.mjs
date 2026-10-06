import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRecord } from './records.mjs';

const TOTAL_MS = 150000, FINAL_CHECKPOINT_MS = 1000, MAX_GROUPS = 3;
function signal(target) {
  try { process.kill(target, 'SIGKILL'); return 'sent'; }
  catch (error) { return error.code === 'ESRCH' ? 'absent' : 'unknown'; }
}
function groupExists(pgid) {
  try { process.kill(-pgid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

/** Owns only this operator PID and its explicitly registered process groups; never removes DBs or directories. */
export async function startTotalDeadline({ directory, run, sourceDigest, totalMs = TOTAL_MS, finalCheckpointMs = FINAL_CHECKPOINT_MS }) {
  assert(isAbsolute(directory) && /^[a-z0-9-]{4,64}$/.test(run) && /^[a-f0-9]{64}$/.test(sourceDigest));
  assert(Number.isSafeInteger(totalMs) && totalMs >= 400 && totalMs <= TOTAL_MS);
  assert(Number.isSafeInteger(finalCheckpointMs) && finalCheckpointMs >= 50 && finalCheckpointMs < totalMs);
  const configuration = { directory, run, sourceDigest, parentPid: process.pid, nonce: randomUUID(),
    deadline: Date.now() + totalMs, finalCheckpointMs };
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--guard', JSON.stringify(configuration)],
    { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let sequence = 0, failed = false;
  const pending = new Map();
  function rejectPending() {
    failed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Independent watchdog unavailable.')); }
    pending.clear();
  }
  child.on('error', rejectPending); child.on('exit', rejectPending);
  child.on('message', message => {
    if (message?.nonce !== configuration.nonce) return;
    const entry = pending.get(message.id); if (!entry) return;
    clearTimeout(entry.timer); pending.delete(message.id); entry.resolve();
  });
  function request(type, values = {}) {
    assert(!failed && child.connected, 'Independent watchdog unavailable.');
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); failed = true; reject(new Error('Independent watchdog acknowledgement deadline.')); }, 1000);
      pending.set(id, { resolve, reject, timer });
      child.send({ type, id, nonce: configuration.nonce, ...values }, error => { if (error) rejectPending(); });
    });
  }
  await request('ready');
  // A completed report is not permission to disarm: the independent timer stays armed until automatic parent exit.
  child.unref(); child.channel.unref();
  return Object.freeze({ pid: child.pid, deadline: configuration.deadline,
    register: groups => request('register', { groups }), complete: () => request('complete') });
}

function guard(configuration) {
  assert(process.send && configuration.parentPid === process.ppid && configuration.parentPid > 1);
  assert(isAbsolute(configuration.directory) && /^[a-z0-9-]{4,64}$/.test(configuration.run));
  assert(/^[a-f0-9]{64}$/.test(configuration.sourceDigest));
  const remaining = configuration.deadline - Date.now();
  assert(Number.isSafeInteger(remaining) && remaining > 0 && remaining <= TOTAL_MS);
  assert(configuration.finalCheckpointMs >= 50 && configuration.finalCheckpointMs < remaining);
  const groups = new Set(); let complete = false, stopping = false;
  function stop(reason) {
    if (stopping) return; stopping = true;
    // Signal before any asynchronous persistence. A stuck filesystem must not keep the parent or known groups alive.
    const ownedGroups = [...groups].map(pgid => ({ pgid, signal: signal(-pgid), state: 'unconfirmed' }));
    const parentSignal = process.ppid === configuration.parentPid ? signal(configuration.parentPid) : 'already-detached';
    const report = { kind: 'flow.o16.total-deadline.v1', run: configuration.run, sourceDigest: configuration.sourceDigest,
      parentPid: configuration.parentPid, watchdogPid: process.pid, reason, outcome: 'unknown-retain', retainResources: true,
      ownedGroups, parentSignal, at: new Date().toISOString() };
    // The initial operator reservation remains the durable fallback if either final write cannot complete.
    void Promise.allSettled([
      writeRecord(join(configuration.directory, 'STOP.json'), report, { exclusive: true }),
      writeRecord(join(configuration.directory, 'watchdog-unknown.json'), report, { exclusive: true }),
    ]).then(() => process.exit(1));
  }
  setTimeout(() => stop('parent-total-deadline'), Math.max(0, remaining - configuration.finalCheckpointMs));
  setTimeout(() => process.exit(1), remaining); // Independent process exits even with pending final checkpoint I/O.
  process.on('message', message => {
    if (stopping) return;
    try {
      assert(message?.nonce === configuration.nonce && Number.isSafeInteger(message.id));
      if (message.type === 'register') {
        assert(!complete && Array.isArray(message.groups) && message.groups.length <= MAX_GROUPS);
        for (const pgid of message.groups) {
          assert(Number.isSafeInteger(pgid) && pgid > 1 && pgid !== process.pid && pgid !== configuration.parentPid);
          groups.add(pgid);
        }
        assert(groups.size <= MAX_GROUPS);
      } else if (message.type === 'complete') {
        assert([...groups].every(pgid => !groupExists(pgid))); complete = true;
      } else assert.equal(message.type, 'ready');
      process.send({ id: message.id, nonce: configuration.nonce });
    } catch { stop('watchdog-protocol-or-group-state-unconfirmed'); }
  });
  process.on('disconnect', () => {
    if (stopping) return;
    if (complete && [...groups].every(pgid => !groupExists(pgid))) process.exit(0);
    stop('parent-disconnected-before-completion');
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assert.equal(process.argv[2], '--guard'); assert.equal(process.argv.length, 4); guard(JSON.parse(process.argv[3])); }
  catch { process.exit(1); }
}
