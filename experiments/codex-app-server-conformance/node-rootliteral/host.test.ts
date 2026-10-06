import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hook = vi.hoisted(() => ({ calls: 0, stage: 0, fault: '', privateRoots: [] as string[], base: '' }));
vi.mock('../../../apps/runner/src/codex/index.ts', () => ({ createCodexTransport: () => { throw Error('Real transport forbidden in tests'); } }));
vi.mock('node:fs', async original => {
  const real = await original<typeof import('node:fs')>();
  return { ...real, default: { ...real, mkdtempSync(prefix: string) {
    if (!prefix.startsWith('/private/tmp/flow-wpf02-private-')) return real.mkdtempSync(prefix);
    const result = real.mkdtempSync(path.join(hook.base, 'private-')); hook.privateRoots.push(result); return result;
  } } };
});
import { makeNodeBudget, runNodeRootliteralBatch } from './host.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';
import { makePrivateSink, finalizeFile } from '../diagnostics/run-diagnostics.mjs';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
// The control's literal payload is sourced directly; never execute that script.
const control = Buffer.concat([Buffer.from('flow-diag-prefix\n'), Buffer.from('中🙂'), Buffer.from('\nflow-diag-tail\n')]);
let base: string;
let elapsed: number;
let closed: any;
function factory(options: any) {
  hook.calls++;
  const stderr = hook.calls === 3 ? Buffer.alloc(0) : hook.fault === 'extra-stderr' ? Buffer.from('unexpected') : control;
  options.privateStderr.write(stderr);
  const unknown = hook.fault === 'unknown-close';
  closed = { reason: 'DISCONNECTED', child: unknown ? 'unconfirmed' : 'confirmed-exited', exitCode: hook.calls === 3 ? 0 : 7,
    signal: null, remoteEffects: 'unknown', stderrCapture: { observedBytes: stderr.length, writtenBytes: stderr.length,
      streamEnded: !unknown, childCloseObserved: !unknown, incomplete: unknown || hook.fault === 'capture-incomplete',
      truncated: false, observerFailed: false } };
  const ready = hook.calls === 3 ? Promise.resolve({ userAgent: 'synthetic/1' }) : Promise.reject(Error('expected'));
  void ready.catch(() => {});
  return { ready, closed: Promise.resolve(closed), close: () => Promise.resolve(closed) };
}
async function compose(create: any, options: any) {
  const directory = fs.mkdtempSync(path.join(base, 'composition-'));
  fs.mkdirSync(path.join(directory, 'control')); fs.mkdirSync(path.join(directory, 'state'));
  fs.writeFileSync(path.join(directory, 'control/config.json'), '{}');
  const index = hook.stage++;
  const transport = create({ spawn: { executable: index === 0 ? '/opt/homebrew/Cellar/node@24/24.20.0/bin/node' : '/usr/bin/sandbox-exec',
    cwd: path.join(directory, 'state'), args: [], environment: {} }, limits: {} });
  await transport.ready.catch(() => {}); await transport.close();
  const clean = closed.child === 'confirmed-exited';
  if (clean) fs.rmSync(directory, { recursive: true });
  if (hook.fault === 'clock-after-first') elapsed = 45000;
  return { passed: true, reason: 'fixture', stdoutBoundConfirmed: hook.fault !== 'protocol-close', listenerClosed: clean, retainedRoots: clean ? [] : [directory],
    report: index === 2 ? { passed: true } : undefined,
    outputInventory: { complete: hook.fault !== 'inventory-unknown', bytes: 2, files: [] },
    listener: { created: options.scenario === 'node-canary', accepted: 0 } };
}
const run = () => runNodeRootliteralBatch({ evidenceDirectory: path.join(base, 'evidence'), peerBytes: Buffer.from('test'), preparedEvidenceBytes: 100 },
  { createTransport: factory, compose, now: () => elapsed, start: 0 });
beforeEach(() => {
  base = fs.mkdtempSync('/private/tmp/flow-node-host-test-'); hook.base = base;
  fs.mkdirSync(path.join(base, 'evidence')); hook.calls = 0; hook.stage = 0; hook.fault = ''; hook.privateRoots = []; elapsed = 10;
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(base, { recursive: true, force: true }); }); // Only this zero-child fixture parent.

test('fixture constant is the approved complete forty-byte payload', () => {
  expect(control.length).toBe(40); expect(sha(control)).toBe('ca5c7bbdd4599b7cb7154d4895952561b9f7e94d48d84dba22c898910af1130c');
});
test('three stages reserve once, clean actual private files, count stream and disk separately', async () => {
  const result = await run();
  expect(result.targets).toEqual(['EXPECTED', 'EXPECTED', 'EXPECTED']); expect(hook.calls).toBe(3);
  expect(result).toMatchObject({ cleanupComplete: true, outputAccountingComplete: true, measurementComplete: true, resultPersisted: true });
  expect(result.output).toMatchObject({ captured: 80, diskCopies: 86, stdoutSourceUpperBound: 182 });
  expect(result.stages.map((s: any) => s.observation.listener.created)).toEqual([false, false, true]);
  expect(hook.privateRoots.every(p => !fs.existsSync(p))).toBe(true);
  await expect(run()).rejects.toThrow(); expect(hook.calls).toBe(3);
});
test.each(['extra-stderr', 'capture-incomplete', 'inventory-unknown', 'protocol-close'])('%s stops after one consumed target', async fault => {
  hook.fault = fault; const result = await run();
  expect(hook.calls).toBe(1); expect(result.targets.slice(1)).toEqual(['NOT_RUN', 'NOT_RUN']); expect(result.measurementComplete).toBe(false);
  expect(prepareDelivery(result, 20).passes).toBe(false);
});
test('unknown child close retains both composition and private roots without claiming cleanup', async () => {
  hook.fault = 'unknown-close'; const result = await run();
  expect(hook.calls).toBe(1); expect(result).toMatchObject({ requiresHostExit: true, cleanupComplete: false, outputAccountingComplete: false });
  expect(hook.privateRoots.every(p => fs.existsSync(p))).toBe(true);
  expect(result.privateArtifacts[0]).toMatchObject({ close: true, removed: false, retained: true });
});
test('remaining cleanup margin stops second slot despite a passing first control', async () => {
  hook.fault = 'clock-after-first'; const result = await run();
  expect(hook.calls).toBe(1); expect(result.targets).toEqual(['EXPECTED', 'NOT_RUN', 'NOT_RUN']); expect(result.stopReason).toBe('budget-insufficient');
});
test('output/CLI gate rejects late completion, receipt overflow and unpersisted evidence', async () => {
  const result = await run(); expect(prepareDelivery(result, 20).passes).toBe(true);
  expect(prepareDelivery(result, 60001).passes).toBe(false);
  expect(prepareDelivery({ ...result, inventoryPersisted: false }, 20).passes).toBe(false);
  expect(prepareDelivery({ ...result, output: { ...result.output, receipts: 32768 } }, 20).passes).toBe(false);
});
test('shared budget counts consumed bytes even when an observer then exceeds the cap', () => {
  const budget = makeNodeBudget(0); expect(() => budget.add('captured', 2097152)).toThrow();
  expect(budget.snapshot().captured).toBe(2097152); expect(budget.canStart()).toBe(false);
});

test('partial private write counts captured bytes and only actual disk writes, then closes safely', () => {
  const directory = path.join(base, 'sink'); fs.mkdirSync(directory);
  const records: any[] = []; let captured = 0; let disk = 0;
  const sink = makePrivateSink(directory, 1, records, 'unused', { observe: (n: number) => { captured += n; }, persist: (n: number) => { disk += n; } });
  const write = fs.writeSync; let calls = 0;
  vi.spyOn(fs, 'writeSync').mockImplementation(((fd: number, bytes: Buffer, offset: number, _length: number) => {
    if (calls++) throw Error('OWNED_PARTIAL_FAILURE'); return write(fd, bytes, offset, 3);
  }) as any);
  expect(() => sink.option.write(Buffer.from('12345678'))).toThrow();
  finalizeFile(records[0], 'unused');
  expect({ captured, disk }).toEqual({ captured: 8, disk: 3 }); expect(records[0]).toMatchObject({ bytes: 3, flush: true, close: true });
});
test('late final fsync is included in internal completion rather than preserving an earlier pass', async () => {
  const open = fs.openSync; const sync = fs.fsyncSync; let resultFd = -1;
  vi.spyOn(fs, 'openSync').mockImplementation(((file: string, ...args: any[]) => {
    const fd = (open as any)(file, ...args); if (file.endsWith('/batch-result.json')) resultFd = fd; return fd;
  }) as any);
  vi.spyOn(fs, 'fsyncSync').mockImplementation(fd => { sync(fd); if (fd === resultFd) elapsed = 60001; });
  const result = await run(); expect(result.measurementComplete).toBe(true); expect(result.finalElapsedMs).toBe(60001); expect(result.withinBudget).toBe(false);
});

test('composition rejection before factory retains private root and cleanup/stdout remain unknown', async () => {
  const result = await runNodeRootliteralBatch({ evidenceDirectory: path.join(base, 'evidence'), peerBytes: Buffer.from('test'), preparedEvidenceBytes: 100 },
    { createTransport: factory, compose: async () => { throw Error('FAKE_COMPOSITION_REJECTION'); }, now: () => elapsed, start: 0 });
  expect(hook.calls).toBe(0);
  expect(result).toMatchObject({ cleanupComplete: false, outputAccountingComplete: false, stdoutBoundsConfirmed: false });
  expect(result.privateCleanup.retained).toEqual(hook.privateRoots);
  expect(hook.privateRoots.every(p => fs.existsSync(p))).toBe(true);
  expect(prepareDelivery(result, 20).passes).toBe(false);
});

test('delivery reserves the outer observed stderr copy and receipts inside the total cap', async () => {
  const result = await run();
  const candidate = { ...result, output: { ...result.output, measuredBytes: 1000000 } };
  const bytes = prepareDelivery(candidate, 20).bytes;
  candidate.output.measuredBytes = 2097152 - 131072 - bytes;
  expect(prepareDelivery(candidate, 20).bytes).toBe(bytes);
  expect(candidate.output.measuredBytes + bytes + 131072).toBe(2097152);
  expect(prepareDelivery(candidate, 20).passes).toBe(false);
});
