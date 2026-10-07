import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { GOAL_PLAN_CONFIRMATION_MAX_BYTES, goalPlanConfirmationSchema } from '../../../../packages/contracts/src/goal-plan-confirmation.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { confirmGoalPlan } from './store.js';

export async function migrateGoalPlanConfirmations(pool: Pool) {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=31')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/031-goal-plan-confirmations.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(31)');
  });
}
/** Register after the existing owner authentication hook. No runner confirmation endpoint exists. */
export function registerGoalPlanConfirmationRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss) {
  app.post<{ Params: { id: string } }>('/api/goal-graph-proposals/:id/confirm-inputs', { bodyLimit: GOAL_PLAN_CONFIRMATION_MAX_BYTES }, async request => {
    const id = idSchema.safeParse(request.params.id), input = goalPlanConfirmationSchema.safeParse(request.body);
    if (!id.success || !input.success) throw new HttpError(400, 'invalid_plan_confirmation', 'Invalid bounded plan confirmation.');
    return confirmGoalPlan(pool, boss, id.data, input.data, String(request.headers['idempotency-key'] ?? ''));
  });
}
