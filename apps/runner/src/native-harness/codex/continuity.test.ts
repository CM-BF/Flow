import { lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { guardExecutionProfile } from '../../execution-profiles.js';
import { createNativeFileRecipe } from '../../engineering/native-policy.js';
import { textDigest } from '../../verifier.js';
import { configureCodexHarness, createCodexSessionStorage } from './index.js';
import { persistentTransportFixture, type ContinuityFixtureMode } from './continuity-fixture.js';

const profile: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 1000, maxOutputBytes: 1024 }, sessionPersistence: 'host-owned' };
const runnerId = '5668918f-58a1-4703-89dc-705e92a8b4c4';
const pin = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId, configDigest: textDigest(nativeExecutionProfileConfigurationJson(profile)) };
const roots: { path: string; dev: number; ino: number }[] = [];
afterAll(() => {
  const receipt = roots.map(root => {
    const current = lstatSync(root.path); expect([current.dev, current.ino]).toEqual([root.dev, root.ino]);
    rmSync(root.path, { recursive: true }); expect(() => lstatSync(root.path)).toThrow(); return { ...root, absent: true };
  });
  if (process.env.FLOW_C02_CONTINUITY_REPORT) writeFileSync(process.env.FLOW_C02_CONTINUITY_REPORT, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
});
function setup(mode: ContinuityFixtureMode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'flow-c02-continuity-')); const { dev, ino } = lstatSync(root); roots.push({ path: root, dev, ino });
  const events: RunnerEventData[] = [];
  const { createTransport, calls, instances } = persistentTransportFixture({ codeHome: root, mode });
  const storage = createCodexSessionStorage({ codeHome: root, runnerId, configDigest: pin.configDigest, createTransport });
  const configured = configureCodexHarness({ publicProfile: profile, sessionStorage: storage });
  const adapter = guardExecutionProfile(configured.adapter, pin, profile);
  function context(resumeSessionId?: string, workingDirectory = root): HarnessContext {
    return { task: { title: 'Persistent fixture', prompt: 'Next turn', harness: 'codex', executionProfile: pin, ...(resumeSessionId ? { resumeSessionId } : {}) },
      executionIdentity: { runnerId, taskId: `task-${events.length}`, attemptId: `attempt-${events.length}`, ownerVersion: 1 }, workingDirectory,
      signal: new AbortController().signal, async assertOwnership() {}, async emit(event) { events.push(event); }, async waitForDecision() { throw new Error('No interactive approval'); } };
  }
  return { root, adapter, context, calls, instances, events };
}

it('closes one transport and resumes the exact stored thread in another, using the same trusted directory', async () => {
  const api = setup(); await api.adapter.run(api.context());
  expect(api.instances).toMatchObject([{ codeHome: api.root, closed: true, reads: 1 }]);
  expect(api.events[0]).toMatchObject({ type: 'session', nativeSessionId: 'persistent-thread' });
  await api.adapter.run(api.context('persistent-thread'));
  expect(api.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start', 'thread/resume', 'turn/start']);
  expect(api.instances).toMatchObject([{ codeHome: api.root, closed: true }, { codeHome: api.root, closed: true, reads: 2 }]);
  expect(api.events.filter(event => event.type === 'assistant-final')).toMatchObject([
    { nativeSessionId: 'persistent-thread', content: 'remembered 中文🙂' },
    { nativeSessionId: 'persistent-thread', content: 'remembered 中文🙂', settings: { actualExecution: { evidence: 'unknown', model: null } } },
  ]);
  expect(JSON.stringify(api.events)).not.toContain(api.root);
});

it('keeps session storage fixed while each attempt uses its own working directory', async () => {
  const api = setup();
  const firstDirectory = join(api.root, 'first-attempt'); const secondDirectory = join(api.root, 'second-attempt');
  for (const directory of [firstDirectory, secondDirectory]) mkdirSync(directory, { mode: 0o700 });
  await api.adapter.run(api.context(undefined, firstDirectory));
  await api.adapter.run(api.context('persistent-thread', secondDirectory));
  expect(api.calls).toMatchObject([
    { method: 'thread/start', params: { cwd: firstDirectory } },
    { method: 'turn/start', params: { cwd: firstDirectory } },
    { method: 'thread/resume', params: { cwd: secondDirectory } },
    { method: 'turn/start', params: { cwd: secondDirectory } },
  ]);
  expect(api.instances).toMatchObject([
    { codeHome: api.root, closed: true, reads: 1 }, { codeHome: api.root, closed: true, reads: 2 },
  ]);
  expect(api.events.filter(event => event.type === 'assistant-final')).toHaveLength(2);
});

it.each(['wrong-resume', 'lost-resume'] as const)('does not start or replay a turn after %s', async mode => {
  const api = setup(mode); await api.adapter.run(api.context()); const before = api.events.length;
  await expect(api.adapter.run(api.context('persistent-thread'))).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start', 'thread/resume']);
  expect(api.events).toHaveLength(before); expect(api.instances.every(instance => instance.closed)).toBe(true);
});

it('rejects a different profile id using the existing execution guard before any factory', async () => {
  const api = setup(); const ctx = api.context();
  await expect(api.adapter.run({ ...ctx, task: { ...ctx.task, executionProfile: { ...pin, id: 'c7159e6d-172f-4bba-bd99-e5e509dfc6b0' } } })).rejects.toThrow('does not match');
  expect(api.instances).toEqual([]); expect(api.events).toEqual([]);
});

it.each(['unknown-close', 'approval'] as const)('does not publish a final after %s', async mode => {
  const api = setup(mode); await expect(api.adapter.run(api.context())).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.events).toEqual([]); expect(api.instances.every(instance => instance.closed)).toBe(true);
});

it('preserves old ephemeral refusal and the separate engineering start recipe', async () => {
  const { sessionPersistence: _unused, ...legacy } = profile; let factoryCalls = 0;
  const old = configureCodexHarness({ publicProfile: legacy, createTransport() { factoryCalls++; throw new Error('must not launch'); } });
  const api = setup(); await expect(old.adapter.run(api.context('persistent-thread'))).rejects.toMatchObject({ settlement: 'settled' });
  expect(factoryCalls).toBe(0); expect(old.descriptor.ports).toEqual({});
  const recipe = createNativeFileRecipe('gpt-6-astra', '/owned-fixture', 'Fix calculator');
  expect(recipe.threadMethod ?? 'thread/start').toBe('thread/start');
  expect(recipe.startThread).toMatchObject({ ephemeral: true, approvalPolicy: 'untrusted', sandbox: 'workspace-write' });
  expect(recipe.startTurn('engineering-thread')).toMatchObject({ sandboxPolicy: { type: 'workspaceWrite', networkAccess: false } });
});
