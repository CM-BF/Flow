// Fixed Flow-source artifact preparation; procedural caller derived from reviewed SVC06 entry.
// Existing builder/selector/installer and OPS14 remain the implementations; no host or PG calls.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, readdir, lstat, realpath, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const execute = promisify(execFile), here = dirname(fileURLToPath(import.meta.url));
export function fixedArtifactOptions(options = {}) {
  assert.deepEqual(Object.keys(options).filter(key => !['evidenceDirectory', 'temporaryPrefix', 'runtimeProof'].includes(key)), []);
  const evidenceDirectory = options.evidenceDirectory ?? here;
  const temporaryPrefix = options.temporaryPrefix ?? '/private/tmp/flow-svc06-diagnostics-artifact-';
  const runtimeProof = options.runtimeProof ?? join(here, 'runtime-proof.mjs');
  for (const value of [evidenceDirectory, temporaryPrefix, runtimeProof]) assert.ok(typeof value === 'string' && isAbsolute(value) && resolve(value) === value);
  assert.ok(temporaryPrefix.startsWith('/private/tmp/flow-') && !temporaryPrefix.endsWith('/'));
  return { evidenceDirectory, temporaryPrefix, runtimeProof };
}
// Importing this module performs no I/O. Exact caller-supplied JSON bytes identify the run.
export async function runFixedArtifact(inputBytes, options = {}) {
  assert.ok(Buffer.isBuffer(inputBytes));
  const input = JSON.parse(inputBytes.toString('utf8'));
  const { evidenceDirectory, temporaryPrefix, runtimeProof } = fixedArtifactOptions(options);
  const run = join(evidenceDirectory, 'actual-first');
  const startedAt = new Date().toISOString(), startedMs = performance.now();
  const report = { startedAt, source: input.target, phase: 'preflight', providerCalls: 0, artifact: null, directory: null, reservation: null, failures: [] };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const code = error => ({ name: error.name, code: typeof error.code === 'string' ? error.code : null, message: String(error.message).slice(0, 500) });
  async function durableBytes(path, bytes) {
    const handle = await open(path, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    const parent = await open(dirname(path), constants.O_RDONLY); try { await parent.sync(); } finally { await parent.close(); }
  }
  const durable = (path, value) => durableBytes(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
  let monitor, sampling = null, minimumFree = null, samples = 0, initialFree = null;
  const space = async () => { const value = await statfs(evidenceDirectory); return value.bavail * value.bsize; };
  async function sample() {
    const free = await space(); samples++; minimumFree = Math.min(minimumFree ?? free, free);
    assert.ok(free >= input.resources.liveReserveBytes, 'BACKEND_LIVE_RESERVE_REQUIRED');
    assert.ok(initialFree === null || initialFree - free <= input.resources.additionalBudgetBytes, 'BACKEND_ADDITIONAL_SPACE_BUDGET');
  }
  // OPS14 owns this whole new session, including installer children in the same group.
  // Failures end this entry; the external owner stops/reaps its group independently of fsync.
  function startSample() {
    if (sampling) return;
    sampling = sample().catch(error => {
      process.stdout.write(JSON.stringify({ phase: 'resource-stop', error: code(error), minimumFree, samples }) + '\n');
      process.exit(75);
    }).finally(() => { sampling = null; });
  }
  async function copyBuildRecord() {
    if (!report.directory || report.buildRecord) return;
    const store = join(report.directory, 'backend-artifacts');
    let names;
    try { names = await readdir(store); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    const stages = names.filter(name => /^stage-[a-f0-9-]+\.json$/.test(name));
    assert.ok(stages.length <= 1, 'BACKEND_RECORD_AMBIGUOUS');
    if (!stages.length) return;
    const path = join(store, stages[0]), info = await lstat(path);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= input.resources.rawBytes / 8, 'BACKEND_RECORD_RAW_BUDGET');
    const bytes = await readFile(path); assert.equal(bytes.length, info.size);
    await durableBytes(join(run, 'build-record.json'), bytes);
    report.buildRecord = { path: stages[0], bytes: bytes.length, sha256: hash(bytes) };
  }
  try {
    await mkdir(run, { mode: 0o700 }); // Exclusive: existing or unknown runs are never retried.
    await durable(join(run, 'reservation.json'), { startedAt, inputSha256: hash(inputBytes), source: input.target });
    report.reservation = join(run, 'reservation.json');
    assert.equal(input.ready, 'FIXED_REVIEW_INPUT');
    assert.equal(process.version, input.nodeVersion);
    for (const binding of input.bindings) {
      assert.equal(await realpath(binding.path), binding.realpath);
      const info = await lstat(binding.realpath); assert.ok(info.isFile() && !info.isSymbolicLink()); assert.equal(info.size, binding.bytes);
      assert.equal(hash(await readFile(binding.realpath)), binding.sha256);
    }
    const git = async args => (await execute('/usr/bin/git', ['-C', input.repository, ...args], { timeout: 3000, maxBuffer: 4 * 1024 ** 2 })).stdout;
    assert.equal((await git(['rev-parse', `${input.target}^{commit}`])).trim(), input.target);
    initialFree = await space(); minimumFree = initialFree;
    assert.ok(initialFree >= input.resources.minimumFreeBytes, 'BACKEND_FRESH_SPACE_REQUIRED');
    monitor = setInterval(startSample, 500); monitor.unref();
    const directory = await realpath(await mkdtemp(temporaryPrefix));
    const identity = await lstat(directory);
    assert.ok(identity.isDirectory() && !identity.isSymbolicLink() && identity.uid === process.getuid() && (identity.mode & 0o777) === 0o700, 'BACKEND_OWN_ROOT_REQUIRED');
    report.directory = directory; report.directoryIdentity = { dev: identity.dev, ino: identity.ino };
    await durable(join(run, 'owned-root.json'), { directory, ...report.directoryIdentity, source: input.target });
    await durable(join(directory, 'owner.json'), { run, source: input.target, ...report.directoryIdentity });
    const { prepareBackendArtifact, verifyBackendArtifact } = await import(pathToFileURL(input.builderModule).href);
    report.phase = 'building';
    const artifact = await prepareBackendArtifact({ repository: input.repository, target: input.target, directory, offlineStore: input.offlineStore, pnpmCli: input.pnpmCli });
    report.artifact = artifact; report.phase = 'verifying';
    await copyBuildRecord();
    const verified = await verifyBackendArtifact({ directory, artifact });
    assert.equal(artifact.sourceHead, input.target);
    assert.equal(verified.manifest.sourceRepository, input.repository);
    assert.equal(verified.manifest.sourceTree, input.sourceTree);
    for (const source of input.fixedSourceInputs) { const bytes = await readFile(join(verified.root, source.path)); assert.equal(bytes.length, source.bytes); assert.equal(hash(bytes), source.sha256); }
    assert.equal(verified.manifest.lockDigest, input.lockSha256);
    assert.deepEqual(verified.manifest.installation.hostTools, input.hostTools);
    assert.equal(verified.manifest.installation.snapshots.length, input.snapshots);
    assert.deepEqual(verified.manifest.installation.snapshots, input.snapshotKeys);
    assert.deepEqual(verified.manifest.installation.importers, input.importers);
    for (const sql of input.sql) { const bytes = await readFile(join(verified.root, sql.path)); assert.equal(bytes.length, sql.bytes); assert.equal(hash(bytes), sql.sha256); }
    report.sqlFilesVerified = input.sql.length;
    report.inventory = { logicalBytes: verified.manifest.inventory.bytes, entries: verified.manifest.inventory.entries.length, manifestBytesIncluded: verified.totalBytes, nodeImages: verified.manifest.node.images.length };
    await durable(join(run, 'result-descriptor.json'), artifact);
    const artifactRequire = createRequire(join(verified.root, 'package.json'));
    let proof, proofError;
    try {
      proof = await execute(process.execPath, ['--import', artifactRequire.resolve('tsx'), runtimeProof, verified.root, directory, join(run, 'result-descriptor.json'), input.repository], {
        cwd: verified.root, env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: directory, TMPDIR: directory, TSX_DISABLE_CACHE: '1' }, timeout: 15000, maxBuffer: 65536,
      });
    } catch (error) { proofError = error; proof = { stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }; }
    await durableBytes(join(run, 'imports.stdout'), Buffer.from(proof.stdout));
    await durableBytes(join(run, 'imports.stderr'), Buffer.from(proof.stderr));
    report.importExit = proofError ? (proofError.code ?? 'UNKNOWN') : 0;
    if (proofError) throw proofError;
    report.runtimeProof = JSON.parse(proof.stdout);
    const names = await readdir(join(directory, 'backend-artifacts'));
    assert.ok(!names.includes('prepare.lock') && !names.some(name => name.startsWith('stage-') && !name.endsWith('.json')));
    assert.equal(report.buildRecord?.path !== undefined, true);
    report.phase = 'artifact-and-imports-passed';
  } catch (error) { report.failures.push({ phase: report.phase, ...code(error) }); report.phase = 'failed-or-unknown'; process.exitCode = 1; }
  finally {
    if (monitor) clearInterval(monitor);
    if (sampling) await sampling;
    try { await copyBuildRecord(); } catch (error) { report.failures.push({ phase: 'record-persistence', ...code(error) }); report.phase = 'failed-or-unknown'; process.exitCode = 1; }
    try { await sample(); } catch (error) { report.failures.push({ phase: 'final-space', ...code(error) }); report.phase = 'failed-or-unknown'; process.exitCode = 1; }
    try {
      if (report.reservation) {
        let rawBytes = report.buildRecord?.bytes ?? 0; // Include the retained original and its evidence copy.
        for (const name of await readdir(run)) rawBytes += (await lstat(join(run, name))).size;
        report.rawBytesBeforeFinalResult = rawBytes;
        assert.ok(rawBytes + 1024 * 1024 + 65536 <= input.resources.rawBytes, 'BACKEND_TOTAL_RAW_BUDGET');
      }
    } catch (error) { report.failures.push({ phase: 'final-raw', ...code(error) }); report.phase = 'failed-or-unknown'; process.exitCode = 1; }
    report.resources = { initialFree, minimumFree, samples, ...input.resources, physicalPeak: 'NOT_MEASURED; sampled filesystem availability includes other writers', rawLimit: '1MiB outer capture plus bounded copied build-record and import bytes; original producer record can exceed observation threshold and remains preserved on refusal' };
    report.finishedAt = new Date().toISOString(); report.elapsedMs = Math.round(performance.now() - startedMs);
    report.retention = 'KEEP own artifact/root and stage records for later host validation; interrupted/unknown stage or lock is not removed by this entry';
    // Never overwrite the first result. OPS14 deadline covers result fsync too.
    if (report.reservation) {
      try { await durable(join(run, 'result.json'), report); }
      catch (error) { report.failures.push({ phase: 'result-persistence', ...code(error) }); process.exitCode = 1; }
    }
    console.log(JSON.stringify(report));
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runFixedArtifact(await readFile(join(here, 'inputs.json')));
}
