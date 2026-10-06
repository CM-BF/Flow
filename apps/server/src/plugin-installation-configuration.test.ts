import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { readPluginInstallationConfiguration } from './plugin-installation-configuration.js';

const directory = await mkdtemp(join(tmpdir(), 'flow-install-config-'));
const policy = { artifactStore: { root: '/tmp/artifacts', storeId: 'artifact-store' }, materialStore: {
  root: '/tmp/materials', storeId: 'material-store', allowedDigests: ['a'.repeat(64)],
} };
afterAll(() => rm(directory, { recursive: true, force: true }));
it('is disabled by default and accepts only exact private host policy, without invented lifecycle proof', async () => {
  expect(await readPluginInstallationConfiguration(undefined)).toBeUndefined();
  const file = join(directory, 'valid.json'); await writeFile(file, JSON.stringify(policy), { mode: 0o600 });
  expect(await readPluginInstallationConfiguration(file)).toEqual(policy);
  expect((await readPluginInstallationConfiguration(file))!.executionSettled).toBeUndefined();
  for (const value of [
    { ...policy, executionSettled: true },
    { ...policy, artifactStore: { ...policy.artifactStore, root: '../private' } },
    { ...policy, materialStore: { ...policy.materialStore, root: '/tmp/../private' } },
    { ...policy, materialStore: { ...policy.materialStore, allowedDigests: ['not-a-digest'] } },
    { ...policy, materialStore: { ...policy.materialStore, allowedDigests: Array(513).fill('a'.repeat(64)) } },
    { ...policy, token: 'PRIVATE_CONFIG_MARKER' },
  ]) {
    await writeFile(file, JSON.stringify(value));
    await expect(readPluginInstallationConfiguration(file)).rejects.toThrow('invalid or unavailable');
    await expect(readPluginInstallationConfiguration(file)).rejects.not.toThrow('PRIVATE_CONFIG_MARKER');
  }
});
it('rejects symlink, FIFO, nonprivate, invalid UTF8 and oversized configuration without blocking', async () => {
  const file = join(directory, 'source.json'); await writeFile(file, JSON.stringify(policy), { mode: 0o600 });
  const link = join(directory, 'link.json'); await symlink(file, link);
  const fifo = join(directory, 'fifo'); execFileSync('mkfifo', ['-m', '600', fifo]);
  for (const path of [link, fifo, 'relative.json']) await expect(readPluginInstallationConfiguration(path)).rejects.toThrow('invalid or unavailable');
  await chmod(file, 0o644); await expect(readPluginInstallationConfiguration(file)).rejects.toThrow('owned 0600');
  await chmod(file, 0o600); await writeFile(file, Buffer.from([0xff]));
  await expect(readPluginInstallationConfiguration(file)).rejects.toThrow('invalid or unavailable');
  await writeFile(file, 'x'.repeat(65_537));
  await expect(readPluginInstallationConfiguration(file)).rejects.toThrow('invalid or unavailable');
});
