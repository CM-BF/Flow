import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrate, sha256, transaction } from '../database.js';
import { migrateWorkspace } from '../m2-workspace.js';
import { migrateNativeHarnessSources } from '../native-harness-migration.js';
import { readAssistantFinalPreview } from './store.js';
import { assistantMessageId, codexSourceMessageId } from '../native-harness-policy.js';
import { executionProfileConfigurationJson, type CodexExecutionProfileConfiguration, type ExecutionProfilePage } from '../../../../packages/contracts/src/execution-profiles.js';

const database = `flow_r05b_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const ownerToken = 'r05b-owner';
const old = { task: randomUUID(), runner: randomUUID(), attempt: randomUUID(), detail: randomUUID(), profile: randomUUID(), session: 'shared-native-session', event: randomUUID() };
const nativeSourceIdentity = { turnId: 'native-turn', itemId: 'native-item' };
const oldSourceMessageId = codexSourceMessageId(nativeSourceIdentity);
const oldMessageId = assistantMessageId('claude.sdk.result', old.session, oldSourceMessageId);
const oldConfiguration = { harness: 'claude' as const, adapterVersion: 'claude-sdk-0.3.290-v2' as const, model: 'sonnet', thinking: 'disabled' as const, permissionMode: 'dontAsk' as const,
  access: 'none' as const, requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 } };
const oldSettings = { requested: { model: 'sonnet', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } };
let pool: Pool;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let base = '';
let created = false;
let beforeUpgrade: unknown;
let afterUpgrade: unknown;
let migrationTime: unknown;
const facts: Record<string, unknown> = { database, providerCalls: 0, appServerStarts: 0, authRequests: 0 };
async function startServer() { app = await createServer({ databaseUrl, ownerToken, leaseMs: 60_000 }); base = await app.listen({ host: '127.0.0.1', port: 0 }); }
async function stopServer() { app?.server.closeAllConnections(); await app?.close(); app = undefined; }
async function oldRows() {
  return { final: (await pool.query('SELECT ordinal,id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings,created_at FROM flow.assistant_messages WHERE id=$1', [oldMessageId])).rows[0],
    profile: (await pool.query('SELECT * FROM flow.execution_profiles WHERE id=$1', [old.profile])).rows[0],
    detail: (await pool.query('SELECT * FROM flow.details WHERE id=$1', [old.detail])).rows[0] };
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 5000 });
  await migrate(pool); await migrateWorkspace(pool);
  // Build the actual pre-025 schema from immutable checked-in migrations, never downgrade a live database.
  const directory = new URL('../../../../packages/storage/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => /^(00[4-9]|01\d|02[0-4])-/.test(name)).sort()) {
    await transaction(pool, async client => {
      await client.query(await readFile(new URL(file, directory), 'utf8'));
      await client.query('INSERT INTO flow.migrations(version) VALUES($1) ON CONFLICT DO NOTHING', [Number(file.slice(0, 3))]);
    });
  }
  const oldDigest = sha256(executionProfileConfigurationJson(oldConfiguration));
  await transaction(pool, async client => {
    await client.query("INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,'old Claude',$2,ARRAY['claude'],1)", [old.runner, sha256('legacy-seed-token')]);
    await client.query("INSERT INTO flow.tasks(id,submission,status,owner_version,current_attempt_id) VALUES($1,$2,'succeeded',1,$3)", [old.task, { title: '旧记录', prompt: '旧记录', harness: 'claude' }, old.attempt]);
    await client.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,native_session_id,completed_at) VALUES($1,$2,$3,1,clock_timestamp(),$4,clock_timestamp())", [old.attempt, old.task, old.runner, old.session]);
    await client.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'claude',$2)", [old.session, old.runner]);
    await client.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Assistant reply','detail','旧正文 🌱','text/plain')", [old.detail, old.task, old.attempt]);
    await client.query('INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings) VALUES($1,$2,$3,$4,2,$5,$6,$7,$8,$9,$10)', [oldMessageId, old.task, old.attempt, old.event, old.session, 'claude.sdk.result', oldSourceMessageId, sha256('旧正文 🌱'), old.detail, oldSettings]);
    await client.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)', [old.profile, old.runner, oldDigest, oldConfiguration]);
  });
  beforeUpgrade = await oldRows();
  const migrationStarted = performance.now();
  await migrateNativeHarnessSources(pool);
  facts.migrationMs = performance.now() - migrationStarted;
  afterUpgrade = await oldRows();
  migrationTime = (await pool.query('SELECT applied_at FROM flow.migrations WHERE version=25')).rows[0].applied_at;
  await migrateNativeHarnessSources(pool);
  facts.oldRowsDigestBefore = sha256(JSON.stringify(beforeUpgrade)); facts.oldRowsDigestAfter = sha256(JSON.stringify(afterUpgrade));
  facts.pgVersion = (await pool.query('SHOW server_version')).rows[0].server_version;
  await startServer();
});
afterAll(async () => {
  try {
    await stopServer(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
  } finally {
    await admin.end();
    if (process.env.FLOW_R05B_EVIDENCE) await writeFile(process.env.FLOW_R05B_EVIDENCE, JSON.stringify(facts, null, 2) + '\n');
  }
});
async function request(path: string, body?: unknown, token = ownerToken, expected = 200) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const json = await response.json(); expect(response.status, JSON.stringify(json)).toBe(expected); return json;
}
function configuration(maxOutputBytes = 1_048_576): CodexExecutionProfileConfiguration {
  return { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'gpt-5.4', reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 3000, maxOutputBytes } };
}
async function runner(harness: 'codex' | 'claude' = 'codex', maxOutputBytes?: number) {
  const registration = await request('/api/runners', { name: 'R05B injected protocol', harnesses: [harness], capacity: 1 });
  const publication = await request('/api/runner/execution-profile', { configuration: harness === 'codex' ? configuration(maxOutputBytes) : oldConfiguration }, registration.token);
  return { ...registration, profile: publication.profile };
}
async function attempt(options: { harness?: 'codex' | 'claude'; session?: string; adapterVersion?: string; maxOutputBytes?: number } = {}) {
  const harness = options.harness ?? 'codex';
  const registered = await runner(harness, options.maxOutputBytes);
  const accepted = await request('/api/tasks', { title: 'Native final', prompt: 'Injected only', harness, executionProfile: registered.profile.reference }, ownerToken, 202);
  let assignment: any;
  for (let tries = 0; tries < 100; tries++) {
    assignment = (await request('/api/runner/claim', {}, registered.token)).assignment;
    if (assignment) break; await sleep(10);
  }
  expect(assignment?.task.id).toBe(accepted.task.id);
  const nativeSessionId = options.session ?? randomUUID();
  return { ...registered, taskId: accepted.task.id, ownership: { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion }, nativeSessionId,
    session: { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: options.adapterVersion ?? registered.profile.configuration.adapterVersion } };
}
function final(a: { nativeSessionId: string }, content = '最终正文 🌱') {
  const sourceMessageId = codexSourceMessageId(nativeSourceIdentity);
  return { id: randomUUID(), sequence: 2, type: 'assistant-final', source: 'codex.app-server.agent-message', nativeSessionId: a.nativeSessionId,
    sourceMessageId, nativeSourceIdentity, messageId: assistantMessageId('codex.app-server.agent-message', a.nativeSessionId, sourceMessageId), content,
    settings: { requested: { model: 'gpt-5.4', reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none' },
      observedThreadConfiguration: { model: 'gpt-5.4', modelProvider: 'openai', reasoningEffort: null, serviceTier: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } },
      actualExecution: { model: null, reasoningEffort: null, serviceTier: null, tools: null, evidence: 'unknown' } } };
}
const report = (a: any, events: unknown[], expected = 200, owner = a.ownership) => request('/api/runner/events', { ...owner, events }, a.token, expected);
it('upgrades real old final/profile rows unchanged and reruns 025 without replacement', async () => {
  expect(afterUpgrade).toEqual(beforeUpgrade);
  const index = (await pool.query("SELECT indexdef FROM pg_indexes WHERE schemaname='flow' AND indexname='details_native_session_evidence'")).rows[0]?.indexdef;
  expect(index).toContain('(task_id, attempt_id)');
  expect(index).toContain("WHERE (kind = 'session'::text)");
  facts.sessionEvidenceIndex = index;
  expect((await pool.query('SELECT applied_at FROM flow.migrations WHERE version=25')).rows[0].applied_at).toEqual(migrationTime);
  const message = await request(`/api/assistant-messages/${oldMessageId}`);
  expect(message).toMatchObject({ id: oldMessageId, content: '旧正文 🌱', settings: oldSettings, sourceMessageId: oldSourceMessageId });
  expect(message).not.toHaveProperty('nativeSourceIdentity');
  expect((await pool.query('SELECT native_source_identity FROM flow.assistant_messages WHERE id=$1', [oldMessageId])).rows[0].native_source_identity).toBeNull();
  expect((await request('/api/execution-profiles')).profiles.find((profile: any) => profile.reference.id === old.profile).reference.configDigest).toBe(sha256(executionProfileConfigurationJson(oldConfiguration)));
});
it('stores a Codex final with the same native session/source-message names in a separate namespace', async () => {
  const a = await attempt({ session: old.session }); const event = final(a);
  expect(event.messageId).not.toBe(oldMessageId);
  expect(await report(a, [a.session, event])).toEqual({ accepted: 2, lastSequence: 2 });
  const message = await request(`/api/assistant-messages/${event.messageId}`);
  expect(message).toMatchObject({ source: event.source, content: event.content, nativeSourceIdentity, settings: event.settings });
  const page = await request(`/api/tasks/${a.taskId}/assistant-messages`);
  expect(page.messages).toHaveLength(1); expect(page.messages[0]).not.toHaveProperty('content'); expect(page.messages[0]).not.toHaveProperty('settings');
  expect((await pool.query('SELECT count(*) FROM flow.assistant_messages WHERE native_session_id=$1 AND source_message_id=$2', [old.session, oldSourceMessageId])).rows[0].count).toBe('2');
  expect((await request(`/api/tasks/${a.taskId}`)).usage).toMatchObject({ inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true });
});
it('preserves ordered ACK replay across a center restart and rejects altered replay', async () => {
  const a = await attempt(); const event = final(a); const completed = { id: randomUUID(), sequence: 3, type: 'completed', outcome: 'succeeded' };
  expect(await report(a, [a.session, event, completed])).toEqual({ accepted: 3, lastSequence: 3 });
  await stopServer(); await startServer();
  expect(await report(a, [a.session, event, completed])).toEqual({ accepted: 0, lastSequence: 3 });
  expect((await report(a, [{ ...event, content: 'different' }], 409)).error.code).toBe('event_conflict');
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
});
it('rejects missing session, forged raw identities, a legacy ID and cross-harness source atomically', async () => {
  const a = await attempt(); const event = final(a);
  expect((await report(a, [{ ...event, sequence: 1 }], 409)).error.code).toBe('assistant_session_mismatch');
  expect((await report(a, [a.session, { ...event, nativeSourceIdentity: { turnId: 'other', itemId: 'native-item' } }], 409)).error.code).toBe('assistant_identity');
  expect((await report(a, [a.session, { ...event, messageId: assistantMessageId('claude.sdk.result', a.nativeSessionId, event.sourceMessageId) }], 409)).error.code).toBe('assistant_identity');
  expect((await request(`/api/tasks/${a.taskId}`)).attempt).not.toHaveProperty('nativeSessionId');
  const claude = await attempt({ harness: 'claude' });
  expect((await report(claude, [claude.session, final(claude)], 409)).error.code).toBe('assistant_session_mismatch');
});
it('requires the recognized adapter version, requested profile and host output bound', async () => {
  const unknown = await attempt({ adapterVersion: 'codex-next' });
  expect((await report(unknown, [unknown.session, final(unknown)], 409)).error.code).toBe('assistant_source_mismatch');
  const legacyUnknown = await attempt({ harness: 'claude', adapterVersion: 'claude-unknown' });
  const sourceMessageId = randomUUID();
  const legacyFinal = { id: randomUUID(), sequence: 2, type: 'assistant-final', source: 'claude.sdk.result', nativeSessionId: legacyUnknown.nativeSessionId, sourceMessageId,
    messageId: assistantMessageId('claude.sdk.result', legacyUnknown.nativeSessionId, sourceMessageId), content: 'unknown adapter', settings: oldSettings };
  expect((await report(legacyUnknown, [legacyUnknown.session, legacyFinal], 409)).error.code).toBe('assistant_source_mismatch');
  const a = await attempt({ maxOutputBytes: 3 });
  expect((await report(a, [a.session, final(a, '🌱')], 409)).error.code).toBe('assistant_configuration_mismatch');
  const event = final(a, 'ok');
  expect((await report(a, [a.session, { ...event, settings: { ...event.settings, requested: { ...event.settings.requested, serviceTierForTurn: null } } }], 409)).error.code).toBe('assistant_configuration_mismatch');
  expect(await report(a, [a.session, event])).toEqual({ accepted: 2, lastSequence: 2 });
});
it('retains owner fencing and does not manufacture a final for failed native execution', async () => {
  const a = await attempt();
  await report(a, [a.session], 409, { ...a.ownership, ownerVersion: a.ownership.ownerVersion + 1 });
  expect(await report(a, [a.session, { id: randomUUID(), sequence: 2, type: 'completed', outcome: 'failed', error: 'Injected native failure' }])).toEqual({ accepted: 2, lastSequence: 2 });
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toEqual([]);
  expect((await report(a, [{ ...final(a), sequence: 3 }], 409)).error.code).toBe('stale_owner');
});
it('enforces session runner ownership and same-source uniqueness without replacing rows', async () => {
  const first = await attempt(); const event = final(first);
  await report(first, [first.session, event]);
  const second = await attempt({ session: first.nativeSessionId });
  expect((await report(second, [second.session], 409)).error.code).toBe('session_owned');
  const another = await attempt(); const anotherEvent = final(another); await report(another, [another.session, anotherEvent]);
  await expect(pool.query('UPDATE flow.assistant_messages SET native_session_id=$1,source_message_id=$2 WHERE id=$3', [first.nativeSessionId, event.sourceMessageId, anotherEvent.messageId])).rejects.toMatchObject({ code: '23505' });
  expect((await request(`/api/assistant-messages/${event.messageId}`)).content).toBe(event.content);
});
it('rejects unknown sources and malformed raw identity at the database seam', async () => {
  const a = await attempt(); const event = final(a); await report(a, [a.session, event]);
  await expect(pool.query("UPDATE flow.assistant_messages SET source='unknown.final' WHERE id=$1", [event.messageId])).rejects.toMatchObject({ code: '23514' });
  for (const identity of [null, {}, { turnId: null, itemId: 'item' }, { turnId: 'turn', itemId: 'item', extra: true }, { turnId: '界'.repeat(43), itemId: 'item' }]) {
    await expect(pool.query('UPDATE flow.assistant_messages SET native_source_identity=$2 WHERE id=$1', [event.messageId, identity])).rejects.toMatchObject({ code: '23514' });
  }
  await pool.query('UPDATE flow.assistant_messages SET settings=$2 WHERE id=$1', [event.messageId, oldSettings]);
  expect((await request(`/api/assistant-messages/${event.messageId}`, undefined, ownerToken, 409)).error.code).toBe('assistant_source_mismatch');
  await pool.query('UPDATE flow.assistant_messages SET settings=$2 WHERE id=$1', [event.messageId, event.settings]);
  await pool.query('UPDATE flow.assistant_messages SET native_source_identity=$2 WHERE id=$1', [event.messageId, { turnId: 'tampered', itemId: 'item' }]);
  expect((await request(`/api/assistant-messages/${event.messageId}`, undefined, ownerToken, 409)).error.code).toBe('assistant_identity');
});
it('filters mixed profiles before limits and keeps Codex out of Claude conversations', async () => {
  const codex = await runner(); const claude = await runner('claude');
  const selected: string[] = []; let cursor: string | null = null;
  do {
    const response: Response = await fetch(base + '/api/execution-profiles?limit=1' + (cursor ? `&after=${cursor}` : ''), { headers: { authorization: `Bearer ${ownerToken}` } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    const page: ExecutionProfilePage = await response.json(); expect(page.profiles).toHaveLength(1);
    expect(page.profiles[0]!.configuration.harness).toBe('claude'); selected.push(page.profiles[0]!.reference.id); cursor = page.nextCursor;
  } while (cursor);
  expect(selected).toContain(claude.profile.reference.id); expect(selected).not.toContain(codex.profile.reference.id);
  expect(new Set(selected).size).toBe(selected.length);
  const body = { title: 'Not a Codex conversation', harness: 'claude', requested: { model: 'gpt-5.4', thinking: 'disabled', tools: 'none' }, executionProfile: codex.profile.reference };
  expect((await request('/api/conversations', body, ownerToken, 409)).error.code).toBe('profile_harness_mismatch');
  await request('/api/conversations', { ...body, harness: 'codex' }, ownerToken, 400);
  await request('/api/tasks', { title: 'Unpinned', prompt: 'no', harness: 'codex' }, ownerToken, 400);
  await request('/api/tasks', { title: 'Mismatch', prompt: 'no', harness: 'codex', executionProfile: claude.profile.reference }, ownerToken, 409);
});
it('preserves immutable publication, rejects unknown versions and does not leak Codex through steering negotiation', async () => {
  const a = await runner();
  expect((await request('/api/runner/execution-profile', { configuration: configuration() }, a.token)).replayed).toBe(true);
  expect((await request('/api/runner/execution-profile', { configuration: { ...configuration(), model: 'another-model' } }, a.token, 409)).error.code).toBe('profile_immutable');
  await request('/api/runner/execution-profile', { configuration: { ...configuration(), adapterVersion: 'codex-next' } }, a.token, 400);
  for (const header of ['steering-v1', 'unknown']) {
    const page = await (await fetch(base + '/api/execution-profiles', { headers: { authorization: `Bearer ${ownerToken}`, 'X-Flow-Execution-Profile': header } })).json();
    expect(page.profiles.every((profile: any) => profile.configuration.harness === 'claude')).toBe(true);
  }
});

it('keeps a maximum-sized native body out of list responses and bounds the preview read', async () => {
  const a = await attempt(); const event = final(a, 'x'.repeat(1_048_576)); await report(a, [a.session, event]);
  const page = await request(`/api/tasks/${a.taskId}/assistant-messages`);
  const preview = await transaction(pool, client => readAssistantFinalPreview(client, a.taskId, a.ownership.attemptId), true);
  expect(preview).toMatchObject({ text: 'x'.repeat(4000), truncated: true, nativeSourceIdentity });
  expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(2048);
  facts.boundedReadSample = { bodyUtf8Bytes: Buffer.byteLength(event.content), pageJsonBytes: Buffer.byteLength(JSON.stringify(page)), previewUtf8Bytes: Buffer.byteLength(preview!.text), pageContainsBody: JSON.stringify(page).includes(event.content) };
});
