import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { runRunner, type RunnerOptions, type RunnerNotice } from './runtime.js';
import { textDigest } from './verifier.js';
import { AdmissionStorageError } from './admission-journal.js';

const directories: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const path of directories.splice(0)) await rm(path, { recursive: true }); });
const runnerId = 'runner-initialization', baseUrl = 'http://initialization.invalid';
async function fixture() {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-runner-initialization-')); directories.push(workingDirectory);
  const state = join(workingDirectory, textDigest(baseUrl)); await mkdir(state);
  const signal = new AbortController(), notices: RunnerNotice[] = [], requests: { path: string; input: Record<string, unknown> }[] = [];
  let respond = (path: string, input: Record<string, unknown>): Response => {
    if (path.endsWith('/identity')) return Response.json({ protocol: 'flow.runner-claim.v2', runnerId });
    if (path.endsWith('/status')) return Response.json({ ...input, state: 'missing' });
    if (path.endsWith('/claim-opportunity')) return Response.json({ ...input, state: 'empty' });
    throw new Error('Unexpected synthetic request: ' + path);
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname, input = JSON.parse(String(options.body ?? '{}'));
    requests.push({ path, input }); return respond(path, input);
  }));
  return { state, signal, notices, requests,
    respond(fn: typeof respond) { respond = fn; },
    async seed(value: unknown) { await writeFile(join(state, 'admission.json'), JSON.stringify(value)); },
    run(extra: Partial<RunnerOptions> = {}) { return runRunner({ baseUrl, token: 'synthetic', workingDirectory, signal: signal.signal,
      pollIntervalMs: 1, requestTimeoutMs: 200, adapters: [{ name: 'fixture', version: '1', async run() { throw new Error('No adapter may run.'); } }],
      onNotice: notice => { notices.push(notice); if (notice.type !== 'runtime-initialized') signal.abort(); }, ...extra }); },
  };
}

it('emits one local initialization before natural polling without an extra claim or journal key', async () => {
  const f = await fixture(); let claims = 0;
  f.respond((path, input) => {
    if (path.endsWith('/identity')) return Response.json({ protocol: 'flow.runner-claim.v2', runnerId });
    expect(f.notices).toEqual([{ type: 'runtime-initialized', runnerId }]);
    if (path.endsWith('/status')) return Response.json({ ...input, state: 'missing' });
    if (++claims === 2) f.signal.abort();
    return Response.json({ ...input, state: 'empty' });
  });
  await f.run(); expect(claims).toBe(2);
  expect(f.requests.map(value => value.path)).toEqual(['/api/runner/identity', '/api/runner/claim-opportunity/status', '/api/runner/claim-opportunity', '/api/runner/claim-opportunity']);
  const journal = JSON.parse(await readFile(join(f.state, 'admission.json'), 'utf8'));
  expect(new Set(f.requests.slice(1).map(value => value.input.requestId))).toEqual(new Set([journal.opportunityId]));
});

it('initialization observer failure does not suppress polling or replace authentication failure', async () => {
  const f = await fixture(); let initialized = 0;
  f.respond(path => path.endsWith('/identity') ? Response.json({ protocol: 'flow.runner-claim.v2', runnerId })
    : Response.json({ error: { code: 'unauthorized', message: 'Synthetic revoked host' } }, { status: 401 }));
  await expect(f.run({ onNotice(notice) { if (notice.type === 'runtime-initialized') { initialized++; throw new Error('observer'); } } })).rejects.toMatchObject({ status: 401 });
  expect(initialized).toBe(1); expect(f.requests).toHaveLength(2);
});

it('does not initialize when identity authentication fails', async () => {
  const f = await fixture(); f.respond(() => Response.json({ error: { code: 'unauthorized', message: 'Synthetic' } }, { status: 401 }));
  await expect(f.run()).rejects.toMatchObject({ status: 401 }); expect(f.notices).toEqual([]); expect(f.requests).toHaveLength(1);
});

it('does not initialize when the journal belongs to another runner', async () => {
  const f = await fixture(); await f.seed({ version: 2, runnerId: 'other', opportunityId: randomUUID(), assignments: [] });
  await expect(f.run()).rejects.toBeInstanceOf(AdmissionStorageError); expect(f.notices).toEqual([]); expect(f.requests).toHaveLength(1);
});

it.each([
  { version: 1, inFlight: randomUUID(), assignments: [] },
  { version: 2, runnerId, opportunityId: randomUUID(), assignments: [{ taskId: 'task', attemptId: 'attempt', runnerId, ownerVersion: 1 }] },
])('does not initialize across unresolved legacy intent or accepted assignment %#', async original => {
  const f = await fixture(); await f.seed(original); await f.run();
  expect(f.notices.map(value => value.type)).toEqual(['admission-blocked']); expect(f.requests).toHaveLength(1);
  expect(JSON.parse(await readFile(join(f.state, 'admission.json'), 'utf8'))).toEqual(original);
});

it('does not initialize before final proposal recovery is known', async () => {
  const f = await fixture(), attempt = join(f.state, 'a'.repeat(64)); await mkdir(attempt);
  await writeFile(join(attempt, 'pending-final-proposal.json'), '{'); await f.run();
  expect(f.notices.map(value => value.type)).toEqual(['connection-lost']); expect(f.requests).toHaveLength(1);
});

it('does not initialize before explicit body support confirmation succeeds', async () => {
  const f = await fixture(); f.respond(path => path.endsWith('/identity') ? Response.json({ protocol: 'flow.runner-claim.v2', runnerId }) : Response.json({}, { status: 500 }));
  await f.run({ nativeActivityBodies: true }); expect(f.notices.map(value => value.type)).toEqual(['connection-lost']);
  expect(f.requests.some(value => value.path.includes('claim-opportunity'))).toBe(false);
});

it('does not initialize before explicit plugin host publication succeeds', async () => {
  const f = await fixture();
  await f.run({ pluginExecution: { store: { root: f.state, storeId: 'synthetic', allowedDigests: [] }, transport: () => ({
    async publishHost() { throw new Error('Synthetic unknown publication'); },
    async claim() { throw new Error('Unexpected claim'); }, async status() { throw new Error('Unexpected status'); }, async authorize() { throw new Error('Unexpected authorization'); },
  }) } });
  expect(f.notices.map(value => value.type)).toEqual(['connection-lost']); expect(f.requests).toHaveLength(1);
});

it('already aborted input publishes no initialization and sends no request', async () => {
  const f = await fixture(); f.signal.abort(); await f.run(); expect(f.notices).toEqual([]); expect(f.requests).toEqual([]);
});

it('main forwards only the typed initialization on its parent IPC channel', async () => {
  const sent: unknown[] = [], previous = Object.getOwnPropertyDescriptor(process, 'send');
  Object.defineProperty(process, 'send', { configurable: true, value: (message: unknown, done: () => void) => { sent.push(message); done(); return true; } });
  vi.doMock('./runtime.js', () => ({ runRunner: async (options: RunnerOptions) => { options.onNotice?.({ type: 'runtime-initialized', runnerId }); } }));
  vi.doMock('./protocol-dispatch/index.js', () => ({ loadProtocolEndpoints() { throw new Error('Unexpected protocol configuration'); }, runProtocolRunner() { throw new Error('Unexpected protocol runner'); } }));
  vi.doMock('./configuration.js', () => ({ loadCodexProductionRunnerConfiguration() { throw new Error('Unexpected Codex'); },
    loadPluginExecutionConfiguration: async () => undefined,
    loadRunnerConfiguration: async () => ({ harnesses: [], activeSteering: false }) }));
  try {
    await import('./main.js');
    expect(sent).toEqual([{ protocol: 'flow.runner-startup.v1', type: 'runtime-initialized', runnerId }]);
  } finally {
    if (previous) Object.defineProperty(process, 'send', previous); else Reflect.deleteProperty(process, 'send');
    vi.doUnmock('./runtime.js'); vi.doUnmock('./configuration.js'); vi.doUnmock('./protocol-dispatch/index.js');
  }
});
