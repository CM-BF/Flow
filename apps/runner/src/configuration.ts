import { z } from 'zod';
import type { TrustedPackageStore } from '@flow/plugin-runtime';
import { readPrivateJsonConfiguration } from '../../../packages/plugin-runtime/src/private-configuration.js';
import { open, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { HarnessAdapter } from '@flow/contracts';
import { createFixtureAdapter } from './fixture.js';
import { configureClaudeHarness } from './native-harness/claude.js';
import { configureCodexLaunch, prepareCodexLaunchRecipe, publishPersistentCodexLaunch } from './native-harness/codex/launch.js';
import type { CodexTransportFactory } from './native-harness/codex/index.js';
import { describeNativeHarness } from './native-harness/descriptor.js';
import type { ConfiguredNativeHarness } from '../../../packages/contracts/src/native-harness.js';
import { codexExecutionProfileConfigurationSchema, type CodexExecutionProfileConfiguration, ExecutionProfileConfiguration, NativeExecutionProfileConfiguration } from '../../../packages/contracts/src/execution-profiles.js';

/** An explicit operator manifest enables Claude; omission preserves fixture-only startup. */
export async function loadRunnerAdapters(manifestFile?: string): Promise<HarnessAdapter[]> {
  const configured = await loadRunnerConfiguration(manifestFile);
  if (configured.activeSteering) throw new Error('Use loadRunnerConfiguration to preserve the active steering runtime configuration.');
  return configured.adapters;
}

export interface RunnerConfiguration<Profile extends NativeExecutionProfileConfiguration = ExecutionProfileConfiguration> {
  harnesses: ConfiguredNativeHarness[];
  /** Compatibility views for existing local consumers. */
  adapters: HarnessAdapter[];
  profile: Profile | null;
  activeSteering: boolean;
}

export async function loadRunnerConfiguration(manifestFile?: string): Promise<RunnerConfiguration> {
  const fixture = describeNativeHarness(createFixtureAdapter(), null);
  if (!manifestFile) return { harnesses: [fixture], adapters: [fixture.adapter], profile: null, activeSteering: false };
  const configured = configureClaudeHarness(await readManifest(manifestFile, 'Claude'));
  const harnesses = [fixture, configured];
  return { harnesses, adapters: harnesses.map(item => item.adapter), profile: configured.descriptor.publicProfile,
    activeSteering: configured.descriptor.ports.steering === 'flow.active-steering.v1' };
}

/** Explicit selection only; neither this loader nor its factory construction launches a process. */
export async function loadCodexRunnerConfiguration(manifestFile: string, createTransport?: CodexTransportFactory): Promise<RunnerConfiguration<CodexExecutionProfileConfiguration>> {
  const configured = configureCodexLaunch(await readManifest(manifestFile, 'Codex'), createTransport);
  const harnesses = [describeNativeHarness(createFixtureAdapter(), null), configured];
  return { harnesses, adapters: harnesses.map(item => item.adapter), profile: configured.descriptor.publicProfile, activeSteering: false };
}

/** Startup for the explicit persistent profile. Return only after its publication ACK.
 * The caller can pass these guarded adapters to runRunner without publishing twice. */
export async function loadPublishedCodexRunnerConfiguration(options: Parameters<typeof publishPersistentCodexLaunch>[1] & {
  codexManifestFile: string; claudeManifestFile?: string;
}) {
  if (options.claudeManifestFile) throw new Error('Select only one native manifest.');
  const { configured, reference } = await publishPersistentCodexLaunch(await readManifest(options.codexManifestFile, 'Codex'), options);
  const harnesses = [describeNativeHarness(createFixtureAdapter(), null), configured];
  return { harnesses, adapters: harnesses.map(item => item.adapter), profile: configured.descriptor.publicProfile,
    activeSteering: false, reference };
}

/** Production selection is explicit: public profile first, separate operator recipe second.
 * Only the shared publisher may supply the runner identity for the persistent storage handle. */
export async function loadCodexProductionRunnerConfiguration(options: {
  codexManifestFile: string; launchManifestFile: string; baseUrl: string; token: string; signal?: AbortSignal;
}) {
  const profile = codexExecutionProfileConfigurationSchema.parse(await readManifest(options.codexManifestFile, 'Codex'));
  if (profile.sessionPersistence !== 'host-owned') throw new Error('A persistent Codex profile is required.');
  const recipe = prepareCodexLaunchRecipe(await readManifest(options.launchManifestFile, 'Codex'));
  const { configured, reference } = await publishPersistentCodexLaunch(profile, { ...options, ...recipe });
  const harnesses = [describeNativeHarness(createFixtureAdapter(), null), configured];
  return { harnesses, adapters: harnesses.map(item => item.adapter), profile: configured.descriptor.publicProfile,
    activeSteering: false, reference };
}

export async function loadSelectedRunnerConfiguration(options: {
  claudeManifestFile?: string; codexManifestFile?: string; codexTransportFactory?: CodexTransportFactory;
} = {}): Promise<RunnerConfiguration<NativeExecutionProfileConfiguration>> {
  if (options.claudeManifestFile && options.codexManifestFile) throw new Error('Select only one native manifest.');
  return options.codexManifestFile
    ? loadCodexRunnerConfiguration(options.codexManifestFile, options.codexTransportFactory)
    : loadRunnerConfiguration(options.claudeManifestFile);
}

async function readManifest(path: string, harness: 'Claude' | 'Codex'): Promise<unknown> {
  const maximumBytes = 16_384;
  if (!isAbsolute(path)) throw new Error(`${harness} manifest must be a small, explicitly selected absolute file.`);
  const initial = await stat(path);
  if (!initial.isFile() || initial.size > maximumBytes) throw new Error(`${harness} manifest must be a small, explicitly selected absolute file.`);
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const opened = await file.stat();
    if (!opened.isFile() || opened.size > maximumBytes) throw new Error(`${harness} manifest exceeds its size limit.`);
    // One extra byte detects growth without allocating/reading an unbounded replacement file.
    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximumBytes) throw new Error(`${harness} manifest exceeds its size limit.`);
    return JSON.parse(buffer.subarray(0, offset).toString('utf8'));
  } finally { await file.close(); }
}

const pluginStore = z.strictObject({
  root: z.string().min(1).max(4096).refine(path => isAbsolute(path) && resolve(path) === path),
  storeId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  allowedDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(512),
  executionMode: z.enum(['in-process', 'trusted-process']).optional(),
});

/** Explicit private operator input only; actual materials remain checked by the existing package store. */
export async function loadPluginExecutionConfiguration(filename: string | undefined): Promise<{ store: TrustedPackageStore; executionMode?: 'in-process' | 'trusted-process' } | undefined> {
  if (filename === undefined) return undefined;
  try {
    const { executionMode, ...store } = pluginStore.parse(await readPrivateJsonConfiguration(filename));
    if (executionMode === 'trusted-process' && (process.platform !== 'darwin' || process.arch !== 'arm64' || process.version !== 'v24.20.0')) throw new Error('Unsupported trusted process host.');
    return { store, ...(executionMode ? { executionMode } : {}) };
  }
  catch { throw new Error('Plugin execution configuration is invalid or unavailable. Use an owned 0600 regular JSON file.'); }
}
