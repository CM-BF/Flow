import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { conversationCreationSchema, conversationTurnSchema } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const database = 'flow_f01_attachment_' + randomUUID().replaceAll('-', '');
const pgBounds = { connectionTimeoutMillis: 2000, query_timeout: 5000, statement_timeout: 5000 };
const admin = new Pool({ ...pgBounds, connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const options = { databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`, ownerToken: randomUUID() };
const pool = new Pool({ ...pgBounds, connectionString: options.databaseUrl, max: 2 });
let creationRequested = false;
let created = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let client: FlowClient;
let baseUrl = '';
const facts: Record<string, unknown> = { startedAt: new Date().toISOString(), database, providerQueries: 0, manualModuleMount: false };
async function start() {
  app = await createServer(options); // Actual factory, default scheduler/queue lifecycle.
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl, token: options.ownerToken });
}
beforeAll(async () => {
  const before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  facts.before = before; expect(before).toEqual([]);
  creationRequested = true; facts.creationRequested = true;
  await admin.query(`CREATE DATABASE "${database}"`); created = true; facts.created = true;
  await start();
});
interface CleanupFixture {
  creationRequested: boolean;
  created: boolean;
  closeApp(): Promise<unknown>;
  closePool(): Promise<unknown>;
  query(sql: string, parameters?: string[]): Promise<{ rows: unknown[] }>;
  closeAdmin(): Promise<unknown>;
  save(value: Record<string, unknown>): Promise<void>;
}
async function boundedCleanup<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Cleanup timeout')), 6000); })]); }
  finally { clearTimeout(timer); }
}
async function cleanupFixture(resources: CleanupFixture, record: Record<string, unknown>) {
  const errors: string[] = [];
  const attempt = async <T>(name: string, operation: () => Promise<T>): Promise<T | undefined> => {
    try { return await boundedCleanup(operation); } catch { errors.push(name); return undefined; }
  };
  await attempt('app-close', resources.closeApp);
  await attempt('pool-close', resources.closePool);
  // The name is generated once and CREATE is requested only after an empty exact-name check.
  // Inspect after unknown CREATE acknowledgement; never force or terminate connections.
  const existence = await attempt('database-observation', () => resources.query('SELECT datname FROM pg_database WHERE datname=$1', [database]));
  const connections = await attempt('connection-observation', () => resources.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database]));
  record.connections = connections?.rows ?? null;
  if (resources.creationRequested && existence?.rows.length === 1 && connections?.rows.length === 0) {
    await attempt('database-drop', () => resources.query(`DROP DATABASE "${database}"`));
  }
  const remaining = await attempt('remaining-observation', () => resources.query('SELECT datname FROM pg_database WHERE datname=$1', [database]));
  record.remaining = remaining?.rows ?? null;
  await attempt('admin-close', resources.closeAdmin);
  record.cleanupErrors = errors;
  record.cleanupState = errors.length === 0 && remaining?.rows.length === 0 && connections?.rows.length === 0 ? 'removed' : 'unknown';
  // Always persist available facts after all independent resource attempts, including close failure.
  await resources.save(record);
}
afterAll(async () => {
  await cleanupFixture({ creationRequested, created,
    closeApp: async () => app?.close(), closePool: () => pool.end(), query: (sql, parameters) => admin.query(sql, parameters), closeAdmin: () => admin.end(),
    save: async value => { value.endedAt = new Date().toISOString(); await writeFile(process.env.FLOW_ATTACHMENT_EVIDENCE ?? 'docs/evidence/f01/attachment-cleanup-facts.json', JSON.stringify(value, null, 2) + '\n'); },
  }, facts);
  expect(facts.connections).toEqual([]); expect(facts.remaining).toEqual([]); expect(facts.cleanupState).toBe('removed');
}, 40_000);

function cleanupScenario(failure: 'create-ack' | 'close-and-inspect') {
  let exists = true, poolClosed = false, adminClosed = false, saved: Record<string, unknown> | undefined;
  const resources: CleanupFixture = { creationRequested: true, created: failure !== 'create-ack',
    async closeApp() { if (failure === 'close-and-inspect') throw Error('Injected close rejection'); },
    async closePool() { poolClosed = true; }, async closeAdmin() { adminClosed = true; },
    async query(sql) {
      if (failure === 'close-and-inspect') throw Error('Injected observation failure');
      if (sql.startsWith('DROP')) { exists = false; return { rows: [] }; }
      return { rows: sql.includes('pg_database') && exists ? [{ datname: database }] : [] };
    },
    async save(value) { saved = structuredClone(value); },
  };
  return { resources, state: () => ({ exists, poolClosed, adminClosed, saved }) };
}
it('cleans an exclusively requested database after committed CREATE loses its acknowledgement', async () => {
  const api = cleanupScenario('create-ack'); await cleanupFixture(api.resources, { database });
  expect(api.state()).toMatchObject({ exists: false, poolClosed: true, adminClosed: true, saved: { remaining: [] } });
});
it('persists unknown cleanup facts and closes independent resources after app close rejects', async () => {
  const api = cleanupScenario('close-and-inspect'); await cleanupFixture(api.resources, { database });
  expect(api.state()).toMatchObject({ exists: true, poolClosed: true, adminClosed: true, saved: { database, cleanupState: 'unknown', remaining: null, connections: null, cleanupErrors: ['app-close', 'database-observation', 'connection-observation', 'remaining-observation'] } });
});

it('mounts 026 before readiness and binds owner uploads, Send/Queue receipts and private claim across restart', async () => {
  const migrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
  facts.migrationsAtReady = migrations; expect(migrations).toContain(26);
  expect(app!.hasRoute({ method: 'POST', url: '/api/projects/:projectId/attachments' })).toBe(true);
  const projectId = (await client.createProject({ workspaceId: 'personal', title: 'Synthetic attachment integration' }, randomUUID())).snapshot.project.id;
  const capabilities = await client.attachmentCapabilities(projectId);
  expect(capabilities).toMatchObject({ protocol: 'text-v1', projectId, maxFileBytes: 8192, maxCombinedReferences: 4 });
  const text = '\uFEFFATTACH_PRIVATE_中文🙂\r\nexact bytes';
  const input = { recoveryScopeId: capabilities.recoveryScopeId, name: '资料.txt', mediaType: 'text/plain' as const, text,
    byteLength: Buffer.byteLength(text), contentDigest: createHash('sha256').update(text).digest('hex') };
  const uploadKey = randomUUID(); const uploaded = await client.uploadAttachment(projectId, input, uploadKey);
  const reference = uploaded.resource.reference;
  expect(uploaded.replayed).toBe(false); expect(uploaded.resource.byteLength).toBe(Buffer.byteLength(text));
  expect((await client.attachments(projectId, { q: '资料', limit: 2 })).resources.map(item => item.reference)).toEqual([reference]);
  expect(JSON.stringify(await client.attachment(projectId, reference.resourceId))).not.toContain('ATTACH_PRIVATE');
  expect((await client.attachmentContent(projectId, reference.resourceId, 1, input.contentDigest)).text).toBe(text);
  const conversationId = (await client.createConversation(conversationCreationSchema.parse({ title: 'Uploaded context', projectId }), randomUUID())).conversation.id;
  expect((await client.conversation(conversationId)).capabilities.attachmentContext).toBe(true);
  const sendInput = conversationTurnSchema.parse({ expectedRevision: 0, text: 'Public user text only.', attachments: [reference] });
  const sendKey = randomUUID(); const sent = await client.submitConversationTurn(conversationId, sendInput, sendKey);
  expect(sent.turn.context).toMatchObject({ templateVersion: 2, attachments: [{ reference }] });
  expect(JSON.stringify(sent)).not.toContain('ATTACH_PRIVATE');
  expect((await client.show(sent.turn.task.id)).prompt).toBe(sendInput.text);
  const queuedConversation = (await client.createConversation(conversationCreationSchema.parse({ title: 'Paused selection', projectId }), randomUUID())).conversation.id;
  await client.pauseConversationQueue(queuedConversation, { expectedQueueRevision: 0 }, randomUUID());
  const queued = await client.enqueueConversationTurn(queuedConversation, { expectedQueueRevision: 1, text: 'Later', attachments: [reference] }, randomUUID());
  expect(queued.item.context).toMatchObject({ templateVersion: 2, attachments: [{ reference }] });
  expect(JSON.stringify(queued)).not.toContain('ATTACH_PRIVATE');
  const registration = await client.registerRunner({ name: 'Synthetic private attachment reader', harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl, token: registration.token });
  await expect(runner.attachmentCapabilities(projectId)).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
  expect((await fetch(baseUrl + `/api/projects/${projectId}/attachments/capabilities`)).status).toBe(401);
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(sent.turn.task.id);
  expect(assignment!.task.prompt).toContain('ATTACH_PRIVATE');
  expect(assignment!.conversationContext?.id).toBe(sent.turn.context!.id);
  await runner.report({ attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion,
    events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] });
  await app!.close(); app = undefined; await start();
  expect((await client.attachmentCapabilities(projectId)).recoveryScopeId).toBe(capabilities.recoveryScopeId);
  expect(await client.uploadAttachment(projectId, input, uploadKey)).toEqual({ ...uploaded, replayed: true });
  expect((await client.attachmentUploadReceipt(projectId, { scope: input.recoveryScopeId, key: uploadKey })).receipt.resource.reference).toEqual(reference);
  expect(await client.submitConversationTurn(conversationId, sendInput, sendKey)).toEqual({ ...sent, replayed: true });
  const detail = await client.conversationContext(conversationId, sent.turn.context!.id);
  if (!('attachments' in detail)) throw Error('Expected the bound v2 attachment detail.');
  expect(detail.attachments[0]?.text).toBe(text);
  expect((await client.conversationQueueItem(queuedConversation, queued.item.id)).item.state).toBe('waiting');
  const plain = (await client.createConversation(conversationCreationSchema.parse({ title: 'Plain' }), randomUUID())).conversation.id;
  expect((await client.submitConversationTurn(plain, conversationTurnSchema.parse({ expectedRevision: 0, text: 'Legacy', attachments: [] }), randomUUID())).turn.context).toBeUndefined();
  facts.result = { projectId, conversationId, taskId: sent.turn.task.id, resourceId: reference.resourceId,
    uploadReplay: true, sendReplay: true, namespacePreserved: true, privateClaim: true, plainPreserved: true, pausedQueuePreserved: true };
});
