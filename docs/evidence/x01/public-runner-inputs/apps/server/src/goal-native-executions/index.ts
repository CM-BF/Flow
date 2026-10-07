import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { goalNativeExecutionSchema } from '../../../../packages/contracts/src/goal-native-executions.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError } from '../database.js';
import { admitGoalNativeExecution } from './store.js';

export function registerGoalNativeExecutionRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss): void {
  app.post<{ Params: { id: string } }>('/api/goals/:id/native-executions', async (request, reply) => {
    const goalId = idSchema.safeParse(request.params.id);
    const input = goalNativeExecutionSchema.safeParse(request.body);
    if (!goalId.success || !input.success) throw new HttpError(400, 'invalid_native_goal_execution', 'Select a fixed goal input and readonly execution profile.');
    const result = await admitGoalNativeExecution(pool, boss, goalId.data, input.data, String(request.headers['idempotency-key'] ?? ''));
    return reply.code(201).send(result);
  });
}
