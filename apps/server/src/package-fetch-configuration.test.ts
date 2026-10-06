import { mkdtemp, chmod, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, expect, it } from 'vitest';
import { readPackageFetchConfiguration } from './package-fetch-configuration.js';

const root = await mkdtemp(join(tmpdir(), 'flow-fetch-config-'));
const config = { storeId: 'test-store', root: '/tmp/synthetic-store', registries: { npm: { url: 'https://registry.npmjs.org/' } } };
afterAll(() => rm(root, { recursive: true, force: true }));
it('is opt-in and reads an owned private exact configuration without exposing credentials', async () => {
  expect(await readPackageFetchConfiguration(undefined)).toBeUndefined();
  const file = join(root, 'good.json'); await writeFile(file, JSON.stringify(config), { mode: 0o600 });
  expect(await readPackageFetchConfiguration(file)).toEqual(config);
  await chmod(file, 0o644);
  await expect(readPackageFetchConfiguration(file)).rejects.toThrow('owned 0600');
});
it('rejects symlinks, nonregular FIFO, oversized files and unknown secret-bearing fields', async () => {
  const file = join(root, 'private.json'); await writeFile(file, JSON.stringify(config), { mode: 0o600 });
  const link = join(root, 'link.json'); await symlink(file, link);
  await expect(readPackageFetchConfiguration(link)).rejects.toThrow('invalid or unavailable');
  const fifo = join(root, 'fifo'); execFileSync('mkfifo', ['-m', '600', fifo]);
  await expect(readPackageFetchConfiguration(fifo)).rejects.toThrow('invalid or unavailable');
  const huge = join(root, 'huge.json'); await writeFile(huge, 'x'.repeat(65_537), { mode: 0o600 });
  await expect(readPackageFetchConfiguration(huge)).rejects.toThrow('invalid or unavailable');
  const secret = join(root, 'secret.json'); await writeFile(secret, JSON.stringify({ ...config, token: 'SYNTHETIC_PRIVATE_MARKER' }), { mode: 0o600 });
  await expect(readPackageFetchConfiguration(secret)).rejects.not.toThrow('SYNTHETIC_PRIVATE_MARKER');
});
