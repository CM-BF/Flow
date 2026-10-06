import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { realpath, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { migratePackageFetches, registerPackageFetchRoutes, startPackageFetchWorker } from './index.js';

const db = `flow_x05_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${db}`;
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const token = 'x05-owner';
let app: FastifyInstance; let base: string; let root: string;
const body = Buffer.from('synthetic tarball');
const integrity = 'sha512-' + createHash('sha512').update(body).digest('base64');
let installationId: string; let versionId: string;
const host = () => ({ storeId: 'center-x05-test', root, registries: { local: { url: 'https://registry.invalid/' } } });
async function request(path: string, data?: unknown, key = randomUUID(), bearer = token) {
  const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: {
    authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'idempotency-key': key,
  }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'flow-x05-')));
  await admin.query(`CREATE DATABASE ${db}`);
  app = await createServer({ databaseUrl, ownerToken: token });
  await migratePackageFetches(pool); registerPackageFetchRoutes(app, pool, host());
  base = await app.listen({ host: '127.0.0.1', port: 0 });
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: 'flow-x05-fixture', packageVersion: '1.0.0', source: 'npm',
    declaredSha256: createHash('sha256').update(body).digest('hex'), license: 'MIT', hostApiMajor: 1,
    capabilities: ['tool'], publicConfiguration: [],
  } });
  expect(registered.status).toBe(201);
  installationId = registered.body.snapshot.installation.id; versionId = registered.body.snapshot.version.id;
});
afterAll(async () => {
  await app?.close(); await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${db}`); await admin.end();
  if (root) await rm(root, { recursive: true, force: true });
});

test('durably accepts one exact registered version, replays stable IDs and rejects key conflicts', async () => {
  const key = randomUUID(); const input = { expectedRevision: 1, registryRef: 'local', integrity };
  const path = `/api/plugins/${installationId}/versions/${versionId}/fetch`;
  const accepted = await request(path, input, key);
  expect(accepted.status).toBe(202);
  const replay = await request(path, input, key);
  expect(replay.body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(path, { ...input, expectedRevision: 2 }, key)).status).toBe(409);
  const loaded = await request(`/api/package-fetches/${accepted.body.operationId}`);
  expect(loaded.body).toMatchObject({ installationId, versionId, status: 'queued', storeId: 'center-x05-test', attempts: [{ ordinal: 1, status: 'queued' }] });
  expect(loaded.body.artifact).toBeNull();
  expect((await request(`/api/plugins/${installationId}`)).body.installation.runtimeStatus).toBe('unavailable');
});

test('owner auth, registry references, CAS and version ownership reject before a download', async () => {
  const path = `/api/plugins/${installationId}/versions/${versionId}/fetch`;
  const input = { expectedRevision: 1, registryRef: 'local', integrity };
  expect((await request(path, input, randomUUID(), 'invalid')).status).toBe(401);
  const runner = await request('/api/runners', { name: 'package-test', harnesses: ['fixture'], capacity: 1 });
  expect((await request(path, input, randomUUID(), runner.body.token)).status).toBe(403);
  expect((await request(path, { ...input, registryRef: 'constructor' })).status).toBe(409);
  expect((await request(path, { ...input, registryRef: 'unknown' })).status).toBe(409);
  expect((await request(path, { ...input, expectedRevision: 999 })).status).toBe(409);
  expect((await request(path, { ...input, url: 'https://secret.invalid' })).status).toBe(400);
  expect((await request(`/api/plugins/${installationId}/versions/${randomUUID()}/fetch`, input)).status).toBe(404);
});

test('concurrent identical commands yield one immutable audit and bounded summary/history pages', async () => {
  const path = `/api/plugins/${installationId}/versions/${versionId}/fetch`;
  const input = { expectedRevision: 1, registryRef: 'local', integrity }; const key = randomUUID();
  const accepted = await Promise.all([1, 2].map(() => request(path, input, key)));
  expect(accepted.map(r => r.status)).toEqual([202, 202]);
  expect(accepted[0]!.body.operationId).toBe(accepted[1]!.body.operationId);
  const history = await request(`/api/package-fetches/${accepted[0]!.body.operationId}/history?limit=1`);
  expect(history.body.events).toHaveLength(1);
  expect(history.body.events[0]).toMatchObject({ kind: 'admitted', actor: { kind: 'owner' } });
  const list = await request(`/api/plugins/${installationId}/package-fetches?limit=1`);
  expect(list.body.operations).toHaveLength(1);
  expect(list.body.operations[0]).not.toHaveProperty('attempts');
  expect(list.body.operations[0]).not.toHaveProperty('artifact');
  expect(list.body.nextCursor).toBeTypeOf('string');
  expect((await request(`/api/plugins/${installationId}/package-fetches?after=bad`)).status).toBe(400);
  await expect(pool.query('DELETE FROM flow.plugin_package_fetch_audit WHERE operation_id=$1', [accepted[0]!.body.operationId])).rejects.toMatchObject({ code: '23514' });
});


test('one worker owns a store session and releases it for a subsequent runtime', async () => {
  const isolated = { ...host(), storeId: 'empty-store', root: join(root, 'empty-store') };
  const first = await startPackageFetchWorker(pool, isolated);
  try { await expect(startPackageFetchWorker(pool, isolated)).rejects.toThrow('already owns'); }
  finally { await first.stop(); await first.stop(); }
  const next = await startPackageFetchWorker(pool, isolated);
  await next.stop();
  await expect(startPackageFetchWorker(pool, { ...isolated, storeId: 'different-identity' })).rejects.toThrow('identity does not match');
});
