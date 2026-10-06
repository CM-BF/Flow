import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../database.js';
import { attachmentAcceptedSchema, attachmentCapabilitiesSchema, attachmentContentSchema, attachmentListSchema, attachmentReceiptLookupSchema } from '../../../../packages/contracts/src/attachments.js';
import { cleanupExpiredAttachments } from './storage.js';
import { startAttachmentFixture } from './fixture.js';
let f: Awaited<ReturnType<typeof startAttachmentFixture>>;
beforeAll(async () => { f = await startAttachmentFixture('resources'); });
afterAll(async () => { await f?.close(); });

test('capability is project-bound, metadata has no body and explicit content preserves BOM/CRLF/UTF-8', async () => {
  const project = await f.project(); const text = '\uFEFF原文😀\r\n tail ';
  const cap = await f.http(`/api/projects/${project}/attachments/capabilities`); expect(attachmentCapabilitiesSchema.parse(cap.body).maxFileBytes).toBe(8192);
  const { accepted } = await f.upload(project, text, '<note>.TXT');
  const ref = attachmentAcceptedSchema.parse(accepted).resource.reference;
  const list = await f.http(`/api/projects/${project}/attachments`); expect(attachmentListSchema.parse(list.body).resources).toHaveLength(1); expect(JSON.stringify(list.body)).not.toContain(text);
  const detail = await f.http(`/api/projects/${project}/attachments/${ref.resourceId}/versions/1/content?digest=${ref.contentDigest}`);
  expect(detail.status).toBe(200); expect(attachmentContentSchema.parse(detail.body).text).toBe(text); expect(detail.httpUtf8Bytes).toBeLessThanOrEqual(65536);
  const created = await f.http('/api/conversations', { title: 'Project', projectId: project }); expect(created.body.capabilities.attachmentContext).toBe(false);
  expect((await f.http(`/api/conversations/${created.body.conversation.id}`)).body.capabilities.attachmentContext).toBe(true);
  const plain = await f.http('/api/conversations', { title: 'No project' }); expect((await f.http(`/api/conversations/${plain.body.conversation.id}`)).body.capabilities.attachmentContext).toBe(false);
});

test('invalid text/type/bytes/digest/key or scope rejects without publishing or normalizing', async () => {
  const project = await f.project(); const { input } = await f.upload(project);
  for (const [change, status] of [
    [{ text: '', byteLength: 0 }, 400], [{ text: '\ud800', byteLength: 3 }, 400], [{ text: 'a\0b', byteLength: 3 }, 400],
    [{ text: '古'.repeat(3000), byteLength: 9000 }, 413], [{ name: 'photo.png', mediaType: 'image/png' }, 415],
    [{ name: '../a.txt' }, 400], [{ byteLength: input.byteLength + 1 }, 400], [{ contentDigest: '0'.repeat(64) }, 400],
    [{ recoveryScopeId: randomUUID() }, 409], [{ extra: 'body' }, 400],
  ] as const) expect((await f.http(`/api/projects/${project}/attachments`, { ...input, ...change })).status).toBe(status);
  expect((await f.http(`/api/projects/${project}/attachments`, input, { key: 'two words' })).status).toBe(400);
  expect((await f.http(`/api/projects/${project}/attachments`)).body.resources).toHaveLength(1);
});

test('lost upload ACK and restart replay exactly one durable resource; changed canonical body conflicts', async () => {
  const project = await f.project(); const cap = (await f.http(`/api/projects/${project}/attachments/capabilities`)).body;
  const text = 'lost original'; const input = { recoveryScopeId: cap.recoveryScopeId, name: 'lost.txt', mediaType: 'text/plain', text, byteLength: Buffer.byteLength(text), contentDigest: sha256(text) }; const key = randomUUID();
  expect(await f.discardReply(`/api/projects/${project}/attachments`, input, key)).toBe(201);
  await f.restart();
  const lookup = await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${cap.recoveryScopeId}&key=${key}`); expect(lookup.status).toBe(200);
  const saved = attachmentReceiptLookupSchema.parse(lookup.body); expect(saved.current.state).toBe('ready');
  const replay = await f.http(`/api/projects/${project}/attachments`, input, { key }); expect(replay.body).toEqual({ ...saved.receipt, replayed: true });
  expect((await f.http(`/api/projects/${project}/attachments`, { ...input, name: 'other.txt' }, { key })).body.error.code).toBe('idempotency_conflict');
  expect((await f.http(`/api/projects/${project}/attachments`)).body.resources).toHaveLength(1);
});

test('receipt lookup may return 404 before blocked upload commits; it does not prove nonacceptance', async () => {
  const project = await f.project(); const cap = (await f.http(`/api/projects/${project}/attachments/capabilities`)).body; const key = randomUUID();
  const input = { recoveryScopeId: cap.recoveryScopeId, name: 'later.txt', mediaType: 'text/plain', text: 'x', byteLength: 1, contentDigest: sha256('x') };
  const lock = await f.pool.connect(); await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [project]);
  const pending = f.http(`/api/projects/${project}/attachments`, input, { key });
  try { await f.waitProjectLock(); expect((await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${cap.recoveryScopeId}&key=${key}`)).status).toBe(404); }
  finally { await lock.query('COMMIT'); lock.release(); }
  expect((await pending).status).toBe(201); expect((await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${cap.recoveryScopeId}&key=${key}`)).status).toBe(200);
});

test('expiry/cleanup retains immutable key tombstone and cannot turn retry into a new upload', async () => {
  const project = await f.project(); const { accepted, input, key } = await f.upload(project); const ref = accepted.resource.reference;
  await f.expire(ref.resourceId);
  expect((await f.http(`/api/projects/${project}/attachments/${ref.resourceId}`)).body).toMatchObject({ state: 'expired', retained: false });
  expect((await f.http(`/api/projects/${project}/attachments/${ref.resourceId}/versions/1/content?digest=${ref.contentDigest}`)).status).toBe(410);
  expect(await cleanupExpiredAttachments(f.pool, project)).toBe(1);
  const receipt = await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${input.recoveryScopeId}&key=${key}`); expect(receipt.body.current).toEqual({ state: 'unavailable', retained: null });
  expect((await f.http(`/api/projects/${project}/attachments`, input, { key })).body).toEqual({ ...accepted, replayed: true });
  expect((await f.http(`/api/projects/${project}/attachments`)).body.resources).toEqual([]);
});

test('owner authentication is reevaluated and references cannot cross project or content identity', async () => {
  const project = await f.project(); const other = await f.project(); const { accepted, input, key } = await f.upload(project); const ref = accepted.resource.reference;
  const runner = await f.http('/api/runners', { name: 'No owner scope', harnesses: ['fixture'], capacity: 1 });
  for (const token of ['revoked', runner.body.token]) {
    const status = token === 'revoked' ? 401 : 403;
    expect((await f.http(`/api/projects/${project}/attachments`, undefined, { token })).status).toBe(status);
    expect((await f.http(`/api/projects/${project}/attachments`, input, { token, key })).status).toBe(status);
    expect((await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${input.recoveryScopeId}&key=${key}`, undefined, { token })).status).toBe(status);
  }
  expect((await f.http(`/api/projects/${other}/attachments/${ref.resourceId}`)).status).toBe(404);
  expect((await f.http(`/api/projects/${project}/attachments/${ref.resourceId}/versions/1/content?digest=${'0'.repeat(64)}`)).status).toBe(409);
});

test('ready pagination/search are bounded and concurrent uploads cannot exceed the project storage quota', async () => {
  const project = await f.project(); const { input } = await f.upload(project, 'x'.repeat(8192), 'seed.txt');
  // Test data uses actual published shape. Capacity boundary is exercised by real concurrent HTTP writes.
  await f.pool.query(`INSERT INTO flow.attachment_resources(id,project_id,name,media_type,content,content_digest)
    SELECT gen_random_uuid(),$1,'seed.txt','text/plain',$2,$3 FROM generate_series(1,126)`, [project, input.text, input.contentDigest]);
  const results = await Promise.all([f.http(`/api/projects/${project}/attachments`, input), f.http(`/api/projects/${project}/attachments`, input)]);
  expect(results.map(r => r.status).sort()).toEqual([201,409]); expect(results.find(r => r.status === 409)!.body.error.code).toBe('attachment_budget');
  expect((await f.pool.query('SELECT count(*)::int AS count,sum(byte_length)::int AS bytes FROM flow.attachment_resources WHERE project_id=$1', [project])).rows[0]).toEqual({ count: 128, bytes: 1048576 });
  const first = await f.http(`/api/projects/${project}/attachments?limit=20&q=seed`); expect(first.body.resources).toHaveLength(20); expect(first.body.nextCursor).toBeTruthy();
  const next = await f.http(`/api/projects/${project}/attachments?limit=20&after=${first.body.nextCursor}`); expect(new Set([...first.body.resources,...next.body.resources].map(item => item.reference.resourceId)).size).toBe(40);
  expect((await f.http(`/api/projects/${project}/attachments?limit=21`)).status).toBe(400);
  expect((await f.http(`/api/projects/${project}/attachments?q=%25`)).body.resources).toEqual([]); // literal search, not SQL wildcard
});


test('interrupted pre-commit upload leaves no partial resource and original-key recovery can commit once', async () => {
  const project = await f.project(); const cap = (await f.http(`/api/projects/${project}/attachments/capabilities`)).body; const key = randomUUID();
  const input = { recoveryScopeId: cap.recoveryScopeId, name: 'crash.txt', mediaType: 'text/plain', text: 'x', byteLength: 1, contentDigest: sha256('x') };
  const lock = await f.pool.connect(); await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [project]);
  const pending = f.http(`/api/projects/${project}/attachments`, input, { key });
  try {
    await f.waitProjectLock();
    const writer = (await f.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT%flow.projects%FOR UPDATE' LIMIT 1")).rows[0];
    expect(writer).toBeDefined(); await f.pool.query('SELECT pg_cancel_backend($1)', [writer.pid]);
    expect((await pending).status).toBe(500);
  } finally { await lock.query('COMMIT'); lock.release(); }
  expect((await f.http(`/api/projects/${project}/attachments`)).body.resources).toEqual([]);
  expect((await f.http(`/api/projects/${project}/attachments/upload-receipt?scope=${cap.recoveryScopeId}&key=${key}`)).status).toBe(404);
  const restored = await f.http(`/api/projects/${project}/attachments`, input, { key }); expect(restored.status).toBe(201); expect(restored.body.replayed).toBe(false);
  expect((await f.http(`/api/projects/${project}/attachments`, input, { key })).body).toEqual({ ...restored.body, replayed: true });
});


test('committed upload survives a real fixture center SIGKILL and same-key HTTP replay', async () => {
  const crashed = await startAttachmentFixture('crash-center', true, true);
  try {
    const project = await crashed.project(); const { input, key, accepted } = await crashed.upload(project, '\uFEFFcrash material\r\n');
    await crashed.crashRestart();
    const lookup = await crashed.http(`/api/projects/${project}/attachments/upload-receipt?scope=${input.recoveryScopeId}&key=${key}`);
    expect(lookup.status).toBe(200); expect(lookup.body.receipt).toEqual(attachmentReceiptLookupSchema.parse(lookup.body).receipt);
    expect((await crashed.http(`/api/projects/${project}/attachments`, input, { key })).body).toEqual({ ...accepted, replayed: true });
    expect((await crashed.http(`/api/projects/${project}/attachments`)).body.resources).toHaveLength(1);
  } finally { await crashed.close(); }
});


test('invalid UTF-8 in the JSON transport cannot be silently replaced and published as a different file', async () => {
  const project = await f.project(); const cap = (await f.http(`/api/projects/${project}/attachments/capabilities`)).body;
  const input = { recoveryScopeId: cap.recoveryScopeId, name: 'raw.txt', mediaType: 'text/plain', text: '\ufffd', byteLength: 3, contentDigest: sha256('\ufffd') };
  const json = Buffer.from(JSON.stringify(input)); const offset = json.indexOf(Buffer.from('\ufffd'));
  const malformed = Buffer.concat([json.subarray(0, offset), Buffer.from([255]), json.subarray(offset + 3)]);
  expect((await f.rawPost(`/api/projects/${project}/attachments`, malformed)).status).toBe(400);
  expect((await f.http(`/api/projects/${project}/attachments`)).body.resources).toEqual([]);
  expect((await f.http(`/api/projects/${project}/attachments`, input)).status).toBe(201); // A real replacement character is valid text.
});
