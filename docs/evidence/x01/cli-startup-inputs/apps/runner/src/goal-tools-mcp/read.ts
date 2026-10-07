import { createHash } from 'node:crypto';
import { z } from 'zod';
import { idSchema, type TaskSummary } from '../../../../packages/contracts/src/tasks.js';
import type { GoalNodeView, GoalSnapshot } from '../../../../packages/contracts/src/goals.js';
import { createGoalTools } from '../goal-tools/index.js';
import { ReadError } from './result.js';

const snapshotRef = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.number().int().min(1).max(2_147_483_647);
export const readRequestSchema = z.discriminatedUnion('view', [
  z.strictObject({ view: z.literal('overview'), limit: z.number().int().min(1).max(10).default(5), after: z.strictObject({ offset: z.number().int().min(1).max(199), snapshotRef }).optional() }),
  z.strictObject({ view: z.literal('goal'), snapshotRef }),
  z.strictObject({ view: z.literal('node'), snapshotRef, nodeId: idSchema }),
  z.strictObject({ view: z.literal('explanation'), snapshotRef, version }),
  z.strictObject({ view: z.literal('input'), nodeId: idSchema, version }),
]);
type Tools = ReturnType<typeof createGoalTools>;
export async function read(tools: Tools, request: z.infer<typeof readRequestSchema>): Promise<unknown> {
  if (request.view === 'input') return { definition: await tools.read({ nodeId: request.nodeId, version: request.version }) };
  const snapshot = await tools.read({}) as GoalSnapshot;
  const ref = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const expected = request.view === 'overview' ? request.after?.snapshotRef : request.snapshotRef;
  if (expected !== undefined && expected !== ref) throw new ReadError('stale_snapshot');
  if (request.view === 'overview') return overview(snapshot, ref, request.after?.offset ?? 0, request.limit);
  if (request.view === 'goal') return { snapshotRef: ref, goal: snapshot.goal };
  if (request.view === 'explanation') {
    const explanation = snapshot.explanations.find(item => item.version === request.version);
    if (!explanation) throw new ReadError('not_available');
    return { snapshotRef: ref, explanation };
  }
  const node = snapshot.nodes.find(item => item.nodeId === request.nodeId);
  if (!node) throw new ReadError('not_available');
  return { snapshotRef: ref, node: { ...nodeSummary(node, ref), dependsOn: node.dependsOn, accepted: node.accepted, reason: node.reason }, omitted: ['execution prompt; read execution inputRef for its exact input version'] };
}
function overview(snapshot: GoalSnapshot, ref: string, offset: number, limit: number) {
  const nodes = snapshot.nodes.slice(offset, offset + limit);
  const last = snapshot.explanations.at(-1);
  return {
    goalId: snapshot.goal.id, projectId: snapshot.goal.projectId, projectRevision: snapshot.projectRevision,
    snapshotRef: ref, goalRef: { view: 'goal', snapshotRef: ref },
    totalNodes: snapshot.nodes.length, nodes: nodes.map(node => nodeSummary(node, ref)),
    next: offset + nodes.length < snapshot.nodes.length ? { view: 'overview', limit, after: { offset: offset + nodes.length, snapshotRef: ref } } : null,
    explanations: { availableCount: snapshot.explanations.length, firstVersion: snapshot.explanations[0]?.version ?? null, lastVersion: last?.version ?? null, latestRef: last ? { view: 'explanation', snapshotRef: ref, version: last.version } : null, history: 'Only the current center window (at most 50) is available; older versions may be unavailable.' },
    omitted: ['original goal text', 'complete inputs', 'execution prompts', 'dependency lists', 'explanation history'],
  };
}
function nodeSummary(node: GoalNodeView, ref: string) {
  return {
    nodeId: node.nodeId, title: node.title, ref: { view: 'node', nodeId: node.nodeId, snapshotRef: ref },
    inputRef: node.definition ? { view: 'input', nodeId: node.nodeId, version: node.definition.version } : null,
    dependencyCount: node.dependsOn.length, deliveryCurrent: node.deliveryCurrent, dependenciesReady: node.dependenciesReady,
    execution: node.execution ? { id: node.execution.id, inputCurrent: node.execution.inputCurrent, inputRef: { view: 'input', nodeId: node.nodeId, version: node.execution.inputVersion }, task: taskSummary(node.execution.task) } : null,
  };
}
export function taskSummary(task: TaskSummary) {
  return { id: task.id, status: task.status, verificationStatus: task.verificationStatus, updatedAt: task.updatedAt };
}
