import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { FastifyInstance } from 'fastify';
import { goalCommandSchema, goalCreationSchema, goalInputQuerySchema, goalHistoryQuerySchema } from '../../../../packages/contracts/src/goals.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { changeGoal, createGoal } from './commands.js';
import { currentDeliveries, definition, executionRows, executionView, loadState, snapshot } from './state.js';

export async function migrateGoals(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT version FROM flow.migrations WHERE version=6')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/006-goals.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(6)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_goal_request', 'Invalid goal request.');
  return result.data;
}
export function registerGoalRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss): void {
  app.post('/api/goals', async (request, reply) => {
    const result = await createGoal(pool, parse(goalCreationSchema, request.body), String(request.headers['idempotency-key'] ?? ''));
    return reply.code(201).send(result);
  });
  app.get<{ Params: { id: string } }>('/api/goals/:id', request => transaction(pool, async client => {
    const state = await loadState(client, parse(idSchema, request.params.id));
    return snapshot(client, state);
  }, true));
  app.post<{ Params: { id: string } }>('/api/goals/:id/commands', request => changeGoal(pool, boss,
    parse(idSchema, request.params.id), parse(goalCommandSchema, request.body), String(request.headers['idempotency-key'] ?? '')));
  app.get<{ Params: { id: string; nodeId: string } }>('/api/goals/:id/inputs/:nodeId', request => transaction(pool, async client => {
    const goalId = parse(idSchema, request.params.id); const nodeId = parse(idSchema, request.params.nodeId);
    const query = parse(goalInputQuerySchema, request.query);
    const state = await loadState(client, goalId);
    const version = query.version ?? state.inputs.get(nodeId)?.version;
    const row = (await client.query('SELECT * FROM flow.goal_inputs WHERE goal_id=$1 AND node_id=$2 AND version=$3', [goalId, nodeId, version ?? 0])).rows[0];
    if (!row) throw new HttpError(404, 'goal_input_not_found', 'Actual input version not found.');
    return definition(row);
  }, true));
  app.get<{ Params: { id: string } }>('/api/goals/:id/executions', request => transaction(pool, async client => {
    const goalId = parse(idSchema, request.params.id); const query = parse(goalHistoryQuerySchema, request.query);
    const state = await loadState(client, goalId);
    const ids = (await client.query<{ id: string }>('SELECT id FROM flow.goal_executions WHERE goal_id=$1 AND node_id=$2 AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT $4', [goalId, query.nodeId, query.after ?? null, query.limit + 1])).rows.map(row => row.id);
    const rows = await executionRows(client, goalId, ids.slice(0, query.limit));
    rows.sort((left, right) => left.id.localeCompare(right.id));
    const validity = currentDeliveries(state);
    return { executions: rows.map(row => executionView(row, validity.isCurrent(row))), nextCursor: ids.length > query.limit ? ids[query.limit - 1]! : null };
  }, true));
}
