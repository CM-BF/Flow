import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const packFixture = promisify(execFile);
import { Pool, Client } from 'pg';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { migratePluginInstallations } from './migration.js';
import { registerPluginInstallationRoutes } from './routes.js';
import { admitInstall, runInstall, type PluginInstallHost } from './commands.js';

const database = `flow_x01_install_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 3500 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 1500, statement_timeout: 4000, application_name: 'flow-x01-install-fixture' });
const token = 'x01-install-owner';
let app: FastifyInstance | undefined; let base = ''; let root = ''; let createdRoot = ''; let rootIdentity: { dev: number; ino: number } | undefined; let registryUrl = ''; let creationRequested = false;
let host: PluginInstallHost; const allowed: string[] = []; const stopped = new Set<string>(); const facts: Record<string, unknown>[] = [];
const packages = new Map<string, { body: Buffer; integrity: string; requests: number }>();
const registry = createHttpServer((req, res) => {
  const path = decodeURIComponent(req.url!.slice(1)); const tarball = path.endsWith('.tgz'); const name = tarball ? path.slice(0, -4) : path;
  const pkg = packages.get(name); if (!pkg) { res.writeHead(404); res.end(); return; }
  if (tarball) { pkg.requests++; res.end(pkg.body); }
  else { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ name, versions: { '1.0.0': { name, version: '1.0.0', dist: { integrity: pkg.integrity, tarball: registryUrl + name + '.tgz' } } } })); }
});
async function request(path: string, body?: unknown, key = randomUUID(), bearer = token) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function until<T>(read: () => Promise<T | false>): Promise<T> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) { const result = await read(); if (result !== false) return result; await sleep(15); }
  throw new Error('Owned fixture condition timed out');
}
async function openApp() {
  app = await createServer({ databaseUrl, ownerToken: token, automaticQueueScan: false, packageFetchHost: { root: host.artifactStore.root, storeId: host.artifactStore.storeId, registries: { own: { url: registryUrl, allowInsecureLoopback: true } } } });
  await migratePluginInstallations(pool); registerPluginInstallationRoutes(app, pool, host);
  base = await app.listen({ host: '127.0.0.1', port: 0 });
}
async function source(trust = true) {
  const name = `flow-x01-${randomUUID()}`; const directory = join(root, name, 'package'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module' }));
  for (const file of ['index.mjs', 'flow-plugin.json']) await fs.copyFile(fileURLToPath(new URL(`../../../../fixtures/plugins/text-tool/${file}`, import.meta.url)), join(directory, file));
  const archive = join(root, name + '.tgz');
  const packing = packFixture('/usr/bin/tar', ['--format=ustar', '-czf', archive, '-C', join(root, name), 'package'], { timeout: 5000, maxBuffer: 8192 });
  try { await packing; } finally { facts.push({ kind: 'own-fixture-pack', pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode, archive }); }
  const body = await fs.readFile(archive); expect(body.byteLength).toBeLessThan(8192);
  const digest = createHash('sha256').update(body).digest('hex'); const integrity = 'sha512-' + createHash('sha512').update(body).digest('base64');
  const pkg = { body, integrity, requests: 0 }; packages.set(name, pkg); if (trust) allowed.push(digest);
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: { packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: digest, license: 'MIT', hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [] } });
  expect(registered.status).toBe(201);
  const registrationId = registered.body.snapshot.installation.id as string; const versionId = registered.body.snapshot.version.id as string;
  const accepted = await request(`/api/plugins/${registrationId}/versions/${versionId}/fetch`, { expectedRevision: 1, registryRef: 'own', integrity }); expect(accepted.status).toBe(202);
  const fetched = await until(async () => { const r = await request(`/api/package-fetches/${accepted.body.operationId}`); return r.body.status === 'succeeded' ? r.body : false; });
  return { registrationId, versionId, pkg, artifact: fetched.artifact, input: { expectedRevision: 1, fetchOperationId: accepted.body.operationId as string, fetchAttemptId: accepted.body.attemptId as string, reason: 'Install the self-owned fixture' }, path: `/api/plugins/${registrationId}/versions/${versionId}/install` };
}
async function accepted(s: Awaited<ReturnType<typeof source>>) { return admitInstall(pool, host, s.registrationId, s.versionId, s.input, randomUUID()); }
async function state(id: string) { const r = await request(`/api/plugin-installs/${id}`); expect(r.status).toBe(200); return r.body; }
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

beforeAll(async () => {
  const space = await fs.statfs(tmpdir()); expect(space.bavail * space.bsize).toBeGreaterThan(1024 ** 3);
  createdRoot = await fs.mkdtemp(join(tmpdir(), 'flow-x01-install-')); root = createdRoot;
  const identity = await fs.lstat(createdRoot); rootIdentity = { dev: identity.dev, ino: identity.ino };
  root = await fs.realpath(createdRoot);
  await fs.mkdir(join(root, 'materials'), { mode: 0o700 });
  host = { artifactStore: { root: join(root, 'artifacts'), storeId: 'x01-artifacts' }, materialStore: { root: join(root, 'materials'), storeId: 'x01-materials', allowedDigests: allowed }, executionSettled: async id => stopped.has(id) };
  creationRequested = true; await admin.query(`CREATE DATABASE ${database}`);
  await new Promise<void>(resolve => registry.listen(0, '127.0.0.1', resolve)); const address = registry.address(); if (!address || typeof address === 'string') throw new Error('Missing registry address');
  registryUrl = `http://127.0.0.1:${address.port}/`; await openApp();
});
afterAll(async () => {
  vi.restoreAllMocks(); const cleanup: Record<string, unknown> = { database, root, createdRoot, rootIdentity: rootIdentity ?? null, creationRequested, providerCalls: 0 };
  const closed = await Promise.allSettled([app?.close(), pool.end(), new Promise<void>((resolve, reject) => { if (!registry.listening) return resolve(); registry.closeAllConnections(); registry.close(error => error ? reject(error) : resolve()); })]);
  cleanup.ownersClosed = closed.every(r => r.status === 'fulfilled');
  try {
    const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
    const connections = Number((await admin.query<{ count: string }>('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [database])).rows[0]!.count); cleanup.connections = connections;
    if (creationRequested && exists && cleanup.ownersClosed && connections === 0) { await admin.query(`DROP DATABASE ${database}`); cleanup.dropped = true; }
    cleanup.databaseAbsent = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount === 0;
    if (cleanup.ownersClosed && cleanup.databaseAbsent && createdRoot && rootIdentity) {
      const current = await fs.lstat(createdRoot);
      if (current.isDirectory() && !current.isSymbolicLink() && current.dev === rootIdentity.dev && current.ino === rootIdentity.ino) { await fs.rm(createdRoot, { recursive: true }); cleanup.rootRemoved = true; }
    }
  } catch { cleanup.failure = 'owned_cleanup_unconfirmed'; } finally {
    cleanup.adminClosed = await admin.end().then(() => true, () => false);
    cleanup.retainedRoot = cleanup.rootRemoved ? null : createdRoot || null;
    if (process.env.FLOW_X01_CENTER_EVIDENCE) await fs.writeFile(process.env.FLOW_X01_CENTER_EVIDENCE, JSON.stringify({ node: process.version, facts, cleanup }, null, 2) + '\n');
  }
  expect(cleanup).toMatchObject({ ownersClosed: true, adminClosed: true, connections: 0, databaseAbsent: true, rootRemoved: true });
});

test('public real npm fetch installs static material, replays without I/O and reads a bounded private-free receipt', async () => {
  const s = await source(); const key = randomUUID(); const installed = await request(s.path, s.input, key); expect(installed.status).toBe(202);
  const value = await state(installed.body.operationId); expect(value).toMatchObject({ schemaVersion: 1, registrationId: s.registrationId, versionId: s.versionId, status: 'installed', hostApiMajor: 1, error: null });
  expect(value.materialId).toMatch(/^[a-f0-9]{64}$/); expect(value.treeDigest).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(value)).not.toContain(root);
  expect(value).not.toHaveProperty('receipt'); expect(value).not.toHaveProperty('enabled');
  const mkdir = vi.spyOn(fs, 'mkdtemp'); const replay = await request(s.path, s.input, key); expect(replay.body).toEqual({ ...installed.body, replayed: true }); expect(mkdir).not.toHaveBeenCalled(); mkdir.mockRestore();
  expect(await state(installed.body.operationId)).toEqual(value); expect((await request(s.path, { ...s.input, reason: 'different' }, key)).status).toBe(409); expect(s.pkg.requests).toBe(1);
  const history = await request(`/api/plugin-installs/${value.id}/history?limit=1`); expect(history.body.events[0].kind).toBe('admitted'); expect(history.body.nextCursor).toBeTypeOf('string');
  expect((await request(`/api/plugins/${s.registrationId}/material-installs?limit=1`)).body.operations).toEqual([value]);
  expect((await request(`/api/plugin-installs/${value.id}`)).headers.get('cache-control')).toBe('no-store');
  expect((await request(`/api/plugins/${s.registrationId}`)).body.installation.runtimeStatus).toBe('unavailable'); facts.push({ kind: 'public-material', operationId: value.id, status: value.status, actualDownloads: s.pkg.requests });
});

test('owner auth, exact source ownership, CAS, trust and strict public input reject before material writes', async () => {
  const s = await source(); const other = await source(); const untrusted = await source(false); const before = await fs.readdir(host.materialStore.root);
  expect((await request(s.path, s.input, randomUUID(), 'wrong')).status).toBe(401);
  const runner = await request('/api/runners', { name: 'x01-fixture', harnesses: ['fixture'], capacity: 1 }); expect((await request(s.path, s.input, randomUUID(), runner.body.token)).status).toBe(403);
  for (const input of [{ ...s.input, expectedRevision: 999 }, { ...s.input, fetchAttemptId: other.input.fetchAttemptId }, { ...s.input, fetchOperationId: other.input.fetchOperationId }]) expect((await request(s.path, input)).status).toBe(409);
  expect((await request(s.path, { ...s.input, root: '/private' })).status).toBe(400); expect((await request(untrusted.path, untrusted.input)).status).toBe(409);
  expect(await fs.readdir(host.materialStore.root)).toEqual(before);
  expect((await request(`/api/plugins/${s.registrationId}/material-installs?after=bad`)).status).toBe(400);
});

test('accepted replay is read-only; only an explicit start may first prepare and restart preserves exact history', async () => {
  const s = await source(); const key = randomUUID(); const a = await admitInstall(pool, host, s.registrationId, s.versionId, s.input, key);
  expect((await request(s.path, s.input, key)).body).toEqual({ ...a, replayed: true }); expect((await state(a.operationId)).status).toBe('accepted');
  const started = await request(`/api/plugin-installs/${a.operationId}/commands`, { action: 'start', reason: 'Explicit first start' }); expect(started.status).toBe(202);
  const value = await state(a.operationId); expect(value.status).toBe('installed'); await app!.close(); app = undefined; await openApp(); expect(await state(a.operationId)).toEqual(value);
  expect((await request(`/api/plugin-installs/${a.operationId}/commands`, { action: 'start', reason: 'Not a retry' })).status).toBe(409);
});

test('official migration constraints and command rollback leave no orphan admission or audit', async () => {
  await migratePluginInstallations(pool); const s = await source(); const key = randomUUID();
  const query = Client.prototype.query; let armed = true;
  const spy = vi.spyOn(Client.prototype, 'query').mockImplementation(function (this: Client, ...args: any[]): any {
    if (armed && typeof args[0] === 'string' && args[0].startsWith('INSERT INTO flow.plugin_material_install_audit')) { armed = false; return Promise.reject(new Error('owned admission fault')); }
    return Reflect.apply(query, this, args);
  });
  try { await expect(admitInstall(pool, host, s.registrationId, s.versionId, s.input, key)).rejects.toThrow('owned admission fault'); } finally { spy.mockRestore(); }
  expect((await pool.query('SELECT 1 FROM flow.plugin_material_installs WHERE registration_id=$1', [s.registrationId])).rowCount).toBe(0);
  const a = await admitInstall(pool, host, s.registrationId, s.versionId, s.input, key); expect(a.replayed).toBe(false);
  await expect(pool.query("UPDATE flow.plugin_material_installs SET artifact_id=$2 WHERE id=$1", [a.operationId, randomUUID()])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.plugin_material_install_audit WHERE operation_id=$1', [a.operationId])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,artifact_id,artifact_store_id,store_id,artifact,input_digest,status)
    SELECT $2,registration_id,version_id,admitted_revision,fetch_operation_id,$3,artifact_id,artifact_store_id,store_id,artifact,input_digest,'accepted' FROM flow.plugin_material_installs WHERE id=$1`, [a.operationId, randomUUID(), randomUUID()])).rejects.toMatchObject({ code: '23503' });
});

test('lost preparing COMMIT acknowledgement starts zero filesystem work and persists a store gate', async () => {
  const s = await source(); const a = await accepted(s); const before = await fs.readdir(host.materialStore.root);
  const query = Client.prototype.query; let marked: Client | undefined;
  const spy = vi.spyOn(Client.prototype, 'query').mockImplementation(function (this: Client, ...args: any[]): any {
    if (typeof args[0] === 'string' && args[0].startsWith("UPDATE flow.plugin_material_installs SET status='preparing'")) marked = this;
    if (this === marked && args[0] === 'COMMIT') { marked = undefined; return Promise.resolve(Reflect.apply(query, this, args)).then(() => { throw new Error('owned lost preparing ACK'); }); }
    return Reflect.apply(query, this, args);
  });
  try { await expect(runInstall(pool, host, a.operationId, 'start')).rejects.toMatchObject({ code: 'plugin_install_unknown' }); } finally { spy.mockRestore(); }
  expect(await fs.readdir(host.materialStore.root)).toEqual(before); expect((await state(a.operationId)).status).toBe('preparing');
  const next = await accepted(s); await runInstall(pool, host, next.operationId, 'start'); expect((await state(next.operationId)).status).toBe('accepted');
  // This unresolved row deliberately remains isolated in a distinct logical store for later tests.
  host = { ...host, materialStore: { ...host.materialStore, storeId: 'x01-after-ack', root: join(root, 'after-ack') } }; await fs.mkdir(host.materialStore.root, { mode: 0o700 });
});

test('publication followed by a rolled-back completion transaction reconciles only with trusted prior lifecycle evidence', async () => {
  const s = await source(); const a = await accepted(s); const query = Client.prototype.query; let marked: Client | undefined;
  const spy = vi.spyOn(Client.prototype, 'query').mockImplementation(function (this: Client, ...args: any[]): any {
    if (typeof args[0] === 'string' && args[0].startsWith('UPDATE flow.plugin_material_installs SET status=$2')) marked = this;
    if (this === marked && args[0] === 'COMMIT') { marked = undefined; return Promise.reject(new Error('owned precommit lost connection')); }
    return Reflect.apply(query, this, args);
  });
  try { await expect(runInstall(pool, host, a.operationId, 'start')).rejects.toMatchObject({ code: 'plugin_install_unknown' }); } finally { spy.mockRestore(); }
  expect((await state(a.operationId)).status).toBe('preparing');
  await runInstall(pool, host, a.operationId, 'reconcile'); expect(await state(a.operationId)).toMatchObject({ status: 'unknown', error: 'lifecycle_unknown' });
  const executionId = (await pool.query<{ execution_id: string }>('SELECT execution_id FROM flow.plugin_material_installs WHERE id=$1', [a.operationId])).rows[0]!.execution_id;
  stopped.add(executionId); // The awaited owned call is settled; only the host, never HTTP, supplies this evidence.
  const mkdir = vi.spyOn(fs, 'mkdtemp'); await runInstall(pool, host, a.operationId, 'reconcile'); expect(mkdir).not.toHaveBeenCalled(); mkdir.mockRestore(); expect((await state(a.operationId)).status).toBe('installed');
});

test('real lost PG lock aborts pending own filesystem work; a new owner cannot overlap prepare', async () => {
  const s = await source(); const a = await accepted(s); const b = await accepted(s); const entered = gate(); const release = gate(); const rename = fs.rename.bind(fs);
  const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => { if (String(from).startsWith(host.materialStore.root + '/.stage-')) { entered.release(); await release.promise; } return rename(from, to); });
  let completion: Promise<unknown> | undefined; const deadline = new AbortController();
  try {
    completion = runInstall(pool, host, a.operationId, 'start').catch(error => error); await Promise.race([entered.promise, sleep(3000, undefined, { signal: deadline.signal }).then(() => { throw new Error('rename gate not reached'); })]);
    await runInstall(pool, host, b.operationId, 'start'); expect((await state(b.operationId)).status).toBe('accepted'); expect(spy).toHaveBeenCalledTimes(1);
    const holders = (await pool.query<{ pid: number }>("SELECT DISTINCT a.pid FROM pg_stat_activity a JOIN pg_locks l ON a.pid=l.pid WHERE a.datname=current_database() AND l.locktype='advisory' AND l.granted AND a.application_name='flow-x01-install-fixture'")).rows;
    expect(holders).toHaveLength(1); await pool.query('SELECT pg_terminate_backend($1)', [holders[0]!.pid]);
    await until(async () => !(await pool.query('SELECT 1 FROM pg_stat_activity WHERE pid=$1', [holders[0]!.pid])).rowCount);
    await runInstall(pool, host, b.operationId, 'start'); expect((await state(b.operationId)).status).toBe('accepted'); expect(spy).toHaveBeenCalledTimes(1);
    release.release(); expect(await completion).toMatchObject({ code: 'plugin_install_unknown' }); expect((await state(a.operationId)).status).toBe('preparing');
  } finally { deadline.abort(); release.release(); await completion; spy.mockRestore(); }
  host = { ...host, materialStore: { ...host.materialStore, storeId: 'x01-after-lock', root: join(root, 'after-lock') } }; await fs.mkdir(host.materialStore.root, { mode: 0o700 });
});

test('a committed completion with lost ACK remains installed and keyed replay cannot prepare again', async () => {
  const s = await source(); const key = randomUUID(); const a = await admitInstall(pool, host, s.registrationId, s.versionId, s.input, key);
  const query = Client.prototype.query; let marked: Client | undefined;
  const spy = vi.spyOn(Client.prototype, 'query').mockImplementation(function (this: Client, ...args: any[]): any {
    if (typeof args[0] === 'string' && args[0].startsWith('UPDATE flow.plugin_material_installs SET status=$2')) marked = this;
    if (this === marked && args[0] === 'COMMIT') { marked = undefined; return Promise.resolve(Reflect.apply(query, this, args)).then(() => { throw new Error('owned postcommit ACK loss'); }); }
    return Reflect.apply(query, this, args);
  });
  try { await expect(runInstall(pool, host, a.operationId, 'start')).rejects.toMatchObject({ code: 'plugin_install_unknown' }); } finally { spy.mockRestore(); }
  const value = await state(a.operationId); expect(value.status).toBe('installed');
  const mkdir = vi.spyOn(fs, 'mkdtemp');
  try { expect(await admitInstall(pool, host, s.registrationId, s.versionId, s.input, key)).toEqual({ ...a, replayed: true }); } finally { expect(mkdir).not.toHaveBeenCalled(); mkdir.mockRestore(); }
  await app!.close(); app = undefined; await openApp(); expect(await state(a.operationId)).toEqual(value);
});

test('cancellation after real publication stays unknown and blocks new preparation until exact reconciliation', async () => {
  const s = await source(); const a = await accepted(s); const stop = new AbortController(); const rename = fs.rename.bind(fs);
  const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => { await rename(from, to); if (String(from).startsWith(host.materialStore.root + '/.stage-')) stop.abort(); });
  try { await runInstall(pool, { ...host, signal: stop.signal }, a.operationId, 'start'); } finally { spy.mockRestore(); }
  expect(await state(a.operationId)).toMatchObject({ status: 'unknown', materialId: null, error: 'outcome_unknown' });
  const b = await accepted(s); await runInstall(pool, host, b.operationId, 'start'); expect((await state(b.operationId)).status).toBe('accepted');
  const executionId = (await pool.query<{ execution_id: string }>('SELECT execution_id FROM flow.plugin_material_installs WHERE id=$1', [a.operationId])).rows[0]!.execution_id;
  stopped.add(executionId); await runInstall(pool, host, a.operationId, 'reconcile'); expect((await state(a.operationId)).status).toBe('installed');
  await runInstall(pool, host, b.operationId, 'start'); expect((await state(b.operationId)).status).toBe('installed');
});

test('a disconnected public request cooperatively stops after publication and retains an unknown receipt', async () => {
  const s = await source(); const entered = gate(); const release = gate(); const disconnected = gate(); const stop = new AbortController();
  const rename = fs.rename.bind(fs); const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (String(from).startsWith(host.materialStore.root + '/.stage-')) { entered.release(); await release.promise; }
    await rename(from, to);
  });
  const onRequest = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => { if (req.url === s.path && req.method === 'POST') res.once('close', disconnected.release); };
  app!.server.on('request', onRequest); const deadline = new AbortController(); let response: Promise<unknown> | undefined; let operationId = '';
  try {
    response = fetch(base + s.path, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(s.input), signal: stop.signal }).catch(error => error);
    await Promise.race([entered.promise, sleep(3000, undefined, { signal: deadline.signal }).then(() => { throw new Error('request did not reach own rename'); })]);
    const list = await request(`/api/plugins/${s.registrationId}/material-installs`); operationId = list.body.operations[0].id;
    stop.abort(); await response; await Promise.race([disconnected.promise, sleep(3000, undefined, { signal: deadline.signal }).then(() => { throw new Error('owned request close was not observed'); })]); release.release();
    await until(async () => (await state(operationId)).status === 'unknown');
    expect(await state(operationId)).toMatchObject({ status: 'unknown', materialId: null, error: 'outcome_unknown' });
  } finally { deadline.abort(); stop.abort(); release.release(); await response; app!.server.removeListener('request', onRequest); spy.mockRestore(); }
  const executionId = (await pool.query<{ execution_id: string }>('SELECT execution_id FROM flow.plugin_material_installs WHERE id=$1', [operationId])).rows[0]!.execution_id;
  stopped.add(executionId); await runInstall(pool, host, operationId, 'reconcile'); expect((await state(operationId)).status).toBe('installed');
});

test('damaged verified artifact never becomes installed and pre-aborted first start performs no I/O', async () => {
  const s = await source(); const a = await accepted(s); const stop = AbortSignal.abort(); await runInstall(pool, { ...host, signal: stop }, a.operationId, 'start'); expect((await state(a.operationId)).status).toBe('accepted');
  const path = join(host.artifactStore.root, 'artifacts', s.artifact.artifactId, 'package.tgz'); await fs.chmod(path, 0o600); await fs.writeFile(path, 'damaged');
  await runInstall(pool, host, a.operationId, 'start'); expect(await state(a.operationId)).toMatchObject({ status: 'unknown', materialId: null, treeDigest: null, error: 'outcome_unknown' });
});
