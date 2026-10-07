import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { goalProgressionAuthorizationSchema, goalProgressionRevocationSchema, GOAL_PROGRESSION_MAX_BYTES } from '../../../../packages/contracts/src/goal-progression.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { authorizeProgression, getProgression, revokeProgression } from './store.js';
export { scanGoalProgressions } from './advance.js';

export async function migrateGoalProgressions(pool: Pool) {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=30')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/030-goal-progression.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(30)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_goal_progression', 'Invalid bounded progression request.');
  return result.data;
}
export function registerGoalProgressionRoutes(app: FastifyInstance, pool: Pool) {
  type Params = { id: string; progressionId: string };
  app.post<{ Params: { id: string } }>('/api/goals/:id/progressions', { bodyLimit: GOAL_PROGRESSION_MAX_BYTES }, async (request, reply) =>
    reply.code(201).send(await authorizeProgression(pool, parse(idSchema, request.params.id), parse(goalProgressionAuthorizationSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: Params }>('/api/goals/:id/progressions/:progressionId', request => getProgression(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.progressionId)));
  app.post<{ Params: Params }>('/api/goals/:id/progressions/:progressionId/revoke', request => revokeProgression(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.progressionId), parse(goalProgressionRevocationSchema, request.body).reason, String(request.headers['idempotency-key'] ?? '')));
}
