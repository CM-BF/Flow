import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeDependencyPlan } from './dependency-plan.mjs';

const entry = version => ({ specifier: version, version });
const integrity = `sha512-${Buffer.alloc(64, 1).toString('base64')}`;
function fixture() {
  const manifests = {
    '.': { name: 'flow', packageManager: 'pnpm@9.15.4', devDependencies: { tsx: '4.23.15', pg: '8.23.1', test: '1.0.0' } },
    'apps/server': { name: '@flow/server', dependencies: { '@flow/contracts': 'workspace:*', server: '1.0.0' } },
    'apps/runner': { name: '@flow/runner', dependencies: { '@flow/contracts': 'workspace:*', sdk: '1.0.0' } },
    'packages/contracts': { name: '@flow/contracts', dependencies: { shared: '1.0.0' } },
    'apps/web': { name: '@flow/web', dependencies: { browser: '1.0.0' }, devDependencies: { vite: '8.3.2' } },
  };
  const link = { specifier: 'workspace:*', version: 'link:../../packages/contracts' };
  const lock = { lockfileVersion: '9.0', settings: { autoInstallPeers: true, excludeLinksFromLockfile: false }, importers: {
    '.': { devDependencies: { tsx: entry('4.23.15'), pg: entry('8.23.1'), test: entry('1.0.0') } },
    'apps/server': { dependencies: { '@flow/contracts': link, server: entry('1.0.0') } },
    'apps/runner': { dependencies: { '@flow/contracts': link, sdk: entry('1.0.0') } },
    'packages/contracts': { dependencies: { shared: entry('1.0.0') } },
    'apps/web': { dependencies: { browser: entry('1.0.0') }, devDependencies: { vite: entry('8.3.2') } },
  }, packages: {}, snapshots: {} };
  for (const key of ['pg@8.23.1', 'tsx@4.23.15', 'vite@8.3.2', 'test@1.0.0', 'server@1.0.0', 'sdk@1.0.0', 'shared@1.0.0', 'browser@1.0.0']) {
    lock.packages[key] = { resolution: { integrity } }; lock.snapshots[key] = {};
  }
  return { lock, manifests, host: { os: 'darwin', cpu: 'arm64', libc: null }, pnpmVersion: '9.15.4' };
}

test('selects backend production workspaces and explicit host tools without selecting the Web workspace', () => {
  const input = fixture(), before = JSON.stringify(input);
  const plan = runtimeDependencyPlan(input);
  assert.deepEqual(plan.importers, ['.', 'apps/runner', 'apps/server', 'packages/contracts']);
  assert.deepEqual(plan.snapshots, ['pg@8.23.1', 'sdk@1.0.0', 'server@1.0.0', 'shared@1.0.0', 'tsx@4.23.15', 'vite@8.3.2']);
  assert.equal(plan.installationLock.importers['.'].devDependencies.tsx, undefined);
  assert.deepEqual(plan.installationLock.importers['.'].dependencies.tsx, entry('4.23.15'));
  assert.equal(plan.installationManifest.dependencies.tsx, '4.23.15');
  assert.deepEqual(plan.installationLock.importers['.'].dependencies.vite, entry('8.3.2'));
  assert.equal(plan.installationManifest.dependencies.vite, '8.3.2');
  assert.deepEqual(plan.hostTools, [
    { name: 'tsx', importer: '.', dependencyKind: 'devDependencies', specifier: '4.23.15', version: '4.23.15' },
    { name: 'pg', importer: '.', dependencyKind: 'devDependencies', specifier: '8.23.1', version: '8.23.1' },
    { name: 'vite', importer: 'apps/web', dependencyKind: 'devDependencies', specifier: '8.3.2', version: '8.3.2' },
  ]);
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

test('host tool selection keeps Vite peer context and platform optional closure without UI packages', () => {
  const input = fixture(), { lock } = input, beforeWeb = structuredClone(lock.importers['apps/web']);
  lock.importers['apps/web'].devDependencies.vite.version = '8.3.2(peer@2.0.0)';
  lock.snapshots['vite@8.3.2(peer@2.0.0)'] = { dependencies: { peer: '2.0.0' }, optionalDependencies: { native: '1.0.0', foreign: '1.0.0' } };
  for (const key of ['peer@2.0.0', 'native@1.0.0', 'foreign@1.0.0']) { lock.packages[key] = { resolution: { integrity } }; lock.snapshots[key] = {}; }
  lock.packages['native@1.0.0'].os = ['darwin']; lock.packages['foreign@1.0.0'].os = ['linux'];
  const plan = runtimeDependencyPlan(input);
  assert.equal(plan.installationLock.importers['.'].dependencies.vite.version, '8.3.2(peer@2.0.0)');
  assert.ok(plan.snapshots.includes('vite@8.3.2(peer@2.0.0)'));
  assert.ok(plan.snapshots.includes('peer@2.0.0')); assert.ok(plan.snapshots.includes('native@1.0.0'));
  assert.deepEqual(plan.skippedOptionalSnapshots, ['foreign@1.0.0']);
  assert.ok(!plan.snapshots.includes('browser@1.0.0')); assert.ok(!plan.importers.includes('apps/web'));
  assert.deepEqual(plan.installationLock.importers['apps/web'].dependencies, beforeWeb.dependencies);
  assert.deepEqual(plan.installationLock.importers['apps/web'], lock.importers['apps/web']);
});

test('host tool selection rejects missing, mismatched, aliased or ambiguous fixed tool sources', () => {
  const cases = [
    [value => { delete value.manifests['apps/web']; }, 'BACKEND_HOST_TOOL_SOURCE_MISMATCH'],
    [value => { value.manifests['apps/web'].name = '@flow/unrelated'; }, 'BACKEND_HOST_TOOL_SOURCE_MISMATCH'],
    [value => { delete value.lock.importers['apps/web'].devDependencies.vite; }, 'BACKEND_MANIFEST_LOCK_MISMATCH'],
    [value => { value.manifests['apps/web'].devDependencies.vite = '9.0.0'; }, 'BACKEND_MANIFEST_LOCK_MISMATCH'],
    [value => { value.lock.importers['apps/web'].devDependencies.vite.version = 'link:../../other'; }, 'BACKEND_DEPENDENCY_UNSUPPORTED'],
    [value => { value.manifests['.'].devDependencies.vite = '9.0.0'; }, 'BACKEND_ROOT_RUNTIME_AMBIGUOUS'],
  ];
  for (const [mutate, code] of cases) { const input = fixture(); mutate(input); assert.throws(() => runtimeDependencyPlan(input), { code }); }
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
  assert.equal(runtimeDependencyPlan(input).snapshots.length, 6);
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

// Root tools cannot resolve a dependency installed only for apps/server.
test('root host pg is explicitly projected from its fixed declaration and missing or changed source fails closed', () => {
  const input = fixture(), before = JSON.stringify(input);
  const plan = runtimeDependencyPlan(input);
  assert.deepEqual(plan.installationLock.importers['.'].dependencies.pg, entry('8.23.1'));
  assert.equal(plan.installationManifest.dependencies.pg, '8.23.1');
  assert.equal(plan.installationManifest.devDependencies.pg, undefined);
  assert.equal(plan.installationLock.importers['.'].devDependencies.pg, undefined);
  assert.equal(plan.snapshots.filter(key => key === 'pg@8.23.1').length, 1);
  assert.equal(plan.installationManifest.devDependencies.test, '1.0.0');
  assert.equal(JSON.stringify(input), before);
  delete input.lock.importers['.'].devDependencies.pg;
  assert.throws(() => runtimeDependencyPlan(input), { code: 'BACKEND_MANIFEST_LOCK_MISMATCH' });
  const changed = fixture(); changed.manifests['.'].devDependencies.pg = '9.0.0';
  assert.throws(() => runtimeDependencyPlan(changed), { code: 'BACKEND_MANIFEST_LOCK_MISMATCH' });
});
