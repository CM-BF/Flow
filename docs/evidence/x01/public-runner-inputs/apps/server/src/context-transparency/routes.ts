import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { loadTask } from '../tasks.js';
import { readLatestHistory } from './store.js';

/** Mount under the center's existing owner-auth preHandler; this module never exposes a runner write endpoint. */
export function registerContextHistoryRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string } }>('/api/tasks/:id/context/history', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!idSchema.safeParse(request.params.id).success || Object.keys(request.query as object).length) throw new HttpError(400, 'invalid_context_history_query', 'Select a task without additional identity parameters.');
    return transaction(pool, async client => readLatestHistory(client, await loadTask(client, request.params.id)), true);
  });
}
