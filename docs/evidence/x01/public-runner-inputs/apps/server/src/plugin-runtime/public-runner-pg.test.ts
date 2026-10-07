import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer as createRegistry } from 'node:http';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { FlowClient } from '@flow/client';
import { readInstalledPackage, type TrustedPackageStore } from '@flow/plugin-runtime';
import { PLUGIN_RUNTIME_PROTOCOL, type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01/enable-binding-pg-fixture.js';
import { createServer } from '../index.js';

const fixture = new PluginDatabaseFixture('runtime', 4);
const ownerToken = `x01-${randomUUID()}`;
const stop = new AbortController();
const pack = promisify(execFile);
const packagePath = fileURLToPath(new URL('../../../../experiments/plugins/semver-compare/package/', import.meta.url));
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let base = '', registryUrl = '', root = '', runnerId = '';
let archive: Buffer, digest: string, integrity: string, store: TrustedPackageStore;
let runner: Promise<void> | undefined, runnerFailure: unknown, runnerSettled = true;
let startupConfirmed = false, registryRequests = 0, tarDownloads = 0, httpRequests = 0, responseBytes = 0;
const facts: Record<string, unknown>[] = [];
const registry = createRegistry((request, response) => {
  try {
    fixture.checkWork();
    if (++registryRequests > 4 || request.method !== 'GET') throw Error('Registry request bound');
    if (request.url === '/flow-semver-compare.tgz') { tarDownloads++; response.end(archive); return; }
    if (request.url !== '/flow-semver-compare') { response.writeHead(404); response.end(); return; }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ name: 'flow-semver-compare', versions: { '1.0.0': {
      name: 'flow-semver-compare', version: '1.0.0', dist: { integrity, tarball: registryUrl + 'flow-semver-compare.tgz' },
    } } }));
  } catch { stop.abort(); response.writeHead(503); response.end(); }
});
async function request(path: string, body?: unknown) {
  return fixture.request(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function until<T>(read: () => Promise<T | false>): Promise<T> {
  // One finite polling bound under the fixture's common work deadline.
  for (let i = 0; i < 80; i++) {
    fixture.checkWork(); if (runnerFailure) throw runnerFailure;
    const result = await read(); if (result !== false) return result;
    await sleep(100);
  }
  throw Error('Public runner observation bound reached');
}
beforeAll(async () => {
  await fixture.create();
  await fixture.start(async () => {
    root = join(await fs.realpath(process.env.FLOW_X01_PG_ROOT!), 'public-package');
    await fs.mkdir(root, { mode: 0o700 });
    await fs.cp(packagePath, join(root, 'package'), { recursive: true, errorOnExist: true, force: false });
    const provenance = JSON.parse(await fs.readFile(join(root, 'package/provenance.json'), 'utf8'));
    const bundle = await fs.readFile(join(root, 'package/index.mjs'));
    expect(provenance.upstream).toMatchObject({ name: 'semver', version: '7.8.5', license: 'ISC' });
    expect(provenance.externalRuntimeImports).toEqual([]);
    expect({ bytes: bundle.length, sha256: createHash('sha256').update(bundle).digest('hex') }).toEqual(provenance.bundle);
    const tarball = join(root, 'package.tgz');
    const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarball, '-C', root, 'package'], { timeout: 5000, maxBuffer: 8192 });
    const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
    try { await packing; } finally {
      await closed;
      facts.push({ kind: 'tar', pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode });
    }
    expect(packing.child.exitCode).toBe(0); expect(packing.child.signalCode).toBeNull();
    archive = await fs.readFile(tarball); expect(archive.length).toBeLessThan(65536);
    digest = createHash('sha256').update(archive).digest('hex');
    integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
    await fs.mkdir(join(root, 'materials'), { mode: 0o700 });
    store = { root: join(root, 'materials'), storeId: 'x01-public-semver', allowedDigests: [digest] };
    await new Promise<void>((resolve, reject) => { registry.once('error', reject); registry.listen(0, '127.0.0.1', resolve); });
    const address = registry.address(); if (!address || typeof address === 'string') throw Error('Registry address unknown');
    registryUrl = `http://127.0.0.1:${address.port}/`; fixture.listener(registryUrl.slice(0, -1));
    const artifactStore = { root: join(root, 'artifacts'), storeId: 'x01-public-artifacts' };
    app = await createServer({ databaseUrl: fixture.databaseUrl, ownerToken, automaticQueueScan: false, leaseMs: 30000,
      packageFetchHost: { ...artifactStore, registries: { own: { url: registryUrl, allowInsecureLoopback: true } } },
      pluginInstallHost: { artifactStore, materialStore: store },
      pluginRuntimeHostPolicy: identity => identity.protocol === PLUGIN_RUNTIME_PROTOCOL && identity.runnerId === runnerId
        && identity.storeId === store.storeId && identity.hostApiMajor === 1,
    });
    // Count actual owner and runner HTTP without replacing FlowClient or fetch.
    app.addHook('onRequest', async () => {
      fixture.checkWork(); if (++httpRequests > 256) { stop.abort(); throw Error('Public HTTP request bound'); }
    });
    app.addHook('onSend', async (_request, _reply, payload) => {
      const bytes = typeof payload === 'string' ? Buffer.byteLength(payload) : Buffer.isBuffer(payload) ? payload.length : payload == null ? 0 : -1;
      if (bytes < 0 || bytes > 131072 || (responseBytes += bytes) > 4194304) { stop.abort(); throw Error('Public response byte bound'); }
      return payload;
    });
    base = await app.listen({ host: '127.0.0.1', port: 0 }); fixture.listener(base); startupConfirmed = true;
  });
}, 30000);
afterAll(async () => {
  stop.abort();
  const started = await fixture.settleStartup();
  const runnerClosed = await fixture.close('runner-drain', async () => { await runner; if (!runnerSettled) throw Error('Runner unsettled'); });
  const serverClosed = started && runnerClosed && await fixture.close('server-close', async () => {
    await app?.close(); if (app?.server.listening) throw Error('Server still listening'); if (base) fixture.listenerClosed(base);
  });
  const registryClosed = started && await fixture.close('registry-close', async () => {
    if (registry.listening) await new Promise<void>((resolve, reject) => registry.close(error => error ? reject(error) : resolve()));
    if (registry.listening) throw Error('Registry still listening'); if (registryUrl) fixture.listenerClosed(registryUrl.slice(0, -1));
  });
  facts.push({ kind: 'public-traffic', httpRequests, responseBytes, registryRequests, tarDownloads, runnerSettled,
    runnerFailure: runnerFailure instanceof Error ? runnerFailure.name : runnerFailure ? 'UnknownError' : null });
  const owners = { startup: started && startupConfirmed, server: serverClosed, registry: registryClosed, runner: runnerClosed };
  const result = await fixture.finish(owners, facts);
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errors: [],
    cleanup: { ownersClosed: true, poolClosed: true, adminClosed: true, identityConfirmed: true,
      connections: 0, dropAcknowledged: true, databaseAbsent: true } });
}, 60000);

test('public trusted enable and frozen admission execute real semver through runRunner and sourced artifact', async () => {
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: {
    packageName: 'flow-semver-compare', packageVersion: '1.0.0', source: 'npm', declaredSha256: digest, license: 'ISC',
    hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [],
  } });
  expect(registered.status).toBe(201);
  const registrationId = registered.body.snapshot.installation.id as string, versionId = registered.body.snapshot.version.id as string;
  const fetched = await request(`/api/plugins/${registrationId}/versions/${versionId}/fetch`, { expectedRevision: 1, registryRef: 'own', integrity });
  expect(fetched.status).toBe(202);
  const fetchedState = await until(async () => { const r = await request(`/api/package-fetches/${fetched.body.operationId}`); return r.body.status === 'succeeded' ? r.body : false; });
  expect(fetchedState.artifact).toMatchObject({ name: 'flow-semver-compare', version: '1.0.0', sha256: digest, integrity, bytes: archive.length });
  const installed = await request(`/api/plugins/${registrationId}/versions/${versionId}/install`, {
    expectedRevision: 1, fetchOperationId: fetched.body.operationId, fetchAttemptId: fetched.body.attemptId, reason: 'Install exact operator-trusted npm bundle',
  });
  expect(installed.status).toBe(202);
  const material = await request(`/api/plugin-installs/${installed.body.operationId}`);
  expect(material.body).toMatchObject({ status: 'installed', error: null });
  const receipt = (await readInstalledPackage({ store, artifact: fetchedState.artifact })).receipt;
  expect(material.body).toMatchObject({ materialId: receipt.installationId, treeDigest: receipt.treeDigest });
  const owner = new FlowClient({ baseUrl: base, token: ownerToken });
  const registration = await owner.registerRunner({ name: 'Real semver runner', harnesses: ['fixture'], capacity: 1 });
  runnerId = registration.runnerId;
  const runnerClient = new FlowClient({ baseUrl: base, token: registration.token });
  await runnerClient.pluginRunner.publishHost({ protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: store.storeId, hostApiMajor: 1 });
  expect((await request(`/api/plugins/${registrationId}/commands`, { expectedRevision: 1, reason: 'Grant tool capability', change: { kind: 'set-grants', capabilities: ['tool'] } })).status).toBe(200);
  expect((await request(`/api/plugins/${registrationId}/runtime/commands`, { expectedRevision: 2, reason: 'Enable exact installed material',
    change: { kind: 'enable', materialInstallOperationId: installed.body.operationId, targetRunnerId: runnerId, storeId: store.storeId } })).status).toBe(200);
  const input = JSON.stringify({ left: '1.0.0-beta.2', right: '1.0.0-beta.11' });
  const admitted = await request(`/api/plugins/${registrationId}/tool-tasks`, { expectedRevision: 3, title: 'Compare real npm prereleases', input, verification: { kind: 'contains', expected: '-1' } });
  expect(admitted.status).toBe(201); const binding = admitted.body.binding as PluginToolBinding;
  expect(binding).toMatchObject({ materialId: receipt.installationId, treeDigest: receipt.treeDigest, artifact: { sha256: digest }, configuration: {} });
  const before = JSON.stringify(binding);
  runnerSettled = false;
  const deadline = AbortSignal.timeout(Math.max(1, Number(process.env.FLOW_X01_PG_WORK_UNTIL) - Date.now()));
  runner = runRunner({ baseUrl: base, token: registration.token, workingDirectory: join(root, 'runner'),
    signal: AbortSignal.any([stop.signal, deadline]), pluginExecution: { store }, adapters: [],
    pollIntervalMs: 100, heartbeatIntervalMs: 1000, requestTimeoutMs: 3000,
  }).catch(error => { runnerFailure = error; }).finally(() => { runnerSettled = true; });
  const final = await until(async () => { const snapshot = await owner.show(binding.taskId); return snapshot.status === 'succeeded' ? snapshot : false; });
  stop.abort(); await runner; expect(runnerFailure).toBeUndefined();
  expect(final.verificationStatus).toBe('passed'); expect(final.attempt).not.toBeNull();
  expect(JSON.stringify((await request(`/api/tasks/${binding.taskId}/plugin-binding`)).body)).toBe(before);
  const details = (await fixture.pool.query<{ id: string; kind: string }>('SELECT id,kind FROM flow.details WHERE task_id=$1 ORDER BY kind', [binding.taskId])).rows;
  const sourceRow = details.find(row => row.kind === 'detail'), artifactRow = details.find(row => row.kind === 'artifact');
  expect(sourceRow).toBeDefined(); expect(artifactRow).toBeDefined();
  expect((await owner.detail(artifactRow!.id)).content).toBe('-1');
  const association = JSON.parse((await owner.detail(sourceRow!.id)).content);
  expect(association.pluginSource).toMatchObject({ bindingId: binding.bindingId, invocationId: binding.invocationId,
    taskId: binding.taskId, attemptId: final.attempt!.id, installationId: receipt.installationId, treeDigest: receipt.treeDigest,
    artifactId: fetchedState.artifact.artifactId, artifactSha256: digest });
  const phases = (await fixture.pool.query('SELECT phase,attempt_id,owner_version FROM flow.plugin_tool_authorizations WHERE binding_id=$1 ORDER BY phase', [binding.bindingId])).rows;
  expect(phases.map(row => row.phase)).toEqual(['invoke', 'load']);
  for (const row of phases) expect(row).toMatchObject({ attempt_id: final.attempt!.id, owner_version: final.attempt!.ownerVersion });
  expect(tarDownloads).toBe(1); expect(registryRequests).toBe(2);
  facts.push({ kind: 'real-public-semver', taskId: binding.taskId, binding, material: material.body, phases,
    artifactContent: '-1', association, finalStatus: final.status, verificationStatus: final.verificationStatus,
    upstream: 'semver@7.8.5', wrapper: 'flow-semver-compare@1.0.0', source: 'fixed local npm composition served by owned loopback registry' });
}, 45000);
