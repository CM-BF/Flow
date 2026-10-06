import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LIMITS, MANAGED_BASELINE } from './config.mjs';
import { validatePermit, reserveAttempt, queryGate, observeFrame } from './guard.mjs';
const identity = { digest: 'a'.repeat(64), root: '/synthetic-o08-test/' };
function permit() { return { kind: 'flow-o08-one-shot', authorizedBy: 'Goal Owner', approvalId: 'synthetic-test-only', authorizationReference: 'Synthetic test record; not native execution permission',
  sourceDigest: identity.digest, worktree: identity.root, model: 'sonnet', limits: LIMITS, approvedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }; }
test('missing, expired, changed-source and expanded-budget permission records fail closed', () => {
  for (const value of [null, {}, { ...permit(), sourceDigest: 'b'.repeat(64) }, { ...permit(), limits: { ...LIMITS, queries: 2 } },
    { ...permit(), expiresAt: new Date(Date.now() - 1000).toISOString() }, { ...permit(), model: 'other-model' }, { ...permit(), worktree: '/another-checkout/' }]) assert.throws(() => validatePermit(value, identity));
  assert.equal(validatePermit(permit(), identity).approvalId, 'synthetic-test-only');
});
test('one approval cannot be reused by moving the permit to another directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-o08-guard-'));
  try {
    const records = [join(root, 'first'), join(root, 'second')]; const markerRoot = join(root, 'markers');
    for (const folder of records) { await mkdir(folder); await writeFile(join(folder, 'permit.json'), JSON.stringify(permit())); }
    await reserveAttempt(join(records[0], 'permit.json'), identity, markerRoot);
    await assert.rejects(reserveAttempt(join(records[1], 'permit.json'), identity, markerRoot), { code: 'EEXIST' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
function input() { return { options: { maxTurns: 4, maxBudgetUsd: .2, model: 'synthetic-no-query', tools: [], settingSources: [], plugins: [], skills: [],
  allowedTools: ['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command'], mcpServers: { 'flow-graph': { type: 'sdk', name: 'flow-graph' } } } }; }
test('query call count and capability scope reject a second call or foreign tools', () => {
  const report = { queryAdapterCalls: 0, nativeQueryCalls: 0 }; const gate = queryGate('rehearsal', report);
  gate(input()); assert.equal(report.nativeQueryCalls, 0); assert.throws(() => gate(input()));
  const altered = input(); altered.options.allowedTools.push('Bash');
  assert.throws(() => queryGate('rehearsal', { queryAdapterCalls: 0 })(altered));
});
test('effective extensions, unknown native cost and over-budget/turn results cannot pass', () => {
  assert.throws(() => observeFrame({ type: 'system', subtype: 'init', tools: ['Bash'], plugins: [], skills: [] }, {}));
  for (const fields of [{}, { num_turns: 5, total_cost_usd: .01 }, { num_turns: 4, total_cost_usd: .21 }]) assert.throws(() => observeFrame({ type: 'result', ...fields }, { mode: 'native' }));
});

test('native capability reports must declare the actual SDK source, exact tools and known managed resources', () => {
  const event = { type: 'system', subtype: 'init', tools: ['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command'], plugins: MANAGED_BASELINE.plugins.map(name => ({ name })), skills: MANAGED_BASELINE.skills, model: 'observed-model', permissionMode: 'dontAsk', mcp_servers: [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] };
  observeFrame(event, { mode: 'native' });
  assert.throws(() => observeFrame({ ...event, mcp_servers: [{ name: 'flow-graph', status: 'connected' }] }, { mode: 'native' }));
  assert.throws(() => observeFrame({ ...event, tools: undefined }, { mode: 'native' }));
});
