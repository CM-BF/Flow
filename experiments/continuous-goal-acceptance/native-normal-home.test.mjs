import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createNativeEnvironmentPolicy, nativeEnvironmentPolicy } from './native-environment.mjs';
import { environmentFixture, fixturePermit, permitInput } from './native-environment-fixture.mjs';
import { reservePhase, validatePermit } from './permit.mjs';
import { createObservedQuery } from './query-run.mjs';
import { adapterOptions, graphScope, GRAPH_TOOLS } from './config.mjs';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { sourceIdentity } from './identity.mjs';

async function normalFixture(body) {
  const f = await environmentFixture({ authenticationHome: 'normal-account' });
  try { await body(f); } finally { await f.dispose(); }
}

test('normal-home: trusted active policy changes HOME while private factory remains byte-compatible', async () => {
  const old = createNativeEnvironmentPolicy(nativeEnvironmentPolicy.recipe.files);
  assert.equal(old.digest, '4111341d2a26aac0b95c72deb2c571415b0d893ffad23d81d0fbaaaf8e518659');
  assert.notEqual(nativeEnvironmentPolicy.digest, old.digest);
  assert.deepEqual(nativeEnvironmentPolicy.recipe.authenticationHome,
    { kind: 'normal-account', username: 'citrine', path: '/Users/citrine' });
  for (const authenticationHome of ['/other-account', true, null, 'normal']) {
    assert.throws(() => createNativeEnvironmentPolicy(old.recipe.files, { authenticationHome }));
  }
  const f = await environmentFixture();
  try { assert.equal(f.policy.environment(f.binding).HOME, f.binding.folders.home.path); }
  finally { await f.dispose(); }
});

test('normal-home: actual query input keeps private config tmp and all non-environment options', () => normalFixture(async f => {
  const input = { prompt: 'synthetic input, never sent', options: { cwd: f.cwd, persistSession: false,
    abortController: new AbortController(), env: { HOME: '/wrong', ANTHROPIC_API_KEY: 'synthetic' },
    model: 'claude-sonnet-5-5', maxTurns: 4, maxBudgetUsd: .2, tools: [], allowedTools: GRAPH_TOOLS,
    materialFiles: [join(f.cwd, 'material.txt')], permissionMode: 'dontAsk' } };
  const actual = await f.policy.queryInput(f.binding, f.source, input);
  const privateView = createNativeEnvironmentPolicy(f.runtime).environment(f.binding);
  assert.deepEqual(Object.keys(privateView).filter(k => privateView[k] !== actual.options.env[k]), ['HOME']);
  assert.equal(actual.options.env.HOME, '/Users/citrine');
  assert.equal(actual.options.env.CLAUDE_CONFIG_DIR, f.binding.folders.config.path);
  assert.equal(actual.options.env.TMPDIR, f.binding.folders.tmp.path);
  assert.equal(actual.options.env.CLAUDE_SECURESTORAGE_CONFIG_DIR, '');
  const { env, pathToClaudeCodeExecutable, ...rest } = actual.options;
  const { env: ignored, ...original } = input.options;
  assert.deepEqual(rest, original); assert.equal(pathToClaudeCodeExecutable, f.runtime[2].path);
  assert.equal(f.policy.recipe.writePolicy.sharedHomeMayUpdate, true);
  assert.equal(f.policy.recipe.writePolicy.homeIncludedInPrivateByteBudget, false);
  assert.equal(input.options.env.HOME, '/wrong');
}));

test('normal-home: old environment permit and account mismatch refuse before provider entry', () => normalFixture(async f => {
  const prior = createNativeEnvironmentPolicy(f.runtime);
  assert.throws(() => validatePermit({ ...permitInput(f), environmentDigest: prior.digest },
    { identity: f.source, phase: 'plan', environmentDigest: f.policy.digest }));
  assert.throws(() => validatePermit({ ...permitInput(f), authenticated: true },
    { identity: f.source, phase: 'plan', environmentDigest: f.policy.digest }));
  await assert.rejects(f.policy.verify({ ...f.binding, username: 'another-account' }, f.source));
  assert.throws(() => f.policy.environment({ ...f.binding, username: 'another-account' }));
}));

test('normal-home: same private binding checks and resume refusal remain mandatory', () => normalFixture(async f => {
  const input = { prompt: 'synthetic', options: { cwd: f.cwd, persistSession: false, abortController: new AbortController() } };
  for (const [key, value] of [['resume', 'old'], ['continue', true], ['sessionStore', {}], ['forkSession', true]]) {
    await assert.rejects(f.policy.queryInput(f.binding, f.source, { ...input, options: { ...input.options, [key]: value } }));
  }
  await assert.rejects(f.policy.queryInput(f.binding, f.source, { ...input, options: { ...input.options, persistSession: true } }));
  await assert.rejects(f.policy.verify({ ...f.binding, recipeDigest: '0'.repeat(64) }, f.source));
}));

test('normal-home: actual Claude adapter and decorator preserve caps and consume only one failed synthetic entry', () => normalFixture(async f => {
  const reservation = await reservePhase(join(f.root, 'reservations'), fixturePermit(f));
  const report = { nativeQueryCalls: 0 }; let calls = 0;
  const binding = { slot: 'planner', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } };
  const query = createObservedQuery({ mode: 'native', phase: 'plan', reservation, report,
    nativeEnvironment: f.nativeEnvironment, getBinding: () => binding,
    nativeQuery(actual) {
      calls++; assert.equal(actual.options.env.HOME, '/Users/citrine');
      assert.equal(actual.options.env.CLAUDE_CONFIG_DIR, f.binding.folders.config.path);
      assert.deepEqual([actual.options.model, actual.options.maxTurns, actual.options.maxBudgetUsd,
        actual.options.persistSession], ['claude-sonnet-5-5', 4, .2, false]);
      assert.deepEqual(actual.options.tools, []); assert.deepEqual(actual.options.allowedTools.slice().sort(), GRAPH_TOOLS.slice().sort());
      assert.equal(actual.options.pathToClaudeCodeExecutable, f.runtime[2].path);
      throw new Error('synthetic-stop-before-provider');
    } });
  const context = { task: { title: 'Synthetic planner', prompt: 'One proposal only', harness: 'claude' },
    workingDirectory: f.cwd, signal: new AbortController().signal, async assertOwnership() {}, async emit() {},
    goalGraphTools: { goalId: 'goal', runId: 'run', scope: graphScope(1), port: {} } };
  const adapter = createClaudeAdapter({ ...adapterOptions('native', 'plan'), query });
  await assert.rejects(adapter.run(context), /synthetic-stop-before-provider/);
  assert.equal(calls, 1); assert.equal(report.nativeQueryCalls, 1); // injected callback count, no SDK call
  assert.equal(report.queries[0].environmentDigest, f.policy.digest);
  assert.equal(report.queries[0].closed, true); assert.equal(report.queries[0].entry, 'native-started-unknown');
  await assert.rejects(adapter.run({ ...context, signal: new AbortController().signal }));
  assert.equal(calls, 1);
}));

test('normal-home: current fixed source and environment identity remain separate from authorization', async () => {
  const source = await sourceIdentity();
  assert.equal(source.root, new URL('../../', import.meta.url).pathname.replace(/\/$/, ''));
  assert.notEqual(source.digest, 'c6d957f101c1084a1298c8c933d81ee898bfe94a5faa0f4e3d19139d5d056816');
  assert.equal(source.dependencies.length, 39);
  console.log(JSON.stringify({ kind: 'normal-home-candidate-identity', sourceDigest: source.digest,
    environmentDigest: nativeEnvironmentPolicy.digest, sourceFiles: source.files.length,
    aliases: source.dependencies.length, realNativeQueries: 0, authorization: 'NOT_GRANTED' }));
});
