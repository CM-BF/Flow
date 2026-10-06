import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ClaimedTask } from '@flow/contracts';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ExecutionProfileConfiguration, ExecutionProfilePage } from '../../../../packages/contracts/src/execution-profiles.js';
import { createServer } from '../index.js';
import { migrateExecutionProfiles, registerExecutionProfileRoutes } from './index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile, publishExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_chat03';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'chat03-local-owner';
let lock: PoolClient | undefined;
let created = false;
let pool: Pool;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
let activeRunners = 0;
async function request(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
async function startServer() {
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 3000 });
  if (!server.hasRoute({ method: 'GET', url: '/api/execution-profiles' })) {
    await migrateExecutionProfiles(pool); registerExecutionProfileRoutes(server, pool);
  }
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function stopServer() {
  expect(activeRunners).toBe(0);
  // All owned runners have exited; close their aborted polling connections before fixture teardown.
  // This is test cleanup, not a claim about production graceful shutdown.
  server?.server.closeAllConnections();
  await server?.close(); server = undefined;
}
beforeAll(async () => {
  lock = await admin.connect();
  if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_chat03_test_exclusive',0)) AS locked")).rows[0]?.locked) throw new Error('flow_chat03 is in use.');
  if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_chat03'")).rowCount) throw new Error('Existing flow_chat03 must be preserved.');
  await lock.query('CREATE DATABASE flow_chat03'); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 8, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await stopServer(); } finally {
    await pool?.end();
    try { if (created) await lock?.query('DROP DATABASE flow_chat03'); }
    finally { lock?.release(); await admin.end(); }
  }
});
const configuration = (model: string): ExecutionProfileConfiguration => ({ harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model,
  thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: '0'.repeat(64),
  limits: { maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 } });
async function newRunner(harnesses = ['claude']) {
  return (await request('/api/runners', { name: 'CHAT03 synthetic runner', harnesses, capacity: 1 })).body as { runnerId: string; token: string };
}
it('publishes an immutable configured profile without asserting provider availability or alias resolution', async () => {
  const runner = await newRunner();
  const publication = await request('/api/runner/execution-profile', { configuration: configuration('sonnet') }, { token: runner.token });
  expect(publication.status).toBe(200);
  expect(publication.body.profile).toMatchObject({ reference: { runnerId: runner.runnerId }, configuration: configuration('sonnet'), source: 'runner-configured', availability: 'not-probed', model: { value: 'sonnet', resolvedModel: null, providerCapabilities: 'unknown' } });
  const again = await request('/api/runner/execution-profile', { configuration: configuration('sonnet') }, { token: runner.token });
  expect(again.body).toEqual({ profile: publication.body.profile, replayed: true });
  expect((await request('/api/runner/execution-profile', { configuration: configuration('other-alias') }, { token: runner.token })).status).toBe(409);
  expect((await request('/api/execution-profiles')).body.profiles).toEqual([publication.body.profile]);
  await stopServer(); await startServer();
  expect((await request('/api/execution-profiles')).body.profiles).toEqual([publication.body.profile]);
});

async function publish(runner: { token: string }, model: string) {
  const result = await request('/api/runner/execution-profile', { configuration: configuration(model) }, { token: runner.token });
  expect(result.status).toBe(200); return result.body.profile;
}
it('pins a selected conversation to the configured runner and preserves that choice in the claimed task', async () => {
  const runnerA = await newRunner(); const runnerB = await newRunner();
  await publish(runnerA, 'model-a'); const profileB = await publish(runnerB, 'model-b');
  const created = await request('/api/conversations', { title: 'Selected model', executionProfile: profileB.reference, requested: { model: 'model-b' } });
  expect(created.status).toBe(201);
  expect(created.body.conversation.executionProfile).toEqual(profileB.reference);
  const admitted = await request(`/api/conversations/${created.body.conversation.id}/turns`, { expectedRevision: 0, text: 'hi' });
  expect(admitted.status).toBe(202);
  let assignment: ClaimedTask | null;
  await expect.poll(async () => {
    expect((await request('/api/runner/claim', {}, { token: runnerA.token })).body.assignment).toBeNull();
    assignment = (await request('/api/runner/claim', {}, { token: runnerB.token })).body.assignment;
    return assignment;
  }, { timeout: 5000, interval: 20 }).toBeTruthy();
  expect(assignment!.task).toMatchObject({ id: admitted.body.turn.task.id, prompt: 'hi', executionProfile: profileB.reference });
  await request('/api/runner/events', { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] }, { token: runnerB.token });
});

it('enforces runner/owner authentication and rejects undeclared publication controls or private material paths', async () => {
  const runner = await newRunner();
  const body = { configuration: configuration('alias') };
  expect((await request('/api/runner/execution-profile', body)).status).toBe(403);
  expect((await request('/api/execution-profiles', undefined, { token: runner.token })).status).toBe(403);
  expect((await request('/api/execution-profiles', undefined, { token: 'invalid' })).status).toBe(401);
  for (const extra of [{ token: 'synthetic-secret' }, { materialFiles: ['/private/material'] }, { effort: 'high' }]) {
    const denied = await request('/api/runner/execution-profile', { configuration: { ...body.configuration, ...extra } }, { token: runner.token });
    expect(denied.status).toBe(400);
    expect(JSON.stringify(denied.body)).not.toMatch(/synthetic-secret|private\/material/);
  }
  expect((await request('/api/runner/execution-profile', { configuration: configuration('/private/material') }, { token: runner.token })).status).toBe(400);
  expect((await request('/api/execution-profiles?after=------------------------------------')).status).toBe(400);
  const fixtureRunner = await newRunner(['fixture']);
  expect((await request('/api/runner/execution-profile', body, { token: fixtureRunner.token })).status).toBe(409);
});

it('serializes simultaneous immutable publication and keeps pagination complete', async () => {
  const runner = await newRunner();
  const publications = await Promise.all(['alias-first', 'alias-second'].map(model => request('/api/runner/execution-profile', { configuration: configuration(model) }, { token: runner.token })));
  expect(publications.map(value => value.status).sort()).toEqual([200, 409]);
  const accepted = publications.find(value => value.status === 200)!.body.profile;
  const replay = await request('/api/runner/execution-profile', { configuration: accepted.configuration }, { token: runner.token });
  expect(replay.body).toEqual({ profile: accepted, replayed: true });
  const all = (await request('/api/execution-profiles')).body.profiles;
  const ids: string[] = [];
  let after: string | null = null;
  do {
    const page: ExecutionProfilePage = (await request(`/api/execution-profiles?limit=1${after ? `&after=${after}` : ''}`)).body;
    ids.push(...page.profiles.map((profile: { reference: { id: string } }) => profile.reference.id));
    after = page.nextCursor;
  } while (after);
  expect(ids).toEqual(all.map((profile: { reference: { id: string } }) => profile.reference.id));
});

it('rejects unsupported settings and stale pins without consuming the admission idempotency key', async () => {
  const runner = await newRunner(); const profile = await publish(runner, 'selected-alias');
  for (const requested of [{ model: 'other' }, { thinking: 'adaptive' }, { thinking: 'enabled' }]) {
    expect((await request('/api/conversations', { title: 'Unsupported', executionProfile: profile.reference, requested })).status).toBe(409);
  }
  expect((await request('/api/conversations', { title: 'Effort unknown', executionProfile: profile.reference, requested: { effort: 'high' } })).status).toBe(400);
  const key = randomUUID();
  const base = { title: 'No partial command', harness: 'claude', prompt: 'hi', executionProfile: profile.reference };
  for (const pin of [{ ...profile.reference, configDigest: 'f'.repeat(64) }, { ...profile.reference, runnerId: randomUUID() }, { ...profile.reference, id: randomUUID() }]) {
    expect((await request('/api/tasks', { ...base, executionProfile: pin }, { key })).status).toBe(409);
  }
  const accepted = await request('/api/tasks', base, { key });
  expect(accepted.status).toBe(202);
  expect((await request('/api/tasks', base, { key })).body).toMatchObject({ task: { id: accepted.body.task.id }, replayed: true });
  expect((await request('/api/tasks', { ...base, prompt: 'changed' }, { key })).status).toBe(409);
  expect((await request(`/api/tasks/${accepted.body.task.id}/cancel`, {})).status).toBe(200);
});

it('removes revoked profiles from selection and refuses both new and already-created conversation admission', async () => {
  const runner = await newRunner(); const profile = await publish(runner, 'revocable');
  const created = await request('/api/conversations', { title: 'Revoked before turn', executionProfile: profile.reference });
  expect((await request(`/api/runners/${runner.runnerId}/revoke`, {})).status).toBe(200);
  expect((await request('/api/execution-profiles')).body.profiles.some((entry: { reference: { id: string } }) => entry.reference.id === profile.reference.id)).toBe(false);
  expect((await request('/api/conversations', { title: 'Revoked', executionProfile: profile.reference })).status).toBe(409);
  expect((await request(`/api/conversations/${created.body.conversation.id}/turns`, { expectedRevision: 0, text: 'hi' })).status).toBe(409);
  expect((await request(`/api/conversations/${created.body.conversation.id}`)).body.conversation.revision).toBe(0);
  expect((await request('/api/runner/execution-profile', { configuration: configuration('revocable') }, { token: runner.token })).status).toBe(401);
});

it('executes the selected configuration, separates reported settings, and resumes only on the original runner', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat03-execution-'));
  const stop = new AbortController();
  const running: Promise<void>[] = [];
  const observed: { model: string | undefined; resume: string | undefined }[] = [];
  const sessionId = randomUUID();
  let calls = 0;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    calls++;
    observed.push({ model: options!.model, resume: options!.resume });
    expect(options!.thinking).toEqual({ type: 'disabled' });
    expect(options!.tools).toEqual([]);
    if (calls === 2) yield { type: 'system', subtype: 'init', session_id: sessionId, model: 'reported-resolved-model', tools: [], skills: [], plugins: [], mcp_servers: [], claude_code_version: 'synthetic', permissionMode: 'dontAsk', uuid: randomUUID() } as unknown as SDKMessage;
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: sessionId, result: `Synthetic reply ${calls}`, modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() {} });
  try {
    const wrong = await newRunner(); const selected = await newRunner();
    const wrongProfile = await publish(wrong, 'another');
    const adapter = createClaudeAdapter({ materialFiles: [], model: 'selected-alias', query, timeoutMs: 2000 });
    const configured = describeExecutionProfile({ materialFiles: [], model: 'selected-alias', timeoutMs: 2000 }, adapter);
    const pin = await publishExecutionProfile({ baseUrl, token: selected.token, configuration: configured });
    const guarded = guardExecutionProfile(adapter, pin, configured);
    const created = await request('/api/conversations', { title: 'Profile execution', executionProfile: pin, requested: { model: 'selected-alias', tools: 'none' } });
    const path = `/api/conversations/${created.body.conversation.id}`;
    const first = await request(`${path}/turns`, { expectedRevision: 0, text: 'hello' });
    expect(first.status).toBe(202);
    activeRunners++;
    running.push(runRunner({ baseUrl, token: selected.token, signal: stop.signal, workingDirectory: directory, adapters: [guarded], pollIntervalMs: 20, heartbeatIntervalMs: 100 }).finally(() => { activeRunners--; }));
    await expect.poll(async () => (await request(path)).body.lastTurn?.task.status, { timeout: 5000, interval: 20 }).toBe('succeeded');
    const initial = (await request(path)).body;
    expect(initial.lastTurn.assistant).toMatchObject({ state: 'available', text: 'Synthetic reply 1' });
    expect(initial.lastTurn.effective).toMatchObject({ model: null, thinking: 'unknown', tools: null, runnerRequested: { model: 'selected-alias', thinking: 'disabled' } });
    expect(initial.conversation.requested.model).toBe('selected-alias');
    expect(initial.nativeSession.runnerId).toBe(selected.runnerId);
    expect((await request('/api/tasks', { title: 'Wrong resume runner', harness: 'claude', prompt: 'follow-up', executionProfile: wrongProfile.reference, resumeSessionId: sessionId })).status).toBe(409);
    const second = await request(`${path}/turns`, { expectedRevision: 1, text: 'follow-up' });
    expect(second.status).toBe(202);
    await expect.poll(async () => (await request(path)).body.lastTurn?.task.status, { timeout: 5000, interval: 20 }).toBe('succeeded');
    const final = (await request(path)).body;
    expect(final.lastTurn.assistant).toMatchObject({ state: 'available', text: 'Synthetic reply 2' });
    expect(final.lastTurn.effective).toMatchObject({ model: 'reported-resolved-model', thinking: 'unknown', tools: [], runnerRequested: { model: 'selected-alias' } });
    expect(final.conversation.revision).toBe(2);
    expect(observed).toEqual([{ model: 'selected-alias', resume: undefined }, { model: 'selected-alias', resume: sessionId }]);
    const catalog = (await request('/api/execution-profiles')).body.profiles.find((profile: { reference: { id: string } }) => profile.reference.id === pin.id);
    expect(catalog.model).toMatchObject({ value: 'selected-alias', resolvedModel: null, providerCapabilities: 'unknown' });
  } finally {
    stop.abort(); await Promise.all(running); await rm(directory, { recursive: true, force: true });
  }
});
