import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import type { HarnessAdapter } from '@flow/contracts';
import type { AttachmentReference } from '../../../../packages/contracts/src/attachments.js';
import { parseAttachmentContextReceipt } from '../../../../packages/contracts/src/conversation-context.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { expireLeases } from '../runners.js';
import { promoteReady } from '../conversation-queue/promotion.js';
import { attachmentCapabilities, cleanupExpiredAttachments } from './storage.js';
import { startAttachmentFixture } from './fixture.js';
import { createProject } from '../projects/commands.js';
import { createConversation, admitTurn } from '../conversations/commands.js';
import { conversationSnapshot } from '../conversations/queries.js';
import { createSource } from '../knowledge/storage.js';
import { enqueue } from '../conversation-queue/commands.js';
import { contextDetail } from '../conversation-context/store.js';
import { conversationCreationSchema, conversationTurnSchema } from '../../../../packages/contracts/src/conversations.js';
import { conversationQueueEnqueueSchema } from '../../../../packages/contracts/src/conversation-queue.js';
let f: Awaited<ReturnType<typeof startAttachmentFixture>>;
beforeAll(async () => { f = await startAttachmentFixture('context-runtime'); });
afterAll(async () => { await f?.close(); });
async function conversation(projectId?: string) {
  const response = await f.http('/api/conversations', { title: 'Attachment context', ...(projectId ? { projectId } : {}) });
  expect(response.status).toBe(201); return response.body.conversation.id as string;
}
async function material(text = 'private-attached-material') {
  const projectId = await f.project(); const upload = await f.upload(projectId, text);
  return { projectId, conversationId: await conversation(projectId), ...upload, reference: upload.accepted.resource.reference as AttachmentReference };
}
async function knowledge(projectId: string, text = 'knowledge-first') {
  const response = await f.http(`/api/projects/${projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Known', text }); expect(response.status).toBe(201);
  return { projectId, sourceId: response.body.source.id as string, version: 1, contentDigest: response.body.version.contentDigest as string, locator: { kind: 'utf8-bytes' as const, start: 0, end: Buffer.byteLength(text) } };
}
async function stopPending() {
  for (const task of (await f.pool.query("SELECT id FROM flow.tasks WHERE status='queued'")).rows) expect((await f.http(`/api/tasks/${task.id}/cancel`, {})).status).toBe(200);
}

test('before 026 plain/knowledge remain v1; migration preserves saved receipts and enables project GET only', async () => {
  const upgrade = await startAttachmentFixture('upgrade', false);
  try {
    // Before any current createServer call: real pre-026 PG and existing domain operations, not HTTP.
    const versions = async () => (await upgrade.pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
    const beforeVersions = await versions(); expect(beforeVersions).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    expect((await upgrade.pool.query("SELECT to_regclass('flow.attachment_namespace') AS namespace,to_regclass('flow.attachment_resources') AS resources")).rows[0]).toEqual({ namespace: null, resources: null });
    const projectId = (await createProject(upgrade.pool, { workspaceId: 'personal', title: 'Pre-026 persisted project' }, randomUUID())).snapshot.project.id;
    const create = async (project?: string) => createConversation(upgrade.pool, conversationCreationSchema.parse({ title: 'Pre-026 conversation', ...(project ? { projectId: project } : {}) }), randomUUID());
    const id = (await create(projectId)).conversation.id;
    const source = await createSource(upgrade.pool, projectId, { expectedVersion: 0, title: 'Known', text: 'knowledge-first' }, randomUUID());
    const citation = { projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest, locator: { kind: 'utf8-bytes' as const, start: 0, end: Buffer.byteLength('knowledge-first') } };
    const beforeSnapshot = await conversationSnapshot(upgrade.pool, id);
    expect(beforeSnapshot.capabilities.attachmentContext).toBe(false);
    await expect(attachmentCapabilities(upgrade.pool, projectId)).rejects.toMatchObject({ status: 409, code: 'attachment_unavailable' });
    const body = { expectedQueueRevision: 0, text: 'legacy source', knowledge: [citation] }; const key = randomUUID();
    const old = await enqueue(upgrade.pool, id, conversationQueueEnqueueSchema.parse(body), key);
    expect(old.item.context?.templateVersion).toBe(1); expect(old.item.context).not.toHaveProperty('attachments');
    const detail = await contextDetail(upgrade.pool, id, old.item.context!.id);
    expect(detail).not.toHaveProperty('templateVersion'); expect(detail.sources[0]?.text).toBe('knowledge-first');
    const legacySendId = (await create(projectId)).conversation.id; const sendKey = randomUUID(); const sendInput = { expectedRevision: 0, text: 'legacy send', knowledge: [citation] };
    const legacySend = await admitTurn(upgrade.pool, upgrade.boss, legacySendId, conversationTurnSchema.parse(sendInput), sendKey);
    expect(legacySend.turn.context?.templateVersion).toBe(1);
    const plainId = (await create()).conversation.id, plainKey = randomUUID();
    const plainInput = { expectedRevision: 0, text: 'legacy plain' };
    const legacyPlain = await admitTurn(upgrade.pool, upgrade.boss, plainId, conversationTurnSchema.parse(plainInput), plainKey);
    expect(legacyPlain.turn).not.toHaveProperty('context');
    const readOriginalRows = async () => ({
      receipts: (await upgrade.pool.query('SELECT operation,key,digest,response FROM flow.commands WHERE key=ANY($1) ORDER BY operation,key', [[key, sendKey, plainKey]])).rows,
      contexts: (await upgrade.pool.query("SELECT to_jsonb(c)-'attachments' AS original FROM flow.conversation_contexts c ORDER BY id")).rows,
      inputs: (await upgrade.pool.query('SELECT * FROM flow.conversation_execution_inputs ORDER BY id')).rows,
    });
    const before = await readOriginalRows(); expect(before.receipts).toHaveLength(3); expect(before.contexts).toHaveLength(2); expect(before.inputs).toHaveLength(2);
    // First current factory startup occurs only after the old rows and receipts exist.
    await upgrade.install();
    const namespace = (await upgrade.pool.query('SELECT recovery_scope_id FROM flow.attachment_namespace')).rows;
    expect(namespace).toHaveLength(1); expect(await versions()).toEqual([...beforeVersions, 26]);
    await upgrade.install(); await upgrade.restart();
    expect((await upgrade.pool.query('SELECT recovery_scope_id FROM flow.attachment_namespace')).rows).toEqual(namespace);
    const after = await readOriginalRows();
    expect(await versions()).toEqual([...beforeVersions, 26]); expect(after).toEqual(before);
    const replaySend = await upgrade.http(`/api/conversations/${legacySendId}/turns`, sendInput, { key: sendKey });
    expect(replaySend.status).toBe(202); expect(replaySend.body).toEqual({ ...legacySend, replayed: true });
    const replayPlain = await upgrade.http(`/api/conversations/${plainId}/turns`, plainInput, { key: plainKey });
    expect(replayPlain.status).toBe(202); expect(replayPlain.body).toEqual({ ...legacyPlain, replayed: true });
    expect((await upgrade.http(`/api/conversations/${id}`)).body.capabilities.attachmentContext).toBe(true);
    const replayQueue = await upgrade.http(`/api/conversations/${id}/queue`, body, { key });
    expect(replayQueue.status).toBe(202); expect(replayQueue.body).toEqual({ ...old, replayed: true });
    expect((await upgrade.http(`/api/conversations/${id}/contexts/${old.item.context!.id}`)).body).toEqual(detail);
    const empty = await upgrade.http(`/api/conversations/${id}/queue`, { expectedQueueRevision: 1, text: 'empty attachments', knowledge: [citation], attachments: [] }); expect(empty.body.item.context.templateVersion).toBe(1);
    const plain = await upgrade.http('/api/conversations', { title: 'Plain' }); expect(plain.status).toBe(201);
    const sent = await upgrade.http(`/api/conversations/${plain.body.conversation.id}/turns`, { expectedRevision: 0, text: 'original', attachments: [] }); expect(sent.status).toBe(202); expect(sent.body.turn).not.toHaveProperty('context');
    await upgrade.writeEvidence('upgrade-assertions.json', { beforeTransport: 'direct PG/domain; no HTTP server', afterTransport: 'full createServer HTTP with separately recorded legacy mount fallback', beforeVersions, afterVersions: await versions(), beforeCapability: beforeSnapshot.capabilities.attachmentContext, unavailableStatus: 409, before, after, namespace, sendReplay: replaySend.body, plainReplay: replayPlain.body, queueReplay: replayQueue.body });
  } finally { await upgrade.close(); }
});

test('frozen ordered upload refs extend metadata without leaking body and preserve knowledge-first input order', async () => {
  const m = await material('\uFEFFfirst\r\n😀'); const second = await f.upload(m.projectId, 'second material', 'two.txt'); const citation = await knowledge(m.projectId);
  const refs = [second.accepted.resource.reference, m.reference]; const input = { expectedRevision: 0, text: 'public raw', knowledge: [citation], attachments: refs };
  const sent = await f.http(`/api/conversations/${m.conversationId}/turns`, input); expect(sent.status, JSON.stringify(sent.body)).toBe(202);
  const context = parseAttachmentContextReceipt({ projectId: m.projectId, knowledge: [citation], attachments: refs, descriptors: [second.accepted.resource,m.accepted.resource] }, sent.body.turn.context);
  expect(context.templateVersion).toBe(2); expect(context.order).toBe('knowledge-then-attachments'); expect(context.attachments.map(a => a.reference)).toEqual(refs);
  for (const path of [`/api/conversations/${m.conversationId}`, `/api/conversations/${m.conversationId}/turns`, `/api/tasks/${sent.body.turn.task.id}`]) {
    const response = await f.http(path); expect(response.status).toBe(200); expect(JSON.stringify(response.body)).not.toContain('second material'); expect(JSON.stringify(response.body)).not.toContain('knowledge-first');
  }
  const detail = await f.http(`/api/conversations/${m.conversationId}/contexts/${context.id}`); expect(detail.body.attachments.map((a: { text: string }) => a.text)).toEqual(['second material','\uFEFFfirst\r\n😀']); expect(detail.body.sources[0].text).toBe('knowledge-first');
  const prompt = (await f.pool.query('SELECT execution_prompt FROM flow.conversation_execution_inputs WHERE id=$1', [context.executionInputId])).rows[0].execution_prompt as string;
  expect(prompt.indexOf('knowledge-first')).toBeLessThan(prompt.indexOf('second material'));
  expect(prompt.indexOf('second material')).toBeLessThan(prompt.indexOf('first\\r\\n')); expect(detail.httpUtf8Bytes).toBeLessThanOrEqual(65536);
  expect((await f.http(`/api/projects/${m.projectId}/attachments/${m.reference.resourceId}`)).body.retained).toBe(true);
  expect((await f.http(`/api/conversations/${await conversation(m.projectId)}/contexts/${context.id}`)).status).toBe(404);
});

test('same ordered material digest is stable across user text, and changing attachment order changes it', async () => {
  const m = await material('one'); const other = await f.upload(m.projectId, 'two'); const path = `/api/conversations/${m.conversationId}/queue`;
  const refs = [m.reference, other.accepted.resource.reference];
  const a = (await f.http(path, { expectedQueueRevision: 0, text: 'a', attachments: refs })).body.item.context;
  const b = (await f.http(path, { expectedQueueRevision: 1, text: 'b', attachments: refs })).body.item.context;
  const c = (await f.http(path, { expectedQueueRevision: 2, text: 'a', attachments: [...refs].reverse() })).body.item.context;
  expect(a.contextDigest).toBe(b.contextDigest); expect(a.executionInputDigest).not.toBe(b.executionInputDigest); expect(a.contextDigest).not.toBe(c.contextDigest);
});

test('lost Send ACK replays before TTL and busy/CAS after restart; retained expiry blocks a fresh key', async () => {
  const m = await material(); const path = `/api/conversations/${m.conversationId}/turns`; const key = randomUUID(); const input = { expectedRevision: 0, text: 'use original', attachments: [m.reference] };
  expect(await f.discardReply(path, input, key)).toBe(202);
  const snapshot = (await f.http(`/api/conversations/${m.conversationId}`)).body; await f.expire(m.reference.resourceId); await f.restart();
  const replay = await f.http(path, input, { key }); expect(replay.status).toBe(202); expect(replay.body.turn).toEqual(snapshot.lastTurn); expect(replay.body.replayed).toBe(true);
  expect(await cleanupExpiredAttachments(f.pool, m.projectId)).toBe(0);
  expect((await f.http(`/api/projects/${m.projectId}/attachments/${m.reference.resourceId}`)).body).toMatchObject({ state: 'expired', retained: true });
  expect((await f.http(`/api/projects/${m.projectId}/attachments`)).body.resources).toEqual([]);
  expect((await f.http(`/api/projects/${m.projectId}/attachments/${m.reference.resourceId}/versions/1/content?digest=${m.reference.contentDigest}`)).body.text).toBe(m.input.text);
  const fresh = await conversation(m.projectId); expect((await f.http(`/api/conversations/${fresh}/turns`, input)).status).toBe(410);
  expect((await f.http(`/api/conversations/${fresh}/queue`, { expectedQueueRevision: 0, text: 'fresh', attachments: [m.reference] })).status).toBe(410);
  expect((await f.http(`/api/conversations/${m.conversationId}/contexts/${snapshot.lastTurn.context.id}`)).body.attachments[0].text).toBe(m.input.text);
});

test('first pin checks DB clock after a project-lock wait, rather than transaction or statement start', async () => {
  const m = await material(); const lock = await f.pool.connect(); await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [m.projectId]);
  const pending = f.http(`/api/conversations/${m.conversationId}/turns`, { expectedRevision: 0, text: 'must not admit expired', attachments: [m.reference] });
  try {
    const began = await f.waitProjectLock(); await f.expire(m.reference.resourceId);
    const expiry = (await f.pool.query('SELECT expires_at FROM flow.attachment_resources WHERE id=$1', [m.reference.resourceId])).rows[0].expires_at as Date;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(began.getTime());
  } finally { await lock.query('COMMIT'); lock.release(); }
  const rejected = await pending; expect(rejected.status).toBe(410); expect(rejected.body.error.code).toBe('attachment_expired');
  expect((await f.http(`/api/conversations/${m.conversationId}`)).body.conversation.revision).toBe(0);
  expect((await f.pool.query('SELECT 1 FROM flow.conversation_attachment_bindings WHERE resource_id=$1', [m.reference.resourceId])).rowCount).toBe(0);
});

test('concurrent expiry cleanup and first pin serialize without partial context; pin-first survives expiry/GC', async () => {
  const m = await material(); await f.expire(m.reference.resourceId);
  const lock = await f.pool.connect(); await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [m.projectId]);
  const cleanup = cleanupExpiredAttachments(f.pool, m.projectId); await f.waitProjectLock();
  const pin = f.http(`/api/conversations/${m.conversationId}/queue`, { expectedQueueRevision: 0, text: 'late pin', attachments: [m.reference] });
  try { await f.waitProjectLock(2); }
  finally { await lock.query('COMMIT'); lock.release(); }
  expect(await cleanup).toBe(1); expect([404,410]).toContain((await pin).status); expect((await f.http(`/api/conversations/${m.conversationId}/queue`)).body.items).toEqual([]);
  const valid = await material(); const sent = await f.http(`/api/conversations/${valid.conversationId}/queue`, { expectedQueueRevision: 0, text: 'early pin', attachments: [valid.reference] }); expect(sent.status).toBe(202);
  await f.expire(valid.reference.resourceId); expect(await cleanupExpiredAttachments(f.pool, valid.projectId)).toBe(0);
  await expect(f.pool.query('DELETE FROM flow.attachment_resources WHERE id=$1', [valid.reference.resourceId])).rejects.toMatchObject({ code: '23503' });
  await expect(f.pool.query('DELETE FROM flow.conversation_attachment_bindings WHERE resource_id=$1', [valid.reference.resourceId])).rejects.toMatchObject({ code: '23514' });
});

test('queue restart, pause/cancel and promotion retain the original material even after expiry', async () => {
  const m = await material(); const path = `/api/conversations/${m.conversationId}/queue`; const input = { expectedQueueRevision: 0, text: 'queued raw', attachments: [m.reference] }; const key = randomUUID();
  expect(await f.discardReply(path, input, key)).toBe(202); const accepted = (await f.http(path, input, { key })).body;
  expect((await f.http(`${path}/pause`, { expectedQueueRevision: 1 })).status).toBe(200); await f.expire(m.reference.resourceId); await f.restart();
  expect((await promoteReady(f.pool, f.boss, m.conversationId)).outcome).toBe('blocked');
  const resumed = await f.http(`${path}/resume`, { expectedQueueRevision: 2, expectedTaskId: null }); expect(resumed.status, JSON.stringify(resumed.body)).toBe(202); expect(resumed.body.promoted.context).toEqual(accepted.item.context);
  expect((await f.http(path, input, { key })).body).toEqual(accepted);
  expect((await f.http(`/api/conversations/${m.conversationId}`)).body.lastTurn.context).toEqual(accepted.item.context);
  const c = await material(); const q = `/api/conversations/${c.conversationId}/queue`; const item = (await f.http(q, { expectedQueueRevision: 0, text: 'remove draft != delete audit', attachments: [c.reference] })).body.item;
  expect((await f.http(`${q}/${item.id}/cancel`, { expectedQueueRevision: 1 })).status).toBe(200); await f.expire(c.reference.resourceId); expect(await cleanupExpiredAttachments(f.pool, c.projectId)).toBe(0);
  expect((await f.http(`/api/conversations/${c.conversationId}/contexts/${item.context.id}`)).body.attachments[0].text).toBe(c.input.text);
});

for (const boundary of ['no-project','foreign-project','wrong-digest','missing','duplicate','five-combined','raw-budget','compiled-budget'] as const) test(`Send and Queue reject ${boundary} atomically`, async () => {
  const m = await material(boundary === 'raw-budget' ? 'x'.repeat(8192) : 'private'); let id = m.conversationId; let refs = [m.reference]; let citations: Awaited<ReturnType<typeof knowledge>>[] = []; let text = 'raw';
  if (boundary === 'no-project') id = await conversation();
  if (boundary === 'foreign-project') refs = [{ ...m.reference, projectId: await f.project() }];
  if (boundary === 'wrong-digest') refs = [{ ...m.reference, contentDigest: '0'.repeat(64) }];
  if (boundary === 'missing') refs = [{ ...m.reference, resourceId: randomUUID() }];
  if (boundary === 'duplicate') refs = [m.reference,m.reference];
  if (boundary === 'raw-budget') refs.push((await f.upload(m.projectId, 'extra')).accepted.resource.reference);
  if (boundary === 'five-combined') { const c = await knowledge(m.projectId, '1234'); citations = [0,1,2,3].map(start => ({ ...c, locator: { ...c.locator, start, end: start+1 } })); }
  if (boundary === 'compiled-budget') text = 'x'.repeat(15900);
  for (const kind of ['turns','queue']) {
    const response = await f.http(`/api/conversations/${id}/${kind}`, { [kind === 'turns' ? 'expectedRevision' : 'expectedQueueRevision']: 0, text, knowledge: citations, attachments: refs }); expect([400,404,409,413]).toContain(response.status);
    expect((await f.pool.query('SELECT (SELECT count(*) FROM flow.conversation_turns WHERE conversation_id=$1)::int AS turns,(SELECT count(*) FROM flow.conversation_contexts WHERE conversation_id=$1)::int AS contexts,(SELECT count(*) FROM flow.conversation_queue WHERE conversation_id=$1)::int AS queued', [id])).rows[0]).toEqual({ turns: 0, contexts: 0, queued: 0 });
  }
});

test('one batched metadata query for 50 items contains descriptors only; large body is read explicitly', async () => {
  const m = await material('p'.repeat(8192)); const path = `/api/conversations/${m.conversationId}/queue`;
  for (let n=0;n<50;n++) expect((await f.http(path, { expectedQueueRevision: n, text: 'raw', attachments: [m.reference] })).status).toBe(202);
  const spy = vi.spyOn(Client.prototype, 'query');
  try {
    const response = await f.http(path + '?limit=50'); expect(response.status).toBe(200); expect(response.body.items).toHaveLength(50); expect(JSON.stringify(response.body)).not.toContain('p'.repeat(30));
    const sql = spy.mock.calls.map(c => c[0]).filter((v): v is string => typeof v === 'string');
    const metadata = sql.filter(q => q.includes('jsonb_array_elements(c.sources)')); expect(metadata).toHaveLength(1); expect(metadata[0]).not.toContain('execution_prompt');
    expect(sql.filter(q => q.includes(',r.content'))).toHaveLength(0);
    await f.writeEvidence('runtime-bounded-reads.json', { items: 50, metadataSelects: metadata.length, resourceBodySelects: 0, responseUtf8Bytes: response.httpUtf8Bytes, note: 'Application SQL counts during actual HTTP; not PG wire, heap or latency measurements.' });
  } finally { spy.mockRestore(); }
});

test('actual runner receives exact frozen input through authorized claim and a generic fake adapter, without provider', async () => {
  await stopPending(); const m = await material('\uFEFFremote material\r\n😀'); const sent = await f.http(`/api/conversations/${m.conversationId}/turns`, { expectedRevision: 0, text: 'public input', attachments: [m.reference] }); expect(sent.status).toBe(202);
  const taskId = sent.body.turn.task.id; const context = sent.body.turn.context;
  const expected = (await f.pool.query('SELECT execution_prompt FROM flow.conversation_execution_inputs WHERE id=$1', [context.executionInputId])).rows[0].execution_prompt;
  await f.expire(m.reference.resourceId); await f.restart();
  const runner = await f.http('/api/runners', { name: 'Generic injected consumer', harnesses: ['claude'], capacity: 1 });
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [taskId]);
  const directory = await mkdtemp(join(tmpdir(), 'flow-attach-runner-')); const controller = new AbortController(); let seen: string | undefined;
  const adapter: HarnessAdapter = { name: 'claude', version: 'test-generic-no-provider', async run(context) { await context.assertOwnership(); seen = context.task.prompt; } };
  const running = runRunner({ baseUrl: f.baseUrl, token: runner.body.token, workingDirectory: directory, signal: controller.signal, adapters: [adapter], pollIntervalMs: 25, heartbeatIntervalMs: 100 });
  try {
    await expect.poll(async () => (await f.http(`/api/tasks/${taskId}`)).body.status, { timeout: 5000 }).toBe('succeeded'); expect(seen).toBe(expected); expect(seen).toContain('remote material');
    expect((await f.http(`/api/tasks/${taskId}`)).body.prompt).toBe('public input');
    expect((await f.http(`/api/conversations/${m.conversationId}/contexts/${context.id}`)).body.attachments[0].text).toBe(m.input.text);
  } finally { controller.abort(); try { await running; } finally { await rm(directory, { recursive: true, force: true }); } }
});

test('authorized reconciliation copies the same frozen material with a new execution input', async () => {
  await stopPending(); const m = await material('recovery original'); const sent = await f.http(`/api/conversations/${m.conversationId}/turns`, { expectedRevision: 0, text: 'raw', attachments: [m.reference] }); expect(sent.status).toBe(202);
  const runner = await f.http('/api/runners', { name: 'Reconcile material', harnesses: ['claude'], capacity: 1 }); const token = runner.body.token;
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [sent.body.turn.task.id]);
  const claim = (await f.http('/api/runner/claim', {}, { token })).body.assignment; const ownership = { attemptId: claim.attempt.id, ownerVersion: claim.attempt.ownerVersion };
  await f.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [ownership.attemptId]); await expireLeases(f.pool);
  const path = `/api/tasks/${sent.body.turn.task.id}/reconciliation`;
  const resolved = await f.http(path + '/resolve', { ...ownership, stoppedConfirmed: true, stopEvidence: { explanation: 'Fixture process stopped' }, sideEffects: 'reviewed', effectsEvidence: { explanation: 'No provider invoked' }, outcome: 'failed' }); expect(resolved.status).toBe(200);
  await f.expire(m.reference.resourceId); await cleanupExpiredAttachments(f.pool, m.projectId);
  const retried = await f.http(path + '/retry', { ...ownership, resolutionId: resolved.body.audit.id, safety: { strategy: 'revised-work', prompt: 'Inspect saved material only', evidence: { explanation: 'Explicit owner recovery' } } }); expect(retried.status, JSON.stringify(retried.body)).toBe(200);
  await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [retried.body.task.id]);
  const next = (await f.http('/api/runner/claim', {}, { token })).body.assignment; expect(next.task.prompt).toContain('recovery original'); expect(next.conversationContext.contextDigest).toBe(sent.body.turn.context.contextDigest); expect(next.conversationContext.executionInputId).not.toBe(sent.body.turn.context.executionInputId);
});

test('context/input tampering cannot enter a runner and the original immutable triggers remain enforced', async () => {
  await stopPending(); const m = await material('integrity'); const sent = await f.http(`/api/conversations/${m.conversationId}/turns`, { expectedRevision: 0, text: 'raw', attachments: [m.reference] }); const context = sent.body.turn.context;
  await expect(f.pool.query('UPDATE flow.attachment_resources SET content=$2 WHERE id=$1', [m.reference.resourceId,'changed'])).rejects.toMatchObject({ code: '23514' });
  await expect(f.pool.query('UPDATE flow.conversation_contexts SET attachments=$2 WHERE id=$1', [context.id,'[]'])).rejects.toMatchObject({ code: '23514' });
  const original = (await f.pool.query('SELECT attachments FROM flow.conversation_contexts WHERE id=$1', [context.id])).rows[0].attachments;
  await f.pool.query('ALTER TABLE flow.conversation_contexts DISABLE TRIGGER conversation_contexts_immutable');
  try { await f.pool.query('UPDATE flow.conversation_contexts SET attachments=$2 WHERE id=$1', [context.id,JSON.stringify([{ ...original[0], text: 'tampered' }])]); }
  finally { await f.pool.query('ALTER TABLE flow.conversation_contexts ENABLE TRIGGER conversation_contexts_immutable'); }
  const runner = await f.http('/api/runners', { name: 'Reject bad private input', harnesses: ['claude'], capacity: 1 }); await f.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [sent.body.turn.task.id]);
  expect((await f.http('/api/runner/claim', {}, { token: runner.body.token })).status).toBe(409);
  expect((await f.pool.query('SELECT 1 FROM flow.attempts WHERE task_id=$1', [sent.body.turn.task.id])).rowCount).toBe(0);
});
