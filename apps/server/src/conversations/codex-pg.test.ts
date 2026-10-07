import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { conversationCreationSchema, conversationTurnSchema } from '../../../../packages/contracts/src/conversations.js';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { ContinuityCenterFixture } from '../../../../docs/evidence/mature02c02/pg-fixture.js';
import { configureCodexHarness, createCodexSessionStorage } from '../../../runner/src/native-harness/codex/index.js';
import { persistentTransportFixture } from '../../../runner/src/native-harness/codex/continuity-fixture.js';
import { guardExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { sha256 } from '../database.js';

// Real isolated PG/HTTP only under the existing opened operator. Transport is injected: no provider/native process.
const center = new ContinuityCenterFixture();
let native: FlowClient, ordinal = 0;
const check = (name: string, action: () => Promise<void>) => it(name, () => center.preserve(name, action));
const ephemeral: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 5000, maxOutputBytes: 1024 } };
const persistent: CodexExecutionProfileConfiguration = { ...ephemeral, sessionPersistence: 'host-owned' };
beforeAll(() => center.preserve('setup', async () => { await center.start(); native = center.conversationClient(); }));
beforeEach(() => center.preserve('case-isolation', async () => { await center.pool.query('UPDATE flow.runners SET revoked=true'); }));
afterAll(() => center.close());
async function register(configuration = persistent) {
  const r = await center.owner.registerRunner({ name: 'conversation fixture', harnesses: ['codex'], capacity: 1 });
  const client = new FlowClient({ baseUrl: center.baseUrl, token: r.token });
  const { profile } = await client.publishNativeExecutionProfile({ configuration });
  return { ...r, client, reference: profile.reference };
}
const creation = (reference: Awaited<ReturnType<typeof register>>['reference']) => conversationCreationSchema.parse({ title: '会话🙂', harness: 'codex', executionProfile: reference,
  requested: { model: 'runner-default', thinking: 'unknown', tools: 'none' } });
async function seedProfile(configuration: CodexExecutionProfileConfiguration) {
  const r = await center.owner.registerRunner({ name: 'catalog fixture', harnesses: ['codex'], capacity: 1 });
  const id = `00000000-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`;
  await center.pool.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)', [id, r.runnerId, sha256(nativeExecutionProfileConfigurationJson(configuration)), configuration]);
  return id;
}
async function completeTask(taskId: string) {
  for (let polls = 1; polls <= 40; polls++) {
    const task = await center.owner.show(taskId);
    center.facts.lastTaskWait = { taskId, polls, status: task.status, attemptId: task.attempt?.id ?? null, watermark: task.watermark };
    if (task.status === 'succeeded') return task;
    expect(['queued', 'running']).toContain(task.status); await sleep(50);
  }
  throw new Error('Conversation task did not finish within the fixed polling budget.');
}
check('filters native-v1 before LIMIT while native-v2 exposes exact persistent pins', async () => {
  const hidden = await seedProfile(persistent), first = await seedProfile(ephemeral); await seedProfile(persistent); const second = await seedProfile(ephemeral);
  const page = await center.owner.nativeExecutionProfiles({ limit: 1 });
  expect(page.profiles.map(x => x.profile.reference.id)).toEqual([first]); expect(page.nextCursor).toBe(first);
  const next = await center.owner.nativeExecutionProfiles({ after: first, limit: 1 });
  expect(next.profiles.map(x => x.profile.reference.id)).toEqual([second]); expect(next.nextCursor).toBeNull();
  const current = await native.nativeConversationProfiles({ limit: 1 });
  expect(current.profiles[0]).toMatchObject({ profile: { reference: { id: hidden }, configuration: persistent }, conversation: { state: 'native-conversation', protocol: 'native-v1' } });
  expect(current.nextCursor).toBe(hidden);
});
check('applies 035 and preserves Claude creation while native creation requires a supported immutable pin', async () => {
  expect(center.facts.migrations).toEqual(expect.arrayContaining([7, 35]));
  const old = await center.owner.createConversation(conversationCreationSchema.parse({ title: 'Claude stays valid' }), randomUUID());
  expect(old.conversation.harness).toBe('claude');
  const r = await register(), input = creation(r.reference), key = randomUUID();
  const first = await native.createConversation(input, key), replay = await native.createConversation(input, key);
  expect(replay.replayed).toBe(true); expect(replay.conversation).toEqual(first.conversation);
  await expect(center.pool.query("UPDATE flow.conversations SET harness='unknown' WHERE id=$1", [old.conversation.id])).rejects.toMatchObject({ code: '23514' });
  expect((await center.owner.conversation(old.conversation.id)).conversation).toEqual(old.conversation);
  await expect(center.owner.createConversation(input, randomUUID())).rejects.toMatchObject({ status: 409, code: 'conversation_protocol_required' });
  await expect(native.createConversation({ ...input, executionProfile: { ...r.reference, configDigest: '0'.repeat(64) } }, randomUUID())).rejects.toMatchObject({ status: 409, code: 'execution_profile_unavailable' });
  const invalid = await center.json('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Flow-Conversation': 'native-v1', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...input, requested: { ...input.requested, thinking: 'enabled' } }) });
  expect(invalid.status).toBe(400);
});
check('filters mixed conversation pages before LIMIT and denies hidden direct route families', async () => {
  const r = await register(); const hidden = await native.createConversation(creation(r.reference), randomUUID());
  await center.owner.createConversation(conversationCreationSchema.parse({ title: 'Legacy page' }), randomUUID());
  const expected = (await center.pool.query("SELECT id FROM flow.conversations WHERE harness='claude' ORDER BY id")).rows.map(row => row.id);
  const observed: string[] = []; let after: string | undefined;
  for (let page = 0; page < 8; page++) { const result = await center.owner.conversations({ limit: 1, ...(after ? { after } : {}) }); observed.push(...result.conversations.map(x => x.id)); if (!result.nextCursor) break; after = result.nextCursor; }
  expect(observed).toEqual(expected);
  const id = hidden.conversation.id;
  for (const path of ['', '/turns', '/turns/fake/details/fake', '/contexts/fake', '/queue', '/queue/fake']) {
    for (const protocol of [undefined, 'native-v0', 'native-v1, native-v1']) {
      const response = await center.json(`/api/conversations/${id}${path}`, { headers: protocol ? { 'X-Flow-Conversation': protocol } : {} });
      expect(response.status).toBe(409); expect(response.value.error.code).toBe('conversation_protocol_required');
    }
  }
  expect((await native.conversation(id)).conversation.harness).toBe('codex');
  expect((await native.conversationTurns(id)).turns).toEqual([]);
});
check('continues two public conversation turns on the original session and preserves typed reply identity', async () => {
  const r = await register(), created = await native.createConversation(creation(r.reference), randomUUID());
  const id = created.conversation.id, codeHome = center.ownRoot(), threadId = randomUUID();
  const fixture = persistentTransportFixture({ codeHome, threadId });
  const storage = createCodexSessionStorage({ codeHome, runnerId: r.runnerId, configDigest: r.reference.configDigest, createTransport: fixture.createTransport });
  const adapter = guardExecutionProfile(configureCodexHarness({ publicProfile: persistent, sessionStorage: storage }).adapter, r.reference, persistent);
  const stop = new AbortController();
  const done = runRunner({ baseUrl: center.baseUrl, token: r.token, workingDirectory: codeHome, adapters: [adapter], signal: stop.signal, pollIntervalMs: 50, heartbeatIntervalMs: 500, requestTimeoutMs: 1000 });
  center.runners.push({ stop, done }); void done.catch(() => {}); let primary = false;
  try {
    const first = await native.submitConversationTurn(id, conversationTurnSchema.parse({ expectedRevision: 0, text: 'Remember 中文🙂' }), randomUUID());
    await completeTask(first.turn.task.id); expect(fixture.instances[0]!.closed).toBe(true);
    const request = conversationTurnSchema.parse({ expectedRevision: 1, text: 'Recall 中文🙂' }), key = randomUUID();
    const second = await native.submitConversationTurn(id, request, key), replay = await native.submitConversationTurn(id, request, key);
    expect(replay.replayed).toBe(true); expect(replay.turn.task.id).toBe(second.turn.task.id);
    await completeTask(second.turn.task.id);
    const page = await native.conversationTurns(id, { limit: 2 }); expect(page.turns).toHaveLength(2); expect(page.nextCursor).toBeNull();
    for (const turn of page.turns) { expect(turn.task.harness).toBe('codex'); expect(turn.assistant).toMatchObject({ state: 'available', text: 'remembered 中文🙂', source: { source: 'codex.app-server.agent-message', nativeSessionId: threadId, contentDigest: sha256('remembered 中文🙂') } }); expect(turn.effective).toMatchObject({ model: null, thinking: 'unknown', tools: 'unknown', codex: { actualExecution: { model: null, evidence: 'unknown' } } }); }
    expect((await native.conversation(id)).nativeSession).toMatchObject({ nativeSessionId: threadId, runnerId: r.runnerId });
    expect(fixture.calls.map(x => x.method)).toEqual(['thread/start', 'turn/start', 'thread/resume', 'turn/start']);
    expect(fixture.instances).toMatchObject([{ closed: true, reads: 1 }, { closed: true, reads: 2 }]);
    const other = await register(); await center.pool.query('UPDATE flow.sessions SET runner_id=$1 WHERE id=$2', [other.runnerId, threadId]);
    await expect(native.submitConversationTurn(id, conversationTurnSchema.parse({ expectedRevision: 2, text: 'must not switch runner' }), randomUUID())).rejects.toMatchObject({ status: 409 });
    await center.pool.query('UPDATE flow.sessions SET runner_id=$1 WHERE id=$2', [r.runnerId, threadId]);
    await center.pool.query("UPDATE flow.details SET content=jsonb_set(content::jsonb,'{adapterVersion}','\"claude-sdk-0.3.290-v1\"')::text WHERE task_id=$1 AND kind='session'", [second.turn.task.id]);
    const changed = await native.conversationTurns(id); expect(changed.turns[1]!.assistant).toEqual({ state: 'unavailable', reason: 'unknown-adapter' });
    expect(changed.turns[1]!.effective).toEqual({ model: null, thinking: 'unknown', tools: 'unknown', source: null });
    center.facts.conversationContinuity = { turns: 2, sameThread: true, typedDigest: sha256('remembered 中文🙂'), instances: fixture.instances.map(x => ({ closed: x.closed, reads: x.reads })), foreignRunnerRejected: true, unknownAdapterRejected: true };
  } catch (error) { primary = true; throw error; }
  finally { stop.abort(); try { await done; } catch (error) { if (!primary) throw error; center.facts.runnerCleanupAfterFailure = 'UNKNOWN'; } }
});
check('keeps queue receipts idempotent and promotes a pinned Codex task through existing controls', async () => {
  const r = await register(), created = await native.createConversation(creation(r.reference), randomUUID()), id = created.conversation.id;
  const key = randomUUID(), request = { expectedQueueRevision: 0, text: 'queued 中文🙂' };
  const accepted = await native.enqueueConversationTurn(id, request, key), replay = await native.enqueueConversationTurn(id, request, key);
  expect(replay.replayed).toBe(true); expect(replay.item).toEqual(accepted.item);
  const paused = await native.pauseConversationQueue(id, { expectedQueueRevision: accepted.queueRevision }, randomUUID()); expect(paused.paused).toBe(true);
  const resumed = await native.resumeConversationQueue(id, { expectedQueueRevision: paused.queueRevision, expectedTaskId: null }, randomUUID());
  expect(resumed.promoted?.promoted?.taskId).toBe(resumed.currentTurn?.taskId);
  const task = await center.owner.show(resumed.currentTurn!.taskId); expect(task.harness).toBe('codex');
  const page = await native.conversationTurns(id); expect(page.turns).toHaveLength(1); expect(page.turns[0]!.assistant.state).toBe('pending');
  const queued = await native.enqueueConversationTurn(id, { expectedQueueRevision: resumed.queueRevision, text: 'cancel queued' }, randomUUID());
  const cancelled = await native.cancelConversationQueueItem(id, queued.item.id, { expectedQueueRevision: queued.queueRevision }, randomUUID()); expect(cancelled.outcome).toBe('cancelled');
  expect((await native.conversationQueueItem(id, accepted.item.id)).item.state).toBe('promoted');
});
check('rejects a corrupt native-v2 sentinel without replacing its immutable digest', async () => {
  await seedProfile(persistent); const second = await seedProfile(persistent);
  await center.pool.query("UPDATE flow.execution_profiles SET config_digest=$1 WHERE id=$2", ['0'.repeat(64), second]);
  await expect(native.nativeConversationProfiles({ limit: 1 })).rejects.toMatchObject({ status: 409, code: 'execution_profile_unavailable' });
});
