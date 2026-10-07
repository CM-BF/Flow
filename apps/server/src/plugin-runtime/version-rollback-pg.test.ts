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
import { PLUGIN_RUNTIME_PROTOCOL, type PluginGrantRequest, type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
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
let store: TrustedPackageStore;
const releases = new Map<string, { archive: Buffer; digest: string; integrity: string }>();
let releaseA: () => void = () => {};
let acknowledgeLoad: (request: PluginGrantRequest) => void = () => {};
const aGate = new Promise<void>(resolve => { releaseA = resolve; });
const aLoaded = new Promise<PluginGrantRequest>(resolve => { acknowledgeLoad = resolve; });
let runner: Promise<void> | undefined, runnerFailure: unknown, runnerSettled = true;
let startupConfirmed = false, registryRequests = 0, tarDownloads = 0, httpRequests = 0, responseBytes = 0;
const facts: Record<string, unknown>[] = [];
const registry = createRegistry((request, response) => {
  try {
    fixture.checkWork();
    if (++registryRequests > 8 || request.method !== 'GET') throw Error('Registry request bound');
    const version = request.url?.match(/^\/flow-semver-compare-(1\.0\.[01])\.tgz$/)?.[1];
    if (version && releases.has(version)) { tarDownloads++; response.end(releases.get(version)!.archive); return; }
    if (request.url !== '/flow-semver-compare') { response.writeHead(404); response.end(); return; }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ name: 'flow-semver-compare', versions: Object.fromEntries([...releases].map(([version, data]) => [version, {
      name: 'flow-semver-compare', version, dist: { integrity: data.integrity, tarball: `${registryUrl}flow-semver-compare-${version}.tgz` },
    }])) }));
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
    for (const version of ['1.0.0', '1.0.1']) {
      const directory = join(root, version); await fs.mkdir(directory);
      await fs.cp(packagePath, join(directory, 'package'), { recursive: true, errorOnExist: true, force: false });
      const manifestPath = join(directory, 'package/package.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, version }) + '\n');
      const provenance = JSON.parse(await fs.readFile(join(directory, 'package/provenance.json'), 'utf8'));
      const bundle = await fs.readFile(join(directory, 'package/index.mjs'));
      expect(provenance.upstream).toMatchObject({ name: 'semver', version: '7.8.5', license: 'ISC' });
      expect(provenance.externalRuntimeImports).toEqual([]);
      expect({ bytes: bundle.length, sha256: createHash('sha256').update(bundle).digest('hex') }).toEqual(provenance.bundle);
      const tarball = join(directory, 'package.tgz');
      const packing = pack('/usr/bin/tar', ['--format=ustar', '-czf', tarball, '-C', directory, 'package'], { timeout: 5000, maxBuffer: 8192 });
      const closed = new Promise<void>(resolve => packing.child.once('close', () => resolve()));
      try { await packing; } finally { await closed; facts.push({ kind: 'tar', version, pid: packing.child.pid, exitCode: packing.child.exitCode, signal: packing.child.signalCode }); }
      expect(packing.child.exitCode).toBe(0); expect(packing.child.signalCode).toBeNull();
      const archive = await fs.readFile(tarball); expect(archive.length).toBeLessThan(65536);
      releases.set(version, { archive, digest: createHash('sha256').update(archive).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(archive).digest('base64') });
    }
    await fs.mkdir(join(root, 'materials'), { mode: 0o700 });
    store = { root: join(root, 'materials'), storeId: 'x01-version-lifecycle', allowedDigests: [...releases.values()].map(value => value.digest) };
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
  stop.abort(); releaseA();
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


test('active load-authorized A keeps its pin across B and rollback C with explicit current grants', async () => {
  const declaration = (version: string) => ({ packageName: 'flow-semver-compare', packageVersion: version, source: 'npm',
    declaredSha256: releases.get(version)!.digest, license: 'ISC', hostApiMajor: 1, capabilities: ['tool'],
    publicConfiguration: [{ key: 'strict', kind: 'boolean', required: true }] });
  const registered = await request('/api/plugins', { scope: { workspaceId: 'personal', projectId: null }, version: declaration('1.0.0') });
  expect(registered.status).toBe(201);
  const id = registered.body.snapshot.installation.id as string, aVersion = registered.body.snapshot.version.id as string;
  let revision = 1;
  const command = async (change: unknown) => {
    const response = await request(`/api/plugins/${id}/commands`, { expectedRevision: revision, reason: 'Version lifecycle validation', change });
    expect(response.status).toBe(200); expect(response.body.operation.beforeRevision).toBe(revision);
    expect(response.body.snapshot.revision).toBe(++revision); return response.body.snapshot;
  };
  const runtime = async (change: unknown) => {
    const response = await request(`/api/plugins/${id}/runtime/commands`, { expectedRevision: revision, reason: 'Explicit runtime transition', change });
    expect(response.status).toBe(200); expect(response.body.snapshot.revision).toBe(++revision); return response.body;
  };
  const install = async (versionId: string, version: string) => {
    const release = releases.get(version)!;
    const fetched = await request(`/api/plugins/${id}/versions/${versionId}/fetch`, { expectedRevision: revision, registryRef: 'own', integrity: release.integrity });
    expect(fetched.status).toBe(202);
    const fetchedState = await until(async () => { const r = await request(`/api/package-fetches/${fetched.body.operationId}`); return r.body.status === 'succeeded' ? r.body : false; });
    expect(fetchedState.artifact).toMatchObject({ name: 'flow-semver-compare', version, sha256: release.digest, integrity: release.integrity, bytes: release.archive.length });
    const installed = await request(`/api/plugins/${id}/versions/${versionId}/install`, { expectedRevision: revision,
      fetchOperationId: fetched.body.operationId, fetchAttemptId: fetched.body.attemptId, reason: 'Install fixed semver composition' });
    expect(installed.status).toBe(202);
    const material = await request(`/api/plugin-installs/${installed.body.operationId}`);
    const receipt = (await readInstalledPackage({ store, artifact: fetchedState.artifact })).receipt;
    expect(material.body).toMatchObject({ status: 'installed', materialId: receipt.installationId, treeDigest: receipt.treeDigest, error: null });
    return { operationId: installed.body.operationId as string, receipt };
  };
  const owner = new FlowClient({ baseUrl: base, token: ownerToken });
  const registration = await owner.registerRunner({ name: 'Version lifecycle runner', harnesses: ['fixture'], capacity: 2 }); runnerId = registration.runnerId;
  const runnerClient = new FlowClient({ baseUrl: base, token: registration.token });
  await runnerClient.pluginRunner.publishHost({ protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: store.storeId, hostApiMajor: 1 });
  const enable = async (material: { operationId: string }, strict: boolean) => {
    await command({ kind: 'configure', values: { strict } }); await command({ kind: 'set-grants', capabilities: ['tool'] });
    await runtime({ kind: 'enable', materialInstallOperationId: material.operationId, targetRunnerId: runnerId, storeId: store.storeId });
  };
  const admit = async (title: string) => {
    const response = await request(`/api/plugins/${id}/tool-tasks`, { expectedRevision: revision, title,
      input: JSON.stringify({ left: '1.0.0-beta.2', right: '1.0.0-beta.11' }), verification: { kind: 'contains', expected: '-1' } });
    expect(response.status).toBe(201); return response.body.binding as PluginToolBinding;
  };
  const aMaterial = await install(aVersion, '1.0.0'); await enable(aMaterial, true);
  const a = await admit('A remains active before invoke'); const originalA = JSON.stringify(a);
  expect(a).toMatchObject({ versionId: aVersion, materialId: aMaterial.receipt.installationId, treeDigest: aMaterial.receipt.treeDigest,
    materialInstallOperationId: aMaterial.operationId, artifact: aMaterial.receipt.artifact, configuration: { strict: true } });
  runnerSettled = false;
  runner = runRunner({ baseUrl: base, token: registration.token, workingDirectory: join(root, 'runner'),
    signal: AbortSignal.any([stop.signal, AbortSignal.timeout(Math.max(1, Number(process.env.FLOW_X01_PG_WORK_UNTIL) - Date.now()))]),
    maxConcurrentAttempts: 2, adapters: [], pollIntervalMs: 100, heartbeatIntervalMs: 1000, requestTimeoutMs: 45000,
    pluginExecution: { store, transport: client => ({
      claim: (...args) => client.pluginRunner.claim(...args), status: (...args) => client.pluginRunner.status(...args),
      publishHost: (...args) => client.pluginRunner.publishHost(...args),
      authorize: async (request, key, signal) => {
        const receipt = await client.pluginRunner.authorize(request, key, signal);
        if (request.bindingId === a.bindingId && request.phase === 'load') {
          facts.push({ kind: 'a-load-ack', request, receipt }); acknowledgeLoad(request);
          if (signal?.aborted) throw signal.reason;
          let onAbort: () => void = () => {};
          try {
            await Promise.race([aGate, new Promise<never>((_, reject) => {
              onAbort = () => reject(signal?.reason ?? Error('A gate aborted'));
              signal?.addEventListener('abort', onAbort, { once: true });
            })]);
          } finally { signal?.removeEventListener('abort', onAbort); }
        }
        return receipt;
      },
    }) },
  }).catch(error => { runnerFailure = error; }).finally(() => { runnerSettled = true; });
  let timer: NodeJS.Timeout | undefined;
  const aLoad = await Promise.race([aLoaded, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('A load gate deadline')), 15000); })]).finally(() => clearTimeout(timer));
  expect((await owner.show(a.taskId)).status).toBe('running');
  const phaseRows = async () => (await fixture.pool.query('SELECT phase,attempt_id,owner_version FROM flow.plugin_tool_authorizations WHERE binding_id=$1 ORDER BY phase', [a.bindingId])).rows;
  expect((await phaseRows()).map(row => row.phase)).toEqual(['load']);
  const prefix = (await fixture.pool.query('SELECT sequence,event_id,digest FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [aLoad.attemptId])).rows;
  const before = revision; const added = await command({ kind: 'register-version', version: declaration('1.0.1') });
  expect(revision).toBe(before + 1); expect(added.version.id).toBe(aVersion);
  const versions = await request(`/api/plugins/${id}/versions`);
  const bVersion = versions.body.versions.find((value: { packageVersion: string }) => value.packageVersion === '1.0.1').id as string;
  const selected = await command({ kind: 'select-version', versionId: bVersion });
  expect(selected).toMatchObject({ configuration: {}, grants: [], configurationStatus: 'incomplete' });
  await expect(runnerClient.pluginRunner.authorize({ ...aLoad, phase: 'invoke' },
    createHash('sha256').update(JSON.stringify([runnerId, a.bindingId, a.invocationId, aLoad.attemptId, aLoad.ownerVersion, 'invoke'])).digest('hex'))).rejects.toMatchObject({ status: 403, code: 'plugin_tool_grant_required' });
  expect((await phaseRows()).map(row => row.phase)).toEqual(['load']);
  expect((await fixture.pool.query("SELECT count(*)::int AS count FROM flow.details WHERE task_id=$1 AND kind='artifact'", [a.taskId])).rows[0].count).toBe(0);
  const bMaterial = await install(bVersion, '1.0.1'); await enable(bMaterial, false);
  expect(bMaterial.receipt.treeDigest).not.toBe(aMaterial.receipt.treeDigest);
  expect(bMaterial.receipt.artifact.sha256).not.toBe(aMaterial.receipt.artifact.sha256);
  const b = await admit('B uses new release');
  expect(b).toMatchObject({ versionId: bVersion, materialInstallOperationId: bMaterial.operationId, materialId: bMaterial.receipt.installationId,
    treeDigest: bMaterial.receipt.treeDigest, artifact: bMaterial.receipt.artifact, configuration: { strict: false } });
  const completed = async (binding: PluginToolBinding) => {
    const final = await until(async () => { const value = await owner.show(binding.taskId); return value.status === 'succeeded' ? value : false; });
    expect(final.verificationStatus).toBe('passed');
    if (binding.bindingId === a.bindingId) expect(final.attempt).toMatchObject({ id: aLoad.attemptId, ownerVersion: aLoad.ownerVersion });
    const rows = (await fixture.pool.query<{ id: string; kind: string }>('SELECT id,kind FROM flow.details WHERE task_id=$1 ORDER BY kind', [binding.taskId])).rows;
    const artifact = rows.find(row => row.kind === 'artifact')!, source = rows.find(row => row.kind === 'detail')!;
    expect(artifact).toBeDefined(); expect(source).toBeDefined(); expect((await owner.detail(artifact.id)).content).toBe('-1');
    const provenance = JSON.parse((await owner.detail(source.id)).content).pluginSource;
    expect(provenance).toMatchObject({ bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: binding.taskId,
      installationId: binding.materialId, treeDigest: binding.treeDigest, artifactId: binding.artifact.artifactId, artifactSha256: binding.artifact.sha256 });
    expect((await request(`/api/tasks/${binding.taskId}/plugin-binding`)).body).toEqual(binding);
    facts.push({ kind: 'completed', taskId: binding.taskId, version: binding.artifact.version, bindingId: binding.bindingId, materialId: binding.materialId,
      treeDigest: binding.treeDigest, artifactSha256: binding.artifact.sha256, provenance });
  };
  await completed(b); releaseA(); await completed(a);
  expect(JSON.stringify((await request(`/api/tasks/${a.taskId}/plugin-binding`)).body)).toBe(originalA);
  expect((await fixture.pool.query('SELECT sequence,event_id,digest FROM flow.runner_events WHERE attempt_id=$1 AND sequence<=$2 ORDER BY sequence', [aLoad.attemptId, prefix.at(-1)?.sequence ?? 0])).rows).toEqual(prefix);
  expect((await phaseRows()).map(row => row.phase)).toEqual(['invoke', 'load']);
  const completedAEvents = (await fixture.pool.query('SELECT sequence,event_id,digest FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [aLoad.attemptId])).rows;
  expect(completedAEvents.length).toBeGreaterThan(0);
  await runtime({ kind: 'disable' });
  const denied = await request(`/api/plugins/${id}/tool-tasks`, { expectedRevision: revision, title: 'Disabled cannot admit', input: '{}' });
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe('plugin_not_enabled');
  const rollback = await command({ kind: 'select-version', versionId: aVersion });
  expect(rollback).toMatchObject({ configuration: {}, grants: [], configurationStatus: 'incomplete' });
  await enable(aMaterial, true); const c = await admit('C uses selected old release');
  expect(c).toMatchObject({ versionId: aVersion, materialInstallOperationId: aMaterial.operationId, materialId: aMaterial.receipt.installationId,
    treeDigest: aMaterial.receipt.treeDigest, artifact: aMaterial.receipt.artifact, configuration: { strict: true } });
  expect(c.bindingId).not.toBe(a.bindingId); expect(c.invocationId).not.toBe(a.invocationId); expect(c.taskId).not.toBe(a.taskId);
  await completed(c); stop.abort(); await runner; expect(runnerFailure).toBeUndefined();
  expect(JSON.stringify((await request(`/api/tasks/${a.taskId}/plugin-binding`)).body)).toBe(originalA);
  expect((await fixture.pool.query('SELECT sequence,event_id,digest FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [aLoad.attemptId])).rows).toEqual(completedAEvents);
  expect(tarDownloads).toBe(2); expect(registryRequests).toBe(4);
  expect((await fixture.pool.query('SELECT count(*)::int AS count FROM flow.tasks')).rows[0].count).toBe(3);
  facts.push({ kind: 'scope', upstream: 'semver@7.8.5', wrappers: ['1.0.0', '1.0.1', '1.0.0'],
    aGate: 'running attempt; load ACK persisted; before module load/invoke', originalEventCount: prefix.length, finalRevision: revision });
}, 110000);
