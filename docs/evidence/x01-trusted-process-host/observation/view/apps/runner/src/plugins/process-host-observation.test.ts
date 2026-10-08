import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { beforeEach, expect, test, vi } from 'vitest';
import { createTrustedProcessHost, type ProcessObservation } from './process-host.js';
import { FrameReader, FrameWriter, type ProcessIdentity } from './process-protocol.js';
import { type PluginToolInput } from './host.js';

const mock = vi.hoisted(() => ({ spawn: (..._args: unknown[]): unknown => { throw Error('Fake child not configured'); },
  finishFails: false, finished: 0, kept: 0, mode: 'success', failure: undefined as unknown }));
vi.mock('node:child_process', () => ({ spawn: (...args: unknown[]) => mock.spawn(...args) }));
vi.mock('./process-resources.js', () => ({ ProcessResources: { open: async () => ({
  reserve: async (identity: unknown) => ({ identity, scratch: '/fixture-only/no-real-directory' }),
  update: async () => {},
  finish: async () => { mock.finished++; if (mock.finishFails) throw Error('Synthetic cleanup unknown'); },
  keep: () => { mock.kept++; }, close: async () => {},
}) } }));

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
function input(): PluginToolInput {
  return { store: { root: '/fixture-only/store', storeId: 'owned', allowedDigests: ['a'.repeat(64)] },
    binding: { taskId: id('1'), bindingId: id('2'), invocationId: id('3'), attemptId: id('4'), ownerVersion: 1,
      material: { installationId: 'installed', storeId: 'owned', treeDigest: 'b'.repeat(64),
        artifact: { artifactId: id('5'), name: 'fixture', version: '1.0.0', bytes: 1,
          integrity: 'sha512-' + 'A'.repeat(86) + '==', sha256: 'a'.repeat(64) } }, configuration: { secret: 'PRIVATE_CONFIG' } },
    input: 'PRIVATE_INPUT', signal: new AbortController().signal, assertOwnership: () => {}, authorize: async () => {} };
}

/** In-memory streams and events only. This file never calls an operating-system spawn. */
function fakeChild(expected: PluginToolInput) {
  const child = Object.assign(new EventEmitter(), { pid: 4242 as number | undefined, exitCode: null as number | null,
    signalCode: null as string | null, stdout: new PassThrough(), stderr: new PassThrough(),
    stdin: undefined as unknown as Writable, stdio: [] as unknown[], kill: (_signal: string): boolean => false });
  const protocol = new PassThrough(); let identity: ProcessIdentity; let writer: FrameWriter;
  let request = 0, acknowledge: (() => void) | undefined, stopped = false;
  async function close(code: number, signal: string | null = null) {
    if (stopped) return; stopped = true; child.exitCode = code; child.signalCode = signal;
    child.stdout.end(); child.stderr.end();
    if (mock.mode !== 'missing-eof') protocol.end();
    await setImmediate(); child.emit('close', code, signal); acknowledge?.();
  }
  child.kill = signal => { void close(0, signal); return true; };
  async function exchange(value: Record<string, unknown>) {
    const ack = new Promise<void>(resolve => { acknowledge = resolve; }); request++;
    await writer.send(value); await ack; await setImmediate();
    if (stopped) throw Error('Fake child stopped');
  }
  async function run() {
    if (mock.mode === 'package-failed' || mock.mode === 'missing-eof') {
      await writer.send({ kind: 'error', code: 'PACKAGE_FAILED' }); await close(0); return;
    }
    await exchange({ kind: 'check' }); await exchange({ kind: 'authorize', phase: 'load' });
    await exchange({ kind: 'check' }); await exchange({ kind: 'check' });
    await exchange({ kind: 'authorize', phase: 'invoke' }); await exchange({ kind: 'check' }); await exchange({ kind: 'check' });
    const b = expected.binding;
    await writer.send({ kind: 'result', value: { kind: 'text', content: 'PRIVATE_RESULT', provenance: {
      bindingId: b.bindingId, invocationId: b.invocationId, taskId: b.taskId, attemptId: b.attemptId, ownerVersion: b.ownerVersion,
      installationId: b.material.installationId, artifactId: b.material.artifact.artifactId,
      artifactSha256: b.material.artifact.sha256, treeDigest: b.material.treeDigest, hostApiMajor: 1,
    } } });
    await close(0);
  }
  const incoming = new FrameReader(192 * 1024, frame => {
    if (frame.kind === 'init') {
      identity = frame.identity; writer = new FrameWriter(protocol, identity);
      void setImmediate().then(run).catch(error => { if (!stopped) mock.failure = error; });
    } else if (frame.kind === 'ack') {
      if (frame.request !== request) mock.failure = Error('Wrong acknowledgement');
      acknowledge?.();
    }
  });
  child.stdin = new Writable({ write(chunk, _encoding, done) { try { incoming.push(chunk); done(); } catch (error) { done(error as Error); } } });
  child.stdio = [child.stdin, child.stdout, child.stderr, protocol];
  queueMicrotask(() => child.emit('spawn'));
  return child;
}
beforeEach(() => { mock.finishFails = false; mock.finished = 0; mock.kept = 0; mock.mode = 'success'; mock.failure = undefined; });

test('owned child observations bind safe identity and only report removed after resource finish', async () => {
  const value = input(), facts: ProcessObservation[] = []; mock.spawn = () => fakeChild(value);
  const host = await createTrustedProcessHost({ resourceRoot: '/fixture-only', observe: fact => {
    expect(Object.isFrozen(fact)).toBe(true);
    expect(mock.finished).toBe(fact.stage === 'settled' ? 1 : 0); facts.push(fact);
  } });
  expect((await host.invokeVerifier(value)).content).toBe('PRIVATE_RESULT'); await host.close();
  expect(mock.failure).toBeUndefined(); expect(facts.map(f => f.stage)).toEqual(['launched', 'settled']);
  expect(facts[0]).toMatchObject({ type: 'plugin-process', executionKind: 'verifier', workerEntry: 'flow.runner.process-worker.v1',
    taskId: value.binding.taskId, bindingId: value.binding.bindingId, invocationId: value.binding.invocationId,
    attemptId: value.binding.attemptId, ownerVersion: 1, pid: 4242, resourceState: 'reserved', processClosed: false });
  expect(facts[1]).toMatchObject({ pid: 4242, exitCode: 0, signal: null, protocolEof: true, stdoutEof: true,
    stderrEof: true, processClosed: true, resourceState: 'removed', observerError: null, launchedAt: facts[0]!.launchedAt });
  for (const fact of facts) {
    expect(fact.observedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    const encoded = JSON.stringify(fact); expect(Buffer.byteLength(encoded)).toBeLessThanOrEqual(2048);
    for (const forbidden of ['nonce', 'PRIVATE_', 'sha256', 'treeDigest', '/fixture-only', 'argv', 'token']) expect(encoded).not.toContain(forbidden);
  }
});

test('observer exceptions do not mask a known package error or prevent cleanup', async () => {
  const value = input(), facts: ProcessObservation[] = []; mock.mode = 'package-failed'; mock.spawn = () => fakeChild(value);
  const host = await createTrustedProcessHost({ resourceRoot: '/fixture-only', observe: fact => {
    facts.push(fact); throw Error('PRIVATE_OBSERVER_ERROR');
  } });
  await expect(host.invoke(value)).rejects.toMatchObject({ code: 'PACKAGE_FAILED' }); await host.close();
  expect(mock.finished).toBe(1); expect(mock.kept).toBe(0);
  expect(facts[1]).toMatchObject({ executionKind: 'tool', resourceState: 'removed', observerError: 'OBSERVER_FAILED' });
});

test('cleanup unknown remains unknown after a known package failure and observes no removal', async () => {
  const value = input(), facts: ProcessObservation[] = []; mock.mode = 'package-failed'; mock.finishFails = true; mock.spawn = () => fakeChild(value);
  const host = await createTrustedProcessHost({ resourceRoot: '/fixture-only', observe: fact => facts.push(fact) });
  await expect(host.invokeVerifier(value)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN', cause: { code: 'PACKAGE_FAILED' } });
  expect(mock.finished).toBe(1); expect(mock.kept).toBe(1);
  expect(facts[1]).toMatchObject({ processClosed: true, resourceState: 'unknown' });
});

test('missing protocol EOF retains resources and never claims process closure', async () => {
  const value = input(), facts: ProcessObservation[] = []; mock.mode = 'missing-eof'; mock.spawn = () => fakeChild(value);
  const host = await createTrustedProcessHost({ resourceRoot: '/fixture-only', observe: fact => facts.push(fact) });
  await expect(host.invoke(value)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN' });
  expect(mock.finished).toBe(0); expect(mock.kept).toBe(1);
  expect(facts[1]).toMatchObject({ protocolEof: false, stdoutEof: true, stderrEof: true, processClosed: false, resourceState: 'unknown' });
});

test('cancellation preserves unknown execution while reporting actual fake handle settlement', async () => {
  const value = input(), abort = new AbortController(), facts: ProcessObservation[] = [];
  value.signal = abort.signal; value.authorize = async () => { abort.abort(); }; mock.spawn = () => fakeChild(value);
  const host = await createTrustedProcessHost({ resourceRoot: '/fixture-only', observe: fact => facts.push(fact) });
  await expect(host.invokeVerifier(value)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN' });
  expect(facts[1]).toMatchObject({ stage: 'settled', pid: 4242, signal: 'SIGTERM', processClosed: true, resourceState: 'removed' });
  expect(mock.finished).toBe(1);
});
