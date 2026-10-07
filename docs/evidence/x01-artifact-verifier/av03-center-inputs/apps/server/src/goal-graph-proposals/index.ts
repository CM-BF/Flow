import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { MAX_GRAPH_PROPOSAL_BYTES, goalGraphProposalInputSchema, goalGraphProposalApplySchema, goalGraphProposalPageSchema } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { HttpError, transaction } from '../database.js';
import { createProposal, readProposal, listProposals, applyProposal } from './store.js';

export async function migrateGoalGraphProposals(pool: Pool) {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=14')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/014-goal-graph-proposals.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(14)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_graph_proposal', 'Invalid bounded graph proposal request.');
  return result.data;
}
export function registerGoalGraphProposalRoutes(app: FastifyInstance, pool: Pool) {
  app.post<{ Params: { id: string } }>('/api/goals/:id/graph-proposals', { bodyLimit: MAX_GRAPH_PROPOSAL_BYTES }, async (request, reply) =>
    reply.code(201).send(await createProposal(pool, parse(idSchema, request.params.id), parse(goalGraphProposalInputSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: { id: string } }>('/api/goals/:id/graph-proposals', request => {
    const page = parse(goalGraphProposalPageSchema, request.query);
    return listProposals(pool, parse(idSchema, request.params.id), page.after, page.limit);
  });
  app.get<{ Params: { id: string } }>('/api/goal-graph-proposals/:id', request => readProposal(pool, parse(idSchema, request.params.id)));
  app.post<{ Params: { id: string } }>('/api/goal-graph-proposals/:id/apply', request => applyProposal(pool, parse(idSchema, request.params.id), parse(goalGraphProposalApplySchema, request.body), String(request.headers['idempotency-key'] ?? '')));
}
