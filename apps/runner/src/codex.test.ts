import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCodexTransport, type TransportOptions } from './codex/index.js';
const fixture = fileURLToPath(new URL('./codex/fixtures/peer.mjs', import.meta.url));
const directories: string[] = [];
const children: ReturnType<typeof createCodexTransport>[] = [];
afterEach(async () => {
  const reports = await Promise.all(children.splice(0).map(child => child.close()));
  for (const report of reports) expect(report.child).toBe('confirmed-exited');
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});
async function open(mode = 'normal', overrides: Partial<TransportOptions> = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'flow-r06-'));
  directories.push(cwd);
  const transport = createCodexTransport({ spawn: { executable: process.execPath, args: [fixture, mode], cwd, environment: { LANG: 'C' } },
    initialize: { clientInfo: { name: 'flow-r06-test', title: null, version: '1' }, capabilities: null }, ...overrides });
  children.push(transport);
  return transport;
}
test('initializes the owned peer before exposing readiness, without returning private codexHome', async () => {
  const transport = await open();
  await expect(transport.ready).resolves.toEqual({ userAgent: 'synthetic/1', platformFamily: 'unix', platformOs: 'test' });
  await expect(transport.receive()).resolves.toEqual({ kind: 'notification', method: 'synthetic/ready', params: { initialized: true } });
});

async function connected(mode = 'normal', overrides: Partial<TransportOptions> = {}) {
  const transport = await open(mode, overrides); await transport.ready; await transport.receive(); return transport;
}
test('correlates three responses out of order and ignores duplicate settled responses', async () => {
  const transport = await connected();
  expect(await Promise.all([1, 2, 3].map(n => transport.request('reorder', n)))).toEqual([1, 2, 3]);
  expect(await transport.request('duplicate', null)).toBe('first');
  await transport.request('echo', null);
  expect(transport.snapshot().ignoredResponses).toBe(1);
});
test('reassembles Chinese and emoji split at every UTF8 byte', async () => {
  const transport = await connected(); expect(await transport.request('unicode', null)).toBe('中文🙂🌍');
});
test('remote error has a distinct outcome but never leaks raw diagnostic content', async () => {
  const transport = await connected();
  const error = await transport.request('remote-error', null).catch(error => error);
  expect(error).toMatchObject({ code: 'REMOTE_ERROR', delivery: 'remote-error', rpcCode: -32001 });
  expect(JSON.stringify(error)).not.toContain('SECRET_MARKER'); expect(error.message).not.toContain('SECRET_MARKER');
});
test('request abort before enqueue is not sent, and abort after receipt is unknown without closing the connection', async () => {
  const transport = await connected(); const before = new AbortController(); before.abort();
  await expect(transport.request('echo', null, { signal: before.signal })).rejects.toMatchObject({ code: 'ABORTED', delivery: 'not-sent' });
  const after = new AbortController(); const pending = transport.request('stall', null, { signal: after.signal });
  const check = expect(pending).rejects.toMatchObject({ code: 'ABORTED', delivery: 'unknown' });
  expect(await transport.receive()).toMatchObject({ method: 'synthetic/received' }); after.abort(); await check;
  expect(await transport.request('echo', 'still-live')).toEqual({ initialized: true, value: 'still-live' });
});
test('timeout is unknown after write and a late response cannot satisfy a new request', async () => {
  const transport = await connected();
  await expect(transport.request('delayed', null, { timeoutMs: 15 })).rejects.toMatchObject({ code: 'TIMEOUT', delivery: 'unknown' });
  expect(await transport.request('echo', 'during-late')).toEqual({ initialized: true, value: 'during-late' });
  await new Promise(resolve => setTimeout(resolve, 80));
  expect(await transport.request('echo', 'new')).toEqual({ initialized: true, value: 'new' });
  expect(transport.snapshot().ignoredResponses).toBe(1);
});
test('server requests require explicit delivery before response and preserve number/string identity', async () => {
  const transport = await connected(); await transport.request('server-request', null);
  await expect(transport.respond('approval-1', { result: true })).rejects.toMatchObject({ delivery: 'not-sent' });
  expect(await transport.receive()).toMatchObject({ kind: 'server-request', id: 'approval-1' });
  expect(await transport.receive()).toMatchObject({ kind: 'server-request', id: 1 });
  await transport.respond('approval-1', { result: 'allowed' }); await transport.respond(1, { error: { code: -1, message: 'Denied' } });
  expect(await transport.receive()).toMatchObject({ method: 'synthetic/replied', params: { id: 'approval-1', result: 'allowed' } });
  expect(await transport.receive()).toMatchObject({ params: { id: 1, error: { code: -1 } } });
  await expect(transport.respond(1, { result: true })).rejects.toMatchObject({ delivery: 'not-sent' });
});
test.each(['invalid-json', 'invalid-utf8', 'truncated', 'future-id', 'wrong-id-type', 'duplicate-server'])('%s is a terminal protocol failure, never success', async method => {
  const transport = await connected();
  await expect(transport.request(method, null)).rejects.toMatchObject({ code: 'PROTOCOL', delivery: 'unknown' });
  expect(await transport.closed).toMatchObject({ reason: 'PROTOCOL', child: 'confirmed-exited', remoteEffects: 'unknown' });
});
test('no-newline oversized stdout fails at the byte limit', async () => {
  const transport = await connected('normal', { limits: { frameBytes: 1024 } });
  await expect(transport.request('long-line', { bytes: 1025 })).rejects.toMatchObject({ code: 'LIMIT', delivery: 'unknown' });
  expect((await transport.closed).reason).toBe('LIMIT');
});
test('bounded inbound backlog fails rather than dropping notifications', async () => {
  const transport = await connected('normal', { limits: { inboundFrames: 3 } });
  await expect(transport.request('flood', { count: 4, size: 5 })).rejects.toMatchObject({ code: 'LIMIT' });
  expect((await transport.closed).reason).toBe('LIMIT');
  expect(transport.snapshot().inboundFrames).toBe(3);
  for (let i = 0; i < 3; i++) expect(await transport.receive()).toMatchObject({ params: { i } });
  expect(await transport.receive()).toBeNull();
});
test('pending requests and duplicate consumers are explicitly bounded', async () => {
  const transport = await connected('normal', { limits: { pendingRequests: 1 } });
  const first = transport.request('stall', null); const firstCheck = expect(first).rejects.toMatchObject({ delivery: 'unknown' });
  await transport.receive(); await expect(transport.request('echo', null)).rejects.toMatchObject({ code: 'LIMIT', delivery: 'not-sent' });
  const waiting = transport.receive(); await expect(transport.receive()).rejects.toMatchObject({ code: 'CONCURRENT_RECEIVE' });
  await transport.close(); await firstCheck; expect(await waiting).toBeNull();
});
test('exit rejects every pending request and reports actual local exit without asserting remote stop', async () => {
  const transport = await connected();
  const pending = transport.request('stall', null); const check = expect(pending).rejects.toMatchObject({ delivery: 'unknown' });
  await transport.receive(); await expect(transport.request('exit', null)).rejects.toMatchObject({ delivery: 'unknown' });
  expect(await transport.closed).toMatchObject({ child: 'confirmed-exited', exitCode: 7, remoteEffects: 'unknown' }); await check;
});
test('close is bounded, idempotent and escalates only its own child that ignores TERM', async () => {
  const transport = await connected('ignore-term', { limits: { terminateMs: 30, killMs: 200 } });
  const first = transport.close(); expect(transport.close()).toBe(first);
  expect(await first).toMatchObject({ child: 'confirmed-exited', signal: 'SIGKILL', reason: 'CLOSED' });
});
test('stderr is drained but only its byte count is retained', async () => {
  const transport = await connected(); await transport.request('stderr', null);
  expect(transport.snapshot().stderrBytes).toBe(260_000);
  expect(JSON.stringify(transport.snapshot())).not.toContain('SECRET_MARKER');
});
test('initialization timeout and malformed response never expose ready', async () => {
  const transport = await open('init-stall', { limits: { initializeTimeoutMs: 30 } });
  await expect(transport.request('echo', null)).rejects.toMatchObject({ code: 'NOT_READY', delivery: 'not-sent' });
  await expect(transport.ready).rejects.toMatchObject({ code: 'TIMEOUT' }); await transport.closed;
  const malformed = await open('bad-init'); await expect(malformed.ready).rejects.toMatchObject({ code: 'PROTOCOL' }); await malformed.closed;
});

test('output backpressure keeps one active frame, permits queued cancellation, and respects byte budget', async () => {
  const transport = await connected('pause', { limits: { outboundBytes: 1_200_000, outboundFrames: 2, requestTimeoutMs: 250 } });
  const first = transport.request('echo', { text: 'a'.repeat(900_000) });
  const firstCheck = expect(first).rejects.toMatchObject({ delivery: 'unknown' });
  await Promise.resolve();
  const abort = new AbortController();
  const second = transport.request('echo', { text: 'b'.repeat(100_000) }, { signal: abort.signal });
  const secondCheck = expect(second).rejects.toMatchObject({ code: 'ABORTED', delivery: 'not-sent' });
  await expect(transport.request('echo', { text: 'c'.repeat(200_000) })).rejects.toMatchObject({ code: 'LIMIT', delivery: 'not-sent' });
  expect(transport.snapshot()).toMatchObject({ outboundFrames: 2 });
  expect(transport.snapshot().peakOutboundBytes).toBeLessThanOrEqual(1_200_000);
  abort.abort(); await secondCheck;
  expect(transport.snapshot().outboundFrames).toBe(1);
  await firstCheck; expect((await transport.closed).reason).toBe('TIMEOUT');
  console.log('R06 backpressure', JSON.stringify(transport.snapshot()));
});
test('explicit child environment excludes parent markers and rejects nonallowlisted keys before spawn', async () => {
  process.env.FLOW_R06_SYNTHETIC_SECRET = 'never-forward';
  try {
    const transport = await connected();
    const environment = await transport.request('environment', null) as { keys: string[]; lang: string };
    expect(environment.lang).toBe('C');
    // macOS may inject this runtime metadata even when spawn.env has only LANG.
    expect(environment.keys.filter(key => key !== '__CF_USER_TEXT_ENCODING')).toEqual(['LANG']);
    await expect(open('normal', { spawn: { executable: process.execPath, args: [fixture], cwd: tmpdir(), environment: { FLOW_R06_SYNTHETIC_SECRET: 'never-forward' } } })).rejects.toMatchObject({ code: 'INVALID_OPTIONS', delivery: 'not-sent' });
  } finally { delete process.env.FLOW_R06_SYNTHETIC_SECRET; }
});
test('lifetime abort closes the child, and abort before create never spawns it', async () => {
  const abort = new AbortController(); const transport = await connected('normal', { signal: abort.signal });
  abort.abort(); expect(await transport.closed).toMatchObject({ reason: 'ABORTED', child: 'confirmed-exited' });
  await expect(open('normal', { signal: abort.signal })).rejects.toMatchObject({ code: 'ABORTED', delivery: 'not-sent' });
});
test('spawn failure is sanitized and terminates readiness without an orphaned handle', async () => {
  const transport = await open('normal', { spawn: { executable: '/nonexistent/flow-r06-owned-executable', args: [], cwd: tmpdir(), environment: {} } });
  await expect(transport.ready).rejects.toMatchObject({ code: 'SPAWN_FAILED' });
  expect((await transport.closed).reason).toBe('SPAWN_FAILED');
});
test('inbound byte and outstanding server request budgets are independent of frame count', async () => {
  const bytes = await connected('normal', { limits: { inboundBytes: 200 } });
  await expect(bytes.request('flood', { count: 2, size: 30 })).rejects.toMatchObject({ code: 'LIMIT' }); await bytes.closed;
  expect(bytes.snapshot().peakInboundBytes).toBeLessThanOrEqual(200);
  const servers = await connected('normal', { limits: { serverRequests: 1 } });
  await expect(servers.request('server-request', null)).rejects.toMatchObject({ code: 'LIMIT' }); await servers.closed;
});
test('outgoing UTF8 byte limit rejects before any request is sent', async () => {
  const transport = await connected('normal', { limits: { frameBytes: 1024 } });
  await expect(transport.request('echo', '文'.repeat(400))).rejects.toMatchObject({ code: 'LIMIT', delivery: 'not-sent' });
  expect(await transport.request('echo', 'okay')).toEqual({ initialized: true, value: 'okay' });
});
test('invalid JSON-shaped inputs are rejected before write, preserving connection usability', async () => {
  const transport = await connected();
  await expect(transport.request('echo', { omitted: undefined } as never)).rejects.toMatchObject({ code: 'INVALID_OPTIONS', delivery: 'not-sent' });
  await expect(transport.respond('never-delivered', { result: true })).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  await expect(transport.request('echo', cyclic as never)).rejects.toMatchObject({ code: 'INVALID_OPTIONS', delivery: 'not-sent' });
  await expect(transport.request('echo', Number.NaN)).rejects.toMatchObject({ code: 'INVALID_OPTIONS', delivery: 'not-sent' });
  expect(await transport.request('echo', 1)).toEqual({ initialized: true, value: 1 });
});

test('nonenumerable toJSON cannot replace bounded outgoing data or execute itself', async () => {
  const transport = await connected(); let invoked = false;
  const value = { text: 'intended' };
  Object.defineProperty(value, 'toJSON', { value: () => { invoked = true; return 'wrong'; } });
  expect(await transport.request('echo', value)).toEqual({ initialized: true, value: { text: 'intended' } });
  expect(invoked).toBe(false);
  const getter = Object.defineProperty({}, 'payload', { enumerable: true, get: () => { throw new Error('must not run'); } });
  await expect(transport.request('echo', getter)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
});
test('16 concurrent real pipe requests preserve JSON scalars and release all request slots', async () => {
  const transport = await connected();
  const values = Array.from({ length: 16 }, (_, n) => ({ n, text: '中🙂'.repeat(128), okay: n % 2 === 0, nested: [null, '\n', -0, 1e-7] }));
  const responses = await Promise.all(values.map(value => transport.request('echo', value)));
  expect(responses).toEqual(values.map(value => ({ initialized: true, value: { ...value, nested: [null, '\n', 0, 1e-7] } })));
  expect(transport.snapshot()).toMatchObject({ pendingRequests: 0, outboundFrames: 0, outboundBytes: 0 });
});
test('unknown sent requests keep their concurrency reservation until reply or connection close', async () => {
  const transport = await connected('normal', { limits: { pendingRequests: 1 } });
  const abort = new AbortController();
  const pending = transport.request('stall', null, { signal: abort.signal });
  const check = expect(pending).rejects.toMatchObject({ code: 'ABORTED', delivery: 'unknown' });
  await transport.receive(); abort.abort(); await check;
  await expect(transport.request('echo', 'must-not-overcommit')).rejects.toMatchObject({ code: 'LIMIT', delivery: 'not-sent' });
  await transport.close();
});

test('late reply releases an unknown reservation exactly once without replay', async () => {
  const transport = await connected('normal', { limits: { pendingRequests: 1 } });
  await expect(transport.request('delayed', null, { timeoutMs: 15 })).rejects.toMatchObject({ delivery: 'unknown' });
  expect(transport.snapshot().unansweredRequests).toBe(1);
  await new Promise(resolve => setTimeout(resolve, 110));
  expect(transport.snapshot().unansweredRequests).toBe(0);
  expect(await transport.request('echo', 'next')).toEqual({ initialized: true, value: 'next' });
});
