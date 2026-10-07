// Fixed isolated migration/configuration journey; original lifecycle implementation remains in the artifact.
import assert from 'node:assert/strict';
import { requireAbsentWork } from '../b2b-host-policy/work-terminal.mjs';
import { observeStartup } from './startup-observer.mjs';
import { constants } from 'node:fs';
import { readFile, open, mkdir, lstat, realpath, rename, statfs, readdir } from 'node:fs/promises';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(await readFile(join(here, 'inputs.json'), 'utf8'));
const sourceRoot = join(input.sourceDirectory, 'backend-artifacts', input.artifact.artifactId, 'root');
const root = join(input.directory, 'backend-artifacts', input.artifact.artifactId, 'root');
const run = join(input.directory, input.runName);
const req = createRequire(join(root, 'package.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const errorFact = error => ({ name: error?.name ?? 'Unknown', code: /^[A-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'UNCONFIRMED' });
const execute = promisify(execFile);
async function bytesAt(path, size, digest) {
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await fd.stat(); assert.ok(s.isFile() && s.uid === process.getuid() && s.size === size);
    const b = Buffer.alloc(size + 1); let n = 0;
    while (n < b.length) { const r = await fd.read(b, n, b.length - n, null); if (!r.bytesRead) break; n += r.bytesRead; }
    assert.equal(n, size); assert.equal(hash(b.subarray(0, n)), digest); return b.subarray(0, n);
  } finally { await fd.close(); }
}
async function syncDir(path) { const f = await open(path, 'r'); try { await f.sync(); } finally { await f.close(); } }
async function durable(path, value, replace = false) {
  const destination = replace ? `${path}.${randomUUID()}.tmp` : path;
  const f = await open(destination, 'wx', 0o600);
  try { await f.writeFile(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
  if (replace) await rename(destination, path);
  await syncDir(dirname(path));
}
async function rootIdentity() {
  const s = await lstat(input.directory);
  assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid() && (s.mode & 0o777) === 0o700);
  assert.equal(s.dev, input.directoryIdentity.dev); assert.equal(s.ino, input.directoryIdentity.ino);
  assert.equal(await realpath(input.directory), input.directory);
}
async function space(minimum = input.resources.liveBytes) {
  const s = await statfs(input.directory); const available = Number(s.bavail) * Number(s.bsize);
  assert.ok(available >= minimum, 'HOST_FREE_SPACE_GATE'); return available;
}
// Bounded metadata observation; fixed diagnostics artifact bytes are independently verified.
async function ownBytes() {
  await rootIdentity(); const start = performance.now(); let seen = 0, missed = 0;
  async function walk(path) {
    const before = await lstat(path); assert.ok(before.isDirectory() && !before.isSymbolicLink());
    let total = 0;
    for (const name of await readdir(path)) {
      if (path === input.directory && name === 'backend-artifacts') continue;
      assert.ok(++seen <= 2048 && performance.now() - start < 250, 'HOST_SAMPLE_BOUND');
      const child = join(path, name); let st;
      try { st = await lstat(child); } catch (error) { if (error.code === 'ENOENT') { missed++; continue; } throw error; }
      assert.ok(!st.isSymbolicLink(), 'HOST_UNEXPECTED_LINK');
      if (st.isDirectory()) total += await walk(child);
      else { assert.ok(st.isFile()); total += st.size; }
      assert.ok(total <= input.resources.additionalBytes, 'HOST_PRIVATE_BYTE_LIMIT');
    }
    const after = await lstat(path); assert.ok(after.isDirectory() && !after.isSymbolicLink() && before.dev === after.dev && before.ino === after.ino);
    return total;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    missed = 0; const bytes = await walk(input.directory);
    if (!missed) return { bytes, attempts: attempt + 1, entriesAcrossAttempts: seen, atomicSnapshot: false };
  }
  throw Object.assign(Error('Sampling incomplete'), { code: 'HOST_SAMPLE_UNKNOWN' });
}
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function port() {
  const server = createServer(); await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value;
}
async function launch() {
  for (const item of input.fixedInputs) await bytesAt(item.path, item.bytes, item.sha256);
  for (const alias of input.legacyAliases) {
    const st = await lstat(alias.path); assert.equal(st.dev, alias.dev); assert.equal(st.ino, alias.ino); assert.equal(await realpath(alias.path), alias.realpath);
  }
  const source = await lstat(input.sourceDirectory);
  assert.equal(source.dev, input.sourceDirectoryIdentity.dev); assert.equal(source.ino, input.sourceDirectoryIdentity.ino);
  assert.ok(source.isDirectory() && !source.isSymbolicLink() && source.uid === process.getuid() && (source.mode & 0o777) === 0o700);
  const free = await statfs(input.sourceDirectory); assert.ok(Number(free.bavail) * Number(free.bsize) >= input.resources.freshBytes);
  await mkdir(input.directory, { mode: 0o700 }); const st = await lstat(input.directory); input.directoryIdentity = { dev: st.dev, ino: st.ino };
  await mkdir(run, { mode: 0o700 }); const runInfo = await lstat(run);
  await durable(join(run, 'reservation.json'), { startedAt: new Date().toISOString(), inputSha256: hash(await readFile(join(here, 'inputs.json'))), free: Number(free.bavail) * Number(free.bsize), dev: runInfo.dev, ino: runInfo.ino, directoryIdentity: input.directoryIdentity, artifact: input.artifact });
  await durable(join(run, 'inputs.json'), input);
  for (const name of ['entry.mjs', 'startup-observer.mjs', 'journey.mjs', 'work-terminal.mjs']) {
    let bytes = await readFile(input.methodSources[name] ?? join(here, name));
    if (name === 'entry.mjs') bytes = Buffer.from(bytes.toString().replace("from '../b2b-host-policy/work-terminal.mjs'", "from './work-terminal.mjs'"));
    await durable(join(run, name), bytes);
  }
  await mkdir(join(run, 'home'), { mode: 0o700 }); await mkdir(join(run, 'tmp'), { mode: 0o700 });
  await mkdir(join(input.directory, 'backend-artifacts'), { mode: 0o700 });
  const { verifyBackendArtifact } = await import(pathToFileURL(join(sourceRoot, 'tools/personal-preview/backend-release/index.mjs')).href);
  await verifyBackendArtifact({ directory: input.sourceDirectory, artifact: input.artifact });
  const copied = await execute(input.python, ['-B', input.cloneCaller.path, join(run, 'inputs.json')], { cwd: run, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, timeout: 60000, maxBuffer: 16384 });
  assert.equal(copied.stderr, ''); const copyResult = JSON.parse(copied.stdout);
  const afterClone = await statfs(input.directory); copyResult.volumeFreeBefore = Number(free.bavail) * Number(free.bsize); copyResult.volumeFreeAfter = Number(afterClone.bavail) * Number(afterClone.bsize);
  copyResult.volumeDeltaNotExclusiveAttribution = copyResult.volumeFreeAfter - copyResult.volumeFreeBefore;
  await durable(join(run, 'clone-result.json'), copyResult);
  assert.ok(copyResult.regularLogicalBytes <= input.artifactTotalLogicalBytes); await space();
  await verifyBackendArtifact({ directory: input.directory, artifact: input.artifact });
  await durable(join(run, 'clone-verified.json'), { artifact: input.artifact, verifiedByOriginalArtifactModule: true, rebuild: false, install: false });
  const admin = new URL(process.env.FLOW_SVC06_ADMIN_URL ?? '');
  assert.ok(['postgres:', 'postgresql:'].includes(admin.protocol) && admin.hostname === '127.0.0.1' && admin.pathname === '/postgres');
  // The work owner calls the unchanged artifact host. Detached roles retain original ownership records.
  const child = spawn(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(run, 'entry.mjs'), 'work'], {
    cwd: run, env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin`, HOME: join(run, 'home'), TMPDIR: join(run, 'tmp'), TSX_DISABLE_CACHE: '1', FLOW_SVC06_ADMIN_URL: admin.href }, stdio: 'inherit',
  });
  process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', code => resolve(code ?? 1)); });
}
async function startupObservation(stage) {
  try {
    const safety = await import(pathToFileURL(join(root, 'tools/personal-preview/startup-diagnostics.mjs')).href);
    const value = await observeStartup({ directory: input.directory, run, safety });
    await durable(join(run, `${stage}-startup-observation.json`), value);
    return value;
  } catch (error) { return { state: 'unknown', failure: errorFact(error) }; }
}
async function work() {
  let result = { startedAt: new Date().toISOString(), phase: 'work-entered' }, timer, pending, resourceFailure;
  const resources = { samples: 0, minimumFree: null, maximumPrivate: 0, nonAtomic: true };
  try {
    await rootIdentity();
    const sample = async () => {
      const value = { free: await space(), private: await ownBytes() }; resources.samples++;
      resources.minimumFree = Math.min(resources.minimumFree ?? value.free, value.free); resources.maximumPrivate = Math.max(resources.maximumPrivate, value.private.bytes); return value;
    };
    result.resourceBefore = await sample();
    timer = setInterval(() => {
      if (pending) return;
      pending = sample().catch(error => { resourceFailure = errorFact(error); console.error(JSON.stringify({ resourceStop: resourceFailure })); process.exit(75); }).finally(() => { pending = null; });
    }, 500); timer.unref();
    const { runJourney } = await import(pathToFileURL(join(here, 'journey.mjs')).href);
    const checkpoint = value => durable(join(run, 'work-checkpoint.json'), value, true);
    result = { ...result, ...await runJourney({ input, root, run, durable, json, port, bytesAt, errorFact, checkpoint }) };
    if (result.phase !== 'passed') process.exitCode = 1;
  } catch (error) { result.failure ??= errorFact(error); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
  finally {
    clearInterval(timer); if (pending) await pending;
    if (resourceFailure) result.resourceFailure = resourceFailure;
    try { result.resourceAfter = { free: await space(), private: await ownBytes() }; }
    catch (error) { result.resourceFailure = errorFact(error); process.exitCode = 1; }
    if (result.resourceAfter) { resources.samples++; resources.minimumFree = Math.min(resources.minimumFree ?? result.resourceAfter.free, result.resourceAfter.free); resources.maximumPrivate = Math.max(resources.maximumPrivate, result.resourceAfter.private.bytes); }
    result.startupObservation = await startupObservation('work');
    result.resources = resources; result.finishedAt = new Date().toISOString();
    await durable(join(run, 'work-result.json'), result); console.log(JSON.stringify(result));
  }
}
async function cleanup() {
  const reservationIdentity = await json(join(run, 'reservation.json')); input.directoryIdentity = reservationIdentity.directoryIdentity;
  await rootIdentity();
  const runtimeInput = await json(join(run, 'inputs.json')); assert.deepEqual(runtimeInput.directoryIdentity, input.directoryIdentity);
  let reservation;
  try { reservation = await json(join(run, 'reservation.json')); } catch (error) { if (error.code === 'ENOENT') { console.log(JSON.stringify({ cleanup: 'no-owned-run-reservation' })); return; } throw error; }
  const identity = await lstat(run); assert.equal(identity.dev, reservation.dev); assert.equal(identity.ino, reservation.ino);
  const result = { startedAt: new Date().toISOString(), processes: {}, database: 'unknown', failures: [], artifactRetained: true, privateRunRetained: true };
  let pool;
  try {
    const terminalRaw = process.env.FLOW_SVC06_WORK_TERMINAL ?? ''; assert.ok(Buffer.byteLength(terminalRaw) <= 8192);
    const terminal = JSON.parse(terminalRaw);
    assert.equal(terminal.inputSha256, reservation.inputSha256); assert.equal(terminal.directory, input.directory); assert.equal(terminal.runName, input.runName);
    await durable(join(run, 'work-terminal.json'), terminal);
    const config = await json(join(input.directory, 'config.json')), state = await json(join(input.directory, 'state.json'));
    assert.ok(/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName)); assert.equal(config.directory, input.directory); assert.equal(config.repository, input.repository);
    assert.deepEqual(state.backendArtifact, input.artifact);
    const origin = await json(join(run, 'work-checkpoint.json'));
    assert.equal(config.installationId, origin.installationId); assert.equal(config.databaseName, origin.databaseName);
    const { inspectOwnedProcess, stopOwnedProcess } = await import(pathToFileURL(join(root, 'tools/personal-preview/process.mjs')).href);
    const generations = [];
    for (const name of ['generation-1.json', 'generation-before-refresh.json', 'generation-2.json']) {
      try { generations.push(await json(join(run, name))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    generations.push(state.processes ?? {});
    const seen = new Set();
    for (const generation of generations.reverse()) for (const role of ['web', 'runner', 'center']) {
      const record = generation[role]; if (!record || seen.has(record.nonce)) continue;
      seen.add(record.nonce); assert.ok(seen.size <= 6 && record.nonce && record.pid === record.group);
      result.processes[record.nonce] = { role, pid: record.pid, group: record.group, state: await stopOwnedProcess(record) };
      if (result.processes[record.nonce].state === 'stopped') assert.equal(await inspectOwnedProcess(record), 'stopped');
    }
    assert.ok(Object.values(result.processes).every(value => value.state === 'stopped'));
    result.startupObservation = await startupObservation('cleanup');
    result.exitRecords = {};
    for (const role of ['web', 'runner', 'center']) {
      try {
        const value = await json(join(input.directory, `${role}-exit.json`));
        if (value.nonce === state.processes?.[role]?.nonce) result.exitRecords[role] = value;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const persistedTerminal = await json(join(run, 'work-terminal.json')); assert.deepEqual(persistedTerminal, terminal);
    requireAbsentWork(terminal, reservation, input);
    result.workWriterAbsent = true;
    const { Pool } = req('pg');
    pool = new Pool({ connectionString: config.adminUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    const exists = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows;
    if (exists.length === 0) { result.database = 'absent-no-drop'; return; }
    assert.equal(exists.length, 1); result.databaseOid = exists[0].oid; assert.equal(result.databaseOid, origin.databaseOid);
    const own = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    try { const marker = (await own.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows; assert.deepEqual(marker, [{ installation_id: config.installationId, directory: config.directory }]); }
    finally { await own.end(); }
    const { observeConnections } = await import(pathToFileURL(join(root, 'apps/tui/src/task-controls/fixture-cleanup.ts')).href);
    const deadline = performance.now() + 3000;
    result.connections = await observeConnections(async () => { const remaining = Math.floor(deadline - performance.now()); assert.ok(remaining > 0); return (await pool.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 LIMIT 33', values: [config.databaseName], query_timeout: Math.min(1500, remaining) })).rows; });
    assert.equal(result.connections.state, 'empty', 'CONNECTIONS_UNKNOWN'); assert.ok(performance.now() < deadline, 'LATE_CONNECTION_SAMPLE');
    result.database = 'owned-and-empty'; result.freeBeforeDrop = await space(); result.privateBeforeDrop = await ownBytes(); await durable(join(run, 'cleanup-checkpoint.json'), result);
    await pool.query(`DROP DATABASE "${config.databaseName}"`);
    result.remaining = (await pool.query('SELECT datname FROM pg_database WHERE datname=$1', [config.databaseName])).rows; assert.equal(result.remaining.length, 0);
    result.database = 'removed';
  } catch (error) { result.failures.push(errorFact(error)); process.exitCode = 1; }
  finally {
    if (pool) { try { await pool.end(); } catch (error) { result.failures.push(errorFact(error)); process.exitCode = 1; } }
    result.finishedAt = new Date().toISOString(); await durable(join(run, 'cleanup-result.json'), result); console.log(JSON.stringify(result));
  }
}
try {
  const mode = process.argv[2];
  if (mode === 'launch') await launch();
  else if (mode === 'work') await work();
  else if (mode === 'cleanup') await cleanup();
  else throw Object.assign(Error('Explicit mode required'), { code: 'HOST_MODE_REQUIRED' });
} catch (error) { console.error(JSON.stringify({ failure: errorFact(error) })); process.exitCode = 1; }
