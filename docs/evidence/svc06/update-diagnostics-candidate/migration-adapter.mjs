// One fixed artifact import. The existing migrateOnce procedure owns the order; no service or pointer mutation.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, realpath, open, readdir, mkdir, statfs } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import { createRequire } from 'node:module';
import { sha, safeError, migrateOnce } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/procedure.mjs';
import { privateBytes, runtimeBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
const execute = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
async function sync(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const s = await file.stat(); assert.ok(s.isDirectory() || s.isFile()); await file.sync(); } finally { await file.close(); }
}
export async function record(path, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); assert.ok(bytes.length <= 128 * 1024, 'RECORD_BOUND');
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  await sync(dirname(path));
}
async function directory(path, expected = null) {
  const s = await lstat(path, { bigint: true });
  assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === BigInt(process.getuid()) && (s.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(path), path);
  const value = { dev: String(s.dev), ino: String(s.ino) };
  if (expected) for (const key of ['dev', 'ino']) assert.equal(value[key], String(expected[key]), 'DIRECTORY_CHANGED');
  return value;
}
async function absent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.fail('EXPECTED_ABSENT');
}
async function free(path, minimum) {
  const s = await statfs(path); const bytes = Number(s.bavail) * Number(s.bsize); assert.ok(bytes >= minimum, 'SPACE_GATE'); return bytes;
}
export function assertMigrationState(state, input) {
  assert.equal(state.backendArtifact ?? null, null, 'BACKEND_ALREADY_SELECTED');
  assert.equal(state.pendingWebHost ?? null, null, 'WEB_HOST_PENDING');
  assert.deepEqual(state.source, input.expectedSource, 'RUNNING_SOURCE_CHANGED');
  // A settled c7b host is required and retained. Never relax this to any non-null host.
  assert.deepEqual(state.webHost, input.expectedWebHost, 'SETTLED_WEB_HOST_CHANGED');
}
export function checkStoreBudget(ids, totalBytes, input, limits) {
  assert.ok(ids.every(id => [input.retainedArtifact.artifactId, input.artifact.artifactId].includes(id)), 'STORE_UNKNOWN');
  assert.ok(ids.includes(input.retainedArtifact.artifactId), 'RETAINED_ARTIFACT_MISSING');
  assert.ok(ids.length <= limits.artifacts && totalBytes <= limits.retainedBytes, 'STORE_LIMIT');
  const present = ids.includes(input.artifact.artifactId);
  assert.ok(present || (ids.length < limits.artifacts && totalBytes + input.artifactTotalLogicalBytes <= limits.retainedBytes), 'RETENTION_LIMIT');
  return present;
}
async function freshInstallation(mod, input) {
  await directory(input.installationDirectory, input.installationIdentity);
  const files = {};
  for (const [name, pin] of Object.entries(input.privateFiles)) {
    const { bytes, info } = await privateBytes(join(input.installationDirectory, name), pin.bytes);
    assert.equal(info.mode & 0o777, 0o600, 'PRIVATE_MODE');
    assert.equal(String(info.dev), pin.dev); assert.equal(String(info.ino), pin.ino);
    assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256, 'PRIVATE_BYTES_CHANGED');
    files[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  await absent(join(input.installationDirectory, 'browser-session.json'));
  const state = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
  assertMigrationState(state, input);
  for (const role of ['center', 'runner', 'web']) {
    assert.equal(sha(JSON.stringify(state.processes[role])), input.processDigests[role], 'OWNED_RECORD_CHANGED');
    assert.equal(await mod.process.inspectOwnedProcess(state.processes[role]), 'running', 'OWNED_IDENTITY');
  }
  for (const role of ['center', 'web']) assert.equal(await mod.process.ownsListener(state.processes[role], input.ports[role]), true, 'LISTENER_IDENTITY');
  return { at: new Date().toISOString(), files, source: state.source, webHost: state.webHost, processDigests: input.processDigests };
}
async function syncArtifact(path, manifest) {
  for (const entry of manifest.inventory.entries) if (entry.kind === 'file') await sync(join(path, 'root', entry.path));
  await sync(join(path, 'manifest.json'));
  for (const entry of [...manifest.inventory.entries].reverse()) if (entry.kind === 'directory') await sync(join(path, 'root', entry.path));
  await sync(join(path, 'root')); await sync(path);
}
// Pure tests inject only I/O and existing module ports; production assembly below supplies every port explicitly.
export async function migrateWithLocks(mod, input, run, io) {
  const config = await mod.preview.loadPreviewConfiguration(input.installationDirectory);
  return mod.preview.withPreviewLock(config, async () => {
    const before = await io.fresh(); await io.record('migration-before.json', before);
    await mod.preview.assertPreviewMarker(config); await io.runner(config);
    const original = await io.original();
    assert.equal(original.manifest.sourceRepository, input.repository);
    await io.record('migration-intent.json', { at: new Date().toISOString(), artifact: input.artifact, mutation: 'artifact-store-only', freeBefore: await io.space() });
    const store = await mod.store.ensureStore(input.installationDirectory);
    return mod.store.withStoreLock(store, async () => {
      const prepared = await io.stage(store, original);
      await migrateOnce({ ...prepared,
        result: async result => {
          if (result.outcome !== 'unknown') {
            const after = await io.fresh(); assert.ok(isDeepStrictEqual(before.files, after.files), 'MIGRATION_PRIVATE_CHANGED');
            await io.record('migration-after.json', after);
          }
          await io.record('migration-result.json', { at: new Date().toISOString(), ...result, artifact: input.artifact, operatorServiceMutations: 0, stageKept: true });
        },
      });
    });
  });
}
// Separate only the actual read-only connection port so its SQL and closure are exercised without a database.
export async function confirmMigrationRunner(Pool, config, expected) {
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 1500, query_timeout: 2000, application_name: 'svc06-artifact-import-readonly' });
  let primary = null;
  try {
    const rows = (await pool.query('SELECT id,maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1', [config.runner.runnerId])).rows;
    assert.deepEqual(rows, [expected], 'RUNNER_MAINTENANCE_CHANGED');
  } catch (error) { primary = error; }
  finally {
    try { await pool.end(); }
    catch (error) { if (primary) primary.recordError = safeError(error); else primary = error; }
  }
  if (primary) throw primary;
}
function productionIO(mod, input, run, healthy) {
  const rec = (name, value) => record(join(run, name), value);
  return {
    record: rec, fresh: () => freshInstallation(mod, input),
    space: async () => { healthy(); return free(input.installationDirectory, input.budget.freshBytes); },
    runner: config => confirmMigrationRunner(mod.Pool, config, input.expectedRunner),
    original: async () => {
      await directory(input.sourceDirectory, input.sourceDirectoryIdentity);
      const original = await mod.backend.verifyBackendArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
      assert.equal(original.totalBytes, input.artifactTotalLogicalBytes); healthy(); return original;
    },
    stage: async (store, original) => {
      const storeIdentity = await directory(store), stageDirectory = join(run, 'stage');
      const staged = join(stageDirectory, 'backend-artifacts', input.artifact.artifactId), destination = join(store, input.artifact.artifactId);
      let stageIdentity;
      return {
        intent: () => rec('migration-store-intent.json', { at: new Date().toISOString(), storeIdentity, staged, destination, artifact: input.artifact }),
        inspectStore: async () => {
          const names = await readdir(store);
          assert.ok(names.every(name => name === 'prepare.lock' || /^[a-f0-9]{64}$/.test(name)), 'STORE_UNKNOWN');
          const ids = names.filter(name => /^[a-f0-9]{64}$/.test(name)); let bytes = 0;
          for (const id of ids) {
            assert.ok([input.retainedArtifact.artifactId, input.artifact.artifactId].includes(id), 'STORE_UNKNOWN');
            bytes += (await mod.backend.verifyBackendArtifact({ directory: input.installationDirectory, artifact: id === input.artifact.artifactId ? input.artifact : input.retainedArtifact })).totalBytes;
          }
          healthy(); return checkStoreBudget(ids, bytes, input, mod.store.LIMITS);
        },
        clone: async () => {
          healthy(); await mkdir(stageDirectory, { mode: 0o700 }); stageIdentity = await directory(stageDirectory);
          assert.equal(stageIdentity.dev, storeIdentity.dev); await mkdir(join(stageDirectory, 'backend-artifacts'), { mode: 0o700 });
          await rec('clone-input.json', { ...input.clone, sourceDirectory: input.sourceDirectory, artifact: input.artifact, directory: stageDirectory });
          const child = await execute(input.python, [input.cloneDriver.path, join(run, 'clone-input.json')], { maxBuffer: 65536, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
          assert.equal(child.stderr, ''); const facts = JSON.parse(child.stdout);
          assert.equal(facts.regularLogicalBytes, input.artifactTotalLogicalBytes);
          assert.ok(facts.regularAllocatedBytes + input.budget.rawBytes <= input.budget.addedBytes, 'ALLOCATED_BYTE_BOUND');
          await rec('clone-result.json', facts); healthy();
        },
        verify: location => mod.backend.verifyBackendArtifact({ directory: location === 'stage' ? stageDirectory : input.installationDirectory, artifact: input.artifact }),
        syncStage: () => syncArtifact(staged, original.manifest),
        checkpoint: async () => {
          healthy(); await directory(store, storeIdentity); await directory(stageDirectory, stageIdentity);
          await free(store, input.budget.liveBytes); await freshInstallation(mod, input);
          await rec('migration-checkpoint.json', { at: new Date().toISOString(), phase: 'verified-and-synced-before-exclusive-rename', stageIdentity, storeIdentity, artifact: input.artifact });
        },
        publishExclusive: () => { healthy(); return mod.transfer.renameExclusive(staged, destination); },
        syncParents: async () => { await sync(store); await sync(dirname(staged)); },
      };
    },
  };
}
async function fixedInputs(input) {
  for (const pin of input.runtimePins) await runtimeBytes(pin);
  const inherited = JSON.parse((await runtimeBytes(input.inherited)).bytes);
  for (const alias of inherited.rootAliases) {
    const s = await lstat(alias.path, { bigint: true });
    assert.equal(String(s.dev), String(alias.dev)); assert.equal(String(s.ino), String(alias.ino)); assert.equal(await realpath(alias.path), alias.realpath);
  }
  const manifest = JSON.parse((await runtimeBytes(input.artifactManifest)).bytes);
  // Reuse the accepted manifest's finite package inventory rather than make another payload manifest.
  for (const pkg of inherited.rootPackages) {
    assert.equal(await realpath(pkg.root), pkg.root);
    const entries = manifest.inventory.entries.filter(row => row.kind === 'file' && row.path.startsWith(pkg.manifestPrefix));
    assert.equal(entries.length, pkg.files); assert.equal(entries.reduce((n, row) => n + row.bytes, 0), pkg.bytes);
    for (const row of entries) {
      const { bytes } = await privateBytes(join(input.repository, row.path), row.bytes);
      assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
    }
  }
}
export async function main() {
  const inputBytes = (await privateBytes(join(here, 'migration-inputs.json'), 128 * 1024)).bytes;
  const input = JSON.parse(inputBytes); await fixedInputs(input);
  const at = path => import(pathToFileURL(path).href), tools = join(input.repository, 'tools/personal-preview');
  const mod = { preview: await at(join(tools, 'preview.mjs')), process: await at(join(tools, 'process.mjs')),
    backend: await at(join(tools, 'backend-release/index.mjs')), store: await at(join(tools, 'backend-release/files.mjs')),
    transfer: await at(input.renameModule.path), Pool: createRequire(join(input.repository, 'package.json'))('pg').Pool };
  await free(input.installationDirectory, input.budget.freshBytes);
  const run = input.runDirectory; await mkdir(run, { mode: 0o700 });
  await record(join(run, 'reservation.json'), { startedAt: new Date().toISOString(), inputSha256: sha(inputBytes), identity: await directory(run), artifact: input.artifact, personalAction: 'not-started' });
  let failure = null, minimumFree = Infinity, samples = 0, active = null;
  const sample = () => active ?? (active = (async () => {
    try { minimumFree = Math.min(minimumFree, await free(run, input.budget.liveBytes)); samples++; }
    catch (error) { failure ??= error; } finally { active = null; }
  })());
  const healthy = () => { if (failure) throw failure; };
  const timer = setInterval(sample, 200); let primary = null;
  try { await migrateWithLocks(mod, input, run, productionIO(mod, input, run, healthy)); healthy(); }
  catch (error) { primary = error; }
  finally {
    clearInterval(timer); if (active) await active; await sample();
    try { await record(join(run, 'resource.json'), { minimumFree, samples, sampleFailure: failure ? safeError(failure) : null, atomicPeak: false }); }
    catch (error) { if (primary) primary.recordError = safeError(error); else primary = error; }
  }
  if (primary) throw primary; healthy();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { assert.equal(process.argv[2], '--execute-fixed-import'); await main(); console.log(JSON.stringify({ outcome: 'complete' })); }
  catch (error) { console.log(JSON.stringify({ outcome: 'unknown-keep', primary: safeError(error), recordError: error.recordError ?? null })); process.exitCode = 1; }
}
