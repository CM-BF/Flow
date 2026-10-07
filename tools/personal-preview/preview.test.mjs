import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, writeFile, chmod } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { startPreview, statusPreview, stopPreview } from './preview.mjs';

const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const execute = promisify(execFile);
async function removeOwnedFixture(directory) {
  let config;
  try { config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const stopped = await stopPreview({ directory });
  assert.ok(!Object.values(stopped.processes).includes('unknown'), `Retain private state for inspection at ${directory}`);
  const owned = new Pool({ connectionString: config.databaseUrl });
  try {
    const marker = (await owned.query('SELECT installation_id FROM public.flow_preview_owner')).rows;
    assert.deepEqual(marker, [{ installation_id: config.installationId }]);
  } finally { await owned.end(); }
  assert.match(config.databaseName, /^flow_preview_[a-f0-9]{24}$/);
  const admin = new Pool({ connectionString: adminUrl });
  try { await admin.query(`DROP DATABASE "${config.databaseName}"`); } finally { await admin.end(); }
}
test('starts an owned empty preview without a model request, persists identity, and stops only its services', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-test-'));
  const directory = join(parent, 'personal');
  let config;
  try {
    const boot = await execute(process.execPath, [cli, 'start', '--directory', directory], { env: { ...process.env, FLOW_PREVIEW_ADMIN_URL: adminUrl }, timeout: 100_000 });
    const started = JSON.parse(boot.stdout); // The launching CLI has exited; detached services remain owned and running.
    assert.equal(started.center.reachable, true);
    assert.equal(started.processes.runner, 'running');
    assert.equal(started.provider, 'not-probed');
    assert.deepEqual({ source: started.profile.source, model: started.profile.model }, { source: 'runner-configured', model: 'claude-sonnet-5-5' });
    assert.equal(started.work.total, 0);
    assert.equal(started.webArtifact.state, 'verified');
    assert.equal(started.webArtifact.serving, 'confirmed');
    assert.equal(started.webArtifact.sourceHead, started.sourceAtStart.head);
    assert.deepEqual(await (await fetch(`${started.webUrl}/__flow_preview_identity`)).json(), { artifactId: started.webArtifact.artifactId, sourceHead: started.webArtifact.sourceHead, manifestDigest: started.webArtifact.manifestDigest });
    assert.ok(!(await (await fetch(started.webUrl)).text()).includes('/@vite/client'));
    config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    assert.equal((await stat(join(directory, 'config.json'))).mode & 0o777, 0o600);
    const reported = JSON.stringify(await statusPreview({ directory }));
    for (const secret of [config.ownerToken, config.runner.token, config.adminUrl, config.databaseUrl]) assert.ok(!reported.includes(secret));
    const { stdout } = await execute(process.execPath, [cli, 'status', '--directory', directory], { timeout: 5000 });
    assert.equal(JSON.parse(stdout).installationId, config.installationId);
    assert.ok(!stdout.includes(config.ownerToken));
    const manifest = JSON.parse(await readFile(join(directory, 'claude.json'), 'utf8'));
    assert.deepEqual(manifest, { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60000 });
    assert.equal((await startPreview({ directory })).installationId, started.installationId);
    const stopped = JSON.parse((await execute(process.execPath, [cli, 'stop', '--directory', directory], { timeout: 100_000 })).stdout);
    assert.ok(Object.values(stopped.processes).every(value => value === 'stopped'));
    assert.equal((await statusPreview({ directory })).center.reachable, false);
  } finally {
    await removeOwnedFixture(directory);
    await rm(parent, { recursive: true, force: true });
  }
});

test('refuses expanded native settings, insecure config permissions, or a changed database address', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-policy-')); const directory = join(parent, 'personal');
  try {
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const configPath = join(directory, 'config.json'); const manifestPath = join(directory, 'claude.json');
    const original = await readFile(configPath, 'utf8'); const manifest = await readFile(manifestPath, 'utf8');
    try {
      await chmod(configPath, 0o644);
      await assert.rejects(startPreview({ directory }), { code: 'PRIVATE_FILE_REQUIRED' });
      await chmod(configPath, 0o600);
      const changed = JSON.parse(original); const address = new URL(changed.databaseUrl); address.port = '1'; changed.databaseUrl = address.href;
      await writeFile(configPath, JSON.stringify(changed));
      await assert.rejects(startPreview({ directory }), { code: 'DATABASE_IDENTITY_MISMATCH' });
      await writeFile(configPath, original);
      await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(manifest), allowRead: true }));
      await assert.rejects(startPreview({ directory }), { code: 'NATIVE_CONFIGURATION_CHANGED' });
    } finally { await chmod(configPath, 0o600); await writeFile(configPath, original); await writeFile(manifestPath, manifest); }
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('retains queued work and requires explicit confirmation before a restart may poll it', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-restart-')); const directory = join(parent, 'personal');
  try {
    const first = await startPreview({ directory, adminUrl });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    const response = await fetch(`${first.center.url}/api/tasks`, { method: 'POST', headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json', 'idempotency-key': 'svc01-pending-fixture' }, body: JSON.stringify({ title: 'Unexecuted fixture', prompt: 'Retain this task', harness: 'fixture' }), signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 202); await response.json();
    await stopPreview({ directory });
    await assert.rejects(startPreview({ directory }), { code: 'PENDING_WORK_REQUIRES_CONFIRMATION' });
    const stopped = await statusPreview({ directory });
    assert.ok(Object.values(stopped.processes).every(value => value === 'stopped'));
    assert.equal(stopped.work.pending, 1);
    const second = await startPreview({ directory, confirmPending: true });
    assert.equal(second.installationId, first.installationId);
    assert.equal(second.work.pending, 1); // The Claude-only runner cannot execute this fixture task.
    assert.equal(second.work.total, 1);
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('refuses a changed database ownership marker and never adopts an existing unowned directory', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-marker-')); const directory = join(parent, 'personal');
  try {
    await assert.rejects(startPreview({ directory: parent, adminUrl }));
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    const pool = new Pool({ connectionString: config.databaseUrl });
    try {
      await pool.query("UPDATE public.flow_preview_owner SET directory='/unowned/location'");
      await assert.rejects(startPreview({ directory }), { code: 'DATABASE_NOT_OWNED' });
      assert.equal((await statusPreview({ directory })).database, 'unknown');
    } finally { await pool.query('UPDATE public.flow_preview_owner SET directory=$1', [config.directory]); await pool.end(); }
  } finally { await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true }); }
});

test('does not authenticate to or stop an unrelated listener occupying the recorded port', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'flow-svc01-port-')); const directory = join(parent, 'personal');
  let authentications = 0;
  const foreign = createServer((request, response) => { if (request.headers.authorization) authentications++; response.end('unrelated'); });
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  try {
    await startPreview({ directory, adminUrl }); await stopPreview({ directory });
    const config = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'));
    config.centerPort = foreign.address().port;
    await writeFile(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
    await assert.rejects(startPreview({ directory }), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
    assert.equal((await statusPreview({ directory })).center.reachable, false);
    assert.equal(authentications, 0);
    assert.equal(await (await fetch(`http://127.0.0.1:${foreign.address().port}`, { signal: AbortSignal.timeout(1000) })).text(), 'unrelated');
  } finally {
    foreign.closeAllConnections(); await new Promise(resolve => foreign.close(resolve));
    await removeOwnedFixture(directory); await rm(parent, { recursive: true, force: true });
  }
});

test('Web-only bootstrap, publish and rollback keep actual center and fixture execution alive with explicit API combination evidence', { timeout: 45_000 }, async () => {
  const { realpath, mkdir, symlink } = await import('node:fs/promises');
  const { createHash, randomUUID } = await import('node:crypto'); const { runInNewContext } = await import('node:vm');
  const { prepareWebArtifact, verifyWebArtifact } = await import('./web-artifact.mjs');
  const { spawnOwnedProcess, stopOwnedProcess, inspectOwnedProcess } = await import('./process.mjs');
  const { bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, importPreviewCompatibility } = await import('./preview.mjs');
  const root = fileURLToPath(new URL('../../', import.meta.url)); const hash = value => createHash('sha256').update(value).digest('hex');
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc04-host-'))); const directory = join(parent, 'state'); const webSource = join(parent, 'web');
  const admin = new Pool({ connectionString: adminUrl, max: 1 }); const databaseName = `flow_preview_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const databaseUrl = adminUrl.replace(/postgres$/, databaseName); const owned = []; let created = false; let config;
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  async function port() { const server = createServer(); const value = await listen(server); await new Promise(resolve => server.close(resolve)); return value; }
  async function until(read, predicate) { const end = Date.now() + 10_000; do { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 40)); } while (Date.now() < end); throw new Error('Owned fixture deadline'); }
  async function json(path, value) { await writeFile(path, JSON.stringify(value), { mode: 0o600 }); }
  async function child(path, env) { const record = await spawnOwnedProcess({ args: ['--import', 'tsx', path], cwd: root, env: { PATH: process.env.PATH, ...env } }); owned.push(record); return record; }
  let taskIds = [];
  try {
    await mkdir(directory, { mode: 0o700 }); await mkdir(join(webSource, 'apps/web'), { recursive: true });
    const backendHead = (await execute('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
    config = { format: 1, installationId: randomUUID(), directory, repository: await realpath(root), databaseName, databaseUrl, adminUrl,
      ownerToken: `synthetic-${randomUUID()}`, centerPort: await port(), webPort: await port(), runner: null };
    await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
    const db = new Pool({ connectionString: databaseUrl, max: 1 });
    try { await db.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)'); await db.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, directory]); } finally { await db.end(); }
    await writeFile(join(webSource, '.gitignore'), 'node_modules\n'); await writeFile(join(webSource, 'pnpm-lock.yaml'), 'standalone-web-fixture');
    await writeFile(join(webSource, 'apps/web/package.json'), '{"type":"module"}');
    await symlink(join(root, 'apps/web/node_modules'), join(webSource, 'apps/web/node_modules'));
    await writeFile(join(webSource, 'apps/web/index.html'), '<html><body>release-one<script type="module" src="/main.js"></script></body></html>');
    // This compiled Web consumer performs actual authenticated read/send/recovery/negotiation.
    const consumer = async (base, token, profile, nonce) => {
      async function request(path, method = 'GET', body, key, more = {}) {
        const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}), ...more }, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!response.ok) throw new Error(`Consumer HTTP ${response.status}`); return response.json();
      }
      const created = await request('/api/conversations', 'POST', { title: nonce, executionProfile: profile }, `create-${nonce}`);
      const id = created.conversation.id; const body = { expectedRevision: 0, text: `synthetic ${nonce}`, mode: 'follow-up' }; const key = `send-${nonce}`;
      const accepted = await request(`/api/conversations/${id}/turns`, 'POST', body, key);
      const recovered = await request(`/api/conversations/${id}/turns`, 'POST', body, key);
      const legacy = await request(`/api/conversations/${id}`); const stream = await request(`/api/conversations/${id}`, 'GET', undefined, undefined, { 'X-Flow-Assistant-Stream': 'patch-v1' });
      const task = await request(`/api/tasks/${accepted.turn.task.id}`);
      const profiles = await request('/api/execution-profiles'); const native = await request('/api/execution-profiles', 'GET', undefined, undefined, { 'X-Flow-Execution-Profile': 'steering-v1' });
      const denied = await fetch(base + `/api/conversations/${id}`);
      return { taskId: task.id, conversationId: id, observations: {
        read: { ownerAuthenticated: denied.status === 401, conversationBound: legacy.conversation.id === id, taskBound: task.id === legacy.lastTurn.task.id },
        send: { acceptedTurnBound: accepted.turn.conversationId === id && accepted.turn.user.text === body.text && accepted.turn.number === 1, requestedProfilePreserved: accepted.conversation.executionProfile.id === profile.id },
        recover: { sameKey: recovered.replayed === true, sameBody: recovered.turn.user.text === body.text, sameTurn: recovered.turn.id === accepted.turn.id },
        negotiation: { legacyReadable: legacy.capabilities.liveAssistantText === false, streamHeaderHandled: stream.capabilities.liveAssistantText === true, profileHeaderHandled: profiles.profiles.some(item => item.reference.id === profile.id) && native.profiles.some(item => item.reference.id === profile.id) },
      } };
    };
    await writeFile(join(webSource, 'apps/web/main.js'), `globalThis.fixtureConsumer=${consumer.toString()};`);
    await execute('git', ['init', '-q', webSource]); await execute('git', ['-C', webSource, 'add', '.']);
    const commit = async name => { await execute('git', ['-C', webSource, '-c', 'user.name=Flow Test', '-c', 'user.email=fixture@example.invalid', 'commit', '-qam', name]); return (await execute('git', ['-C', webSource, 'rev-parse', 'HEAD'])).stdout.trim(); };
    const oldSource = await commit('old-web'); const oldArtifact = await prepareWebArtifact({ directory, repository: webSource, target: oldSource });
    await writeFile(join(webSource, 'apps/web/index.html'), '<html><body>release-two<script type="module" src="/main.js"></script></body></html>');
    const newSource = await commit('new-web-additive'); const nextArtifact = await prepareWebArtifact({ directory, repository: webSource, target: newSource, releaseId: 'ab'.repeat(16) });
    assert.notEqual(oldSource, newSource); assert.notEqual(backendHead, newSource);
    const centerScript = join(parent, 'center.mjs');
    await writeFile(centerScript, `const {createServer}=await import(${JSON.stringify(`${root}apps/server/src/index.ts`)});const app=await createServer({databaseUrl:process.env.DATABASE_URL,ownerToken:process.env.FLOW_TOKEN});await app.listen({host:'127.0.0.1',port:Number(process.env.PORT)});process.on('SIGTERM',()=>void app.close());`);
    const centerRecord = await child(centerScript, { DATABASE_URL: databaseUrl, FLOW_TOKEN: config.ownerToken, PORT: String(config.centerPort) });
    const centerUrl = `http://127.0.0.1:${config.centerPort}`; const webUrl = `http://127.0.0.1:${config.webPort}`;
    await until(async () => { try { return (await fetch(`${centerUrl}/api/health`)).ok; } catch { return false; } }, Boolean);
    const call = async (path, body, token = config.ownerToken) => { const response = await fetch(centerUrl + path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); assert.ok(response.ok, `${path}: ${response.status}`); return response.json(); };
    config.runner = await call('/api/runners', { name: 'SVC04 synthetic only', harnesses: ['claude'], capacity: 1 });
    const configuration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: hash('[]'), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } };
    const profile = (await call('/api/runner/execution-profile', { configuration }, config.runner.token)).profile;
    const runnerScript = join(parent, 'runner.mjs'); const finished = join(parent, 'finish');
    await writeFile(runnerScript, `import {readFile} from 'node:fs/promises';import {setTimeout as sleep} from 'node:timers/promises';import {randomUUID,createHash} from 'node:crypto';
const {runRunner}=await import(${JSON.stringify(`${root}apps/runner/src/runtime.ts`)});const {guardExecutionProfile}=await import(${JSON.stringify(`${root}apps/runner/src/execution-profiles.ts`)});const {verifyText}=await import(${JSON.stringify(`${root}apps/runner/src/verifier.ts`)});const stop=new AbortController();process.on('SIGTERM',()=>stop.abort());
const adapter={name:'claude',version:'claude-sdk-0.3.290-v2',async run(c){const session=randomUUID();await c.emit({type:'session',nativeSessionId:session,adapterVersion:this.version,resources:['SVC04 deterministic fixture; no SDK/provider']});while(true){try{await readFile(${JSON.stringify(finished)});break;}catch{await sleep(40,undefined,{signal:c.signal});}}await c.assertOwnership();const content='synthetic reply '+c.task.prompt;const digest=createHash('sha256').update(content).digest('hex');const id=randomUUID();const sourceMessageId=randomUUID();const messageId=createHash('sha256').update(JSON.stringify([session,sourceMessageId])).digest('hex');await c.emit({type:'assistant-final',messageId,nativeSessionId:session,source:'claude.sdk.result',sourceMessageId,content,settings:{requested:{model:'synthetic',permissionMode:'dontAsk',thinking:'disabled'},effective:{model:null,permissionMode:null,tools:null,thinking:'unknown'}}});await c.emit({type:'artifact',artifactId:id,title:'Synthetic output',version:digest,content,mediaType:'text/plain'});await c.emit(verifyText(id,content,c.task.verification));}};
await runRunner({baseUrl:process.env.FLOW_URL,token:process.env.FLOW_RUNNER_TOKEN,workingDirectory:process.env.WORKDIR,signal:stop.signal,pollIntervalMs:30,heartbeatIntervalMs:250,adapters:[guardExecutionProfile(adapter,${JSON.stringify(profile.reference)},${JSON.stringify(configuration)})]});`);
    const runnerRecord = await child(runnerScript, { FLOW_URL: centerUrl, FLOW_RUNNER_TOKEN: config.runner.token, WORKDIR: join(parent, 'runner') });
    const webScript = join(parent, 'web.mjs'); await writeFile(webScript, `const {startStaticWeb}=await import(${JSON.stringify(`${root}tools/personal-preview/static-web.mjs`)});const web=await startStaticWeb(${JSON.stringify({ directory, repository: root, artifact: oldArtifact, webPort: config.webPort, centerPort: config.centerPort })});process.on('SIGTERM',()=>void web.close());`);
    const webRecord = await child(webScript, {});
    await until(async () => { try { return (await fetch(webUrl)).ok; } catch { return false; } }, Boolean);
    await json(join(directory, 'config.json'), config); await json(join(directory, 'state.json'), { source: { head: backendHead, dirty: false }, webArtifact: oldArtifact, processes: { center: centerRecord, runner: runnerRecord, web: webRecord } });
    const records = {};
    for (const artifact of [oldArtifact, nextArtifact]) {
      const verified = await verifyWebArtifact({ directory, artifact }); const context = { fetch, document: { body: { dataset: {} }, createElement: () => ({ relList: { supports: () => true } }) } };
      for (const file of verified.manifest.files.filter(item => item.path.endsWith('.js'))) runInNewContext(await readFile(join(verified.dist, file.path), 'utf8'), context);
      const result = await context.fixtureConsumer(webUrl, config.ownerToken, profile.reference, randomUUID()); taskIds.push(result.taskId);
      const reportDirectory = join(parent, artifact.artifactId); await mkdir(reportDirectory); const checks = {};
      for (const [check, observations] of Object.entries(result.observations)) {
        assert.ok(Object.values(observations).every(value => value === true), JSON.stringify({ check, observations }));
        const raw = JSON.stringify({ format: 1, check, backendHead, artifactId: artifact.artifactId, observations }); checks[check] = hash(raw); await writeFile(join(reportDirectory, `${check}.json`), raw);
      }
      await json(join(reportDirectory, 'report.json'), { format: 1, policy: 'flow-web-api-v1', backendHead, artifact, checks });
      records[artifact.artifactId] = (await importPreviewCompatibility({ directory, reportDirectory })).compatibilityId;
      console.log('SVC04 exact compatibility fixture report', JSON.stringify({ report: { format: 1, policy: 'flow-web-api-v1', backendHead, artifact, checks }, observations: result.observations, compatibilityId: records[artifact.artifactId] }));
    }
    await until(() => call(`/api/tasks/${taskIds[0]}`), value => value.status === 'running');
    const before = await call(`/api/tasks/${taskIds[0]}`);
    await assert.rejects(bootstrapPreviewWeb({ directory, expectedVersion: 0, expectedBackendHead: '0'.repeat(40), compatibilityId: records[oldArtifact.artifactId] }), { code: 'WEB_BACKEND_SOURCE_MISMATCH' });
    assert.equal(await inspectOwnedProcess(webRecord), 'running');
    const bootstrap = await bootstrapPreviewWeb({ directory, expectedVersion: 0, expectedBackendHead: backendHead, compatibilityId: records[oldArtifact.artifactId] }); assert.equal(bootstrap.release.version, 1);
    const afterBootstrap = JSON.parse(await readFile(join(directory, 'state.json'))); owned.push(afterBootstrap.processes.web);
    assert.deepEqual(afterBootstrap.processes.center, centerRecord); assert.deepEqual(afterBootstrap.processes.runner, runnerRecord);
    const options = { directory, artifact: nextArtifact, expectedVersion: 1, expectedBackendHead: backendHead, compatibilityId: records[nextArtifact.artifactId] };
    await assert.rejects(publishPreviewWeb({ ...options, compatibilityId: '0'.repeat(64) }), { code: 'WEB_COMPATIBILITY_INVALID' });
    assert.ok((await (await fetch(webUrl)).text()).includes('release-one'));
    const competing = await Promise.allSettled([publishPreviewWeb(options), publishPreviewWeb(options)]);
    assert.equal(competing.filter(value => value.status === 'fulfilled').length, 1);
    assert.ok(['OPERATION_IN_PROGRESS_OR_UNCONFIRMED', 'WEB_RELEASE_VERSION_CONFLICT'].includes(competing.find(value => value.status === 'rejected').reason.code));
    assert.ok((await (await fetch(webUrl)).text()).includes('release-two'));
    assert.equal((await call(`/api/tasks/${taskIds[0]}`)).status, 'running');
    const rolled = await rollbackPreviewWeb({ ...options, artifact: oldArtifact, expectedVersion: 2, compatibilityId: records[oldArtifact.artifactId] }); assert.equal(rolled.release.version, 3);
    const after = JSON.parse(await readFile(join(directory, 'state.json')));
    await assert.rejects((await import('./preview.mjs')).preparePreviewWeb(config, '0'.repeat(40)), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    assert.equal(await inspectOwnedProcess(centerRecord), 'running');
    assert.deepEqual(after.processes, afterBootstrap.processes); assert.deepEqual(after.source, afterBootstrap.source);
    assert.equal((await call(`/api/tasks/${taskIds[0]}`)).attempt.id, before.attempt.id);
    // An owned Web restart failure retains the last artifact and never signals the background roles.
    assert.equal(await stopOwnedProcess(after.processes.web), 'stopped');
    const foreign = createServer((_request, response) => response.end('unrelated listener'));
    await new Promise(resolve => foreign.listen(config.webPort, '127.0.0.1', resolve));
    try {
      await assert.rejects(bootstrapPreviewWeb({ directory, expectedVersion: 3, expectedBackendHead: backendHead, compatibilityId: records[oldArtifact.artifactId] }), { code: 'WEB_BOOTSTRAP_UNCONFIRMED' });
      const failed = JSON.parse(await readFile(join(directory, 'state.json'))); owned.push(failed.processes.web);
      assert.equal(failed.webReleaseOperation.outcome, 'unknown'); assert.deepEqual(failed.source, after.source);
      assert.deepEqual(failed.processes.center, centerRecord); assert.deepEqual(failed.processes.runner, runnerRecord);
      assert.equal((await call(`/api/tasks/${taskIds[0]}`)).status, 'running');
      assert.equal(await (await fetch(webUrl)).text(), 'unrelated listener');
      assert.equal(JSON.parse(await readFile(join(directory, 'web-release.json'))).current, oldArtifact.artifactId);
    } finally { foreign.closeAllConnections(); await new Promise(resolve => foreign.close(resolve)); }
    const retry = await bootstrapPreviewWeb({ directory, expectedVersion: 3, expectedBackendHead: backendHead, compatibilityId: records[oldArtifact.artifactId] });
    assert.equal(retry.release.version, 3); // Explicit retry restores observation; no extra publication/version.
    await writeFile(finished, 'finish');
    for (const id of taskIds) await until(() => call(`/api/tasks/${id}`), value => value.status === 'succeeded');
    assert.equal(await inspectOwnedProcess(centerRecord), 'running'); assert.equal(await inspectOwnedProcess(runnerRecord), 'running');
    console.log('SVC04 owned HTTP/PG fixture', JSON.stringify({ backendHead, oldWebSource: oldSource, newWebSource: newSource, compatibilityRecords: Object.values(records), tasks: taskIds.length, final: 'succeeded', operatorProviderQueries: 0, backendAndRunnerIdentityPreserved: true }));
  } finally {
    // Capture any newly owned Web wrapper even if bootstrap verification failed.
    try { const state = JSON.parse(await readFile(join(directory, 'state.json'))); if (state.processes?.web && !owned.some(value => value.pid === state.processes.web.pid)) owned.push(state.processes.web); } catch {}
    const unknown = [];
    for (const record of owned.reverse()) if (await stopOwnedProcess(record) !== 'stopped') unknown.push(record.group);
    if (unknown.length) { await admin.end(); throw new Error(`Owned groups require inspection; retain ${directory}: ${unknown.join(',')}`); }
    if (created) await admin.query(`DROP DATABASE "${databaseName}"`);
    console.log('SVC04 cleanup', JSON.stringify({ databaseName, remaining: (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows }));
    await admin.end(); await rm(parent, { recursive: true, force: true });
  }
});


// SVC08: real private files/lock/compatibility validation, injected DB marker and process ports.
// No PG, listener, detached service, build, SDK or personal installation is started by these cases.
async function hostReplacementFixture(run, options = {}) {
  const { realpath, mkdir, lstat, readdir } = await import('node:fs/promises');
  const { createHash, randomUUID } = await import('node:crypto');
  const { createWebHostReplacement, inspectPreviewWebHostSource } = await import('./preview.mjs');
  const hash = value => createHash('sha256').update(value).digest('hex');
  const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc08-host-')));
  const ownership = await lstat(directory);
  const head = 'af51c621696230fbced12227670f014ca73bd8a1';
  const config = { format: 1, installationId: randomUUID(), directory, repository: root, databaseName: 'flow_preview_' + 'ab'.repeat(12),
    databaseUrl: 'postgresql://synthetic:synthetic@127.0.0.1:1/flow_preview_' + 'ab'.repeat(12), adminUrl: 'postgresql://synthetic:synthetic@127.0.0.1:1/postgres',
    centerPort: 2, webPort: 3, ownerToken: 'synthetic-not-used' };
  const json = (name, value) => writeFile(join(directory, name), JSON.stringify(value)+'\n', { mode: 0o600 });
  const processRecord = (role, pid) => ({ role, pid, group: pid, nonce: `synthetic-${role}`, startedAt: 'synthetic', command: `synthetic --flow-preview=synthetic-${role}` });
  const original = { source: { head, dirty: false }, processes: { center: processRecord('center', 80001), runner: processRecord('runner', 80002), web: processRecord('web', 80003) }, startedAt: '2026-10-01T00:00:00.000Z', lastError: null };
  const calls = { marker: 0, stop: 0, spawn: 0, ready: 0, stoppedRoles: [] };
  let cleaned = false; let bytes = 0;
  try {
    await json('config.json', config); await json('state.json', original);
    await json('claude.json', { model: 'synthetic', maxTurns: 2 }); await json('maintenance.json', { phase: 'accepting', version: 18 });
    const artifacts = []; const compatibilityIds = {};
    const checks = { read: ['ownerAuthenticated','conversationBound','taskBound'], send: ['acceptedTurnBound','requestedProfilePreserved'], recover: ['sameKey','sameBody','sameTurn'], negotiation: ['legacyReadable','streamHeaderHandled','profileHeaderHandled'] };
    for (let index = 0; index < 3; index++) {
      const content = Buffer.from(`<html>synthetic retained ${index}</html>`); const sourceHead = String(index+1).repeat(40);
      const manifest = Buffer.from(JSON.stringify({ format: 2, policy: 'flow-static-web-v2', releaseId: String(index+1).repeat(32), sourceHead,
        files: [{ path: 'index.html', bytes: content.length, sha256: hash(content) }], totalBytes: content.length })+'\n');
      const artifact = { artifactId: hash(manifest), manifestDigest: hash(manifest), sourceHead }; artifacts.push(artifact);
      const dist = join(directory, 'web-artifacts', artifact.artifactId, 'dist'); await mkdir(dist, { recursive: true, mode: 0o700 });
      await writeFile(join(dist, 'index.html'), content); await writeFile(join(dist, '../manifest.json'), manifest, { mode: 0o600 });
      const raw = {}; const hashes = {};
      for (const [check, fields] of Object.entries(checks)) {
        raw[check] = JSON.stringify({ format: 1, check, backendHead: head, artifactId: artifact.artifactId, observations: Object.fromEntries(fields.map(key => [key,true])) }); hashes[check] = hash(raw[check]);
      }
      const report = JSON.stringify({ format: 1, policy: 'flow-web-api-v1', backendHead: head, artifact, checks: hashes }); const id = hash(report); compatibilityIds[artifact.artifactId] = id;
      const path = join(directory, 'web-compatibility', id); await mkdir(path, { recursive: true, mode: 0o700 });
      for (const [check, text] of Object.entries(raw)) await writeFile(join(path, `${check}.json`), text, { mode: 0o600 });
      await writeFile(join(path, 'report.json'), report, { mode: 0o600 });
    }
    const release = { format: 1, policy: 'flow-web-release-v1', version: 3, backendHead: head, compatibilityIds, artifacts, current: artifacts[2].artifactId, updatedAt: '2026-10-01T00:00:00.000Z' };
    await json('web-release.json', release);
    const protectedBytes = Object.fromEntries(await Promise.all(['config.json','claude.json','maintenance.json','web-release.json'].map(async name => [name, await readFile(join(directory,name),'utf8')])));
    let runtime; let resolveRuntime; let hostRoot = root; let hostArtifact;
    let source = await inspectPreviewWebHostSource({ directory }); assert.equal(source.location.kind, 'legacy-repository'); assert.equal(source.location.artifactId, null);
    if (options.webHost) {
      // Source-only stand-in, not a built/verified backend artifact. The trusted port
      // tests selection and lifecycle; actual artifact qualification remains separate.
      hostArtifact = { policy: 'flow.backend-artifact.v1', artifactId: 'a'.repeat(64), manifestDigest: 'a'.repeat(64), sourceHead: '4'.repeat(40) };
      hostRoot = join(directory, 'synthetic-host-source');
      const files = [];
      for (const item of source.files) {
        const path = join(hostRoot, 'tools/personal-preview', item.path);
        await mkdir((await import('node:path')).dirname(path), { recursive: true, mode: 0o700 });
        const bytes = await readFile(join(root, 'tools/personal-preview', item.path));
        await writeFile(path, bytes); files.push({ path: item.path, bytes: bytes.length, sha256: hash(bytes) });
      }
      const location = { kind: 'backend-artifact', artifactId: hostArtifact.artifactId };
      source = { policy: 'flow.web-host-source.v1', location, digest: hash(JSON.stringify({ location, files })), files };
      resolveRuntime = async (_config, artifact) => {
        if (options.runtimeFailure) throw Object.assign(new Error(options.runtimeFailure), { code: options.runtimeFailure });
        if (!artifact) return { root, entry: join(root, 'tools/personal-preview/cli.mjs'), artifact: null };
        assert.deepEqual(artifact, hostArtifact);
        return { root: hostRoot, entry: join(hostRoot, 'tools/personal-preview/cli.mjs'), artifact };
      };
      const { serviceRuntime } = await import('./backend-release/host.mjs');
      runtime = (input, state, role) => serviceRuntime(input, state, role, resolveRuntime);
    }
    const request = { directory, operationId: randomUUID(), expectedVersion: 3, expectedBackendHead: head, compatibilityId: compatibilityIds[release.current],
      expectedWebRecordSha256: hash(JSON.stringify(original.processes.web)), expectedPointerSha256: hash(protectedBytes['web-release.json']), expectedHostSourceDigest: source.digest, allowConnectionInterruption: true,
      ...(hostArtifact ? { webHostArtifact: hostArtifact } : {}) };
    const journalPath = id => join(directory, 'web-host-operations', `${id ?? request.operationId}.json`);
    const processes = {
      inspect: async () => 'running', ownsListener: async () => true,
      stop: async record => {
        calls.stop++; calls.stoppedRoles.push(record.role);
        const journal = JSON.parse(await readFile(journalPath(), 'utf8')); assert.equal(journal.phase, 'reserved'); assert.equal(journal.outcome, 'pending');
        assert.equal((await stat(journalPath())).mode & 0o777, 0o600);
        const pending = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')).pendingWebHost;
        assert.equal(pending.operationId, request.operationId); assert.deepEqual(pending.artifact, hostArtifact ?? null); assert.equal(pending.source.digest, source.digest);
        await options.beforeStop?.(directory); return options.stopOutcome ?? 'stopped';
      },
      spawn: async value => {
        calls.spawn++; assert.deepEqual(value.args, [join(hostRoot,'tools/personal-preview/cli.mjs'),'internal-service',directory,'web']); assert.equal(value.cwd, hostRoot);
        const record = processRecord('web', 80004); await value.onSpawn(record);
        assert.deepEqual(JSON.parse(await readFile(join(directory,'state.json'),'utf8')).processes.web, record);
        if (options.spawnFailure) throw new Error('synthetic start failure');
        return record;
      },
      ready: async () => { calls.ready++; await options.onReady?.(directory); },
    };
    const replace = createWebHostReplacement({ marker: async () => { calls.marker++; }, processes,
      ...(runtime ? { runtime } : {}),
      ...(options.checkpointFailure ? { checkpoint: async () => { throw new Error('synthetic fsync failure'); } } : {}) });
    await run({ directory, config, root, hostRoot, hostArtifact, runtime, resolveRuntime, request, replace, calls, original, release, source, protectedBytes, journalPath, json, hash, randomUUID, processes });
    async function size(path) { for (const item of await readdir(path, { withFileTypes: true })) { const file=join(path,item.name); if(item.isDirectory()) await size(file); else { assert.ok(item.isFile()); bytes+=(await lstat(file)).size; } } }
    await size(directory); assert.ok(bytes < 1024*1024);
  } finally {
    const actual = await lstat(directory); assert.equal(actual.dev, ownership.dev); assert.equal(actual.ino, ownership.ino); assert.ok(actual.isDirectory() && !actual.isSymbolicLink());
    await rm(directory, { recursive: true }); cleaned = true;
    console.log('SVC08_HOST_FIXTURE', JSON.stringify({ directory, dev: ownership.dev, ino: ownership.ino, cleaned, bytes, calls, realProcessOperations: 0, PG: 0, provider: 0 }));
  }
}

test('SVC08 replace-host preserves legacy af51 state, pointer and all retained bytes, then observes same operation', async () => {
  await hostReplacementFixture(async f => {
    const result = await f.replace(f.request); assert.equal(result.outcome,'ready'); assert.equal(result.replayed,false);
    const state = JSON.parse(await readFile(join(f.directory,'state.json'),'utf8'));
    assert.deepEqual(state.source,f.original.source); assert.deepEqual(state.processes.center,f.original.processes.center); assert.deepEqual(state.processes.runner,f.original.processes.runner);
    assert.equal(state.startedAt,f.original.startedAt); assert.equal(state.lastError,null); assert.equal(state.backendArtifact,undefined);
    assert.equal(state.webHost.source.location.kind,'legacy-repository'); assert.equal(state.webHost.source.digest,f.source.digest);
    for(const [name,bytes] of Object.entries(f.protectedBytes))assert.equal(await readFile(join(f.directory,name),'utf8'),bytes);
    assert.equal((await f.replace(f.request)).replayed,true); assert.equal(f.calls.stop,1); assert.equal(f.calls.spawn,1); assert.deepEqual(f.calls.stoppedRoles,['web']);
    await assert.rejects(f.replace({...f.request,expectedVersion:4}),{code:'WEB_HOST_OPERATION_CONFLICT'});
    assert.equal(f.calls.spawn,1);
  });
});

test('SVC08 replace-host rejects stale CAS, source, identity, compatibility and missing interruption consent before stop', async () => {
  await hostReplacementFixture(async f => {
    for(const [change,code] of [ [{expectedVersion:4},'WEB_RELEASE_VERSION_CONFLICT'],[{expectedWebRecordSha256:'0'.repeat(64)},'WEB_HOST_RECORD_CHANGED'],[{expectedPointerSha256:'0'.repeat(64)},'WEB_HOST_POINTER_CHANGED'],[{expectedHostSourceDigest:'0'.repeat(64)},'WEB_HOST_SOURCE_CHANGED'],[{compatibilityId:'0'.repeat(64)},'WEB_COMPATIBILITY_INVALID'],[{allowConnectionInterruption:false},'WEB_HOST_REQUEST_INVALID'],[{argv:['unsafe']},'WEB_HOST_REQUEST_INVALID'] ]) await assert.rejects(f.replace({...f.request,operationId:f.randomUUID(),...change}),{code});
    assert.equal(f.calls.stop,0); assert.equal(f.calls.spawn,0);
  });
});

test('SVC08 replace-host checkpoint failure sends no signal or start', async () => {
  await hostReplacementFixture(async f => { await assert.rejects(f.replace(f.request),/synthetic fsync failure/); assert.equal(f.calls.stop,0);assert.equal(f.calls.spawn,0); },{checkpointFailure:true});
});

test('SVC08 replace-host unknown stop cannot repeat or be bypassed by a new operation id', async () => {
  await hostReplacementFixture(async f => {
    await assert.rejects(f.replace(f.request),{code:'WEB_HOST_REPLACEMENT_UNCONFIRMED'});
    assert.equal((await f.replace(f.request)).outcome,'unknown');
    await assert.rejects(f.replace({...f.request,operationId:f.randomUUID()}),{code:'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED'});
    assert.equal(f.calls.stop,1);assert.equal(f.calls.spawn,0);
    assert.equal(JSON.parse(await readFile(f.journalPath(),'utf8')).failure,'WEB_STOP_UNCONFIRMED');
  },{stopOutcome:'unknown'});
});

test('SVC08 replace-host uncertain spawn preserves pending new record and never starts a duplicate', async () => {
  await hostReplacementFixture(async f => {
    await assert.rejects(f.replace(f.request),{code:'WEB_HOST_REPLACEMENT_UNCONFIRMED'});
    const state=JSON.parse(await readFile(join(f.directory,'state.json'),'utf8'));assert.equal(state.processes.web.pid,80004);assert.deepEqual(state.source,f.original.source);
    assert.equal((await f.replace(f.request)).outcome,'unknown'); assert.equal(f.calls.spawn,1);assert.equal(f.calls.stop,1);
    assert.equal(JSON.parse(await readFile(f.journalPath(),'utf8')).phase,'stopped');
  },{spawnFailure:true});
});

test('SVC08 replace-host concurrent command keeps one operation lock and one start', async () => {
  let entered;const atStop=new Promise(resolve=>{entered=resolve;});let release;const held=new Promise(resolve=>{release=resolve;});
  await hostReplacementFixture(async f => {
    const first=f.replace(f.request);try{await atStop;await assert.rejects(f.replace(f.request),{code:'OPERATION_IN_PROGRESS_OR_UNCONFIRMED'});}finally{release();}
    assert.equal((await first).outcome,'ready');assert.equal(f.calls.stop,1);assert.equal(f.calls.spawn,1);
  },{beforeStop:async()=>{entered();await held;}});
});

test('SVC08 replace-host does not claim ready after protected data changed during launch', async () => {
  await hostReplacementFixture(async f => {
    await assert.rejects(f.replace(f.request),{code:'WEB_HOST_REPLACEMENT_UNCONFIRMED'});
    const journal=JSON.parse(await readFile(f.journalPath(),'utf8'));assert.equal(journal.failure,'WEB_HOST_PROTECTED_STATE_CHANGED');assert.equal(journal.outcome,'unknown');
    assert.equal((await f.replace(f.request)).outcome,'unknown');assert.equal(f.calls.spawn,1);
  },{onReady:async directory=>writeFile(join(directory,'maintenance.json'),'{}\n',{mode:0o600})});
});

test('SVC08 replace-host validates noncurrent retained files before touching Web', async () => {
  await hostReplacementFixture(async f => {
    await writeFile(join(f.directory,'web-artifacts',f.release.artifacts[0].artifactId,'dist/index.html'),'tampered retained bytes');
    await assert.rejects(f.replace(f.request),{code:'WEB_ARTIFACT_INTEGRITY_MISMATCH'});assert.equal(f.calls.stop,0);assert.equal(f.calls.spawn,0);
  });
});

test('SVC08 replace-host validates exact retained report and backend bindings before touching Web', async () => {
  await hostReplacementFixture(async f => {
    const noncurrent = f.release.artifacts[0].artifactId;
    const changed = { ...f.release, compatibilityIds: { ...f.release.compatibilityIds, [noncurrent]: '0'.repeat(64) } };
    await f.json('web-release.json', changed);
    const pointerDigest = async () => f.hash(await readFile(join(f.directory, 'web-release.json')));
    await assert.rejects(f.replace({ ...f.request, expectedPointerSha256: await pointerDigest() }), { code: 'WEB_COMPATIBILITY_INVALID' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
    await f.json('web-release.json', { ...f.release, backendHead: '0'.repeat(40) });
    await assert.rejects(f.replace({ ...f.request, expectedPointerSha256: await pointerDigest() }), { code: 'WEB_BACKEND_SOURCE_MISMATCH' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  });
});


test('SVC08 replace-host CLI rejects extra request authority before any real marker or process port', async () => {
  await hostReplacementFixture(async f => {
    const path=join(f.directory,'request.json');const {directory,...body}=f.request;
    await writeFile(path,JSON.stringify({...body,argv:['not-allowed']}),{mode:0o600});
    await assert.rejects(execute(process.execPath,[cli,'web','replace-host','--directory',f.directory,'--request',path],{timeout:2500,maxBuffer:16384}),error=>{
      assert.equal(error.code,1);assert.equal(error.stdout,'');assert.equal(JSON.parse(error.stderr).error,'WEB_HOST_REQUEST_INVALID');return true;
    });
    assert.equal(f.calls.marker,0);assert.equal(f.calls.stop,0);assert.equal(f.calls.spawn,0);
  });
});

test('SVC08 host selection persists only Web artifact and authorizes only its Web service root', async () => {
  await hostReplacementFixture(async f => {
    const { serviceRuntime, assertInstallationSource } = await import('./backend-release/host.mjs');
    assert.equal((await f.replace(f.request)).outcome, 'ready');
    const state = JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8'));
    assert.equal(state.pendingWebHost, undefined); assert.equal(state.backendArtifact, undefined);
    assert.deepEqual(state.webHost.artifact, f.hostArtifact); assert.deepEqual(state.source, f.original.source);
    for (const role of ['center', 'runner']) {
      assert.equal((await serviceRuntime(f.config, state, role, f.resolveRuntime)).root, f.root);
      assert.deepEqual(state.processes[role], f.original.processes[role]);
      await assert.rejects(assertInstallationSource(f.config, f.hostRoot, role, f.resolveRuntime), { code: 'CONFIGURATION_IDENTITY_MISMATCH' });
    }
    assert.equal((await serviceRuntime(f.config, state, 'web', f.resolveRuntime)).root, f.hostRoot);
    await assertInstallationSource(f.config, f.hostRoot, 'web', f.resolveRuntime);
    await assert.rejects(assertInstallationSource(f.config, f.root, 'web', f.resolveRuntime), { code: 'CONFIGURATION_IDENTITY_MISMATCH' });
    await assert.rejects(assertInstallationSource(f.config, f.hostRoot, null, f.resolveRuntime), { code: 'CONFIGURATION_IDENTITY_MISMATCH' });
    await assert.rejects(serviceRuntime(f.config, state, 'maintenance', f.resolveRuntime), { code: 'UNKNOWN_SERVICE' });
    for (const [name, bytes] of Object.entries(f.protectedBytes)) assert.equal(await readFile(join(f.directory, name), 'utf8'), bytes);
    assert.equal((await f.replace(f.request)).replayed, true); assert.equal(f.calls.spawn, 1); assert.equal(f.calls.stop, 1);
  }, { webHost: true });
});

test('SVC08 host selection pending failure cannot fall through legacy Web mutation or grant other roles', async () => {
  await hostReplacementFixture(async f => {
    const { assertInstallationSource } = await import('./backend-release/host.mjs');
    const { bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, startPreviewServices } = await import('./preview.mjs');
    await assert.rejects(f.replace(f.request), { code: 'WEB_HOST_REPLACEMENT_UNCONFIRMED' });
    const state = JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8'));
    assert.deepEqual(state.pendingWebHost.artifact, f.hostArtifact); assert.equal(state.backendArtifact, undefined);
    assert.equal(state.webHost, undefined); assert.equal(state.processes.web.pid, 80004);
    await assertInstallationSource(f.config, f.hostRoot, 'web', f.resolveRuntime);
    for (const role of ['center', 'runner', null]) await assert.rejects(assertInstallationSource(f.config, f.hostRoot, role, f.resolveRuntime), { code: 'CONFIGURATION_IDENTITY_MISMATCH' });
    assert.equal((await f.replace(f.request)).outcome, 'unknown');
    for (const mutate of [bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, startPreview]) await assert.rejects(mutate(f.request), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    await assert.rejects(startPreviewServices(f.config, state), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    await assert.rejects(f.replace({ ...f.request, operationId: f.randomUUID() }), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    assert.equal(f.calls.stop, 1); assert.equal(f.calls.spawn, 1);
  }, { webHost: true, spawnFailure: true });
});

test('SVC08 host selection rejects noncanonical descriptors before marker or stop', async () => {
  await hostReplacementFixture(async f => {
    for (const artifact of [null, { ...f.hostArtifact, path: '/untrusted' }, { ...f.hostArtifact, policy: 'other' }, { ...f.hostArtifact, manifestDigest: '0'.repeat(64) }]) {
      await assert.rejects(f.replace({ ...f.request, webHostArtifact: artifact }), { code: 'BACKEND_DESCRIPTOR_INVALID' });
    }
    assert.equal(f.calls.marker, 0); assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  }, { webHost: true });
});

test('SVC08 host selection forwards source qualification failure before pending or signal', async () => {
  await hostReplacementFixture(async f => {
    await assert.rejects(f.replace(f.request), { code: 'BACKEND_INSTALLATION_SOURCE_MISMATCH' });
    const state = JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8'));
    assert.deepEqual(state, f.original); assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
    await assert.rejects(readFile(f.journalPath()), { code: 'ENOENT' });
  }, { webHost: true, runtimeFailure: 'BACKEND_INSTALLATION_SOURCE_MISMATCH' });
});

test('SVC08 host selection final receipt unknown blocks legacy mutation after pending was cleared', async () => {
  await hostReplacementFixture(async f => {
    const { bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, startPreviewServices } = await import('./preview.mjs');
    await f.replace(f.request);
    const state = JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8'));
    assert.equal(state.pendingWebHost, undefined); assert.deepEqual(state.webHost.artifact, f.hostArtifact);
    // Stand-in for a ready state rename followed by a failed final journal sync.
    // Keep the real saved request/digest/phase; do not rerun an external action.
    const receipt = JSON.parse(await readFile(f.journalPath(), 'utf8'));
    await writeFile(f.journalPath(), JSON.stringify({ ...receipt, outcome: 'unknown', failure: 'WEB_HOST_OPERATION_UNCONFIRMED' })+'\n', { mode: 0o600 });
    for (const mutate of [bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, startPreview]) await assert.rejects(mutate(f.request), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    await assert.rejects(startPreviewServices(f.config, state), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    assert.equal((await f.replace(f.request)).outcome, 'unknown');
    await assert.rejects(f.replace({ ...f.request, operationId: f.randomUUID() }), { code: 'WEB_HOST_PREVIOUS_OPERATION_UNCONFIRMED' });
    assert.equal(f.calls.stop, 1); assert.equal(f.calls.spawn, 1);
  }, { webHost: true });
});

test('SVC09 invalid browser policy and missing configured reports stop before any marker or service action', async () => {
  await hostReplacementFixture(async f => {
    await f.json('browser-session.json', { format: 1, installationId: f.config.installationId, browserSession: { cookieOrigin: 'https://public.example', trustedOrigins: ['https://public.example'], authEpoch: 'one', unknown: true } });
    await assert.rejects(f.replace(f.request), { code: 'BROWSER_CONFIGURATION_INVALID' });
    assert.equal(f.calls.marker, 0); assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
    await f.json('browser-session.json', { format: 1, installationId: f.config.installationId, browserSession: { cookieOrigin: 'https://public.example', trustedOrigins: ['https://public.example'], authEpoch: 'one' } });
    await assert.rejects(f.replace(f.request), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  });
});
test('SVC09 prepare rechecks the same policy pin before a changed file can trigger a build or stop', async () => {
  const { loadPreviewConfiguration, preparePreviewWeb } = await import('./preview.mjs');
  await hostReplacementFixture(async f => {
    const config = await loadPreviewConfiguration(f.directory);
    await f.json('browser-session.json', { format: 1, installationId: f.config.installationId, browserSession: { cookieOrigin: 'https://public.example', trustedOrigins: ['https://public.example'], authEpoch: 'one' } });
    await assert.rejects(preparePreviewWeb(config, f.original.source.head), { code: 'BROWSER_CONFIGURATION_CHANGED' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  });
});
test('SVC09 configured host uses actual backend tuple with all new reports while retaining the old pointer', async () => {
  await hostReplacementFixture(async f => {
    const { backendHead } = await configuredHostProofs(f);
    const spawn = f.processes.spawn; f.processes.spawn = async input => {
      assert.equal(input.env.FLOW_PREVIEW_WEB_BACKEND_HEAD, backendHead);
      assert.equal(input.env.FLOW_BROWSER_SESSION_JSON, undefined);
      assert.notEqual(input.env.FLOW_PREVIEW_WEB_BACKEND_HEAD, f.hostArtifact.sourceHead);
      assert.equal(JSON.parse(input.env.FLOW_PREVIEW_BROWSER_POLICY_IDENTITY).directory, f.directory);
      return spawn(input);
    };
    const result = await f.replace({ ...f.request, expectedBackendHead: backendHead });
    assert.equal(result.outcome, 'ready'); assert.equal(f.calls.stop, 1); assert.equal(f.calls.spawn, 1);
    assert.equal(await readFile(join(f.directory, 'web-release.json'), 'utf8'), f.protectedBytes['web-release.json']);
    const state = JSON.parse(await readFile(join(f.directory, 'state.json')));
    assert.deepEqual(state.processes.center, f.original.processes.center); assert.deepEqual(state.processes.runner, f.original.processes.runner);
  }, { webHost: true });
});

async function configuredHostProofs(f) {
  const { browserCompatibilityContext } = await import('./browser-session-configuration.mjs');
  const { importWebCompatibility } = await import('./web-release.mjs');
  const { mkdir } = await import('node:fs/promises');
    const settings = { cookieOrigin: 'https://public.example', trustedOrigins: ['https://public.example'], authEpoch: 'one' };
    const context = browserCompatibilityContext(settings); const backendHead = 'e'.repeat(40);
    await f.json('browser-session.json', { format: 1, installationId: f.config.installationId, browserSession: settings });
    await f.json('state.json', { ...f.original, source: { head: backendHead, dirty: false } });
    const source = join(f.directory, 'report-fixture'); await mkdir(source);
    for (const artifact of f.release.artifacts) {
      const old = JSON.parse(await readFile(join(f.directory, 'web-compatibility', f.release.compatibilityIds[artifact.artifactId], 'report.json')));
      const hashes = {};
      for (const name of Object.keys(old.checks)) {
        const prior = JSON.parse(await readFile(join(f.directory, 'web-compatibility', f.release.compatibilityIds[artifact.artifactId], name + '.json')));
        const raw = JSON.stringify({ ...prior, format: 2, backendHead, context }); hashes[name] = f.hash(raw);
        await writeFile(join(source, name + '.json'), raw, { mode: 0o600 });
      }
      await writeFile(join(source, 'report.json'), JSON.stringify({ ...old, format: 2, policy: 'flow-web-api-v2', backendHead, context, checks: hashes }), { mode: 0o600 });
      await importWebCompatibility({ directory: f.directory, reportDirectory: source });
    }
  return { backendHead, context };
}

test('SVC09 old independently selected Web implementation is refused before stopping any role', async () => {
  await hostReplacementFixture(async f => {
    const { backendHead } = await configuredHostProofs(f);
    // The stand-in still has every filename: file presence alone is not a capability proof.
    const path = join(f.hostRoot, 'tools/personal-preview/static-web.mjs');
    await writeFile(path, (await readFile(path, 'utf8')).replace('runtimeCompatibility:', 'historicalCompatibility:'));
    await assert.rejects(f.replace({ ...f.request, expectedBackendHead: backendHead }), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
    assert.equal(await readFile(join(f.directory, 'web-release.json'), 'utf8'), f.protectedBytes['web-release.json']);
  }, { webHost: true });
});

test('SVC09 maintenance qualification rejects old tools for configured policy or four retained items', async () => {
  const { assertPreviewMaintenanceRuntime } = await import('./preview.mjs');
  await hostReplacementFixture(async f => {
    const runtime = { root: f.hostRoot };
    // Legacy three-item installations retain their existing dispatch path.
    await assertPreviewMaintenanceRuntime({ ...f.config }, runtime);
    await configuredHostProofs(f);
    await assert.rejects(assertPreviewMaintenanceRuntime({ ...f.config }, runtime), { code: 'MAINTENANCE_HOST_POLICY_UNSUPPORTED' });
    await writeFile(join(f.hostRoot, 'tools/personal-preview/maintenance-host.mjs'), await readFile(join(f.root, 'tools/personal-preview/maintenance-host.mjs')));
    await assertPreviewMaintenanceRuntime({ ...f.config }, runtime);
    const path = join(f.hostRoot, 'tools/personal-preview/maintenance-host.mjs');
    await writeFile(path, (await readFile(path, 'utf8')).replace('await preparePreviewWeb(config,', 'await oldPreparePreviewWeb(config,'));
    await assert.rejects(assertPreviewMaintenanceRuntime({ ...f.config }, runtime), { code: 'MAINTENANCE_HOST_POLICY_UNSUPPORTED' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  }, { webHost: true });
  await hostReplacementFixture(async f => {
    const fourth = { artifactId: '9'.repeat(64), manifestDigest: '9'.repeat(64), sourceHead: '9'.repeat(40) };
    await f.json('web-release.json', { ...f.release, artifacts: [...f.release.artifacts, fourth], compatibilityIds: { ...f.release.compatibilityIds, [fourth.artifactId]: '9'.repeat(64) } });
    await assert.rejects(assertPreviewMaintenanceRuntime({ ...f.config }, { root: f.hostRoot }), { code: 'MAINTENANCE_HOST_POLICY_UNSUPPORTED' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
  }, { webHost: true });
});


test('SVC06 changed startup diagnostics cannot qualify as the selected configured Web host', async () => {
  await hostReplacementFixture(async f => {
    const { backendHead } = await configuredHostProofs(f);
    const path = join(f.hostRoot, 'tools/personal-preview/startup-diagnostics.mjs');
    assert.ok(f.source.files.some(item => item.path === 'startup-diagnostics.mjs'));
    await writeFile(path, (await readFile(path, 'utf8')) + '\n// different selected diagnostics\n');
    await assert.rejects(f.replace({ ...f.request, expectedBackendHead: backendHead }), { code: 'WEB_HOST_POLICY_UNSUPPORTED' });
    assert.equal(f.calls.stop, 0); assert.equal(f.calls.spawn, 0);
    assert.equal(await readFile(join(f.directory, 'web-release.json'), 'utf8'), f.protectedBytes['web-release.json']);
  }, { webHost: true });
});

// Real preview control-flow with only its external effects injected. No socket/PG/native child.
async function slotPreviewFixture(t, { settings = true, processState = 'running', start = false, failReady = false, readiness } = {}) {
  const vm = await import('node:vm');
  const { realpath, mkdir } = await import('node:fs/promises');
  const { randomUUID } = await import('node:crypto');
  const slotModule = await import('./runner-slots.mjs');
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc09a-preview-')));
  t.after(() => rm(directory, { recursive: true }));
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const config = { format: 1, installationId: randomUUID(), directory, repository: root, databaseName: 'flow_preview_' + '1'.repeat(24),
    databaseUrl: 'postgresql://synthetic:fixture@127.0.0.1:55432/flow_preview_' + '1'.repeat(24), adminUrl: 'postgresql://synthetic:fixture@127.0.0.1:55432/postgres', ownerToken: 'fixture-owner', centerPort: 1234, webPort: 1235,
    runner: { runnerId: randomUUID(), token: 'legacy' } };
  await mkdir(join(directory, 'runner'), { mode: 0o700 });
  const json = (name, value) => writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600 });
  await json('config.json', config); await json('claude.json', slotModule.LEGACY_NATIVE_CONFIGURATION);
  const state = { processes: { center: { role: 'center' }, runner: { role: 'runner' }, web: { role: 'web' } }, source: { head: 'a'.repeat(40) } };
  let settingsSlot;
  if (settings) {
    settingsSlot = await slotModule.registerSettingsSlot(config, { format: 1, choices: [{ model: 'claude-sonnet-5-5', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'standard' }] }, async () => ({ runnerId: randomUUID(), token: 'settings' }));
    state.processes['runner-settings'] = { role: 'runner-settings' };
  }
  const artifact = { artifactId: 'b'.repeat(64), manifestDigest: 'b'.repeat(64), sourceHead: 'a'.repeat(40) };
  if (start) state.backendArtifact = artifact;
  await json('state.json', state);
  const calls = [];
  let milliseconds = 0;
  const ports = {
    pg: { Pool: class {
      async query(sql) {
        calls.push(['sql', sql]);
        if (sql.includes('flow_preview_owner')) return { rows: [{ installation_id: config.installationId, directory }] };
        if (sql.includes('to_regclass')) return { rows: [{ tasks: null }] };
        return { rowCount: 1, rows: [] };
      }
      async end() { calls.push(['pool-end']); }
    } },
    './process.mjs': { inspectOwnedProcess: async record => readiness?.owner ?? (record.role === 'runner-settings' ? processState : 'running'), ownsListener: async () => true,
      observeOwnedListener: async () => { calls.push(['listener']); return readiness?.listener ?? { owned: true, ownerState: 'running', phase: 'confirmed', listenerCount: 1, code: null, exitCode: null }; },
      stopOwnedProcess: async record => {
        calls.push(['stop', record.role]);
        if (readiness) calls.push(['persisted-before-stop', JSON.parse(await readFile(join(directory, 'state.json')))]);
        return readiness?.stop ?? (record.role === 'runner-settings' && processState === 'unknown' ? 'unknown' : 'stopped');
      }, spawnOwnedProcess: async input => {
        assert.equal(start, true); const key = input.args.at(-1); const record = { role: key, nonce: randomUUID(), pid: 50000 + calls.filter(call => call[0] === 'spawn').length };
        calls.push(['spawn', key, input.args[0], input.cwd]); await input.onSpawn(record); return record;
      } },
    'node:child_process': { spawn: () => { throw new Error('unexpected spawn'); }, execFile: (_command, _args, _options, callback) => callback(Object.assign(new Error('fixture'), { code: 128, stderr: 'not a git repository' })) },
    './backend-release/host.mjs': { ...(await import('./backend-release/host.mjs')), assertInstallationSource: async () => {},
      ...(start ? { backendRuntime: async () => ({ root, entry: join(root, 'tools/personal-preview/cli.mjs'), artifact }), serviceRuntime: async () => ({ root, entry: join(root, 'tools/personal-preview/cli.mjs'), artifact }) } : {}) },
    ...(start ? { './web-artifact.mjs': { prepareWebArtifact: async () => artifact, verifyWebArtifact: async () => {} } } : {}),
    './environment.mjs': { ...(await import('./environment.mjs')), baseServiceEnvironment: () => ({ PATH: '/usr/bin:/bin' }) },
    './startup-diagnostics.mjs': { ...(await import('./startup-diagnostics.mjs')), readRunnerInitialization: async input => { calls.push(['initialization', input.recordKey, input.runnerId]); return readiness?.initialized ?? true; } },
    ...(readiness ? { 'node:timers/promises': { setTimeout: async ms => { milliseconds += ms; } }, 'node:perf_hooks': { performance: { now: () => milliseconds } } } : {}),
  };
  const context = vm.createContext({ process, Buffer, URL, AbortSignal,
    ...(readiness ? { Date: class extends Date { static now() { return milliseconds; } } } : {}),
    fetch: async (url, options) => {
      if (url.endsWith('/api/health')) {
        calls.push(['health']);
        if (readiness?.healthError) throw readiness.healthError;
      }
      return { ok: !url.endsWith('/api/health') || !readiness?.healthStatus || readiness.healthStatus === 200,
        status: url.endsWith('/api/health') ? readiness?.healthStatus ?? 200 : 200, body: { cancel: async () => {} }, json: async () => {
    if (url.endsWith('/__flow_preview_identity')) return artifact;
    if (url.endsWith('/maintenance')) return { runnerId: config.runner.runnerId, state: 'accepting', version: 21 };
    if (url.endsWith('/api/runners')) return { runnerId: '22222222-2222-4222-8222-222222222222', token: 'new-synthetic-token' };
    if (!start) return options?.headers?.['X-Flow-Execution-Profile'] ? { protocol: 'flow.claude-turn-settings.v1', profiles: [], nextCursor: null } : { profiles: [] };
    if (options?.headers?.['X-Flow-Execution-Profile']) {
      settingsSlot ??= (await slotModule.readRunnerSlots(config))[1];
      if (failReady) throw Object.assign(new Error('wrong catalog'), { code: 'RUNNER_SLOT_PROFILE_MISMATCH' });
      return { protocol: 'flow.claude-turn-settings.v1', profiles: [{ profile: {
        reference: { id: '11111111-1111-4111-8111-111111111111', runnerId: settingsSlot.runner.runnerId, configDigest: settingsSlot.configDigest }, configuration: settingsSlot.configuration,
        source: 'runner-configured', availability: 'not-probed', model: { value: settingsSlot.configuration.model, resolvedModel: null, displayName: settingsSlot.configuration.model, description: '', providerCapabilities: 'unknown' }, createdAt: '2026-10-07T00:00:00.000Z',
        controls: { access: 'configured-policy', queue: false, steer: false, messageSettings: { protocol: 'flow.claude-turn-settings.v1', choices: 'configuration.turnSettings.choices' } } },
        conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } }], nextCursor: null };
    }
    return { profiles: [{ reference: { id: 'legacy-profile', runnerId: config.runner.runnerId }, configuration: { model: 'claude-sonnet-5-5', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60000 } } }] };
  } }; } });
  const url = new URL('./preview.mjs', import.meta.url);
  const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href, initializeImportMeta: meta => { meta.url = url.href; } });
  await module.link(async specifier => {
    const values = ports[specifier] ?? await import(specifier.startsWith('node:') ? specifier : new URL(specifier, url).href);
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context });
  }); await module.evaluate();
  return { directory, config, state, artifact, calls, json, preview: module.namespace };
}
test('SVC09A status reports both actual slot processes while catalog and claim remain unknown', async t => {
  const f = await slotPreviewFixture(t); const value = await f.preview.statusPreview({ directory: f.directory });
  assert.equal(value.processes['runner-settings'], 'running'); assert.equal(value.runnerSlots.slots.length, 2);
  assert.ok(value.runnerSlots.slots.every(slot => slot.configuration === 'unknown' && slot.actualClaim === 'unknown'));
  assert.equal(JSON.stringify(value).includes('fixture-owner'), false); assert.equal(JSON.stringify(value).includes('"token"'), false);
});
test('SVC09A stop covers both recorded runners and preserves any unknown close', async t => {
  const f = await slotPreviewFixture(t, { processState: 'unknown' }); const result = await f.preview.stopPreview({ directory: f.directory });
  assert.equal(result.processes['runner-settings'], 'unknown'); assert.equal(f.calls.filter(call => call[0] === 'stop').length, 4);
  assert.equal(JSON.parse(await readFile(join(f.directory, 'state.json'))).lastError, 'STOP_UNCONFIRMED');
});
test('SVC09A unresolved slot registration cannot hide an already recorded runner from stop', async t => {
  const f = await slotPreviewFixture(t, { settings: false });
  await f.json('runner-settings-intent.json', { state: 'registration-unknown' }); f.state.processes['runner-settings'] = { role: 'runner-settings' }; await f.json('state.json', f.state);
  const result = await f.preview.stopPreview({ directory: f.directory }); assert.equal(result.processes['runner-settings'], 'stopped');
  const status = await f.preview.statusPreview({ directory: f.directory }); assert.equal(status.runnerSlots.state, 'unknown');
});
test('SVC09A settings activation refuses the unqualified legacy runtime before registration or spawn', async t => {
  const f = await slotPreviewFixture(t, { settings: false });
  await assert.rejects(f.preview.activatePreviewMessageSettings({ directory: f.directory, recipe: { format: 1, choices: [] } }), { code: 'RUNNER_SLOTS_ARTIFACT_REQUIRED' });
  await assert.rejects(readFile(join(f.directory, 'runner-settings-intent.json')), { code: 'ENOENT' });
  assert.equal(f.calls.some(call => call[0] === 'stop'), false);
});

test('SVC09A startup launches the two declared runner identities through the existing owned process port', async t => {
  const f = await slotPreviewFixture(t, { start: true }); f.state.processes = {};
  const result = await f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact);
  assert.deepEqual(f.calls.filter(call => call[0] === 'spawn').map(call => call[1]), ['center', 'runner', 'runner-settings', 'web']);
  assert.equal(result.runnerSlots.slots[1].configuration, 'confirmed'); assert.equal(result.runnerSlots.slots[1].actualClaim, 'unknown');
  assert.equal(result.runnerSlots.slots[1].profile.runnerId === f.config.runner.runnerId, false);
});
test('SVC09A startup profile mismatch preserves primary and stops all records created in that start', async t => {
  const f = await slotPreviewFixture(t, { start: true, failReady: true }); f.state.processes = {};
  await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  assert.deepEqual(f.calls.filter(call => call[0] === 'stop').map(call => call[1]), ['runner-settings', 'runner', 'center']);
  const state = JSON.parse(await readFile(join(f.directory, 'state.json'))); assert.equal(state.lastError, 'START_UNCONFIRMED');
  assert.equal(state.startCleanup.length, 3); assert.equal(f.calls.some(call => call[0] === 'spawn' && call[1] === 'web'), false);
});

test('SVC09A explicit activation starts only settings and preserves old runner config and all old process records', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true });
  const configBefore = await readFile(join(f.directory, 'config.json')), manifestBefore = await readFile(join(f.directory, 'claude.json'));
  const processes = structuredClone(f.state.processes);
  const result = await f.preview.activatePreviewMessageSettings({ directory: f.directory, recipe: { format: 1, choices: [{ model: 'claude-sonnet-5-5', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'standard' }] } });
  assert.deepEqual(f.calls.filter(call => call[0] === 'spawn').map(call => call[1]), ['runner-settings']);
  assert.equal(result.runnerSlots.slots[1].configuration, 'confirmed');
  const state = JSON.parse(await readFile(join(f.directory, 'state.json')));
  for (const key of ['center','runner','web']) assert.deepEqual(state.processes[key], processes[key]);
  assert.deepEqual(await readFile(join(f.directory, 'config.json')), configBefore); assert.deepEqual(await readFile(join(f.directory, 'claude.json')), manifestBefore);
});
test('SVC09A failed new-slot readiness never stops the original three services', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, failReady: true });
  await assert.rejects(f.preview.activatePreviewMessageSettings({ directory: f.directory, recipe: { format: 1, choices: [{ model: 'claude-sonnet-5-5', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'standard' }] } }), { code: 'RUNNER_SLOT_PROFILE_MISMATCH' });
  assert.deepEqual(f.calls.filter(call => call[0] === 'stop').map(call => call[1]), ['runner-settings']);
  const state = JSON.parse(await readFile(join(f.directory, 'state.json'))); assert.equal(state.lastError, 'RUNNER_SLOT_START_UNCONFIRMED'); assert.equal(state.settingsCleanup, 'stopped');
});

test('SVC09A CLI forwards only the explicit private settings request and rejects extra arguments', async () => {
  const vm = await import('node:vm');
  const preview = await import('./preview.mjs');
  for (const extra of [false, true]) {
    const calls = [], input = { format: 1, choices: ['synthetic-private-request'] };
    const processPort = { argv: ['node', cli, 'message-settings', '--directory', '/own', '--request', '/request', ...(extra ? ['--force'] : [])], stdout: { write() {} }, stderr: { write() {} } };
    const context = vm.createContext({ process: processPort });
    const module = new vm.SourceTextModule(await readFile(cli, 'utf8'), { context });
    await module.link(async specifier => {
      const value = specifier === './preview.mjs' ? { ...preview, readPreviewJson: async path => { calls.push(path); return input; }, activatePreviewMessageSettings: async args => { calls.push(args); return {}; } }
        : await import(specifier.startsWith('node:') ? specifier : new URL(specifier, import.meta.url).href);
      return new vm.SyntheticModule(Object.keys(value), function () { for (const [key, item] of Object.entries(value)) this.setExport(key, item); }, { context });
    }); await module.evaluate();
    assert.equal(calls.length, extra ? 0 : 2); if (!extra) { assert.equal(calls[0], '/request'); assert.equal(calls[1].directory, '/own'); assert.equal(calls[1].recipe, input); }
    assert.equal(processPort.exitCode, extra ? 1 : undefined);
  }
});

// Controller-only readiness consumers: actual control-flow, no network, PG, service, or provider.
test('SVC09A readiness owner unknown short-circuits and is persisted before cleanup', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { owner: 'unknown' } });
  await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  const saved = f.calls.find(call => call[0] === 'persisted-before-stop')[1];
  assert.equal(saved.lastStartFailure.code, 'SERVICE_EXITED_DURING_START');
  assert.equal(saved.startReadiness.center.predicates.owner.result, 'unknown');
  assert.equal(saved.startReadiness.center.outcome, 'failed');
  assert.equal(saved.startReadiness.center.iterations, 1);
  assert.equal(f.calls.some(call => ['listener', 'health'].includes(call[0])), false);
});

test('SVC09A readiness listener failure retains bounded last result and the unchanged ten second deadline', async t => {
  const listener = { owned: false, ownerState: 'running', phase: 'listener-query', listenerCount: null, code: 'ENOENT', exitCode: null };
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { listener } });
  await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  const trace = f.state.startReadiness.center;
  assert.equal(trace.elapsedMs, 10_000); assert.equal(trace.iterations, 200);
  assert.equal(trace.predicates.listener.iteration, 200); assert.deepEqual(trace.predicates.listener.result, listener);
  assert.equal('health' in trace.predicates, false); assert.equal(f.calls.some(call => call[0] === 'health'), false);
  assert.ok(Buffer.byteLength(JSON.stringify(f.state.startReadiness)) < 2048);
});

test('SVC09A readiness non-success health status keeps the primary when stop is unknown', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { healthStatus: 503, stop: 'unknown' } });
  await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  const state = JSON.parse(await readFile(join(f.directory, 'state.json')));
  assert.deepEqual(state.startReadiness.center.predicates.health.result, { reachable: false, status: 503, code: null });
  assert.equal(state.lastStartFailure.code, 'SERVICE_START_UNCONFIRMED');
  assert.equal(state.startCleanup[0].state, 'unknown');
  assert.equal(state.startReadiness.center.elapsedMs, 10_000);
});

test('SVC09A readiness fetch cause exposes only an allowed code and missing fields stay unknown', async t => {
  for (const code of ['ECONNREFUSED', 'secret-nonstandard-code']) {
    const healthError = new TypeError('sensitive-url-and-body', { cause: Object.assign(new Error('private-detail'), { code, detail: 'private-value' }) });
    const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { healthError } });
    await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
    const result = f.state.startReadiness.center.predicates.health.result;
    assert.equal(result.code, code === 'ECONNREFUSED' ? code : 'STARTUP_UNCONFIRMED'); assert.equal(result.status, null);
    const saved = await readFile(join(f.directory, 'state.json'), 'utf8');
    for (const value of ['sensitive-url-and-body', 'private-detail', 'private-value', 'secret-nonstandard-code']) assert.equal(saved.includes(value), false);
  }
});

test('SVC09A readiness uses the explicit artifact status port after the same three default launches', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: {} });
  let calls = 0;
  const status = await f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact, async ({ directory }) => {
    calls++; assert.equal(directory, f.directory); return { source: 'bound-artifact-public-status' };
  });
  assert.deepEqual(status, { source: 'bound-artifact-public-status' }); assert.equal(calls, 1);
  assert.deepEqual(f.calls.filter(call => call[0] === 'spawn').map(call => call[1]), ['center', 'runner', 'web']);
  for (const role of ['center', 'runner', 'web']) assert.equal(f.state.startReadiness[role].outcome, 'ready');
  assert.equal(f.state.startReadiness.center.predicates.health.result.status, 200);
  assert.equal(f.state.startReadiness.runner.predicates.profile.result, true);
  assert.equal(f.state.startReadiness.web.predicates.webIdentity.result, true);
});

test('SVC09A readiness default status port preserves the original status contract', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: {} });
  const status = await f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact);
  assert.equal(status.installationId, f.config.installationId);
  assert.equal(status.runnerSlots.slots.length, 1); assert.equal(status.provider, 'not-probed');
  assert.equal(status.runnerSlots.slots[0].actualClaim, 'unknown');
});

test('SVC09A readiness invalid status port is rejected before any configuration or process access', async () => {
  const { startPreviewServices } = await import('./preview.mjs');
  await assert.rejects(startPreviewServices(null, null, null, null, {}), { code: 'START_STATUS_PORT_INVALID' });
});


test('SVC06B initialization old profile and live wrapper are insufficient for readiness', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { initialized: false } });
  await assert.rejects(f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact), { code: 'START_UNCONFIRMED_CHECK_STATUS' });
  assert.equal(f.state.lastStartFailure.role, 'runner');
  assert.equal(f.state.startReadiness.runner.predicates.runtimeInitialization.result, false);
  assert.equal(f.state.startReadiness.runner.predicates.profile, undefined);
  assert.deepEqual(f.calls.filter(call => call[0] === 'spawn').map(call => call[1]), ['center', 'runner']);
});

test('SVC06B initialization positive receipt still requires the original profile and leaves claim unknown', async t => {
  const f = await slotPreviewFixture(t, { settings: false, start: true, readiness: { initialized: true } });
  const status = await f.preview.startPreviewServices(f.config, f.state, f.artifact, f.artifact);
  assert.equal(f.state.startReadiness.runner.predicates.runtimeInitialization.result, true);
  assert.equal(f.state.startReadiness.runner.predicates.profile.result, true);
  assert.equal(status.runnerSlots.slots[0].actualClaim, 'unknown');
  assert.deepEqual(f.calls.filter(call => call[0] === 'initialization')[0], ['initialization', 'runner', f.config.runner.runnerId]);
});
