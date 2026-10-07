import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { goalGraphRunAdmissionSchema } from '../../packages/contracts/src/goal-graph-runs.ts';
import { goalPlanConfirmationSchema } from '../../packages/contracts/src/goal-plan-confirmation.ts';
import { goalInputSchema } from '../../packages/contracts/src/goals.ts';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { describeExecutionProfile, guardExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { createGraphToolMount } from '../../apps/runner/src/goal-tool-bridge/policy.ts';
import { connectPeer } from '../native-graph-acceptance/peer.mjs';
import { graphScope, adapterOptions, MATERIAL, planningInstruction } from './config.mjs';
import { confirmationDraft, validateConfirmation, expectedChildren } from './proposal.mjs';

function fixture() {
  const pin = { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) };
  const citation = { projectId: randomUUID(), sourceId: randomUUID(), version: 1, contentDigest: 'b'.repeat(64), locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(MATERIAL) } };
  const state = { goalId: randomUUID(), projectId: citation.projectId, citation, admitted: { taskId: randomUUID(), runId: randomUUID() },
    runners: { plan: { profile: { reference: pin } }, children: { profile: { reference: pin } } } };
  const proposal = { id: randomUUID(), goalId: state.goalId, projectId: state.projectId, state: 'proposed', baseRevision: 1, proposalDigest: 'c'.repeat(64),
    source: { kind: 'goal-graph-run', runId: state.admitted.runId, taskId: state.admitted.taskId, runnerId: pin.runnerId },
    input: { expectedProjectRevision: 1, reason: 'Synthetic boundary check', additions: [{ key: 'A', title: 'Draft', dependencies: [] }, { key: 'B', title: 'Review', dependencies: [{ kind: 'proposed', key: 'A' }] }],
      inputProposal: { protocol: 'flow.goal-input-proposal.v1', nodes: ['A', 'B'].map(key => ({ key, input: { goal: `Actual input ${key}`, constraints: 'Readonly', acceptance: 'Independent review', verification: { kind: 'nonempty' }, knowledge: [citation] } })) } } };
  return { pin, state, proposal };
}
test('fixed shared schemas accept both finite stages and unapproved drafts cannot authorize children', () => {
  const { pin, state, proposal } = fixture();
  goalGraphRunAdmissionSchema.parse({ scope: graphScope(1), prompt: planningInstruction(state.citation), execution: { harness: 'claude', executionProfile: pin } });
  for (const node of proposal.input.inputProposal.nodes) goalInputSchema.parse(node.input);
  const draft = confirmationDraft(proposal, state); goalPlanConfirmationSchema.parse(draft);
  assert.throws(() => validateConfirmation(draft, proposal, state));
  draft.reason = 'Synthetic owner confirmation after reviewing actual inputs';
  validateConfirmation(draft, proposal, state);
  const confirmed = { goalId: state.goalId, projectId: state.projectId, progressionId: randomUUID(), authorizationDigest: 'd'.repeat(64),
    graph: { nodeIds: { A: 'node-a', B: 'node-b' } }, inputs: [{ key: 'A', nodeId: 'node-a', inputVersion: 1 }, { key: 'B', nodeId: 'node-b', inputVersion: 1 }] };
  assert.deepEqual(expectedChildren(confirmed, draft, state).nodes.map(n => n.nodeId), ['node-a', 'node-b']);
  for (const mutate of [p => p.source.runId = 'wrong', p => p.input.additions[1].dependencies = [], p => p.input.inputProposal.nodes[0].input.knowledge = []]) {
    const changed = structuredClone(proposal); mutate(changed); assert.throws(() => confirmationDraft(changed, state));
  }
});
test('the original adapters publish distinct pinned purposes and the real SDK MCP exposes only its existing two tools', async () => {
  let requests = 0; const denied = () => { requests++; throw new Error('No runtime or center request is allowed in preflight.'); };
  for (const phase of ['plan', 'children']) {
    const options = adapterOptions('rehearsal', phase, '/host-owned/fixed-material.txt'), adapter = createClaudeAdapter({ ...options, query: denied });
    const configuration = describeExecutionProfile(options, adapter);
    assert.equal(configuration.access, phase === 'plan' ? 'goal-graph-tools' : 'configured-readonly');
  }
  const mount = createGraphToolMount({ assertOwnership: async () => {}, emit: denied }, { goalId: 'preflight', runId: 'preflight', scope: graphScope(1),
    port: { readGraph: denied, readProposal: denied, commandGraph: denied } }, new AbortController());
  const peer = await connectPeer(mount.server);
  try { assert.deepEqual((await peer.listTools()).tools.map(t => t.name).sort(), ['graph_command', 'graph_read']); }
  finally { await peer.close(); await mount.server.instance.close(); }
  assert.equal(requests, 0);
});
