import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { goalDeliveryQuerySchema, type GoalDeliveryRead } from '../../../../packages/contracts/src/goal-delivery.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { readDecision, readGoal, readInput } from './details.js';
import { readPlanMetadata } from './metadata.js';
import { planPage } from './plan.js';
import { readState } from './state.js';
import { explanationPage, readExplanation } from './explanations.js';

export function readGoalDelivery(pool: Pool, goalId: string, query: ReturnType<typeof goalDeliveryQuerySchema.parse>): Promise<GoalDeliveryRead> {
  return transaction(pool, async client => {
    if (query.view === 'explanations') return explanationPage(client, goalId, query.limit, query.after);
    if (query.view === 'explanation') return readExplanation(client, goalId, query.version);
    if (query.view === 'goal') return readGoal(client, goalId);
    if (query.view === 'input') return readInput(client, goalId, query.nodeId, query.version);
    if (query.view === 'decision') return readDecision(client, goalId, query.nodeId, query.taskId, query.decisionId);
    const plan = await readPlanMetadata(client, goalId);
    return query.view === 'plan' ? planPage(plan, query.limit, query.after) : readState(client, plan, query.nodeIds);
  }, true);
}
/** Mount before ready in the existing owner-authenticated Fastify scope; owns no resources. */
export function registerGoalDeliveryRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string } }>('/api/goals/:id/delivery', async (request, reply) => {
    const goalId = idSchema.safeParse(request.params.id); const query = goalDeliveryQuerySchema.safeParse(request.query);
    if (!goalId.success || !query.success) throw new HttpError(400, 'invalid_goal_delivery_query', 'Choose a bounded goal delivery view and exact references.');
    reply.header('Cache-Control', 'no-store');
    return readGoalDelivery(pool, goalId.data, query.data);
  });
}
