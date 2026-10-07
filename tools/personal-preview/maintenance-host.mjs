import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { loadPreviewConfiguration, readPreviewJson, savePreviewJson, withPreviewLock, assertPreviewMarker, startPreviewServices, preparePreviewWeb } from './preview.mjs';
import { inspectOwnedProcess, stopOwnedProcess } from './process.mjs';
import { migrateRunnerMaintenance, commandRunnerMaintenance, readRunnerMaintenance } from '../../apps/server/src/runner-maintenance/index.ts';

import { selectHeldPreviewWebHost } from './maintenance-target.mjs';
import { readWebRelease } from './web-release.mjs';
import { backendById, backendRuntime } from './backend-release/host.mjs';
import { pinnedBrowserSessionConfiguration } from './browser-session-configuration.mjs';

const execute = promisify(execFile);
const roles = ['center', 'runner', 'web'];
function fail(code) { const error = new Error(code); error.code = code; throw error; }
async function processFacts(state) {
  const result = {};
  for (const role of roles) result[role] = state.processes[role] ? await inspectOwnedProcess(state.processes[role]) : 'unknown';
  return result;
}
async function verifiedIdentity(config, pool) {
  await assertPreviewMarker(config);
  if (!config.runner) fail('RUNNER_IDENTITY_UNAVAILABLE');
  const digest = createHash('sha256').update(config.runner.token).digest('hex');
  if (!(await pool.query('SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, digest])).rowCount) fail('RUNNER_IDENTITY_UNAVAILABLE');
}
async function currentSource(config, target) {
  if (!/^[a-f0-9]{40}$/.test(target ?? '')) fail('EXPLICIT_SOURCE_TARGET_REQUIRED');
  const head = (await execute('git', ['-C', config.repository, 'rev-parse', 'HEAD'], { timeout: 1500 })).stdout.trim();
  const dirty = (await execute('git', ['-C', config.repository, 'status', '--porcelain'], { timeout: 1500 })).stdout;
  if (head !== target || dirty) fail('SOURCE_TARGET_NOT_CLEAN');
  return head;
}
async function localOperation(config) {
  try { return await readPreviewJson(join(config.directory, 'maintenance.json')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function assertOperation(operation, view) {
  if (!operation || operation.operationId !== view.operationId) fail('MAINTENANCE_OPERATION_UNCONFIRMED');
}
async function bootstrap(config, pool, state, target, backendId) {
  const backendArtifact = backendId ? await backendById(config.directory, backendId) : state.backendArtifact ?? null;
  const browser = await pinnedBrowserSessionConfiguration(config);
  if (backendArtifact) {
    await backendRuntime(config, backendArtifact);
    if (!await readWebRelease(config.directory)) fail('BACKEND_REQUIRES_WEB_RELEASE');
  }
  // Qualification uses the actual selected Web host, including a separately installed host.
  // Invalid configuration or missing tuple evidence must not first be discovered after drain.
  if (backendArtifact || browser.context !== null) await preparePreviewWeb(config, backendArtifact?.sourceHead ?? (target || undefined), backendArtifact);
  const facts = await processFacts(state);
  if (Object.values(facts).some(value => value !== 'running')) fail('EXISTING_PROCESSES_UNCONFIRMED');
  await migrateRunnerMaintenance(pool);
  const view = await readRunnerMaintenance(pool, config.runner.runnerId);
  let operation = await localOperation(config);
  if (view.state !== 'accepting') { assertOperation(operation, view); if (backendArtifact && operation.backendArtifact?.artifactId !== backendArtifact.artifactId) fail('BACKEND_OPERATION_MISMATCH'); return view; }
  operation = { operationId: randomUUID(), initialVersion: view.version, drainKey: randomUUID(), holdKey: randomUUID(), resumeKey: randomUUID(), phase: 'drain-requested', ...(backendArtifact ? { backendArtifact, target: backendArtifact.sourceHead } : {}) };
  await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  await commandRunnerMaintenance(pool, config.runner.runnerId, 'drain', { version: view.version, operationId: operation.operationId, reason: 'Operator requested a local preview update.' }, operation.drainKey, 'trusted-host');
  return readRunnerMaintenance(pool, config.runner.runnerId);
}
async function refresh(config, pool, state, target) {
  let view = await readRunnerMaintenance(pool, config.runner.runnerId);
  const operation = await localOperation(config); assertOperation(operation, view);
  const confirmSource = async () => {
    if (operation.backendArtifact) { if (operation.backendArtifact.sourceHead !== target) fail('BACKEND_OPERATION_MISMATCH'); await backendRuntime(config, operation.backendArtifact); }
    else await currentSource(config, target);
  };
  await confirmSource();
  if (view.state === 'draining') {
    if (view.activeAttempts > 0) return { ...view, update: 'waiting-for-current-work' };
    await commandRunnerMaintenance(pool, config.runner.runnerId, 'hold', { version: view.version, operationId: operation.operationId, reason: 'No active attempts; reserve the local update.' }, operation.holdKey, 'trusted-host');
    view = await readRunnerMaintenance(pool, config.runner.runnerId);
  }
  if (view.state !== 'maintenance') fail('MAINTENANCE_HOLD_REQUIRED');
  const facts = await processFacts(state);
  if (Object.values(facts).includes('unknown')) fail('EXISTING_PROCESSES_UNCONFIRMED');
  if (operation.phase === 'ready-paused' && operation.target === target && Object.values(facts).every(value => value === 'running')) return { ...view, update: 'ready-paused', source: target };
  if (operation.webHostTarget?.status === 'pending') await selectHeldPreviewWebHost(config, pool, state, operation);
  const artifact = await preparePreviewWeb(config, target, operation.backendArtifact);
  await confirmSource();
  // The durable gate and HTTP denial of maintenance resume protect this interval.
  // No PG transaction spans shutdown or startup, which need database migrations themselves.
  for (const role of [...roles].reverse()) {
    const result = await stopOwnedProcess(state.processes[role]);
    if (result !== 'stopped') fail('STOP_UNCONFIRMED');
  }
  await confirmSource();
  operation.phase = 'starting'; operation.target = target;
  await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  if (operation.webHostTarget) { state.webHost.selection = 'starting'; await savePreviewJson(join(config.directory, 'state.json'), state); }
  await startPreviewServices(config, state, artifact, operation.backendArtifact);
  if (operation.webHostTarget) {
    state.webHost.selection = 'ready'; state.webHost.recordSha256 = createHash('sha256').update(JSON.stringify(state.processes.web)).digest('hex');
    await savePreviewJson(join(config.directory, 'state.json'), state);
  }
  await confirmSource();
  operation.phase = 'ready-paused';
  await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  return { ...await readRunnerMaintenance(pool, config.runner.runnerId), update: 'ready-paused', source: target };
}
async function resume(config, pool, state) {
  const view = await readRunnerMaintenance(pool, config.runner.runnerId);
  const operation = await localOperation(config);
  const resuming = ['resume-requested', 'resumed'].includes(operation?.phase);
  if (view.state !== 'accepting' || !resuming) assertOperation(operation, view);
  if (!operation || !['ready-paused', 'resume-requested', 'resumed'].includes(operation.phase) || !['maintenance', 'accepting'].includes(view.state)) fail('UPDATED_PROCESSES_NOT_CONFIRMED');
  if (Object.values(await processFacts(state)).some(value => value !== 'running')) fail('UPDATED_PROCESSES_NOT_CONFIRMED');
  if (operation.backendArtifact) await backendRuntime(config, operation.backendArtifact);
  else await currentSource(config, operation.target);
  if (!resuming) { operation.resumeVersion = view.version; operation.phase = 'resume-requested'; await savePreviewJson(join(config.directory, 'maintenance.json'), operation); }
  if (!Number.isSafeInteger(operation.resumeVersion)) fail('MAINTENANCE_OPERATION_UNCONFIRMED');
  await commandRunnerMaintenance(pool, config.runner.runnerId, 'resume', { version: operation.resumeVersion, operationId: operation.operationId, reason: 'Operator explicitly resumed the verified local preview.' }, operation.resumeKey, 'trusted-host');
  operation.phase = 'resumed'; await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  return readRunnerMaintenance(pool, config.runner.runnerId);
}
export async function maintainPreview({ directory, action, target, backendId }) {
  if (!['bootstrap', 'status', 'refresh', 'resume'].includes(action)) fail('MAINTENANCE_ACTION_REQUIRED');
  const config = await loadPreviewConfiguration(directory);
  return withPreviewLock(config, async () => {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 2, connectionTimeoutMillis: 1500, statement_timeout: 3000, application_name: 'flow-preview-maintenance' });
    try {
      await verifiedIdentity(config, pool);
      const state = await readPreviewJson(join(config.directory, 'state.json'));
      const operation = { bootstrap, refresh, resume }[action];
      const view = operation ? await operation(config, pool, state, target, backendId) : await readRunnerMaintenance(pool, config.runner.runnerId);
      return { ...view, provider: 'not-probed', display: view.state === 'accepting' ? '恢复接收' : view.activeAttempts ? '等待当前任务' : view.state === 'maintenance' ? '可更新' : '停止接新任务' };
    } finally { await pool.end(); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, directory, target, backendId] = process.argv.slice(2);
    process.stdout.write(`${JSON.stringify(await maintainPreview({ action, directory, target, backendId }))}\n`);
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'MAINTENANCE_UNCONFIRMED';
    process.stderr.write(`${JSON.stringify({ error: code, message: 'Maintenance outcome unconfirmed. Keep admission paused and inspect status; no task cancellation is implied.' })}\n`);
    process.exitCode = 1;
  }
}
