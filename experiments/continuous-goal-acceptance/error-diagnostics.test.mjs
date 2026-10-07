import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, lstat, readdir, rm, rename, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateErrorRecorder } from './error-diagnostics.mjs';
import { createObservedQuery } from './query-run.mjs';
import { DECLARATIONS, GRAPH_TOOLS } from './config.mjs';
import { settleStage } from './stage-policy.mjs';
const sourceDigest = 'a'.repeat(64), binding = { slot: 'planner', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } };
function input() { return { prompt: 'Synthetic bounded diagnostic', options: { model: 'synthetic-no-query', maxTurns: 4, maxBudgetUsd: .2,
  abortController: new AbortController(), permissionMode: 'dontAsk', strictMcpConfig: true, tools: [], allowedTools: [...GRAPH_TOOLS],
  disallowedTools: ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'], settingSources: [], plugins: [], skills: [],
  hooks: { PreToolUse: [{ hooks: [async () => ({ hookSpecificOutput: { permissionDecision: 'deny' } })] }] },
  thinking: { type: 'disabled' }, canUseTool: async () => ({ behavior: 'deny' }), mcpServers: { 'flow-graph': { type: 'sdk', name: 'flow-graph' } },
  settings: { enabledPlugins: {}, autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false,
    disableBundledSkills: true, disableSkillShellExecution: true, claudeMdExcludes: ['**'] } } }; }
function init() { return { type: 'system', subtype: 'init', session_id: 'synthetic', model: DECLARATIONS.model, permissionMode: 'dontAsk',
  tools: [...GRAPH_TOOLS], plugins: DECLARATIONS.plugins.map(name => ({ name })), skills: [...DECLARATIONS.skills],
  mcp_servers: [{ name: 'flow-graph', source: 'sdk', status: 'connected' }], claude_code_version: DECLARATIONS.runtimeVersion }; }
function errorFrame() { return { type: 'result', subtype: 'success', is_error: true, session_id: 'synthetic', uuid: 'final', num_turns: 1,
  total_cost_usd: 0, modelUsage: {}, permission_denials: [], result: 'Synthetic error: private-marker runner-secret Bearer synthetic-auth', errors: ['synthetic-detail'] }; }
async function fixture(fn) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'o16-diagnostic-')));
  try { await fn(root, await createPrivateErrorRecorder({ directory: root, sourceDigest, phase: 'plan', secrets: ['runner-secret'] })); }
  finally { await rm(root, { recursive: true }); }
}
async function run(frame, recordError, persistObservation = async () => {}, firstFrame = init(), between = []) {
  const report = { nativeQueryCalls: 0 }, request = input();
  const query = createObservedQuery({ mode: 'rehearsal', phase: 'plan', getBinding: () => binding, report, recordError,
    persistObservation: () => persistObservation(report), rehearseQuery() { return Object.assign((async function* () { yield firstFrame; for (const frame of between) yield frame; yield frame; })(), { close() {} }); } });
  const stream = query(request); let first;
  try { for await (const _ of stream) {} } catch (error) { first = error; }
  finally { stream.close(); }
  return { report, row: report.queries[0], first, request };
}
test('diagnostic: success subtype plus is_error persists private text before public rejection', async () => fixture(async (root, record) => {
  let checkpoint;
  const r = await run(errorFrame(), record, async report => { checkpoint = structuredClone(report); assert.equal((await readdir(root)).length, 1); });
  assert(r.first); assert.equal(r.request.options.abortController.signal.reason, r.first);
  const saved = r.row.errorResult; assert.equal(saved.kind, 'sdk-error-flag-with-success-subtype'); assert.equal(saved.state, 'recorded');
  const path = join(root, saved.file), info = await lstat(path), text = await readFile(path, 'utf8'), data = JSON.parse(text);
  assert.equal(info.mode & 0o777, 0o600); assert.equal(data.sourceDigest, sourceDigest); assert.deepEqual(data.binding, binding);
  assert(text.includes('private-marker')); assert(!text.includes('runner-secret')); assert(!text.includes('synthetic-auth'));
  assert(!JSON.stringify(r.report).includes('private-marker')); assert(!JSON.stringify(checkpoint).includes('synthetic-detail'));
  assert.equal(checkpoint.queries[0].errorResult.sha256, saved.sha256); assert.equal(r.row.observation.result.isError, true);
  assert.equal(r.report.nativeQueryCalls, 0); assert.equal(r.row.closed, true);
}));
test('diagnostic: missing invalid and over-bound body remains unknown with explicit limits', async () => fixture(async (root, record) => {
  const variants = [{ result: undefined, errors: undefined }, { result: '', errors: [] }, { result: {}, errors: [23] }, { result: 'x'.repeat(9000), errors: [] },
    { result: 'x'.repeat(262145), errors: [] }, { result: undefined, errors: Array(17).fill('e') }];
  for (const [i, delta] of variants.entries()) {
    const saved = await record({ ...errorFrame(), ...delta }, { ...binding, assignment: { ...binding.assignment, taskId: `task-${i}` } });
    assert.equal(saved.state, 'unknown'); assert(saved.constraint); assert(saved.bytes <= 8192); assert.equal(saved.exists, true);
  }
  assert.equal((await readdir(root)).length, variants.length);
}));
test('diagnostic: exclusive write failure keeps first SDK rejection and independent cleanup failure', async () => fixture(async (_root, record) => {
  await record(errorFrame(), binding); const r = await run(errorFrame(), record);
  assert(r.first); assert.equal(r.row.errorResult.state, 'unknown'); assert.equal(r.row.errorResult.failure.code, 'EEXIST');
  const stages = { workerStopped: true, worker: r.report };
  await assert.rejects(settleStage(stages, { primaryError: r.first, persist: async () => {}, finish: async () => { throw Object.assign(new Error('cleanup synthetic'), { code: 'EIO' }); } }), e => e === r.first);
  assert.equal(stages.cleanupFailure.code, 'EIO'); assert.deepEqual(stages.primaryFailure, r.row.firstFailure);
}));
test('diagnostic: public checkpoint failure remains separate from first SDK failure', async () => fixture(async (_root, record) => {
  const r = await run(errorFrame(), record, async () => { throw Object.assign(new Error('synthetic fsync'), { code: 'EIO' }); });
  assert(r.first); assert.equal(r.row.evidenceFailure.code, 'EIO'); assert.equal(r.row.firstFailure.code, null);
  assert.equal(r.row.errorResult.state, 'recorded'); assert.equal(r.request.options.abortController.signal.reason, r.first);
}));
test('diagnostic: success and earlier declaration rejection never write an error result', async () => fixture(async (root, record) => {
  const good = await run({ ...errorFrame(), is_error: false, result: 'ordinary success', errors: undefined }, record);
  assert.equal(good.first, undefined); assert.equal(good.row.errorResult, undefined);
  const rejected = await run(errorFrame(), record, undefined, { ...init(), model: 'unknown-model' });
  assert(rejected.first); assert.equal(rejected.row.errorResult, undefined); assert.equal((await readdir(root)).length, 0);
}));
test('diagnostic: replaced private directory identity refuses the record', async () => fixture(async (root, record) => {
  const moved = root + '-moved'; await rename(root, moved); await mkdir(root, { mode: 0o700 });
  try { const saved = await record(errorFrame(), binding); assert.equal(saved.state, 'unknown'); assert(saved.failure); assert.equal((await readdir(root)).length, 0); }
  finally { await rm(moved, { recursive: true }); }
}));

test('diagnostic: structured SDK error sources are bounded and never guessed from text', async () => fixture(async (_root, record) => {
  const messages = [{ type: 'assistant', error: 'authentication_failed', message: { content: [] } },
    { type: 'system', subtype: 'api_retry', error: 'rate_limit', error_status: 429 },
    { type: 'system', subtype: 'api_retry', error: 'secret-unrecognized-enum', error_status: 'secret-status' }];
  const r = await run({ ...errorFrame(), api_error_status: 401 }, record, undefined, init(), messages);
  const observation = r.row.observation;
  assert.deepEqual(observation.sdkErrors.map(x => x.source), ['assistant.error', 'system.api_retry', 'system.api_retry']);
  assert.deepEqual(observation.sdkErrors[0].error, { state: 'reported', value: 'authentication_failed' });
  assert.deepEqual(observation.sdkErrors[1].errorStatus, { state: 'reported', value: 429 });
  assert.deepEqual(observation.sdkErrors[2].error, { state: 'unknown', value: null });
  assert.deepEqual(observation.result.apiErrorStatus, { state: 'reported', value: 401 });
  assert(!JSON.stringify(r.report).includes('secret-unrecognized-enum')); assert(!JSON.stringify(r.report).includes('secret-status'));
  const bounded = await run(errorFrame(), undefined, undefined, init(), Array(20).fill(messages[0]));
  assert.equal(bounded.row.observation.sdkErrors.length, 16); assert.equal(bounded.row.observation.sdkErrorsOmitted, 4);
  assert.deepEqual(bounded.row.observation.result.apiErrorStatus, { state: 'unknown', value: null });
}));
