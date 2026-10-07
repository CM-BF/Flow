import { expect, it } from 'vitest';
import { lstat, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { createStartupProgress, STARTUP_PROGRESS_PREFIX, withStartupPhase } from './startup-progress.js';

// Existing host persistence is the direct consumer; no service, database or signal is created.
const diagnosticsUrl = new URL('../../../tools/personal-preview/startup-diagnostics.mjs', import.meta.url).href;

it.skipIf(!process.env.FLOW_STARTUP_PROGRESS_SCRATCH)('existing startup capture retains bounded producer frames through its actual private file port', async () => {
  const { openStartupDiagnostics } = await import(diagnosticsUrl);
  const scratch = process.env.FLOW_STARTUP_PROGRESS_SCRATCH;
  if (!scratch) throw Error('Explicit owned scratch required');
  const directory = await mkdtemp(join(scratch, 'capture-'));
  const identity = await lstat(directory);
  try {
    const nonce = randomUUID(), pid = process.pid;
    await writeFile(join(directory, 'state.json'), JSON.stringify({ processes: { center: { nonce, pid } } }), { mode: 0o600, flag: 'wx' });
    const diagnostic = await openStartupDiagnostics({ directory, role: 'center', nonce, pid });
    const stderr = new PassThrough();
    diagnostic.capture(stderr);
    const producer = createStartupProgress({ enabled: true, write: frame => stderr.write(frame) });
    await withStartupPhase(producer.observe, 'migrate', () => undefined);
    const summary = producer.finish('listening');
    stderr.end();
    const capture = await diagnostic.finish({ code: 0, signal: null });
    expect(capture).toMatchObject({ complete: true, truncated: false, bytes: summary.bytes, observedBytes: summary.bytes });
    const lines = (await readFile(join(directory, 'startup-diagnostics', `center-${nonce}.stderr`), 'utf8')).trim().split('\n');
    expect(lines.map(line => JSON.parse(line.slice(STARTUP_PROGRESS_PREFIX.length)).e)).toEqual(['enter', 'settled', 'complete']);
    const record = JSON.parse(await readFile(join(directory, 'startup-diagnostics', `center-${nonce}.json`), 'utf8'));
    expect(record).toMatchObject({ role: 'center', pid, nonce, phase: 'child-exit', stderr: capture });
  } finally {
    const current = await lstat(directory);
    if (current.dev !== identity.dev || current.ino !== identity.ino || !current.isDirectory()) throw Error('Owned fixture identity changed; KEEP');
    await rm(directory, { recursive: true });
  }
});

it('observer failure preserves the primary and existing host cleanup unknown independently', async () => {
  const { preserveStartupFailure } = await import(diagnosticsUrl);
  const primary = Object.assign(Error('primary-private-text'), { code: 'EIO' });
  const producer = createStartupProgress({ enabled: true, write: () => { throw Error('sink-private-text'); } });
  let caught: unknown, operations = 0;
  try { await withStartupPhase(producer.observe, 'scheduler', () => { operations++; throw primary; }); }
  catch (error) { caught = error; }
  expect(caught).toBe(primary); expect(operations).toBe(1);
  const state: { processes: object; startCleanup?: object[]; lastStartFailure?: { code: string } } = { processes: { center: { pid: 99 } } };
  let saves = 0;
  await preserveStartupFailure({ state, error: caught, role: 'center', phase: 'ready',
    stop: async () => { throw Object.assign(Error('cleanup-private-text'), { code: 'EPERM' }); },
    save: async () => { saves++; } });
  expect(state.lastStartFailure?.code).toBe('EIO');
  expect(state.startCleanup).toEqual([{ role: 'center', state: 'unknown', code: 'EPERM' }]);
  expect(saves).toBe(2);
  expect(producer.finish('failed')).toMatchObject({ state: 'incomplete', reason: 'write-error' });
});
