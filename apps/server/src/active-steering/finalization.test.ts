import { describeExecutionProfile, guardExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { sha256 } from '../database.js';
import { verifyText } from '../../../runner/src/verifier.js';
import { migrateActiveSteering, registerActiveSteeringRoutes } from './index.js';
const database = `flow_chat08_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
let app: Awaited<ReturnType<typeof createServer>>, base = '', created = false;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  const configuration = { databaseUrl, ownerToken: 'chat08-owner', automaticQueueScan: false, leaseMs: 300_000, activeSteering: true };
  app = await createServer(configuration);
  await migrateActiveSteering(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/steering/finalize' })) registerActiveSteeringRoutes(app, pool, { acceptCommands: true });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => { try { if (app) { app.server.closeAllConnections(); await app.close(); } } finally { await pool.end(); try { if (created) await admin.query(`DROP DATABASE ${database}`); } finally { await admin.end(); } } });
async function request(path: string, body?: unknown, token = 'chat08-owner', status = 200) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const value = await response.json(); expect(response.status, JSON.stringify(value)).toBe(status); return value;
}
async function attempt() {
  const runner = await request('/api/runners', { name: 'Conditional final runner', harnesses: ['claude'], capacity: 1 });
  const profile = await publishSteeringProfile(runner);
  const task = (await request('/api/tasks', { executionProfile: profile.reference, title: 'Conditional final', prompt: 'Synthetic SDK only', harness: 'claude' }, undefined, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const claim = await request('/api/runner/claim', {}, runner.token);
  expect(claim.assignment.task.id).toBe(task.id);
  const a = { ...runner, taskId: task.id, ownership: { attemptId: claim.assignment.attempt.id, ownerVersion: claim.assignment.attempt.ownerVersion }, session: randomUUID(), sequence: 0 };
  await emit(a, { type: 'session', nativeSessionId: a.session, adapterVersion: 'claude-sdk-0.3.290-v2' }); return a;
}
async function emit(a: any, event: any) { return request('/api/runner/events', { ...a.ownership, events: [{ ...event, id: randomUUID(), sequence: ++a.sequence }] }, a.token); }
function result(a: any, id: string, text: string, uuids: string[] = [], queuedTurnCount: number | null = 0) {
  return { nativeSessionId: a.session, sourceMessageId: id, consumedUserMessageUuids: uuids, queuedTurnCount, outcome: 'success', contentDigest: sha256(text) };
}
function proposal(a: any, resultId: string, text: string, expectedRevision = 0) {
  const artifactId = randomUUID();
  const data = [{ type: 'artifact', artifactId, title: 'Claude result', version: sha256(text), content: text, mediaType: 'text/plain' }, verifyText(artifactId, text),
    { type: 'assistant-final', messageId: sha256(JSON.stringify([a.session, resultId])), nativeSessionId: a.session, source: 'claude.sdk.result', sourceMessageId: resultId, content: text,
      settings: { requested: { model: 'synthetic', thinking: 'disabled', permissionMode: 'dontAsk' }, effective: { model: 'synthetic', thinking: 'unknown', permissionMode: 'dontAsk', tools: [] } } }];
  return { ...a.ownership, proposalId: randomUUID(), expectedRevision, afterSequence: a.sequence, nativeSessionId: a.session, resultId, events: data.map((event, index) => ({ ...event, id: randomUUID(), sequence: a.sequence + index + 1 })) };
}
it('commits one local-verifier final proposal atomically after observed result and replays its receipt', async () => {
  const a = await attempt(), id = randomUUID();
  await emit(a, { type: 'steering-result', result: result(a, id, 'Final text') });
  const input = proposal(a, id, 'Final text');
  const committed = await request('/api/runner/steering/finalize', input, a.token);
  expect(committed).toMatchObject({ state: 'committed', proposalId: input.proposalId, lastSequence: a.sequence + 3, replayed: false });
  expect(await request('/api/runner/steering/finalize', input, a.token)).toEqual({ ...committed, replayed: true });
  const snapshot = await request(`/api/tasks/${a.taskId}`);
  expect(snapshot.status).toBe('running'); expect(snapshot.verificationStatus).toBe('passed');
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
});
async function command(a: any, revision = 0) {
  return (await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: revision, text: 'Use the revised instruction' }, undefined, 202)).command;
}
async function consume(a: any, c: any, sourceId = randomUUID()) {
  const receipt = { ...a.ownership, commandId: c.id, nativeSessionId: a.session, userMessageUuid: c.userMessageUuid };
  await emit(a, { type: 'steering-receipt', receipt: { ...receipt, receiptId: randomUUID(), expectedReceiptRevision: 0, phase: 'received' } });
  await emit(a, { type: 'steering-receipt', receipt: { ...receipt, receiptId: randomUUID(), expectedReceiptRevision: 1, phase: 'observed-consumed', sourceMessageId: sourceId, sourceType: 'assistant', parentToolUseId: null, consumedUserMessageUuids: [c.userMessageUuid] } });
}
it('does not mistake a root consumption receipt for coverage by an older result; a later result settles in the same attempt', async () => {
  const a = await attempt(), first = randomUUID(), second = randomUUID();
  await emit(a, { type: 'steering-result', result: result(a, first, 'Old reply') });
  const c = await command(a); await consume(a, c);
  expect(await request('/api/runner/steering/finalize', proposal(a, first, 'Old reply', 1), a.token)).toMatchObject({ state: 'not-committed', reason: 'uncovered-command' });
  expect((await request(`/api/tasks/${a.taskId}`)).latestArtifact).toBeUndefined();
  await emit(a, { type: 'steering-result', result: result(a, second, 'Revised reply', [c.userMessageUuid]) });
  expect(await request('/api/runner/steering/finalize', proposal(a, second, 'Revised reply', 1), a.token)).toMatchObject({ state: 'committed' });
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
});
it.each([null, 1])('does not finalize when the SDK pending count is %s', async count => {
  const a = await attempt(), id = randomUUID();
  await emit(a, { type: 'steering-result', result: result(a, id, 'Maybe final', [], count) });
  expect(await request('/api/runner/steering/finalize', proposal(a, id, 'Maybe final'), a.token)).toMatchObject({ state: 'not-committed', reason: 'sdk-pending' });
});
it('preserves successful coverage over three results and deduplicates an earlier replay without moving the frontier', async () => {
  const a = await attempt(), first = randomUUID(), second = randomUUID(), third = randomUUID();
  const c1 = await command(a); await consume(a, c1);
  const r1 = result(a, first, 'First', [c1.userMessageUuid]); await emit(a, { type: 'steering-result', result: r1 });
  const c2 = await command(a, 1); await consume(a, c2);
  await emit(a, { type: 'steering-result', result: result(a, second, 'Second', [c2.userMessageUuid], 1) });
  await emit(a, { type: 'steering-result', result: result(a, third, 'Third') });
  await emit(a, { type: 'steering-result', result: r1 });
  expect(await request('/api/runner/steering/finalize', proposal(a, third, 'Third', 2), a.token)).toMatchObject({ state: 'committed' });
  expect((await pool.query("SELECT 1 FROM flow.steering_audit WHERE attempt_id=$1 AND action='result-observed'", [a.ownership.attemptId])).rowCount).toBe(3);
});
it('rolls the seal and artifact back if the exact local verifier assertion is wrong', async () => {
  const a = await attempt(), id = randomUUID(); await emit(a, { type: 'steering-result', result: result(a, id, 'Verified') });
  const input = proposal(a, id, 'Verified'); (input.events[1] as any).result = 'failed';
  await request('/api/runner/steering/finalize', input, a.token, 409);
  expect((await pool.query('SELECT 1 FROM flow.steering_attempts WHERE attempt_id=$1 AND seal IS NOT NULL', [a.ownership.attemptId])).rowCount).toBe(0);
  expect((await pool.query('SELECT 1 FROM flow.artifacts WHERE attempt_id=$1', [a.ownership.attemptId])).rowCount).toBe(0);
  expect(await request('/api/runner/steering/proposals/status', { ...a.ownership, proposalId: input.proposalId }, a.token)).toMatchObject({ state: 'absent' });
});
it('serializes a command/final race: command wins and no final exists, or final wins and admission is rejected', async () => {
  const a = await attempt(), id = randomUUID(); await emit(a, { type: 'steering-result', result: result(a, id, 'Race') });
  const input = proposal(a, id, 'Race');
  const send = (path: string, body: unknown, token: string) => fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const [finalResponse, commandResponse] = await Promise.all([send('/api/runner/steering/finalize', input, a.token), send(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'Race instruction' }, 'chat08-owner')]);
  const final = await finalResponse.json(); expect(finalResponse.status).toBe(200);
  if (final.state === 'committed') expect(commandResponse.status).toBe(409);
  else { expect(final.reason).toBe('control-changed'); expect(commandResponse.status).toBe(202); }
  expect((await pool.query('SELECT 1 FROM flow.assistant_messages WHERE attempt_id=$1', [a.ownership.attemptId])).rowCount).toBe(final.state === 'committed' ? 1 : 0);
});
it('replays a committed receipt after completion but rejects changed payload, wrong credentials and stale ownership', async () => {
  const a = await attempt(), id = randomUUID(); await emit(a, { type: 'steering-result', result: result(a, id, 'Durable') });
  const input = proposal(a, id, 'Durable'); await request('/api/runner/steering/finalize', input, a.token); a.sequence += 3;
  await emit(a, { type: 'completed', outcome: 'succeeded' });
  expect(await request('/api/runner/steering/proposals/status', { ...a.ownership, proposalId: input.proposalId }, a.token)).toMatchObject({ state: 'committed', replayed: true });
  await request('/api/runner/steering/finalize', { ...input, expectedRevision: 1 }, a.token, 409);
  await request('/api/runner/steering/proposals/status', { ...a.ownership, proposalId: input.proposalId }, 'wrong', 401);
  await request('/api/runner/steering/proposals/status', { ...a.ownership, ownerVersion: 999, proposalId: input.proposalId }, a.token, 409);
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;
type SDKUserMessage = Exclude<Parameters<ClaudeQuery>[0]['prompt'], string> extends AsyncIterable<infer Message> ? Message : never;
import { runRunner } from '../../../runner/src/runtime.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
function sdkResult(session: string, uuid: string, text: string, consumed: string[], pending: number): SDKMessage {
  return { type: 'result', subtype: 'success', is_error: false, uuid, session_id: session, result: text, user_message_uuids: consumed, queued_turn_count: pending,
    modelUsage: { synthetic: { inputTokens: pending ? 2 : 5, outputTokens: pending ? 3 : 8, costUSD: pending ? 0.001 : 0.002 } }, permission_denials: [] } as unknown as SDKMessage;
}
async function eventually(read: () => Promise<boolean>) {
  const until = Date.now() + 8000; while (!await read()) { if (Date.now() > until) throw new Error('Timed out waiting for the synthetic runner'); await sleep(20); }
}
it('connects one SDK streaming-input query through the real runtime, durable outbox and PG with two results and one consumed command', async () => {
  const runner = await request('/api/runners', { name: 'Injected native runtime', harnesses: ['claude'], capacity: 1 });
  const options = { materialFiles: [], maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 6000 };
  const profile = await publishSteeringProfile(runner, options);
  const task = (await request('/api/tasks', { executionProfile: profile.reference, title: 'Real transport / synthetic provider', prompt: 'Initial instruction', harness: 'claude' }, undefined, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat08-runtime-')), stop = new AbortController();
  const session = randomUUID(), sent: SDKUserMessage[] = []; let queryCount = 0, closed = 0;
  const query: ClaudeQuery = ({ prompt, options }) => Object.assign((async function* () {
    queryCount++; expect(typeof prompt).not.toBe('string'); expect(options!.maxBudgetUsd).toBe(0.2); expect(options!.maxTurns).toBe(2);
    const input = (prompt as AsyncIterable<SDKUserMessage>)[Symbol.asyncIterator](); sent.push((await input.next()).value!);
    yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: session, tools: [], plugins: [], skills: [], mcp_servers: [], model: 'synthetic', permissionMode: 'dontAsk', claude_code_version: 'injected' } as unknown as SDKMessage;
    yield sdkResult(session, 'intermediate-result', 'Before steering', [], 1);
    expect((await request(`/api/tasks/${task.id}/assistant-messages`)).messages).toHaveLength(0);
    const current = (await pool.query('SELECT id,owner_version FROM flow.attempts WHERE task_id=$1', [task.id])).rows[0];
    const c = (await request(`/api/tasks/${task.id}/steering`, { attemptId: current.id, ownerVersion: current.owner_version, expectedRevision: 0, text: 'Return revised answer' }, undefined, 202)).command;
    sent.push((await input.next()).value!); expect(sent[1]!.uuid).toBe(c.userMessageUuid);
    const frame = (event: object) => ({ type: 'stream_event', uuid: randomUUID(), session_id: session, parent_tool_use_id: null, user_message_uuids: [c.userMessageUuid], event } as unknown as SDKMessage);
    yield frame({ type: 'message_start', message: { id: 'after-steer', content: [] } });
    yield frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    yield frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Revised 你好🙂' } });
    yield sdkResult(session, 'final-result', 'Revised 你好🙂', [c.userMessageUuid], 0);
    await input.next();
  })(), { close() { closed++; } });
  const running = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: stop.signal, activeSteering: true, heartbeatIntervalMs: 50, pollIntervalMs: 20,
    adapters: [guardExecutionProfile(createClaudeAdapter({ ...options, query }), profile.reference, profile.configuration)] });
  try {
    await eventually(async () => (await request(`/api/tasks/${task.id}`)).status === 'succeeded');
    expect(queryCount).toBe(1); expect(closed).toBe(1); expect(sent.map(value => value.message.content)).toEqual(['Initial instruction', 'Return revised answer']);
    const messages = await request(`/api/tasks/${task.id}/assistant-messages`); expect(messages.messages).toHaveLength(1); expect(messages.messages[0].sourceMessageId).toBe('final-result');
    const snapshot = await request(`/api/tasks/${task.id}`); expect(snapshot.usage).toMatchObject({ inputTokens: 5, outputTokens: 8, costUsd: 0.002 });
    const attempts = (await pool.query('SELECT id FROM flow.attempts WHERE task_id=$1', [task.id])).rows; expect(attempts).toHaveLength(1);
    const state = await request(`/api/tasks/${task.id}/steering`); expect(state.commands[0].status).toBe('observed-consumed'); expect(state.sealed).toBe(true);
    const patch = (await pool.query('SELECT sequence FROM flow.assistant_stream_patches WHERE attempt_id=$1', [attempts[0].id])).rows;
    expect(patch.length).toBeGreaterThan(0);
    expect(patch.every(row => row.sequence < messages.messages[0].sequence)).toBe(true);
    // close() is observed; injected SDK exit does not prove a real provider shutdown.
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});
it('rejects bypass of the conditional final endpoint once an attempt has steering control', async () => {
  const a = await attempt(), id = randomUUID(); await emit(a, { type: 'steering-result', result: result(a, id, 'Bypass') });
  const input = proposal(a, id, 'Bypass');
  await request('/api/runner/events', { ...a.ownership, events: input.events }, a.token, 409);
  expect((await pool.query('SELECT 1 FROM flow.artifacts WHERE attempt_id=$1', [a.ownership.attemptId])).rowCount).toBe(0);
});
it('enforces the result evidence bound at the HTTP ingress while identical replays do not consume the limit', async () => {
  const a = await attempt();
  for (let index = 0; index < 65; index++) await emit(a, { type: 'steering-result', result: result(a, `bounded-${index}`, 'bounded') });
  await emit(a, { type: 'steering-result', result: result(a, 'bounded-0', 'bounded') });
  await request('/api/runner/events', { ...a.ownership, events: [{ type: 'steering-result', result: result(a, 'too-many', 'bounded'), id: randomUUID(), sequence: a.sequence + 1 }] }, a.token, 409);
  expect((await pool.query("SELECT 1 FROM flow.steering_audit WHERE attempt_id=$1 AND action='result-observed'", [a.ownership.attemptId])).rowCount).toBe(65);
});
it('actual cancellation closes a waiting native input and records delivered-but-unconfirmed steering as unknown without a final', async () => {
  const runner = await request('/api/runners', { name: 'Cancellation runtime', harnesses: ['claude'], capacity: 1 });
  const options = { materialFiles: [], timeoutMs: 6000 };
  const profile = await publishSteeringProfile(runner, options);
  const task = (await request('/api/tasks', { executionProfile: profile.reference, title: 'Cancel unknown delivery', prompt: 'Initial', harness: 'claude' }, undefined, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat08-cancel-')), stop = new AbortController();
  const session = randomUUID(); let closed = false, delivered = false, inputAborted = false;
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    const input = (prompt as AsyncIterable<SDKUserMessage>)[Symbol.asyncIterator](); await input.next();
    yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: session, tools: [], plugins: [], skills: [], mcp_servers: [], model: 'synthetic', permissionMode: 'dontAsk', claude_code_version: 'injected' } as unknown as SDKMessage;
    const a = (await pool.query('SELECT id,owner_version FROM flow.attempts WHERE task_id=$1', [task.id])).rows[0];
    await request(`/api/tasks/${task.id}/steering`, { attemptId: a.id, ownerVersion: a.owner_version, expectedRevision: 0, text: 'Unconfirmed instruction' }, undefined, 202);
    await input.next(); delivered = true;
    await request(`/api/tasks/${task.id}/cancel`, {});
    try { await input.next(); } catch { inputAborted = true; }
  })(), { close() { closed = true; } });
  const running = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: stop.signal, activeSteering: true, heartbeatIntervalMs: 30, pollIntervalMs: 20, adapters: [guardExecutionProfile(createClaudeAdapter({ ...options, query }), profile.reference, profile.configuration)] });
  try {
    await eventually(async () => (await request(`/api/tasks/${task.id}`)).status === 'cancelled');
    expect(delivered).toBe(true); expect(inputAborted).toBe(true); expect(closed).toBe(true);
    expect((await request(`/api/tasks/${task.id}/assistant-messages`)).messages).toHaveLength(0);
    expect((await request(`/api/tasks/${task.id}/steering`)).commands[0].status).toBe('unknown');
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});

import { writeFile } from 'node:fs/promises';
import { FinalProposalJournal } from '../../../runner/src/active-steering/proposal.js';
it('uses the strict HTTP lookup shape after a lost ACK and after a process restart', async () => {
  const a = await attempt(), id = randomUUID(); await emit(a, { type: 'steering-result', result: result(a, id, 'Receipt recovery') });
  const input = proposal(a, id, 'Receipt recovery'), directory = await mkdtemp(join(tmpdir(), 'flow-chat08-real-receipt-'));
  try {
    const journal = new FinalProposalJournal(directory);
    const recovered = await journal.commit(input as any, {
      async submit(value) { await request('/api/runner/steering/finalize', value, a.token); throw new Error('Simulated response loss after real commit'); },
      status: value => request('/api/runner/steering/proposals/status', value, a.token),
    });
    expect(recovered).toMatchObject({ state: 'committed', replayed: true });
    await writeFile(join(directory, 'pending-final-proposal.json'), JSON.stringify(input), { mode: 0o600 });
    expect(await new FinalProposalJournal(directory).recover(value => request('/api/runner/steering/proposals/status', value, a.token))).toEqual({ attemptId: a.ownership.attemptId });
    expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
    expect((await request(`/api/tasks/${a.taskId}`)).status).toBe('running');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function publishSteeringProfile(runner: { token: string }, options: Parameters<typeof createClaudeAdapter>[0] = { materialFiles: [] }) {
  const configuration = describeExecutionProfile(options, createClaudeAdapter(options), true);
  return (await request('/api/runner/execution-profile', { configuration }, runner.token)).profile;
}
