import { describeExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { HttpError, migrate, sha256, transaction } from '../database.js';
import { ownedAttempt } from '../runners.js';
import { saveAssistantFinal } from '../assistant/store.js';
import { sealForFinal, migrateActiveSteering, registerActiveSteeringRoutes } from './index.js';
const database = `flow_chat07_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
let app: Awaited<ReturnType<typeof createServer>>, base = '', created = false;
async function start(port = 0, acceptCommands = true) {
  app = await createServer({ databaseUrl, ownerToken: 'chat07-owner', automaticQueueScan: false, leaseMs: 300_000, activeSteering: acceptCommands });
  await migrateActiveSteering(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/steering/finalize' })) registerActiveSteeringRoutes(app, pool, { acceptCommands });
  // Test-only composition: production events are intentionally untouched by this slice.
  app.post<{ Body: { seal: Parameters<typeof sealForFinal>[2]; content: string; fail?: boolean } }>('/api/runner/steering-test-final', request => transaction(pool, async client => {
    const seal = await sealForFinal(client, request.runnerId!, request.body.seal);
    const { task, attempt } = await ownedAttempt(client, request.runnerId!, request.body.seal);
    await saveAssistantFinal(client, task, attempt, finalEvent(request.body.seal.final.nativeSessionId, request.body.seal.final.sourceMessageId, request.body.content));
    if (request.body.fail) throw new HttpError(409, 'synthetic_final_failure', 'Roll back the composed transaction.');
    return seal;
  }));
  base = await app.listen({ host: '127.0.0.1', port });
}
async function stop() { if (app) { app.server.closeAllConnections(); await app.close(); } }
beforeAll(async () => { await admin.query(`CREATE DATABASE ${database}`); created = true; await start(); });
afterAll(async () => { try { await stop(); } finally { await pool.end(); try { if (created) await admin.query(`DROP DATABASE ${database}`); } finally { await admin.end(); } } });
async function request(path: string, body?: unknown, token = 'chat07-owner', status = 200, key = randomUUID()) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  if (body === undefined && response.ok && path.includes('/steering')) expect(response.headers.get('cache-control')).toBe('no-store');
  const data = await response.json(); expect(response.status, JSON.stringify(data)).toBe(status); return data;
}
async function attempt() {
  const runner = await request('/api/runners', { name: 'Synthetic steering runner', harnesses: ['claude'], capacity: 1 });
  const profile = (await request('/api/runner/execution-profile', { configuration: steeringConfiguration() }, runner.token)).profile;
  const task = (await request('/api/tasks', { executionProfile: profile.reference, title: 'Steering test', prompt: 'Zero provider', harness: 'claude' }, undefined, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const claim = await request('/api/runner/claim', {}, runner.token);
  expect(claim.assignment.task.id).toBe(task.id);
  const ownership = { attemptId: claim.assignment.attempt.id, ownerVersion: claim.assignment.attempt.ownerVersion };
  const nativeSessionId = randomUUID();
  await request('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }] }, runner.token);
  return { ...runner, taskId: task.id, ownership, nativeSessionId };
}
it('persists a bounded command while returning only lightweight metadata', async () => {
  const a = await attempt(); const text = '改用中文解释🙂';
  const result = await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text }, undefined, 202);
  expect(result.command).toMatchObject({ taskId: a.taskId, revision: 1, status: 'accepted', receiptRevision: 0, input: { bytes: Buffer.byteLength(text) } });
  expect(JSON.stringify(result)).not.toContain(text);
});

function finalEvent(nativeSessionId: string, sourceMessageId: string, content: string) {
  return { id: randomUUID(), sequence: 2, type: 'assistant-final' as const, messageId: sha256(JSON.stringify([nativeSessionId, sourceMessageId])),
    nativeSessionId, source: 'claude.sdk.result' as const, sourceMessageId, content,
    settings: { requested: { model: 'synthetic', permissionMode: 'dontAsk' as const, thinking: 'disabled' as const },
      effective: { model: 'synthetic', tools: [], permissionMode: 'dontAsk', thinking: 'unknown' as const } } };
}
async function send(a: Awaited<ReturnType<typeof attempt>>, text = 'A new instruction', revision = 0, key = randomUUID(), status = 202) {
  return request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: revision, text }, undefined, status, key);
}
function receipt(a: Awaited<ReturnType<typeof attempt>>, command: any, phase = 'received', expectedReceiptRevision = 0) {
  return { ...a.ownership, commandId: command.id, nativeSessionId: a.nativeSessionId, userMessageUuid: command.userMessageUuid,
    receiptId: randomUUID(), expectedReceiptRevision, phase };
}
function finalInput(a: Awaited<ReturnType<typeof attempt>>, expectedRevision = 0) {
  return { ...a.ownership, expectedRevision, final: { nativeSessionId: a.nativeSessionId, sourceMessageId: randomUUID(), contentDigest: sha256('Canonical reply') } };
}
it('authenticates actual roles and binds body access to the task', async () => {
  const a = await attempt(), b = await attempt();
  await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'x' }, a.token, 403);
  await request(`/api/tasks/${a.taskId}/steering`, undefined, 'invalid', 401);
  await request(`/api/tasks/${b.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'x' }, undefined, 404);
  const { command } = await send(a, 'private steering text');
  const path = `/api/tasks/${a.taskId}/steering/${command.id}/text`;
  expect((await request(path)).text).toBe('private steering text');
  await request(path, undefined, a.token, 403);
  await request(`/api/tasks/${b.taskId}/steering/${command.id}/text`, undefined, undefined, 404);
  await request('/api/runner/steering/receipts', receipt(a, command), undefined, 403);
  await request('/api/runner/steering/receipts', receipt(a, command), b.token, 403);
  await request('/api/runner/steering/receipts', { ...receipt(a, command), runnerId: a.runnerId }, a.token, 400);
});
it('bounds exact UTF-8 bytes and rejects malformed input before durable acceptance', async () => {
  const a = await attempt();
  for (const text of [' ', '\0', '\ud800', '🙂'.repeat(4097), 'x'.repeat(16385)]) await send(a, text, 0, randomUUID(), 400);
  expect((await request(`/api/tasks/${a.taskId}/steering`)).commands).toEqual([]);
  const result = await send(a, '🙂'.repeat(4096));
  expect(result.command.input.bytes).toBe(16384);
  expect((await request(`/api/tasks/${a.taskId}/steering/${result.command.id}/text`)).text).toBe('🙂'.repeat(4096));
  expect(JSON.stringify(await request(`/api/tasks/${a.taskId}/steering`))).not.toContain('🙂');
});
it('replays one key exactly and rejects changed input, stale CAS and a second pending command', async () => {
  const a = await attempt(), key = randomUUID();
  await send(a, 'first', 1, randomUUID(), 409);
  expect((await pool.query('SELECT count(*)::int n FROM flow.commands WHERE operation=$1', [`steering.accept:${a.taskId}`])).rows[0].n).toBe(0);
  const first = await send(a, 'first', 0, key);
  expect(await send(a, 'first', 0, key)).toEqual({ ...first, replayed: true });
  await send(a, 'changed', 0, key, 409);
  await send(a, 'second', 1, randomUUID(), 409);
  expect((await request(`/api/tasks/${a.taskId}/steering/audit`)).entries.map((entry: any) => entry.action)).toEqual(['accepted']);
});
it('serializes two real HTTP submissions to one in-flight command', async () => {
  const a = await attempt();
  const submit = (text: string) => fetch(`${base}/api/tasks/${a.taskId}/steering`, { method: 'POST', headers: { authorization: 'Bearer chat07-owner', 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify({ ...a.ownership, expectedRevision: 0, text }), signal: AbortSignal.timeout(5000) });
  const responses = await Promise.all([submit('alpha'), submit('beta')]);
  expect(responses.map(value => value.status).sort()).toEqual([202, 409]);
  await Promise.all(responses.map(value => value.arrayBuffer()));
  expect((await request(`/api/tasks/${a.taskId}/steering`)).commands).toHaveLength(1);
});
it('separates received from observed consumption and checks source identity, revision and receipt idempotency', async () => {
  const a = await attempt(), { command } = await send(a), received = receipt(a, command);
  await request('/api/runner/steering/receipts', { ...received, nativeSessionId: randomUUID() }, a.token, 409);
  await request('/api/runner/steering/receipts', { ...received, userMessageUuid: randomUUID() }, a.token, 409);
  const first = await request('/api/runner/steering/receipts', received, a.token);
  expect(first.command.status).toBe('received'); expect(first.command.receiptRevision).toBe(1);
  expect(await request('/api/runner/steering/receipts', received, a.token)).toEqual({ ...first, replayed: true });
  await request('/api/runner/steering/receipts', { ...received, expectedReceiptRevision: 1 }, a.token, 409);
  const consumed = { ...receipt(a, command, 'observed-consumed', 1), sourceMessageId: randomUUID(), sourceType: 'assistant', parentToolUseId: null, consumedUserMessageUuids: [command.userMessageUuid] };
  await request('/api/runner/steering/receipts', { ...consumed, parentToolUseId: 'child-tool' }, a.token, 400);
  await request('/api/runner/steering/receipts', { ...consumed, consumedUserMessageUuids: [randomUUID()] }, a.token, 400);
  await request('/api/runner/steering/receipts', { ...consumed, expectedReceiptRevision: 0 }, a.token, 409);
  expect((await request('/api/runner/steering/receipts', consumed, a.token)).command.status).toBe('observed-consumed');
  const next = await send(a, 'next instruction', 1);
  expect(next.command.revision).toBe(2);
  const audit = await request(`/api/tasks/${a.taskId}/steering/audit`);
  expect(audit.entries.map((entry: any) => entry.action)).toEqual(['accepted', 'received', 'observed-consumed', 'accepted']);
  expect(JSON.stringify(audit)).not.toContain('A new instruction');
  const page = await request(`/api/tasks/${a.taskId}/steering?limit=1`);
  expect(page.nextCursor).toBe(1);
  expect((await request(`/api/tasks/${a.taskId}/steering?after=1&limit=1`)).commands[0].id).toBe(next.command.id);
  const auditPage = await request(`/api/tasks/${a.taskId}/steering/audit?limit=2`);
  expect((await request(`/api/tasks/${a.taskId}/steering/audit?after=${auditPage.nextCursor}`)).entries).toHaveLength(2);
});
it('keeps unknown delivery unresolved without creating a new task or quietly resending', async () => {
  const a = await attempt(), { command } = await send(a);
  const before = (await pool.query('SELECT count(*)::int n FROM flow.tasks')).rows[0].n;
  const unknown = { ...receipt(a, command, 'unknown'), reason: 'Connection ended before consumption was observable.' };
  expect((await request('/api/runner/steering/receipts', unknown, a.token)).command.status).toBe('unknown');
  await send(a, 'retry', 1, randomUUID(), 409);
  await request('/api/runner/steering/receipts', receipt(a, command, 'received', 1), a.token, 409);
  await request('/api/runner/steering-test-final', { seal: finalInput(a, 1), content: 'Canonical reply' }, a.token, 409);
  expect((await pool.query('SELECT count(*)::int n FROM flow.tasks')).rows[0].n).toBe(before);
});
it('checks current ownership and availability before returning a saved receipt', async () => {
  for (const change of ['expired', 'revoked', 'stale', 'cancelled', 'waiting', 'completed', 'session']) {
    const a = await attempt(), key = randomUUID(), { command } = await send(a, 'original', 0, key);
    const received = receipt(a, command); await request('/api/runner/steering/receipts', received, a.token);
    if (change === 'expired') await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [a.ownership.attemptId]);
    if (change === 'revoked') await pool.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [a.runnerId]);
    if (change === 'stale') await pool.query('UPDATE flow.tasks SET owner_version=owner_version+1 WHERE id=$1', [a.taskId]);
    if (change === 'cancelled') await request(`/api/tasks/${a.taskId}/cancel`, {}, undefined);
    if (change === 'waiting') await pool.query("UPDATE flow.tasks SET status='waiting' WHERE id=$1", [a.taskId]);
    if (change === 'completed') await pool.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE id=$1', [a.ownership.attemptId]);
    if (change === 'session') await pool.query('UPDATE flow.sessions SET active_task_id=NULL WHERE id=$1', [a.nativeSessionId]);
    await send(a, 'original', 0, key, change === 'revoked' ? 401 : 409);
    await request('/api/runner/steering/receipts', received, a.token, change === 'revoked' ? 401 : 409);
    expect((await request(`/api/tasks/${a.taskId}/steering`)).attemptAvailable).toBe(false);
  }
});
it('rolls back final sealing with a failed final write and seals successfully in the same transaction', async () => {
  const a = await attempt(), seal = finalInput(a);
  await request('/api/runner/steering-test-final', { seal, content: 'Canonical reply', fail: true }, a.token, 409);
  expect((await request(`/api/tasks/${a.taskId}/steering`)).sealed).toBe(false);
  expect((await pool.query('SELECT count(*)::int n FROM flow.assistant_messages WHERE task_id=$1', [a.taskId])).rows[0].n).toBe(0);
  await request('/api/runner/steering-test-final', { seal, content: 'Canonical reply' }, a.token);
  expect((await request(`/api/tasks/${a.taskId}/steering`)).sealed).toBe(true);
  const saved = await transaction(pool, client => sealForFinal(client, a.runnerId, seal));
  expect(saved.final).toEqual(seal.final);
  await expect(transaction(pool, client => sealForFinal(client, a.runnerId, { ...seal, final: { ...seal.final, sourceMessageId: randomUUID() } }))).rejects.toMatchObject({ code: 'steering_seal_conflict' });
  await send(a, 'too late', 0, randomUUID(), 409);
});
it('rejects sealing while a command is received and permits it only after explicit rejection', async () => {
  const a = await attempt(), { command } = await send(a);
  await request('/api/runner/steering/receipts', receipt(a, command), a.token);
  await request('/api/runner/steering-test-final', { seal: finalInput(a, 1), content: 'Canonical reply' }, a.token, 409);
  await request('/api/runner/steering/receipts', { ...receipt(a, command, 'rejected', 1), reason: 'Native input was not submitted.' }, a.token);
  await request('/api/runner/steering-test-final', { seal: finalInput(a, 1), content: 'Canonical reply' }, a.token);
});
it('races command admission against final sealing in two real HTTP transactions', async () => {
  const a = await attempt();
  const headers = { authorization: 'Bearer chat07-owner', 'content-type': 'application/json', 'idempotency-key': randomUUID() };
  const commands = fetch(`${base}/api/tasks/${a.taskId}/steering`, { method: 'POST', headers, body: JSON.stringify({ ...a.ownership, expectedRevision: 0, text: 'Racing instruction' }), signal: AbortSignal.timeout(5000) });
  const finals = fetch(`${base}/api/runner/steering-test-final`, { method: 'POST', headers: { ...headers, authorization: `Bearer ${a.token}` }, body: JSON.stringify({ seal: finalInput(a), content: 'Canonical reply' }), signal: AbortSignal.timeout(5000) });
  const [commandResponse, finalResponse] = await Promise.all([commands, finals]);
  expect([[202, 409], [409, 200]]).toContainEqual([commandResponse.status, finalResponse.status]);
  await Promise.all([commandResponse.arrayBuffer(), finalResponse.arrayBuffer()]);
  const state = await request(`/api/tasks/${a.taskId}/steering`);
  expect(Number(state.sealed) + state.commands.length).toBe(1);
});
it('holds the same runner lock across seal and final commit, rejecting a waiting command', async () => {
  const a = await attempt(), seal = finalInput(a), client = await pool.connect();
  try {
    await client.query('BEGIN'); await sealForFinal(client, a.runnerId, seal);
    const pending = send(a, 'arrives during final', 0, randomUUID(), 409);
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT%flow.runners%FOR UPDATE%'" )).rowCount;
      if (waiting) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(waiting).toBe(true);
    const { task, attempt: owned } = await ownedAttempt(client, a.runnerId, seal);
    await saveAssistantFinal(client, task, owned, finalEvent(a.nativeSessionId, seal.final.sourceMessageId, 'Canonical reply'));
    await client.query('COMMIT'); await pending;
  } finally { await client.query('ROLLBACK'); client.release(); }
});
it('preserves receipts and immutable audit across center restart and keeps default intake disabled', async () => {
  const a = await attempt(), key = randomUUID(), accepted = await send(a, 'survives restart', 0, key);
  const delivered = receipt(a, accepted.command);
  const savedReceipt = await request('/api/runner/steering/receipts', delivered, a.token);
  const before = await request(`/api/tasks/${a.taskId}/steering/audit`);
  await stop(); await start(0, false);
  await send(a, 'survives restart', 0, key, 409);
  expect(await request(`/api/tasks/${a.taskId}/steering/audit`)).toEqual(before);
  await stop(); await start();
  expect(await send(a, 'survives restart', 0, key)).toEqual({ ...accepted, replayed: true });
  expect(await request('/api/runner/steering/receipts', delivered, a.token)).toEqual({ ...savedReceipt, replayed: true });
  expect((await request(`/api/tasks/${a.taskId}/steering`)).commands[0].status).toBe('received');
  await expect(pool.query('UPDATE flow.steering_audit SET actor=$2 WHERE task_id=$1', [a.taskId, 'runner'])).rejects.toMatchObject({ code: '55000' });
  await expect(pool.query('DELETE FROM flow.steering_audit WHERE task_id=$1', [a.taskId])).rejects.toMatchObject({ code: '55000' });
});
it('first-upgrades an old schema with existing data and applies 024 exactly once', async () => {
  const name = `flow_chat07_upgrade_${randomUUID().replaceAll('-', '')}`;
  const old = new Pool({ connectionString: `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  try {
    await migrate(old);
    const id = randomUUID(); await old.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [id, { title: 'Pre-024 task', prompt: 'No execution', harness: 'fixture' }]);
    expect((await old.query('SELECT 1 FROM flow.migrations WHERE version=24')).rowCount).toBe(0);
    expect((await old.query("SELECT to_regclass('flow.steering_commands') AS relation")).rows[0].relation).toBeNull();
    const before = (await old.query('SELECT * FROM flow.tasks WHERE id=$1', [id])).rows[0];
    await migrateActiveSteering(old); await migrateActiveSteering(old);
    expect((await old.query('SELECT * FROM flow.tasks WHERE id=$1', [id])).rows[0]).toEqual(before);
    expect((await old.query('SELECT 1 FROM flow.migrations WHERE version=24')).rowCount).toBe(1);
    expect((await old.query('SELECT count(*)::int n FROM flow.steering_commands')).rows[0].n).toBe(0);
  } finally { await old.end(); await admin.query(`DROP DATABASE ${name}`); }
});

it('rejects unsupported receipt jumps and keeps historical state explicitly unavailable after completion', async () => {
  const a = await attempt(), { command } = await send(a);
  const consumed = { ...receipt(a, command, 'observed-consumed'), sourceMessageId: randomUUID(), sourceType: 'stream_event', parentToolUseId: null, consumedUserMessageUuids: [command.userMessageUuid] };
  await request('/api/runner/steering/receipts', consumed, a.token, 409);
  expect((await request(`/api/tasks/${a.taskId}/steering/audit`)).entries).toHaveLength(1);
  await pool.query("UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE id=$1", [a.ownership.attemptId]);
  await pool.query("UPDATE flow.tasks SET status='cancelled' WHERE id=$1", [a.taskId]);
  const historical = await request(`/api/tasks/${a.taskId}/steering?attemptId=${a.ownership.attemptId}`);
  expect(historical.attemptAvailable).toBe(false); expect(historical.commands[0].status).toBe('accepted');
  await request(`/api/tasks/${a.taskId}/steering?attemptId=${randomUUID()}`, undefined, undefined, 404);
  await request(`/api/tasks/${a.taskId}/steering?limit=101`, undefined, undefined, 400);
});
it('checks stored body integrity without leaking it into metadata responses', async () => {
  const a = await attempt(), { command } = await send(a, 'Original private body');
  await pool.query('UPDATE flow.steering_commands SET text=$2 WHERE id=$1', [command.id, 'Damaged private body']);
  await request(`/api/tasks/${a.taskId}/steering/${command.id}/text`, undefined, undefined, 409);
  expect(JSON.stringify(await request(`/api/tasks/${a.taskId}/steering/audit`))).not.toContain('private body');
});

function steeringConfiguration() {
  return describeExecutionProfile({ materialFiles: [] }, { name: 'claude', version: 'claude-sdk-0.3.290-v2', async run() {} }, true);
}
