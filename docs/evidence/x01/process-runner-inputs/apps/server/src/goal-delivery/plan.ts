import type { GoalDeliveryPlan, GoalInputReference, GoalPlanNode } from '../../../../packages/contracts/src/goal-delivery.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { canonical, HttpError, sha256 } from '../database.js';
import type { PlanMetadata } from './metadata.js';

export function inputReference(plan: PlanMetadata, nodeId: string, version?: number): GoalInputReference | null {
  const value = version ?? plan.inputs.get(nodeId)?.version;
  return value === undefined ? null : { goalId: plan.goalId, nodeId, version: value };
}
function decodeCursor(value: unknown): [1, string, string, string] {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== 1 || !idSchema.safeParse(value[1]).success
    || typeof value[2] !== 'string' || !/^[a-f0-9]{64}$/.test(value[2]) || !idSchema.safeParse(value[3]).success) throw new Error('Invalid cursor');
  return value as [1, string, string, string];
}
export function planPage(plan: PlanMetadata, limit: number, after?: string): GoalDeliveryPlan {
  const nodes: GoalPlanNode[] = plan.nodes.map(node => ({ id: node.id, title: node.title, version: node.version, parentId: node.parentId, dependsOn: [...node.dependsOn].sort(), inputRef: inputReference(plan, node.id) })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const planRef = sha256(canonical({ goalId: plan.goalId, projectId: plan.projectId, nodes }));
  let start = 0;
  if (after) {
    let parsed;
    try { parsed = decodeCursor(JSON.parse(Buffer.from(after, 'base64url').toString('utf8'))); }
    catch { throw new HttpError(400, 'goal_plan_cursor', 'Invalid goal plan cursor.'); }
    if (parsed[1] !== plan.goalId) throw new HttpError(400, 'goal_plan_cursor', 'The cursor belongs to a different goal.');
    if (parsed[2] !== planRef) throw new HttpError(409, 'stale_goal_plan', 'Plan or input identities changed; reload plan metadata.');
    const index = nodes.findIndex(node => node.id === parsed[3]);
    if (index < 0) throw new HttpError(400, 'goal_plan_cursor', 'The cursor does not name a plan node.');
    start = index + 1;
  }
  const page = nodes.slice(start, start + limit);
  const nextCursor = start + page.length < nodes.length ? Buffer.from(JSON.stringify([1, plan.goalId, planRef, page.at(-1)!.id])).toString('base64url') : null;
  return { view: 'plan', goalId: plan.goalId, projectId: plan.projectId, projectRevision: plan.projectRevision, planRef, goalRef: { goalId: plan.goalId }, totalNodes: nodes.length, nodes: page, nextCursor };
}
