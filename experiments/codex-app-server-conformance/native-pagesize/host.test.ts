import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePagesizeReport, runPagesize } from './host.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const nonce = 'a'.repeat(32);
const report = (id = 123, token = nonce) => ({ protocol: 'flow.pagesize.v1', nonce: token, pid: id,
  sysconf: { value: -1, errno: 1 }, getpagesize: { value: -1, errno: 1 },
  sysctl: { result: -1, value: null, length: 4, expectedLength: 4, errno: 1 },
  pthread: { stackSize: 8388608, stackSizeErrno: 0, stackAddressPresent: true, stackAddressErrno: 0 }, complete: true });
const encoded = value => Buffer.from(`${JSON.stringify(value)}\n`);
const fixtures: { path: string; dev: number | null; ino: number | null; removed: boolean }[] = [];
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-pagesize-fake-'));
  const item = { path: directory, dev: null, ino: null, removed: false }; fixtures.push(item);
  const stat = fs.lstatSync(directory); item.dev = stat.dev; item.ino = stat.ino;
  const root = fs.realpathSync(directory), evidenceDirectory = path.join(root, 'evidence');
  fs.mkdirSync(evidenceDirectory); return { root, evidenceDirectory };
}
afterAll(() => {
  for (const item of fixtures) {
    const stat = fs.lstatSync(item.path);
    if (stat.isSymbolicLink() || stat.dev !== item.dev || stat.ino !== item.ino) throw Error('Fixture identity unknown');
    fs.rmSync(item.path, { recursive: true }); item.removed = !fs.existsSync(item.path);
    expect(item.removed).toBe(true);
  }
  // Finite own fixture receipt, never command output or private diagnostic contents.
  console.log(JSON.stringify({ fixtureCount: fixtures.length, fixtures }));
});
const stream = { streamEnded: true, childCloseObserved: true, incomplete: false, truncated: false, observerFailed: false };
const healthy = (pid, pipes = false) => ({ safe: { pid, reason: 'completed', closeObserved: true, groupGone: true,
  code: 0, signal: null, streams: pipes ? { stdout: stream, stderr: stream } : null }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
const toolchain = { clang: '/fixed/clang', linker: '/fixed/ld', sandbox: '/usr/bin/sandbox-exec', sdk: '/fixed/sdk' };
function fakeCommand(calls, helperMode = 'reported') {
  return async (options, budget) => {
    calls.push(options);
    if (options.executable === toolchain.clang) {
      const binary = options.args.at(-1), object = path.join(options.cwd, 'pagesize.o');
      fs.writeFileSync(binary, 'fake executable'); fs.writeFileSync(object, 'fake object');
      const stderr = Buffer.from(`"${toolchain.clang}" -cc1 -o "${object}"\n"${toolchain.linker}" -o "${binary}"\n`);
      budget.observe(stderr.length);
      return { ...healthy(100, true), stderr };
    }
    const result = healthy(100 + calls.length);
    if (helperMode === 'unknown') return { ...result, safe: { ...result.safe, closeObserved: false, groupGone: false } };
    const value = report(result.safe.pid, options.args.at(-1));
    fs.writeFileSync(options.args.at(-2), encoded(value), { flag: 'wx', mode: 0o600 });
    return result;
  };
}
const args = fixture => ({ sourceDirectory, evidenceDirectory: fixture.evidenceDirectory, toolchain, preparedBytes: 40000 });

describe('fixed pagesize observations', () => {
  it('accepts complete negative queries without converting them into helper failure', () => {
    expect(decodePagesizeReport(encoded(report()), nonce, 123).sysctl.value).toBe(null);
  });
  it('keeps positive values and diagnostic errno separately, including pthread', () => {
    const value = report(); value.sysconf = { value: 16384, errno: 13 }; value.getpagesize = { value: 16384, errno: 13 };
    value.pthread.stackSizeErrno = 13;
    expect(decodePagesizeReport(encoded(value), nonce, 123).sysconf).toEqual({ value: 16384, errno: 13 });
  });
  it('rejects a stale identity, extra fields, incomplete report and inconsistent direct value', () => {
    expect(() => decodePagesizeReport(encoded(report()), nonce, 124)).toThrow();
    expect(() => decodePagesizeReport(encoded(report(123, 'b'.repeat(32))), nonce, 123)).toThrow();
    expect(() => decodePagesizeReport(encoded({ ...report(), extra: 1 }), nonce, 123)).toThrow();
    expect(() => decodePagesizeReport(encoded({ ...report(), complete: false }), nonce, 123)).toThrow();
    const value = report(); value.sysctl.value = 16384;
    expect(() => decodePagesizeReport(encoded(value), nonce, 123)).toThrow();
  });
  it('runs one fake compiler then A/B only, with the same binary and regular descriptors', async () => {
    const fix = fixture(), calls = [];
    const result = await runPagesize(args(fix), { now: () => 1000, command: fakeCommand(calls), rootBase: fix.root });
    expect(result.measurementComplete).toBe(true); expect(result.helperCalls).toBe(2); expect(result.compileCalls).toBe(1);
    expect(calls).toHaveLength(3); expect(calls[1].args.slice(0, 6)).toEqual(calls[2].args.slice(0, 6));
    expect(calls[1].args.at(-3)).toBe(calls[2].args.at(-3));
    expect(calls[1].args).toContain(path.join(calls[0].cwd, 'baseline.sb'));
    expect(calls[2].args).toContain(path.join(calls[0].cwd, 'pagesize.sb'));
    expect(calls.slice(1).every(call => Array.isArray(call.stdio) && call.stdio.length === 3)).toBe(true);
    expect(result.rootCleanupComplete && result.outputAccountingComplete && result.resultPersisted).toBe(true);
    expect(result.retainedRoots).toEqual([]); expect(result.output.observedBytes).toBeGreaterThan(0);
  });
  it('stops after A close unknown, preserves exact roots and never enters B', async () => {
    const fix = fixture(), calls = [];
    let unknown = false;
    const fake = fakeCommand(calls, 'unknown');
    const io = { ...fs, opendirSync(...values) { if (unknown) throw Error('Must not inventory after unknown'); return fs.opendirSync(...values); },
      rmSync(...values) { if (unknown) throw Error('Must not delete after unknown'); return fs.rmSync(...values); } };
    const result = await runPagesize(args(fix), { io, now: () => 1000, rootBase: fix.root, command: async (...values) => {
      const response = await fake(...values); if (!response.safe.closeObserved) unknown = true; return response;
    } });
    expect(calls).toHaveLength(2); expect(result.targets[1].state).toBe('NOT_RUN');
    expect(result.retainedRoots).toHaveLength(2); expect(result.processCleanupComplete).toBe(false);
    expect(result.retainedRoots.every(item => item.identity && fs.existsSync(item.path))).toBe(true);
    expect(result.outputAccountingComplete).toBe(false);
  });
  it('preserves compiler roots when compiler diagnostic persistence fails', async () => {
    const fix = fixture(), calls = [];
    const io = { ...fs, openSync(file, ...rest) {
      if (String(file).endsWith('compiler.stderr')) throw Error('Injected compiler copy failure');
      return fs.openSync(file, ...rest);
    } };
    const result = await runPagesize(args(fix), { io, now: () => 1000, command: fakeCommand(calls), rootBase: fix.root });
    expect(calls).toHaveLength(1); expect(result.helperCalls).toBe(0); expect(result.retainedRoots).toHaveLength(2);
    expect(fs.existsSync(path.join(calls[0].cwd, 'pagesize.o'))).toBe(true);
    expect(result.rootCleanupComplete).toBe(false); expect(result.outputAccountingComplete).toBe(false);
  });
  it('keeps original stderr/root when the diagnostic copy write fails', async () => {
    const fix = fixture(), calls = [];
    const io = { ...fs, openSync(file, ...rest) {
      if (String(file).endsWith('helper-a.stderr')) throw Error('Injected copy failure');
      return fs.openSync(file, ...rest);
    } };
    const command = fakeCommand(calls);
    const result = await runPagesize(args(fix), { io, now: () => 1000, rootBase: fix.root, command: async (options, budget) => {
      const response = await command(options, budget);
      if (options.executable === toolchain.sandbox) fs.writeSync(options.stdio[2], Buffer.from('fixture diagnostic'));
      return response;
    } });
    expect(calls).toHaveLength(2); expect(result.retainedRoots).toHaveLength(2);
    const raw = result.descriptors.find(item => item.stdio && item.file.endsWith('stdio-2.file'));
    expect(fs.readFileSync(raw.file, 'utf8')).toBe('fixture diagnostic');
    expect(result.rootCleanupComplete).toBe(false);
  });
  it('returns known identities and target counts when final result persistence fails', async () => {
    const fix = fixture(), calls = [];
    const io = { ...fs, openSync(file, ...rest) {
      if (String(file).endsWith('batch-result.json')) throw Error('Injected persistence failure');
      return fs.openSync(file, ...rest);
    } };
    const result = await runPagesize(args(fix), { io, now: () => 1000, command: fakeCommand(calls, 'unknown'), rootBase: fix.root });
    expect(result.helperCalls).toBe(1); expect(result.retainedRoots).toHaveLength(2); expect(result.resultPersisted).toBe(false);
    expect(prepareDelivery({ result, reservation: { complete: true } }, 1200).passes).toBe(false);
  });
  it('consumes a slot but starts no command when its fsync crosses the common cutoff', async () => {
    const fix = fixture(), calls = []; let current = 1000, slotFd = null;
    const io = { ...fs, openSync(file, ...rest) {
      const fd = fs.openSync(file, ...rest); if (String(file).endsWith('slot-compile.json')) slotFd = fd; return fd;
    }, fsyncSync(fd) { fs.fsyncSync(fd); if (fd === slotFd) current = 6000; } };
    const result = await runPagesize(args(fix), { io, now: () => current, command: fakeCommand(calls), rootBase: fix.root });
    expect(calls).toEqual([]); expect(result.compileCalls).toBe(0); expect(result.helperCalls).toBe(0);
    expect(fs.existsSync(path.join(fix.evidenceDirectory, 'slot-compile.json'))).toBe(true);
    expect(result.rootCleanupComplete).toBe(true);
  });
  it('never invokes a command after the shared preparation deadline', async () => {
    const fix = fixture(), calls = [];
    const result = await runPagesize(args(fix), { now: () => 7000, command: fakeCommand(calls), rootBase: fix.root });
    expect(calls).toEqual([]); expect(result.compileCalls).toBe(0); expect(result.helperCalls).toBe(0);
    expect(result.rootCleanupComplete).toBe(true); expect(result.measurementComplete).toBe(false);
  });
});
