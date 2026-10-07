// Assembly only. The previously reviewed procedure owns ordering, locks and unknown results.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, realpath, open, readdir, mkdir, statfs } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { migrateWithLocks, confirmMigrationRunner, record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
import * as backend from '../../../../tools/personal-preview/backend-release/index.mjs';
import * as store from '../../../../tools/personal-preview/backend-release/files.mjs';
import { renameExclusive } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';
const execute = promisify(execFile);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredFiles = ['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json'];

export function currentMigrationModulePaths(input) {
  const root = join(input.installationDirectory, 'backend-artifacts', input.expectedBackendArtifact.artifactId, 'root');
  return { root, preview: join(root, 'tools/personal-preview/preview.mjs'),
    process: join(root, 'tools/personal-preview/process.mjs'), package: join(root, 'package.json') };
}
// Called only inside the later actual window. Full installed-manifest verification precedes loading its code.
export async function loadCurrentMigrationModules(input, { validateInput = validateCurrentMigrationInput } = {}) {
  // Only a reviewed in-process caller supplies a policy; JSON cannot select one.
  validateInput(input);
  const verified = await backend.verifyBackendArtifact({ directory: input.installationDirectory, artifact: input.expectedBackendArtifact });
  assert.equal(verified.manifest.sourceRepository, input.repository);
  const paths = currentMigrationModulePaths(input); assert.equal(verified.root, paths.root);
  const preview = await import(pathToFileURL(paths.preview).href), process = await import(pathToFileURL(paths.process).href);
  const { Pool } = createRequire(paths.package)('pg'); assert.equal(typeof Pool, 'function');
  return { preview, process, backend, store, transfer: { renameExclusive }, Pool };
}

export function validateCurrentMigrationInput(input) {
  for (const path of [input.installationDirectory, input.sourceDirectory, input.runDirectory, input.repository]) assert.ok(isAbsolute(path), 'ABSOLUTE_PATH_REQUIRED');
  assert.equal(new Set([input.installationDirectory, input.sourceDirectory, input.runDirectory, input.repository]).size, 4, 'SEPARATE_ROOTS_REQUIRED');
  for (const identity of [input.installationIdentity, input.sourceDirectoryIdentity, input.runIdentity]) {
    assert.deepEqual(Object.keys(identity).sort(), ['dev', 'ino']);
    for (const value of Object.values(identity)) assert.match(value, /^(0|[1-9][0-9]*)$/);
  }
  assert.equal(input.python, '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13');
  assert.equal(input.cloneDriver.path, '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/artifact-host-followup/clone-artifact.py');
  assert.equal(input.cloneDriver.sha256, '05d19da5726ab251dcb3635bfc51514fd06c3c288e773913ba4ee427b587d3f6');
  assert.equal(input.artifact.artifactId, 'cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b');
  assert.equal(input.artifact.sourceHead, '04da80692e79e2b7c3f6341c7fa76515a3f719a3');
  assert.equal(input.artifact.manifestDigest, input.artifact.artifactId);
  assert.equal(input.artifact.policy, 'flow.backend-artifact.v1');
  assert.equal(input.expectedBackendArtifact.artifactId, '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920');
  assert.equal(input.expectedBackendArtifact.sourceHead, '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
  assert.deepEqual(input.expectedSource, { head: input.expectedBackendArtifact.sourceHead, dirty: false });
  assert.deepEqual(input.expectedWebHostArtifact, input.expectedBackendArtifact);
  assert.equal(input.expectedRunner.maintenance_state, 'accepting');
  assert.equal(input.expectedRunner.maintenance_operation_id, null);
  assert.ok(Number.isSafeInteger(input.expectedRunner.maintenance_version) && input.expectedRunner.maintenance_version >= 0);
  assert.deepEqual(Object.keys(input.privateFiles).sort(), requiredFiles);
  for (const pin of Object.values(input.privateFiles)) {
    assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 65536);
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    for (const key of ['dev', 'ino']) assert.match(pin[key], /^(0|[1-9][0-9]*)$/);
  }
  assert.equal(input.privateFiles['browser-session.json'].bytes, 205);
  assert.equal(input.privateFiles['browser-session.json'].sha256, 'ce38dbfa3b79b6cef3a18aadab0974ffc1860e256a5ecdc59f93396255c39f4a');
  assert.deepEqual(input.retainedArtifacts.map(item => item.artifactId).sort(), [
    '7d1a3928feb84fd1e5f503ec41aeae635bdefb4b9da5f47b50fb6824ec048920',
    'c7b85f49cf077460402083cfed577b034a19d256c8592020115d28512060542d',
  ]);
  assert.deepEqual(input.retainedArtifacts.find(item => item.artifactId === input.expectedBackendArtifact.artifactId), input.expectedBackendArtifact);
  for (const artifact of input.retainedArtifacts) {
    assert.equal(artifact.policy, 'flow.backend-artifact.v1'); assert.equal(artifact.manifestDigest, artifact.artifactId);
  }
  assert.equal(input.retainedArtifacts.find(item => item.artifactId.startsWith('c7b')).sourceHead, '422f4b150e5801d6010e5bbd6b53574e35384f87');
  assert.deepEqual(input.ports, { center: 61227, web: 61228 });
  assert.deepEqual(Object.keys(input.processDigests).sort(), ['center', 'runner', 'web']);
  for (const value of Object.values(input.processDigests)) assert.match(value, /^[a-f0-9]{64}$/);
  assert.ok(input.budget.freshBytes >= 2.5 * 1024 ** 3 && input.budget.liveBytes >= 1024 ** 3);
  assert.equal(input.budget.addedBytes, 512 * 1024 ** 2);
  assert.equal(input.budget.rawBytes, 2 * 1024 ** 2);
  assert.equal(input.artifactTotalLogicalBytes, 367045616);
  assert.equal(input.clone.manifestBytes, 3196606);
  assert.equal(input.clone.artifactEntries, 15628);
  assert.equal(input.clone.artifactLogicalBytes, 363849010);
  assert.equal(input.clone.cloneHelperSha256, 'c4911f0fc50009639a12fb8f24617916b1b8f2f116f0ba6ba7c55e74693cad62');
}

export function assertCurrentMigrationState(state, input) {
  assert.deepEqual(state.backendArtifact, input.expectedBackendArtifact, 'SELECTED_BACKEND_CHANGED');
  assert.deepEqual(state.source, input.expectedSource, 'RUNNING_SOURCE_CHANGED');
  assert.equal(state.pendingWebHost ?? null, null, 'WEB_HOST_PENDING');
  assert.deepEqual(state.webHost?.artifact, input.expectedWebHostArtifact, 'SELECTED_WEB_HOST_CHANGED');
}

async function directory(path, expected = null) {
  const info = await lstat(path, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(path), path);
  const identity = { dev: String(info.dev), ino: String(info.ino) };
  if (expected) assert.deepEqual(identity, expected, 'DIRECTORY_CHANGED');
  return identity;
}
async function sync(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const info = await file.stat(); assert.ok(info.isFile() || info.isDirectory()); await file.sync(); }
  finally { await file.close(); }
}
async function requireSpace(path, minimum) {
  const info = await statfs(path), available = Number(info.bavail) * Number(info.bsize);
  assert.ok(available >= minimum, 'SPACE_GATE'); return available;
}

export async function observeCurrentInstallation(mod, input) {
  await directory(input.installationDirectory, input.installationIdentity);
  const files = {};
  for (const name of requiredFiles) {
    const pin = input.privateFiles[name], path = join(input.installationDirectory, name);
    const { bytes, info } = await privateBytes(path, pin.bytes);
    assert.equal(await realpath(path), path); assert.equal(info.mode & 0o777, 0o600, 'PRIVATE_MODE');
    assert.equal(String(info.dev), pin.dev); assert.equal(String(info.ino), pin.ino);
    assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256, 'PRIVATE_BYTES_CHANGED');
    files[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  const state = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
  assertCurrentMigrationState(state, input);
  for (const role of ['center', 'runner', 'web']) {
    assert.equal(sha(JSON.stringify(state.processes[role])), input.processDigests[role], 'OWNED_RECORD_CHANGED');
    assert.equal(await mod.process.inspectOwnedProcess(state.processes[role]), 'running', 'OWNED_IDENTITY');
  }
  for (const role of ['center', 'web']) assert.equal(await mod.process.ownsListener(state.processes[role], input.ports[role]), true, 'LISTENER_IDENTITY');
  return { at: new Date().toISOString(), files, source: state.source, backendArtifact: state.backendArtifact, webHostArtifact: state.webHost.artifact, processDigests: input.processDigests };
}

export async function inspectCurrentStore(mod, input, store, verifiedOriginal) {
  const names = await readdir(store);
  assert.ok(names.every(name => name === 'prepare.lock' || /^[a-f0-9]{64}$/.test(name)), 'STORE_UNKNOWN');
  const ids = names.filter(name => name !== 'prepare.lock');
  const expected = new Map(input.retainedArtifacts.map(item => [item.artifactId, item]));
  for (const id of expected.keys()) assert.ok(ids.includes(id), 'RETAINED_ARTIFACT_MISSING');
  expected.set(input.artifact.artifactId, input.artifact);
  assert.ok(ids.every(id => expected.has(id)), 'STORE_UNKNOWN');
  let bytes = 0;
  for (const id of ids) bytes += (await mod.backend.verifyBackendArtifact({ directory: input.installationDirectory, artifact: expected.get(id) })).totalBytes;
  const present = ids.includes(input.artifact.artifactId);
  assert.equal(verifiedOriginal.totalBytes, input.artifactTotalLogicalBytes);
  backend.assertBackendRetention({ count: ids.length, bytes }, present ? null : { kind: 'import', bytes: verifiedOriginal.totalBytes });
  return present;
}

export function currentMigrationIO(mod, input, run, healthy, { observeInstallation = observeCurrentInstallation } = {}) {
  const rec = (name, value) => record(join(run, name), value);
  const fresh = () => observeInstallation(mod, input);
  return {
    record: rec, fresh,
    runner: config => confirmMigrationRunner(mod.Pool, config, input.expectedRunner),
    space: () => { healthy(); return requireSpace(input.installationDirectory, input.budget.freshBytes); },
    original: async () => {
      await directory(input.sourceDirectory, input.sourceDirectoryIdentity);
      const result = await mod.backend.verifyBackendArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
      assert.equal(result.totalBytes, input.artifactTotalLogicalBytes); healthy(); return result;
    },
    stage: async (store, original) => {
      const storeIdentity = await directory(store), stageDirectory = join(run, 'stage');
      const staged = join(stageDirectory, 'backend-artifacts', input.artifact.artifactId), destination = join(store, input.artifact.artifactId);
      let stageIdentity;
      return {
        intent: () => rec('migration-store-intent.json', { storeIdentity, staged, destination, artifact: input.artifact }),
        inspectStore: () => { healthy(); return inspectCurrentStore(mod, input, store, original); },
        clone: async () => {
          healthy(); await mkdir(stageDirectory, { mode: 0o700 }); stageIdentity = await directory(stageDirectory);
          assert.equal(stageIdentity.dev, storeIdentity.dev); await mkdir(join(stageDirectory, 'backend-artifacts'), { mode: 0o700 });
          await rec('clone-input.json', { ...input.clone, sourceDirectory: input.sourceDirectory, artifact: input.artifact, directory: stageDirectory });
          const child = await execute(input.python, [input.cloneDriver.path, join(run, 'clone-input.json')], { maxBuffer: 65536, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
          assert.equal(child.stderr, ''); const facts = JSON.parse(child.stdout);
          assert.equal(facts.regularLogicalBytes, original.totalBytes);
          assert.ok(facts.regularAllocatedBytes + input.budget.rawBytes <= input.budget.addedBytes, 'ALLOCATED_BYTE_BOUND');
          await rec('clone-result.json', facts); healthy();
        },
        verify: location => mod.backend.verifyBackendArtifact({ directory: location === 'stage' ? stageDirectory : input.installationDirectory, artifact: input.artifact }),
        syncStage: async () => {
          for (const item of original.manifest.inventory.entries) if (item.kind === 'file') await sync(join(staged, 'root', item.path));
          await sync(join(staged, 'manifest.json'));
          for (const item of [...original.manifest.inventory.entries].reverse()) if (item.kind === 'directory') await sync(join(staged, 'root', item.path));
          await sync(join(staged, 'root')); await sync(staged);
        },
        checkpoint: async () => {
          healthy(); await directory(store, storeIdentity); await directory(stageDirectory, stageIdentity);
          await requireSpace(store, input.budget.liveBytes); await fresh();
          await rec('migration-checkpoint.json', { phase: 'verified-and-synced-before-exclusive-rename', stageIdentity, storeIdentity, artifact: input.artifact });
        },
        publishExclusive: () => { healthy(); return mod.transfer.renameExclusive(staged, destination); },
        syncParents: async () => { await sync(store); await sync(dirname(staged)); },
      };
    },
  };
}

export async function migrateCurrentArtifact(mod, input, healthy,
  { validateInput = validateCurrentMigrationInput, observeInstallation = observeCurrentInstallation } = {}) {
  validateInput(input);
  await directory(input.runDirectory, input.runIdentity);
  return migrateWithLocks(mod, input, input.runDirectory,
    currentMigrationIO(mod, input, input.runDirectory, healthy, { observeInstallation }));
}
