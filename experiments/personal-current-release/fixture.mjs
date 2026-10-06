import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { BACKEND, inventory, sha } from './inventory.mjs';
import { observationProxy, freePort, until } from './transport.mjs';
import { prepareWebArtifact, verifyWebArtifact } from '../../tools/personal-preview/web-artifact.mjs';
import { startStaticWeb } from '../../tools/personal-preview/static-web.mjs';
export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const load = (root, path) => import(pathToFileURL(join(root, path)).href);
const execute = promisify(execFile);
const ADMIN = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const OLD = 'b1c2e39837c2208e6fc2c59a80e16797f26448b5';
const RELEASE_ID = BACKEND.slice(0, 32);
export async function createFixture(evidence) {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc05-')));
  const dbName = 'flow_svc05_' + randomUUID().replaceAll('-', '').slice(0, 24);
  const dbUrl = new URL(ADMIN); dbUrl.pathname = '/' + dbName;
  const marker = randomUUID(), token = 'synthetic-' + randomUUID(), secrets = [token];
  const closures = [], checkouts = [], previews = []; let app, pool, created = false;
  const report = { startedAt: new Date().toISOString(), backend: BACKEND, parent, databaseName: dbName, providerQueries: 0, personalActions: 0, results: [], failure: null };
  report.sourceHashes = Object.fromEntries(await Promise.all(['inventory.mjs', 'transport.mjs', 'fixture.mjs', 'browser.mjs'].map(async name => [name, sha(await readFile(join(repository, 'experiments/personal-current-release', name)))])));
  const save = async (name, value) => { await writeFile(join(evidence, name), JSON.stringify(value, null, 2) + '\n'); };
  const git = async (...args) => (await execute('git', ['-C', repository, ...args], { maxBuffer: 1048576 })).stdout.trim();
  const redact = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));
  const request = async (path, body, auth = token, headers = {}) => {
    const response = await fetch(report.centerUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const result = await response.json(); assert.ok(response.ok, `HTTP ${path}: ${response.status} ${JSON.stringify(result)}`); return result;
  };
  async function startCenter(source) { const module = await load(source, 'apps/server/src/index.ts'); app = await module.createServer({ databaseUrl: dbUrl.href, ownerToken: token }); report.centerUrl = await app.listen({ host: '127.0.0.1', port: 0 }); }
  async function stopCenter() { if (app) { await app.close(); app = undefined; } }
  async function checkout(label, target) {
    const source = join(parent, label); await git('worktree', 'add', '--detach', source, target); checkouts.push(source);
    const installed = await execute('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], { cwd: source, timeout: 90000, maxBuffer: 1048576 });
    await writeFile(join(evidence, label + '-install.txt'), installed.stdout + installed.stderr);
    assert.equal(await git('-C', source, 'rev-parse', 'HEAD'), target); return source;
  }
  async function seedHistory() {
    const runner = await request('/api/runners', { name: 'SVC05 synthetic legacy', harnesses: ['claude'], capacity: 1 }); secrets.push(runner.token);
    const conversation = (await request('/api/conversations', { title: 'Preserved synthetic history' })).conversation;
    const body = { expectedRevision: 0, text: 'Persist this synthetic historical message' }, key = randomUUID();
    const receipt = await request(`/api/conversations/${conversation.id}/turns`, body, token, { 'idempotency-key': key });
    const assignment = await until(async () => (await request('/api/runner/claim', {}, runner.token)).assignment, value => value !== null); assert.equal(assignment.task.id, receipt.turn.task.id);
    const content = 'Preserved synthetic final', session = randomUUID(), sourceMessageId = randomUUID(), artifactId = randomUUID();
    const events = [{ type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2', resources: ['SVC05 synthetic; no SDK'] },
      { type: 'assistant-final', messageId: sha(JSON.stringify([session, sourceMessageId])), nativeSessionId: session, source: 'claude.sdk.result', sourceMessageId, content,
        settings: { requested: { model: 'synthetic', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } } },
      { type: 'artifact', artifactId, content, title: 'Synthetic historical output', mediaType: 'text/plain', version: sha(content) },
      { type: 'verification', artifactId, artifactVersion: sha(content), verifierId: 'flow.text', verifierVersion: '1', inputDigest: sha(JSON.stringify({ artifactVersion: sha(content), rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Synthetic historical verification' },
      { type: 'completed', outcome: 'succeeded' }].map((event, i) => ({ ...event, id: randomUUID(), sequence: i + 1 }));
    await request('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events }, runner.token);
    return { conversationId: conversation.id, receipt, body, key, taskId: receipt.turn.task.id, content };
  }
  async function snapshot() {
    const tables = ['migrations', 'conversations', 'conversation_turns', 'tasks', 'attempts', 'assistant_messages', 'artifacts', 'details', 'commands']; const result = {};
    for (const table of tables) result[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM flow.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(x => x.row);
    return result;
  }
  const close = async () => {
    const failures = [];
    for (const action of closures.reverse()) { try { await action(); } catch (error) { failures.push(redact(error.message)); } }
    try { await stopCenter(); await pool?.end(); } catch (error) { failures.push(redact(error.message)); }
    let checkpoint = false;
    try { await save('checkpoint.json', { ...report, cleanup: { failures, closedOwnedResources: failures.length === 0, phase: 'before-destructive-cleanup' } }); checkpoint = true; } catch { failures.push('Checkpoint failed; DB/tmp retained'); }
    if (checkpoint && !failures.length) {
      if (created) { const admin = new Pool({ connectionString: ADMIN, max: 1 }); const own = new Pool({ connectionString: dbUrl.href, max: 1 });
        try { assert.deepEqual((await own.query('SELECT id FROM public.svc05_owner')).rows, [{ id: marker }]); await own.end(); await admin.query(`DROP DATABASE "${dbName}"`); report.databaseRemaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [dbName])).rows; }
        catch (error) { failures.push(redact(error.message)); } finally { await own.end().catch(() => {}); await admin.end(); }
      }
      if (!failures.length) { for (const path of checkouts) { try { assert.equal(await git('-C', path, 'status', '--porcelain'), ''); await git('worktree', 'remove', '--force', path); } catch { failures.push('Own checkout cleanup failed'); } } }
      // Preserve verified static artifacts for later approved import; no credentials persist in this directory.
    }
    report.cleanup = { checkpoint, failures, privateArtifactRootRetained: parent, containsPersonalCredentials: false, finishedAt: new Date().toISOString() };
    await save('result.json', report); assert.deepEqual(failures, []);
  };
  try {
    const facts = await inventory(); await save('personal-inventory.json', facts); report.inventory = { observedAt: facts.observedAt, artifacts: facts.artifacts.map(x => x.descriptor) };
    const oldSource = await checkout('old-backend', OLD), source = await checkout('new-backend', BACKEND);
    const artifacts = [];
    for (const [index, entry] of facts.artifacts.entries()) {
      const directory = join(parent, `retained-${index}`); await mkdir(join(directory, 'web-artifacts'), { recursive: true, mode: 0o700 });
      await cp(entry.directory, join(directory, 'web-artifacts', entry.descriptor.artifactId), { recursive: true, dereference: false });
      const verified = await verifyWebArtifact({ directory, artifact: entry.descriptor }); artifacts.push({ label: `retained-${index}`, directory, artifact: entry.descriptor, ...verified });
    }
    const directory = join(parent, 'candidate'); await mkdir(directory, { mode: 0o700 });
    const artifact = await prepareWebArtifact({ repository: source, target: BACKEND, directory, releaseId: RELEASE_ID });
    artifacts.push({ label: 'candidate', directory, artifact, ...await verifyWebArtifact({ directory, artifact }) });
    report.artifacts = artifacts.map(({ label, directory, artifact, manifest }) => ({ label, directory, artifact, manifest })); await save('artifacts.json', report.artifacts);
    const admin = new Pool({ connectionString: ADMIN, max: 1 }); try { await admin.query(`CREATE DATABASE "${dbName}"`); created = true; } finally { await admin.end(); }
    pool = new Pool({ connectionString: dbUrl.href, max: 1 }); await pool.query('CREATE TABLE public.svc05_owner(id uuid PRIMARY KEY)'); await pool.query('INSERT INTO public.svc05_owner VALUES($1)', [marker]);
    await startCenter(oldSource); const history = await seedHistory(); await stopCenter(); const before = await snapshot();
    await startCenter(source); const after = await snapshot();
    const preservation = {};
    for (const [table, rows] of Object.entries(before)) {
      if (table !== 'migrations') assert.equal(after[table].length, rows.length, `Migration changed row count: ${table}`);
      const projected = rows.map(old => {
        const match = after[table].find(row => Object.keys(old).every(key => JSON.stringify(row[key]) === JSON.stringify(old[key])));
        assert.ok(match, `Old row not preserved in ${table}`);
        return Object.fromEntries(Object.keys(old).map(key => [key, match[key]]));
      });
      // Existing rows keep original fields, new nullable 025 column is handled explicitly below.
      assert.deepEqual(projected, rows, `Migration changed old ${table}`); preservation[table] = { rows: rows.length, beforeSha256: sha(JSON.stringify(rows)), oldFieldProjectionSha256: sha(JSON.stringify(projected)) };
    }
    assert.deepEqual(after.migrations.map(x => x.version).sort((a,b)=>a-b), Array.from({ length: 27 }, (_, i) => i + 1));
    const replay = await request(`/api/conversations/${history.conversationId}/turns`, history.body, token, { 'idempotency-key': history.key }); assert.equal(replay.replayed, true); assert.equal(replay.turn.id, history.receipt.turn.id);
    const restored = await request(`/api/conversations/${history.conversationId}`); assert.equal(restored.lastTurn.assistant.text, history.content);
    const contextHistory = await request(`/api/tasks/${history.taskId}/context/history`); report.migration = { from: OLD, to: BACKEND, beforeVersions: before.migrations.map(x=>x.version).sort((a,b)=>a-b), afterVersions: after.migrations.map(x=>x.version).sort((a,b)=>a-b), preservation, historicalReceiptRecovered: true, restoredConversationId: history.conversationId, contextHistory };
    const project = (await request('/api/projects', { title: 'SVC05 isolated resources' })).snapshot.project;
    const capabilities = await request(`/api/projects/${project.id}/attachments/capabilities`);
    assert.equal(capabilities.protocol, 'text-v1');
    const text = 'SVC05 synthetic attachment 中文🙂', uploadKey = randomUUID();
    const uploadBody = { recoveryScopeId: capabilities.recoveryScopeId, name: 'synthetic.txt', mediaType: 'text/plain', text, byteLength: Buffer.byteLength(text), contentDigest: sha(text) };
    const uploaded = await request(`/api/projects/${project.id}/attachments`, uploadBody, token, { 'idempotency-key': uploadKey });
    const goal = (await request('/api/goals', { projectId: project.id, originalGoal: 'SVC05 synthetic goal', constraints: 'No execution', acceptance: 'Read the fixed plan only' })).goal;
    const plan = await request(`/api/goals/${goal.id}/delivery?view=plan&limit=1`);
    assert.ok(!JSON.stringify(plan).includes('SVC05 synthetic goal'));
    assert.equal((await request(`/api/goals/${goal.id}/delivery?view=goal`)).goal.originalGoal, 'SVC05 synthetic goal');
    const explanations = await request(`/api/goals/${goal.id}/delivery?view=explanations&limit=1`);
    assert.equal(contextHistory.current.kind, 'unknown'); assert.equal(contextHistory.remaining.kind, 'unknown'); assert.equal(contextHistory.latest, null);
    await stopCenter(); await startCenter(source); assert.equal((await request(`/api/conversations/${history.conversationId}`)).lastTurn.assistant.text, history.content);
    const restoredUpload = await request(`/api/projects/${project.id}/attachments/upload-receipt?scope=${capabilities.recoveryScopeId}&key=${uploadKey}`);
    assert.deepEqual(restoredUpload.receipt.resource, uploaded.resource);
    assert.equal((await request(`/api/projects/${project.id}/attachments`, uploadBody, token, { 'idempotency-key': uploadKey })).replayed, true);
    report.publicReads = { attachment: { projectId: project.id, capabilities, reference: uploaded.resource.reference, fixedReceiptAfterRestart: true }, goal: { goalId: goal.id, plan, explanations }, contextHistoryUnknown: true };
    await save('public-reads.json', report.publicReads);
    report.migration.restartRead = true; await save('migration.json', report.migration);
    const runner = await request('/api/runners', { name: 'SVC05 deterministic compatibility adapter', harnesses: ['claude'], capacity: 1 }); secrets.push(runner.token);
    const configuration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'svc05-synthetic', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: sha('[]'), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 30000 } };
    const { profile } = await request('/api/runner/execution-profile', { configuration }, runner.token);
    const { runRunner } = await load(source, 'apps/runner/src/runtime.ts'); const { guardExecutionProfile } = await load(source, 'apps/runner/src/execution-profiles.ts'); const { verifyText } = await load(source, 'apps/runner/src/verifier.ts');
    const controller = new AbortController(); let runnerError;
    const adapter = { name: 'claude', version: configuration.adapterVersion, async run(context) {
      const nativeSessionId = context.task.nativeSessionId ?? randomUUID(), sourceMessageId = randomUUID(), artifactId = randomUUID(), content = 'SVC05 synthetic reply: ' + context.task.prompt;
      await context.emit({ type: 'session', nativeSessionId, adapterVersion: configuration.adapterVersion, resources: ['SVC05 deterministic; zero SDK/provider'] });
      await context.assertOwnership(); await context.emit({ type: 'assistant-final', messageId: sha(JSON.stringify([nativeSessionId, sourceMessageId])), nativeSessionId, source: 'claude.sdk.result', sourceMessageId, content,
        settings: { requested: { model: configuration.model, permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } } });
      await context.emit({ type: 'artifact', artifactId, title: 'SVC05 synthetic output', version: sha(content), content, mediaType: 'text/plain' }); await context.emit(verifyText(artifactId, content, context.task.verification));
    } };
    const running = runRunner({ baseUrl: report.centerUrl, token: runner.token, workingDirectory: join(parent, 'runner'), signal: controller.signal, pollIntervalMs: 50, heartbeatIntervalMs: 500, adapters: [guardExecutionProfile(adapter, profile.reference, configuration)] }).catch(error => { if (!controller.signal.aborted) runnerError = error; });
    closures.push(async () => { controller.abort(); await running; if (runnerError) throw runnerError; });
    for (const entry of artifacts) {
      const proxy = await observationProxy(new URL(report.centerUrl).port); closures.push(proxy.close); const port = await freePort();
      // No release pointer exists yet. Vite must honor the candidate artifact's built base.
      const { createRequire } = await import('node:module'); const require = createRequire(join(source, 'apps/web/package.json')); const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
      const web = entry.manifest.format === 1 ? await startStaticWeb({ directory: entry.directory, artifact: entry.artifact, repository: source, webPort: port, centerPort: proxy.port }) : await preview({ root: entry.dist, configFile: false, envDir: false, publicDir: false, logLevel: 'silent', base: `/__flow_releases/${entry.manifest.releaseId}/`, build: { outDir: entry.dist }, preview: { host: '127.0.0.1', port, strictPort: true, open: false, proxy: { '^/api(?:/|$)': { target: `http://127.0.0.1:${proxy.port}`, changeOrigin: false } } } });
      closures.push(async () => { if (web.httpServer) { web.httpServer.closeAllConnections(); await new Promise((resolve,reject)=>web.httpServer.close(e=>e?reject(e):resolve())); } else await web.close(); });
      previews.push({ ...entry, proxy, url: `http://127.0.0.1:${port}` });
    }
    return { previews, profile, token, request, report, save, close, redact };
  } catch (error) { report.failure = redact(error.stack ?? error); await close(); throw error; }
}
