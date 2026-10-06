import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadRunnerConfiguration } from '../configuration.js';
const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function load(value: unknown) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o04-config-')); directories.push(directory);
  const file = join(directory, 'manifest.json'); await writeFile(file, JSON.stringify(value));
  return loadRunnerConfiguration(file);
}
it('uses the production manifest loader to publish an explicit goal profile without starting query', async () => {
  const loaded = await load({ materialFiles: [], allowRead: false, goalTools: true, model: 'synthetic-no-query', maxTurns: 2, maxBudgetUsd: 0.01, timeoutMs: 1000 });
  expect(loaded.profile).toMatchObject({ access: 'goal-tools', adapterVersion: 'claude-sdk-0.3.290-v2', limits: { maxTurns: 2, maxBudgetUsd: 0.01, timeoutMs: 1000 } });
  expect(loaded.adapters.map(adapter => adapter.name)).toEqual(['fixture', 'claude']);
});
it.each([
  { materialFiles: [], goalTools: true },
  { materialFiles: [], goalTools: true, allowRead: true },
  { materialFiles: [], goalTools: true, allowRead: false, requireReadApproval: true },
  { materialFiles: ['/tmp/any-material'], goalTools: true, allowRead: false },
  { materialFiles: [], goalTools: 'maybe', allowRead: false },
])('rejects conflicting or unknown goal mode: %j', async value => { await expect(load(value)).rejects.toThrow(); });
