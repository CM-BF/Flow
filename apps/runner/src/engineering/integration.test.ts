import { publishEngineeringProfile } from '../../../server/src/engineering/profile.js';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../../server/src/index.js';
import { expireLeases } from '../../../server/src/runners.js';
import { engineeringReceiptSchema } from '../../../../packages/contracts/src/engineering.js';
import { runRunner, type RunnerNotice } from '../runtime.js';
import { createFixtureAdapter } from '../fixture.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { createEngineeringFixtureAdapter } from './adapter.js';
import { createTrustedChecker } from './checker.js';
import { createSyntheticProject, type EngineeringWorkspace } from './workspace.js';
import { digest } from './resources.js';

const database = `flow_eng01a_vertical_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const cleanup: (() => Promise<void>)[] = [];
const facts = { database, databaseRemoved: false, providerCalls: 0, samples: [] as Record<string, unknown>[] };
let app: Awaited<ReturnType<typeof createServer>>, pool: Pool, owner: FlowClient, baseUrl: string, created = false;
const baseline = `import { pathToFileURL } from 'node:url'; import { join } from 'node:path';
const {add,subtract}=await import(pathToFileURL(join(process.argv[2],'calculator.mjs')).href);
console.log(JSON.stringify({checks:[{id:'sum',passed:add(5,2)===7},{id:'difference',passed:subtract(5,2)===3}]}));`;
async function eventually(predicate: () => boolean | Promise<boolean>) {
  const until = Date.now() + 8000;
  while (!await predicate()) { if (Date.now() > until) throw new Error('Expected engineering behavior did not occur.'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw new Error('Refusing existing database.');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  app = await createServer({ databaseUrl, ownerToken: 'eng01a-vertical-owner', leaseMs: 300_000, automaticQueueScan: false });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: 'eng01a-vertical-owner' });
});
afterEach(async () => { vi.restoreAllMocks(); for (const stop of cleanup.splice(0).reverse()) await stop(); });
afterAll(async () => {
  try {
    app?.server.closeAllConnections(); await app?.close(); await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount; expect(facts.databaseRemoved).toBe(true);
  } finally { await admin.end(); if (process.env.FLOW_ENG01A_EVIDENCE) await writeFile(process.env.FLOW_ENG01A_EVIDENCE, JSON.stringify(facts, null, 2) + '\n'); }
});

async function scenario(mode: 'success' | 'failed' | 'unknown') {
  const directory = await mkdtemp(join(tmpdir(), 'flow-eng01a-pg-')), identity = await owner.registerRunner({ name: `Engineering ${mode}`, harnesses: ['fixture'], capacity: 1 });
  const project = await createSyntheticProject(directory, `synthetic-${randomUUID()}`, { 'calculator.mjs': 'export const add=(a,b)=>a-b;\nexport const subtract=(a,b)=>a-b;\n', 'obsolete.txt': 'obsolete\n', 'run.sh': 'exit 0\n' });
  const checker = await createTrustedChecker(directory, 'fixed-math', baseline, ['sum', 'difference']);
  let writes = 0, workspace: EngineeringWorkspace | undefined;
  const adapter = createEngineeringFixtureAdapter(identity.runnerId, [{ project, checker, async execute(value) {
    workspace = value; writes++;
    await writeFile(join(value.directory, 'calculator.mjs'), `export const add=(a,b)=>a${mode === 'failed' ? '-' : '+'}b;\nexport const subtract=(a,b)=>a-b;\n`);
    await rm(join(value.directory, 'obsolete.txt')); await writeFile(join(value.directory, 'README.txt'), 'Synthetic engineering delivery\n'); await chmod(join(value.directory, 'run.sh'), 0o700);
    if (mode === 'unknown') throw new NativeExecutionError('unknown');
  } }]);
  const profile = (await publishEngineeringProfile(pool, identity.runnerId, { protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: 'calculator-v1', project: { id: project.id, baseCommit: project.baseCommit }, checker: checker.selection, limits: { checkerTimeoutMs: 30_000 } })).profile.reference;
  const accepted = await owner.submit({ title: 'Synthetic engineering', prompt: 'Repair the controlled calculator', harness: 'fixture', engineering: {
    protocol: 'flow.engineering.v1', targetRunnerId: identity.runnerId, projectId: project.id, baseCommit: project.baseCommit, checker: checker.selection, profile } }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
  const notices: RunnerNotice[] = [], executions: { controller: AbortController; promise: Promise<void> }[] = [];
  const hostDirectory = join(directory, 'host');
  function start() {
    const controller = new AbortController(), promise = runRunner({ baseUrl, token: identity.token, workingDirectory: hostDirectory, adapters: [adapter], signal: controller.signal,
      pollIntervalMs: 10, heartbeatIntervalMs: 40, requestTimeoutMs: 1500, onNotice: notice => notices.push(notice) });
    void promise.catch(() => undefined); const run = { controller, promise }; executions.push(run); return run;
  }
  cleanup.push(async () => {
    for (const run of executions) run.controller.abort(); await Promise.allSettled(executions.map(run => run.promise));
    await checker.dispose();
    if (mode === 'unknown') {
      // This fixture deliberately threw unknown after awaited local writes, with no child. Only test teardown has this extra knowledge.
      await workspace?.release();
    }
    await project.dispose(); await rm(directory, { recursive: true });
  });
  return { taskId: accepted.task.id, project, notices, start, writes: () => writes,
    admission: async () => JSON.parse(await readFile(join(hostDirectory, digest(baseUrl), 'admission.json'), 'utf8')) };
}

it('executes a real synthetic Git repair and fixed Node checker through existing host/outbox to public PG artifact readback', async () => {
  const api = await scenario('success'), started = performance.now(), run = api.start();
  await eventually(async () => (await owner.show(api.taskId)).status === 'succeeded');
  await eventually(async () => (await api.admission()).assignments.length === 0); run.controller.abort(); await run.promise;
  const task = await owner.show(api.taskId); expect(task.verificationStatus).toBe('passed');
  const artifact = task.entries.find(entry => entry.kind === 'reference');
  if (artifact?.kind !== 'reference') throw new Error('Missing public engineering artifact.');
  const detail = await owner.detail(artifact.reference.id), receipt = engineeringReceiptSchema.parse(JSON.parse(detail.content));
  expect(detail.kind).toBe('artifact');
  expect(receipt.result).toBe('passed'); expect(receipt.command.exitCode).toBe(0); expect(receipt.checker.checks).toEqual([{ id: 'sum', passed: true }, { id: 'difference', passed: true }]);
  expect(receipt.workspace.beforeDigest).toBe(receipt.workspace.afterDigest); expect(receipt.workspace.baseCommit).toBe(api.project.baseCommit);
  expect(receipt.workspace.files.find(file => file.path === 'obsolete.txt')?.worktree).toBeNull();
  expect(receipt.workspace.files.find(file => file.path === 'README.txt')?.base).toBeNull();
  expect(receipt.workspace.files.find(file => file.path === 'run.sh')?.worktree?.mode).toBe('100755');
  expect(receipt.diff.content).toContain('+export const add=(a,b)=>a+b;'); expect(api.writes()).toBe(1);
  expect((await owner.reconciliation(api.taskId)).reservationHeld).toBe(false);
  const events = (await pool.query('SELECT e.sequence FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1 ORDER BY e.sequence', [api.taskId])).rows;
  expect(events.map(event => event.sequence)).toEqual([1, 2, 3]);
  facts.samples.push({ scenario: 'success', elapsedMs: Math.round(performance.now() - started), checkerElapsedMs: receipt.command.elapsedMs, artifactBytes: Buffer.byteLength(detail.content), snapshotFiles: receipt.workspace.files.length, diffBytes: Buffer.byteLength(receipt.diff.content), checkerChildExited: receipt.command.childExited, writes: api.writes() });
});

it('keeps failed engineering checks readable and lets the existing host publish only failed completion', async () => {
  const api = await scenario('failed'), run = api.start(); await eventually(async () => (await owner.show(api.taskId)).status === 'failed');
  await eventually(async () => (await api.admission()).assignments.length === 0); run.controller.abort(); await run.promise;
  const task = await owner.show(api.taskId); expect(task.verificationStatus).toBe('failed');
  const artifact = task.entries.find(entry => entry.kind === 'reference');
  if (artifact?.kind !== 'reference') throw new Error('Missing failed engineering receipt.');
  const receipt = engineeringReceiptSchema.parse(JSON.parse((await owner.detail(artifact.reference.id)).content));
  expect(receipt.result).toBe('failed'); expect(receipt.command.exitCode).toBe(0); expect(receipt.checker.checks[0]?.passed).toBe(false);
  expect((await owner.reconciliation(api.taskId)).reservationHeld).toBe(false); facts.samples.push({ scenario: 'failed', checkerChildExited: receipt.command.childExited, writes: api.writes() });
});

it('retains an injected uncertain write and project lease across host restart without replaying writes', async () => {
  const api = await scenario('unknown'), run = api.start(); await eventually(() => api.notices.some(notice => notice.type === 'admission-blocked'));
  await expect(api.project.acquire()).rejects.toThrow('already leased'); await expect(api.project.dispose()).rejects.toThrow('unresolved');
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE task_id=$1", [api.taskId]); await expireLeases(pool);
  expect((await owner.show(api.taskId)).status).toBe('uncertain'); expect((await owner.reconciliation(api.taskId)).reservationHeld).toBe(true);
  expect((await api.admission()).assignments).toHaveLength(1); run.controller.abort(); await run.promise;
  const count = api.notices.length, restarted = api.start(); await eventually(() => api.notices.slice(count).some(notice => notice.type === 'admission-blocked'));
  restarted.controller.abort(); await restarted.promise; expect(api.writes()).toBe(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1', [api.taskId])).rows[0].n).toBe(0);
  facts.samples.push({ scenario: 'unknown', uncertainty: 'Explicit fixture injection after awaited writes; no child dispatched', writes: api.writes(), reservationHeld: true, journalRetained: true });
});

it('replays a lost artifact acknowledgement without fabricating the verification or reexecuting engineering', async () => {
  const api = await scenario('success'), realFetch = globalThis.fetch; let lost = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const response = await realFetch(input, init);
    if (!lost && String(input) === `${baseUrl}/api/runner/events` && response.status === 200) {
      lost = true; await response.arrayBuffer(); throw new TypeError('Injected lost acknowledgement after center commit.');
    }
    return response;
  });
  const run = api.start(); await eventually(() => api.notices.some(notice => notice.type === 'admission-blocked'));
  expect(lost).toBe(true); expect(api.writes()).toBe(1);
  const task = await owner.show(api.taskId); expect(task.verificationStatus).toBe('pending');
  const artifact = task.entries.find(entry => entry.kind === 'reference');
  if (artifact?.kind !== 'reference') throw new Error('Lost acknowledgement must preserve its artifact.');
  expect(engineeringReceiptSchema.parse(JSON.parse((await owner.detail(artifact.reference.id)).content)).result).toBe('passed');
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1', [api.taskId])).rows[0].n).toBe(1);
  run.controller.abort(); await run.promise;
  const count = api.notices.length, restarted = api.start(); await eventually(() => api.notices.slice(count).some(notice => notice.type === 'admission-blocked'));
  restarted.controller.abort(); await restarted.promise; expect(api.writes()).toBe(1); expect((await api.admission()).assignments).toHaveLength(1);
  facts.samples.push({ scenario: 'lost-acknowledgement', writes: api.writes(), events: 1, journalRetained: true, verificationStatus: 'pending' });
});

it('preserves ordinary text verification but cannot accept engineering success when a task is misdirected to an ordinary fixture', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-eng01a-ordinary-'));
  const identity = await owner.registerRunner({ name: 'Ordinary fixture compatibility', harnesses: ['fixture'], capacity: 1 });
  const plain = await owner.submit({ title: 'Ordinary compatibility', prompt: 'Text fixture remains compatible', harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 } }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [plain.task.id]);
  const controller = new AbortController(), notices: RunnerNotice[] = [];
  const promise = runRunner({ baseUrl, token: identity.token, workingDirectory: directory, adapters: [createFixtureAdapter()], signal: controller.signal,
    pollIntervalMs: 10, heartbeatIntervalMs: 40, onNotice: notice => notices.push(notice) });
  void promise.catch(() => undefined);
  cleanup.push(async () => { controller.abort(); await promise; await rm(directory, { recursive: true }); });
  await eventually(async () => (await owner.show(plain.task.id)).status === 'succeeded');
  expect((await owner.show(plain.task.id)).verificationStatus).toBe('passed');
  await expect(owner.submit({ title: 'Deliberately misdirected engineering', prompt: 'No engineering configuration here', harness: 'fixture', engineering: {
    protocol: 'flow.engineering.v1', targetRunnerId: identity.runnerId, projectId: 'not-registered', baseCommit: 'a'.repeat(40), checker: { id: 'not-registered', version: '1', baselineDigest: 'b'.repeat(64) } } }, randomUUID())).rejects.toMatchObject({ status: 409 });
  expect(notices.some(notice => notice.type === 'admission-blocked')).toBe(false);
  facts.samples.push({ scenario: 'misdirected-ordinary-fixture', accepted: false, actuallyClaimed: false, status: 409, legacyTextTask: 'succeeded/passed' });
});
