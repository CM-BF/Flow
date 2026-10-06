import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { assistantFinalDataSchema } from '../../packages/contracts/src/assistant.js';
import { installInstrumentation, withinRequest, type RequestWork } from './instrument.js';

const startedAt = new Date().toISOString();
const deadline = performance.now() + 90_000;
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(new Error('B02 work deadline exceeded')), 90_000); timer.unref();
const measurement = installInstrumentation();
const databaseName = `flow_b02_${process.pid}_${randomUUID().slice(0, 8)}`;
const adminUrl = process.env.FLOW_B02_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const database = new URL(adminUrl); database.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
let pool: Pool | undefined; let server: Awaited<ReturnType<typeof import('../../apps/server/src/index.js')['createServer']>> | undefined; let baseUrl = ''; let created = false;
const ownerToken = randomUUID();
let currentWork: RequestWork | undefined;
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const result: any = { startedAt, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), productBase: '75a33dec228e17bbbd0d3be9fd01bc9ac18a0133', node: process.version,
  method: { databaseBytes: 'UTF-8 JSON serialization of decoded pg result.rows arrays, including field names and empty arrays; NOT PostgreSQL wire bytes', httpBytes: 'UTF-8 response body bytes as received by fetch; headers excluded', latency: 'Instrumented shared-host wall time including JSON sizing/hash hooks; first-after-seed is NOT cold PG/OS cache; warm n20 p99=max, not SLO', hash: 'SHA256 update+digest input bytes and instrumented compute elapsed; known body byte size distinguishes body hashes from auth hashes; no secret/content capture' },
  workloads: [], guards: [], cleanup: {}, exitCode: 1 };
function checkDeadline() { if (performance.now() > deadline) throw new Error('B02 bounded work deadline exceeded'); }
async function http(path: string, body?: unknown, measured = false) {
  checkDeadline(); const started = performance.now();
  if (measured) currentWork = measurement.begin();
  try {
    const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(measured ? { 'x-b02-sample': 'yes' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]) });
    const text = await response.text(); const elapsedMs = performance.now() - started;
    return { status: response.status, body: JSON.parse(text), httpUtf8Bytes: Buffer.byteLength(text), elapsedMs, work: currentWork };
  } finally { if (measured) { measurement.end(); currentWork = undefined; } }
}
const settings = { requested: { model: 'fixture', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: 'fixture', permissionMode: 'dontAsk', tools: [], thinking: 'unknown' } } as const;
interface Fixture { conversationId: string; turnId: string; taskId: string; attemptId: string; sessionId: string; runnerId: string; detailId: string; eventId: string; sourceId: string; messageId: string; content: string }
async function addTyped(client: PoolClient, fixture: Fixture) {
  const f = fixture;
  const typed = assistantFinalDataSchema.parse({ type: 'assistant-final', messageId: f.messageId, nativeSessionId: f.sessionId, source: 'claude.sdk.result', sourceMessageId: f.sourceId, content: f.content, settings });
  await client.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Assistant reply','detail',$4,'text/plain')", [f.detailId, f.taskId, f.attemptId, typed.content]);
  await client.query("INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings) VALUES($1,$2,$3,$4,2,$5,'claude.sdk.result',$6,$7,$8,$9)", [f.messageId, f.taskId, f.attemptId, f.eventId, f.sessionId, f.sourceId, sha256(f.content), f.detailId, typed.settings]);
}
async function seed(turns: number, content: string, typed = true, status = 'succeeded') {
  const created = await http('/api/conversations', { title: 'B02 fixed metadata' }); assert.equal(created.status, 201);
  const conversationId = created.body.conversation.id; const runnerId = randomUUID(); const fixtures: Fixture[] = [];
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,'B02 fixture',$2,ARRAY['claude'],1)", [runnerId, sha256(randomUUID())]);
    for (let number = 1; number <= turns; number += 1) {
      checkDeadline();
      const sessionId = randomUUID(); const sourceId = randomUUID();
      const f = { conversationId, turnId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), sessionId, runnerId, detailId: randomUUID(), eventId: randomUUID(), sourceId, messageId: sha256(JSON.stringify([sessionId, sourceId])), content };
      await client.query("INSERT INTO flow.tasks(id,submission,status,verification_status,current_attempt_id,owner_version) VALUES($1,$2,$3,'passed',$4,1)", [f.taskId, { title: 'B02 fixed metadata', harness: 'claude', prompt: 'Fixed user request.' }, status, f.attemptId]);
      await client.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,native_session_id,completed_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '1 hour',$4,clock_timestamp())", [f.attemptId, f.taskId, runnerId, sessionId]);
      await client.query("INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,'claude',$2)", [sessionId, runnerId]);
      await client.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Native session','session',$4,'application/json')", [randomUUID(), f.taskId, f.attemptId, JSON.stringify({ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' })]);
      if (typed) await addTyped(client, f);
      await client.query('INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text) VALUES($1,$2,$3,$4,$5)', [f.turnId, conversationId, number, f.taskId, 'Fixed user request.']); fixtures.push(f);
    }
    await client.query('UPDATE flow.conversations SET revision=$2 WHERE id=$1', [conversationId, turns]);
    await client.query('COMMIT'); return fixtures;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
function body(bytes: number) { return '中🙂ab'.repeat(Math.floor(bytes / 9)) + 'x'.repeat(bytes % 9); }
function percentile(values: number[], fraction: number) { return [...values].sort((a,b) => a-b)[Math.ceil(values.length * fraction)-1]!; }
async function measure(turns: number, contentBytes: number) {
  const content = body(contentBytes); assert.equal(Buffer.byteLength(content), contentBytes);
  const fixtures = await seed(turns, content); const samples: any[] = [];
  for (let index = 0; index < 21; index += 1) {
    const response = await http(`/api/conversations/${fixtures[0]!.conversationId}/turns?limit=${turns}`, undefined, true);
    assert.equal(response.status, 200); assert.equal(response.body.turns.length, turns);
    assert(response.body.turns.every((turn: any) => turn.assistant.state === 'available' && turn.assistant.source.contentDigest === sha256(content)));
    const work = response.work!; const selects = Object.entries(work.sql).filter(([name]) => name.startsWith('select:'));
    const selectCount = selects.reduce((sum, [,value]) => sum + value.count, 0);
    const bodyHashes = work.hashes.filter(hash => hash.inputBytes === contentBytes);
    assert.equal(selectCount, 2 + 5 * turns, 'Observed SQL count must match the inspected typed path.');
    assert.equal(bodyHashes.length, turns, 'Every returned typed body must retain digest validation.');
    samples.push({ phase: index ? 'subsequent' : 'first-after-seed', elapsedMs: response.elapsedMs, httpUtf8Bytes: response.httpUtf8Bytes,
      selectCount, transactionCount: Object.entries(work.sql).filter(([name]) => name.startsWith('transaction:')).reduce((sum,[,value])=>sum+value.count,0),
      decodedSelectRowsJsonUtf8Bytes: selects.reduce((sum,[,value])=>sum+value.decodedRowsJsonUtf8Bytes,0), bodyHashCount: bodyHashes.length,
      bodyHashInputBytes: bodyHashes.reduce((sum,hash)=>sum+hash.inputBytes,0), bodyHashComputeMs: bodyHashes.reduce((sum,hash)=>sum+hash.computeMs,0), ...work });
  }
  const warm = samples.slice(1); const consistent = ['selectCount','transactionCount','decodedSelectRowsJsonUtf8Bytes','httpUtf8Bytes','bodyHashCount','bodyHashInputBytes'];
  for (const field of consistent) assert.equal(new Set(samples.map(sample=>sample[field])).size, 1, `Byte/query consistency: ${field}`);
  result.workloads.push({ turns, contentUtf8Bytes: contentBytes, persistedBodyUtf8Bytes: turns*contentBytes, samples,
    summary: { n: warm.length, p50Ms: percentile(warm.map(s=>s.elapsedMs),0.5), p95Ms: percentile(warm.map(s=>s.elapsedMs),0.95), p99Ms: percentile(warm.map(s=>s.elapsedMs),0.99), firstMs: samples[0].elapsedMs,
      ...Object.fromEntries(consistent.map(field=>[field,warm[0][field]])) } });
}
async function guardChecks() {
  const f = (await seed(1, 'Late typed body', false, 'running'))[0]!;
  const read = async () => (await http(`/api/conversations/${f.conversationId}/turns?limit=1`)).body.turns[0].assistant;
  const writer = await pool!.connect();
  try {
    await writer.query('BEGIN'); await addTyped(writer, f);
    assert.equal((await read()).state, 'pending'); result.guards.push('uncommitted typed final stays pending');
    await writer.query('COMMIT'); assert.equal((await read()).state,'pending'); result.guards.push('committed typed final remains pending before task success');
  } catch (error) { await writer.query('ROLLBACK'); throw error; } finally { writer.release(); }
  await pool!.query("UPDATE flow.tasks SET status='succeeded' WHERE id=$1",[f.taskId]);
  assert.equal((await read()).text, f.content); result.guards.push('success exposes exact bound final');
  await pool!.query('UPDATE flow.details SET content=$2 WHERE id=$1',[f.detailId,'Corrupted imported body']);
  assert.equal((await read()).reason,'invalid-result'); result.guards.push('digest corruption rejected');
  await pool!.query('UPDATE flow.details SET content=$2 WHERE id=$1',[f.detailId,f.content]);
  await pool!.query('UPDATE flow.assistant_messages SET native_session_id=$2 WHERE id=$1',[f.messageId,randomUUID()]);
  assert.equal((await read()).reason,'invalid-result'); result.guards.push('foreign native session binding rejected');
  await pool!.query('UPDATE flow.assistant_messages SET native_session_id=$2 WHERE id=$1',[f.messageId,f.sessionId]);
  const foreign = (await seed(1,'Foreign conversation body'))[0]!;
  assert.equal((await http(`/api/conversations/${foreign.conversationId}/turns/${f.turnId}/details/${f.detailId}`)).status,404); result.guards.push('foreign conversation detail access rejected');
  const attempt = randomUUID();
  await pool!.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,native_session_id,completed_at) VALUES($1,$2,$3,2,clock_timestamp(),$4,clock_timestamp())',[attempt,f.taskId,f.runnerId,f.sessionId]);
  await pool!.query("INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,'Session','session',$4,'application/json')",[randomUUID(),f.taskId,attempt,JSON.stringify({id:randomUUID(),sequence:1,type:'session',nativeSessionId:f.sessionId,adapterVersion:'claude-sdk-0.3.290-v2'})]);
  await pool!.query('UPDATE flow.tasks SET current_attempt_id=$2,owner_version=2 WHERE id=$1',[f.taskId,attempt]);
  assert.equal((await read()).reason,'missing-result'); result.guards.push('prior attempt final not reused by current attempt');
}
try {
  const { createServer } = await import('../../apps/server/src/index.js');
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName])).rowCount) throw new Error('Refusing existing database.');
  await writeFile('docs/evidence/b02/resource.json',JSON.stringify({ databaseName, startedAt }));
  await admin.query(`CREATE DATABASE "${databaseName}"`); created=true;
  pool = new Pool({connectionString:database.href,max:4,connectionTimeoutMillis:3000,statement_timeout:5000});
  server = await createServer({databaseUrl:database.href,ownerToken});
  server.addHook('onRequest',(request,_reply,done)=> { if (request.headers['x-b02-sample']==='yes' && currentWork) withinRequest(currentWork,done); else done(); });
  baseUrl=await server.listen({host:'127.0.0.1',port:0});
  result.port=new URL(baseUrl).port;
  for (const bytes of [256,131072]) for (const turns of [1,20,50]) await measure(turns,bytes);
  await guardChecks(); result.exitCode=0;
} catch (error) { result.error=error instanceof Error ? {name:error.name,message:error.message,stack:error.stack?.split('\n').slice(0,7)} : {message:String(error)}; }
finally {
  measurement.end(); currentWork=undefined;
  try {
    try { await server?.close(); } finally { await pool?.end(); }
    if (created) {
      const cleanupDeadline=performance.now()+5000;
      while(Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1',[databaseName])).rows[0].count)) { if(performance.now()>cleanupDeadline)throw new Error('Own database still connected.'); await delay(25); }
      await admin.query(`DROP DATABASE "${databaseName}"`);
    }
    result.cleanup={databaseName,remaining:(await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[databaseName])).rows};
  } catch(error) { result.exitCode=1;result.cleanupError=error instanceof Error?error.message:String(error); }
  finally { try { await admin.end(); } finally { measurement.restore(); clearTimeout(timer); } }
  result.endedAt=new Date().toISOString(); result.instrumentationRestored=true;
  const sourceFiles=['apps/server/src/conversations/queries.ts','apps/server/src/conversations/state.ts','apps/server/src/conversations/replies.ts','apps/server/src/assistant/store.ts','apps/server/src/tasks.ts','apps/server/src/database.ts'];
  result.productSourceFiles=await Promise.all(sourceFiles.map(async path=>({path,sha256:sha256(await readFile(path,'utf8'))})));
  await writeFile('docs/evidence/b02/results.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({startedAt:result.startedAt,endedAt:result.endedAt,exitCode:result.exitCode,workloads:result.workloads.map((w:any)=>({turns:w.turns,contentUtf8Bytes:w.contentUtf8Bytes,...w.summary})),guards:result.guards,cleanup:result.cleanup,error:result.error}));
  process.exitCode=result.exitCode;
}
