import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CodexTransport, Inbound, Json } from '../codex/types.js';
import { runCodexExchange } from '../native-harness/codex/exchange.js';
import { prepareTrustedToolHost, TrustedToolHostPreparationError, type TrustedToolHostPorts } from './native-tool-host.js';
import { openCalculatorToolFile, type CalculatorToolFile, type TrustedToolBinding } from './native-tool-writer.js';
import type { DarwinReadOnlyHost } from './native-authority.js';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const freshSignal = () => new AbortController().signal;
const fixedBinding: TrustedToolBinding = { identity: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 },
  leaseId: '5b647dc2-9b9d-4c5c-9fd3-79a6d1b0a0f8', baseCommit: 'a'.repeat(40), generation: 1 };
const args = { expectedSha256: digest('old'), contentsBase64: 'bmV3' };
const started = { type: 'dynamicToolCall', id: 'call', tool: 'flow_calculator_update', arguments: args, status: 'inProgress' };
const params = { threadId: 'thread', turnId: 'turn', callId: 'call', tool: 'flow_calculator_update', arguments: args };
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function options(overrides: Partial<Parameters<typeof prepareTrustedToolHost>[0]> = {}) {
  return { directory: '/fixture', runtimeDirectory: '/runtime', startupRecipe: 'injected only', model: 'gpt-6-astra' as const,
    prompt: 'Injected native tool call', binding: fixedBinding, signal: freshSignal(), async assertOwnership() {}, ...overrides };
}
function memory() {
  let value = 'old', writes = 0, closes = 0;
  const target: CalculatorToolFile = { identity: { path: '/fixture/calculator.mjs', device: '1', inode: '2' },
    async read() { return Buffer.from(value); }, async replace(bytes) { value = Buffer.from(bytes).toString(); writes++; }, async close() { closes++; } };
  return { target, get writes() { return writes; }, get closes() { return closes; } };
}
function native(port?: CodexTransport) {
  let closes = 0, launches = 0;
  const host: DarwinReadOnlyHost = { policySha256: '1'.repeat(64), createTransport() { launches++; if (!port) throw Error('No native launch in this case'); return port; },
    async close() { closes++; return { policySha256: '1'.repeat(64), child: launches ? 'confirmed-exited' : 'not-started', writeAccess: 'unknown' }; } };
  return { host, get closes() { return closes; }, get launches() { return launches; } };
}
function ports(n: ReturnType<typeof native>, file: CalculatorToolFile): TrustedToolHostPorts { return { async prepareNative() { return n.host; }, async openTarget() { return file; } }; }
function bind(host: Awaited<ReturnType<typeof prepareTrustedToolHost>>) {
  host.recipe.evidence.bindThread('thread'); host.recipe.evidence.bindTurn({ id: 'turn', items: [] });
  host.recipe.evidence.accept({ method: 'item/started', params: { threadId: 'thread', turnId: 'turn', item: started } });
}
async function preparationFailure(operation: ReturnType<typeof prepareTrustedToolHost>) {
  try { await operation; throw Error('Preparation unexpectedly succeeded'); }
  catch (error) { expect(error).toBeInstanceOf(TrustedToolHostPreparationError); if (!(error instanceof TrustedToolHostPreparationError)) throw error; return error; }
}
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true }); });
function peer() {
  const queue: Inbound[] = []; let waiting: ((m: Inbound | null) => void) | undefined, stopped = false, replies = 0;
  const ended = deferred<Awaited<ReturnType<CodexTransport['close']>>>();
  function emit(m: Inbound) { if (waiting) { const resolve = waiting; waiting = undefined; resolve(m); } else queue.push(m); }
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent: 'injected', platformFamily: 'test', platformOs: 'test' }), closed: ended.promise,
    async request(method): Promise<Json> {
      if (method === 'thread/start') return { thread: { id: 'thread' }, model: 'gpt-6-astra', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
      expect(method).toBe('turn/start');
      emit({ kind: 'notification', method: 'item/started', params: { threadId: 'thread', turnId: 'turn', item: started } });
      emit({ kind: 'server-request', id: 'rpc', method: 'item/tool/call', params });
      return { turn: { id: 'turn', status: 'inProgress', error: null, itemsView: 'full', items: [] } };
    },
    async receive() { if (queue.length) return queue.shift()!; if (stopped) return null; expect(waiting).toBeUndefined(); return new Promise(resolve => { waiting = resolve; }); },
    async respond(id, reply) {
      expect(id).toBe('rpc'); replies++;
      if (!('result' in reply) || !reply.result || typeof reply.result !== 'object' || Array.isArray(reply.result)) throw Error('Missing host reply');
      const item = { ...started, status: 'completed', success: true, contentItems: reply.result.contentItems! };
      const final = { type: 'agentMessage', id: 'final', phase: 'final_answer', delivery: null, questions: null, text: 'Updated.' };
      for (const value of [item, final]) emit({ kind: 'notification', method: 'item/completed', params: { threadId: 'thread', turnId: 'turn', item: value, completedAtMs: 1 } });
      emit({ kind: 'notification', method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null, itemsView: 'full', items: [item, final] } } });
    },
    async close() { stopped = true; waiting?.(null); waiting = undefined; const report = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const }; ended.resolve(report); return report; },
    snapshot() { throw Error('Unused injected snapshot'); },
  };
  return { port, get replies() { return replies; } };
}

test('ENG01L composes the real private file with the existing exchange and injected readonly transport', async () => {
  const directory = await realpath(await mkdtemp(join(process.env.FLOW_ENG01L_TMP ?? tmpdir(), 'tool-host-'))); roots.push(directory);
  await writeFile(join(directory, 'calculator.mjs'), 'old'); await writeFile(join(directory, 'baseline.txt'), 'untouched');
  const p = peer(), n = native(p.port); let ownership = 0;
  const host = await prepareTrustedToolHost(options({ directory, async assertOwnership(binding) { expect(binding).toEqual(fixedBinding); ownership++; } }), {
    async prepareNative(input) { expect(input.directory).toBe(directory); return n.host; }, openTarget: openCalculatorToolFile,
  });
  try {
    const result = await runCodexExchange(host.createTransport, { signal: freshSignal(), workingDirectory: directory, async assertOwnership() {} },
      { wallTimeMs: 500, maxOutputBytes: 1024 }, host.recipe);
    expect(result.observation.state).toBe('completed'); expect(p.replies).toBe(1); expect(ownership).toBe(5);
    expect(await readFile(join(directory, 'calculator.mjs'), 'utf8')).toBe('new');
    expect(await readFile(join(directory, 'baseline.txt'), 'utf8')).toBe('untouched');
    expect(() => host.createTransport({ signal: freshSignal(), workingDirectory: directory })).toThrow();
  } finally {
    expect(await host.close(freshSignal())).toEqual({ child: 'confirmed-exited', hostWrite: 'settled', nativeWriteAccess: 'unknown' }); await p.port.close();
  }
});

test('ENG01L rejects stale initial ownership without opening a target or native host', async () => {
  let calls = 0;
  const failed = await preparationFailure(prepareTrustedToolHost(options({ async assertOwnership() { throw Error('stale lease'); } }), {
    async prepareNative() { calls++; throw Error('unused'); }, async openTarget() { calls++; throw Error('unused'); },
  }));
  expect(calls).toBe(0); expect(await failed.close(freshSignal())).toEqual({ child: 'not-started', hostWrite: 'settled', nativeWriteAccess: 'unknown' });
});

test('ENG01L cancellation after native preparation closes it without acquiring the write FD', async () => {
  const n = native(), abort = new AbortController(); let opens = 0;
  const failed = await preparationFailure(prepareTrustedToolHost(options({ signal: abort.signal }), {
    async prepareNative() { abort.abort(); return n.host; }, async openTarget() { opens++; throw Error('unused'); },
  }));
  expect((await failed.close(freshSignal())).hostWrite).toBe('settled'); expect(opens).toBe(0); expect(n.closes).toBe(1);
});

test('ENG01L ownership lost after opening the target closes both partial resources', async () => {
  const n = native(), m = memory(); let ownership = 0;
  const failed = await preparationFailure(prepareTrustedToolHost(options({ async assertOwnership() { if (++ownership === 3) throw Error('lost'); } }), ports(n, m.target)));
  expect(await failed.close(freshSignal())).toMatchObject({ child: 'not-started', hostWrite: 'settled' });
  expect(n.closes).toBe(1); expect(m.closes).toBe(1); expect(m.writes).toBe(0);
});

test('ENG01L wrong target and FD close failure retain a preparation error with unknown cleanup', async () => {
  const n = native(), m = memory();
  const failed = await preparationFailure(prepareTrustedToolHost(options(), ports(n, { ...m.target,
    identity: { ...m.target.identity, path: '/other/calculator.mjs' }, async close() { throw Error('close unknown'); } })));
  expect(await failed.close(freshSignal())).toMatchObject({ child: 'not-started', hostWrite: 'unknown', nativeWriteAccess: 'unknown' }); expect(m.writes).toBe(0);
});

test('ENG01L late ownership cannot write after close has sealed admission', async () => {
  const n = native(), m = memory(), waiting = deferred<void>(), entered = deferred<void>(); let armed = false;
  const host = await prepareTrustedToolHost(options({ async assertOwnership() { if (armed) { entered.resolve(); await waiting.promise; } } }), ports(n, m.target)); bind(host); armed = true;
  const response = host.recipe.respond('item/tool/call', params, freshSignal()); await entered.promise;
  const closing = host.close(freshSignal()); waiting.resolve(); expect((await response).allowed).toBe(false);
  expect((await closing).hostWrite).toBe('settled'); expect(m.writes).toBe(0); expect(m.closes).toBe(1);
});

test('ENG01L confirmed child close does not settle held file write or FD close', async () => {
  const n = native(), m = memory(), entered = deferred<void>(), write = deferred<void>(), fd = deferred<void>();
  const host = await prepareTrustedToolHost(options(), ports(n, { ...m.target,
    async replace(bytes) { entered.resolve(); await write.promise; await m.target.replace(bytes); }, async close() { await fd.promise; await m.target.close(); } })); bind(host);
  const response = host.recipe.respond('item/tool/call', params, freshSignal()); await entered.promise;
  let settled = false; const closing = host.close(freshSignal()).then(value => { settled = true; return value; });
  await Promise.resolve(); expect(n.closes).toBe(1); expect(settled).toBe(false);
  write.resolve(); expect((await response).allowed).toBe(true); await Promise.resolve(); expect(settled).toBe(false); expect(m.closes).toBe(0);
  fd.resolve(); expect((await closing).hostWrite).toBe('settled'); expect(m.writes).toBe(1); expect(m.closes).toBe(1);
});

test('ENG01L cancelled close keeps unknown and retains the real pending drain exactly once', async () => {
  const n = native(), m = memory(), entered = deferred<void>(), held = deferred<void>();
  const host = await prepareTrustedToolHost(options(), ports(n, { ...m.target, async replace(bytes) { entered.resolve(); await held.promise; await m.target.replace(bytes); } })); bind(host);
  const response = host.recipe.respond('item/tool/call', params, freshSignal()); await entered.promise;
  const abort = new AbortController(), stop = host.close(abort.signal); abort.abort();
  expect(await stop).toEqual({ child: 'unconfirmed', hostWrite: 'unknown', nativeWriteAccess: 'unknown' }); expect(m.closes).toBe(0);
  expect(() => host.createTransport({ signal: freshSignal(), workingDirectory: '/fixture' })).toThrow();
  held.resolve(); await response; expect((await host.close(freshSignal())).hostWrite).toBe('unknown'); expect(n.closes).toBe(1); expect(m.closes).toBe(1);
});

test('ENG01L native close failure stays separate while the host FD still closes', async () => {
  const n = native(), m = memory(); n.host.close = async () => { throw Error('native unknown'); };
  const host = await prepareTrustedToolHost(options(), ports(n, m.target));
  expect(await host.close(freshSignal())).toEqual({ child: 'unconfirmed', hostWrite: 'settled', nativeWriteAccess: 'unknown' }); expect(m.closes).toBe(1);
});

test('ENG01L freezes binding before asynchronous preparation and refuses a changed launch cwd', async () => {
  const n = native(), m = memory(), enter = deferred<void>(), release = deferred<void>();
  const mutable = { ...fixedBinding, identity: { ...fixedBinding.identity } };
  const pending = prepareTrustedToolHost(options({ binding: mutable, async assertOwnership(b) { expect(b.identity.taskId).toBe('task'); } }), {
    ...ports(n, m.target), async prepareNative() { enter.resolve(); await release.promise; return n.host; },
  });
  await enter.promise; mutable.identity.taskId = 'other'; release.resolve(); const host = await pending;
  expect(() => host.createTransport({ signal: freshSignal(), workingDirectory: '/different' })).toThrow();
  expect(() => host.createTransport({ signal: freshSignal(), workingDirectory: '/fixture' })).toThrow(); expect(n.launches).toBe(0);
  expect((await host.close(freshSignal())).hostWrite).toBe('settled');
});
