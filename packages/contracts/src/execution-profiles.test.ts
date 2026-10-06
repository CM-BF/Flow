import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { executionProfileConfigurationJson, nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema } from './execution-profiles.js';
import { taskSubmissionSchema } from './tasks.js';

const claude = { harness: 'claude' as const, adapterVersion: 'claude-sdk-0.3.290-v2' as const, model: 'sonnet', thinking: 'disabled' as const, permissionMode: 'dontAsk' as const,
  access: 'none' as const, requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 } };
const codex = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'gpt-5.4', reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none',
  approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } };
it('preserves preexisting Claude canonical bytes through the native codec', () => {
  const expected = '{"harness":"claude","adapterVersion":"claude-sdk-0.3.290-v2","model":"sonnet","thinking":"disabled","permissionMode":"dontAsk","access":"none","requireReadApproval":false,"materialScopeDigest":"' + '0'.repeat(64) + '","limits":{"maxTurns":2,"maxBudgetUsd":0.25,"timeoutMs":2000}}';
  expect(executionProfileConfigurationJson(claude)).toBe(expected);
  expect(nativeExecutionProfileConfigurationJson(claude)).toBe(expected);
  expect(createHash('sha256').update(nativeExecutionProfileConfigurationJson(claude)).digest('hex')).toBe(createHash('sha256').update(expected).digest('hex'));
});
it('rejects unrecognized versions and provider limits while retaining null and turn-tier intent', () => {
  expect(nativeExecutionProfileConfigurationSchema.parse(codex)).toEqual(codex);
  for (const changed of [{ adapterVersion: 'codex-latest' }, { permissionMode: 'dontAsk' }, { limits: { maxTurns: 1, maxBudgetUsd: 1 } }, { access: 'goal-tools' }, { sandboxMode: 'danger-full-access' }]) {
    expect(nativeExecutionProfileConfigurationSchema.safeParse({ ...codex, ...changed }).success).toBe(false);
  }
});
it('requires a pinned ordinary Codex task and rejects unimplemented resume/fixture paths', () => {
  const task = { title: 'Native', prompt: 'hello', harness: 'codex', executionProfile: { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId: '5668918f-58a1-4703-89dc-705e92a8b4c4', configDigest: 'a'.repeat(64) } };
  expect(taskSubmissionSchema.parse(task)).toEqual(task);
  expect(taskSubmissionSchema.safeParse({ ...task, executionProfile: undefined }).success).toBe(false);
  expect(taskSubmissionSchema.safeParse({ ...task, resumeSessionId: 'thread' }).success).toBe(false);
  expect(taskSubmissionSchema.safeParse({ ...task, fixture: { scenario: 'success' } }).success).toBe(false);
});
