import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
vi.mock('../../../apps/runner/src/codex/index.ts', () => ({ createCodexTransport: () => { throw Error('Actual transport forbidden'); } }));
import { runCause, makeCauseBudget, isExpectedControl } from '../node-loader-cause/host.mjs';
import { runNodeRootliteralBatch } from '../node-rootliteral/host.mjs';
import { runRuntimeMetadataBatch } from './host.mjs';
import { prepareDelivery, verifyPathClosure } from './execute-reviewed.mjs';
const payload = Buffer.from('flow-diag-prefix\n中🙂\nflow-diag-tail\n');
const repository = process.cwd();
let base: string, elapsed: number, commands: any[], transports: any[], fault: string;
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
beforeEach(() => {
  base = fs.mkdtempSync('/private/tmp/flow-runtime-metadata-test-'); elapsed = 1; commands = []; transports = []; fault = '';
  const create = fs.mkdtempSync.bind(fs);
  vi.spyOn(fs, 'mkdtempSync').mockImplementation((prefix: any) => create(path.join(base, String(prefix).includes('private') ? 'private-' : 'owned-')));
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(base, { recursive: true, force: true }); });
function response(budget: any, stdout = Buffer.alloc(0), stderr = payload) {
  for (const bytes of [stdout, stderr]) { budget.observe(bytes.length); budget.consume(bytes.length); }
  const stream = (bytes: Buffer) => ({ observedBytes: bytes.length, writtenBytes: bytes.length, streamEnded: true,
    childCloseObserved: true, incomplete: false, truncated: false, observerFailed: false });
  return { safe: { pid: 2345678, reason: 'completed', closeObserved: true, groupGone: true, code: 7, signal: null,
    observationFailed: false, streams: { stdout: stream(stdout), stderr: stream(stderr) } }, stdout, stderr };
}
async function command(options: any, budget: any) {
  commands.push(options);
  const r = response(budget, fault === 'control-stdout' ? Buffer.from('x') : Buffer.alloc(0), fault === 'control-abort' ? Buffer.from('failure') : payload);
  if (fault === 'control-abort') { r.safe.code = null as any; r.safe.signal = 'SIGABRT' as any; }
  if (fault === 'control-unknown') r.safe.groupGone = false;
  return r;
}
async function compose(create: any, options: any) {
  const directory = fs.mkdtempSync(path.join(base, 'compose-'));
  fs.mkdirSync(path.join(directory, 'control')); fs.mkdirSync(path.join(directory, 'state'));
  const bytes = fs.readFileSync('experiments/codex-app-server-conformance/node-runtime-metadata/candidate.sb');
  fs.writeFileSync(path.join(directory, 'control/default-deny.sb'), bytes);
  expect(options.scenario).toBe('node-runtime-metadata-canary');
  const transport = create({ spawn: { executable: fault === 'unsandboxed' ? '/opt/homebrew/Cellar/node@24/24.20.0/bin/node' : '/usr/bin/sandbox-exec',
    cwd: path.join(directory, 'state'), args: [], environment: {} } });
  await transport.ready; await transport.close(); fs.rmSync(directory, { recursive: true });
  return { passed: fault !== 'canary-report', stdoutBoundConfirmed: true, report: fault === 'canary-report' ? null : { passed: true },
    listenerClosed: true, retainedRoots: [], listener: { created: true, bound: true, accepted: 0, closed: true },
    outputInventory: { complete: true, bytes: bytes.length, files: [] } };
}
function factory(options: any) {
  transports.push(options);
  const stderr = fault === 'canary-loader' ? Buffer.from('dyld[22]: Library not loaded: /public/lib\nReason: tried: \'/public/lib\' (blocked by sandbox)\n') : Buffer.alloc(0);
  options.privateStderr.write(stderr);
  const close = { reason: fault === 'bad-reason' ? 'DISCONNECTED' : 'CLOSED', child: 'confirmed-exited', exitCode: 0, signal: null,
    stderrCapture: { observedBytes: stderr.length, writtenBytes: stderr.length, streamEnded: true, childCloseObserved: true, incomplete: false, truncated: false, observerFailed: false } };
  return { ready: Promise.resolve({ userAgent: 'synthetic/1' }), closed: Promise.resolve(close), close: async () => close };
}
const deps = () => ({ now: () => elapsed, controlDependencies: { now: () => elapsed, command }, canaryDependencies: { compose, createTransport: factory } });
function input() { const evidenceDirectory = path.join(base, 'evidence'); fs.mkdirSync(evidenceDirectory); return { repository, evidenceDirectory, preparedBytes: 400000, roles: [], peerBytes: Buffer.from('fixed') }; }
it('new control uses fixed metadata profile, separate exact success predicate and no loader-error prerequisite', async () => {
  const i = input(); const r = await runCause({ ...i, preparedBytes: 0, recipe: 'runtime-metadata-control' }, { now: () => elapsed, command });
  expect(commands).toHaveLength(1); expect(r.controlPassed).toBe(true); expect(r.observationComplete).toBe(false); expect(isExpectedControl(r)).toBe(true);
  const privateProfile = r.privateFiles.find((row: any) => row.file.endsWith('/default-deny.sb'));
  expect(privateProfile.sha256).toBe(hash(fs.readFileSync('experiments/codex-app-server-conformance/node-runtime-metadata/candidate.sb')));
  expect(r.cleanupComplete).toBe(true);
});
it('both full 8192-byte streams fit the new profile local disk cap; legacy 24KiB still rejects', async () => {
  const i = input(); const r = await runCause({ ...i, preparedBytes: 0, recipe: 'runtime-metadata-control' },
    { now: () => 1, command: async (_: any, b: any) => response(b, Buffer.alloc(8192), Buffer.alloc(8192)) });
  expect(r.output.disk).toBe(16762 + 379 + 16384); expect(r.output.withinBudget).toBe(true);
  expect(r.outputAccountingComplete).toBe(true); expect(r.controlPassed).toBe(false);
  expect(() => makeCauseBudget(0).disk(33525)).toThrow();
  const fresh = makeCauseBudget(0, 'runtime-metadata-control'); fresh.disk(33525); expect(fresh.snapshot().withinBudget).toBe(true);
  expect(() => makeCauseBudget(1, 'runtime-metadata-control')).toThrow();
});
it('combination runs exactly one control plus one sandbox canary with prepared charged once', async () => {
  const r = await runRuntimeMetadataBatch(input(), deps());
  expect(commands).toHaveLength(1); expect(transports).toHaveLength(1); expect(r.targets).toEqual(['EXPECTED', 'EXPECTED']);
  expect(r).toMatchObject({ targetCalls: 2, cleanupComplete: true, outputAccountingComplete: true, measurementComplete: true, inventoryPersisted: true });
  expect(r.output.prepared).toBe(400000); expect(r.output.controlObserved).toBe(40); expect(r.output.canaryStdoutSourceUpperBound).toBe(182);
  expect(r.output.controlDisk).toBe(16762 + 379 + 40); expect(prepareDelivery(r, 50).passes).toBe(true);
});
it.each(['control-abort', 'control-stdout', 'control-unknown'])('%s consumes one slot and never creates the canary', async name => {
  fault = name; const r = await runRuntimeMetadataBatch(input(), deps());
  expect(commands).toHaveLength(1); expect(transports).toHaveLength(0); expect(r.targets[1]).toBe('NOT_RUN');
  expect(r.measurementComplete).toBe(false); expect(prepareDelivery(r, 50).passes).toBe(false);
});
it.each(['bad-reason', 'canary-report'])('%s disqualifies the canary stdout source bound despite an empty queue receipt', async name => {
  fault = name; const r = await runRuntimeMetadataBatch(input(), deps());
  expect(transports).toHaveLength(1); expect(r.canary.stdoutBoundQualified).toBe(false); expect(r.outputAccountingComplete).toBe(false);
  expect(r.canary.stdoutBasis).toContain('not wire capture'); expect(r.measurementComplete).toBe(false);
  expect(r.output.canaryStdoutSourceUpperBound).toBeNull(); expect(r.output.unqualifiedStdoutReserveBytes).toBe(182);
});
it('single-canary recipe rejects unsandboxed executable before creating its transport', async () => {
  fault = 'unsandboxed'; const i = input(); const r = await runNodeRootliteralBatch({ evidenceDirectory: i.evidenceDirectory, peerBytes: i.peerBytes,
    preparedEvidenceBytes: 0, recipe: 'runtime-metadata-canary-only' }, { compose, createTransport: factory, now: () => 1, start: 0 });
  expect(transports).toHaveLength(0); expect(r.measurementComplete).toBe(false); expect(r.cleanupComplete).toBe(false);
});
it('the second Module uses the global clock and cannot restart its budget origin', async () => {
  const d = deps(); const i = input(); const canary = vi.fn(async (args: any, injected: any) => {
    expect(injected.start).toBe(0); expect(injected.now()).toBe(44000); elapsed = 60001;
    return runNodeRootliteralBatch(args, injected);
  });
  const control = async (args: any, injected: any) => { const r = await runCause(args, injected); elapsed = 44000; return r; };
  const r = await runRuntimeMetadataBatch(i, { ...d, control, canary });
  expect(canary).toHaveBeenCalledOnce(); expect(transports).toHaveLength(0); expect(r.withinBudget).toBe(false);
});
it('a control completion beyond its own 30s never qualifies the second slot', async () => {
  const d = deps(); d.controlDependencies.command = async (o: any, b: any) => { const r = await command(o, b); elapsed = 30001; return r; };
  const r = await runRuntimeMetadataBatch(input(), d);
  expect(transports).toHaveLength(0); expect(r.targets[1]).toBe('NOT_RUN');
});
it('a Module rejection before a receipt leaves owner settlement unknown', async () => {
  const r = await runRuntimeMetadataBatch(input(), { ...deps(), control: async () => { throw Error('FAKE_UNKNOWN'); } });
  expect(r.ownerPending).toBe('control'); expect(r.cleanupComplete).toBe(false); expect(r.outputAccountingComplete).toBe(false); expect(transports).toHaveLength(0);
  expect(r.targetCalls).toBeNull(); expect(r.targets[0]).toBe('UNKNOWN');
  expect(r.retainedRootsComplete).toBe(false); // An empty partial list is not proof of no retained roots.
});
it('canary failure extracts bounded reason before private cleanup without qualifying stdout', async () => {
  fault = 'canary-loader'; const r = await runRuntimeMetadataBatch(input(), deps());
  expect(r.canary.observation.reasons).toEqual([{ operation: 'search-stat', category: 'sandbox-stat', errno: null, dependencyRole: null }]);
  expect(r.canary.stdoutBoundQualified).toBe(false); expect(r.cleanupComplete).toBe(true);
  expect(JSON.stringify(r.canary.observation)).not.toContain('/public/lib');
});
it('fixed input gate rejects changed link targets and absent paths becoming present', () => {
  const closure = JSON.parse(fs.readFileSync('docs/evidence/wpf-mature-02/node-runtime-metadata/path-closure.json', 'utf8'));
  const io: any = { lstatSync: (p: string) => {
    const n = closure.nodes.find((x: any) => x.path === p);
    if (n.kind === 'absent') throw Object.assign(Error('missing'), { code: 'ENOENT' });
    return { isSymbolicLink: () => n.kind === 'symlink', isDirectory: () => n.kind === 'directory', isFile: () => n.kind === 'regular', size: n.bytes };
  }, readlinkSync: (p: string) => closure.nodes.find((x: any) => x.path === p).target,
  realpathSync: (p: string) => closure.chains.find((x: any) => x.seed === p).realpath };
  expect(() => verifyPathClosure(closure, io)).not.toThrow();
  expect(() => verifyPathClosure(closure, { ...io, readlinkSync: () => '/Users/private' })).toThrow();
  expect(() => verifyPathClosure(closure, { ...io, lstatSync: () => ({ isSymbolicLink: () => false, isDirectory: () => true, isFile: () => false }) })).toThrow();
});
it('delivery refuses a late automatic receipt or the combined CLI/receipt overflow', async () => {
  const r = await runRuntimeMetadataBatch(input(), deps());
  expect(prepareDelivery(r, 60001).passes).toBe(false);
  expect(prepareDelivery({ ...r, output: { ...r.output, receipts: 32768 } }, 2).passes).toBe(false);
});
it('an unconfirmed extra observation descriptor retains the private root and invalidates accounting', async () => {
  const open = fs.openSync.bind(fs), close = fs.closeSync.bind(fs); let observerFd: number | null = null;
  vi.spyOn(fs, 'openSync').mockImplementation(((file: any, flags: any, ...rest: any[]) => {
    const fd = (open as any)(file, flags, ...rest);
    if (String(file).endsWith('attempt-1.stderr') && flags === (fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)) observerFd = fd;
    return fd;
  }) as any);
  vi.spyOn(fs, 'closeSync').mockImplementation(fd => {
    close(fd); if (fd === observerFd) { observerFd = null; throw Error('SYNTHETIC_CLOSE_UNKNOWN'); }
  });
  const r = await runRuntimeMetadataBatch(input(), deps());
  expect(r.canary.observation.descriptorClosed).toBe(false); expect(r.cleanupComplete).toBe(false); expect(r.outputAccountingComplete).toBe(false);
  expect(r.retainedRoots.length).toBeGreaterThan(0); expect(JSON.stringify(r)).not.toContain('SYNTHETIC_CLOSE_UNKNOWN');
});
it('unknown recipe names never create an owned target or accept an arbitrary profile path', async () => {
  const i = input();
  await expect(runCause({ ...i, preparedBytes: 0, recipe: '/tmp/alternate.sb' }, { command })).rejects.toThrow();
  await expect(runNodeRootliteralBatch({ evidenceDirectory: i.evidenceDirectory, peerBytes: i.peerBytes, preparedEvidenceBytes: 0, recipe: '/tmp/alternate.sb' }, { createTransport: factory, compose })).rejects.toThrow();
  expect(commands).toHaveLength(0); expect(transports).toHaveLength(0);
});

it('new control preserves known retained identities if its final receipt cannot persist', async () => {
  fault = 'control-unknown'; const open = fs.openSync.bind(fs);
  vi.spyOn(fs, 'openSync').mockImplementation(((file: any, ...args: any[]) => {
    if (String(file).endsWith('/control/batch-result.json')) throw Error('SYNTHETIC_PERSIST_FAILURE');
    return (open as any)(file, ...args);
  }) as any);
  const r = await runRuntimeMetadataBatch(input(), deps());
  expect(commands).toHaveLength(1); expect(transports).toHaveLength(0); expect(r.ownerPending).toBeNull();
  expect(r.retainedRootsComplete).toBe(true); expect(r.retainedRoots).toHaveLength(2);
  expect(r.retainedRoots.every((root: string) => fs.existsSync(root))).toBe(true);
  expect(r.cleanupComplete).toBe(false); expect(r.outputAccountingComplete).toBe(false); expect(r.targets[1]).toBe('NOT_RUN');
});
it('new canary preserves its resource receipt when final persistence fails', async () => {
  const open = fs.openSync.bind(fs);
  vi.spyOn(fs, 'openSync').mockImplementation(((file: any, ...args: any[]) => {
    if (String(file).endsWith('/canary/batch-result.json')) throw Error('SYNTHETIC_PERSIST_FAILURE');
    return (open as any)(file, ...args);
  }) as any);
  const r = await runRuntimeMetadataBatch(input(), deps());
  expect(commands).toHaveLength(1); expect(transports).toHaveLength(1); expect(r.ownerPending).toBeNull();
  expect(r.retainedRootsComplete).toBe(true); expect(r.cleanupComplete).toBe(true);
  expect(r.outputAccountingComplete).toBe(false); expect(prepareDelivery(r, 50).passes).toBe(false);
});
it('legacy cause still rejects failed final persistence', async () => {
  const i = input(), open = fs.openSync.bind(fs);
  vi.spyOn(fs, 'openSync').mockImplementation(((file: any, ...args: any[]) => {
    if (String(file) === path.join(i.evidenceDirectory, 'batch-result.json')) throw Error('SYNTHETIC_PERSIST_FAILURE');
    return (open as any)(file, ...args);
  }) as any);
  await expect(runCause({ ...i, preparedBytes: 0 }, { command, now: () => 1 })).rejects.toThrow('SYNTHETIC_PERSIST_FAILURE');
});

it('combined final persistence failure retains the known control roots and prevents the canary', async () => {
  fault = 'control-unknown'; const i = input(), open = fs.openSync.bind(fs);
  vi.spyOn(fs, 'openSync').mockImplementation(((file: any, ...args: any[]) => {
    if (String(file).endsWith('/control/batch-result.json') || String(file) === path.join(i.evidenceDirectory, 'batch-result.json')) throw Error('SYNTHETIC_FINAL_FAILURE');
    return (open as any)(file, ...args);
  }) as any);
  const r = await runRuntimeMetadataBatch(i, deps());
  expect(commands).toHaveLength(1); expect(transports).toHaveLength(0); expect(r.targets[1]).toBe('NOT_RUN');
  expect(r.knownTargetCalls).toBe(1); expect(r.targetCalls).toBe(1); expect(r.retainedRoots).toHaveLength(2);
  expect(r.retainedRootsComplete).toBe(true); expect(r.retainedRoots.every((p: string) => fs.existsSync(p))).toBe(true);
  expect(r.resultPersisted).toBe(false); expect(r.outputAccountingComplete).toBe(false); expect(r.withinBudget).toBe(false);
  expect(prepareDelivery(r, 50).passes).toBe(false); expect(prepareDelivery(r, 50).line).toContain('retainedRoots');
});
