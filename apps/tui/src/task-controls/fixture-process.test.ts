import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ownProcessGroup } from './fixture-process.js';
import { CancelJourney } from './fixture.js';

const error = (code: string) => Object.assign(Error('not recorded: private detail'), { code });
function fakeChild() {
  const child = Object.assign(new EventEmitter(), { pid: 99999999, exitCode: null as number | null, signalCode: null as NodeJS.Signals | null }) as ChildProcess;
  const exit = () => { child.exitCode = 0; child.emit('exit', 0, null); };
  return { child, exit, close: () => { exit(); child.emit('close', 0, null); } };
}
function clock(onWait: () => void = () => {}) {
  let time = 0;
  return { now: () => time, wait: async (ms: number) => { time += ms; onWait(); }, termMs: 50, reapMs: 25 };
}

test('[group lifecycle] unknown never signals, close and later absence resolve with original safe observation', async () => {
  const fake = fakeChild(); let closed = false;
  const owned = ownProcessGroup(fake.child, { ...clock(() => { closed = true; fake.close(); }),
    observe: () => { throw error(closed ? 'ESRCH' : 'EPERM'); }, signal: () => assert.fail('unknown must never signal') });
  const first = owned.stop(); assert.equal(owned.stop(), first);
  const result = await first;
  assert.equal(result.stopped, true); assert.equal(result.child.closed, true); assert.equal(result.failure, null);
  assert.deepEqual(result.signals, []); assert.deepEqual(result.observations[0], { state: 'unknown', code: 'EPERM' });
  assert.equal(result.observations.at(-1)?.state, 'absent'); assert.ok(!JSON.stringify(result).includes('private detail'));
});

test('[group lifecycle] persistent unknown preserves group identity and bounded error without retry', async () => {
  const fake = fakeChild(); const timer = clock();
  const owned = ownProcessGroup(fake.child, { ...timer, termMs: 3000, reapMs: 1000, observe: () => { throw error('EPERM'); }, signal: () => assert.fail('unknown signal') });
  const first = owned.stop(), result = await first;
  assert.equal(result.stopped, false); assert.equal(result.pgid, fake.child.pid);
  assert.deepEqual(result.failure, { phase: 'group', code: 'EPERM' });
  assert.equal(owned.stop(), first); assert.equal(timer.now(), 4000); assert.equal(result.observations.length, 8);
});

test('[group lifecycle] absence without real child close cannot pass', async () => {
  const fake = fakeChild(); fake.exit();
  const result = await ownProcessGroup(fake.child, { ...clock(), observe: () => { throw error('ESRCH'); }, signal: () => assert.fail('absent signal') }).stop();
  assert.equal(result.stopped, false); assert.equal(result.child.closed, false);
  assert.deepEqual(result.failure, { phase: 'child-close', code: null });
});

test('[group lifecycle] reaped leader cannot authorize a signal to a still-present numeric group', async () => {
  const fake = fakeChild();
  const owned = ownProcessGroup(fake.child, { ...clock(), observe: () => {}, signal: () => assert.fail('reaped identity') });
  fake.close(); const result = await owned.stop();
  assert.equal(result.stopped, false); assert.equal(result.child.closed, true);
  assert.deepEqual(result.failure, { phase: 'group', code: null }); assert.deepEqual(result.signals, []);
});

test('[group lifecycle] TERM waits for close, then absence; signal failure stays primary after closure', async () => {
  const fake = fakeChild(); let closed = false, calls = 0;
  const result = await ownProcessGroup(fake.child, { ...clock(() => { closed = true; fake.close(); }),
    observe: () => { if (closed) throw error('ESRCH'); }, signal: (_id, signal) => { calls++; assert.equal(signal, 'SIGTERM'); throw error('EACCES'); } }).stop();
  assert.equal(calls, 1); assert.equal(result.stopped, true); assert.equal(result.child.closed, true);
  assert.deepEqual(result.failure, { phase: 'signal', code: 'EACCES' });
});

test('[group lifecycle] TERM/KILL remain bounded and final absent still waits for close', async () => {
  const fake = fakeChild(); let killed = false;
  const result = await ownProcessGroup(fake.child, { ...clock(() => { if (killed) fake.close(); }),
    observe: () => { if (killed) throw error('ESRCH'); }, signal: (_id, signal) => { if (signal === 'SIGKILL') killed = true; } }).stop();
  assert.equal(result.stopped, true); assert.deepEqual(result.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(result.failure, null); assert.equal(result.child.closed, true);
});

test('[group lifecycle] unknown unsafe codes never expose their contents or child error primary', async () => {
  const fake = fakeChild(); let closed = false;
  const owned = ownProcessGroup(fake.child, { ...clock(() => { closed = true; fake.close(); }),
    observe: () => { throw error(closed ? 'ESRCH' : 'secret-like-code'); }, signal: () => assert.fail('child error must bar signals') });
  fake.child.emit('error', error('EIO'));
  const result = await owned.stop();
  assert.equal(result.stopped, true); assert.deepEqual(result.failure, { phase: 'child', code: 'EIO' });
  assert.deepEqual(result.observations[0], { state: 'unknown', code: null }); assert.ok(!JSON.stringify(result).includes('secret-like'));
});

test('[group lifecycle] actual fixture retains work primary and concrete group error after real child close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tui-owned-group-'));
  const fixture = new CancelJourney(directory, { kind: 'web-handoff', adapterVersion: 'synthetic',
    createCenter: async () => { throw Error('not a PG test'); }, beforeCleanup: async () => ({ withinBound: true }) });
  const child = spawn(process.execPath, ['-e', "process.stdout.write('ready\\n'); setTimeout(() => {}, 150);"],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', TMPDIR: tmpdir() } });
  const owned = fixture.registerHandoffGroup(child);
  child.stdout!.resume(); child.stderr!.resume();
  try {
    await once(child.stdout!, 'data');
    // Actual child handle and OS observation; injected notification cannot authorize a signal.
    child.emit('error', error('EIO'));
    fixture.failed('original-work-primary');
    await assert.rejects(fixture.close(), /evidence\/cleanup incomplete/);
    const saved = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
    assert.equal(saved.failures[0], 'original-work-primary'); assert.ok(saved.failures.includes('groups'));
    assert.equal(saved.cleanup.groups, 'unknown'); assert.equal(saved.cleanup.irreversibleCleanup, false);
    const group = saved.cleanup.groupDetails[0];
    assert.equal(group.pgid, child.pid); assert.equal(group.stopped, true); assert.equal(group.child.closed, true);
    assert.deepEqual(group.failure, { phase: 'child', code: 'EIO' }); assert.deepEqual(group.signals, []);
    assert.equal(group.observations.at(-1).state, 'absent');
  } finally {
    const stopped = await owned.stop(); assert.equal(stopped.stopped, true);
    for (const name of ['checkpoint.json', 'result.json']) await unlink(join(directory, name));
    await rmdir(directory);
  }
});
