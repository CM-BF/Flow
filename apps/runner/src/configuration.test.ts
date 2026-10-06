import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadRunnerAdapters } from './configuration.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function manifest(value: unknown) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-runner-config-'));
  directories.push(directory);
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
