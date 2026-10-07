// Only this exact disposable fixture. Historical, unowned and partial resources remain KEEP.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { validateHostInput } from './host-consumer.mjs';
import { poolOptions, exclusive } from './host-fixture.mjs';
import { privateJson, recorder, savedWork, rootIdentity, failure } from './host-records.mjs';
import { hostInputPath } from './host-paths.mjs';

export function validateCleanupArguments(argv) {
  assert.equal(argv.length, 2); assert.equal(argv[0], '--cleanup-once');
  return hostInputPath(argv[1]);
}

export function mayDrop({ outer, work, closure, allStopped, databaseCreated }) {
  return outer.owned_state === 'absent' && outer.eof?.stdout === true && outer.eof?.stderr === true
    && outer.exit_code === 0 && outer.first_failure === null && work.workComplete === true
    && work.primary === null && work.cleanupFailures?.length === 0 && closure?.loopsSettled === true
    && closure.errors?.length === 2 && closure.errors.every(value => value === null)
    && allStopped && databaseCreated;
}

export function ownedRecords(records, state, directory) {
  const found = new Map();
  const generations = records.filter(record => ['default-legacy', 'settings-published', 'both-refreshed-held'].includes(record.phase));
  for (const source of [...generations.map(record => record.fact?.processes), state?.processes]) {
    for (const [role, value] of Object.entries(source ?? {})) {
      assert.ok(['center', 'runner', 'runner-settings', 'web'].includes(role), 'UNDECLARED_RECORD_KEY');
      assert.ok(value && value.pid === value.group && Number.isSafeInteger(value.pid) && value.pid > 1 && typeof value.nonce === 'string');
      // Pending identity is retained and becomes unknown, never an authority to signal.
      if (value.command !== null) assert.ok(typeof value.command === 'string' && value.command.includes(directory)
        && value.command.includes(`--flow-preview=${value.nonce}`), 'RECORD_INSTALLATION_MISMATCH');
      const key = `${value.pid}:${value.nonce}`;
      if (found.has(key)) assert.deepEqual(found.get(key).record, value, 'RECORDED_IDENTITY_CHANGED');
      else found.set(key, { role, record: value });
    }
  }
  assert.ok(found.size <= 8, 'SERVICE_GENERATION_LIMIT'); return [...found.values()];
}

export async function readWorkDisposition(path, failures) {
  try { return await privateJson(path, 512 * 1024); }
  catch (error) { failures.push(failure(error, 'work-outer-read')); return { owned_state: 'unknown' }; }
}

async function close(pool, result, phase) {
  try { await pool.end(); } catch (error) { result.failures.push(failure(error, phase)); }
}

export async function cleanup(input) {
  const root = validateHostInput(input); await rootIdentity(input);
  assert.equal(input.records, join(input.directory, 'records'));
  const checkpoint = recorder(input, 'cleanup'), records = await savedWork(input);
  const result = { processes: [], failures: [], database: 'KEEP', directory: 'KEEP', providerCalls: 0 };
  const load = path => import(pathToFileURL(join(root, path)).href);
  const { stopOwnedProcess } = await load('tools/personal-preview/process.mjs');
  let state;
  try { state = await privateJson(join(input.directory, 'state.json')); }
  catch (error) { result.failures.push(failure(error, 'state-read')); }
  const registered = ownedRecords(records, state, input.directory);
  // Two at a time bounds ps subprocesses while keeping eight generations inside cleanup's budget.
  for (let offset = 0; offset < registered.length; offset += 2) {
    for (const fact of await Promise.all(registered.slice(offset, offset + 2).map(async ({ role, record }) => ({ role,
      pid: record.pid, nonce: record.nonce, state: await stopOwnedProcess(record, 2500) })))) result.processes.push(fact);
  }
  await checkpoint('registered-processes-stopped', result);
  const outer = await readWorkDisposition(join(input.records, 'work-outer.json'), result.failures);
  let work;
  try { work = await privateJson(join(input.records, 'work-result.json')); }
  catch (error) { result.failures.push(failure(error, 'work-result-read')); work = {}; }
  const origin = records.find(record => record.phase === 'database-marked')?.fact;
  const closure = records.find(record => record.phase === 'mixed-loop-closure')?.fact;
  const allStopped = registered.length === 8 && result.processes.every(value => value.state === 'stopped') && result.failures.length === 0;
  result.mayDrop = mayDrop({ outer, work, closure, allStopped, databaseCreated: !!origin });
  await checkpoint('drop-admission', { mayDrop: result.mayDrop, fullGenerationsStopped: allStopped,
    workComplete: work.workComplete ?? 'unknown', originKnown: !!origin });
  if (result.mayDrop) {
    const config = await privateJson(join(input.directory, 'config.json'));
    assert.match(config.databaseName, /^flow_preview_[a-f0-9]{24}$/);
    assert.equal(config.directory, input.directory); assert.equal(config.databaseName, origin.databaseName);
    assert.equal(config.installationId, origin.installationId); assert.equal(origin.directory, input.directory);
    const { Pool } = createRequire(join(root, 'package.json'))('pg');
    const owned = new Pool(poolOptions(config.databaseUrl));
    try {
      assert.deepEqual((await owned.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows,
        [{ installation_id: origin.installationId, directory: input.directory }]);
      const counts = (await owned.query("SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.tasks WHERE status='succeeded') AS succeeded,(SELECT count(*)::int FROM flow.attempts) AS attempts")).rows[0];
      assert.deepEqual(counts, { tasks: 2, succeeded: 2, attempts: 2 }); result.tasks = counts;
    } catch (error) { result.failures.push(failure(error, 'database-content')); }
    finally { await close(owned, result, 'owned-observer-close'); }
    const admin = new Pool(poolOptions(config.adminUrl));
    try {
      assert.equal(result.failures.length, 0, 'DATABASE_CONTENT_OR_CLOSURE_UNKNOWN');
      assert.deepEqual((await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows, [{ oid: origin.databaseOid }]);
      const { observeConnections } = await load('apps/tui/src/task-controls/fixture-cleanup.ts');
      const deadline = performance.now() + 3000;
      result.connections = await observeConnections(async () => {
        const remaining = Math.floor(deadline - performance.now()); assert.ok(remaining > 0, 'CONNECTION_DEADLINE');
        return (await admin.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid',
          values: [config.databaseName], query_timeout: Math.min(remaining, 1000) })).rows;
      });
      assert.equal(result.connections.state, 'empty', 'CONNECTIONS_NOT_CONFIRMED_EMPTY');
      await checkpoint('normal-drop-checkpoint', { origin, processes: result.processes, tasks: result.tasks, connections: result.connections });
      await admin.query(`DROP DATABASE "${config.databaseName}"`);
      result.remaining = (await admin.query('SELECT oid FROM pg_database WHERE datname=$1', [config.databaseName])).rows;
      assert.equal(result.remaining.length, 0); result.database = 'NORMAL_DROP_CONFIRMED';
    } catch (error) { result.failures.push(failure(error, 'normal-drop-or-observation')); }
    finally { await close(admin, result, 'admin-close'); }
  }
  result.cleanupConfirmed = result.failures.length === 0 && allStopped && result.database === 'NORMAL_DROP_CONFIRMED';
  await checkpoint('cleanup-disposition', result); await exclusive(join(input.records, 'cleanup-result.json'), result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await cleanup(await privateJson(validateCleanupArguments(process.argv.slice(2))));
    process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.cleanupConfirmed ? 0 : 1;
  } catch (error) { process.stderr.write(JSON.stringify(failure(error, 'cleanup-entry-or-persistence')) + '\n'); process.exitCode = 1; }
}
