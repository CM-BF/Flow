import { afterAll, beforeAll, expect, test } from 'vitest';
import { TaskReadFixture } from '../../../experiments/bounded-reads/task-projections/fixture.js';
import { eventPage } from './queries.js';
import { list, loadTask } from './tasks.js';
import { randomUUID } from 'node:crypto';
import { summary, type TaskRecord } from './tasks.js';
import { transaction } from './database.js';

const fixture = new TaskReadFixture();
const legalPrompt = '界🙂'.repeat(5333); // 15,999 UTF-16 code units: within the real public POST contract.
let primaryId = '';
beforeAll(async () => {
  await fixture.start(); fixture.accountTask(legalPrompt);
  const accepted = await fixture.http('/api/tasks', { title: 'Public Unicode prompt', prompt: legalPrompt, harness: 'fixture' });
  expect(accepted.status).toBe(202); primaryId = accepted.data.task.id;
}, 20_000);
afterAll(() => fixture.close(), 15_000);

test('event reads keep public output while omitting a legal long prompt from decoded PG rows', async () => {
  const baseline = await fixture.sample('public-prompt:old-full-task-row', () => transaction(fixture.pool, client => loadTask(client, primaryId), true));
  const current = await fixture.sample('public-prompt:event-page', () => eventPage(fixture.pool, primaryId, 0));
  expect(current.value.task).toEqual({ id: primaryId, title: 'Public Unicode prompt', harness: 'fixture', status: 'queued', verificationStatus: 'pending', createdAt: baseline.value.created_at.toISOString(), updatedAt: baseline.value.updated_at.toISOString() });
  expect(current.value).toMatchObject({ entries: [], nextCursor: 0, watermark: 0, hasMore: false, pendingDecision: null });
  expect(baseline.measurement.taskFields).toContain('submission');
  expect(current.measurement.taskFields).not.toContain('submission');
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(baseline.measurement.taskRowJsonBytes - Buffer.byteLength(legalPrompt));
  expect(current.measurement.selectCalls).toBe(2);
});

test('list reads omit the legal long prompt without adding a query', async () => {
  const current = await fixture.sample('public-prompt:task-list', () => list(fixture.pool, 1));
  expect(current.value.tasks).toHaveLength(1);
  expect(current.value.tasks[0]).toMatchObject({ id: primaryId, title: 'Public Unicode prompt', harness: 'fixture' });
  expect(current.value.nextCursor).toBeNull();
  expect(current.measurement.taskFields).not.toContain('submission');
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(1024);
  expect(current.measurement.queryCalls).toBe(1);
});

test('list keyset pagination keeps timestamp ties, limits and invalid cursor rejection', async () => {
  for (const id of ['projection-a', 'projection-b', 'projection-c']) {
    fixture.accountTask('Small synthetic SQL prompt');
    await fixture.pool.query('INSERT INTO flow.tasks(id,submission,created_at,updated_at) VALUES($1,$2,$3,$3)', [id, { title: id, prompt: 'Small synthetic SQL prompt', harness: 'fixture' }, '2026-01-01T00:00:00.000Z']);
  }
  const first = await list(fixture.pool, 2);
  expect(first.tasks.map(task => task.id)).toEqual([primaryId, 'projection-c']);
  expect(JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString())).toEqual({ date: '2026-01-01T00:00:00.000Z', id: 'projection-c' });
  const second = await list(fixture.pool, 2, first.nextCursor!);
  expect(second.tasks.map(task => task.id)).toEqual(['projection-b', 'projection-a']);
  expect(second.nextCursor).toBeNull();
  for (const cursor of ['invalid', 'x'.repeat(1025), Buffer.from(JSON.stringify({ id: 'x', date: '2026-01-01' })).toString('base64url')]) {
    await expect(list(fixture.pool, 2, cursor)).rejects.toMatchObject({ status: 400, code: 'invalid_cursor' });
  }
});

test('event cursors advance over hidden stream references and retain reset and empty pages', async () => {
  const at = '2026-01-01T00:00:00.000Z';
  const rows = [
    { id: randomUUID(), cursor: 1, createdAt: at, kind: 'text', text: 'Visible' },
    { id: randomUUID(), cursor: 2, createdAt: at, kind: 'reference', reference: { id: 'hidden', title: 'Hidden stream', stream: { kind: 'assistant-stream', streamId: 'stream', revision: 1 } } },
    { id: randomUUID(), cursor: 3, createdAt: at, kind: 'text', text: 'Last' },
  ];
  for (const row of rows) await fixture.pool.query('INSERT INTO flow.timeline(task_id,cursor,entry) VALUES($1,$2,$3)', [primaryId, row.cursor, row]);
  await fixture.pool.query('UPDATE flow.tasks SET cursor=3 WHERE id=$1', [primaryId]);
  const hidden = await eventPage(fixture.pool, primaryId, 1, 1);
  expect(hidden).toMatchObject({ entries: [], nextCursor: 2, watermark: 3, hasMore: true });
  expect(await eventPage(fixture.pool, primaryId, 2, 1)).toMatchObject({ entries: [rows[2]], nextCursor: 3, watermark: 3, hasMore: false });
  expect(await eventPage(fixture.pool, primaryId, 3)).toMatchObject({ entries: [], nextCursor: 3, watermark: 3, hasMore: false });
  const reset = await fixture.sample('reset:event-page', () => eventPage(fixture.pool, primaryId, 4));
  expect(reset.value).toMatchObject({ entries: [], nextCursor: 0, watermark: 3, hasMore: false, reset: true });
  expect(reset.measurement.selectCalls).toBe(1);
  await expect(eventPage(fixture.pool, 'missing-task', 0)).rejects.toMatchObject({ status: 404, code: 'not_found', message: 'Task not found.' });
});

test('state-only changes remain visible without a new timeline entry', async () => {
  const usage = { inputTokens: 10, outputTokens: 0, costUsd: null, costKind: 'unknown', incomplete: true };
  const decision = { id: 'decision-1', prompt: 'Approve this step?' };
  await fixture.pool.query("UPDATE flow.tasks SET status='waiting',verification_status='passed',pending_decision=$2,usage=$3,updated_at=$4 WHERE id=$1", [primaryId, decision, usage, '2026-02-01T00:00:00.000Z']);
  const page = await eventPage(fixture.pool, primaryId, 3);
  expect(page).toMatchObject({ nextCursor: 3, watermark: 3, entries: [], task: { status: 'waiting', verificationStatus: 'passed', updatedAt: '2026-02-01T00:00:00.000Z' }, pendingDecision: decision, usage });
  for (const status of ['succeeded', 'uncertain'] as const) {
    await fixture.pool.query('UPDATE flow.tasks SET status=$2 WHERE id=$1', [primaryId, status]);
    expect((await eventPage(fixture.pool, primaryId, 3)).task).toEqual({ ...page.task, status });
    expect((await list(fixture.pool, 4)).tasks.find(task => task.id === primaryId)).toEqual({ ...page.task, status });
  }
});

test('public HTTP keeps snapshot prompt, owner authorization and not-found responses', async () => {
  const snapshot = await fixture.http(`/api/tasks/${primaryId}`);
  expect(snapshot.status).toBe(200); expect(snapshot.data.prompt).toBe(legalPrompt);
  expect(snapshot.data.entries.map((entry: { cursor: number }) => entry.cursor)).toEqual([1, 3]);
  const events = await fixture.http(`/api/tasks/${primaryId}/events?after=3`);
  expect(events.status).toBe(200); expect(events.data).toEqual(await eventPage(fixture.pool, primaryId, 3));
  expect(JSON.stringify(events.data)).not.toContain(legalPrompt);
  const listing = await fixture.http('/api/tasks?limit=4');
  expect(listing.status).toBe(200); expect(listing.data).toEqual(await list(fixture.pool, 4));
  const runner = await fixture.http('/api/runners', { name: 'Read role fixture', harnesses: ['fixture'], capacity: 1 });
  for (const path of ['/api/tasks', `/api/tasks/${primaryId}/events`]) {
    expect((await fixture.http(path, undefined, 'invalid')).status).toBe(401);
    expect((await fixture.http(path, undefined, runner.data.token)).status).toBe(403);
  }
  expect((await fixture.http('/api/tasks/missing-task/events')).status).toBe(404);
  expect((await fixture.http('/api/tasks?before=invalid')).status).toBe(400);
});

test('loadTask retains exclusive row locking for existing writers', async () => {
  const holder = await fixture.pool.connect(), waiter = await fixture.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await holder.query('BEGIN'); await loadTask(holder, primaryId, true);
    const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const waiterPid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending = waiter.query("UPDATE flow.tasks SET verification_status='pending' WHERE id=$1", [primaryId]);
    void pending.catch(() => {});
    let blocked = false;
    const deadline = performance.now() + 1500;
    while (performance.now() < deadline) {
      const row = (await fixture.pool.query('SELECT wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()', [waiterPid])).rows[0];
      blocked = row?.wait_event_type === 'Lock' && row.blockers.includes(holderPid);
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
    await holder.query('COMMIT'); await pending;
  } finally {
    try { await holder.query('ROLLBACK'); }
    finally { holder.release(); if (pending) await pending.catch(() => {}); waiter.release(); }
  }
});

test('synthetic over-API-limit prompt pressure remains separate from the legal public sample', async () => {
  const prompt = '🙂'.repeat(32_768); // 128KiB, intentionally SQL-seeded beyond public POST's character limit.
  fixture.accountTask(prompt);
  await fixture.pool.query('INSERT INTO flow.tasks(id,submission,created_at,updated_at) VALUES($1,$2,$3,$3)', ['projection-stress', { title: 'SQL-only stress', prompt, harness: 'fixture' }, '2025-01-01T00:00:00.000Z']);
  const old = await fixture.sample('sql-stress:old-full-task-row', () => transaction(fixture.pool, client => loadTask(client, 'projection-stress'), true));
  const event = await fixture.sample('sql-stress:event-page', () => eventPage(fixture.pool, 'projection-stress', 0));
  expect(event.value.task).toEqual(summary(old.value));
  expect(event.measurement.taskFields).not.toContain('submission');
  expect(event.measurement.taskRowJsonBytes).toBeLessThan(1024);
  const baseline = await fixture.sample('mixed-five-tasks:old-full-list-rows', () => fixture.pool.query<TaskRecord>('SELECT * FROM flow.tasks ORDER BY created_at DESC,id DESC LIMIT $1', [6]));
  const current = await fixture.sample('mixed-five-tasks:task-list', () => list(fixture.pool, 5));
  expect(current.value).toEqual({ tasks: baseline.value.rows.map(summary), nextCursor: null });
  expect(current.measurement.taskRowJsonBytes).toBeLessThan(baseline.measurement.taskRowJsonBytes - Buffer.byteLength(prompt) - Buffer.byteLength(legalPrompt));
  expect(current.measurement.queryCalls).toBe(1);
});
