import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer as createRegistry } from 'node:http';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { FlowClient } from '@flow/client';
import { runCli } from '../../../cli/src/index.js';
import { readInstalledPackage, type TrustedPackageStore } from '@flow/plugin-runtime';
import { type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import { PluginDatabaseFixture } from '../../../../docs/evidence/x01/enable-binding-pg-fixture.js';

const fixture = new PluginDatabaseFixture('runtime', 4);
const ownerToken = `x01-${randomUUID()}`;
const stop = new AbortController();
const pack = promisify(execFile);
const packagePath = fileURLToPath(new URL('../../../../experiments/plugins/semver-compare/package/', import.meta.url));
const processes: OwnedProcess[] = [];
let server: OwnedProcess | undefined, activeRunner: OwnedProcess | undefined;
let runnerToken = '', serverPort = 0;
let base = '', registryUrl = '', root = '', runnerId = '';
let archive: Buffer, digest: string, integrity: string, store: TrustedPackageStore;
let startupConfirmed = false, registryRequests = 0, tarDownloads = 0;
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
type OwnedProcess = { label: string; child: ChildProcessWithoutNullStreams; closed: Promise<void>;
  receipt: { label: string; pid: number | undefined; startedAt: string; exitCode: number | null; signal: NodeJS.Signals | null;
    stdoutEof: boolean; stderrEof: boolean; closed: boolean; outputBytes: number; terminationRequested: boolean; workDeadlineReached: boolean; logSha256: string | null }; error?: Error };
const sourceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const loader = '/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/loader.mjs';
async function config(name: string, value: unknown) {
  await fs.writeFile(join(root, name + '.json'), JSON.stringify(value), { flag: 'wx', mode: 0o600 });
}
function centerEnvironment(): NodeJS.ProcessEnv {
  return { DATABASE_URL: fixture.databaseUrl, FLOW_TOKEN: ownerToken, FLOW_PORT: String(serverPort), FLOW_HOST: '127.0.0.1',
    FLOW_PACKAGE_FETCH_CONFIG: join(root, 'fetch.json'), FLOW_PLUGIN_INSTALL_CONFIG: join(root, 'install.json') };
}
function launch(label: string, entry: string, values: NodeJS.ProcessEnv): OwnedProcess {
  fixture.checkWork();
  if (!process.env.FLOW_X01_PROCESS_TSCONFIG?.startsWith('/')) throw Error('Fixed process module map required');
  const child = spawn(process.execPath, ['--import', loader, join(sourceRoot, entry)], { cwd: sourceRoot, detached: false, stdio: 'pipe',
    env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, TMP: process.env.TMPDIR, TEMP: process.env.TMPDIR,
      NODE_DISABLE_COMPILE_CACHE: '1', TSX_DISABLE_CACHE: '1', TSX_TSCONFIG_PATH: process.env.FLOW_X01_PROCESS_TSCONFIG, ...values } });
  child.stdin.end();
  const receipt: OwnedProcess['receipt'] = { label, pid: child.pid, startedAt: new Date().toISOString(), exitCode: null, signal: null,
    stdoutEof: false, stderrEof: false, closed: false, outputBytes: 0, terminationRequested: false, workDeadlineReached: false, logSha256: null };
  const item: OwnedProcess = { label, child, receipt, closed: Promise.resolve() };
  const chunks: Buffer[] = [];
  const workTimer = setTimeout(() => { receipt.workDeadlineReached = true; if (!receipt.closed && !receipt.terminationRequested) { receipt.terminationRequested = true; child.kill('SIGTERM'); } }, Math.max(1, Number(process.env.FLOW_X01_PG_WORK_UNTIL) - Date.now()));
  workTimer.unref();
  item.closed = new Promise(resolve => { child.once('error', error => { item.error = error; }); child.once('close', (code, signal) => {
    clearTimeout(workTimer); receipt.exitCode = code; receipt.signal = signal; receipt.closed = true;
    const data = Buffer.concat(chunks); receipt.logSha256 = createHash('sha256').update(data).digest('hex');
    void fs.writeFile(join(root, label + '.log'), data, { flag: 'wx', mode: 0o600 }).catch(error => { item.error ??= error; }).finally(resolve);
  }); });
  child.stdout.once('end', () => { receipt.stdoutEof = true; }); child.stderr.once('end', () => { receipt.stderrEof = true; });
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', (chunk: Buffer) => {
    receipt.outputBytes += chunk.length; if (receipt.outputBytes <= 65536) chunks.push(Buffer.from(chunk));
    if (receipt.outputBytes > 65536) { item.error ??= Error('Child output bound exceeded'); if (!receipt.terminationRequested) { receipt.terminationRequested = true; child.kill('SIGTERM'); } }
  });
  processes.push(item); return item;
}
async function ready(item: OwnedProcess) {
  await until(async () => {
    if (item.error || item.receipt.closed) throw item.error ?? Error('Center exited before ready');
    try { const response = await request('/api/health'); return response.status === 200 ? true : false; }
    catch (error) { fixture.checkWork(); if (!(error instanceof TypeError)) throw error; return false; }
  });
}
async function stopProcess(item: OwnedProcess) {
  if (!item.receipt.closed && !item.receipt.terminationRequested) { item.receipt.terminationRequested = true; if (!item.child.kill('SIGTERM')) throw Error('Owned process signal unconfirmed'); }
  await item.closed;
  if (item.error) throw item.error;
  expect(item.receipt).toMatchObject({ exitCode: 0, signal: null, closed: true, stdoutEof: true, stderrEof: true, workDeadlineReached: false });
}
function startRunner(label: string) {
  return launch(label, 'apps/runner/src/main.ts', { FLOW_URL: base, FLOW_RUNNER_TOKEN: runnerToken,
    FLOW_RUNNER_WORKDIR: join(root, 'runner'), FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS: '1', FLOW_PLUGIN_EXECUTION_CONFIG: join(root, 'runner.json') });
}
let managementCalls = 0;
async function manage(action: 'runtime' | 'runtime-change' | 'tool-task' | 'binding', id: string, input?: unknown) {
  fixture.checkWork(); if (++managementCalls > 16) throw Error('Management call limit');
  const args = ['plugin', action, id];
  if (input !== undefined) {
    const name = `command-${managementCalls}`; await config(name, input);
    args.push('--input', join(root, name + '.json'), '--key', randomUUID());
  }
  let output = '', error = ''; const bound = (value: string) => { if (Buffer.byteLength(value) > 65536) throw Error('Management output limit'); return value; };
  const code = await runCli(args, { out: value => { output = bound(output + value); }, err: value => { error = bound(error + value); } },
    { FLOW_URL: base, FLOW_TOKEN: ownerToken }, AbortSignal.timeout(Math.max(1, Number(process.env.FLOW_X01_PG_WORK_UNTIL) - Date.now())));
  expect({ code, error }).toEqual({ code: 0, error: '' });
  return { code, body: JSON.parse(output) };
}
async function request(path: string, body?: unknown) {
  return fixture.request(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function until<T>(read: () => Promise<T | false>): Promise<T> {
  // One finite polling bound under the fixture's common work deadline.
  for (let i = 0; i < 80; i++) {
    fixture.checkWork(); if (activeRunner?.error || activeRunner?.receipt.closed) throw activeRunner.error ?? Error('Runner exited before expected observation');
    const result = await read(); if (result !== false) return result;
    await sleep(100);
  }
  throw Error('Public runner observation bound reached');
}
beforeAll(async () => {
  await fixture.create();
  await fixture.start(async () => {
    root = join(await fs.realpath(process.env.FLOW_X01_PG_ROOT!), 'process-package');
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
    const portReservation = createRegistry();
    await new Promise<void>((resolve, reject) => { portReservation.once('error', reject); portReservation.listen(0, '127.0.0.1', resolve); });
    const selected = portReservation.address();
    if (!selected || typeof selected === 'string') throw Error('Candidate port unknown');
    serverPort = selected.port;
    await new Promise<void>((resolve, reject) => portReservation.close(error => error ? reject(error) : resolve()));
    // This close→bind race is explicit: EADDRINUSE fails; no scanning or killing another listener.
    base = `http://127.0.0.1:${serverPort}`;
    await config('fetch', { ...artifactStore, registries: { own: { url: registryUrl, allowInsecureLoopback: true } } });
    await config('install', { artifactStore, materialStore: store });
    await config('runner', store);
    server = launch('bootstrap-center', 'apps/server/src/main.ts', centerEnvironment());
    await ready(server); fixture.listener(base);
    const owner = new FlowClient({ baseUrl: base, token: ownerToken });
    const registered = await owner.registerRunner({ name: 'Process semver runner', harnesses: ['fixture'], capacity: 1 });
    runnerId = registered.runnerId; runnerToken = registered.token;
    expect(await fixture.close('bootstrap-stop', () => stopProcess(server!))).toBe(true); fixture.listenerClosed(base);
    await config('runtime', { hosts: [{ runnerId, storeId: store.storeId, hostApiMajor: 1 }] });
    server = launch('trusted-center', 'apps/server/src/main.ts', { ...centerEnvironment(), FLOW_PLUGIN_RUNTIME_CONFIG: join(root, 'runtime.json') });
    await ready(server); fixture.listener(base); startupConfirmed = true;
  });
}, 30000);
afterAll(async () => {
  stop.abort();
  const started = await fixture.settleStartup();
  const runnerClosed = await fixture.close('runner-processes', async () => {
    for (const child of processes.filter(item => item.label.startsWith('runner-'))) await stopProcess(child);
  });
  const serverClosed = runnerClosed && await fixture.close('center-processes', async () => {
    for (const child of processes.filter(item => item.label.endsWith('center'))) await stopProcess(child);
    if (startupConfirmed) fixture.listenerClosed(base);
  });
  const registryClosed = await fixture.close('registry-close', async () => {
    if (registry.listening) await new Promise<void>((resolve, reject) => registry.close(error => error ? reject(error) : resolve()));
    if (registry.listening) throw Error('Registry still listening'); if (registryUrl) fixture.listenerClosed(registryUrl.slice(0, -1));
  });
  facts.push({ kind: 'process-traffic', registryRequests, tarDownloads, managementCalls, runnerHttpActual: null,
    httpTheoreticalMaximum: 2048, responseBytesTheoreticalMaximum: 268435456,
    processes: processes.map(item => item.receipt) });
  const owners = { startup: started && startupConfirmed, server: serverClosed, registry: registryClosed, runner: runnerClosed };
  const result = await fixture.finish(owners, facts);
  expect(result).toMatchObject({ cleanupConfirmed: true, retainedDatabase: null, errors: [],
    cleanup: { ownersClosed: true, poolClosed: true, adminClosed: true, identityConfirmed: true,
      connections: 0, dropAcknowledged: true, databaseAbsent: true } });
}, 60000);

test('real center and runner entries execute pinned semver before and after clean ACK restart', async () => {
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
  activeRunner = startRunner('runner-first');
  await until(async () => (await fixture.pool.query('SELECT 1 FROM flow.plugin_runtime_hosts WHERE runner_id=$1 AND store_id=$2', [runnerId, store.storeId])).rowCount ? true : false);
  expect((await request(`/api/plugins/${registrationId}/commands`, { expectedRevision: 1, reason: 'Grant tool capability', change: { kind: 'set-grants', capabilities: ['tool'] } })).status).toBe(200);
  expect((await manage('runtime-change', registrationId, { expectedRevision: 2, reason: 'Enable exact installed material',
    change: { kind: 'enable', materialInstallOperationId: installed.body.operationId, targetRunnerId: runnerId, storeId: store.storeId } })).code).toBe(0);
  expect((await manage('runtime', registrationId)).body).toMatchObject({ desiredEnabled: true });
  const input = JSON.stringify({ left: '1.0.0-beta.2', right: '1.0.0-beta.11' });
  const admitted = await manage('tool-task', registrationId, { expectedRevision: 3, title: 'Compare real npm prereleases', input, verification: { kind: 'contains', expected: '-1' } });
  expect(admitted.code).toBe(0); const binding = admitted.body.binding as PluginToolBinding;
  expect(binding).toMatchObject({ materialId: receipt.installationId, treeDigest: receipt.treeDigest, artifact: { sha256: digest }, configuration: {} });
  const before = JSON.stringify(binding);
  const final = await until(async () => { const snapshot = await owner.show(binding.taskId); return snapshot.status === 'succeeded' ? snapshot : false; });
  expect(await fixture.close('first-runner-stop', () => stopProcess(activeRunner!))).toBe(true);
  expect(final.verificationStatus).toBe('passed'); expect(final.attempt).not.toBeNull();
  expect(JSON.stringify((await manage('binding', binding.taskId)).body)).toBe(before);
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
  const oldEvents = await fixture.pool.query('SELECT event_id,sequence,digest FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [final.attempt!.id]);
  activeRunner = startRunner('runner-second');
  const second = await manage('tool-task', registrationId, { expectedRevision: 3, title: 'Confirm clean restart with independent task',
    input: JSON.stringify({ left: '2.0.0', right: '1.0.0' }), verification: { kind: 'contains', expected: '1' } });
  expect(second.code).toBe(0);
  const secondBinding = second.body.binding as PluginToolBinding;
  const secondFinal = await until(async () => { const state = await owner.show(secondBinding.taskId); return state.status === 'succeeded' ? state : false; });
  expect(secondFinal.verificationStatus).toBe('passed');
  const secondPhases = (await fixture.pool.query('SELECT phase,attempt_id,owner_version FROM flow.plugin_tool_authorizations WHERE binding_id=$1 ORDER BY phase', [secondBinding.bindingId])).rows;
  expect(secondPhases.map(row => row.phase)).toEqual(['invoke', 'load']);
  for (const row of secondPhases) expect(row).toMatchObject({ attempt_id: secondFinal.attempt!.id, owner_version: secondFinal.attempt!.ownerVersion });
  const secondArtifact = (await fixture.pool.query<{ id: string }>("SELECT id FROM flow.details WHERE task_id=$1 AND kind='artifact'", [secondBinding.taskId])).rows[0]!;
  expect((await owner.detail(secondArtifact.id)).content).toBe('1');
  const secondSource = (await fixture.pool.query<{ id: string }>("SELECT id FROM flow.details WHERE task_id=$1 AND kind='detail'", [secondBinding.taskId])).rows[0]!;
  expect(JSON.parse((await owner.detail(secondSource.id)).content).pluginSource).toMatchObject({ bindingId: secondBinding.bindingId, invocationId: secondBinding.invocationId, taskId: secondBinding.taskId, attemptId: secondFinal.attempt!.id, installationId: receipt.installationId, artifactSha256: digest, treeDigest: receipt.treeDigest });
  expect(await fixture.close('second-runner-stop', () => stopProcess(activeRunner!))).toBe(true);
  expect((await fixture.pool.query('SELECT event_id,sequence,digest FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [final.attempt!.id])).rows).toEqual(oldEvents.rows);
  expect((await fixture.pool.query('SELECT phase,attempt_id,owner_version FROM flow.plugin_tool_authorizations WHERE binding_id=$1 ORDER BY phase', [binding.bindingId])).rows).toEqual(phases);
  expect((await owner.show(binding.taskId)).attempt).toEqual(final.attempt);
  expect(JSON.stringify((await manage('binding', binding.taskId)).body)).toBe(before);
  expect(secondBinding).toMatchObject({ materialId: binding.materialId, treeDigest: binding.treeDigest, artifact: binding.artifact, configuration: binding.configuration });
  facts.push({ kind: 'clean-post-ACK-restart', firstTask: binding.taskId, secondTask: secondBinding.taskId,
    firstAttempt: final.attempt!.id, secondAttempt: secondFinal.attempt!.id, firstEventsUnchanged: true, firstPhasesUnchanged: true,
    samePinnedMaterial: true, secondArtifact: '1', unknownSideEffectsRecoveryProven: false });
  expect(tarDownloads).toBe(1); expect(registryRequests).toBe(2);
  facts.push({ kind: 'real-public-semver', taskId: binding.taskId, binding, material: material.body, phases,
    artifactContent: '-1', association, finalStatus: final.status, verificationStatus: final.verificationStatus,
    upstream: 'semver@7.8.5', wrapper: 'flow-semver-compare@1.0.0', source: 'fixed local npm composition served by owned loopback registry' });
}, 110000);
