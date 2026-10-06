import { randomUUID, createHash } from 'node:crypto';
import { createServer as httpServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, realpath, lstat, rm, copyFile, readFile, writeFile, statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../../../apps/server/src/index.js';
import { readPluginInstallationConfiguration } from '../../../apps/server/src/plugin-installation-configuration.js';
import { runCli } from '../../../apps/cli/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_install_${randomUUID().replaceAll('-', '')}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 4000 });
const options = { databaseUrl: adminUrl.replace(/postgres$/, database), ownerToken: 'synthetic-install-owner' };
const pool = new Pool({ connectionString: options.databaseUrl, max: 1 });
const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerCalls: 0 };
const name = `flow-install-${randomUUID()}`;
let root: string, rootIdentity: { dev: number; ino: number }, archive: Buffer, integrity: string, digest: string;
let registryUrl: string, base: string, client: FlowClient, created = false, downloads = 0;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
const registry = httpServer((request, response) => {
  if (request.url === `/${name}.tgz`) { downloads++; response.end(archive); return; }
  if (request.url !== `/${name}`) { response.writeHead(404); response.end(); return; }
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ name, versions: { '1.0.0': { name, version: '1.0.0', dist: { integrity, tarball: registryUrl + name + '.tgz' } } } }));
});
async function start(configured: boolean) {
  app = await createServer({ ...options, ...(configured ? {
    pluginInstallHost: await readPluginInstallationConfiguration(join(root, 'policy.json')),
    packageFetchHost: { root: join(root, 'artifacts'), storeId: 'f01-artifacts', registries: { local: { url: registryUrl, allowInsecureLoopback: true } } },
  } : {}) });
  base = await app.listen({ host: '127.0.0.1', port: 0 }); client = new FlowClient({ baseUrl: base, token: options.ownerToken });
}
async function cli(args: string[]) {
  let out = '', err = '';
  const exit = await runCli(['plugin', ...args], { out: s => { out += s; }, err: s => { err += s; } }, { FLOW_URL: base, FLOW_TOKEN: options.ownerToken });
  expect({ exit, err }).toEqual({ exit: 0, err: '' }); return JSON.parse(out);
}
beforeAll(async () => {
  const space = await statfs(tmpdir()); facts.availableBytesBefore = space.bavail * space.bsize;
  expect(facts.availableBytesBefore).toBeGreaterThan(1024 ** 3 + 32 * 1024 ** 2);
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  expect(facts.before).toEqual([]);
  await admin.query(`CREATE DATABASE ${database}`); created = true; facts.created = true;
  root = await realpath(await mkdtemp(join(tmpdir(), 'flow-f01-install-')));
  const st = await lstat(root); rootIdentity = { dev: st.dev, ino: st.ino };
  await mkdir(join(root, 'materials'), { mode: 0o700 }); await mkdir(join(root, 'package'));
  await writeFile(join(root, 'package/package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module' }));
  for (const file of ['index.mjs', 'flow-plugin.json']) await copyFile(fileURLToPath(new URL(`../../../fixtures/plugins/text-tool/${file}`, import.meta.url)), join(root, 'package', file));
  const tar = join(root, 'package.tgz');
  await promisify(execFile)('/usr/bin/tar', ['--format=ustar', '-czf', tar, '-C', root, 'package'], { timeout: 5000, maxBuffer: 8192 });
  archive = await readFile(tar); expect(archive.length).toBeLessThan(8192);
  digest = createHash('sha256').update(archive).digest('hex'); integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
  await writeFile(join(root, 'policy.json'), JSON.stringify({ artifactStore: { root: join(root, 'artifacts'), storeId: 'f01-artifacts' },
    materialStore: { root: join(root, 'materials'), storeId: 'f01-materials', allowedDigests: [digest] } }), { mode: 0o600 });
  await new Promise<void>(resolve => registry.listen(0, '127.0.0.1', resolve));
  const address = registry.address(); if (!address || typeof address === 'string') throw new Error('Missing loopback');
  registryUrl = `http://127.0.0.1:${address.port}/`; await start(false);
});
afterAll(async () => {
  try {
    const closed = await Promise.allSettled([app?.close(), pool.end(), new Promise<void>(resolve => {
      if (!registry.listening) return resolve(); registry.closeAllConnections(); registry.close(() => resolve());
    })]);
    facts.ownersClosed = closed.every(x => x.status === 'fulfilled');
    if (created) {
      facts.databaseBytes = Number((await admin.query('SELECT pg_database_size($1)::text AS bytes', [database])).rows[0].bytes);
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
      if (facts.ownersClosed && (facts.connections as unknown[]).length === 0) await admin.query(`DROP DATABASE ${database}`);
    }
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
    if (root && facts.ownersClosed && (facts.remaining as unknown[]).length === 0) {
      const st = await lstat(root);
      if (st.isDirectory() && !st.isSymbolicLink() && st.dev === rootIdentity.dev && st.ino === rootIdentity.ino) {
        await rm(root, { recursive: true }); facts.rootRemoved = true;
      }
    }
  } finally {
    await admin.end(); facts.endedAt = new Date().toISOString();
    await writeFile('docs/evidence/f01/plugin-installation-production-facts.json', JSON.stringify(facts, null, 2) + '\n');
  }
  if (created) expect(facts).toMatchObject({ ownersClosed: true, connections: [], remaining: [], rootRemoved: true });
});
it('mounts only trusted owner installation after 029 and preserves real fetch/material receipts through restart', { timeout: 25_000 }, async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/plugin-installs/:id' })).toBe(false);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=29')).rowCount).toBe(1);
  await app!.close(); app = undefined; await start(true);
  const registered = await client.registerPlugin({ scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: digest, license: 'MIT', hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [],
  } }, randomUUID());
  const { installation, version } = registered.snapshot;
  const fetched = await client.fetchPluginPackage(installation.id, version.id, { expectedRevision: 1, registryRef: 'local', integrity }, randomUUID());
  await expect.poll(async () => (await client.packageFetch(fetched.operationId)).status, { timeout: 5000 }).toBe('succeeded');
  const file = join(root, 'input.json'), key = randomUUID();
  await writeFile(file, JSON.stringify({ expectedRevision: 1, fetchOperationId: fetched.operationId, fetchAttemptId: fetched.attemptId, reason: 'Prepare fixed static material.' }));
  const args = ['install', installation.id, version.id, '--input', file, '--key', key];
  const accepted = await cli(args); expect(accepted).toMatchObject({ replayed: false });
  const current = await cli(['install-show', accepted.operationId]); expect(current).toMatchObject({ status: 'installed', registrationId: installation.id, versionId: version.id });
  expect(JSON.stringify(current)).not.toContain(root); expect(current).not.toHaveProperty('receipt');
  const runner = await client.registerRunner({ name: 'No plugin authority', harnesses: ['fixture'], capacity: 1 });
  await expect(new FlowClient({ baseUrl: base, token: runner.token }).pluginMaterialInstall(accepted.operationId)).rejects.toMatchObject({ status: 403 });
  await expect(new FlowClient({ baseUrl: base, token: 'invalid' }).pluginMaterialInstall(accepted.operationId)).rejects.toMatchObject({ status: 401 });
  await app!.close(); app = undefined; await start(true);
  expect(await cli(args)).toEqual({ ...accepted, replayed: true });
  expect(await cli(['install-show', accepted.operationId])).toEqual(current);
  expect((await cli(['installs', installation.id])).operations).toEqual([current]);
  expect((await cli(['install-history', accepted.operationId])).events.map((x: { kind: string }) => x.kind)).toEqual(['admitted', 'preparing', 'installed']);
  await expect(client.commandPluginMaterialInstall(accepted.operationId, { action: 'start', reason: 'No duplicate work.' }, randomUUID())).rejects.toMatchObject({ status: 409 });
  expect(downloads).toBe(1); expect((await client.plugin(installation.id)).installation.runtimeStatus).toBe('unavailable');
  facts.success = { operationId: accepted.operationId, status: current.status, downloads, replayed: true, migration: 29, runtimeStatus: 'unavailable' };
});
