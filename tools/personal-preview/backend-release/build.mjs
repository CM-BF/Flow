import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, readdir, realpath, writeFile, statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fail, inventory, LIMITS, hashFile, inside } from './files.mjs';
const execute = promisify(execFile);
const sourcePaths = ['apps', 'packages', 'tools', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json'];
export async function buildBackend({ repository, target, stage, offlineStore, pnpmCli }) {
  const root = join(stage, 'root'), home = join(stage, 'home'), store = join(stage, 'store');
  await mkdir(root); await mkdir(home);
  const space = await statfs(stage);
  const availableBytes = space.bavail * space.bsize;
  if (availableBytes < LIMITS.bytes + 256 * 1024 ** 2) fail('BACKEND_FREE_SPACE_REQUIRED');
  await writeFile(join(stage, 'space.json'), JSON.stringify({ availableBytes, minimumBytes: LIMITS.bytes + 256 * 1024 ** 2, reservation: false }));
  const source = await realpath(repository), seed = await realpath(offlineStore), cli = await realpath(pnpmCli);
  if (inside(source, stage) || inside(seed, stage) || inside(stage, seed)) fail('BACKEND_STAGE_LOCATION_INVALID');
  const pnpm = JSON.parse(await readFile(join(dirname(dirname(cli)), 'package.json'), 'utf8'));
  if (pnpm.name !== 'pnpm' || pnpm.version !== '9.15.4') fail('BACKEND_PNPM_VERSION');
  // Read the fixed tree; never execute checkout hooks or use working-tree source bytes.
  const tree = (await execute('git', ['-C', source, 'ls-tree', '-r', target, '--', ...sourcePaths], { timeout: 5000, maxBuffer: 8 * 1024 * 1024 })).stdout;
  if (tree.split('\n').filter(Boolean).some(line => !/^100(644|755) blob /.test(line))) fail('BACKEND_SOURCE_LINK_OR_SUBMODULE');
  const archive = join(stage, 'source.tar');
  await execute('git', ['-C', source, 'archive', '--format=tar', '--output', archive, target, ...sourcePaths], { timeout: 20_000 });
  await execute('/usr/bin/tar', ['-xf', archive, '-C', root], { timeout: 20_000 });
  await inventory(root, { links: false });
  if (JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).packageManager !== 'pnpm@9.15.4') fail('BACKEND_LOCK_TOOL_MISMATCH');
  const lockBefore = await hashFile(join(root, 'pnpm-lock.yaml'));
  await inventory(seed, { bytes: LIMITS.seedBytes, entries: LIMITS.seedEntries, hashes: false, links: false, hardlinks: true });
  await execute('/usr/bin/python3', [fileURLToPath(new URL('./clone-store.py', import.meta.url)), seed, store], { env: { PATH: '/usr/bin:/bin', HOME: home }, timeout: 180_000, maxBuffer: 65536 });
  const emptyConfig = join(home, 'empty.npmrc'); await writeFile(emptyConfig, '', { mode: 0o600 });
  const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, TMPDIR: stage, CI: 'true', LANG: 'C', npm_config_userconfig: emptyConfig, npm_config_globalconfig: emptyConfig, npm_config_update_notifier: 'false' };
  const args = [cli, 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--package-import-method=copy', '--store-dir', store, '--cache-dir', join(stage, 'cache'), '--config.manage-package-manager-versions=false'];
  const result = await execute(process.execPath, args, { cwd: root, env, timeout: 180_000, maxBuffer: 1024 * 1024 });
  await writeFile(join(stage, 'install.stdout'), result.stdout, { mode: 0o600 });
  if (await hashFile(join(root, 'pnpm-lock.yaml')) !== lockBefore) fail('BACKEND_LOCK_CHANGED');
  // Runtime uses Node/tsx and module-relative executables, never pnpm's absolute build-time shell shims.
  async function strip(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.name === '.bin' || entry.name === '.modules.yaml') await rm(path, { recursive: true, force: true });
      else if (entry.isDirectory()) await strip(path);
    }
  }
  await strip(root);
  return { root, sourceRepository: source, lockDigest: lockBefore, pnpm: { version: pnpm.version, cli, sha256: await hashFile(cli) }, installation: { offline: true, frozen: true, scripts: false, importMethod: 'copy' } };
}
