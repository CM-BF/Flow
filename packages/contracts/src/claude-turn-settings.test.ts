import { describe, expect, it } from 'vitest';
import {
  CLAUDE_TURN_SETTINGS_MAX_BYTES, CLAUDE_TURN_CHOICES_MAX_BYTES,
  claudeTurnSettingsSchema, claudeTurnSettingsChoicesSchema, claudeTurnSettingsJson,
  checkClaudeTurnSettingsAllowed, assertClaudeTurnSettingsMatch, ClaudeTurnSettingsMismatchError,
  type ClaudeTurnSettings, type ClaudeTurnSettingsPolicy,
} from './claude-turn-settings.js';

const profile = {
  id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64),
};
const requested: ClaudeTurnSettings['requested'] = {
  model: 'configured-model', thinking: 'adaptive', effort: { kind: 'level', value: 'medium' }, speed: 'standard',
};
function snapshot(): ClaudeTurnSettings {
  return { protocol: 'flow.claude-turn-settings.v1', profile: { ...profile }, requested: { ...requested, effort: { kind: 'level', value: 'medium' } } };
}
function policy(choices: ClaudeTurnSettingsPolicy['choices'] = [requested]): ClaudeTurnSettingsPolicy {
  return { profile: { ...profile }, choices };
}

describe('Claude message settings contract', () => {
  it('requires an explicit bounded request while preserving not-requested as omission intent only', () => {
    const input = snapshot();
    const parsed = claudeTurnSettingsSchema.parse(input);
    input.requested.model = 'later-draft';
    expect(parsed.requested.model).toBe('configured-model');
    const omittedIntent = { ...snapshot(), requested: { ...requested, effort: { kind: 'not-requested' } } };
    expect(claudeTurnSettingsSchema.parse(omittedIntent).requested.effort).toEqual({ kind: 'not-requested' });
    for (const field of ['model', 'thinking', 'effort', 'speed']) {
      const fields: Record<string, unknown> = { ...requested }; delete fields[field];
      expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), requested: fields }).success).toBe(false);
    }
    for (const effort of [null, { kind: 'default' }, { kind: 'not-requested', value: 'low' }, { kind: 'level', value: 'maximum' }]) {
      expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), requested: { ...requested, effort } }).success).toBe(false);
    }
    expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), requested: { ...requested, thinking: 'enabled', budgetTokens: 1024 } }).success).toBe(false);
    expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), settingsRevision: 1 }).success).toBe(false);
    expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), requested: { ...requested, model: 'm'.repeat(181) } }).success).toBe(false);
    expect(claudeTurnSettingsSchema.safeParse({ ...snapshot(), profile: { ...profile, configDigest: 'invalid' } }).success).toBe(false);
    expect(new TextEncoder().encode(claudeTurnSettingsJson(parsed)).length).toBeLessThanOrEqual(CLAUDE_TURN_SETTINGS_MAX_BYTES);
  });

  it('canonicalizes property order without merging distinct effort, speed or omission requests', () => {
    const value = snapshot();
    const reordered = { requested: { speed: value.requested.speed, effort: { value: 'medium', kind: 'level' }, thinking: 'adaptive', model: 'configured-model' },
      profile: { configDigest: profile.configDigest, runnerId: profile.runnerId, id: profile.id }, protocol: value.protocol };
    expect(claudeTurnSettingsJson(claudeTurnSettingsSchema.parse(reordered))).toBe(claudeTurnSettingsJson(value));
    const changed = [
      { ...requested, effort: { kind: 'level' as const, value: 'high' as const } },
      { ...requested, speed: 'fast' as const },
      { ...requested, effort: { kind: 'not-requested' as const } },
    ];
    for (const next of changed) expect(claudeTurnSettingsJson({ ...value, requested: next })).not.toBe(claudeTurnSettingsJson(value));
  });

  it('distinguishes missing evidence from a trusted empty policy and never combines independent choices', () => {
    expect(checkClaudeTurnSettingsAllowed(snapshot())).toEqual({ decision: 'unknown', reason: 'capability-evidence-unavailable' });
    expect(checkClaudeTurnSettingsAllowed(snapshot(), null)).toEqual({ decision: 'unknown', reason: 'capability-evidence-unavailable' });
    expect(checkClaudeTurnSettingsAllowed(snapshot(), policy([]))).toEqual({ decision: 'unsupported', reason: 'combination-not-configured' });
    expect(checkClaudeTurnSettingsAllowed(snapshot(), policy())).toEqual({ decision: 'allowed' });
    const other = { ...requested, model: 'second-model', effort: { kind: 'level' as const, value: 'high' as const }, speed: 'fast' as const };
    const mixed = { ...snapshot(), requested: { ...requested, speed: 'fast' as const } };
    expect(checkClaudeTurnSettingsAllowed(mixed, policy([requested, other]))).toEqual({ decision: 'unsupported', reason: 'combination-not-configured' });
    const noEffort = { ...requested, effort: { kind: 'not-requested' as const } };
    expect(checkClaudeTurnSettingsAllowed({ ...snapshot(), requested: noEffort }, policy([noEffort]))).toEqual({ decision: 'allowed' });
    expect(checkClaudeTurnSettingsAllowed(snapshot(), policy([noEffort]))).toEqual({ decision: 'unsupported', reason: 'combination-not-configured' });
  });

  it('fences all three profile fields and limits the complete configured choices', () => {
    for (const changedProfile of [
      { ...profile, id: '00000000-0000-4000-8000-000000000003' },
      { ...profile, runnerId: '00000000-0000-4000-8000-000000000004' },
      { ...profile, configDigest: 'b'.repeat(64) },
    ]) expect(checkClaudeTurnSettingsAllowed(snapshot(), { ...policy(), profile: changedProfile })).toEqual({ decision: 'profile-mismatch' });
    const choices = Array.from({ length: 32 }, (_, index) => ({ ...requested, model: `model-${index}-${'m'.repeat(170)}` }));
    expect(claudeTurnSettingsChoicesSchema.parse(choices)).toHaveLength(32);
    expect(new TextEncoder().encode(JSON.stringify(choices)).length).toBeLessThanOrEqual(CLAUDE_TURN_CHOICES_MAX_BYTES);
    expect(claudeTurnSettingsChoicesSchema.safeParse([...choices, { ...requested, model: 'thirty-third' }]).success).toBe(false);
    expect(claudeTurnSettingsChoicesSchema.safeParse([requested, { speed: 'standard', effort: { value: 'medium', kind: 'level' }, thinking: 'adaptive', model: 'configured-model' }]).success).toBe(false);
  });

  it('accepts only the exact frozen acknowledgement and does not repair missing or changed fields', () => {
    const expected = snapshot();
    expect(assertClaudeTurnSettingsMatch(expected, structuredClone(expected))).toEqual(expected);
    const invalid = [undefined, null, {},
      { ...expected, protocol: 'flow.claude-turn-settings.v2' },
      { ...expected, profile: { ...profile, configDigest: 'b'.repeat(64) } },
      ...[
        { ...requested, model: 'other-model' }, { ...requested, thinking: 'disabled' },
        { ...requested, effort: { kind: 'level', value: 'high' } },
        { ...requested, effort: { kind: 'not-requested' } }, { ...requested, speed: 'fast' },
      ].map(next => ({ ...expected, requested: next })),
    ];
    for (const actual of invalid) expect(() => assertClaudeTurnSettingsMatch(expected, actual)).toThrow(ClaudeTurnSettingsMismatchError);
    expect(expected).toEqual(snapshot());
  });
});
