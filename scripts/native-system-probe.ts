import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { createServer } from '../apps/server/src/index.js';
import { FlowClient } from '../packages/client/src/index.js';
import type { TaskSnapshot } from '../packages/contracts/src/index.js';

if (process.env.FLOW_RUN_REAL_NATIVE !== '1') throw new Error('Explicit FLOW_RUN_REAL_NATIVE=1 is required; this probe spends two reserved native query slots.');
const evidencePath = 'docs/evidence/i01/native-system.json';
await mkdir('docs/evidence/i01', { recursive: true });
const evidence: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'running', nativeQuerySlotsReserved: 2, previousR02Queries: 3, limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 }, scenarios: [] };
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });

let directory: string | undefined;
let pool: Pool | undefined;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let runner: ChildProcess | undefined;
let runnerExit: Promise<unknown> | undefined;
let client: FlowClient;
let baseUrl: string;
const token = randomUUID();
const expected = randomBytes(12).toString('hex');

async function cli(args: string[]) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/cli/src/main.ts', ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FLOW_URL: baseUrl, FLOW_TOKEN: token } });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.resume();
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('Native probe CLI command failed.');
  return output;
}

async function waitFor(id: string, accept: (task: TaskSnapshot) => boolean): Promise<TaskSnapshot> {
  const deadline = Date.now() + 95000;
  while (Date.now() < deadline) {
    const task = await client.show(id);
    if (accept(task)) return task;
    if (['failed', 'succeeded', 'cancelled', 'uncertain'].includes(task.status)) throw new Error(`Unexpected native task state: ${task.status}`);
    if (!runner || runner.exitCode !== null || runner.signalCode !== null) throw new Error('Native runner exited before the expected result.');
    await sleep(150);
  }
  throw new Error('Native system probe exceeded its task deadline.');
}

try {
  directory = await mkdtemp(join(tmpdir(), 'flow-native-i01-'));
  const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_i01';
  const material = join(directory, 'random-material.txt');
  await writeFile(material, `The calibration code is ${expected}.\n`, { mode: 0o600 });
  const manifest = join(directory, 'claude-materials.json');
  await writeFile(manifest, JSON.stringify({ materialFiles: [material], requireReadApproval: true, maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 }), { mode: 0o600 });
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;');
  await pool.end();
  pool = undefined;
  server = await createServer({ databaseUrl, ownerToken: token });
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl, token });
  const registration = await client.registerRunner({ name: 'I01 native read-only', harnesses: ['claude'], capacity: 1 });
  runner = spawn(process.execPath, ['--import', 'tsx', 'apps/runner/src/main.ts'], { stdio: 'ignore', env: { ...process.env, FLOW_URL: baseUrl, FLOW_RUNNER_TOKEN: registration.token, FLOW_RUNNER_WORKDIR: join(directory, 'runner'), FLOW_CLAUDE_MATERIALS_FILE: manifest } });
  runnerExit = once(runner, 'exit').catch(() => undefined);
  for (const action of ['approve', 'cancel'] as const) {
    const started = performance.now();
    const accepted = await client.submit({ title: `Native ${action} check`, prompt: 'Read the explicitly authorized material and return only its calibration code. Do not guess.', harness: 'claude', verification: { kind: 'contains', expected } }, randomUUID());
    const waiting = await waitFor(accepted.task.id, task => task.status === 'waiting' && Boolean(task.pendingDecision));
    if (action === 'approve') await cli(['decision', accepted.task.id, 'approve', '--decision', waiting.pendingDecision!.id, '--key', randomUUID(), '--json']);
    else await cli(['cancel', accepted.task.id, '--key', randomUUID(), '--json']);
    const task = await waitFor(accepted.task.id, state => state.status === (action === 'approve' ? 'succeeded' : 'cancelled'));
    const details = await Promise.all(task.entries.filter(entry => entry.kind === 'reference').map(entry => client.detail(entry.reference.id)));
    const artifact = details.find(detail => detail.kind === 'artifact');
    if (action === 'approve' && (!artifact?.content.includes(expected) || task.verificationStatus !== 'passed')) throw new Error('Native artifact or independent verification did not match the unknown material.');
    if (action === 'cancel' && artifact) throw new Error('Cancelled read unexpectedly published an artifact.');
    (evidence.scenarios as unknown[]).push({ action, durationMs: performance.now() - started, taskId: task.id, attemptId: task.attempt?.id, nativeSessionId: task.attempt?.nativeSessionId, executionStatus: task.status, verificationStatus: task.verificationStatus, durableDecisionId: waiting.pendingDecision!.id, usage: task.usage, artifactVersion: artifact?.artifactVersion ?? null, expectedDigest: createHash('sha256').update(expected).digest('hex'), expectedWasInModelPrompt: false, detailKinds: details.map(detail => detail.kind), sessionResources: details.filter(detail => detail.kind === 'session').map(detail => JSON.parse(detail.content).resources ?? []), verification: details.filter(detail => detail.kind === 'verification').map(detail => JSON.parse(detail.content)) });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.error = error instanceof Error ? error.message : 'Native probe failed.';
  process.exitCode = 1;
} finally {
  const cleanupErrors: string[] = [];
  const clean = async (label: string, action: () => Promise<unknown>) => {
    try { await bounded(action(), 10000); } catch { cleanupErrors.push(label); }
  };
  await clean('runner', async () => {
    if (runner && runner.exitCode === null && runner.signalCode === null) {
      runner.kill('SIGTERM');
      try { await bounded(runnerExit!, 3000); }
      catch { runner.kill('SIGKILL'); await bounded(runnerExit!, 3000); }
    }
  });
  await clean('center', async () => { server?.server.closeAllConnections(); await server?.close(); });
  await clean('setup pool', async () => { await pool?.end(); });
  await clean('temporary material', async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
  if (cleanupErrors.length) {
    evidence.cleanupErrors = cleanupErrors;
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 1000).unref();
  }
  evidence.finishedAt = new Date().toISOString();
  evidence.limitsOfEvidence = ['Two read-only native tasks on this host; no project writes', 'Cancellation stopped at human-gated read; no claim to undo in-flight external effects', 'SDK cost is an estimate; cancelled query usage may be unknown', 'No product Web, remote host, DB power loss or capacity validation'];
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: evidence.status, evidencePath, scenarios: (evidence.scenarios as unknown[]).length })}\n`);
}


async function bounded<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline reached.')), milliseconds); });
  try { return await Promise.race([pending, timeout]); }
  finally { clearTimeout(timer); }
}
