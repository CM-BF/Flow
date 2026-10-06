import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { access, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const database = `flow_x05_process_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const ownerToken = 'x05-process-owner';
const packages = new Map<string, { body: Buffer; wrong?: boolean; wait?: Promise<void>; requests: number }>();
let root: string; let base: string; let registryUrl: string; let child: ChildProcess | null = null;
let output = ''; const facts: Record<string, unknown>[] = [];
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url!.slice(1));
  const isBody = path.endsWith('.tgz');
  const name = isBody ? path.slice(0, -4) : path;
  const pkg = packages.get(name);
  if (!pkg) { res.writeHead(404); res.end(); return; }
  if (!isBody) {
    res.end(JSON.stringify({ name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { name, version: '1.0.0',
      dist: { tarball: registryUrl + name + '.tgz', integrity: 'sha512-' + createHash('sha512').update(pkg.body).digest('base64') } } } }));
  } else {
    pkg.requests++;
    void (pkg.wait ?? Promise.resolve()).then(() => { if (!res.destroyed) res.end(pkg.wrong ? Buffer.from('wrong') : pkg.body); });
  }
});
async function poll<T>(fn: () => Promise<T | false>, timeout = 8000): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value !== false) return value; await new Promise(r => setTimeout(r, 20)); }
  throw new Error('Condition timed out');
}
async function stop(signal: NodeJS.Signals = 'SIGTERM') {
  if (!child) return;
  const target = child; child = null;
  const exited = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { target.kill('SIGKILL'); reject(new Error('Owned process failed to stop')); }, 7000);
    target.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  target.kill(signal); await exited;
}
async function start(storeId = 'x05-store', worker = true) {
  const hostRoot = storeId === 'x05-store' ? join(root, 'artifacts') : join(root, storeId);
  const config = join(root, `config-${randomUUID()}.json`);
  await writeFile(config, JSON.stringify({ databaseUrl, ownerToken, host: { storeId, root: hostRoot,
    registries: { local: { url: registryUrl, allowInsecureLoopback: true } } }, worker }), { mode: 0o600 });
  let local = '';
  child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./process-fixture.ts', import.meta.url)), config], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout!.on('data', chunk => { local += String(chunk); output += String(chunk); });
  child.stderr!.on('data', chunk => { output += String(chunk); });
  base = await poll(async () => {
    for (const line of local.split('\n')) { try { const value = JSON.parse(line); if (value.ready) return value.address as string; } catch {} }
    if (child?.exitCode !== null) throw new Error('Fixture failed before readiness');
    return false;
  });
}
async function request(path: string, data?: unknown, key = randomUUID()) {
  const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: {
    authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key,
  }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
}
async function prepare(options: { mismatch?: boolean; wrong?: boolean; wait?: Promise<void> } = {}) {
  const name = `flow-x05-${randomUUID()}`;
  const body = gzipSync(Buffer.from(JSON.stringify({ fixture: name })));
  const pkg = { body, wrong: options.wrong, wait: options.wait, requests: 0 }; packages.set(name, pkg);
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: options.mismatch ? 'f'.repeat(64) : createHash('sha256').update(body).digest('hex'),
    license: 'MIT', hostApiMajor: 1, capabilities: [], publicConfiguration: [],
  } });
  expect(registered.status).toBe(201);
  const snapshot = registered.body.snapshot;
  const path = `/api/plugins/${snapshot.installation.id}/versions/${snapshot.version.id}/fetch`;
  const input = { expectedRevision: 1, registryRef: 'local', integrity: 'sha512-' + createHash('sha512').update(body).digest('base64') };
  return { pkg, path, input, snapshot };
}
async function state(id: string, status: string) {
  return poll(async () => { const r = await request(`/api/package-fetches/${id}`); return r.body.status === status ? r.body : false; });
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'flow-x05-process-')));
  await admin.query(`CREATE DATABASE ${database}`);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing server address');
  registryUrl = `http://127.0.0.1:${address.port}/`;
  await start();
});
afterAll(async () => {
  await stop();
  await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });
  await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${database}`); await admin.end();
  if (process.env.FLOW_X05_EVIDENCE) await writeFile(process.env.FLOW_X05_EVIDENCE, JSON.stringify({ node: process.version, recordedAt: new Date().toISOString(), modelQueries: 0, facts, processOutput: output, databaseRemoved: true }, null, 2) + '\n');
  await rm(root, { recursive: true, force: true });
});

test('accepted command survives center restart and stable replay does not download again', async () => {
  await stop(); await start('x05-store', false);
  const fixture = await prepare(); const key = randomUUID();
  const accepted = await request(fixture.path, fixture.input, key); expect(accepted.status).toBe(202);
  const before = await state(accepted.body.operationId, 'queued');
  await stop('SIGKILL'); await start();
  const result = await state(accepted.body.operationId, 'succeeded');
  expect(result.artifact.artifactId).toBe(before.attempts[0].artifactId);
  expect(fixture.pkg.requests).toBe(1);
  expect((await request(fixture.path, fixture.input, key)).body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(`/api/plugins/${fixture.snapshot.installation.id}`)).body.installation.runtimeStatus).toBe('unavailable');
  facts.push({ case: 'queued-restart-and-replay', operationId: result.id, status: result.status, artifactId: result.artifact.artifactId, requests: fixture.pkg.requests });
});

test('hard exit after file publication but before PG commit recovers by known ID without another GET', async () => {
  let releaseBody!: () => void; const gate = new Promise<void>(resolve => { releaseBody = resolve; });
  const fixture = await prepare({ wait: gate });
  const accepted = await request(fixture.path, fixture.input); const running = await state(accepted.body.operationId, 'running');
  await poll(async () => fixture.pkg.requests === 1);
  const blocker = await pool.connect();
  await blocker.query('BEGIN'); await blocker.query('SELECT 1 FROM flow.plugin_package_fetches WHERE id=$1 FOR UPDATE', [running.id]);
  releaseBody();
  const artifactId = running.attempts[0].artifactId;
  const file = join(root, 'artifacts', 'artifacts', artifactId, 'receipt.json');
  await poll(async () => { try { await access(file); return true; } catch { return false; } });
  await stop('SIGKILL'); await blocker.query('ROLLBACK'); blocker.release();
  await start(); const recovered = await state(running.id, 'succeeded');
  expect(recovered.artifact.artifactId).toBe(artifactId); expect(fixture.pkg.requests).toBe(1);
  const history = await request(`/api/package-fetches/${running.id}/history`);
  expect(history.body.events.filter((e: any) => e.kind === 'succeeded')).toHaveLength(1);
  facts.push({ case: 'published-before-PG-hard-exit', operationId: running.id, artifactId, requests: fixture.pkg.requests, status: recovered.status });
});

test('interrupted network requires explicit retry with a fresh attempt; reconciliation does no download', async () => {
  let releaseBody!: () => void; const gate = new Promise<void>(resolve => { releaseBody = resolve; });
  const fixture = await prepare({ wait: gate }); const accepted = await request(fixture.path, fixture.input);
  const running = await state(accepted.body.operationId, 'running'); await poll(async () => fixture.pkg.requests === 1);
  await stop('SIGKILL'); releaseBody(); fixture.pkg.wait = undefined;
  await start(); const interrupted = await state(running.id, 'interrupted'); expect(fixture.pkg.requests).toBe(1);
  expect((await request(`/api/package-fetches/${running.id}/commands`, { action: 'reconcile', reason: 'Inspect the known publication' })).status).toBe(202);
  await state(running.id, 'interrupted'); expect(fixture.pkg.requests).toBe(1);
  const key = randomUUID(); const input = { action: 'retry', reason: 'Explicit new download attempt' };
  const retried = await request(`/api/package-fetches/${running.id}/commands`, input, key);
  expect(retried.status).toBe(202); expect(retried.body.attemptId).not.toBe(interrupted.currentAttemptId);
  const succeeded = await state(running.id, 'succeeded');
  expect(succeeded.attempts).toHaveLength(2); expect(succeeded.attempts[0].status).toBe('interrupted');
  expect(succeeded.attempts[0].artifactId).not.toBe(succeeded.attempts[1].artifactId);
  expect((await request(`/api/package-fetches/${running.id}/commands`, input, key)).body).toEqual({ ...retried.body, replayed: true });
  expect(fixture.pkg.requests).toBe(2);
  facts.push({ case: 'interrupted-reconcile-explicit-retry', operationId: running.id, requests: fixture.pkg.requests, attempts: succeeded.attempts });
});

test('declared SHA256 mismatch is not a verified version and retries have a fixed attempt budget', async () => {
  const fixture = await prepare({ mismatch: true }); const accepted = await request(fixture.path, fixture.input);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const failed = await state(accepted.body.operationId, 'failed');
    expect(failed.artifact).toBeNull(); expect(failed.attempts.at(-1).error).toBe('DECLARATION_MISMATCH');
    const retry = await request(`/api/package-fetches/${failed.id}/commands`, { action: 'retry', reason: 'Explicit bounded retry' });
    expect(retry.status).toBe(attempt < 3 ? 202 : 409);
  }
  expect(fixture.pkg.requests).toBe(3);
  facts.push({ case: 'declaration-mismatch-budget', operationId: accepted.body.operationId, requests: fixture.pkg.requests, status: 'failed' });
});

test('a different center store can observe but cannot reconcile or execute the local operation', async () => {
  const fixture = await prepare({ wrong: true }); const accepted = await request(fixture.path, fixture.input);
  await state(accepted.body.operationId, 'failed'); const requests = fixture.pkg.requests;
  await stop(); await start('other-store');
  expect((await request(`/api/package-fetches/${accepted.body.operationId}`)).status).toBe(200);
  expect((await request(`/api/package-fetches/${accepted.body.operationId}/commands`, { action: 'reconcile', reason: 'Wrong host' })).status).toBe(409);
  expect(fixture.pkg.requests).toBe(requests);
  await stop(); await start();
  facts.push({ case: 'foreign-store-observation-only', operationId: accepted.body.operationId, requests });
});


test('lost admission ACK replays one committed operation after center restart', async () => {
  await stop(); await start('x05-store', false);
  const fixture = await prepare(); const key = randomUUID();
  let acknowledgeCommit!: (value: any) => void;
  const committed = new Promise<any>(resolve => { acknowledgeCommit = resolve; });
  const proxy = createServer(async (_req, response) => {
    const accepted = await request(fixture.path, fixture.input, key);
    acknowledgeCommit(accepted);
    response.destroy(); // The caller never receives the durable acceptance receipt.
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  try {
    const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('Missing proxy');
    await expect(fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST' })).rejects.toThrow();
    const accepted = await committed; expect(accepted.status).toBe(202);
    await stop('SIGKILL'); await start();
    const replay = await request(fixture.path, fixture.input, key);
    expect(replay.body).toEqual({ ...accepted.body, replayed: true });
    const result = await state(accepted.body.operationId, 'succeeded');
    expect(fixture.pkg.requests).toBe(1);
    const history = await request(`/api/package-fetches/${result.id}/history`);
    expect(history.body.events.filter((event: any) => event.kind === 'admitted')).toHaveLength(1);
    facts.push({ case: 'lost-admission-ACK', operationId: result.id, requests: fixture.pkg.requests, replayed: replay.body.replayed });
  } finally { await new Promise<void>(resolve => proxy.close(() => resolve())); }
});
