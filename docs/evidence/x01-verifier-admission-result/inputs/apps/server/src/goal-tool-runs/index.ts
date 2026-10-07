import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { ownershipSchema } from '../../../../packages/contracts/src/runner.js';
import { runnerGrant, runnerSnapshot, runnerInput, runnerCommand } from './runner.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { goalToolRunAdmissionSchema, goalToolAuditQuerySchema, goalToolRevokeSchema, goalToolRunCallSchema, goalToolInputCallSchema, goalToolCommandCallSchema } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { HttpError, transaction } from '../database.js';
import { admit, audit, getRun, revoke } from './store.js';

export async function migrateGoalToolRuns(pool: Pool) {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    for (const [version, file] of [[12, '012-goal-tool-runs.sql'], [13, '013-goal-native-mode.sql']] as const) {
      if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=$1', [version])).rowCount) continue;
      await client.query(await readFile(new URL(`../../../../packages/storage/migrations/${file}`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO flow.migrations(version) VALUES($1)', [version]);
    }
  });
}
export function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_goal_tool_request', 'Invalid goal tool request.');
  return result.data;
}
export function registerGoalToolRunRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss) {
  app.post('/api/runner/goal-tools/grant', request => runnerGrant(pool, request.runnerId!, parse(ownershipSchema, request.body)));
  app.post('/api/runner/goal-tools/snapshot', request => {
    const input = parse(goalToolRunCallSchema, request.body);
    return runnerSnapshot(pool, request.runnerId!, input, input.grant);
  });
  app.post('/api/runner/goal-tools/input', request => runnerInput(pool, request.runnerId!, parse(goalToolInputCallSchema, request.body)));
  app.post('/api/runner/goal-tools/command', request => runnerCommand(pool, boss, request.runnerId!, parse(goalToolCommandCallSchema, request.body), String(request.headers['idempotency-key'] ?? '')));
  app.post<{ Params: { id: string } }>('/api/goals/:id/tool-runs', async (request, reply) => reply.code(201).send(await admit(pool, boss, parse(idSchema, request.params.id), parse(goalToolRunAdmissionSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: { id: string } }>('/api/goal-tool-runs/:id', request => getRun(pool, parse(idSchema, request.params.id)));
  app.post<{ Params: { id: string } }>('/api/goal-tool-runs/:id/revoke', request => revoke(pool, parse(idSchema, request.params.id), parse(goalToolRevokeSchema, request.body).reason, String(request.headers['idempotency-key'] ?? '')));
  app.get<{ Params: { id: string } }>('/api/goal-tool-runs/:id/calls', request => {
    const query = parse(goalToolAuditQuerySchema, request.query);
    return audit(pool, parse(idSchema, request.params.id), query.after, query.limit);
  });
}
