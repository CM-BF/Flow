import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECLARATIONS, HISTORICAL_O10_DECLARATIONS, GRAPH_TOOLS, MATERIAL } from './config.mjs';
import { createQueryObservation } from './query-policy.mjs';
function init(phase = 'children') { return { type: 'system', subtype: 'init', session_id: 'session', model: DECLARATIONS.model,
  permissionMode: 'dontAsk', tools: phase === 'plan' ? GRAPH_TOOLS : ['Read'], plugins: DECLARATIONS.plugins.map(name => ({ name })),
  skills: DECLARATIONS.skills, mcp_servers: phase === 'plan' ? [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] : [], claude_code_version: DECLARATIONS.runtimeVersion }; }
function result() { return { type: 'result', subtype: 'success', is_error: false, session_id: 'session', uuid: 'final', num_turns: 2,
  total_cost_usd: 0.02, modelUsage: { 'claude-sonnet-5-5': { costUSD: 0.019 }, 'claude-haiku-4-5-20251001': { costUSD: 0.001 } }, permission_denials: [] }; }
function use(id = 'read') { return { type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id, name: 'Read' }] } }; }
function read(id = 'read') { return { type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: id, content: MATERIAL, is_error: false }] } }; }

test('child evidence requires matching material Read result and result accounting, not only host allow', () => {
  const missing = createQueryObservation('children'); missing.frame(init()); missing.frame(result()); assert.throws(() => missing.finish(), /Read/);
  const observed = createQueryObservation('children'); observed.frame(init()); observed.frame(use()); observed.frame(read()); observed.frame(result());
  const facts = observed.finish(); assert.equal(facts.reads[0].containsFixedMaterial, true); assert.equal(facts.result.sdkEstimatedCostUsd, 0.02);
  assert.equal(facts.result.modelUsage['claude-haiku-4-5-20251001'].costUSD, 0.001); assert(!JSON.stringify(facts).includes(MATERIAL));
});

test('unknown declarations, unpaired tool evidence, conflicting finals and missing accounting are rejected', () => {
  for (const mutate of [x => x.tools.push('Bash'), x => x.model = 'unexpected', x => x.plugins.push({ name: 'extra' }), x => x.mcp_servers.push({ name: 'other' })]) {
    const event = structuredClone(init()); mutate(event); assert.throws(() => createQueryObservation('children').frame(event));
  }
  const unpaired = createQueryObservation('children'); unpaired.frame(init()); assert.throws(() => unpaired.frame(read()), /tool result/);
  const duplicate = createQueryObservation('children'); duplicate.frame(init()); duplicate.frame(use()); duplicate.frame(read()); duplicate.frame(result()); assert.throws(() => duplicate.frame({ ...result(), uuid: 'other' }), /final/); assert.throws(() => duplicate.finish(), /rejected/);
  const unknown = createQueryObservation('children'); unknown.frame(init()); assert.throws(() => unknown.frame({ ...result(), total_cost_usd: undefined }), /accounting/);
});

test('planner evidence only admits the two registered graph tools and keeps semantic acceptance separate', () => {
  const observed = createQueryObservation('plan'); observed.frame(init('plan')); observed.frame(result());
  const facts = observed.finish(); assert.equal(facts.semanticAcceptance, 'not-evaluated'); assert.equal(facts.toolExecutionEvidence, 'center-audit-required');
  assert.throws(() => createQueryObservation('plan').frame(init('children')));
});


test('O16 repair: exact private recipe declarations pass while O10 stays historical', () => {
  const observed = createQueryObservation('plan'); observed.frame(init('plan'));
  assert.deepEqual(observed.snapshot().effective.plugins, ['cc-plugin-agents-md', 'cc-plugin-plugin-authoring']);
  assert.deepEqual(observed.snapshot().effective.skills, ['doctor', 'plugin-authoring']);
  assert.equal(observed.snapshot().declarationPolicy, 'o16-private-recipe-20261007-1018');
  assert.deepEqual(HISTORICAL_O10_DECLARATIONS.plugins, ['cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-plugin-authoring']);
  assert.deepEqual(HISTORICAL_O10_DECLARATIONS.skills, ['design', 'doctor', 'plugin-authoring']);
  assert.equal(observed.snapshot().result, null); // Init is neither actual-model qualification nor usage.
});
test('O16 repair: private declaration metadata never widens executable authority or accepts conflicts', () => {
  for (const mutate of [e => e.plugins.push({ name: 'unknown' }), e => e.skills.push('unknown'),
    e => e.plugins.push({ name: e.plugins[0].name }), e => e.skills.push(e.skills[0]), e => delete e.plugins,
    e => e.skills = [], e => e.model = 'other', e => e.claude_code_version = 'other',
    e => e.tools = ['Bash'], e => e.mcp_servers[0].source = 'external', e => e.permissionMode = 'bypassPermissions']) {
    const observed = createQueryObservation('plan'), event = structuredClone(init('plan')); mutate(event);
    assert.throws(() => observed.frame(event)); assert.equal(observed.snapshot().failure, 'observation-rejected');
  }
  const observed = createQueryObservation('plan'); observed.frame(init('plan'));
  assert.throws(() => observed.frame({ ...init('plan'), session_id: 'conflicting-session' }));
});
