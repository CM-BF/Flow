import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ClaimedTask, RunnerEventData, ApiErrorBody, ReconciliationResult, ReconciliationRetryResult } from '@flow/contracts';
import type { ConversationSnapshot } from '../../../../packages/contracts/src/conversations.js';
import type { ConversationQueueAccepted, ConversationQueuePage, ConversationQueueResumed } from '../../../../packages/contracts/src/conversation-queue.js';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeTurnSettingsSchema, type ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { claudeMessageSettingsCatalogPageSchema, type ExecutionProfilePage, type NativeExecutionProfileCatalogPage } from '../../../../packages/contracts/src/execution-profiles.js';
import { CLAUDE_CONTEXT_SOURCE } from '../../../../packages/contracts/src/context-observation-event.js';
import type { ContextHistoryResponse } from '../../../../packages/contracts/src/context-observation-history.js';
import { sha256 } from '../database.js';
import { promoteReady } from '../conversation-queue/promotion.js';
import { migrateClaudeMessageSettings } from './message-settings-migration.js';
import { MessageSettingsFixture, choices } from './message-settings-fixture.js';

let f: MessageSettingsFixture;
beforeAll(async () => { f = new MessageSettingsFixture(); await f.start(); }, 30_000);
afterAll(async () => { await f?.close(); }, 60_000);
type Profile = Awaited<ReturnType<MessageSettingsFixture['profile']>>;
async function enqueue(conversation: string, settings: ClaudeTurnSettings | undefined, revision = 0, key = randomUUID()) {
  return f.http<ConversationQueueAccepted>(`/api/conversations/${conversation}/queue`, { expectedQueueRevision: revision, text: 'Frozen queued message',
    ...(settings ? { messageSettings: settings } : {}) }, { key, status: 202 });
}
async function execution(profile: Profile, conversation: string, settings = profile.settings()) {
  const accepted = await f.send(conversation, settings);
  const assignment = await f.claim(profile.token, accepted.turn.task.id);
  const session = randomUUID();
  await f.report(profile.token, assignment, [{ type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' }]);
  return { accepted, assignment, session };
}
async function complete(profile: Profile, assignment: ClaimedTask, sequence = 2) {
  await f.report(profile.token, assignment, [{ type: 'completed', outcome: 'succeeded' }], sequence);
}
async function counts() {
  return (await f.pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.commands) AS commands,(SELECT count(*)::int FROM flow.reconciliation_audit) AS audit,(SELECT count(*)::int FROM pgboss.job) AS wakes')).rows[0];
}
function final(snapshot: ClaudeTurnSettings, session: string): RunnerEventData {
  const sourceMessageId = randomUUID();
  return { type: 'assistant-final', source: 'claude.sdk.result', nativeSessionId: session, sourceMessageId,
    messageId: sha256(JSON.stringify([session, sourceMessageId])), content: 'Synthetic public reply',
    settings: { effective: { model: 'synthetic-resolved', permissionMode: 'dontAsk', thinking: 'unknown', tools: [] },
      messageSettings: { snapshot, observed: { source: 'claude.sdk.system.init', model: 'synthetic-resolved', effort: null, fastModeState: 'cooldown' } } } };
}

it('migrates once, preserves old rows and rejects missing/null/extra snapshot fields in SQL', async () => {
  await migrateClaudeMessageSettings(f.pool);
  expect((await f.pool.query('SELECT count(*)::int AS count FROM flow.migrations WHERE version=32')).rows[0].count).toBe(1);
  expect((await f.pool.query('SELECT user_text,message_settings FROM flow.conversation_queue WHERE id=$1', [f.legacyQueue])).rows[0]).toEqual({ user_text: 'unchanged legacy text', message_settings: null });
  expect((await f.pool.query('SELECT submission FROM flow.tasks WHERE id=$1', [f.legacyTask])).rows[0].submission).toEqual({ title: 'Legacy migration fixture', prompt: 'unchanged legacy prompt', harness: 'fixture' });
  const profile = await f.profile(); const settings = profile.settings();
  const longest = claudeTurnSettingsSchema.parse({ ...settings, requested: { ...settings.requested, model: 'a'.repeat(180) } });
  const valid = (await f.pool.query('SELECT flow.valid_claude_message_settings($1::jsonb) AS valid,octet_length(convert_to($1::jsonb::text,\'UTF8\')) AS pg_bytes', [JSON.stringify(longest)])).rows[0];
  expect(valid.valid).toBe(true); expect(valid.pg_bytes).toBeGreaterThan(Buffer.byteLength(JSON.stringify(longest)));
  for (const value of [null, {}, { ...settings, requested: null }, { ...settings, profile: null }, { ...settings, protocol: null },
    { ...settings, requested: { ...settings.requested, speed: null } }, { ...settings, requested: { ...settings.requested, effort: { kind: 'level' } } }, { ...settings, extra: true }]) {
    expect((await f.pool.query('SELECT flow.valid_claude_message_settings($1::jsonb) IS TRUE AS valid', [JSON.stringify(value)])).rows[0].valid).toBe(false);
  }
  await expect(f.pool.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [randomUUID(), { title: 'invalid', prompt: 'x', harness: 'claude', messageSettings: settings }])).rejects.toMatchObject({ code: '23514' });
});

it('isolates all old catalog readers before pagination and publishes honest opt-in controls', async () => {
  const profile = await f.profile(); const legacy = await f.profile(false);
  expect(profile.publication.profile.controls).toEqual({ access: 'configured-policy', queue: false, steer: false,
    messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: 'configuration.turnSettings.choices' } });
  for (const version of [undefined, 'steering-v1', 'native-v1', CLAUDE_TURN_SETTINGS_PROTOCOL.toUpperCase(), `${CLAUDE_TURN_SETTINGS_PROTOCOL}, ${CLAUDE_TURN_SETTINGS_PROTOCOL}`]) {
    const body = await f.http<ExecutionProfilePage | NativeExecutionProfileCatalogPage>('/api/execution-profiles?limit=1', undefined,
      { headers: version ? { 'X-Flow-Execution-Profile': version } : {} });
    expect(body.profiles).toHaveLength(1);
    const item = body.profiles[0]!; const selected = 'profile' in item ? item.profile : item;
    expect(selected.reference).toEqual(legacy.reference); expect(selected.configuration).not.toHaveProperty('turnSettings');
  }
  expect(await f.duplicateHeaderCatalog()).toMatchObject({ profiles: [{ reference: legacy.reference }] });
  const page = claudeMessageSettingsCatalogPageSchema.parse(await f.http('/api/execution-profiles?limit=1', undefined, { headers: { 'X-Flow-Execution-Profile': CLAUDE_TURN_SETTINGS_PROTOCOL } }));
  expect(page.profiles).toHaveLength(1); expect(page.nextCursor).toBe(page.profiles[0]!.profile.reference.id);
  const remaining = claudeMessageSettingsCatalogPageSchema.parse(await f.http(`/api/execution-profiles?after=${page.nextCursor}`, undefined, { headers: { 'X-Flow-Execution-Profile': CLAUDE_TURN_SETTINGS_PROTOCOL } }));
  expect(remaining.profiles.length).toBeGreaterThan(0); expect(remaining.profiles.some(entry => entry.profile.reference.id === page.nextCursor)).toBe(false);
  const seeds: string[] = [];
  try {
    for (const [index, digest] of [profile.reference.configDigest, '0'.repeat(64)].entries()) {
      const runner = await f.http<{ runnerId: string }>('/api/runners', { name: 'Catalog sentinel fixture', harnesses: ['claude'], capacity: 1 });
      seeds.push(runner.runnerId);
      // Synthetic corrupt storage via INSERT: never disable an immutable production trigger.
      await f.pool.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)',
        [`00000000-0000-4000-8000-00000000000${index + 1}`, runner.runnerId, digest, profile.publication.profile.configuration]);
    }
    const error = await f.http<ApiErrorBody>('/api/execution-profiles?limit=1', undefined, { status: 409, headers: { 'X-Flow-Execution-Profile': CLAUDE_TURN_SETTINGS_PROTOCOL } });
    expect(error.error.code).toBe('execution_profile_unavailable');
  } finally { for (const runnerId of seeds) await f.http(`/api/runners/${runnerId}/revoke`, {}); }
});

it('freezes send and enqueue bodies through replay, promotion and explicit resume without reading a later draft', async () => {
  const p = await f.profile(); const c = await f.conversation(p.reference);
  const key = randomUUID(); const a = await f.send(c, p.settings(), 0, key);
  expect(await f.send(c, p.settings(), 0, key)).toEqual({ ...a, replayed: true });
  await f.http(`/api/conversations/${c}/turns`, { expectedRevision: 0, text: 'Frozen message', messageSettings: p.settings(1) }, { key, status: 409 });
  const queueKey = randomUUID(); const queued = await enqueue(c, p.settings(1), 0, queueKey);
  expect(await enqueue(c, p.settings(1), 0, queueKey)).toEqual({ ...queued, replayed: true });
  await f.http(`/api/conversations/${c}/queue`, { expectedQueueRevision: 0, text: 'Frozen queued message', messageSettings: p.settings(2) }, { key: queueKey, status: 409 });
  const draft = p.settings(); draft.requested = { ...choices[0]!, model: 'later-unsent-draft' };
  const claimed = await f.claim(p.token, a.turn.task.id); const session = randomUUID();
  expect(claimed.task.messageSettings).toEqual(p.settings());
  await f.report(p.token, claimed, [{ type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' }, { type: 'completed', outcome: 'succeeded' }]);
  const promotion = await promoteReady(f.pool, f.boss, c);
  expect(promotion).toMatchObject({ outcome: 'promoted', receipt: { item: { id: queued.item.id, messageSettings: p.settings(1) } } });
  if (promotion.outcome !== 'promoted') throw new Error('Expected promotion');
  const b = await f.claim(p.token, promotion.receipt.item.promoted!.taskId);
  expect(b.task).toMatchObject({ resumeSessionId: session, messageSettings: p.settings(1) });
  await f.report(p.token, b, [{ type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' }, { type: 'completed', outcome: 'succeeded' }]);
  const next = await enqueue(c, p.settings(), 2);
  const resumed = await f.http<ConversationQueueResumed>(`/api/conversations/${c}/queue/resume`, { expectedQueueRevision: 3, expectedTaskId: b.task.id }, { status: 202 });
  expect(resumed.promoted).toMatchObject({ id: next.item.id, messageSettings: p.settings() });
  expect(await enqueue(c, p.settings(1), 0, queueKey)).toEqual({ ...queued, replayed: true });
  await f.pool.query('UPDATE flow.conversation_queue SET message_settings=message_settings WHERE id=$1', [queued.item.id]);
  await f.pool.query('UPDATE flow.tasks SET submission=submission WHERE id=$1', [a.turn.task.id]);
  await expect(f.pool.query('UPDATE flow.conversation_queue SET message_settings=$2 WHERE id=$1', [queued.item.id, p.settings()])).rejects.toMatchObject({ code: '23514' });
  await expect(f.pool.query("UPDATE flow.tasks SET submission=jsonb_set(submission,'{messageSettings}',$2) WHERE id=$1", [a.turn.task.id, JSON.stringify(p.settings(1))])).rejects.toMatchObject({ code: '23514' });
  await expect(f.pool.query("UPDATE flow.tasks SET submission=submission-'messageSettings' WHERE id=$1", [a.turn.task.id])).rejects.toMatchObject({ code: '23514' });
});

it('rejects opt-in bypass and steer before writes while retaining unavailable legacy queued intents', async () => {
  const p = await f.profile(); const c = await f.conversation(p.reference); const before = await counts();
  for (const input of [{ expectedRevision: 0, text: 'missing settings' }, { expectedRevision: 0, text: 'unsupported mode', mode: 'steer', messageSettings: p.settings() }]) {
    await f.http(`/api/conversations/${c}/turns`, input, { status: 409 });
  }
  await f.http(`/api/conversations/${c}/queue`, { expectedQueueRevision: 0, text: 'missing settings' }, { status: 409 });
  await f.http('/api/tasks', { title: 'direct bypass', prompt: 'x', harness: 'claude', executionProfile: p.reference }, { status: 409 });
  await f.http('/api/tasks', { title: 'cross identity', prompt: 'x', harness: 'claude', executionProfile: { ...p.reference, runnerId: randomUUID() }, messageSettings: p.settings() }, { status: 400 });
  expect(await counts()).toEqual(before);
  for (const invalid of [false, true]) {
    const old = await f.profile(false); const oldConversation = await f.conversation(old.reference);
    if (invalid) await f.pool.query('UPDATE flow.conversations SET execution_profile=$2 WHERE id=$1', [oldConversation, { ...old.reference, configDigest: '0'.repeat(64) }]);
    else await f.http(`/api/runners/${old.runnerId}/revoke`, {});
    const accepted = await enqueue(oldConversation, undefined);
    expect(accepted.item.state).toBe('waiting');
    expect(await promoteReady(f.pool, f.boss, oldConversation)).toMatchObject({ outcome: 'blocked', reason: 'execution-profile-unavailable' });
  }
});

it('keeps legacy conversation requests and typed replies readable and resumable without new fields', async () => {
  const p = await f.profile(false); const c = await f.conversation(p.reference);
  const accepted = await f.http<{ turn: { task: { id: string }; messageSettings?: unknown } }>(`/api/conversations/${c}/turns`, { expectedRevision: 0, text: 'Old request' }, { status: 202 });
  expect(accepted.turn).not.toHaveProperty('messageSettings');
  const assignment = await f.claim(p.token, accepted.turn.task.id); const session = randomUUID(); const sourceMessageId = randomUUID();
  await f.report(p.token, assignment, [{ type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' },
    { type: 'assistant-final', source: 'claude.sdk.result', sourceMessageId, nativeSessionId: session,
      messageId: sha256(JSON.stringify([session, sourceMessageId])), content: 'Legacy answer',
      settings: { requested: { model: 'legacy-profile-model', permissionMode: 'dontAsk', thinking: 'disabled' },
        effective: { model: 'legacy-resolved', permissionMode: 'dontAsk', tools: [], thinking: 'unknown' } } },
    { type: 'completed', outcome: 'succeeded' }]);
  const read = await f.http<ConversationSnapshot>(`/api/conversations/${c}`);
  expect(read.lastTurn!.effective).toMatchObject({ model: 'legacy-resolved', runnerRequested: { thinking: 'disabled' } });
  expect(read.lastTurn!.effective).not.toHaveProperty('messageSettings');
  const next = await f.http<{ turn: { task: { id: string } } }>(`/api/conversations/${c}/turns`, { expectedRevision: 1, text: 'Legacy continuation' }, { status: 202 });
  const resumed = await f.claim(p.token, next.turn.task.id);
  expect(resumed.task.resumeSessionId).toBe(session); expect(resumed.task).not.toHaveProperty('messageSettings');
  await f.report(p.token, resumed, [{ type: 'completed', outcome: 'cancelled' }]);
});

it('blocks uncertain effort inheritance on both promotion paths and permits empty unpause without a task', async () => {
  const p = await f.profile(); const c = await f.conversation(p.reference);
  const emptyBefore = await counts();
  await f.http(`/api/conversations/${c}/queue/pause`, { expectedQueueRevision: 0 });
  expect(await f.http<ConversationQueueResumed>(`/api/conversations/${c}/queue/resume`, { expectedQueueRevision: 1, expectedTaskId: null }, { status: 202 })).toMatchObject({ promoted: null, paused: false });
  expect((await counts()).tasks).toBe(emptyBefore.tasks); expect((await counts()).wakes).toBe(emptyBefore.wakes);
  const run = await execution(p, c); const activeCounts = await counts();
  await f.http(`/api/conversations/${c}/queue/resume`, { expectedQueueRevision: 2, expectedTaskId: run.assignment.task.id }, { status: 409 });
  expect(await counts()).toEqual(activeCounts);
  await complete(p, run.assignment);
  await enqueue(c, p.settings(2), 2);
  expect(await promoteReady(f.pool, f.boss, c)).toMatchObject({ outcome: 'blocked', reason: 'message-settings-unsupported' });
  await f.http(`/api/conversations/${c}/queue/resume`, { expectedQueueRevision: 3, expectedTaskId: run.assignment.task.id }, { status: 409 });
  expect(await f.http<ConversationQueuePage>(`/api/conversations/${c}/queue`)).toMatchObject({ blocked: 'message-settings-unsupported', items: [{ messageSettings: p.settings(2), state: 'waiting' }] });
  const empty = await f.conversation(p.reference); const missing = await f.send(empty, p.settings());
  await f.pool.query("UPDATE flow.tasks SET status='failed' WHERE id=$1", [missing.turn.task.id]);
  await f.http(`/api/conversations/${empty}/queue/resume`, { expectedQueueRevision: 0, expectedTaskId: missing.turn.task.id }, { status: 409 });
});

it('binds typed final and context model to the frozen task and rolls back a mismatching whole event batch', async () => {
  const p = await f.profile(); const c = await f.conversation(p.reference); const run = await execution(p, c);
  const before = (await f.pool.query('SELECT count(*)::int AS count FROM flow.details WHERE task_id=$1', [run.assignment.task.id])).rows[0].count;
  await f.report(p.token, run.assignment, [{ type: 'detail', title: 'Must rollback', content: 'synthetic', mediaType: 'text/plain' }, final(p.settings(1), run.session)], 2, 409);
  expect((await f.pool.query('SELECT count(*)::int AS count FROM flow.details WHERE task_id=$1', [run.assignment.task.id])).rows[0].count).toBe(before);
  expect((await f.pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [run.assignment.attempt.id])).rows[0].last_sequence).toBe(1);
  const observation: RunnerEventData = { type: 'context-observation', observation: { source: CLAUDE_CONTEXT_SOURCE, observationId: randomUUID(), observedAt: new Date().toISOString(), nativeSessionId: run.session,
    resolvedModel: 'synthetic-resolved', used: 12, compactionWindow: 1000, categories: [{ kind: 'used', tokens: 12 }] } };
  await f.report(p.token, run.assignment, [observation, final(p.settings(), run.session), { type: 'completed', outcome: 'succeeded' }], 2);
  const value = await f.http<ConversationSnapshot>(`/api/conversations/${c}`);
  expect(value.lastTurn).toMatchObject({ messageSettings: p.settings(), effective: { messageSettings: { snapshot: p.settings(), observed: { model: 'synthetic-resolved', effort: null, fastModeState: 'cooldown' } }, model: 'synthetic-resolved', thinking: 'unknown' } });
  expect(value.lastTurn!.effective).not.toHaveProperty('runnerRequested');
  const history = await f.http<ContextHistoryResponse>(`/api/tasks/${run.assignment.task.id}/context/history`);
  expect(history.latest?.observation.identity).toMatchObject({ requestedModel: choices[0]!.model, resolvedModel: 'synthetic-resolved' });
  expect(history.current.kind).toBe('unknown');
});

it('retains the snapshot through audited retry and rejects a now-unavailable profile before any new retry writes', async () => {
  for (const revoked of [false, true]) {
    const p = await f.profile(); const c = await f.conversation(p.reference); const initial = await execution(p, c);
    await complete(p, initial.assignment);
    const next = await f.send(c, p.settings(1), 1); const assignment = await f.claim(p.token, next.turn.task.id);
    expect(assignment.task.resumeSessionId).toBe(initial.session);
    // Controlled uncertain state, not an OS process or inferred native settlement.
    await f.pool.query("UPDATE flow.tasks SET status='uncertain' WHERE id=$1", [assignment.task.id]);
    const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
    const resolution = await f.http<ReconciliationResult>(`/api/tasks/${assignment.task.id}/reconciliation/resolve`, { ...ownership, stoppedConfirmed: true,
      stopEvidence: { explanation: 'Synthetic reporter has no native process.', references: [] }, sideEffects: 'none-confirmed',
      effectsEvidence: { explanation: 'Synthetic metadata only.', references: [] }, outcome: 'cancelled' });
    if (revoked) await f.http(`/api/runners/${p.runnerId}/revoke`, {});
    const key = randomUUID(); const input = { ...ownership, resolutionId: resolution.audit.id, safety: { strategy: 'no-side-effects', evidence: { explanation: 'Synthetic retry fixture.', references: [] } } };
    const before = await counts();
    if (revoked) {
      await f.http(`/api/tasks/${assignment.task.id}/reconciliation/retry`, input, { key, status: 409 });
      expect(await counts()).toEqual(before);
    } else {
      const retry = await f.http<ReconciliationRetryResult>(`/api/tasks/${assignment.task.id}/reconciliation/retry`, input, { key });
      expect(await f.http(`/api/tasks/${assignment.task.id}/reconciliation/retry`, input, { key })).toEqual({ ...retry, replayed: true });
      const claimed = await f.claim(p.token, retry.task.id);
      expect(claimed.task.messageSettings).toEqual(p.settings(1)); expect(claimed.task.executionProfile).toEqual(p.reference);
      expect(claimed.task).not.toHaveProperty('resumeSessionId');
      await f.report(p.token, claimed, [{ type: 'completed', outcome: 'cancelled' }]);
    }
  }
});
