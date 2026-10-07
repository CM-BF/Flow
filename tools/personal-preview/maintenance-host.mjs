import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { loadPreviewConfiguration, readPreviewJson, savePreviewJson, withPreviewLock, assertPreviewMarker, startPreviewServices, preparePreviewWeb } from './preview.mjs';
import { readRunnerSlots, slotServiceKeys } from './runner-slots.mjs';
import { inspectOwnedProcess, stopOwnedProcess } from './process.mjs';
import { migrateRunnerMaintenance, commandRunnerMaintenance, readRunnerMaintenance } from '../../apps/server/src/runner-maintenance/index.ts';

import { selectHeldPreviewWebHost } from './maintenance-target.mjs';
import { readWebRelease } from './web-release.mjs';
import { backendById, backendRuntime } from './backend-release/host.mjs';
import { pinnedBrowserSessionConfiguration } from './browser-session-configuration.mjs';

const execute = promisify(execFile);
function fail(code) { const error = new Error(code); error.code = code; throw error; }
async function processFacts(state, slots) {
  const result = {};
  const declared = slotServiceKeys(slots);
  for (const role of new Set([...declared, ...Object.keys(state.processes)])) result[role] = declared.includes(role) && state.processes[role] ? await inspectOwnedProcess(state.processes[role]) : 'unknown';
  return result;
}
async function verifiedIdentity(config, pool, slots) {
  await assertPreviewMarker(config);
  for (const slot of slots) {
    if (!slot.runner) fail('RUNNER_IDENTITY_UNAVAILABLE');
    const digest = createHash('sha256').update(slot.runner.token).digest('hex');
    if (!(await pool.query('SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [slot.runner.runnerId, digest])).rowCount) fail('RUNNER_IDENTITY_UNAVAILABLE');
  }
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
async function viewsFor(pool, slots) {
  const views = [];
  for (const slot of slots) views.push(await readRunnerMaintenance(pool, slot.runner.runnerId));
  return views;
}
function summary(slots, views) {
  if (slots.length === 1) return views[0];
  return { ...views[0], state: views.every(view => view.state === views[0].state) ? views[0].state : 'mixed', activeAttempts: views.reduce((n, view) => n + view.activeAttempts, 0),
    uncertainAttempts: views.reduce((n, view) => n + view.uncertainAttempts, 0),
    slots: slots.map((slot, index) => ({ slot: slot.id, runnerId: slot.runner.runnerId, ...views[index] })), actualClaim: 'unknown' };
}
function commandsFor(operation, slots) {
  if (slots.length === 1 && !operation.slots) return [operation];
  if (!operation.slots || operation.slots.length !== slots.length || operation.slots.some((value, index) => value.runnerId !== slots[index].runner.runnerId || value.configDigest !== (slots[index].configDigest ?? null))) fail('MAINTENANCE_SLOT_SET_CHANGED');
  return operation.slots;
}
async function drainSlots(config, pool, slots, views, operation) {
  const commands = commandsFor(operation, slots);
  for (let index = 0; index < slots.length; index++) {
    const view = views[index];
    if (view.state !== 'accepting') { assertOperation(operation, view); continue; }
    await commandRunnerMaintenance(pool, slots[index].runner.runnerId, 'drain', { version: commands[index].initialVersion, operationId: operation.operationId, reason: 'Operator requested a local preview update.' }, commands[index].drainKey, 'trusted-host');
  }
  return summary(slots, await viewsFor(pool, slots));
}
async function bootstrap(config, pool, state, target, backendId, slots) {
  const backendArtifact = backendId ? await backendById(config.directory, backendId) : state.backendArtifact ?? null;
  const browser = await pinnedBrowserSessionConfiguration(config);
  if (backendArtifact) {
    await backendRuntime(config, backendArtifact);
    if (!await readWebRelease(config.directory)) fail('BACKEND_REQUIRES_WEB_RELEASE');
  }
  if (backendArtifact || browser.context !== null || slots.length > 1) await preparePreviewWeb(config, backendArtifact?.sourceHead ?? (target || undefined), backendArtifact);
  const facts = await processFacts(state, slots);
  if (Object.values(facts).some(value => value !== 'running')) fail('EXISTING_PROCESSES_UNCONFIRMED');
  await migrateRunnerMaintenance(pool);
  const views = await viewsFor(pool, slots);
  let operation = await localOperation(config);
  if (views.some(view => view.state !== 'accepting') || operation?.phase === 'drain-requested') {
    if (!operation) fail('MAINTENANCE_OPERATION_UNCONFIRMED');
    if (backendArtifact && operation.backendArtifact?.artifactId !== backendArtifact.artifactId) fail('BACKEND_OPERATION_MISMATCH');
    return drainSlots(config, pool, slots, views, operation);
  }
  const commands = views.map((view, index) => ({ runnerId: slots[index].runner.runnerId, configDigest: slots[index].configDigest ?? null, initialVersion: view.version, drainKey: randomUUID(), holdKey: randomUUID(), resumeKey: randomUUID() }));
  operation = { operationId: randomUUID(), initialVersion: commands[0].initialVersion, drainKey: commands[0].drainKey, holdKey: commands[0].holdKey, resumeKey: commands[0].resumeKey, phase: 'drain-requested',
    ...(slots.length > 1 ? { slots: commands } : {}), ...(backendArtifact ? { backendArtifact, target: backendArtifact.sourceHead } : {}) };
  await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  return drainSlots(config, pool, slots, views, operation);
}
async function refresh(config, pool, state, target, _backendId, slots) {
  let views = await viewsFor(pool, slots);
  const operation = await localOperation(config);
  for (const view of views) assertOperation(operation, view);
  const commands = commandsFor(operation, slots);
  const confirmSource = async () => {
    if (operation.backendArtifact) { if (operation.backendArtifact.sourceHead !== target) fail('BACKEND_OPERATION_MISMATCH'); await backendRuntime(config, operation.backendArtifact); }
    else await currentSource(config, target);
  };
  await confirmSource();
  if (views.some(view => !['draining', 'maintenance'].includes(view.state))) fail('MAINTENANCE_HOLD_REQUIRED');
  if (views.some(view => view.activeAttempts > 0)) return { ...summary(slots, views), update: 'waiting-for-current-work' };
  for (let index = 0; index < slots.length; index++) {
    if (views[index].state !== 'draining') continue;
    await commandRunnerMaintenance(pool, slots[index].runner.runnerId, 'hold', { version: views[index].version, operationId: operation.operationId, reason: 'No active attempts; reserve the local update.' }, commands[index].holdKey, 'trusted-host');
  }
  views = await viewsFor(pool, slots);
  for (const view of views) assertOperation(operation, view);
  if (views.some(view => view.state !== 'maintenance' || view.activeAttempts !== 0)) fail('MAINTENANCE_HOLD_REQUIRED');
  const facts = await processFacts(state, slots);
  if (Object.values(facts).includes('unknown')) fail('EXISTING_PROCESSES_UNCONFIRMED');
  if (operation.phase === 'ready-paused' && operation.target === target && Object.values(facts).every(value => value === 'running')) return { ...summary(slots, views), update: 'ready-paused', source: target };
  if (operation.webHostTarget?.status === 'pending') await selectHeldPreviewWebHost(config, pool, state, operation);
  const artifact = await preparePreviewWeb(config, target, operation.backendArtifact);
  await confirmSource();
  for (const role of [...slotServiceKeys(slots)].reverse()) {
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
  return { ...summary(slots, await viewsFor(pool, slots)), update: 'ready-paused', source: target };
}
async function resume(config, pool, state, _target, _backendId, slots) {
  const views = await viewsFor(pool, slots);
  const operation = await localOperation(config);
  const resuming = ['resume-requested', 'resumed'].includes(operation?.phase);
  if (!operation || !['ready-paused', 'resume-requested', 'resumed'].includes(operation.phase)) fail('UPDATED_PROCESSES_NOT_CONFIRMED');
  const commands = commandsFor(operation, slots);
  for (let index = 0; index < views.length; index++) {
    const view = views[index];
    if (view.state === 'accepting' && resuming && view.version !== commands[index].resumeVersion + 1) fail('MAINTENANCE_OPERATION_UNCONFIRMED');
    if (view.state !== 'accepting' || !resuming) assertOperation(operation, view);
    if (!['maintenance', 'accepting'].includes(view.state)) fail('UPDATED_PROCESSES_NOT_CONFIRMED');
  }
  if (Object.values(await processFacts(state, slots)).some(value => value !== 'running')) fail('UPDATED_PROCESSES_NOT_CONFIRMED');
  if (operation.backendArtifact) await backendRuntime(config, operation.backendArtifact);
  else await currentSource(config, operation.target);
  if (!resuming) {
    commands.forEach((command, index) => { command.resumeVersion = views[index].version; });
    operation.phase = 'resume-requested'; await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  }
  // Replay the same persisted CAS/key after any partial ACK; never infer completion from PID/profile.
  for (let index = 0; index < slots.length; index++) {
    const command = commands[index];
    if (!Number.isSafeInteger(command.resumeVersion)) fail('MAINTENANCE_OPERATION_UNCONFIRMED');
    await commandRunnerMaintenance(pool, slots[index].runner.runnerId, 'resume', { version: command.resumeVersion, operationId: operation.operationId, reason: 'Operator explicitly resumed the verified local preview.' }, command.resumeKey, 'trusted-host');
  }
  operation.phase = 'resumed'; await savePreviewJson(join(config.directory, 'maintenance.json'), operation);
  return summary(slots, await viewsFor(pool, slots));
}
export async function maintainPreview({ directory, action, target, backendId }) {
  if (!['bootstrap', 'status', 'refresh', 'resume'].includes(action)) fail('MAINTENANCE_ACTION_REQUIRED');
  const config = await loadPreviewConfiguration(directory);
  return withPreviewLock(config, async () => {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 2, connectionTimeoutMillis: 1500, statement_timeout: 3000, application_name: 'flow-preview-maintenance' });
    try {
      const slots = await readRunnerSlots(config);
      await verifiedIdentity(config, pool, slots);
      const state = await readPreviewJson(join(config.directory, 'state.json'));
      const operation = { bootstrap, refresh, resume }[action];
      const view = operation ? await operation(config, pool, state, target, backendId, slots) : summary(slots, await viewsFor(pool, slots));
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
