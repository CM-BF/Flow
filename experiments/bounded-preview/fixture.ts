import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { createServer } from '../../apps/server/src/index.js';
import { assistantFinalDataSchema } from '../../packages/contracts/src/assistant.js';
import { installInstrumentation, withinRequest, type RequestWork } from './instrument.js';

export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const settings = { requested: { model: 'fixture', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: 'fixture', permissionMode: 'dontAsk', tools: [], thinking: 'unknown' } } as const;
export interface TurnFixture { conversationId: string; turnId: string; taskId: string; attemptId: string; sessionId: string; runnerId: string; detailId: string; eventId: string; sourceId: string; messageId: string; content: string }
export async function addTyped(client: PoolClient, f: TurnFixture) {
  const typed = assistantFinalDataSchema.parse({ type: 'assistant-final', messageId: f.messageId, nativeSessionId: f.sessionId, source: 'claude.sdk.result', sourceMessageId: f.sourceId, content: f.content, settings });
  await client.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Assistant reply','detail',$4,'text/plain')", [f.detailId, f.taskId, f.attemptId, typed.content]);
  await client.query("INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings) VALUES($1,$2,$3,$4,2,$5,'claude.sdk.result',$6,$7,$8,$9)", [f.messageId, f.taskId, f.attemptId, f.eventId, f.sessionId, f.sourceId, digest(f.content), f.detailId, typed.settings]);
}
export async function startFixture(label: string) {
  assert.match(label, /^[a-z-]+$/);
  const startedAt = new Date().toISOString();
  const databaseName = 'flow_b03_' + process.pid + '_' + randomUUID().slice(0, 8);
  const adminUrl = process.env.FLOW_B03_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const url = new URL(adminUrl); url.pathname = '/' + databaseName;
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  let created = false; let pool: Pool | undefined; let server: Awaited<ReturnType<typeof createServer>> | undefined; let base = '';
  let measurement: ReturnType<typeof installInstrumentation> | undefined; let work: RequestWork | undefined;
  const ownerToken = randomUUID();
  async function close() {
    measurement?.end(); work = undefined;
    try {
      try { await server?.close(); } finally { await pool?.end(); }
      if (created) {
        const deadline = performance.now() + 5000;
        while (Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count)) {
          if (performance.now() > deadline) throw new Error('Own database still connected.');
          await delay(25);
        }
        await admin.query('DROP DATABASE "' + databaseName + '"'); created = false;
      }
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      await writeFile('docs/evidence/b03/' + label + '-cleanup.json', JSON.stringify({ startedAt, endedAt: new Date().toISOString(), databaseName, remaining }, null, 2));
    } finally { try { await admin.end(); } finally { measurement?.restore(); } }
  }
  async function http(path: string, body?: unknown, measured = false) {
    if (measured) work = measurement!.begin();
    const started = performance.now();
    try {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(measured ? { 'x-b03-sample': 'yes' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
      const text = await response.text();
      return { status: response.status, body: JSON.parse(text), httpUtf8Bytes: Buffer.byteLength(text), elapsedMs: performance.now() - started, work };
    } finally { if (measured) { measurement!.end(); work = undefined; } }
  }
  async function seed(contents: string[], options: { typed?: boolean; status?: string; adapter?: string } = {}) {
    const accepted = await http('/api/conversations', { title: 'B02 fixed metadata' }); assert.equal(accepted.status, 201);
    const conversationId = accepted.body.conversation.id; const runnerId = randomUUID(); const fixtures: TurnFixture[] = [];
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,'B02 fixture',$2,ARRAY['claude'],1)", [runnerId, digest(randomUUID())]);
      for (const [index,content] of contents.entries()) {
        const sessionId = randomUUID(); const sourceId = randomUUID();
        const f = { conversationId, turnId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), sessionId, runnerId, detailId: randomUUID(), eventId: randomUUID(), sourceId, messageId: digest(JSON.stringify([sessionId, sourceId])), content };
        await client.query("INSERT INTO flow.tasks(id,submission,status,verification_status,current_attempt_id,owner_version) VALUES($1,$2,$3,'passed',$4,1)", [f.taskId, { title: 'B02 fixed metadata', harness: 'claude', prompt: 'Fixed user request.' }, options.status ?? 'succeeded', f.attemptId]);
        await client.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,native_session_id,completed_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '1 hour',$4,clock_timestamp())", [f.attemptId, f.taskId, runnerId, sessionId]);
        await client.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'claude',$2)", [sessionId, runnerId]);
        await client.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Native session','session',$4,'application/json')", [randomUUID(), f.taskId, f.attemptId, JSON.stringify({ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: options.adapter ?? 'claude-sdk-0.3.290-v2' })]);
        if (options.typed !== false) await addTyped(client, f);
        await client.query('INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text) VALUES($1,$2,$3,$4,$5)', [f.turnId, conversationId, index+1, f.taskId, 'Fixed user request.']); fixtures.push(f);
      }
      await client.query('UPDATE flow.conversations SET revision=$2 WHERE id=$1', [conversationId, contents.length]);
      await client.query('COMMIT'); return fixtures;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  try {
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw new Error('Refusing existing database.');
    await writeFile('docs/evidence/b03/' + label + '-resource.json', JSON.stringify({ startedAt, databaseName }));
    await admin.query('CREATE DATABASE "' + databaseName + '"'); created = true;
    pool = new Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
    server = await createServer({ databaseUrl: url.href, ownerToken });
    measurement = installInstrumentation();
    server.addHook('onRequest', (request,_reply,done) => { if (request.headers['x-b03-sample'] === 'yes' && work) withinRequest(work,done); else done(); });
    base = await server.listen({ host: '127.0.0.1', port: 0 });
    return { pool, seed, http, close, databaseName, port: new URL(base).port };
  } catch (error) { await close(); throw error; }
}
