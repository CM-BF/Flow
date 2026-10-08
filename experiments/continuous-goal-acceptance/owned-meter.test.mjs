import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, lstat, symlink, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createOwnedMeter } from './owned-meter.mjs';
import { METER_BRIDGE, METER_RUNTIME } from './meter-bridge.mjs';
import { BOUNDS, measureRun, measurementFailure, assertCleanupBudget } from './operator-bounds.mjs';

async function fixture(t) {
  assert(process.env.FLOW_O16_METER_SCRATCH, 'Explicit owned scratch required');
  const root = await mkdtemp(join(resolve(process.env.FLOW_O16_METER_SCRATCH), 'sample-'));
  const original = await lstat(root);
  t.after(async () => {
    const current = await lstat(root);
    assert.equal(current.dev, original.dev); assert.equal(current.ino, original.ino);
    await rm(root, { recursive: true });
  });
  const roots = [];
  for (const stage of ['stage-evidence', 'operator-evidence', 'runtime']) {
    const path = join(root, stage); await mkdir(path); const stat = await lstat(path);
    roots.push({ stage, path, ...(stage === 'runtime' ? { identity: { dev: stat.dev, ino: stat.ino } } : {}) });
  }
  return { root, roots };
}
function instrumentedSpawn(stats, program) {
  return (file, argv, options) => {
    assert.equal(file, METER_RUNTIME.python); assert.equal(options.detached, false);
    assert.deepEqual(Object.keys(options.env).sort(), ['LANG', 'PATH']);
    const child = spawn(file, program ? ['-I', '-B', '-c', program] : argv, options);
    stats.started++; stats.pid = child.pid;
    child.on('close', () => { stats.closed++; assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' }); });
    return child;
  };
}
test('O16 meter: real three-root batch closes one inherited helper and measures current consumer', async t => {
  const f = await fixture(t), stats = { started: 0, closed: 0 };
  await writeFile(join(f.roots[0].path, 'safe'), 'abc');
  await writeFile(join(f.roots[2].path, 'safe'), '12345');
  const meter = createOwnedMeter({ spawnChild: instrumentedSpawn(stats) });
  const metrics = await measureRun('synthetic-run', { path: f.roots[2].path, ...f.roots[2].identity }, {
    statfs: async () => ({ bavail: BOUNDS.reserveBytes, bsize: 1 }),
    measureRoots: async requested => {
      assert.deepEqual(requested.map(x => x.stage), f.roots.map(x => x.stage));
      return meter(f.roots);
    },
  });
  assert.equal(metrics.rawBytes, 3); assert.equal(metrics.runtimeBytes, 5);
  assert.equal(metrics.runtimeEntries, 2); assert.equal(metrics.vanishedEntries, 0);
  assert.equal(metrics.runtimeState, 'measured'); assert(metrics.measurementElapsedMs < 200);
  assert.deepEqual({ started: stats.started, closed: stats.closed }, { started: 1, closed: 1 });
  t.diagnostic(JSON.stringify({ sampleElapsedMs: metrics.measurementElapsedMs, helperClosed: true, roots: 3, nonAtomic: true }));
});
test('O16 meter: missing optional evidence stays distinct from changed runtime identity', async t => {
  const f = await fixture(t);
  await rm(f.roots[0].path, { recursive: true }); f.roots[2].identity.ino++;
  await assert.rejects(createOwnedMeter()(f.roots), { code: 'O16_METER_ROOT_IDENTITY_CHANGED', measurementStage: 'runtime' });
});
test('O16 meter: symlink remains rejected rather than becoming a measured zero', async t => {
  const f = await fixture(t); await symlink('/does-not-exist', join(f.roots[2].path, 'link'));
  await assert.rejects(createOwnedMeter()(f.roots), { code: 'O16_METER_SYMLINK', measurementStage: 'runtime' });
});
test('O16 meter: real rename/unlink gaps reuse fixed module while opened-directory and I/O faults stay unknown', async t => {
  const f = await fixture(t);
  const program = `${METER_BRIDGE}\n
from pathlib import Path
from unittest.mock import patch
request = json.load(sys.stdin)
meter = load_meter()
root = Path(request['roots'][2]['path'])
real_stat, real_scandir = meter.os.stat, meter.os.scandir
def scan():
    return observe([request][0], meter)['results'][-1]
# Enumerated file unlink and atomic rename both exercise actual filesystem gaps.
for action in ('unlink', 'rename'):
    leaf = root / 'gone'
    leaf.write_bytes(b'bounded synthetic data')
    def vanish(path, *args, **kwargs):
        if path == 'gone' and leaf.exists():
            leaf.unlink() if action == 'unlink' else leaf.rename(root / 'moved')
        return real_stat(path, *args, **kwargs)
    with patch.object(meter.os, 'stat', side_effect=vanish):
        result = scan()
    assert result['state'] == 'complete' and result['vanished'] == 1
    (root / 'moved').unlink(missing_ok=True)
# A directory already opened and enumerated may not silently disappear.
opened = root / 'opened'; opened.mkdir()
opened_inode = opened.stat().st_ino
def unlink_opened(fd):
    if os.fstat(fd).st_ino == opened_inode:
        opened.rmdir()
    return real_scandir(fd)
with patch.object(meter.os, 'scandir', side_effect=unlink_opened):
    result = scan()
assert result['state'] == 'unknown' and result['code'] == 'DIRECTORY_BINDING_UNKNOWN'
# Controlled permission/I/O error shapes use the same public meter.
(root / 'fault').write_bytes(b'x')
for number in (errno.EACCES, errno.EIO):
    def fail_stat(path, *args, **kwargs):
        if path == 'fault': raise OSError(number, 'private fixture text')
        return real_stat(path, *args, **kwargs)
    with patch.object(meter.os, 'stat', side_effect=fail_stat):
        result = scan()
    assert result['state'] == 'unknown' and result['code'] == 'ENTRY_IO'
# Actual OS bad-descriptor error; this is a synthetic fault, not the old cause.
def closed_descriptor(path, *args, **kwargs):
    if path == 'fault': kwargs['dir_fd'] = -1
    return real_stat(path, *args, **kwargs)
with patch.object(meter.os, 'stat', side_effect=closed_descriptor):
    assert scan()['code'] == 'ENTRY_IO'
(root / 'fault').unlink()
# Root disappearance remains unknown, even though descendants may vanish.
root.rmdir()
assert scan()['code'] == 'ROOT_IO'
root.mkdir()
info = root.stat(); request['roots'][2]['identity'] = dict(dev=info.st_dev, ino=info.st_ino)
print(json.dumps(observe(request, meter)))
`;
  const stats = { started: 0, closed: 0 };
  const value = await createOwnedMeter({ spawnChild: instrumentedSpawn(stats, program) })(f.roots);
  assert.equal(value.roots.length, 3); assert.equal(stats.closed, 1);
});
test('O16 meter: input/source validation and module import do not launch a helper', async () => {
  let spawned = 0;
  const options = { spawnChild: () => { spawned++; assert.fail('No helper authorized'); } };
  const meter = createOwnedMeter(options);
  await assert.rejects(meter([{ stage: 'runtime', path: '/synthetic' }]), { code: 'O16_METER_INPUT' });
  await assert.rejects(meter(Array(4).fill({ stage: 'runtime', path: '/synthetic' })), { code: 'O16_METER_INPUT' });
  await assert.rejects(createOwnedMeter({ ...options, verify: async () => { throw new Error('source changed'); } })([
    { stage: 'operator-evidence', path: '/synthetic' }]), { code: 'O16_METER_SOURCE' });
  assert.equal(spawned, 0);
});
test('O16 meter: fixed Python loader refuses changed shared source binding before target traversal', async t => {
  const f = await fixture(t), stats = { started: 0, closed: 0 };
  const meter = createOwnedMeter({ spawnChild: instrumentedSpawn(stats, `${METER_BRIDGE}\nMODULE_SHA='0'*64\nmain()`) });
  await assert.rejects(meter(f.roots), { code: 'O16_METER_HELPER_FAILURE' });
  assert.equal(stats.closed, 1);
});
function fakeChild() {
  const child = new EventEmitter();
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kills: 0,
    kill() { this.kills++; return true; } });
  return child;
}
test('O16 meter: output/protocol failure is bounded and waits for close, without persisting private text', async () => {
  for (const mode of ['output', 'stderr', 'protocol']) {
    const child = fakeChild(); let finished = false;
    const meter = createOwnedMeter({ verify: async () => {}, spawnChild: () => child });
    const promise = meter([{ stage: 'operator-evidence', path: '/synthetic' }]).catch(error => { finished = true; return error; });
    await new Promise(resolve => setImmediate(resolve));
    if (mode === 'stderr') child.stderr.write('private path or token');
    else child.stdout.write(mode === 'output' ? 'x'.repeat(8193) : '{"failure":"private path"}');
    assert.equal(finished, false); child.emit('close', 0, null);
    const error = await promise;
    assert.equal(error.code, mode === 'output' ? 'O16_METER_OUTPUT' : mode === 'stderr' ? 'O16_METER_STDERR' : 'O16_METER_HELPER_FAILURE');
    assert(!JSON.stringify(measurementFailure(error)).includes('private'));
  }
});
test('O16 meter: one total deadline kills an actual stalled helper and confirms close', async t => {
  const f = await fixture(t), stats = { started: 0, closed: 0 };
  const meter = createOwnedMeter({ spawnChild: instrumentedSpawn(stats, 'import time; time.sleep(2)') });
  await assert.rejects(meter(f.roots), { code: 'O16_METER_DEADLINE' });
  assert.equal(stats.started, 1); assert.equal(stats.closed, 1);
});
test('O16 meter: unconfirmed close latches rejection and never overlaps another helper', async () => {
  const child = fakeChild(); let count = 0;
  const meter = createOwnedMeter({ totalMs: 20, verify: async () => {}, spawnChild: () => { count++; return child; } });
  const roots = [{ stage: 'operator-evidence', path: '/synthetic' }];
  const first = meter(roots);
  await assert.rejects(meter(roots), { code: 'O16_METER_BUSY_OR_UNCLOSED' });
  await assert.rejects(first, { code: 'O16_METER_DEADLINE' });
  child.emit('close', null, 'SIGKILL');
  await assert.rejects(meter(roots), { code: 'O16_METER_DEADLINE' });
  assert.equal(count, 1); assert(child.kills > 0);
});
test('O16 meter: operator and cleanup consumers preserve the first failure without new helper launches', async () => {
  const child = fakeChild(); let count = 0;
  const meter = createOwnedMeter({ verify: async () => {}, spawnChild: () => { count++; return child; } });
  const sample = (run, directory) => measureRun(run, directory, {
    statfs: async () => ({ bavail: BOUNDS.reserveBytes, bsize: 1 }), measureRoots: meter,
  });
  const stat = async path => { if (path.endsWith('/STOP.json')) throw Object.assign(new Error('absent stop'), { code: 'ENOENT' }); return {}; };
  const first = sample('synthetic-run', undefined);
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write('{"results":[{"stage":"stage-evidence","state":"unknown","code":"ROOT_IO"}]}');
  child.emit('close', 0, null);
  await assert.rejects(first, { code: 'O16_METER_ROOT_IO' });
  await assert.rejects(assertCleanupBudget('synthetic-run', undefined, { stat, measure: sample }), { code: 'O16_METER_ROOT_IO' });
  assert.equal(count, 1);
  const valid = await assertCleanupBudget('synthetic-run', null, { stat, measure: async (_run, dir) => ({ runtimeState: dir === null ? 'removed' : 'unknown' }) });
  assert.equal(valid.runtimeState, 'removed');
});
