import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadRunnerConfiguration } from './configuration.js';
import { executionProfileConfigurationJson } from '../../../packages/contracts/src/execution-profiles.js';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function configured(value: unknown) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-native-descriptor-'));
  directories.push(directory);
  const filename = join(directory, 'claude.json');
  await writeFile(filename, JSON.stringify(value), { mode: 0o600 });
  return loadRunnerConfiguration(filename);
}

it('describes the default fixture without a native profile or control ports', async () => {
  const loaded = await loadRunnerConfiguration();
  expect(loaded).toMatchObject({
    harnesses: [{ descriptor: {
      protocol: 'flow.native-harness.v1', harness: 'fixture', adapterVersion: '1',
      ports: {}, publicProfile: null,
    } }],
    profile: null, activeSteering: false,
  });
  expect(loaded.harnesses[0]!.adapter).toBe(loaded.adapters[0]);
});

it.each([
  { settings: {}, ports: {}, access: 'none', steering: false },
  { settings: { activeSteering: false }, ports: {}, access: 'none', steering: false },
  { settings: { activeSteering: true }, ports: { steering: 'flow.active-steering.v1' }, access: 'none', steering: true },
  { settings: { goalTools: true, allowRead: false }, ports: { goalTools: 1 }, access: 'goal-tools', steering: false },
  { settings: { goalGraphTools: true, allowRead: false }, ports: { goalGraphTools: 1 }, access: 'goal-graph-tools', steering: false },
])('describes only the ports required by an explicit $access configuration ($settings)', async ({ settings, ports, access, steering }) => {
  const loaded = await configured({ materialFiles: [], ...settings });
  const selected = loaded.harnesses[1]!;
  expect(selected.descriptor).toEqual({
    protocol: 'flow.native-harness.v1', harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2',
    ports, publicProfile: loaded.profile,
  });
  expect(selected.adapter).toBe(loaded.adapters[1]);
  expect(loaded.activeSteering).toBe(steering);
  expect(selected.descriptor.publicProfile?.access).toBe(access);
  expect(executionProfileConfigurationJson(loaded.profile!)).not.toContain('flow.native-harness');
});

it('exposes only a material scope digest and preserves an explicit read-only profile', async () => {
  const loaded = await configured({ materialFiles: ['/private/never-read-by-configuration.txt'], requireReadApproval: true, model: 'configured-alias' });
  const descriptor = loaded.harnesses[1]!.descriptor;
  expect(descriptor.publicProfile).toMatchObject({ model: 'configured-alias', access: 'configured-readonly', requireReadApproval: true });
  expect(descriptor.ports).toEqual({});
  expect(JSON.stringify(descriptor)).not.toContain('/private/');
});

it('does not accept caller-supplied descriptors or ports as authority', async () => {
  await expect(configured({ materialFiles: [], descriptor: { protocol: 'flow.native-harness.v9', ports: { steering: 'anything' } } })).rejects.toThrow('unsupported field');
  await expect(configured({ materialFiles: [], ports: { goalTools: 1 } })).rejects.toThrow('unsupported field');
});
