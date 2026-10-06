import type { GraphRunActor, ProjectActor } from '../../../../packages/contracts/src/projects.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { MAX_GRAPH_PROPOSAL_BYTES, type GoalGraphProposal, type GoalGraphProposalSummary, type GoalGraphProposalInput, type GoalGraphProposalApply, type GoalGraphProposalReceipt } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { commandInTransaction } from '../tasks.js';
import { loadProject, readProject } from '../projects/storage.js';
import { applyProjectCommand } from '../projects/commands.js';
import { assemble, validateGraph } from './graph.js';

interface ProposalRow {
  id: string; goal_id: string; project_id: string; base_revision: number; goal_digest: string; proposal_digest: string;
  input: GoalGraphProposalInput; source: string; node_count: number; edge_count: number; created_at: Date;
  applied_revision: number | null;
}
interface ApplicationRow { proposal_id: string; project_id: string; from_revision: number; to_revision: number; node_ids: Record<string, string>; actor: string; applied_at: Date }
function summary(row: ProposalRow): GoalGraphProposalSummary {
  return { id: row.id, goalId: row.goal_id, projectId: row.project_id, baseRevision: row.base_revision,
    goalDigest: row.goal_digest, proposalDigest: row.proposal_digest, source: row.source === 'owner-submission' ? { kind: 'owner-submission' } : JSON.parse(row.source) as GraphRunActor, createdAt: row.created_at.toISOString(),
    nodeCount: row.node_count, edgeCount: row.edge_count, state: row.applied_revision === null ? 'proposed' : 'applied', appliedRevision: row.applied_revision };
}
function detail(row: ProposalRow): GoalGraphProposal { return { ...summary(row), input: row.input }; }
export async function goalContext(client: PoolClient, goalId: string, lock = false) {
  const goal = (await client.query<{ id: string; project_id: string; original: unknown }>('SELECT id,project_id,original FROM flow.goals WHERE id=$1', [goalId])).rows[0];
  if (!goal) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
  const project = await loadProject(client, goal.project_id, lock);
  return { goal, project, goalDigest: sha256(canonical({ goalId: goal.id, projectId: goal.project_id, original: goal.original })) };
}
export async function readProposalInTransaction(client: PoolClient, id: string): Promise<ProposalRow> {
  const row = (await client.query<ProposalRow>(`SELECT p.*,a.to_revision AS applied_revision FROM flow.goal_graph_proposals p
    LEFT JOIN flow.goal_graph_applications a ON a.proposal_id=p.id WHERE p.id=$1`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'graph_proposal_not_found', 'Graph proposal not found.');
  return row;
}
/** Authoritative mutation only; caller owns authorization, transaction and idempotency. */
export async function createProposalInTransaction(client: PoolClient, goalId: string, input: GoalGraphProposalInput, source?: GraphRunActor) {
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_GRAPH_PROPOSAL_BYTES) throw new HttpError(413, 'proposal_too_large', 'The proposal exceeds 64 KiB; nothing was truncated.');
  const context = await goalContext(client, goalId, true);
  if (context.project.revision !== input.expectedProjectRevision) throw new HttpError(409, 'stale_project_revision', 'Refresh the project before proposing a graph.');
  const current = await readProject(client, context.project.id);
  await validateGraph(input, current.graph.nodes);
  const digest = sha256(canonical({ goalId, projectId: context.project.id, goalDigest: context.goalDigest, input, ...(source ? { source } : {}) }));
  const id = randomUUID();
  await client.query(`INSERT INTO flow.goal_graph_proposals(id,goal_id,project_id,base_revision,goal_digest,proposal_digest,input,source,node_count,edge_count)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, goalId, context.project.id, input.expectedProjectRevision, context.goalDigest, digest, input,
    source ? JSON.stringify(source) : 'owner-submission', input.additions.length, input.additions.reduce((sum, node) => sum + node.dependencies.length, 0)]);
  return detail(await readProposalInTransaction(client, id));
}
export function createProposal(pool: Pool, goalId: string, input: GoalGraphProposalInput, key: string) {
  return transaction(pool, async client => {
    await goalContext(client, goalId, true);
    const accepted = await commandInTransaction(client, `graph-proposal:create:${goalId}`, key, input, () => createProposalInTransaction(client, goalId, input));
    return { proposal: accepted.value, replayed: accepted.replayed };
  });
}
export function readProposal(pool: Pool, id: string) { return transaction(pool, async client => detail(await readProposalInTransaction(client, id)), true); }
export function listProposals(pool: Pool, goalId: string, after: string | undefined, limit: number) {
  return transaction(pool, async client => {
    await goalContext(client, goalId);
    // Explicit columns keep proposal text out of the list query and response.
    const rows = (await client.query<ProposalRow>(`SELECT p.id,p.goal_id,p.project_id,p.base_revision,p.goal_digest,p.proposal_digest,p.source,p.node_count,p.edge_count,p.created_at,a.to_revision AS applied_revision
      FROM flow.goal_graph_proposals p LEFT JOIN flow.goal_graph_applications a ON a.proposal_id=p.id
      WHERE p.goal_id=$1 AND ($2::text IS NULL OR p.id>$2) ORDER BY p.id LIMIT $3`, [goalId, after ?? null, limit + 1])).rows;
    const proposals = rows.slice(0, limit).map(summary);
    return { proposals, nextCursor: rows.length > limit ? proposals.at(-1)!.id : null };
  }, true);
}
function receipt(proposal: ProposalRow, application: ApplicationRow): GoalGraphProposalReceipt {
  return { proposalId: proposal.id, goalId: proposal.goal_id, projectId: proposal.project_id, proposalDigest: proposal.proposal_digest,
    fromRevision: application.from_revision, toRevision: application.to_revision, nodeIds: application.node_ids,
    actor: application.actor === 'owner' ? { kind: 'owner' } : JSON.parse(application.actor) as GraphRunActor, appliedAt: application.applied_at.toISOString() };
}
/** All paths lock project before proposal; no command cache or separate transaction here. */
export async function applyProposalInTransaction(client: PoolClient, id: string, input: GoalGraphProposalApply, actor: ProjectActor = { kind: 'owner' }) {
  const found = await readProposalInTransaction(client, id);
  const context = await goalContext(client, found.goal_id, true);
  await client.query('SELECT id FROM flow.goal_graph_proposals WHERE id=$1 FOR UPDATE', [id]);
  const proposal = await readProposalInTransaction(client, id);
  if (input.expectedProjectRevision !== proposal.base_revision || input.proposalDigest !== proposal.proposal_digest) throw new HttpError(409, 'proposal_mismatch', 'Apply must name the saved proposal digest and base revision.');
  const existing = (await client.query<ApplicationRow>('SELECT * FROM flow.goal_graph_applications WHERE proposal_id=$1', [id])).rows[0];
  if (existing) return { receipt: receipt(proposal, existing), alreadyApplied: true };
  if (context.project.id !== proposal.project_id || context.goalDigest !== proposal.goal_digest) throw new HttpError(409, 'proposal_goal_changed', 'The proposal no longer matches the goal.');
  if (context.project.revision !== proposal.base_revision) throw new HttpError(409, 'stale_project_revision', 'The project changed; save a new proposal instead of rebasing silently.');
  const current = await readProject(client, context.project.id);
  let revision = context.project.revision;
  const applied = await assemble(proposal.input, current.graph.nodes, async change => {
    const result = await applyProjectCommand(client, context.project.id, { expectedRevision: revision, reason: `Apply goal graph proposal ${id}`, change }, actor);
    revision = result.snapshot.project.revision;
    return { nodes: result.snapshot.graph.nodes, changedNodeId: result.changedNodeId! };
  });
  const saved = (await client.query<ApplicationRow>(`INSERT INTO flow.goal_graph_applications(proposal_id,project_id,from_revision,to_revision,node_ids,actor)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [id, context.project.id, proposal.base_revision, revision, applied.nodeIds, actor.kind === 'owner' ? 'owner' : JSON.stringify(actor)])).rows[0]!;
  return { receipt: receipt(proposal, saved), alreadyApplied: false };
}
export function applyProposal(pool: Pool, id: string, input: GoalGraphProposalApply, key: string) {
  return transaction(pool, async client => {
    const found = await readProposalInTransaction(client, id);
    await goalContext(client, found.goal_id, true);
    await client.query('SELECT id FROM flow.goal_graph_proposals WHERE id=$1 FOR UPDATE', [id]);
    if (input.expectedProjectRevision !== found.base_revision || input.proposalDigest !== found.proposal_digest) throw new HttpError(409, 'proposal_mismatch', 'Apply must name the saved proposal digest and base revision.');
    const accepted = await commandInTransaction(client, `graph-proposal:apply:${id}`, key, input, () => applyProposalInTransaction(client, id, input));
    return { ...accepted.value, replayed: accepted.replayed };
  });
}
