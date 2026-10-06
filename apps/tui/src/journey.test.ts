import { afterAll, beforeAll, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { Pool } from 'pg';
import { FlowClient } from '@flow/client';
import type { ExecutionProfile } from '@flow/contracts';
import { createInteractionController, type Intent } from '@flow/interaction';
import { createServer } from '../../server/src/index.js';
import { runRunner } from '../../runner/src/runtime.js';
import { verifyText } from '../../runner/src/verifier.js';
const database = `flow_tui01a_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = adminUrl.replace(/postgres$/, database);
const owner = `tui01a-synthetic-${randomUUID()}`;
const admin = new Pool({ connectionString: adminUrl, max: 1 });
let app: Awaited<ReturnType<typeof createServer>> | undefined; let created = false;
let directory: string; let url: string; let client: FlowClient; let running: Promise<void> | undefined;
const stop = new AbortController();
let configuredProfile: ExecutionProfile;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  directory = await mkdtemp(join(tmpdir(), 'flow-tui01a-journey-'));
  app = await createServer({ databaseUrl, ownerToken: owner, leaseMs: 3000, shutdownGraceMs: 2000 }); url = await app.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl: url, token: owner });
  const catalogRunner = await client.registerRunner({ name: 'TUI01A configured-only profile', harnesses: ['claude'], capacity: 1 });
  configuredProfile = (await new FlowClient({ baseUrl: url, token: catalogRunner.token }).publishExecutionProfile({ configuration: {
    harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-model', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false,
    materialScopeDigest: createHash('sha256').update('[]').digest('hex'), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 },
  } })).profile;
  const runner = await client.registerRunner({ name: 'TUI01A synthetic fixture', harnesses: ['claude'], capacity: 1 });
  running = runRunner({ baseUrl: url, token: runner.token, workingDirectory: join(directory, 'runner'), signal: stop.signal, pollIntervalMs: 50, heartbeatIntervalMs: 500, requestTimeoutMs: 1000,
    adapters: [{ name: 'claude', version: 'claude-sdk-0.3.290-v1', async run(context) {
      await context.emit({ type: 'session', nativeSessionId: context.task.resumeSessionId ?? randomUUID(), adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['synthetic TUI fixture; no SDK/provider', 'model:synthetic'] });
      await new Promise<void>((done, reject) => { const timer = setTimeout(done, 2200); context.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Fixture aborted')); }, { once: true }); });
      await context.assertOwnership(); const content = `Fixture reply: ${context.task.prompt}\n\u001b]52;c;NO\u0007`;
      const artifactId = randomUUID();
      await context.emit({ type: 'artifact', artifactId, title: 'Synthetic reply', version: createHash('sha256').update(content).digest('hex'), content, mediaType: 'text/plain' });
      await context.emit(verifyText(artifactId, content, context.task.verification));
    } }],
  });
});
afterAll(async () => {
  stop.abort(); await running;
  await app?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
  if (created) await admin.query(`DROP DATABASE "${database}"`);
  const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  await admin.end(); console.log('TUI01A cleanup', JSON.stringify({ database, remaining, ownedRunnerStopped: true }));
});
function child(command: string, args: string[], env: NodeJS.ProcessEnv, input?: string) {
  return new Promise<{ output: string; code: number | null }>((done, reject) => {
    const owned = spawn(command, args, { cwd: resolve('.'), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let bytes = 0; let failure: Error | null = null; let killTimer: NodeJS.Timeout | undefined;
    function terminate(error: Error) {
      if (failure) return; failure = error; owned.kill('SIGTERM');
      killTimer = setTimeout(() => { owned.kill('SIGKILL'); }, 2000);
    }
    const timer = setTimeout(() => terminate(new Error('Owned test child timeout')), 20_000);
    for (const stream of [owned.stdout, owned.stderr]) stream.on('data', buffer => {
      bytes += buffer.length; if (bytes > 2 * 1024 * 1024) terminate(new Error('Owned output limit')); else output += buffer.toString();
    });
    owned.once('error', error => { clearTimeout(timer); clearTimeout(killTimer); reject(error); });
    owned.once('close', code => { clearTimeout(timer); clearTimeout(killTimer); if (failure) reject(failure); else done({ output, code }); });
    owned.stdin.on('error', () => {}); owned.stdin.end(input);
  });
}
test('real center catalog selection creates the exact configured profile without submitting a turn', async () => {
  let saved: Intent | null = null;
  const controller = createInteractionController({ client, connectionId: 'synthetic-profile', intents: { load: async () => saved, save: async value => { saved = value; }, clear: async () => { saved = null; } } });
  try {
    await controller.initialize(); expect((await controller.input('/profiles')).code).toBe('PROFILES');
    expect(controller.snapshot().profiles).toContainEqual({ id: configuredProfile.reference.id, model: 'synthetic-model', access: 'none', availability: 'not-probed' });
    expect((await controller.input(`/new --profile ${configuredProfile.reference.id} Profile selection`)).code).toBe('ACCEPTED');
    const snapshot = await client.conversation(controller.snapshot().selected!.id);
    expect(snapshot.conversation.executionProfile).toEqual(configuredProfile.reference);
    expect(snapshot.conversation.requested).toEqual({ model: 'synthetic-model', thinking: 'disabled', tools: 'none' });
    expect(snapshot.lastTurn).toBeNull(); expect(saved).toBeNull();
  } finally { await controller.dispose(); }
});
test('real HTTP lost ACK reuses original key, PTY exit leaves execution running, reopen/headless recover final history', async () => {
  let dropped = false; const posts: { key: string | undefined; body: string }[] = [];
  const proxy = createHttpServer(async (request, response) => {
    const pieces: Buffer[] = []; for await (const piece of request) pieces.push(piece as Buffer); const body = Buffer.concat(pieces).toString();
    const headers: Record<string, string> = { authorization: request.headers.authorization ?? '', 'content-type': 'application/json' };
    if (request.headers['idempotency-key']) headers['idempotency-key'] = String(request.headers['idempotency-key']);
    try {
      const upstream = await fetch(`${url}${request.url}`, { method: request.method, headers, ...(body ? { body } : {}), signal: AbortSignal.timeout(5000) }); const text = await upstream.text();
      if (request.method === 'POST' && request.url === '/api/conversations') {
        posts.push({ key: headers['idempotency-key'], body });
        if (!dropped) { dropped = true; response.destroy(); return; }
      }
      response.writeHead(upstream.status, { 'content-type': 'application/json' }); response.end(text);
    } catch { response.destroy(); }
  });
  await new Promise<void>(done => proxy.listen(0, '127.0.0.1', done));
  const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('No proxy port');
  let saved: Intent | null = null;
  const controller = createInteractionController({ client: new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: owner }), connectionId: 'synthetic-http',
    intents: { load: async () => saved, save: async value => { saved = structuredClone(value); }, clear: async () => { saved = null; } } });
  let conversationId: string;
  try {
    await controller.initialize(); expect((await controller.input('/new PTY conversation')).code).toBe('UNKNOWN');
    expect(posts).toHaveLength(1); expect((await controller.input('/recover')).code).toBe('ACCEPTED');
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]); conversationId = controller.snapshot().selected!.id;
  } finally { await controller.dispose(); proxy.closeAllConnections(); await new Promise<void>(done => proxy.close(() => done())); }
  const nonce = `tui-${randomUUID()}`;
  const environment = { PATH: '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TERM: 'xterm-256color', LANG: 'en_US.UTF-8', FLOW_URL: url, FLOW_TOKEN: owner,
    FLOW_TUI_STATE_DIR: join(directory, 'state'), TUI_TEST_NODE: process.execPath, TUI_TEST_CONVERSATION: conversationId!, TUI_TEST_NONCE: nonce, TUI_TEST_MODE: 'send' };
  const first = await child('/usr/bin/python3', ['apps/tui/test-fixtures/terminal_driver.py'], environment); console.log('TUI01A PTY send', first.output); expect(first.code).toBe(0);
  const afterExit = await client.conversation(conversationId!); expect(afterExit.lastTurn?.task.status).toBe('running');
  expect(afterExit.lastTurn?.user.text).toBe(`${nonce} 中文\nsecond🙂`);
  await expect.poll(async () => (await client.conversation(conversationId!)).lastTurn?.task.status, { timeout: 8000 }).toBe('succeeded');
  const reopened = await child('/usr/bin/python3', ['apps/tui/test-fixtures/terminal_driver.py'], { ...environment, TUI_TEST_MODE: 'read' }); console.log('TUI01A PTY reopen', reopened.output); expect(reopened.code).toBe(0);
  const headless = await child(process.execPath, ['--import', 'tsx', 'apps/tui/src/main.tsx', '--headless'], environment,
    `${JSON.stringify({ type: 'open', id: conversationId! })}\n{"type":"quit"}\n`);
  expect(headless.code).toBe(0);
  const output = headless.output.trim().split('\n').map(line => JSON.parse(line));
  expect(output[0].snapshot.turns[0].assistant.text).toBe(`Fixture reply: ${nonce} 中文\nsecond🙂\n\u001b]52;c;NO\u0007`);
  expect(output[1].result.code).toBe('QUIT');
  expect((await client.conversation(conversationId!)).lastTurn?.task.status).toBe('succeeded');
});
