import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migratePlugins, registerPluginRoutes } from './index.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01/enable-binding-pg-fixture.js';

const databaseFixture = new PluginDatabaseFixture('registry', 3);
const { databaseUrl, pool } = databaseFixture;
const ownerToken = 'x02-test-owner';
let startupConfirmed = true;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl = '';
const version = {
  packageName: '@flow-test/registry-fixture', packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64),
  license: 'MIT', hostApiMajor: 1, capabilities: ['tool', 'renderer'],
  publicConfiguration: [{ key: 'enabledFeature', kind: 'boolean', required: true }],
};
const registration = { scope: { workspaceId: 'personal', projectId: null }, version };
async function request(path: string, body?: unknown, options: { token?: string; key?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw), bytes: Buffer.byteLength(raw), raw };
}
async function startServer() {
  startupConfirmed = false;
  server = await createServer({ databaseUrl, ownerToken });
  if (!server.hasRoute({ method: 'POST', url: '/api/plugins' })) {
    await migratePlugins(pool!);
    registerPluginRoutes(server, pool!);
  }
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
  startupConfirmed = true;
}
beforeAll(async () => {
  await databaseFixture.create();
  await startServer();
}, 30_000);
afterAll(async () => {
  const closed = await Promise.allSettled([server?.close()]);
  const result = await databaseFixture.finish({ startup: startupConfirmed, server: closed[0]!.status === 'fulfilled' });
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errors: [],
    cleanup: { ownersClosed: true, poolClosed: true, adminClosed: true, identityConfirmed: true,
      connections: 0, dropAcknowledged: true, databaseAbsent: true } });
}, 60_000);

it('registers a fixed declaration without granting capabilities or claiming the package was installed', async () => {
  const accepted = await request('/api/plugins', registration);
  expect(accepted.status).toBe(201);
  expect(accepted.body.snapshot.installation).toMatchObject({ scope: registration.scope, registrationStatus: 'registered', runtimeStatus: 'unavailable', revision: 1 });
  expect(accepted.body.snapshot).toMatchObject({ version, grants: [], configuration: {}, configurationStatus: 'incomplete' });
  expect(accepted.body.operation).toMatchObject({ kind: 'register', status: 'succeeded', beforeRevision: null, afterRevision: 1, actor: 'owner' });
  const loaded = await request(`/api/plugins/${accepted.body.snapshot.installation.id}`);
  expect(loaded.body).toEqual(accepted.body.snapshot);
});

async function registered() {
  const accepted = await request('/api/plugins', { ...registration, version: { ...version, packageName: `@flow-test/p-${randomUUID()}` } });
  expect(accepted.status).toBe(201);
  return accepted.body.snapshot;
}
it('versions configuration and explicit grants with CAS and original-result idempotency', async () => {
  const initial = await registered(); const id = initial.installation.id;
  const input = { expectedRevision: 1, reason: 'Configure the registered plugin', change: { kind: 'configure', values: { enabledFeature: true } } };
  const key = randomUUID();
  const configured = await request(`/api/plugins/${id}/commands`, input, { key });
  expect(configured.status).toBe(200);
  expect(configured.body.snapshot).toMatchObject({ revision: 2, configuration: { enabledFeature: true }, configurationStatus: 'ready', grants: [] });
  const attempts = await Promise.all([['tool'], ['renderer']].map(capabilities => request(`/api/plugins/${id}/commands`, {
    expectedRevision: 2, reason: 'Grant only one concurrent request', change: { kind: 'set-grants', capabilities },
  })));
  expect(attempts.map(result => result.status).sort()).toEqual([200, 409]);
  const current = await request(`/api/plugins/${id}`);
  expect(current.body.revision).toBe(3); expect(current.body.grants).toHaveLength(1);
  const replay = await request(`/api/plugins/${id}/commands`, input, { key });
  expect(replay.body).toEqual({ ...configured.body, replayed: true });
  const changedKeyPayload = await request(`/api/plugins/${id}/commands`, { ...input, reason: 'Different input' }, { key });
  expect(changedKeyPayload.status).toBe(409);
  const old = await request(`/api/plugins/${id}?revision=1`);
  expect(old.body).toMatchObject({ revision: 1, configuration: {}, grants: [], installation: { revision: 3 } });
});

it('retains immutable declarations and history while selecting a version clears configuration and grants', async () => {
  const initial = await registered(); const id = initial.installation.id;
  for (const [expectedRevision, change] of [
    [1, { kind: 'configure', values: { enabledFeature: true } }],
    [2, { kind: 'set-grants', capabilities: ['tool'] }],
  ] as const) expect((await request(`/api/plugins/${id}/commands`, { expectedRevision, reason: 'Prepare version one', change })).status).toBe(200);
  const declaration = { ...version, packageName: initial.version.packageName, packageVersion: '2.0.0', declaredSha256: 'b'.repeat(64) };
  const added = await request(`/api/plugins/${id}/commands`, { expectedRevision: 3, reason: 'Register version two', change: { kind: 'register-version', version: declaration } });
  expect(added.status).toBe(200);
  expect(added.body.snapshot.version.packageVersion).toBe('1.0.0');
  const versions = await request(`/api/plugins/${id}/versions`);
  expect(versions.body.versions).toHaveLength(2);
  const next = versions.body.versions.find((item: { packageVersion: string }) => item.packageVersion === '2.0.0');
  const selected = await request(`/api/plugins/${id}/commands`, { expectedRevision: 4, reason: 'Explicitly select version two', change: { kind: 'select-version', versionId: next.id } });
  expect(selected.body.snapshot).toMatchObject({ revision: 5, configuration: {}, grants: [], configurationStatus: 'incomplete', version: { packageVersion: '2.0.0' } });
  const conflict = await request(`/api/plugins/${id}/commands`, { expectedRevision: 5, reason: 'Cannot rewrite a version', change: { kind: 'register-version', version: { ...declaration, declaredSha256: 'c'.repeat(64) } } });
  expect(conflict.status).toBe(409); expect(conflict.body.error.code).toBe('plugin_version_conflict');
  expect((await request(`/api/plugins/${id}?revision=3`)).body).toMatchObject({ configuration: { enabledFeature: true }, grants: ['tool'], version: { packageVersion: '1.0.0' } });
  const foreign = await registered();
  expect((await request(`/api/plugins/${id}/commands`, { expectedRevision: 5, reason: 'Cannot select another installation version', change: { kind: 'select-version', versionId: foreign.version.id } })).status).toBe(404);
  expect((await request(`/api/plugins/${id}`)).body.revision).toBe(5);
  expect((await request(`/api/plugins/${id}/operations`)).body.operations.map((item: { kind: string }) => item.kind).sort())
    .toEqual(['configure', 'register', 'register-version', 'select-version', 'set-grants']);
});

it('keeps the same registration receipt and immutable operation after the center restarts', async () => {
  const input = { ...registration, version: { ...version, packageName: `@flow-test/restart-${randomUUID()}` } };
  const key = randomUUID(); const accepted = await request('/api/plugins', input, { key });
  expect(accepted.status).toBe(201);
  const id = accepted.body.snapshot.installation.id;
  await server!.close(); await startServer();
  expect((await request(`/api/plugins/${id}`)).body).toEqual(accepted.body.snapshot);
  const replay = await request('/api/plugins', input, { key });
  expect(replay.body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(`/api/plugins/${id}/operations/${accepted.body.operation.id}`)).body).toEqual(accepted.body.operation);
  expect((await request(`/api/plugins/${id}/operations`)).body.operations).toEqual([accepted.body.operation]);
  expect((await request('/api/plugins', input)).status).toBe(409);
  const changed = { ...input, version: { ...input.version, license: 'Apache-2.0' } };
  expect((await request('/api/plugins', changed, { key })).status).toBe(409);
});

it('rejects undeclared configuration, credentials and grants without exposing input or advancing revision', async () => {
  const initial = await registered(); const id = initial.installation.id;
  const marker = 'synthetic-secret-marker-should-not-appear';
  for (const change of [
    { kind: 'configure', values: { accessToken: marker } },
    { kind: 'configure', values: { enabledFeature: marker } },
    { kind: 'configure', values: {} },
    { kind: 'configure', values: { enabledFeature: true, extra: true } },
    { kind: 'set-grants', capabilities: ['context'] },
    { kind: 'set-grants', capabilities: ['tool', 'tool'] },
  ]) {
    const denied = await request(`/api/plugins/${id}/commands`, { expectedRevision: 1, reason: 'Reject invalid public data', change });
    expect([400, 409]).toContain(denied.status); expect(denied.raw).not.toContain(marker);
  }
  const credentialInput = await request('/api/plugins', { ...registration, secretReferences: { apiKey: marker } });
  expect(credentialInput.status).toBe(400); expect(credentialInput.raw).not.toContain(marker);
  expect((await request(`/api/plugins/${id}`)).body.revision).toBe(1);
  expect((await request(`/api/plugins/${id}/operations`)).body.operations).toHaveLength(1);
});

it.each(['latest', '^1.0.0', '1.0', '01.2.3', '1.0.0-01', 'file:../package'])('rejects non-exact npm semver %s', async packageVersion => {
  const result = await request('/api/plugins', { ...registration, version: { ...version, packageName: `@flow-test/invalid-${randomUUID()}`, packageVersion } });
  expect(result.status).toBe(400);
});

it('validates integer and enum public values and does not inherit configuration from object prototypes', async () => {
  const input = { ...registration, version: { ...version, packageName: `@flow-test/config-${randomUUID()}`, packageVersion: '1.2.3-rc.1+local.01', publicConfiguration: [
    { key: 'toString', kind: 'boolean', required: true },
    { key: 'retries', kind: 'integer', min: 1, max: 3, required: true },
    { key: 'mode', kind: 'enum', values: ['fast', 'safe'], required: false },
  ] } };
  const accepted = await request('/api/plugins', input);
  expect(accepted.status).toBe(201); expect(accepted.body.snapshot.configurationStatus).toBe('incomplete');
  const id = accepted.body.snapshot.installation.id;
  for (const values of [{ retries: 2 }, { toString: false, retries: 0 }, { toString: false, retries: 4 }, { toString: false, retries: 2, mode: 'arbitrary-value' }]) {
    expect((await request(`/api/plugins/${id}/commands`, { expectedRevision: 1, reason: 'Invalid public values', change: { kind: 'configure', values } })).status).toBe(409);
  }
  expect((await request(`/api/plugins/${id}/commands`, { expectedRevision: 1, reason: 'Valid public configuration', change: { kind: 'configure', values: { toString: false, retries: 2, mode: 'safe' } } })).body.snapshot.configurationStatus).toBe('ready');
});

it('lets only one simultaneous registration reserve the same package and scope', async () => {
  const input = { ...registration, version: { ...version, packageName: `@flow-test/race-${randomUUID()}` } };
  const responses = await Promise.all([request('/api/plugins', input), request('/api/plugins', input)]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  const winner = responses.find(response => response.status === 201)!;
  expect((await request(`/api/plugins/${winner.body.snapshot.installation.id}/operations`)).body.operations).toHaveLength(1);
});

it('preserves owner authorization and scope in list cursors, project registrations and operation lookups', async () => {
  const runner = await request('/api/runners', { name: 'X02 denied runner', harnesses: ['fixture'], capacity: 1 });
  expect((await request('/api/plugins', undefined, { token: runner.body.token })).status).toBe(403);
  expect((await request('/api/plugins', registration, { token: runner.body.token })).status).toBe(403);
  expect((await request('/api/plugins', undefined, { token: 'not-an-owner' })).status).toBe(401);
  expect((await request('/api/plugins?workspaceId=other')).status).toBe(400);
  expect((await request('/api/plugins', { ...registration, scope: { workspaceId: 'personal', projectId: randomUUID() } })).status).toBe(404);
  const project = await request('/api/projects', { workspaceId: 'personal', title: 'Plugin scope' });
  const projectId = project.body.snapshot.project.id;
  const input = { ...registration, scope: { workspaceId: 'personal', projectId }, version: { ...version, packageName: `@flow-test/scope-${randomUUID()}` } };
  const projectPlugin = await request('/api/plugins', input);
  expect(projectPlugin.status).toBe(201);
  const workspacePlugin = await request('/api/plugins', { ...input, scope: registration.scope });
  expect(workspacePlugin.status).toBe(201);
  const list = await request(`/api/plugins?projectId=${projectId}`);
  expect(list.body.installations.map((entry: { id: string }) => entry.id)).toEqual([projectPlugin.body.snapshot.installation.id]);
  expect(list.raw).not.toContain('configuration');
  expect((await request(`/api/plugins?projectId=${projectId}&after=${workspacePlugin.body.snapshot.installation.id}`)).status).toBe(400);
  expect((await request(`/api/plugins/${projectPlugin.body.snapshot.installation.id}/operations/${workspacePlugin.body.operation.id}`)).status).toBe(404);
});

it('rejects schema ambiguity and bounds request bytes before accepting registry data', async () => {
  const duplicates = { ...version, publicConfiguration: [{ key: 'flag', kind: 'boolean', required: false }, { key: 'flag', kind: 'boolean', required: false }] };
  expect((await request('/api/plugins', { ...registration, version: duplicates })).status).toBe(400);
  expect((await request('/api/plugins', { ...registration, version: { ...version, hostApiMajor: 2 } })).status).toBe(400);
  expect((await request('/api/plugins', { ...registration, oversized: '界'.repeat(12_000) })).status).toBe(413);
  expect((await request('/api/plugins', registration, { key: '' })).status).toBe(400);
  for (const query of ['limit=0', 'limit=41', 'limit=1.5', 'after=']) expect((await request(`/api/plugins?${query}`)).status).toBe(400);
});

it('returns complete paginated version history within both item and UTF8 byte limits', async () => {
  const largeVersion = { ...version, packageName: `@flow-test/large-${randomUUID()}`, license: '許'.repeat(80),
    publicConfiguration: Array.from({ length: 16 }, (_, index) => ({ key: `field${index}`, kind: 'enum', required: false, values: Array.from({ length: 16 }, (_, choice) => `v${choice}${'x'.repeat(60)}`) })),
  };
  const accepted = await request('/api/plugins', { ...registration, version: largeVersion });
  expect(accepted.status).toBe(201); expect(accepted.bytes).toBeLessThanOrEqual(65_536);
  const id = accepted.body.snapshot.installation.id;
  for (let index = 2; index <= 6; index++) {
    const result = await request(`/api/plugins/${id}/commands`, { expectedRevision: index - 1, reason: 'Add a fixed historical declaration', change: { kind: 'register-version', version: { ...largeVersion, packageVersion: `${index}.0.0` } } });
    expect(result.status).toBe(200);
  }
  const all: string[] = []; let cursor: string | null = null; let pages = 0;
  do {
    const response = await request(`/api/plugins/${id}/versions?limit=40${cursor ? `&after=${cursor}` : ''}`);
    expect(response.status).toBe(200); expect(response.bytes).toBeLessThanOrEqual(65_536);
    expect(response.body.versions.length).toBeGreaterThan(0); expect(response.body.versions.length).toBeLessThanOrEqual(40);
    all.push(...response.body.versions.map((item: { packageVersion: string }) => item.packageVersion));
    cursor = response.body.nextCursor; pages++; expect(pages).toBeLessThan(10);
  } while (cursor);
  expect(pages).toBeGreaterThan(1); expect(all.sort()).toEqual(['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0']);
  const operations: number[] = []; cursor = null;
  do {
    const response = await request(`/api/plugins/${id}/operations?limit=2${cursor ? `&after=${cursor}` : ''}`);
    expect(response.status).toBe(200); expect(response.body.operations.length).toBeLessThanOrEqual(2);
    operations.push(...response.body.operations.map((operation: { afterRevision: number }) => operation.afterRevision));
    cursor = response.body.nextCursor;
  } while (cursor);
  expect(operations).toEqual([1, 2, 3, 4, 5, 6]);
});

it('protects accepted version, revision and operation history from SQL mutation', async () => {
  await registered();
  for (const table of ['plugin_versions', 'plugin_revisions', 'plugin_operations']) {
    const column = table === 'plugin_revisions' ? 'revision' : 'id';
    for (const sql of [`UPDATE flow.${table} SET ${column}=${column}`, `DELETE FROM flow.${table}`, `TRUNCATE flow.${table} CASCADE`]) {
      await expect(pool!.query(sql)).rejects.toMatchObject({ code: '23514' });
    }
  }
});
