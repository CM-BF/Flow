import { mkdir, lstat, realpath, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createServer as createSocket } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { spawnOwnedProcess, inspectOwnedProcess, stopOwnedProcess, ownsListener } from './process.mjs';
import { baseServiceEnvironment, serviceEnvironment } from './environment.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const roles = ['center', 'runner', 'web'];
const execute = promisify(execFile);
const NATIVE_CONFIGURATION = Object.freeze({ model: 'claude-sonnet-5-5', materialFiles: Object.freeze([]), allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60_000 });
function fail(code) { const error = new Error(code); error.code = code; throw error; }
async function outsideGit(path) {
  try { await execute('git', ['-C', path, 'rev-parse', '--show-toplevel'], { env: { ...process.env, LC_ALL: 'C' }, timeout: 1000 }); }
  catch (error) {
    if (error.code === 128 && error.stderr?.includes('not a git repository')) return;
    fail('STATE_LOCATION_UNCONFIRMED');
  }
  fail('STATE_MUST_BE_OUTSIDE_SOURCE');
}
async function privateJson(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600 || info.uid !== process.getuid() || info.size > 65_536) fail('PRIVATE_FILE_REQUIRED');
  return JSON.parse(await readFile(path, 'utf8'));
}
async function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: 'wx' }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
async function directoryPath(input) {
  if (!isAbsolute(input)) fail('ABSOLUTE_PRIVATE_DIRECTORY_REQUIRED');
  const path = resolve(input);
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700 || info.uid !== process.getuid()) fail('PRIVATE_DIRECTORY_REQUIRED');
  const actual = await realpath(path);
  await outsideGit(actual);
  return actual;
}
async function load(directory) {
  const path = await directoryPath(directory);
  const config = await privateJson(join(path, 'config.json'));
  if (config.format !== 1 || config.directory !== path || config.repository !== await realpath(repository)
    || !/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName) || !/^[a-f0-9-]{36}$/.test(config.installationId)) fail('CONFIGURATION_IDENTITY_MISMATCH');
  const url = new URL(config.databaseUrl);
  const admin = new URL(config.adminUrl);
  if (url.pathname !== `/${config.databaseName}` || !['postgres:', 'postgresql:'].includes(admin.protocol) || admin.hostname !== '127.0.0.1' || admin.pathname !== '/postgres'
    || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== admin.hostname || url.port !== admin.port
    || url.username !== admin.username || url.password !== admin.password) fail('DATABASE_IDENTITY_MISMATCH');
  for (const port of [config.centerPort, config.webPort]) if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail('INVALID_PORT');
  return config;
}
async function database(config, callback, admin = false) {
  const pool = new Pool({ connectionString: admin ? config.adminUrl : config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, application_name: 'flow-personal-preview' });
  try { return await callback(pool); } finally { await pool.end(); }
}
async function assertMarker(config) {
  await database(config, async pool => {
    const record = (await pool.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows;
    if (record.length !== 1 || record[0].installation_id !== config.installationId || record[0].directory !== config.directory) fail('DATABASE_NOT_OWNED');
  });
}
async function availablePort() {
  const socket = createSocket();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve)); return port;
}
async function initialize(directory, adminUrl) {
  if (!adminUrl || !isAbsolute(directory)) fail('INITIAL_ADMIN_URL_AND_PRIVATE_DIRECTORY_REQUIRED');
  const admin = new URL(adminUrl);
  if (!['postgres:', 'postgresql:'].includes(admin.protocol) || admin.hostname !== '127.0.0.1' || admin.pathname !== '/postgres') fail('LOCAL_POSTGRES_ADMIN_REQUIRED');
  const parent = await realpath(dirname(resolve(directory)));
  await outsideGit(parent);
  directory = join(parent, basename(resolve(directory)));
  await mkdir(directory, { mode: 0o700 }); // Existing directories are never adopted.
  const path = await directoryPath(directory);
  const databaseName = `flow_preview_${randomBytes(12).toString('hex')}`;
  const url = new URL(adminUrl); url.pathname = `/${databaseName}`;
  const config = { format: 1, installationId: randomUUID(), directory: path, repository: await realpath(repository), databaseName, databaseUrl: url.href, adminUrl,
    ownerToken: randomBytes(32).toString('base64url'), runner: null, centerPort: await availablePort(), webPort: await availablePort(), createdAt: new Date().toISOString() };
  await save(join(path, 'config.json'), config);
  await save(join(path, 'state.json'), { processes: {}, lastError: null });
  await mkdir(join(path, 'runner'), { mode: 0o700 });
  await save(join(path, 'claude.json'), NATIVE_CONFIGURATION);
  return config;
}
async function ensureDatabase(config) {
  await database(config, async pool => {
    const existing = (await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [config.databaseName])).rowCount;
    if (existing) { await assertMarker(config); return; }
    if (config.databaseCreated) fail('OWNED_DATABASE_MISSING');
    await pool.query(`CREATE DATABASE "${config.databaseName}"`);
    await database(config, async owned => {
      await owned.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
      await owned.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, config.directory]);
    });
  }, true);
  config.databaseCreated = true;
  await save(join(config.directory, 'config.json'), config);
}
async function workFacts(config) {
  return database(config, async pool => {
    if (!(await pool.query("SELECT to_regclass('flow.tasks') AS tasks")).rows[0].tasks) return { total: 0, pending: 0, lastTaskSucceededAt: null, lastHeartbeatAt: null };
    const tasks = (await pool.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE status NOT IN ('succeeded','failed','cancelled'))::int AS pending,max(updated_at) FILTER(WHERE status='succeeded') AS last_success FROM flow.tasks")).rows[0];
    const heartbeat = (await pool.query('SELECT max(last_heartbeat_at) AS last FROM flow.attempts WHERE runner_id=$1', [config.runner?.runnerId ?? null])).rows[0];
    return { total: tasks.total, pending: tasks.pending, lastTaskSucceededAt: tasks.last_success?.toISOString() ?? null, lastHeartbeatAt: heartbeat.last?.toISOString() ?? null };
  });
}
async function api(config, path, body) {
  const state = await privateJson(join(config.directory, 'state.json'));
  if (!state.processes.center || !await ownsListener(state.processes.center, config.centerPort)) fail('CENTER_IDENTITY_UNCONFIRMED');
  const response = await fetch(`http://127.0.0.1:${config.centerPort}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(2000) });
  if (!response.ok) fail('CENTER_REQUEST_REJECTED');
  return response.json();
}
async function configuredProfile(config) {
  if (!config.runner) return null;
  const page = await api(config, '/api/execution-profiles?limit=100');
  const profile = page.profiles.find(value => value.reference.runnerId === config.runner.runnerId);
  if (!profile) return null;
  const value = profile.configuration;
  if (value.model !== NATIVE_CONFIGURATION.model || value.thinking !== 'disabled' || value.permissionMode !== 'dontAsk' || value.access !== 'none'
    || value.limits.maxTurns !== 2 || value.limits.maxBudgetUsd !== 0.20 || value.limits.timeoutMs !== 60_000) fail('PROFILE_POLICY_MISMATCH');
  return { id: profile.reference.id, source: 'runner-configured', model: value.model };
}
async function reachable(url) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(700) }); await response.body?.cancel(); return response.ok; } catch { return false; }
}
async function waitReady(config, role, record) {
  const deadline = Date.now() + 10_000;
  do {
    if (await inspectOwnedProcess(record) !== 'running') fail('SERVICE_EXITED_DURING_START');
    if (role === 'runner') { if (await configuredProfile(config)) return; }
    else if (await ownsListener(record, role === 'center' ? config.centerPort : config.webPort)
      && await reachable(role === 'center' ? `http://127.0.0.1:${config.centerPort}/api/health` : `http://127.0.0.1:${config.webPort}/`)) return;
    await sleep(50);
  } while (Date.now() < deadline);
  fail('SERVICE_START_UNCONFIRMED');
}
async function locked(config, callback) {
  const lock = join(config.directory, 'operation.lock');
  try { await mkdir(lock, { mode: 0o700 }); } catch { fail('OPERATION_IN_PROGRESS_OR_UNCONFIRMED'); }
  try { return await callback(); } finally { await rm(lock, { recursive: true }); }
}
export async function startPreview({ directory, adminUrl, confirmPending = false }) {
  let config;
  try { await lstat(directory); config = await load(directory); }
  catch (error) { if (error.code !== 'ENOENT') throw error; config = await initialize(directory, adminUrl); }
  return locked(config, async () => {
    await ensureDatabase(config); await assertMarker(config);
    const state = await privateJson(join(config.directory, 'state.json'));
    const previous = await Promise.all(Object.values(state.processes).map(inspectOwnedProcess));
    if (previous.length === 3 && previous.every(value => value === 'running')) return statusPreview({ directory });
    if (previous.some(value => value !== 'stopped')) fail('STOP_OR_VERIFY_EXISTING_PROCESSES');
    if ((await workFacts(config)).pending > 0 && !confirmPending) fail('PENDING_WORK_REQUIRES_CONFIRMATION');
    if (JSON.stringify(await privateJson(join(config.directory, 'claude.json'))) !== JSON.stringify(NATIVE_CONFIGURATION)) fail('NATIVE_CONFIGURATION_CHANGED');
    return startPreviewServices(config, state);
  });
}
export async function statusPreview({ directory }) {
  const config = await load(directory);
  const state = await privateJson(join(config.directory, 'state.json'));
  const processes = {};
  const lastProcessExits = {};
  for (const role of roles) processes[role] = state.processes[role] ? await inspectOwnedProcess(state.processes[role]) : 'not-started';
  for (const role of roles) {
    try {
      const last = await privateJson(join(config.directory, `${role}-exit.json`));
      if (last.nonce === state.processes[role]?.nonce) lastProcessExits[role] = { at: last.at, code: last.code, signal: last.signal };
    } catch { /* Missing or untrusted exit facts remain absent. */ }
  }
  let work = null; let databaseState = 'unknown';
  try { await assertMarker(config); work = await workFacts(config); databaseState = 'owned'; } catch { /* No database details or secrets enter status. */ }
  const centerUrl = `http://127.0.0.1:${config.centerPort}`;
  let profile = null;
  try { profile = await configuredProfile(config); } catch { /* Configuration publication is not an online/provider guarantee. */ }
  return { installationId: config.installationId, observedAt: new Date().toISOString(), startedAt: state.startedAt ?? null, sourceAtStart: state.source ?? null, configured: NATIVE_CONFIGURATION.model, provider: 'not-probed', processes,
    center: { url: centerUrl, reachable: processes.center === 'running' && await ownsListener(state.processes.center, config.centerPort) && await reachable(`${centerUrl}/api/health`) }, webUrl: `http://127.0.0.1:${config.webPort}`, database: databaseState, work, lastError: state.lastError,
    profile, lastProcessExits, credentialsFile: join(config.directory, 'config.json'), limits: { maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60_000, scope: 'per-query-not-project-total' } };
}
export async function stopPreview({ directory }) {
  const config = await load(directory);
  return locked(config, async () => {
    const state = await privateJson(join(config.directory, 'state.json'));
    const processes = {};
    for (const role of [...roles].reverse()) processes[role] = state.processes[role] ? await stopOwnedProcess(state.processes[role]) : 'not-started';
    state.stoppedAt = new Date().toISOString(); state.lastError = Object.values(processes).includes('unknown') ? 'STOP_UNCONFIRMED' : null;
    await save(join(config.directory, 'state.json'), state);
    return { installationId: config.installationId, processes, databaseRetained: true, workOutcome: 'not-implied-by-process-stop' };
  });
}

/** Private child entry: credentials stay in its environment and never appear in arguments or output. */
export async function runService(directory, role) {
  const config = await load(directory);
  if (!roles.includes(role)) fail('UNKNOWN_SERVICE');
  const nonce = process.argv.find(value => value.startsWith('--flow-preview='))?.slice('--flow-preview='.length);
  const deadline = Date.now() + 2000;
  let owned = false;
  do {
    const state = await privateJson(join(config.directory, 'state.json'));
    owned = Boolean(nonce && state.processes[role]?.nonce === nonce && state.processes[role]?.pid === process.pid);
    if (!owned) await sleep(20);
  } while (!owned && Date.now() < deadline);
  if (!owned) fail('SERVICE_NOT_OWNED');
  await assertMarker(config);
  if (role === 'runner' && JSON.stringify(await privateJson(join(config.directory, 'claude.json'))) !== JSON.stringify(NATIVE_CONFIGURATION)) fail('NATIVE_CONFIGURATION_CHANGED');
  const env = serviceEnvironment(role, config);
  let args; let cwd = config.repository;
  if (role === 'center') {
    args = ['--import', 'tsx', 'apps/server/src/main.ts'];
  } else if (role === 'runner') {
    args = ['--import', 'tsx', 'apps/runner/src/main.ts'];
  } else {
    cwd = join(config.repository, 'apps/web'); args = ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(config.webPort), '--strictPort'];
  }
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'ignore' });
  let stopping = false;
  const stop = () => { if (!stopping) { stopping = true; child.kill('SIGTERM'); } };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  const result = await new Promise(resolve => { child.once('error', () => resolve({ code: null, signal: 'start-error' })); child.once('exit', (code, signal) => resolve({ code, signal })); });
  await save(join(config.directory, `${role}-exit.json`), { at: new Date().toISOString(), nonce, ...result });
  process.off('SIGTERM', stop); process.off('SIGINT', stop); process.exitCode = result.code ?? (stopping ? 0 : 1);
}

/** Trusted local maintenance reuses the same private validation and launch implementation. */
export { load as loadPreviewConfiguration, privateJson as readPreviewJson, save as savePreviewJson, locked as withPreviewLock, assertMarker as assertPreviewMarker };
export async function startPreviewServices(config, state) {
state.processes = {}; state.lastError = null;
    try {
      for (const role of roles) {
        if (role === 'runner') {
          if (!config.runner) { config.runner = await api(config, '/api/runners', { name: 'Personal preview', harnesses: ['claude'], capacity: 1 }); await save(join(config.directory, 'config.json'), config); }
          await database(config, async pool => {
            const tokenHash = createHash('sha256').update(config.runner.token).digest('hex');
            if (!(await pool.query('SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, tokenHash])).rowCount) fail('RUNNER_IDENTITY_UNAVAILABLE');
          });
        }
        const record = await spawnOwnedProcess({ args: [entry, 'internal-service', config.directory, role], cwd: config.repository, env: baseServiceEnvironment(role),
          onSpawn: async pending => { state.processes[role] = pending; await save(join(config.directory, 'state.json'), state); } });
        state.processes[role] = record; await save(join(config.directory, 'state.json'), state);
        await waitReady(config, role, record);
      }
      const revision = await execute('git', ['-C', config.repository, 'rev-parse', 'HEAD'], { timeout: 1000 });
      const changes = await execute('git', ['-C', config.repository, 'status', '--porcelain'], { timeout: 1000 });
      state.source = { head: revision.stdout.trim(), dirty: changes.stdout.length > 0 };
      state.startedAt = new Date().toISOString(); await save(join(config.directory, 'state.json'), state);
      return statusPreview({ directory: config.directory });
    } catch {
      state.lastError = 'START_UNCONFIRMED';
      for (const record of Object.values(state.processes).reverse()) await stopOwnedProcess(record);
      await save(join(config.directory, 'state.json'), state);
      fail('START_UNCONFIRMED_CHECK_STATUS');
    }
}
