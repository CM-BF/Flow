import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createServer } from '../index.js';
import { registerEngineeringRoutes } from './index.js';
import { engineeringProfileConfigurationJson, engineeringProfilePageSchema, engineeringProfilePublishedSchema, type EngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-profile.js';
import { type EngineeringIntent } from '../../../../packages/contracts/src/engineering.js';
import { requireExecutionProfile, assertTaskExecutionProfile } from '../execution-profiles/store.js';
import { sha256, transaction } from '../database.js';

const database = `flow_eng01b_profile_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'eng01b-profile-owner';
let pool: Pool, app: Awaited<ReturnType<typeof createServer>>, baseUrl: string, owner: FlowClient, creationRequested = false;
const configuration: EngineeringProfileConfiguration = { protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: 'calculator-v1',
  project: { id: 'trusted-project', baseCommit: 'a'.repeat(40) }, checker: { id: 'trusted-checker', version: '1', baselineDigest: 'b'.repeat(64) }, limits: { checkerTimeoutMs: 1000 } };
async function request(path: string, body?: unknown, token = ownerToken, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
async function configured() {
  const registration = await owner.registerRunner({ name: 'Dedicated trusted fixture', harnesses: ['fixture'], capacity: 1 });
  const response = await request('/api/runner/engineering-profile', { configuration }, registration.token);
  expect(response.status).toBe(200);
  const { profile } = engineeringProfilePublishedSchema.parse(response.body);
  const intent: EngineeringIntent = { protocol: 'flow.engineering.v1', targetRunnerId: registration.runnerId, projectId: configuration.project.id, baseCommit: configuration.project.baseCommit, checker: configuration.checker, profile: profile.reference };
  return { registration, profile, intent, runner: new FlowClient({ baseUrl, token: registration.token }) };
}
const task = (engineering: EngineeringIntent) => ({ title: 'Pinned engineering fixture', prompt: 'Repair trusted fixture', harness: 'fixture' as const, engineering });
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) throw new Error('Refusing existing database.');
  creationRequested = true; await admin.query(`CREATE DATABASE ${database}`);
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  pool = new Pool({ connectionString: databaseUrl, max: 2, statement_timeout: 5000 });
  app = await createServer({ databaseUrl, ownerToken, automaticQueueScan: false });
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/engineering-profile' })) registerEngineeringRoutes(app, pool);
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl, token: ownerToken });
});
beforeEach(async () => { await pool.query('UPDATE flow.runners SET revoked=true'); });
afterAll(async () => {
  let databaseRemoved = false;
  try {
    app?.server.closeAllConnections(); await app?.close(); await pool?.end();
    if (creationRequested && (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query(`DROP DATABASE ${database}`);
    databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount; expect(databaseRemoved).toBe(true);
  } finally { await admin.end(); if (process.env.FLOW_ENG01B_EVIDENCE) await writeFile(process.env.FLOW_ENG01B_EVIDENCE, JSON.stringify({ database, databaseRemoved, providerCalls: 0 }, null, 2) + '\n'); }
});
it('publishes one immutable engineering profile per runner and replays only its canonical configuration', async () => {
  const api = await configured(); expect(api.profile.reference.configDigest).toBe(sha256(engineeringProfileConfigurationJson(configuration)));
  expect(api.profile).toMatchObject({ source: 'trusted-fixture-setup', availability: 'not-probed' });
  expect((await request('/api/runner/engineering-profile', { configuration }, api.registration.token)).body).toEqual({ profile: api.profile, replayed: true });
  expect((await request('/api/runner/engineering-profile', { configuration: { ...configuration, limits: { checkerTimeoutMs: 2000 } } }, api.registration.token)).status).toBe(409);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.execution_profiles WHERE runner_id=$1', [api.registration.runnerId])).rows[0].n).toBe(1);
});
it('rejects unrecognized recipe, task-supplied local configuration, wrong harness and revoked identity', async () => {
  const api = await configured();
  for (const extra of [{ recipe: 'arbitrary' }, { argv: ['node'] }, { path: '/private' }, { env: {} }, { source: 'task' }]) expect((await request('/api/runner/engineering-profile', { configuration: { ...configuration, ...extra } }, api.registration.token)).status).toBe(400);
  const native = await owner.registerRunner({ name: 'Native identity', harnesses: ['claude'] });
  expect((await request('/api/runner/engineering-profile', { configuration }, native.token)).status).toBe(409);
  await owner.revokeRunner(api.registration.runnerId);
  expect((await request('/api/runner/engineering-profile', { configuration }, api.registration.token)).status).toBe(401);
});
it('paginates engineering profiles independently while preserving empty legacy/native catalogs', async () => {
  const first = await configured(), second = await configured();
  const page1 = await request('/api/engineering-profiles?limit=1'); expect(page1.cache).toBe('no-store');
  const parsed1 = engineeringProfilePageSchema.parse(page1.body); expect(parsed1.profiles).toHaveLength(1); expect(parsed1.nextCursor).not.toBeNull();
  const parsed2 = engineeringProfilePageSchema.parse((await request(`/api/engineering-profiles?limit=1&after=${parsed1.nextCursor}`)).body);
  expect([...parsed1.profiles, ...parsed2.profiles].map(value => value.reference.id).sort()).toEqual([first.profile.reference.id, second.profile.reference.id].sort()); expect(parsed2.nextCursor).toBeNull();
  for (const headers of [{}, { 'X-Flow-Execution-Profile': 'native-v1' }] as Record<string, string>[]) expect((await request('/api/execution-profiles', undefined, ownerToken, headers)).body.profiles).toEqual([]);
  expect((await request('/api/engineering-profiles?after=bad')).status).toBe(400); expect((await request('/api/engineering-profiles?limit=101')).status).toBe(400);
});
it.each(['profile', 'target', 'project', 'base', 'checker', 'digest'] as const)('rejects mismatched %s before creating a task', async field => {
  const api = await configured(), intent = structuredClone(api.intent);
  if (field === 'profile') delete intent.profile;
  if (field === 'target') intent.targetRunnerId = randomUUID();
  if (field === 'project') intent.projectId = 'wrong';
  if (field === 'base') intent.baseCommit = 'c'.repeat(40);
  if (field === 'checker') intent.checker.baselineDigest = 'c'.repeat(64);
  if (field === 'digest') intent.profile!.configDigest = 'c'.repeat(64);
  const before = (await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n;
  await expect(owner.submit(task(intent), randomUUID())).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n).toBe(before);
});
it('rejects engineering pins for ordinary native/conversation/goal authority', async () => {
  const api = await configured();
  await expect(owner.submit({ title: 'Wrong purpose', prompt: 'No engineering intent', harness: 'claude', executionProfile: api.profile.reference }, randomUUID())).rejects.toMatchObject({ status: 409 });
  for (const purpose of ['ordinary', 'goal-tools', 'goal-graph-tools'] as const) await expect(transaction(pool, client => requireExecutionProfile(client, api.profile.reference, purpose))).rejects.toMatchObject({ status: 409 });
  for (const purpose of ['goal-tools', 'goal-graph-tools'] as const) await expect(transaction(pool, client => assertTaskExecutionProfile(client, task(api.intent), purpose))).rejects.toMatchObject({ status: 409 });
  expect((await request('/api/conversations', { title: 'Wrong purpose', harness: 'claude', executionProfile: api.profile.reference })).status).toBe(409);
});
it('filters unpinned historical rows and other purposes before claim without blocking legitimate work', async () => {
  const api = await configured(), other = await owner.registerRunner({ name: 'Ordinary fixture', harnesses: ['fixture'] }), ordinaryRunner = new FlowClient({ baseUrl, token: other.token });
  const legacy = await owner.submit(task(api.intent), randomUUID());
  await pool.query("UPDATE flow.tasks SET submission=submission #- '{engineering,profile}',dispatch_ready=true WHERE id=$1", [legacy.task.id]);
  const ordinary = await owner.submit({ title: 'Ordinary fixture', prompt: 'Legacy behavior', harness: 'fixture' }, randomUUID());
  const valid = await owner.submit(task(api.intent), randomUUID());
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=ANY($1)', [[ordinary.task.id, valid.task.id]]);
  expect((await ordinaryRunner.claim()).assignment?.task.id).toBe(ordinary.task.id);
  expect((await api.runner.claim()).assignment?.task.id).toBe(valid.task.id);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.attempts WHERE task_id=$1', [legacy.task.id])).rows[0].n).toBe(0);
});
it('fails closed on corrupt recognized storage and never uses a digest as a codec', async () => {
  const registration = await owner.registerRunner({ name: 'Corrupt stored input', harnesses: ['fixture'] });
  await pool.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)', [randomUUID(), registration.runnerId, sha256(engineeringProfileConfigurationJson(configuration)), { ...configuration, recipe: 'unknown' }]);
  expect((await request('/api/engineering-profiles')).status).toBe(409);
  expect((await request('/api/runner/engineering-profile', { configuration }, registration.token)).status).toBe(409);
});
it('keeps owner catalog and runner publication roles under the production authentication hook', async () => {
  const api = await configured();
  expect((await request('/api/runner/engineering-profile', { configuration })).status).toBe(403);
  expect((await request('/api/engineering-profiles', undefined, api.registration.token)).status).toBe(403);
  expect((await request('/api/engineering-profiles', undefined, '')).status).toBe(401);
});
