import { it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { retainPrivateText, removePrivateText } from './private-text.mjs';
import { runCause, makeCauseBudget } from '../node-loader-cause/host.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';
const roots: string[] = [];
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const payload = Buffer.from('synthetic bounded failure: owned script unavailable\n');
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = fs.mkdtempSync('/private/tmp/flow-failure-text-test-'); roots.push(root);
  const evidenceDirectory = path.join(root, 'evidence'); fs.mkdirSync(evidenceDirectory);
  const io = { ...fs, mkdtempSync: () => fs.mkdtempSync(path.join(root, 'target-')) };
  return { root, evidenceDirectory, file: path.join(evidenceDirectory, 'private-stderr.raw'), io };
}
function response(budget: any, complete = true) {
  budget.observe(payload.length); budget.consume(payload.length);
  const stream = (bytes: Buffer) => ({ observedBytes: bytes.length, writtenBytes: bytes.length, truncated: false, observerFailed: false,
    streamEnded: complete, childCloseObserved: complete, incomplete: !complete });
  return { safe: { reason: 'completed', code: 1, signal: null, closeObserved: complete, groupGone: complete,
    streams: { stdout: stream(Buffer.alloc(0)), stderr: stream(payload) } }, stdout: Buffer.alloc(0), stderr: payload };
}
function args(t: any) { return { repository: process.cwd(), evidenceDirectory: t.evidenceDirectory, preparedBytes: 200000, roles: [], recipe: 'failure-text' }; }
it('one fixed target retains the second private copy while process and target roots are cleaned', async () => {
  const t = setup(); const command = vi.fn(async (options, budget) => {
    expect(options.captureMaxBytes).toBe(8192); expect(options.args.slice(-3, -1)).toEqual(['--jitless', '--no-addons']);
    expect(options.environment).not.toHaveProperty('NODE_OPTIONS');
    const profile = fs.readFileSync(options.args[options.args.indexOf('-f') + 1]);
    expect(hash(profile)).toBe('37023e6516aa4ef6552a720b7d08d27aadb48fc7947d36b414ebd5c329391213');
    return response(budget);
  });
  const r = await runCause(args(t), { io: t.io, command, now: () => 1 });
  expect(command).toHaveBeenCalledOnce(); expect(r.targetCalls).toBe(1); expect(r.processCleanupComplete).toBe(true);
  expect(r.retainedRoots).toEqual([]); expect(r.retainedDiagnosticArtifact).toMatchObject({ owned: true, complete: true, closed: true, removed: false, bytes: payload.length });
  expect(fs.readFileSync(t.file)).toEqual(payload); expect(fs.statSync(t.file).mode & 0o777).toBe(0o600);
  expect(r.output.disk).toBe(16762 + 379 + 2 * payload.length); expect(r.output.observed).toBe(payload.length);
  expect(r.output.limit).toBe(1048576); expect(r.observation.errorClass).toBe('UNKNOWN'); expect(r.observationComplete).toBe(true);
  expect(prepareDelivery(r, 2).passes).toBe(true);
  expect(removePrivateText(r.retainedDiagnosticArtifact)).toEqual({ removed: true, reason: 'exact-owned-file-removed' });
});
it.each(['loader-cause', 'runtime-metadata-control'])('old %s recipe never creates the retained diagnostic copy', async recipe => {
  const t = setup(); const r = await runCause({ ...args(t), recipe, preparedBytes: 0 }, { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b) });
  expect(r).not.toHaveProperty('retainedDiagnosticArtifact'); expect(fs.existsSync(t.file)).toBe(false); expect(r.output.limit).toBe(262144);
});
it('final safe receipt failure returns retained diagnostic identity without pretending persistence succeeded', async () => {
  const t = setup(); const open = t.io.openSync;
  t.io.openSync = ((file: any, ...rest: any[]) => { if (String(file).endsWith('/batch-result.json')) throw Error('SYNTHETIC_FINAL'); return (open as any)(file, ...rest); }) as any;
  const r = await runCause(args(t), { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b) });
  expect(r.resultPersisted).toBe(false); expect(r.retainedDiagnosticArtifact.complete).toBe(true);
  expect(r.retainedDiagnosticArtifact.identity).not.toBeNull(); expect(r.processCleanupComplete).toBe(true);
  expect(r.outputAccountingComplete).toBe(false); expect(prepareDelivery(r, 2).passes).toBe(false);
  expect(prepareDelivery(r, 2).line).not.toContain(payload.toString());
});
it('unknown process/group or stream completion retains target roots and labels private text incomplete', async () => {
  const t = setup(); const r = await runCause(args(t), { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b, false) });
  expect(r.processCleanupComplete).toBe(false); expect(r.retainedRoots).toHaveLength(2);
  expect(r.retainedDiagnosticArtifact).toMatchObject({ owned: true, complete: false, inputComplete: false, removed: false });
  expect(r.outputAccountingComplete).toBe(false); expect(prepareDelivery(r, 2).passes).toBe(false);
});
it('successful partial writes count before a later failure and exact post-diagnosis cleanup is explicit', () => {
  const t = setup(); let writes = 0; const budget = makeCauseBudget(0, 'failure-text');
  t.io.writeSync = ((fd: any, b: any, offset: any) => { if (writes++) throw Error('SYNTHETIC_WRITE'); return fs.writeSync(fd, b, offset, 3); }) as any;
  const a = retainPrivateText(t.file, payload, true, budget, t.io);
  expect(a).toMatchObject({ owned: true, closed: true, complete: false, bytes: 3, sha256: hash(payload.subarray(0, 3)) });
  expect(budget.snapshot().disk).toBe(3); expect(fs.statSync(t.file).size).toBe(3); expect(removePrivateText(a).removed).toBe(true);
});
it('partial write loops followed by fsync and close failures retain safe identity without double close', () => {
  const t = setup(); let closes = 0; const budget = makeCauseBudget(0, 'failure-text');
  t.io.writeSync = ((fd: any, b: any, offset: any, length: any) => fs.writeSync(fd, b, offset, Math.min(3, length))) as any;
  t.io.fsyncSync = () => { throw Error('SYNTHETIC_FSYNC'); };
  t.io.closeSync = fd => { closes++; fs.closeSync(fd); throw Error('SYNTHETIC_CLOSE'); };
  const a = retainPrivateText(t.file, payload, true, budget, t.io);
  expect(closes).toBe(1); expect(a.bytes).toBe(payload.length); expect(budget.snapshot().disk).toBe(payload.length);
  expect(a).toMatchObject({ owned: true, closed: false, complete: false, flushed: false }); expect(a.identity).not.toBeNull();
  expect(removePrivateText(a).removed).toBe(false); expect(fs.existsSync(t.file)).toBe(true);
});
it('fstat failure still reports creation and an unknown identity', () => {
  const t = setup(); t.io.fstatSync = () => { throw Error('SYNTHETIC_FSTAT'); };
  const a = retainPrivateText(t.file, payload, true, makeCauseBudget(0, 'failure-text'), t.io);
  expect(a).toMatchObject({ owned: true, identity: null, closed: true, complete: false, bytes: 0 });
  expect(fs.existsSync(t.file)).toBe(true); expect(removePrivateText(a).removed).toBe(false);
});
it('EEXIST never adopts or deletes a previous file', () => {
  const t = setup(); fs.writeFileSync(t.file, 'prior', { mode: 0o600 });
  const a = retainPrivateText(t.file, payload, true, makeCauseBudget(0, 'failure-text'));
  expect(a).toMatchObject({ owned: false, identity: null, bytes: 0, complete: false }); expect(removePrivateText(a).removed).toBe(false);
  expect(fs.readFileSync(t.file, 'utf8')).toBe('prior');
});
it('replacement inode blocks diagnostic cleanup', () => {
  const t = setup(), a = retainPrivateText(t.file, payload, true, makeCauseBudget(0, 'failure-text'));
  fs.renameSync(t.file, t.file + '.original'); fs.writeFileSync(t.file, payload, { mode: 0o600 });
  expect(removePrivateText(a)).toEqual({ removed: false, reason: 'identity-changed' }); expect(fs.existsSync(t.file)).toBe(true);
});
it('the 8KiB private copy cap and separate 1MiB recipe budget do not change old budgets', () => {
  const t = setup(), b = makeCauseBudget(200000, 'failure-text');
  const a = retainPrivateText(t.file, Buffer.alloc(8193), true, b);
  expect(a.owned).toBe(false); expect(fs.existsSync(t.file)).toBe(false); expect(b.snapshot().disk).toBe(0);
  expect(() => makeCauseBudget(200000)).toThrow(); expect(() => makeCauseBudget(1, 'runtime-metadata-control')).toThrow();
  expect(() => makeCauseBudget(262145, 'failure-text')).toThrow();
});
it('late completion cannot pass merely because complete error text was retained', async () => {
  const t = setup(); let now = 1;
  const r = await runCause(args(t), { io: t.io, now: () => now, command: async (_: any, b: any) => { const value = response(b); now = 30001; return value; } });
  expect(r.retainedDiagnosticArtifact.complete).toBe(true); expect(r.withinBudget).toBe(false); expect(prepareDelivery(r, 30001).passes).toBe(false);
});
it('known closed process still retains an explicitly incomplete captured prefix', async () => {
  const t = setup();
  const r = await runCause(args(t), { io: t.io, now: () => 1, command: async (_: any, b: any) => {
    const value = response(b); value.safe.streams.stderr.truncated = true; value.safe.streams.stderr.observedBytes++; b.observe(1); return value;
  } });
  expect(r.processCleanupComplete).toBe(true); expect(r.retainedDiagnosticArtifact).toMatchObject({ owned: true, closed: true, complete: false, inputComplete: false, removed: false });
  expect(fs.readFileSync(t.file)).toEqual(payload); expect(r.outputAccountingComplete).toBe(false); expect(prepareDelivery(r, 2).passes).toBe(false);
});
it('partial diagnostic copy failure retains the complete original stderr with exact identity', async () => {
  const t = setup(); let diagnosticFd = -1, writes = 0;
  const open = t.io.openSync, write = t.io.writeSync;
  t.io.openSync = ((file: any, ...rest: any[]) => { const fd = (open as any)(file, ...rest); if (String(file) === t.file) diagnosticFd = fd; return fd; }) as any;
  t.io.writeSync = ((fd: any, buffer: any, offset: any, length: any) => {
    if (fd === diagnosticFd) { if (writes++) throw Error('SYNTHETIC_COPY'); return fs.writeSync(fd, buffer, offset, 3); }
    return (write as any)(fd, buffer, offset, length);
  }) as any;
  const close = t.io.closeSync; t.io.closeSync = fd => { close(fd); if (fd === diagnosticFd) diagnosticFd = -1; };
  const r = await runCause(args(t), { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b) });
  expect(r.retainedDiagnosticArtifact).toMatchObject({ complete: false, bytes: 3, removed: false });
  expect(r.cleanupComplete).toBe(false); expect(r.retainedRoots).toHaveLength(2);
  const original = r.privateFiles.find((f: any) => f.file.endsWith('/stderr.raw'));
  expect(original).toMatchObject({ closed: true, removed: false, bytes: payload.length, sha256: hash(payload) });
  const stat = fs.lstatSync(original.file); expect({ dev: stat.dev, ino: stat.ino }).toEqual({ dev: original.identity.dev, ino: original.identity.ino });
  expect(fs.readFileSync(original.file)).toEqual(payload); expect(prepareDelivery(r, 2).passes).toBe(false);
});
it('failure to create the original raw still leaves the diagnostic text already retained', async () => {
  const t = setup(); const open = t.io.openSync;
  t.io.openSync = ((file: any, ...rest: any[]) => { if (String(file).endsWith('/stderr.raw')) throw Error('SYNTHETIC_ORIGINAL'); return (open as any)(file, ...rest); }) as any;
  const r = await runCause(args(t), { io: t.io, now: () => 1, command: async (_: any, b: any) => response(b) });
  expect(r.retainedDiagnosticArtifact).toMatchObject({ complete: true, bytes: payload.length, removed: false });
  expect(fs.readFileSync(t.file)).toEqual(payload); expect(prepareDelivery(r, 2).passes).toBe(false);
});
