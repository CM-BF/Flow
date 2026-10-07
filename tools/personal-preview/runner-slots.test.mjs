import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile, readFile, rename, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LEGACY_NATIVE_CONFIGURATION, settingsRecipe, readRunnerSlots, registerSettingsSlot, observeSettingsProfile, pinSettingsProfile, slotServiceKeys } from './runner-slots.mjs';
const choices = [{ model: 'claude-sonnet-5-5', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'standard' },
  { model: 'claude-opus-4-6', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'fast' }];
async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc09a-slots-')));
  t.after(() => rm(directory, { recursive: true }));
  const config = { installationId: randomUUID(), directory, runner: { runnerId: randomUUID(), token: 'legacy-synthetic' } };
  await mkdir(join(directory, 'runner'), { mode: 0o700 });
  await writeFile(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
  await writeFile(join(directory, 'claude.json'), JSON.stringify(LEGACY_NATIVE_CONFIGURATION), { mode: 0o600 });
  const identity = { runnerId: randomUUID(), token: 'settings-synthetic' };
  return { config, identity, register: () => registerSettingsSlot(config, { format: 1, choices }, async () => identity) };
}
function page(slot, reference = { id: randomUUID(), runnerId: slot.runner.runnerId, configDigest: slot.configDigest }) {
  return { protocol: 'flow.claude-turn-settings.v1', profiles: [{ profile: { reference, configuration: slot.configuration,
    source: 'runner-configured', availability: 'not-probed', model: { value: slot.configuration.model, resolvedModel: null, displayName: slot.configuration.model, description: '', providerCapabilities: 'unknown' }, createdAt: '2026-10-07T00:00:00.000Z',
    controls: { access: 'configured-policy', queue: false, steer: false, messageSettings: { protocol: 'flow.claude-turn-settings.v1', choices: 'configuration.turnSettings.choices' } } },
    conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } }], nextCursor: null };
}
test('SVC09A default legacy slot preserves the existing identity, paths and configuration bytes', async t => {
  const f = await fixture(t); const before = await readFile(join(f.config.directory, 'claude.json'));
  const slots = await readRunnerSlots(f.config); assert.equal(slots.length, 1); assert.deepEqual(slots[0].runner, f.config.runner);
  assert.deepEqual(slotServiceKeys(slots), ['center', 'runner', 'web']);
  assert.deepEqual(await readFile(join(f.config.directory, 'claude.json')), before);
});
test('SVC09A configuration preserves complete choices and rejects duplicate, partial or extra authority', async () => {
  const recipe = await settingsRecipe({ format: 1, choices }); assert.deepEqual(recipe.configuration.turnSettings.choices, choices);
  assert.equal(recipe.configuration.access, 'none'); assert.equal(recipe.manifest.allowRead, false);
  for (const value of [{ format: 1, choices: [] }, { format: 1, choices: [choices[0], choices[0]] }, { format: 1, choices: [{ model: choices[0].model }] }, { format: 1, choices, access: 'goal-tools' }]) await assert.rejects(settingsRecipe(value));
});
test('SVC09A successful registration creates one immutable slot without changing legacy state', async t => {
  const f = await fixture(t); const config = await readFile(join(f.config.directory, 'config.json')), manifest = await readFile(join(f.config.directory, 'claude.json'));
  const slot = await f.register(); assert.equal(slot.runner.runnerId, f.identity.runnerId); assert.equal(slot.id, 'settings');
  assert.deepEqual(slotServiceKeys(await readRunnerSlots(f.config)), ['center', 'runner', 'runner-settings', 'web']);
  assert.deepEqual(await readFile(join(f.config.directory, 'config.json')), config); assert.deepEqual(await readFile(join(f.config.directory, 'claude.json')), manifest);
  await assert.rejects(f.register(), { code: 'RUNNER_SLOT_IMMUTABLE' });
});
test('SVC09A lost registration ACK persists unknown and never repeats the create request', async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(registerSettingsSlot(f.config, { format: 1, choices }, async () => { calls++; throw new Error('lost ACK'); }));
  await assert.rejects(registerSettingsSlot(f.config, { format: 1, choices }, async () => { calls++; return f.identity; }), { code: 'RUNNER_SLOT_REGISTRATION_UNKNOWN' });
  assert.equal(calls, 1); assert.equal(JSON.parse(await readFile(join(f.config.directory, 'runner-settings-intent.json'))).state, 'registration-unknown');
});
test('SVC09A rejects reuse of the old runner and detects manifest or directory replacement', async t => {
  const reused = await fixture(t); await assert.rejects(registerSettingsSlot(reused.config, { format: 1, choices }, async () => reused.config.runner), { code: 'RUNNER_SLOT_IDENTITY_REUSED' });
  const changed = await fixture(t), slot = await changed.register();
  await writeFile(slot.manifestPath, JSON.stringify({ ...slot.manifest, allowRead: true })); await assert.rejects(readRunnerSlots(changed.config), { code: 'RUNNER_SLOT_CONFIGURATION_CHANGED' });
  const replaced = await fixture(t), other = await replaced.register(); await rename(other.workdir, `${other.workdir}-old`); await mkdir(other.workdir, { mode: 0o700 });
  await assert.rejects(readRunnerSlots(replaced.config), { code: 'RUNNER_SLOT_DIRECTORY_CHANGED' });
});
test('SVC09A exact catalog tuple binds immutable profile and never implies provider or claim readiness', async t => {
  const f = await fixture(t), slot = await f.register(), catalog = page(slot);
  const profile = await observeSettingsProfile(slot, async () => catalog);
  assert.equal(await pinSettingsProfile(f.config, slot, profile), null); // status is read only
  const pinned = await pinSettingsProfile(f.config, slot, profile, true); assert.equal(pinned.provider, 'not-probed'); assert.equal(pinned.actualClaim, 'unknown');
  assert.deepEqual(pinned.choices, choices);
  await assert.rejects(pinSettingsProfile(f.config, slot, { ...profile, reference: { ...profile.reference, id: randomUUID() } }, true), { code: 'RUNNER_SLOT_PROFILE_CHANGED' });
});
test('SVC09A rejects catalog configuration mismatch and treats absent capability as unconfirmed', async t => {
  const f = await fixture(t), slot = await f.register();
  const bad = page(slot); bad.profiles[0].profile.reference.configDigest = 'a'.repeat(64);
  await assert.rejects(observeSettingsProfile(slot, async () => bad), { code: 'RUNNER_SLOT_PROFILE_MISMATCH' });
  assert.equal(await observeSettingsProfile(slot, async () => ({ protocol: 'flow.claude-turn-settings.v1', profiles: [], nextCursor: null })), null);
  await assert.rejects(observeSettingsProfile(slot, async () => ({ profiles: [] })));
});
test('SVC09A catalog traversal is bounded and never accepts a repeated page as fresh evidence', async t => {
  const f = await fixture(t), slot = await f.register(), repeated = page(slot); repeated.nextCursor = repeated.profiles[0].profile.reference.id;
  let count = 0; await assert.rejects(observeSettingsProfile(slot, async () => { count++; return repeated; }), { code: 'RUNNER_SLOT_CATALOG_CHANGED' }); assert.equal(count, 2);
});
