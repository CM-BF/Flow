import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { taskIndexQuerySchema, type TaskIndexPage, type TaskIndexQuery, type TaskSummary } from '@flow/contracts';
import { canonical, HttpError, sha256, transaction } from './database.js';
import { integerQuery } from './queries.js';

interface TaskCursor { filter: string; date: string; id: string }

export function registerTaskIndexRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Querystring: { limit?: string; cursor?: string; statuses?: string; contextId?: string; updatedAfter?: string } }>('/api/task-index', request => {
    const query = request.query;
    const parsed = taskIndexQuerySchema.safeParse({ ...query, limit: integerQuery(query.limit, 40, 100, 1),
      ...(query.statuses !== undefined ? { statuses: query.statuses.split(',') } : {}) });
    if (!parsed.success) throw new HttpError(400, 'invalid_query', 'Invalid task filter or ISO UTC timestamp.');
    const input = parsed.data;
    if (input.statuses) input.statuses = [...new Set(input.statuses)].sort();
    if (input.updatedAfter) input.updatedAfter = new Date(input.updatedAfter).toISOString();
    return queryTaskIndex(pool, input);
  });
}

async function queryTaskIndex(pool: Pool, input: TaskIndexQuery): Promise<TaskIndexPage> {
  const filter = sha256(canonical({ statuses: input.statuses ?? null, contextId: input.contextId ?? null, updatedAfter: input.updatedAfter ?? null }));
  let cursor: TaskCursor | undefined;
  if (input.cursor) {
    try {
      if (input.cursor.length > 1024) throw new Error('Cursor too long');
      cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as TaskCursor;
      if (!cursor || cursor.filter !== filter || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128
        || typeof cursor.date !== 'string' || new Date(cursor.date).toISOString() !== cursor.date
        || Object.keys(cursor).sort().join(',') !== 'date,filter,id') throw new Error('Invalid cursor or changed filter');
    } catch { throw new HttpError(400, 'invalid_cursor', 'The task cursor does not match this query.'); }
  }
  return transaction(pool, async client => {
    const parameters = [input.statuses ?? null, input.contextId ?? null, input.updatedAfter ?? null];
    const where = '($1::text[] IS NULL OR status=ANY($1)) AND ($2::text IS NULL OR id=$2) AND ($3::timestamptz IS NULL OR updated_at>=$3)';
    const totalSize = Number((await client.query<{ count: string }>(`SELECT COUNT(*) count FROM flow.tasks WHERE ${where}`, parameters)).rows[0]!.count);
    const result = await client.query<{
      id: string; title: string; harness: TaskSummary['harness']; status: TaskSummary['status'];
      verification_status: TaskSummary['verificationStatus']; created_at: Date; updated_at: Date;
    }>(`SELECT id,submission->>'title' title,submission->>'harness' harness,status,verification_status,created_at,updated_at FROM flow.tasks
      WHERE ${where} AND ($4::timestamptz IS NULL OR (updated_at,id)<($4::timestamptz,$5))
      ORDER BY updated_at DESC,id DESC LIMIT $6`, [...parameters, cursor?.date ?? null, cursor?.id ?? null, (input.limit ?? 40) + 1]);
    const rows = result.rows.slice(0, input.limit ?? 40);
    const last = rows.at(-1);
    return { totalSize, tasks: rows.map(row => ({ id: row.id, title: row.title, harness: row.harness, status: row.status,
      verificationStatus: row.verification_status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() })),
    nextCursor: result.rows.length > rows.length && last ? Buffer.from(JSON.stringify({ filter, date: last.updated_at.toISOString(), id: last.id })).toString('base64url') : null };
  }, true);
}
