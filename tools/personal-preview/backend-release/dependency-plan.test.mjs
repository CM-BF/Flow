import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeDependencyPlan } from './dependency-plan.mjs';

const entry = version => ({ specifier: version, version });
const integrity = `sha512-${Buffer.alloc(64, 1).toString('base64')}`;
function fixture() {
  const manifests = {
    '.': { name: 'flow', packageManager: 'pnpm@9.15.4', devDependencies: { tsx: '4.23.15', test: '1.0.0' } },
    'apps/server': { name: '@flow/server', dependencies: { '@flow/contracts': 'workspace:*', server: '1.0.0' } },
    'apps/runner': { name: '@flow/runner', dependencies: { '@flow/contracts': 'workspace:*', sdk: '1.0.0' } },
    'packages/contracts': { name: '@flow/contracts', dependencies: { shared: '1.0.0' } },
    'apps/web': { name: '@flow/web', dependencies: { browser: '1.0.0' } },
  };
  const link = { specifier: 'workspace:*', version: 'link:../../packages/contracts' };
  const lock = { lockfileVersion: '9.0', settings: { autoInstallPeers: true, excludeLinksFromLockfile: false }, importers: {
    '.': { devDependencies: { tsx: entry('4.23.15'), test: entry('1.0.0') } },
    'apps/server': { dependencies: { '@flow/contracts': link, server: entry('1.0.0') } },
    'apps/runner': { dependencies: { '@flow/contracts': link, sdk: entry('1.0.0') } },
    'packages/contracts': { dependencies: { shared: entry('1.0.0') } },
    'apps/web': { dependencies: { browser: entry('1.0.0') } },
  }, packages: {}, snapshots: {} };
  for (const key of ['tsx@4.23.15', 'test@1.0.0', 'server@1.0.0', 'sdk@1.0.0', 'shared@1.0.0', 'browser@1.0.0']) {
    lock.packages[key] = { resolution: { integrity } }; lock.snapshots[key] = {};
  }
  return { lock, manifests, host: { os: 'darwin', cpu: 'arm64', libc: null }, pnpmVersion: '9.15.4' };
}

test('selects only backend production workspace dependencies and explicit root tsx without mutating source', () => {
  const input = fixture(), before = JSON.stringify(input);
  const plan = runtimeDependencyPlan(input);
  assert.deepEqual(plan.importers, ['.', 'apps/runner', 'apps/server', 'packages/contracts']);
  assert.deepEqual(plan.snapshots, ['sdk@1.0.0', 'server@1.0.0', 'shared@1.0.0', 'tsx@4.23.15']);
  assert.equal(plan.installationLock.importers['.'].devDependencies.tsx, undefined);
  assert.deepEqual(plan.installationLock.importers['.'].dependencies.tsx, entry('4.23.15'));
  assert.equal(plan.installationManifest.dependencies.tsx, '4.23.15');
  assert.equal(plan.installationManifest.devDependencies.test, '1.0.0');
  assert.deepEqual(plan.installationLock.importers['apps/web'], input.lock.importers['apps/web']);
  assert.deepEqual(plan.installationLock.packages, input.lock.packages);
  assert.equal(JSON.stringify(input), before);
  assert.equal(plan.policy, 'flow.backend-runtime-closure.v1');
  assert.ok(plan.installArguments.includes('--prod'));
  assert.ok(plan.installArguments.includes('--filter-prod=@flow/server...'));
  assert.ok(plan.installArguments.includes('--filter-prod=@flow/runner...'));
  assert.ok(plan.installArguments.includes('--filter=flow'));
});

test('retains distinct resolved peer contexts and only omits incompatible optional packages', () => {
  const input = fixture(), { lock } = input;
  lock.snapshots['sdk@1.0.0'].dependencies = { shared: '1.0.0(peer@1.0.0)' };
  lock.snapshots['server@1.0.0'].dependencies = { shared: '1.0.0(peer@2.0.0)' };
  lock.snapshots['shared@1.0.0(peer@1.0.0)'] = { dependencies: { peer: '1.0.0' } };
  lock.snapshots['shared@1.0.0(peer@2.0.0)'] = { dependencies: { peer: '2.0.0' } };
  for (const key of ['peer@1.0.0', 'peer@2.0.0']) { lock.packages[key] = { resolution: { integrity } }; lock.snapshots[key] = {}; }
  lock.snapshots['sdk@1.0.0'].optionalDependencies = { native: '1.0.0', foreign: '1.0.0' };
  lock.packages['native@1.0.0'] = { resolution: { integrity }, os: ['darwin'], cpu: ['arm64'] };
  lock.packages['foreign@1.0.0'] = { resolution: { integrity }, os: ['linux'], cpu: ['arm64'] };
  lock.snapshots['native@1.0.0'] = {}; lock.snapshots['foreign@1.0.0'] = {};
  const result = runtimeDependencyPlan(input);
  assert.ok(result.snapshots.includes('shared@1.0.0(peer@1.0.0)'));
  assert.ok(result.snapshots.includes('shared@1.0.0(peer@2.0.0)'));
  assert.ok(result.snapshots.includes('native@1.0.0'));
  assert.deepEqual(result.skippedOptionalSnapshots, ['foreign@1.0.0']);
  assert.equal(result.packages.filter(value => value.key === 'shared@1.0.0').length, 1);
  lock.snapshots['server@1.0.0'].dependencies.foreign = '1.0.0';
  assert.throws(() => runtimeDependencyPlan(input), { code: 'BACKEND_REQUIRED_PLATFORM_MISMATCH' });
});

test('rejects mismatched manifests, tools, unresolved edges and out-of-tree workspace links', () => {
  const cases = [
    [value => { value.pnpmVersion = '10.0.0'; }, 'BACKEND_LOCK_TOOL_MISMATCH'],
    [value => { value.lock.lockfileVersion = '8.0'; }, 'BACKEND_LOCK_TOOL_MISMATCH'],
    [value => { value.manifests['apps/server'].dependencies.server = '2.0.0'; }, 'BACKEND_MANIFEST_LOCK_MISMATCH'],
    [value => { value.lock.importers['apps/server'].dependencies['@flow/contracts'].version = 'link:../../../outside'; }, 'BACKEND_WORKSPACE_PATH'],
    [value => { delete value.lock.snapshots['sdk@1.0.0']; }, 'BACKEND_LOCK_REFERENCE_MISSING'],
    [value => { value.lock.snapshots['sdk@1.0.0'].dependencies = { remote: 'https://example.invalid/package.tgz' }; }, 'BACKEND_DEPENDENCY_UNSUPPORTED'],
    [value => { value.lock.packages['sdk@1.0.0'].resolution.tarball = 'https://example.invalid/package.tgz'; }, 'BACKEND_RESOLUTION_UNSUPPORTED'],
    [value => { value.lock.patchedDependencies = { sdk: {} }; }, 'BACKEND_LOCK_FEATURE_UNSUPPORTED'],
    [value => { value.manifests['.'].dependencies = { unrelated: '1.0.0' }; }, 'BACKEND_ROOT_RUNTIME_AMBIGUOUS'],
    [value => { value.lock.packages['sdk@1.0.0'].libc = ['musl']; }, 'BACKEND_PLATFORM_UNKNOWN'],
  ];
  for (const [mutate, code] of cases) { const value = fixture(); mutate(value); assert.throws(() => runtimeDependencyPlan(value), { code }); }
});

test('handles a dependency cycle without looping and rejects oversized input before graph traversal', () => {
  const input = fixture();
  input.lock.snapshots['sdk@1.0.0'].dependencies = { server: '1.0.0' };
  input.lock.snapshots['server@1.0.0'].dependencies = { sdk: '1.0.0' };
  assert.equal(runtimeDependencyPlan(input).snapshots.length, 4);
  input.manifests['.'].description = 'x'.repeat(4 * 1024 ** 2);
  assert.throws(() => runtimeDependencyPlan(input), { code: 'BACKEND_LOCK_BUDGET' });
});

test('prepares deterministic staging bytes and detects any installer mutation before source restoration', async () => {
  const { installationView, verifyInstallationView } = await import('./installation-view.mjs');
  const plan = runtimeDependencyPlan(fixture()), view = installationView(plan);
  assert.deepEqual(JSON.parse(view.manifest), plan.installationManifest);
  assert.deepEqual(JSON.parse(view.lock), plan.installationLock); // JSON is a valid YAML installation document.
  assert.equal(verifyInstallationView(plan, view), true);
  assert.deepEqual(installationView(runtimeDependencyPlan(fixture())), view);
  const altered = JSON.parse(view.lock); altered.snapshots['sdk@1.0.0'].dependencies = { browser: '1.0.0' };
  assert.throws(() => verifyInstallationView(plan, { ...view, lock: JSON.stringify(altered) }), { code: 'BACKEND_INSTALLATION_VIEW_CHANGED' });
  assert.throws(() => verifyInstallationView(plan, { ...view, manifest: '{}' }), { code: 'BACKEND_INSTALLATION_VIEW_CHANGED' });
  assert.throws(() => verifyInstallationView(plan, { ...view, lock: '{' }), { code: 'BACKEND_INSTALLATION_VIEW_INVALID' });
});
