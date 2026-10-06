import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GOAL_INPUT_PROPOSAL_PROTOCOL, type GoalGraphProposal, type GoalGraphProposalInput } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { goalPlanConfirmationSchema, type GoalPlanConfirmation } from '../../../../packages/contracts/src/goal-plan-confirmation.js';
import type { ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import type { GoalGraphScope } from '../../../../packages/contracts/src/goal-graph-runs.js';
import type { ClaudeQuery } from '../../../runner/src/claude.js';
import { finalResult, graphPeer } from '../../../runner/src/goal-graph-tools/test-peer.js';
import { confirmationFixture } from './fixture.js';

function plan(): GoalGraphProposalInput {
  return { expectedProjectRevision: 1, reason: 'Complete explicit proposal', additions: [
    { key: 'A', title: 'TITLE_A_NOT_INPUT', dependencies: [] },
    { key: 'B', title: 'TITLE_B_NOT_INPUT', dependencies: [{ kind: 'proposed', key: 'A' }] },
  ], inputProposal: { protocol: GOAL_INPUT_PROPOSAL_PROTOCOL, nodes: ['A', 'B'].map(key => ({ key, input: {
    goal: `Actual work ${key} with fixed requirements`, constraints: 'Readonly, no automatic semantic acceptance',
    acceptance: 'Owner checks factual completeness', verification: { kind: 'nonempty' },
  } })) } };
}
function confirmation(proposal: Pick<GoalGraphProposal, 'proposalDigest'>, pin: ExecutionProfileReference, revision = 1): GoalPlanConfirmation {
  return { protocol: 'flow.goal-plan-confirmation.v1', proposalDigest: proposal.proposalDigest, expectedProjectRevision: revision,
    nodes: ['A', 'B'].map(key => ({ key, executionProfile: pin, externalDependencies: [] })), maxAdmissions: 2,
    intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: new Date(Date.now() + 600_000).toISOString(), reason: 'Owner confirms exact inputs and bounded execution.' };
}
const query: ClaudeQuery = () => Object.assign((async function* () { yield { ...finalResult(randomUUID()), result: 'Synthetic verified result.' }; })(), { close() {} });
it('bounds the explicit owner confirmation without accepting model authority fields', () => {
  const body = confirmation({ proposalDigest: 'a'.repeat(64) }, { id: randomUUID(), runnerId: randomUUID(), configDigest: 'b'.repeat(64) });
  expect(goalPlanConfirmationSchema.safeParse(body).success).toBe(true);
  for (const changed of [{ protocol: 'qualified' }, { nodes: [body.nodes[0], body.nodes[0]] }, { maxAdmissions: 3 }, { nodes: Array(17).fill(body.nodes[0]) }, { expiresAt: 'later' }, { trusted: true }]) {
    expect(goalPlanConfirmationSchema.safeParse({ ...body, ...changed }).success).toBe(false);
  }
});

describe('O15 real isolated HTTP/PG confirmation', () => {
  let f: Awaited<ReturnType<typeof confirmationFixture>>;
  beforeAll(async () => { f = await confirmationFixture(); });
  afterAll(async () => { await f?.close(); });
  async function setup(input = plan()) {
    const goal = await f.goal(), harness = await f.harness(query);
    const proposal = (await f.owner().createGoalGraphProposal(goal.goalId, input, randomUUID())).proposal;
    return { ...goal, harness, proposal, body: confirmation(proposal, harness.pin) };
  }
  const confirm = (s: Awaited<ReturnType<typeof setup>>, body: unknown = s.body, key: string = randomUUID()) => f.http(`/api/goal-graph-proposals/${s.proposal.id}/confirm-inputs`, body, key);
  async function noConfirmation(goalId: string) {
    for (const table of ['goal_inputs', 'goal_contexts', 'goal_progressions', 'goal_plan_confirmations'] as const) {
      expect((await f.pool.query(`SELECT count(*)::int AS n FROM flow.${table} WHERE goal_id=$1`, [goalId])).rows[0].n).toBe(0);
    }
    expect((await f.owner().readGoal(goalId)).nodes).toEqual([]);
  }

  it('uses the real SDK tool proposal, one owner confirmation and fixed materials through two children, then preserves obsolete output', async () => {
    const goal = await f.goal(), input = plan(), sourceText = 'Frozen material Ω😀 from the owner.';
    const source = await f.http(`/api/projects/${goal.projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Owner material', text: sourceText });
    expect(source.status).toBe(201);
    input.inputProposal!.nodes[0]!.input.knowledge = [{ projectId: goal.projectId, sourceId: source.body.source.id, version: 1,
      contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(sourceText) } }];
    let proposalId = '', plannerCalls = 0; const prompts: string[] = [];
    const planner = await f.harness(({ options }) => Object.assign((async function* () {
      plannerCalls++; const peer = await graphPeer(options!);
      try {
        const proposed = await peer.callTool({ name: 'graph_command', arguments: { command: { kind: 'propose', proposal: input }, idempotencyKey: 'complete-plan' } });
        expect(proposed.isError).not.toBe(true); const body = JSON.parse((proposed.content as any)[0].text); proposalId = body.proposal.id;
        expect(body.proposal).not.toHaveProperty('input');
      } finally { await peer.close(); }
      yield finalResult(randomUUID());
    })(), { close() {} }), true);
    const run = await f.owner().admitGoalGraphRun(goal.goalId, { scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 0,
      maxNewNodes: 2, maxNewEdges: 1, inputProposalProtocol: GOAL_INPUT_PROPOSAL_PROTOCOL }, prompt: 'Propose complete inputs; owner confirms execution separately.', execution: { harness: 'claude', executionProfile: planner.pin } }, randomUUID());
    const planning = await planner.start();
    await expect.poll(async () => (await f.owner().show(run.task.id)).status, { timeout: 10000 }).toBe('succeeded'); await planning.close();
    expect(plannerCalls).toBe(1); expect(proposalId).not.toBe(''); expect((await f.owner().readGoal(goal.goalId)).nodes).toEqual([]);
    const saved = await f.owner().goalGraphProposal(proposalId); expect(saved.input).toEqual(input); expect(saved.source).toMatchObject({ kind: 'goal-graph-run', runId: run.run.id });
    const child = await f.harness(({ prompt }) => Object.assign((async function* () { prompts.push(String(prompt)); yield { ...finalResult(randomUUID()), result: `Child artifact ${prompts.length}` }; })(), { close() {} }));
    const body = confirmation(saved, child.pin), key = randomUUID(), path = `/api/goal-graph-proposals/${saved.id}/confirm-inputs`;
    f.loseReply(path); await expect(f.http(path, body, key)).rejects.toThrow(); await f.restart();
    const recovered = await f.http(path, body, key); expect(recovered.status, JSON.stringify(recovered.body)).toBe(200); expect(recovered.body.replayed).toBe(true);
    const receipt = recovered.body.confirmation, id = receipt.progressionId;
    expect((await f.http(path, body)).body).toMatchObject({ confirmation: receipt, alreadyConfirmed: true });
    expect((await f.http(path, { ...body, maxAdmissions: 1 })).body.error.code).toBe('plan_already_confirmed');
    expect((await f.http(path, body, key, child.runner.token)).status).toBe(403);
    expect((await f.pool.query('SELECT count(*)::int AS n FROM flow.goal_plan_confirmations WHERE proposal_id=$1', [saved.id])).rows[0].n).toBe(1);
    for (const selection of receipt.inputs) expect((await f.owner().readGoalInput(goal.goalId, selection.nodeId)).input).toEqual(input.inputProposal!.nodes.find(node => node.key === selection.key)!.input);
    const children = await child.start();
    for (let index = 0; index < 2; index++) {
      expect((await f.sweep()).errors).toEqual([]);
      await expect.poll(async () => (await f.http(`/api/goals/${goal.goalId}/progressions/${id}`)).body.nodes[index]?.task?.status, { timeout: 10000 }).toBe('succeeded');
    }
    await children.close(); await f.sweep();
    const done = (await f.http(`/api/goals/${goal.goalId}/progressions/${id}`)).body;
    expect(done.state).toBe('finished'); expect(done.admissions).toBe(2); expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('Actual work A'); expect(prompts[0]).toContain(sourceText); expect(prompts[1]).toContain('Actual work B'); expect(prompts[1]).toContain('Child artifact 1');
    expect(prompts.join('\n')).not.toContain('TITLE_A_NOT_INPUT');
    expect((await f.owner().readGoal(goal.goalId)).nodes.map(node => node.accepted)).toEqual([null, null]);
    const b = receipt.graph.nodeIds.B, artifact = done.nodes.find((node: any) => node.nodeId === b).artifact;
    await f.owner().commandGoal(goal.goalId, { kind: 'accept-delivery', nodeId: b, executionId: done.nodes[1].executionId, expectedCurrentExecutionId: null, reason: 'Independent owner accepts this exact result.' }, randomUUID());
    await f.owner().commandGoal(goal.goalId, { kind: 'define-input', nodeId: b, expectedInputVersion: 1, reason: 'Owner requests a revised downstream input.', input: { ...input.inputProposal!.nodes[1]!.input, goal: 'Revised owner input B' } }, randomUUID());
    expect((await f.owner().readGoal(goal.goalId)).nodes.find(node => node.nodeId === b)).toMatchObject({ deliveryCurrent: false, execution: { inputCurrent: false } });
    expect((await f.http(`/api/details/${artifact.detailId}`)).body.content).toBe('Child artifact 2');
    expect((await f.owner().readGoalInput(goal.goalId, b, 1)).input.goal).toContain('Actual work B');
    await f.sweep(); expect((await f.pool.query('SELECT count(*)::int AS n FROM flow.goal_executions WHERE goal_id=$1', [goal.goalId])).rows[0].n).toBe(2);
    f.facts.journey = { plannerCalls, childCalls: prompts.length, receipt, artifact, explicitOwnerRevision: true, oldArtifactStillReadable: true, modelCalls: 0 };
  });

  it('rolls back graph, materialized inputs and authorization when the final receipt fails', async () => {
    const s = await setup(), key = randomUUID();
    await f.pool.query(`CREATE FUNCTION flow.o15_reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'O15 injected final link failure'; END $$;
      CREATE TRIGGER o15_reject_receipt BEFORE INSERT ON flow.goal_plan_confirmations FOR EACH ROW EXECUTE FUNCTION flow.o15_reject_receipt()`);
    try { expect((await confirm(s, s.body, key)).status).toBe(500); await noConfirmation(s.goalId);
      expect((await f.owner().goalGraphProposal(s.proposal.id)).state).toBe('proposed');
    } finally { await f.pool.query('DROP TRIGGER o15_reject_receipt ON flow.goal_plan_confirmations; DROP FUNCTION flow.o15_reject_receipt()'); }
    expect((await confirm(s, s.body, key)).status).toBe(200);
    await expect(f.pool.query('DELETE FROM flow.goal_plan_confirmations WHERE proposal_id=$1', [s.proposal.id])).rejects.toMatchObject({ code: '23514' });
    await expect(f.pool.query('UPDATE flow.goal_plan_confirmations SET confirmation_digest=$2 WHERE proposal_id=$1', [s.proposal.id, '0'.repeat(64)])).rejects.toMatchObject({ code: '23514' });
    await f.owner().revokeRunner(s.harness.runner.runnerId);
  });

  it('requires complete saved input, exact current graph, profile, budget and current material before all-or-nothing confirmation', async () => {
    const old = plan(); delete old.inputProposal;
    const legacy = await setup(old); expect((await confirm(legacy)).body.error.code).toBe('complete_inputs_required'); await noConfirmation(legacy.goalId);
    const s = await setup();
    for (const changed of [{ expectedProjectRevision: 2 }, { nodes: [s.body.nodes[0]] }, { expiresAt: new Date(Date.now() - 1).toISOString() }, { maxAdmissions: 3 }, { proposalDigest: '0'.repeat(64) }]) {
      expect((await confirm(s, { ...s.body, ...changed })).status).toBeGreaterThanOrEqual(400); await noConfirmation(s.goalId);
    }
    await f.owner().revokeRunner(s.harness.runner.runnerId);
    expect((await confirm(s)).status).toBe(409); await noConfirmation(s.goalId);
    const goal = await f.goal(), input = plan(), sourceText = 'Exact material';
    const source = await f.http(`/api/projects/${goal.projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Source', text: sourceText });
    input.inputProposal!.nodes[0]!.input.knowledge = [{ projectId: goal.projectId, sourceId: source.body.source.id, version: 1, contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: sourceText.length } }];
    const proposal = (await f.owner().createGoalGraphProposal(goal.goalId, input, randomUUID())).proposal;
    await f.http(`/api/projects/${goal.projectId}/knowledge/sources/${source.body.source.id}/versions`, { expectedVersion: 1, text: 'Changed material' });
    const harness = await f.harness(query);
    expect((await f.http(`/api/goal-graph-proposals/${proposal.id}/confirm-inputs`, confirmation(proposal, harness.pin))).body.error.code).toBe('goal_knowledge_obsolete'); await noConfirmation(goal.goalId);
    const wrongPurpose = await setup(), graphHarness = await f.harness(query, true);
    expect((await confirm(wrongPurpose, confirmation(wrongPurpose.proposal, graphHarness.pin))).status).toBe(409); await noConfirmation(wrongPurpose.goalId);
  });

  it('reuses only the exact applied graph and refuses an already-defined node without partially freezing the others', async () => {
    const s = await setup(), graph = await f.owner().applyGoalGraphProposal(s.proposal.id, { expectedProjectRevision: 1, proposalDigest: s.proposal.proposalDigest }, randomUUID());
    const body = { ...s.body, expectedProjectRevision: graph.receipt.toRevision };
    await f.owner().commandGoal(s.goalId, { kind: 'define-input', nodeId: graph.receipt.nodeIds.B!, expectedInputVersion: 0, input: plan().inputProposal!.nodes[1]!.input, reason: 'Prior explicit owner edit.' }, randomUUID());
    expect((await confirm(s, body)).body.error.code).toBe('input_version');
    expect((await f.pool.query('SELECT node_id FROM flow.goal_inputs WHERE goal_id=$1', [s.goalId])).rows).toEqual([{ node_id: graph.receipt.nodeIds.B }]);
    expect((await f.pool.query('SELECT id FROM flow.goal_progressions WHERE goal_id=$1', [s.goalId])).rows).toEqual([]);
    const fresh = await setup(), applied = await f.owner().applyGoalGraphProposal(fresh.proposal.id, { expectedProjectRevision: 1, proposalDigest: fresh.proposal.proposalDigest }, randomUUID());
    const accepted = await confirm(fresh, { ...fresh.body, expectedProjectRevision: applied.receipt.toRevision });
    expect(accepted.status).toBe(200); expect(accepted.body.confirmation.graph).toEqual(applied.receipt);
  });

  it('rejects new payloads on old graph grants before replay and preserves current authority on explicitly granted proposals', async () => {
    async function granted(explicit: boolean) {
      const goal = await f.goal();
      const scope: GoalGraphScope = { baseRevision: 1, allowedExistingNodes: [], maxProposals: 2, maxApplications: 0, maxNewNodes: 2, maxNewEdges: 1,
        ...(explicit ? { inputProposalProtocol: GOAL_INPUT_PROPOSAL_PROTOCOL } : {}) };
      const run = await f.owner().admitGoalGraphRun(goal.goalId, { scope, prompt: 'Fixed proposal authority', execution: { harness: 'fixture' } }, randomUUID());
      expect(run.run.scope).toEqual(scope);
      if (!explicit) expect(run.run.scope).not.toHaveProperty('inputProposalProtocol');
      const runner = await f.owner().registerRunner({ name: 'O15 authority fixture', harnesses: ['fixture'], capacity: 1 });
      let assignment: any;
      await expect.poll(async () => { assignment = (await f.http('/api/runner/claim', {}, randomUUID(), runner.token)).body.assignment; return assignment?.task.id; }).toBe(run.task.id);
      const call = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, grant: { id: run.run.id, version: 1 } };
      return { goal, run, runner, call };
    }
    const old = await granted(false), { inputProposal: _input, ...legacy } = plan(), key = randomUUID();
    const path = '/api/runner/goal-graph/command';
    const accepted = await f.http(path, { ...old.call, command: { kind: 'propose', proposal: legacy } }, key, old.runner.token);
    expect(accepted.status).toBe(200); expect((await f.owner().goalGraphProposal(accepted.body.proposal.id)).input).toEqual(legacy);
    for (const requestKey of [key, randomUUID()]) {
      const denied = await f.http(path, { ...old.call, command: { kind: 'propose', proposal: plan() } }, requestKey, old.runner.token);
      expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('goal_graph_scope');
    }
    expect((await f.owner().goalGraphRunCalls(old.run.run.id)).calls).toHaveLength(1);
    const current = await granted(true), currentKey = randomUUID(), command = { ...current.call, command: { kind: 'propose', proposal: plan() } };
    const permitted = await f.http(path, command, currentKey, current.runner.token); expect(permitted.status).toBe(200);
    expect((await f.http(path, command, currentKey, current.runner.token)).body.replayed).toBe(true);
    expect((await f.http(path, { ...command, ownerVersion: current.call.ownerVersion + 1 }, randomUUID(), current.runner.token)).status).toBeGreaterThanOrEqual(400);
    await f.http(`/api/goal-graph-runs/${current.run.run.id}/revoke`, { reason: 'Owner withdraws this exact authority.' });
    expect((await f.http(path, command, currentKey, current.runner.token)).status).toBeGreaterThanOrEqual(400);
    expect((await f.owner().goalGraphRunCalls(current.run.run.id)).calls).toHaveLength(1);
  });

  it('does not duplicate confirmed work after its first execution becomes unknown and the center restarts', async () => {
    const s = await setup(), accepted = await confirm(s), id = accepted.body.confirmation.progressionId;
    expect(accepted.status).toBe(200); await f.sweep();
    let assignment: any;
    await expect.poll(async () => { assignment = (await f.http('/api/runner/claim', {}, randomUUID(), s.harness.runner.token)).body.assignment; return assignment; }).not.toBeNull();
    await f.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [assignment.attempt.id]);
    await expect.poll(async () => (await f.owner().show(assignment.task.id)).status, { timeout: 5000 }).toBe('uncertain');
    await f.restart(); await f.sweep();
    expect((await f.http(`/api/goals/${s.goalId}/progressions/${id}`)).body).toMatchObject({ admissions: 1, state: 'blocked', cause: { code: 'execution-uncertain' } });
    expect((await confirm(s)).body).toMatchObject({ alreadyConfirmed: true, confirmation: accepted.body.confirmation });
    expect((await f.http('/api/runner/claim', {}, randomUUID(), s.harness.runner.token)).body.assignment).toBeNull();
    expect((await f.pool.query('SELECT count(*)::int AS n FROM flow.goal_executions WHERE goal_id=$1', [s.goalId])).rows[0].n).toBe(1);
  });
});
