import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ClaimedTask, RunnerEventData, TaskSubmission } from '@flow/contracts';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import type { ExecutionProfileConfiguration, NativeExecutionProfilePublished } from '../../../../packages/contracts/src/execution-profiles.js';
import { RUNNER_CLAIM_PROTOCOL, decodeRunnerClaimResponse, type RunnerClaimRequest } from '../../../../packages/contracts/src/runner-claim.js';
import { PLUGIN_RUNNER_CLAIM_PROTOCOL, decodePluginRunnerClaimResponse, type PluginRunnerClaimRequest } from '../../../../packages/contracts/src/plugin-runner-claim.js';
import { PLUGIN_RUNTIME_PROTOCOL } from '../../../../packages/contracts/src/plugin-runtime.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/wpf-mature-02-message-settings-core/claim-eligibility/enable-binding-pg-fixture.js';
import { createServer } from '../index.js';

// Prepared only: real owner/runner HTTP and PostgreSQL, no SDK import or provider execution.
const fixture = new PluginDatabaseFixture('runtime', 4);
const owner = randomUUID();
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let origin = '';
const facts: Record<string, unknown>[] = [];
const requested: ClaudeTurnSettings['requested'] = {
  model: 'configured-test-model', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'standard',
};
const configuration: ExecutionProfileConfiguration = {
  harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'legacy-test-model', thinking: 'disabled',
  permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64),
  limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 },
};
async function http<T>(path: string, body?: unknown, token: string = owner, status = 200): Promise<T> {
  const response = await fixture.request(origin + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body) });
  expect(response.status).toBe(status);
  return response.body as T;
}
beforeAll(async () => {
  await fixture.create();
  await fixture.start(async () => {
    app = await createServer({ databaseUrl: fixture.databaseUrl, ownerToken: owner, automaticQueueScan: false, leaseMs: 300_000 });
    origin = await app.listen({ host: '127.0.0.1', port: 0 }); fixture.listener(origin);
  });
}, 30_000);
afterAll(async () => {
  const startup = await fixture.settleStartup();
  const server = startup && await fixture.close('server-close', async () => {
    await app?.close();
    if (app?.server.listening) throw new Error('Settings claim listener remains open');
    if (origin) fixture.listenerClosed(origin);
  });
  let counts: { tasks: number; attempts: number; runners: number } | undefined;
  try { counts = (await fixture.pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts,(SELECT count(*)::int FROM flow.runners) AS runners')).rows[0]; }
  catch { facts.push({ kind: 'count-query-failed' }); }
  facts.push({ kind: 'bounded-counts', counts });
  const result = await fixture.finish({ startup, server }, facts);
  expect(counts).toBeDefined();
  if (counts) { expect(counts.tasks).toBeLessThanOrEqual(13); expect(counts.attempts).toBeLessThanOrEqual(10); expect(counts.runners).toBeLessThanOrEqual(10); }
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errors: [],
    cleanup: { ownersClosed: true, poolClosed: true, adminClosed: true, identityConfirmed: true,
      connections: 0, dropAcknowledged: true, databaseAbsent: true } });
}, 60_000);

async function profile(optIn: boolean, harnesses = ['claude']) {
  const runner = await http<{ runnerId: string; token: string }>('/api/runners', { name: 'Mixed queue configured runner', harnesses, capacity: 1 });
  const publication = await http<NativeExecutionProfilePublished>('/api/runner/execution-profile', {
    configuration: { ...configuration, ...(optIn ? { turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [requested] } } : {}) },
  }, runner.token);
  const reference = publication.profile.reference;
  const settings: ClaudeTurnSettings = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested };
  return { ...runner, reference, settings };
}
type Profile = Awaited<ReturnType<typeof profile>>;
type Protocol = 'v1' | 'v2' | 'v3';
function opportunity(runner: Profile, protocol: 'v2' | 'v3'): RunnerClaimRequest | PluginRunnerClaimRequest {
  const base = { runnerId: runner.runnerId, requestId: randomUUID() };
  return protocol === 'v2' ? { ...base, protocol: RUNNER_CLAIM_PROTOCOL }
    : { ...base, protocol: PLUGIN_RUNNER_CLAIM_PROTOCOL,
      pluginToolExecution: { bindingProtocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'claim-test-store', hostApiMajor: 1 } };
}
async function claim(runner: Profile, protocol: Protocol, request?: RunnerClaimRequest | PluginRunnerClaimRequest, status = false) {
  if (protocol === 'v1') return (await http<{ assignment: ClaimedTask | null }>('/api/runner/claim', {}, runner.token)).assignment;
  if (!request) throw new Error('The original opportunity request is required');
  const response = await http('/api/runner/claim-opportunity' + (status ? '/status' : ''), request, runner.token);
  const decoded = request.protocol === PLUGIN_RUNNER_CLAIM_PROTOCOL
    ? decodePluginRunnerClaimResponse(response, request, status ? 'status' : 'claim')
    : decodeRunnerClaimResponse(response, request, status ? 'status' : 'claim');
  if (decoded.state !== 'assigned') expect(decoded.state).toBe(status ? 'missing' : 'empty');
  return decoded.state === 'assigned' ? decoded.assignment : null;
}
async function task(extra: Partial<TaskSubmission> = {}) {
  const input: TaskSubmission = { title: 'Mixed queue claim', prompt: 'No provider execution', harness: 'claude', ...extra };
  const result = await http<{ task: { id: string } }>('/api/tasks', input, owner, 202);
  // Only readiness is controlled, not claim eligibility or ownership. The real allocation query decides.
  await fixture.pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1 AND status='queued'", [result.task.id]);
  return result.task.id;
}
async function report(runner: Profile, assignment: ClaimedTask, events: RunnerEventData[]) {
  return http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: events.map((event, index) => ({ ...event, id: randomUUID(), sequence: index + 1 })) }, runner.token);
}
async function attemptState(taskId: string) {
  return (await fixture.pool.query('SELECT id,runner_id,owner_version,lease_expires_at,last_sequence,completed_at FROM flow.attempts WHERE task_id=$1 ORDER BY id', [taskId])).rows;
}

test.each(['v1', 'v2', 'v3'] as const)('%s filters old unpinned and missing-snapshot work before LIMIT and preserves opportunity identity', async protocol => {
  const old = await profile(false); const current = await profile(true);
  const legacyTask = await task();
  // Historical/corrupt-but-schema-legal pin without a snapshot: public current admission rejects this.
  const denied = await http<{ error: { code: string } }>('/api/tasks', { title: 'Invalid new admission', prompt: 'Missing snapshot', harness: 'claude', executionProfile: current.reference }, owner, 409);
  expect(denied.error.code).toBe('message_settings_required');
  const missingSnapshot = randomUUID();
  await fixture.pool.query('INSERT INTO flow.tasks(id,submission,dispatch_ready) VALUES($1,$2,true)',
    [missingSnapshot, { title: 'Historical pin without snapshot', prompt: 'Do not execute', harness: 'claude', executionProfile: current.reference }]);
  const key = protocol === 'v1' ? undefined : opportunity(current, protocol);
  expect(await claim(current, protocol, key)).toBeNull();
  expect(await attemptState(legacyTask)).toEqual([]); expect(await attemptState(missingSnapshot)).toEqual([]);
  if (key) expect(await claim(current, protocol, key, true)).toBeNull(); // Empty is not a durable assignment.
  const eligible = await task({ executionProfile: current.reference, messageSettings: current.settings });
  expect((await fixture.pool.query('SELECT id FROM flow.tasks WHERE id=ANY($1) ORDER BY created_at,id', [[legacyTask, missingSnapshot, eligible]])).rows.map(row => row.id)).toEqual([legacyTask, missingSnapshot, eligible]);
  const assignment = await claim(current, protocol, key);
  expect(assignment?.task).toMatchObject({ id: eligible, executionProfile: current.reference, messageSettings: current.settings });
  expect(assignment?.attempt).toMatchObject({ runnerId: current.runnerId, ownerVersion: 1 });
  const before = await attemptState(eligible);
  const stale = await http<{ error: { code: string } }>('/api/runner/events', { attemptId: assignment!.attempt.id,
    ownerVersion: assignment!.attempt.ownerVersion + 1, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'succeeded' }] }, current.token, 409);
  expect(stale.error.code).toBe('stale_owner'); expect(await attemptState(eligible)).toEqual(before);
  if (key) {
    expect(await claim(current, protocol, key)).toEqual(assignment);
    expect(await claim(current, protocol, key, true)).toEqual(assignment);
    expect(await attemptState(eligible)).toEqual(before); // Same attempt/fence/lease; replay is not renewal.
  } else expect(await claim(current, protocol)).toBeNull(); // Capacity remains enforced.
  const oldKey = protocol === 'v1' ? undefined : opportunity(old, protocol);
  const legacyAssignment = await claim(old, protocol, oldKey);
  expect(legacyAssignment?.task.id).toBe(legacyTask);
  expect(await attemptState(missingSnapshot)).toEqual([]);
  if (!assignment || !legacyAssignment) throw new Error('Expected both exact assignments');
  await report(current, assignment, [{ type: 'completed', outcome: 'succeeded' }]);
  await report(old, legacyAssignment, [{ type: 'completed', outcome: 'succeeded' }]);
  facts.push({ protocol, legacyTask, missingSnapshot, eligible, providerCalls: 0 });
});

test('keeps a resumed legacy session on its original runner while the opt-in runner claims later work', async () => {
  const old = await profile(false); const current = await profile(true);
  const first = await task();
  const original = await claim(old, 'v2', opportunity(old, 'v2'));
  expect(original?.task.id).toBe(first); if (!original) throw new Error('Expected original session owner');
  const sessionId = randomUUID();
  await report(old, original, [{ type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }, { type: 'completed', outcome: 'succeeded' }]);
  const resumed = await task({ resumeSessionId: sessionId });
  const otherLegacy = await profile(false);
  expect(await claim(otherLegacy, 'v2', opportunity(otherLegacy, 'v2'))).toBeNull();
  const eligible = await task({ executionProfile: current.reference, messageSettings: current.settings });
  const assignment = await claim(current, 'v3', opportunity(current, 'v3'));
  expect(assignment?.task.id).toBe(eligible); expect(await attemptState(resumed)).toEqual([]);
  const continuation = await claim(old, 'v2', opportunity(old, 'v2'));
  expect(continuation?.task).toMatchObject({ id: resumed, resumeSessionId: sessionId });
  expect(continuation?.attempt.runnerId).toBe(old.runnerId);
  expect((await fixture.pool.query('SELECT runner_id,active_task_id FROM flow.sessions WHERE id=$1', [sessionId])).rows[0])
    .toEqual({ runner_id: old.runnerId, active_task_id: resumed });
  if (!assignment || !continuation) throw new Error('Expected separate resumed and opted-in assignments');
  await report(current, assignment, [{ type: 'completed', outcome: 'succeeded' }]);
  await report(old, continuation, [{ type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }, { type: 'completed', outcome: 'succeeded' }]);
});

test('does not impose Claude message settings on an ordinary fixture task', async () => {
  const current = await profile(true, ['claude', 'fixture']);
  const id = await task({ harness: 'fixture' });
  const assignment = await claim(current, 'v3', opportunity(current, 'v3'));
  expect(assignment?.task.id).toBe(id); expect(assignment?.task.messageSettings).toBeUndefined();
  if (!assignment) throw new Error('Expected fixture assignment');
  await report(current, assignment, [{ type: 'completed', outcome: 'succeeded' }]);
});
