import { lstatSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import type { HarnessContext } from '@flow/contracts';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { textDigest } from '../../verifier.js';
import { configureCodexHarness } from './index.js';
import { createCodexSessionStorage, sessionTransport, type CodexSessionStorage } from './session-storage.js';

const profile: CodexExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 1000, maxOutputBytes: 1024 }, sessionPersistence: 'host-owned' };
const runnerId = '5668918f-58a1-4703-89dc-705e92a8b4c4';
const pin = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId, configDigest: textDigest(nativeExecutionProfileConfigurationJson(profile)) };
const roots: { path: string; dev: number; ino: number }[] = [];
function ownRoot() {
  const path = mkdtempSync(join(tmpdir(), 'flow-c02-storage-')); const { dev, ino } = lstatSync(path);
  roots.push({ path, dev, ino }); return path;
}
afterAll(() => {
  const receipt = roots.map(root => {
    const current = lstatSync(root.path); expect([current.dev, current.ino]).toEqual([root.dev, root.ino]);
    rmSync(root.path, { recursive: true }); expect(() => lstatSync(root.path)).toThrow(); return { ...root, absent: true };
  });
  if (process.env.FLOW_C02_STORAGE_REPORT) writeFileSync(process.env.FLOW_C02_STORAGE_REPORT, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
});
function context(): HarnessContext {
  return { task: { title: 'Continue', prompt: 'hello', harness: 'codex', executionProfile: pin },
    executionIdentity: { taskId: 'task', attemptId: 'attempt', ownerVersion: 1, runnerId }, workingDirectory: '/fixture',
    signal: new AbortController().signal, async assertOwnership() {}, async emit() {}, async waitForDecision() { throw new Error('unused'); } };
}
function setup() {
  const codeHome = ownRoot();
  const createTransport = vi.fn(() => { throw new Error('fixture factory invoked'); });
  const storage = createCodexSessionStorage({ codeHome, runnerId, configDigest: pin.configDigest, createTransport });
  return { codeHome, createTransport, storage };
}

it('requires an opaque host handle and a matching profile; the descriptor derives the same opt-in', () => {
  const api = setup();
  expect(() => configureCodexHarness({ publicProfile: profile })).toThrow('does not match');
  expect(() => configureCodexHarness({ publicProfile: profile, sessionStorage: {} as CodexSessionStorage })).toThrow('does not match');
  expect(() => configureCodexHarness({ publicProfile: { ...profile, model: 'different' }, sessionStorage: api.storage })).toThrow('does not match');
  expect(() => configureCodexHarness({ publicProfile: profile, sessionStorage: api.storage, createTransport: api.createTransport })).toThrow('must be bound');
  expect(configureCodexHarness({ publicProfile: profile, sessionStorage: api.storage }).descriptor.ports).toEqual({ sessionPersistence: 'host-owned' });
  expect(JSON.stringify(api.storage)).toBe('{}'); expect(api.createTransport).not.toHaveBeenCalled();
});

it('the trusted closure passes its fixed directory to the actual factory only after assignment binding', () => {
  const api = setup(); const ctx = context(); const factory = sessionTransport(api.storage, profile, ctx);
  expect(() => factory({ signal: ctx.signal, workingDirectory: ctx.workingDirectory })).toThrow('fixture factory invoked');
  expect(api.createTransport).toHaveBeenCalledExactlyOnceWith({ codeHome: api.codeHome, signal: ctx.signal, workingDirectory: ctx.workingDirectory });
});

it.each(['missing-identity', 'wrong-runner', 'wrong-pin-runner', 'wrong-digest'] as const)('rejects %s before any factory', mismatch => {
  const api = setup(); const ctx = context();
  const executionIdentity = mismatch === 'missing-identity' ? undefined : { ...ctx.executionIdentity!, runnerId: mismatch === 'wrong-runner' ? 'other' : runnerId };
  const task = { ...ctx.task, executionProfile: { ...pin, runnerId: mismatch === 'wrong-pin-runner' ? 'other' : runnerId,
    configDigest: mismatch === 'wrong-digest' ? '0'.repeat(64) : pin.configDigest } };
  expect(() => sessionTransport(api.storage, profile, { ...ctx, executionIdentity, task })).toThrow('failed after settlement');
  expect(api.createTransport).not.toHaveBeenCalled();
});

it.each(['replacement', 'symlink'] as const)('rejects a %s at the fixed storage path without calling the factory', mode => {
  const api = setup(); const factory = sessionTransport(api.storage, profile, context());
  const moved = `${api.codeHome}-original`; renameSync(api.codeHome, moved); roots.find(root => root.path === api.codeHome)!.path = moved;
  if (mode === 'symlink') symlinkSync(moved, api.codeHome);
  else { const replacement = ownRoot(); renameSync(replacement, api.codeHome); roots.find(root => root.path === replacement)!.path = api.codeHome; }
  expect(() => factory({ signal: context().signal, workingDirectory: '/fixture' })).toThrow('failed after settlement');
  expect(api.createTransport).not.toHaveBeenCalled();
  if (mode === 'symlink') { expect(lstatSync(api.codeHome).isSymbolicLink()).toBe(true); rmSync(api.codeHome); }
});

it('does not disclose a rejected private path or validation input', () => {
  const api = setup();
  for (const codeHome of ['relative-private', `${api.codeHome}/missing-private`]) {
    const error = (() => { try { createCodexSessionStorage({ codeHome, runnerId, configDigest: pin.configDigest, createTransport: api.createTransport }); } catch (error) { return error; } })();
    expect(error).toBeInstanceOf(Error); expect(String(error)).toBe('Error: Host-owned Codex session storage is unavailable.');
    expect(error).not.toHaveProperty('cause');
  }
});
