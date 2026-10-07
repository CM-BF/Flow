import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ConversationTurn } from '@flow/contracts';
import { parseInput } from '../commands.js';
import { settingsFixture } from './fixture.js';
import { readSettingsPage, selectSettings, settingsProfile, settingsEvidence } from './index.js';

test('typed selection and slash only identify a complete loaded tuple', () => {
  const f = settingsFixture(); const page = readSettingsPage(f.catalog);
  const chosen = selectSettings(page, f.reference, f.reference.id, 2);
  expect(chosen.requested).toEqual(f.choices[1]); expect(chosen.profile).toEqual(f.reference);
  expect(parseInput(`/setting ${f.reference.id} 2`)).toEqual({ type: 'setting', profileId: f.reference.id, choice: 2 });
  expect(() => parseInput(`/setting ${f.reference.id} 2 --model anything`)).toThrow();
  expect(() => selectSettings(page, f.reference, f.reference.id, 3)).toThrow();
  expect(() => selectSettings(page, { ...f.reference, configDigest: 'b'.repeat(64) }, f.reference.id, 1)).toThrow();
  expect(() => selectSettings(page, null, f.reference.id, 1)).toThrow();
});
test('capability requires the conversation profile triple and Claude protocol; catalog is bounded and never accepts Codex', () => {
  const f = settingsFixture(); const c = f.snapshot.conversation, cap = f.snapshot.capabilities.messageSettings!;
  expect(settingsProfile(c, cap)).toEqual(f.reference); expect(settingsProfile(c, undefined)).toBeNull();
  for (const field of ['id', 'runnerId', 'configDigest'] as const) expect(settingsProfile(c, { ...cap, profile: { ...cap.profile, [field]: field === 'configDigest' ? 'c'.repeat(64) : randomUUID() } })).toBeNull();
  expect(() => readSettingsPage({ ...f.catalog, protocol: 'native-v1' })).toThrow();
  expect(() => readSettingsPage({ ...f.catalog, profiles: Array.from({ length: 7 }, () => ({ ...f.catalog.profiles[0], profile: { ...f.catalog.profiles[0]!.profile, reference: { ...f.reference, id: randomUUID() } } })) })).toThrow();
});
test('requested and init observation stay separate and every mismatched final remains unknown', () => {
  const f = settingsFixture(); const settings = selectSettings(f.catalog, f.reference, f.reference.id, 1);
  const turn = f.accepted({ mode: 'follow-up', text: 'hello', expectedRevision: 0, messageSettings: settings }).turn;
  expect(settingsEvidence(turn)).toMatchObject({ requested: f.choices[0], observed: null, thinking: 'unknown', observedLabel: 'unknown' });
  const attemptId = randomUUID(), detailId = randomUUID(), messageId = 'd'.repeat(64);
  turn.assistant = { state: 'available', role: 'assistant', messageId, text: 'answer', truncated: false,
    contentRef: { kind: 'detail', id: detailId, title: 'Final', taskId: turn.task.id, attemptId },
    source: { kind: 'assistant-final', source: 'claude.sdk.result', messageId, taskId: turn.task.id, attemptId, nativeSessionId: 'session', eventId: 'event', sourceMessageId: 'result', contentDigest: 'e'.repeat(64), detailId } };
  turn.effective = { model: 'observed-alias', thinking: 'unknown', tools: null,
    source: { kind: 'assistant-final', messageId, taskId: turn.task.id, attemptId, detailId },
    messageSettings: { snapshot: settings, observed: { source: 'claude.sdk.system.init', model: 'observed-alias', effort: null, fastModeState: 'cooldown' } } };
  expect(settingsEvidence(turn)).toMatchObject({ requested: f.choices[0], observed: { model: 'observed-alias', effort: null, fastModeState: 'cooldown' }, thinking: 'unknown' });
  expect(settingsEvidence(turn)?.observedLabel).toContain('effort unknown');
  for (const mutate of [
    (v: ConversationTurn) => { v.effective.source = null; },
    (v: ConversationTurn) => { v.effective.source!.taskId = 'other'; },
    (v: ConversationTurn) => { v.effective.thinking = 'disabled'; },
    (v: ConversationTurn) => { v.effective.runnerRequested = { model: 'sonnet', thinking: 'disabled', permissionMode: 'dontAsk' }; },
    (v: ConversationTurn) => { v.effective.messageSettings!.snapshot = { ...settings, requested: f.choices[1]! }; },
  ]) { const invalid = structuredClone(turn); mutate(invalid); expect(settingsEvidence(invalid)?.observed).toBeNull(); }
  delete turn.messageSettings; delete turn.effective.messageSettings; expect(settingsEvidence(turn)).toBeUndefined();
});
