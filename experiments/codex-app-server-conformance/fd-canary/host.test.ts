import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { runFdCanaryBatch } from './host.mjs';
import { runOwnedCommand } from './command.mjs';
import { decodeReport, compilerInventory } from './report.mjs';
const sourceDirectory = path.dirname(new URL(import.meta.url).pathname);
const toolchain = { clang: '/fixed/clang', linker: '/fixed/ld', sdk: '/fixed/sdk', sandbox: '/fixed/sandbox-exec' };
const owned: Array<{ directory: string; dev: number; ino: number }> = [];
function own(prefix = '/private/tmp/flow-wpf02-fd-test-') {
  const directory = fs.mkdtempSync(prefix); const { dev, ino } = fs.lstatSync(directory); owned.push({ directory, dev, ino }); return directory;
}
afterEach(() => {
  vi.useRealTimers();
  for (const item of owned.splice(0)) if (fs.existsSync(item.directory)) {
    const stat = fs.lstatSync(item.directory); expect([stat.dev, stat.ino, stat.isSymbolicLink()]).toEqual([item.dev, item.ino, false]);
    fs.rmSync(item.directory, { recursive: true });
  }
});
const call = (kind = 'socket', denied = false) => ({ fstat: denied ? { ok: false, result: -1, errno: 'EPERM', errnoNumber: 1, kind: 'unknown' }
  : { ok: true, result: 0, errno: null, errnoNumber: 0, kind }, fcntl: { ok: true, result: 2, errno: null, errnoNumber: 0, access: 'read-write', nonblocking: false } });
function records(nonce: string, pid: number, kind = 'socket', denied = false) {
  return [{ record: 'start', protocol: 'flow.fd-canary.v1', nonce, pid }, ...[0, 1, 2].map(fd => ({ record: 'fd', fd, ...call(kind, denied) })), { record: 'complete', count: 3 }];
}
const encode = (value: unknown[]) => Buffer.from(value.map(row => JSON.stringify(row)).join('\n') + '\n');
const normal = () => ({ pid: 42, reason: 'completed', closeObserved: true, groupGone: true, code: 0, signal: null, streams: null });
function fixture(override?: (options: any, number: number) => any) {
  const evidenceDirectory = own(); const calls: any[] = [];
  const io = new Proxy(fs, { get(target, name) {
    if (name === 'mkdtempSync') return (prefix: string) => own(prefix);
    return Reflect.get(target, name);
  } });
  async function command(options: any, budget: any) {
    calls.push(options); const number = calls.length;
    const replacement = override?.(options, number); if (replacement) return replacement;
    let stderr = Buffer.alloc(0);
    if (number === 1) {
      for (const name of ['fd-canary.i', 'fd-canary.o', 'fd-canary']) fs.writeFileSync(path.join(options.cwd, name), 'owned synthetic compiler output', { mode: 0o700 });
      stderr = Buffer.from(` "${toolchain.clang}" "-cc1" "-o" "${options.cwd}/fd-canary.i"\n "${toolchain.clang}" "-cc1" "-o" "${options.cwd}/fd-canary.o"\n "${toolchain.linker}" "-o" "${options.cwd}/fd-canary"\n`);
      budget.consume(stderr.length);
    } else {
      const [file, nonce] = options.args.slice(-2);
      fs.writeFileSync(file, encode(records(nonce, 42, number === 4 ? 'regular' : 'socket', number === 3)), { flag: 'wx', mode: 0o600 });
    }
    return { safe: normal(), stdout: Buffer.alloc(0), stderr };
  }
  return { evidenceDirectory, calls, io, command, input: { sourceDirectory, evidenceDirectory, toolchain } };
}
it('runs the finite fake compile and three contrasting reports, then removes only its roots', async () => {
  const f = fixture(); const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ measurementComplete: true, compileCalls: 1, targetReservations: 3, targetStartsObserved: 3,
    cleanupComplete: true, retainedRoots: [], withinBudget: true, resultPersisted: true });
  expect(f.calls[0].args).toContain('-save-temps=obj'); expect(f.calls[0].environment).not.toHaveProperty('CODEX_HOME');
  expect(result.targets[1].report[1].fstat.errno).toBe('EPERM'); expect(result.targets[2].report[1].fstat.kind).toBe('regular');
  expect(result.compilerCommands).toHaveLength(3); expect(result.output.artifacts).toBeGreaterThan(0);
  for (const item of owned.filter(item => item.directory !== f.evidenceDirectory)) expect(fs.existsSync(item.directory)).toBe(false);
});
it('refuses a consumed reservation without a compiler or target call', async () => {
  const f = fixture(); fs.writeFileSync(path.join(f.evidenceDirectory, 'batch-reservation.json'), 'already consumed');
  const result = await runFdCanaryBatch(f.input, f); expect(f.calls).toHaveLength(0);
  expect(result).toMatchObject({ measurementComplete: false, compileCalls: 0, targetReservations: 0, resultPersisted: false });
});
it('stops after a failed compiler and still closes and removes owned roots', async () => {
  const f = fixture(() => ({ safe: { ...normal(), code: 1 }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
  const result = await runFdCanaryBatch(f.input, f);
  expect(f.calls).toHaveLength(1); expect(result).toMatchObject({ measurementComplete: false, cleanupComplete: true, targets: ['NOT_RUN', 'NOT_RUN', 'NOT_RUN'], withinBudget: false });
});
it('retains roots when the owned process group is not confirmed gone', async () => {
  const f = fixture(() => ({ safe: { ...normal(), groupGone: false }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
  const result = await runFdCanaryBatch(f.input, f);
  expect(result.cleanupComplete).toBe(false); expect(result.retainedRoots).toHaveLength(2); expect(f.calls).toHaveLength(1);
});
it('stops at the first missing report without silently consuming later targets', async () => {
  const f = fixture((_options, number) => number === 2 && ({ safe: normal(), stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
  const result = await runFdCanaryBatch(f.input, f);
  expect(f.calls).toHaveLength(2); expect(result).toMatchObject({ measurementComplete: false, targetReservations: 1, cleanupComplete: true });
});
it('measures an oversized own compiler artifact and cleans it without reading its contents', async () => {
  const f = fixture((options, number) => { if (number === 1) {
    fs.writeFileSync(path.join(options.cwd, 'fd-canary.o'), Buffer.alloc(2 * 1024 * 1024));
    return { safe: normal(), stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
  } });
  const result = await runFdCanaryBatch(f.input, f);
  expect(result.withinBudget).toBe(false); expect(result.output.measuredBytes).toBeGreaterThan(2 * 1024 * 1024);
  expect(result.cleanupComplete).toBe(true); expect(result.targetReservations).toBe(0);
});
it.each(['realpathSync', 'lstatSync', 'chmodSync'])('retains a root registered before %s preparation fails', async method => {
  const f = fixture(); let fired = false;
  const io = new Proxy(f.io, { get(target, name) { if (name === method) return (...args: any[]) => {
    if (!fired && String(args[0]).startsWith('/private/tmp/flow-wpf02-fd-')) { fired = true; throw new Error('synthetic setup failure'); }
    return (Reflect.get(target, name) as any)(...args);
  }; return Reflect.get(target, name); } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(f.calls).toHaveLength(0); expect(result.cleanupComplete).toBe(false); expect(result.retainedRoots).toHaveLength(1);
  expect(fs.existsSync(result.retainedRoots[0])).toBe(true);
});
it('reports the outer elapsed time after final fsync crosses the 60 second limit', async () => {
  const f = fixture(); let clock = 0; const descriptors = new Map<number, string>();
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
    if (name === 'fsyncSync') return (fd: number) => { fs.fsyncSync(fd); if (descriptors.get(fd)?.endsWith('/batch-result.json')) clock = 60001; };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io, now: () => clock });
  expect(result).toMatchObject({ finalElapsedMs: 60001, withinBudget: false, cleanupComplete: true, resultPersisted: true });
  expect(JSON.parse(fs.readFileSync(path.join(f.evidenceDirectory, 'batch-result.json'), 'utf8'))).toMatchObject({ elapsedBasis: 'before-result-persistence', elapsedMs: 0 });
});
it('rejects contradictory syscall data, report identity and incomplete record sequences', () => {
  const value = records('a'.repeat(32), 42); expect(decodeReport(encode(value), 'a'.repeat(32), 42)).toEqual(value);
  const bad = records('a'.repeat(32), 42, 'socket', true); (bad[1] as any).fstat.errnoNumber = 0;
  expect(() => decodeReport(encode(bad), 'a'.repeat(32), 42)).toThrow();
  expect(() => decodeReport(encode(value), 'b'.repeat(32), 42)).toThrow();
  expect(() => decodeReport(encode(value.slice(0, 4)), 'a'.repeat(32), 42)).toThrow();
});
it('rejects compiler output claims absent from the owned inventory', () => {
  expect(() => compilerInventory(Buffer.from(' "/fixed/clang" "-cc1" "-o" "/owned/missing.o"\n'), '/owned', [], toolchain.clang, toolchain.linker)).toThrow();
});
function fakeChild() {
  const child = Object.assign(new EventEmitter(), { pid: 123, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() }); return child;
}
it('waits for close and captures stderr arriving after exit without a real child', async () => {
  const child = fakeChild(); let finished = false;
  const result = runOwnedCommand({ executable: '/fixed/test', args: [], cwd: '/', environment: {}, stdio: 'pipe', timeoutMs: 1000 }, { consume() {} },
    { spawn: () => child, signal: () => { throw Object.assign(new Error(), { code: 'ESRCH' }); } }).then(value => { finished = true; return value; });
  child.emit('exit', 0, null); await Promise.resolve(); expect(finished).toBe(false);
  child.stderr.end('late owned marker'); child.stdout.end(); await new Promise(resolve => setImmediate(resolve)); child.emit('close', 0, null);
  const value = await result; expect(value.stderr.toString()).toBe('late owned marker'); expect(value.safe).toMatchObject({ closeObserved: true, groupGone: true, code: 0 });
});
it('bounds TERM/KILL/forced close from the first stop and never claims an undrained group closed', async () => {
  vi.useFakeTimers(); const child = fakeChild(); const signals: unknown[] = [];
  const pending = runOwnedCommand({ executable: '/fixed/test', args: [], cwd: '/', environment: {}, stdio: 'pipe', timeoutMs: 1000 }, { consume() {} },
    { spawn: () => child, signal: (_pid: number, value: unknown) => { signals.push(value); } });
  await vi.advanceTimersByTimeAsync(1000); child.emit('error', new Error('must not extend deadline'));
  await vi.advanceTimersByTimeAsync(750); const result = await pending;
  expect(signals.filter(value => value === 'SIGTERM')).toHaveLength(1); expect(signals.filter(value => value === 'SIGKILL')).toHaveLength(1);
  expect(result.safe).toMatchObject({ closeObserved: false, groupGone: false, reason: 'deadline' }); expect(result.safe.streams.stderr.incomplete).toBe(true);
});
it('stops a fake output stream at the capture bound without copying extra bytes', async () => {
  vi.useFakeTimers(); const child = fakeChild(); let consumed = 0;
  const pending = runOwnedCommand({ executable: '/fixed/test', args: [], cwd: '/', environment: {}, stdio: 'pipe', timeoutMs: 1000 }, { consume(length: number) { consumed += length; } },
    { spawn: () => child, signal: () => {} });
  child.stderr.write(Buffer.alloc(65537)); await vi.advanceTimersByTimeAsync(750); const result = await pending;
  expect(consumed).toBe(65536); expect(result.stderr.length).toBe(65536); expect(result.safe.reason).toBe('output-bound');
});

it('makes accounting unknown when final root enumeration cannot finish after all commands close', async () => {
  const f = fixture(); let lastStageEnumerations = 0;
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'readdirSync') return (directory: string) => {
      if (f.calls.length === 4 && directory === path.dirname(f.calls[0].cwd) && ++lastStageEnumerations === 2) throw new Error('synthetic final inventory failure');
      return fs.readdirSync(directory);
    };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(result).toMatchObject({ measurementComplete: true, outputAccountingComplete: false, withinBudget: false, cleanupComplete: false });
  expect(result.retainedRoots).toHaveLength(1); expect(result.output.withinMeasuredBudget).toBe(true);
});
it('rejects caller identity outside the report schema even when the payload echoes it', () => {
  expect(() => decodeReport(encode(records('x', 42)), 'x', 42)).toThrow();
  expect(() => decodeReport(encode(records('a'.repeat(32), 0)), 'a'.repeat(32), 0)).toThrow();
});
it('refuses an unquoted or unknown compiler command instead of omitting it from known commands', () => {
  const artifacts = [{ path: '/owned/a.o' }, { path: '/owned/b' }];
  const valid = ' "/fixed/clang" "-cc1" "-o" "/owned/a.o"\n "/fixed/ld" "-o" "/owned/b"\n';
  expect(compilerInventory(Buffer.from(valid), '/owned', artifacts, toolchain.clang, toolchain.linker)).toHaveLength(2);
  expect(() => compilerInventory(Buffer.from(valid + ' /fixed/unknown -o /owned/c\n'), '/owned', artifacts, toolchain.clang, toolchain.linker)).toThrow();
  expect(() => compilerInventory(Buffer.from(valid + ' "/fixed/unknown" "-o" "/owned/c"\n'), '/owned', artifacts, toolchain.clang, toolchain.linker)).toThrow();
});
