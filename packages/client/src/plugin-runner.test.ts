import { FlowClient, FlowApiError } from './index.js';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { PluginRunnerClient, type PluginJsonRequest } from './plugin-runner.js';
import type { PluginRunnerClaimRequest } from '../../contracts/src/plugin-runner-claim.js';
const request = (): PluginRunnerClaimRequest => ({ protocol: 'flow.runner-claim.v3', runnerId: randomUUID(), requestId: randomUUID(),
  pluginToolExecution: { bindingProtocol: 'flow.plugin-runtime.v1', storeId: 'owned', hostApiMajor: 1 } });
test('claim snapshots the complete request before awaiting the shared transport', async () => {
  const input = request(), original = structuredClone(input); let release!: (value: unknown) => void;
  const transport = vi.fn<PluginJsonRequest>(() => new Promise(resolve => { release = resolve; }));
  const pending = new PluginRunnerClient(transport).claim(input); input.pluginToolExecution.storeId = 'changed';
  release({ ...original, state: 'empty' }); expect(await pending).toEqual({ ...original, state: 'empty' });
  expect(JSON.parse(transport.mock.calls[0]![1].body as string)).toEqual(original);
  expect(transport.mock.calls[0]![2]).toBe(131072);
});
test('status rejects a claim-only ACK and changed qualification without retry', async () => {
  const input = request(); const transport = vi.fn<PluginJsonRequest>(async () => ({ ...input, state: 'empty' }));
  await expect(new PluginRunnerClient(transport).status(input)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
  transport.mockResolvedValue({ ...input, pluginToolExecution: { ...input.pluginToolExecution, storeId: 'wrong' }, state: 'empty' });
  await expect(new PluginRunnerClient(transport).claim(input)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(2);
});
test('publication requires the exact explicit ACK', async () => {
  const transport = vi.fn<PluginJsonRequest>(async (): Promise<unknown> => ({ published: true, extra: true }));
  const client = new PluginRunnerClient(transport), input = { protocol: 'flow.plugin-runtime.v1' as const, storeId: 'owned', hostApiMajor: 1 as const };
  await expect(client.publishHost(input)).rejects.toThrow(); transport.mockResolvedValue({ published: true });
  await expect(client.publishHost(input)).resolves.toBeUndefined(); expect(transport.mock.calls[0]![2]).toBe(1024);
});
test('phase request preserves stable key and rejects a changed ownership ACK', async () => {
  const input = { attemptId: randomUUID(), ownerVersion: 1, bindingId: randomUUID(), invocationId: randomUUID(), phase: 'load' as const };
  const transport = vi.fn<PluginJsonRequest>(async () => ({ ...input, protocol: 'flow.plugin-runtime.v1', taskId: randomUUID(), runnerId: randomUUID(), authorizedRevision: 1, replayed: false, ownerVersion: 2 }));
  await expect(new PluginRunnerClient(transport).authorize(input, 'a'.repeat(64))).rejects.toThrow();
  expect(transport.mock.calls[0]![1].headers).toEqual({ 'Idempotency-Key': 'a'.repeat(64) }); expect(transport).toHaveBeenCalledTimes(1);
});

afterEach(() => { vi.unstubAllGlobals(); });
test('FlowClient domain uses the same bearer transport and bounded decoder', async () => {
  const input = request(); const calls: RequestInit[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init!); return new Response(JSON.stringify({ ...input, state: 'empty' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'owned-token' });
  expect(await client.pluginRunner.claim(input)).toMatchObject({ state: 'empty' });
  expect(new Headers(calls[0]!.headers).get('authorization')).toBe('Bearer owned-token');
  expect(calls[0]!.credentials).toBe('omit'); expect(client.pluginRunner).toBe(client.pluginRunner);
});
test('FlowClient domain reads current browser CSRF and preserves its one error class', async () => {
  let csrf = 'a'.repeat(64); const seen: Headers[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    seen.push(new Headers(init!.headers)); return new Response(JSON.stringify({ published: true }), { status: 200 });
  }));
  const client = new FlowClient({ baseUrl: 'http://fixture.invalid', browserSession: { csrfToken: () => csrf } });
  const input = { protocol: 'flow.plugin-runtime.v1' as const, storeId: 'owned', hostApiMajor: 1 as const };
  await client.pluginRunner.publishHost(input); csrf = 'b'.repeat(64); await client.pluginRunner.publishHost(input);
  expect([...seen[0]!.values()]).toContain('a'.repeat(64)); expect([...seen[1]!.values()]).toContain('b'.repeat(64));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'runner_required', message: 'Denied' }), { status: 401 })));
  await expect(client.pluginRunner.publishHost(input)).rejects.toBeInstanceOf(FlowApiError);
});
test('shared request preserves cancellation and rejects an oversized plugin response', async () => {
  const abort = new AbortController(); const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'owned-token' });
  const fetch = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('cancelled by original signal')), { once: true });
  })); vi.stubGlobal('fetch', fetch);
  const input = { protocol: 'flow.plugin-runtime.v1' as const, storeId: 'owned', hostApiMajor: 1 as const };
  const pending = client.pluginRunner.publishHost(input, abort.signal); abort.abort();
  await expect(pending).rejects.toThrow('cancelled by original signal'); expect(fetch).toHaveBeenCalledTimes(1);
  const oversized = vi.fn(async () => new Response('x'.repeat(1025), { status: 200, headers: { 'content-length': '1025' } }));
  vi.stubGlobal('fetch', oversized); await expect(client.pluginRunner.publishHost(input)).rejects.toThrow();
  expect(oversized).toHaveBeenCalledTimes(1);
});

test('AV03 center FlowClient sends detached v4 through one bounded authenticated request', async () => {
  const input = { protocol: 'flow.runner-claim.v4' as const, runnerId: randomUUID(), requestId: randomUUID(),
    pluginVerifierExecution: { bindingProtocol: 'flow.plugin-verification.v1' as const, storeId: 'owned', hostApiMajor: 1 as const,
      algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] } };
  const original = structuredClone(input); let release!: (value: Response) => void;
  const fetch = vi.fn((_url: unknown, _init?: RequestInit) => new Promise<Response>(resolve => { release = resolve; })); vi.stubGlobal('fetch', fetch);
  const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'owned-token' });
  const pending = client.pluginRunner.claimVerifier(input); input.pluginVerifierExecution.storeId = 'changed';
  release(new Response(JSON.stringify({ ...original, state: 'empty' })));
  expect(await pending).toEqual({ ...original, state: 'empty' }); expect(fetch).toHaveBeenCalledTimes(1);
  const init = fetch.mock.calls[0]![1]!;
  expect(JSON.parse(String(init.body))).toEqual(original); expect(new Headers(init.headers).get('authorization')).toBe('Bearer owned-token');
});
test('AV03 center v4 unknown ACK and cancellation do not resend', async () => {
  const input = { protocol: 'flow.runner-claim.v4' as const, runnerId: randomUUID(), requestId: randomUUID(),
    pluginVerifierExecution: { bindingProtocol: 'flow.plugin-verification.v1' as const, storeId: 'owned', hostApiMajor: 1 as const,
      algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] } };
  const transport = vi.fn<PluginJsonRequest>(async () => ({ ...input, state: 'empty' }));
  await expect(new PluginRunnerClient(transport).statusVerifier(input)).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
  const abort = new AbortController(); transport.mockImplementation(async (_path, init) => {
    expect(init.signal).toBe(abort.signal); throw new DOMException('Cancelled', 'AbortError');
  }); abort.abort();
  await expect(new PluginRunnerClient(transport).claimVerifier(input, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(transport).toHaveBeenCalledTimes(2);
});


const phaseInput = () => ({ attemptId: randomUUID(), ownerVersion: 1, bindingId: randomUUID(), invocationId: randomUUID(), phase: 'load' as const });
const phaseReceipt = (input: ReturnType<typeof phaseInput> | (Omit<ReturnType<typeof phaseInput>, 'phase'> & { phase: 'invoke' })) => ({
  ...input, protocol: 'flow.plugin-runtime.v1' as const, taskId: randomUUID(), runnerId: randomUUID(), authorizedRevision: 1, replayed: false,
});

test.each([
  ['tool', 'load'], ['tool', 'invoke'], ['verifier', 'load'], ['verifier', 'invoke'],
] as const)('verifier phase client preserves %s %s endpoint key and receipt through FlowClient', async (kind, phase) => {
  const input = { ...phaseInput(), phase }, receipt = phaseReceipt(input), key = 'd'.repeat(64);
  const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify(receipt), { status: 200 })); vi.stubGlobal('fetch', fetch);
  const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'runner-token' });
  const result = kind === 'tool' ? await client.pluginRunner.authorize(input, key) : await client.pluginRunner.authorizeVerifier(input, key);
  expect(result).toEqual(receipt); expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`http://fixture.invalid/api/runner/plugin-${kind}/authorize`);
  expect(init.method).toBe('POST'); expect(init.credentials).toBe('omit');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer runner-token');
  expect(new Headers(init.headers).get('idempotency-key')).toBe(key); expect(JSON.parse(String(init.body))).toEqual(input);
});

test('verifier phase client snapshots input and forwards its exact signal and byte budget', async () => {
  const input = phaseInput(), expected = structuredClone(input), abort = new AbortController(); let resolve!: (value: unknown) => void;
  const transport = vi.fn<PluginJsonRequest>(() => new Promise(done => { resolve = done; }));
  const pending = new PluginRunnerClient(transport).authorizeVerifier(input, 'a'.repeat(64), abort.signal);
  input.ownerVersion = 2; input.bindingId = randomUUID(); resolve(phaseReceipt(expected));
  expect(await pending).toMatchObject(expected); expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0]![1].signal).toBe(abort.signal); expect(transport.mock.calls[0]![2]).toBe(65536);
  expect(JSON.parse(String(transport.mock.calls[0]![1].body))).toEqual(expected);
});

test('verifier phase client rejects invalid input or unstable key before transport', async () => {
  const transport = vi.fn<PluginJsonRequest>(), client = new PluginRunnerClient(transport);
  await expect(client.authorizeVerifier({ ...phaseInput(), ownerVersion: 0 }, 'a'.repeat(64))).rejects.toThrow();
  for (const key of ['', 'A'.repeat(64), 'a'.repeat(63)]) await expect(client.authorizeVerifier(phaseInput(), key)).rejects.toThrow('stable identity key');
  expect(transport).not.toHaveBeenCalled();
});

test('verifier phase client treats mismatched or malformed ACK as unknown without retry', async () => {
  const input = phaseInput(), receipt = phaseReceipt(input);
  const variants = [ { attemptId: randomUUID() }, { ownerVersion: 2 }, { bindingId: randomUUID() },
    { invocationId: randomUUID() }, { phase: 'invoke' }, { protocol: 'foreign' }, { authorizedRevision: -1 } ];
  for (const delta of variants) {
    const transport = vi.fn<PluginJsonRequest>(async () => ({ ...receipt, ...delta }));
    await expect(new PluginRunnerClient(transport).authorizeVerifier(input, 'b'.repeat(64))).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  }
});

test('verifier phase client preserves original cancellation through the shared transport', async () => {
  const abort = new AbortController();
  const fetch = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  })); vi.stubGlobal('fetch', fetch);
  const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'runner-token' });
  const pending = client.pluginRunner.authorizeVerifier(phaseInput(), 'c'.repeat(64), abort.signal); abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(fetch).toHaveBeenCalledTimes(1);
});

test('verifier phase client refuses response bytes over 65536 without retry', async () => {
  const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response('x'.repeat(65537), { status: 200, headers: { 'content-length': '65537' } }));
  vi.stubGlobal('fetch', fetch); const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'runner-token' });
  await expect(client.pluginRunner.authorizeVerifier(phaseInput(), 'c'.repeat(64))).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(1);
});

test('verifier phase client preserves typed denial and never falls back to tool', async () => {
  const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ code: 'plugin_verifier_grant_required', message: 'Denied' }), { status: 403 }));
  vi.stubGlobal('fetch', fetch); const client = new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'runner-token' });
  await expect(client.pluginRunner.authorizeVerifier(phaseInput(), 'c'.repeat(64))).rejects.toBeInstanceOf(FlowApiError);
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0]![0]).toBe('http://fixture.invalid/api/runner/plugin-verifier/authorize');
});
