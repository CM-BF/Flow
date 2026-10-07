import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ConversationQueueItem } from '../../../../packages/contracts/src/conversation-queue.js';
import { createServer } from '../index.js';
import { migrateConversationQueue, registerConversationQueueRoutes, promoteReady, scanConversationQueue } from './index.js';

const databaseName = `flow_chat04_${process.pid}_${randomUUID().slice(0, 8)}`;
const localAdmin = process.env.FLOW_CHAT04_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = new URL(localAdmin); databaseUrl.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: localAdmin, max: 1 });
const ownerToken = randomUUID();
let created = false;
let pool: Pool;
let boss: PgBoss;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
const startedAt = new Date().toISOString();
async function start() {
  const options = { databaseUrl: databaseUrl.href, ownerToken, automaticQueueScan: false };
  server = await createServer(options);
  await migrateConversationQueue(pool);
  if (!server.hasRoute({ method: 'POST', url: '/api/conversations/:id/queue' })) registerConversationQueueRoutes(server, pool, boss);
  server.addHook('onSend', async (request, reply, payload) => {
    if (request.headers['x-chat04-drop-ack'] === 'yes' && [200, 202].includes(reply.statusCode)) reply.raw.destroy();
    return payload;
  });
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function request(path: string, body?: unknown, key = randomUUID()) {
  const response = await fetch(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return { status: response.status, body: await response.json() };
}
async function conversation() {
  const result = await request('/api/conversations', { title: 'Queue test' });
  expect(result.status).toBe(201);
  return result.body.conversation;
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw new Error('Refusing existing test database.');
  await writeFile(new URL('../../../../docs/evidence/chat04/latest-resource.json', import.meta.url), JSON.stringify({ databaseName, startedAt }));
  await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
  pool = new Pool({ connectionString: databaseUrl.href, max: 10, statement_timeout: 5000 });
  boss = new PgBoss({ connectionString: databaseUrl.href, max: 2 });
  boss.on('error', error => console.error('CHAT04 scheduler:', error.message));
  await boss.start();
  await start();
});
afterAll(async () => {
  try {
    await server?.close();
    await boss?.stop({ graceful: true, timeout: 5000 });
    await pool?.end();
    if (created) {
      const deadline = performance.now() + 5000;
      while (Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count)) {
        if (performance.now() > deadline) throw new Error('Own database still has live connections.');
        await delay(25);
      }
      await admin.query(`DROP DATABASE "${databaseName}"`);
    }
    const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
    await writeFile(new URL('../../../../docs/evidence/chat04/latest-cleanup.json', import.meta.url), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), databaseName, remaining }, null, 2));
  } finally { await admin.end(); }
});
it('skips more than a default batch of paused queues without rotating them and scans again after explicit resume', async () => {
  const paused: { id: string; itemId: string }[] = [];
  for (let index = 0; index < 21; index += 1) {
    const c = await conversation();
    const item = await enqueueItem(c.id, 0, `Paused scan ${index}`);
    expect((await request(`/api/conversations/${c.id}/queue/pause`, { expectedQueueRevision: 1 })).status).toBe(200);
    paused.push({ id: c.id, itemId: item.item.id });
  }
  const ready = await conversation();
  const waiting = await enqueueItem(ready.id, 0, 'Ready behind paused queues');
  // Paused candidates sort first even when their random UUIDs do not.
  await pool.query("UPDATE flow.conversations SET queue_checked_at='2000-01-01' WHERE id=$1", [ready.id]);
  const pausedIds = paused.map(item => item.id);
  const pausedState = () => pool.query(`SELECT id,queue_checked_at::text,queue_revision,queue_paused
    FROM flow.conversations WHERE id=ANY($1::text[]) ORDER BY id`, [pausedIds]);
  const before = (await pausedState()).rows;
  expect(before.every(row => row.queue_checked_at === '-infinity')).toBe(true);

  expect(await scanConversationQueue(pool, boss)).toEqual({ inspected: 1, promoted: 1, blocked: 0, errors: [] });
  expect((await pausedState()).rows).toEqual(before);
  expect(Number((await pool.query('SELECT count(*) FROM flow.conversation_turns WHERE conversation_id=ANY($1::text[])', [pausedIds])).rows[0].count)).toBe(0);
  expect((await request(`/api/conversations/${ready.id}/queue/${waiting.item.id}`)).body.item.state).toBe('promoted');
  expect((await request(`/api/conversations/${paused[0].id}/queue`)).body).toMatchObject({ paused: true, queueRevision: 2, currentTurn: null, items: [{ state: 'waiting' }] });

  // Empty explicit resume clears pause; a later enqueue becomes eligible to scan.
  const resumed = paused[0]; const path = `/api/conversations/${resumed.id}/queue`;
  expect((await request(`${path}/${resumed.itemId}/cancel`, { expectedQueueRevision: 2 })).body.queueRevision).toBe(3);
  expect((await request(`${path}/resume`, { expectedQueueRevision: 3, expectedTaskId: null })).body).toMatchObject({ paused: false, queueRevision: 4, promoted: null });
  const next = await enqueueItem(resumed.id, 4, 'Eligible after explicit resume');
  expect(await scanConversationQueue(pool, boss)).toEqual({ inspected: 1, promoted: 1, blocked: 0, errors: [] });
  expect((await request(`${path}/${next.item.id}`)).body.item.state).toBe('promoted');
  expect((await pausedState()).rows.filter(row => row.id !== resumed.id)).toEqual(before.filter(row => row.id !== resumed.id));
});
it('keeps pause CAS authoritative when a candidate scan races promotion', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const item = await enqueueItem(c.id, 0, 'Pause versus candidate scan');
  const [pause, scan] = await Promise.all([
    request(`${path}/pause`, { expectedQueueRevision: 1 }),
    scanConversationQueue(pool, boss, 1),
  ]);
  expect(scan.errors).toEqual([]);
  const current = (await request(`${path}/${item.item.id}`)).body;
  const turns = (await request(`/api/conversations/${c.id}/turns`)).body.turns;
  if (pause.status === 200) {
    expect(current).toMatchObject({ paused: true, queueRevision: 2, item: { state: 'waiting', promoted: null } });
    expect(turns).toEqual([]); expect(scan.promoted).toBe(0);
    expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'blocked', reason: 'queue-paused' });
  } else {
    expect(pause.status).toBe(409); expect(pause.body.error.code).toBe('conversation_queue_revision_conflict');
    expect(scan.promoted).toBe(1); expect(turns).toHaveLength(1);
    expect(current).toMatchObject({ paused: false, queueRevision: 2, item: { state: 'promoted', promoted: { taskId: turns[0].task.id } } });
  }
});
it('persists an immutable enqueue receipt through ACK loss and exposes current cancellation with independent revision', async () => {
  const c = await conversation();
  const path = `/api/conversations/${c.id}/queue`;
  const key = randomUUID(); const input = { expectedQueueRevision: 0, text: 'First waiting intent' };
  const accepted = await request(path, input, key);
  expect(accepted.status).toBe(202);
  expect(accepted.body).toMatchObject({ queueRevision: 1, item: { sequence: 1, state: 'waiting', promoted: null }, replayed: false });
  const replay = await request(path, input, key);
  expect(replay.body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(path, { ...input, text: 'changed' }, key)).status).toBe(409);
  const page = await request(path);
  expect(page.body.items).toEqual([accepted.body.item]);
  expect((await request(`/api/conversations/${c.id}`)).body.conversation.revision).toBe(0);
  const cancelKey = randomUUID();
  const cancelled = await request(`${path}/${accepted.body.item.id}/cancel`, { expectedQueueRevision: 1 }, cancelKey);
  expect(cancelled.body).toMatchObject({ outcome: 'cancelled', queueRevision: 2, item: { state: 'cancelled' } });
  expect((await request(`${path}/${accepted.body.item.id}/cancel`, { expectedQueueRevision: 1 }, cancelKey)).body).toEqual({ ...cancelled.body, replayed: true });
  expect((await request(path, input, key)).body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(`${path}/${accepted.body.item.id}`)).body).toMatchObject({ queueRevision: 2, item: { state: 'cancelled', text: input.text } });
});
it('promotes an empty conversation once, forbids follow-up bypass, and preserves the original ACK after restart', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const key = randomUUID(); const input = { expectedQueueRevision: 0, text: 'Queued first turn' };
  const accepted = (await request(path, input, key)).body;
  const bypass = await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Must not jump ahead' });
  expect(bypass.status).toBe(409);
  expect(bypass.body.error.code).toBe('conversation_queue_pending');
  const outcomes = await Promise.all([promoteReady(pool, boss, c.id), promoteReady(pool, boss, c.id)]);
  expect(outcomes.map(value => value.outcome).sort()).toEqual(['empty', 'promoted']);
  const current = (await request(`${path}/${accepted.item.id}`)).body;
  expect(current).toMatchObject({ queueRevision: 2, item: { state: 'promoted', promoted: { turnNumber: 1 } } });
  const snapshot = (await request(`/api/conversations/${c.id}`)).body;
  expect(snapshot.conversation.revision).toBe(1);
  expect(snapshot.lastTurn.user.text).toBe(input.text);
  expect(snapshot.lastTurn.task.id).toBe(current.item.promoted.taskId);
  expect((await request(path)).body.items).toEqual([]);
  const cancelAfterPromotion = await request(`${path}/${accepted.item.id}/cancel`, { expectedQueueRevision: 1 });
  expect(cancelAfterPromotion.body).toMatchObject({ outcome: 'already-promoted', item: { promoted: current.item.promoted } });
  await server!.close(); await start();
  expect((await request(path, input, key)).body).toEqual({ ...accepted, replayed: true });
  expect((await request(`${path}/${accepted.item.id}`)).body).toEqual(current);
});

async function enqueueItem(id: string, expectedQueueRevision: number, text: string) {
  const result = await request(`/api/conversations/${id}/queue`, { expectedQueueRevision, text });
  expect(result.status).toBe(202); return result.body;
}
/** Controlled durable execution evidence; no SDK/model is run by queue tests. */
async function executionFixture(taskId: string, status: string, adapter: 'known' | 'unknown' | 'missing' = 'known') {
  const runner = (await request('/api/runners', { name: 'Queue fixture', harnesses: ['claude'], capacity: 1 })).body;
  const attemptId = randomUUID(); const sessionId = randomUUID();
  await pool.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at,native_session_id)
    VALUES($1,$2,$3,1,clock_timestamp()+interval '1 minute',clock_timestamp(),$4)`, [attemptId, taskId, runner.runnerId, adapter === 'missing' ? null : sessionId]);
  await pool.query('UPDATE flow.tasks SET status=$2,current_attempt_id=$3,owner_version=1 WHERE id=$1', [taskId, status, attemptId]);
  if (adapter !== 'missing') {
    await pool.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'claude',$2)", [sessionId, runner.runnerId]);
    await pool.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Session','session',$4,'application/json')", [randomUUID(), taskId, attemptId, JSON.stringify({ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: adapter === 'known' ? 'claude-sdk-0.3.290-v2' : 'unknown-adapter' })]);
  }
  return { runner, attemptId, sessionId };
}
it('serializes two client CAS writes, preserves FIFO after cancellation, and resumes the previous known session', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const concurrent = await Promise.all(['A', 'B'].map(text => request(path, { expectedQueueRevision: 0, text })));
  expect(concurrent.map(value => value.status).sort()).toEqual([202, 409]);
  const first = concurrent.find(value => value.status === 202)!.body;
  const second = await enqueueItem(c.id, 1, 'Second');
  const third = await enqueueItem(c.id, 2, 'Third');
  expect((await request(`${path}/${second.item.id}/cancel`, { expectedQueueRevision: 3 })).body.outcome).toBe('cancelled');
  const initial = await promoteReady(pool, boss, c.id);
  expect(initial).toMatchObject({ outcome: 'promoted', receipt: { item: { id: first.item.id } } });
  const snapshot = (await request(`/api/conversations/${c.id}`)).body;
  const evidence = await executionFixture(snapshot.lastTurn.task.id, 'succeeded');
  expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'promoted', receipt: { item: { id: third.item.id, promoted: { turnNumber: 2 } } } });
  const next = (await request(`/api/conversations/${c.id}`)).body;
  expect(next.lastTurn.user.text).toBe('Third');
  const submission = (await pool.query('SELECT submission FROM flow.tasks WHERE id=$1', [next.lastTurn.task.id])).rows[0].submission;
  expect(submission.resumeSessionId).toBe(evidence.sessionId);
  expect((await request(path)).body).toMatchObject({ items: [], queueRevision: 6 });
});
it.each([
  ['failed', 'known', 'previous-turn-failed'], ['cancelled', 'known', 'previous-turn-cancelled'],
  ['uncertain', 'known', 'previous-turn-uncertain'], ['running', 'known', 'previous-turn-active'],
  ['succeeded', 'missing', 'native-session-unavailable'], ['succeeded', 'unknown', 'native-session-unavailable'],
] as const)('freezes waiting intent after %s with %s evidence', async (status, adapter, reason) => {
  const c = await conversation();
  const first = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Previous' })).body;
  await executionFixture(first.turn.task.id, status, adapter);
  const item = await enqueueItem(c.id, 0, 'Must remain waiting');
  expect(await promoteReady(pool, boss, c.id)).toEqual({ outcome: 'blocked', conversationId: c.id, reason });
  expect((await request(`/api/conversations/${c.id}/queue`)).body).toMatchObject({ queueRevision: 1, blocked: reason, items: [{ id: item.item.id, state: 'waiting' }] });
  expect((await request(`/api/conversations/${c.id}`)).body.conversation.revision).toBe(1);
});
it('freezes unavailable profile pins and busy sessions without losing waiting intent', async () => {
  const pinned = await conversation();
  await pool.query('UPDATE flow.conversations SET execution_profile=$2 WHERE id=$1', [pinned.id, { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) }]);
  await enqueueItem(pinned.id, 0, 'Pinned waiting');
  expect(await promoteReady(pool, boss, pinned.id)).toMatchObject({ outcome: 'blocked', reason: 'execution-profile-unavailable' });
  const c = await conversation();
  const first = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Previous' })).body;
  const fixture = await executionFixture(first.turn.task.id, 'succeeded');
  await pool.query('UPDATE flow.sessions SET active_task_id=$2 WHERE id=$1', [fixture.sessionId, first.turn.task.id]);
  await enqueueItem(c.id, 0, 'Busy waiting');
  expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'blocked', reason: 'native-session-busy' });
});
it('cancellation and promotion agree on a single outcome under the conversation lock', async () => {
  for (let index = 0; index < 8; index += 1) {
    const c = await conversation(); const item = await enqueueItem(c.id, 0, `Race ${index}`);
    const [cancelled, promoted] = await Promise.all([
      request(`/api/conversations/${c.id}/queue/${item.item.id}/cancel`, { expectedQueueRevision: 1 }), promoteReady(pool, boss, c.id),
    ]);
    expect(cancelled.status).toBe(200);
    const detail = (await request(`/api/conversations/${c.id}/queue/${item.item.id}`)).body;
    const turns = (await request(`/api/conversations/${c.id}/turns`)).body.turns;
    if (detail.item.state === 'cancelled') {
      expect(cancelled.body.outcome).toBe('cancelled'); expect(promoted.outcome).toBe('empty'); expect(turns).toEqual([]);
    } else {
      expect(cancelled.body.outcome).toBe('already-promoted'); expect(promoted.outcome).toBe('promoted');
      expect(turns).toHaveLength(1); expect(cancelled.body.item.promoted.taskId).toBe(turns[0].task.id);
    }
  }
});
it('restarts pending work and permits only one promotion across two center instances', async () => {
  const c = await conversation(); const item = await enqueueItem(c.id, 0, 'Recovered waiting');
  await server!.close(); await start();
  const otherPool = new Pool({ connectionString: databaseUrl.href, max: 2 });
  const options = { databaseUrl: databaseUrl.href, ownerToken, automaticQueueScan: false };
  const other = await createServer(options);
  if (!other.hasRoute({ method: 'POST', url: '/api/conversations/:id/queue' })) registerConversationQueueRoutes(other, otherPool, boss);
  const otherUrl = await other.listen({ host: '127.0.0.1', port: 0 });
  try {
    const before = await fetch(`${otherUrl}/api/conversations/${c.id}/queue`, { headers: { authorization: `Bearer ${ownerToken}` } }).then(response => response.json());
    expect(before.items[0].id).toBe(item.item.id);
    const results = await Promise.all([promoteReady(pool, boss, c.id), promoteReady(otherPool, boss, c.id)]);
    expect(results.map(value => value.outcome).sort()).toEqual(['empty', 'promoted']);
    expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toHaveLength(1);
  } finally { await other.close(); await otherPool.end(); }
});
it('rolls back task, wake and turn when item update fails and scan still reaches other ready conversations', async () => {
  const broken = await conversation(); await enqueueItem(broken.id, 0, 'Rollback probe');
  const ready = await conversation(); const readyItem = await enqueueItem(ready.id, 0, 'Ready after broken');
  await pool.query(`CREATE FUNCTION flow.chat04_reject_promotion() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.user_text='Rollback probe' AND NEW.state='promoted' THEN RAISE EXCEPTION 'Controlled promotion failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER chat04_reject_promotion BEFORE UPDATE ON flow.conversation_queue FOR EACH ROW EXECUTE FUNCTION flow.chat04_reject_promotion()`);
  try {
    const countBefore = Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count);
    await expect(promoteReady(pool, boss, broken.id)).rejects.toThrow('Controlled promotion failure');
    expect(Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count)).toBe(countBefore);
    expect(Number((await pool.query("SELECT count(*) FROM pgboss.job j WHERE name='flow-wake' AND NOT EXISTS (SELECT 1 FROM flow.tasks t WHERE t.id=j.data->>'taskId')")).rows[0].count)).toBe(0);
    expect((await request(`/api/conversations/${broken.id}/turns`)).body.turns).toEqual([]);
    expect((await request(`/api/conversations/${broken.id}/queue`)).body).toMatchObject({ queueRevision: 1, items: [{ state: 'waiting' }] });
    const scans = [];
    for (let index = 0; index < 30; index += 1) {
      scans.push(await scanConversationQueue(pool, boss, 1));
      if ((await request(`/api/conversations/${ready.id}/queue/${readyItem.item.id}`)).body.item.state === 'promoted') break;
    }
    expect(scans.some(scan => scan.promoted === 1)).toBe(true);
    const scanAll = await scanConversationQueue(pool, boss, 100);
    expect(scanAll.errors).toContainEqual({ conversationId: broken.id, code: 'promotion_failed' });
    expect((await request(`/api/conversations/${broken.id}/queue`)).body.queueRevision).toBe(1);
  } finally { await pool.query('DROP TRIGGER chat04_reject_promotion ON flow.conversation_queue; DROP FUNCTION flow.chat04_reject_promotion()'); }
});
it('bounds UTF-8 previews and pending count, pages only waiting items, and confines item reads to their conversation', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const text = '中文🙂'.repeat(1600);
  const first = await enqueueItem(c.id, 0, text);
  expect(Buffer.byteLength(first.item.preview)).toBeLessThanOrEqual(512);
  expect(first.item.truncated).toBe(true);
  expect(first.item.preview).not.toContain('\ufffd');
  expect((await request(`${path}/${first.item.id}`)).body.item.text).toBe(text);
  expect((await request(path, { expectedQueueRevision: 1, text: text + 'x' })).status).toBe(400);
  for (let index = 1; index < 100; index += 1) await enqueueItem(c.id, index, `Pending ${index + 1}`);
  expect((await request(path, { expectedQueueRevision: 100, text: 'Full' })).body.error.code).toBe('conversation_queue_full');
  const a = (await request(`${path}?limit=50`)).body; const b = (await request(`${path}?limit=50&after=${a.nextCursor}`)).body;
  expect(a.items).toHaveLength(50); expect(b.items).toHaveLength(50); expect(b.nextCursor).toBeNull();
  expect(new Set([...a.items, ...b.items].map(item => item.id)).size).toBe(100);
  expect(a.items.every((item: ConversationQueueItem) => !Object.hasOwn(item, 'text'))).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(a))).toBeLessThan(50 * 1100);
  const foreign = await conversation();
  expect((await request(`/api/conversations/${foreign.id}/queue/${first.item.id}`)).status).toBe(404);
  expect((await request(`${path}?limit=51`)).status).toBe(400);
  await expect(scanConversationQueue(pool, boss, 101)).rejects.toThrow('between 1 and 100');
});
it('recovers an actually dropped HTTP ACK using the same key after promotion', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const key = randomUUID(); const input = { expectedQueueRevision: 0, text: 'ACK deliberately dropped after commit' };
  await expect(fetch(`${baseUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key, 'x-chat04-drop-ack': 'yes' }, body: JSON.stringify(input), signal: AbortSignal.timeout(5000) })).rejects.toThrow();
  const current = (await request(path)).body;
  expect(current.items).toHaveLength(1);
  expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'promoted' });
  const replay = (await request(path, input, key)).body;
  expect(replay).toMatchObject({ replayed: true, queueRevision: 1, item: { id: current.items[0].id, state: 'waiting' } });
  expect((await request(`${path}/${current.items[0].id}`)).body).toMatchObject({ queueRevision: 2, item: { state: 'promoted', promoted: { turnNumber: 1 } } });
});
it('persists pause before cancelling and never auto-promotes after a late successful completion or restart', async () => {
  const c = await conversation();
  const first = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Running before stop' })).body;
  const fixture = await executionFixture(first.turn.task.id, 'running');
  await pool.query('UPDATE flow.attempts SET completed_at=NULL WHERE id=$1', [fixture.attemptId]);
  const waiting = await enqueueItem(c.id, 0, 'Must not start after Stop');
  const path = `/api/conversations/${c.id}/queue`;
  const paused = await request(`${path}/pause`, { expectedQueueRevision: 1 });
  expect(paused.status).toBe(200);
  expect(paused.body).toMatchObject({ paused: true, queueRevision: 2, currentTurn: { taskId: first.turn.task.id, taskStatus: 'running', queueItemId: null } });
  expect((await request(`/api/tasks/${first.turn.task.id}/cancel`, {})).body.status).toBe('cancel_requested');
  const completed = await fetch(`${baseUrl}/api/runner/events`, { method: 'POST', headers: { authorization: `Bearer ${fixture.runner.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ attemptId: fixture.attemptId, ownerVersion: 1, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'succeeded' }] }) });
  expect(completed.status).toBe(200);
  await server!.close(); await start();
  expect(await promoteReady(pool, boss, c.id)).toEqual({ outcome: 'blocked', conversationId: c.id, reason: 'queue-paused' });
  expect((await request(path)).body).toMatchObject({ paused: true, blocked: 'queue-paused', queueRevision: 2, currentTurn: { taskStatus: 'succeeded' }, items: [{ id: waiting.item.id, state: 'waiting' }] });
  expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toHaveLength(1);
});
it.each(['failed', 'cancelled'])('explicitly resumes %s once atomically and does not authorize later automatic continuation', async status => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const previous = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Previous failed/cancelled' })).body.turn;
  await executionFixture(previous.task.id, status);
  const first = await enqueueItem(c.id, 0, 'Explicit continuation');
  const second = await enqueueItem(c.id, 1, 'Still requires success');
  expect((await request(`${path}/pause`, { expectedQueueRevision: 2 })).body.queueRevision).toBe(3);
  const input = { expectedQueueRevision: 3, expectedTaskId: previous.task.id };
  const responses = await Promise.all([request(`${path}/resume`, input), request(`${path}/resume`, input)]);
  expect(responses.map(result => result.status).sort()).toEqual([202, 409]);
  const resumed = responses.find(result => result.status === 202)!.body;
  expect(resumed).toMatchObject({ paused: false, queueRevision: 4, promoted: { id: first.item.id, state: 'promoted' }, currentTurn: { turnNumber: 2, taskStatus: 'queued', queueItemId: first.item.id } });
  await executionFixture(resumed.currentTurn.taskId, 'failed');
  expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'blocked', reason: 'previous-turn-failed' });
  expect((await request(path)).body.items[0].id).toBe(second.item.id);
});
it('keeps an empty queue paused, preserves pause during enqueue/cancel, and explicitly restores an empty composer', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  expect((await request(`${path}/pause`, { expectedQueueRevision: 0 })).body).toMatchObject({ paused: true, queueRevision: 1, currentTurn: null });
  expect((await request(path)).body).toMatchObject({ paused: true, blocked: 'queue-paused', items: [], currentTurn: null });
  expect((await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Cannot bypass pause' })).body.error.code).toBe('conversation_queue_paused');
  expect((await request(`${path}/pause`, { expectedQueueRevision: 0 })).status).toBe(409);
  expect((await request(`${path}/pause`, { expectedQueueRevision: 1 })).body.queueRevision).toBe(1);
  const item = await enqueueItem(c.id, 1, 'Waiting while paused');
  expect((await request(`${path}/${item.item.id}`)).body.paused).toBe(true);
  expect((await request(`${path}/${item.item.id}/cancel`, { expectedQueueRevision: 2 })).body.queueRevision).toBe(3);
  expect((await request(path)).body).toMatchObject({ paused: true, blocked: 'queue-paused', items: [] });
  expect((await request(`${path}/resume`, { expectedQueueRevision: 3, expectedTaskId: null })).body).toMatchObject({ paused: false, queueRevision: 4, promoted: null, currentTurn: null });
  expect((await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Explicit message after resume' })).status).toBe(202);
});
it('returns 409 when promotion wins pause CAS and distinguishes lost pause/resume ACKs from current facts', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  await enqueueItem(c.id, 0, 'Promoted before pause');
  const promoted = await promoteReady(pool, boss, c.id);
  expect(promoted.outcome).toBe('promoted');
  expect((await request(`${path}/pause`, { expectedQueueRevision: 1 })).status).toBe(409);
  expect((await request(path)).body.paused).toBe(false);
  const pauseKey = randomUUID(); const pauseInput = { expectedQueueRevision: 2 };
  const lostAck = (command: string, body: unknown, key: string) => fetch(`${baseUrl}${path}/${command}`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key, 'x-chat04-drop-ack': 'yes' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  await expect(lostAck('pause', pauseInput, pauseKey)).rejects.toThrow();
  const paused = (await request(`${path}/pause`, pauseInput, pauseKey)).body;
  expect(paused).toMatchObject({ paused: true, replayed: true, queueRevision: 3, currentTurn: { taskStatus: 'queued', turnNumber: 1 } });
  expect(paused.currentTurn.queueItemId).not.toBeNull();
  await executionFixture(paused.currentTurn.taskId, 'succeeded');
  const waiting = await enqueueItem(c.id, 3, 'Explicitly continued after paused success');
  const resumeKey = randomUUID(); const resumeInput = { expectedQueueRevision: 4, expectedTaskId: paused.currentTurn.taskId };
  await expect(lostAck('resume', resumeInput, resumeKey)).rejects.toThrow();
  const resumed = (await request(`${path}/resume`, resumeInput, resumeKey)).body;
  expect(resumed).toMatchObject({ replayed: true, paused: false, queueRevision: 5, promoted: { id: waiting.item.id }, currentTurn: { queueItemId: waiting.item.id, turnNumber: 2 } });
  expect((await request(`${path}/pause`, pauseInput, pauseKey)).body).toEqual(paused);
  expect((await request(path)).body).toMatchObject({ paused: false, queueRevision: 5, currentTurn: resumed.currentTurn });
  expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toHaveLength(2);
});
it('allows empty failed queue unpause without preauthorizing future automatic work and rejects stale task identity', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const first = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Failed previous turn' })).body.turn;
  await executionFixture(first.task.id, 'failed');
  await request(`${path}/pause`, { expectedQueueRevision: 0 });
  const before = (await request(path)).body;
  expect((await request(`${path}/resume`, { expectedQueueRevision: 1, expectedTaskId: randomUUID() })).body.error.code).toBe('conversation_queue_task_conflict');
  expect((await request(`${path}/resume`, { expectedQueueRevision: 0, expectedTaskId: first.task.id })).body.error.code).toBe('conversation_queue_revision_conflict');
  expect((await request(path)).body).toEqual(before);
  expect((await request(`${path}/resume`, { expectedQueueRevision: 1, expectedTaskId: first.task.id })).body).toMatchObject({ paused: false, promoted: null, queueRevision: 2 });
  await enqueueItem(c.id, 2, 'Not an authorization for auto continuation');
  expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'blocked', reason: 'previous-turn-failed' });
});
it.each([
  ['uncertain', 'known', 'none'], ['running', 'known', 'none'], ['waiting', 'known', 'none'], ['cancel_requested', 'known', 'none'],
  ['succeeded', 'missing', 'none'], ['succeeded', 'unknown', 'none'], ['succeeded', 'known', 'revoked'],
  ['succeeded', 'known', 'busy'], ['failed', 'known', 'invalid-pin'],
] as const)('refuses resume from %s/%s/%s and preserves durable pause and queue', async (status, adapter, condition) => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const previous = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Resume guard fixture' })).body.turn;
  const fixture = await executionFixture(previous.task.id, status, adapter);
  if (condition === 'revoked') expect((await request(`/api/runners/${fixture.runner.runnerId}/revoke`, {})).status).toBe(200);
  if (condition === 'busy') await pool.query('UPDATE flow.sessions SET active_task_id=$2 WHERE id=$1', [fixture.sessionId, previous.task.id]);
  if (condition === 'invalid-pin') await pool.query('UPDATE flow.conversations SET execution_profile=$2 WHERE id=$1', [c.id, { id: randomUUID(), runnerId: fixture.runner.runnerId, configDigest: 'f'.repeat(64) }]);
  const item = await enqueueItem(c.id, 0, 'Preserved waiting item');
  await request(`${path}/pause`, { expectedQueueRevision: 1 });
  const rejected = await request(`${path}/resume`, { expectedQueueRevision: 2, expectedTaskId: previous.task.id });
  expect(rejected.status).toBe(409);
  expect((await request(path)).body).toMatchObject({ paused: true, queueRevision: 2, blocked: 'queue-paused', items: [{ id: item.item.id, state: 'waiting' }] });
  expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toHaveLength(1);
});
it('rolls back pause clearing together with task, wake and turn when explicit resume cannot persist the promoted item', async () => {
  const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
  const item = await enqueueItem(c.id, 0, 'Resume rollback fixture');
  await request(`${path}/pause`, { expectedQueueRevision: 1 });
  await pool.query(`CREATE FUNCTION flow.chat04_reject_resume() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.user_text='Resume rollback fixture' AND NEW.state='promoted' THEN RAISE EXCEPTION 'Controlled resume failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER chat04_reject_resume BEFORE UPDATE ON flow.conversation_queue FOR EACH ROW EXECUTE FUNCTION flow.chat04_reject_resume()`);
  try {
    const before = Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count);
    expect((await request(`${path}/resume`, { expectedQueueRevision: 2, expectedTaskId: null })).status).toBe(500);
    expect((await request(`${path}/${item.item.id}`)).body).toMatchObject({ paused: true, queueRevision: 2, item: { state: 'waiting', promoted: null }, currentTurn: null });
    expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toEqual([]);
    expect(Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count)).toBe(before);
    expect(Number((await pool.query("SELECT count(*) FROM pgboss.job j WHERE name='flow-wake' AND NOT EXISTS (SELECT 1 FROM flow.tasks t WHERE t.id=j.data->>'taskId')")).rows[0].count)).toBe(0);
  } finally { await pool.query('DROP TRIGGER chat04_reject_resume ON flow.conversation_queue; DROP FUNCTION flow.chat04_reject_resume()'); }
  expect((await request(`${path}/resume`, { expectedQueueRevision: 2, expectedTaskId: null })).body).toMatchObject({ paused: false, queueRevision: 3, promoted: { id: item.item.id }, currentTurn: { turnNumber: 1 } });
});
it('serializes concurrent pause, real completion and promotion without admitting any turn after the winning pause ACK', async () => {
  for (let index = 0; index < 4; index += 1) {
    const c = await conversation(); const path = `/api/conversations/${c.id}/queue`;
    const turn = (await request(`/api/conversations/${c.id}/turns`, { expectedRevision: 0, text: 'Concurrent previous' })).body.turn;
    const fixture = await executionFixture(turn.task.id, 'running');
    await pool.query('UPDATE flow.attempts SET completed_at=NULL WHERE id=$1', [fixture.attemptId]);
    await enqueueItem(c.id, 0, 'Concurrent next');
    const [pauseResult, completed] = await Promise.all([
      request(`${path}/pause`, { expectedQueueRevision: 1 }),
      fetch(`${baseUrl}/api/runner/events`, { method: 'POST', headers: { authorization: `Bearer ${fixture.runner.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ attemptId: fixture.attemptId, ownerVersion: 1, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'succeeded' }] }) }),
      promoteReady(pool, boss, c.id),
    ]);
    expect(completed.status).toBe(200);
    if (pauseResult.status === 409) {
      const current = (await request(path)).body;
      const retried = await request(`${path}/pause`, { expectedQueueRevision: current.queueRevision });
      expect(retried.status).toBe(200); expect(retried.body.currentTurn).toEqual(current.currentTurn);
    } else expect(pauseResult.status).toBe(200);
    const before = (await request(`/api/conversations/${c.id}/turns`)).body.turns.length;
    expect(await promoteReady(pool, boss, c.id)).toMatchObject({ outcome: 'blocked', reason: 'queue-paused' });
    expect((await request(`/api/conversations/${c.id}/turns`)).body.turns).toHaveLength(before);
  }
});
