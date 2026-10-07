import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runtimeDependencyPlan } from '../../../../tools/personal-preview/backend-release/dependency-plan.mjs';
import { parseBuildYaml } from '../../../../tools/personal-preview/backend-release/runtime-installation.mjs';
const source = '8c80a7105cf442783e83184a14e34c8da08ebe16';
const inputs = [];
function read(path) {
  const bytes = execFileSync('/usr/bin/git', ['show', `${source}:${path}`], { timeout: 3000, maxBuffer: 4 * 1024 ** 2 });
  inputs.push({ ref: source, path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes.toString('utf8');
}
const lock = await parseBuildYaml(read('pnpm-lock.yaml'));
const manifests = Object.fromEntries(Object.keys(lock.importers).sort().map(path => [path, JSON.parse(read(path === '.' ? 'package.json' : `${path}/package.json`))]));
const plan = runtimeDependencyPlan({ lock, manifests, host: { os: 'darwin', cpu: 'arm64', libc: null }, pnpmVersion: '9.15.4' });
assert.deepEqual(Object.keys(plan.installationManifest.dependencies).sort(), ['pg', 'tsx', 'vite']);
assert.equal(plan.hostTools.find(tool => tool.name === 'vite').specifier, '8.3.2');
assert.equal(plan.installationLock.importers['.'].dependencies.pg.version, lock.importers['.'].devDependencies.pg.version);
assert.equal(plan.installationManifest.dependencies.pg, '8.23.1');
assert.equal(plan.snapshots.length, 271);
assert.equal(plan.installationLock.importers['.'].dependencies.vite.version, lock.importers['apps/web'].devDependencies.vite.version);
assert.ok(!plan.importers.includes('apps/web')); assert.ok(!plan.importers.includes('apps/tui'));
assert.deepEqual(plan.installationLock.importers['apps/web'], lock.importers['apps/web']);
for (const path of ['tools/personal-preview/static-web.mjs', 'tools/personal-preview/preview.mjs', 'tools/personal-preview/maintenance-host.mjs', 'tools/personal-preview/backend-release/host.mjs']) read(path);
console.log(JSON.stringify({ source, hostTools: plan.hostTools, selectedImporters: plan.importers, snapshots: plan.snapshots.length, packages: plan.packages.length, skippedOptional: plan.skippedOptionalSnapshots, sourceSemanticDigest: plan.sourceSemanticDigest, installationSemanticDigest: plan.installationSemanticDigest, inputBindings: inputs, install: 'NOT_RUN', cacheContent: 'NOT_READ', runtimeResolution: 'NOT_RUN', physicalSaving: 'UNKNOWN' }, null, 2));
