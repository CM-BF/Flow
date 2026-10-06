import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { createEngineeringFixtureAdapter } from './adapter.js';
import type { EngineeringWriter, EngineeringWriteInput } from './writer.js';
import type { SyntheticProject, EngineeringWorkspace } from './workspace.js';
import type { TrustedChecker } from './checker.js';

function scenario(execute: EngineeringWriter['execute'], controller = new AbortController()) {
  const leaseId = randomUUID(), runnerId = randomUUID(), baseCommit = 'a'.repeat(40), hash = 'b'.repeat(64);
  const snapshot = vi.fn(async () => ({ baseCommit, headCommit: baseCommit, files: [], digest: hash, diff: '' }));
  const release = vi.fn(async () => {});
  const workspace: EngineeringWorkspace = { directory: '/managed/worktree', leaseId, snapshot, release };
  const project: SyntheticProject = { id: 'fixture', baseCommit, rootDirectory: '/managed/project', acquire: vi.fn(async () => workspace), dispose: vi.fn(async () => {}) };
  const checker: TrustedChecker = { rootDirectory: '/host/checker', selection: { id: 'checker', version: '1', baselineDigest: hash }, dispose: vi.fn(async () => {}), run: vi.fn(async () => ({
    checker: { id: 'checker', version: '1' as const, baselineBeforeDigest: hash, baselineAfterDigest: hash, commandDigest: hash, expectedChecks: ['fixed'], checks: [{ id: 'fixed', passed: true }] },
    command: { exitCode: 0, signal: null, timedOut: false, outputTruncated: false, childExited: true, elapsedMs: 1, stdout: '', stderr: '' },
  })) };
  const events: RunnerEventData[] = [], invoked = vi.fn(execute);
  const context: HarnessContext = { task: { title: 'Trusted writer', prompt: 'Controlled fixture input', harness: 'fixture', engineering: { protocol: 'flow.engineering.v1', targetRunnerId: runnerId, projectId: project.id, baseCommit, checker: checker.selection } },
    workingDirectory: '/host', signal: controller.signal, assertOwnership: vi.fn(async () => {}), waitForDecision: async () => 'reject', emit: async event => { events.push(event); } };
  const adapter = createEngineeringFixtureAdapter(runnerId, [{ project, checker, execute: invoked }]);
  return { leaseId, snapshot, release, checker, events, invoked, context, run: () => adapter.run(context) };
}
const stopped = (input: EngineeringWriteInput, outcome: 'completed' | 'failed' = 'completed') => ({ leaseId: input.leaseId, settlement: 'stopped' as const, outcome });

it('passes only the owned writer input and preserves the existing v1 successful receipt', async () => {
  const api = scenario(async input => {
    expect(Object.keys(input).sort()).toEqual(['assertOwnership', 'baseCommit', 'directory', 'leaseId', 'prompt', 'signal']);
    expect(Object.isFrozen(input)).toBe(true); expect(input.directory).toBe('/managed/worktree');
    await input.assertOwnership(); return stopped(input);
  });
  await api.run(); expect(api.checker.run).toHaveBeenCalledTimes(1); expect(api.snapshot).toHaveBeenCalledTimes(2); expect(api.release).toHaveBeenCalledTimes(1);
  expect(api.events.map(value => value.type)).toEqual(['artifact', 'verification']);
  const artifact = api.events[0]; if (artifact?.type !== 'artifact') throw Error('Missing receipt');
  const receipt = JSON.parse(artifact.content); expect(receipt.protocol).toBe('flow.engineering.receipt.v1'); expect(receipt).not.toHaveProperty('writer');
});

it('releases an explicitly stopped failed writer without running checker or producing a pass', async () => {
  const api = scenario(async input => stopped(input, 'failed'));
  await expect(api.run()).rejects.toMatchObject({ settlement: 'settled' });
  expect(api.checker.run).not.toHaveBeenCalled(); expect(api.snapshot).not.toHaveBeenCalled(); expect(api.events).toEqual([]); expect(api.release).toHaveBeenCalledTimes(1);
});

it.each(['unknown', 'void', 'null', 'wrong-lease', 'missing-outcome', 'claimed-success-only'] as const)('retains the lease and skips checker for %s writer output', async kind => {
  const api = scenario(async input => {
    const outputs = { unknown: { leaseId: input.leaseId, settlement: 'unknown' }, void: undefined, null: null,
      'wrong-lease': { ...stopped(input), leaseId: randomUUID() }, 'missing-outcome': { leaseId: input.leaseId, settlement: 'stopped' }, 'claimed-success-only': { leaseId: input.leaseId, outcome: 'completed' } };
    return outputs[kind] as Awaited<ReturnType<EngineeringWriter['execute']>>;
  });
  await expect(api.run()).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.checker.run).not.toHaveBeenCalled(); expect(api.snapshot).not.toHaveBeenCalled(); expect(api.release).not.toHaveBeenCalled(); expect(api.events).toEqual([]);
});

it.each(['ordinary', 'native-settled', 'native-unknown', 'abort'] as const)('never derives writer settlement from the %s exception type', async kind => {
  const api = scenario(async () => { throw kind === 'ordinary' ? new Error('private native data') : kind === 'abort' ? new DOMException('private abort data', 'AbortError') : new NativeExecutionError(kind === 'native-settled' ? 'settled' : 'unknown'); });
  const error = await api.run().catch(error => error);
  expect(error).toBeInstanceOf(NativeExecutionError); expect(error.settlement).toBe('unknown'); expect(error.message).not.toContain('private'); expect(error.cause).toBeUndefined();
  expect(api.checker.run).not.toHaveBeenCalled(); expect(api.release).not.toHaveBeenCalled(); expect(api.events).toEqual([]);
});

it('does not dispatch a writer when cancellation is already known before dispatch', async () => {
  const controller = new AbortController(); controller.abort(); const api = scenario(async input => stopped(input), controller);
  await expect(api.run()).rejects.toThrow(); expect(api.invoked).not.toHaveBeenCalled(); expect(api.checker.run).not.toHaveBeenCalled(); expect(api.release).toHaveBeenCalledTimes(1);
});

it('a cancellation request does not resolve a pending writer or release its resources', async () => {
  const controller = new AbortController(); let enter!: () => void, finish!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { finish = resolve; });
  const api = scenario(async input => { enter(); await gate; return { leaseId: input.leaseId, settlement: 'unknown' }; }, controller);
  let done = false; const running = api.run().finally(() => { done = true; }); void running.catch(() => {});
  await entered; controller.abort(); await Promise.resolve();
  expect(done).toBe(false); expect(api.release).not.toHaveBeenCalled(); expect(api.checker.run).not.toHaveBeenCalled();
  finish(); await expect(running).rejects.toMatchObject({ settlement: 'unknown' }); expect(api.release).not.toHaveBeenCalled();
});

it('waits for explicit stopped failure after cancellation and then permits release', async () => {
  const controller = new AbortController(); const api = scenario(async input => { controller.abort(); return stopped(input, 'failed'); }, controller);
  await expect(api.run()).rejects.toMatchObject({ settlement: 'settled' }); expect(api.checker.run).not.toHaveBeenCalled(); expect(api.release).toHaveBeenCalledTimes(1);
});

it('an unknown return cannot authorize checking while separately tracked fixture work remains active', async () => {
  let stillWriting = true, finish!: () => void;
  const background = new Promise<void>(resolve => { finish = () => { stillWriting = false; resolve(); }; });
  const api = scenario(async input => ({ leaseId: input.leaseId, settlement: 'unknown' }));
  try { await expect(api.run()).rejects.toMatchObject({ settlement: 'unknown' }); expect(stillWriting).toBe(true); expect(api.release).not.toHaveBeenCalled(); expect(api.checker.run).not.toHaveBeenCalled(); }
  finally { finish(); await background; }
});
