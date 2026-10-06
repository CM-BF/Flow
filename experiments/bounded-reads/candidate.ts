import assert from 'node:assert/strict';
import type { Pool } from 'pg';

// Candidate only: relies on per-task timeline writers committing cursors in order.
// No global source watermark, new table, writer change, or migration is proposed.
export const candidateSql = `SELECT tl.task_id,tl.cursor,t.submission->>'title',tl.entry
  FROM flow.tasks t
  JOIN LATERAL (
    SELECT task_cursor FROM flow.workspace_feed WHERE task_id=t.id ORDER BY task_cursor DESC LIMIT 1
  ) projected ON true
  JOIN LATERAL (
    SELECT task_id,cursor,entry FROM flow.timeline
    WHERE task_id=t.id AND cursor>projected.task_cursor ORDER BY cursor LIMIT $1
  ) tl ON true
  ORDER BY t.created_at,t.id,tl.cursor LIMIT $1`;

export async function compareCandidate(pool: Pool, baselineInsert: string) {
  const baselineSql = baselineInsert.slice(baselineInsert.indexOf('SELECT tl.task_id'));
  assert(baselineSql.startsWith('SELECT tl.task_id'), 'Capture the real source query, not a copied baseline');
  const baseline = await pool.query(baselineSql, [200]);
  const candidate = await pool.query(candidateSql, [200]);
  assert.deepEqual(candidate.rows, baseline.rows, 'Candidate must preserve the current batch/order/content');
  const plan = (await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${candidateSql}`, [200])).rows[0]['QUERY PLAN'][0];
  return { matchedRows: baseline.rows.length, sql: candidateSql, plan,
    limitation: 'Synthetic contiguous per-task histories only; production late-commit and 201-task regressions still required before a product fix' };
}
