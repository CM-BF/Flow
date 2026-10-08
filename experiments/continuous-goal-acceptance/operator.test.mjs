import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { supervise } from './operator.mjs';
import { BOUNDS, measureRun, measureFinalRun, measurementFailure } from './operator-bounds.mjs';
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


test('O16 repair: final accounting requires durable resource facts even after failed stage cleanup', async () => {
  let measured = 0;
  const missing = await measureFinalRun('synthetic-run', 'source', {
    read: async () => { throw Object.assign(new Error('Secret path must not survive'), { code: 'ENOENT' }); },
    measure: async () => { measured++; } });
  assert.equal(measured, 0); assert.equal(missing.metrics, null);
  assert.deepEqual(missing.failure, { state: 'unknown', stage: 'resources-record', code: 'ENOENT', constraint: null });
  const directory = { path: '/synthetic-owned-root', dev: 1, ino: 2 };
  const facts = { kind: 'flow.o16.private-resources.v1', sourceDigest: 'source', directory, phase: 'server-closed' };
  const observed = await measureFinalRun('synthetic-run', 'source', { read: async () => facts,
    measure: async (run, actual) => { assert.equal(run, 'synthetic-run'); assert.deepEqual(actual, directory);
      return { runtimeBytes: 123, runtimeState: 'measured' }; } });
  assert.equal(observed.metrics.runtimeBytes, 123); assert.equal(observed.failure, null);
  const mismatch = await measureFinalRun('synthetic-run', 'different-source', { read: async () => facts,
    measure: async () => assert.fail('Must not measure another source') });
  assert.equal(mismatch.metrics, null); assert.equal(mismatch.failure.constraint, 'sourceDigest');
  const absent = await measureFinalRun('synthetic-run', 'source', { read: async () => ({ ...facts, directory: undefined }),
    measure: async () => assert.fail('An omitted identity is not zero bytes') });
  assert.equal(absent.metrics, null); assert.equal(absent.failure.constraint, 'directoryIdentity');
});
function fakeMeasurementIO() {
  return { statfs: async () => ({ bavail: BOUNDS.reserveBytes, bsize: 1 }),
    measureRoots: async roots => ({ roots: roots.map(root => ({ stage: root.stage, bytes: 0, entries: 1, vanished: 0 })), elapsedMs: 1 }) };
}
test('O16 repair: measurement records controlled limit or IO stage and never invents runtime zero', async () => {
  const io = fakeMeasurementIO();
  assert.equal((await measureRun('synthetic-run', undefined, io)).runtimeState, 'unknown');
  assert.equal((await measureRun('synthetic-run', undefined, io)).runtimeBytes, null);
  assert.equal((await measureRun('synthetic-run', null, io)).runtimeState, 'removed');
  assert.equal((await measureRun('synthetic-run', null, io)).runtimeBytes, 0);
  const pin = { path: '/synthetic-runtime', dev: 1, ino: 2 };
  const fail = async promise => { try { await promise; assert.fail('Expected measurement rejection'); } catch (error) { return measurementFailure(error); } };
  const lowSpace = await fail(measureRun('synthetic-run', pin, { ...io, statfs: async () => ({ bavail: 0, bsize: 1 }) }));
  assert.deepEqual(lowSpace, { state: 'unknown', stage: 'live-reserve', code: 'O16_RESOURCE_LIMIT', constraint: 'freeBytes' });
  const limit = await fail(measureRun('synthetic-run', pin, { ...io,
    measureRoots: async roots => ({ roots: (await io.measureRoots(roots)).roots.map(root => ({ ...root,
      bytes: root.stage === 'runtime' ? BOUNDS.runtimeBytes + 1 : 0 })) }) }));
  assert.deepEqual(limit, { state: 'unknown', stage: 'runtime', code: 'O16_RESOURCE_LIMIT', constraint: 'runtimeBytes' });
  const missing = await fail(measureRun('synthetic-run', pin, { ...io,
    measureRoots: async () => { throw Object.assign(new Error('Secret runtime path'), { code: 'EIO', measurementStage: 'runtime' }); } }));
  assert.deepEqual(missing, { state: 'unknown', stage: 'runtime', code: 'EIO', constraint: null });
  assert(!JSON.stringify(missing).includes('Secret'));
});
test('O16 repair: supervision retains first observation and checkpoint uncertainty separately', async () => {
  const child = await peer(); let samples = 0;
  try {
    const report = await supervise({ child, sample: async () => { samples++;
      throw Object.assign(new Error('Do not persist private text'), { code: samples === 1 ? 'EIO' : 'ENOENT',
        measurementStage: 'runtime' }); }, persist: async () => {},
      markStop: async () => { throw new Error('Checkpoint unavailable'); }, outputFailure: () => false,
      bounds: { workMs: 1000, cleanupMs: 1100 } });
    assert.equal(report.reason, 'resource-observation-or-bound-unconfirmed');
    assert.equal(report.observationFailure.code, 'EIO'); assert.equal(report.observationFailure.stage, 'runtime');
    assert.equal(report.stopCheckpoint, 'unknown'); assert.equal(report.outcome, 'unknown-retain');
    assert(!JSON.stringify(report).includes('private text')); gone(child.pid);
  } finally { if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL'); }
});
