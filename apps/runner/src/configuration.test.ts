import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import * as filesystem from 'node:fs/promises';
import { constants, lstatSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { loadCodexRunnerConfiguration, loadPublishedCodexRunnerConfiguration, loadRunnerAdapters, loadSelectedRunnerConfiguration } from './configuration.js';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, stat: vi.fn(actual.stat), open: vi.fn(actual.open) };
});

const directories: { path: string; dev: number; ino: number }[] = [];
const cleanup: { path: string; dev: number; ino: number; absent: boolean }[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) {
    const current = lstatSync(directory.path); expect([current.dev, current.ino]).toEqual([directory.dev, directory.ino]);
    await rm(directory.path, { recursive: true }); expect(() => lstatSync(directory.path)).toThrow();
    cleanup.push({ ...directory, absent: true });
  }
});
afterAll(() => {
  if (process.env.FLOW_C02_CONFIGURATION_REPORT) writeFileSync(process.env.FLOW_C02_CONFIGURATION_REPORT, JSON.stringify(cleanup), { flag: 'wx', mode: 0o600 });
});
async function manifest(value: unknown) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-runner-config-'));
  const { dev, ino } = lstatSync(directory); directories.push({ path: directory, dev, ino });
  const path = join(directory, 'claude.json');
  await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  return path;
}
it('defaults the ordinary runner entry point to fixture only', async () => {
  expect((await loadRunnerAdapters()).map(adapter => adapter.name)).toEqual(['fixture']);
});
it('enables Claude from an explicit material manifest without starting a query', async () => {
  const file = await manifest({ materialFiles: ['/tmp/explicit-authorized-material.txt'], maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 30_000 });
  expect((await loadRunnerAdapters(file)).map(adapter => adapter.name)).toEqual(['fixture', 'claude']);
});
it.each([
  {}, { materialFiles: ['relative.txt'] }, { materialFiles: [], tools: ['Bash'] },
  { materialFiles: [], query: 'injected' }, { materialFiles: [], maxBudgetUsd: 5 },
  { materialFiles: [], requireReadApproval: 'false' }, { materialFiles: [], maxTurns: 5 },
])('rejects an invalid or policy-widening manifest %j', async value => {
  await expect(loadRunnerAdapters(await manifest(value))).rejects.toThrow();
});

it('binds explicit active steering to one immutable profile while preserving legacy canonical bytes', async () => {
  const { loadRunnerConfiguration } = await import('./configuration.js');
  const omitted = await loadRunnerConfiguration(await manifest({ materialFiles: [] }));
  const disabled = await loadRunnerConfiguration(await manifest({ materialFiles: [], activeSteering: false }));
  const enabled = await loadRunnerConfiguration(await manifest({ materialFiles: [], activeSteering: true }));
  expect(disabled).toMatchObject({ activeSteering: false, profile: omitted.profile });
  expect(enabled).toMatchObject({ activeSteering: true, profile: { activeSteering: { protocol: 'flow.active-steering.v1' } } });
  expect(Object.hasOwn(omitted.profile!, 'activeSteering')).toBe(false);
});

it.each(['true', null, { protocol: 'flow.active-steering.v1' }])('rejects a non-boolean steering manifest without starting a query: %j', async activeSteering => {
  await expect(loadRunnerAdapters(await manifest({ materialFiles: [], activeSteering }))).rejects.toThrow();
});
it('refuses steering configuration for a planner tool profile', async () => {
  await expect(loadRunnerAdapters(await manifest({ materialFiles: [], goalTools: true, activeSteering: true }))).rejects.toThrow();
});

it('refuses to silently drop steering configuration through the legacy adapter-only loader', async () => {
  await expect(loadRunnerAdapters(await manifest({ materialFiles: [], activeSteering: true }))).rejects.toThrow('loadRunnerConfiguration');
});

const codexProfile = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } };

it('loads a strict Codex profile through the shared descriptor without starting a process', async () => {
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  const loaded = await loadCodexRunnerConfiguration(await manifest(codexProfile), createTransport);
  expect(loaded.adapters.map(adapter => adapter.name)).toEqual(['fixture', 'codex']);
  expect(loaded.profile).toEqual(codexProfile); expect(loaded.activeSteering).toBe(false);
  expect(loaded.harnesses[1]!.descriptor.publicProfile).toBe(loaded.profile);
  expect(createTransport).not.toHaveBeenCalled();
});

it('fails without a trusted factory and refuses relative or oversized Codex files', async () => {
  await expect(loadCodexRunnerConfiguration(await manifest(codexProfile))).rejects.toThrow('trusted Codex launch factory');
  await expect(loadCodexRunnerConfiguration('relative.json')).rejects.toThrow('absolute file');
  await expect(loadCodexRunnerConfiguration(await manifest({ ...codexProfile, model: '中'.repeat(6000) }))).rejects.toThrow('small');
});

it('uses explicit mutually exclusive native selection while preserving fixture and Claude defaults', async () => {
  expect((await loadSelectedRunnerConfiguration()).adapters.map(adapter => adapter.name)).toEqual(['fixture']);
  const claudeManifestFile = await manifest({ materialFiles: [] });
  expect((await loadSelectedRunnerConfiguration({ claudeManifestFile })).adapters.map(adapter => adapter.name)).toEqual(['fixture', 'claude']);
  const codexManifestFile = await manifest(codexProfile);
  await expect(loadSelectedRunnerConfiguration({ claudeManifestFile, codexManifestFile })).rejects.toThrow('Select only one native manifest.');
  await expect(loadSelectedRunnerConfiguration({ codexManifestFile })).rejects.toThrow('trusted Codex launch factory');
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  const selected = await loadSelectedRunnerConfiguration({ codexManifestFile, codexTransportFactory: createTransport });
  expect(selected.profile?.harness).toBe('codex'); expect(createTransport).not.toHaveBeenCalled();
});

it('does not accept launch permissions inside an otherwise valid Codex file', async () => {
  await expect(loadCodexRunnerConfiguration(await manifest({ ...codexProfile, env: { HOME: '/private' } }))).rejects.toThrow();
});

it('refuses a file replaced with a FIFO after inspection without blocking and closes its handle', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const file = await manifest(codexProfile);
  let close: ReturnType<typeof vi.spyOn> | undefined;
  vi.mocked(filesystem.stat).mockImplementationOnce(async path => {
    const observed = await actual.stat(path);
    await actual.unlink(path);
    await promisify(execFile)('/usr/bin/mkfifo', [String(path)]);
    return observed;
  });
  vi.mocked(filesystem.open).mockImplementationOnce(async (path, flags, mode) => {
    // A regression fails here before it can block a worker in a FIFO open.
    expect(Number(flags) & constants.O_NONBLOCK).not.toBe(0);
    const handle = await actual.open(path, flags, mode);
    close = vi.spyOn(handle, 'close');
    return handle;
  });
  await expect(loadCodexRunnerConfiguration(file)).rejects.toThrow('manifest exceeds its size limit');
  expect(close).toHaveBeenCalledExactlyOnceWith();
});


it('persistent loader rejects mixed selection and invalid public JSON before publication', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const options = { baseUrl: 'http://fixture.invalid', token: 'synthetic-token', codeHome: '/missing-private-storage',
    createTransport: vi.fn(() => { throw new Error('Unexpected factory'); }), codexManifestFile: '/missing-manifest', claudeManifestFile: '/other-manifest' };
  await expect(loadPublishedCodexRunnerConfiguration(options)).rejects.toThrow('Select only one native manifest.');
  await expect(loadPublishedCodexRunnerConfiguration({ ...options, claudeManifestFile: undefined,
    codexManifestFile: await manifest({ ...codexProfile, sessionPersistence: 'host-owned', env: {} }) })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled(); expect(options.createTransport).not.toHaveBeenCalled();
});

it('persistent loader returns guarded adapters and a confirmed reference without starting a process', async () => {
  const { nativeExecutionProfileConfigurationJson, codexExecutionProfileConfigurationSchema } = await import('../../../packages/contracts/src/execution-profiles.js');
  const { textDigest } = await import('./verifier.js');
  const profile = codexExecutionProfileConfigurationSchema.parse({ ...codexProfile, sessionPersistence: 'host-owned' });
  const file = await manifest(profile); const codeHome = directories.at(-1)!.path;
  const reference = { id: '6a287c9c-e6c0-4b78-a63a-9fcc7a45d62f', runnerId: '5668918f-58a1-4703-89dc-705e92a8b4c4',
    configDigest: textDigest(nativeExecutionProfileConfigurationJson(profile)) };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ profile: { reference, configuration: profile }, replayed: false }), { status: 200 })));
  const createTransport = vi.fn(() => { throw new Error('Unexpected factory'); });
  const loaded = await loadPublishedCodexRunnerConfiguration({ codexManifestFile: file, baseUrl: 'http://fixture.invalid', token: 'synthetic-token', codeHome, createTransport });
  expect(loaded.reference).toEqual(reference); expect(loaded.adapters.map(adapter => adapter.name)).toEqual(['fixture', 'codex']);
  expect(loaded.profile).toEqual(profile); expect(loaded.activeSteering).toBe(false);
  expect(loaded.harnesses[1]!.descriptor.ports).toEqual({ sessionPersistence: 'host-owned' });
  expect(createTransport).not.toHaveBeenCalled();
});

it('plugin operator file is explicitly selected and returns only strict store policy without publishing or executing', async () => {
  const { loadPluginExecutionConfiguration } = await import('./configuration.js');
  expect(await loadPluginExecutionConfiguration(undefined)).toBeUndefined();
  const store = { root: '/operator/materials', storeId: 'private-store', allowedDigests: ['a'.repeat(64)] };
  expect(await loadPluginExecutionConfiguration(await manifest(store))).toEqual({ store });
  for (const value of [{ ...store, token: 'SECRET_MARKER' }, { ...store, root: 'relative' }, { ...store, root: '/a/../b' },
    { ...store, allowedDigests: ['invalid'] }, { ...store, allowedDigests: Array(513).fill('a'.repeat(64)) }, { ...store, hostApiMajor: 2 }]) {
    await expect(loadPluginExecutionConfiguration(await manifest(value))).rejects.toThrow('invalid or unavailable');
  }
  await expect(loadPluginExecutionConfiguration('')).rejects.toThrow('invalid or unavailable');
});

 it('trusted process mode requires explicit private opt-in and leaves the store DTO unchanged', async () => {
  const { loadPluginExecutionConfiguration } = await import('./configuration.js');
  const store = { root: '/operator/materials', storeId: 'private-store', allowedDigests: ['a'.repeat(64)] };
  expect(await loadPluginExecutionConfiguration(await manifest({ ...store, executionMode: 'trusted-process' }))).toEqual({ store, executionMode: 'trusted-process' });
  expect(await loadPluginExecutionConfiguration(await manifest({ ...store, executionMode: 'in-process' }))).toEqual({ store, executionMode: 'in-process' });
  await expect(loadPluginExecutionConfiguration(await manifest({ ...store, executionMode: 'sandbox' }))).rejects.toThrow('invalid or unavailable');
 });

it('verifier private opt-in requires exact trusted material and does not infer tool capability', async () => {
  const { loadPluginExecutionConfiguration } = await import('./configuration.js');
  const store = { root: '/operator/materials', storeId: 'private-store', allowedDigests: ['a'.repeat(64)] };
  const trusted = { artifactSha256: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1,
    algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1 };
  const verifier = { trustedAlgorithms: [trusted] };
  expect(await loadPluginExecutionConfiguration(await manifest({ ...store, verifier }))).toEqual({ store, verifier });
  for (const invalid of [{ trustedAlgorithms: [] }, { trustedAlgorithms: [{ ...trusted, algorithmId: 'arbitrary' }] },
    { trustedAlgorithms: [{ ...trusted, treeDigest: 'x' }] }, { ...verifier, toolExecution: 'true' }, { ...verifier, token: 'NO' }]) {
    await expect(loadPluginExecutionConfiguration(await manifest({ ...store, verifier: invalid }))).rejects.toThrow('invalid or unavailable');
  }
  expect(await loadPluginExecutionConfiguration(await manifest({ ...store, verifier: { ...verifier, toolExecution: true } })))
    .toEqual({ store, verifier: { ...verifier, toolExecution: true } });
});
