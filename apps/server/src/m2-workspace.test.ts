import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeEach, afterEach, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ClaimedTask, WorkspacePage } from '@flow/contracts';
import { createServer } from './index.js';

const databaseUrl = process.env.FLOW_M02_DATABASE_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_m02';
const database = new URL(databaseUrl);
if (database.pathname !== '/flow_m02' || database.hostname !== '127.0.0.1' || database.port !== '55432') throw new Error('M02 tests require isolated local flow_m02.');
const ownerToken = 'm02-owner-test';
const headers = { authorization: `Bearer ${ownerToken}` };
let server: FastifyInstance;
let pool: Pool;
const get = (path = '/api/workspace') => server.inject({ method: 'GET', url: path, headers });
const submit = (title: string) => server.inject({ method: 'POST', url: '/api/tasks', headers: { ...headers, 'idempotency-key': randomUUID() }, payload: { title, prompt: 'Keep full task material out of the shared feed.', harness: 'fixture' } });

beforeEach(async () => {
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE');
  server = await createServer({ databaseUrl, ownerToken });
});
afterEach(async () => { await server?.close(); await pool?.end(); });

it('shows accepted tasks together through a durable lightweight workspace page', async () => {
  const first = (await submit('Review release notes')).json().task;
  const second = (await submit('Verify package')).json().task;
  const response = await get();
  expect(response.statusCode).toBe(200);
  const page = response.json<WorkspacePage>();
  expect(page.workspaceId).toBe('personal');
  expect(page.entries.map(item => item.task.id).sort()).toEqual([first.id, second.id].sort());
  expect(page.tasks.map(item => item.id).sort()).toEqual([first.id, second.id].sort());
  expect(response.body).not.toContain('Keep full task material');
  const after = await get(`/api/workspace?after=${page.nextCursor}`);
  expect(after.json().entries).toEqual([]);
  await server.close();
  server = await createServer({ databaseUrl, ownerToken });
  expect((await get()).json().entries).toEqual(page.entries);
  expect((await server.inject({ method: 'GET', url: '/api/workspace' })).statusCode).toBe(401);
});

it('delivers a late source commit after the observer already passed a newer committed source', async () => {
  const first = (await submit('Earlier transaction')).json().task;
  const second = (await submit('Later transaction')).json().task;
  const initial = (await get()).json<WorkspacePage>();
  const a = await pool.connect();
  const b = await pool.connect();
  const entryA = { id: randomUUID(), cursor: 1, createdAt: '2026-10-06T00:00:00.000Z', kind: 'text', text: 'A committed last' };
  const entryB = { id: randomUUID(), cursor: 1, createdAt: '2026-10-06T00:00:01.000Z', kind: 'reference', reference: { id: 'artifact-b', title: 'Verified result' } };
  try {
    await a.query('BEGIN');
    await a.query('INSERT INTO flow.timeline(task_id,cursor,entry) VALUES($1,1,$2)', [first.id, entryA]);
    await b.query('BEGIN');
    await b.query('INSERT INTO flow.timeline(task_id,cursor,entry) VALUES($1,1,$2)', [second.id, entryB]);
    await b.query('COMMIT');
    const observedB = (await get(`/api/workspace?after=${initial.nextCursor}`)).json<WorkspacePage>();
    expect(observedB.entries.map(item => item.entry.id)).toEqual([entryB.id]);
    await a.query('COMMIT');
    const observedA = (await get(`/api/workspace?after=${observedB.nextCursor}`)).json<WorkspacePage>();
    expect(observedA.entries.map(item => item.entry.id)).toEqual([entryA.id]);
    expect(observedA.entries[0]!.cursor).toBeGreaterThan(observedB.entries[0]!.cursor);
    expect(observedB.entries[0]!.entry).toEqual(entryB);
    const reconnected = (await get(`/api/workspace?after=${initial.nextCursor}`)).json<WorkspacePage>();
    expect(reconnected.entries.map(item => item.entry.id)).toEqual([entryB.id, entryA.id]);
  } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release(); }
});

it('paginates both directions and serializes concurrent projection without duplicate source events', async () => {
  for (let i = 0; i < 7; i++) await submit(`Task ${i}`);
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => get('/api/workspace?after=0&limit=3')));
  const first = concurrent[0]!.json<WorkspacePage>();
  for (const response of concurrent) expect(response.json().entries).toEqual(first.entries);
  expect(first.entries).toHaveLength(3);
  expect(first.hasMore).toBe(true);
  const second = (await get(`/api/workspace?after=${first.nextCursor}&limit=3`)).json<WorkspacePage>();
  const third = (await get(`/api/workspace?after=${second.nextCursor}&limit=3`)).json<WorkspacePage>();
  const all = [...first.entries, ...second.entries, ...third.entries];
  expect(new Set(all.map(item => item.entry.id)).size).toBe(7);
  expect(third.hasMore).toBe(false);
  expect((await get(`/api/workspace?before=${second.previousCursor}&limit=3`)).json().entries).toEqual(first.entries);
  expect((await get('/api/workspace?after=1&before=2')).statusCode).toBe(400);
  expect((await get('/api/workspace?limit=101')).statusCode).toBe(400);
  expect((await get('/api/workspace?after=999999')).statusCode).toBe(409);
});

it('projects acceptance before output across the 200-task batch boundary without losing events', async () => {
  let lastTaskId = '';
  for (let i = 0; i < 201; i++) lastTaskId = (await submit(`Batch task ${i}`)).json().task.id;
  const output = { id: randomUUID(), cursor: 1, createdAt: new Date().toISOString(), kind: 'text', text: 'Output from the last task' };
  await pool.query('INSERT INTO flow.timeline(task_id,cursor,entry) VALUES($1,1,$2)', [lastTaskId, output]);
  const first = (await get('/api/workspace?after=0&limit=100')).json<WorkspacePage>();
  expect(first.watermark).toBe(200);
  expect(first.projectionPending).toBe(true);
  const second = (await get(`/api/workspace?after=${first.nextCursor}&limit=100`)).json<WorkspacePage>();
  const third = (await get(`/api/workspace?after=${second.nextCursor}&limit=100`)).json<WorkspacePage>();
  const all = [...first.entries, ...second.entries, ...third.entries];
  expect(all).toHaveLength(202);
  expect(new Set(all.map(item => item.entry.id)).size).toBe(202);
  const lastTaskEvents = all.filter(item => item.task.id === lastTaskId);
  expect(lastTaskEvents.map(item => item.entry.id)).toEqual([`accepted:${lastTaskId}`, output.id]);
  expect(lastTaskEvents[0]!.cursor).toBeLessThan(lastTaskEvents[1]!.cursor);
  expect(third.hasMore).toBe(false);
});

it('exposes ten task decisions together and rejects a stale decision after cancellation', async () => {
  const post = (url: string, payload: object, token = ownerToken) => server.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() } });
  const runner = (await post('/api/runners', { name: 'M02 protocol test runner', harnesses: ['fixture'], capacity: 10 })).json();
  for (let i = 0; i < 10; i++) await submit(`Independent task ${i}`);
  const assignments: ClaimedTask[] = [];
  for (let i = 0; i < 10; i++) {
    let assignment: ClaimedTask | null = null;
    await expect.poll(async () => {
      assignment = (await post('/api/runner/claim', {}, runner.token)).json().assignment;
      return assignment;
    }).toBeTruthy();
    assignments.push(assignment!);
    const { attempt } = assignment!;
    const reported = await post('/api/runner/events', { attemptId: attempt.id, ownerVersion: attempt.ownerVersion, events: [{ id: randomUUID(), sequence: 1, type: 'decision', decisionId: `decision-${i}`, prompt: `Approve the action for task ${i}?` }] }, runner.token);
    expect(reported.statusCode).toBe(200);
  }
  const page = (await get()).json<WorkspacePage>();
  expect(page.attention).toHaveLength(10);
  expect(page.attentionTruncated).toBe(false);
  expect(new Set(page.attention.map(task => task.pendingDecision?.id)).size).toBe(10);
  const first = assignments[0]!.task.id;
  const second = assignments[1]!.task.id;
  expect((await post(`/api/tasks/${first}/decision`, { decisionId: 'decision-0', answer: 'approve' })).statusCode).toBe(200);
  expect((await post(`/api/tasks/${second}/cancel`, {})).statusCode).toBe(200);
  const stale = await post(`/api/tasks/${second}/decision`, { decisionId: 'decision-1', answer: 'approve' });
  expect(stale.statusCode).toBe(409);
  const refreshed = (await get(`/api/workspace?after=${page.nextCursor}`)).json<WorkspacePage>();
  expect(refreshed.attention).toHaveLength(8);
  expect(refreshed.tasks.find(task => task.id === second)?.status).toBe('cancel_requested');
  expect((await server.inject({ method: 'GET', url: '/api/workspace', headers: { authorization: `Bearer ${runner.token}` } })).statusCode).toBe(403);
});

it('provides an authorized updated-order task index with exact filtered totals and bound cursors', async () => {
  const a = (await submit('Old task')).json().task;
  const b = (await submit('Middle task')).json().task;
  const c = (await submit('Newest task')).json().task;
  await pool.query("UPDATE flow.tasks SET updated_at='2026-10-06T00:00:00Z' WHERE id=$1", [a.id]);
  await pool.query("UPDATE flow.tasks SET updated_at='2026-10-06T00:01:00Z' WHERE id=$1", [b.id]);
  await pool.query("UPDATE flow.tasks SET updated_at='2026-10-06T00:02:00Z',status='cancelled' WHERE id=$1", [c.id]);
  const first = (await get('/api/task-index?limit=1')).json();
  expect(first.totalSize).toBe(3);
  expect(first.tasks.map((task: { id: string }) => task.id)).toEqual([c.id]);
  const second = (await get(`/api/task-index?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
  expect(second.totalSize).toBe(3);
  expect(second.tasks.map((task: { id: string }) => task.id)).toEqual([b.id, a.id]);
  expect(second.nextCursor).toBeNull();
  const filtered = (await get('/api/task-index?statuses=queued&updatedAfter=2026-10-06T00%3A00%3A30Z')).json();
  expect(filtered.totalSize).toBe(1);
  const inclusive = (await get('/api/task-index?statuses=queued&updatedAfter=2026-10-06T00%3A01%3A00Z')).json();
  expect(inclusive.tasks.map((task: { id: string }) => task.id)).toEqual([b.id]);
  expect(filtered.tasks[0].id).toBe(b.id);
  expect((await get(`/api/task-index?contextId=${a.id}`)).json().totalSize).toBe(1);
  expect((await get(`/api/task-index?statuses=queued&cursor=${encodeURIComponent(first.nextCursor)}`)).statusCode).toBe(400);
  expect((await get('/api/task-index?statuses=not-a-state')).statusCode).toBe(400);
  expect((await get('/api/task-index?updatedAfter=bad-date')).statusCode).toBe(400);
  expect((await server.inject({ method: 'GET', url: '/api/task-index' })).statusCode).toBe(401);
  expect(JSON.stringify(first)).not.toContain('Keep full task material');
});
