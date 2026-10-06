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
