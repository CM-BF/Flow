import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { canonical, transaction } from '../../apps/server/src/database.ts';
import { readPreviewJson, withPreviewLock, assertPreviewMarker, inspectPreviewWebHostSource } from './preview.mjs';
import { backendRuntime, serviceRuntime, webHostArtifactDescriptor } from './backend-release/host.mjs';
import { saveJson } from './backend-release/files.mjs';
import { readWebRelease, findWebCompatibility, loadReleaseAssets } from './web-release.mjs';
import { pinnedBrowserSessionConfiguration } from './browser-session-configuration.mjs';
import { inspectOwnedProcess } from './process.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const roles = ['center', 'runner', 'web'];
const fingerprint = value => createHash('sha256').update(canonical(value)).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const codes = new Set(['MAINTENANCE_TARGET_INPUT', 'MAINTENANCE_TARGET_LOADER', 'MAINTENANCE_TARGET_CHANGED',
  'MAINTENANCE_TARGET_OPERATION', 'MAINTENANCE_TARGET_HOLD', 'MAINTENANCE_TARGET_BUSY', 'MAINTENANCE_TARGET_PROCESSES',
  'MAINTENANCE_TARGET_WEB', 'MAINTENANCE_TARGET_SELECTION', 'MAINTENANCE_TARGET_AUDIT_LIMIT', 'MAINTENANCE_TARGET_WRITE_UNCONFIRMED',
  'BACKEND_MANIFEST_MISMATCH', 'BACKEND_INSTALLATION_SOURCE_MISMATCH', 'WEB_COMPATIBILITY_REQUIRED',
  'WEB_COMPATIBILITY_INVALID', 'EIO', 'ENOSPC', 'EACCES', 'EPERM', 'EEXIST', 'ENOENT']);
function failure(phase, error) {
  let code = null;
  try { if (codes.has(error?.code) || /^[0-9A-Z]{5}$/.test(error?.code ?? '')) code = error.code; } catch { /* Unknown stays unknown. */ }
  return { phase, code };
}
function request(value) {
  const keys = ['directory', 'operationId', 'requestId', 'expectedVersion', 'expectedOperationDigest', 'expectedStateDigest',
    'expectedWebReleaseDigest', 'expectedBackendArtifact', 'expectedWebHostArtifact', 'targetArtifact'];
  if (!value || Object.keys(value).sort().join() !== keys.sort().join() || !isAbsolute(value.directory ?? '')
    || !uuid.test(value.operationId ?? '') || !uuid.test(value.requestId ?? '')
    || !Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1
    || !['expectedOperationDigest', 'expectedStateDigest', 'expectedWebReleaseDigest'].every(key => hash.test(value[key] ?? ''))) fail('MAINTENANCE_TARGET_INPUT');
  const expectedBackendArtifact = webHostArtifactDescriptor(value.expectedBackendArtifact);
  const targetArtifact = webHostArtifactDescriptor(value.targetArtifact);
  const expectedWebHostArtifact = value.expectedWebHostArtifact === null ? null : webHostArtifactDescriptor(value.expectedWebHostArtifact);
  if (targetArtifact.artifactId === expectedBackendArtifact.artifactId) fail('MAINTENANCE_TARGET_INPUT');
  return { ...value, expectedBackendArtifact, expectedWebHostArtifact, targetArtifact };
}
function same(actual, expected) { return canonical(actual ?? null) === canonical(expected ?? null); }

async function durableJson(directory, path, value) {
  if (Buffer.byteLength(JSON.stringify(value) + '\n') > 65536) fail('MAINTENANCE_TARGET_AUDIT_LIMIT');
  await saveJson(path, value); // Exclusive temp, file fsync and rename; a failed temp is retained.
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
  if (!same(await readPreviewJson(path), value)) fail('MAINTENANCE_TARGET_WRITE_UNCONFIRMED');
}
async function retainedWeb(config, release, target) {
  if (!release || !Array.isArray(release.artifacts) || !release.artifacts.length) fail('MAINTENANCE_TARGET_WEB');
  const { context } = await pinnedBrowserSessionConfiguration(config);
  // Always qualify every retained page against the NEW source, including legacy context=null.
  for (const artifact of release.artifacts) await findWebCompatibility({ directory: config.directory, artifact,
    backendHead: target.sourceHead, expectedContext: context });
  await loadReleaseAssets({ directory: config.directory, release, expectedBackendHead: target.sourceHead, expectedContext: context });
}
async function heldRunner(client, config, operationId, version) {
  await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='3s'; SET LOCAL idle_in_transaction_session_timeout='10s'");
  const row = (await client.query('SELECT id,token_hash,revoked,maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1 FOR UPDATE', [config.runner.runnerId])).rows[0];
  if (!row || row.id !== config.runner.runnerId || row.revoked || row.token_hash !== createHash('sha256').update(config.runner.token).digest('hex')
    || row.maintenance_state !== 'maintenance' || row.maintenance_version !== version
    || row.maintenance_operation_id !== operationId) fail('MAINTENANCE_TARGET_HOLD');
  const counts = (await client.query(`SELECT count(*)::int AS active,count(*) FILTER(WHERE t.status='uncertain')::int AS uncertain
    FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id WHERE a.runner_id=$1 AND a.completed_at IS NULL`, [config.runner.runnerId])).rows[0];
  if (counts?.active !== 0 || counts?.uncertain !== 0) fail('MAINTENANCE_TARGET_BUSY');
}
async function stopped(state) {
  if (!state.processes || Object.keys(state.processes).sort().join() !== [...roles].sort().join()) fail('MAINTENANCE_TARGET_PROCESSES');
  for (const role of roles) if (await inspectOwnedProcess(state.processes[role]) !== 'stopped') fail('MAINTENANCE_TARGET_PROCESSES');
}

/** Explicit trusted operator only. loadCurrentConfiguration is a fixed old installation's
 * public loader, wired by the reviewed operator; it is never supplied by request JSON.
 * No state/config rewrite, process start, maintenance transition or automatic retry occurs. */
export async function rebindHeldPreviewTarget(input, { loadCurrentConfiguration } = {}) {
  let phase = 'request', primary = null, writeAttempted = false, observedWritten = false;
  const cleanup = [];
  let result = null;
  try {
    input = request(input);
    if (typeof loadCurrentConfiguration !== 'function') fail('MAINTENANCE_TARGET_LOADER');
    phase = 'load-current-installation';
    const config = await loadCurrentConfiguration(input.directory);
    if (config.directory !== input.directory || !config.runner?.runnerId || !config.runner?.token) fail('MAINTENANCE_TARGET_LOADER');
    phase = 'preview-lock';
    await withPreviewLock(config, async () => {
      let pool;
      try {
        phase = 'identity'; await assertPreviewMarker(config);
        const operationPath = join(config.directory, 'maintenance.json');
        const readInputs = async () => ({ operation: await readPreviewJson(operationPath),
          state: await readPreviewJson(join(config.directory, 'state.json')), release: await readWebRelease(config.directory) });
        const original = await readInputs();
        const verifyInputs = ({ operation, state, release }) => {
          if (fingerprint(operation) !== input.expectedOperationDigest || fingerprint(state) !== input.expectedStateDigest
            || fingerprint(release) !== input.expectedWebReleaseDigest) fail('MAINTENANCE_TARGET_CHANGED');
          if (operation.operationId !== input.operationId || !['drain-requested', 'starting', 'ready-paused'].includes(operation.phase)
            || !same(operation.backendArtifact, input.expectedBackendArtifact) || operation.target !== input.expectedBackendArtifact.sourceHead
            || operation.slots !== undefined || operation.webHostTarget !== undefined
            || !same(state.backendArtifact, input.expectedBackendArtifact)) fail('MAINTENANCE_TARGET_OPERATION');
          if (state.pendingWebHost || !same(state.webHost?.artifact, input.expectedWebHostArtifact)
            || !release || !Array.isArray(release.artifacts) || !release.artifacts.length) fail('MAINTENANCE_TARGET_WEB');
          if (!state.processes || Object.keys(state.processes).sort().join() !== [...roles].sort().join()) fail('MAINTENANCE_TARGET_PROCESSES');
        };
        verifyInputs(original);
        // Verify the immutable target and each retained page before taking the DB row lock.
        // A missing release must never fall through to preparePreviewWeb's build path.
        phase = 'verify-target'; await backendRuntime(config, input.targetArtifact);
        phase = 'verify-old-web-host'; await serviceRuntime(config, original.state, 'web');
        phase = 'verify-new-web-host'; await serviceRuntime(config, { ...original.state, pendingWebHost: { artifact: input.targetArtifact } }, 'web');
        phase = 'verify-retained-web'; await retainedWeb(config, original.release, input.targetArtifact);
        phase = 'pool-open';
        pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500,
          statement_timeout: 3000, application_name: 'flow-preview-maintenance-target' });
        phase = 'runner-lock';
        result = await transaction(pool, async client => {
          await heldRunner(client, config, input.operationId, input.expectedVersion);
          phase = 'owned-stopped'; await stopped(original.state);
          phase = 'compare-before-write';
          const current = await readInputs(); verifyInputs(current);
          const history = current.operation.targetRebindings ?? [];
          if (!Array.isArray(history) || history.length >= 4 || history.some(item => item?.requestId === input.requestId)) fail('MAINTENANCE_TARGET_AUDIT_LIMIT');
          const audit = { requestId: input.requestId, operationId: input.operationId, version: input.expectedVersion,
            beforeDigest: input.expectedOperationDigest, before: { phase: current.operation.phase, target: current.operation.target, backendArtifact: current.operation.backendArtifact,
              webHost: current.state.webHost ?? null, processes: current.state.processes },
            after: { target: input.targetArtifact.sourceHead, backendArtifact: input.targetArtifact, webHostArtifact: input.targetArtifact },
            stateDigest: input.expectedStateDigest, webReleaseDigest: input.expectedWebReleaseDigest,
            webHostArtifact: input.expectedWebHostArtifact, recordedAt: new Date().toISOString() };
          const next = { ...current.operation, phase: 'target-bound', target: input.targetArtifact.sourceHead,
            backendArtifact: input.targetArtifact, webHostTarget: { policy: 'flow.held-web-target.v1', status: 'pending',
              requestId: input.requestId, expectedVersion: input.expectedVersion, artifact: input.targetArtifact,
              stateDigest: input.expectedStateDigest, webReleaseDigest: input.expectedWebReleaseDigest }, targetRebindings: [...history, audit] };
          if (Buffer.byteLength(JSON.stringify(next) + '\n') > 65536) fail('MAINTENANCE_TARGET_AUDIT_LIMIT');
          phase = 'operation-write'; writeAttempted = true;
          await durableJson(config.directory, operationPath, next);
          observedWritten = true; phase = 'transaction-close';
          return { operationId: input.operationId, requestId: input.requestId, version: input.expectedVersion,
            target: input.targetArtifact.sourceHead, artifactId: input.targetArtifact.artifactId, operationDigest: fingerprint(next) };
        });
      } catch (error) { primary ??= failure(phase, error); }
      finally {
        if (pool) try { await pool.end(); } catch (error) { cleanup.push(failure('pool-close', error)); }
      }
    });
  } catch (error) {
    if (primary || result) cleanup.push(failure('lock-release', error)); else primary = failure(phase, error);
  }
  return { outcome: primary || cleanup.length ? 'unconfirmed' : 'target-bound',
    mutation: observedWritten ? 'observed-written' : writeAttempted ? 'unknown' : 'not-written',
    primary, cleanup, result, maintenance: 'held-required', retry: 'not-authorized', actualClaim: 'unknown' };
}

/** Called only by refresh inside the existing preview lock. No start, hold CAS, or retry.
 * A partial two-file write leaves mismatched digests and must be separately reconciled. */
export async function selectHeldPreviewWebHost(config, pool, state, operation) {
  const intent = operation.webHostTarget;
  if (!intent || intent.policy !== 'flow.held-web-target.v1' || intent.status !== 'pending'
    || operation.phase !== 'target-bound' || operation.slots !== undefined || !uuid.test(intent.requestId ?? '')
    || !Number.isSafeInteger(intent.expectedVersion) || intent.expectedVersion < 1
    || !hash.test(intent.stateDigest ?? '') || !hash.test(intent.webReleaseDigest ?? '')
    || !same(webHostArtifactDescriptor(intent.artifact), operation.backendArtifact)
    || operation.target !== intent.artifact.sourceHead || state.pendingWebHost) fail('MAINTENANCE_TARGET_SELECTION');
  const operationPath = join(config.directory, 'maintenance.json'), statePath = join(config.directory, 'state.json');
  const originalOperationDigest = fingerprint(operation);
  const compare = async () => {
    if (fingerprint(await readPreviewJson(operationPath)) !== originalOperationDigest
      || fingerprint(await readPreviewJson(statePath)) !== intent.stateDigest || fingerprint(state) !== intent.stateDigest
      || fingerprint(await readWebRelease(config.directory)) !== intent.webReleaseDigest) fail('MAINTENANCE_TARGET_CHANGED');
  };
  await assertPreviewMarker(config); await compare();
  await backendRuntime(config, intent.artifact);
  await retainedWeb(config, await readWebRelease(config.directory), intent.artifact);
  // The pending operation already authorizes this fixed new module's public loader.
  const source = await inspectPreviewWebHostSource({ directory: config.directory, webHostArtifact: intent.artifact });
  await transaction(pool, async client => {
    await heldRunner(client, config, operation.operationId, intent.expectedVersion);
    await stopped(state); await compare();
    const selected = { ...state, webHost: { operationId: operation.operationId, artifact: intent.artifact, source,
      selection: 'selected-stopped', targetRequestId: intent.requestId } };
    await durableJson(config.directory, statePath, selected);
    const next = { ...operation, webHostTarget: { ...intent, status: 'selected-stopped', selectedStateDigest: fingerprint(selected) } };
    await durableJson(config.directory, operationPath, next);
    Object.assign(state, selected); Object.assign(operation, next);
  });
}
