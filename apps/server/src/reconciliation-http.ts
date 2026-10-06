import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { reconciliationObservationSchema, reconciliationResolutionSchema, reconciliationRetrySchema } from '@flow/contracts';
import { HttpError } from './database.js';
import { integerQuery } from './queries.js';
import { observeUncertain, reconciliation, resolveUncertain, retryReconciled } from './reconciliation.js';

export function registerReconciliation(app: FastifyInstance, pool: Pool, boss: PgBoss): void {
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>('/api/tasks/:id/reconciliation', request =>
    reconciliation(pool, request.params.id, integerQuery(request.query.after, 0, Number.MAX_SAFE_INTEGER)));
  app.post<{ Params: { id: string } }>('/api/tasks/:id/reconciliation/observations', request => {
    const parsed = reconciliationObservationSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_reconciliation', 'Invalid observation evidence.');
    return observeUncertain(pool, request.params.id, parsed.data, String(request.headers['idempotency-key'] ?? ''));
  });
  app.post<{ Params: { id: string } }>('/api/tasks/:id/reconciliation/resolve', request => {
    const parsed = reconciliationResolutionSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_reconciliation', 'Stop confirmation and reviewed side-effect evidence are required.');
    return resolveUncertain(pool, request.params.id, parsed.data, String(request.headers['idempotency-key'] ?? ''));
  });
  app.post<{ Params: { id: string } }>('/api/tasks/:id/reconciliation/retry', request => {
    const parsed = reconciliationRetrySchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_reconciliation', 'A resolution and original attempt ownership are required.');
    return retryReconciled(pool, boss, request.params.id, parsed.data, String(request.headers['idempotency-key'] ?? ''));
  });
}
