// One isolated consumer of fixed public factories and the original trusted host lifecycle.
import assert from 'node:assert/strict';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const hash = b => createHash('sha256').update(b).digest('hex');
const stable = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export async function runJourney({ input, root, run, durable, json, port, bytesAt, errorFact, checkpoint }) {
  const load = path => import(pathToFileURL(join(root, path)).href);
  const { Pool } = createRequire(join(root, 'package.json'))('pg');
  const poolOptions = url => ({ connectionString: url, max: 1, connectionTimeoutMillis: 1000, query_timeout: 3000, statement_timeout: 2500 });
  const result = { checks: {}, providerCalls: 0, tasksCreated: 0, phase: 'create-identity', reportScope: 'SYNTHETIC_LOADER_CONTRACT_ONLY_NOT_APP_COMPATIBILITY' };
  let pool, oldApp, primary, oldCloseAttempted = false;
  const secondary = [];
  const phase = async value => { result.phase = value; await checkpoint(result); };
  try {
    const databaseName = `flow_preview_${randomBytes(12).toString('hex')}`;
    const adminUrl = process.env.FLOW_SVC06_ADMIN_URL, database = new URL(adminUrl); database.pathname = '/' + databaseName;
    const config = { format: 1, installationId: randomUUID(), directory: input.directory, repository: input.repository,
      databaseName, databaseUrl: database.href, adminUrl, ownerToken: randomBytes(32).toString('base64url'), runner: null,
      centerPort: await port(), webPort: await port(), createdAt: new Date().toISOString() };
    assert.notEqual(config.centerPort, config.webPort); assert.ok(![config.centerPort, config.webPort].some(p => [61227, 61228].includes(p)));
    result.databaseName = databaseName; result.installationId = config.installationId; result.ports = [config.centerPort, config.webPort];
    await durable(join(input.directory, 'config.json'), config);
    await durable(join(input.directory, 'state.json'), { backendArtifact: input.artifact, source: { head: input.artifact.sourceHead, dirty: false }, webArtifact: input.web, processes: {}, lastError: null });
    await durable(join(input.directory, 'claude.json'), { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60000 });
    await mkdir(join(input.directory, 'runner'), { mode: 0o700 });
    await phase('create-database-intent');
    pool = new Pool(poolOptions(adminUrl));
    assert.equal((await pool.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    result.databaseOid = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rows[0].oid;
    await phase('database-created'); await pool.end(); pool = new Pool(poolOptions(config.databaseUrl));
    await pool.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
    await pool.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, config.directory]);
    await phase('legacy-factory');
    const { createServer } = await import(pathToFileURL(join(input.legacyRoot, 'apps/server/src/index.ts')).href);
    oldApp = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken });
    await oldApp.listen({ host: '127.0.0.1', port: config.centerPort });
    async function request(path, { body, headers = {}, web = false, owner = true, expected = 200, key = randomUUID() } = {}) {
      const response = await fetch(`http://127.0.0.1:${web ? config.webPort : config.centerPort}${path}`, {
        method: body === undefined ? 'GET' : 'POST', headers: { ...(owner ? { authorization: `Bearer ${config.ownerToken}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': key }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(3000), redirect: 'error' });
      assert.equal(response.status, expected, `HTTP_STATUS_${path.split('?')[0]}`); return response;
    }
    const created = await (await request('/api/conversations', { body: { title: 'SVC06 isolated migration fixture' }, expected: 201 })).json();
    const conversationId = created.conversation.id, turnKey = randomUUID();
    const body = { expectedRevision: 0, text: 'SVC06 fixture; cancelled before any execution.' };
    const accepted = await (await request(`/api/conversations/${conversationId}/turns`, { body, key: turnKey, expected: 202 })).json();
    const replayed = await (await request(`/api/conversations/${conversationId}/turns`, { body, key: turnKey, expected: 202 })).json();
    assert.equal(replayed.replayed, true); assert.equal(replayed.turn.id, accepted.turn.id);
    const taskId = accepted.turn.task.id; result.tasksCreated = 1;
    const cancelled = await (await request(`/api/tasks/${taskId}/cancel`, { body: {} })).json();
    assert.equal(cancelled.status, 'cancelled');
    result.fixtureIds = { conversationId, turnId: accepted.turn.id, taskId };
    result.oldMigrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(r => r.version);
    assert.deepEqual(result.oldMigrations, Array.from({ length: 27 }, (_, i) => i + 1));
    oldCloseAttempted = true; await oldApp.close(); oldApp = null; result.oldFactoryClosed = true;
    const historyTables = ['conversations', 'conversation_turns', 'tasks', 'timeline', 'commands'];
    async function snapshot(columns) {
      const out = {};
      for (const table of historyTables) {
        const names = columns?.[table] ?? (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='flow' AND table_name=$1 ORDER BY ordinal_position", [table])).rows.map(r => r.column_name).filter(n => n !== 'queue_checked_at');
        assert.ok(names.length > 0 && names.length < 80 && names.every(n => /^[a-z_]+$/.test(n)));
        const rows = (await pool.query(`SELECT ${names.map(n => '"' + n + '"').join(',')} FROM flow.${table} LIMIT 101`)).rows;
        assert.ok(rows.length <= 100); out[table] = { columns: names, rows: rows.map(stable).sort() };
      }
      const bytes = stable(out); assert.ok(Buffer.byteLength(bytes) <= 65536); return { value: out, digest: hash(bytes) };
    }
    async function idle() {
      const facts = (await pool.query("SELECT (SELECT count(*)::int FROM flow.tasks WHERE status NOT IN ('succeeded','failed','cancelled')) AS unfinished,(SELECT count(*)::int FROM flow.attempts) AS attempts")).rows[0];
      assert.deepEqual(facts, { unfinished: 0, attempts: 0 });
      const databaseBytes = Number((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
      assert.ok(databaseBytes <= input.resources.databaseBytes); (result.databaseSizeSamples ??= []).push(databaseBytes); return facts;
    }
    await idle(); const before = await snapshot(); await durable(join(run, 'history-before.json'), before);
    result.historyDigest = before.digest;
    const webAt = join(input.directory, 'web-artifacts', input.web.artifactId), webSource = join(input.webSourceDirectory, 'web-artifacts', input.web.artifactId);
    await mkdir(join(input.directory, 'web-artifacts'), { mode: 0o700 }); await mkdir(webAt, { mode: 0o700 });
    await mkdir(join(webAt, 'dist'), { mode: 0o700 }); await mkdir(join(webAt, 'dist/assets'), { mode: 0o700 });
    await durable(join(webAt, 'manifest.json'), await bytesAt(join(webSource, 'manifest.json'), input.webManifestBytes, input.web.manifestDigest));
    for (const file of input.webManifest.files) {
      assert.ok(/^(?:index\.html|assets\/[A-Za-z0-9_.-]+)$/.test(file.path));
      await durable(join(webAt, 'dist', file.path), await bytesAt(join(webSource, 'dist', file.path), file.bytes, file.sha256));
    }
    const preview = await load('tools/personal-preview/preview.mjs');
    const processTools = await load('tools/personal-preview/process.mjs');
    const release = await load('tools/personal-preview/web-release.mjs');
    const { maintainPreview } = await load('tools/personal-preview/maintenance-host.mjs');
    const policyModule = await load('tools/personal-preview/browser-session-configuration.mjs');
    await phase('start-default-off');
    const startingState = await json(join(input.directory, 'state.json'));
    await preview.withPreviewLock(config, () => preview.startPreviewServices(config, startingState, input.web, input.artifact));
    const firstState = await json(join(input.directory, 'state.json'));
    await durable(join(run, 'generation-1.json'), firstState.processes);
    const actualConfig = await json(join(input.directory, 'config.json')); config.runner = actualConfig.runner;
    result.checks.defaultOff = (await (await request('/api/browser-session', { web: true, owner: false })).json()).state === 'unsupported'; assert.ok(result.checks.defaultOff);
    result.newMigrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(r => r.version);
    assert.deepEqual(result.newMigrations, Array.from({ length: 35 }, (_, i) => i + 1)); assert.ok([28, 32, 33].every(v => result.newMigrations.includes(v)) && result.oldMigrations.every(v => result.newMigrations.includes(v)));
    const columns = Object.fromEntries(Object.entries(before.value).map(([k, v]) => [k, v.columns]));
    assert.equal((await snapshot(columns)).digest, before.digest); await idle();
    const profileBytes = await readFile(join(input.directory, 'claude.json')), configBytes = await readFile(join(input.directory, 'config.json'));
    // Synthetic check attestations are confined to this root. They exercise the loader contract, never App compatibility.
    const fixtureBase = join(run, 'NON_PRODUCTION_LOADER_FIXTURE'); await mkdir(fixtureBase, { mode: 0o700 });
    await durable(join(fixtureBase, 'SCOPE.json'), { synthetic: true, appCompatibility: false, personalCandidate: false, reason: 'Only fixed report format/context loading and pre-stop guards; actual HTTP observations are separate.' });
    async function reportFixture(context) {
      const format = context ? 2 : 1, at = join(fixtureBase, `v${format}`); await mkdir(at, { mode: 0o700 });
      const checks = {}, checkKeys = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'], recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
      for (const [check, keys] of Object.entries(checkKeys)) {
        const value = { format, check, backendHead: input.artifact.sourceHead, artifactId: input.web.artifactId, observations: Object.fromEntries(keys.map(k => [k, true])), ...(context ? { context } : {}) };
        const raw = JSON.stringify(value) + '\n'; await durable(join(at, `${check}.json`), raw); checks[check] = hash(raw);
      }
      await durable(join(at, 'report.json'), { format, policy: `flow-web-api-v${format}`, backendHead: input.artifact.sourceHead, artifact: input.web, checks, ...(context ? { context } : {}) });
      return preview.withPreviewLock(await preview.loadPreviewConfiguration(input.directory), () => release.importWebCompatibility({ directory: input.directory, reportDirectory: at }));
    }
    const legacyId = await reportFixture(null);
    await preview.withPreviewLock(await preview.loadPreviewConfiguration(input.directory), async () => {
      const pointer = await release.planWebRelease({ directory: input.directory, artifact: input.web, expectedVersion: 0, action: 'bootstrap', backendHead: input.artifact.sourceHead, compatibilityId: legacyId });
      await release.commitWebRelease(input.directory, pointer);
    });
    const pointerBefore = await readFile(join(input.directory, 'web-release.json'));
    const initialMaintenance = await maintainPreview({ directory: input.directory, action: 'status' });
    assert.equal(initialMaintenance.state, 'accepting');
    async function unchangedPreDrain() {
      assert.deepEqual((await json(join(input.directory, 'state.json'))).processes, firstState.processes);
      for (const record of Object.values(firstState.processes)) assert.equal(await processTools.inspectOwnedProcess(record), 'running');
      const row = (await pool.query('SELECT maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1', [config.runner.runnerId])).rows[0];
      assert.equal(row.maintenance_state, 'accepting'); assert.equal(row.maintenance_version, initialMaintenance.version); assert.equal(row.maintenance_operation_id, null);
    }
    async function rejectedBootstrap(label, expectedCode) {
      let error;
      try { await maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId }); } catch (e) { error = e; }
      assert.equal(error?.code, expectedCode); await unchangedPreDrain(); result.checks[label] = errorFact(error); await durable(join(run, `${label}.json`), result.checks[label]);
    }
    await phase('pre-drain-negative-guards');
    await durable(join(input.directory, 'browser-session.json'), { format: 999 });
    await rejectedBootstrap('invalid-policy-rejected-before-drain', 'BROWSER_CONFIGURATION_INVALID');
    await unlink(join(input.directory, 'browser-session.json')); // Exact self-created invalid fixture, never a user policy.
    const origin = `http://127.0.0.1:${config.webPort}`, browserSession = { cookieOrigin: origin, trustedOrigins: [origin], authEpoch: 'svc06-b2b-isolated-host-policy-v1' };
    await durable(join(input.directory, 'browser-session.json'), { format: 1, installationId: config.installationId, browserSession });
    const context = policyModule.browserCompatibilityContext(browserSession); result.context = context;
    await rejectedBootstrap('missing-v2-rejected-before-drain', 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN');
    result.loaderFixtureCompatibilityId = await reportFixture(context);
    await phase('maintenance-bootstrap'); const drained = await maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId });
    assert.equal(drained.state, 'draining'); assert.equal(drained.activeAttempts, 0); assert.equal(drained.uncertainAttempts, 0); await idle();
    await durable(join(run, 'generation-before-refresh.json'), firstState.processes);
    await phase('maintenance-refresh'); const paused = await maintainPreview({ directory: input.directory, action: 'refresh', target: input.artifact.sourceHead });
    assert.equal(paused.update, 'ready-paused'); assert.equal(paused.state, 'maintenance');
    for (const record of Object.values(firstState.processes)) assert.equal(await processTools.inspectOwnedProcess(record), 'stopped');
    result.oldExitRecords = {};
    for (const role of ['web', 'runner', 'center']) {
      try { const exit = await json(join(input.directory, `${role}-exit.json`)); if (exit.nonce === firstState.processes[role].nonce) result.oldExitRecords[role] = exit; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const secondState = await json(join(input.directory, 'state.json')); await durable(join(run, 'generation-2.json'), secondState.processes);
    for (const [role, record] of Object.entries(secondState.processes)) { assert.notEqual(record.nonce, firstState.processes[role].nonce); assert.equal(await processTools.inspectOwnedProcess(record), 'running'); }
    await phase('maintenance-resume'); const resumed = await maintainPreview({ directory: input.directory, action: 'resume' }); assert.equal(resumed.state, 'accepting');
    result.maintenance = { initial: initialMaintenance.version, drained: drained.version, paused: paused.version, resumed: resumed.version };
    await phase('browser-cookie-http');
    const browser = { web: true, owner: false, headers: { origin } };
    assert.equal((await (await request('/api/browser-session', browser)).json()).state, 'unauthenticated');
    const connected = await request('/api/browser-session/connect', { body: {}, web: true, headers: { origin } });
    const cookie = connected.headers.get('set-cookie')?.split(';')[0], session = await connected.json();
    assert.ok(cookie && session.state === 'ready' && session.csrfToken);
    const cookieHeaders = { origin, cookie };
    const page = await (await request(`/api/conversations/${conversationId}/turns?limit=20`, { ...browser, headers: cookieHeaders })).json();
    assert.ok(JSON.stringify(page).includes(taskId));
    await (await request('/api/browser-session/logout', { ...browser, body: {}, headers: cookieHeaders, expected: 403 })).body?.cancel();
    assert.equal((await (await request('/api/browser-session/logout', { ...browser, body: {}, headers: { ...cookieHeaders, 'x-flow-csrf': session.csrfToken } })).json()).state, 'unauthenticated');
    assert.equal((await (await request('/api/browser-session', { ...browser, headers: cookieHeaders })).json()).state, 'unauthenticated');
    const identity = await (await request('/__flow_preview_identity', { web: true, owner: false })).json();
    assert.deepEqual(identity.runtimeCompatibility, { backendHead: input.artifact.sourceHead, context });
    assert.equal(hash(await readFile(join(input.directory, 'web-release.json'))), hash(pointerBefore));
    assert.equal(hash(await readFile(join(input.directory, 'config.json'))), hash(configBytes));
    assert.equal(hash(await readFile(join(input.directory, 'claude.json'))), hash(profileBytes));
    assert.equal((await snapshot(columns)).digest, before.digest); await idle();
    assert.ok((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes <= input.resources.databaseBytes);
    result.checks.historyPreserved = true; result.checks.pointerConfigProfilePreserved = true; result.checks.cookieReadCsrfLogout = true;
    result.checks.realThreeRoleRefreshResume = true; result.phase = 'passed';
  } catch (error) { primary = error; }
  finally {
    if (oldApp && !oldCloseAttempted) { try { oldCloseAttempted = true; await oldApp.close(); result.oldFactoryClosed = true; } catch (error) { secondary.push(errorFact(error)); } }
    if (pool) { try { await pool.end(); } catch (error) { secondary.push(errorFact(error)); } }
  }
  if (primary) result.failure = errorFact(primary);
  result.secondaryFailures = secondary;
  if (primary || secondary.length) result.phase = 'failed-or-unknown';
  return result;
}
