import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, rename, mkdir, writeFile, lstat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareDriverEnvironment } from './native-environment.mjs';
import { environmentFixture, fixturePermit, permitInput } from './native-environment-fixture.mjs';
import { validatePermit, assertNativePermit, reservePhase, NATIVE_MODEL, PHASE_LIMITS } from './permit.mjs';
import { createObservedQuery } from './query-run.mjs';
import { adapterOptions, graphScope, GRAPH_TOOLS } from './config.mjs';

async function fixture(body) { const f = await environmentFixture(); try { await body(f); } finally { await f.dispose(); } }
function input(f) { return { prompt: 'Synthetic planner', options: { cwd: f.cwd, model: NATIVE_MODEL,
  maxTurns: 4, maxBudgetUsd: .2, abortController: new AbortController(), persistSession: false,
  permissionMode: 'dontAsk', strictMcpConfig: true, tools: [], allowedTools: [...GRAPH_TOOLS],
  disallowedTools: ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'], settingSources: [], plugins: [], skills: [],
  thinking: { type: 'disabled' }, canUseTool: async () => ({ behavior: 'deny' }),
  settings: { enabledPlugins: {}, autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false,
    disableBundledSkills: true, disableSkillShellExecution: true, claudeMdExcludes: ['**'] },
  mcpServers: { 'flow-graph': { type: 'sdk', name: 'flow-graph' } },
  hooks: { PreToolUse: [{ hooks: [async () => ({ hookSpecificOutput: { permissionDecision: 'allow' } })] }] },
} }; }
const assignment = { slot: 'planner', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } };
const drain = async stream => { for await (const _ of stream) {} };

test('environment: explicit private paths and fixed executable replace all injected environment values', () => fixture(async f => {
  const original = input(f); original.options.env = { ANTHROPIC_API_KEY: 'synthetic-never-used', DEBUG: 'synthetic', HOME: '/wrong', FLOW_DATABASE_URL: 'synthetic' };
  const actual = await f.policy.queryInput(f.binding, f.source, original);
  assert.deepEqual(Object.keys(actual.options.env).sort(), ['HOME','CLAUDE_CONFIG_DIR','TMPDIR','CLAUDE_TMPDIR','CLAUDE_SECURESTORAGE_CONFIG_DIR','USER','PATH','LANG','DISABLE_AUTOUPDATER','DISABLE_TELEMETRY','CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'].sort());
  assert.equal(actual.options.env.HOME, f.binding.folders.home.path); assert.equal(actual.options.env.CLAUDE_SECURESTORAGE_CONFIG_DIR, '');
  assert.equal(actual.options.pathToClaudeCodeExecutable, f.runtime[2].path); assert.equal(actual.options.persistSession, false);
  assert.equal(original.options.env.HOME, '/wrong'); assert.equal(f.policy.recipe.writePolicy.sharedKeychainMayUpdate, true);
  assert.equal(f.policy.recipe.writePolicy.keychainIncludedInPrivateByteBudget, false);
}));
test('environment: authentication booleans, old permits, wrong source or recipe never authorize native entry', () => fixture(async f => {
  for (const change of [p => p.authenticated = true, p => p.kind = 'flow.o16.phase-permit.v1', p => p.sourceDigest = 'b'.repeat(64), p => p.environmentDigest = 'c'.repeat(64), p => p.model = 'sonnet']) {
    const value = permitInput(f); change(value);
    assert.throws(() => validatePermit(value, { identity: f.source, phase: 'plan', environmentDigest: f.policy.digest }));
  }
  assert.throws(() => assertNativePermit(permitInput(f), f.policy.digest));
  assertNativePermit(fixturePermit(f), f.policy.digest);
}));
test('environment: native children require a later separate decision and cannot inherit planner permission', () => fixture(async f => {
  const confirmation = { goalId: 'goal', proposalId: 'proposal', proposalDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64), progressionId: 'progression' };
  const p = validatePermit(permitInput(f, 'children', confirmation), { identity: f.source, phase: 'children', confirmation, environmentDigest: f.policy.digest });
  assert.throws(() => assertNativePermit(p, f.policy.digest));
  assert.throws(() => validatePermit(permitInput(f, 'children', confirmation), { identity: f.source, phase: 'children', confirmation: { ...confirmation, proposalId: 'other' }, environmentDigest: f.policy.digest }));
}));
test('environment: changed native bytes or replacement identity fail before the injected query', () => fixture(async f => {
  await chmod(f.runtime[2].path, 0o600); await writeFile(f.runtime[2].path, 'changed-native');
  await assert.rejects(f.policy.verify(f.binding, f.source));
  await writeFile(f.runtime[2].path, 'synthetic-native'); await rename(f.runtime[2].path, f.runtime[2].path + '-old');
  await writeFile(f.runtime[2].path, 'synthetic-native'); await assert.rejects(f.policy.verify(f.binding, f.source));
}));
test('environment: replaced private directory, symlink and mode change retain a rejected binding', () => fixture(async f => {
  const home = f.binding.folders.home.path; await chmod(home, 0o755); await assert.rejects(f.policy.verify(f.binding, f.source)); await chmod(home, 0o700);
  await rename(home, home + '-old'); await mkdir(home, { mode: 0o700 }); await assert.rejects(f.policy.verify(f.binding, f.source));
  await rename(home, home + '-new'); await symlink(home + '-old', home); await assert.rejects(f.policy.verify(f.binding, f.source));
}));
test('environment: existing private namespace is never overwritten and restore options never enter query', () => fixture(async f => {
  const before = await lstat(f.binding.nativeRoot.path); await assert.rejects(f.policy.prepare(f.phase, f.source), { code: 'EEXIST' });
  assert.equal((await lstat(f.binding.nativeRoot.path)).ino, before.ino);
  for (const [key,value] of [['resume','old'],['continue',true],['sessionStore',{}],['forkSession',true]]) {
    const request = input(f); request.options[key] = value; await assert.rejects(f.policy.queryInput(f.binding, f.source, request));
  }
}));
test('environment: cancellation during input verification starts zero queries and keeps the consumed slot', () => fixture(async f => {
  const reservation = await reservePhase(join(f.root, 'reservations'), fixturePermit(f)), request = input(f), report = { nativeQueryCalls: 0 }; let calls = 0;
  const policy = { ...f.policy, async queryInput(...args) { request.options.abortController.abort(); return f.policy.queryInput(...args); } };
  const query = createObservedQuery({ mode: 'native', phase: 'plan', reservation, report, getBinding: () => assignment,
    nativeEnvironment: { ...f.nativeEnvironment, policy }, nativeQuery() { calls++; } });
  const stream = query(request); await assert.rejects(drain(stream)); stream.close();
  assert.equal(calls, 0); assert.equal(report.nativeQueryCalls, 0); assert.equal(report.queries[0].entry, 'not-started');
  assert.equal(report.queries[0].reservation.slot, 'planner'); assert.throws(() => query(input(f)));
}));
test('environment: injected authentication failure is one unknown entry without fallback or a second attempt', () => fixture(async f => {
  const reservation = await reservePhase(join(f.root, 'reservations'), fixturePermit(f)), report = { nativeQueryCalls: 0 }; let calls = 0, closed = 0;
  const query = createObservedQuery({ mode: 'native', phase: 'plan', reservation, report, getBinding: () => assignment, nativeEnvironment: f.nativeEnvironment,
    nativeQuery(actual) { calls++; assert.equal(actual.options.env.HOME, f.binding.folders.home.path);
      return Object.assign((async function* () { throw new Error('synthetic authentication unavailable'); })(), { close() { closed++; } }); } });
  const stream = query(input(f)); await assert.rejects(drain(stream), /synthetic authentication/); stream.close();
  assert.equal(calls, 1); assert.equal(closed, 1); assert.equal(report.queries[0].entry, 'native-started-unknown');
  assert.equal(report.queries[0].failure, 'query-or-observation-unconfirmed'); assert.throws(() => query(input(f)));
}));
test('environment: exact Sonnet planner caps and proposal-only scope are accepted by the existing graph mount', async () => {
  const options = adapterOptions('native', 'plan'); assert.equal(options.model, NATIVE_MODEL);
  assert.deepEqual([options.maxTurns, options.maxBudgetUsd, options.timeoutMs], [4,.2,90000]); assert.equal(PHASE_LIMITS.plan.queries, 1);
  const { createGraphToolMount } = await import('../../apps/runner/src/goal-tool-bridge/policy.ts');
  const capability = { goalId: 'goal', runId: 'run', scope: graphScope(1), port: {} };
  const mount = createGraphToolMount({ async assertOwnership() {}, async emit() {} }, capability, new AbortController());
  assert.deepEqual(mount.allowedTools.slice().sort(), GRAPH_TOOLS.slice().sort());
  assert.match(mount.systemPrompt, /"maxApplications":0/); assert.equal(capability.scope.maxProposals, 1);
  assert.deepEqual([capability.scope.maxNewNodes, capability.scope.maxNewEdges], [2,1]);
  // Construction only: no SDK query, MCP connection or center request.
  await mount.server.instance.close();
});

test('environment: metadata driver imports use private paths without inherited credential or debug variables', () => fixture(async f => {
  const control = join(f.root, 'control'); await mkdir(control, { mode: 0o700 });
  const prepared = await prepareDriverEnvironment(control, 'synthetic-run', 'plan');
  assert.deepEqual(Object.keys(prepared.environment).sort(), ['HOME','CLAUDE_CONFIG_DIR','TMPDIR','PATH','LANG','TSX_DISABLE_CACHE','NODE_DISABLE_COMPILE_CACHE','FLOW_O16_RUN','FLOW_O16_OPERATOR_PHASE'].sort());
  assert.equal(prepared.environment.FLOW_O16_RUN, 'synthetic-run');
  assert.equal(prepared.environment.HOME, join(control, 'driver-private', 'home'));
  await assert.rejects(prepareDriverEnvironment(control, 'synthetic-run', 'plan'), { code: 'EEXIST' });
}));
