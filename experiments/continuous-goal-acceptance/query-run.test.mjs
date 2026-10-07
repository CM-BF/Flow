import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createObservedQuery, checkQueryOptions } from './query-run.mjs';
import { DECLARATIONS, GRAPH_TOOLS } from './config.mjs';
import { reservePhase, NATIVE_MODEL } from './permit.mjs';
import { environmentFixture, fixturePermit } from './native-environment-fixture.mjs';
import { recordQueryCount } from './query-policy.mjs';
import { settleStage } from './stage-policy.mjs';
function input(mode = 'rehearsal') { return { prompt: 'Bounded actual planner prompt', options: {
  model: mode === 'native' ? NATIVE_MODEL : 'synthetic-no-query', maxTurns: 4, maxBudgetUsd: 0.2, abortController: new AbortController(),
  permissionMode: 'dontAsk', strictMcpConfig: true, tools: [], allowedTools: [...GRAPH_TOOLS],
  disallowedTools: ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'], settingSources: [], plugins: [], skills: [],
  thinking: { type: 'disabled' }, canUseTool: async () => ({ behavior: 'deny' }),
  settings: { enabledPlugins: {}, autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false,
    disableBundledSkills: true, disableSkillShellExecution: true, claudeMdExcludes: ['**'] },
  mcpServers: { 'flow-graph': { type: 'sdk', name: 'flow-graph' } }, hooks: { PreToolUse: [{ hooks: [async () => ({ hookSpecificOutput: { permissionDecision: 'allow' } })] }] },
} }; }
const binding = { slot: 'planner', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } };
function frames() { return Object.assign((async function* () {
  yield { type: 'system', subtype: 'init', session_id: 'synthetic', model: DECLARATIONS.model, claude_code_version: DECLARATIONS.runtimeVersion,
    permissionMode: 'dontAsk', tools: [...GRAPH_TOOLS], plugins: DECLARATIONS.plugins.map(name => ({ name })), skills: [...DECLARATIONS.skills],
    mcp_servers: [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] };
  yield { type: 'result', subtype: 'success', is_error: false, session_id: 'synthetic', uuid: 'final', num_turns: 2,
    total_cost_usd: 0, modelUsage: {}, permission_denials: [] };
})(), { close() {} }); }
async function drain(stream) { for await (const _ of stream) {} }
test('actual request capability changes fail before a transport entry', () => {
  checkQueryOptions(input(), 'rehearsal', 'plan');
  for (const mutate of [o => o.resume = 'old-session', o => o.tools = ['Read'], o => o.maxTurns = 5,
    o => o.settings.disableSkillShellExecution = false, o => o.mcpServers.extra = {}, o => o.allowedTools.push('Bash')]) {
    const value = input(); mutate(value.options); assert.throws(() => checkQueryOptions(value, 'rehearsal', 'plan'));
  }
});
test('close-before-iteration starts no transport and a used task or slot cannot be admitted twice', async () => {
  let calls = 0; const report = { nativeQueryCalls: 0 };
  const query = createObservedQuery({ mode: 'rehearsal', phase: 'plan', getBinding: () => binding, report,
    rehearseQuery() { calls++; return frames(); } });
  const stream = query(input()); stream.close(); await assert.rejects(drain(stream));
  assert.equal(calls, 0); assert.equal(report.queries[0].closed, true); assert.throws(() => query(input()));
});
test('native entry is durably reserved before its injected stand-in and cannot be repeated after reopening', async () => {
  const f = await environmentFixture(), root = f.root;
  try {
    const permit = fixturePermit(f);
    const reservation = await reservePhase(root, permit), report = { nativeQueryCalls: 0 }; let calls = 0;
    const make = () => createObservedQuery({ mode: 'native', phase: 'plan', reservation, report, nativeEnvironment: f.nativeEnvironment, getBinding: () => binding,
      nativeQuery() { calls++; const original = frames(); original.getContextUsage = async options => { assert.deepEqual(options, { detail: 'summary' }); return { control: 'summary-stand-in' }; }; return original; } });
    const request = () => { const value = input('native'); value.options.cwd = f.cwd; return value; };
    const stream = make()(request()); await drain(stream); assert.deepEqual(await stream.getContextUsage({ detail: 'summary' }), { control: 'summary-stand-in' }); stream.close();
    assert.equal(calls, 1); assert.equal(report.nativeQueryCalls, 1); assert.equal(report.queries[0].reservation.assignment.attemptId, 'attempt');
    const restarted = make()(request()); await assert.rejects(drain(restarted), { code: 'EEXIST' }); restarted.close(); assert.equal(calls, 1);
  } finally { await f.dispose(); }
});


test('O16 repair: early init rejection persists consumed one before independent cleanup failure', async () => {
  const f = await environmentFixture();
  try {
    const reservation = await reservePhase(f.root, fixturePermit(f)), worker = { nativeQueryCalls: 0 };
    const query = createObservedQuery({ mode: 'native', phase: 'plan', reservation, report: worker,
      nativeEnvironment: f.nativeEnvironment, getBinding: () => binding,
      nativeQuery() { return Object.assign((async function* () {
        const good = (await frames().next()).value; yield { ...good, model: 'unexpected-model' };
      })(), { close() {} }); } });
    const value = input('native'); value.options.cwd = f.cwd;
    const stream = query(value); let first;
    try { await assert.rejects(drain(stream), error => { first = error; return true; }); }
    finally { stream.close(); }
    assert.equal(worker.nativeQueryCalls, 1); assert.equal(worker.queries[0].entry, 'native-started-unknown');
    assert.equal(worker.queries[0].observation.result, null); assert.equal(worker.queries[0].closed, true);
    const report = { nativeQueryCalls: 0, worker }, checkpoints = [];
    recordQueryCount(report);
    await assert.rejects(settleStage(report, { primaryError: first,
      persist: async value => checkpoints.push(structuredClone(value)),
      finish: async () => { throw Object.assign(new Error('Synthetic cleanup failure'), { code: 'EIO' }); } }), error => error === first);
    assert(checkpoints.length >= 2); assert(checkpoints.every(row => row.nativeQueryCalls === 1));
    assert.equal(report.cleanupFailure.code, 'EIO'); assert(report.primaryFailure);
    assert.equal(report.worker.queries[0].observation.result, null);
  } finally { await f.dispose(); }
});
test('O16 repair: missing or invalid worker counter remains unknown instead of stale zero', () => {
  for (const worker of [undefined, {}, { nativeQueryCalls: null }, { nativeQueryCalls: -1 }, { nativeQueryCalls: 1.5 }]) {
    const report = { nativeQueryCalls: 0, worker }; assert.equal(recordQueryCount(report), 'unknown');
  }
  assert.equal(recordQueryCount({ worker: { nativeQueryCalls: 0 } }), 0);
});
