import { afterAll, beforeAll, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { Pool } from 'pg';
import { FlowClient } from '@flow/client';
import { createInteractionController, type InteractionController } from '@flow/interaction';
import { openIntentStore } from '../intent-store.js';
import { createServer } from '../../../server/src/index.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { verifyText } from '../../../runner/src/verifier.js';

const db = `flow_tui01e_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const admin = new Pool({ connectionString: adminUrl, max: 1 });
const token = `synthetic-tui01e-${randomUUID()}`;
const stop = new AbortController(); let created = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let runner: Promise<void> | undefined; let directory: string; let url: string; let client: FlowClient;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${db}"`); created = true;
  directory = await mkdtemp(join(tmpdir(), 'flow-tui01e-'));
  app = await createServer({ databaseUrl: adminUrl.replace(/postgres$/, db), ownerToken: token, automaticQueueScan: false });
  url = await app.listen({ host: '127.0.0.1', port: 0 }); client = new FlowClient({ baseUrl: url, token });
  const registration = await client.registerRunner({ name: 'TUI01E 0-provider fixture', harnesses: ['claude'], capacity: 1 });
  runner = runRunner({ baseUrl: url, token: registration.token, workingDirectory: join(directory, 'runner'), signal: stop.signal,
    pollIntervalMs: 50, heartbeatIntervalMs: 500, requestTimeoutMs: 1500,
    adapters: [{ name: 'claude', version: 'claude-sdk-0.3.290-v1', async run(context) {
      await context.emit({ type: 'session', nativeSessionId: context.task.resumeSessionId ?? randomUUID(), adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['fixture:no SDK/provider'] });
      const delay = context.task.prompt.includes('PTY-SLOW') ? 6000 : 80;
      await new Promise<void>((done, reject) => { const timer = setTimeout(done, delay); context.signal.addEventListener('abort', () => { clearTimeout(timer); reject(Error('fixture abort')); }, { once: true }); });
      await context.assertOwnership(); const content = `Fixture: ${context.task.prompt}`; const artifactId = randomUUID();
      await context.emit({ type: 'artifact', artifactId, title: 'Fixture text', content, mediaType: 'text/plain', version: createHash('sha256').update(content).digest('hex') });
      await context.emit(verifyText(artifactId, content, context.task.verification));
    } }],
  });
});
afterAll(async () => {
  stop.abort(); await runner; await app?.close();
  if (created) await admin.query(`DROP DATABASE "${db}"`);
  const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [db])).rows;
  await admin.end(); if (directory) await rm(directory, { recursive: true, force: true });
  console.log('TUI01E cleanup', JSON.stringify({ database: db, remaining, ownedRunnerStopped: true, providerCalls: 0 }));
});

async function terminal(baseUrl = url, name = randomUUID()) {
  const id = createHash('sha256').update(name).digest('hex');
  const journal = await openIntentStore(join(directory, 'journals'), id);
  const transport = new FlowClient({ baseUrl, token });
  const controller = createInteractionController({ client: transport, queue: transport, connectionId: id, pollMs: 60_000, intents: journal });
  await controller.initialize();
  return { controller, journal, close: async () => { await controller.dispose(); await journal.close(); } };
}
async function open(controller: InteractionController, conversationId: string) {
  expect((await controller.input(`/open ${conversationId}`)).code).toBe('OPENED');
  expect((await controller.input('/queue')).code).toBe('QUEUE');
}
async function conversation() {
  const id = (await client.createConversation({ title: 'TUI01E queue journey', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } }, randomUUID())).conversation.id;
  const accepted = await client.submitConversationTurn(id, { expectedRevision: 0, text: 'initial fixture', mode: 'follow-up' }, randomUUID());
  await expect.poll(async () => (await client.show(accepted.turn.task.id)).status, { timeout: 8000 }).toBe('succeeded');
  return id;
}
async function child(command: string, args: string[], env: NodeJS.ProcessEnv, input?: string) {
  return new Promise<{ output: string; code: number | null }>((done, reject) => {
    const process = spawn(command, args, { cwd: resolve('.'), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let failure: Error | undefined; let hard: NodeJS.Timeout | undefined;
    const end = (error: Error) => { if (failure) return; failure = error; process.kill('SIGTERM'); hard = setTimeout(() => process.kill('SIGKILL'), 2000); };
    const timeout = setTimeout(() => end(Error('owned child timeout')), 25_000);
    for (const stream of [process.stdout, process.stderr]) stream.on('data', bytes => { if (Buffer.byteLength(output) + bytes.length > 2 * 1024 ** 2) end(Error('owned output bound')); else output += bytes.toString(); });
    process.once('error', error => { clearTimeout(timeout); clearTimeout(hard); reject(error); });
    process.once('close', code => { clearTimeout(timeout); clearTimeout(hard); failure ? reject(failure) : done({ output, code }); });
    process.stdin.on('error', () => {}); process.stdin.end(input);
  });
}
const environment = () => ({ PATH: '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TERM: 'xterm-256color', LANG: 'en_US.UTF-8', FLOW_URL: url, FLOW_TOKEN: token,
  FLOW_TUI_STATE_DIR: join(directory, 'process-journal'), TUI_TEST_NODE: process.execPath });

test('two real clients preserve stale draft, observe queue revision and explicitly resume the bound task', async () => {
  const id = await conversation(); const left = await terminal();
  try {
    await open(left.controller, id); left.controller.setDraft('  original 中文🙂\nnot submitted');
    const observed = left.controller.snapshot().queue!;
    await client.enqueueConversationTurn(id, { expectedQueueRevision: observed.queueRevision, text: 'from second public client' }, randomUUID());
    expect((await left.controller.input('/pause')).code).toBe('HTTP_409');
    expect(left.controller.snapshot()).toMatchObject({ connected: true, draft: '  original 中文🙂\nnot submitted', queue: { queueRevision: observed.queueRevision + 1, paused: false } });
    const afterRejection = await client.conversationQueue(id); await left.controller.input('/recover');
    expect((await client.conversationQueue(id)).queueRevision).toBe(afterRejection.queueRevision);
    expect((await left.controller.input('/pause')).code).toBe('ACCEPTED');
    const paused = await client.conversationQueue(id); expect(paused.paused).toBe(true);
    await expect(client.resumeConversationQueue(id, { expectedQueueRevision: paused.queueRevision, expectedTaskId: randomUUID() }, randomUUID())).rejects.toMatchObject({ status: 409, code: 'conversation_queue_task_conflict' });
    expect((await left.controller.input('/resume')).code).toBe('ACCEPTED');
    const resumed = await client.conversationQueue(id); expect(resumed.paused).toBe(false); expect(resumed.currentTurn?.queueItemId).toBe(paused.items[0]!.id);
    await expect.poll(async () => (await client.show(resumed.currentTurn!.taskId)).status, { timeout: 8000 }).toBe('succeeded');
    expect(left.controller.snapshot().draft).toBe('  original 中文🙂\nnot submitted');
  } finally { await left.close(); }
});

test('lost HTTP ACK persists through journal reopening, recovers exact body/key and preserves newer queue facts', async () => {
  const id = await conversation(); let hidden = false; const requests: { key?: string; body: string }[] = [];
  const proxy = httpServer(async (request, response) => {
    const pieces: Buffer[] = []; for await (const piece of request) pieces.push(piece as Buffer); const body = Buffer.concat(pieces).toString();
    const headers: Record<string, string> = { authorization: String(request.headers.authorization), 'content-type': 'application/json' };
    if (request.headers['idempotency-key']) headers['idempotency-key'] = String(request.headers['idempotency-key']);
    try {
      const upstream = await fetch(`${url}${request.url}`, { method: request.method, headers, ...(body ? { body } : {}), signal: AbortSignal.timeout(5000) }); const text = await upstream.text();
      if (request.method === 'POST') { requests.push({ key: headers['idempotency-key'], body }); if (!hidden) { hidden = true; response.destroy(); return; } }
      response.writeHead(upstream.status, { 'content-type': 'application/json' }); response.end(text);
    } catch { response.destroy(); }
  });
  await new Promise<void>(done => proxy.listen(0, '127.0.0.1', done)); const address = proxy.address(); if (!address || typeof address === 'string') throw Error('proxy port');
  const baseUrl = `http://127.0.0.1:${address.port}`, name = randomUUID(); let current = await terminal(baseUrl, name);
  try {
    await open(current.controller, id); expect((await current.controller.input('/pause')).code).toBe('UNKNOWN'); const saved = await current.journal.load(); expect(saved?.kind).toBe('queue-pause');
    const paused = await client.conversationQueue(id); await client.enqueueConversationTurn(id, { expectedQueueRevision: paused.queueRevision, text: 'later by second client' }, randomUUID());
    await current.close(); current = await terminal(baseUrl, name); expect(requests).toHaveLength(1);
    expect((await current.controller.input('/recover')).code).toBe('ACCEPTED'); expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
    expect(await current.journal.load()).toBeNull(); expect(current.controller.snapshot().queue?.queueRevision).toBe(paused.queueRevision + 1);
    expect(current.controller.snapshot().queue?.items[0]?.preview).toBe('later by second client');
  } finally { await current.close(); proxy.closeAllConnections(); await new Promise<void>(done => proxy.close(() => done())); }
});

test('queue pages stay bounded at twenty preview references through actual JSONL', async () => {
  const id = (await client.createConversation({ title: 'bounded queue', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } }, randomUUID())).conversation.id;
  let revision = 0; const p = await client.pauseConversationQueue(id, { expectedQueueRevision: revision }, randomUUID()); revision = p.queueRevision;
  let originalMaterialBytes = 0;
  for (let i = 1; i <= 23; i++) {
    const text = `${i} ${'正文'.repeat(800)}`; originalMaterialBytes += Buffer.byteLength(text);
    revision = (await client.enqueueConversationTurn(id, { expectedQueueRevision: revision, text }, randomUUID())).queueRevision;
  }
  const input = [{ type: 'open', id }, { type: 'queue' }, { type: 'queue', next: true }, { type: 'quit' }].map(value => JSON.stringify(value)).join('\n') + '\n';
  const paths: string[] = [];
  const proxy = httpServer(async (request, response) => {
    paths.push(`${request.method} ${request.url}`);
    try {
      const upstream = await fetch(`${url}${request.url}`, { headers: { authorization: String(request.headers.authorization) }, signal: AbortSignal.timeout(5000) });
      response.writeHead(upstream.status, { 'content-type': 'application/json' }); response.end(await upstream.text());
    } catch { response.destroy(); }
  });
  await new Promise<void>(done => proxy.listen(0, '127.0.0.1', done)); const address = proxy.address(); if (!address || typeof address === 'string') throw Error('proxy port');
  let result: Awaited<ReturnType<typeof child>>;
  try { result = await child(process.execPath, ['--import', 'tsx', 'apps/tui/src/main.tsx', '--headless'], { ...environment(), FLOW_URL: `http://127.0.0.1:${address.port}` }, input); }
  finally { proxy.closeAllConnections(); await new Promise<void>(done => proxy.close(() => done())); }
  expect(result.code).toBe(0); const lines = result.output.trim().split('\n').map(line => JSON.parse(line));
  expect(lines[1].snapshot.queue.items).toHaveLength(20); expect(lines[2].snapshot.queue.items).toHaveLength(3);
  expect(lines[1].snapshot.queue.items.every((item: object) => !('text' in item))).toBe(true);
  const itemBodyRequests = paths.filter(path => /\/queue\/[^?]+/.test(path)).length;
  expect(itemBodyRequests).toBe(0); expect(paths.every(path => path.startsWith('GET '))).toBe(true);
  console.log('TUI01E bounded JSONL', JSON.stringify({ references: [20, 3], outputBytes: Buffer.byteLength(result.output), firstPageBytes: Buffer.byteLength(JSON.stringify(lines[1].snapshot.queue)), originalMaterialBytes, itemBodyRequests, requests: paths }));
});

test('owned PTY pauses/resumes visibly, preserves an unsent CJK multiline draft and exits without cancelling work', async () => {
  const id = await conversation(); const paused = await client.pauseConversationQueue(id, { expectedQueueRevision: 0 }, randomUUID());
  await client.enqueueConversationTurn(id, { expectedQueueRevision: paused.queueRevision, text: 'PTY-SLOW continues after observer exit' }, randomUUID());
  const result = await child('/usr/bin/python3', ['apps/tui/test-fixtures/queue_driver.py'], { ...environment(), TUI_TEST_CONVERSATION: id });
  console.log('TUI01E PTY', result.output); expect(result.code).toBe(0);
  const state = await client.conversationQueue(id); expect(state.paused).toBe(false); expect(state.currentTurn?.taskStatus).toMatch(/queued|running/);
  expect((await client.conversationTurns(id)).turns).toHaveLength(2);
  await expect.poll(async () => (await client.show(state.currentTurn!.taskId)).status, { timeout: 12_000 }).toBe('succeeded');
}, 25_000);
