// A separate, finite purpose: default three roles only. No settings, tasks, provider or DROP.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { main as runWork } from './host-entry.mjs';
import { validateHostInput } from './host-consumer.mjs';
import { ownedRecords, readWorkDisposition, validateCleanupArguments } from './host-cleanup.mjs';
import { poolOptions, exclusive, localAdmin } from './host-fixture.mjs';
import { privateJson, recorder, savedWork, rootIdentity, failure } from './host-records.mjs';
import { prepareControllerDriver } from './controller-loader.mjs';

export const PURPOSE = 'SVC09A_DEFAULT_THREE_ROLE_START_STOP';
const roles = ['center', 'runner', 'web'];
const loadFrom = root => relative => import(pathToFileURL(join(root, relative)).href);

export function requirePurpose(input) {
  assert.equal(input.purpose, PURPOSE, 'HOST_PURPOSE_MISMATCH');
  assert.equal(input.providerCalls, 0);
  return validateHostInput(input);
}

export async function emptyTasks(pool) {
  let value;
  try { value = (await pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts')).rows[0]; }
  catch (cause) { throw Object.assign(new Error('Empty task observation failed'), { code: 'DEFAULT_EMPTY_QUERY_FAILED', cause }); }
  assert.deepEqual(value, { tasks: 0, attempts: 0 }, 'DEFAULT_TASKS_NOT_EMPTY');
  return value;
}

// Trusted ports are the actual frozen artifact exports at the production call site below.
export async function defaultSequence({ input, preview, controller, pool, checkpoint }) {
  requirePurpose(input);
  const config = await preview.loadPreviewConfiguration(input.directory);
  assert.equal(config.repository, input.repository);
  const state = await preview.readPreviewJson(join(input.directory, 'state.json'));
  assert.deepEqual(state.backendArtifact, input.artifact);
  assert.deepEqual(state.processes, {}, 'FRESH_DEFAULT_STATE_REQUIRED');
  await preview.assertPreviewMarker(config);
  await checkpoint('before-default-start', { purpose: PURPOSE, artifact: input.artifact });
  let started, primary;
  try {
    started = await preview.withPreviewLock(config, () => controller.startPreviewServices(config, state,
      input.webArtifact, input.artifact, preview.statusPreview));
  } catch (error) { primary = error; }
  try {
    const observed = await preview.readPreviewJson(join(input.directory, 'state.json'));
    await checkpoint('default-start-observation', { purpose: PURPOSE, processes: observed.processes,
      readiness: observed.startReadiness ?? null, failure: observed.lastStartFailure ?? null,
      startCleanup: observed.startCleanup ?? null, evidenceErrors: observed.startEvidenceErrors ?? null });
  } catch (error) {
    // Persistence is secondary to the exact startup failure. No retry and no raw exception content.
    if (!primary) primary = error;
    else await checkpoint('default-observation-failure', failure(error, 'default-start-observation')).catch(() => {});
  }
  if (primary) throw primary;
  assert.deepEqual(started.processes, { center: 'running', runner: 'running', web: 'running' });
  assert.equal(started.center.reachable, true); assert.equal(started.database, 'owned');
  assert.equal(started.webArtifact.serving, 'confirmed');
  assert.equal(started.runnerSlots.state, 'configured');
  assert.deepEqual(started.runnerSlots.slots.map(value => value.slot), ['legacy']);
  const live = await preview.readPreviewJson(join(input.directory, 'state.json'));
  assert.deepEqual(Object.keys(live.processes).sort(), roles);
  await checkpoint('default-legacy', { purpose: PURPOSE, processes: live.processes,
    readiness: live.startReadiness ?? null, tasks: await emptyTasks(pool),
    provider: 'not-probed', actualClaim: 'unknown', web: 'SYNTHETIC_LOADER_NOT_APP' });
  const stopped = await preview.stopPreview({ directory: input.directory });
  assert.deepEqual(stopped.processes, { web: 'stopped', runner: 'stopped', center: 'stopped' });
  await checkpoint('default-explicit-stop', { purpose: PURPOSE, processes: stopped.processes, tasks: await emptyTasks(pool) });
  return { purpose: PURPOSE, defaultReady: true, explicitStop: true, providerCalls: 0,
    database: 'KEEP', directory: 'KEEP', resourceClosure: 'PENDING_INDEPENDENT_OWNER', actualClaim: 'unknown' };
}

export async function runDefaultConsumer({ input, checkpoint, pool }) {
  const root = requirePurpose(input); await rootIdentity(input);
  const driverInput = JSON.parse(await readFile(new URL('./controller-driver-inputs.json', import.meta.url), 'utf8'));
  assert.deepEqual(driverInput.artifact, input.artifact);
  // Driver dependencies intentionally stay on the already pinned immutable original artifact.
  // All config/status/stop and all service runtime paths still use this attempt's verified clone.
  const driver = await prepareControllerDriver(driverInput, join(input.directory, 'controller-driver'));
  await checkpoint('controller-driver', { controllerSource: driverInput.controllerSource,
    dependencyArtifactRoot: driverInput.artifactRoot, serviceArtifactRoot: root, identities: driver.identities });
  const preview = await loadFrom(root)('tools/personal-preview/preview.mjs');
  const controller = await import(pathToFileURL(driver.entry).href);
  return defaultSequence({ input, preview, controller, pool, checkpoint });
}

export function defaultClosure({ outer, recordsKnown, stateKnown, registered, processes, connections, failures, adminClosed }) {
  return outer.owned_state === 'absent' && outer.eof?.stdout === true && outer.eof?.stderr === true
    && recordsKnown && stateKnown && registered.length <= 3 && processes.length === registered.length
    && processes.every(value => value.state === 'stopped') && connections?.state === 'empty'
    && failures.length === 0 && adminClosed === true;
}

export async function cleanupDefault(input) {
  const root = requirePurpose(input); await rootIdentity(input);
  assert.equal(input.records, join(input.directory, 'records'));
  const checkpoint = recorder(input, 'cleanup'), result = { purpose: PURPOSE, processes: [], failures: [],
    database: 'KEEP', directory: 'KEEP', mayDrop: false, resourcesClosed: false, adminClosed: false, providerCalls: 0 };
  let records = [], state, recordsKnown = false, stateKnown = false;
  try { records = await savedWork(input); recordsKnown = true; } catch (error) { result.failures.push(failure(error, 'records-read')); }
  try { state = await privateJson(join(input.directory, 'state.json')); stateKnown = true; } catch (error) { result.failures.push(failure(error, 'state-read')); }
  const registered = ownedRecords(records, state, input.directory, ['default-start-observation', 'default-legacy']);
  assert.ok(registered.length <= 3 && registered.every(value => roles.includes(value.role)), 'DEFAULT_ROLE_SCOPE_MISMATCH');
  const load = loadFrom(root), { stopOwnedProcess } = await load('tools/personal-preview/process.mjs');
  for (const { role, record } of registered.reverse()) {
    let observed = 'unknown';
    try { observed = await stopOwnedProcess(record, 2500); } catch (error) { result.failures.push(failure(error, 'registered-stop')); }
    result.processes.push({ role, pid: record.pid, group: record.group, nonce: record.nonce, state: observed });
  }
  await checkpoint('default-registered-stop', result);
  const outer = await readWorkDisposition(join(input.records, 'work-outer.json'), result.failures);
  const origin = records.find(record => record.phase === 'database-marked')?.fact;
  let admin;
  try {
    assert.ok(origin, 'DATABASE_ORIGIN_UNKNOWN');
    const config = await privateJson(join(input.directory, 'config.json'));
    assert.equal(config.directory, input.directory); assert.equal(origin.directory, input.directory);
    assert.equal(config.installationId, origin.installationId); assert.equal(config.databaseName, origin.databaseName);
    assert.match(config.databaseName, /^flow_preview_[a-f0-9]{24}$/); localAdmin(config.adminUrl);
    const databaseUrl = new URL(config.databaseUrl), adminUrl = new URL(config.adminUrl);
    assert.equal(databaseUrl.origin, adminUrl.origin); assert.equal(databaseUrl.pathname, '/' + origin.databaseName);
    databaseUrl.pathname = '/postgres'; assert.equal(databaseUrl.href, adminUrl.href, 'DATABASE_URL_IDENTITY_MISMATCH');
    const { Pool } = createRequire(join(root, 'package.json'))('pg');
    const owned = new Pool(poolOptions(config.databaseUrl));
    try {
      assert.deepEqual((await owned.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows,
        [{ installation_id: origin.installationId, directory: input.directory }]);
      result.tasks = await emptyTasks(owned);
    } catch (error) { result.failures.push(failure(error, 'owned-observation')); }
    finally { try { await owned.end(); } catch (error) { result.failures.push(failure(error, 'owned-pool-close')); } }
    admin = new Pool(poolOptions(config.adminUrl));
    assert.deepEqual((await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows, [{ oid: origin.databaseOid }]);
    const { observeConnections } = await load('apps/tui/src/task-controls/fixture-cleanup.ts');
    const deadline = performance.now() + 3000;
    result.connections = await observeConnections(async () => {
      const remaining = Math.floor(deadline - performance.now()); assert.ok(remaining > 0, 'CONNECTION_DEADLINE');
      return (await admin.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid',
        values: [config.databaseName], query_timeout: Math.min(remaining, 1000) })).rows;
    });
  } catch (error) { result.failures.push(failure(error, 'database-observation')); }
  finally { if (admin) try { await admin.end(); result.adminClosed = true; } catch (error) { result.failures.push(failure(error, 'admin-close')); } }
  result.resourcesClosed = defaultClosure({ outer, recordsKnown, stateKnown, registered, ...result });
  await checkpoint('default-closure', result); await exclusive(join(input.records, 'cleanup-result.json'), result);
  return result;
}

export function defaultArguments(argv) {
  assert.equal(argv.length, 2); assert.ok(['--work-once', '--cleanup-once'].includes(argv[0]), 'EXACT_DEFAULT_MODE_REQUIRED');
  if (argv[0] === '--cleanup-once') validateCleanupArguments(argv);
  return argv[0];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    if (defaultArguments(argv) === '--work-once') process.exitCode = await runWork(argv, { consumer: runDefaultConsumer, purpose: PURPOSE });
    else {
      const result = await cleanupDefault(await privateJson(argv[1]));
      process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.resourcesClosed ? 0 : 1;
    }
  } catch (error) { process.stderr.write(JSON.stringify(failure(error, 'default-entry-or-persistence')) + '\n'); process.exitCode = 1; }
}
