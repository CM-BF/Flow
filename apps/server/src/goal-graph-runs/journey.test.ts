import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createServer } from '../index.js';
const name = `flow_o13_list_${randomUUID().replaceAll('-', '')}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const url = new URL(adminUrl); url.pathname = '/' + name;
const admin = new Pool({ connectionString: adminUrl, max: 1, statement_timeout: 5000 });
const token = randomUUID(), marker = randomUUID(); const facts: Record<string, unknown> = { database: name, providerCalls: 0 };
let app: Awaited<ReturnType<typeof createServer>>, pool: Pool, address = '', created = false;
let goalId: string, otherGoalId: string, projectId: string, ids: string[];
const client = () => new FlowClient({ baseUrl: address, token });
async function start() { app = await createServer({ databaseUrl: url.href, ownerToken: token, automaticQueueScan: false }); address = await app.listen({ host: '127.0.0.1', port: 0 }); }
beforeAll(async () => {
  const before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; facts.before = before; expect(before).toEqual([]);
  await admin.query(`CREATE DATABASE "${name}"`); created = true; await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
  pool = new Pool({ connectionString: url.href, max: 2 }); await start();
  async function goal(label: string) { const p = await client().createProject({ workspaceId: 'personal', title: label }, randomUUID()); const g = await client().createGoal({ projectId: p.snapshot.project.id, originalGoal: 'PRIVATE_INTAKE_TEXT', constraints: 'No provider', acceptance: 'Owner reviews' }, randomUUID()); return g.goal; }
  const first = await goal('List A'); goalId = first.id; projectId = first.projectId; otherGoalId = (await goal('List B')).id;
  ids = [];
  for (let n = 0; n < 3; n++) { const r = await client().admitGoalGraphRun(goalId, { execution: { harness: 'fixture' }, prompt: 'PRIVATE_PLANNING_PROMPT', scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 } }, randomUUID()); ids.push(r.run.id); }
});
afterAll(async () => {
  try {
    await app?.close(); await pool?.end();
    if (created) { expect((await admin.query('SELECT shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [name])).rows[0].marker).toBe(marker);
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows; expect(facts.connections).toEqual([]); await admin.query(`DROP DATABASE "${name}"`); }
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; expect(facts.remaining).toEqual([]);
  } finally { await admin.end(); await writeFile(`docs/evidence/o13/list-facts-${name}.json`, JSON.stringify(facts, null, 2) + '\n'); }
});
it('public planning read is body-free, goal-bound and page-complete with the exact database timestamp cursor', async () => {
  const commandsBefore = (await pool.query('SELECT count(*)::int AS n FROM flow.commands')).rows[0].n;
  const first = await client().goalGraphRuns(goalId, { limit: 1 }); expect(first).toMatchObject({ goalId, projectId }); expect(first.runs.map(r => r.id)).toEqual([ids[2]]);
  const cursor = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString());
  const exact = (await pool.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at FROM flow.goal_graph_runs WHERE id=$1`, [ids[2]])).rows[0].at;
  expect(cursor.at).toBe(exact);
  const second = await client().goalGraphRuns(goalId, { limit: 1, after: first.nextCursor! }); const third = await client().goalGraphRuns(goalId, { limit: 1, after: second.nextCursor! });
  expect([...first.runs, ...second.runs, ...third.runs].map(r => r.id)).toEqual([...ids].reverse()); expect(third.nextCursor).toBeNull();
  for (const run of [...first.runs, ...second.runs, ...third.runs]) { expect(run.task.id).toBe((await client().goalGraphRun(run.id)).taskId); expect(run.task.harness).toBe(run.mode); expect(run).not.toHaveProperty('scope'); expect(run.task).not.toHaveProperty('prompt'); }
  const json = JSON.stringify(first); expect(json).not.toContain('PRIVATE_'); expect(Buffer.byteLength(json)).toBeLessThan(2048);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.commands')).rows[0].n).toBe(commandsBefore); facts.pageBytes = Buffer.byteLength(json); facts.ids = ids;
});
it('rejects foreign cursors, invalid bounds and runner role; empty and unknown goals remain distinct', async () => {
  const page = await client().goalGraphRuns(goalId, { limit: 1 });
  await expect(client().goalGraphRuns(otherGoalId, { after: page.nextCursor! })).rejects.toMatchObject({ status: 400 });
  for (const after of ['not-json', Buffer.from(JSON.stringify({ version: 1, goalId, at: '2026-02-30T00:00:00.000000Z', id: 'x' })).toString('base64url')]) await expect(client().goalGraphRuns(goalId, { after })).rejects.toMatchObject({ status: 400 });
  for (const limit of [0, 21, 1.5]) await expect(client().goalGraphRuns(goalId, { limit })).rejects.toMatchObject({ status: 400 });
  expect((await client().goalGraphRuns(otherGoalId)).runs).toEqual([]); await expect(client().goalGraphRuns('unknown')).rejects.toMatchObject({ status: 404 });
  const registered = await client().registerRunner({ name: 'List unauthorized runner', harnesses: ['fixture'], capacity: 1 });
  await expect(new FlowClient({ baseUrl: address, token: registered.token }).goalGraphRuns(goalId)).rejects.toMatchObject({ status: 403 });
});
it('returns current task/revocation facts after restart and keeps persisted grant association immutable', async () => {
  const run = await client().goalGraphRun(ids[0]!); await client().cancel(run.taskId, randomUUID()); await client().revokeGoalGraphRun(run.id, { reason: 'Owner stops this grant' }, randomUUID());
  await app.close(); await start(); const page = await client().goalGraphRuns(goalId); const found = page.runs.find(r => r.id === run.id)!;
  expect(found.task.status).toBe('cancelled'); expect(found.revokedAt).not.toBeNull();
  await expect(pool.query("UPDATE flow.goal_graph_runs SET scope=jsonb_set(scope,'{projectId}',to_jsonb('wrong'::text)) WHERE id=$1", [run.id])).rejects.toThrow(/immutable/);
  expect((await client().goalGraphRuns(goalId)).runs.every(r => r.goalId === goalId && r.projectId === projectId)).toBe(true);
});
