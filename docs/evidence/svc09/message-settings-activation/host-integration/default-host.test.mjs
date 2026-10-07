import test from 'node:test';
import assert from 'node:assert/strict';
import { PURPOSE, requirePurpose, defaultArguments, defaultSequence, defaultClosure, launchAccountingKnown, emptyTasks, cleanupDefault } from './default-host.mjs';
import { ownedRecords } from './host-cleanup.mjs';
import { failure } from './host-records.mjs';
const input = { format: 1, purpose: PURPOSE, directory: '/private/tmp/flow-svc09a-host-unit_1', providerCalls: 0,
  sourceHead: 'a'.repeat(40), repository: '/fixed/repository', choices: [{}, {}],
  artifact: { artifactId: 'b'.repeat(64), manifestDigest: 'b'.repeat(64), sourceHead: 'a'.repeat(40) }, webArtifact: { fixture: true } };
function fixture() {
  const calls = [], records = [], state = { backendArtifact: input.artifact, processes: {}, startReadiness: {} };
  const preview = {
    loadPreviewConfiguration: async directory => { assert.equal(directory, input.directory); return { directory, repository: input.repository }; },
    readPreviewJson: async () => structuredClone(state), assertPreviewMarker: async () => {},
    withPreviewLock: async (_config, action) => { calls.push('lock'); return action(); },
    statusPreview: async () => ({ processes: { center: 'running', runner: 'running', web: 'running' }, center: { reachable: true },
      database: 'owned', webArtifact: { serving: 'confirmed' }, runnerSlots: { state: 'configured', slots: [{ slot: 'legacy' }] } }),
    stopPreview: async () => { calls.push('stop'); return { processes: { web: 'stopped', runner: 'stopped', center: 'stopped' } }; },
  };
  const controller = { startPreviewServices: async (config, initial, web, artifact, status) => {
    assert.deepEqual(initial.processes, {}); assert.equal(web, input.webArtifact); assert.equal(artifact, input.artifact);
    assert.equal(status, preview.statusPreview); calls.push('start');
    state.processes = { center: { pid: 11 }, runner: { pid: 12 }, web: { pid: 13 } }; state.startReadiness = { center: { outcome: 'ready' } };
    Object.assign(initial, structuredClone(state));
    return status({ directory: config.directory });
  } };
  const pool = { query: async sql => { assert.match(sql, /flow\.tasks/); calls.push('empty'); return { rows: [{ tasks: 0, attempts: 0 }] }; } };
  const checkpoint = async (phase, fact) => { records.push({ phase, fact }); };
  return { input, preview, controller, pool, checkpoint, calls, records, state };
}
test('default purpose rejects full journey or arbitrary entry before private access', () => {
  assert.equal(requirePurpose(input), input.directory + '/backend-artifacts/' + input.artifact.artifactId + '/root');
  assert.throws(() => requirePurpose({ ...input, purpose: 'full' }), /HOST_PURPOSE_MISMATCH/);
  assert.throws(() => defaultArguments(['--settings', input.directory + '/input.json']));
  assert.throws(() => defaultArguments(['--cleanup-once', '/outside/input.json']));
});
test('default real ports sequence uses original status and explicit stop, no task creation', async () => {
  const f = fixture(), result = await defaultSequence(f);
  assert.deepEqual(f.calls, ['lock', 'start', 'empty', 'stop', 'empty']);
  assert.equal(result.defaultReady, true); assert.equal(result.database, 'KEEP'); assert.equal(result.actualClaim, 'unknown');
  assert.deepEqual(f.records.map(v => v.phase), ['before-default-start', 'default-start-observation', 'default-legacy', 'default-explicit-stop']);
});
test('startup primary survives diagnostic persistence failure without a second start', async () => {
  const f = fixture(), primary = Object.assign(new Error('safe fixture'), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  f.controller.startPreviewServices = async () => { f.calls.push('start'); throw primary; };
  f.checkpoint = async phase => { if (phase === 'default-start-observation') throw new Error('injected record failure'); };
  await assert.rejects(defaultSequence(f), error => error === primary);
  assert.deepEqual(f.calls, ['lock', 'start']);
});
test('nonempty queue or unknown stop cannot become default work complete', async () => {
  const f = fixture(); f.pool.query = async () => ({ rows: [{ tasks: 1, attempts: 0 }] });
  await assert.rejects(defaultSequence(f), /DEFAULT_TASKS_NOT_EMPTY/); assert.ok(!f.calls.includes('stop'));
  const second = fixture(); second.preview.stopPreview = async () => ({ processes: { center: 'stopped', runner: 'unknown', web: 'stopped' } });
  await assert.rejects(defaultSequence(second));
});
test('actual recorded subset closure permits KEEP without inventing unstarted roles', () => {
  const facts = { outer: { owned_state: 'absent', eof: { stdout: true, stderr: true }, exit_code: 1 }, recordsKnown: true,
    stateKnown: true, launchAccounted: true, registered: [{ role: 'center' }], processes: [{ role: 'center', state: 'stopped' }],
    connections: { state: 'empty' }, failures: [], adminClosed: true };
  assert.equal(defaultClosure(facts), true);
  for (const change of [{ stateKnown: false }, { recordsKnown: false }, { launchAccounted: false }, { connections: { state: 'unknown' } },
    { adminClosed: false }, { processes: [{ state: 'unknown' }] }, { registered: [{}, {}] }, { failures: [{}] }]) {
    assert.equal(defaultClosure({ ...facts, ...change }), false);
  }
});
test('unpersisted launch cannot be inferred closed from readable empty state', () => {
  assert.equal(launchAccountingKnown([], { processes: {} }), false);
  const records = [{ phase: 'default-start-observation', fact: { purpose: PURPOSE, origin: 'controller-call-state', evidenceErrors: [], startCleanup: [], readiness: {} } }];
  assert.equal(launchAccountingKnown(records, { startEvidenceErrors: [] }), true);
  assert.equal(launchAccountingKnown(records, {}), false);
  assert.equal(launchAccountingKnown(records, { startEvidenceErrors: ['EIO'] }), false);
  records[0].fact.evidenceErrors.push('ENOSPC');
  assert.equal(launchAccountingKnown(records, { startEvidenceErrors: [] }), false);
});
test('pending launch identity comes from actual call state despite stale persisted state', async () => {
  const f = fixture(), primary = new Error('startup failed');
  f.controller.startPreviewServices = async (_config, actual) => {
    actual.processes = { center: { pid: 111, command: null, nonce: 'pending' } };
    actual.startEvidenceErrors = ['EIO']; actual.startCleanup = []; actual.startReadiness = {};
    throw primary;
  };
  await assert.rejects(defaultSequence(f), error => error === primary);
  const observed = f.records.find(value => value.phase === 'default-start-observation').fact;
  assert.equal(observed.processes.center.pid, 111); assert.deepEqual(f.state.processes, {});
  assert.equal(launchAccountingKnown(f.records, { startEvidenceErrors: [] }), false);
});
test('failed start checkpoint contributes all exact generations and rejects identity change', () => {
  const record = { pid: 11, group: 11, nonce: 'unit', command: input.directory + ' --flow-preview=unit', startedAt: 'fixed' };
  const values = [{ phase: 'default-start-observation', fact: { processes: { center: record } } }];
  assert.equal(ownedRecords(values, { processes: {} }, input.directory, ['default-start-observation']).length, 1);
  assert.throws(() => ownedRecords(values, { processes: { center: { ...record, command: record.command + ' changed' } } },
    input.directory, ['default-start-observation']), /RECORDED_IDENTITY_CHANGED/);
  assert.equal(ownedRecords(values, { processes: {} }, input.directory).length, 0); // old full-purpose default unchanged
});
test('empty SQL error preserves only controlled SQLSTATE and source phase', async () => {
  let error;
  try { await emptyTasks({ query: async () => { throw { code: '42P01', message: 'private synthetic body' }; } }); } catch (value) { error = value; }
  assert.deepEqual(failure(error, 'host-consumer'), { phase: 'default-empty-task-query', sourcePhase: 'host-consumer',
    name: 'Error', code: 'DEFAULT_EMPTY_QUERY_FAILED', sqlState: '42P01' });
  assert.ok(!JSON.stringify(failure(error, 'host-consumer')).includes('private'));
});

test('cold policy uses the actual mutable launch state and does not require a slots module', async () => {
  const f = fixture(), purpose = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE';
  f.input = { ...f.input, purpose }; let seen = false;
  f.policy = { purpose, validateInput: value => { assert.equal(value, f.input); }, assertReady: async args => {
    assert.equal(args.input, f.input); assert.equal(args.controller, f.controller); assert.equal(args.preview, f.preview);
    assert.deepEqual(Object.keys(args.state.processes).sort(), ['center', 'runner', 'web']);
    assert.equal(args.started.runnerSlots, undefined); seen = true;
  } };
  const original = f.preview.statusPreview; f.preview.statusPreview = async (...args) => { const value = await original(...args); delete value.runnerSlots; return value; };
  const result = await defaultSequence(f); assert.equal(seen, true); assert.equal(result.purpose, purpose);
  assert.deepEqual(f.calls, ['lock', 'start', 'empty', 'stop', 'empty']);
  assert.equal(f.records[1].fact.purpose, purpose);
});
test('cold policy initialization refusal is primary and cannot reach explicit stop or successful work', async () => {
  const f = fixture(), purpose = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE';
  f.input = { ...f.input, purpose }; const primary = new Error('synthetic initialization unknown');
  f.policy = { purpose, validateInput: () => {}, assertReady: async () => { throw primary; } };
  await assert.rejects(defaultSequence(f), value => value === primary); assert.deepEqual(f.calls, ['lock', 'start']);
});
test('cold cleanup and sequence reject their explicit policy before private access', async () => {
  const primary = new Error('synthetic fixed input mismatch'), purpose = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE';
  await assert.rejects(cleanupDefault({ purpose }, { purpose, validateInput: () => { throw primary; } }), value => value === primary);
  const f = fixture(); f.policy = { purpose, validateInput: () => { throw primary; } };
  await assert.rejects(defaultSequence(f), /HOST_PURPOSE_MISMATCH/); assert.deepEqual(f.calls, []);
});
