import { afterEach, expect, test, vi } from 'vitest';
import { cleanupAfterCheckpoint, observeConnections } from './fixture-cleanup.js';

afterEach(() => vi.useRealTimers());

test('observes a closing connection until zero and preserves the original pid/state', async () => {
  let elapsed = 0, reads = 0;
  const result = await observeConnections(async () => ++reads === 1 ? [{ pid: 42, state: 'idle' }] : [], {
    now: () => elapsed, wait: async ms => { elapsed += ms; },
  });
  expect(result).toEqual({ state: 'empty', observations: [
    { elapsedMs: 0, rows: [{ pid: 42, state: 'idle' }] }, { elapsedMs: 50, rows: [] },
  ] });
  expect(reads).toBe(2);
});

test('retains bounded nonzero observations through the three-second deadline', async () => {
  let elapsed = 0;
  const result = await observeConnections(async () => [{ pid: 43, state: 'idle' }], {
    now: () => elapsed, wait: async ms => { elapsed += ms; },
  });
  expect(result.state).toBe('busy'); expect(result.observations).toHaveLength(60);
  expect(result.observations.at(-1)).toEqual({ elapsedMs: 2950, rows: [{ pid: 43, state: 'idle' }] });
  expect(elapsed).toBe(3000);
});

test('a query error stays unknown and saves only its safe code, never message or SQL', async () => {
  const result = await observeConnections(async () => { throw Object.assign(Error('secret SQL and connection string'), { code: '57P01' }); });
  expect(result.state).toBe('unknown'); expect(result.observations).toHaveLength(1);
  expect(result.observations[0]!.errorCode).toBe('57P01');
  expect(JSON.stringify(result)).not.toMatch(/secret|SQL|string/);
});

test('an unsettled connection query is unknown at the deadline without cancellation of consumers', async () => {
  vi.useFakeTimers();
  const result = observeConnections(() => new Promise(() => {}));
  await vi.advanceTimersByTimeAsync(3000);
  expect(await result).toMatchObject({ state: 'unknown', observations: [{ errorCode: 'OBSERVATION_TIMEOUT' }] });
  expect(vi.getTimerCount()).toBe(0);
});

const identity = { dev: 1, ino: 50, directory: true, symbolicLink: false };
function ports() {
  const calls: string[] = [];
  return { calls, checkpoint: async () => { calls.push('checkpoint'); },
    removeDatabase: async () => { calls.push('database'); }, readDirectory: async () => { calls.push('identity'); return identity; },
    removeDirectory: async () => { calls.push('directory'); } };
}
test('confirmed checkpoint precedes deletion, with directory identity checked immediately before removal', async () => {
  const port = ports(); const result = await cleanupAfterCheckpoint(port, true, identity);
  expect(port.calls).toEqual(['checkpoint', 'database', 'identity', 'directory']);
  expect(result).toEqual({ checkpointConfirmed: true, databaseRemoved: true, temporaryRemoved: true,
    directoryObservation: identity, failures: [] });
});
test('checkpoint failure retains both database and private recovery directory', async () => {
  const port = ports(); port.checkpoint = async () => { port.calls.push('checkpoint'); throw Object.assign(Error('private path'), { code: 'ENOSPC' }); };
  const result = await cleanupAfterCheckpoint(port, true, identity);
  expect(port.calls).toEqual(['checkpoint']);
  expect(result).toMatchObject({ checkpointConfirmed: false, databaseRemoved: false, temporaryRemoved: false, failures: ['checkpoint:ENOSPC'] });
});
test('existing unknown shutdown permits evidence persistence but no irreversible cleanup', async () => {
  const port = ports(); const result = await cleanupAfterCheckpoint(port, false, identity);
  expect(port.calls).toEqual(['checkpoint']);
  expect(result).toMatchObject({ checkpointConfirmed: true, databaseRemoved: false, temporaryRemoved: false });
});
test('changed directory inode preserves the replacement instead of deleting it', async () => {
  const port = ports(); port.readDirectory = async () => { port.calls.push('identity'); return { ...identity, ino: 51 }; };
  const result = await cleanupAfterCheckpoint(port, true, identity);
  expect(port.calls).toEqual(['checkpoint', 'database', 'identity']);
  expect(result).toMatchObject({ databaseRemoved: true, temporaryRemoved: false, failures: ['directory:IDENTITY_MISMATCH'] });
});
test('missing initial directory identity is never manufactured from the current path', async () => {
  const port = ports(); const result = await cleanupAfterCheckpoint(port, true, undefined);
  expect(port.calls).toEqual(['checkpoint']);
  expect(result.failures).toEqual(['directory:ORIGINAL_IDENTITY_UNKNOWN']);
});
test('database drop failure preserves recovery files and records only the bounded error code', async () => {
  const port = ports(); port.removeDatabase = async () => { port.calls.push('database'); throw Object.assign(Error('private database'), { code: '55006' }); };
  const result = await cleanupAfterCheckpoint(port, true, identity);
  expect(port.calls).toEqual(['checkpoint', 'database']); expect(result.failures).toEqual(['database:55006']);
  expect(result.temporaryRemoved).toBe(false);
});
