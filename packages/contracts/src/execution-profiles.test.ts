import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { executionProfileConfigurationJson, nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema, nativeExecutionProfileCatalogEntrySchema, nativeExecutionProfileCatalogPageSchema, NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, type NativeExecutionProfileConfiguration } from './execution-profiles.js';
import { taskSubmissionSchema } from './tasks.js';

const claude = { harness: 'claude' as const, adapterVersion: 'claude-sdk-0.3.290-v2' as const, model: 'sonnet', thinking: 'disabled' as const, permissionMode: 'dontAsk' as const,
  access: 'none' as const, requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 } };
const codex: NativeExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'gpt-5.4', reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none',
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
it('requires a pinned ordinary Codex task and defers resume support to center profile admission', () => {
  const task = { title: 'Native', prompt: 'hello', harness: 'codex', executionProfile: { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId: '5668918f-58a1-4703-89dc-705e92a8b4c4', configDigest: 'a'.repeat(64) } };
  expect(taskSubmissionSchema.parse(task)).toEqual(task);
  expect(taskSubmissionSchema.safeParse({ ...task, executionProfile: undefined }).success).toBe(false);
  expect(taskSubmissionSchema.parse({ ...task, resumeSessionId: 'thread' })).toEqual({ ...task, resumeSessionId: 'thread' });
  expect(taskSubmissionSchema.safeParse({ ...task, fixture: { scenario: 'success' } }).success).toBe(false);
});

function catalogEntry(configuration: NativeExecutionProfileConfiguration) {
  const isClaude = configuration.harness === 'claude';
  return { profile: { reference: { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) },
    configuration, source: 'runner-configured', availability: 'not-probed',
    model: { value: configuration.model, resolvedModel: null, displayName: configuration.model, description: 'Configured only', providerCapabilities: 'unknown' },
    controls: isClaude ? { model: 'select-configured-profile', thinking: 'fixed-disabled', effort: 'unsupported', access: 'configured-policy', queue: false, steer: false }
      : { model: 'select-configured-profile', thinking: 'unsupported', effort: 'configured-request', serviceTier: 'configured-request', access: 'requested-none', queue: false, steer: false },
    createdAt: '2026-10-06T00:00:00.000Z' },
    conversation: isClaude ? { state: 'existing-claude-contract', capabilitySource: 'conversation-response' }
      : { state: 'unsupported', reason: 'codex-conversation-unimplemented' } };
}
it('requires the exact native page protocol and preserves full configured fields and explicit nulls', () => {
  const entries = [catalogEntry(claude), catalogEntry(codex)];
  entries[1]!.profile.reference.id = '00000000-0000-4000-8000-000000000003';
  const page = { protocol: NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, profiles: entries, nextCursor: null };
  expect(nativeExecutionProfileCatalogPageSchema.parse(page)).toEqual(page);
  for (const protocol of [undefined, 'native-v1', 'flow.native-execution-profile-catalog.v2']) {
    expect(nativeExecutionProfileCatalogPageSchema.safeParse({ ...page, protocol }).success).toBe(false);
  }
  const parsed = nativeExecutionProfileCatalogPageSchema.parse(page);
  expect(nativeExecutionProfileConfigurationJson(parsed.profiles[0]!.profile.configuration)).toBe(executionProfileConfigurationJson(claude));
});
it('rejects conversation capabilities inconsistent with the profile harness or purpose', () => {
  const wrong = catalogEntry(codex); wrong.conversation = catalogEntry(claude).conversation;
  expect(nativeExecutionProfileCatalogEntrySchema.safeParse(wrong).success).toBe(false);
  for (const access of ['goal-tools', 'goal-graph-tools'] as const) {
    const goal = catalogEntry({ ...claude, access, materialScopeDigest: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' });
    expect(nativeExecutionProfileCatalogEntrySchema.safeParse(goal).success).toBe(false);
    goal.conversation = { state: 'unsupported', reason: 'profile-purpose-not-supported' };
    expect(nativeExecutionProfileCatalogEntrySchema.parse(goal)).toEqual(goal);
  }
  const ordinary = catalogEntry(claude); ordinary.conversation = { state: 'unsupported', reason: 'profile-purpose-not-supported' };
  expect(nativeExecutionProfileCatalogEntrySchema.safeParse(ordinary).success).toBe(false);
});
it('rejects effective-model, readiness, fast and private data claims in the configured catalog', () => {
  const entry = catalogEntry(codex);
  for (const patch of [{ availability: 'available' }, { secret: 'must-not-escape' }, { controls: { ...entry.profile.controls, fast: true } },
    { model: { ...entry.profile.model, resolvedModel: 'actual-model' } }, { model: { ...entry.profile.model, value: 'different-request' } },
    { controls: catalogEntry(claude).profile.controls }]) {
    expect(nativeExecutionProfileCatalogEntrySchema.safeParse({ ...entry, profile: { ...entry.profile, ...patch } }).success).toBe(false);
  }
});
it('bounds native pages and checks cursor and duplicate identities without changing configuration bytes', () => {
  const entry = catalogEntry(claude);
  const page = { protocol: NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, profiles: [entry], nextCursor: entry.profile.reference.id };
  expect(nativeExecutionProfileCatalogPageSchema.parse(page)).toEqual(page);
  for (const patch of [{ profiles: [] }, { profiles: [entry, entry] }, { profiles: Array.from({ length: 101 }, () => entry) },
    { nextCursor: '00000000-0000-4000-8000-000000000099' }]) {
    expect(nativeExecutionProfileCatalogPageSchema.safeParse({ ...page, ...patch }).success).toBe(false);
  }
});
