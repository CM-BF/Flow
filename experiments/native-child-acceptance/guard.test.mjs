import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePermit, observeFrame } from './guard.mjs';

test('refuses old graph permits and distinguishes host permission from successful Read evidence', () => {
  assert.throws(() => validatePermit({ kind: 'flow-o08-one-shot' }, { digest: 'fixed', root: '/fixed/' }));
  const report = { mode: 'rehearsal', hostToolDecisions: [{ toolName: 'Read', decision: 'allowed' }] };
  observeFrame({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: 'must-not-persist' } }] } }, report);
  assert.equal(report.readObservations[0].state, 'requested');
  assert.equal(JSON.stringify(report).includes('must-not-persist'), false);
});

import { queryGate, reserveAttempt } from './guard.mjs';
import { LIMITS, MANAGED_BASELINE, MATERIAL } from './config.mjs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function queryInput() { return { options: { model: 'synthetic-no-query', maxTurns: 3, maxBudgetUsd: 0.1, tools: ['Read'], allowedTools: ['Read'],
  disallowedTools: ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'], permissionMode: 'dontAsk', thinking: { type: 'disabled' }, settingSources: [], plugins: [], skills: [], mcpServers: {}, strictMcpConfig: true, env: {} } }; }
test('rejects a widened requested gate and consumes the only attempt before a second query', () => {
  const bad = queryInput(); bad.options.disallowedTools = [];
  assert.throws(() => queryGate('rehearsal', bad, { queryAdapterCalls: 0 }), /mismatch/);
  const report = { queryAdapterCalls: 0 }; queryGate('rehearsal', queryInput(), report);
  assert.throws(() => queryGate('rehearsal', queryInput(), report), /one query/);
});

test('matches exact known init sets without treating declarations as execution', () => {
  const init = { type: 'system', subtype: 'init', model: 'synthetic', tools: ['Read'], permissionMode: 'dontAsk', plugins: MANAGED_BASELINE.plugins.map(name => ({ name })), skills: MANAGED_BASELINE.skills, mcp_servers: [] };
  const report = { mode: 'rehearsal' }; observeFrame(init, report); assert.equal(report.effective.observationKind, 'sdk-init-declaration'); assert.equal(report.readObservations, undefined);
  for (const changed of [{ tools: ['Read', 'Read'] }, { plugins: [...init.plugins, { name: 'unknown' }] }, { skills: [] }, { mcp_servers: [{ name: 'extra' }] }]) assert.throws(() => observeFrame({ ...init, ...changed }, {}), /baseline/);
});
test('requires matched successful tool results and rejects errors, unknown accounting and excess turns', () => {
  const report = {}; observeFrame({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'read', name: 'Read' }] } }, report);
  observeFrame({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read', content: MATERIAL }] } }, report);
  assert.equal(report.readObservations[0].state, 'reported-success'); assert.equal(report.readObservations[0].containsSyntheticMaterial, true);
  assert.throws(() => observeFrame({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'unknown', content: MATERIAL }] } }, report), /Unmatched/);
  const result = { type: 'result', subtype: 'success', is_error: false, num_turns: 2, total_cost_usd: 0.01, permission_denials: [{ tool_name: 'Read', tool_use_id: 'read', tool_input: { secret: 'never-save' } }] };
  observeFrame(result, report); assert.equal(JSON.stringify(report).includes('never-save'), false);
  for (const changed of [{ num_turns: 4 }, { total_cost_usd: null }, { total_cost_usd: 0.11 }]) assert.throws(() => observeFrame({ ...result, ...changed }, {}), /accounting/);
});
test('one-shot reservation cannot be reused through another output or permit filename', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-o10-reservation-unit-'));
  const identity = { digest: 'synthetic-unit-identity-not-a-real-source', root: '/synthetic-unit-not-a-checkout/' };
  const now = Date.now();
  // Schema fixture only: this identity cannot authorize either O10's checkout or provider execution.
  const permit = { kind: 'flow-o10-one-shot', authorizedBy: 'Goal Owner', approvalId: 'synthetic-unit-only', authorizationReference: 'Unit schema fixture; no human approval or provider authorization', sourceDigest: identity.digest, worktree: identity.root, model: 'sonnet', limits: LIMITS, approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString() };
  try {
    const first = join(root, 'first.json'), second = join(root, 'second.json'), markers = join(root, 'markers');
    await writeFile(first, JSON.stringify(permit)); await writeFile(second, JSON.stringify(permit));
    const reserved = await reserveAttempt(first, identity, markers); assert.equal(JSON.parse(await readFile(reserved.marker)).outcome, 'unknown');
    await assert.rejects(reserveAttempt(second, identity, markers), { code: 'EEXIST' });
    for (const changed of [{ sourceDigest: 'other' }, { worktree: '/' }, { limits: { ...LIMITS, queries: 2 } }, { expiresAt: new Date(now - 1).toISOString() }]) assert.throws(() => validatePermit({ ...permit, ...changed }, identity, now));
  } finally { await rm(root, { recursive: true, force: true }); }
});
