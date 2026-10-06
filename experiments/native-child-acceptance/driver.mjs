import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir, rm, realpath, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { FlowClient } from '../../packages/client/src/index.ts';
import { createServer } from '../../apps/server/src/index.ts';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { describeExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { goalInputSchema } from '../../packages/contracts/src/goals.ts';
import { goalNativeExecutionSchema } from '../../packages/contracts/src/goal-native-executions.ts';
import { stopWorker } from '../native-graph-acceptance/driver.mjs';
import { adapterOptions, BASE, LIMITS, INPUT, MATERIAL, MANAGED_BASELINE, versions, sourceIdentity, digest } from './config.mjs';
import { reserveAttempt } from './guard.mjs';
import { checkFacts } from './facts.mjs';

export async function preflight() {
  goalInputSchema.parse(INPUT);
  const dependencies = await versions(), source = await sourceIdentity();
  const options = adapterOptions('native', '/O10-PRIVATE/authorized.txt');
  const profile = describeExecutionProfile(options, createClaudeAdapter(options));
  assert.equal(profile.access, 'configured-readonly');
  goalNativeExecutionSchema.parse({ nodeId: '00000000-0000-4000-8000-000000000010', expectedInputVersion: 1, dependencies: [], previousExecutionId: null,
    reason: 'Candidate only', executionProfile: { id: '00000000-0000-4000-8000-000000000011', runnerId: '00000000-0000-4000-8000-000000000012', configDigest: '0'.repeat(64) } });
  return { mode: 'preflight', nativeQueryCalls: 0, providerAuthenticationCalls: 0, dependencies, source, input: INPUT,
    material: { bytes: Buffer.byteLength(MATERIAL), sha256: digest(MATERIAL) }, profile, profileState: 'candidate only; placeholder path, not registered',
    candidateLimitsNotAuthorized: LIMITS, managedDeclarations: MANAGED_BASELINE, boundary: 'Local source/version/schema/adapter construction only; no PG, HTTP, query, startup or authentication.' };
}
async function until(check, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) { const value = await check(); if (value) return value; await new Promise(r => setTimeout(r, 40)); }
  throw new Error('Observation deadline reached');
}
async function collect(owner, http, ids, report) {
  report.task = await owner.show(ids.taskId, AbortSignal.timeout(3000));
  report.goal = await owner.readGoal(ids.goalId, AbortSignal.timeout(3000));
  report.history = await owner.goalExecutions(ids.goalId, { nodeId: ids.nodeId, limit: 2 }, AbortSignal.timeout(3000));
  report.totalTasks = (await owner.queryTasks({ limit: 2 })).totalSize;
  const messages = await http(`/api/tasks/${ids.taskId}/assistant-messages`);
  report.final = messages.messages.length === 1 ? await http(`/api/assistant-messages/${messages.messages[0].id}`) : null;
  report.finalCount = messages.messages.length;
  assert.equal(report.task.hasMore, false, 'This bounded probe requires complete single-page task references');
  const details = [];
  for (const entry of report.task.entries) if (entry.kind === 'reference') {
    const detail = await http(`/api/details/${entry.reference.id}`);
    if (detail.kind === 'artifact' || detail.kind === 'verification') details.push(detail);
  }
  report.details = details;
}
async function saveCheckpoint(output, report) {
  const file = await open(join(output, 'checkpoint.json'), 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify({ ...report, checkpointPhase: 'before-resource-removal' }, null, 2) + '\n');
    await file.sync();
  } finally { await file.close(); }
  const directory = await open(output, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function run(mode, outputDirectory, authorization, scenario = 'success') {
  assert(['rehearsal', 'native'].includes(mode));
  assert(['success', 'init-difference', 'denied-tool', 'allow-without-read', 'error-result'].includes(scenario));
  if (mode === 'native' && scenario !== 'success') throw new Error('Native fault scenarios are not authorized');
  const pre = await preflight();
  if (mode === 'native' && !authorization) throw new Error('Native execution requires a fresh explicit permit path');
  const reservation = mode === 'native' ? await reserveAttempt(authorization, pre.source) : null;
  const output = resolve(outputDirectory); await mkdir(output, { recursive: true, mode: 0o700 });
  const resultPath = join(output, 'result.json');
  await writeFile(resultPath, JSON.stringify({ mode, outcome: 'started-unknown', source: pre.source.digest }) + '\n', { mode: 0o600, flag: 'wx' });
  const report = { mode, scenario, base: BASE, source: pre.source, versions: pre.dependencies, nativeQueryCalls: null,
    startedAt: new Date().toISOString(), approvalId: reservation?.permit.approvalId ?? null, attemptMarker: reservation?.marker ?? null,
    phase: 'prepare-private-resources', outcome: 'unknown', cleanup: {}, semanticAcceptance: { state: 'not-evaluated', acceptedDelivery: false }, workerForcedKill: false };
  const database = `flow_o10_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, statement_timeout: 5000 });
  let app, child, root, madeDatabase = false, owner, http, workerReportPath, deadline;
  try {
    root = await realpath(await mkdtemp(join(tmpdir(), 'flow-o10-')));
    report.privateResources = { database, directory: root };
    await admin.query(`CREATE DATABASE ${database}`); madeDatabase = true;
    // The owner token remains only in this host closure; never in the runner config or SDK environment.
    const ownerToken = randomUUID();
    app = await createServer({ databaseUrl, ownerToken, leaseMs: 20_000, automaticQueueScan: false });
    const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: ownerToken });
    http = async path => { const response = await fetch(baseUrl + path, { headers: { authorization: `Bearer ${ownerToken}` }, signal: AbortSignal.timeout(3000) }); if (!response.ok) throw new Error('Private center read failed'); return response.json(); };
    report.phase = 'define-owner-input';
    const project = (await owner.createProject({ title: 'O10 one synthetic child' }, randomUUID())).snapshot.project;
    const node = await owner.changeProject(project.id, { expectedRevision: project.revision, reason: 'Owner fixes one text node', change: { kind: 'add-node', title: '纸鸢发布说明草稿' } }, randomUUID());
    const { goal } = await owner.createGoal({ projectId: project.id, originalGoal: INPUT.goal, constraints: INPUT.constraints, acceptance: INPUT.acceptance }, randomUUID());
    await owner.commandGoal(goal.id, { kind: 'define-input', nodeId: node.changedNodeId, expectedInputVersion: 0, input: INPUT, reason: 'Owner fixes exact synthetic facts and rule' }, randomUUID());
    const runner = await owner.registerRunner({ name: `O10-${mode}`, harnesses: ['claude'], capacity: 1 });
    const materialFile = join(root, 'authorized.txt'); await writeFile(materialFile, MATERIAL, { flag: 'wx', mode: 0o600 });
    const options = adapterOptions(mode, materialFile), configuration = describeExecutionProfile(options, createClaudeAdapter(options));
    const client = new FlowClient({ baseUrl, token: runner.token });
    const publication = await client.publishExecutionProfile({ configuration }); report.profile = publication.profile;
    assert.equal(publication.profile.configuration.access, 'configured-readonly');
    report.material = pre.material; report.phase = 'owner-native-admission'; report.admissionKey = randomUUID();
    report.admission = await owner.executeGoalNative(goal.id, { nodeId: node.changedNodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null,
      reason: 'Owner selects this registered readonly profile for exactly one synthetic text child', executionProfile: publication.profile.reference }, report.admissionKey);
    report.ids = { database, projectId: project.id, goalId: goal.id, nodeId: node.changedNodeId, executionId: report.admission.executionId, taskId: report.admission.task.id, runnerId: runner.runnerId };
    const configPath = join(root, 'worker.json'); workerReportPath = join(root, 'worker-report.json');
    const workingDirectory = join(root, 'runner'); await mkdir(workingDirectory, { mode: 0o700 });
    await writeFile(configPath, JSON.stringify({ mode, scenario, baseUrl, runnerToken: runner.token, profile: publication.profile, workingDirectory, materialFile,
      reportFile: workerReportPath, sourceDigest: pre.source.digest, permit: reservation?.permit, marker: reservation?.marker }), { mode: 0o600, flag: 'wx' });
    const home = join(root, 'home'); await mkdir(home, { mode: 0o700 });
    const environment = mode === 'native' ? process.env : { PATH: process.env.PATH, HOME: home, TMPDIR: root, LANG: 'C.UTF-8' };
    report.phase = 'observe-owned-runner';
    child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./worker.mjs', import.meta.url)), configPath], { detached: true, stdio: 'ignore', env: environment });
    child.once('error', () => { report.workerStartFailed = true; });
    report.runnerPid = child.pid;
    const limit = mode === 'native' ? LIMITS.timeoutMs : 15_000;
    deadline = setTimeout(() => { report.observerDeadlineReached = true; void stopWorker(child, report).catch(() => { report.cleanup.runnerStopped = false; }); }, limit);
    await until(async () => {
      if (report.workerStartFailed || child.exitCode !== null || child.signalCode) throw new Error('Owned runner exited early');
      const task = await owner.show(report.ids.taskId, AbortSignal.timeout(3000)); return ['succeeded', 'failed', 'cancelled', 'uncertain'].includes(task.status) ? task : null;
    }, limit);
    clearTimeout(deadline); await stopWorker(child, report);
    report.worker = JSON.parse(await readFile(workerReportPath, 'utf8')); report.nativeQueryCalls = report.worker.nativeQueryCalls;
    report.phase = 'collect-and-check-facts'; await collect(owner, http, report.ids, report); checkFacts(report);
    report.outcome = mode === 'native' ? 'mechanical-evidence-collected' : 'rehearsal-passed';
  } catch {
    report.failurePhase = report.phase; report.outcome = 'failed-or-unknown'; report.error = 'Acceptance was not established; preserve facts and do not retry a native approval.';
    if (owner && report.ids) try { await owner.cancel(report.ids.taskId, randomUUID(), AbortSignal.timeout(3000)); report.cancelRequested = true; } catch { report.cancelRequested = 'unknown'; }
  } finally {
    clearTimeout(deadline);
    try { await stopWorker(child, report); report.cleanup.runnerStopped = true; } catch { report.cleanup.runnerStopped = false; }
    if (!report.worker && workerReportPath) try { report.worker = JSON.parse(await readFile(workerReportPath, 'utf8')); report.nativeQueryCalls = report.worker.nativeQueryCalls; } catch {}
    if (owner && report.ids && http && report.outcome === 'failed-or-unknown') try { await collect(owner, http, report.ids, report); } catch { report.partialFactsUnavailable = true; }
    try { await app?.close(); report.cleanup.centerClosed = true; } catch { report.cleanup.centerClosed = false; }
    try {
      await saveCheckpoint(output, report);
      report.evidenceCheckpoint = { saved: true, file: 'checkpoint.json' };
    } catch {
      report.evidenceCheckpoint = { saved: false, file: 'checkpoint.json' };
      report.outcome = 'failed-or-unknown'; report.failurePhase = 'evidence-checkpoint';
    }
    const mayRemoveResources = report.evidenceCheckpoint.saved && report.cleanup.runnerStopped && report.cleanup.centerClosed;
    try {
      if (!mayRemoveResources) throw new Error('Preserve private database until complete facts are saved and owned processes are stopped');
      if (madeDatabase) await admin.query(`DROP DATABASE ${database}`);
      report.remainingDatabases = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
      report.cleanup.databaseRemoved = report.remainingDatabases.length === 0;
    } catch { report.cleanup.databaseRemoved = false; }
    await admin.end();
    try { if (!mayRemoveResources) throw new Error('Preserve private resources'); if (root) await rm(root, { recursive: true, force: true }); report.cleanup.privateTemporaryDirectoryRemoved = true; }
    catch { report.cleanup.privateTemporaryDirectoryRemoved = false; }
    if (Object.values(report.cleanup).some(v => v !== true)) { report.outcome = 'failed-or-unknown'; report.failurePhase = report.evidenceCheckpoint.saved ? 'cleanup' : 'evidence-checkpoint'; }
    report.finishedAt = new Date().toISOString(); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.length || args.join() === '--preflight') process.stdout.write(JSON.stringify(await preflight(), null, 2) + '\n');
    else {
      const mode = args[0] === '--rehearse' ? 'rehearsal' : args[0] === '--execute' ? 'native' : null;
      if (!mode || args[1] !== '--output' || !args[2] || (mode === 'native' ? args[3] !== '--permit' || !args[4] || args.length !== 5 : args.length !== 3)) throw new Error('Invalid invocation');
      const report = await run(mode, args[2], args[4]);
      process.stdout.write(JSON.stringify({ outcome: report.outcome, mode: report.mode, nativeQueryCalls: report.nativeQueryCalls, cleanup: report.cleanup }) + '\n');
      if (report.outcome === 'failed-or-unknown') process.exitCode = 1;
    }
  } catch { process.stderr.write('O10 refused or could not complete this invocation; no automatic retry.\n'); process.exitCode = 1; }
}
