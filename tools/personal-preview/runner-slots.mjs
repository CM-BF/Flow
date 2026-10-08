import { constants } from 'node:fs';
import { open, lstat, realpath, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const LEGACY_NATIVE_CONFIGURATION = Object.freeze({ model: 'claude-sonnet-5-5', materialFiles: Object.freeze([]), allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60_000 });
export const SETTINGS_SLOT_KEY = 'runner-settings';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
let codecs;
async function contracts() {
  // The CLI remains plain ESM. Load the existing pure contract codecs only for opt-in settings.
  codecs ??= import('tsx/esm/api').then(({ tsImport }) => tsImport('../../packages/contracts/src/execution-profiles.ts', import.meta.url));
  return codecs;
}
async function privateBytes(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.uid !== BigInt(process.getuid()) || before.nlink !== 1n || (before.mode & 0o777n) !== 0o600n || before.size > 65536n) fail('RUNNER_SLOT_FILE_INVALID');
    const buffer = Buffer.alloc(65537); let size = 0;
    while (size < buffer.length) { const result = await file.read(buffer, size, buffer.length - size, size); if (!result.bytesRead) break; size += result.bytesRead; }
    const after = await file.stat({ bigint: true }), named = await lstat(path, { bigint: true });
    if (size !== Number(before.size) || before.dev !== after.dev || before.ino !== after.ino || before.mtimeNs !== after.mtimeNs || before.size !== after.size || named.dev !== after.dev || named.ino !== after.ino) fail('RUNNER_SLOT_FILE_CHANGED');
    return buffer.subarray(0, size);
  } finally { await file.close(); }
}
async function optionalJson(path) {
  try { return JSON.parse((await privateBytes(path)).toString('utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function directoryIdentity(path) {
  const info = await lstat(path, { bigint: true });
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== BigInt(process.getuid()) || (info.mode & 0o777n) !== 0o700n || await realpath(path) !== path) fail('RUNNER_SLOT_DIRECTORY_INVALID');
  return { dev: String(info.dev), ino: String(info.ino) };
}
async function exclusiveJson(path, value) {
  const bytes = Buffer.from(json(value) + '\n');
  if (bytes.length > 65536) fail('RUNNER_SLOT_FILE_LIMIT');
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  const parent = await open(join(path, '..'), constants.O_RDONLY | constants.O_DIRECTORY);
  try { await parent.sync(); } finally { await parent.close(); }
  return digest(bytes);
}
function runnerIdentity(value) {
  if (!value || Object.keys(value).sort().join() !== 'runnerId,token' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.runnerId ?? '') || typeof value.token !== 'string' || value.token.length < 1 || value.token.length > 1024) fail('RUNNER_SLOT_IDENTITY_INVALID');
  return { runnerId: value.runnerId, token: value.token };
}
export async function settingsRecipe(input) {
  if (!input || Object.keys(input).sort().join() !== 'choices,format' || input.format !== 1) fail('RUNNER_SLOT_RECIPE_INVALID');
  const c = await contracts();
  const turnSettings = c.claudeTurnSettingsConfigurationSchema.parse({ protocol: 'flow.claude-turn-settings.v1', choices: input.choices });
  if (!turnSettings.choices.length) fail('RUNNER_SLOT_CHOICES_EMPTY');
  const manifest = { ...LEGACY_NATIVE_CONFIGURATION, turnSettings };
  const configuration = c.executionProfileConfigurationSchema.parse({ harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: manifest.model,
    thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: digest('[]'),
    turnSettings, limits: { maxTurns: manifest.maxTurns, maxBudgetUsd: manifest.maxBudgetUsd, timeoutMs: manifest.timeoutMs } });
  return { manifest, configuration, configDigest: digest(c.executionProfileConfigurationJson(configuration)) };
}
function legacy(config) {
  return { id: 'legacy', key: 'runner', runner: config.runner, directory: config.directory, workdir: join(config.directory, 'runner'), manifestPath: join(config.directory, 'claude.json'), manifest: LEGACY_NATIVE_CONFIGURATION };
}
export function slotServiceKeys(slots) { return ['center', ...slots.map(slot => slot.key), 'web']; }
export function runnerServiceRole(key) {
  if (key === SETTINGS_SLOT_KEY) return 'runner';
  if (!['center', 'runner', 'web'].includes(key)) fail('UNKNOWN_SERVICE');
  return key;
}
/** The optional immutable descriptor is the single slot registry. There is no second process state. */
export async function readRunnerSlots(config) {
  const slots = [legacy(config)];
  const value = await optionalJson(join(config.directory, 'runner-settings.json'));
  if (!value) {
    if (await optionalJson(join(config.directory, 'runner-settings-intent.json'))) fail('RUNNER_SLOT_REGISTRATION_UNKNOWN');
    return slots;
  }
  if (value.format !== 1 || value.installationId !== config.installationId || value.slot !== 'settings') fail('RUNNER_SLOT_IDENTITY_INVALID');
  const directory = join(config.directory, SETTINGS_SLOT_KEY), workdir = join(directory, 'work');
  if (json(await directoryIdentity(directory)) !== json(value.directoryIdentity) || json(await directoryIdentity(workdir)) !== json(value.workdirIdentity)) fail('RUNNER_SLOT_DIRECTORY_CHANGED');
  const recipe = await settingsRecipe(value.recipe);
  if (json(recipe.configuration) !== json(value.configuration) || recipe.configDigest !== value.configDigest) fail('RUNNER_SLOT_CONFIGURATION_CHANGED');
  const manifestPath = join(directory, 'claude.json'), bytes = await privateBytes(manifestPath);
  if (digest(bytes) !== value.manifestDigest || json(JSON.parse(bytes.toString('utf8'))) !== json(recipe.manifest)) fail('RUNNER_SLOT_CONFIGURATION_CHANGED');
  const runner = runnerIdentity(value.runner);
  if (runner.runnerId === config.runner?.runnerId || runner.token === config.runner?.token) fail('RUNNER_SLOT_IDENTITY_REUSED');
  return [...slots, { id: 'settings', key: SETTINGS_SLOT_KEY, directory, workdir, manifestPath, runner, ...recipe }];
}
/** Caller owns the installation lock and center authentication; an unresolved create never retries. */
export async function registerSettingsSlot(config, input, createRunner) {
  if (!config.runner) fail('LEGACY_RUNNER_REQUIRED');
  const recipe = await settingsRecipe(input);
  const current = await readRunnerSlots(config);
  if (current.length !== 1) fail('RUNNER_SLOT_IMMUTABLE');
  const directory = join(config.directory, SETTINGS_SLOT_KEY), workdir = join(directory, 'work');
  await exclusiveJson(join(config.directory, 'runner-settings-intent.json'), { format: 1, installationId: config.installationId, recipe: input, configDigest: recipe.configDigest, state: 'registration-unknown' });
  await mkdir(directory, { mode: 0o700 }); await mkdir(workdir, { mode: 0o700 });
  const directoryPin = await directoryIdentity(directory), workdirPin = await directoryIdentity(workdir);
  const manifestDigest = await exclusiveJson(join(directory, 'claude.json'), recipe.manifest);
  const runner = runnerIdentity(await createRunner());
  if (runner.runnerId === config.runner.runnerId || runner.token === config.runner.token) fail('RUNNER_SLOT_IDENTITY_REUSED');
  await exclusiveJson(join(config.directory, 'runner-settings.json'), { format: 1, installationId: config.installationId, slot: 'settings', runner,
    recipe: input, configuration: recipe.configuration, configDigest: recipe.configDigest, manifestDigest, directoryIdentity: directoryPin, workdirIdentity: workdirPin });
  return (await readRunnerSlots(config))[1];
}
/** A finite catalog observation is configuration evidence only, never an actual claim/entitlement. */
export async function observeSettingsProfile(slot, readPage) {
  const c = await contracts(); let after; const seen = new Set(); let found = null;
  for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
    const page = c.claudeMessageSettingsCatalogPageSchema.parse(await readPage(after));
    for (const { profile } of page.profiles) {
      if (seen.has(profile.reference.id)) fail('RUNNER_SLOT_CATALOG_CHANGED'); seen.add(profile.reference.id);
      if (profile.reference.runnerId !== slot.runner.runnerId) continue;
      if (found || profile.reference.configDigest !== slot.configDigest || c.executionProfileConfigurationJson(profile.configuration) !== c.executionProfileConfigurationJson(slot.configuration)) fail('RUNNER_SLOT_PROFILE_MISMATCH');
      found = profile;
    }
    if (page.nextCursor === null) return found;
    after = page.nextCursor;
  }
  fail('RUNNER_SLOT_CATALOG_LIMIT');
}
export async function pinSettingsProfile(config, slot, profile, persist = false) {
  const path = join(config.directory, 'runner-settings-profile.json');
  const previous = await optionalJson(path), reference = profile.reference;
  if (previous && json(previous) !== json(reference)) fail('RUNNER_SLOT_PROFILE_CHANGED');
  if (!previous && !persist) return null;
  if (!previous) await exclusiveJson(path, reference);
  return { ...reference, source: 'runner-configured', model: profile.configuration.model, choices: profile.configuration.turnSettings.choices, provider: 'not-probed', actualClaim: 'unknown' };
}
