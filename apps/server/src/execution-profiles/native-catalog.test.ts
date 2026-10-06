import { randomUUID, createHash } from 'node:crypto';
import { request as rawRequest } from 'node:http';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, nativeExecutionProfileCatalogPageSchema, nativeExecutionProfileConfigurationJson,
  type NativeExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';

// One owned DB, real public HTTP and no runner/SDK/transport process.
const database = `flow_wpf02_catalog_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, statement_timeout: 5000 });
const ownerToken = 'wpf02-catalog-synthetic-owner';
let lock: PoolClient | undefined;
const ownedDatabase = { name: database, creationRequested: false };
type OwnedDatabase = typeof ownedDatabase;
async function createOwnedDatabase(owned: OwnedDatabase, sendCreate = (sql: string): Promise<unknown> => lock!.query(sql)) {
  if (!(await lock!.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [owned.name])).rows[0]?.locked) throw new Error('Owned fixture lock unavailable.');
  if ((await lock!.query('SELECT 1 FROM pg_database WHERE datname=$1', [owned.name])).rowCount) throw new Error('Owned fixture already exists.');
  owned.creationRequested = true;
  await sendCreate(`CREATE DATABASE ${owned.name}`);
}
async function cleanupOwnedDatabase(owned: OwnedDatabase) {
  if (!owned.creationRequested) return { state: 'not-requested', database: owned.name } as const;
  try {
    if ((await lock!.query('SELECT 1 FROM pg_database WHERE datname=$1', [owned.name])).rowCount) await lock!.query(`DROP DATABASE ${owned.name}`);
    const remaining = (await lock!.query('SELECT 1 FROM pg_database WHERE datname=$1', [owned.name])).rowCount;
    return { state: remaining === 0 ? 'absent' : 'unknown', database: owned.name } as const;
  } catch {
    // A disconnected admin or remaining connections must be explicit; never FORCE or terminate another session.
    return { state: 'unknown', database: owned.name } as const;
  }
}
let pool: Pool | undefined;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl = '';
let sequence = 0;
const claude: NativeExecutionProfileConfiguration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'configured-alias',
  thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: '0'.repeat(64),
  limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } };
const codex: NativeExecutionProfileConfiguration = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'configured-codex',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 1000, maxOutputBytes: 1024 } };
async function request(path: string, options: { body?: unknown; token?: string; protocol?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method: options.body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${options.token ?? ownerToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
      ...(options.protocol === undefined ? {} : { 'X-Flow-Execution-Profile': options.protocol }) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
const catalog = (query = '') => request(`/api/execution-profiles${query}`, { protocol: 'native-v1' });
async function seed(configuration: NativeExecutionProfileConfiguration, overrides: { raw?: unknown; digest?: string; revoked?: boolean } = {}) {
  const registered = await request('/api/runners', { body: { name: 'WPF02 synthetic catalog', harnesses: [configuration.harness], capacity: 1 } });
  expect(registered.status).toBe(200);
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const configDigest = overrides.digest ?? createHash('sha256').update(nativeExecutionProfileConfigurationJson(configuration)).digest('hex');
  // Direct owned-fixture inserts model future/corrupt stored rows without disabling immutable triggers.
  await pool!.query('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4)',
    [id, registered.body.runnerId, configDigest, overrides.raw ?? configuration]);
  if (overrides.revoked) await request(`/api/runners/${registered.body.runnerId}/revoke`, { body: {} });
  return { reference: { id, runnerId: registered.body.runnerId, configDigest }, token: registered.body.token as string };
}
beforeAll(async () => {
  lock = await admin.connect();
  await createOwnedDatabase(ownedDatabase);
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 5000 });
  server = await createServer({ databaseUrl, ownerToken, automaticQueueScan: false });
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
});
beforeEach(async () => {
  // Old rows remain immutable; revocation isolates this test's catalog without table/trigger mutation.
  await pool!.query('UPDATE flow.runners SET revoked=true');
});
afterAll(async () => {
  try {
    server?.server.closeAllConnections();
    await server?.close();
  } finally {
    try { await pool?.end(); }
    finally {
      try {
        if (ownedDatabase.creationRequested) expect(await cleanupOwnedDatabase(ownedDatabase)).toEqual({ state: 'absent', database });
      }
      finally { lock?.release(); await admin.end(); }
    }
  }
});
it('cleans its exact owned database when CREATE commits but acknowledgement is lost', async () => {
  const owned = { name: `flow_wpf02_catalog_${randomUUID().replaceAll('-', '')}`, creationRequested: false };
  let cleanup: Awaited<ReturnType<typeof cleanupOwnedDatabase>>;
  try {
    await expect(createOwnedDatabase(owned, async sql => {
      await lock!.query(sql);
      throw new Error('Synthetic lost CREATE acknowledgement.');
    })).rejects.toThrow('Synthetic lost CREATE acknowledgement.');
    expect(owned.creationRequested).toBe(true);
    expect((await lock!.query('SELECT 1 FROM pg_database WHERE datname=$1', [owned.name])).rowCount).toBe(1);
  } finally {
    // This second owned database has no application connections; the primary fixture closes its connections in afterAll.
    cleanup = await cleanupOwnedDatabase(owned);
  }
  expect(cleanup).toEqual({ state: 'absent', database: owned.name });
});
it('returns configured native facts with explicit unsupported Codex conversation capability', async () => {
  const c = await seed(claude), x = await seed(codex);
  const response = await catalog();
  expect(response.status).toBe(200); expect(response.cache).toBe('no-store');
  const page = nativeExecutionProfileCatalogPageSchema.parse(response.body);
  expect(page.protocol).toBe(NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL);
  expect(page.profiles.map(item => item.profile.reference)).toEqual([c.reference, x.reference]);
  expect(page.profiles[0]!.conversation).toEqual({ state: 'existing-claude-contract', capabilitySource: 'conversation-response' });
  expect(page.profiles[1]!.conversation).toEqual({ state: 'unsupported', reason: 'codex-conversation-unimplemented' });
  expect(page.profiles[1]!.profile).toMatchObject({ configuration: codex, source: 'runner-configured', availability: 'not-probed',
    model: { value: codex.model, resolvedModel: null, providerCapabilities: 'unknown' }, controls: { effort: 'configured-request', serviceTier: 'configured-request' } });
  expect(page.nextCursor).toBeNull();
});
it('preserves no-header and steering legacy readers and never negotiates unknown or combined headers', async () => {
  const c = await seed(claude), steering = await seed({ ...claude, activeSteering: { protocol: 'flow.active-steering.v1' } });
  await seed(codex);
  for (const protocol of [undefined, 'native-v2', 'native-v1, native-v1', 'Native-v1', '']) {
    const response = await request('/api/execution-profiles', { protocol });
    expect(response.body).not.toHaveProperty('protocol');
    expect(response.body.profiles.map((profile: { reference: { id: string } }) => profile.reference.id)).toEqual([c.reference.id]);
  }
  const legacy = await request('/api/execution-profiles', { protocol: 'steering-v1' });
  expect(legacy.body.profiles.map((profile: { reference: { id: string } }) => profile.reference.id)).toEqual([c.reference.id, steering.reference.id]);
  const duplicate = await new Promise<unknown>((resolve, reject) => {
    const req = rawRequest(`${baseUrl}/api/execution-profiles`, { headers: ['Host', new URL(baseUrl).host, 'Authorization', `Bearer ${ownerToken}`,
      'X-Flow-Execution-Profile', 'native-v1', 'X-Flow-Execution-Profile', 'native-v1'], timeout: 5000 }, response => {
      expect(response.statusCode).toBe(200);
      let text = ''; response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(text)); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Owned request timeout.'))); req.end();
  });
  expect(duplicate).not.toHaveProperty('protocol');
  expect(nativeExecutionProfileCatalogPageSchema.safeParse(duplicate).success).toBe(false);
});
it('keeps catalog owner-only despite a native header', async () => {
  const item = await seed(codex);
  expect((await request('/api/execution-profiles', { protocol: 'native-v1', token: item.token })).status).toBe(403);
  expect((await request('/api/execution-profiles', { protocol: 'native-v1', token: 'invalid' })).status).toBe(401);
});
it('filters known adapter pairs and revoked rows before limit while preserving complete pagination', async () => {
  await seed(codex, { raw: { ...codex, adapterVersion: 'future-adapter' } });
  const c = await seed(claude);
  await seed(claude, { raw: { ...claude, harness: 'future-harness' } });
  const x = await seed(codex);
  await seed(codex, { revoked: true });
  const s = await seed({ ...claude, activeSteering: { protocol: 'flow.active-steering.v1' } });
  const seen: string[] = [];
  let after: string | null = null;
  for (let pages = 0; pages < 4; pages++) {
    const response = await catalog(`?limit=1${after ? `&after=${after}` : ''}`);
    expect(response.status).toBe(200);
    const page = nativeExecutionProfileCatalogPageSchema.parse(response.body);
    seen.push(...page.profiles.map(item => item.profile.reference.id)); after = page.nextCursor;
    if (after === null) break;
  }
  expect(after).toBeNull(); expect(seen).toEqual([c.reference.id, x.reference.id, s.reference.id]);
});
it('rejects corrupted recognized sentinel rows without leaking or skipping their fields', async () => {
  await seed(claude);
  await seed(codex, { raw: { ...codex, privateMarker: 'must-not-appear-in-response' } });
  const response = await catalog('?limit=1');
  expect(response.status).toBe(409);
  expect(response.body).toEqual({ error: { code: 'execution_profile_unavailable', message: 'The stored execution profile is not recognized.' } });
});
it('rejects a valid-shaped row whose immutable digest does not match', async () => {
  await seed(codex, { digest: '0'.repeat(64) });
  expect((await catalog()).body.error.code).toBe('execution_profile_unavailable');
});
it('bounds cursor and limits before reading and preserves explicit empty native pages', async () => {
  for (const query of ['?after=invalid', '?limit=0', '?limit=101', '?limit=1.5']) expect((await catalog(query)).status).toBe(400);
  expect((await catalog()).body).toEqual({ protocol: NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, profiles: [], nextCursor: null });
});
it('marks both goal purposes unsupported for ordinary conversation without changing their profile', async () => {
  for (const access of ['goal-tools', 'goal-graph-tools'] as const) {
    await seed({ ...claude, access, materialScopeDigest: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' });
  }
  const page = nativeExecutionProfileCatalogPageSchema.parse((await catalog()).body);
  expect(page.profiles).toHaveLength(2);
  for (const entry of page.profiles) expect(entry.conversation).toEqual({ state: 'unsupported', reason: 'profile-purpose-not-supported' });
});
it('keeps Codex conversation rejection and revoked or altered pin admission checks after catalog reads', async () => {
  const item = await seed(codex); await catalog();
  expect((await request('/api/conversations', { body: { title: 'unsupported', harness: 'codex', executionProfile: item.reference } })).status).toBe(400);
  expect((await request('/api/conversations', { body: { title: 'wrong harness', harness: 'claude', executionProfile: item.reference } })).body.error.code).toBe('profile_harness_mismatch');
  expect((await request('/api/conversations', { body: { title: 'altered pin', harness: 'claude', executionProfile: { ...item.reference, configDigest: '0'.repeat(64) } } })).body.error.code).toBe('execution_profile_unavailable');
  await request(`/api/runners/${item.reference.runnerId}/revoke`, { body: {} });
  expect((await catalog()).body.profiles).toEqual([]);
  expect((await request('/api/conversations', { body: { title: 'revoked pin', harness: 'claude', executionProfile: item.reference } })).body.error.code).toBe('execution_profile_unavailable');
});
