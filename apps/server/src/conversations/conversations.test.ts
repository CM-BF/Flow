import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { Pool, type PoolClient } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ClaimedTask, RunnerEventData } from '@flow/contracts';
import { createServer } from '../index.js';
import { migrateAssistantMessages, registerAssistantRoutes } from '../assistant/index.js';
import { migrateConversations, registerConversationRoutes } from './index.js';

type QueryMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_chat01';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'chat01-local-owner';
let lock: PoolClient | undefined;
let created = false;
let pool: Pool;
let boss: PgBoss | undefined;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
async function request(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}
async function startServer() {
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 3000 });
  if (!server.hasRoute({ method: 'GET', url: '/api/assistant-messages/:id' })) {
    await migrateAssistantMessages(pool); registerAssistantRoutes(server, pool);
  }
  if (!server.hasRoute({ method: 'POST', url: '/api/conversations' })) {
    await migrateConversations(pool);
    boss = new PgBoss({ connectionString: databaseUrl }); await boss.start();
    registerConversationRoutes(server, pool, boss);
  }
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function stopServer() { await server?.close(); server = undefined; await boss?.stop(); boss = undefined; }
beforeAll(async () => {
  lock = await admin.connect();
  if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_chat01_test_exclusive',0)) AS locked")).rows[0]?.locked) throw new Error('flow_chat01 is in use.');
  if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_chat01'")).rowCount) throw new Error('Existing flow_chat01 must be preserved.');
  await lock.query('CREATE DATABASE flow_chat01'); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 8, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await stopServer(); } finally {
    await pool?.end();
    try { if (created) await lock?.query('DROP DATABASE flow_chat01'); }
    finally { lock?.release(); await admin.end(); }
  }
});

it('persists a conversation and ordinary user turn atomically without goal orchestration', async () => {
  const created = await request('/api/conversations', { title: 'A real conversation' });
  expect(created.status).toBe(201);
  const conversation = created.body.conversation;
  expect(conversation.revision).toBe(0);
  const admitted = await request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 0, text: 'hi' });
  expect(admitted.status).toBe(202);
  expect(admitted.body.turn).toMatchObject({ conversationId: conversation.id, number: 1, user: { role: 'user', text: 'hi' }, assistant: { state: 'pending' } });
  const task = (await request(`/api/tasks/${admitted.body.turn.task.id}`)).body;
  expect(task.prompt).toBe('hi');
  expect(task.harness).toBe('claude');
  await stopServer(); await startServer();
  const restored = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(restored.conversation).toEqual(admitted.body.conversation);
  expect(restored.lastTurn.id).toBe(admitted.body.turn.id);
  expect(restored.nativeSession).toBeNull();
  await request(`/api/tasks/${task.id}/cancel`, {});
});

const digest = (content: string) => createHash('sha256').update(content).digest('hex');
async function newTurn() {
  const conversation = (await request('/api/conversations', { title: 'Protocol conversation fixture' })).body.conversation;
  const accepted = (await request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 0, text: 'first user message' })).body;
  return { conversation: accepted.conversation, turn: accepted.turn };
}
async function newRunner() {
  return (await request('/api/runners', { name: 'CHAT01 protocol fixture', harnesses: ['claude'], capacity: 1 })).body as { runnerId: string; token: string };
}
async function claim(token: string): Promise<ClaimedTask> {
  let assignment: ClaimedTask | undefined;
  await expect.poll(async () => { assignment = (await request('/api/runner/claim', {}, { token })).body.assignment; return assignment; }, { timeout: 4000 }).toBeTruthy();
  return assignment!;
}
async function report(token: string, assignment: ClaimedTask, events: RunnerEventData[], start = 1) {
  return request('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: events.map((event, index) => ({ ...event, sequence: start + index, id: randomUUID() })) }, { token });
}
function finalEvents(nativeSessionId: string, content = 'actual final reply'): RunnerEventData[] {
  const version = digest(content);
  return [
    { type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['sdk:0.3.290', 'model:synthetic-test-model', 'tool:Read'] },
    { type: 'message', text: 'TELEMETRY MUST NOT BECOME ASSISTANT TEXT' },
    { type: 'artifact', artifactId: 'result', title: 'A title is not reply authority', content, version, mediaType: 'text/plain' },
    { type: 'verification', artifactId: 'result', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: digest(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Synthetic protocol result' },
    { type: 'completed', outcome: 'succeeded' },
  ];
}
it('projects only the exact final result and follows up on the same native session and runner', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  expect(assignment.task.id).toBe(turn.task.id);
  const nativeSessionId = randomUUID();
  expect((await report(runner.token, assignment, finalEvents(nativeSessionId))).status).toBe(200);
  const snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(snapshot.conversation.revision).toBe(1);
  expect(snapshot.nativeSession).toMatchObject({ nativeSessionId, runnerId: runner.runnerId, sourceTaskId: turn.task.id, sourceAttemptId: assignment.attempt.id });
  expect(snapshot.lastTurn.assistant).toMatchObject({ state: 'available', role: 'assistant', text: 'actual final reply', truncated: false, source: { taskId: turn.task.id, attemptId: assignment.attempt.id, artifactVersion: digest('actual final reply') } });
  expect(snapshot.lastTurn.effective).toMatchObject({ model: 'synthetic-test-model', thinking: 'disabled', tools: 'configured-readonly', source: { adapterVersion: 'claude-sdk-0.3.290-v1' } });
  const followup = await request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 1, text: 'What did we discuss?' });
  expect(followup.status).toBe(202);
  expect(followup.body.turn.number).toBe(2);
  const otherRunner = await newRunner();
  expect((await request('/api/runner/claim', {}, { token: otherRunner.token })).body.assignment).toBeNull();
  const resumed = await claim(runner.token);
  expect(resumed.task).toMatchObject({ id: followup.body.turn.task.id, prompt: 'What did we discuss?', resumeSessionId: nativeSessionId });
  expect((await report(runner.token, resumed, finalEvents(nativeSessionId, 'second reply'))).status).toBe(200);
  await stopServer(); await startServer();
  expect((await request(`/api/conversations/${conversation.id}`)).body).toMatchObject({ conversation: { id: conversation.id, revision: 2 }, nativeSession: { nativeSessionId }, lastTurn: { assistant: { text: 'second reply' } } });
});

it('pages immutable turns and returns long assistant content only through an owned lazy detail', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const content = 'x' + '中文🙂'.repeat(1800);
  expect((await report(runner.token, assignment, finalEvents(randomUUID(), content))).status).toBe(200);
  const page = await request(`/api/conversations/${conversation.id}/turns?limit=1`);
  expect(page.status).toBe(200);
  expect(page.body.turns).toHaveLength(1);
  expect(page.body.turns[0].assistant).toMatchObject({ state: 'available', truncated: true });
  expect(page.body.turns[0].assistant.text.length).toBeLessThanOrEqual(4000);
  expect(/[\uD800-\uDBFF]$/.test(page.body.turns[0].assistant.text)).toBe(false);
  const ref = page.body.turns[0].assistant.contentRef;
  expect((await request(`/api/conversations/${conversation.id}/turns/${turn.id}/details/${ref.id}`)).body.content).toBe(content);
  const other = (await request('/api/conversations', { title: 'Other conversation' })).body.conversation;
  expect((await request(`/api/conversations/${other.id}/turns/${turn.id}/details/${ref.id}`)).status).toBe(404);
  expect((await request(`/api/conversations/${conversation.id}/turns/${randomUUID()}/details/${ref.id}`)).status).toBe(404);
  expect((await request(`/api/conversations/${conversation.id}/turns?after=1`)).body.turns).toEqual([]);
  expect((await request(`/api/conversations/${conversation.id}/turns?limit=51`)).status).toBe(400);
  const list = await request('/api/conversations?limit=1');
  expect(list.status).toBe(200);
  expect(list.body.conversations).toHaveLength(1);
  expect(list.body.nextCursor).toBe(list.body.conversations[0].id);
  expect((await request(`/api/conversations?after=${list.body.nextCursor}&limit=50`)).body.conversations.every((item: { id: string }) => item.id > list.body.nextCursor)).toBe(true);
  await expect(pool.query('UPDATE flow.conversation_turns SET user_text=$1 WHERE id=$2', ['forged input', turn.id])).rejects.toMatchObject({ code: '23514' });
  expect((await request(`/api/conversations/${conversation.id}/turns`)).body.turns[0].user.text).toBe('first user message');
});

it('enforces owner identity, idempotency and one atomic winner for concurrent revision proposals', async () => {
  const runner = await newRunner();
  expect((await request('/api/conversations', undefined, { token: 'invalid' })).status).toBe(401);
  expect((await request('/api/conversations', undefined, { token: runner.token })).status).toBe(403);
  const key = randomUUID();
  const input = { title: 'Idempotent conversation' };
  const [a, b] = await Promise.all([request('/api/conversations', input, { key }), request('/api/conversations', input, { key })]);
  expect(a.body.conversation).toEqual(b.body.conversation);
  expect([a.body.replayed, b.body.replayed].sort()).toEqual([false, true]);
  expect((await request('/api/conversations', { title: 'Changed input' }, { key })).status).toBe(409);
  const path = `/api/conversations/${a.body.conversation.id}/turns`;
  const turnKey = randomUUID();
  const taskCount = Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count);
  const rightKey = randomUUID();
  const proposals = await Promise.all([request(path, { expectedRevision: 0, text: 'left' }, { key: turnKey }), request(path, { expectedRevision: 0, text: 'right' }, { key: rightKey })]);
  expect(proposals.map(result => result.status).sort()).toEqual([202, 409]);
  expect(Number((await pool.query('SELECT count(*) FROM flow.tasks')).rows[0].count)).toBe(taskCount + 1);
  const winner = proposals.find(result => result.status === 202)!;
  expect((await request(`${path}?limit=50`)).body.turns).toHaveLength(1);
  expect((await request(path, { expectedRevision: 0, text: 'stale' })).body.error.code).toBe('conversation_revision_conflict');
  const winnerKey = proposals[0]!.status === 202 ? turnKey : rightKey;
  const replay = await request(path, { expectedRevision: 0, text: winner.body.turn.user.text }, { key: winnerKey });
  expect(replay.body).toEqual({ ...winner.body, replayed: true });
  expect((await request(path, { expectedRevision: 0, text: 'altered' }, { key: winnerKey })).status).toBe(409);
  await request(`/api/tasks/${winner.body.turn.task.id}/cancel`, {});
  expect((await request(path, { expectedRevision: 0, text: winner.body.turn.user.text }, { key: winnerKey })).body).toEqual({ ...winner.body, replayed: true });
  expect((await request(path, { expectedRevision: 1, text: 'follow up without session' })).body.error.code).toBe('conversation_resume_unavailable');
});

it('rejects unsupported queue, steer and requested controls without admitting a task', async () => {
  for (const requested of [{ model: 'specific-model' }, { thinking: 'enabled' }, { thinking: 'adaptive' }, { tools: 'none' }]) {
    const response = await request('/api/conversations', { title: 'Unsupported setting', requested });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conversation_settings_unsupported');
  }
  const conversation = (await request('/api/conversations', { title: 'Unsupported modes' })).body.conversation;
  const path = `/api/conversations/${conversation.id}/turns`;
  for (const mode of ['queue', 'steer']) expect((await request(path, { expectedRevision: 0, text: 'hi', mode })).body.error.code).toBe('conversation_mode_unsupported');
  expect((await request(path, { expectedRevision: 0, text: '   ' })).status).toBe(400);
  expect((await request(path, { expectedRevision: 0, text: 'hi', surprise: true })).status).toBe(400);
  expect((await request(path, { expectedRevision: 0, text: 'x'.repeat(16001) })).status).toBe(400);
  expect((await request(`/api/conversations/${conversation.id}`)).body).toMatchObject({ conversation: { revision: 0 }, lastTurn: null });
});

it('rejects follow-up while queued, running, waiting, cancelling or uncertain without duplicating work', async () => {
  const { conversation, turn } = await newTurn();
  const next = () => request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 1, text: 'do not queue me' });
  expect((await next()).body.error.code).toBe('conversation_busy');
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  expect((await next()).body.error.code).toBe('conversation_busy');
  expect((await report(runner.token, assignment, [finalEvents(randomUUID())[0]!, { type: 'decision', decisionId: 'approve-read', prompt: 'May I read?' }])).status).toBe(200);
  expect((await next()).body.error.code).toBe('conversation_busy');
  await request(`/api/tasks/${turn.task.id}/cancel`, {});
  expect((await next()).body.error.code).toBe('conversation_busy');
  await expect.poll(async () => (await request(`/api/tasks/${turn.task.id}`)).body.status, { timeout: 5000 }).toBe('uncertain');
  expect((await next()).body.error.code).toBe('conversation_busy');
  expect((await report(runner.token, assignment, [{ type: 'completed', outcome: 'succeeded' }], 3)).status).toBe(409);
  const snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(snapshot.conversation.revision).toBe(1);
  expect(snapshot.lastTurn.assistant).toEqual({ state: 'unavailable', reason: 'execution-not-succeeded' });
});

it.each(['unknown-adapter', 'missing-session', 'missing-result', 'ambiguous-result', 'invalid-result'] as const)('keeps %s unavailable instead of guessing from telemetry or a title', async reason => {
  const { conversation } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  let events = finalEvents(randomUUID());
  if (reason === 'unknown-adapter') events[0] = { type: 'session', nativeSessionId: randomUUID(), adapterVersion: 'claude-sdk-unknown' };
  if (reason === 'missing-session') events = events.filter(event => event.type !== 'session');
  if (reason === 'missing-result') events = events.filter(event => !['artifact', 'verification'].includes(event.type));
  if (reason === 'ambiguous-result') events.splice(2, 0, { type: 'artifact', artifactId: 'ambiguous', title: 'Claude result', version: digest('different'), content: 'different', mediaType: 'text/plain' });
  if (reason === 'invalid-result') events = events.filter(event => event.type !== 'verification');
  expect((await report(runner.token, assignment, events)).status).toBe(200);
  const snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(snapshot.lastTurn.assistant).toEqual({ state: 'unavailable', reason });
  if (['unknown-adapter', 'missing-session'].includes(reason)) expect(snapshot.lastTurn.effective).toEqual({ model: null, thinking: 'unknown', tools: 'unknown', source: null });
});


it('maps the actual Claude adapter final-result path through the runner using only an injected SDK', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-chat01-runner-'));
  const controller = new AbortController();
  const nativeSessionId = randomUUID();
  let calls = 0;
  const query: ClaudeQuery = ({ options, prompt }) => Object.assign((async function* () {
    calls += 1;
    expect(prompt).toBe(calls === 1 ? 'first user message' : 'a normal follow-up');
    expect(options!.resume).toBe(calls === 1 ? undefined : nativeSessionId);
    expect(options!.thinking).toEqual({ type: 'disabled' });
    yield { type: 'system', subtype: 'init', session_id: nativeSessionId, model: 'injected-model', claude_code_version: 'injected', tools: [], plugins: [], skills: [], mcp_servers: [] } as unknown as QueryMessage;
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: nativeSessionId, result: `Injected final ${calls}`, modelUsage: {}, permission_denials: [] } as unknown as QueryMessage;
  })(), { close() {} });
  const running = runRunner({ baseUrl, token: runner.token, workingDirectory, signal: controller.signal, pollIntervalMs: 25, heartbeatIntervalMs: 100,
    adapters: [createClaudeAdapter({ materialFiles: [], query, timeoutMs: 2000 })] });
  try {
    await expect.poll(async () => (await request(`/api/tasks/${turn.task.id}`)).body.status).toBe('succeeded');
    let snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
    expect(snapshot.lastTurn.assistant).toMatchObject({ state: 'available', text: 'Injected final 1', source: { kind: 'assistant-final', source: 'claude.sdk.result' } });
    expect(snapshot.lastTurn.effective).toMatchObject({ model: 'injected-model', thinking: 'unknown', tools: [], permissionMode: null, runnerRequested: { model: 'sonnet', thinking: 'disabled' }, source: { kind: 'assistant-final' } });
    const followup = await request(`/api/conversations/${conversation.id}/turns`, { expectedRevision: 1, text: 'a normal follow-up' });
    expect(followup.status).toBe(202);
    await expect.poll(async () => (await request(`/api/tasks/${followup.body.turn.task.id}`)).body.status).toBe('succeeded');
    snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
    expect(snapshot.lastTurn.assistant.text).toBe('Injected final 2');
    expect(snapshot.nativeSession.nativeSessionId).toBe(nativeSessionId);
    expect(calls).toBe(2);
    const firstPage = (await request(`/api/conversations/${conversation.id}/turns?limit=1`)).body;
    expect(firstPage.nextCursor).toBe(1);
    const secondPage = (await request(`/api/conversations/${conversation.id}/turns?after=1&limit=1`)).body;
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.turns[0].number).toBe(2);
    expect((await request(`/api/conversations/${conversation.id}/turns/${turn.id}/details/${secondPage.turns[0].assistant.contentRef.id}`)).status).toBe(404);
  } finally { controller.abort(); await running; await rm(workingDirectory, { recursive: true, force: true }); }
});

it('never promotes retained artifacts belonging to a superseded attempt', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  expect((await report(runner.token, assignment, finalEvents(randomUUID()))).status).toBe(200);
  // Defensive imported-history fixture: normal center commands never revive a completed attempt.
  const replacement = randomUUID();
  await pool.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at)
    VALUES($1,$2,$3,$4,clock_timestamp(),clock_timestamp())`, [replacement, turn.task.id, runner.runnerId, assignment.attempt.ownerVersion + 1]);
  await pool.query('UPDATE flow.tasks SET current_attempt_id=$2,owner_version=owner_version+1 WHERE id=$1', [turn.task.id, replacement]);
  const snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(snapshot.lastTurn.assistant).toEqual({ state: 'unavailable', reason: 'missing-session' });
  expect((await report(runner.token, assignment, [{ type: 'message', text: 'late old owner' }], 6)).status).toBe(409);
});


it('leaves the effective model unknown when the session did not record one', async () => {
  const { conversation } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const events = finalEvents(randomUUID());
  events[0] = { type: 'session', nativeSessionId: randomUUID(), adapterVersion: 'claude-sdk-0.3.290-v1' };
  expect((await report(runner.token, assignment, events)).status).toBe(200);
  const turn = (await request(`/api/conversations/${conversation.id}`)).body.lastTurn;
  expect(turn.assistant.state).toBe('available');
  expect(turn.effective).toMatchObject({ model: null, thinking: 'disabled', tools: 'configured-readonly', source: { kind: 'recorded-adapter-session' } });
});


function typedFinal(sessionId: string, content = 'Typed assistant text'): RunnerEventData {
  const sourceMessageId = randomUUID();
  return { type: 'assistant-final', messageId: digest(JSON.stringify([sessionId, sourceMessageId])), nativeSessionId: sessionId,
    source: 'claude.sdk.result', sourceMessageId, content,
    settings: { requested: { model: 'requested-runner-model', permissionMode: 'dontAsk', thinking: 'disabled' },
      effective: { model: 'reported-effective-model', permissionMode: 'default', tools: ['Read', 'ActualToolName'], thinking: 'unknown' } } };
}
function typedEvents(sessionId: string, content = 'Typed assistant text'): RunnerEventData[] {
  const events = finalEvents(sessionId, 'Artifact evidence, not the assistant source');
  events[0] = { type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2', resources: ['model:do-not-infer-from-legacy-resource'] };
  events.splice(events.length - 1, 0, typedFinal(sessionId, content));
  return events;
}
it('prioritizes a typed final over artifacts and reports actual settings without overwriting unknown thinking', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const sessionId = randomUUID();
  const events = typedEvents(sessionId);
  expect((await report(runner.token, assignment, events)).status).toBe(200);
  const snapshot = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(snapshot.conversation.revision).toBe(1);
  expect(snapshot.conversation.requested.model).toBe('runner-default');
  expect(snapshot.lastTurn.task.updatedAt).toEqual(expect.any(String));
  expect(snapshot.lastTurn.assistant).toMatchObject({ state: 'available', text: 'Typed assistant text', source: { kind: 'assistant-final', source: 'claude.sdk.result', taskId: turn.task.id, attemptId: assignment.attempt.id, nativeSessionId: sessionId, contentDigest: digest('Typed assistant text') } });
  expect(snapshot.lastTurn.effective).toMatchObject({ model: 'reported-effective-model', permissionMode: 'default', thinking: 'unknown', tools: ['Read', 'ActualToolName'], runnerRequested: { model: 'requested-runner-model', thinking: 'disabled' }, source: { kind: 'assistant-final' } });
  const ref = snapshot.lastTurn.assistant.contentRef;
  expect(ref.kind).toBe('detail');
  expect((await request(`/api/conversations/${conversation.id}/turns/${turn.id}/details/${ref.id}`)).body.content).toBe('Typed assistant text');
});

it('never falls back to a v1 artifact when a v2 attempt lacks its typed final', async () => {
  const { conversation } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const events = typedEvents(randomUUID()).filter(event => event.type !== 'assistant-final');
  expect((await report(runner.token, assignment, events)).status).toBe(200);
  const turn = (await request(`/api/conversations/${conversation.id}`)).body.lastTurn;
  expect(turn.assistant).toEqual({ state: 'unavailable', reason: 'missing-result' });
  expect(turn.effective).toEqual({ model: null, thinking: 'unknown', tools: 'unknown', source: null });
});

it('keeps a typed final pending until task success and deduplicates it through restart and replay', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const events = typedEvents(randomUUID());
  const batch = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: events.map((event, index) => ({ ...event, sequence: index + 1, id: randomUUID() })) };
  expect((await request('/api/runner/events', { ...batch, events: batch.events.slice(0, -1) }, { token: runner.token })).status).toBe(200);
  const pending = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(pending.lastTurn.assistant).toEqual({ state: 'pending', reason: 'execution-pending' });
  expect((await request('/api/runner/events', { ...batch, events: batch.events.slice(-1) }, { token: runner.token })).status).toBe(200);
  const completed = (await request(`/api/conversations/${conversation.id}`)).body;
  expect(completed.conversation.revision).toBe(pending.conversation.revision);
  expect(completed.lastTurn.task.status).toBe('succeeded');
  expect(completed.lastTurn.assistant.source.contentDigest).toBe(digest('Typed assistant text'));
  await stopServer(); await startServer();
  expect((await request('/api/runner/events', batch, { token: runner.token })).body).toEqual({ accepted: 0, lastSequence: batch.events.length });
  expect((await request(`/api/conversations/${conversation.id}`)).body).toEqual(completed);
  expect((await request(`/api/tasks/${turn.task.id}/assistant-messages`)).body.messages).toHaveLength(1);
  const changed = { ...batch.events[batch.events.length - 2], content: 'changed' };
  expect((await request('/api/runner/events', { ...batch, events: [changed] }, { token: runner.token })).status).toBe(409);
});

it('rejects foreign task/session/fence reports and confines each typed lazy reference to its bound turn', async () => {
  const a = await newTurn();
  const runnerA = await newRunner();
  const assignmentA = await claim(runnerA.token);
  const b = await newTurn();
  const runnerB = await newRunner();
  const assignmentB = await claim(runnerB.token);
  const sessionA = randomUUID();
  const eventsA = typedEvents(sessionA, 'Only conversation A');
  expect((await report(runnerB.token, assignmentA, eventsA)).status).toBe(403);
  expect((await report(runnerA.token, { ...assignmentA, attempt: { ...assignmentA.attempt, ownerVersion: assignmentA.attempt.ownerVersion + 1 } }, eventsA)).status).toBe(409);
  const wrongSession = eventsA.map(event => event.type === 'assistant-final' ? typedFinal(randomUUID(), 'wrong session') : event);
  expect((await report(runnerA.token, assignmentA, wrongSession)).status).toBe(409);
  expect((await request(`/api/tasks/${a.turn.task.id}/assistant-messages`)).body.messages).toEqual([]);
  expect((await report(runnerA.token, assignmentA, eventsA)).status).toBe(200);
  expect((await report(runnerB.token, assignmentB, typedEvents(randomUUID(), 'Only conversation B'))).status).toBe(200);
  const snapshotA = (await request(`/api/conversations/${a.conversation.id}`)).body;
  const snapshotB = (await request(`/api/conversations/${b.conversation.id}`)).body;
  expect(snapshotA.lastTurn.assistant.text).toBe('Only conversation A');
  expect(snapshotB.lastTurn.assistant.text).toBe('Only conversation B');
  expect((await request(`/api/conversations/${b.conversation.id}/turns/${b.turn.id}/details/${snapshotA.lastTurn.assistant.contentRef.id}`)).status).toBe(404);
});

it('does not reuse an old typed final after the current attempt binding changes', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const sessionId = randomUUID();
  expect((await report(runner.token, assignment, typedEvents(sessionId))).status).toBe(200);
  const replacement = randomUUID();
  // Imported-history fence fixture, as in the legacy-attempt test; no production revive command is added.
  await pool.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,native_session_id,lease_expires_at,completed_at)
    VALUES($1,$2,$3,$4,$5,clock_timestamp(),clock_timestamp())`, [replacement, turn.task.id, runner.runnerId, assignment.attempt.ownerVersion + 1, sessionId]);
  await pool.query('UPDATE flow.tasks SET current_attempt_id=$2,owner_version=owner_version+1 WHERE id=$1', [turn.task.id, replacement]);
  const sessionDetail = { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' };
  await pool.query(`INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Imported session','session',$4,'application/json')`, [randomUUID(), turn.task.id, replacement, JSON.stringify(sessionDetail)]);
  expect((await request(`/api/conversations/${conversation.id}`)).body.lastTurn.assistant).toEqual({ state: 'unavailable', reason: 'missing-result' });
});

it('does not expose a reply when the actual adapter receives a non-success SDK result', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-chat01-failure-'));
  const controller = new AbortController();
  const query: ClaudeQuery = () => Object.assign((async function* () {
    yield { type: 'result', subtype: 'error_during_execution', is_error: true, uuid: randomUUID(), session_id: randomUUID(), errors: ['Synthetic failure'], result: 'must not become a reply', modelUsage: {}, permission_denials: [] } as unknown as QueryMessage;
  })(), { close() {} });
  const running = runRunner({ baseUrl, token: runner.token, workingDirectory, signal: controller.signal, pollIntervalMs: 25, heartbeatIntervalMs: 100,
    adapters: [createClaudeAdapter({ materialFiles: [], query, timeoutMs: 2000 })] });
  try {
    await expect.poll(async () => (await request(`/api/tasks/${turn.task.id}`)).body.status).toBe('failed');
    expect((await request(`/api/conversations/${conversation.id}`)).body.lastTurn.assistant).toEqual({ state: 'unavailable', reason: 'execution-not-succeeded' });
    expect((await request(`/api/tasks/${turn.task.id}/assistant-messages`)).body.messages).toEqual([]);
  } finally { controller.abort(); await running; await rm(workingDirectory, { recursive: true, force: true }); }
});

it('keeps a corrupted typed body unavailable without falling back to its intact artifact', async () => {
  const { conversation } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  expect((await report(runner.token, assignment, typedEvents(randomUUID()))).status).toBe(200);
  const before = (await request(`/api/conversations/${conversation.id}`)).body.lastTurn.assistant;
  await pool.query('UPDATE flow.details SET content=$2 WHERE id=$1', [before.contentRef.id, 'Corrupted imported detail']);
  const after = await request(`/api/conversations/${conversation.id}`);
  expect(after.status).toBe(200);
  expect(after.body.lastTurn.assistant).toEqual({ state: 'unavailable', reason: 'invalid-result' });
});


it('preserves null effective facts and exposes long typed content through its exact detail', async () => {
  const { conversation, turn } = await newTurn();
  const runner = await newRunner();
  const assignment = await claim(runner.token);
  const content = 'x' + '中文🙂'.repeat(1800);
  const events = typedEvents(randomUUID(), content).map(event => event.type === 'assistant-final'
    ? { ...event, settings: { ...event.settings, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' as const } } } : event);
  expect((await report(runner.token, assignment, events)).status).toBe(200);
  const view = (await request(`/api/conversations/${conversation.id}`)).body.lastTurn;
  expect(view.effective).toMatchObject({ model: null, permissionMode: null, tools: null, thinking: 'unknown', runnerRequested: { model: 'requested-runner-model' } });
  expect(view.assistant.truncated).toBe(true);
  expect(view.assistant.text.length).toBeLessThanOrEqual(4000);
  expect(/[\uD800-\uDBFF]$/.test(view.assistant.text)).toBe(false);
  expect(view.assistant.source.contentDigest).toBe(digest(content));
  expect((await request(`/api/conversations/${conversation.id}/turns/${turn.id}/details/${view.assistant.contentRef.id}`)).body.content).toBe(content);
});
