// Fixed, zero-task host smoke. This file is copied into owned tmp before checkout reads are denied.
import assert from 'node:assert/strict';
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
// Bounded metadata observation of newly written private state; e5 bytes remain independently verified.
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
async function deniedReads() {
  const observations = [];
  for (const path of input.negativePaths) {
    let result = 'READ_ALLOWED', fd;
    try { fd = await open(path, 'r'); } catch (error) { result = error.code; } finally { await fd?.close(); }
    observations.push({ path, result }); assert.ok(['EPERM', 'EACCES'].includes(result), 'DEVELOPMENT_SOURCE_NOT_DENIED');
  }
  return observations;
}
async function launch() {
  await rootIdentity(); const free = await space(input.resources.freshBytes);
  const manifest = JSON.parse((await bytesAt(join(dirname(root), 'manifest.json'), input.manifestBytes, input.artifact.manifestDigest)).toString());
  assert.equal(manifest.sourceRepository, input.repository); assert.equal(manifest.node.executable, await realpath(process.execPath));
  await mkdir(run, { mode: 0o700 }); const st = await lstat(run);
  await durable(join(run, 'reservation.json'), { startedAt: new Date().toISOString(), inputSha256: hash(await readFile(join(here, 'inputs.json'))), free, dev: st.dev, ino: st.ino, artifact: input.artifact });
  await durable(join(run, 'inputs.json'), await readFile(join(here, 'inputs.json')));
  await durable(join(run, 'worker.mjs'), await readFile(fileURLToPath(import.meta.url)));
  const profile = '(version 1)\n(allow default)\n' + input.deniedRoots.map(path => `(deny file-read* (subpath ${JSON.stringify(path)}))`).join('\n') + '\n';
  await durable(join(run, 'profile.sb'), profile);
  await mkdir(join(run, 'home'), { mode: 0o700 }); await mkdir(join(run, 'tmp'), { mode: 0o700 });
  const admin = new URL(process.env.FLOW_SVC06_ADMIN_URL ?? '');
  assert.ok(['postgres:', 'postgresql:'].includes(admin.protocol) && admin.hostname === '127.0.0.1' && admin.pathname === '/postgres');
  const child = spawn('/usr/bin/sandbox-exec', ['-f', join(run, 'profile.sb'), process.execPath, '--import', req.resolve('tsx'), join(run, 'worker.mjs'), 'work'], {
    cwd: run, env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin`, HOME: join(run, 'home'), TMPDIR: join(run, 'tmp'), TSX_DISABLE_CACHE: '1', FLOW_SVC06_ADMIN_URL: admin.href }, stdio: 'inherit',
  }); // Same outer session; only production role wrappers are deliberately detached.
  process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', code => resolve(code ?? 1)); });
}
async function work() {
  const result = { startedAt: new Date().toISOString(), artifact: input.artifact, providerCalls: 0, tasksCreated: 0, checks: {}, phase: 'preflight' };
  let pool, monitor, sampling = null;
  try {
    result.checks.deniedReads = await deniedReads(); await rootIdentity(); result.freeBefore = await space();
    result.resourceSamples = [];
    async function sample() {
      const observation = { free: await space(), private: await ownBytes() };
      assert.ok(result.resourceSamples.length < 260, 'HOST_SAMPLE_COUNT'); result.resourceSamples.push(observation);
    }
    const trigger = () => { if (!sampling) sampling = sample().catch(error => { console.error(JSON.stringify({ resourceStop: errorFact(error) })); process.exit(75); }).finally(() => { sampling = null; }); };
    monitor = setInterval(trigger, 500); monitor.unref();
    const { verifyBackendArtifact } = await import(pathToFileURL(join(root, 'tools/personal-preview/backend-release/index.mjs')).href);
    const verified = await verifyBackendArtifact({ directory: input.directory, artifact: input.artifact }); assert.equal(verified.root, root);
    const { Pool } = req('pg');
    const databaseName = `flow_preview_${randomBytes(12).toString('hex')}`;
    const adminUrl = process.env.FLOW_SVC06_ADMIN_URL; const database = new URL(adminUrl); database.pathname = '/' + databaseName;
    const config = { format: 1, installationId: randomUUID(), directory: input.directory, repository: input.repository, databaseName, databaseUrl: database.href, adminUrl,
      ownerToken: randomBytes(32).toString('base64url'), runner: null, centerPort: await port(), webPort: await port(), createdAt: new Date().toISOString() };
    assert.notEqual(config.centerPort, config.webPort);
    await durable(join(input.directory, 'config.json'), config);
    await durable(join(input.directory, 'state.json'), { backendArtifact: input.artifact, source: { head: input.artifact.sourceHead, dirty: false }, webArtifact: input.web, processes: {}, lastError: null });
    await durable(join(input.directory, 'claude.json'), { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60000 });
    await mkdir(join(input.directory, 'runner'), { mode: 0o700 });
    result.databaseName = databaseName; result.ports = [config.centerPort, config.webPort]; result.installationId = config.installationId;
    await durable(join(run, 'work-checkpoint.json'), result);
    pool = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    assert.equal((await pool.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
    result.phase = 'create-database'; await durable(join(run, 'work-checkpoint.json'), result, true);
    await pool.query(`CREATE DATABASE "${databaseName}"`); await pool.end(); pool = null;
    pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    await pool.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
    await pool.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, config.directory]);
    await pool.end(); pool = null;
    const webAt = join(input.directory, 'web-artifacts', input.web.artifactId);
    await mkdir(join(input.directory, 'web-artifacts'), { mode: 0o700 }); await mkdir(webAt, { mode: 0o700 });
    await mkdir(join(webAt, 'dist'), { mode: 0o700 }); await mkdir(join(webAt, 'dist/assets'), { mode: 0o700 });
    const sourceWeb = join(input.webSourceDirectory, 'web-artifacts', input.web.artifactId);
    await durable(join(webAt, 'manifest.json'), await bytesAt(join(sourceWeb, 'manifest.json'), input.webManifestBytes, input.web.manifestDigest));
    for (const file of input.webManifest.files) {
      assert.ok(/^(?:index\.html|assets\/[A-Za-z0-9_.-]+)$/.test(file.path));
      await durable(join(webAt, 'dist', file.path), await bytesAt(join(sourceWeb, 'dist', file.path), file.bytes, file.sha256));
    }
    const { verifyWebArtifact } = await import(pathToFileURL(join(root, 'tools/personal-preview/web-artifact.mjs')).href);
    await verifyWebArtifact({ directory: input.directory, artifact: input.web });
    const processes = await import(pathToFileURL(join(root, 'tools/personal-preview/process.mjs')).href);
    const { baseServiceEnvironment } = await import(pathToFileURL(join(root, 'tools/personal-preview/environment.mjs')).href);
    const state = await json(join(input.directory, 'state.json'));
    async function request(path, body, web = false) {
      const response = await fetch(`http://127.0.0.1:${web ? config.webPort : config.centerPort}${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(1500) });
      assert.ok(response.ok); return response;
    }
    async function ready(role, record) {
      const deadline = performance.now() + 12000;
      while (performance.now() < deadline) {
        assert.equal(await processes.inspectOwnedProcess(record), 'running');
        try {
          if (role === 'runner') {
            const page = await (await request('/api/execution-profiles?limit=100')).json();
            if (page.profiles.some(p => p.reference.runnerId === config.runner.runnerId)) return;
          } else if (await processes.ownsListener(record, role === 'web' ? config.webPort : config.centerPort)) {
            const response = await request(role === 'web' ? '/__flow_preview_identity' : '/api/health', undefined, role === 'web');
            if (role === 'web') assert.deepEqual(await response.json(), input.web); else await response.body?.cancel();
            return;
          }
        } catch { /* Bounded start observation only; no command is replayed. */ }
        await new Promise(resolve => setTimeout(resolve, 75));
      }
      throw Object.assign(Error('Ready unknown'), { code: 'HOST_READY_UNKNOWN' });
    }
    for (const role of ['center', 'runner', 'web']) {
      if (role === 'runner') { config.runner = await (await request('/api/runners', { name: 'SVC06 isolated smoke', harnesses: ['claude'], capacity: 1 })).json(); await durable(join(input.directory, 'config.json'), config, true); }
      result.phase = `starting-${role}`; await durable(join(run, 'work-checkpoint.json'), result, true);
      await durable(join(run, `spawn-${role}-intent.json`), { role, installationId: config.installationId, artifact: input.artifact });
      const record = await processes.spawnOwnedProcess({ args: [join(root, 'tools/personal-preview/cli.mjs'), 'internal-service', input.directory, role], cwd: root, env: baseServiceEnvironment(role),
        onSpawn: async pending => { await durable(join(run, `spawn-${role}-pending.json`), pending); state.processes[role] = pending; await durable(join(input.directory, 'state.json'), state, true); } });
      await durable(join(run, `spawn-${role}.json`), record); state.processes[role] = record; await durable(join(input.directory, 'state.json'), state, true); await ready(role, record);
    }
    result.checks.roles = Object.fromEntries(await Promise.all(Object.entries(state.processes).map(async ([role, record]) => [role, { pid: record.pid, group: record.group, state: await processes.inspectOwnedProcess(record), artifactCommand: record.command.includes(root) }])));
    const html = await (await request('/', undefined, true)).arrayBuffer();
    assert.equal(hash(Buffer.from(html)), input.webManifest.files.find(f => f.path === 'index.html').sha256);
    await (await request('/api/health', undefined, true)).body?.cancel();
    result.checks.realWebIdentityStaticAndProxy = true;
    const delayed = await execute(process.execPath, ['--import', req.resolve('tsx'), '--input-type=module', '-e', `const x=await import(${JSON.stringify(pathToFileURL(join(root, 'apps/runner/src/runtime.ts')).href)});if(typeof x.runRunner!=='function')process.exitCode=1;`], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, TSX_DISABLE_CACHE: '1' }, timeout: 5000, maxBuffer: 4096 });
    assert.equal(delayed.stderr, ''); result.checks.delayedRuntimeImport = true;
    pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    result.checks.tasks = (await pool.query('SELECT count(*)::int AS count FROM flow.tasks')).rows[0].count; assert.equal(result.checks.tasks, 0);
    result.checks.migrations = (await pool.query('SELECT count(*)::int AS count FROM flow.migrations')).rows[0].count;
    result.checks.deniedReadsAfter = await deniedReads(); result.phase = 'host-smoke-passed';
  } catch (error) { result.failure = errorFact(error); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
  finally {
    clearInterval(monitor); if (sampling) await sampling; if (pool) { try { await pool.end(); } catch (error) { result.poolCloseError = errorFact(error); result.phase = 'failed-or-unknown'; process.exitCode = 1; } }
    try { result.freeAfter = await space(); result.privateAfter = await ownBytes(); } catch (error) { result.spaceError = errorFact(error); result.phase = 'failed-or-unknown'; process.exitCode = 1; }
    result.finishedAt = new Date().toISOString();
    await durable(join(run, 'work-result.json'), result); console.log(JSON.stringify(result));
  }
}
async function cleanup() {
  await rootIdentity();
  let reservation;
  try { reservation = await json(join(run, 'reservation.json')); } catch (error) { if (error.code === 'ENOENT') { console.log(JSON.stringify({ cleanup: 'no-owned-run-reservation' })); return; } throw error; }
  const identity = await lstat(run); assert.equal(identity.dev, reservation.dev); assert.equal(identity.ino, reservation.ino);
  const result = { startedAt: new Date().toISOString(), processes: {}, database: 'unknown', failures: [], artifactRetained: true, privateRunRetained: true };
  let pool;
  try {
    const config = await json(join(input.directory, 'config.json')), state = await json(join(input.directory, 'state.json'));
    assert.ok(/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName)); assert.equal(config.directory, input.directory); assert.equal(config.repository, input.repository);
    assert.deepEqual(state.backendArtifact, input.artifact);
    const origin = await json(join(run, 'work-checkpoint.json'));
    assert.equal(config.installationId, origin.installationId); assert.equal(config.databaseName, origin.databaseName);
    const { inspectOwnedProcess, stopOwnedProcess } = await import(pathToFileURL(join(root, 'tools/personal-preview/process.mjs')).href);
    for (const role of ['web', 'runner', 'center']) {
      let intent, record;
      try { intent = await json(join(run, `spawn-${role}-intent.json`)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!intent) { assert.equal(state.processes[role], undefined); result.processes[role] = 'not-started'; continue; }
      assert.equal(intent.installationId, config.installationId); assert.deepEqual(intent.artifact, input.artifact);
      try { record = await json(join(run, `spawn-${role}.json`)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; result.processes[role] = 'unknown'; continue; }
      const saved = state.processes[role];
      if (!saved || saved.nonce !== record.nonce || saved.pid !== record.pid || saved.group !== record.group) { result.processes[role] = 'unknown'; continue; }
      result.processes[role] = await stopOwnedProcess(record);
      if (result.processes[role] === 'stopped') assert.equal(await inspectOwnedProcess(record), 'stopped', `${role}_GROUP_UNKNOWN`);
    }
    assert.ok(Object.values(result.processes).every(s => ['stopped', 'not-started'].includes(s)));
    const { Pool } = req('pg');
    pool = new Pool({ connectionString: config.adminUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    const exists = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows;
    if (exists.length === 0) { result.database = 'absent-no-drop'; return; }
    assert.equal(exists.length, 1); result.databaseOid = exists[0].oid;
    const own = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
    try { const marker = (await own.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows; assert.deepEqual(marker, [{ installation_id: config.installationId, directory: config.directory }]); }
    finally { await own.end(); }
    const { observeConnections } = await import(pathToFileURL(join(root, 'apps/tui/src/task-controls/fixture-cleanup.ts')).href);
    result.connections = await observeConnections(async () => (await pool.query('SELECT pid,state FROM pg_stat_activity WHERE datname=$1 LIMIT 33', [config.databaseName])).rows);
    assert.equal(result.connections.state, 'empty', 'CONNECTIONS_UNKNOWN');
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
