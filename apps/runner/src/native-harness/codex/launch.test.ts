import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadCodexProductionRunnerConfiguration } from '../../configuration.js';
const native = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../codex/index.js', () => ({ createCodexTransport: native.create }));
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { textDigest } from '../../verifier.js';
import { persistentTransportFixture } from './continuity-fixture.js';
import { configureCodexLaunch, prepareCodexLaunchRecipe, publishPersistentCodexLaunch } from './launch.js';

const profile = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } };

it('constructs an immutable ordinary harness using an explicit factory without native I/O', () => {
  const createTransport = vi.fn(() => { throw new Error('Construction must not launch a process.'); });
  const configured = configureCodexLaunch(profile, createTransport);
  expect(configured.adapter.name).toBe('codex');
  expect(configured.descriptor.publicProfile).toEqual(profile);
  expect(configured.descriptor.ports).toEqual({});
  expect(Object.isFrozen(configured.descriptor.publicProfile)).toBe(true);
  expect(Object.isFrozen(configured.descriptor.publicProfile.hostLimits)).toBe(true);
  expect(createTransport).not.toHaveBeenCalled();
});

it('has no default executable or self-authorized launch recipe', () => {
  expect(() => configureCodexLaunch(profile)).toThrow('A trusted Codex launch factory is unavailable.');
});

it.each(['executable', 'args', 'env', 'approved', 'query', 'resume', 'launch'])('rejects untrusted %s rather than converting JSON into native launch authority', key => {
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  expect(() => configureCodexLaunch({ ...profile, [key]: true }, createTransport)).toThrow();
  expect(createTransport).not.toHaveBeenCalled();
});

it('rejects unsupported versions and permissions before invoking a trusted dependency', () => {
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  for (const change of [{ adapterVersion: 'latest' }, { access: 'configured-readonly' }, { approvalPolicy: 'on-request' }, { sandboxMode: 'workspace-write' }]) {
    expect(() => configureCodexLaunch({ ...profile, ...change }, createTransport)).toThrow();
  }
  expect(createTransport).not.toHaveBeenCalled();
});


const persistentProfile: CodexExecutionProfileConfiguration = { ...profile, harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1',
  model: 'fixture-model', serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', sessionPersistence: 'host-owned' };
const publishedReference = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId: '5668918f-58a1-4703-89dc-705e92a8b4c4',
  configDigest: textDigest(nativeExecutionProfileConfigurationJson(persistentProfile)) };
const ownedRoots: { path: string; dev: number; ino: number }[] = [];
function ownRoot() {
  const path = mkdtempSync(join(tmpdir(), 'flow-c02-launch-')); const { dev, ino } = lstatSync(path);
  ownedRoots.push({ path, dev, ino }); return path;
}
afterEach(() => { vi.unstubAllGlobals(); native.create.mockReset(); });
afterAll(() => {
  const receipt = ownedRoots.map(root => {
    const current = lstatSync(root.path); expect([current.dev, current.ino]).toEqual([root.dev, root.ino]);
    rmSync(root.path, { recursive: true }); expect(() => lstatSync(root.path)).toThrow(); return { ...root, absent: true };
  });
  if (process.env.FLOW_C02_LAUNCH_REPORT) writeFileSync(process.env.FLOW_C02_LAUNCH_REPORT, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
});
function publication(reference: unknown = publishedReference, configuration: unknown = persistentProfile) {
  return new Response(JSON.stringify({ profile: { reference, configuration }, replayed: false }), { status: 200 });
}
function launchOptions(codeHome: string, createTransport = vi.fn(() => { throw new Error('Unexpected factory'); })) {
  return { baseUrl: 'http://fixture.invalid', token: 'synthetic-token', codeHome, createTransport };
}
function persistentContext(workingDirectory: string, events: RunnerEventData[], resumeSessionId?: string): HarnessContext {
  return { task: { title: 'Startup fixture', prompt: 'Continue', harness: 'codex', executionProfile: publishedReference,
    ...(resumeSessionId ? { resumeSessionId } : {}) }, workingDirectory,
    executionIdentity: { runnerId: publishedReference.runnerId, taskId: 'task', attemptId: 'attempt', ownerVersion: 1 },
    signal: new AbortController().signal, async assertOwnership() {}, async emit(event) { events.push(event); },
    async waitForDecision() { throw new Error('No approvals'); } };
}

it('persistent startup publishes before storage binding and freezes the selected trusted recipe', async () => {
  const parent = ownRoot(); const codeHome = join(parent, 'home');
  let acknowledge!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { acknowledge = resolve; })); vi.stubGlobal('fetch', fetch);
  const options = launchOptions(codeHome);
  const pending = publishPersistentCodexLaunch(persistentProfile, options);
  expect(fetch).toHaveBeenCalledTimes(1); expect(() => lstatSync(codeHome)).toThrow();
  mkdirSync(codeHome, { mode: 0o700 }); options.codeHome = join(parent, 'missing-private');
  acknowledge(publication());
  const result = await pending;
  expect(result.reference).toEqual(publishedReference); expect(Object.isFrozen(result.reference)).toBe(true);
  expect(result.configured.descriptor.ports).toEqual({ sessionPersistence: 'host-owned' });
  expect(options.createTransport).not.toHaveBeenCalled();
});

it('persistent startup supplies the same storage to two actual injected factories behind the published guard', async () => {
  const root = ownRoot(); const codeHome = join(root, 'home'); mkdirSync(codeHome, { mode: 0o700 });
  const fixture = persistentTransportFixture({ codeHome }); const createTransport = vi.fn(fixture.createTransport);
  const fetch = vi.fn(async () => publication()); vi.stubGlobal('fetch', fetch);
  const { configured } = await publishPersistentCodexLaunch(persistentProfile, { ...launchOptions(codeHome), createTransport });
  expect(createTransport).not.toHaveBeenCalled();
  const events: RunnerEventData[] = []; const first = join(root, 'attempt-a'); const second = join(root, 'attempt-b');
  for (const path of [first, second]) mkdirSync(path, { mode: 0o700 });
  await configured.adapter.run(persistentContext(first, events));
  await configured.adapter.run(persistentContext(second, events, 'persistent-thread'));
  expect(createTransport.mock.calls.map(([options]) => [options.codeHome, options.workingDirectory])).toEqual([[codeHome, first], [codeHome, second]]);
  expect(fixture.instances).toMatchObject([{ closed: true, reads: 1 }, { closed: true, reads: 2 }]);
  expect(events.filter(event => event.type === 'assistant-final')).toHaveLength(2);
  const request = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(request[0]).toBe('http://fixture.invalid/api/runner/execution-profile');
  expect(JSON.parse(String(request[1].body))).toEqual({ configuration: persistentProfile });
  expect(String(request[1].body)).not.toContain(codeHome); expect(JSON.stringify(events)).not.toContain(codeHome);
});

it.each(['missing', 'runner', 'digest', 'configuration', 'lost'] as const)('persistent startup rejects %s publication ACK without fallback or a factory', async mode => {
  const options = launchOptions('/missing-private-storage');
  const fetch = vi.fn(async () => {
    if (mode === 'lost') throw new Error('Lost fixture response');
    return publication(mode === 'missing' ? undefined : { ...publishedReference,
      ...(mode === 'runner' ? { runnerId: 'invalid' } : {}), ...(mode === 'digest' ? { configDigest: '0'.repeat(64) } : {}) },
      mode === 'configuration' ? { ...persistentProfile, model: 'another-model' } : persistentProfile);
  });
  if (mode === 'missing') fetch.mockImplementation(async () => new Response(JSON.stringify({ replayed: false }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await expect(publishPersistentCodexLaunch(persistentProfile, options)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1); expect(options.createTransport).not.toHaveBeenCalled();
});

it('persistent startup rejects unsupported profiles before publication and checks the assignment before any factory', async () => {
  const options = launchOptions(ownRoot()); const fetch = vi.fn(async () => publication()); vi.stubGlobal('fetch', fetch);
  await expect(publishPersistentCodexLaunch(profile, options)).rejects.toThrow('persistent Codex profile');
  await expect(publishPersistentCodexLaunch({ ...persistentProfile, env: {} }, options)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  const { configured } = await publishPersistentCodexLaunch(persistentProfile, options);
  const context = persistentContext('/fixture-attempt', []);
  for (const change of [{ id: 'ea255104-20bf-46ce-b2c2-06e5a33ba1ca' }, { runnerId: 'ae255104-20bf-46ce-b2c2-06e5a33ba1ca' }, { configDigest: '0'.repeat(64) }]) {
    await expect(configured.adapter.run({ ...context, task: { ...context.task, executionProfile: { ...publishedReference, ...change } } })).rejects.toThrow();
  }
  await expect(configured.adapter.run({ ...context, executionIdentity: { ...context.executionIdentity!, runnerId: 'other' } })).rejects.toThrow();
  expect(options.createTransport).not.toHaveBeenCalled();
});

it('persistent startup preserves storage inode checks until factory invocation', async () => {
  const root = ownRoot(); const codeHome = join(root, 'home'); mkdirSync(codeHome, { mode: 0o700 });
  const options = launchOptions(codeHome); vi.stubGlobal('fetch', vi.fn(async () => publication()));
  const { configured } = await publishPersistentCodexLaunch(persistentProfile, options);
  renameSync(codeHome, join(root, 'original')); mkdirSync(codeHome, { mode: 0o700 });
  await expect(configured.adapter.run(persistentContext('/fixture-attempt', []))).rejects.toThrow();
  expect(options.createTransport).not.toHaveBeenCalled();
});

it('persistent startup honors cancellation after a publication ACK before binding storage', async () => {
  const controller = new AbortController(); const options = launchOptions('/missing-private-storage');
  vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); return publication(); }));
  await expect(publishPersistentCodexLaunch(persistentProfile, { ...options, signal: controller.signal })).rejects.toThrow();
  expect(options.createTransport).not.toHaveBeenCalled();
});

function operatorRecipe() {
  const root = realpathSync(ownRoot()); const executable = join(root, 'codex'); const contents = 'synthetic executable, never launched';
  writeFileSync(executable, contents, { mode: 0o700 });
  const recipe = { protocol: 'flow.codex-launch.v1', executable, executableSha256: createHash('sha256').update(contents).digest('hex'),
    home: join(root, 'home'), codeHome: join(root, 'codex-home'), temporaryDirectory: join(root, 'temporary') };
  for (const path of [recipe.home, recipe.codeHome, recipe.temporaryDirectory]) mkdirSync(path, { mode: 0o700 });
  return { root, recipe };
}
it('operator recipe binds the actual R06 spawn to fixed storage, independent of each attempt cwd', () => {
  const { recipe } = operatorRecipe(); const prepared = prepareCodexLaunchRecipe(recipe);
  expect(native.create).not.toHaveBeenCalled();
  native.create.mockReturnValue({ synthetic: true });
  for (const workingDirectory of ['/attempt-a', '/attempt-b']) prepared.createTransport({ workingDirectory, codeHome: recipe.codeHome, signal: new AbortController().signal });
  expect(native.create).toHaveBeenCalledTimes(2);
  for (const [index, [options]] of native.create.mock.calls.entries()) {
    expect(options.spawn).toEqual({ executable: recipe.executable, args: ['app-server', '--listen', 'stdio://'], cwd: index ? '/attempt-b' : '/attempt-a',
      environment: { PATH: '/usr/bin:/bin', HOME: recipe.home, CODEX_HOME: recipe.codeHome, TMPDIR: recipe.temporaryDirectory, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC' } });
    expect(options.initialize.capabilities).toBeNull();
  }
  expect(() => prepared.createTransport({ workingDirectory: '/attempt', codeHome: '/foreign-root', signal: new AbortController().signal })).toThrow();
  expect(native.create).toHaveBeenCalledTimes(2);
});
it('operator recipe rejects arbitrary options, wrong binary hash and changed identities before R06', () => {
  const { root, recipe } = operatorRecipe();
  expect(() => prepareCodexLaunchRecipe({ ...recipe, env: { SECRET: 'never inherited' } })).toThrow();
  expect(() => prepareCodexLaunchRecipe({ ...recipe, executableSha256: '0'.repeat(64) })).toThrow();
  const prepared = prepareCodexLaunchRecipe(recipe);
  renameSync(recipe.home, join(root, 'original-home')); mkdirSync(recipe.home, { mode: 0o700 });
  expect(() => prepared.createTransport({ workingDirectory: '/attempt', codeHome: recipe.codeHome, signal: new AbortController().signal })).toThrow();
  expect(native.create).not.toHaveBeenCalled();
});
it('operator recipe refuses writable executable and nonprivate roots, including after preparation', () => {
  const { recipe } = operatorRecipe(); chmodSync(recipe.executable, 0o777);
  expect(() => prepareCodexLaunchRecipe(recipe)).toThrow(); chmodSync(recipe.executable, 0o700);
  const prepared = prepareCodexLaunchRecipe(recipe); chmodSync(recipe.temporaryDirectory, 0o755);
  expect(() => prepared.createTransport({ workingDirectory: '/attempt', codeHome: recipe.codeHome, signal: new AbortController().signal })).toThrow();
  expect(() => prepareCodexLaunchRecipe(recipe)).toThrow(); expect(native.create).not.toHaveBeenCalled();
});
it('production loader reads a strict profile and operator recipe before publication, then restores through R06', async () => {
  const { root, recipe } = operatorRecipe(); const profileFile = join(root, 'profile.json'), recipeFile = join(root, 'launch.json');
  writeFileSync(profileFile, JSON.stringify(persistentProfile)); writeFileSync(recipeFile, JSON.stringify(recipe));
  const fetch = vi.fn(async () => publication()); vi.stubGlobal('fetch', fetch);
  const fixture = persistentTransportFixture({ codeHome: recipe.codeHome });
  native.create.mockImplementation(options => fixture.createTransport({ codeHome: options.spawn.environment.CODEX_HOME, workingDirectory: options.spawn.cwd, signal: options.signal }));
  const loaded = await loadCodexProductionRunnerConfiguration({ codexManifestFile: profileFile, launchManifestFile: recipeFile, baseUrl: 'http://fixture.invalid', token: 'synthetic' });
  expect(fetch).toHaveBeenCalledOnce(); expect(native.create).not.toHaveBeenCalled();
  const events: RunnerEventData[] = [];
  for (const [index, directory] of ['attempt-one', 'attempt-two'].entries()) {
    const cwd = join(root, directory); mkdirSync(cwd, { mode: 0o700 });
    await loaded.adapters.find(adapter => adapter.name === 'codex')!.run(persistentContext(cwd, events, index ? 'persistent-thread' : undefined));
  }
  expect(native.create).toHaveBeenCalledTimes(2); expect(fixture.instances).toMatchObject([{ closed: true, reads: 1 }, { closed: true, reads: 2 }]);
  expect(events.filter(event => event.type === 'assistant-final')).toHaveLength(2);
  expect(native.create.mock.calls.map(([options]) => options.spawn.environment.CODEX_HOME)).toEqual([recipe.codeHome, recipe.codeHome]);
});
it('production loader refuses legacy profiles and invalid recipes before publication and never starts after unknown ACK', async () => {
  const { root, recipe } = operatorRecipe(); const profileFile = join(root, 'profile.json'), recipeFile = join(root, 'launch.json');
  const fetch = vi.fn(async () => new Response('{}')); vi.stubGlobal('fetch', fetch);
  const options = { codexManifestFile: profileFile, launchManifestFile: recipeFile, baseUrl: 'http://fixture.invalid', token: 'synthetic' };
  writeFileSync(profileFile, JSON.stringify(profile));
  await expect(loadCodexProductionRunnerConfiguration(options)).rejects.toThrow('persistent Codex profile');
  writeFileSync(profileFile, JSON.stringify(persistentProfile)); writeFileSync(recipeFile, JSON.stringify({ ...recipe, args: [] }));
  await expect(loadCodexProductionRunnerConfiguration(options)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  writeFileSync(recipeFile, JSON.stringify(recipe));
  await expect(loadCodexProductionRunnerConfiguration(options)).rejects.toThrow(); expect(fetch).toHaveBeenCalledOnce(); expect(native.create).not.toHaveBeenCalled();
});
