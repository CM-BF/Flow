import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const hook = vi.hoisted(() => ({ base: '', point: '', fired: false, privateRoot: '', fds: [] as number[], factoryCalls: 0, stderr: 'Operation not permitted' }));
vi.mock('node:fs', async importOriginal => {
  const real = await importOriginal<typeof import('node:fs')>();
  const mapped = (file: unknown) => typeof file === 'string' && file.includes('/docs/evidence/wpf-mature-02/diagnostics/')
    ? path.join(hook.base, 'evidence', path.basename(file)) : file;
  const fail = (point: string) => { if (hook.point === point && !hook.fired) { hook.fired = true; throw Error('PRIVATE_FAILURE_SENTINEL'); } };
  return { ...real, default: {
    ...real,
    readFileSync(file: unknown, ...args: any[]) { return (real.readFileSync as any)(mapped(file), ...args); },
    openSync(file: unknown, ...args: any[]) {
      const fd = (real.openSync as any)(mapped(file), ...args);
      if (typeof file === 'string' && file.endsWith('.stderr')) hook.fds.push(fd);
      return fd;
    },
    mkdtempSync(prefix: string) {
      hook.privateRoot = real.mkdtempSync(path.join(hook.base, 'owned-')); return hook.privateRoot;
    },
    chmodSync(file: string, mode: number) { if (file === hook.privateRoot) fail('root-chmod'); return real.chmodSync(file, mode); },
    lstatSync(file: string) { if (file === hook.privateRoot) fail('root-identity'); return real.lstatSync(file); },
    fstatSync(fd: number) { if (hook.fds.includes(fd)) fail('sink-fstat'); return real.fstatSync(fd); },
    closeSync(fd: number) {
      if (hook.fds.includes(fd)) fail('sink-close');
      real.closeSync(fd); hook.fds = hook.fds.filter(owned => owned !== fd);
    },
  } };
});
vi.mock('../../../apps/runner/src/codex/index.ts', () => ({ createCodexTransport(options: any) {
  hook.factoryCalls++;
  // Fake transport only; real owned files exercise host sink/cleanup, with no child or listener.
  const bytes = Buffer.from(hook.stderr); options.privateStderr.write(bytes);
  const report = { reason: 'DISCONNECTED', child: 'confirmed-exited', exitCode: 7, signal: null, remoteEffects: 'unknown',
    stderrCapture: { observedBytes: bytes.length, writtenBytes: bytes.length, truncated: false, observerFailed: false,
      streamEnded: true, childCloseObserved: true, incomplete: false } };
  const ready = Promise.reject(Error('safe synthetic startup')); void ready.catch(() => {});
  const closed = Promise.resolve(report);
  return { ready, closed, close: () => closed };
} }));
vi.mock('../isolation/compose-canary.mjs', () => ({ runSyntheticCanary() { throw Error('Control must stop before canary in preparation tests'); } }));
import { runDiagnosticBatch } from './run-diagnostics.mjs';
const real = await vi.importActual<typeof import('node:fs')>('node:fs');
beforeEach(() => {
  hook.base = real.mkdtempSync(path.join(os.tmpdir(), 'flow-diag-prep-test-'));
  real.mkdirSync(path.join(hook.base, 'evidence'), { mode: 0o700 });
  hook.point = ''; hook.fired = false; hook.privateRoot = ''; hook.fds = []; hook.factoryCalls = 0; hook.stderr = 'Operation not permitted';
  real.writeFileSync(path.join(hook.base, 'evidence/driver-input-v3.json'), JSON.stringify({ maxChildren: 3, totalMs: 60000,
    thirdAttempt: 'NOT_RUN', files: {}, externalInputs: {}, node: real.realpathSync(process.execPath),
    nodeSha256: createHash('sha256').update(real.readFileSync(process.execPath)).digest('hex'), controlStderrSha256: 'intentionally-different' }));
});
afterEach(() => {
  for (const fd of hook.fds) { try { real.closeSync(fd); } catch { /* Already closed by the host. */ } }
  real.rmSync(hook.base, { recursive: true }); // Only this test's root; no child was ever created.
});

test('normal private classification and exact-inode cleanup happen before batch end despite control failure', async () => {
  const result = await runDiagnosticBatch();
  expect(hook.factoryCalls).toBe(1); expect(result.stopReason).toBe('capture-control-failed');
  expect(result.cleanupComplete).toBe(true); expect(result.privateCleanup.privateRootRemoved).toBe(true);
  expect(result.privateArtifacts[0]).toMatchObject({ classification: 'permission-denial-text', flush: true, close: true, removed: true, retained: false });
  expect(real.existsSync(hook.privateRoot)).toBe(false);
  expect(JSON.stringify(result)).not.toContain('Operation not permitted');
  expect(result.elapsedMs).toBeLessThan(60000);
});

test('root chmod failure after mkdtemp still enters cleanup with known root inode', async () => {
  hook.point = 'root-chmod'; const result = await runDiagnosticBatch();
  expect(hook.fired).toBe(true); expect(hook.factoryCalls).toBe(0);
  expect(result.cleanupComplete).toBe(true); expect(real.existsSync(hook.privateRoot)).toBe(false);
});

test('unknown root identity retains the own root honestly instead of deleting by guessed path', async () => {
  hook.point = 'root-identity'; const result = await runDiagnosticBatch();
  expect(hook.factoryCalls).toBe(0); expect(result.cleanupComplete).toBe(false);
  expect(result.privateCleanup.retained).toContain(hook.privateRoot); expect(real.existsSync(hook.privateRoot)).toBe(true);
});

test('sink fstat failure after open is registered, closed and removed before any child factory call', async () => {
  hook.point = 'sink-fstat'; const result = await runDiagnosticBatch();
  expect(hook.fired).toBe(true); expect(hook.factoryCalls).toBe(0); expect(result.attempts).toHaveLength(0);
  expect(result.cleanupComplete).toBe(true);
  expect(result.privateArtifacts[0]).toMatchObject({ flush: true, close: true, removed: true, retained: false });
  expect(real.existsSync(hook.privateRoot)).toBe(false);
});

test('unknown private fd close is not retried and cannot claim cleanupComplete', async () => {
  hook.point = 'sink-close'; const result = await runDiagnosticBatch();
  expect(hook.fired).toBe(true); expect(hook.factoryCalls).toBe(1);
  expect(result.cleanupComplete).toBe(false);
  expect(result.privateArtifacts[0]).toMatchObject({ close: false, removed: false, retained: true });
  expect(JSON.stringify(result)).not.toContain('PRIVATE_FAILURE_SENTINEL');
});


test.each(['uv_thread_create', 'uv_loop_init', 'uv_async_init'])('public startup check %s produces only its fixed label, not raw text or a denied-rule inference', async name => {
  hook.stderr = `Assertion failed: ${name} PRIVATE_FAILURE_SENTINEL`;
  const result = await runDiagnosticBatch();
  expect(result.privateArtifacts[0].classification).toBe(`startup-check-${name}`);
  expect(result.cleanupComplete).toBe(true); expect(JSON.stringify(result)).not.toContain('PRIVATE_FAILURE_SENTINEL');
});

test('a function name without a failure marker remains unknown', async () => {
  hook.stderr = 'uv_thread_create PRIVATE_FAILURE_SENTINEL';
  const result = await runDiagnosticBatch();
  expect(result.privateArtifacts[0].classification).toBe('unknown'); expect(result.cleanupComplete).toBe(true);
});
