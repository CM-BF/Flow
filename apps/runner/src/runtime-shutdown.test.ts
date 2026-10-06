import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { FlowApiError } from '@flow/client';
import type { ClaimedTask, HarnessAdapter } from '@flow/contracts';
import { runRunner, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  const errors: unknown[] = [];
  for (const close of cleanup.splice(0).reverse()) try { await close(); } catch (error) { errors.push(error); }
  vi.restoreAllMocks();
  if (errors.length) throw errors[0];
});
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
async function peer() {
  const directory = await mkdtemp(join(tmpdir(), 'flow-runner-stop-'));
  const executions: { control: AbortController; promise: Promise<void> }[] = [];
  const requests: string[] = [];
  let claim = (_index: number, response: ServerResponse) => { response.end(JSON.stringify({ assignment: null, remainingLeaseMs: 0 })); };
  let route = (_path: string, _body: any, _response: ServerResponse) => false;
  let claims = 0;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const part of request) chunks.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    requests.push(request.url ?? '');
    response.setHeader('content-type', 'application/json');
    if (request.url === '/api/runner/claim') { claim(++claims, response); return; }
    if (route(request.url ?? '', body, response)) return;
    if (request.url === '/api/runner/heartbeat') { response.end(JSON.stringify({ action: 'continue', remainingLeaseMs: 10_000 })); return; }
    if (request.url === '/api/runner/events') { response.end(JSON.stringify({ accepted: body.events.length, lastSequence: body.events.at(-1).sequence })); return; }
    response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing private listener.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const journalPath = join(directory, textDigest(baseUrl), 'admission.json');
  cleanup.push(async () => {
    for (const execution of executions) execution.control.abort();
    server.closeAllConnections();
    await Promise.allSettled(executions.map(execution => execution.promise));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  return {
    baseUrl, directory, journalPath, requests,
    get claims() { return claims; },
    onClaim(handler: typeof claim) { claim = handler; },
    onRoute(handler: typeof route) { route = handler; },
    async journal() { return JSON.parse(await readFile(journalPath, 'utf8')) as { version: number; inFlight: string | null; assignments: unknown[] }; },
    start(extra: Partial<RunnerOptions> = {}) {
      const control = new AbortController();
      const adapter: HarnessAdapter = { name: 'fixture', version: 'test', async run() { throw new Error('Unexpected adapter execution.'); } };
      const promise = runRunner({ baseUrl, token: 'synthetic-test-token', workingDirectory: directory, signal: control.signal,
        adapters: [adapter], pollIntervalMs: 10, heartbeatIntervalMs: 25, requestTimeoutMs: 500, ...extra });
      void promise.catch(() => undefined);
      const execution = { control, promise }; executions.push(execution); return execution;
    },
  };
}

it('drains a definite null claim across normal stop and can claim after same-directory restart', async () => {
  const api = await peer(); const received = deferred<ServerResponse>();
  api.onClaim((_index, response) => received.resolve(response));
  const first = api.start(); const response = await received.promise;
  expect((await api.journal()).inFlight).toEqual(expect.any(String));
  first.control.abort();
  response.end(JSON.stringify({ assignment: null, remainingLeaseMs: 0 }));
  await first.promise;
  expect(await api.journal()).toEqual({ version: 1, inFlight: null, assignments: [] });
  const next = deferred<ServerResponse>(); api.onClaim((_index, reply) => next.resolve(reply));
  const restarted = api.start(); const nextResponse = await next.promise;
  restarted.control.abort(); nextResponse.end(JSON.stringify({ assignment: null, remainingLeaseMs: 0 }));
  await restarted.promise;
  expect(api.claims).toBe(2);
  expect(await api.journal()).toEqual({ version: 1, inFlight: null, assignments: [] });
});

function assignment(): ClaimedTask {
  return { attempt: { id: 'attempt-stop-test', runnerId: 'runner-stop-test', ownerVersion: 7, leaseExpiresAt: new Date(Date.now() + 10_000).toISOString() },
    task: { id: 'task-stop-test', title: 'Synthetic shutdown', prompt: 'No model', harness: 'fixture' } };
}
async function assertBlockedRestart(api: Awaited<ReturnType<typeof peer>>) {
  const count = api.claims; const blocked = deferred(); let adapters = 0;
  const resumed = api.start({ adapters: [{ name: 'fixture', version: 'test', async run() { adapters++; } }],
    onNotice: notice => { if (notice.type === 'admission-blocked') blocked.resolve(); } });
  await blocked.promise; resumed.control.abort(); await resumed.promise;
  expect(api.claims).toBe(count); expect(adapters).toBe(0);
}

it('persists a late assignment without starting it or manufacturing completion after normal stop', async () => {
  const api = await peer(); const received = deferred<ServerResponse>(); let executed = 0;
  api.onClaim((_index, response) => received.resolve(response));
  const running = api.start({ adapters: [{ name: 'fixture', version: 'test', async run() { executed++; } }] });
  const response = await received.promise; running.control.abort();
  response.end(JSON.stringify({ assignment: assignment(), remainingLeaseMs: 10_000 }));
  await running.promise;
  expect(await api.journal()).toEqual({ version: 1, inFlight: null, assignments: [{ taskId: 'task-stop-test', attemptId: 'attempt-stop-test', runnerId: 'runner-stop-test', ownerVersion: 7 }] });
  expect(executed).toBe(0); expect(api.requests).toEqual(['/api/runner/claim']);
  await assertBlockedRestart(api);
  expect(api.requests).toEqual(['/api/runner/claim']);
});

it('uses the original request deadline during normal stop and keeps its unresolved intent across restart', async () => {
  const api = await peer(); const received = deferred();
  api.onClaim(() => received.resolve());
  const deadlines: { milliseconds: number; control: AbortController }[] = [];
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
    const control = new AbortController(); deadlines.push({ milliseconds, control }); return control.signal;
  });
  const running = api.start({ requestTimeoutMs: 200 });
  try {
    await received.promise; const before = await api.journal();
    expect(deadlines).toHaveLength(1); expect(deadlines[0]!.milliseconds).toBe(200);
    running.control.abort();
    deadlines[0]!.control.abort(new DOMException('Original deadline reached', 'TimeoutError'));
    await running.promise;
    expect(deadlines).toHaveLength(1); expect(await api.journal()).toEqual(before);
    timeout.mockRestore(); await assertBlockedRestart(api);
    expect(await api.journal()).toEqual(before);
  } finally {
    running.control.abort(); for (const deadline of deadlines) deadline.control.abort();
    await running.promise; timeout.mockRestore();
  }
});

it.each(['connection reset', 'malformed response'])('retains the same intent on %s without a replacement claim', async mode => {
  const api = await peer(); const received = deferred<ServerResponse>(); const blocked = deferred();
  api.onClaim((_index, response) => received.resolve(response));
  const running = api.start({ onNotice: notice => { if (notice.type === 'admission-blocked') blocked.resolve(); } });
  const response = await received.promise; const before = await api.journal();
  if (mode === 'connection reset') response.destroy(); else response.end('{}');
  await blocked.promise; running.control.abort(); await running.promise;
  expect(await api.journal()).toEqual(before); expect(api.claims).toBe(1);
  await assertBlockedRestart(api); expect(await api.journal()).toEqual(before);
});

it('sends no request if normal stop already happened before admission', async () => {
  const api = await peer(); const stop = new AbortController(); stop.abort();
  await api.start({ signal: stop.signal }).promise;
  expect(api.requests).toEqual([]);
});

it('clears only its unsent intent when normal stop occurs while real durable rename is returning', async () => {
  const api = await peer(); const renamed = deferred(); const release = deferred();
  const original = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let gated = false;
  vi.mocked(rename).mockImplementation(async (source, destination) => {
    await original.rename(source, destination);
    if (!gated && source === api.journalPath + '.tmp' && destination === api.journalPath) {
      gated = true; renamed.resolve(); await release.promise;
    }
  });
  const running = api.start();
  try {
    await renamed.promise; expect((await api.journal()).inFlight).toEqual(expect.any(String));
    running.control.abort(); release.resolve(); await running.promise;
    expect(api.requests).toEqual([]);
    expect(await api.journal()).toEqual({ version: 1, inFlight: null, assignments: [] });
  } finally {
    release.resolve(); running.control.abort(); await running.promise;
    vi.mocked(rename).mockImplementation(original.rename);
  }
});

it.each([401, 403])('fatal host authentication %s still preempts a pending claim and awaits the active adapter', async status => {
  const api = await peer(); const pendingClaim = deferred<ServerResponse>(); const fatalHeartbeat = deferred<ServerResponse>(); const entered = deferred();
  let heartbeatCount = 0, exited = false;
  api.onClaim((index, response) => {
    if (index === 1) response.end(JSON.stringify({ assignment: assignment(), remainingLeaseMs: 10_000 }));
    else pendingClaim.resolve(response);
  });
  api.onRoute((path, _body, response) => {
    if (path === '/api/runner/heartbeat' && ++heartbeatCount > 1) { fatalHeartbeat.resolve(response); return true; }
    return false;
  });
  const running = api.start({ maxConcurrentAttempts: 2, requestTimeoutMs: 10_000, adapters: [{ name: 'fixture', version: 'test', async run(context) {
    entered.resolve();
    try { await new Promise<void>(resolve => { if (context.signal.aborted) resolve(); else context.signal.addEventListener('abort', () => resolve(), { once: true }); }); }
    finally { exited = true; }
  } }] });
  const [pending, heartbeat] = await Promise.all([pendingClaim.promise, fatalHeartbeat.promise, entered.promise]);
  const before = await api.journal(); const closed = new Promise<void>(resolve => pending.once('close', () => resolve()));
  heartbeat.writeHead(status).end(JSON.stringify({ error: { code: status === 403 ? 'wrong_role' : 'unauthorized', message: 'Synthetic revoked host' } }));
  const error = await running.promise.catch(error => error);
  expect(error).toBeInstanceOf(FlowApiError); expect(error).toMatchObject({ status, message: 'Synthetic revoked host' });
  await closed; expect(exited).toBe(true); expect(api.claims).toBe(2);
  expect((await api.journal()).inFlight).toBe(before.inFlight);
  expect(api.requests.filter(path => path === '/api/runner/events')).toHaveLength(0);
});

it('retains a real in-flight intent after killing its owned child and blocks same-directory restart', async () => {
  const api = await peer(); const received = deferred(); api.onClaim(() => received.resolve());
  const runtime = pathToFileURL(join(import.meta.dirname, 'runtime.ts')).href;
  const script = `import { runRunner } from ${JSON.stringify(runtime)}; await runRunner({baseUrl:${JSON.stringify(api.baseUrl)},token:'synthetic-test-token',workingDirectory:${JSON.stringify(api.directory)},signal:new AbortController().signal,requestTimeoutMs:10000});`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), env: { PATH: process.env.PATH ?? '' }, stdio: 'ignore' });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
  });
  cleanup.push(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await closed; });
  await Promise.race([received.promise, closed.then(() => { throw new Error('Owned child exited before the peer received its claim.'); })]);
  const before = await api.journal(); expect(before.inFlight).toEqual(expect.any(String));
  expect(child.kill('SIGKILL')).toBe(true); expect(await closed).toEqual({ code: null, signal: 'SIGKILL' });
  expect(await api.journal()).toEqual(before);
  await assertBlockedRestart(api); expect(await api.journal()).toEqual(before); expect(api.claims).toBe(1);
});
