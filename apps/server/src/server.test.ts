import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ClaimedTask } from '@flow/contracts';
import { createServer } from './index.js';

const databaseUrl = process.env.FLOW_TEST_DATABASE_URL ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_c01';
const testDatabase = new URL(databaseUrl);
if (testDatabase.pathname !== '/flow_c01' || testDatabase.hostname !== '127.0.0.1' || testDatabase.port !== '55432') throw new Error('C01 tests require the isolated local flow_c01 database.');
const ownerToken = 'c01-owner-test-token';
const ownerHeaders = { authorization: `Bearer ${ownerToken}` };
let server: FastifyInstance;
const submission = { title: 'A durable task', prompt: 'Summarize a fixture', harness: 'fixture' };
const post = (url: string, payload: unknown, token = ownerToken, key = randomUUID()) => server.inject({ method: 'POST', url, payload: payload as object, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key } });
const get = (url: string) => server.inject({ method: 'GET', url, headers: ownerHeaders });
async function register(harnesses = ['fixture'], capacity = 1) {
  const response = await post('/api/runners', { name: 'Test runner', harnesses, capacity });
  expect(response.statusCode).toBe(200);
  return response.json() as { runnerId: string; token: string };
}
async function claim(token: string) {
  let assignment: ClaimedTask | null = null;
  await expect.poll(async () => { assignment = (await post('/api/runner/claim', {}, token)).json().assignment; return assignment; }).toBeTruthy();
  return assignment!;
}
const ownership = (assignment: Awaited<ReturnType<typeof claim>>) => ({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

beforeEach(async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;');
  await pool.end();
  server = await createServer({ databaseUrl, ownerToken });
});
afterEach(async () => { await server?.close(); });

describe('center public HTTP interface', () => {
  it('atomically rejects gaps and mismatched ownership, and never revives expired work', async () => {
    await server.close();
    server = await createServer({ databaseUrl, ownerToken, leaseMs: 150 });
    const runner = await register();
    await post('/api/tasks', submission);
    const assignment = await claim(runner.token);
    const taskUrl = `/api/tasks/${assignment.task.id}`;
    const message = { id: 'first', sequence: 1, type: 'message', text: 'Once' };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [message, { ...message, id: 'gap', sequence: 3 }] }, runner.token)).statusCode).toBe(409);
    expect((await get(taskUrl)).json().entries).toEqual([]);
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [{ ...message, sequence: Number.MAX_SAFE_INTEGER }] }, runner.token)).statusCode).toBe(409);
    expect((await post('/api/runner/heartbeat', { ...ownership(assignment), ownerVersion: assignment.attempt.ownerVersion + 1 }, runner.token)).statusCode).toBe(409);
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [message] }, runner.token)).json()).toEqual({ accepted: 1, lastSequence: 1 });
    await expect.poll(async () => (await get(taskUrl)).json().status).toBe('uncertain');
    expect((await post('/api/runner/heartbeat', ownership(assignment), runner.token)).json().action).toBe('stop');
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [message] }, runner.token)).json()).toEqual({ accepted: 0, lastSequence: 1 });
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [{ ...message, id: 'new', sequence: 2 }] }, runner.token)).statusCode).toBe(409);
    const other = await register();
    expect((await post('/api/runner/claim', {}, other.token)).json().assignment).toBeNull();
    await server.close();
    server = await createServer({ databaseUrl, ownerToken });
    expect((await get(taskUrl)).json().status).toBe('uncertain');
    expect((await post('/api/runner/claim', {}, other.token)).json().assignment).toBeNull();
  });

  it('serializes concurrent claims and command retries, and retains cancellation history', async () => {
    const a = await register();
    const b = await register();
    const key = randomUUID();
    const accepted = await Promise.all([post('/api/tasks', submission, ownerToken, key), post('/api/tasks', submission, ownerToken, key)]);
    expect(accepted.map(response => response.json().replayed).sort()).toEqual([false, true]);
    const task = accepted[0]!.json().task;
    await server.close();
    server = await createServer({ databaseUrl, ownerToken });
    const claims = await Promise.all([post('/api/runner/claim', {}, a.token), post('/api/runner/claim', {}, b.token)]);
    expect(claims.filter(response => response.json().assignment)).toHaveLength(1);
    const winner = claims[0]!.json().assignment ? a : b;
    const assignment = claims.find(response => response.json().assignment)!.json().assignment;
    await post(`/api/tasks/${task.id}/cancel`, {});
    await post('/api/runner/events', { ...ownership(assignment), events: [{ id: 'done', sequence: 1, type: 'completed', outcome: 'cancelled' }] }, winner.token);
    expect((await get(`/api/tasks/${task.id}`)).json()).toMatchObject({ status: 'cancelled', entries: [{ text: 'Cancellation requested.' }] });
    const queued = (await post('/api/tasks', submission)).json().task;
    expect((await post(`/api/tasks/${queued.id}/cancel`, {})).json().status).toBe('cancelled');
    expect((await post('/api/runner/claim', {}, winner.token)).json().assignment).toBeNull();
    expect((await post(`/api/runners/${winner.runnerId}/revoke`, {})).json()).toEqual({ revoked: true });
    expect((await post('/api/runner/claim', {}, winner.token)).statusCode).toBe(401);
  });
  it('streams durable pages and state-only changes, then closes observers without cancelling work', async () => {
    const runner = await register();
    const task = (await post('/api/tasks', submission)).json().task;
    const baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${baseUrl}/api/tasks/${task.id}/stream?after=0`, { headers: ownerHeaders, signal: AbortSignal.timeout(10_000) });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    const nextPage = async () => {
      while (!buffered.includes('\n\n')) buffered += decoder.decode((await reader.read()).value, { stream: true });
      const split = buffered.indexOf('\n\n');
      const frame = buffered.slice(0, split);
      buffered = buffered.slice(split + 2);
      return JSON.parse(frame.split('\n').find(line => line.startsWith('data:'))!.slice(5));
    };
    expect(await nextPage()).toMatchObject({ nextCursor: 0, entries: [], task: { status: 'queued' } });
    const assignment = await claim(runner.token);
    expect(await nextPage()).toMatchObject({ nextCursor: 0, entries: [], task: { status: 'running' } });
    const events = Array.from({ length: 40 }, (_, index) => ({ id: `message-${index}`, sequence: index + 1, type: 'message', text: `Entry ${index}` }));
    expect((await post('/api/runner/events', { ...ownership(assignment), events }, runner.token)).statusCode).toBe(200);
    const first = await nextPage();
    expect(first).toMatchObject({ nextCursor: 32, watermark: 40, hasMore: true });
    expect(await nextPage()).toMatchObject({ nextCursor: 40, hasMore: false });
    await reader.cancel();
    expect((await get(`/api/tasks/${task.id}`)).json().status).toBe('running');
    const stillOpen = await fetch(`${baseUrl}/api/tasks/${task.id}/stream?after=40`, { headers: ownerHeaders, signal: AbortSignal.timeout(10_000) });
    await server.close();
    expect(await stillOpen.text()).toContain('event: update');
  });
  it('persists accepted commands across restart and rejects changed retries', async () => {
    expect((await server.inject({ url: '/api/tasks' })).statusCode).toBe(401);
    const key = randomUUID();
    const accepted = await post('/api/tasks', submission, ownerToken, key);
    expect(accepted.statusCode).toBe(202);
    const task = accepted.json().task;
    await server.close();
    server = await createServer({ databaseUrl, ownerToken });
    const replay = await post('/api/tasks', submission, ownerToken, key);
    expect(replay.json()).toEqual({ task, replayed: true });
    expect((await post('/api/tasks', { ...submission, prompt: 'different' }, ownerToken, key)).statusCode).toBe(409);
    expect((await get(`/api/tasks/${task.id}`)).json()).toMatchObject({ id: task.id, prompt: submission.prompt, status: 'queued' });
    expect((await get('/api/tasks')).json().tasks).toHaveLength(1);
  });

  it('claims once across runners and stores an atomic replayable completion', async () => {
    const a = await register();
    const b = await register();
    expect((await post('/api/runner/claim', {})).statusCode).toBe(403);
    expect((await post('/api/tasks', submission, a.token)).statusCode).toBe(403);
    const accepted = (await post('/api/tasks', submission)).json();
    const assignment = await claim(a.token);
    expect(assignment.task.id).toBe(accepted.task.id);
    expect((await post('/api/runner/claim', {}, b.token)).json().assignment).toBeNull();
    expect((await post('/api/runner/heartbeat', ownership(assignment), b.token)).statusCode).toBe(403);
    const events = [{ id: 'message-1', sequence: 1, type: 'message', text: 'Finished' }, { id: 'finish-1', sequence: 2, type: 'completed', outcome: 'succeeded' }];
    const batch = { ...ownership(assignment), events };
    expect((await post('/api/runner/events', batch, a.token)).json()).toEqual({ accepted: 2, lastSequence: 2 });
    expect((await post('/api/runner/events', batch, a.token)).json()).toEqual({ accepted: 0, lastSequence: 2 });
    expect((await get(`/api/tasks/${assignment.task.id}`)).json()).toMatchObject({ status: 'succeeded', verificationStatus: 'pending', entries: [{ kind: 'text', text: 'Finished' }] });
    expect((await post('/api/runner/events', { ...batch, events: [{ ...events[0], text: 'Changed' }] }, a.token)).statusCode).toBe(409);
  });

  it('retains a human decision across restart and distinguishes cancel request from stopped work', async () => {
    const runner = await register();
    await post('/api/tasks', submission);
    const assignment = await claim(runner.token);
    const taskUrl = `/api/tasks/${assignment.task.id}`;
    const decision = { id: 'decision-event', sequence: 1, type: 'decision', decisionId: 'approval-1', prompt: 'Continue?' };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [decision] }, runner.token)).statusCode).toBe(200);
    await server.close();
    server = await createServer({ databaseUrl, ownerToken });
    expect((await get(taskUrl)).json()).toMatchObject({ status: 'waiting', pendingDecision: { id: 'approval-1' } });
    expect((await post(`${taskUrl}/decision`, { decisionId: 'approval-1', answer: 'approve' })).json().status).toBe('running');
    expect((await post('/api/runner/heartbeat', ownership(assignment), runner.token)).json().decision).toEqual({ decisionId: 'approval-1', answer: 'approve' });
    expect((await post(`${taskUrl}/cancel`, {})).json().status).toBe('cancel_requested');
    expect((await post('/api/runner/heartbeat', ownership(assignment), runner.token)).json().action).toBe('cancel');
    await post('/api/runner/events', { ...ownership(assignment), events: [{ id: 'completion', sequence: 2, type: 'completed', outcome: 'succeeded' }] }, runner.token);
    expect((await get(taskUrl)).json().status).toBe('succeeded');
    expect((await post(`${taskUrl}/cancel`, {})).json().status).toBe('succeeded');
  });

  it('keeps large evidence folded and verifies the exact artifact independently', async () => {
    const runner = await register();
    const rule = { kind: 'contains', expected: 'approved' };
    await post('/api/tasks', { ...submission, verification: rule });
    const assignment = await claim(runner.token);
    const taskUrl = `/api/tasks/${assignment.task.id}`;
    const content = 'x'.repeat(262144);
    const version = digest(content);
    const artifact = { id: 'artifact-event', sequence: 1, type: 'artifact', artifactId: 'report', title: 'Large report', version, content, mediaType: 'text/plain' };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [artifact] }, runner.token)).statusCode).toBe(200);
    const verification = { id: 'verify-event', sequence: 2, type: 'verification', artifactId: 'report', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: digest(JSON.stringify({ artifactVersion: version, rule })), result: 'passed', evidence: 'Claimed success' };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [verification] }, runner.token)).statusCode).toBe(409);
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [{ ...verification, result: 'failed', evidence: 'Required text was absent' }] }, runner.token)).statusCode).toBe(200);
    const snapshot = (await get(taskUrl)).json();
    expect(snapshot.verificationStatus).toBe('failed');
    expect(JSON.stringify(snapshot).length).toBeLessThan(4000);
    expect(Object.keys(snapshot.entries[0].reference).sort()).toEqual(['id', 'title']);
    expect((await get(`/api/details/${snapshot.entries[0].reference.id}`)).json().content).toBe(content);
    const page = (await get(`${taskUrl}/events?after=0&limit=1`)).json();
    expect(page).toMatchObject({ hasMore: true, nextCursor: 1, watermark: 2 });
    expect((await get(`${taskUrl}/events?after=${page.nextCursor}&limit=1`)).json()).toMatchObject({ hasMore: false, nextCursor: 2 });
    expect((await get(`${taskUrl}/events?after=999`)).json()).toMatchObject({ reset: true, nextCursor: 0 });
    expect((await get(`${taskUrl}/events?limit=101`)).statusCode).toBe(400);
  });

  it('counts authoritative cumulative usage once and preserves unknown values', async () => {
    const runner = await register();
    await post('/api/tasks', submission);
    const assignment = await claim(runner.token);
    const base = { type: 'usage', source: 'fixture', scope: 'session', scopeId: 'session-usage', cumulative: true, accounting: 'authoritative', costKind: 'sdk_estimate', inputTokens: 100, outputTokens: 10, costUsd: 0.1 };
    const session = { type: 'session', id: 'session', sequence: 1, nativeSessionId: base.scopeId, adapterVersion: '1' };
    const first = { ...base, id: 'usage-1', sequence: 2, sampleId: 'sample-1', baseline: { kind: 'new-session' } };
    const second = { ...base, id: 'usage-2', sequence: 3, sampleId: 'sample-2', baseline: { kind: 'sample', sampleId: 'sample-1' }, inputTokens: 120, outputTokens: 15, costUsd: 0.15 };
    const duplicate = { ...second, id: 'usage-replay', sequence: 4 };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [{ ...first, sequence: 1 }] }, runner.token)).statusCode).toBe(409);
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [session] }, runner.token)).statusCode).toBe(200);
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [first, second, duplicate] }, runner.token)).statusCode).toBe(200);
    expect((await get(`/api/tasks/${assignment.task.id}`)).json().usage).toEqual({ inputTokens: 120, outputTokens: 15, costUsd: 0.15, costKind: 'sdk_estimate', incomplete: false });
    const diagnostic = { ...base, id: 'diagnostic', sequence: 5, sampleId: 'diagnostic', accounting: 'informational', inputTokens: 9999 };
    await post('/api/runner/events', { ...ownership(assignment), events: [diagnostic] }, runner.token);
    expect((await get(`/api/tasks/${assignment.task.id}`)).json().usage.inputTokens).toBe(120);
    const unknown = { ...base, id: 'unknown', sequence: 6, sampleId: 'unknown', baseline: { kind: 'unknown' }, inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown' };
    await post('/api/runner/events', { ...ownership(assignment), events: [unknown] }, runner.token);
    expect((await get(`/api/tasks/${assignment.task.id}`)).json().usage).toMatchObject({ inputTokens: null, outputTokens: null, costUsd: null, incomplete: true });
  });

  it('resumes only a known session on its original runner without concurrent use', async () => {
    const a = await register(['fixture'], 2);
    const b = await register();
    expect((await post('/api/tasks', { ...submission, resumeSessionId: 'unknown-session' })).statusCode).toBe(409);
    await post('/api/tasks', submission);
    const original = await claim(a.token);
    const session = { id: 'session-event', sequence: 1, type: 'session', nativeSessionId: 'native-session-1', adapterVersion: '1' };
    const usage = { type: 'usage', id: 'usage', sequence: 2, source: 'fixture', scope: 'session', scopeId: session.nativeSessionId, cumulative: true, accounting: 'authoritative', costKind: 'sdk_estimate', inputTokens: 40, outputTokens: 10, costUsd: 0.1, sampleId: 'original', baseline: { kind: 'new-session' } };
    expect((await post('/api/runner/events', { ...ownership(original), events: [session, usage, { id: 'done', sequence: 3, type: 'completed', outcome: 'succeeded' }] }, a.token)).statusCode).toBe(200);
    const resumed = (await post('/api/tasks', { ...submission, resumeSessionId: 'native-session-1' })).json().task;
    expect((await post('/api/runner/claim', {}, b.token)).json().assignment).toBeNull();
    const resumedAssignment = await claim(a.token);
    expect(resumedAssignment.task.id).toBe(resumed.id);
    await post('/api/tasks', { ...submission, resumeSessionId: session.nativeSessionId });
    expect((await post('/api/runner/claim', {}, a.token)).json().assignment).toBeNull();
    const resumedUsage = { ...usage, sampleId: 'resumed', baseline: { kind: 'sample', sampleId: 'original' }, inputTokens: 60, outputTokens: 15, costUsd: 0.15 };
    expect((await post('/api/runner/events', { ...ownership(resumedAssignment), events: [session, resumedUsage] }, a.token)).statusCode).toBe(200);
    expect((await get(`/api/tasks/${resumed.id}`)).json().usage).toEqual({ inputTokens: 20, outputTokens: 5, costUsd: 0.05, costKind: 'sdk_estimate', incomplete: false });
    expect((await get(`/api/tasks/${original.task.id}`)).json().usage.inputTokens).toBe(40);
    const decreased = { ...resumedUsage, id: 'decreased', sequence: 3, sampleId: 'decreased', baseline: { kind: 'sample', sampleId: 'resumed' }, inputTokens: 1 };
    await post('/api/runner/events', { ...ownership(resumedAssignment), events: [decreased] }, a.token);
    expect((await get(`/api/tasks/${resumed.id}`)).json().usage).toMatchObject({ inputTokens: null, incomplete: true });
    const falseStart = { ...resumedUsage, id: 'false-start', sequence: 4, sampleId: 'false-start', baseline: { kind: 'new-session' } };
    await post('/api/runner/events', { ...ownership(resumedAssignment), events: [falseStart] }, a.token);
    expect((await get(`/api/tasks/${resumed.id}`)).json().usage).toMatchObject({ inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true });
  });

  it('bounds history and request sizes and rejects malformed command bodies', async () => {
    const runner = await register();
    const otherHarness = await register(['claude']);
    const accepted = await Promise.all(Array.from({ length: 3 }, () => post('/api/tasks', submission)));
    expect((await post('/api/runner/claim', {}, otherHarness.token)).json().assignment).toBeNull();
    const firstPage = (await get('/api/tasks?limit=2')).json();
    const lastPage = (await get(`/api/tasks?limit=2&before=${firstPage.nextCursor}`)).json();
    expect(new Set([...firstPage.tasks, ...lastPage.tasks].map(task => task.id)).size).toBe(3);
    expect(lastPage.nextCursor).toBeNull();
    expect((await get('/api/tasks?before=invalid')).statusCode).toBe(400);
    const assignment = await claim(runner.token);
    for (let start = 0; start < 105; start += 50) {
      const events = Array.from({ length: Math.min(50, 105 - start) }, (_, index) => ({ id: `message-${start + index}`, sequence: start + index + 1, type: 'message', text: `Message ${start + index}` }));
      expect((await post('/api/runner/events', { ...ownership(assignment), events }, runner.token)).statusCode).toBe(200);
    }
    const snapshot = (await get(`/api/tasks/${assignment.task.id}`)).json();
    expect(snapshot.entries).toHaveLength(100);
    expect(snapshot).toMatchObject({ hasMore: true, watermark: 105, entries: expect.arrayContaining([{ ...snapshot.entries[0], cursor: 6 }]) });
    expect((await get(`/api/tasks/${assignment.task.id}/events?after=0`)).json()).toMatchObject({ hasMore: true, nextCursor: 100, watermark: 105 });
    expect((await post(`/api/tasks/${accepted[0]!.json().task.id}/cancel`, { ignored: true })).statusCode).toBe(400);
    expect((await post('/api/tasks', { ...submission, prompt: 'x'.repeat(2 * 1024 * 1024) })).statusCode).toBe(413);
    const oversized = { id: 'oversized', sequence: 106, type: 'detail', title: 'Too large', content: 'x'.repeat(1024 * 1024 + 1), mediaType: 'text/plain' };
    expect((await post('/api/runner/events', { ...ownership(assignment), events: [oversized] }, runner.token)).statusCode).toBe(400);
    expect((await get('/api/details/missing')).statusCode).toBe(404);
  });
});
