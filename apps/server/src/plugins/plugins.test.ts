import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migratePlugins, registerPluginRoutes } from './index.js';

const databaseName = `flow_x02_${process.pid}_${randomUUID().slice(0, 8)}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${databaseName}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'x02-test-owner';
let created = false;
let pool: Pool | undefined;
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
  server = await createServer({ databaseUrl, ownerToken });
  await migratePlugins(pool!);
  registerPluginRoutes(server, pool!);
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${databaseName}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 3, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await server?.close(); }
  finally {
    try { await pool?.end(); if (created) await admin.query(`DROP DATABASE ${databaseName}`); }
    finally { await admin.end(); }
  }
});

it('registers a fixed declaration without granting capabilities or claiming the package was installed', async () => {
  const accepted = await request('/api/plugins', registration);
  expect(accepted.status).toBe(201);
  expect(accepted.body.snapshot.installation).toMatchObject({ scope: registration.scope, registrationStatus: 'registered', runtimeStatus: 'unavailable', revision: 1 });
  expect(accepted.body.snapshot).toMatchObject({ version, grants: [], configuration: {}, configurationStatus: 'incomplete' });
  expect(accepted.body.operation).toMatchObject({ kind: 'register', status: 'succeeded', beforeRevision: null, afterRevision: 1, actor: 'owner' });
  const loaded = await request(`/api/plugins/${accepted.body.snapshot.installation.id}`);
  expect(loaded.body).toEqual(accepted.body.snapshot);
});
