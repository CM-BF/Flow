import { randomUUID, createHash } from 'node:crypto';
import { createServer as httpServer } from 'node:http';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { createServer } from '../../../apps/server/src/index.js';
import { readPackageFetchConfiguration } from '../../../apps/server/src/package-fetch-configuration.js';
import { runCli } from '../../../apps/cli/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_fetch_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const options = { databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`, ownerToken: 'synthetic-fetch-owner' };
const pool = new Pool({ connectionString: options.databaseUrl, max: 2 });
let created = false; let root: string; let registryUrl: string; let base: string;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let client: FlowClient;
const facts: Record<string, unknown> = { database, modelQueries: 0, startedAt: new Date().toISOString() };
const packages = new Map<string, { bytes: Buffer; requests: number; hold?: boolean }>();
const registry = httpServer((request, response) => {
  const path = decodeURIComponent(request.url!.slice(1));
  const tarball = path.endsWith('.tgz'); const name = tarball ? path.slice(0, -4) : path;
  const pkg = packages.get(name);
  if (!pkg) { response.writeHead(404); response.end(); return; }
  if (tarball) { pkg.requests++; if (!pkg.hold) response.end(pkg.bytes); return; }
  response.end(JSON.stringify({ name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { name, version: '1.0.0', dist: {
    tarball: `${registryUrl}${name}.tgz`, integrity: `sha512-${createHash('sha512').update(pkg.bytes).digest('base64')}`,
  } } } }));
});
const host = () => ({ storeId: 'f01-production-store', root: join(root, 'artifacts'), registries: { local: { url: registryUrl, allowInsecureLoopback: true } } });
async function start(configured: boolean) {
  const file = join(root, 'fetch-config.json'); await writeFile(file, JSON.stringify(host()), { mode: 0o600 });
  app = await createServer({ ...options, ...(configured ? { packageFetchHost: await readPackageFetchConfiguration(file) } : {}) });
  base = await app.listen({ host: '127.0.0.1', port: 0 }); client = new FlowClient({ baseUrl: base, token: options.ownerToken });
}
async function cli(args: string[]) {
  let output = ''; let error = '';
  const exit = await runCli(['plugin', ...args, '--json'], { out: text => { output += text; }, err: text => { error += text; } }, { FLOW_TOKEN: options.ownerToken, FLOW_URL: base });
  expect(error).toBe(''); expect(exit).toBe(0); return JSON.parse(output);
}
async function fixture(hold = false) {
  const name = `flow-f01-${randomUUID()}`; const bytes = gzipSync(Buffer.from(`synthetic verified bytes ${name}`));
  const pkg = { bytes, requests: 0, hold }; packages.set(name, pkg);
  const registered = await client.registerPlugin({ scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: createHash('sha256').update(bytes).digest('hex'),
    license: 'MIT', hostApiMajor: 1, capabilities: [], publicConfiguration: [],
  } }, randomUUID());
  const input = { expectedRevision: 1, registryRef: 'local', integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
  return { pkg, input, pluginId: registered.snapshot.installation.id, versionId: registered.snapshot.version.id };
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'flow-f01-fetch-')));
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refusing an existing database.');
  await admin.query(`CREATE DATABASE ${database}`); created = true; facts.created = true;
  await new Promise<void>(resolve => registry.listen(0, '127.0.0.1', resolve));
  const address = registry.address(); if (!address || typeof address === 'string') throw new Error('Missing registry');
  registryUrl = `http://127.0.0.1:${address.port}/`; await start(false);
});
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    await new Promise<void>(resolve => { registry.closeAllConnections(); registry.close(() => resolve()); });
    facts.connectionsBeforeDrop = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
    if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
    await rm(root, { recursive: true, force: true }); facts.endedAt = new Date().toISOString();
    await writeFile('docs/evidence/f01/package-fetch-production-facts.json', JSON.stringify(facts, null, 2));
  } finally { await admin.end(); }
});
it('keeps downloads disabled by default and starts only an explicitly configured worker after migration', async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/package-fetches/:id' })).toBe(false);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=23')).rowCount).toBe(1);
  await app!.close(); app = undefined; await start(true);
  expect(app!.hasRoute({ method: 'GET', url: '/api/package-fetches/:id' })).toBe(true);
  await expect(createServer({ ...options, packageFetchHost: host() })).rejects.toThrow('already owns');
  const registered = await client.registerRunner({ name: 'no download privilege', harnesses: ['fixture'], capacity: 1 });
  await expect(new FlowClient({ baseUrl: base, token: registered.token }).packageFetch(randomUUID())).rejects.toMatchObject({ status: 403 });
});
it('runs the public CLI through the production worker and replays stable receipts after restart without downloading twice', async () => {
  const f = await fixture(); const file = join(root, 'request.json'); await writeFile(file, JSON.stringify(f.input));
  const key = randomUUID(); const args = ['fetch', f.pluginId, f.versionId, '--input', file, '--key', key];
  const accepted = await cli(args);
  await expect.poll(async () => (await client.packageFetch(accepted.operationId)).status).toBe('succeeded');
  const operation = await cli(['fetch-show', accepted.operationId]); expect(operation.artifact.sha256).toBe(createHash('sha256').update(f.pkg.bytes).digest('hex'));
  expect((await cli(['fetches', f.pluginId])).operations[0].id).toBe(accepted.operationId);
  expect((await cli(['fetch-history', accepted.operationId])).events.some((event: { kind: string }) => event.kind === 'succeeded')).toBe(true);
  await app!.close(); app = undefined; await start(true);
  expect(await cli(args)).toEqual({ ...accepted, replayed: true }); expect(f.pkg.requests).toBe(1);
  expect((await client.plugin(f.pluginId)).installation.runtimeStatus).toBe('unavailable');
  facts.success = { operationId: operation.id, artifactId: operation.artifact.artifactId, tarballRequests: f.pkg.requests, runtimeStatus: 'unavailable' };
});
it('stops in-flight downloads before closing the pool and preserves an explicit interruption through restart and local reconcile', async () => {
  const f = await fixture(true); const accepted = await client.fetchPluginPackage(f.pluginId, f.versionId, f.input, randomUUID());
  await expect.poll(async () => f.pkg.requests).toBe(1);
  await app!.close(); app = undefined;
  expect((await pool.query('SELECT status FROM flow.plugin_package_fetch_attempts WHERE id=$1', [accepted.attemptId])).rows[0].status).toBe('interrupted');
  await start(true);
  expect((await client.packageFetch(accepted.operationId)).status).toBe('interrupted'); expect(f.pkg.requests).toBe(1);
  const file = join(root, 'reconcile.json'); await writeFile(file, JSON.stringify({ action: 'reconcile', reason: 'Inspect known local artifact only.' }));
  await cli(['fetch-change', accepted.operationId, '--input', file, '--key', randomUUID()]);
  await expect.poll(async () => (await client.packageFetch(accepted.operationId)).status).toBe('interrupted');
  expect(f.pkg.requests).toBe(1);
  facts.interrupted = { operationId: accepted.operationId, tarballRequests: f.pkg.requests, reconciliationDownloaded: false };
});
