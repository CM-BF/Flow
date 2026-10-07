import { z } from 'zod';
import { goalArtifactBindingSchema, goalInputSchema } from '../../../contracts/src/goals.js';
import { idSchema } from '../../../contracts/src/tasks.js';
import type { GoalDeliveryRead, GoalDeliveryQuery } from '../../../contracts/src/goal-delivery.js';
import type { Detail } from '../../../contracts/src/tasks.js';
import type { GoalGraphRunPage } from '../../../contracts/src/goal-graph-runs.js';
import type { GoalBodyReference, GoalSessionPort } from './types.js';

export function checkPlanningPage(goalId: string, projectId: string, raw: unknown, limit: number): GoalGraphRunPage {
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 65_536) throw Error('Planning page exceeds its 64 KiB bound.');
  const summary = z.object({ id: idSchema, title: z.string().max(180), harness: z.enum(['fixture', 'claude']), status: z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain']), verificationStatus: z.enum(['pending', 'passed', 'failed']), createdAt: z.string(), updatedAt: z.string() });
  const page = z.object({ goalId: idSchema, projectId: idSchema, nextCursor: z.string().max(1024).nullable(), runs: z.array(z.object({
    id: idSchema, version: z.literal(1), goalId: idSchema, projectId: idSchema, goalDigest: z.string().regex(/^[a-f0-9]{64}$/), baseRevision: z.number().int().positive(),
    mode: z.enum(['fixture', 'claude']), task: summary, createdAt: z.string(), revokedAt: z.string().nullable(),
  })).max(limit) }).parse(raw);
  if (page.goalId !== goalId || page.projectId !== projectId || new Set(page.runs.map(run => run.id)).size !== page.runs.length || new Set(page.runs.map(run => run.task.id)).size !== page.runs.length || page.runs.some(run => run.goalId !== goalId || run.projectId !== projectId || run.task.harness !== run.mode)) throw Error('Planning read identity mismatch.');
  return page;
}

const version = z.number().int().positive();
const ref = z.object({ goalId: idSchema, nodeId: idSchema, version });
const explanation = z.object({ version, kind: z.enum(['created', 'define-input', 'execute', 'accept-delivery']), createdAt: z.string(), source: z.object({ projectRevision: version, nodeId: idSchema.optional(), inputVersion: version.optional(), executionId: idSchema.optional() }) });
const planNode = z.object({ id: idSchema, title: z.string().max(180), version, parentId: idSchema.nullable(), dependsOn: z.array(idSchema).max(199), inputRef: ref.nullable() });
const task = z.object({ id: idSchema, status: z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain']), verificationStatus: z.enum(['pending', 'passed', 'failed']), updatedAt: z.string(), attemptId: idSchema.nullable(), ownerVersion: z.number().int().nonnegative() });
const decisionRef = z.object({ goalId: idSchema, nodeId: idSchema, taskId: idSchema, decisionId: idSchema });
const stateNode = z.object({ nodeId: idSchema, inputRef: ref.nullable(), knowledgeCurrent: z.boolean(), dependenciesReady: z.boolean(), accepted: goalArtifactBindingSchema.nullable(), deliveryCurrent: z.boolean(), reason: z.enum(['input-undefined', 'knowledge-stale', 'dependencies-unavailable', 'execution-uncertain', 'execution-stale', 'accepted-current', 'accepted-stale', 'not-accepted']), execution: z.object({ id: idSchema, inputRef: ref, inputCurrent: z.boolean(), dependencyCount: z.number().int().min(0).max(199), task, pendingDecision: decisionRef.nullable(), artifact: goalArtifactBindingSchema.nullable() }).nullable() });
const envelope = z.discriminatedUnion('view', [
  z.object({ view: z.literal('plan'), goalId: idSchema, projectId: idSchema, projectRevision: version, planRef: z.string().regex(/^[a-f0-9]{64}$/), goalRef: z.object({ goalId: idSchema }), totalNodes: z.number().int().min(0).max(200), nodes: z.array(planNode).max(50), nextCursor: z.string().max(1024).nullable() }),
  z.object({ view: z.literal('state'), goalId: idSchema, projectId: idSchema, observedAt: z.string(), nodes: z.array(stateNode).min(1).max(50) }),
  z.object({ view: z.literal('explanations'), goalId: idSchema, throughVersion: z.number().int().nonnegative(), items: z.array(explanation.omit({ version: true }).extend({ reference: z.object({ goalId: idSchema, version }) })).max(50), nextCursor: z.string().max(1024).nullable() }),
  z.object({ view: z.literal('explanation'), reference: z.object({ goalId: idSchema, version }), explanation: explanation.extend({ text: z.string() }), historical: z.literal(true) }),
  z.object({ view: z.literal('input'), reference: ref, definition: z.object({ nodeId: idSchema, version, input: goalInputSchema, projectRevision: version, createdAt: z.string() }), currentVersion: version.nullable(), stale: z.boolean() }),
  z.object({ view: z.literal('goal'), goal: z.object({ id: idSchema, projectId: idSchema, originalGoal: z.string(), constraints: z.string(), acceptance: z.string(), createdAt: z.string() }) }),
  z.object({ view: z.literal('decision'), reference: decisionRef, prompt: z.string(), pending: z.boolean(), answer: z.enum(['approve', 'reject']).nullable() }),
]);
/** Decode identity and structural bounds; current validity continues to be a server fact. */
export function checkRead(goalId: string, query: GoalDeliveryQuery, raw: unknown): GoalDeliveryRead {
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 2_097_152) throw Error('Goal read exceeds the response bound.');
  const value = envelope.parse(raw);
  const returnedGoal = 'goalId' in value ? value.goalId : value.view === 'goal' ? value.goal.id : value.reference.goalId;
  if (value.view !== query.view || returnedGoal !== goalId) throw Error('Goal read identity mismatch.');
  if (value.view === 'plan' && (value.goalRef.goalId !== goalId || new Set(value.nodes.map(n => n.id)).size !== value.nodes.length || value.nodes.some(n => n.inputRef && (n.inputRef.goalId !== goalId || n.inputRef.nodeId !== n.id)))) throw Error('Plan identity mismatch.');
  if (value.view === 'state' && query.view === 'state') {
    const ids = value.nodes.map(n => n.nodeId);
    if (ids.length !== query.nodeIds.length || new Set(ids).size !== ids.length || ids.some(id => !query.nodeIds.includes(id))) throw Error('Observed node identity mismatch.');
    for (const n of value.nodes) {
      if ([n.inputRef, n.execution?.inputRef].some(r => r && (r.goalId !== goalId || r.nodeId !== n.nodeId))) throw Error('Input reference mismatch.');
      const d = n.execution?.pendingDecision;
      if (d && (d.goalId !== goalId || d.nodeId !== n.nodeId || d.taskId !== n.execution!.task.id)) throw Error('Decision identity mismatch.');
      if ([n.accepted, n.execution?.artifact].some(a => a && a.nodeId !== n.nodeId)) throw Error('Artifact node identity mismatch.');
    }
  }
  if (value.view === 'input' && query.view === 'input' && (value.reference.nodeId !== query.nodeId || value.reference.version !== query.version || value.definition.nodeId !== query.nodeId || value.definition.version !== query.version)) throw Error('Fixed input identity mismatch.');
  if (value.view === 'explanation' && query.view === 'explanation' && (value.reference.version !== query.version || value.explanation.version !== query.version)) throw Error('Explanation identity mismatch.');
  if (value.view === 'explanations' && (value.items.some((r, i) => r.reference.goalId !== goalId || r.reference.version > value.throughVersion || (i > 0 && r.reference.version <= value.items[i - 1]!.reference.version)))) throw Error('History identity mismatch.');
  if (value.view === 'decision' && query.view === 'decision' && (value.reference.nodeId !== query.nodeId || value.reference.taskId !== query.taskId || value.reference.decisionId !== query.decisionId)) throw Error('Decision reference mismatch.');
  // Keep optional established detail metadata (e.g. frozen knowledge context) after boundary checks.
  return raw as GoalDeliveryRead;
}
export async function readBody(client: GoalSessionPort, goalId: string, reference: GoalBodyReference, signal: AbortSignal): Promise<GoalDeliveryRead | Detail> {
  if (reference.kind !== 'artifact') { const { kind, ...fields } = reference; const query = { view: kind, ...fields } as GoalDeliveryQuery; return checkRead(goalId, query, await client.goalDelivery(goalId, query, signal)); }
  const binding = goalArtifactBindingSchema.parse(reference.binding);
  const raw = await client.detail(binding.detailId, signal);
  const detail = z.object({ id: idSchema, kind: z.literal('artifact'), artifactVersion: z.string(), content: z.string().max(1_048_576) }).parse(raw);
  const bytes = new TextEncoder().encode(detail.content);
  if (bytes.byteLength > 1_048_576 || detail.id !== binding.detailId || detail.artifactVersion !== binding.artifactVersion) throw Error('Artifact detail identity mismatch.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== binding.artifactVersion) throw Error('Artifact content digest mismatch.');
  return raw;
}
