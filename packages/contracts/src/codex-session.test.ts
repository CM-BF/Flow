import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { codexExecutionProfileConfigurationSchema, nativeExecutionProfileConfigurationJson } from './execution-profiles.js';
import { taskSubmissionSchema } from './tasks.js';

const legacy = { harness: 'codex' as const, adapterVersion: 'codex-app-server-0.154.0-v1' as const, model: 'fixture-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none' as const, approvalPolicy: 'never' as const,
  sandboxMode: 'read-only' as const, hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } };
const reference = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId: '5668918f-58a1-4703-89dc-705e92a8b4c4', configDigest: 'a'.repeat(64) };

it('retains the exact legacy Codex bytes and digest without a default persistence capability', () => {
  const expected = JSON.stringify(legacy);
  expect(nativeExecutionProfileConfigurationJson(legacy)).toBe(expected);
  expect(codexExecutionProfileConfigurationSchema.parse(legacy)).not.toHaveProperty('sessionPersistence');
  expect(createHash('sha256').update(nativeExecutionProfileConfigurationJson(legacy)).digest('hex'))
    .toBe(createHash('sha256').update(expected).digest('hex'));
});

it('accepts only explicit host-owned intent and never accepts a storage path or launch authority', () => {
  const persistent = { ...legacy, sessionPersistence: 'host-owned' as const };
  expect(codexExecutionProfileConfigurationSchema.parse(persistent)).toEqual(persistent);
  expect(nativeExecutionProfileConfigurationJson(persistent)).not.toBe(nativeExecutionProfileConfigurationJson(legacy));
  for (const sessionPersistence of [null, true, 'ephemeral', 'any-path']) {
    expect(codexExecutionProfileConfigurationSchema.safeParse({ ...legacy, sessionPersistence }).success).toBe(false);
  }
  for (const key of ['codeHome', 'storage', 'env', 'args', 'auth']) {
    expect(codexExecutionProfileConfigurationSchema.safeParse({ ...persistent, [key]: 'private' }).success).toBe(false);
  }
});

it('carries only a session ID and pin to center admission while rejecting fixture and private launch fields', () => {
  const task = { title: 'Continue', prompt: 'Next turn', harness: 'codex', executionProfile: reference, resumeSessionId: 'confirmed-thread' };
  expect(taskSubmissionSchema.parse(task)).toEqual(task);
  for (const patch of [{ executionProfile: undefined }, { fixture: { scenario: 'success' } }, { codeHome: '/private' },
    { env: { CODEX_HOME: '/private' } }, { args: ['--resume'] }, { resumeSessionId: '' }]) {
    expect(taskSubmissionSchema.safeParse({ ...task, ...patch }).success).toBe(false);
  }
});
