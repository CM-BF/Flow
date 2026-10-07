// Only executed by the fixed supervisor. Importing this module does not read the personal installation.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, realpath, open, readdir, mkdir, statfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import { sha, safeError, protectedState, requireFresh, protection, requestFrom, migrateOnce } from './procedure.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const execute = promisify(execFile);
let resourceFailure = null;
function healthy() { if (resourceFailure) throw resourceFailure; }
async function bounded(path, limit = 65536) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat(); assert.ok(info.isFile() && info.uid === process.getuid() && info.nlink === 1 && info.size <= limit);
    const buffer = Buffer.alloc(limit + 1); let length = 0;
    while (length < buffer.length) { const row = await file.read(buffer, length, buffer.length - length, null); if (!row.bytesRead) break; length += row.bytesRead; }
    assert.ok(length <= limit); return { bytes: buffer.subarray(0, length), info };
  } finally { await file.close(); }
}
async function json(path, limit) { return JSON.parse((await bounded(path, limit)).bytes); }
async function sync(path, directory = false) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const s = await file.stat(); assert.ok(directory ? s.isDirectory() : s.isFile()); await file.sync(); } finally { await file.close(); }
}
async function record(path, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); assert.ok(bytes.length < 512 * 1024);
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  await sync(dirname(path), true);
}
async function directory(path, expected = null) {
  const s = await lstat(path);
  assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid() && (s.mode & 0o777) === 0o700);
  assert.equal(await realpath(path), path);
  if (expected) { assert.equal(s.dev, expected.dev); assert.equal(s.ino, expected.ino); }
  return { dev: s.dev, ino: s.ino };
}
async function space(path, minimum) {
  const s = await statfs(path), free = Number(s.bavail) * Number(s.bsize); assert.ok(free >= minimum, 'SPACE_GATE'); return free;
}
async function fixed(row, path = row.path) {
  const { bytes, info } = await bounded(path, row.bytes);
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  if (row.realpath) assert.equal(await realpath(path), row.realpath);
  if (row.dev) { assert.equal(info.dev, row.dev); assert.equal(info.ino, row.ino); }
}
async function modules(input) {
  for (const row of input.rootToolClosure) await fixed(row, join(input.repository, row.path));
  for (const row of [...input.runtimeTools, ...input.resolvedRootEntries, ...input.reusedHelpers]) await fixed(row);
  const at = path => import(pathToFileURL(path).href);
  const tools = join(input.repository, 'tools/personal-preview');
  return { preview: await at(join(tools, 'preview.mjs')), store: await at(join(tools, 'backend-release/files.mjs')),
    backend: await at(join(tools, 'backend-release/index.mjs')), process: await at(join(tools, 'process.mjs')),
    release: await at(join(tools, 'web-release.mjs')), webArtifact: await at(join(tools, 'web-artifact.mjs')), facts: await at(input.factsModule),
    transfer: await at(input.renameModule) };
}
async function snapshot(mod, input) {
  const facts = await mod.facts.snapshot();
  const state = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
  facts.protectedState = protectedState(state); facts.webHost = state.webHost ?? null;
  facts.backendArtifact = state.backendArtifact ?? null; facts.pendingWebHost = state.pendingWebHost ?? null;
  return facts;
}
async function inspectStore(mod, input, store) {
  const names = await readdir(store);
  assert.ok(names.every(name => name === 'prepare.lock' || /^[a-f0-9]{64}$/.test(name) || /^stage-[a-f0-9-]+\.json$/.test(name)), 'STORE_UNKNOWN');
  assert.ok(names.filter(name => name.startsWith('stage-')).length < 32, 'STORE_RECORD_LIMIT');
  const ids = names.filter(name => /^[a-f0-9]{64}$/.test(name)); let bytes = 0;
  for (const id of ids) {
    const manifest = await json(join(store, id, 'manifest.json'), 32 * 1024 ** 2);
    const descriptor = { policy: 'flow.backend-artifact.v1', artifactId: id, manifestDigest: id, sourceHead: manifest.sourceHead };
    bytes += (await mod.backend.verifyBackendArtifact({ directory: input.installationDirectory, artifact: descriptor })).totalBytes;
  }
  assert.ok(ids.length <= mod.store.LIMITS.artifacts && bytes <= mod.store.LIMITS.retainedBytes);
  const present = ids.includes(input.artifact.artifactId);
  assert.ok(present || ids.length < mod.store.LIMITS.artifacts && bytes + mod.store.LIMITS.bytes <= mod.store.LIMITS.retainedBytes, 'RETENTION_LIMIT');
  return present;
}
async function syncArtifact(path, manifest) {
  // The verifier already checked the exact finite inventory. Links stay links; sync their parent directories.
  for (const entry of manifest.inventory.entries) if (entry.kind === 'file') await sync(join(path, 'root', entry.path));
  await sync(join(path, 'manifest.json'));
  for (const entry of [...manifest.inventory.entries].reverse()) if (entry.kind === 'directory') await sync(join(path, 'root', entry.path), true);
  await sync(join(path, 'root'), true); await sync(path, true);
}
async function migrate(mod, input, run) {
  const config = await mod.preview.loadPreviewConfiguration(input.installationDirectory);
  await mod.preview.withPreviewLock(config, async () => {
    const before = await snapshot(mod, input); await record(join(run, 'migration-before.json'), before); requireFresh(before, before, input); assert.equal(before.webHost, null);
    await mod.preview.assertPreviewMarker(config);
    await directory(input.sourceDirectory, input.sourceDirectoryIdentity);
    const originalManifest = join(input.sourceDirectory, 'backend-artifacts', input.artifact.artifactId, 'manifest.json');
    const ms = (await bounded(originalManifest, input.manifestBytes)).info;
    assert.equal(ms.dev, input.artifactManifestIdentity.dev); assert.equal(ms.ino, input.artifactManifestIdentity.ino);
    const original = await mod.backend.verifyBackendArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
    assert.equal(original.manifest.sourceRepository, input.repository);
    const freeBefore = await space(input.installationDirectory, input.proposedBudget.freshBytes);
    healthy();
    await record(join(run, 'migration-intent.json'), { at: new Date().toISOString(), artifact: input.artifact, rootIdentity: before.rootIdentity, mutation: 'store-and-exact-artifact-only', freeBefore });
    const store = await mod.store.ensureStore(input.installationDirectory), storeIdentity = await directory(store);
    await mod.store.withStoreLock(store, async () => {
      const stageDirectory = join(run, 'stage'), staged = join(stageDirectory, 'backend-artifacts', input.artifact.artifactId);
      const destination = join(store, input.artifact.artifactId); let stageIdentity, cloneFacts;
      await migrateOnce({
        intent: () => record(join(run, 'migration-store-intent.json'), { at: new Date().toISOString(), artifact: input.artifact, destination, staged, storeIdentity, freeBefore }),
        inspectStore: () => inspectStore(mod, input, store),
        clone: async () => {
          healthy();
          await mkdir(stageDirectory, { mode: 0o700 }); stageIdentity = await directory(stageDirectory);
          assert.equal(stageIdentity.dev, storeIdentity.dev); await mkdir(join(stageDirectory, 'backend-artifacts'), { mode: 0o700 });
          const cloneInput = { ...input, directory: stageDirectory };
          await record(join(run, 'clone-input.json'), cloneInput);
          const child = await execute(input.python, [input.cloneDriver.path, join(run, 'clone-input.json')], { maxBuffer: 65536, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
          cloneFacts = JSON.parse(child.stdout); assert.equal(child.stderr, ''); await record(join(run, 'clone-result.json'), cloneFacts);
        },
        verify: location => mod.backend.verifyBackendArtifact({ directory: location === 'stage' ? stageDirectory : input.installationDirectory, artifact: input.artifact }),
        syncStage: () => syncArtifact(staged, original.manifest),
        checkpoint: async () => {
          healthy();
          await directory(store, storeIdentity); await directory(stageDirectory, stageIdentity);
          await space(store, input.proposedBudget.liveBytes);
          await record(join(run, 'migration-checkpoint.json'), { at: new Date().toISOString(), phase: 'verified-and-synced-before-exclusive-rename', stageIdentity, storeIdentity, cloneFacts });
        },
        publishExclusive: () => { healthy(); return mod.transfer.renameExclusive(staged, destination); },
        syncParents: async () => { await sync(store, true); await sync(dirname(staged), true); },
        result: result => record(join(run, 'migration-result.json'), { at: new Date().toISOString(), ...result, artifact: input.artifact, stageKept: true }),
      });
    });
  });
}
async function request(mod, input, run, operationId) {
  const migrated = await json(join(run, 'migration-result.json'));
  assert.ok(['migrated', 'already-present-exact'].includes(migrated.outcome));
  const config = await mod.preview.loadPreviewConfiguration(input.installationDirectory);
  await mod.preview.withPreviewLock(config, async () => {
    const before = await snapshot(mod, input); await record(join(run, 'replacement-before.json'), before); requireFresh(before, before, input); assert.equal(before.webHost, null);
    const state = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
    assert.equal(sha(JSON.stringify(state.processes.web)), before.processes.web.recordSha256);
    await record(join(run, 'old-web-record.json'), state.processes.web);
    const migrationBefore = await json(join(run, 'migration-before.json'));
    const preserved = protection(migrationBefore, before);
    await record(join(run, 'migration-preservation.json'), preserved); assert.ok(preserved.protected);
    // Concurrent business activity is observed, never blocked or required to become empty.
    await space(input.installationDirectory, input.proposedBudget.freshBytes);
    const candidate = await mod.preview.inspectPreviewWebHostSource({ directory: input.installationDirectory, webHostArtifact: input.artifact });
    assert.equal(candidate.digest, input.candidateHostSource.digest);
    healthy();
    await record(join(run, 'replace-intent.json'), { at: new Date().toISOString(), operationId, artifact: input.artifact, beforeDigest: sha(JSON.stringify(before)) });
    await record(join(run, 'request.json'), requestFrom(before, operationId, input));
  });
}
async function fetchBounded(port, path, limit) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 200); const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try { for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; assert.ok(bytes <= limit); chunks.push(Buffer.from(next.value)); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
async function post(mod, input, run, operationId) {
  const outer = await json(join(run, 'replace-outer.json'), 2 * 1024 ** 2);
  assert.equal(outer.exit_code, 0); assert.equal(outer.first_failure, null); assert.equal(outer.owned_state, 'absent'); assert.ok(Object.values(outer.eof).every(Boolean));
  const cli = JSON.parse(outer.stdout); assert.equal(cli.outcome, 'ready');
  const before = await json(join(run, 'replacement-before.json')), after = await snapshot(mod, input);
  await record(join(run, 'replacement-after.json'), after); requireFresh(after, after, input);
  const preserved = protection(before, after); await record(join(run, 'replacement-preservation.json'), preserved);
  assert.ok(preserved.protected); assert.equal(after.webHost.operationId, operationId); assert.ok(isDeepStrictEqual(after.webHost.artifact, input.artifact));
  const oldRecord = await json(join(run, 'old-web-record.json'));
  assert.equal(await mod.process.inspectOwnedProcess(oldRecord), 'stopped');
  const oldExit = await json(join(input.installationDirectory, 'web-exit.json'));
  await record(join(run, 'old-web-exit-observed.json'), { at: oldExit.at, code: oldExit.code, signal: oldExit.signal, nonceMatches: oldExit.nonce === oldRecord.nonce });
  const assets = await mod.release.loadReleaseAssets({ directory: input.installationDirectory, release: after.release });
  const results = []; let total = 0;
  const read = async (path, expected = null) => {
    const bytes = await fetchBounded(after.identity.webPort, path, 1024 ** 2); total += bytes.length; assert.ok(total <= 2 * 1024 ** 2);
    if (expected) { assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256); }
    results.push({ path, status: 200, bytes: bytes.length, sha256: sha(bytes) }); return bytes;
  };
  const identity = JSON.parse(await read('/__flow_preview_identity'));
  assert.equal(identity.artifactId, after.release.current); assert.equal(identity.releaseVersion, 3);
  const current = after.release.artifacts.find(row => row.artifactId === after.release.current);
  assert.equal(identity.manifestDigest, current.manifestDigest); assert.equal(identity.sourceHead, current.sourceHead);
  await read('/', assets.index);
  for (const artifact of after.release.artifacts) {
    const asset = await mod.webArtifact.verifyWebArtifact({ directory: input.installationDirectory, artifact });
    const file = asset.manifest.files.find(file => file.path !== 'index.html' && file.bytes <= 1024 ** 2); assert.ok(file);
    const prefix = asset.manifest.format === 2 ? `/__flow_releases/${asset.manifest.releaseId}/` : '/';
    await read(prefix + file.path, file);
  }
  await record(join(run, 'post-result.json'), { at: new Date().toISOString(), outcome: preserved.businessObservation === 'UNCHANGED' ? 'ready-preserved' : 'ready-business-observation-unknown',
    operatorBusinessWrites: 0, http: results, totalHttpBytes: total, oldGroup: 'stopped', preservation: preserved, automaticFurtherAction: false });
}
export async function main(phase, run) {
  assert.ok(['migrate', 'request', 'post'].includes(phase));
  const input = await json(join(here, 'inputs.json')), reservation = await json(join(run, 'reservation.json'));
  assert.equal(run, input.executionDirectory); await directory(run, reservation.identity);
  const mod = await modules(input);
  let minimumFree = await space(input.installationDirectory, input.proposedBudget.freshBytes), samples = 1, activeSample = null;
  const sample = () => {
    if (activeSample) return activeSample;
    activeSample = (async () => {
      try { minimumFree = Math.min(minimumFree, await space(run, input.proposedBudget.liveBytes)); samples++; }
      catch (error) { resourceFailure ??= error; }
      finally { activeSample = null; }
    })();
    return activeSample;
  };
  const timer = setInterval(sample, 200); let primary = null;
  try {
    if (phase === 'migrate') await migrate(mod, input, run);
    else if (phase === 'request') await request(mod, input, run, reservation.operationId);
    else await post(mod, input, run, reservation.operationId);
    healthy();
  } catch (error) { primary = error; }
  finally {
    clearInterval(timer);
    try {
      if (activeSample) await activeSample;
      await sample();
      await record(join(run, `${phase}-resource.json`), { minimumFree, samples, sampleFailure: resourceFailure ? safeError(resourceFailure) : null, atomicPeak: false });
    } catch (error) { if (primary) primary.recordError = safeError(error); else primary = error; }
  }
  if (primary) throw primary;
  healthy();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await main(process.argv[2], process.argv[3]); console.log(JSON.stringify({ phase: process.argv[2], outcome: 'complete' })); }
  catch (error) {
    const result = { at: new Date().toISOString(), phase: process.argv[2], outcome: 'unknown', primary: safeError(error), recordError: error.recordError ?? null };
    try { await record(join(process.argv[3], `${process.argv[2]}-failure.json`), result); } catch (failure) { result.failurePersistence = safeError(failure); }
    console.log(JSON.stringify(result)); process.exitCode = 1;
  }
}
