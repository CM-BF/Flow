/** Fixed-installation confirmation Adapter; importing it performs no service/DB action. */
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { source, sha, identity, readRegular, assertPreservedQueueContract, assertPreservedQueueEvidence } from './retire.mjs';

const repository = '/Users/citrine/Projects/AgentHarness/Flow';
const personal = '/Users/citrine/.flow-personal';
const execute = promisify(execFile);
const fail = code => { throw Object.assign(Error(code), { code }); };
const tool = name => import(pathToFileURL(join(repository, 'tools/personal-preview', name)).href);
async function fixedSource() {
  const head = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'], { timeout: 1500 })).stdout.trim();
  const dirty = (await execute('git', ['-C', repository, 'status', '--porcelain'], { timeout: 1500 })).stdout;
  if (head !== source || dirty) fail('SOURCE_CHANGED');
}

// This one operation allows only the four previously hashed result files, plus the one journal.
// Any new pending/uncertain/final proposal, temp or unfamiliar file refuses resolution.
export async function exactHistory(request) {
  if (!Array.isArray(request.history) || request.history.length !== 4) fail('HISTORY_INPUT');
  const allowed = new Map(request.history.map(item => [item.path, item]));
  if (allowed.size !== 4 || request.history.some(item => !new RegExp('^' + request.namespace + '/[a-f0-9]{64}/claude-result-[a-f0-9-]{36}\\.txt$').test(item.path)
    || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > 65536 || !/^[a-f0-9]{64}$/.test(item.sha256))) fail('HISTORY_INPUT');
  let entries = 0, total = 0; const seen = new Set();
  async function walk(path, relative = '', depth = 0) {
    const before = await lstat(path);
    if (depth > 3 || !before.isDirectory() || before.isSymbolicLink() || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o700) fail('HISTORY_DIRECTORY');
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (++entries > 32) fail('HISTORY_BOUND');
      const name = relative + entry.name, next = join(path, entry.name), st = await lstat(next);
      if (st.isSymbolicLink() || st.uid !== process.getuid()) fail('HISTORY_IDENTITY');
      if (st.isDirectory()) {
        if (![...allowed.keys()].some(p => p.startsWith(name + '/'))) fail('UNKNOWN_DIRECTORY');
        await walk(next, name + '/', depth + 1);
      } else {
        if (name === request.namespace + '/admission.json') { await readRegular(next); continue; }
        const expected = allowed.get(name); if (!expected) fail('PENDING_OR_UNKNOWN_FILE');
        const data = await readRegular(next); total += data.bytes.length;
        if (total > 262144 || data.bytes.length !== expected.bytes || sha(data.bytes) !== expected.sha256) fail('HISTORY_CHANGED');
        seen.add(name);
      }
    }
    const after = await lstat(path);
    if (JSON.stringify(identity(before)) !== JSON.stringify(identity(after))) fail('HISTORY_DIRECTORY_CHANGED');
  }
  await walk(join(request.root, 'runner'));
  if (seen.size !== allowed.size) fail('HISTORY_MISSING');
}

/** Actual SQL producer, called only inside the same-runner FOR UPDATE fence below. */
export async function readPreservedQueueEvidence(client, contract) {
  assertPreservedQueueContract(contract);
  const tables = [];
  for (const table of contract.tables) {
    const columns = table.columns.map(column => '"' + column + '"').join(',');
    const result = await client.query(`SELECT md5(to_jsonb(x)::text) AS h FROM (SELECT ${columns} FROM flow."${table.name}" LIMIT 10001) x`);
    if (result.rows.length > 10000) fail('HISTORY_BOUND');
    tables.push({ name: table.name, columns: table.columns, rowHashes: result.rows.map(row => row.h).sort() });
  }
  const queuedTasks = (await client.query("SELECT id,status,current_attempt_id FROM flow.tasks WHERE status NOT IN ('succeeded','failed','cancelled') ORDER BY id LIMIT 10001")).rows;
  const evidence = { protocol: contract.protocol, baselineSha256: contract.baselineSha256, tables, queuedTasks };
  assertPreservedQueueEvidence(contract, evidence);
  return evidence;
}

// verifySource is a trusted caller's fixed tool-closure check, not a request-controlled boolean.
// Omitting it preserves the original af51 checkout qualification. The actual runner source
// remains af51 in both modes and is separately checked from the immutable state below.
export async function withHostFence(request, use, { verifySource = fixedSource } = {}) {
  if (request.root !== personal || request.runnerId !== 'd22f4df2-8242-49f4-a1b4-77f8f08611ef'
    || !/^[a-f0-9]{64}$/.test(request.stateSha256) || !/^[a-f0-9]{64}$/.test(request.configSha256)) fail('FIXED_INSTALLATION');
  await verifySource();
  const preview = await tool('preview.mjs'), processTools = await tool('process.mjs');
  const config = await preview.loadPreviewConfiguration(personal);
  if (sha((await readRegular(join(personal, 'config.json'))).bytes) !== request.configSha256
    || config.runner?.runnerId !== request.runnerId || request.baseUrl !== 'http://127.0.0.1:' + config.centerPort) fail('CONFIG_CHANGED');
  return preview.withPreviewLock(config, async () => {
    await preview.assertPreviewMarker(config);
    const { Pool } = createRequire(join(repository, 'package.json'))('pg');
    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000,
      application_name: 'svc05h-legacy-intent-resolution' });
    let client;
    try {
      client = await pool.connect(); await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='3s'");
      // Existing claim and maintenance commands use this same row; keep the hold fence throughout local publication.
      const runner = (await client.query('SELECT id,revoked,token_hash,maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1 FOR UPDATE', [request.runnerId])).rows[0];
      if (!runner || runner.revoked || runner.token_hash !== sha(config.runner.token)) fail('RUNNER_IDENTITY');
      const confirm = async () => {
        await verifySource();
        if (sha((await readRegular(join(personal, 'config.json'))).bytes) !== request.configSha256) fail('CONFIG_CHANGED');
        const stateBytes = (await readRegular(join(personal, 'state.json'))).bytes;
        if (sha(stateBytes) !== request.stateSha256) fail('STATE_CHANGED');
        const state = JSON.parse(stateBytes);
        if (request.confirmation !== undefined && (state.source?.head !== source || state.source.dirty !== false)) fail('RUNNER_SOURCE_CHANGED');
        if (await processTools.inspectOwnedProcess(state.processes?.runner) !== 'stopped') fail('RUNNER_NOT_STOPPED');
        // Bounded same-installation deployment check; not a claim to detect arbitrary hostile processes.
        const ps = (await execute('ps', ['-axo', 'pid=,command='], { timeout: 1500, maxBuffer: 1048576 })).stdout;
        if (ps.split('\n').some(line => /apps\/runner\/src\/main\.ts|--role=runner|--role runner/.test(line))) fail('OTHER_RUNNER_PROCESS');
        await exactHistory(request);
        const marker = (await client.query('SELECT installation_id,directory FROM public.flow_preview_owner')).rows;
        const registered = (await client.query('SELECT id,revoked FROM flow.runners ORDER BY id LIMIT 2')).rows;
        if (marker.length !== 1 || marker[0].installation_id !== config.installationId || marker[0].directory !== personal
          || registered.length !== 1 || registered[0].id !== request.runnerId || registered[0].revoked) fail('DEPLOYMENT_IDENTITY');
        const counts = (await client.query(`SELECT
          (SELECT count(*)::int FROM flow.attempts WHERE completed_at IS NULL) unfinished,
          (SELECT count(*)::int FROM flow.tasks WHERE status='uncertain') uncertain,
          (SELECT count(*)::int FROM flow.tasks WHERE status NOT IN ('succeeded','failed','cancelled')) pending,
          (SELECT count(*)::int FROM flow.conversation_queue WHERE state='waiting') queue`)).rows[0];
        const centerEvidence = request.confirmation === undefined ? undefined : await readPreservedQueueEvidence(client, request.confirmation);
        return { source, sourceClean: true, runnerId: runner.id, state: runner.maintenance_state,
          operationId: runner.maintenance_operation_id, version: runner.maintenance_version,
          runnerStopped: true, soleWriterConfirmed: true, inventoryComplete: true,
          globalUnfinished: counts.unfinished, globalUncertain: counts.uncertain, pendingTasks: counts.pending, pendingQueue: counts.queue,
          pendingOutbox: 0, pendingFinal: 0, pendingUnknown: 0,
          ...(centerEvidence ? { centerEvidence } : {}),
          deployment: { installationId: config.installationId, databaseName: config.databaseName, markerMatched: true,
            registeredRunnerIds: registered.map(row => row.id), configSha256: request.configSha256, stateSha256: request.stateSha256,
            ownedRunnerRecordSha256: sha(JSON.stringify(state.processes.runner)), knownRunnerEntrypoints: 0,
            scope: 'Recorded local installation and fixed runner entrypoints, not a proof against hidden hostile deployments.' } };
      };
      const result = await use(confirm); await client.query('COMMIT'); return result;
    } catch (error) { if (client) await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client?.release(); await pool.end(); }
  });
}
