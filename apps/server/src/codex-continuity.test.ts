import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../packages/contracts/src/execution-profiles.js';
import { ContinuityCenterFixture } from '../../../docs/evidence/mature02c02/pg-fixture.js';
import { sha256 } from './database.js';
import { configureCodexHarness, createCodexSessionStorage } from '../../runner/src/native-harness/codex/index.js';
import { persistentTransportFixture } from '../../runner/src/native-harness/codex/continuity-fixture.js';
import { guardExecutionProfile } from '../../runner/src/execution-profiles.js';
import { runRunner } from '../../runner/src/runtime.js';

// Separate explicitly opened PG suite. No process/SDK/provider transport; only the production HTTP/task/runner paths.
const center = new ContinuityCenterFixture();
let owner: FlowClient, ordinal = 0;
const check = (name: string, action: () => Promise<void>) => it(name, () => center.preserve(name, action));
const legacy: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 5000, maxOutputBytes: 1024 } };
const persistent: CodexExecutionProfileConfiguration = { ...legacy, sessionPersistence: 'host-owned' };
beforeAll(() => center.preserve('setup', async () => { await center.start(); owner = center.owner; }));
beforeEach(() => center.preserve('case-isolation', async () => { await center.pool.query('UPDATE flow.runners SET revoked=true'); }));
afterAll(() => center.close());
async function registered(configuration = persistent, capacity = 1) {
  const registration = await owner.registerRunner({ name: 'C02 fixture', harnesses: ['codex'], capacity });
  const client = new FlowClient({ baseUrl: center.baseUrl, token: registration.token });
  const publication = await client.publishNativeExecutionProfile({ configuration });
  return { ...registration, client, reference: publication.profile.reference };
}
async function seeded(configuration: CodexExecutionProfileConfiguration, corrupt = false) {
  const runner = await owner.registerRunner({ name: 'C02 catalog fixture', harnesses: ['codex'], capacity: 1 });
  const id = `00000000-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`;
  await center.pool.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)',
    [id, runner.runnerId, sha256(nativeExecutionProfileConfigurationJson(configuration)), corrupt ? { ...configuration, privateMarker: 'do-not-publish' } : configuration]);
  return id;
}
const submission = (reference: Awaited<ReturnType<typeof registered>>['reference'], resumeSessionId?: string) => ({
  title: 'C02 public continuity', prompt: 'Recall fixture context', harness: 'codex' as const, executionProfile: reference,
  ...(resumeSessionId ? { resumeSessionId } : {}),
});
async function awaitTask(id: string) {
  for (let i = 0; i < 40; i++) { const task = await owner.show(id); if (task.status === 'succeeded') return task; expect(['queued', 'running']).toContain(task.status); await sleep(50); }
  throw new Error('Owned task did not finish in its polling budget.');
}

check('filters host-owned profiles before legacy native-v1 LIMIT and preserves cursor/digest bytes', async () => {
  await seeded(persistent); const first = await seeded(legacy); await seeded(persistent); const second = await seeded(legacy);
  const page = await owner.nativeExecutionProfiles({ limit: 1 });
  expect(page.profiles.map(entry => entry.profile.reference.id)).toEqual([first]); expect(page.nextCursor).toBe(first);
  const next = await owner.nativeExecutionProfiles({ limit: 1, after: page.nextCursor! });
  expect(next.profiles.map(entry => entry.profile.reference.id)).toEqual([second]); expect(next.nextCursor).toBeNull();
  for (const entry of [...page.profiles, ...next.profiles]) {
    expect(entry.profile.configuration).toEqual(legacy);
    expect(entry.profile.reference.configDigest).toBe(sha256(nativeExecutionProfileConfigurationJson(legacy)));
  }
});
check('still rejects a corrupt recognized sentinel rather than hiding it behind a valid first row', async () => {
  await seeded(persistent); await seeded(legacy); await seeded(legacy, true);
  const response = await center.json('/api/execution-profiles?limit=1', { headers: { 'X-Flow-Execution-Profile': 'native-v1' } });
  expect(response.status).toBe(409); expect(response.value.error.code).toBe('execution_profile_unavailable');
  expect(JSON.stringify(response.value)).not.toContain('do-not-publish');
});
check('keeps old ephemeral resume explicitly unsupported while accepting its ordinary pinned task', async () => {
  const runner = await registered(legacy);
  await expect(owner.submit(submission(runner.reference, 'old-thread'), randomUUID())).rejects.toMatchObject({ status: 409, code: 'native_resume_unsupported' });
  expect((await owner.submit(submission(runner.reference), randomUUID())).task.harness).toBe('codex');
});
check('rejects missing sessions, wrong runner, altered pins and revoked profiles before new task insertion', async () => {
  const first = await registered(), other = await registered(); const thread = randomUUID();
  await center.pool.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'codex',$2)", [thread, first.runnerId]);
  for (const request of [submission(first.reference, 'missing-thread'), submission(other.reference, thread)]) {
    await expect(owner.submit(request, randomUUID())).rejects.toMatchObject({ status: 409, code: 'profile_session_mismatch' });
  }
  await expect(owner.submit(submission({ ...first.reference, configDigest: '0'.repeat(64) }, thread), randomUUID())).rejects.toMatchObject({ status: 409, code: 'execution_profile_unavailable' });
  await owner.revokeRunner(first.runnerId);
  await expect(owner.submit(submission(first.reference, thread), randomUUID())).rejects.toMatchObject({ status: 409, code: 'execution_profile_unavailable' });
  expect((await center.pool.query('SELECT count(*)::int AS n FROM flow.tasks WHERE submission->\'executionProfile\'->>\'runnerId\'=ANY($1)', [[first.runnerId, other.runnerId]])).rows[0].n).toBe(0);
});
check('continues through observer disconnect and then restores the same session across two independent transports', async () => {
  const registration = await registered(); const codeHome = center.ownRoot(); const threadId = randomUUID();
  let release!: () => void, entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }); const started = new Promise<void>(resolve => { entered = resolve; });
  center.releases.push(release);
  const fixture = persistentTransportFixture({ codeHome, threadId, async beforeTurn(instance) { if (instance === 1) { entered(); await pending; } } });
  const storage = createCodexSessionStorage({ codeHome, runnerId: registration.runnerId, configDigest: registration.reference.configDigest, createTransport: fixture.createTransport });
  const configured = configureCodexHarness({ publicProfile: persistent, sessionStorage: storage });
  const adapter = guardExecutionProfile(configured.adapter, registration.reference, persistent);
  const first = await owner.submit(submission(registration.reference), randomUUID()); const stop = new AbortController();
  const done = runRunner({ baseUrl: center.baseUrl, token: registration.token, workingDirectory: codeHome, adapters: [adapter], signal: stop.signal,
    pollIntervalMs: 50, heartbeatIntervalMs: 500, requestTimeoutMs: 1000 });
  center.runners.push({ stop, done }); void done.catch(() => {});
  let primaryFailed = false;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([started, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Fixture turn did not start.')), 3000); })]); }
    finally { clearTimeout(timer); }
    const observer = new AbortController(); const stream = owner.watch(first.task.id, 0, AbortSignal.any([observer.signal, AbortSignal.timeout(3000)]));
    try { expect((await stream.next()).done).toBe(false); } finally { observer.abort(); await stream.return(undefined); }
    expect(stop.signal.aborted).toBe(false); expect(fixture.instances[0]!.closed).toBe(false); release();
    await awaitTask(first.task.id); expect(fixture.instances[0]!.closed).toBe(true);
    const request = submission(registration.reference, threadId), key = randomUUID();
    const second = await owner.submit(request, key); const replay = await owner.submit(request, key);
    expect(replay.replayed).toBe(true); expect(replay.task.id).toBe(second.task.id);
    await awaitTask(second.task.id);
    expect(fixture.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start', 'thread/resume', 'turn/start']);
    expect(fixture.instances).toMatchObject([{ codeHome, closed: true, reads: 1 }, { codeHome, closed: true, reads: 2 }]);
    const messages = await center.pool.query('SELECT native_session_id,source,content_digest,settings FROM flow.assistant_messages WHERE task_id=ANY($1) ORDER BY created_at', [[first.task.id, second.task.id]]);
    expect(messages.rows).toHaveLength(2);
    for (const message of messages.rows) expect(message).toMatchObject({ native_session_id: threadId, source: 'codex.app-server.agent-message',
      content_digest: sha256('remembered 中文🙂'), settings: { actualExecution: { model: null, evidence: 'unknown' } } });
    expect((await center.pool.query('SELECT runner_id,active_task_id FROM flow.sessions WHERE id=$1', [threadId])).rows[0]).toEqual({ runner_id: registration.runnerId, active_task_id: null });
    center.facts.twoTransports = fixture.instances.map(instance => ({ closed: instance.closed, reads: instance.reads })); center.facts.observerDisconnected = true;
  } catch (error) { primaryFailed = true; throw error; }
  finally {
    release(); stop.abort();
    try { await done; } catch (error) { if (!primaryFailed) throw error; center.facts.runnerCleanupAfterFailure = 'UNKNOWN'; }
  }
});
check('serializes resumed tasks on their original runner/session and preserves current attempt fencing', async () => {
  const runner = await registered(persistent, 2), other = await registered(); const thread = randomUUID();
  await center.pool.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'codex',$2)", [thread, runner.runnerId]);
  const first = await owner.submit(submission(runner.reference, thread), randomUUID()); const second = await owner.submit(submission(runner.reference, thread), randomUUID());
  await center.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=ANY($1)', [[first.task.id, second.task.id]]);
  expect((await other.client.claim()).assignment).toBeNull();
  const assigned = (await runner.client.claim()).assignment!; expect([first.task.id, second.task.id]).toContain(assigned.task.id);
  expect((await runner.client.claim()).assignment).toBeNull();
  const ownership = { attemptId: assigned.attempt.id, ownerVersion: assigned.attempt.ownerVersion };
  await expect(other.client.heartbeat(ownership)).rejects.toMatchObject({ status: 403, code: 'attempt_forbidden' });
  await expect(runner.client.heartbeat({ ...ownership, ownerVersion: ownership.ownerVersion + 1 })).rejects.toMatchObject({ status: 409, code: 'stale_owner' });
  await runner.client.report({ ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'failed' }] });
  expect((await runner.client.claim()).assignment?.task.id).toBe(assigned.task.id === first.task.id ? second.task.id : first.task.id);
});
