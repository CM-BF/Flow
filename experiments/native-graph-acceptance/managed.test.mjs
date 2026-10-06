import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeFrame, recordHostDecisions } from './guard.mjs';
import { createGraphToolMount } from '../../apps/runner/src/goal-tool-bridge/policy.ts';
import { SCOPE } from './config.mjs';
const plugins = ['cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-plugin-authoring'];
const skills = ['design', 'doctor', 'plugin-authoring'];
function init() { return { type: 'system', subtype: 'init', model: 'observed-model', permissionMode: 'dontAsk',
  tools: ['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command'],
  plugins: plugins.map(name => ({ name, path: '/managed/not-read' })), skills,
  mcp_servers: [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] }; }
test('known managed declarations are accepted without granting additional tools or implying execution', () => {
  const report = { mode: 'native' }; observeFrame(init(), report);
  assert.equal(report.effective.observationKind, 'sdk-init-declaration');
  assert.deepEqual(report.effective.plugins.map(plugin => plugin.name), plugins);
  assert.equal(report.hostToolDecisions, undefined);
});
test('the actual host gate records allow and deny separately without recording tool arguments', async () => {
  const controller = new AbortController();
  const context = { assertOwnership: async () => {}, emit: async () => {} };
  const denied = async () => { throw new Error('No center port call was authorized by this test'); };
  const mount = createGraphToolMount(context, { goalId: 'synthetic', runId: 'synthetic', scope: SCOPE,
    port: { readGraph: denied, readProposal: denied, commandGraph: denied } }, controller);
  const input = { options: { hooks: { PreToolUse: [{ hooks: [mount.hook] }] }, abortController: controller } };
  const report = {}; recordHostDecisions(input, report);
  const hook = input.options.hooks.PreToolUse[0].hooks[0];
  try {
    for (const [tool, source, expected] of [['mcp__flow-graph__graph_read', 'sdk', 'allow'], ['Bash', 'sdk', 'deny'], ['mcp__flow-graph__graph_command', 'plugin', 'deny']]) {
      const result = await hook({ hook_event_name: 'PreToolUse', tool_name: tool, tool_use_id: 'bounded-id',
        tool_input: { secret: 'NEVER-SAVE-ARGUMENT' }, mcp_server: { name: 'flow-graph', source } });
      assert.equal(result.hookSpecificOutput.permissionDecision, expected);
    }
    assert.deepEqual(report.hostToolDecisions.map(row => row.decision), ['allowed', 'denied', 'denied']);
    assert(report.hostToolDecisions.every(row => row.execution === 'not-observed'));
    assert.equal(JSON.stringify(report).includes('NEVER-SAVE-ARGUMENT'), false);
  } finally { await mount.server.instance.close(); }
});
test('unknown host outcomes remain unknown and observations have a hard entry bound', async () => {
  const report = {}, controller = new AbortController();
  const input = { options: { hooks: { PreToolUse: [{ hooks: [async () => { throw new Error('SECRET-CALLBACK-ERROR'); }] }] }, abortController: controller } };
  recordHostDecisions(input, report);
  await assert.rejects(input.options.hooks.PreToolUse[0].hooks[0]({ tool_name: 'Bash', tool_input: { secret: 'NO' } }), /could not be observed/);
  assert.equal(report.hostToolDecisions[0].decision, 'unknown'); assert.equal(controller.signal.aborted, true);
  assert.equal(JSON.stringify(report).includes('SECRET'), false);
  const bounded = {}, next = new AbortController();
  const second = { options: { hooks: { PreToolUse: [{ hooks: [async () => ({ hookSpecificOutput: { permissionDecision: 'deny' } })] }] }, abortController: next } };
  recordHostDecisions(second, bounded);
  for (let i = 0; i < 64; i++) await second.options.hooks.PreToolUse[0].hooks[0]({ tool_name: 'Bash' });
  await assert.rejects(second.options.hooks.PreToolUse[0].hooks[0]({ tool_name: 'Bash' }), /limit/);
  assert.equal(bounded.hostToolDecisions.length, 64); assert.equal(next.signal.aborted, true);
});
test('SDK result denials retain source and bounded identities while missing observations stay unknown', () => {
  const report = {}; observeFrame({ type: 'result' }, report);
  assert.equal(report.permissionDenials.state, 'unknown'); assert.equal(report.permissionDenials.total, null);
  const result = { type: 'result', permission_denials: Array.from({ length: 33 }, (_, i) => ({ tool_name: 'Bash', tool_use_id: `call-${i}`, tool_input: { credential: 'NEVER-STORE' } })) };
  observeFrame(result, report);
  assert.equal(report.permissionDenials.total, 33); assert.equal(report.permissionDenials.entries.length, 32);
  assert.equal(report.permissionDenials.truncated, true); assert.equal(report.permissionDenials.source, 'result.permission_denials');
  assert.equal(JSON.stringify(report).includes('NEVER-STORE'), false);
});
test('missing, duplicate and unknown managed declarations or tool provenance fail closed', () => {
  for (const changed of [{ plugins: [] }, { plugins: [...init().plugins, init().plugins[0]] }, { plugins: [...init().plugins, { name: 'foreign' }] },
    { skills: undefined }, { skills: ['design', 'doctor', 'doctor'] }, { skills: [...skills, 'foreign'] },
    { tools: [...init().tools, 'Bash'] }, { tools: [init().tools[0], init().tools[0]] },
    { mcp_servers: [{ name: 'flow-graph', source: 'plugin', status: 'connected' }] }, { permissionMode: 'bypassPermissions' }]) {
    assert.throws(() => observeFrame({ ...init(), ...changed }, { mode: 'native' }));
  }
});
