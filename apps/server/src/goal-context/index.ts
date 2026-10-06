import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { goalContextDetail } from './store.js';
export { goalExecutionInputForTask, copyGoalRecoveryInput } from './store.js';
/** After migrations 6,15,18; before requests, claim or recovery processing. */
export async function migrateGoalContext(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=21')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/021-goal-context.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(21)');
  });
}
/** Register under the center's existing owner authentication; runner credentials remain forbidden. */
export function registerGoalContextRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { goalId: string; nodeId: string; version: string } }>('/api/goals/:goalId/nodes/:nodeId/inputs/:version/context', request => {
    const { goalId, nodeId, version } = request.params;
    if (!idSchema.safeParse(goalId).success || !idSchema.safeParse(nodeId).success || !/^[1-9][0-9]*$/.test(version) || !Number.isSafeInteger(Number(version)) || Number(version) > 2147483647) throw new HttpError(400, 'invalid_goal_context', 'Invalid goal input reference.');
    return goalContextDetail(pool, goalId, nodeId, Number(version));
  });
}
