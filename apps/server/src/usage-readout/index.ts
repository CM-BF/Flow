import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { UsageTotals } from '../../../../packages/contracts/src/tasks.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { USAGE_READOUT_SAMPLE_LIMIT } from '../../../../packages/contracts/src/usage-readout.js';
import { HttpError, transaction } from '../database.js';
import { projectReadout, type UsageRow } from './projection.js';

export async function readTaskUsage(pool: Pool, taskId: string) {
  return transaction(pool, async client => {
    const task = (await client.query<{ id: string; usage: UsageTotals; harness: string; resumed: boolean }>(`
      SELECT id,usage,submission->>'harness' AS harness,
        COALESCE(length(submission->>'resumeSessionId')>0,false) AS resumed FROM flow.tasks WHERE id=$1`, [taskId])).rows[0];
    if (!task) throw new HttpError(404, 'task_not_found', 'Task not found.');
    const rows = (await client.query<UsageRow>(`
      WITH selected AS MATERIALIZED (
        SELECT ordinal,stream,sample,authoritative,input_tokens,output_tokens,cost_usd,cost_kind
        FROM flow.usage_samples WHERE task_id=$1 ORDER BY ordinal LIMIT $2
      )
      SELECT s.sample,s.authoritative,s.input_tokens,s.output_tokens,s.cost_usd,s.cost_kind,
        CASE WHEN p.sample_id IS NULL THEN NULL ELSE jsonb_build_object('sample',p.sample,'sample_id',p.sample_id) END AS previous
      FROM selected s LEFT JOIN LATERAL (
        SELECT sample,sample_id FROM flow.usage_samples p
        WHERE s.authoritative AND p.authoritative AND p.stream=s.stream AND p.ordinal<s.ordinal
        ORDER BY p.ordinal DESC LIMIT 1
      ) p ON true ORDER BY s.ordinal`, [taskId, USAGE_READOUT_SAMPLE_LIMIT + 1])).rows;
    return projectReadout(task, rows);
  }, true);
}

/** Mount in the existing owner-authenticated server; the host owns pool lifetime. */
export function registerUsageReadoutRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string } }>('/api/tasks/:id/usage-readout', async (request, reply) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success || Object.keys(request.query as object).length) throw new HttpError(400, 'invalid_usage_readout', 'Choose a task without extra query parameters.');
    reply.header('Cache-Control', 'no-store');
    return readTaskUsage(pool, id.data);
  });
}
