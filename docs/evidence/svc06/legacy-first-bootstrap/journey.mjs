// Direct maintenance consumer only: real private PG + three owned idle processes, no service impersonation.
import assert from 'node:assert/strict';
import { readFile, mkdir, lstat } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertLegacyCleanupState } from './legacy-state.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function runJourney({ input, root, run, durable, json, port, bytesAt, errorFact, checkpoint }) {
  const load = path => import(pathToFileURL(join(root, path)).href);
  const { Pool } = createRequire(join(root, 'package.json'))('pg');
  const options = connectionString => ({ connectionString, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
  const result = { checks: {}, providerCalls: 0, tasksCreated: 0, phase: 'create-identity', scope: 'FIRST_BOOTSTRAP_WITH_OWNED_IDLE_ROLES_NOT_REAL_SERVICES', reportScope: 'SYNTHETIC_LOADER_ONLY_NOT_APP_COMPATIBILITY', secondary: [] };
  let pool;
  const phase = async value => { result.phase = value; await checkpoint(result); };
  try {
    const databaseName = `flow_preview_${randomBytes(12).toString('hex')}`;
    const adminUrl = process.env.FLOW_SVC06_ADMIN_URL, database = new URL(adminUrl); database.pathname = '/' + databaseName;
    const config = { format: 1, installationId: randomUUID(), directory: input.directory, repository: input.repository,
      databaseName, databaseUrl: database.href, adminUrl, ownerToken: randomBytes(32).toString('base64url'), runner: null,
      centerPort: await port(), webPort: await port(), createdAt: new Date().toISOString() };
    assert.notEqual(config.centerPort, config.webPort); assert.ok(![config.centerPort, config.webPort].some(p => [61227, 61228].includes(p)));
    result.databaseName = databaseName; result.installationId = config.installationId; result.unboundPorts = [config.centerPort, config.webPort];
    await durable(join(input.directory, 'config.json'), config);
    const state = { processes: {}, webArtifact: input.web, lastError: null };
    await durable(join(input.directory, 'state.json'), state);
    await phase('create-database-intent');
    pool = new Pool(options(adminUrl));
    assert.equal((await pool.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    result.databaseOid = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rows[0].oid;
    await phase('database-created'); await pool.end(); pool = new Pool(options(config.databaseUrl));
    await pool.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
    await pool.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, config.directory]);
    // Canonical functions, not a fabricated maintenance schema or a hand-built operation.
    await (await load('apps/server/src/database.ts')).migrate(pool);
    const maintenance = await load('apps/server/src/runner-maintenance/index.ts');
    await maintenance.migrateRunnerMaintenance(pool);
    config.runner = await (await load('apps/server/src/runners.ts')).registerRunner(pool, { name: 'SVC06 isolated legacy entry fixture', harnesses: ['fixture'], capacity: 1 });
    await durable(join(input.directory, 'config.json'), config, true);
    result.migrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
    assert.deepEqual(result.migrations, [1, 2, 16]);
    const processTools = await load('tools/personal-preview/process.mjs');
    const idleScript = join(run, 'idle-role.mjs');
    await durable(idleScript, "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);\n");
    await phase('start-owned-idle-roles');
    for (const role of ['center', 'runner', 'web']) {
      state.processes[role] = await processTools.spawnOwnedProcess({ args: [idleScript], cwd: run,
        env: { PATH: '/usr/bin:/bin', HOME: join(run, 'home'), TMPDIR: join(run, 'tmp') },
        onSpawn: async pending => { state.processes[role] = pending; await durable(join(input.directory, 'state.json'), state, true); } });
      await durable(join(input.directory, 'state.json'), state, true);
      assert.equal(await processTools.inspectOwnedProcess(state.processes[role]), 'running');
    }
    await durable(join(run, 'generation-1.json'), state.processes);
    const webAt = join(input.directory, 'web-artifacts', input.web.artifactId), webSource = join(input.webSourceDirectory, 'web-artifacts', input.web.artifactId);
    for (const path of [join(input.directory, 'web-artifacts'), webAt, join(webAt, 'dist'), join(webAt, 'dist/assets')]) await mkdir(path, { mode: 0o700 });
    await durable(join(webAt, 'manifest.json'), await bytesAt(join(webSource, 'manifest.json'), input.webManifestBytes, input.web.manifestDigest));
    for (const file of input.webManifest.files) {
      assert.ok(/^(?:index\.html|assets\/[A-Za-z0-9_.-]+)$/.test(file.path));
      await durable(join(webAt, 'dist', file.path), await bytesAt(join(webSource, 'dist', file.path), file.bytes, file.sha256));
    }
    // Narrow fixture attestations only unlock the report loader. They are never production App evidence.
    const fixture = join(run, 'NON_PRODUCTION_LOADER_FIXTURE'); await mkdir(fixture, { mode: 0o700 });
    await durable(join(fixture, 'SCOPE.json'), { synthetic: true, appCompatibility: false, personalCandidate: false });
    const checks = {}, keys = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'], recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
    for (const [check, names] of Object.entries(keys)) {
      const raw = JSON.stringify({ format: 1, check, backendHead: input.artifact.sourceHead, artifactId: input.web.artifactId, observations: Object.fromEntries(names.map(name => [name, true])) }) + '\n';
      await durable(join(fixture, `${check}.json`), raw); checks[check] = hash(raw);
    }
    await durable(join(fixture, 'report.json'), { format: 1, policy: 'flow-web-api-v1', backendHead: input.artifact.sourceHead, artifact: input.web, checks });
    const rootPreview = await import(pathToFileURL(join(input.repository, 'tools/personal-preview/preview.mjs')).href);
    const release = await load('tools/personal-preview/web-release.mjs');
    await rootPreview.withPreviewLock(await rootPreview.loadPreviewConfiguration(input.directory), async () => {
      const compatibilityId = await release.importWebCompatibility({ directory: input.directory, reportDirectory: fixture });
      const pointer = await release.planWebRelease({ directory: input.directory, artifact: input.web, expectedVersion: 0, action: 'bootstrap', backendHead: input.artifact.sourceHead, compatibilityId });
      await release.commitWebRelease(input.directory, pointer);
    });
    const fixedBytes = Object.fromEntries(await Promise.all(['state.json', 'config.json', 'web-release.json'].map(async name => [name, hash(await readFile(join(input.directory, name)))])));
    const audit = async () => (await pool.query('SELECT count(*)::int AS count FROM flow.runner_maintenance_audit')).rows[0].count;
    const view = () => maintenance.readRunnerMaintenance(pool, config.runner.runnerId);
    const before = await view(); assert.equal(before.state, 'accepting'); assert.equal(before.version, 0); assert.equal(await audit(), 0);
    await assert.rejects(lstat(join(input.directory, 'maintenance.json')), { code: 'ENOENT' });
    assertLegacyCleanupState(await json(join(input.directory, 'state.json')), null, input.artifact);
    await phase('artifact-first-entry-must-reject');
    const artifactHost = await load('tools/personal-preview/maintenance-host.mjs');
    await assert.rejects(artifactHost.maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId }), { code: 'CONFIGURATION_IDENTITY_MISMATCH' });
    assert.deepEqual(await view(), before); assert.equal(await audit(), 0);
    await assert.rejects(lstat(join(input.directory, 'maintenance.json')), { code: 'ENOENT' });
    for (const [name, digest] of Object.entries(fixedBytes)) assert.equal(hash(await readFile(join(input.directory, name))), digest);
    result.checks.artifactRejectedBeforeDrain = true; result.negative = { code: 'CONFIGURATION_IDENTITY_MISMATCH', before, after: await view(), auditCount: 0, protectedHashes: fixedBytes };
    await phase('root-public-bootstrap');
    const rootHost = await import(pathToFileURL(join(input.repository, 'tools/personal-preview/maintenance-host.mjs')).href);
    const first = await rootHost.maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId });
    const operation = await json(join(input.directory, 'maintenance.json')); assertLegacyCleanupState(state, operation, input.artifact);
    assert.equal(first.state, 'draining'); assert.equal(first.version, 1); assert.equal(first.operationId, operation.operationId); assert.equal(await audit(), 1);
    result.checks.realOperationCreatedByRoot = true;
    await phase('artifact-same-operation-continuation');
    const operationBytes = await readFile(join(input.directory, 'maintenance.json'));
    const repeated = await artifactHost.maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId });
    const status = await artifactHost.maintainPreview({ directory: input.directory, action: 'status' });
    assert.deepEqual(repeated, first); assert.equal(status.operationId, operation.operationId); assert.equal(status.version, 1); assert.equal(status.state, 'draining');
    assert.equal(await audit(), 1); assert.deepEqual(await readFile(join(input.directory, 'maintenance.json')), operationBytes);
    for (const [name, digest] of Object.entries(fixedBytes)) assert.equal(hash(await readFile(join(input.directory, name))), digest);
    for (const record of Object.values(state.processes)) assert.equal(await processTools.inspectOwnedProcess(record), 'running');
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM flow.tasks')).rows[0].count, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM flow.attempts')).rows[0].count, 0);
    result.databaseBytes = Number((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes); assert.ok(result.databaseBytes <= input.resources.databaseBytes);
    result.operation = { operationId: operation.operationId, artifact: operation.backendArtifact, phase: operation.phase, version: status.version, state: status.state, auditCount: 1, sha256: hash(operationBytes) };
    result.checks.artifactContinuesSameOperation = true; result.checks.legacyStateUnchanged = true; result.checks.noTasksOrAttempts = true;
    await phase('passed');
  } catch (error) { result.failure = errorFact(error); result.failedPhase = result.phase; result.phase = 'failed-or-unknown'; }
  finally {
    if (pool) try { await pool.end(); } catch (error) { result.secondary.push(errorFact(error)); result.phase = 'failed-or-unknown'; }
    await checkpoint(result);
  }
  return result;
}
