import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, lstat, rm, readdir, chmod, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { validateCurrentMigrationInput, assertCurrentMigrationState, inspectCurrentStore, observeCurrentInstallation, currentMigrationIO, currentMigrationModulePaths, loadCurrentMigrationModules, migrateCurrentArtifact } from './current-migration.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = (id, source) => ({ policy: 'flow.backend-artifact.v1', artifactId: id, manifestDigest: id, sourceHead: source });
const old = artifact('7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920', '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
const c7b = artifact('c7b85f49cf077460402083cfed577b034a19d256c8592020115d28512060542d', '422f4b150e5801d6010e5bbd6b53574e35384f87');
const next = artifact('cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b', '04da80692e79e2b7c3f6341c7fa76515a3f719a3');
const files = ['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json'];
function input() {
  const privateFiles = Object.fromEntries(files.map(name => [name, { dev: '1', ino: '2', bytes: 2, sha256: sha('{}') }]));
  privateFiles['browser-session.json'] = { dev: '1', ino: '3', bytes: 205, sha256: 'ce38dbfa3b79b6cef3a18aadab0974ffc1860e256a5ecdc59f93396255c39f4a' };
  return { installationDirectory: '/private/tmp/unused-test-installation', sourceDirectory: '/private/tmp/unused-test-source',
    runDirectory: '/private/tmp/unused-test-run', repository: '/private/tmp/unused-test-repository',
    installationIdentity: { dev: '1', ino: '10' }, sourceDirectoryIdentity: { dev: '1', ino: '11' }, runIdentity: { dev: '1', ino: '12' },
    python: '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13',
    cloneDriver: { path: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/artifact-host-followup/clone-artifact.py', sha256: '05d19da5726ab251dcb3635bfc51514fd06c3c288e773913ba4ee427b587d3f6' },
    artifact: next, expectedBackendArtifact: old, expectedWebHostArtifact: old,
    expectedSource: { head: old.sourceHead, dirty: false }, expectedRunner: { id: 'test-runner', maintenance_state: 'accepting', maintenance_version: 21, maintenance_operation_id: null },
    retainedArtifacts: [c7b, old], privateFiles, ports: { center: 61227, web: 61228 },
    processDigests: Object.fromEntries(['center', 'runner', 'web'].map(role => [role, sha(role)])),
    artifactTotalLogicalBytes: 367045616, clone: { manifestBytes: 3196606, artifactEntries: 15628, artifactLogicalBytes: 363849010, cloneHelperSha256: 'c4911f0fc50009639a12fb8f24617916b1b8f2f116f0ba6ba7c55e74693cad62' },
    budget: { freshBytes: 2.5 * 1024 ** 3, liveBytes: 1024 ** 3, addedBytes: 512 * 1024 ** 2, rawBytes: 2 * 1024 ** 2 } };
}
const state = i => ({ backendArtifact: old, source: i.expectedSource, webHost: { artifact: old }, pendingWebHost: null,
  processes: Object.fromEntries(['center', 'runner', 'web'].map((role, n) => [role, { pid: n + 1, fixture: true }])) });
async function scratch(callback) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'svc06b-current-import-')));
  try { return await callback(root); } finally { await rm(root, { recursive: true }); }
}

test('current migration input checks are side-effect-free and require the existing policy and exact fixed artifacts', () => {
  const value = input(); assert.doesNotThrow(() => validateCurrentMigrationInput(value));
  assert.equal(typeof currentMigrationIO, 'function');
  for (const mutate of [i => { delete i.privateFiles['browser-session.json']; }, i => { i.expectedRunner.maintenance_state = 'draining'; },
    i => { i.retainedArtifacts = [old, old]; }, i => { i.artifact = { ...next, sourceHead: old.sourceHead }; },
    i => { i.runIdentity = null; }, i => { i.cloneDriver.sha256 = '0'.repeat(64); },
    i => { i.clone.cloneHelperSha256 = '0'.repeat(64); }, i => { i.sourceDirectory = i.installationDirectory; }]) {
    const bad = structuredClone(value); mutate(bad); assert.throws(() => validateCurrentMigrationInput(bad));
  }
  assert.deepEqual(value, input());
});

test('current migration state retains the selected backend and settled host instead of accepting the old null-backend contract', () => {
  const i = input(), current = state(i); assert.doesNotThrow(() => assertCurrentMigrationState(current, i));
  for (const bad of [{ ...current, backendArtifact: null }, { ...current, backendArtifact: next },
    { ...current, webHost: { artifact: c7b } }, { ...current, pendingWebHost: {} }, { ...current, source: { head: old.sourceHead, dirty: true } }]) {
    assert.throws(() => assertCurrentMigrationState(bad, i));
  }
});

test('current migration store verifies the complete retained set and rejects missing, unknown or unverifiable entries', async () => scratch(async root => {
  const i = input(); i.installationDirectory = root;
  const store = join(root, 'backend-artifacts'); await mkdir(store, { mode: 0o700 });
  for (const value of [c7b, old]) await mkdir(join(store, value.artifactId), { mode: 0o700 });
  const called = [], sizes = new Map([[c7b.artifactId, 366318536], [old.artifactId, 367041727], [next.artifactId, 367045616]]);
  const mod = { backend: { verifyBackendArtifact: async options => { called.push(options.artifact); return { totalBytes: sizes.get(options.artifact.artifactId) }; } } };
  const original = { totalBytes: 367045616 };
  assert.equal(await inspectCurrentStore(mod, i, store, original), false);
  assert.deepEqual(called.map(x => x.artifactId).sort(), [c7b.artifactId, old.artifactId].sort());
  await mkdir(join(store, next.artifactId), { mode: 0o700 });
  assert.equal(await inspectCurrentStore(mod, i, store, original), true);
  await writeFile(join(store, 'unknown'), 'preserve');
  await assert.rejects(inspectCurrentStore(mod, i, store, original), /STORE_UNKNOWN/); await rm(join(store, 'unknown'));
  await rm(join(store, c7b.artifactId), { recursive: true });
  await assert.rejects(inspectCurrentStore(mod, i, store, original), /RETAINED_ARTIFACT_MISSING/);
  await mkdir(join(store, c7b.artifactId), { mode: 0o700 });
  mod.backend.verifyBackendArtifact = async () => { throw new Error('FIXED_VERIFY_FAILURE'); };
  await assert.rejects(inspectCurrentStore(mod, i, store, original), /FIXED_VERIFY_FAILURE/);
  assert.equal((await readdir(store)).length, 3);
}));

test('current migration private observer includes policy and refuses changed bytes, permissions and links', async () => scratch(async root => {
  const i = input(); i.installationDirectory = root;
  const s = state(i), id = await lstat(root); i.installationIdentity = { dev: String(id.dev), ino: String(id.ino) };
  for (const name of files) {
    const bytes = Buffer.from(name === 'state.json' ? JSON.stringify(s) : '{}');
    const path = join(root, name); await writeFile(path, bytes, { mode: 0o600 }); const info = await lstat(path);
    i.privateFiles[name] = { dev: String(info.dev), ino: String(info.ino), bytes: bytes.length, sha256: sha(bytes) };
  }
  for (const role of ['center', 'runner', 'web']) i.processDigests[role] = sha(JSON.stringify(s.processes[role]));
  const mod = { preview: { readPreviewJson: async () => structuredClone(s) }, process: { inspectOwnedProcess: async () => 'running', ownsListener: async () => true } };
  const observed = await observeCurrentInstallation(mod, i); assert.deepEqual(Object.keys(observed.files).sort(), files);
  const policy = join(root, 'browser-session.json'); await writeFile(policy, '[]');
  await assert.rejects(observeCurrentInstallation(mod, i), /PRIVATE_BYTES_CHANGED/); await writeFile(policy, '{}');
  await chmod(policy, 0o644); await assert.rejects(observeCurrentInstallation(mod, i), /PRIVATE_MODE/); await chmod(policy, 0o600);
  await rm(policy); await symlink(join(root, 'config.json'), policy);
  await assert.rejects(observeCurrentInstallation(mod, i));
}));

test('current migration production store port refuses unknown material without allocating stage or copying', async () => scratch(async root => {
  const i = input(); i.runDirectory = root;
  const store = join(root, 'backend-artifacts'); await mkdir(store, { mode: 0o700 });
  await writeFile(join(store, 'stage-unknown'), 'keep');
  const calls = [], mod = { backend: { verifyBackendArtifact: async () => { calls.push('verify'); throw new Error('must not reach'); } } };
  const io = currentMigrationIO(mod, i, root, () => {});
  const ports = await io.stage(store, { totalBytes: 367045616 });
  await assert.rejects(ports.inspectStore(), /STORE_UNKNOWN/);
  assert.deepEqual(calls, []); assert.deepEqual(await readdir(root), ['backend-artifacts']);
  assert.deepEqual(await readdir(store), ['stage-unknown']);
}));

test('current migration loader paths select the installed current artifact without loading personal modules', () => {
  const i = input(), paths = currentMigrationModulePaths(i);
  const root = join(i.installationDirectory, 'backend-artifacts', old.artifactId, 'root');
  assert.deepEqual(paths, { root, preview: join(root, 'tools/personal-preview/preview.mjs'), process: join(root, 'tools/personal-preview/process.mjs'), package: join(root, 'package.json') });
  assert.equal(typeof loadCurrentMigrationModules, 'function');
  assert.ok(!paths.preview.includes(next.artifactId));
  // Same package/lock as selected 7d1; only the retained self-owned build is read here.
  const ownRoot = '/private/tmp/flow-svc06b-artifact-IhwFGS/backend-artifacts/' + next.artifactId + '/root';
  const { Pool } = createRequire(join(ownRoot, 'package.json'))('pg');
  assert.equal(typeof Pool, 'function');
});

test('current migration trusted validation runs before IO and JSON cannot replace the strict default', async () => {
  const value = { validateInput: () => {}, observeInstallation: () => {} };
  await assert.rejects(loadCurrentMigrationModules(value));
  await assert.rejects(migrateCurrentArtifact({}, value, () => {}));
  const rejected = Object.assign(new Error('FIXED_CALLER_REJECTED'), { code: 'FIXED_CALLER_REJECTED' });
  const validateInput = actual => { assert.equal(actual, value); throw rejected; };
  await assert.rejects(loadCurrentMigrationModules(value, { validateInput }), error => error === rejected);
  await assert.rejects(migrateCurrentArtifact({}, value, () => {}, { validateInput }), error => error === rejected);
});

test('current migration trusted fresh observer receives exact modules and input and preserves unknown', async () => {
  const value = input(), mod = {}, failure = new Error('HELD_OBSERVATION_UNKNOWN'); let calls = 0;
  const observeInstallation = async (actualMod, actualInput) => {
    assert.equal(actualMod, mod); assert.equal(actualInput, value); calls += 1;
    if (calls === 2) throw failure;
    return { files: { preserved: true }, held: true };
  };
  const io = currentMigrationIO(mod, value, '/unused', () => {}, { observeInstallation });
  assert.deepEqual(await io.fresh(), { files: { preserved: true }, held: true });
  await assert.rejects(io.fresh(), error => error === failure);
  assert.equal(calls, 2);
});

test('current migration wrapper observes trusted held policy inside original preview lock before any store or SQL', async () => scratch(async root => {
  const value = input(), info = await lstat(root); value.runDirectory = root;
  value.runIdentity = { dev: String(info.dev), ino: String(info.ino) };
  const events = [], failure = new Error('EXACT_HELD_UNKNOWN');
  const mod = { preview: {
    loadPreviewConfiguration: async path => { assert.equal(path, value.installationDirectory); events.push('load'); return {}; },
    withPreviewLock: async (_config, callback) => { events.push('lock'); try { return await callback(); } finally { events.push('unlock'); } },
  } };
  await assert.rejects(migrateCurrentArtifact(mod, value, () => { throw new Error('unexpected health IO'); }, {
    validateInput: actual => { assert.equal(actual, value); events.push('validate'); },
    observeInstallation: async (actualMod, actual) => { assert.equal(actualMod, mod); assert.equal(actual, value); events.push('held-observe'); throw failure; },
  }), error => error === failure);
  assert.deepEqual(events, ['validate', 'load', 'lock', 'held-observe', 'unlock']);
  assert.deepEqual(await readdir(root), []);
}));
