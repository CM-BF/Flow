// One fixed artifact, one isolated Web role. No build, center, runner, provider or personal operation.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { readFile, open, mkdir, lstat, realpath, rename, statfs, readdir } from 'node:fs/promises';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
const here = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(await readFile(join(here, 'inputs.json'), 'utf8'));
const sourceRoot = join(input.sourceDirectory, 'backend-artifacts', input.artifact.artifactId, 'root');
const root = join(input.directory, 'backend-artifacts', input.artifact.artifactId, 'root');
const run = join(input.directory, input.runName);
const req = createRequire(join(root, 'package.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fact = error => ({ name: error?.name ?? 'Unknown', code: /^[A-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'UNCONFIRMED' });
const execute = promisify(execFile);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const moduleAt = path => import(pathToFileURL(join(root, path)).href);
async function bytesAt(path, size, digest) {
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await fd.stat(); assert.ok(s.isFile() && s.uid === process.getuid() && s.size === size);
    const bytes = Buffer.alloc(size + 1); let n = 0;
    while (n < bytes.length) { const r = await fd.read(bytes, n, bytes.length - n, null); if (!r.bytesRead) break; n += r.bytesRead; }
    assert.equal(n, size); assert.equal(hash(bytes.subarray(0, n)), digest); return bytes.subarray(0, n);
  } finally { await fd.close(); }
}
async function durable(path, value, replace = false) {
  const destination = replace ? `${path}.${randomUUID()}.tmp` : path;
  const f = await open(destination, 'wx', 0o600);
  try { await f.writeFile(Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
  if (replace) await rename(destination, path);
  const parent = await open(dirname(path), 'r'); try { await parent.sync(); } finally { await parent.close(); }
}
async function rootIdentity() {
  const s = await lstat(input.directory);
  assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid() && (s.mode & 0o777) === 0o700);
  assert.equal(s.dev, input.directoryIdentity.dev); assert.equal(s.ino, input.directoryIdentity.ino);
  assert.equal(await realpath(input.directory), input.directory);
}
async function space(path = input.directory, minimum = input.resources.liveBytes) {
  const s = await statfs(path), available = Number(s.bavail) * Number(s.bsize);
  assert.ok(available >= minimum, 'HOST_FREE_SPACE_GATE'); return available;
}
// Exclude the separately verified immutable artifact, not a sequential subtree subtraction.
async function ownBytes() {
  await rootIdentity(); const started = performance.now(); let entries = 0, missed = 0;
  async function walk(path) {
    const before = await lstat(path); assert.ok(before.isDirectory() && !before.isSymbolicLink());
    let total = 0;
    for (const name of await readdir(path)) {
      if (path === input.directory && name === 'backend-artifacts') continue;
      assert.ok(++entries <= 2048 && performance.now() - started < 250, 'HOST_SAMPLE_BOUND');
      const child = join(path, name); let s;
      try { s = await lstat(child); } catch (e) { if (e.code === 'ENOENT') { missed++; continue; } throw e; }
      assert.ok(!s.isSymbolicLink(), 'HOST_UNEXPECTED_LINK');
      if (s.isDirectory()) total += await walk(child); else { assert.ok(s.isFile()); total += s.size; }
      assert.ok(total <= input.resources.additionalBytes, 'HOST_PRIVATE_BYTE_LIMIT');
    }
    const after = await lstat(path); assert.ok(after.isDirectory() && !after.isSymbolicLink() && before.dev === after.dev && before.ino === after.ino);
    return total;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    missed = 0; const bytes = await walk(input.directory);
    if (!missed) return { bytes, attempts: attempt + 1, entries, atomicSnapshot: false };
  }
  throw Object.assign(Error(), { code: 'HOST_SAMPLE_UNKNOWN' });
}
async function availablePort() {
  const socket = createServer(); await new Promise((yes, no) => { socket.once('error', no); socket.listen(0, '127.0.0.1', yes); });
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}
function preserved(state) {
  const { web, ...otherProcesses } = state.processes;
  return { ...state, processes: otherProcesses };
}
async function fetchBytes(port, path, limit) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 200); const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; assert.ok(bytes <= limit, 'HTTP_BYTE_LIMIT'); chunks.push(Buffer.from(part.value)); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
async function copyArtifact() {
  const source = await lstat(input.sourceDirectory);
  assert.ok(source.isDirectory() && !source.isSymbolicLink() && source.uid === process.getuid() && (source.mode & 0o777) === 0o700);
  assert.equal(source.dev, input.sourceDirectoryIdentity.dev); assert.equal(source.ino, input.sourceDirectoryIdentity.ino);
  const originalManifest = join(input.sourceDirectory, 'backend-artifacts', input.artifact.artifactId, 'manifest.json');
  const ms = await lstat(originalManifest); assert.equal(ms.dev, input.artifactManifestIdentity.dev); assert.equal(ms.ino, input.artifactManifestIdentity.ino);
  await bytesAt(originalManifest, input.manifestBytes, input.artifact.manifestDigest);
  await bytesAt(input.cloneDriver.path, input.cloneDriver.bytes, input.cloneDriver.sha256);
  const { verifyBackendArtifact } = await import(pathToFileURL(join(sourceRoot, 'tools/personal-preview/backend-release/index.mjs')).href);
  await verifyBackendArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
  await mkdir(join(input.directory, 'backend-artifacts'), { mode: 0o700 });
  const copy = await execute(input.python, ['-B', input.cloneDriver.path, join(run, 'inputs.json')], {
    cwd: run, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, timeout: 60000, maxBuffer: 16384,
  });
  assert.equal(copy.stderr, ''); const result = JSON.parse(copy.stdout);
  assert.equal(result.regularLogicalBytes, input.artifactTotalLogicalBytes);
  result.freeAfter = await space(); result.physicalExclusiveBytes = null;
  await durable(join(run, 'clone-result.json'), result);
  const verified = await verifyBackendArtifact({ directory: input.directory, artifact: input.artifact });
  assert.equal(verified.root, root); assert.equal(verified.manifest.sourceRepository, input.repository);
}
async function work() {
  const result = { startedAt: new Date().toISOString(), artifact: input.artifact, providerCalls: 0, tasksCreated: 0, checks: {}, samples: [] };
  let pool, monitor, sampling = null;
  try {
    result.freeBefore = await space(input.sourceDirectory, input.resources.freshBytes);
    await mkdir(input.directory, { mode: 0o700 }); const st = await lstat(input.directory); input.directoryIdentity = { dev: st.dev, ino: st.ino };
    await mkdir(run, { mode: 0o700 }); const rs = await lstat(run);
    await durable(join(run, 'reservation.json'), { startedAt: result.startedAt, inputSha256: hash(await readFile(join(here, 'inputs.json'))), directoryIdentity: input.directoryIdentity, runIdentity: { dev: rs.dev, ino: rs.ino } });
    await durable(join(run, 'inputs.json'), input);
    const sample = async () => { assert.ok(result.samples.length < 260); result.samples.push({ free: await space(), private: await ownBytes() }); };
    monitor = setInterval(() => { if (!sampling) sampling = sample().catch(error => { console.error(JSON.stringify({ resourceStop: fact(error) })); process.exit(75); }).finally(() => { sampling = null; }); }, 500); monitor.unref();
    await copyArtifact();
    const admin = new URL(process.env.FLOW_SVC08_ADMIN_URL ?? '');
    assert.ok(['postgres:', 'postgresql:'].includes(admin.protocol) && admin.hostname === '127.0.0.1' && admin.pathname === '/postgres');
    const databaseName = `flow_preview_${randomBytes(12).toString('hex')}`, database = new URL(admin); database.pathname = '/' + databaseName;
    const config = { format: 1, installationId: randomUUID(), directory: input.directory, repository: input.repository, databaseName, databaseUrl: database.href, adminUrl: admin.href,
      ownerToken: randomBytes(32).toString('base64url'), runner: null, centerPort: await availablePort(), webPort: await availablePort(), createdAt: new Date().toISOString() };
    assert.notEqual(config.centerPort, config.webPort);
    const state = { source: { head: input.legacyBackendHead, dirty: false }, backendArtifact: null, webHost: { artifact: input.artifact }, webArtifact: input.web,
      processes: { center: { synthetic: 'not-running-center-preservation-sentinel' }, runner: { synthetic: 'not-running-runner-preservation-sentinel' } }, lastError: null };
    const baseline = { state: preserved(state) };
    await durable(join(input.directory, 'config.json'), config); await durable(join(input.directory, 'state.json'), state);
    baseline.configSha256 = hash(await readFile(join(input.directory, 'config.json'))); await durable(join(run, 'preservation.json'), baseline);
    result.databaseName = databaseName; result.installationId = config.installationId; result.ports = { web: config.webPort, unusedCenter: config.centerPort };
    await durable(join(run, 'database-intent.json'), { installationId: config.installationId, databaseName, directory: input.directory, beforeCreate: true });
    const { Pool } = req('pg'); const options = { max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 };
    pool = new Pool({ ...options, connectionString: admin.href });
    assert.equal((await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    result.databaseOid = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rows[0].oid;
    await durable(join(run, 'database-created.json'), { installationId: config.installationId, databaseName, oid: result.databaseOid });
    await pool.end(); pool = new Pool({ ...options, connectionString: database.href });
    await pool.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
    await pool.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, config.directory]);
    await pool.end(); pool = null;
    const webAt = join(input.directory, 'web-artifacts', input.web.artifactId), sourceWeb = join(input.webSourceDirectory, 'web-artifacts', input.web.artifactId);
    await mkdir(join(input.directory, 'web-artifacts'), { mode: 0o700 }); await mkdir(webAt, { mode: 0o700 });
    await mkdir(join(webAt, 'dist'), { mode: 0o700 }); await mkdir(join(webAt, 'dist/assets'), { mode: 0o700 });
    await durable(join(webAt, 'manifest.json'), await bytesAt(join(sourceWeb, 'manifest.json'), input.webManifestBytes, input.web.manifestDigest));
    for (const file of input.webManifest.files) { assert.match(file.path, /^(?:index\.html|assets\/[A-Za-z0-9_.-]+)$/); await durable(join(webAt, 'dist', file.path), await bytesAt(join(sourceWeb, 'dist', file.path), file.bytes, file.sha256)); }
    const { verifyWebArtifact } = await moduleAt('tools/personal-preview/web-artifact.mjs'); await verifyWebArtifact({ directory: input.directory, artifact: input.web });
    const { serviceRuntime } = await moduleAt('tools/personal-preview/backend-release/host.mjs');
    const runtime = await serviceRuntime(config, state, 'web'); assert.equal(runtime.root, root); assert.deepEqual(runtime.artifact, input.artifact);
    const processes = await moduleAt('tools/personal-preview/process.mjs');
    const { baseServiceEnvironment } = await moduleAt('tools/personal-preview/environment.mjs');
    await mkdir(join(run, 'home'), { mode: 0o700 }); await mkdir(join(run, 'tmp'), { mode: 0o700 });
    await durable(join(run, 'spawn-web-intent.json'), { installationId: config.installationId, artifact: input.artifact, entry: runtime.entry, cwd: runtime.root });
    const record = await processes.spawnOwnedProcess({ args: [runtime.entry, 'internal-service', input.directory, 'web'], cwd: runtime.root,
      env: { ...baseServiceEnvironment('web', { PATH: `${dirname(input.node)}:/usr/bin:/bin:/usr/sbin`, HOME: join(run, 'home'), TMPDIR: join(run, 'tmp') }), TSX_DISABLE_CACHE: '1' },
      onSpawn: async pending => { await durable(join(run, 'spawn-web-pending.json'), pending); state.processes.web = pending; await durable(join(input.directory, 'state.json'), state, true); },
    });
    await durable(join(run, 'spawn-web.json'), record); state.processes.web = record; await durable(join(input.directory, 'state.json'), state, true);
    const readyUntil = performance.now() + 10000;
    do { assert.equal(await processes.inspectOwnedProcess(record), 'running'); if (await processes.ownsListener(record, config.webPort)) break; await sleep(100); } while (performance.now() < readyUntil);
    assert.ok(await processes.ownsListener(record, config.webPort));
    assert.deepEqual(JSON.parse((await fetchBytes(config.webPort, '/__flow_preview_identity', 4096)).toString()), input.web);
    for (const file of [input.webManifest.files.find(f => f.path === 'index.html'), input.webManifest.files.find(f => f.path.startsWith('assets/'))]) {
      const bytes = await fetchBytes(config.webPort, file.path === 'index.html' ? '/' : '/' + file.path, file.bytes);
      assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256);
    }
    assert.deepEqual(preserved(await json(join(input.directory, 'state.json'))), baseline.state);
    assert.equal(hash(await readFile(join(input.directory, 'config.json'))), baseline.configSha256);
    result.checks = { actualWebCliAndVite: true, ownedListener: true, identity: true, indexAndAssetBytes: true, syntheticBackendAndRunnerStateUnchanged: true, configUnchanged: true, onlyMarkerDatabaseNoMigrations: true };
    result.web = { pid: record.pid, group: record.group, nonce: record.nonce }; result.phase = 'isolated-web-host-passed';
  } catch (error) { result.failure = fact(error); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
  finally {
    clearInterval(monitor); if (sampling) await sampling;
    if (pool) try { await pool.end(); } catch (e) { result.poolCloseError = fact(e); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
    try { result.freeAfter = await space(); result.privateAfter = await ownBytes(); } catch (e) { result.resourceError = fact(e); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
    result.finishedAt = new Date().toISOString(); await durable(join(run, 'work-result.json'), result); console.log(JSON.stringify(result));
  }
}
async function cleanup() {
  const recordedInput = await json(join(run, 'inputs.json')); input.directoryIdentity = recordedInput.directoryIdentity; await rootIdentity();
  const reservation = await json(join(run, 'reservation.json')), rs = await lstat(run);
  assert.equal(rs.dev, reservation.runIdentity.dev); assert.equal(rs.ino, reservation.runIdentity.ino);
  assert.equal(reservation.inputSha256, hash(await readFile(join(here, 'inputs.json'))));
  const result = { startedAt: new Date().toISOString(), web: 'unknown', database: 'unknown', failures: [], artifactAndPrivateRunRetained: true };
  let pool;
  try {
    const config = await json(join(input.directory, 'config.json')), state = await json(join(input.directory, 'state.json')), baseline = await json(join(run, 'preservation.json'));
    assert.equal(config.directory, input.directory); assert.equal(config.repository, input.repository); assert.match(config.databaseName, /^flow_preview_[a-f0-9]{24}$/);
    assert.equal(hash(await readFile(join(input.directory, 'config.json'))), baseline.configSha256); assert.deepEqual(preserved(state), baseline.state);
    const { stopOwnedProcess, inspectOwnedProcess } = await moduleAt('tools/personal-preview/process.mjs');
    let intent;
    try { intent = await json(join(run, 'spawn-web-intent.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (intent) {
      assert.equal(intent.installationId, config.installationId); assert.deepEqual(intent.artifact, input.artifact);
      const record = await json(join(run, 'spawn-web.json')); assert.deepEqual(state.processes.web, record);
      await durable(join(run, 'stop-web-intent.json'), { at: new Date().toISOString(), pid: record.pid, group: record.group, nonce: record.nonce });
      result.web = await stopOwnedProcess(record); assert.equal(result.web, 'stopped'); assert.equal(await inspectOwnedProcess(record), 'stopped');
      const exit = await json(join(input.directory, 'web-exit.json')); assert.equal(exit.nonce, record.nonce); result.webExit = exit;
    } else { assert.equal(state.processes.web, undefined); result.web = 'not-started'; }
    const dbIntent = await json(join(run, 'database-intent.json')), created = await json(join(run, 'database-created.json'));
    assert.equal(dbIntent.installationId, config.installationId); assert.equal(dbIntent.databaseName, config.databaseName);
    assert.equal(created.installationId, config.installationId); assert.equal(created.databaseName, config.databaseName);
    const { Pool } = req('pg'), options = { max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 };
    pool = new Pool({ ...options, connectionString: config.adminUrl });
    const existing = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows;
    assert.deepEqual(existing, [{ oid: created.oid }]); result.databaseOid = created.oid;
    const own = new Pool({ ...options, connectionString: config.databaseUrl });
    try { assert.deepEqual((await own.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows, [{ installation_id: config.installationId, directory: config.directory }]); }
    finally { await own.end(); }
    const { observeConnections } = await moduleAt('apps/tui/src/task-controls/fixture-cleanup.ts'); const until = performance.now() + 3000;
    result.connections = await observeConnections(async () => { const remaining = Math.floor(until - performance.now()); assert.ok(remaining > 0); return (await pool.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 LIMIT 33', values: [config.databaseName], query_timeout: Math.min(1500, remaining) })).rows; });
    assert.equal(result.connections.state, 'empty'); result.database = 'owned-and-empty';
    result.freeBeforeDrop = await space(); result.privateBeforeDrop = await ownBytes(); await durable(join(run, 'cleanup-checkpoint.json'), result);
    await pool.query(`DROP DATABASE "${config.databaseName}"`); result.remaining = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows;
    assert.deepEqual(result.remaining, []); result.database = 'removed';
    assert.equal(hash(await readFile(join(input.directory, 'config.json'))), baseline.configSha256);
    assert.deepEqual(preserved(await json(join(input.directory, 'state.json'))), baseline.state); result.preservation = true;
  } catch (e) { result.failures.push(fact(e)); process.exitCode = 1; }
  finally {
    if (pool) try { await pool.end(); } catch (e) { result.failures.push(fact(e)); process.exitCode = 1; }
    result.finishedAt = new Date().toISOString(); await durable(join(run, 'cleanup-result.json'), result); console.log(JSON.stringify(result));
  }
}
try {
  if (process.argv[2] === 'work') await work();
  else if (process.argv[2] === 'cleanup') await cleanup();
  else throw Object.assign(Error(), { code: 'EXPLICIT_MODE_REQUIRED' });
} catch (e) { console.error(JSON.stringify({ entryFailure: fact(e) })); process.exitCode = 1; }
