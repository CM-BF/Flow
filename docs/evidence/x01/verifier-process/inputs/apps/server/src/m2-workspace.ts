import { legacyTimelineEntries } from './assistant-stream-compatibility/index.js';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { WORKSPACE_ID, type TimelineEntry, type WorkspaceEntry, type WorkspacePage, type WorkspaceQuery, type WorkspaceTask } from '@flow/contracts';
import { HttpError, transaction } from './database.js';
import { integerQuery } from './queries.js';

const projectionLock = 'flow-workspace-projection-v1';
const batchSize = 200;

export async function migrateWorkspace(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=3')).rowCount) return;
    await client.query(`CREATE TABLE flow.workspace_feed (
      ordinal bigserial PRIMARY KEY, task_id text NOT NULL REFERENCES flow.tasks(id),
      task_cursor integer NOT NULL, task_title text NOT NULL, entry jsonb NOT NULL,
      UNIQUE(task_id,task_cursor)
    ); INSERT INTO flow.migrations(version) VALUES(3)`);
  });
}

export function registerWorkspaceRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Querystring: { after?: string; before?: string; limit?: string } }>('/api/workspace', request => {
    const { after, before, limit } = request.query;
    if (after !== undefined && before !== undefined) throw new HttpError(400, 'invalid_query', 'Choose a forward or backward cursor, not both.');
    return workspacePage(pool, {
      ...(after !== undefined ? { after: integerQuery(after, 0, Number.MAX_SAFE_INTEGER) } : {}),
      ...(before !== undefined ? { before: integerQuery(before, 0, Number.MAX_SAFE_INTEGER, 1) } : {}),
      limit: integerQuery(limit, 40, 100, 1),
    });
  });
}

async function projectCommittedEvents(pool: Pool): Promise<boolean> {
  return transaction(pool, async client => {
    // Source transactions do not acquire this lock. Only the derived feed serializes
    // cursor allocation through commit, so late source commits cannot fall behind a cursor.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [projectionLock]);
    const accepted = await client.query(`INSERT INTO flow.workspace_feed(task_id,task_cursor,task_title,entry)
      SELECT t.id,0,t.submission->>'title',jsonb_build_object(
        'id','accepted:'||t.id,'cursor',0,'createdAt',to_char(t.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'kind','text','text','Task accepted.')
      FROM flow.tasks t LEFT JOIN flow.workspace_feed f ON f.task_id=t.id AND f.task_cursor=0
      WHERE f.ordinal IS NULL ORDER BY t.created_at,t.id LIMIT $1`, [batchSize]);
    // Writers commit each task's cursors in order under its row lock, and this
    // projection inserts ordered prefixes. A per-task cursor therefore cannot
    // skip a late commit from another task; no global source watermark is used.
    const updates = await client.query(`INSERT INTO flow.workspace_feed(task_id,task_cursor,task_title,entry)
      SELECT tl.task_id,tl.cursor,t.submission->>'title',tl.entry
      FROM flow.tasks t
      JOIN LATERAL (
        SELECT task_cursor FROM flow.workspace_feed WHERE task_id=t.id ORDER BY task_cursor DESC LIMIT 1
      ) projected ON true
      JOIN LATERAL (
        SELECT task_id,cursor,entry FROM flow.timeline
        WHERE task_id=t.id AND cursor>projected.task_cursor ORDER BY cursor LIMIT $1
      ) tl ON true
      ORDER BY t.created_at,t.id,tl.cursor LIMIT $1`, [batchSize]);
    return accepted.rowCount === batchSize || updates.rowCount === batchSize;
  });
}

interface FeedRow { ordinal: string; task_id: string; task_title: string; entry: TimelineEntry }

export async function workspacePage(pool: Pool, query: WorkspaceQuery): Promise<WorkspacePage> {
  const projectionPending = await projectCommittedEvents(pool);
  return transaction(pool, async client => {
    const watermark = Number((await client.query<{ watermark: string }>('SELECT COALESCE(MAX(ordinal),0) watermark FROM flow.workspace_feed')).rows[0]!.watermark);
    if (query.after !== undefined && query.after > watermark) throw new HttpError(409, 'workspace_cursor_reset', 'The workspace cursor is no longer available; reload the workspace.');
    const forward = query.after !== undefined;
    const rows = (await client.query<FeedRow>(`SELECT ordinal,task_id,task_title,entry FROM flow.workspace_feed
      WHERE ordinal ${forward ? '>' : '<'} $1 ORDER BY ordinal ${forward ? 'ASC' : 'DESC'} LIMIT $2`,
    [forward ? query.after : query.before ?? watermark + 1, query.limit ?? 40])).rows;
    if (!forward) rows.reverse();
    const rawEntries: WorkspaceEntry[] = rows.map(row => ({ id: `workspace-${row.ordinal}`, cursor: Number(row.ordinal), task: { id: row.task_id, title: row.task_title }, entry: row.entry }));
    const nextCursor = rawEntries.at(-1)?.cursor ?? query.after ?? watermark;
    const previousCursor = rawEntries[0]?.cursor ?? query.before ?? 0;
    const hasEarlier = previousCursor > 0 && Boolean((await client.query('SELECT 1 FROM flow.workspace_feed WHERE ordinal<$1 LIMIT 1', [previousCursor])).rowCount);
    const tasks = await readWorkspaceTasks(client, false);
    const attention = await readWorkspaceTasks(client, true);
    return { workspaceId: WORKSPACE_ID, entries: legacyTimelineEntries(rawEntries, item => item.entry), nextCursor, previousCursor, watermark,
      hasMore: nextCursor < watermark, hasEarlier, projectionPending,
      tasks: tasks.slice(0, 100), tasksTruncated: tasks.length > 100,
      attention: attention.slice(0, 100), attentionTruncated: attention.length > 100 };
  }, true);
}

async function readWorkspaceTasks(client: PoolClient, attentionOnly: boolean): Promise<WorkspaceTask[]> {
  const rows = (await client.query<{
    id: string; title: string; harness: WorkspaceTask['harness']; status: WorkspaceTask['status'];
    verification_status: WorkspaceTask['verificationStatus']; created_at: Date; updated_at: Date;
    owner_version: number; pending_decision: WorkspaceTask['pendingDecision'];
  }>(`SELECT id,submission->>'title' title,submission->>'harness' harness,status,verification_status,
    created_at,updated_at,owner_version,pending_decision FROM flow.tasks
    ${attentionOnly ? "WHERE status IN ('waiting','uncertain')" : ''}
    ORDER BY updated_at DESC,id DESC LIMIT 101`)).rows;
  return rows.map(row => ({ id: row.id, title: row.title, harness: row.harness, status: row.status,
    verificationStatus: row.verification_status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    ownerVersion: row.owner_version, pendingDecision: row.pending_decision }));
}
