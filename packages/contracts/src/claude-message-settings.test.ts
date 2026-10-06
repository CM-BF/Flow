import { z } from 'zod';
import { expect, it } from 'vitest';
import { taskSubmissionSchema } from './tasks.js';
import { conversationTurnSchema } from './conversations.js';
import { conversationQueueEnqueueSchema } from './conversation-queue.js';
import { assistantFinalDataSchema, assistantSettingsSchema } from './assistant.js';
import { runnerEventSchema } from './runner.js';
import { CLAUDE_TURN_SETTINGS_PROTOCOL } from './claude-turn-settings.js';
import { executionProfileConfigurationSchema, executionProfileConfigurationJson, claudeMessageSettingsCatalogPageSchema, nativeExecutionProfileCatalogEntrySchema, type ExecutionProfilePublished } from './execution-profiles.js';

const reference = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) };
const choice = { model: 'sonnet', thinking: 'adaptive' as const, effort: { kind: 'level' as const, value: 'high' as const }, speed: 'standard' as const };
const snapshot = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested: choice };
const legacy = { harness: 'claude' as const, adapterVersion: 'claude-sdk-0.3.290-v2' as const, model: 'sonnet', thinking: 'disabled' as const,
  permissionMode: 'dontAsk' as const, access: 'none' as const, requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } };
const configuration = { ...legacy, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [choice] } };
const effective = { model: null, permissionMode: null, tools: null, thinking: 'unknown' as const };
const final = () => ({ type: 'assistant-final', source: 'claude.sdk.result', messageId: 'b'.repeat(64), nativeSessionId: 'session', sourceMessageId: 'message', content: 'answer',
  settings: { effective, messageSettings: { snapshot, observed: null } } });

it('keeps the legacy configuration bytes and requires explicit, mutually exclusive opt-in', () => {
  expect(executionProfileConfigurationJson(legacy)).toBe(JSON.stringify(legacy));
  expect(executionProfileConfigurationSchema.parse(configuration)).toEqual(configuration);
  expect(executionProfileConfigurationSchema.safeParse({ ...configuration, activeSteering: { protocol: 'flow.active-steering.v1' } }).success).toBe(false);
  for (const access of ['goal-tools', 'goal-graph-tools']) expect(executionProfileConfigurationSchema.safeParse({ ...configuration, access }).success).toBe(false);
  expect(executionProfileConfigurationSchema.safeParse({ ...configuration, turnSettings: {} }).success).toBe(false);
});

it('advertises configured tuples without legacy fixed controls or provider readiness', () => {
  const entry = { profile: { reference, configuration, source: 'runner-configured', availability: 'not-probed',
    model: { value: 'sonnet', resolvedModel: null, displayName: 'sonnet', description: 'Configured only', providerCapabilities: 'unknown' },
    controls: { access: 'configured-policy', queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: 'configuration.turnSettings.choices' } },
    createdAt: '2026-10-06T00:00:00.000Z' }, conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } };
  const page = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: [entry], nextCursor: reference.id };
  expect(claudeMessageSettingsCatalogPageSchema.parse(page)).toEqual(page);
  const publication: ExecutionProfilePublished = { profile: claudeMessageSettingsCatalogPageSchema.parse(page).profiles[0]!.profile, replayed: false };
  expect(publication.profile.controls).toHaveProperty('messageSettings');
  expect(nativeExecutionProfileCatalogEntrySchema.safeParse(entry).success).toBe(false);
  for (const patch of [{ availability: 'available' }, { controls: { ...entry.profile.controls, thinking: 'fixed-disabled' } }, { configuration: legacy }]) {
    expect(claudeMessageSettingsCatalogPageSchema.safeParse({ ...page, profiles: [{ ...entry, profile: { ...entry.profile, ...patch } }] }).success).toBe(false);
  }
  expect(claudeMessageSettingsCatalogPageSchema.safeParse({ ...page, profiles: [entry, entry] }).success).toBe(false);
  expect(claudeMessageSettingsCatalogPageSchema.safeParse({ ...page, nextCursor: reference.runnerId }).success).toBe(false);
});

it('prevents ordinary task admission from crossing harness, purpose or profile identities', () => {
  const task = { title: 'turn', prompt: 'hello', harness: 'claude', executionProfile: reference, messageSettings: snapshot };
  expect(taskSubmissionSchema.parse(task)).toEqual(task);
  for (const patch of [{ harness: 'fixture' }, { harness: 'codex' }, { executionProfile: undefined }, { fixture: { scenario: 'success' } },
    { executionProfile: { ...reference, id: reference.runnerId } }, { executionProfile: { ...reference, runnerId: reference.id } }, { executionProfile: { ...reference, configDigest: 'c'.repeat(64) } }]) {
    expect(taskSubmissionSchema.safeParse({ ...task, ...patch }).success).toBe(false);
  }
  const omittedEffort = { ...snapshot, requested: { ...choice, effort: { kind: 'not-requested' } } };
  expect(taskSubmissionSchema.safeParse({ ...task, messageSettings: omittedEffort }).success).toBe(true);
  expect(taskSubmissionSchema.safeParse({ ...task, resumeSessionId: 'session', messageSettings: omittedEffort }).success).toBe(false);
});

it('keeps message snapshots optional for legacy bodies and explicit for new send and queue bodies', () => {
  const send = { expectedRevision: 0, text: 'hello' };
  const enqueue = { expectedQueueRevision: 0, text: 'hello' };
  expect(conversationTurnSchema.parse(send)).not.toHaveProperty('messageSettings');
  expect(conversationQueueEnqueueSchema.parse(enqueue)).toEqual(enqueue);
  expect(conversationTurnSchema.parse({ ...send, messageSettings: snapshot }).messageSettings).toEqual(snapshot);
  expect(conversationQueueEnqueueSchema.parse({ ...enqueue, messageSettings: snapshot }).messageSettings).toEqual(snapshot);
  // The base remains extendable by interaction; command admission rejects unsupported modes.
  expect(conversationTurnSchema.extend({ mode: z.literal('follow-up') }).parse({ ...send, mode: 'follow-up', messageSettings: snapshot }).messageSettings).toEqual(snapshot);
  expect(conversationQueueEnqueueSchema.safeParse({ ...enqueue, messageSettings: { ...snapshot, requested: { model: 'sonnet' } } }).success).toBe(false);
});

it('keeps final envelope extension and the legacy settings codec while separating new requested intent', () => {
  expect(runnerEventSchema.parse({ ...final(), id: 'event', sequence: 1 })).toMatchObject(final());
  const old = { requested: { model: 'sonnet', permissionMode: 'dontAsk', thinking: 'disabled' }, effective };
  expect(assistantSettingsSchema.parse(old)).toEqual(old);
  expect(assistantFinalDataSchema.parse({ ...final(), settings: old }).settings).toEqual(old);
  expect(assistantFinalDataSchema.safeParse({ ...final(), settings: { ...final().settings, requested: old.requested } }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...final(), settings: { effective } }).success).toBe(false);
});

it('preserves init absence, explicit null effort and cooldown without inventing effective controls', () => {
  const observed = { source: 'claude.sdk.system.init', model: 'resolved-alias', effort: null, fastModeState: 'cooldown', fastModeDisabledReason: 'sdk_opt_in_required' };
  const payload = { ...final(), settings: { ...final().settings, effective: { ...effective, model: observed.model }, messageSettings: { snapshot, observed } } };
  expect(assistantFinalDataSchema.parse(payload)).toEqual(payload);
  expect(assistantFinalDataSchema.safeParse({ ...payload, settings: { ...payload.settings, effective: { ...effective, model: 'different-model' } } }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...final(), settings: { ...final().settings, effective: { ...effective, model: observed.model } } }).success).toBe(false);
  const sparse = { ...payload, settings: { ...payload.settings, messageSettings: { snapshot, observed: { source: observed.source, model: observed.model } } } };
  expect(assistantFinalDataSchema.parse(sparse)).toEqual(sparse);
  for (const patch of [{ model: undefined }, { effort: 'ultra' }, { fastModeState: null }, { fastModeDisabledReason: 'private reason' }, { thinking: 'adaptive' }]) {
    expect(assistantFinalDataSchema.safeParse({ ...payload, settings: { ...payload.settings, messageSettings: { snapshot, observed: { ...observed, ...patch } } } }).success).toBe(false);
  }
  const largeTools = { ...final(), settings: { ...final().settings, effective: { ...effective, tools: Array.from({ length: 100 }, () => 'x'.repeat(200)) } } };
  expect(assistantFinalDataSchema.parse(largeTools)).toEqual(largeTools);
});
