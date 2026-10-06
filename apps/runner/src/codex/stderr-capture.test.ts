import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createCodexTransport, type TransportOptions } from './index.js';

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn: spawnMock }));

// In-process only: never starts a real child or reads a provider/account environment.
class FakeChild extends EventEmitter {
  pid = 123;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stdout = new PassThrough();
  stderr = new PassThrough();
  writes: string[] = [];
  signals: string[] = [];
  stdin = new Writable({ write: (bytes, _encoding, done) => { this.writes.push(bytes.toString()); done(); } });
  kill(signal: string) { this.signals.push(signal); return true; }
  exit(code = 7) { this.exitCode = code; this.emit('exit', code, null); }
  async close() {
    this.stdout.end(); this.stderr.end();
    await vi.advanceTimersByTimeAsync(0);
    this.emit('close', this.exitCode, this.signalCode);
  }
}
const children: FakeChild[] = [];
const transports: ReturnType<typeof createCodexTransport>[] = [];
const options = (privateStderr?: TransportOptions['privateStderr']): TransportOptions => ({
  spawn: { executable: '/synthetic/node', args: [], cwd: '/synthetic/empty', environment: { LANG: 'C' } },
  initialize: { clientInfo: { name: 'diagnostic-unit', title: null, version: '1' }, capabilities: null },
  limits: { initializeTimeoutMs: 100, terminateMs: 20, killMs: 30 },
  ...(privateStderr === undefined ? {} : { privateStderr }),
});
function open(privateStderr?: TransportOptions['privateStderr']) {
  const child = new FakeChild(); children.push(child); spawnMock.mockReturnValueOnce(child);
  const transport = createCodexTransport(options(privateStderr)); transports.push(transport);
  return { child, transport };
}
async function ready(child: FakeChild, transport: ReturnType<typeof createCodexTransport>) {
  await vi.advanceTimersByTimeAsync(0);
  child.stdout.write(JSON.stringify({ id: 1, result: { userAgent: 'synthetic/1', platformFamily: 'unix', platformOs: 'test', codexHome: '/private-synthetic' } }) + '\n');
  await transport.ready;
}
beforeEach(() => { vi.useFakeTimers(); spawnMock.mockReset(); });
afterEach(async () => {
  const reports = transports.splice(0).map(t => t.close());
  await vi.advanceTimersByTimeAsync(1000);
  await Promise.all(reports);
  for (const child of children.splice(0)) child.removeAllListeners();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

test('default off preserves immediate exited-close timing, report shape and count-only diagnostics', async () => {
  const { child, transport } = open(); await ready(child, transport);
  child.stderr.write('PRIVATE_SENTINEL'); child.exit();
  const closing = transport.close();
  expect(transport.snapshot().state).toBe('closed');
  expect(await closing).toEqual({ reason: 'CLOSED', child: 'confirmed-exited', exitCode: 7, signal: null, remoteEffects: 'unknown' });
  expect(transport.snapshot().stderrBytes).toBe(16);
  expect(JSON.stringify(transport.snapshot())).not.toContain('PRIVATE_SENTINEL');
});

test.each([null, { maxBytes: 0, write() {} }, { maxBytes: 65537, write() {} }, { maxBytes: 2.5, write() {} }, { maxBytes: 1, write: null }])('invalid private sink rejects before spawn: %j', value => {
  expect(() => createCodexTransport({ ...options(), privateStderr: value as never })).toThrow('INVALID_OPTIONS');
  expect(spawnMock).not.toHaveBeenCalled();
});

test('copied descriptor and byte reservation preserve the exact UTF8 prefix under mutation and reentrant close', async () => {
  const chunks: Uint8Array[] = [];
  let transport!: ReturnType<typeof createCodexTransport>;
  const sink = { maxBytes: 5, write(bytes: Uint8Array) { chunks.push(bytes); void transport.close(); } };
  const opened = open(sink); transport = opened.transport;
  sink.maxBytes = 65536; sink.write = () => { throw Error('replaced callback'); };
  const bytes = Buffer.from('文🙂tail');
  opened.child.stderr.write(bytes.subarray(0, 2)); opened.child.stderr.write(bytes.subarray(2));
  opened.child.exit(); await opened.child.close();
  expect(Buffer.concat(chunks)).toEqual(bytes.subarray(0, 5));
  expect((await transport.closed).stderrCapture).toEqual({ observedBytes: bytes.length, writtenBytes: 5, truncated: true, observerFailed: false, streamEnded: true, childCloseObserved: true, incomplete: false });
});

test('total copied delivery is at most 64KiB even during nested stderr delivery', async () => {
  let total = 0; let child!: FakeChild;
  const opened = open({ maxBytes: 65536, write(bytes) { total += bytes.length; child.stderr.emit('data', Buffer.alloc(100)); } }); child = opened.child;
  child.stderr.write(Buffer.alloc(100000)); child.stderr.write(Buffer.alloc(100000));
  child.exit(); await child.close();
  expect(total).toBe(65536);
  expect((await opened.transport.closed).stderrCapture).toMatchObject({ writtenBytes: 65536, observerFailed: true, truncated: true });
});

test.each(['throw', 'reject', 'thenable', 'throwing-then-getter'])('sink %s fails observation once, handles rejection and never exposes the error', async mode => {
  const callback = vi.fn(() => {
    if (mode === 'throw') throw Error('PRIVATE_SENTINEL');
    if (mode === 'reject') return Promise.reject(Error('PRIVATE_SENTINEL'));
    if (mode === 'throwing-then-getter') return Object.defineProperty({}, 'then', { get() { throw Error('PRIVATE_SENTINEL'); } });
    return { then(_resolve: unknown, reject: (error: Error) => void) { reject(Error('PRIVATE_SENTINEL')); } };
  });
  const { child, transport } = open({ maxBytes: 32, write: callback });
  child.stderr.write('first'); child.stderr.write('never-deliver'); child.exit(); await child.close();
  expect(callback).toHaveBeenCalledTimes(1);
  const report = await transport.closed;
  expect(report.stderrCapture).toMatchObject({ observerFailed: true, writtenBytes: 0, incomplete: false });
  const error = await transport.ready.catch(error => error);
  expect(JSON.stringify([report, transport.snapshot(), error, error.message])).not.toContain('PRIVATE_SENTINEL');
});

test('a resolved async sink is also rejected as observation, without delivering later chunks', async () => {
  const write = vi.fn(async () => {}); const { child, transport } = open({ maxBytes: 16, write });
  child.stderr.write('one'); await vi.advanceTimersByTimeAsync(0); child.stderr.write('two');
  child.exit(); await child.close();
  expect(write).toHaveBeenCalledTimes(1); expect((await transport.closed).stderrCapture?.observerFailed).toBe(true);
});

test('exit before stderr tail and stdio close preserves all bytes without claiming early capture completion', async () => {
  const chunks: Uint8Array[] = [];
  const { child, transport } = open({ maxBytes: 64, write(bytes) { chunks.push(bytes); } });
  child.stderr.write('before'); child.exit();
  expect(transport.snapshot().state).toBe('closing'); expect(child.stderr.destroyed).toBe(false);
  await vi.advanceTimersByTimeAsync(15); child.stderr.write('TAIL');
  expect(transport.snapshot().state).toBe('closing');
  await child.close();
  expect(Buffer.concat(chunks).toString()).toBe('beforeTAIL');
  expect((await transport.closed).stderrCapture).toMatchObject({ writtenBytes: 10, streamEnded: true, childCloseObserved: true, incomplete: false });
  expect(child.signals).toEqual([]);
});

test('repeated close and chunks never extend the first stop deadline; forced destroy is not EOF', async () => {
  const { child, transport } = open({ maxBytes: 2, write() {} });
  const closing = transport.close(); await vi.advanceTimersByTimeAsync(19);
  expect(transport.close()).toBe(closing); child.stderr.write('tail');
  await vi.advanceTimersByTimeAsync(1); expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  await vi.advanceTimersByTimeAsync(29); expect(transport.snapshot().state).toBe('closing');
  await vi.advanceTimersByTimeAsync(1);
  expect(await closing).toMatchObject({ child: 'unconfirmed', stderrCapture: { incomplete: true, streamEnded: false, childCloseObserved: false, truncated: true } });
  expect(child.stderr.destroyed).toBe(true);
});

test('exit after TERM skips KILL but still waits only to the existing absolute deadline for close', async () => {
  const { child, transport } = open({ maxBytes: 32, write() {} });
  const closing = transport.close(); await vi.advanceTimersByTimeAsync(5); child.exit();
  await vi.advanceTimersByTimeAsync(45);
  expect(child.signals).toEqual(['SIGTERM']);
  expect(await closing).toMatchObject({ child: 'confirmed-exited', stderrCapture: { incomplete: true, childCloseObserved: false } });
});

test('stream error remains incomplete even if end and close later arrive, with safe error shape', async () => {
  const { child, transport } = open({ maxBytes: 32, write() {} });
  child.stderr.emit('error', Error('PRIVATE_SENTINEL')); child.exit(); await child.close();
  const report = await transport.closed;
  expect(report).toMatchObject({ reason: 'DISCONNECTED', stderrCapture: { streamEnded: true, incomplete: true } });
  expect(JSON.stringify([report, transport.snapshot(), await transport.ready.catch(e => e)])).not.toContain('PRIVATE_SENTINEL');
});

test('initialize timeout stays TIMEOUT and bounded close, not a diagnostic success', async () => {
  const { transport } = open({ maxBytes: 32, write() {} });
  await vi.advanceTimersByTimeAsync(150);
  expect(await transport.ready.catch(error => error)).toMatchObject({ code: 'TIMEOUT' });
  expect(await transport.closed).toMatchObject({ reason: 'TIMEOUT', child: 'unconfirmed', stderrCapture: { incomplete: true } });
});


test('sink descriptor is read once before validation, so changing getters cannot bypass the byte cap', async () => {
  let reads = 0; let delivered = 0;
  const { child, transport } = open({ get maxBytes() { return ++reads === 1 ? 3 : 1_000_000; }, write(bytes) { delivered += bytes.length; } });
  child.stderr.write(Buffer.alloc(100000)); child.exit(); await child.close();
  expect(reads).toBe(1); expect(delivered).toBe(3);
  expect((await transport.closed).stderrCapture).toMatchObject({ writtenBytes: 3, truncated: true });
});
