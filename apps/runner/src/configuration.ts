import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { HarnessAdapter } from '@flow/contracts';
import { createFixtureAdapter } from './fixture.js';
import { configureClaudeHarness } from './native-harness/claude.js';
import { describeNativeHarness } from './native-harness/descriptor.js';
import type { ConfiguredNativeHarness } from '../../../packages/contracts/src/native-harness.js';
import type { ExecutionProfileConfiguration } from '../../../packages/contracts/src/execution-profiles.js';

/** An explicit operator manifest enables Claude; omission preserves fixture-only startup. */
export async function loadRunnerAdapters(manifestFile?: string): Promise<HarnessAdapter[]> {
  const configured = await loadRunnerConfiguration(manifestFile);
  if (configured.activeSteering) throw new Error('Use loadRunnerConfiguration to preserve the active steering runtime configuration.');
  return configured.adapters;
}

export interface RunnerConfiguration {
  harnesses: ConfiguredNativeHarness[];
  /** Compatibility views for existing local consumers. */
  adapters: HarnessAdapter[];
  profile: ExecutionProfileConfiguration | null;
  activeSteering: boolean;
}

export async function loadRunnerConfiguration(manifestFile?: string): Promise<RunnerConfiguration> {
  const fixture = describeNativeHarness(createFixtureAdapter(), null);
  if (!manifestFile) return { harnesses: [fixture], adapters: [fixture.adapter], profile: null, activeSteering: false };
  if (!isAbsolute(manifestFile) || (await stat(manifestFile)).size > 16_384) throw new Error('Claude manifest must be a small, explicitly selected absolute file.');
  const content = await readFile(manifestFile, 'utf8');
  if (Buffer.byteLength(content) > 16_384) throw new Error('Claude manifest exceeds its size limit.');
  const configured = configureClaudeHarness(JSON.parse(content));
  const harnesses = [fixture, configured];
  return { harnesses, adapters: harnesses.map(item => item.adapter), profile: configured.descriptor.publicProfile,
    activeSteering: configured.descriptor.ports.steering === 'flow.active-steering.v1' };
}
