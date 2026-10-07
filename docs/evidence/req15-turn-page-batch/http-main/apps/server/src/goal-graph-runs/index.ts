import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { FastifyInstance } from 'fastify';
import { ownershipSchema } from '../../../../packages/contracts/src/runner.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { goalGraphRunAdmissionSchema, goalGraphReadCallSchema, goalGraphDetailCallSchema, goalGraphCommandCallSchema, goalGraphRevokeSchema, goalGraphAuditQuerySchema, goalGraphRunListQuerySchema } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { HttpError, transaction } from '../database.js';
import { admit, audit, getRun, revoke, listRuns } from './store.js';
import { runnerCommand, runnerDetail, runnerGrant, runnerRead } from './runner.js';
export async function migrateGoalGraphRuns(pool: Pool) {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    for (const [version, file] of [[17, '017-goal-graph-runs.sql'], [19, '019-goal-graph-native-mode.sql']] as const) {
      if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=$1', [version])).rowCount) continue;
      await client.query(await readFile(new URL(`../../../../packages/storage/migrations/${file}`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO flow.migrations(version) VALUES($1)', [version]);
    }
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_graph_run', 'Invalid bounded graph run request.');
  return result.data;
}
export function registerGoalGraphRunRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss) {
  app.get<{ Params: { id: string } }>('/api/goals/:id/graph-runs', request => {
    const query = parse(goalGraphRunListQuerySchema, request.query);
    return listRuns(pool, parse(idSchema, request.params.id), query.after, query.limit);
  });
  app.post<{ Params: { id: string } }>('/api/goals/:id/graph-runs', async (request, reply) => reply.code(201).send(await admit(pool, boss, parse(idSchema, request.params.id), parse(goalGraphRunAdmissionSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: { id: string } }>('/api/goal-graph-runs/:id', request => getRun(pool, parse(idSchema, request.params.id)));
  app.post<{ Params: { id: string } }>('/api/goal-graph-runs/:id/revoke', request => revoke(pool, parse(idSchema, request.params.id), parse(goalGraphRevokeSchema, request.body).reason, String(request.headers['idempotency-key'] ?? '')));
  app.get<{ Params: { id: string } }>('/api/goal-graph-runs/:id/calls', request => {
    const page = parse(goalGraphAuditQuerySchema, request.query); return audit(pool, parse(idSchema, request.params.id), page.after, page.limit);
  });
  app.post('/api/runner/goal-graph/grant', request => runnerGrant(pool, request.runnerId!, parse(ownershipSchema, request.body)));
  app.post('/api/runner/goal-graph/read', request => runnerRead(pool, request.runnerId!, parse(goalGraphReadCallSchema, request.body)));
  app.post('/api/runner/goal-graph/proposal', request => runnerDetail(pool, request.runnerId!, parse(goalGraphDetailCallSchema, request.body)));
  app.post('/api/runner/goal-graph/command', { bodyLimit: 70_000 }, request => runnerCommand(pool, request.runnerId!, parse(goalGraphCommandCallSchema, request.body), String(request.headers['idempotency-key'] ?? '')));
}
