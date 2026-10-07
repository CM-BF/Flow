import { afterEach, expect, test } from 'vitest';
import { FlowApiError } from '@flow/client';
import { randomUUID } from 'node:crypto';
import { createInteractionController } from '../controller.js';
import type { InteractionController } from '../types.js';
import { controlledSettings, selectFirst, settingsFixture } from './fixture.js';
const controllers: InteractionController[] = [];
function setup(...args: Parameters<typeof controlledSettings>) { const value = controlledSettings(...args); controllers.push(value.controller); return value; }
afterEach(async () => { await Promise.all(controllers.splice(0).map(value => value.dispose())); });

test('catalog selection freezes exact next-message settings before send and clears only on accepted receipt', async () => {
  const value = setup(); expect((await selectFirst(value)).ok).toBe(true);
  expect(value.reads).toMatchObject([{ options: { limit: 6 } }]);
  expect(value.controller.snapshot().settings.selectionLabel).toContain('thinking adaptive');
  let persisted = false;
  value.client.submitConversationTurn = async (_id, input) => { persisted = JSON.stringify(value.saved()?.kind === 'send' ? (value.saved() as { input: unknown }).input : null) === JSON.stringify(input); return value.f.accepted(input); };
  expect((await value.controller.input('  hello 中文  ')).code).toBe('ACCEPTED'); expect(persisted).toBe(true);
  expect(value.saved()).toBeNull(); expect(value.controller.snapshot().settings.selected).toBeNull();
  expect((await value.controller.input('next')).code).toBe('SETTINGS_REQUIRED');
});
test('optional transport and missing capability are unsupported while old plain chat stays unchanged', async () => {
  const f = settingsFixture(); delete f.snapshot.capabilities.messageSettings;
  const value = setup(f); await selectFirst(value);
  expect((await value.controller.execute({ type: 'setting', profileId: f.reference.id, choice: 1 })).code).toBe('UNSUPPORTED_SETTINGS');
  expect((await value.controller.input('ordinary')).code).toBe('ACCEPTED'); expect(value.calls[0]!.input).not.toHaveProperty('messageSettings');
  const legacy = createInteractionController({ client: value.client, intents: value.intents, connectionId: 'settings-test' }); controllers.push(legacy);
  await legacy.initialize(); expect((await legacy.input('/settings')).code).toBe('UNSUPPORTED_SETTINGS');
});
test('lost ACK survives restart and newer catalog without changing original bytes/key or issuing automatic requests', async () => {
  const seen: string[] = []; const keys: string[] = []; const value = setup(); await selectFirst(value);
  value.client.submitConversationTurn = async (_id, input, key) => { seen.push(JSON.stringify(input)); keys.push(key); throw Error('lost'); };
  expect((await value.controller.input('frozen')).code).toBe('UNKNOWN'); const pending = value.saved(); expect(pending?.kind).toBe('send');
  expect((await value.controller.input('/setting-clear')).code).toBe('UNRESOLVED'); expect(seen).toHaveLength(1);
  await value.controller.dispose();
  const next = setup(value.f, { submitConversationTurn: async (_id, input, key) => { seen.push(JSON.stringify(input)); keys.push(key); return value.f.accepted(input); } }, pending);
  await next.controller.initialize(); expect(seen).toHaveLength(1);
  next.f.catalog.profiles[0]!.profile.configuration.turnSettings!.choices.reverse();
  await next.controller.input('/settings');
  expect((await next.controller.input('/recover')).code).toBe('ACCEPTED'); expect(seen[1]).toBe(seen[0]); expect(keys[1]).toBe(keys[0]);
});
test('contradictory success ACK keeps unknown and the frozen original intent', async () => {
  const value = setup(); await selectFirst(value); let calls = 0;
  value.client.submitConversationTurn = async (_id, input) => { calls++; const reply = value.f.accepted(input); reply.turn.messageSettings!.requested = value.f.choices[1]!; return reply; };
  expect((await value.controller.input('identity')).code).toBe('UNKNOWN'); expect(calls).toBe(1);
  expect(value.saved()).toMatchObject({ kind: 'send', input: { messageSettings: { requested: value.f.choices[0] } } });
});
test('stale CAS keeps draft and selection, refreshes revision, and never resubmits automatically', async () => {
  const value = setup(); await selectFirst(value); value.controller.setDraft('keep draft'); let calls = 0;
  value.client.submitConversationTurn = async () => { calls++; value.f.snapshot.conversation.revision = 2; throw new FlowApiError(409, 'conversation_revision_conflict', 'stale'); };
  expect((await value.controller.input('keep draft')).code).toBe('HTTP_409'); expect(calls).toBe(1);
  expect(value.controller.snapshot()).toMatchObject({ draft: 'keep draft', selected: { revision: 2 }, pending: null });
  expect(value.controller.snapshot().settings.selected?.requested).toEqual(value.f.choices[0]); expect(value.saved()).toBeNull();
});
test('disconnect ignores late catalog and switching conversation clears only unsent selection', async () => {
  const value = setup(); await selectFirst(value);
  let finish!: (value: ReturnType<typeof settingsFixture>['catalog']) => void;
  value.client.claudeMessageSettingsProfiles = () => new Promise(resolve => { finish = resolve; });
  const loading = value.controller.input('/settings'); await Promise.resolve(); value.controller.disconnect(); finish({ ...value.f.catalog, profiles: [] });
  expect((await loading).code).toBe('STALE'); expect(value.controller.snapshot().settings.profiles).toHaveLength(1);
  value.f.snapshot.conversation.id = randomUUID();
  await value.controller.execute({ type: 'open', id: value.f.snapshot.conversation.id });
  expect(value.controller.snapshot().settings.selected).toBeNull();
});
test('a settings profile can create through the old stable ACK then obtains capability only from GET', async () => {
  const value = setup(); await value.controller.initialize(); await value.controller.input('/settings');
  expect((await value.controller.input(`/new --profile ${value.f.reference.id} New settings conversation`)).code).toBe('ACCEPTED');
  expect(value.controller.snapshot().settings.supported).toBe(true); expect(value.controller.snapshot().settings.selected).toBeNull();
});
test('typed commands reject caller-composed fields and changed capability blocks an unsent choice', async () => {
  const value = setup(); await selectFirst(value);
  expect((await value.controller.execute({ type: 'setting', profileId: value.f.reference.id, choice: 1, model: 'invented' } as never)).code).toBe('INVALID_COMMAND');
  delete value.f.snapshot.capabilities.messageSettings;
  await value.controller.input('/recover');
  expect((await value.controller.input('blocked')).code).toBe('SETTINGS_PROFILE_MISMATCH'); expect(value.calls).toHaveLength(0);
});
