import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pauseReceipt, validatePause, settleStage, stagePassed, REVIEW_MS, assertNativeReady } from './stage-policy.mjs';
import { operationArguments, operate } from './operator.mjs';
import { runPaths } from './operator-bounds.mjs';
import { createObservedQuery, oneShotQueryInput } from './query-run.mjs';
import { readRecord, writeRecord } from './records.mjs';
import { GRAPH_TOOLS } from './config.mjs';
import { reservePhase, NATIVE_MODEL } from './permit.mjs';
import { environmentFixture, fixturePermit } from './native-environment-fixture.mjs';
import { claimPausedResources } from './resources.mjs';

function paused() {
  const sourceDigest = 'a'.repeat(64), now = Date.now();
  const resources = { phase: 'paused-owned-resources', sourceDigest, database: 'synthetic-db', marker: 'synthetic-marker',
    directory: { path: '/synthetic-private', dev: 1, ino: 2 }, marked: true, serverClosed: true, adminClosed: true,
    workersStopped: true, workerProcesses: [{ pgid: 123, state: 'stopped' }], errors: [], connectionObservations: [{ rows: [] }] };
  const state = { stage: 'planned', sourceDigest, goalId: 'goal', proposal: { id: 'proposal', proposalDigest: 'b'.repeat(64), input: 'actual-input' },
    runners: { plan: { profile: { reference: { runnerId: 'plan', profileId: 'profile-p', revision: 1 } } },
      children: { profile: { reference: { runnerId: 'children', profileId: 'profile-c', revision: 2 } } } } };
  const report = { outcome: 'actual-proposal-awaiting-owner', resources, childQueries: 0 };
  return { run: 'stage-unit', phase: 'plan', sourceDigest, state, report, resources, now };
}
test('pause binds actual proposal, profile, source, state, report and resource closure', () => {
  const value = paused(), receipt = pauseReceipt(value);
  assert.equal(validatePause(receipt, { ...value, phase: 'confirm' }), receipt);
  for (const change of [v => v.state.proposal.input = 'changed', v => v.state.runners.children.profile.reference.revision++,
    v => v.sourceDigest = 'c'.repeat(64), v => v.resources.marker = 'changed', v => v.report.childQueries = 1]) {
    const other = structuredClone(value); change(other); assert.throws(() => validatePause(receipt, { ...other, phase: 'confirm' }));
  }
});
test('expiry, clock reversal and wrong next phase refuse without any cleanup action', () => {
  const value = paused(), receipt = pauseReceipt(value);
  for (const overrides of [{ now: value.now + REVIEW_MS }, { now: value.now - 1 }, { phase: 'children' }]) {
    assert.throws(() => validatePause(receipt, { ...value, phase: 'confirm', ...overrides }));
  }
  assert.equal(receipt.expiredAction, 'refuse-and-retain'); assert.equal(value.resources.databaseDropped, undefined);
});
test('unclosed server, pool, worker, connections and a cleanup failure cannot produce a pause', () => {
  for (const change of [v => v.resources.serverClosed = false, v => v.resources.adminClosed = false,
    v => v.resources.workerProcesses[0].state = 'unknown', v => v.resources.workersStopped = false,
    v => v.resources.connectionObservations = [{ rows: [{ pid: 1 }] }], v => v.resources.errors = ['unknown'],
    v => v.report.primaryFailure = { name: 'Error' }]) { const value = paused(); change(value); assert.throws(() => pauseReceipt(value)); }
});
test('operator reports a verified pause separately from accepted-and-destroyed completion', () => {
  const value = paused(), receipt = pauseReceipt(value);
  assert.equal(stagePassed('plan', value.report, receipt), true);
  assert.equal(stagePassed('rehearse', value.report), false);
  value.report.childQueries = 2; assert.equal(stagePassed('plan', value.report, receipt), false);
});
test('each phase has a distinct reservation and STOP path but shares one aggregate evidence namespace', () => {
  const a = runPaths('stage-unit', 'plan'), b = runPaths('stage-unit', 'children');
  assert.equal(a.operatorRoot, b.operatorRoot); assert.equal(a.evidence, b.evidence); assert.notEqual(a.operator, b.operator); assert.notEqual(a.stop, b.stop);
  assert.deepEqual(operationArguments(['--plan', 'stage-unit', '/synthetic-permit']), { phase: 'plan', run: 'stage-unit', file: '/synthetic-permit' });
  for (const args of [['--plan', '../old', '/file'], ['--resume'], ['--rehearse', 'extra']]) assert.throws(() => operationArguments(args));
});
test('native operation refuses before source loading, permits, allocation or child startup while inputs are unresolved', async () => {
  assert.throws(() => assertNativeReady('native'), /source\/environment-bound/); assertNativeReady('rehearsal');
  await assert.rejects(operate({ phase: 'plan', run: 'stage-unit', file: '/does-not-exist' }), { code: 'ENOENT' });
  const { plan } = await import('./driver.mjs');
  await assert.rejects(plan('stage-unit', 'native', '/does-not-exist'), { code: 'ENOENT' });
  const { runPhase } = await import('./phase-host.mjs');
  await assert.rejects(runPhase({}, { mode: 'native' }, 'plan', {}), /source\/environment-bound/);
});
test('a durable primary failure survives disposal and finish failures in the saved report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'o16-stage-primary-'));
  try {
    const file = join(root, 'report.json'), first = new Error('first synthetic failure'), report = { outcome: 'unknown' }; let paused = false;
    await assert.rejects(settleStage(report, { primaryError: first, persist: value => writeRecord(file, value),
      dispose: async () => { throw new TypeError('dispose'); }, finish: async options => { assert.equal(options.destroy, false); throw new Error('finish'); },
      pause: async () => { paused = true; }, destroy: true }), error => error === first);
    const saved = await readRecord(file); assert.equal(saved.primaryFailure.name, 'Error'); assert.equal(saved.cleanupFailure.name, 'TypeError'); assert.equal(paused, false);
  } finally { await rm(root, { recursive: true }); }
});
test('checkpoint failure still closes resources, prevents destruction and never publishes a pause', async () => {
  const first = new Error('checkpoint'), report = {}, events = []; let calls = 0;
  await assert.rejects(settleStage(report, { persist: async () => { events.push('persist'); if (++calls === 1) throw first; },
    dispose: async () => events.push('dispose'), finish: async options => { events.push('finish'); assert.equal(options.destroy, false); return {}; },
    pause: async () => events.push('pause'), destroy: true }), error => error === first);
  assert.deepEqual(events, ['persist', 'dispose', 'finish', 'persist']); assert.equal(report.evidenceFailure.state, 'unconfirmed');
});
test('successful stage persists its result then closes before the final durable pause', async () => {
  const events = [], report = {};
  await settleStage(report, { persist: async () => events.push('persist'), dispose: async () => events.push('dispose'),
    finish: async options => { assert.equal(options.destroy, false); events.push('finish'); return { closed: true }; },
    pause: async value => { assert.equal(value.resources.closed, true); events.push('pause'); } });
  assert.deepEqual(events, ['persist', 'dispose', 'finish', 'persist', 'pause']);
});
test('exclusive pause consumption retains a prior record and refuses duplicate continuation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'o16-stage-exclusive-'));
  try {
    const value = paused(), directory = join(root, 'private'); await mkdir(directory);
    const stat = await lstat(directory); value.run = root.split('/').at(-1);
    value.resources.directory = { path: directory, dev: stat.dev, ino: stat.ino };
    const file = join(root, 'pause-consumed-plan.json'), receipt = pauseReceipt(value);
    await writeRecord(join(root, 'pause.json'), receipt); await writeRecord(join(root, 'plan.json'), value.report);
    await writeRecord(join(directory, 'journey.json'), value.state);
    const source = { digest: value.sourceDigest };
    await claimPausedResources(root, source, value.resources, 'confirm');
    await assert.rejects(claimPausedResources(root, source, value.resources, 'confirm'), { code: 'EEXIST' });
    assert.deepEqual((await readRecord(file)).receipt, receipt);
  } finally { await rm(root, { recursive: true }); }
});
test('the real resume packet reader refuses changed material before consuming or reconnecting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'o16-stage-packet-'));
  try {
    const value = paused(), directory = join(root, 'private'); await mkdir(directory);
    const stat = await lstat(directory); value.run = root.split('/').at(-1);
    value.resources.directory = { path: directory, dev: stat.dev, ino: stat.ino };
    const receipt = pauseReceipt(value);
    await writeRecord(join(root, 'pause.json'), receipt); await writeRecord(join(root, 'plan.json'), value.report);
    value.state.proposal.input = 'changed-after-review'; await writeRecord(join(directory, 'journey.json'), value.state);
    await assert.rejects(claimPausedResources(root, { digest: value.sourceDigest }, value.resources, 'confirm'), /changed/);
    await assert.rejects(lstat(join(root, 'pause-consumed-plan.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true }); }
});

function queryInput() { return { prompt: 'Synthetic bounded prompt', options: {
  model: NATIVE_MODEL, maxTurns: 4, maxBudgetUsd: .2, abortController: new AbortController(), persistSession: true,
  permissionMode: 'dontAsk', strictMcpConfig: true, tools: [], allowedTools: [...GRAPH_TOOLS],
  disallowedTools: ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'], settingSources: [], plugins: [], skills: [],
  thinking: { type: 'disabled' }, canUseTool: async () => ({ behavior: 'deny' }),
  settings: { enabledPlugins: {}, autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false,
    disableBundledSkills: true, disableSkillShellExecution: true, claudeMdExcludes: ['**'] },
  mcpServers: { 'flow-graph': { type: 'sdk', name: 'flow-graph' } },
  hooks: { PreToolUse: [{ hooks: [async () => ({ hookSpecificOutput: { permissionDecision: 'allow' } })] }] },
} }; }
test('restore and store options fail before a query slot or injected transport is touched', () => {
  for (const [field, value] of [['resume', 'old'], ['continue', true], ['sessionStore', {}], ['forkSession', true]]) {
    let calls = 0; const report = {}, input = queryInput(); input.options[field] = value;
    const query = createObservedQuery({ mode: 'native', phase: 'plan', report, getBinding() { calls++; }, nativeQuery() { calls++; } });
    assert.throws(() => query(input)); assert.equal(calls, 0); assert.deepEqual(report.queries, []);
  }
});
test('the actual injected query receives persistSession false with the original hooks, abort and iterator', async () => {
  const f = await environmentFixture(), root = f.root;
  try {
    const permit = fixturePermit(f);
    const reservation = await reservePhase(root, permit), original = queryInput(), report = { nativeQueryCalls: 0 }; let calls = 0;
    original.options.cwd = f.cwd;
    const originalHook = original.options.hooks.PreToolUse[0].hooks[0];
    const query = createObservedQuery({ mode: 'native', phase: 'plan', reservation, report, nativeEnvironment: f.nativeEnvironment,
      getBinding: () => ({ slot: 'planner', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } }),
      nativeQuery(prepared) { calls++; assert.equal(prepared.options.persistSession, false); assert.notEqual(prepared.options, original.options);
        assert.notEqual(prepared.options.hooks, original.options.hooks); assert.equal(prepared.options.abortController, original.options.abortController);
        assert.notEqual(prepared.options.hooks.PreToolUse[0].hooks[0], originalHook);
        return Object.assign((async function* () { throw new Error('injected no SDK'); })(), { close() {} }); } });
    const stream = query(original); await assert.rejects(async () => { for await (const _ of stream) {} }, /injected no SDK/); stream.close();
    assert.equal(calls, 1); assert.equal(original.options.persistSession, true); assert.equal(report.queries[0].requested.persistSession, false);
    assert.equal(original.options.hooks.PreToolUse[0].hooks[0], originalHook);
    assert.equal(report.queries[0].reservation.slot, 'planner'); assert.equal(report.queries[0].closed, true);
    assert.equal(oneShotQueryInput(original).prompt, original.prompt);
  } finally { await f.dispose(); }
});
