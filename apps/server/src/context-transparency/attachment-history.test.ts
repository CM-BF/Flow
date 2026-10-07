import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { conversationCreationSchema, conversationTurnSchema, eventBatchSchema, type ClaimedTask, type KnowledgeCitation } from '@flow/contracts';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { CLAUDE_CONTEXT_SOURCE } from '../../../../packages/contracts/src/context-observation-event.js';
import { contextHistoryResponseSchema } from '../../../../packages/contracts/src/context-observation-history.js';
import { conversationContextReferenceSchema } from '../../../../packages/contracts/src/conversation-context.js';
import { canonical, sha256 } from '../database.js';
import { createServer } from '../index.js';

const database = `flow_wpf04_attachment_${randomUUID().replaceAll('-', '')}`;
const bounds = { connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 7000 };
const admin = new Pool({ ...bounds, connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ ...bounds, connectionString: databaseUrl, max: 2 });
const ownerToken = randomUUID();
const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerCalls: 0, manualMount: false };
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let owner: FlowClient;
let creationRequested = false;
async function start() {
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 300_000 });
  owner = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: ownerToken });
}
beforeAll(async () => {
  expect((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows).toEqual([]);
  creationRequested = true;
  await admin.query(`CREATE DATABASE "${database}"`);
  await start();
});
afterAll(async () => {
  const errors: string[] = [];
  const attempt = async <T>(name: string, run: () => Promise<T>): Promise<T | undefined> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('cleanup deadline')), 8000); })]); }
    catch { errors.push(name); return undefined; }
    finally { clearTimeout(timer); }
  };
  await attempt('app-close', async () => app?.close());
  await attempt('pool-close', () => pool.end());
  const exists = await attempt('database-exists', () => admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database]));
  const connections = await attempt('database-connections', () => admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database]));
  if (creationRequested && exists?.rows.length === 1 && connections?.rows.length === 0) await attempt('database-drop', () => admin.query(`DROP DATABASE "${database}"`));
  const remaining = await attempt('database-remaining', () => admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database]));
  await attempt('admin-close', () => admin.end());
  Object.assign(facts, { creationRequested, connections: connections?.rows ?? null, remaining: remaining?.rows ?? null, errors, finishedAt: new Date().toISOString() });
  if (process.env.FLOW_WPF04_ATTACHMENT_EVIDENCE) await writeFile(process.env.FLOW_WPF04_ATTACHMENT_EVIDENCE, JSON.stringify(facts, null, 2) + '\n');
  expect(errors).toEqual([]); expect(connections?.rows).toEqual([]); expect(remaining?.rows).toEqual([]);
}, 60_000);

async function fixture(kind: 'attachment-only' | 'mixed' | 'knowledge') {
  const registration = await owner.registerRunner({ name: `Synthetic ${kind} reporter`, harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  const { profile } = await runner.publishExecutionProfile({ configuration: { harness: 'claude', adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion,
    model: 'sonnet', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false,
    materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } });
  const projectId = (await owner.createProject({ workspaceId: 'personal', title: kind }, randomUUID())).snapshot.project.id;
  const text = 'PRIVATE_ATTACHMENT_資料🙂'; const knowledgeText = 'PRIVATE_KNOWLEDGE_資料🙂';
  const attachments = [];
  if (kind !== 'knowledge') {
    const capabilities = await owner.attachmentCapabilities(projectId);
    const uploaded = await owner.uploadAttachment(projectId, { recoveryScopeId: capabilities.recoveryScopeId, name: 'context.txt', mediaType: 'text/plain', text,
      byteLength: Buffer.byteLength(text), contentDigest: sha256(text) }, randomUUID());
    attachments.push(uploaded.resource.reference);
  }
  const knowledge: KnowledgeCitation[] = [];
  if (kind !== 'attachment-only') {
    const source = await owner.createKnowledgeSource(projectId, { expectedVersion: 0, title: 'Knowledge', text: knowledgeText }, randomUUID());
    knowledge.push({ projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest,
      locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(knowledgeText) } });
  }
  const conversationId = (await owner.createConversation(conversationCreationSchema.parse({ title: kind, projectId, executionProfile: profile.reference }), randomUUID())).conversation.id;
  const turn = await owner.submitConversationTurn(conversationId, conversationTurnSchema.parse({ expectedRevision: 0, text: 'Use the selected material.', attachments, knowledge }), randomUUID());
  const context = conversationContextReferenceSchema.parse(turn.turn.context);
  let claimed: ClaimedTask | null = null;
  await expect.poll(async () => { claimed = (await runner.claim()).assignment; return claimed?.task.id; }, { timeout: 5000 }).toBe(turn.turn.task.id);
  const assignment = claimed as unknown as ClaimedTask;
  expect(assignment.conversationContext?.executionInputDigest).toBe(context.executionInputDigest);
  if (attachments.length) expect(assignment.task.prompt).toContain(text);
  if (knowledge.length) expect(assignment.task.prompt).toContain(knowledgeText);
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const nativeSessionId = randomUUID();
  await runner.report({ ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion }] });
  const observation = { source: CLAUDE_CONTEXT_SOURCE, observationId: randomUUID(), observedAt: new Date().toISOString(), nativeSessionId,
    resolvedModel: 'synthetic-resolved-model', used: 123, compactionWindow: 1000, categories: [{ kind: 'used' as const, tokens: 123 }] };
  const batch = eventBatchSchema.parse({ ...ownership, events: [{ id: randomUUID(), sequence: 2, type: 'context-observation', observation }] });
  return { runner, taskId: assignment.task.id, assignment, ownership, context, conversationId, batch, observation, knowledge };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function history(f: Fixture) {
  const value = contextHistoryResponseSchema.parse(await owner.contextHistory(f.taskId));
  expect(value.latest?.observation.identity).toMatchObject({ executionInputDigest: f.context.executionInputDigest,
    requestedModel: 'sonnet', resolvedModel: 'synthetic-resolved-model', subject: { taskId: f.taskId, attemptId: f.assignment.attempt.id, ownerVersion: f.ownership.ownerVersion } });
  expect(value.current).toEqual({ kind: 'unknown', value: null, reason: 'history-only' });
  expect(value.remaining).toEqual({ kind: 'unknown', value: null, reason: 'history-only' });
  expect(JSON.stringify(value)).not.toContain('PRIVATE_');
  return value;
}
const complete = (f: Fixture, sequence = 3) => f.runner.report({ ...f.ownership, events: [{ id: randomUUID(), sequence, type: 'completed', outcome: 'succeeded' }] });

it('records attachment-only v2 through reportEvents, completes and reads history without claiming known empty materials', async () => {
  const f = await fixture('attachment-only');
  expect(f.context).toMatchObject({ templateVersion: 2, sources: [], attachments: [{ byteLength: Buffer.byteLength('PRIVATE_ATTACHMENT_資料🙂') }] });
  expect(await f.runner.report(f.batch)).toEqual({ accepted: 1, lastSequence: 2 });
  expect(await complete(f)).toEqual({ accepted: 1, lastSequence: 3 });
  expect((await owner.show(f.taskId)).status).toBe('succeeded');
  const result = await history(f);
  expect(result.latest?.materials).toEqual({ state: 'unknown', reason: 'metadata-unavailable' });
  expect(result.latest?.observation.identity.materialRevisionDigest).toBeNull();
  expect(result.latest?.eventSequence).toBe(2);
  expect(await f.runner.report(f.batch)).toEqual({ accepted: 0, lastSequence: 3 });
  expect(await history(f)).toEqual(result);
  const detail = await owner.conversationContext(f.conversationId, f.context.id);
  expect(detail).toMatchObject({ templateVersion: 2, attachments: [{ text: 'PRIVATE_ATTACHMENT_資料🙂' }] });
});

it('keeps mixed v2 inventory explicitly unknown while retaining both frozen inputs', async () => {
  const f = await fixture('mixed');
  expect(f.context).toMatchObject({ templateVersion: 2, sources: [{ citation: f.knowledge[0] }], attachments: [{ name: 'context.txt' }] });
  await f.runner.report(f.batch);
  const result = await history(f);
  expect(result.latest?.materials).toEqual({ state: 'unknown', reason: 'metadata-unavailable' });
  expect(result.latest?.observation.identity.materialRevisionDigest).toBeNull();
  await expect(f.runner.contextHistory(f.taskId)).rejects.toMatchObject({ status: 403 });
  const url = `${app!.listeningOrigin}/api/tasks/${f.taskId}/context/history`;
  expect((await fetch(url)).status).toBe(401);
  const response = await fetch(url, { headers: { authorization: `Bearer ${ownerToken}` } });
  expect(response.headers.get('cache-control')).toBe('no-store'); await response.arrayBuffer();
  await complete(f);
});

it('preserves v1 known citations and original persisted history across center restart', async () => {
  const f = await fixture('knowledge');
  expect(f.context.templateVersion).toBe(1);
  await f.runner.report(f.batch); await complete(f);
  const result = await history(f);
  expect(result.latest?.materials).toEqual({ state: 'known', sources: [{ citation: f.knowledge[0], byteLength: Buffer.byteLength('PRIVATE_KNOWLEDGE_資料🙂'), tokens: null }] });
  expect(result.latest?.observation.identity.materialRevisionDigest).toBe(sha256(canonical({ version: 1, citations: f.knowledge })));
  await app!.close(); app = undefined; await start();
  expect(await history(f)).toEqual(result);
});

it('rolls back the entire event batch after a later invalid sample and replays the corrected batch exactly once', async () => {
  const f = await fixture('attachment-only');
  const detailIds = async () => (await pool.query('SELECT id FROM flow.details WHERE task_id=$1 ORDER BY id', [f.taskId])).rows;
  const before = await detailIds();
  const invalid = eventBatchSchema.parse({ ...f.ownership, events: [...f.batch.events, { id: randomUUID(), sequence: 3, type: 'context-observation',
    observation: { ...f.observation, observationId: randomUUID(), nativeSessionId: 'wrong-session' } }] });
  await expect(f.runner.report(invalid)).rejects.toMatchObject({ status: 409, code: 'context_observation_invalid' });
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.context_observations WHERE task_id=$1', [f.taskId])).rows[0]?.n).toBe(0);
  expect((await pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [f.ownership.attemptId])).rows[0]?.last_sequence).toBe(1);
  expect(await detailIds()).toEqual(before);
  const corrected = eventBatchSchema.parse({ ...f.ownership, events: [...f.batch.events, { id: randomUUID(), sequence: 3, type: 'completed', outcome: 'succeeded' }] });
  expect(await f.runner.report(corrected)).toEqual({ accepted: 2, lastSequence: 3 });
  const result = await history(f);
  expect(await f.runner.report(corrected)).toEqual({ accepted: 0, lastSequence: 3 });
  expect(await history(f)).toEqual(result);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.context_observations WHERE task_id=$1', [f.taskId])).rows[0]?.n).toBe(1);
  expect((await owner.show(f.taskId)).status).toBe('succeeded');
});
