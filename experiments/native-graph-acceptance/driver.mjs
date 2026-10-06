import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir, rm, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { FlowClient } from '../../packages/client/src/index.ts';
import { createServer } from '../../apps/server/src/index.ts';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { describeExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { createGraphToolMount } from '../../apps/runner/src/goal-tool-bridge/policy.ts';
import { adapterOptions, BASE, LIMITS, SCOPE, TITLES, GOAL, CONSTRAINTS, PROMPT, EXPECTED_TOOLS, validatePlan, versions, sourceIdentity } from './config.mjs';
import { reserveAttempt } from './guard.mjs';
import { connectPeer } from './peer.mjs';

export async function preflight() {
  validatePlan(); const dependencies = await versions(); const source = await sourceIdentity();
  const denied = () => { throw new Error('Preflight may not call a graph port'); };
  const mount = createGraphToolMount({ assertOwnership: async () => {}, emit: denied }, { goalId: 'preflight', runId: 'preflight', scope: SCOPE,
    port: { readGraph: denied, readProposal: denied, commandGraph: denied } }, new AbortController());
  const peer = await connectPeer(mount.server);
  let listed;
  try { listed = await peer.listTools(); } finally { await peer.close(); await mount.server.instance.close(); }
  assert.deepEqual([...mount.allowedTools].sort(), [...EXPECTED_TOOLS].sort());
  assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ['graph_command', 'graph_read']);
  return { mode: 'preflight', nativeQueryCalls: 0, providerAuthenticationCalls: 0, dependencies, source, scope: SCOPE,
    candidateLimitsNotAuthorized: LIMITS, sdkServer: { key: mount.key, type: mount.server.type }, tools: listed.tools,
    boundary: 'SDK in-process construction and MCP tools/list only; no query/startup/authentication, HTTP or database.' };
}
async function until(check, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) { const result = await check(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error('Acceptance observation deadline reached');
}
const stoppingWorkers = new WeakMap();
function signalGroup(pgid, signal) {
  try { process.kill(-pgid, signal); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function awaitGroupGone(pgid, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (signalGroup(pgid, 0)) {
    if (performance.now() >= deadline) return false;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  return true;
}
async function stopGroup(child, report) {
  const pgid = child.pid;
  report.workerProcessGroup = { pgid, state: 'unknown' };
  if (!Number.isSafeInteger(pgid) || pgid <= 1) throw new Error('Owned process group is unknown');
  // detached:true makes this worker the Unix group leader. Its exit is not group exit.
  if (signalGroup(pgid, 0)) {
    signalGroup(pgid, 'SIGTERM');
    if (!await awaitGroupGone(pgid, 3000)) {
      report.workerForcedKill = true;
      signalGroup(pgid, 'SIGKILL');
      if (!await awaitGroupGone(pgid, 1000)) throw new Error('Owned process group remains present');
    }
  }
  report.workerProcessGroup.state = 'stopped';
}
export async function stopWorker(child, report) {
  if (!child) return;
  // The observation deadline and finally may both stop the same owned group.
  if (!stoppingWorkers.has(child)) stoppingWorkers.set(child, stopGroup(child, report));
  await stoppingWorkers.get(child);
}
export async function run(mode, outputDirectory, authorization) {
  assert(['rehearsal', 'native'].includes(mode));
  const pre = await preflight();
  // No PG, private credentials or native transport are touched until authorization is reserved.
  if (mode === 'native' && !authorization) throw new Error('Native execution requires a fresh explicit permit path');
  const reservation = mode === 'native' ? await reserveAttempt(authorization, pre.source) : null;
  const output = resolve(outputDirectory); await mkdir(output, { recursive: true, mode: 0o700 });
  const resultPath = join(output, 'result.json');
  await writeFile(resultPath, JSON.stringify({ outcome: 'started-unknown', mode, source: pre.source.digest }) + '\n', { flag: 'wx', mode: 0o600 });
  const report = { mode, base: BASE, source: pre.source, versions: pre.dependencies, nativeQueryCalls: null,
    approvalId: reservation?.permit.approvalId ?? null, attemptMarker: reservation?.marker ?? null, startedAt: new Date().toISOString(),
    outcome: 'unknown', phase: 'prepare-private-resources', cleanup: {}, workerForcedKill: false, boundary: mode === 'native' ? 'Real SDK query requested; success requires center facts and SDK observations.' : 'Injected query transport; real official MCP + public HTTP/PostgreSQL + independent runner process. No native broker/model proof.' };
  const database = `flow_o08_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  let app, child, root, madeDatabase = false, owner, admitted, http, workerReportPath, deadline;
  try {
    root = await realpath(await mkdtemp(join(tmpdir(), 'flow-o08-')));
    await admin.query(`CREATE DATABASE ${database}`); madeDatabase = true;
    const ownerToken = randomUUID();
    app = await createServer({ databaseUrl, ownerToken, leaseMs: 20_000, automaticQueueScan: false });
    const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    owner = new FlowClient({ baseUrl, token: ownerToken });
    http = async (path, body) => {
      const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: {
        authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(),
      }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Local center rejected acceptance setup (${response.status})`);
      return response.json();
    };
    report.phase = 'create-synthetic-project-goal';
    const project = (await http('/api/projects', { title: 'O08 synthetic release plan' })).snapshot.project;
    const goal = (await http('/api/goals', { projectId: project.id, originalGoal: GOAL, constraints: CONSTRAINTS, acceptance: '三个指定标题，按顺序两条依赖；最终明确计划已记录且子任务未执行。' })).goal;
    const runner = await owner.registerRunner({ name: `O08-${mode}`, harnesses: ['claude'], capacity: 1 });
    const options = adapterOptions(mode);
    const configuration = describeExecutionProfile(options, createClaudeAdapter(options));
    const client = new FlowClient({ baseUrl, token: runner.token });
    const published = await client.publishExecutionProfile({ configuration });
    report.phase = 'admit-fixed-grant';
    admitted = await owner.admitGoalGraphRun(goal.id, { scope: SCOPE, prompt: PROMPT,
      execution: { harness: 'claude', executionProfile: published.profile.reference } }, randomUUID());
    report.ids = { database, projectId: project.id, goalId: goal.id, runId: admitted.run.id, taskId: admitted.task.id, runnerId: runner.runnerId };
    report.profile = published.profile;
    const configPath = join(root, 'worker.json'); workerReportPath = join(root, 'worker-report.json');
    const workingDirectory = join(root, 'runner'); await mkdir(workingDirectory, { mode: 0o700 });
    await writeFile(configPath, JSON.stringify({ mode, baseUrl, runnerToken: runner.token, profile: published.profile, workingDirectory,
      reportFile: workerReportPath, sourceDigest: pre.source.digest, permit: reservation?.permit, marker: reservation?.marker }), { mode: 0o600 });
    const rehearsalHome = join(root, 'home'); await mkdir(rehearsalHome, { mode: 0o700 });
    const environment = mode === 'native' ? process.env : { PATH: process.env.PATH, HOME: rehearsalHome, TMPDIR: root, LANG: 'C.UTF-8' };
    report.phase = 'observe-owned-runner';
    child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./worker.mjs', import.meta.url)), configPath],
      { detached: true, stdio: 'ignore', env: environment });
    report.runnerPid = child.pid; report.observationStartedAt = new Date().toISOString();
    const started = performance.now();
    deadline = setTimeout(() => { report.observerDeadlineReached = true; void stopWorker(child, report).catch(() => { report.cleanup.runnerStopped = false; }); }, mode === 'native' ? LIMITS.timeoutMs : 15_000);
    const task = await until(async () => {
      if (child.exitCode !== null || child.signalCode) throw new Error('Runner exited before acceptance finished');
      const task = await owner.show(admitted.task.id, AbortSignal.timeout(5000));
      return ['succeeded', 'failed', 'cancelled', 'uncertain'].includes(task.status) ? task : null;
    }, mode === 'native' ? LIMITS.timeoutMs : 15_000);
    report.phase = 'collect-and-check-facts';
    report.observationMs = performance.now() - started;
    clearTimeout(deadline);
    await stopWorker(child, report);
    const worker = JSON.parse(await readFile(workerReportPath, 'utf8')); report.worker = worker; report.nativeQueryCalls = worker.nativeQueryCalls;
    report.task = task; report.graph = (await http(`/api/projects/${project.id}`)).graph;
    report.audit = await owner.goalGraphRunCalls(admitted.run.id);
    if (report.audit.calls[0]) report.proposal = await owner.goalGraphProposal(report.audit.calls[0].proposalId);
    const messages = await http(`/api/tasks/${task.id}/assistant-messages`);
    report.final = messages.messages.length === 1 ? await http(`/api/assistant-messages/${messages.messages[0].id}`) : null;
    const tasks = await owner.queryTasks({ limit: 10 }); report.totalTasks = tasks.totalSize;
    assert.equal(task.status, 'succeeded'); assert.equal(task.verificationStatus, 'passed');
    assert.equal(worker.queryAdapterCalls, 1); assert.equal(worker.queryClosed, true); assert.equal(worker.nativeQueryCalls, mode === 'native' ? 1 : 0);
    assert.equal(report.totalTasks, 1); assert.equal(report.audit.run.usedProposals, 1); assert.equal(report.audit.run.usedApplications, 1);
    assert.deepEqual(report.audit.calls.map(call => call.kind), ['propose', 'apply']);
    assert(report.audit.calls.every(call => call.runnerId === runner.runnerId && call.attemptId === task.attempt.id && call.ownerVersion === task.attempt.ownerVersion));
    const nodes = report.graph.nodes; assert.equal(nodes.length, 3);
    const ordered = TITLES.map(title => { const node = nodes.find(node => node.title === title); assert(node); return node; });
    assert.deepEqual(ordered.map(node => node.dependsOn), [[], [ordered[0].id], [ordered[1].id]]);
    assert(nodes.every(node => node.taskId === null)); assert.match(report.final.content, /未执行子任务/);
    assert.equal(report.final.taskId, task.id); assert.equal(report.final.attemptId, task.attempt.id); assert.equal(report.final.source, 'claude.sdk.result');
    if (mode === 'native') { assert(worker.effective); assert(worker.result); }
    report.outcome = mode === 'native' ? 'native-acceptance-passed' : 'rehearsal-passed';
  } catch {
    report.failurePhase = report.phase; report.outcome = 'failed-or-unknown'; report.error = 'Acceptance was not established. Do not retry the native approval; inspect saved local facts.';
    if (owner && admitted) {
      try { report.taskAtFailure = await owner.show(admitted.task.id, AbortSignal.timeout(3000)); await owner.cancel(admitted.task.id, randomUUID(), AbortSignal.timeout(3000)); report.cancelRequested = true; } catch { report.cancelRequested = 'unknown'; }
    }
  } finally {
    clearTimeout(deadline);
    try { await stopWorker(child, report); report.cleanup.runnerStopped = true; } catch { report.cleanup.runnerStopped = false; }
    // Preserve partial facts before removing the disposable database, including on timeout/failure.
    if (!report.worker && workerReportPath) {
      try { report.worker = JSON.parse(await readFile(workerReportPath, 'utf8')); report.nativeQueryCalls = report.worker.nativeQueryCalls; } catch {}
    }
    if (owner && admitted && report.ids && http && report.outcome === 'failed-or-unknown') {
      try { report.graphAtFailure = (await http(`/api/projects/${report.ids.projectId}`)).graph; report.auditAtFailure = await owner.goalGraphRunCalls(admitted.run.id); } catch { report.partialFactsUnavailable = true; }
    }
    try { await app?.close(); report.cleanup.centerClosed = true; } catch { report.cleanup.centerClosed = false; }
    try { if (madeDatabase) await admin.query(`DROP DATABASE ${database}`); report.cleanup.databaseRemoved = true; } catch { report.cleanup.databaseRemoved = false; }
    await admin.end();
    try {
      if (!report.cleanup.runnerStopped) throw new Error('Keep private resources until the owned process is confirmed stopped');
      if (root) await rm(root, { recursive: true, force: true }); report.cleanup.privateTemporaryDirectoryRemoved = true;
    } catch { report.cleanup.privateTemporaryDirectoryRemoved = false; }
    if (Object.values(report.cleanup).some(value => value !== true)) { report.failurePhase = 'cleanup'; report.outcome = 'failed-or-unknown'; }
    report.finishedAt = new Date().toISOString();
    await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.join() === '--preflight') process.stdout.write(JSON.stringify(await preflight(), null, 2) + '\n');
    else {
      const mode = args[0] === '--rehearse' ? 'rehearsal' : args[0] === '--execute' ? 'native' : null;
      if (!mode || args[1] !== '--output' || !args[2] || (mode === 'native' ? args[3] !== '--permit' || !args[4] || args.length !== 5 : args.length !== 3)) throw new Error('Invalid invocation');
      const result = await run(mode, args[2], args[4]);
      process.stdout.write(JSON.stringify({ outcome: result.outcome, mode: result.mode, nativeQueryCalls: result.nativeQueryCalls, cleanup: result.cleanup }) + '\n');
      if (result.outcome === 'failed-or-unknown') process.exitCode = 1;
    }
  } catch { process.stderr.write('O08 refused or could not complete this invocation; no automatic retry.\n'); process.exitCode = 1; }
}
