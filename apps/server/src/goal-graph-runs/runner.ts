import type { Pool, PoolClient } from 'pg';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import type { GraphRunActor } from '../../../../packages/contracts/src/projects.js';
import type { GoalGraphCommandCall, GoalGraphCommandResult, GoalGraphDetailCall, GoalGraphReadCall, GoalGraphReadPage } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { commandInTransaction } from '../tasks.js';
import { applyProposalInTransaction, createProposalInTransaction, goalContext, readProposalInTransaction } from '../goal-graph-proposals/store.js';
import { withRunnerAuthority } from '../goal-run-authority/runner-project-fence.js';
import { counts, graphAuthorityStore, runView, type GraphRunRow } from './store.js';
import { GOAL_INPUT_PROPOSAL_PROTOCOL } from '../../../../packages/contracts/src/goal-graph-proposals.js';

export function runnerGrant(pool: Pool, runnerId: string, input: Ownership) {
  return withRunnerAuthority(pool, graphAuthorityStore, runnerId, input, undefined, (client, run) => runView(client, run));
}
function cursor(run: GraphRunRow, after: string) { return Buffer.from(JSON.stringify([run.id, run.scope.projectId, run.scope.baseRevision, after])).toString('base64url'); }
function afterId(run: GraphRunRow, input: string | undefined): string | null {
  if (!input) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
    if (Array.isArray(value) && value.length === 4 && value[0] === run.id && value[1] === run.scope.projectId && value[2] === run.scope.baseRevision && typeof value[3] === 'string' && value[3].length <= 128) return value[3];
  } catch { /* All malformed or cross-grant cursors have the same bounded error. */ }
  throw new HttpError(400, 'goal_graph_cursor', 'The cursor must name this grant and base revision.');
}
export function runnerRead(pool: Pool, runnerId: string, input: GoalGraphReadCall): Promise<GoalGraphReadPage> {
  return withRunnerAuthority(pool, graphAuthorityStore, runnerId, input, input.grant, async (client, run, state) => {
    const rows = (await client.query<{ id: string; title: string; version: number }>(`SELECT n->>'id' AS id,n->>'title' AS title,(n->>'version')::int AS version
      FROM flow.project_revisions r CROSS JOIN LATERAL jsonb_array_elements(r.nodes) n
      WHERE r.project_id=$1 AND r.revision=$2 AND ($3::text IS NULL OR n->>'id'>$3) ORDER BY n->>'id' LIMIT $4`,
    [run.scope.projectId, run.scope.baseRevision, afterId(run, input.after), input.limit + 1])).rows;
    const nodes = rows.slice(0, input.limit);
    const currentRevision = state.project.project.revision;
    return { goalId: run.goal_id, projectId: run.scope.projectId, baseRevision: run.scope.baseRevision, currentRevision,
      stale: currentRevision !== run.scope.baseRevision, nodes, nextCursor: rows.length > input.limit ? cursor(run, nodes.at(-1)!.id) : null };
  });
}
async function grantedProposal(client: PoolClient, run: GraphRunRow, id: string) {
  const proposal = await readProposalInTransaction(client, id);
  const source: unknown = proposal.source === 'owner-submission' ? null : JSON.parse(proposal.source);
  if (!source || (source as GraphRunActor).kind !== 'goal-graph-run' || (source as GraphRunActor).runId !== run.id || proposal.goal_id !== run.goal_id || proposal.project_id !== run.scope.projectId || proposal.base_revision !== run.scope.baseRevision || proposal.goal_digest !== run.scope.goalDigest) {
    throw new HttpError(403, 'goal_graph_scope', 'The proposal is outside this graph grant.');
  }
  return proposal;
}
export function runnerDetail(pool: Pool, runnerId: string, input: GoalGraphDetailCall) {
  return withRunnerAuthority(pool, graphAuthorityStore, runnerId, input, input.grant, async (client, run) => {
    const row = await grantedProposal(client, run, input.proposalId);
    return { id: row.id, proposalDigest: row.proposal_digest, baseRevision: row.base_revision, input: row.input };
  });
}
function requireProposalScope(run: GraphRunRow, command: Extract<GoalGraphCommandCall['command'], { kind: 'propose' }>) {
  const input = command.proposal;
  if (input.inputProposal && run.scope.inputProposalProtocol !== GOAL_INPUT_PROPOSAL_PROTOCOL) {
    throw new HttpError(403, 'goal_graph_scope', 'This grant permits graph-only proposals.');
  }
  const edges = input.additions.flatMap(node => node.dependencies);
  if (input.expectedProjectRevision !== run.scope.baseRevision || input.additions.length > run.scope.maxNewNodes || edges.length > run.scope.maxNewEdges) throw new HttpError(403, 'goal_graph_scope', 'The proposal exceeds this grant.');
  for (const ref of edges) if (ref.kind === 'existing' && !run.scope.allowedExistingNodes.some(allowed => allowed.nodeId === ref.nodeId && allowed.expectedVersion === ref.expectedVersion)) throw new HttpError(403, 'goal_graph_scope', 'An existing reference is outside this grant.');
}
export function runnerCommand(pool: Pool, runnerId: string, input: GoalGraphCommandCall, key: string): Promise<GoalGraphCommandResult> {
  return withRunnerAuthority(pool, graphAuthorityStore, runnerId, input, input.grant, async (client, run) => {
    const context = await goalContext(client, run.goal_id);
    if (context.project.id !== run.scope.projectId || context.goalDigest !== run.scope.goalDigest) throw new HttpError(409, 'goal_graph_goal_changed', 'The original goal no longer matches this grant.');
    const command = input.command;
    if (command.kind === 'propose') requireProposalScope(run, command);
    else {
      if (run.scope.maxApplications === 0) throw new HttpError(403, 'goal_graph_scope', 'This grant permits proposals only.');
      const proposal = await grantedProposal(client, run, command.proposalId);
      if (command.proposalDigest !== proposal.proposal_digest || command.expectedProjectRevision !== run.scope.baseRevision) throw new HttpError(409, 'proposal_mismatch', 'Apply must name the granted proposal digest and base revision.');
    }
    const accepted = await commandInTransaction(client, `goal-graph-command:${run.id}`, key, command, async () => {
      const used = await counts(client, run.id);
      if (command.kind === 'propose' ? used.proposals >= run.scope.maxProposals : used.applications >= run.scope.maxApplications) throw new HttpError(409, 'goal_graph_limit', 'This grant has reached its command limit.');
      // CAS belongs inside the new-command branch: replay after our own apply remains recoverable.
      if (context.project.revision !== run.scope.baseRevision) throw new HttpError(409, 'stale_project_revision', 'The base graph changed; no silent rebase is allowed.');
      const actor: GraphRunActor = { kind: 'goal-graph-run', runId: run.id, runnerId, taskId: run.task_id, attemptId: input.attemptId, ownerVersion: input.ownerVersion };
      let result: Omit<Extract<GoalGraphCommandResult, { kind: 'propose' }>, 'replayed'> | Omit<Extract<GoalGraphCommandResult, { kind: 'apply' }>, 'replayed'>;
      if (command.kind === 'propose') {
        const { input: _detail, ...proposal } = await createProposalInTransaction(client, run.goal_id, command.proposal, actor);
        result = { kind: 'propose', proposal };
      } else result = { kind: 'apply', ...await applyProposalInTransaction(client, command.proposalId, command, actor) };
      const proposal = result.kind === 'propose' ? result.proposal : { id: result.receipt.proposalId, proposalDigest: result.receipt.proposalDigest };
      await client.query(`INSERT INTO flow.goal_graph_calls(run_id,sequence,runner_id,attempt_id,owner_version,command_key,digest,kind,proposal_id,proposal_digest,applied_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [run.id, run.used_commands + 1, runnerId, input.attemptId, input.ownerVersion, key, sha256(canonical(command)), command.kind, proposal.id, proposal.proposalDigest, result.kind === 'apply' ? result.receipt.toRevision : null]);
      await client.query('UPDATE flow.goal_graph_runs SET used_commands=used_commands+1 WHERE id=$1', [run.id]);
      return result;
    });
    return { ...accepted.value, replayed: accepted.replayed };
  });
}
