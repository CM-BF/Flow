import type { Pool } from 'pg';
import { legacyTimelineEntries } from './assistant-stream-compatibility/index.js';
import type { Detail, EventPage, TimelineEntry } from '@flow/contracts';
import { HttpError, transaction } from './database.js';
import { loadTask, summary } from './tasks.js';

export function integerQuery(value: string | undefined, fallback: number, maximum: number, minimum = 0): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new HttpError(400, 'invalid_query', 'Query value must be a nonnegative integer.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new HttpError(400, 'invalid_query', 'Query value is out of range.');
  return number;
}
export async function eventPage(pool: Pool, id: string, after: number, limit = 100): Promise<EventPage> {
  return transaction(pool, async client => {
    const task = await loadTask(client, id);
    const reset = after > task.cursor;
    const rows = reset ? [] : (await client.query<{ entry: TimelineEntry }>('SELECT entry FROM flow.timeline WHERE task_id=$1 AND cursor>$2 ORDER BY cursor LIMIT $3', [id, after, limit])).rows;
    const rawEntries = rows.map(row => row.entry);
    const nextCursor = reset ? 0 : rawEntries.at(-1)?.cursor ?? after;
    const entries = legacyTimelineEntries(rawEntries, entry => entry);
    return { entries, nextCursor, watermark: task.cursor, hasMore: !reset && nextCursor < task.cursor, task: summary(task), pendingDecision: task.pending_decision, usage: task.usage, ...(reset ? { reset: true } : {}) };
  }, true);
}
export async function detail(pool: Pool, id: string): Promise<Detail> {
  const row = (await pool.query<{ id: string; title: string; kind: Detail['kind']; content: string; media_type: string; artifact_version: string | null }>('SELECT id,title,kind,content,media_type,artifact_version FROM flow.details WHERE id=$1', [id])).rows[0];
  if (!row) throw new HttpError(404, 'detail_not_found', 'Detail not found.');
  return { id: row.id, title: row.title, kind: row.kind, content: row.content, mediaType: row.media_type, ...(row.artifact_version ? { artifactVersion: row.artifact_version } : {}) };
}
