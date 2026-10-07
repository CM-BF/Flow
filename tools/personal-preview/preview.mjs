import { mkdir, lstat, realpath, readFile, writeFile, rename, rm, open, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
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
import { readRunnerInitialization, openStartupDiagnostics, observeStartupChild, preserveStartupFailure, publicStartupFailure, startupFailure, startupErrorCode } from './startup-diagnostics.mjs';
import { WEB_RETENTION_POLICY } from './web-retention-policy.mjs';
import { pinnedBrowserSessionConfiguration, browserSessionLaunchEnvironment, readBrowserSessionLaunch } from './browser-session-configuration.mjs';
import { prepareWebArtifact, verifyWebArtifact } from './web-artifact.mjs';

import { backendRuntime, assertInstallationSource, serviceRuntime, webHostArtifactDescriptor, createLaunchRuntimeResolver } from './backend-release/host.mjs';
import { prepareBackendArtifact } from './backend-release/index.mjs';
import { readWebRelease, currentWebArtifact, planWebRelease, commitWebRelease, findWebCompatibility, importWebCompatibility, loadReleaseAssets } from './web-release.mjs';

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
async function load(directory, serviceRole = null, launchRuntime = null) {
  const path = await directoryPath(directory);
  const config = await privateJson(join(path, 'config.json'));
  if (config.format !== 1 || config.directory !== path || typeof config.repository !== 'string'
    || !/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName) || !/^[a-f0-9-]{36}$/.test(config.installationId)) fail('CONFIGURATION_IDENTITY_MISMATCH');
  await assertInstallationSource(config, repository, serviceRole, launchRuntime);
  const url = new URL(config.databaseUrl);
  const admin = new URL(config.adminUrl);
  if (url.pathname !== `/${config.databaseName}` || !['postgres:', 'postgresql:'].includes(admin.protocol) || admin.hostname !== '127.0.0.1' || admin.pathname !== '/postgres'
    || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== admin.hostname || url.port !== admin.port
    || url.username !== admin.username || url.password !== admin.password) fail('DATABASE_IDENTITY_MISMATCH');
  for (const port of [config.centerPort, config.webPort]) if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail('INVALID_PORT');
  await pinnedBrowserSessionConfiguration(config);
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
async function webIdentity(config, artifact, releaseVersion, expectedBackendHead) {
  if (!artifact) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${config.webPort}/__flow_preview_identity`, { signal: AbortSignal.timeout(700) });
    if (!response.ok) return false;
    const actual = await response.json();
    const { context } = await pinnedBrowserSessionConfiguration(config);
    if (context !== null && (!/^[a-f0-9]{40}$/.test(expectedBackendHead ?? '')
      || actual.runtimeCompatibility?.backendHead !== expectedBackendHead
      || JSON.stringify(actual.runtimeCompatibility?.context) !== JSON.stringify(context))) return false;
    return actual.artifactId === artifact.artifactId && actual.sourceHead === artifact.sourceHead && actual.manifestDigest === artifact.manifestDigest && (releaseVersion === undefined || actual.releaseVersion === releaseVersion && actual.releasePolicy === 'flow-web-release-v1');
  } catch { return false; }
}
async function waitReady(config, role, record, artifact, expectedBackendHead) {
  const deadline = Date.now() + 10_000;
  do {
    if (await inspectOwnedProcess(record) !== 'running') fail('SERVICE_EXITED_DURING_START');
    if (role === 'runner') { if (await readRunnerInitialization({ directory: config.directory, recordKey: role, record, runnerId: config.runner?.runnerId }) && await configuredProfile(config)) return; }
    else if (await ownsListener(record, role === 'center' ? config.centerPort : config.webPort)
      && (role === 'center' ? await reachable(`http://127.0.0.1:${config.centerPort}/api/health`) : await webIdentity(config, artifact, (await readWebRelease(config.directory))?.version, expectedBackendHead))) return;
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
    const state = await privateJson(join(config.directory, 'state.json'));
    await assertWebHostSettled(config, state);
    await ensureDatabase(config); await assertMarker(config);
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
  let webArtifact = { state: 'unknown', reason: 'legacy-or-unconfirmed' };
  try {
    const release = await readWebRelease(config.directory);
    const artifact = release ? currentWebArtifact(release) : state.webArtifact;
    if (artifact) {
      await verifyWebArtifact({ directory: config.directory, artifact });
      const identityMatches = processes.web === 'running' && await ownsListener(state.processes.web, config.webPort) && await webIdentity(config, artifact, release?.version, state.source?.head);
      webArtifact = { ...artifact, ...(release ? { releaseVersion: release.version, retained: release.artifacts.length, validatedAgainstBackendHead: release.backendHead, publicationBackendHead: release.backendHead } : {}), state: 'verified', serving: identityMatches ? 'confirmed' : 'unknown' };
    }
  } catch { webArtifact = { state: 'unknown', reason: 'artifact-verification-failed' }; }
  return { installationId: config.installationId, webArtifact, observedAt: new Date().toISOString(), startedAt: state.startedAt ?? null, sourceAtStart: state.source ?? null, configured: NATIVE_CONFIGURATION.model, provider: 'not-probed', processes,
    center: { url: centerUrl, reachable: processes.center === 'running' && await ownsListener(state.processes.center, config.centerPort) && await reachable(`${centerUrl}/api/health`) }, webUrl: `http://127.0.0.1:${config.webPort}`, database: databaseState, work, lastError: state.lastError, startFailure: publicStartupFailure(state.lastStartFailure),
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
  if (!roles.includes(role)) fail('UNKNOWN_SERVICE');
  const launchRuntime = createLaunchRuntimeResolver();
  const config = await load(directory, role, launchRuntime);
  launchRuntime.seal();
  const nonce = process.argv.find(value => value.startsWith('--flow-preview='))?.slice('--flow-preview='.length);
  const deadline = Date.now() + 2000;
  let owned = false;
  do {
    const state = await privateJson(join(config.directory, 'state.json'));
    owned = Boolean(nonce && state.processes[role]?.nonce === nonce && state.processes[role]?.pid === process.pid);
    if (!owned) await sleep(20);
  } while (!owned && Date.now() < deadline);
  if (!owned) fail('SERVICE_NOT_OWNED');
  let diagnostic, phase = 'configuration-ready', child, stopping = false;
  const stop = () => { if (!stopping) { stopping = true; child?.kill('SIGTERM'); } };
  const stage = async next => { phase = next; await diagnostic.stage(next); };
  try {
    diagnostic = await openStartupDiagnostics({ directory: config.directory, role, nonce, pid: process.pid });
    await stage('marker'); await assertMarker(config);
    if (role === 'runner' && JSON.stringify(await privateJson(join(config.directory, 'claude.json'))) !== JSON.stringify(NATIVE_CONFIGURATION)) fail('NATIVE_CONFIGURATION_CHANGED');
    await stage('policy');
    const browser = await readBrowserSessionLaunch(config);
    const env = serviceEnvironment(role, config, process.env, browser.settings, process.env.FLOW_PREVIEW_WEB_BACKEND_HEAD ?? null);
    await stage('runtime');
    const runtime = await serviceRuntime(config, await privateJson(join(config.directory, 'state.json')), role, launchRuntime);
    let args; let cwd = runtime.root;
    if (role === 'center') args = ['--import', 'tsx', 'apps/server/src/main.ts'];
    else if (role === 'runner') args = ['--import', 'tsx', 'apps/runner/src/main.ts'];
    else {
      const state = await privateJson(join(config.directory, 'state.json'));
      const release = await readWebRelease(config.directory);
      const artifact = release ? currentWebArtifact(release) : state.webArtifact;
      await verifyWebArtifact({ directory: config.directory, artifact });
      cwd = config.directory;
      args = [fileURLToPath(new URL('./static-web.mjs', import.meta.url)), config.directory, runtime.root,
        String(config.webPort), String(config.centerPort), artifact.artifactId, artifact.sourceHead, artifact.manifestDigest];
    }
    await stage('child-spawn');
    child = spawn(process.execPath, args, { cwd, env, stdio: role === 'runner' ? ['ignore', 'ignore', 'pipe', 'ipc'] : ['ignore', 'ignore', 'pipe'] });
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    const result = await observeStartupChild(child, diagnostic, role === 'runner' ? { runnerId: config.runner.runnerId } : {});
    diagnostic = null;
    await save(join(config.directory, `${role}-exit.json`), { at: new Date().toISOString(), nonce, ...result });
    process.exitCode = result.code ?? (stopping ? 0 : 1);
  } catch (error) {
    // This path is before child spawn, or after its observed exit. Never abandon a running child for a logging failure.
    let diagnosticError;
    if (diagnostic) { try { await diagnostic.finish(null, error); } catch (secondary) { diagnosticError = startupErrorCode(secondary); } }
    try { await save(join(config.directory, `${role}-startup-failure.json`), { nonce, ...startupFailure(error, role, phase), ...(diagnosticError ? { diagnosticError } : {}) }); } catch { /* The primary error remains authoritative when evidence cannot be saved. */ }
    throw error;
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }

}

/** Trusted local maintenance reuses the same private validation and launch implementation. */
export { load as loadPreviewConfiguration, privateJson as readPreviewJson, save as savePreviewJson, locked as withPreviewLock, assertMarker as assertPreviewMarker };
export async function preparePreviewWeb(config, target, selectedBackend) {
  const browser = await pinnedBrowserSessionConfiguration(config);
  if (browser.context !== null) {
    const state = await privateJson(join(config.directory, 'state.json'));
    if (selectedBackend !== undefined) state.backendArtifact = selectedBackend;
    await assertWebHostPolicyRuntime(config, state);
  }
  const head = target ?? selectedBackend?.sourceHead ?? (await execute('git', ['-C', config.repository, 'rev-parse', 'HEAD'], { timeout: 1000 })).stdout.trim();
  const release = await readWebRelease(config.directory);
  if (release) {
    await assertReleaseCompatibility(head, release.artifacts, config);
    await loadReleaseAssets({ directory: config.directory, release, expectedBackendHead: head, expectedContext: browser.context });
    return currentWebArtifact(release);
  }
  if (browser.context !== null) fail('WEB_COMPATIBILITY_REQUIRED');
  return prepareWebArtifact({ directory: config.directory, repository: config.repository, target: head });
}
export async function startPreviewServices(config, state, preparedArtifact, selectedBackend = state.backendArtifact) {
  const browser = await pinnedBrowserSessionConfiguration(config);
  if (browser.context !== null) await assertWebHostPolicyRuntime(config, { ...state, backendArtifact: selectedBackend });
  await assertWebHostSettled(config, state);
  const runtime = await backendRuntime(config, selectedBackend);
  const webRuntime = await serviceRuntime(config, { ...state, backendArtifact: selectedBackend }, 'web');
  const backendHead = selectedBackend?.sourceHead ?? (await execute('git', ['-C', config.repository, 'rev-parse', 'HEAD'], { timeout: 1000 })).stdout.trim();
  const artifact = preparedArtifact ?? await preparePreviewWeb(config, backendHead, selectedBackend);
  const release = await readWebRelease(config.directory);
  if (release) {
    await assertReleaseCompatibility(backendHead, release.artifacts, config);
    await loadReleaseAssets({ directory: config.directory, release, expectedBackendHead: backendHead, expectedContext: (await pinnedBrowserSessionConfiguration(config)).context });
  } else if ((await pinnedBrowserSessionConfiguration(config)).context !== null) fail('WEB_COMPATIBILITY_REQUIRED');
  await verifyWebArtifact({ directory: config.directory, artifact });
  state.webArtifact = artifact;
  if (selectedBackend) state.backendArtifact = selectedBackend;
  state.processes = {}; state.lastError = null; state.lastStartFailure = null; state.startCleanup = []; state.startEvidenceErrors = [];
  let startingRole = null, startingPhase = 'spawn';
  try {
    for (const role of roles) {
      startingRole = role; startingPhase = 'spawn';
      if (role === 'runner') {
        if (!config.runner) { config.runner = await api(config, '/api/runners', { name: 'Personal preview', harnesses: ['claude'], capacity: 1 }); await save(join(config.directory, 'config.json'), config); }
        await database(config, async pool => {
          const tokenHash = createHash('sha256').update(config.runner.token).digest('hex');
          if (!(await pool.query('SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, tokenHash])).rowCount) fail('RUNNER_IDENTITY_UNAVAILABLE');
        });
      }
      const roleRuntime = role === 'web' ? webRuntime : runtime;
      const record = await spawnOwnedProcess({ args: [roleRuntime.entry, 'internal-service', config.directory, role], cwd: roleRuntime.root, env: await launchEnvironment(role, config, backendHead),
        onSpawn: async pending => { state.processes[role] = pending; await save(join(config.directory, 'state.json'), state); } });
      state.processes[role] = record; await save(join(config.directory, 'state.json'), state);
      startingPhase = 'ready';
      await waitReady(config, role, record, artifact, backendHead);
    }
    startingPhase = 'final-verification';
    if (selectedBackend) await backendRuntime(config, selectedBackend);
    else {
    const revision = await execute('git', ['-C', config.repository, 'rev-parse', 'HEAD'], { timeout: 1000 });
    const changes = await execute('git', ['-C', config.repository, 'status', '--porcelain'], { timeout: 1000 });
    if (revision.stdout.trim() !== backendHead || changes.stdout.length > 0) fail('SOURCE_CHANGED_DURING_START');
    }
    state.source = { head: backendHead, dirty: false };
    state.startedAt = new Date().toISOString(); await save(join(config.directory, 'state.json'), state);
    return statusPreview({ directory: config.directory });
  } catch (error) {
    await preserveStartupFailure({ state, error, role: startingRole, phase: startingPhase, stop: stopOwnedProcess,
      save: value => save(join(config.directory, 'state.json'), value) });
    fail('START_UNCONFIRMED_CHECK_STATUS');
  }
}


async function assertReleaseCompatibility(backendHead, artifacts, config) {
  const { directory } = config;
  const { context: expectedContext } = await pinnedBrowserSessionConfiguration(config);
  for (const artifact of artifacts) {
    await verifyWebArtifact({ directory, artifact });
    await findWebCompatibility({ directory, artifact, backendHead, expectedContext });
  }
}
async function assertWebBackend(config, state, expectedBackendHead, processes = webHostProcesses) {
  if (!/^[a-f0-9]{40}$/.test(expectedBackendHead ?? '') || state.source?.dirty !== false || state.source.head !== expectedBackendHead) fail('WEB_BACKEND_SOURCE_MISMATCH');
  for (const role of ['center', 'runner']) if (await processes.inspect(state.processes[role]) !== 'running') fail('WEB_BACKEND_IDENTITY_UNCONFIRMED');
  if (!await processes.ownsListener(state.processes.center, config.centerPort)) fail('WEB_BACKEND_IDENTITY_UNCONFIRMED');
}
async function launchEnvironment(role, config, backendHead) {
  const browser = await pinnedBrowserSessionConfiguration(config);
  if (role === 'web' && browser.context !== null && !/^[a-f0-9]{40}$/.test(backendHead ?? '')) fail('WEB_BACKEND_SOURCE_MISMATCH');
  return { ...baseServiceEnvironment(role), ...browserSessionLaunchEnvironment(browser),
    ...(role === 'web' && browser.context !== null ? { FLOW_PREVIEW_WEB_BACKEND_HEAD: backendHead } : {}) };
}
async function launchWeb(config, state, artifact, processes = webHostProcesses, saveState = save, resolveRuntime = serviceRuntime) {
  const runtime = await resolveRuntime(config, state, 'web');
  const record = await processes.spawn({ args: [runtime.entry, 'internal-service', config.directory, 'web'], cwd: runtime.root, env: await launchEnvironment('web', config, state.source?.dirty === false ? state.source.head : null),
    onSpawn: async pending => { state.processes.web = pending; await saveState(join(config.directory, 'state.json'), state); } });
  state.processes.web = record; await saveState(join(config.directory, 'state.json'), state);
  await processes.ready(config, 'web', record, artifact, state.source?.head);
}
const webHostProcesses = Object.freeze({ inspect: inspectOwnedProcess, ownsListener, stop: stopOwnedProcess, spawn: spawnOwnedProcess, ready: waitReady });
const webHostFiles = Object.freeze(['cli.mjs', 'preview.mjs', 'static-web.mjs', 'process.mjs', 'startup-diagnostics.mjs', 'environment.mjs', 'browser-session-configuration.mjs', 'web-retention-policy.mjs', 'web-artifact.mjs', 'web-release.mjs', 'backend-release/host.mjs']);
const maintenanceHostFiles = Object.freeze([...webHostFiles, 'maintenance-host.mjs']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
async function boundedHostBytes(path, maximum = 65_536) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > maximum) fail('WEB_HOST_FILE_INVALID');
    const bytes = Buffer.alloc(maximum + 1); let length = 0;
    while (length < bytes.length) {
      const read = await file.read(bytes, length, bytes.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    const after = await file.stat();
    if (length > maximum || length !== before.size || before.ino !== after.ino || before.dev !== after.dev
      || before.size !== after.size || before.mtimeMs !== after.mtimeMs) fail('WEB_HOST_FILE_CHANGED');
    return bytes.subarray(0, length);
  } finally { await file.close(); }
}
async function hostSource(config, state, resolveRuntime = serviceRuntime) {
  const runtime = await resolveRuntime(config, state, 'web');
  const files = await runtimeToolFiles(runtime.root, webHostFiles);
  const location = { kind: runtime.artifact ? 'backend-artifact' : 'legacy-repository', artifactId: runtime.artifact?.artifactId ?? null };
  return { policy: 'flow.web-host-source.v1', location, digest: sha256(JSON.stringify({ location, files })), files };
}
async function runtimeToolFiles(root, paths) {
  const files = [];
  for (const path of paths) {
    const bytes = await boundedHostBytes(join(root, 'tools/personal-preview', path));
    files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return files;
}
async function assertPolicyTools(files) {
  for (const item of files) {
    const expected = await boundedHostBytes(join(repository, 'tools/personal-preview', item.path));
    if (expected.length !== item.bytes || sha256(expected) !== item.sha256) fail('WEB_HOST_POLICY_UNSUPPORTED');
  }
}
/** Exact reviewed implementation qualification, not a version or self-reported capability. */
async function assertWebHostPolicyRuntime(config, state, runtime = serviceRuntime) {
  try {
    const selected = await hostSource(config, state, runtime);
    await assertPolicyTools(selected.files);
    return selected;
  } catch { fail('WEB_HOST_POLICY_UNSUPPORTED'); }
}
/** Qualify the selected maintenance program before CLI spawn can reach an older drain path. */
export async function assertPreviewMaintenanceRuntime(config, runtime) {
  const browser = await pinnedBrowserSessionConfiguration(config);
  const release = await readWebRelease(config.directory);
  if (browser.context === null && (!release || release.artifacts.length < WEB_RETENTION_POLICY.artifacts)) return;
  try { await assertPolicyTools(await runtimeToolFiles(runtime.root, maintenanceHostFiles)); }
  catch { fail('MAINTENANCE_HOST_POLICY_UNSUPPORTED'); }
}
/** Local read only: no DB, process probe, or state creation. This is host-source identity, not artifact identity. */
export async function inspectPreviewWebHostSource({ directory, webHostArtifact }) {
  const config = await load(directory);
  const state = await privateJson(join(directory, 'state.json'));
  if (webHostArtifact !== undefined) state.pendingWebHost = { artifact: webHostArtifactDescriptor(webHostArtifact) };
  return hostSource(config, state);
}
async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function webHostJournalDirectory(directory, create = true) {
  const root = join(directory, 'web-host-operations');
  if (create) {
    try { await mkdir(root, { mode: 0o700 }); await syncDirectory(directory); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  let info;
  try { info = await lstat(root); } catch (error) { if (!create && error.code === 'ENOENT') return null; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o700) fail('WEB_HOST_JOURNAL_INVALID');
  return root;
}
async function checkpointWebHost(path, record, initial = false, maximum = 16_384) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
  if (bytes.length > maximum) fail('WEB_HOST_JOURNAL_BUDGET');
  const destination = initial ? path : `${path}.${randomUUID()}.tmp`;
  const file = await open(destination, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  if (!initial) await rename(destination, path);
  await syncDirectory(dirname(path)); // A failed write/sync is retained, never treated as permission to stop/start.
}
function webHostRequest(input) {
  const keys = ['directory', 'operationId', 'expectedVersion', 'expectedBackendHead', 'compatibilityId', 'expectedWebRecordSha256', 'expectedPointerSha256', 'expectedHostSourceDigest', 'allowConnectionInterruption'];
  if (input && Object.hasOwn(input, 'webHostArtifact')) keys.push('webHostArtifact');
  if (!input || Object.keys(input).sort().join() !== keys.sort().join()
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.operationId ?? '')
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1
    || !/^[a-f0-9]{40}$/.test(input.expectedBackendHead ?? '') || input.allowConnectionInterruption !== true
    || ['compatibilityId', 'expectedWebRecordSha256', 'expectedPointerSha256', 'expectedHostSourceDigest'].some(key => !/^[a-f0-9]{64}$/.test(input[key] ?? ''))) fail('WEB_HOST_REQUEST_INVALID');
  return Object.fromEntries(keys.filter(key => key !== 'directory').map(key => [key, key === 'webHostArtifact' ? webHostArtifactDescriptor(input[key]) : input[key]]));
}
async function protectedWebHostFiles(directory) {
  const result = {};
  for (const name of ['config.json', 'claude.json', 'maintenance.json', 'web-release.json']) {
    try { result[name] = sha256(await boundedHostBytes(join(directory, name))); }
    catch (error) { if (error.code !== 'ENOENT' || ['config.json', 'web-release.json'].includes(name)) throw error; result[name] = null; }
  }
  return result;
}
function protectedWebHostState(state) {
  const { webHost, pendingWebHost, processes, ...rest } = state;
  const { web, ...background } = processes;
  return JSON.stringify({ ...rest, processes: background });
}
async function saveWebHostState(path, state) { await checkpointWebHost(path, state, false, 65_536); }
async function readWebHostJournal(path) {
  const info = await lstat(path);
  if (info.size > 16_384) fail('WEB_HOST_JOURNAL_INVALID');
  const value = await privateJson(path);
  if (value.format !== 1 || value.policy !== 'flow.web-host-operation.v1'
    || !['pending', 'ready', 'unknown'].includes(value.outcome) || typeof value.request !== 'object'
    || value.requestDigest !== sha256(JSON.stringify(value.request)) || !['reserved', 'stopped', 'ready'].includes(value.phase)
    || basename(path) !== `${value.request.operationId}.json`
    || value.outcome === 'ready' && (value.phase !== 'ready' || !/^[a-f0-9]{64}$/.test(value.newWebRecordSha256 ?? ''))) fail('WEB_HOST_JOURNAL_INVALID');
  try { if (JSON.stringify(webHostRequest({ ...value.request, directory: dirname(path) })) !== JSON.stringify(value.request)) fail('WEB_HOST_JOURNAL_INVALID'); }
  catch { fail('WEB_HOST_JOURNAL_INVALID'); }
  return value;
}
async function assertWebHostOperationsSettled(root, reserveNext = false) {
  if (!root) return;
  const names = await readdir(root);
  if (names.length > 32 || reserveNext && names.length === 32) fail('WEB_HOST_JOURNAL_BUDGET');
  for (const name of names) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name) || (await readWebHostJournal(join(root, name))).outcome !== 'ready') fail('WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED');
  }
}
/** Trusted construction seam: only the production singleton is reachable from the strict local CLI. */
export function createWebHostReplacement({ marker = assertMarker, processes = webHostProcesses, checkpoint = checkpointWebHost, runtime = serviceRuntime } = {}) {
  return async function replace(input) {
    const request = webHostRequest(input); const requestDigest = sha256(JSON.stringify(request));
    const config = await load(input.directory);
    return locked(config, async () => {
      await marker(config);
      const statePath = join(config.directory, 'state.json'); const state = await privateJson(statePath);
      await assertWebBackend(config, state, request.expectedBackendHead, processes);
      const root = await webHostJournalDirectory(config.directory); const path = join(root, `${request.operationId}.json`);
      let previous;
      try { previous = await readWebHostJournal(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (previous) {
        if (previous.requestDigest !== requestDigest) fail('WEB_HOST_OPERATION_CONFLICT');
        let observed = 'unknown';
        if (!state.pendingWebHost && previous.outcome === 'ready' && previous.newWebRecordSha256 === sha256(JSON.stringify(state.processes.web))
          && state.webHost?.operationId === request.operationId && state.webHost.source.digest === request.expectedHostSourceDigest
          && sha256(await boundedHostBytes(join(config.directory, 'web-release.json'))) === request.expectedPointerSha256) {
          try { await processes.ready(config, 'web', state.processes.web, currentWebArtifact(await readWebRelease(config.directory)), request.expectedBackendHead); observed = 'ready'; } catch { /* Observation cannot restart or erase an earlier outcome. */ }
        }
        return { action: 'replace-host', operationId: request.operationId, outcome: observed, recordedOutcome: previous.outcome, replayed: true, hostSourceDigest: request.expectedHostSourceDigest };
      }
      await assertWebHostOperationsSettled(root, true);
      if (state.pendingWebHost) fail('WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED');
      const release = await readWebRelease(config.directory);
      if (!release || release.version !== request.expectedVersion) fail('WEB_RELEASE_VERSION_CONFLICT');
      const artifact = currentWebArtifact(release);
      const protectedFiles = await protectedWebHostFiles(config.directory);
      if (protectedFiles['web-release.json'] !== request.expectedPointerSha256) fail('WEB_HOST_POINTER_CHANGED');
      if (sha256(JSON.stringify(state.processes.web)) !== request.expectedWebRecordSha256) fail('WEB_HOST_RECORD_CHANGED');
      const browser = await pinnedBrowserSessionConfiguration(config);
      if (browser.context === null && release.backendHead !== request.expectedBackendHead) fail('WEB_BACKEND_SOURCE_MISMATCH');
      if (release.compatibilityIds[artifact.artifactId] !== request.compatibilityId) fail('WEB_COMPATIBILITY_INVALID');
      await loadReleaseAssets({ directory: config.directory, release, expectedBackendHead: request.expectedBackendHead, expectedContext: browser.context });
      const selectedState = request.webHostArtifact ? { ...state, pendingWebHost: { artifact: request.webHostArtifact } } : state;
      if (browser.context !== null) await assertWebHostPolicyRuntime(config, selectedState, runtime);
      const source = await hostSource(config, selectedState, runtime);
      if (source.digest !== request.expectedHostSourceDigest) fail('WEB_HOST_SOURCE_CHANGED');
      const processState = await processes.inspect(state.processes.web);
      if (!['running', 'stopped'].includes(processState)) fail('WEB_PROCESS_IDENTITY_UNCONFIRMED');
      const protectedState = protectedWebHostState(state);
      const record = { format: 1, policy: 'flow.web-host-operation.v1', request, requestDigest, outcome: 'pending', phase: 'reserved', at: new Date().toISOString() };
      await checkpoint(path, record, true); // Durable operation identity precedes the first signal, including failed/unknown requests.
      try {
        state.pendingWebHost = { operationId: request.operationId, artifact: request.webHostArtifact ?? state.webHost?.artifact ?? state.backendArtifact ?? null, source };
        await saveWebHostState(statePath, state);
        if (processState === 'running' && await processes.stop(state.processes.web) !== 'stopped') fail('WEB_STOP_UNCONFIRMED');
        record.phase = 'stopped'; await checkpoint(path, record);
        await launchWeb(config, state, artifact, processes, saveWebHostState, runtime);
        await assertWebBackend(config, state, request.expectedBackendHead, processes);
        if ((await hostSource(config, state, runtime)).digest !== source.digest) fail('WEB_HOST_SOURCE_CHANGED');
        if (JSON.stringify(await protectedWebHostFiles(config.directory)) !== JSON.stringify(protectedFiles)
          || protectedWebHostState(await privateJson(statePath)) !== protectedState) fail('WEB_HOST_PROTECTED_STATE_CHANGED');
        state.webHost = { operationId: request.operationId, artifact: state.pendingWebHost.artifact, source, recordSha256: sha256(JSON.stringify(state.processes.web)) };
        delete state.pendingWebHost;
        await saveWebHostState(statePath, state);
        record.newWebRecordSha256 = state.webHost.recordSha256; record.outcome = 'ready'; record.phase = 'ready';
        await checkpoint(path, record);
        return { action: 'replace-host', operationId: request.operationId, outcome: 'ready', replayed: false, hostSourceDigest: source.digest };
      } catch (error) {
        record.outcome = 'unknown'; record.failure = /^WEB_[A-Z_]+$/.test(error.code ?? '') ? error.code : 'WEB_HOST_OPERATION_UNCONFIRMED';
        try { await checkpoint(path, record); } catch { /* Keep the last durable stage and pending process record; no cleanup or retry. */ }
        fail('WEB_HOST_REPLACEMENT_UNCONFIRMED');
      }
    });
  };
}
export const replacePreviewWebHost = createWebHostReplacement();

async function assertWebHostSettled(config, state) {
  if (state.pendingWebHost) fail('WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED');
  await assertWebHostOperationsSettled(await webHostJournalDirectory(config.directory, false));
}
async function settledWebMutationState(config) {
  const state = await privateJson(join(config.directory, 'state.json'));
  await assertWebHostSettled(config, state);
  await assertMarker(config);
  return state;
}
/** One-time Web-only host replacement. Backend roles and their running work are never stopped. */
export async function bootstrapPreviewWeb({ directory, expectedVersion, expectedBackendHead, compatibilityId }) {
  const config = await load(directory);
  return locked(config, async () => {
    const state = await settledWebMutationState(config);
    await assertWebBackend(config, state, expectedBackendHead);
    const previous = await readWebRelease(directory);
    if (expectedVersion !== (previous?.version ?? 0)) fail('WEB_RELEASE_VERSION_CONFLICT');
    if ((await pinnedBrowserSessionConfiguration(config)).context !== null) await assertWebHostPolicyRuntime(config, state);
    const artifact = previous ? currentWebArtifact(previous) : state.webArtifact;
    await assertReleaseCompatibility(expectedBackendHead, previous?.artifacts ?? [artifact], config);
    const release = previous ?? await planWebRelease({ directory, artifact, action: 'bootstrap', expectedVersion, backendHead: expectedBackendHead, compatibilityId, expectedContext: (await pinnedBrowserSessionConfiguration(config)).context });
    await loadReleaseAssets({ directory, release, expectedBackendHead: expectedBackendHead, expectedContext: (await pinnedBrowserSessionConfiguration(config)).context });
    const processState = await inspectOwnedProcess(state.processes.web);
    if (processState === 'unknown') fail('WEB_PROCESS_IDENTITY_UNCONFIRMED');
    if (previous && processState === 'running' && await ownsListener(state.processes.web, config.webPort) && await webIdentity(config, artifact, release.version, expectedBackendHead)) return { action: 'bootstrap', release, web: 'ready', alreadyReady: true };
    // All artifact, compatibility and identity checks finish before changing the pointer or owned Web process.
    if (!previous) await commitWebRelease(directory, release);
    try {
      if (processState === 'running' && await stopOwnedProcess(state.processes.web) !== 'stopped') fail('WEB_STOP_UNCONFIRMED');
      await launchWeb(config, state, artifact);
      await assertWebBackend(config, state, expectedBackendHead);
      state.webReleaseOperation = { action: 'bootstrap', version: release.version, at: new Date().toISOString(), outcome: 'ready' };
      await save(join(directory, 'state.json'), state);
      return { action: 'bootstrap', release, web: 'ready' };
    } catch {
      state.webReleaseOperation = { action: 'bootstrap', version: release.version, at: new Date().toISOString(), outcome: 'unknown' };
      await save(join(directory, 'state.json'), state); fail('WEB_BOOTSTRAP_UNCONFIRMED');
    }
  });
}
async function changePreviewWeb({ directory, artifact, expectedVersion, expectedBackendHead, compatibilityId }, action) {
  const config = await load(directory);
  return locked(config, async () => {
    const state = await settledWebMutationState(config);
    await assertWebBackend(config, state, expectedBackendHead);
    const previous = await readWebRelease(directory);
    if (!previous) fail('WEB_RELEASE_BOOTSTRAP_REQUIRED');
    if ((await pinnedBrowserSessionConfiguration(config)).context !== null || previous.artifacts.length >= WEB_RETENTION_POLICY.artifacts - 1) await assertWebHostPolicyRuntime(config, state);
    if (!await ownsListener(state.processes.web, config.webPort) || !await webIdentity(config, currentWebArtifact(previous), previous.version, expectedBackendHead)) fail('WEB_RELEASE_HOST_UNCONFIRMED');
    await assertReleaseCompatibility(expectedBackendHead, [...previous.artifacts, artifact], config);
    const release = await planWebRelease({ directory, artifact, expectedVersion, action, backendHead: expectedBackendHead, compatibilityId, expectedContext: (await pinnedBrowserSessionConfiguration(config)).context });
    await assertWebBackend(config, state, expectedBackendHead);
    await commitWebRelease(directory, release);
    const ready = await webIdentity(config, artifact, release.version, expectedBackendHead);
    state.webReleaseOperation = { action, version: release.version, at: new Date().toISOString(), outcome: ready ? 'ready' : 'unknown' };
    await save(join(directory, 'state.json'), state);
    if (!ready) fail('WEB_RELEASE_COMMITTED_UNCONFIRMED');
    return { action, release, web: 'ready' };
  });
}
export function publishPreviewWeb(options) { return changePreviewWeb(options, 'publish'); }
export function rollbackPreviewWeb(options) { return changePreviewWeb(options, 'rollback'); }

export async function preparePreviewRelease({ directory, target, releaseId }) {
  if (!/^[a-f0-9]{32}$/.test(releaseId ?? '')) fail('WEB_RELEASE_NAMESPACE_INVALID');
  const config = await load(directory);
  return locked(config, async () => {
    const release = await readWebRelease(directory);
    if ((await pinnedBrowserSessionConfiguration(config)).context !== null || release?.artifacts.length >= WEB_RETENTION_POLICY.artifacts - 1) {
      await assertWebHostPolicyRuntime(config, await privateJson(join(directory, 'state.json')));
    }
    return prepareWebArtifact({ directory, repository: config.repository, target, releaseId });
  });
}
export async function importPreviewCompatibility({ directory, reportDirectory }) {
  const config = await load(directory);
  return locked(config, async () => ({ compatibilityId: await importWebCompatibility({ directory, reportDirectory }) }));
}

/** Preparation is explicit and cannot change running services or the maintenance gate. */
export async function preparePreviewBackend({ directory, target, offlineStore, pnpmCli }) {
  const config = await load(directory);
  return locked(config, () => prepareBackendArtifact({ repository: config.repository, target, directory, offlineStore, pnpmCli }));
}
