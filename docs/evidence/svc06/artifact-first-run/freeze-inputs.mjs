// Preparation only: fixed Git source and already installed tool bytes; no installation/import proof.
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBuildYaml } from '../../../../tools/personal-preview/backend-release/runtime-installation.mjs';
import { runtimeDependencyPlan } from '../../../../tools/personal-preview/backend-release/dependency-plan.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const target = '3230becf07b804479ec4dc7ef02fcaff58cc3858';
const input = JSON.parse(await readFile(join(here, 'inputs.json'), 'utf8'));
const oldCache = JSON.parse(await readFile(join(here, 'cache-stdout.txt'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('/usr/bin/git', ['-C', input.repository, ...args], { timeout: 3000, maxBuffer: 4 * 1024 ** 2 });
const inputs = [];
function fixed(path) { const bytes = git('show', `${target}:${path}`); inputs.push({ path, bytes: bytes.length, sha256: hash(bytes) }); return bytes; }
const lockBytes = fixed('pnpm-lock.yaml'), lock = await parseBuildYaml(lockBytes.toString('utf8'));
assert.equal(hash(lockBytes), oldCache.lockSha256);
const manifests = Object.fromEntries(Object.keys(lock.importers).sort().map(path => [path, JSON.parse(fixed(path === '.' ? 'package.json' : `${path}/package.json`).toString('utf8'))]));
const plan = runtimeDependencyPlan({ lock, manifests, pnpmVersion: '9.15.4', host: { os: 'darwin', cpu: 'arm64', libc: null } });
assert.deepEqual(plan.packages.map(pkg => [pkg.key, pkg.cacheIndex]), oldCache.indexBindings.map(pkg => [pkg.key, pkg.path]));
for (const binding of input.bindings) {
  assert.equal(await realpath(binding.path), binding.realpath);
  const bytes = await readFile(binding.realpath);
  if (binding.path.startsWith(`${input.repository}/tools/`)) {
    const path = binding.path.slice(input.repository.length + 1);
    assert.deepEqual(bytes, fixed(path));
    binding.bytes = bytes.length; binding.sha256 = hash(bytes);
  } else { assert.equal(bytes.length, binding.bytes); assert.equal(hash(bytes), binding.sha256); }
}
const tree = git('ls-tree', '-rl', target, '--', 'apps', 'packages', 'tools', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json').toString('utf8').trim().split('\n').map(line => { const [meta,path] = line.split('\t'); return { path, bytes: Number(meta.trim().split(/\s+/).at(-1)) }; });
input.target = target; input.ready = 'FIXED_REVIEW_INPUT'; input.hostTools = plan.hostTools;
input.snapshots = plan.snapshots.length; input.snapshotKeys = plan.snapshots; input.importers = plan.importers;
input.sql = tree.filter(row => row.path.endsWith('.sql')).map(row => ({ ...row, sha256: hash(fixed(row.path)) }));
input.sourceArchive = { files: tree.length, logicalBytes: tree.reduce((sum,row) => sum + row.bytes,0) };
input.fixedSourceInputs = inputs;
input.cacheReuse = { observationSource: oldCache.source, packagesAndCacheIndexPathsIdentical: true, selectedPackages: plan.packages.length, oldMetadataErrorsPreserved: oldCache.errors.length, contentHashing: 'NOT_RUN; deferred to real clone', physicalPeak: 'UNKNOWN' };
await writeFile(join(here, 'inputs.json'), JSON.stringify(input, null, 2) + '\n');
console.log(JSON.stringify({ target, hostTools: plan.hostTools, snapshots: input.snapshots, importers: plan.importers, cacheReuse: input.cacheReuse, sourceArchive: input.sourceArchive, sqlFiles: input.sql.length, bindings: input.bindings.length, fixedSourceInputs: inputs.length, install: 'NOT_RUN' }));
