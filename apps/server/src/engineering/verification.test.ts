import { publishEngineeringProfile } from './profile.js';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { taskSubmissionSchema, type RunnerEventData } from '@flow/contracts';
import { engineeringReceiptResult, engineeringReceiptJson, engineeringSnapshotJson, engineeringVerificationInput, type EngineeringIntent, type EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';
import { createServer } from '../index.js';
import { sha256 } from '../database.js';

const database = `flow_eng01a_contract_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
let pool: Pool, app: Awaited<ReturnType<typeof createServer>>, owner: FlowClient, baseUrl: string, created = false;
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw new Error('Refusing an existing database.');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  app = await createServer({ databaseUrl, ownerToken: 'eng01a-owner', leaseMs: 300_000, automaticQueueScan: false });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: 'eng01a-owner' });
});
afterAll(async () => {
  let databaseRemoved = false;
  try {
    app?.server.closeAllConnections(); await app?.close(); await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${database}`);
    databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
    expect(databaseRemoved).toBe(true);
  } finally {
    await admin.end();
    if (process.env.FLOW_ENG01A_EVIDENCE) await writeFile(process.env.FLOW_ENG01A_EVIDENCE, JSON.stringify({ database, databaseRemoved, providerCalls: 0, receiptEvidence: 'Injected contract records, not actual checker/Git execution' }, null, 2) + '\n');
  }
});

async function scenario() {
  const target = await owner.registerRunner({ name: 'Dedicated engineering fixture', harnesses: ['fixture'], capacity: 1 });
  const runner = new FlowClient({ baseUrl, token: target.token });
  const intent: EngineeringIntent = { protocol: 'flow.engineering.v1', targetRunnerId: target.runnerId, projectId: 'synthetic-project', baseCommit: 'a'.repeat(40), checker: { id: 'synthetic-checker', version: '1', baselineDigest: 'b'.repeat(64) } };
  intent.profile = (await publishEngineeringProfile(pool, target.runnerId, { protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: 'calculator-v1', project: { id: intent.projectId, baseCommit: intent.baseCommit }, checker: intent.checker, limits: { checkerTimeoutMs: 1000 } })).profile.reference;
  const accepted = await owner.submit({ title: 'Engineering receipt contract', prompt: 'Synthetic contract only', harness: 'fixture', engineering: intent }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
  const assignment = (await runner.claim()).assignment;
  expect(assignment?.task.id).toBe(accepted.task.id);
  const ownership = { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion };
  const receipt: EngineeringReceipt = { protocol: 'flow.engineering.receipt.v1', intent,
    workspace: { leaseId: randomUUID(), baseCommit: intent.baseCommit, headCommit: intent.baseCommit, beforeDigest: '', afterDigest: '', files: [] },
    checker: { id: intent.checker.id, version: intent.checker.version, baselineBeforeDigest: intent.checker.baselineDigest, baselineAfterDigest: intent.checker.baselineDigest, commandDigest: 'c'.repeat(64), expectedChecks: ['independent-check'], checks: [{ id: 'independent-check', passed: true }] },
    command: { exitCode: 0, signal: null, timedOut: false, outputTruncated: false, childExited: true, elapsedMs: 1, stdout: 'Injected result', stderr: '' },
    diff: { content: '', digest: sha256('') }, result: 'passed' };
  // The test is explicit synthetic evidence; it proves center linkage, never remote execution.
  receipt.workspace.beforeDigest = receipt.workspace.afterDigest = sha256(engineeringSnapshotJson(receipt.workspace));
  function publication(value = receipt) {
    value.result = engineeringReceiptResult(value);
    const content = engineeringReceiptJson(value), artifactId = randomUUID(), version = sha256(content);
    const artifact: RunnerEventData = { type: 'artifact', artifactId, title: 'Engineering receipt', version, content, mediaType: 'application/json' };
    const verification: RunnerEventData = { type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.engineering', verifierVersion: '1', inputDigest: sha256(engineeringVerificationInput(version, intent)), result: value.result === 'passed' ? 'passed' : 'failed', evidence: 'Trusted host receipt association only.' };
    return { artifact, verification, artifactId, version };
  }
  const report = (events: RunnerEventData[], first = 1, own = ownership) => runner.report({ ...own, events: events.map((event, index) => ({ ...event, id: randomUUID(), sequence: first + index })) });
  return { taskId: accepted.task.id, runner, target, ownership, intent, receipt, publication, report };
}

it('pins engineering work to its designated fixture runner before claim', async () => {
  const target = await owner.registerRunner({ name: 'Engineering target', harnesses: ['fixture'] });
  const other = await owner.registerRunner({ name: 'Ordinary fixture', harnesses: ['fixture'] });
  const intent: EngineeringIntent = { protocol: 'flow.engineering.v1', targetRunnerId: target.runnerId, projectId: 'project', baseCommit: 'a'.repeat(40), checker: { id: 'checker', version: '1', baselineDigest: 'b'.repeat(64) } } as const;
  intent.profile = (await publishEngineeringProfile(pool, target.runnerId, { protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: 'calculator-v1', project: { id: intent.projectId, baseCommit: intent.baseCommit }, checker: intent.checker, limits: { checkerTimeoutMs: 1000 } })).profile.reference;
  const task = await owner.submit({ title: 'Pinned', prompt: 'Test routing', harness: 'fixture', engineering: intent }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.task.id]);
  expect((await new FlowClient({ baseUrl, token: other.token }).claim()).assignment).toBeNull();
  expect((await new FlowClient({ baseUrl, token: target.token }).claim()).assignment?.task.id).toBe(task.task.id);
  for (const extra of [{ harness: 'claude' }, { harness: 'codex' }, { verification: { kind: 'nonempty' } }, { fixture: { scenario: 'success' } }, { resumeSessionId: 'old' }]) {
    expect(taskSubmissionSchema.safeParse({ title: 'No mixed authority', prompt: 'Test', harness: 'fixture', engineering: intent, ...extra }).success).toBe(false);
  }
});

it('rolls back a whole batch when engineering success has no verified artifact, then accepts and replays the exact valid receipt', async () => {
  const api = await scenario();
  await expect(api.report([{ type: 'message', text: 'Must roll back' }, { type: 'completed', outcome: 'succeeded' }])).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [api.ownership.attemptId])).rows[0].last_sequence).toBe(0);
  const { artifact, verification } = api.publication();
  const batch = { ...api.ownership, events: [artifact, verification, { type: 'completed', outcome: 'succeeded' } as const].map((event, index) => ({ ...event, id: randomUUID(), sequence: index + 1 })) };
  expect(await api.runner.report(batch)).toMatchObject({ accepted: 3, lastSequence: 3 });
  expect(await api.runner.report(batch)).toMatchObject({ accepted: 0, lastSequence: 3 });
  const task = await owner.show(api.taskId); expect(task).toMatchObject({ status: 'succeeded', verificationStatus: 'passed' });
  const artifactReference = task.entries.find(entry => entry.kind === 'reference');
  if (artifactReference?.kind !== 'reference') throw new Error('Missing saved artifact reference');
  expect((await owner.detail(artifactReference.reference.id)).content).toBe(artifact.type === 'artifact' ? artifact.content : '');
});

it('rejects text verification for engineering and rejects engineering receipts for ordinary tasks', async () => {
  const api = await scenario(); const { artifact, verification } = api.publication();
  await api.report([artifact]);
  await expect(api.report([{ ...verification, verifierId: 'flow.text' } as RunnerEventData], 2)).rejects.toMatchObject({ status: 409 });
  const ordinary = await owner.submit({ title: 'Ordinary', prompt: 'Ordinary fixture', harness: 'fixture' }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [ordinary.task.id]);
  const registration = await owner.registerRunner({ name: 'Ordinary test', harnesses: ['fixture'] });
  const runner = new FlowClient({ baseUrl, token: registration.token }); const assignment = (await runner.claim()).assignment!;
  expect(assignment.task.id).toBe(ordinary.task.id);
  await expect(runner.report({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    events: [artifact, verification].map((event, index) => ({ ...event, id: randomUUID(), sequence: index + 1 })) })).rejects.toMatchObject({ status: 409 });
});

it('refuses success when a newer artifact invalidates the earlier passed receipt', async () => {
  const api = await scenario(); const old = api.publication(); await api.report([old.artifact, old.verification]);
  const newer = api.publication({ ...api.receipt, workspace: { ...api.receipt.workspace, leaseId: randomUUID() } });
  await api.report([newer.artifact], 3);
  await expect(api.report([{ type: 'completed', outcome: 'succeeded' }], 4)).rejects.toMatchObject({ status: 409 });
  expect((await owner.show(api.taskId)).verificationStatus).toBe('pending');
});

it('requires the current attempt rather than inheriting a prior attempt passed receipt', async () => {
  const api = await scenario(); const publication = api.publication(); await api.report([publication.artifact, publication.verification]);
  const attemptId = randomUUID();
  await pool.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE task_id=$1', [api.taskId]);
  await pool.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,2,clock_timestamp()+interval '5 minutes')", [attemptId, api.taskId, api.target.runnerId]);
  await pool.query('UPDATE flow.tasks SET current_attempt_id=$2,owner_version=2 WHERE id=$1', [api.taskId, attemptId]);
  await expect(api.report([{ type: 'completed', outcome: 'succeeded' }], 1, { attemptId, ownerVersion: 2 })).rejects.toMatchObject({ status: 409 });
});

it('keeps failed checker evidence readable and rejects a succeeded terminal for it', async () => {
  const api = await scenario(); api.receipt.command.exitCode = 1; api.receipt.checker.checks[0]!.passed = false;
  const failed = api.publication(); await api.report([failed.artifact, failed.verification]);
  await expect(api.report([{ type: 'completed', outcome: 'succeeded' }], 3)).rejects.toMatchObject({ status: 409 });
  await api.report([{ type: 'completed', outcome: 'failed' }], 3);
  expect(await owner.show(api.taskId)).toMatchObject({ status: 'failed', verificationStatus: 'failed' });
});

it.each(['intent', 'snapshot', 'diff', 'result'] as const)('rejects forged %s association even if the artifact has a matching content hash', async changed => {
  const api = await scenario(); const value = structuredClone(api.receipt);
  if (changed === 'intent') value.intent.projectId = 'another-project';
  if (changed === 'snapshot') value.workspace.beforeDigest = value.workspace.afterDigest = 'd'.repeat(64);
  if (changed === 'diff') value.diff.content = 'Unbound changed diff';
  if (changed === 'result') value.command.exitCode = 3;
  const content = engineeringReceiptJson(value), version = sha256(content), artifactId = randomUUID();
  await api.report([{ type: 'artifact', artifactId, title: 'Untrusted receipt', version, content, mediaType: 'application/json' }]);
  await expect(api.report([{ type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.engineering', verifierVersion: '1',
    inputDigest: sha256(engineeringVerificationInput(version, api.intent)), result: 'passed', evidence: 'Not trusted by content hash alone.' }], 2)).rejects.toMatchObject({ status: 409 });
});
