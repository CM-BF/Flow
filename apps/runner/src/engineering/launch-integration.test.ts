import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer as createProxy, type Server } from 'node:http';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../../server/src/index.js';
import { registerEngineeringRoutes } from '../../../server/src/engineering/index.js';
import { expireLeases } from '../../../server/src/runners.js';
import { engineeringProfilePageSchema, type EngineeringProfile } from '../../../../packages/contracts/src/engineering-profile.js';
import { engineeringReceiptSchema } from '../../../../packages/contracts/src/engineering.js';
import { digest } from './resources.js';

const database = `flow_eng01b_main_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`, ownerToken = 'eng01b-main-owner';
const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const cleanups: (() => Promise<void>)[] = [];
const facts = { database, databaseRemoved: false, providerCalls: 0, children: [] as { pid: number; closed: boolean; code: number | null; signal: string | null }[], samples: [] as Record<string, unknown>[] };
let app: Awaited<ReturnType<typeof createServer>>, pool: Pool, owner: FlowClient, baseUrl: string, creationRequested = false;
async function eventually(predicate: () => boolean | Promise<boolean>) {
  const until = Date.now() + 12_000;
  while (!await predicate()) { if (Date.now() > until) throw new Error('Configured engineering host did not reach its bounded observation.'); await new Promise(resolve => setTimeout(resolve, 20)); }
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw new Error('Refusing existing database.');
  creationRequested = true; await admin.query(`CREATE DATABASE ${database}`);
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 300_000, automaticQueueScan: false });
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/engineering-profile' })) registerEngineeringRoutes(app, pool);
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: ownerToken });
});
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
afterAll(async () => {
  try {
    app?.server.closeAllConnections(); await app?.close(); await pool?.end();
    if (creationRequested && (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query(`DROP DATABASE ${database}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount; expect(facts.databaseRemoved).toBe(true);
  } finally { await admin.end(); if (process.env.FLOW_ENG01B_EVIDENCE) await writeFile(process.env.FLOW_ENG01B_EVIDENCE, JSON.stringify(facts, null, 2) + '\n'); }
});
async function scenario(url = baseUrl) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-eng01b-main-'))), workingDirectory = join(directory, 'host'), manifest = join(directory, 'engineering.json');
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  await writeFile(manifest, JSON.stringify({ protocol: 'flow.engineering-setup.v1', recipe: 'calculator-v1', projectId: `project-${randomUUID()}`, checkerTimeoutMs: 2000 }));
  const runner = await owner.registerRunner({ name: 'Configured engineering process', harnesses: ['fixture'], capacity: 1 });
  function start() {
    const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runner/src/main.ts'], { cwd: repository, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: {
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, LANG: 'C', FLOW_URL: url, FLOW_RUNNER_TOKEN: runner.token, FLOW_RUNNER_WORKDIR: workingDirectory,
      FLOW_ENGINEERING_SETUP_FILE: manifest, FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS: '1',
    } });
    const observed = { pid: child.pid!, closed: false, code: null as number | null, signal: null as string | null, outputTruncated: false }; facts.children.push(observed);
    let stderr = '', stdout = '';
    const collect = (current: string, chunk: Buffer) => { if (Buffer.byteLength(current) + chunk.length > 16_384) { observed.outputTruncated = true; child.kill('SIGTERM'); return current; } return current + chunk.toString('utf8'); };
    child.stderr.on('data', (value: Buffer) => { stderr = collect(stderr, value); }); child.stdout.on('data', (value: Buffer) => { stdout = collect(stdout, value); });
    const closed = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { Object.assign(observed, { closed: true, code, signal }); resolve(); }); });
    async function stop() {
      if (!observed.closed) child.kill('SIGTERM');
      const timer = setTimeout(() => { if (!observed.closed) child.kill('SIGKILL'); }, 5000);
      try { await closed; } finally { clearTimeout(timer); }
      expect(observed.signal).not.toBe('SIGKILL'); expect(observed.code).toBe(0); expect(observed.outputTruncated).toBe(false);
    }
    cleanups.push(stop);
    return { child, observed, stop, stderr: () => stderr, stdout: () => stdout };
  }
  async function profile() {
    // Shared public reader, never private row interpretation by the runner.
    const page = engineeringProfilePageSchema.parse(await owner.listEngineeringProfiles());
    return page.profiles.find(value => value.reference.runnerId === runner.runnerId);
  }
  async function submit(selected: EngineeringProfile) {
    const task = await owner.submit({ title: 'Configured engineering', prompt: 'Fix the trusted calculator', harness: 'fixture', engineering: {
      protocol: 'flow.engineering.v1', targetRunnerId: runner.runnerId, projectId: selected.configuration.project.id, baseCommit: selected.configuration.project.baseCommit,
      checker: selected.configuration.checker, profile: selected.reference } }, randomUUID());
    await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.task.id]); return task.task.id;
  }
  const record = async () => JSON.parse(await readFile(join(workingDirectory, 'engineering-fixture', 'setup.json'), 'utf8'));
  const worktrees = async () => readdir(join(workingDirectory, 'engineering-fixture', (await record()).value.projectDirectory, 'worktrees'));
  const admission = async () => JSON.parse(await readFile(join(workingDirectory, digest(url), 'admission.json'), 'utf8'));
  return { runner, start, profile, submit, record, worktrees, admission, workingDirectory };
}
async function artifact(taskId: string) {
  const task = await owner.show(taskId), reference = task.entries.find(entry => entry.kind === 'reference');
  if (reference?.kind !== 'reference') throw new Error('Missing public engineering receipt.');
  return engineeringReceiptSchema.parse(JSON.parse((await owner.detail(reference.reference.id)).content));
}
it('runs the explicit main configuration through public profile/claim/artifact APIs and restores the same setup in a new process', async () => {
  const api = await scenario(), first = api.start(); await eventually(async () => Boolean(await api.profile()));
  const profile = (await api.profile())!, record = await api.record(), firstId = await api.submit(profile);
  await eventually(async () => (await owner.show(firstId)).status === 'succeeded'); await eventually(async () => (await api.admission()).assignments.length === 0);
  const firstReceipt = await artifact(firstId); expect(firstReceipt.result).toBe('passed'); expect(firstReceipt.intent.profile).toEqual(profile.reference);
  await first.stop(); const second = api.start();
  expect(await api.record()).toEqual(record); expect(await api.profile()).toEqual(profile);
  const secondId = await api.submit(profile); await eventually(async () => (await owner.show(secondId)).status === 'succeeded'); await eventually(async () => (await api.admission()).assignments.length === 0);
  const secondReceipt = await artifact(secondId); expect(secondReceipt.workspace.leaseId).not.toBe(firstReceipt.workspace.leaseId); expect(secondReceipt.intent.profile).toEqual(profile.reference);
  expect(await api.worktrees()).toHaveLength(2); await second.stop();
  facts.samples.push({ scenario: 'public-main-success-and-restart', pids: [first.child.pid, second.child.pid], sameSetup: true, sameProfile: true, taskCount: 2, worktrees: 2, checkerChildExited: secondReceipt.command.childExited });
}, 30_000);
it('retains the host journal after a real lost artifact response and refuses another claim after process restart', async () => {
  let lost = false;
  const proxy: Server = createProxy(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of incoming) { bytes += chunk.length; if (bytes > 1_048_576) throw new Error('Proxy input bound'); chunks.push(chunk); }
      const response = await fetch(`${baseUrl}${incoming.url}`, { method: incoming.method, headers: { Authorization: incoming.headers.authorization ?? '', 'Content-Type': 'application/json' },
        ...(bytes ? { body: Buffer.concat(chunks) } : {}), signal: AbortSignal.timeout(5000) });
      const body = Buffer.from(await response.arrayBuffer());
      if (!lost && incoming.url === '/api/runner/events' && response.ok) { lost = true; outgoing.destroy(); return; }
      outgoing.writeHead(response.status, { 'Content-Type': 'application/json' }); outgoing.end(body);
    } catch { outgoing.destroy(); }
  });
  proxy.requestTimeout = 5000;
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => { proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); });
  const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('Missing proxy port');
  const api = await scenario(`http://127.0.0.1:${address.port}`), first = api.start(); await eventually(async () => Boolean(await api.profile()));
  const profile = (await api.profile())!, record = await api.record(), taskId = await api.submit(profile);
  await eventually(() => first.stderr().includes('admission-blocked')); expect(lost).toBe(true); expect((await api.admission()).assignments).toHaveLength(1);
  const receipt = await artifact(taskId); expect(receipt.result).toBe('passed'); expect((await owner.show(taskId)).verificationStatus).toBe('pending');
  await first.stop(); await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE task_id=$1", [taskId]); await expireLeases(pool);
  expect((await owner.show(taskId)).status).toBe('uncertain');
  const queued = await api.submit(profile), second = api.start(); await eventually(() => second.stderr().includes('admission-blocked'));
  expect(await api.record()).toEqual(record); expect(await api.worktrees()).toHaveLength(1); expect((await api.admission()).assignments).toHaveLength(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.attempts WHERE task_id=$1', [queued])).rows[0].n).toBe(0);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1', [taskId])).rows[0].n).toBe(1);
  await second.stop(); facts.samples.push({ scenario: 'main-process-lost-ack-restart', pids: [first.child.pid, second.child.pid], artifactEvents: 1, worktrees: 1, nextClaimCount: 0, verification: 'pending', result: 'uncertain', journalRetained: true });
}, 30_000);
