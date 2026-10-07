import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseBuildYaml, prepareRuntimeInstallation, restoreRuntimeSource } from './runtime-installation.mjs';

const execute = promisify(execFile);
const sri = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entry = version => ({ specifier: version, version });
const clone = (seed, target, plan) => execute('/usr/bin/python3', [fileURLToPath(new URL('./clone-store.py', import.meta.url)), seed, target, plan], { env: { PATH: '/usr/bin:/bin' }, timeout: 3000, maxBuffer: 4096 });

async function fixture() {
  const stage = await mkdtemp(join(tmpdir(), 'svc06-installation-'));
  const root = join(stage, 'root'), seed = join(stage, 'seed');
  await mkdir(root); await mkdir(seed);
  const lock = { lockfileVersion: '9.0', settings: { autoInstallPeers: true, excludeLinksFromLockfile: false }, importers: {
    '.': { devDependencies: { tsx: entry('4.23.15') } },
    'apps/server': { dependencies: { server: entry('1.0.0') } },
    'apps/runner': { dependencies: { sdk: entry('1.0.0') } },
    'apps/web': { dependencies: { browser: entry('1.0.0') } },
  }, packages: {}, snapshots: {} };
  const manifests = {
    '.': { name: 'flow', packageManager: 'pnpm@9.15.4', devDependencies: { tsx: '4.23.15' } },
    'apps/server': { name: '@flow/server', dependencies: { server: '1.0.0' } },
    'apps/runner': { name: '@flow/runner', dependencies: { sdk: '1.0.0' } },
    'apps/web': { name: '@flow/web', dependencies: { browser: '1.0.0' } },
  };
  const indexes = [];
  for (const [name, version] of [['server', '1.0.0'], ['sdk', '1.0.0'], ['tsx', '4.23.15'], ['browser', '1.0.0']]) {
    const integrity = sri(`tarball identity: ${name}`), hex = Buffer.from(integrity.slice(7), 'base64').toString('hex');
    lock.packages[`${name}@${version}`] = { resolution: { integrity } };
    lock.snapshots[`${name}@${version}`] = {};
    if (name === 'browser') continue; // Its cache is deliberately absent.
    const content = Buffer.from(`export const packageName = ${JSON.stringify(name)};\n`), contentIntegrity = sri(content);
    const contentHex = Buffer.from(contentIntegrity.slice(7), 'base64').toString('hex');
    const contentPath = join(seed, 'files', contentHex.slice(0, 2), contentHex.slice(2));
    await mkdir(join(seed, 'files', contentHex.slice(0, 2)), { recursive: true });
    await writeFile(contentPath, content);
    const indexPath = join(seed, 'files', hex.slice(0, 2), `${hex.slice(2)}-index.json`);
    await mkdir(join(seed, 'files', hex.slice(0, 2)), { recursive: true });
    await writeFile(indexPath, JSON.stringify({ name, version, files: { 'index.js': { integrity: contentIntegrity, size: content.length, mode: 0o644 } } }));
    indexes.push(indexPath);
  }
  for (const [path, manifest] of Object.entries(manifests)) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  await writeFile(join(root, 'pnpm-lock.yaml'), JSON.stringify(lock, null, 2) + '\n');
  return { root, seed, stage, indexes, pnpmVersion: '9.15.4', host: { os: 'darwin', cpu: 'arm64', libc: null } };
}

test('formal YAML parser accepts lock text and rejects ambiguous or executable-looking YAML constructs', async () => {
  assert.deepEqual(await parseBuildYaml("lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n"), { lockfileVersion: '9.0', settings: { autoInstallPeers: true } });
  for (const text of ['x: 1\nx: 2', 'x: &value [1]\ny: *value', 'x: !custom value', '---\nx: 1\n---\ny: 2', '%YAML 1.1\n---\nx: yes']) {
    await assert.rejects(parseBuildYaml(text), { code: 'BACKEND_LOCK_PARSE' });
  }
});

test('staging selects backend cache only and restores exact source bytes after a semantically unchanged frozen install', async () => {
  const input = await fixture();
  try {
    const before = await Promise.all(['package.json', 'pnpm-lock.yaml'].map(path => readFile(join(input.root, path), 'utf8')));
    const prepared = await prepareRuntimeInstallation(input);
    assert.deepEqual(prepared.plan.snapshots, ['sdk@1.0.0', 'server@1.0.0', 'tsx@4.23.15']);
    assert.equal(prepared.cache.files.length, 6);
    assert.equal(JSON.parse(await readFile(join(input.root, 'package.json'), 'utf8')).dependencies.tsx, '4.23.15');
    // The package manager may render JSON-as-YAML with different whitespace.
    await writeFile(join(input.root, 'pnpm-lock.yaml'), JSON.stringify(JSON.parse(prepared.view.lock)));
    const result = await restoreRuntimeSource(prepared);
    assert.equal(result.sourceBytesRestored, true);
    assert.equal(result.installedProjectionVerified, true);
    assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml'].map(path => readFile(join(input.root, path), 'utf8'))), before);
  } finally { await rm(input.stage, { recursive: true }); }
});

test('missing selected cache index fails before source projection is written', async () => {
  const input = await fixture();
  try {
    const original = await readFile(join(input.root, 'pnpm-lock.yaml'));
    await rm(input.indexes[0]);
    await assert.rejects(prepareRuntimeInstallation(input), { code: 'ENOENT' });
    assert.deepEqual(await readFile(join(input.root, 'pnpm-lock.yaml')), original);
    assert.ok(!(await readdir(input.stage)).includes('selected-cache.json'));
  } finally { await rm(input.stage, { recursive: true }); }
});

test('changed projected lock or workspace manifest cannot be concealed by restoring original bytes', async () => {
  const input = await fixture();
  try {
    const prepared = await prepareRuntimeInstallation(input);
    const changed = JSON.parse(prepared.view.lock); changed.settings.autoInstallPeers = false;
    await writeFile(join(input.root, 'pnpm-lock.yaml'), JSON.stringify(changed));
    await assert.rejects(restoreRuntimeSource(prepared), { code: 'BACKEND_INSTALLATION_VIEW_CHANGED' });
    assert.notEqual(await readFile(join(input.root, 'package.json'), 'utf8'), prepared.originals['package.json']);
    await writeFile(join(input.root, 'pnpm-lock.yaml'), prepared.view.lock);
    await writeFile(join(input.root, 'apps/runner/package.json'), '{}');
    await assert.rejects(restoreRuntimeSource(prepared), { code: 'BACKEND_WORKSPACE_MANIFEST_CHANGED' });
  } finally { await rm(input.stage, { recursive: true }); }
});

test('selected clone verifies exact content and ignores unrelated cache paths without following them', async () => {
  const input = await fixture();
  try {
    const prepared = await prepareRuntimeInstallation(input);
    await symlink('/does-not-exist', join(input.seed, 'unrelated'));
    const target = join(input.stage, 'copy');
    const result = JSON.parse((await clone(input.seed, target, prepared.cloneManifest)).stdout);
    assert.equal(result.selectedFiles, 6);
    assert.equal(result.integrityVerified, true);
    assert.deepEqual(await readdir(target), ['files']);
    for (const file of prepared.cache.files) {
      assert.deepEqual(await readFile(join(target, file.path)), await readFile(join(input.seed, file.path)));
      assert.equal((await stat(join(target, file.path))).nlink, 1);
      assert.notEqual((await stat(join(target, file.path))).ino, (await stat(join(input.seed, file.path))).ino);
    }
  } finally { await rm(input.stage, { recursive: true }); }
});

test('selected clone rejects corrupt bytes, selected symlinks and escaping manifest paths', async () => {
  const input = await fixture();
  try {
    const prepared = await prepareRuntimeInstallation(input), file = prepared.cache.files.find(value => value.kind === 'content');
    const path = join(input.seed, file.path), original = await readFile(path);
    // Replace a verified CAFS leaf with a directory before the clone step.
    // No file beneath this unselected directory may be cloned, even on failure.
    const racingTarget = join(input.stage, 'changed-directory');
    const replaceAfterVerification = `
import os, runpy, sys
module = runpy.run_path(sys.argv[1])
verify = module['verify_file']
def replace(path, entry):
    result = verify(path, entry)
    if path == sys.argv[5]:
        os.unlink(path)
        os.mkdir(path)
        with open(os.path.join(path, 'unselected'), 'w') as stream:
            stream.write('must not clone')
    return result
module['selected_copy'].__globals__['verify_file'] = replace
module['selected_copy'](sys.argv[2], sys.argv[3], sys.argv[4])
`;
    await assert.rejects(execute('/usr/bin/python3', ['-c', replaceAfterVerification,
      fileURLToPath(new URL('./clone-store.py', import.meta.url)), input.seed, racingTarget, prepared.cloneManifest, path],
    { env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, timeout: 3000, maxBuffer: 4096 }), /CLONE_REGULAR_FILE_REQUIRED/);
    await assert.rejects(stat(join(racingTarget, file.path)), { code: 'ENOENT' });
    await rm(path, { recursive: true });
    await writeFile(path, Buffer.alloc(original.length, 120));
    await assert.rejects(clone(input.seed, join(input.stage, 'corrupt'), prepared.cloneManifest), /CLONE_SOURCE_INTEGRITY/);
    await rm(path); await symlink(input.indexes[0], path);
    await assert.rejects(clone(input.seed, join(input.stage, 'link'), prepared.cloneManifest));
    await writeFile(prepared.cloneManifest, JSON.stringify({ policy: 'flow.backend-cache-clone.v1', files: [{ path: '../escape', kind: 'index', bytes: 0, sha256: sha('') }] }));
    await assert.rejects(clone(input.seed, join(input.stage, 'escape'), prepared.cloneManifest), /CLONE_PLAN_PATH/);
  } finally { await rm(input.stage, { recursive: true }); }
});
