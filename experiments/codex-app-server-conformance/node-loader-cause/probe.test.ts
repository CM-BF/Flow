import { it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runOwnedCommand } from '../fd-canary/command.mjs';
import { observeLoader } from './observe.mjs';
import { runCause, makeCauseBudget } from './host.mjs';
const repository = process.cwd();
const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const p of roots.splice(0)) fs.rmSync(p, { recursive: true, force: true }); });
const roles = [{ token: '@rpath/libnode.137.dylib', role: 'node-library' }];
function child() { return Object.assign(new EventEmitter(), { pid: 1234567, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), unref: vi.fn() }); }
const gone = () => { throw Object.assign(Error('synthetic'), { code: 'ESRCH' }); };
const options = { executable: '/fixed/owned', args: [], cwd: '/', environment: {}, stdio: 'pipe', timeoutMs: 1000 };
it('default cap preserves the legacy 65536 copied-byte consumer', async () => {
  const c = child(); let copied = 0;
  const done = runOwnedCommand(options, { consume(n: number) { copied += n; } }, { spawn: () => c, signal: gone });
  c.stdout.write(Buffer.alloc(9000)); c.stdout.end(); c.stderr.end(); await new Promise(r => setImmediate(r)); c.emit('close', 0, null);
  const r = await done; expect(copied).toBe(9000); expect(r.safe.streams.stdout.truncated).toBe(false); expect(r.safe).not.toHaveProperty('observationFailed');
});
it('counts full overflow and termination chunks separately from capped copies', async () => {
  const c = child(); let observed = 0, copied = 0;
  const done = runOwnedCommand({ ...options, captureMaxBytes: 8 }, { observe(n: number) { observed += n; }, consume(n: number) { copied += n; } }, { spawn: () => c, signal: gone });
  c.stdout.write(Buffer.alloc(10)); c.stdout.write(Buffer.alloc(7)); c.stderr.write(Buffer.alloc(2)); c.stdout.end(); c.stderr.end();
  await new Promise(r => setImmediate(r)); c.emit('close', null, 'SIGTERM'); const r = await done;
  expect(observed).toBe(19); expect(copied).toBe(10); expect(r.safe.streams.stdout.observedBytes).toBe(17); expect(r.stdout.length).toBe(8); expect(r.safe.reason).toBe('output-bound');
});
it('observer budget failure still counts later received bytes and returns failure', async () => {
  const c = child(); let observed = 0;
  const done = runOwnedCommand({ ...options, captureMaxBytes: 8 }, { observe(n: number) { observed += n; throw Error('budget'); }, consume() {} }, { spawn: () => c, signal: gone });
  c.stderr.write(Buffer.alloc(6)); c.stderr.write(Buffer.alloc(2)); c.stdout.end(); c.stderr.end(); await new Promise(r => setImmediate(r)); c.emit('close', 1, null);
  const r = await done; expect(observed).toBe(8); expect(r.safe.observationFailed).toBe(true); expect(r.safe.reason).toBe('output-bound');
});
it('forced deadline never claims EOF or child/group close and unrefs only its child', async () => {
  vi.useFakeTimers(); const c = child();
  const done = runOwnedCommand({ ...options, captureMaxBytes: 8 }, { observe() {}, consume() {} }, { spawn: () => c, signal: () => {} });
  await vi.advanceTimersByTimeAsync(1751); const r = await done;
  expect(r.safe.closeObserved).toBe(false); expect(r.safe.groupGone).toBe(false); expect(r.safe.streams.stderr.incomplete).toBe(true); expect(c.unref).toHaveBeenCalledOnce();
});
it.each([0, 65537, 1.1])('rejects invalid capture cap %s before spawning', cap => {
  const spawn = vi.fn(); expect(() => runOwnedCommand({ ...options, captureMaxBytes: cap }, {}, { spawn })).toThrow(); expect(spawn).not.toHaveBeenCalled();
});
it('emits only the exact fixed role and text errno', () => {
  expect(observeLoader(Buffer.from('Library not loaded: @rpath/libnode.137.dylib\nReason: errno=13\n'), roles, true)).toEqual({ errorClass: 'library-not-loaded', errno: 13, errnoState: 'observed-text', dependencyRoles: ['node-library'] });
});
it.each(['/Users/secret/key', '@rpath/libnode.137.dylib.extra', '/private/tmp/libnode.137.dylib'])('does not return unknown or partial dependency %s', token => {
  const value = observeLoader(Buffer.from(`Library not loaded: ${token}\n`), roles, true); expect(value.dependencyRoles).toEqual([]); expect(JSON.stringify(value)).not.toContain(token);
});
it('missing/conflicting errno and incomplete/nonUTF8 output remain unknown', () => {
  expect(observeLoader(Buffer.from('errno=1 errno=2'), roles, true).errnoState).toBe('conflict');
  expect(observeLoader(Buffer.from('Library not loaded: @rpath/libnode.137.dylib'), roles, false).errorClass).toBe('UNKNOWN');
  expect(observeLoader(Buffer.from([255]), roles, true).errorClass).toBe('UNKNOWN');
  expect(observeLoader(Buffer.from('unknown text'), roles, true).errno).toBeNull();
});
it('budget records overflow instead of rolling bytes back', () => {
  const budget = makeCauseBudget(77824); expect(() => budget.observe(100000)).toThrow(); expect(budget.snapshot().observed).toBe(100000); expect(budget.snapshot().withinBudget).toBe(false);
});
function setup() {
  const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-cause-test-evidence-')); roots.push(evidenceDirectory);
  const owned: string[] = [];
  const io = Object.assign({}, fs, { mkdtempSync(prefix: string) { const p = fs.mkdtempSync(prefix); roots.push(p); owned.push(p); return p; } });
  return { evidenceDirectory, owned, io };
}
function response(budget: any, incomplete = false) {
  const stdout = Buffer.alloc(0), stderr = Buffer.from('Library not loaded: @rpath/libnode.137.dylib\nReason: errno=13\n');
  budget.observe(stderr.length); budget.consume(stderr.length);
  const stream = (bytes: Buffer) => ({ observedBytes: bytes.length, writtenBytes: bytes.length, truncated: false, observerFailed: false, streamEnded: !incomplete, childCloseObserved: !incomplete, incomplete });
  return { safe: { pid: 1234567, reason: 'completed', closeObserved: !incomplete, groupGone: !incomplete, code: null, signal: 'SIGABRT', observationFailed: false, streams: { stdout: stream(stdout), stderr: stream(stderr) } }, stdout, stderr };
}
it('single fixed target classifies before cleanup and accounts stdout even on SIGABRT', async () => {
  const t = setup(), seen: any[] = [];
  const result = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: async (o: any, b: any) => { seen.push(o); return response(b); } });
  expect(seen).toHaveLength(1); expect(seen[0].args).toContain('--jitless'); expect(seen[0].captureMaxBytes).toBe(8192); expect(seen[0].environment).not.toHaveProperty('NODE_OPTIONS');
  expect(result.observation.dependencyRoles).toEqual(['node-library']); expect(result.observationComplete).toBe(true); expect(result.cleanupComplete).toBe(true); expect(result.outputAccountingComplete).toBe(true);
  expect(result.output.observed).toBe(result.streams[1].bytes); expect(t.owned.every(p => !fs.existsSync(p))).toBe(true); expect(result.resultPersisted).toBe(true);
  await expect(runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: vi.fn() })).rejects.toThrow();
});
it('unknown close retains only own roots and does not classify partial output', async () => {
  const t = setup(); const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b, true) });
  expect(r.cleanupComplete).toBe(false); expect(r.outputAccountingComplete).toBe(false); expect(r.observation.errorClass).toBe('UNKNOWN'); expect(r.retainedRoots).toEqual(t.owned); expect(t.owned.every(p => fs.existsSync(p))).toBe(true);
});
it('preparation lstat failure preserves the root created before its identity was known', async () => {
  const t = setup(); t.io.lstatSync = ((p: string) => { if (t.owned.includes(p)) throw Error('synthetic'); return fs.lstatSync(p); }) as any;
  const command = vi.fn(); const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command });
  expect(command).not.toHaveBeenCalled(); expect(r.retainedRoots).toEqual(t.owned); expect(r.cleanupComplete).toBe(false);
});
it('partial private write failure retains accurate disk count without inventing a target', async () => {
  const t = setup(); let attempts = 0; const write = fs.writeSync.bind(fs);
  t.io.writeSync = ((fd: number, bytes: Buffer, offset: number, n: number) => {
    if (bytes.includes(Buffer.from('(version 1)'))) { if (++attempts > 1) throw Error('synthetic'); return write(fd, bytes, offset, 3); }
    return write(fd, bytes, offset, n);
  }) as any;
  const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: vi.fn() });
  expect(r.output.disk).toBe(3); expect(r.targetCalls).toBe(0); expect(r.privateFiles[0].bytes).toBe(3);
});
it('unexpected file prevents cleanup and invalidates the output inventory', async () => {
  const t = setup(); const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: async (o: any, b: any) => { fs.writeFileSync(path.join(o.cwd, 'extra'), 'x'); return response(b); } });
  expect(r.cleanupComplete).toBe(false); expect(r.inventoryComplete).toBe(false); expect(r.outputAccountingComplete).toBe(false); expect(r.retainedRoots).toEqual(t.owned);
});
it('close failure retains owned identity and blocks cleanup despite the OS fd having closed', async () => {
  const t = setup(); const close = fs.closeSync.bind(fs); let calls = 0;
  t.io.closeSync = ((fd: number) => { close(fd); if (++calls === 2) throw Error('synthetic close outcome'); }) as any;
  const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: vi.fn() });
  expect(r.descriptorsClosed).toBe(false); expect(r.cleanupComplete).toBe(false); expect(r.retainedRoots).toEqual(t.owned); expect(r.targetCalls).toBe(0);
});
it('truncation cannot qualify a loader class even with normal close and parseable copied bytes', async () => {
  const t = setup(); const r = await runCause({ ...t, repository, preparedBytes: 0, roles }, { io: t.io, now: () => 1, command: async (_: any, b: any) => {
    const r = response(b); r.safe.streams.stderr.truncated = true; r.safe.streams.stderr.observedBytes += 10; b.observe(10); return r;
  } });
  expect(r.observation.errorClass).toBe('UNKNOWN'); expect(r.outputAccountingComplete).toBe(false); expect(r.withinBudget).toBe(false); expect(r.cleanupComplete).toBe(true);
});
it('delivery refuses unknown accounting, late completion, and receipts beyond the fixed bound', async () => {
  const { prepareDelivery } = await import('./execute-reviewed.mjs');
  const good = { observationComplete: true, cleanupComplete: true, outputAccountingComplete: true, withinBudget: true, resultPersisted: true, output: { receipts: 1, reservedBytes: 250000 } };
  expect(prepareDelivery(good, 1).passes).toBe(true);
  expect(prepareDelivery({ ...good, outputAccountingComplete: false }, 1).passes).toBe(false);
  expect(prepareDelivery(good, 30001).passes).toBe(false);
  expect(prepareDelivery({ ...good, output: { ...good.output, receipts: 16384 } }, 1).passes).toBe(false);
});

it('preparation boundary leaves the declared archive and automatic receipt reserves', () => {
  expect(makeCauseBudget(77824).snapshot().reservedBytes).toBe(208896);
  expect(() => makeCauseBudget(77825)).toThrow();
});
