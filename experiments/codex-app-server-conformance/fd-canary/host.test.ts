import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { runFdCanaryBatch } from './host.mjs';
import { runOwnedCommand } from './command.mjs';
import { decodeReport, compilerInventory } from './report.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';
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
    const replacement = override?.(options, number); if (replacement) { budget.consume(replacement.stdout.length + replacement.stderr.length); return replacement; }
    let stderr = Buffer.alloc(0);
    if (number === 1) {
      for (const name of ['fd-canary.i', 'fd-canary.o', 'fd-canary']) fs.writeFileSync(path.join(options.cwd, name), 'owned synthetic compiler output', { mode: 0o700 });
      stderr = Buffer.from(` "${toolchain.clang}" "-cc1" "-o" "${options.cwd}/fd-canary.i"\n "${toolchain.clang}" "-cc1" "-o" "${options.cwd}/fd-canary.o"\n "${toolchain.linker}" "-o" "${options.cwd}/fd-canary"\n`);
      budget.consume(stderr.length);
    } else {
      const [file, nonce] = options.args.slice(-2);
      fs.writeFileSync(file, encode(records(nonce, 42, number === 3 ? 'regular' : 'socket')), { flag: 'wx', mode: 0o600 });
    }
    return { safe: normal(), stdout: Buffer.alloc(0), stderr };
  }
  return { evidenceDirectory, calls, io, command, input: { sourceDirectory, evidenceDirectory, toolchain } };
}
it('runs the finite fake compile and two fixed contrasting reports, then removes only its roots', async () => {
  const f = fixture(); const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ measurementComplete: true, compileCalls: 1, targetReservations: 2, targetStartsObserved: 2,
    cleanupComplete: true, retainedRoots: [], withinBudget: true, resultPersisted: true });
  expect(f.calls[0].args).toContain('-save-temps=obj'); expect(f.calls[0].environment).not.toHaveProperty('CODEX_HOME');
  expect(f.calls).toHaveLength(3); expect(result.targets).toHaveLength(2);
  expect(result.targets[0].report[1].fstat.kind).toBe('socket'); expect(result.targets[1].report[1].fstat.kind).toBe('regular');
  expect(result.compilerInventoryPersisted).toBe(true);
  const receipt = JSON.parse(fs.readFileSync(path.join(f.evidenceDirectory, 'compiler-inventory.json'), 'utf8'));
  expect(receipt.files).toHaveLength(2); expect(receipt.files.every((x: any) => x.verifiedBytes === x.capturedBytes && x.verifiedSha256 === x.capturedSha256 && x.mode === '0600')).toBe(true);
  expect(result.parentRegularStdio.map((x: any) => x.fd)).toEqual([0, 1, 2]);
  for (const fd of f.calls[2].stdio) expect(() => fs.fstatSync(fd)).toThrow();
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
  expect(f.calls).toHaveLength(1); expect(result).toMatchObject({ measurementComplete: false, cleanupComplete: true, targets: ['NOT_RUN', 'NOT_RUN'], withinBudget: false });
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
  const child = Object.assign(new EventEmitter(), { pid: 123, unref: vi.fn(), stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() }); return child;
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
  expect(result.safe).toMatchObject({ closeObserved: false, groupGone: false, reason: 'deadline' }); expect(result.safe.streams.stderr.incomplete).toBe(true); expect(child.unref).toHaveBeenCalledTimes(1);
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
      if (f.calls.length === 3 && directory === path.dirname(f.calls[0].cwd) && ++lastStageEnumerations === 2) throw new Error('synthetic final inventory failure');
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

it('requires all final CLI gates and counts its exact encoded bytes without claiming post-write elapsed', () => {
  const good = { measurementComplete: true, cleanupComplete: true, outputAccountingComplete: true, resultPersisted: true, compilerInventoryPersisted: true,
    withinBudget: true, output: { measuredBytes: 1000, receipts: 1000, archiveReserveBytes: 131072, receiptReserveBytes: 32768 } };
  const delivery = prepareDelivery(good, 100); expect(delivery.passes).toBe(true); expect(delivery.bytes).toBe(Buffer.byteLength(delivery.line));
  const parsed = JSON.parse(delivery.line); expect(parsed.cliPayloadBytes).toBe(Buffer.byteLength(JSON.stringify(parsed.result)));
  expect(parsed.result.finalElapsedBasis).toBe('after-result-persistence-before-cli-write'); expect(parsed.result).not.toHaveProperty('withinBudget');
  for (const key of ['measurementComplete', 'cleanupComplete', 'outputAccountingComplete', 'resultPersisted', 'compilerInventoryPersisted', 'withinBudget']) expect(prepareDelivery({ ...good, [key]: false }, 100).passes).toBe(false);
  expect(prepareDelivery(good, 60001).passes).toBe(false);
  expect(prepareDelivery({ ...good, output: { ...good.output, measuredBytes: 2097152 } }, 100).passes).toBe(false);
  expect(prepareDelivery({ ...good, output: { ...good.output, receipts: 32768 } }, 100).passes).toBe(false);
});

it('reserves prepared evidence and archive tail before any command can consume the runtime budget', async () => {
  const f = fixture(); const preparedEvidenceBytes = 1900000;
  const result = await runFdCanaryBatch({ ...f.input, preparedEvidenceBytes }, f);
  expect(result.output).toMatchObject({ preparedEvidenceBytes, archiveReserveBytes: 131072, receiptReserveBytes: 32768 });
  expect(result.output.measuredBytes).toBe(preparedEvidenceBytes + result.output.captured + result.output.artifacts + result.output.receipts);
  expect(result.output.reservedUpperBound).toBe(preparedEvidenceBytes + result.output.captured + result.output.artifacts + 32768 + 131072);
  expect(result.withinBudget).toBe(true);
  const invalid = fixture(); await expect(runFdCanaryBatch({ ...invalid.input, preparedEvidenceBytes: 2097152 }, invalid)).rejects.toThrow();
  expect(invalid.calls).toHaveLength(0); expect(fs.existsSync(path.join(invalid.evidenceDirectory, 'batch-reservation.json'))).toBe(false);
});

function failedCompilerFixture(stderr: Buffer, code = 0) {
  return fixture((options, number) => {
    if (number !== 1) return;
    for (const name of ['fd-canary.o', 'fd-canary']) fs.writeFileSync(path.join(options.cwd, name), 'owned output');
    return { safe: { ...normal(), code }, stdout: Buffer.from('owned stdout'), stderr };
  });
}
it('persists bounded compiler bytes before a syntax failure without putting raw bytes in the safe result', async () => {
  const raw = Buffer.from(' "/fixed/clang" "-cc1" -o "/owned/unterminated\nSYNTHETIC_PRIVATE_MARKER\n');
  const f = failedCompilerFixture(raw); const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ measurementComplete: false, failureStage: 'compiler-command-inventory', failureCheck: 'compiler-command-syntax', cleanupComplete: true, targetReservations: 0 });
  expect(fs.readFileSync(path.join(f.evidenceDirectory, 'compiler.stderr'))).toEqual(raw);
  expect(fs.readFileSync(path.join(f.evidenceDirectory, 'compiler.stdout'))).toEqual(Buffer.from('owned stdout'));
  for (const name of ['compiler.stderr', 'compiler.stdout']) expect(fs.statSync(path.join(f.evidenceDirectory, name)).mode & 0o777).toBe(0o600);
  expect(result.compilerOutputFiles).toHaveLength(2); expect(result.compilerOutputFiles.every((x: any) => x.persisted && x.closed)).toBe(true);
  expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_MARKER'); expect(f.calls).toHaveLength(1);
});
it('persists compiler failure output before checking exit status and still cleans owned roots', async () => {
  const f = failedCompilerFixture(Buffer.from('synthetic compiler failure'), 1); const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ failureStage: 'compiler-health', failureCheck: 'unclassified', cleanupComplete: true, targetReservations: 0 });
  expect(fs.readFileSync(path.join(f.evidenceDirectory, 'compiler.stderr'), 'utf8')).toBe('synthetic compiler failure');
});
it('keeps log persistence failure separate and closes its owned descriptor in finally', async () => {
  const f = fixture(); const descriptors = new Map<number, string>(); const closed: number[] = [];
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
    if (name === 'fsyncSync') return (fd: number) => { if (descriptors.get(fd)?.endsWith('/compiler.stderr')) throw new Error('synthetic sync failure'); fs.fsyncSync(fd); };
    if (name === 'closeSync') return (fd: number) => { if (descriptors.get(fd)?.endsWith('/compiler.stderr')) closed.push(fd); fs.closeSync(fd); };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(result).toMatchObject({ failureStage: 'compiler-output-persistence', failureCheck: 'unclassified', cleanupComplete: true, targetReservations: 0 });
  expect(result.compilerOutputFiles[0]).toMatchObject({ persisted: false, closed: true }); expect(closed).toHaveLength(1);
});
it('charges persisted compiler output before writing it and stops when the shared budget is exhausted', async () => {
  const f = failedCompilerFixture(Buffer.alloc(5000, 65));
  const sourceBytes = ['fd-canary.c', 'candidate.sb'].reduce((sum, name) => sum + fs.statSync(path.join(sourceDirectory, name)).size, 0);
  const preparedEvidenceBytes = 2097152 - 131072 - 32768 - sourceBytes - 8000;
  const result = await runFdCanaryBatch({ ...f.input, preparedEvidenceBytes }, f);
  expect(result).toMatchObject({ failureStage: 'compiler-output-persistence', withinBudget: false, cleanupComplete: true, targetReservations: 0 });
  expect(fs.existsSync(path.join(f.evidenceDirectory, 'compiler.stderr'))).toBe(false); expect(f.calls).toHaveLength(1);
});
it('never overwrites an existing compiler evidence file', async () => {
  const f = fixture(); const file = path.join(f.evidenceDirectory, 'compiler.stderr'); fs.writeFileSync(file, 'previous own receipt');
  const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ failureStage: 'compiler-output-persistence', cleanupComplete: true, targetReservations: 0 });
  expect(fs.readFileSync(file, 'utf8')).toBe('previous own receipt');
});
it.each([
  [' /fixed/clang -cc1 -o /owned/a.o', 'compiler-command-syntax'],
  [' "/fixed/clang" "-cc1" -o "/owned/a.o', 'compiler-command-syntax'],
  [' "/fixed/unknown" "-cc1" "-o" "/owned/a.o"', 'compiler-executable'],
  [' "/fixed/clang" "-cc1" "-o" "/owned/missing.o"', 'compiler-output-missing'],
])('classifies a fixed compiler rejection without exposing its raw assertion: %s', (line, code) => {
  let error: any; try { compilerInventory(Buffer.from(line + '\n'), '/owned', [{ path: '/owned/a.o' }], toolchain.clang, toolchain.linker); } catch (caught) { error = caught; }
  expect(error).toMatchObject({ code }); expect(error.message).toBe('Compiler inventory unavailable'); expect(error).not.toHaveProperty('actual');
});

it('preserves an unknown compiler-log close without retrying that descriptor or deleting roots', async () => {
  const f = fixture(); const descriptors = new Map<number, string>(); let attempts = 0;
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
    if (name === 'closeSync') return (fd: number) => {
      fs.closeSync(fd);
      if (descriptors.get(fd)?.endsWith('/compiler.stderr')) { attempts++; descriptors.delete(fd); throw new Error('synthetic unknown close ACK'); }
    };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(result).toMatchObject({ failureStage: 'compiler-output-persistence', cleanupComplete: false, descriptorsClosed: false, targetReservations: 0 });
  expect(result.compilerOutputFiles[0]).toMatchObject({ persisted: true, closed: false }); expect(result.retainedRoots).toHaveLength(2); expect(attempts).toBe(1);
});

it('decodes documented quoted executables with bare and escaped arguments as data only', () => {
  const artifacts = [{ path: '/owned/space name.o' }, { path: '/owned/final' }];
  const text = String.raw` "/fixed/clang" -cc1 -DVALUE="ignored" -o "/owned/space name.o"`;
  // Embedded partial quoting is not printArg output; the whole argument must be quoted if it needs escaping.
  expect(() => compilerInventory(Buffer.from(text + '\n'), '/owned', artifacts, toolchain.clang, toolchain.linker)).toThrow();
  const verbose = String.raw` "/fixed/clang" -cc1 "-DVALUE=\"literal\"" "-DDOLLAR=\$VALUE" "-DBACKSLASH=\\value" -o "/owned/space name.o"
 "/fixed/ld" -o /owned/final` + '\n';
  const commands = compilerInventory(Buffer.from(verbose), '/owned', artifacts, toolchain.clang, toolchain.linker);
  expect(commands.map(x => x.output)).toEqual(['space name.o', 'final']); expect(commands.map(x => x.role)).toEqual(['frontend', 'linker']);
});
it.each([
  ' "/fixed/clang" -cc1 "bad\\q" -o /owned/a.o',
  ' "/fixed/clang" -cc1 -o /owned/a.o -o /owned/other.o',
  ' "/fixed/clang" -cc1 -o /outside/a.o',
  ' "/fixed/clang" -cc1 "' + 'a'.repeat(4097) + '" -o /owned/a.o',
])('rejects unsupported or ambiguous compiler tokens without executing them: %s', line => {
  expect(() => compilerInventory(Buffer.from(line + '\n'), '/owned', [{ path: '/owned/a.o' }], toolchain.clang, toolchain.linker)).toThrow();
});


it('v3 sends only three parent-confirmed owned regular descriptors to its second target', async () => {
  let observed: number[] = [];
  const f = fixture((options, number) => { if (number === 3) {
    expect(options.executable).toBe(toolchain.sandbox); expect(options.stdio).toHaveLength(3);
    observed = [...options.stdio]; expect(new Set(observed).size).toBe(3);
    for (const [index, fd] of observed.entries()) {
      const opened = fs.fstatSync(fd), named = fs.lstatSync(path.join(options.cwd, `stdio-${index}.file`));
      expect(opened.isFile()).toBe(true); expect([opened.dev, opened.ino]).toEqual([named.dev, named.ino]);
      expect(opened.mode & 0o777).toBe(0o600);
    }
  } });
  const result = await runFdCanaryBatch(f.input, f);
  expect(result.measurementComplete).toBe(true); expect(f.calls).toHaveLength(3);
  expect(f.calls[1].stdio).toBe('pipe'); expect(result.parentRegularStdio).toHaveLength(3);
  for (const fd of observed) expect(() => fs.fstatSync(fd)).toThrow();
});
it('v3 preserves valid negative child fstat without inventing a regular observation', async () => {
  const f = fixture((options, number) => { if (number === 3) {
    const [file, nonce] = options.args.slice(-2);
    fs.writeFileSync(file, encode(records(nonce, 42, 'unknown', true)), { flag: 'wx', mode: 0o600 });
    return { safe: normal(), stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
  } });
  const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ measurementComplete: true, cleanupComplete: true, targetReservations: 2 });
  expect(result.parentRegularStdio).toHaveLength(3);
  expect(result.targets[1].report.slice(1, 4).every((x: any) => x.fstat.kind === 'unknown' && x.fstat.errnoNumber === 1 && !x.fstat.ok)).toBe(true);
});
it('v3 stops after unhealthy control without opening the regular comparison', async () => {
  const f = fixture((_options, number) => number === 2 && ({ safe: { ...normal(), code: 1 }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
  const result = await runFdCanaryBatch(f.input, f);
  expect(result).toMatchObject({ targetReservations: 1, measurementComplete: false, cleanupComplete: true });
  expect(result.targets).toHaveLength(2); expect(result.targets[1]).toBe('NOT_RUN'); expect(result.parentRegularStdio).toBeUndefined();
  expect(f.calls).toHaveLength(2);
});
it.each([true, false])('v3 distinguishes a closed profile failure from unknown group cleanup: %s', async groupGone => {
  const f = fixture((_options, number) => number === 3 && ({ safe: { ...normal(), code: null, signal: 'SIGABRT', groupGone }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
  const result = await runFdCanaryBatch(f.input, f);
  expect(f.calls).toHaveLength(3); expect(result.targets).toHaveLength(2);
  expect(result).toMatchObject({ measurementComplete: false, cleanupComplete: groupGone, descriptorsClosed: true, failureStage: 'target-2-health' });
  expect(result.retainedRoots).toHaveLength(groupGone ? 0 : 2); expect(result.targets[1].report).toBeNull();
  for (const fd of f.calls[2].stdio) expect(() => fs.fstatSync(fd)).toThrow();
});
it('v3 rejects substituted descriptor metadata before starting its profile target', async () => {
  const f = fixture(); const descriptors = new Map<number, string>(); const regularFds: number[] = [];
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); if (String(args[0]).endsWith('/stdio-0.file')) regularFds.push(fd); return fd; };
    if (name === 'fstatSync') return (fd: number) => { const stat = fs.fstatSync(fd); return descriptors.get(fd)?.endsWith('/stdio-0.file') ? new Proxy(stat, { get(object, key) { return key === 'ino' ? stat.ino + 1 : Reflect.get(object, key); } }) : stat; };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(result).toMatchObject({ measurementComplete: false, targetReservations: 1, descriptorsClosed: true, cleanupComplete: true });
  expect(f.calls).toHaveLength(2); expect(regularFds).toHaveLength(1); for (const fd of regularFds) expect(() => fs.fstatSync(fd)).toThrow();
});
it.each(['failure', 'deadline'])('v3 persists required compiler inventory inside the same clock: %s', async mode => {
  const f = fixture(); let clock = 0; const descriptors = new Map<number, string>();
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
    if (name === 'fsyncSync') return (fd: number) => { if (descriptors.get(fd)?.endsWith('/compiler-inventory.json')) { if (mode === 'failure') throw new Error('synthetic fsync failure'); clock = 60001; } fs.fsyncSync(fd); };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io, now: () => clock });
  expect(f.calls).toHaveLength(1); expect(result).toMatchObject({ measurementComplete: false, cleanupComplete: true, targetReservations: 0, compilerInventoryPersisted: mode === 'deadline' });
  if (mode === 'deadline') expect(result.withinBudget).toBe(false);
});

it('v3 retains roots when automatic inventory close is unknown without retrying its fd', async () => {
  const f = fixture(); const descriptors = new Map<number, string>(); let closes = 0;
  const io = new Proxy(f.io, { get(target, name) {
    if (name === 'openSync') return (...args: any[]) => { const fd = (fs.openSync as any)(...args); descriptors.set(fd, String(args[0])); return fd; };
    if (name === 'closeSync') return (fd: number) => { fs.closeSync(fd); if (descriptors.get(fd)?.endsWith('/compiler-inventory.json')) { closes++; descriptors.delete(fd); throw new Error('synthetic close ACK loss'); } };
    return Reflect.get(target, name);
  } });
  const result = await runFdCanaryBatch(f.input, { ...f, io });
  expect(result).toMatchObject({ compilerInventoryPersisted: false, descriptorsClosed: false, cleanupComplete: false, targetReservations: 0, failureStage: 'compiler-inventory-persistence' });
  expect(result.retainedRoots).toHaveLength(2); expect(f.calls).toHaveLength(1); expect(closes).toBe(1);
});
