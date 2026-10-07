import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { RUNNER_CLAIM_PROTOCOL, type ClaimedTask, type HarnessContext, type RunnerClaimRequest } from '@flow/contracts';
import { AdmissionStorageError } from './admission-journal.js';
import { runRunner, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const stops: (() => Promise<void>)[] = [];
afterEach(async () => { for (const stop of stops.splice(0).reverse()) await stop(); });
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function hold(context: HarnessContext) { return new Promise<void>(resolve => { if (context.signal.aborted) resolve(); else context.signal.addEventListener('abort', () => resolve(), { once: true }); }); }
const runnerId = 'runner-recovery';
const assignment: ClaimedTask = { task: { id: 'task-recovery', title: 'Recovery', prompt: 'No provider', harness: 'fixture' },
  attempt: { id: 'attempt-recovery', runnerId, ownerVersion: 3, leaseExpiresAt: '2099-01-01T00:00:00.000Z' } };
const identity = { taskId: assignment.task.id, attemptId: assignment.attempt.id, runnerId, ownerVersion: 3 };

async function peer() {
  const directory = await mkdtemp(join(tmpdir(), 'flow-claim-recovery-'));
  const requests: { path: string; input: RunnerClaimRequest; at: number }[] = [];
  const executions: { stop: AbortController; promise: Promise<void> }[] = [];
  const heartbeats: unknown[] = [];
  let claim = (input: RunnerClaimRequest, response: ServerResponse) => { response.end(JSON.stringify({ ...input, state: 'empty' })); };
  let status = (input: RunnerClaimRequest, response: ServerResponse) => { response.end(JSON.stringify({ ...input, state: 'missing' })); };
  let authenticatedRunner = runnerId;
  const server = createServer(async (request, response) => {
    const parts: Buffer[] = []; for await (const part of request) parts.push(part as Buffer);
    const input = JSON.parse(Buffer.concat(parts).toString() || '{}');
    const path = request.url ?? ''; requests.push({ path, input, at: performance.now() });
    response.setHeader('content-type', 'application/json');
    if (path === '/api/runner/identity') response.end(JSON.stringify({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: authenticatedRunner }));
    else if (path === '/api/runner/claim-opportunity/status') status(input, response);
    else if (path === '/api/runner/claim-opportunity') claim(input, response);
    else if (path === '/api/runner/heartbeat') { heartbeats.push(input); response.end(JSON.stringify({ action: 'continue', remainingLeaseMs: 10000 })); }
    else if (path === '/api/runner/events') response.end(JSON.stringify({ accepted: input.events.length, lastSequence: input.events.at(-1).sequence }));
    else response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No private listener.');
  const baseUrl = `http://127.0.0.1:${address.port}`, state = join(directory, textDigest(baseUrl)), journal = join(state, 'admission.json');
  stops.push(async () => { executions.forEach(item => item.stop.abort()); server.closeAllConnections(); await Promise.allSettled(executions.map(item => item.promise)); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });
  return {
    requests, heartbeats, journal,
    onClaim(fn: typeof claim) { claim = fn; }, onStatus(fn: typeof status) { status = fn; },
    authenticate(id: string) { authenticatedRunner = id; },
    assigned(input: RunnerClaimRequest, response: ServerResponse) { response.end(JSON.stringify({ ...input, state: 'assigned', identity, assignment, remainingLeaseMs: 9999 })); },
    async read() { return JSON.parse(await readFile(journal, 'utf8')); },
    async seed(value: unknown) { await mkdir(state, { recursive: true }); await writeFile(journal, JSON.stringify(value)); },
    start(run: (context: HarnessContext) => Promise<void> = async () => { throw new Error('Unexpected adapter execution.'); }, extra: Partial<RunnerOptions> = {}) {
      const stop = new AbortController();
      const promise = runRunner({ baseUrl, token: 'synthetic-runner-token', workingDirectory: directory, signal: stop.signal,
        adapters: [{ name: 'fixture', version: '1', run }], heartbeatIntervalMs: 1000, requestTimeoutMs: 1000, ...extra });
      void promise.catch(() => undefined); const execution = { stop, promise }; executions.push(execution); return execution;
    },
  };
}

it('keeps the default 500 ms cadence and the same durable file through three empty observations', async () => {
  const api = await peer(), first = deferred(), third = deferred(); let count = 0;
  api.onClaim((input, response) => { response.end(JSON.stringify({ ...input, state: 'empty' })); if (++count === 1) first.resolve(); if (count === 3) third.resolve(); });
  const running = api.start(); await first.promise;
  const before = await stat(api.journal), value = await api.read();
  await third.promise; running.stop.abort(); await running.promise;
  const after = await stat(api.journal), claims = api.requests.filter(item => item.path === '/api/runner/claim-opportunity');
  expect(claims).toHaveLength(3); expect(new Set(claims.map(item => item.input.requestId))).toEqual(new Set([value.opportunityId]));
  expect(claims[1]!.at - claims[0]!.at).toBeGreaterThanOrEqual(490);
  expect(claims[2]!.at - claims[1]!.at).toBeGreaterThanOrEqual(490);
  expect(after.ino).toBe(before.ino); expect(after.mtimeMs).toBe(before.mtimeMs); expect(await api.read()).toEqual(value);
});

it('recovers an allocated but lost ACK by the same identity, durably accepts, then fences before the adapter', async () => {
  const api = await peer(), entered = deferred(); let allocated: RunnerClaimRequest | undefined, starts = 0;
  api.onStatus((input, response) => { if (allocated) api.assigned(input, response); else response.end(JSON.stringify({ ...input, state: 'missing' })); });
  api.onClaim((input, response) => { allocated = input; response.destroy(); });
  let accepted: unknown, key: string | undefined, fenced: unknown;
  const running = api.start(async context => { starts++; const journal = await api.read(); accepted = journal.assignments; key = journal.opportunityId; fenced = api.heartbeats[0]; entered.resolve(); await hold(context); }, { pollIntervalMs: 5 });
  await entered.promise; running.stop.abort(); await running.promise;
  expect(starts).toBe(1); expect(accepted).toEqual([identity]); expect(key).not.toBe(allocated!.requestId);
  expect(fenced).toMatchObject({ attemptId: identity.attemptId, ownerVersion: identity.ownerVersion });
  expect(api.requests.filter(item => item.path === '/api/runner/claim-opportunity')).toHaveLength(1);
  expect(new Set(api.requests.filter(item => item.path.includes('claim-opportunity')).map(item => item.input.requestId))).toEqual(new Set([allocated!.requestId]));
});

it('safely re-sends the same key after a missing lookup and never replaces it after unknown delivery', async () => {
  const api = await peer(), entered = deferred(); const keys: string[] = []; let starts = 0;
  api.onClaim((input, response) => { keys.push(input.requestId); if (keys.length === 1) response.destroy(); else api.assigned(input, response); });
  const running = api.start(async context => { starts++; entered.resolve(); await hold(context); }, { pollIntervalMs: 5 });
  await entered.promise; running.stop.abort(); await running.promise;
  expect(keys).toHaveLength(2); expect(new Set(keys).size).toBe(1); expect(starts).toBe(1); expect((await api.read()).assignments).toEqual([identity]);
});

it('restarts an unresolved v2 opportunity by querying its original key, without replaying an already persisted assignment', async () => {
  const api = await peer(), entered = deferred(), blocked = deferred(); const requestId = randomUUID(); let starts = 0;
  await api.seed({ version: 2, runnerId, opportunityId: requestId, assignments: [] });
  api.onStatus((input, response) => api.assigned(input, response));
  const first = api.start(async context => { starts++; entered.resolve(); await hold(context); });
  await entered.promise; first.stop.abort(); await first.promise;
  const second = api.start(async () => { starts++; }, { onNotice: notice => { if (notice.type === 'admission-blocked') blocked.resolve(); } });
  await blocked.promise; second.stop.abort(); await second.promise;
  expect(starts).toBe(1); expect(api.requests.filter(item => item.path === '/api/runner/claim-opportunity')).toHaveLength(0);
  expect(api.requests.filter(item => item.path.endsWith('/status')).map(item => item.input.requestId)).toEqual([requestId]);
});

it('retains an unavailable expired or completed allocation without new admission or adapter execution', async () => {
  const api = await peer(), blocked = deferred(); const requestId = randomUUID(); let starts = 0;
  const original = { version: 2, runnerId, opportunityId: requestId, assignments: [] }; await api.seed(original);
  api.onStatus((input, response) => response.end(JSON.stringify({ ...input, state: 'unavailable', identity, reason: 'not-executable' })));
  const running = api.start(async () => { starts++; }, { onNotice: notice => { if (notice.type === 'admission-blocked') blocked.resolve(); } });
  await blocked.promise; running.stop.abort(); await running.promise;
  expect(await api.read()).toEqual(original); expect(starts).toBe(0); expect(api.requests.filter(item => item.path === '/api/runner/claim-opportunity')).toHaveLength(0);
});

it('keeps a v1 unknown request blocked and rejects another bearer identity before any opportunity request', async () => {
  const api = await peer(), blocked = deferred(); const original = { version: 1, inFlight: randomUUID(), assignments: [] }; await api.seed(original);
  const first = api.start(undefined, { onNotice: notice => { if (notice.type === 'admission-blocked') blocked.resolve(); } });
  await blocked.promise; first.stop.abort(); await first.promise; expect(await api.read()).toEqual(original);
  await api.seed({ version: 2, runnerId, opportunityId: randomUUID(), assignments: [] }); api.authenticate('different-runner');
  await expect(api.start().promise).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(api.requests.every(item => item.path === '/api/runner/identity')).toBe(true);
});

it.each([401, 403])('preserves fatal authentication %s from the new status method without a mutation or retry', async code => {
  const api = await peer(); api.onStatus((_input, response) => response.writeHead(code).end(JSON.stringify({ error: { code: code === 401 ? 'unauthorized' : 'wrong_role', message: 'Synthetic revoked runner' } })));
  await expect(api.start().promise).rejects.toMatchObject({ status: code, message: 'Synthetic revoked runner' });
  expect(api.requests.map(item => item.path)).toEqual(['/api/runner/identity', '/api/runner/claim-opportunity/status']);
});
