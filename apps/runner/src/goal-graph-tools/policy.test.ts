import type { HarnessContext } from '@flow/contracts';
import { expect, it } from 'vitest';
import type { GoalGraphCapability } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { createGraphToolMount } from '../goal-tool-bridge/policy.js';

const capability: GoalGraphCapability = { goalId: 'fixed', runId: 'grant', scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 }, port: { async readGraph() { throw new Error('unused'); }, async readProposal() { throw new Error('unused'); }, async commandGraph() { throw new Error('unused'); } } };
function context(): HarnessContext { return { task: { title: 'Graph', prompt: 'Plan only', harness: 'claude' }, workingDirectory: '/tmp', signal: new AbortController().signal, async emit() {}, async assertOwnership() {}, async waitForDecision() { return 'reject'; } }; }
it.each([
  ['sdk', 'flow-graph', 'mcp__flow-graph__graph_read', true],
  ['sdk', 'flow-graph', 'mcp__flow-graph__graph_command', true],
  ['plugin', 'flow-graph', 'mcp__flow-graph__graph_command', false],
  ['dynamic', 'flow-graph', 'mcp__flow-graph__graph_command', false],
  ['sdk', 'flow_graph', 'mcp__flow_graph__graph_command', false],
  ['sdk', 'flow-graph', 'mcp__flow-graph__execute', false],
  ['sdk', 'flow-goal', 'mcp__flow-goal__goal_command', false],
  [undefined, undefined, 'Read', false],
] as const)('allows only exact SDK graph provenance %s/%s/%s', async (source, name, tool, allowed) => {
  const controller = new AbortController(); const ctx = context(); const mount = createGraphToolMount(ctx, capability, controller);
  try {
    expect(mount.key).toBe(mount.server.name); expect(mount.allowedTools).toEqual(['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command']);
    const response = await mount.hook({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {}, tool_use_id: 'test', session_id: 'session', cwd: '/tmp', transcript_path: '', ...(source ? { mcp_server: { source, name: name! } } : {}) }, 'test', { signal: ctx.signal });
    expect(response).toMatchObject({ hookSpecificOutput: { permissionDecision: allowed ? 'allow' : 'deny' } });
    expect(mount.systemPrompt).toContain('does not execute or verify any child task');
  } finally { await mount.server.instance.close(); }
});
it('denies even an exact registered tool after cancellation or failed ownership', async () => {
  for (const revoked of [false, true]) {
    const controller = new AbortController(); const ctx = context();
    if (revoked) ctx.assertOwnership = async () => { throw new Error('Lost lease'); }; else controller.abort();
    const mount = createGraphToolMount(ctx, capability, controller);
    try {
      const response = await mount.hook({ hook_event_name: 'PreToolUse', tool_name: mount.allowedTools[1]!, tool_input: {}, tool_use_id: 'test', session_id: 'session', cwd: '/tmp', transcript_path: '', mcp_server: { source: 'sdk', name: mount.key } }, 'test', { signal: ctx.signal });
      expect(response).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } }); expect(controller.signal.aborted).toBe(true);
    } finally { await mount.server.instance.close(); }
  }
});
