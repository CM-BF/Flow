import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, lstat, symlink, link, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrustedToolWriter, openCalculatorToolFile, type CalculatorToolFile, type TrustedToolBinding } from './native-tool-writer.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const binding: TrustedToolBinding = { identity: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 },
  leaseId: '5b647dc2-9b9d-4c5c-9fd3-79a6d1b0a0f8', baseCommit: 'a'.repeat(40), generation: 1 };
const signal = () => new AbortController().signal;
const call = (overrides = {}) => ({ threadId: 'thread', turnId: 'turn', callId: 'call',
  arguments: { expectedSha256: digest('old'), contentsBase64: Buffer.from('new').toString('base64') }, ...overrides });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function memory() {
  let text = 'old', writes = 0, closes = 0;
  const target: CalculatorToolFile = { identity: { path: '/fixture/calculator.mjs', device: '1', inode: '2' },
    async read() { return Buffer.from(text); }, async replace(bytes) { writes++; text = Buffer.from(bytes).toString(); }, async close() { closes++; } };
  return { target, get writes() { return writes; }, get closes() { return closes; }, get text() { return text; } };
}
function gate(target: CalculatorToolFile, assertOwnership: (binding: TrustedToolBinding) => Promise<void> = async () => {}, abort = signal()) {
  const writer = createTrustedToolWriter({ binding, target, assertOwnership, signal: abort }); writer.bindTurn('thread', 'turn'); return writer;
}
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true }); });

test('writes only the pinned calculator, fsyncs and retains its inode; ACK recovery never writes again', async () => {
  const root = await realpath(await mkdtemp(join(process.env.FLOW_ENG01K_TMP ?? tmpdir(), 'calculator-'))); roots.push(root);
  await writeFile(join(root, 'calculator.mjs'), 'old'); await writeFile(join(root, 'baseline.txt'), 'untouched');
  const before = await lstat(join(root, 'calculator.mjs'), { bigint: true });
  const target = await openCalculatorToolFile(root); let checks = 0;
  const writer = gate(target, async value => { expect(value).toEqual(binding); checks++; });
  const first = await writer.invoke(call()); expect(first).toMatchObject({ state: 'written', sha256: digest('new') });
  expect(await writer.invoke(call())).toEqual(first); expect(checks).toBe(3);
  expect(await writer.close(signal())).toEqual({ hostWrite: 'settled', nativeWriteAccess: 'unknown' });
  expect((await lstat(join(root, 'calculator.mjs'), { bigint: true })).ino).toBe(before.ino);
  expect(await readFile(join(root, 'calculator.mjs'), 'utf8')).toBe('new');
  expect(await readFile(join(root, 'baseline.txt'), 'utf8')).toBe('untouched');
});

test('rejects another body or call id after one admission without an extra write', async () => {
  for (const changed of [call({ callId: 'other' }), call({ arguments: { expectedSha256: digest('old'), contentsBase64: 'WA==' } })]) {
    const m = memory(), writer = gate(m.target); await writer.invoke(call());
    expect(await writer.invoke(changed)).toEqual({ state: 'rejected', code: 'conflict' }); expect(m.writes).toBe(1);
    await writer.close(signal());
  }
});

test('replay rechecks current ownership and cannot reuse a stale lease ACK', async () => {
  const m = memory(); let allowed = true;
  const writer = gate(m.target, async () => { if (!allowed) throw Error('private ownership detail'); });
  await writer.invoke(call()); allowed = false;
  expect(await writer.invoke(call())).toEqual({ state: 'rejected', code: 'ownership-or-target' }); expect(m.writes).toBe(1); await writer.close(signal());
});

test('conflicting digest and unexpected path/oversized/base64 input are rejected before writing', async () => {
  const values = [{ ...call().arguments, expectedSha256: digest('different') }, { ...call().arguments, path: '../escape' },
    { ...call().arguments, contentsBase64: Buffer.alloc(2049).toString('base64') }, { ...call().arguments, contentsBase64: 'YQ' }];
  for (const args of values) {
    const m = memory(), writer = gate(m.target);
    expect((await writer.invoke(call({ arguments: args }))).state).toBe('rejected'); expect(m.writes).toBe(0); await writer.close(signal());
  }
});

test('turn mismatch and a changed trusted binding cannot reopen a gate', async () => {
  const m = memory(), writer = gate(m.target);
  expect(() => writer.bindTurn('thread', 'new-turn')).toThrow();
  expect((await writer.invoke(call())).state).toBe('rejected'); expect(m.writes).toBe(0); await writer.close(signal());
});

test('close seals admission before a late ownership check returns', async () => {
  const ready = deferred<void>(), m = memory(), writer = gate(m.target, () => ready.promise);
  const pending = writer.invoke(call()), closing = writer.close(signal());
  ready.resolve(); expect((await pending).state).toBe('rejected');
  expect(await closing).toEqual({ hostWrite: 'settled', nativeWriteAccess: 'unknown' }); expect(m.writes).toBe(0); expect(m.closes).toBe(1);
});

test('close waits for real write settlement and FD close, not native process close', async () => {
  const writing = deferred<void>(), finish = deferred<void>(), closed = deferred<void>(), m = memory();
  const target = { ...m.target, async replace(bytes: Uint8Array) { writing.resolve(); await finish.promise; await m.target.replace(bytes); },
    async close() { await closed.promise; await m.target.close(); } };
  const writer = gate(target), pending = writer.invoke(call()); await writing.promise;
  let settled = false; const closing = writer.close(signal()).then(value => { settled = true; return value; });
  await Promise.resolve(); expect(settled).toBe(false); expect(m.closes).toBe(0);
  finish.resolve(); await pending; await Promise.resolve(); expect(settled).toBe(false);
  closed.resolve(); expect((await closing).hostWrite).toBe('settled'); expect(m.closes).toBe(1);
});

test('a timed out drain remains unknown even after the late operation settles', async () => {
  const ready = deferred<void>(), m = memory(), writer = gate(m.target, () => ready.promise);
  const pending = writer.invoke(call()); const stop = new AbortController();
  const closing = writer.close(stop.signal); stop.abort();
  expect((await closing).hostWrite).toBe('unknown'); expect(m.closes).toBe(0);
  ready.resolve(); await pending;
  expect((await writer.close(signal())).hostWrite).toBe('unknown'); expect(m.writes).toBe(0); expect(m.closes).toBe(1);
});

test('partial write or close errors keep unknown and never replay the operation', async () => {
  const m = memory(); const writer = gate({ ...m.target, async replace(bytes) { await m.target.replace(bytes); throw Error('disk'); } });
  expect(await writer.invoke(call())).toEqual({ state: 'unknown' }); expect((await writer.invoke(call())).state).toBe('rejected');
  expect((await writer.close(signal())).hostWrite).toBe('unknown'); expect(m.writes).toBe(1);
  const other = gate({ ...memory().target, async close() { throw Error('private'); } }); expect((await other.close(signal())).hostWrite).toBe('unknown');
});

test('native cancellation seals before ownership resume and does not claim native revocation', async () => {
  const ready = deferred<void>(), m = memory(), abort = new AbortController(), writer = gate(m.target, () => ready.promise, abort.signal);
  const pending = writer.invoke(call()); abort.abort(); ready.resolve();
  expect((await pending).state).toBe('unknown'); expect(m.writes).toBe(0);
  expect((await writer.close(signal())).nativeWriteAccess).toBe('unknown');
});

test('cancelled observation retains a real pending write until its eventual close', async () => {
  const writing = deferred<void>(), finish = deferred<void>(), m = memory();
  const writer = gate({ ...m.target, async replace(bytes) { writing.resolve(); await finish.promise; await m.target.replace(bytes); } });
  const abort = new AbortController(), pending = writer.invoke(call(), abort.signal); await writing.promise;
  abort.abort(); expect(await pending).toEqual({ state: 'unknown' }); expect(m.closes).toBe(0);
  expect((await writer.close(abort.signal)).hostWrite).toBe('unknown'); expect(m.closes).toBe(0);
  finish.resolve(); expect((await writer.close(signal())).hostWrite).toBe('unknown'); expect(m.closes).toBe(1); expect(m.writes).toBe(1);
});

test('file port rejects symlinks/hardlinks and detects a path replaced after open', async () => {
  const root = await realpath(await mkdtemp(join(process.env.FLOW_ENG01K_TMP ?? tmpdir(), 'identity-'))); roots.push(root);
  const path = join(root, 'calculator.mjs'), other = join(root, 'other'); await writeFile(other, 'old');
  await symlink(other, path); await expect(openCalculatorToolFile(root)).rejects.toThrow(); await rm(path);
  await link(other, path); await expect(openCalculatorToolFile(root)).rejects.toThrow(); await rm(path);
  await writeFile(path, 'old'); const target = await openCalculatorToolFile(root); const writer = gate(target);
  await rm(path); await writeFile(path, 'swapped');
  expect((await writer.invoke(call())).state).toBe('rejected'); await writer.close(signal());
  expect(await readFile(path, 'utf8')).toBe('swapped'); expect(await readFile(other, 'utf8')).toBe('old');
});
