// One bounded acceptance caller. Default mode only reads owned deployment facts.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { queueJourney } from './queue-journey.mjs';

const root = '/Users/citrine/Projects/AgentHarness/Flow';
const webHead = '3d4985fca060155435b159e0467815bf8e88b8b8';
const loadedHead = 'fb906cb42391971a8b315dbd813f7633927d7265';
const privateDirectory = '/Users/citrine/.flow-personal';
const execute = process.argv.includes('--execute-approved-two-query');
const output = new URL(execute ? './queue-live/' : './queue-live-preflight/', import.meta.url).pathname;
const sha = value => createHash('sha256').update(value).digest('hex');
const expectedManifest = { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60000 };
async function privateJson(name) {
  const file = `${privateDirectory}/${name}`, info = await lstat(file);
  assert.ok(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o600 && info.uid === process.getuid() && info.size < 65536);
  return JSON.parse(await readFile(file, 'utf8'));
}
const config = await privateJson('config.json');
const manifest = await privateJson('claude.json');
assert.deepEqual(manifest, expectedManifest);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), webHead);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '');
const { statusPreview } = await import(pathToFileURL(`${root}/tools/personal-preview/preview.mjs`));
const deployment = await statusPreview({ directory: privateDirectory });
assert.equal(deployment.sourceAtStart.head, loadedHead); assert.equal(deployment.sourceAtStart.dirty, false);
assert.deepEqual(deployment.processes, { center: 'running', runner: 'running', web: 'running' });
assert.equal(deployment.database, 'owned'); assert.equal(deployment.work.total, 0); assert.equal(deployment.center.reachable, true);
assert.equal(deployment.profile.model, manifest.model);
const centerUrl = deployment.center.url;
async function read(path) {
  const response = await fetch(`${centerUrl}${path}`, { headers: { authorization: `Bearer ${config.ownerToken}` }, signal: AbortSignal.timeout(3000) });
  assert.ok(response.ok, `Read ${path} returned ${response.status}`); return response.json();
}
const maintenance = await read(`/api/runners/${config.runner.runnerId}/maintenance`);
assert.equal(maintenance.state, 'accepting'); assert.equal(maintenance.activeAttempts, 0); assert.equal(maintenance.uncertainAttempts, 0);
const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000 });
async function counts() {
  return (await pool.query(`SELECT (SELECT count(*)::int FROM flow.tasks) tasks,
    (SELECT count(*)::int FROM flow.attempts WHERE completed_at IS NULL) unfinished_attempts,
    (SELECT count(*)::int FROM flow.runners WHERE NOT revoked) runners`)).rows[0];
}
const initialCounts = await counts(); assert.deepEqual(initialCounts, { tasks: 0, unfinished_attempts: 0, runners: 1 });
const evidence = { kind: execute ? 'live native queue acceptance' : 'read-only real deployment preflight', startedAt: new Date().toISOString(), webHead, loadedHead,
  sdk: '0.3.290', requestedManifest: manifest, configurationDigest: sha(JSON.stringify(manifest)), deployment, maintenance, initialCounts,
  sdkQueryLimit: 2, sdkQueryCount: 0, providerRequestCount: 'unknown', costSemantics: 'Normalized complete SDK modelUsage samples. Resume baseline unknown; sum is a conservative upper bound, not incremental billing.',
  nonce: execute ? `flow-queue-${randomBytes(8).toString('hex')}` : null, steps: [], browsers: [], pageErrors: [], mutations: [], turns: [] };
await mkdir(output, { recursive: true });
async function startTestWeb() {
  const { createServer } = await import(pathToFileURL(`${root}/apps/web/node_modules/vite/dist/node/index.js`));
  const server = await createServer({ root: `${root}/apps/web`, configFile: `${root}/apps/web/vite.config.ts`, define: { 'import.meta.env.VITE_FLOW_FIXTURE': 'false' }, server: { host: '127.0.0.1', port: 0, strictPort: true, proxy: { '/api': { target: centerUrl, changeOrigin: true } } } });
  try { await server.listen(); return server; } catch (error) { await server.close(); throw error; }
}
if (!execute) {
  if (process.argv.includes('--prepare-web')) {
    const server = await startTestWeb();
    try {
      const url = `http://127.0.0.1:${server.httpServer.address().port}`;
      assert.ok((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok);
      assert.ok((await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) })).ok);
      evidence.testWebPreflight = { url, pageReady: true, realCenterProxyReady: true, fixture: false, modelQueries: 0 };
    } finally { await server.close(); }
  }
  await pool.end(); evidence.status = 'PASSED_ZERO_QUERY_PREFLIGHT';
  await writeFile(`${output}/real-deployment-preflight.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, webHead, loadedHead, counts: initialCounts, sdkQueries: 0 }));
  process.exit(0);
}

// The flag is used only after the Goal Owner grants a concrete execution window.
assert.equal(process.env.FLOW_QUEUE_APPROVED_WEB_HEAD, webHead);
await writeFile(`${output}/started.json`, JSON.stringify({ at: evidence.startedAt, webHead, loadedHead }), { flag: 'wx' });
let web, firstQueryAt = 0;
const allowed = new Set(['create', 'turn', 'pause', 'enqueue', 'resume']);
function mutationKind(path) {
  if (path === '/api/conversations') return 'create';
  if (/^\/api\/conversations\/[^/]+\/turns$/.test(path)) return 'turn';
  if (/^\/api\/conversations\/[^/]+\/queue$/.test(path)) return 'enqueue';
  return path.endsWith('/queue/pause') ? 'pause' : path.endsWith('/queue/resume') ? 'resume' : null;
}
async function guardContext(context) {
  await context.route('**/api/**', async route => {
    const request = route.request(); if (request.method() === 'GET') return route.continue();
    const path = new URL(request.url()).pathname, kind = mutationKind(path);
    const elapsed = firstQueryAt ? Date.now() - firstQueryAt : 0;
    if (request.method() !== 'POST' || !allowed.has(kind) || elapsed > 120000 || kind === 'resume' && elapsed > 60000) {
      evidence.mutations.push({ path, blocked: true, at: new Date().toISOString() }); return route.abort('blockedbyclient');
    }
    allowed.delete(kind); if (kind === 'turn') firstQueryAt = Date.now();
    evidence.mutations.push({ path, kind, at: new Date().toISOString() }); return route.continue();
  });
}
async function finishedTurn(conversationId, number) {
  while (Date.now() - firstQueryAt < 120000) {
    const page = await read(`/api/conversations/${conversationId}/turns`), turn = page.turns.find(value => value.number === number);
    if (turn?.assistant.state === 'available') return turn;
    assert.ok(!turn || !['failed', 'cancelled', 'uncertain'].includes(turn.task.status), 'Unsuccessful turn stops acceptance.');
    await sleep(200);
  }
  throw new Error('Two-query acceptance time limit reached.');
}
async function inspectTurn(conversationId, number) {
  const turn = await finishedTurn(conversationId, number), task = await read(`/api/tasks/${turn.task.id}`), details = [];
  for (const entry of task.entries) if (entry.kind === 'reference') details.push(await read(`/api/details/${entry.reference.id}`));
  const usage = details.flatMap(detail => { try { const event = JSON.parse(detail.content); return event.type === 'usage' ? [event] : []; } catch { return []; } });
  assert.equal(task.status, 'succeeded'); assert.equal(task.verificationStatus, 'passed');
  assert.equal(turn.assistant.source.kind, 'assistant-final'); assert.equal(turn.assistant.source.taskId, task.id); assert.equal(turn.assistant.source.attemptId, task.attempt.id);
  assert.equal(turn.effective.model, manifest.model); assert.equal(turn.effective.runnerRequested.model, manifest.model);
  assert.deepEqual(turn.effective.tools, []);
  assert.ok(usage.length && usage.every(event => event.costKind === 'sdk_estimate' && Number.isFinite(event.costUsd) && event.costUsd >= 0 && event.inputTokens !== null && event.outputTokens !== null), 'Unknown usage halts before promotion.');
  const cost = usage.reduce((sum, event) => sum + event.costUsd, 0); assert.ok(cost <= .20);
  const proof = { turn, task, normalizedSdkUsage: true, usage, conservativeCostUsd: cost, details };
  evidence.turns.push(proof); evidence.sdkQueryCount = evidence.turns.length;
  await writeFile(`${output}/turn-${number}.json`, JSON.stringify(proof, null, 2) + '\n'); return proof;
}
try {
  web = await startTestWeb(); const webUrl = `http://127.0.0.1:${web.httpServer.address().port}`; evidence.testWebUrl = webUrl;
  const result = await queueJourney({ webUrl, token: config.ownerToken, nonce: evidence.nonce, read, output, evidence, prepareContext: guardContext,
    beforeContinue: async ({ conversationId }) => {
      await inspectTurn(conversationId, 1);
      assert.ok(Date.now() - firstQueryAt <= 60000, 'Insufficient time for a second bounded query; keep paused.');
      const attempts = (await pool.query('SELECT id,task_id FROM flow.attempts')).rows; assert.equal(attempts.length, 1);
      evidence.firstCostGate = { at: new Date().toISOString(), attempts: attempts.length, conservativeCostUsd: evidence.turns[0].conservativeCostUsd };
    },
    afterBrowserClose: async ({ secondTaskId }) => {
      const task = await read(`/api/tasks/${secondTaskId}`);
      evidence.afterDedicatedBrowserExit = { at: new Date().toISOString(), taskId: secondTaskId, status: task.status, updatedAt: task.updatedAt };
      evidence.continuedAfterBrowserExit = task.status === 'running' ? 'PROVEN' : 'NOT_PROVEN';
    },
  });
  const second = await inspectTurn(result.conversationId, 2), first = evidence.turns[0];
  assert.equal(second.turn.assistant.text, evidence.nonce); assert.equal(second.turn.assistant.source.nativeSessionId, first.turn.assistant.source.nativeSessionId);
  assert.notEqual(second.task.id, first.task.id); assert.notEqual(second.task.attempt.id, first.task.attempt.id);
  evidence.conservativeCostUsd = evidence.turns.reduce((sum, turn) => sum + turn.conservativeCostUsd, 0); assert.ok(evidence.conservativeCostUsd <= .40);
  evidence.attempts = (await pool.query('SELECT id,task_id,runner_id,native_session_id,completed_at FROM flow.attempts ORDER BY task_id')).rows;
  assert.equal(evidence.attempts.length, 2); assert.ok(evidence.attempts.every(attempt => attempt.runner_id === config.runner.runnerId));
  evidence.status = 'PASSED_TWO_QUERY_QUEUE_AND_VISIBLE_MEMORY';
} catch (error) { evidence.status = 'STOPPED_NO_RETRY'; evidence.error = String(error); process.exitCode = 1; }
finally {
  await web?.close(); evidence.endedAt = new Date().toISOString(); evidence.elapsedFromFirstQueryMs = firstQueryAt ? Date.now() - firstQueryAt : null;
  evidence.sdkQueryInvocationsWithKnownUsage = evidence.sdkQueryCount;
  evidence.attempts ??= (await pool.query('SELECT id,task_id,runner_id,native_session_id,completed_at FROM flow.attempts ORDER BY task_id').catch(() => ({ rows: null }))).rows;
  evidence.sdkQueryUpperBound = evidence.attempts?.length ?? 'unknown';
  // A failed acceptance may have called the SDK before any known usage result arrived.
  if (evidence.status !== 'PASSED_TWO_QUERY_QUEUE_AND_VISIBLE_MEMORY') evidence.sdkQueryCount = 'unknown; see attempt upper bound and saved usage';
  evidence.finalCounts = await counts().catch(() => 'unknown'); await pool.end();
  evidence.cleanup = 'Only isolated test browsers and test Vite closed. Personal center/runner/web, database and conversation retained.';
  await writeFile(`${output}/checks.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, sdkQueries: evidence.sdkQueryCount, cost: evidence.conservativeCostUsd, error: evidence.error }));
}
