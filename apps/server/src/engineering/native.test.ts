import { randomUUID } from 'node:crypto';
import { writeFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareEngineeringSetup } from '../../../runner/src/engineering/setup.js';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { taskSubmissionSchema, type RunnerEventData } from '@flow/contracts';
import { nativeEngineeringProfileConfigurationJson, nativeEngineeringProfilePageSchema, nativeEngineeringProfilePublishedSchema,
  nativeEngineeringReceiptJson, nativeEngineeringVerificationInput, type NativeEngineeringProfileConfiguration,
  type NativeEngineeringIntent, type NativeEngineeringReceipt } from '../../../../packages/contracts/src/engineering-native.js';
import { createCalculatorReceipt } from '../../../runner/src/engineering/calculator-receipt.js';
import { engineeringSnapshotJson } from '../../../../packages/contracts/src/engineering.js';
import { createServer } from '../index.js';
import { sha256, transaction } from '../database.js';
import { assertTaskExecutionProfile, requireExecutionProfile } from '../execution-profiles/store.js';

const database = `flow_eng01h_${randomUUID().replaceAll('-', '')}`, marker = randomUUID();
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool, app: Awaited<ReturnType<typeof createServer>>, owner: FlowClient, baseUrl: string, created = false;
const ownerToken = 'eng01h-synthetic-owner';
const configuration: NativeEngineeringProfileConfiguration = { protocol: 'flow.engineering-profile.v2', harness: 'codex', adapterVersion: 'engineering-codex-1', purpose: 'engineering-native', recipe: 'calculator-arithmetic-v1',
  project: { id: 'owned-calculator', baseCommit: 'a'.repeat(40) }, checker: { id: 'calculator-arithmetic', version: '1', sourcePolicy: 'flow.calculator-source.v1' },
  model: 'gpt-5.6-sol', authority: { policy: 'calculator-file-only-v1', qualificationDigest: 'b'.repeat(64) }, limits: { writerTimeoutMs: 1000 } };
const submission = (engineering: NativeEngineeringIntent) => ({ title: 'Native engineering contract', prompt: 'Synthetic center records only', harness: 'codex' as const, engineering });
async function request(path: string, body?: unknown, token = ownerToken) {
  const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw Error('Refusing existing database.');
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  await pool.query('CREATE TABLE public.eng01h_owner (id uuid PRIMARY KEY)'); await pool.query('INSERT INTO public.eng01h_owner VALUES($1)', [marker]);
  app = await createServer({ databaseUrl, ownerToken, automaticQueueScan: false, leaseMs: 300_000 });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: ownerToken });
});
beforeEach(async () => { await pool.query('UPDATE flow.runners SET revoked=true'); });
afterAll(async () => {
  let databaseRemoved = false;
  try {
    app?.server.closeAllConnections(); await app?.close();
    if (created) { expect((await pool.query('SELECT id FROM public.eng01h_owner')).rows).toEqual([{ id: marker }]); await pool.end(); await admin.query(`DROP DATABASE ${database}`); }
    databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount; expect(databaseRemoved).toBe(true);
  } finally { await admin.end(); if (process.env.FLOW_ENG01H_EVIDENCE) await writeFile(process.env.FLOW_ENG01H_EVIDENCE, JSON.stringify({ database, marker, databaseRemoved, providerCalls: 0, source: 'Injected runner declaration and real PG/HTTP; no native authority or execution' }, null, 2) + '\n'); }
});
async function configured() {
  const registration = await owner.registerRunner({ name: 'Synthetic native declaration', harnesses: ['codex'], capacity: 1 });
  const response = await request('/api/runner/native-engineering-profile', { configuration }, registration.token); expect(response.status).toBe(200);
  const { profile } = nativeEngineeringProfilePublishedSchema.parse(response.body);
  const intent: NativeEngineeringIntent = { protocol: 'flow.engineering.v2', targetRunnerId: registration.runnerId, projectId: configuration.project.id,
    baseCommit: configuration.project.baseCommit, checker: configuration.checker, profile: profile.reference };
  return { registration, profile, intent, runner: new FlowClient({ baseUrl, token: registration.token }) };
}
async function scenario() {
  const api = await configured(), accepted = await owner.submit(submission(api.intent), randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
  const assignment = (await api.runner.claim()).assignment; expect(assignment?.task.id).toBe(accepted.task.id);
  const identity = { taskId: accepted.task.id, attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, runnerId: api.registration.runnerId };
  const ownership = { attemptId: identity.attemptId, ownerVersion: identity.ownerVersion }, leaseId = randomUUID();
  const source = 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n';
  const files = [{ path: 'calculator.mjs', base: { oid: 'c'.repeat(40), mode: '100644' as const }, index: { oid: 'c'.repeat(40), mode: '100644' as const }, worktree: { digest: sha256(source), bytes: Buffer.byteLength(source), mode: '100644' as const } }];
  const workspace = { leaseId, baseCommit: api.intent.baseCommit, headCommit: api.intent.baseCommit, files, beforeDigest: sha256(engineeringSnapshotJson({ baseCommit: api.intent.baseCommit, headCommit: api.intent.baseCommit, files })), afterDigest: '' }; workspace.afterDigest = workspace.beforeDigest;
  // Real pure host checker output, with explicit injected writer declaration; no native execution is implied.
  const check = createCalculatorReceipt({ identity, workspace, source, diff: { content: '', digest: sha256('') } });
  const receipt = JSON.parse(JSON.stringify({ protocol: 'flow.engineering.native-receipt.v1', intent: api.intent, check,
    writer: { identity, leaseId, baseCommit: api.intent.baseCommit, profile: api.profile.reference, ...configuration.authority, model: configuration.model, writeAccess: 'revoked' }, result: 'passed' })) as NativeEngineeringReceipt;
  function publication(value = receipt) {
    const content = nativeEngineeringReceiptJson(value), artifactId = randomUUID(), version = sha256(content);
    const artifact: RunnerEventData = { type: 'artifact', artifactId, title: 'Native engineering receipt', content, version, mediaType: 'application/json' };
    const verification = { type: 'verification' as const, artifactId, artifactVersion: version, verifierId: 'flow.engineering.native' as const, verifierVersion: '1' as const,
      inputDigest: sha256(nativeEngineeringVerificationInput(version, api.intent)), result: value.result, evidence: 'Center declaration association only' };
    return { artifact, verification, artifactId, version };
  }
  const batch = (events: RunnerEventData[]) => ({ ...ownership, events: events.map((event, index) => ({ ...event, id: randomUUID(), sequence: index + 1 })) });
  return { ...api, taskId: accepted.task.id, identity, ownership, receipt, publication, batch };
}
it('publishes immutable native purpose separately without claiming host qualification', async () => {
  const api = await configured(); expect(api.profile.reference.configDigest).toBe(sha256(nativeEngineeringProfileConfigurationJson(configuration)));
  expect(api.profile.availability).toBe('host-qualification-required');
  expect((await request('/api/runner/native-engineering-profile', { configuration }, api.registration.token)).body).toEqual({ profile: api.profile, replayed: true });
  expect((await request('/api/runner/native-engineering-profile', { configuration: { ...configuration, model: 'gpt-6-astra' } }, api.registration.token)).status).toBe(409);
  for (const extra of [{ qualified: true }, { argv: [] }, { model: 'unknown' }, { authority: { policy: 'calculator-file-only-v1' } }]) expect((await request('/api/runner/native-engineering-profile', { configuration: { ...configuration, ...extra } }, api.registration.token)).status).toBe(400);
});
it('paginates only native engineering declarations and keeps all old catalogs unchanged', async () => {
  const a = await configured(), b = await configured(), first = await request('/api/native-engineering-profiles?limit=1'); expect(first.cache).toBe('no-store');
  const p1 = nativeEngineeringProfilePageSchema.parse(first.body), p2 = nativeEngineeringProfilePageSchema.parse((await request(`/api/native-engineering-profiles?limit=1&after=${p1.nextCursor}`)).body);
  expect([...p1.profiles, ...p2.profiles].map(p => p.reference.id).sort()).toEqual([a.profile.reference.id, b.profile.reference.id].sort()); expect(p2.nextCursor).toBeNull();
  for (const route of ['/api/engineering-profiles', '/api/execution-profiles']) expect((await request(route)).body.profiles).toEqual([]);
  expect((await owner.nativeExecutionProfiles()).profiles).toEqual([]);
  expect((await request('/api/native-engineering-profiles?limit=101')).status).toBe(400); expect((await request('/api/native-engineering-profiles?after=bad')).status).toBe(400);
});
it.each(['target', 'project', 'base', 'checker', 'digest'] as const)('rejects mismatched %s at admission', async field => {
  const api = await configured(), intent = structuredClone(api.intent);
  if (field === 'target') intent.targetRunnerId = randomUUID();
  if (field === 'project') intent.projectId = 'other';
  if (field === 'base') intent.baseCommit = 'd'.repeat(40);
  if (field === 'checker') (intent.checker as { version: string }).version = '2';
  if (field === 'digest') intent.profile.configDigest = 'd'.repeat(64);
  const response = await request('/api/tasks', submission(intent)); expect([400, 409]).toContain(response.status);
});
it('rejects mixed ordinary, fixture, conversation and planner purposes', async () => {
  const api = await configured(); expect(taskSubmissionSchema.safeParse(submission(api.intent)).success).toBe(true);
  for (const extra of [{ harness: 'fixture' }, { executionProfile: api.profile.reference }, { fixture: { scenario: 'success' } }, { resumeSessionId: 'old' }, { verification: { kind: 'nonempty' } }]) expect(taskSubmissionSchema.safeParse({ ...submission(api.intent), ...extra }).success).toBe(false);
  for (const purpose of ['ordinary', 'goal-tools', 'goal-graph-tools'] as const) await expect(transaction(pool, client => requireExecutionProfile(client, api.profile.reference, purpose))).rejects.toMatchObject({ status: 409 });
  for (const purpose of ['goal-tools', 'goal-graph-tools'] as const) await expect(transaction(pool, client => assertTaskExecutionProfile(client, submission(api.intent), purpose))).rejects.toMatchObject({ status: 409 });
  expect((await request('/api/conversations', { title: 'Wrong purpose', harness: 'claude', executionProfile: api.profile.reference })).status).toBe(409);
});
it('filters historical malformed and ordinary tasks before claim and routes a valid pin once', async () => {
  const api = await configured(), other = await owner.registerRunner({ name: 'Other codex', harnesses: ['codex'] });
  const ordinary = await owner.submit(submission(api.intent), randomUUID());
  await pool.query("UPDATE flow.tasks SET submission=submission-'engineering',dispatch_ready=true WHERE id=$1", [ordinary.task.id]);
  const stale = await owner.submit(submission(api.intent), randomUUID());
  await pool.query("UPDATE flow.tasks SET submission=submission #- '{engineering,profile}' WHERE id=$1", [stale.task.id]);
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [stale.task.id]);
  expect((await api.runner.claim()).assignment).toBeNull();
  // The ordinary Codex gate still rejects this deliberately unpinned historical row.
  await expect(new FlowClient({ baseUrl, token: other.token }).claim()).rejects.toMatchObject({ status: 409 });
  const valid = await owner.submit(submission(api.intent), randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [valid.task.id]);
  expect((await api.runner.claim()).assignment?.task.id).toBe(valid.task.id); expect((await api.runner.claim()).assignment).toBeNull();
});
it('saves an exact current receipt, reads it publicly, and replays the same lost-ACK batch without a second completion', async () => {
  const api = await scenario(), { artifact, verification } = api.publication(); const batch = api.batch([artifact, verification, { type: 'completed', outcome: 'succeeded' }]);
  expect(await api.runner.report(batch)).toEqual({ accepted: 3, lastSequence: 3 }); expect(await api.runner.report(batch)).toEqual({ accepted: 0, lastSequence: 3 });
  const shown = await owner.show(api.taskId); expect(shown).toMatchObject({ status: 'succeeded', verificationStatus: 'passed' });
  const refs = shown.entries.filter(e => e.kind === 'reference'); const details = await Promise.all(refs.map(e => owner.detail(e.reference.id)));
  expect(details.some(d => d.content === (artifact.type === 'artifact' ? artifact.content : ''))).toBe(true);
});
it('rolls back a succeeded batch without a verified native receipt', async () => {
  const api = await scenario(); await expect(api.runner.report(api.batch([{ type: 'message', text: 'rollback' }, { type: 'completed', outcome: 'succeeded' }]))).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [api.identity.attemptId])).rows[0].last_sequence).toBe(0);
});
it.each(['attempt', 'task', 'owner', 'runner', 'lease', 'pin', 'qualification', 'model', 'base', 'snapshot', 'diff', 'source', 'result', 'artifact', 'verifier'] as const)('rejects wrong %s evidence and preserves batch sequence', async field => {
  const api = await scenario(), value = structuredClone(api.receipt);
  if (field === 'attempt') value.check.identity.attemptId = randomUUID();
  if (field === 'task') value.check.identity.taskId = randomUUID();
  if (field === 'owner') value.check.identity.ownerVersion++;
  if (field === 'runner') value.check.identity.runnerId = randomUUID();
  if (field === 'lease') value.writer.leaseId = randomUUID();
  if (field === 'pin') value.writer.profile.configDigest = 'd'.repeat(64);
  if (field === 'qualification') value.writer.qualificationDigest = 'd'.repeat(64);
  if (field === 'model') value.writer.model = 'gpt-6-astra';
  if (field === 'base') value.writer.baseCommit = 'd'.repeat(40);
  if (field === 'snapshot') value.check.workspace.afterDigest = 'd'.repeat(64);
  if (field === 'diff') value.check.diff.digest = 'd'.repeat(64);
  if (field === 'source') value.check.source += ' ';
  if (field === 'result' && value.check.report.result !== 'rejected') value.check.report.checks[0].passed = false;
  const { artifact, verification } = api.publication(value);
  const event: RunnerEventData = field === 'verifier' ? { ...verification, verifierId: 'flow.text' } : verification;
  if (field === 'artifact') event.artifactId = randomUUID();
  await expect(api.runner.report(api.batch([artifact, event, { type: 'completed', outcome: 'succeeded' }]))).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [api.identity.attemptId])).rows[0].last_sequence).toBe(0);
});
it('records a failed host check but refuses success and leaves the exact batch replayable', async () => {
  const api = await scenario(), receipt = structuredClone(api.receipt); receipt.result = 'failed';
  if (receipt.check.report.result === 'rejected') throw Error('Expected check'); receipt.check.report.result = 'failed'; receipt.check.report.checks[0].passed = false;
  const { artifact, verification } = api.publication(receipt);
  await expect(api.runner.report(api.batch([artifact, verification, { type: 'completed', outcome: 'succeeded' }]))).rejects.toMatchObject({ status: 409 });
  const batch = api.batch([artifact, verification, { type: 'completed', outcome: 'failed' }]); expect((await api.runner.report(batch)).accepted).toBe(3);
  expect(await owner.show(api.taskId)).toMatchObject({ status: 'failed', verificationStatus: 'failed' });
});
it('rechecks revocation before claim and rejects another harness publication', async () => {
  const api = await configured(), other = await owner.registerRunner({ name: 'Fixture', harnesses: ['fixture'] });
  expect((await request('/api/runner/native-engineering-profile', { configuration }, other.token)).status).toBe(409);
  await owner.revokeRunner(api.registration.runnerId); await expect(api.runner.claim()).rejects.toMatchObject({ status: 401 });
  expect((await request('/api/native-engineering-profiles')).body.profiles).toEqual([]);
});

it('rejects a corrupt recognized pagination sentinel instead of hiding it', async () => {
  const a = await configured(), b = await configured(), last = [a.profile.reference.id, b.profile.reference.id].sort().at(-1)!;
  // Immutable production rows cannot be edited; temporarily disable only the local synthetic trigger for corruption coverage.
  await pool.query('ALTER TABLE flow.execution_profiles DISABLE TRIGGER USER');
  try { await pool.query("UPDATE flow.execution_profiles SET configuration=configuration || '{\"extra\":true}'::jsonb WHERE id=$1", [last]); }
  finally { await pool.query('ALTER TABLE flow.execution_profiles ENABLE TRIGGER USER'); }
  expect((await request('/api/native-engineering-profiles?limit=1')).status).toBe(409);
});
it('does not let an earlier passed artifact authorize a newer unverified artifact', async () => {
  const api = await scenario(), first = api.publication(), second = api.publication();
  await expect(api.runner.report(api.batch([first.artifact, first.verification, second.artifact, { type: 'completed', outcome: 'succeeded' }]))).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1', [api.identity.attemptId])).rows[0].last_sequence).toBe(0);
});
it('rejects unknown writer settlement and oversized receipt bytes before verification', async () => {
  const api = await scenario();
  const original = api.publication(), parsed = JSON.parse(original.artifact.type === 'artifact' ? original.artifact.content : '');
  for (const content of [JSON.stringify({ ...parsed, writer: { ...parsed.writer, writeAccess: 'unknown' } }), ' '.repeat(524_288) + JSON.stringify(parsed)]) {
    const version = sha256(content), artifact = { ...original.artifact, content, version };
    const verification = { ...original.verification, artifactVersion: version, inputDigest: sha256(nativeEngineeringVerificationInput(version, api.intent)) };
    await expect(api.runner.report(api.batch([artifact, verification, { type: 'completed', outcome: 'succeeded' }]))).rejects.toMatchObject({ status: 409 });
  }
});
it('does not treat the native verifier as ordinary nonempty text verification', async () => {
  const registration = await owner.registerRunner({ name: 'Ordinary fixture', harnesses: ['fixture'] }), runner = new FlowClient({ baseUrl, token: registration.token });
  const accepted = await owner.submit({ title: 'Ordinary', prompt: 'Text only', harness: 'fixture' }, randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
  const assignment = (await runner.claim()).assignment!, artifactId = randomUUID(), content = 'nonempty', version = sha256(content);
  await expect(runner.report({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'artifact', artifactId, content, title: 'Ordinary output', mediaType: 'text/plain', version },
    { id: randomUUID(), sequence: 2, type: 'verification', verifierId: 'flow.engineering.native', verifierVersion: '1', artifactId, artifactVersion: version,
      inputDigest: sha256(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Must not use text rule' },
  ] })).rejects.toMatchObject({ status: 409 });
});

it('does not make the existing production host executable by publishing a native declaration', async () => {
  const api = await configured(), directory = await mkdtemp(join(tmpdir(), 'flow-eng01h-unsupported-'));
  try {
    const manifest = join(directory, 'native.json'); await writeFile(manifest, JSON.stringify({ protocol: 'flow.engineering-setup.v2', configuration: api.profile.configuration }));
    await expect(prepareEngineeringSetup(join(directory, 'host'), manifest)).rejects.toThrow();
    expect(await readdir(directory)).toEqual(['native.json']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
