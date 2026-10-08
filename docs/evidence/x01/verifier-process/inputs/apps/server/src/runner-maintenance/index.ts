import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { runnerMaintenanceCommandSchema } from '../../../../packages/contracts/src/runner-maintenance.js';
import { HttpError, transaction } from '../database.js';
import { commandRunnerMaintenance, readRunnerMaintenance, readRunnerMaintenanceHistory } from './store.js';
export { commandRunnerMaintenance, readRunnerMaintenance, readRunnerMaintenanceHistory } from './store.js';

export async function migrateRunnerMaintenance(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SET LOCAL lock_timeout='500ms'; SET LOCAL statement_timeout='2s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=16')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/016-runner-maintenance.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(16)');
  });
}
export function registerRunnerMaintenanceRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string } }>('/api/runners/:id/maintenance', request => readRunnerMaintenance(pool, request.params.id));
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>('/api/runners/:id/maintenance/history', request => readRunnerMaintenanceHistory(pool, request.params.id, request.query.after));
  for (const action of ['drain', 'resume'] as const) {
    app.post<{ Params: { id: string } }>(`/api/runners/:id/maintenance/${action}`, request => {
      const input = runnerMaintenanceCommandSchema.safeParse(request.body);
      if (!input.success) throw new HttpError(400, 'maintenance_input', 'Invalid maintenance command.');
      return commandRunnerMaintenance(pool, request.params.id, action, input.data, String(request.headers['idempotency-key'] ?? ''), 'owner-http');
    });
  }
}
