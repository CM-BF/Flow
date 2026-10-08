import { randomUUID } from 'node:crypto';
import { mkdtemp, lstat, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FlowApiError, FlowClient } from '@flow/client';
import type { EventBatch } from '@flow/contracts';
import { PluginRunnerClient } from '../../../../packages/client/src/plugin-runner.js';
import type { PluginRunnerClaimRequest } from '../../../../packages/contracts/src/plugin-runner-claim.js';
import { AdmissionJournal, AdmissionStorageError } from '../admission-journal.js';
import { runRunner, type RunnerOptions } from '../runtime.js';
import { textDigest } from '../verifier.js';
import type { ProcessObservation } from './process-host.js';
const disk = vi.hoisted(() => ({ failPendingUnlink: false }));
vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, unlink: async (path: Parameters<typeof fs.unlink>[0]) => {
    if (disk.failPendingUnlink && String(path).endsWith('/pending-events.json')) { disk.failPendingUnlink = false; throw new Error('Crash before unlink'); }
    return fs.unlink(path);
  } };
});
const processState = vi.hoisted(() => ({ invokes: 0, closes: 0, roots: [] as string[], observations: [] as ProcessObservation[] }));
vi.mock('./process-host.js', async () => ({ createTrustedProcessHost: async ({ resourceRoot, observe }: { resourceRoot: string; observe?: (fact: ProcessObservation) => void }) => {
  processState.roots.push(resourceRoot);
  return { invoke: async (input: import('./host.js').PluginToolInput) => { processState.invokes++; for (const fact of processState.observations) observe?.(fact); return (await import('./host.js')).invokeInstalledTool(input); },
    close: async () => { processState.closes++; } };
} }));
const state = vi.hoisted(() => ({ invokes: 0, unknown: false, checkPersisted: async () => {} }));
vi.mock('./host.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./host.js')>();
  return { ...actual, invokeInstalledTool: vi.fn(async (input: import('./host.js').PluginToolInput) => {
    state.invokes++; await state.checkPersisted(); await input.assertOwnership(); await input.authorize(input.binding, 'load');
    await input.authorize(input.binding, 'invoke');
    if (state.unknown) throw new actual.PluginToolError('OUTCOME_UNKNOWN');
    return { kind: 'text', content: 'verified', provenance: { bindingId: input.binding.bindingId, invocationId: input.binding.invocationId,
      taskId: input.binding.taskId, attemptId: input.binding.attemptId, ownerVersion: input.binding.ownerVersion,
      installationId: input.binding.material.installationId, artifactId: input.binding.material.artifact.artifactId,
      artifactSha256: input.binding.material.artifact.sha256, treeDigest: input.binding.material.treeDigest, hostApiMajor: 1 } };
  }) };
});
const roots: { path: string; dev: number; ino: number; removed: boolean }[] = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const root of roots.filter(value => !value.removed)) {
    const now = await lstat(root.path); expect([now.dev, now.ino, now.isDirectory(), now.isSymbolicLink()]).toEqual([root.dev, root.ino, true, false]);
    await rm(root.path, { recursive: true }); root.removed = true;
  }
});
afterAll(async () => { if (process.env.FLOW_X01_PLUGIN_RUNTIME_FACTS) await writeFile(process.env.FLOW_X01_PLUGIN_RUNTIME_FACTS, JSON.stringify({ roots }), { flag: 'wx', mode: 0o600 }); });
beforeEach(() => { state.invokes = 0; state.unknown = false; disk.failPendingUnlink = false; processState.observations = []; });
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'flow-plugin-runtime-')), metadata = await lstat(path);
  roots.push({ path, dev: metadata.dev, ino: metadata.ino, removed: false });
  const baseUrl = 'http://unused.invalid', directory = join(path, textDigest(baseUrl)); await mkdir(directory);
  const runnerId = randomUUID(), taskId = randomUUID(), attemptId = randomUUID();
  const identity = { runnerId, taskId, attemptId, ownerVersion: 1 }, qualification = { bindingProtocol: 'flow.plugin-runtime.v1' as const, storeId: 'owned', hostApiMajor: 1 as const };
  const binding = { protocol: 'flow.plugin-runtime.v1' as const, bindingId: randomUUID(), invocationId: randomUUID(), taskId,
    registrationId: randomUUID(), registrationRevision: 1, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
    materialInstallOperationId: randomUUID(), targetRunnerId: runnerId, storeId: 'owned', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1 as const,
    artifact: { artifactId: randomUUID(), name: 'controlled', version: '1.0.0', integrity: 'sha512-'+'A'.repeat(86)+'==', bytes: 100, sha256: 'c'.repeat(64) },
    configuration: {}, inputDigest: textDigest('hello'), createdAt: new Date().toISOString() };
  const assignment = { task: { id: taskId, title: 'Tool', prompt: 'hello', harness: 'fixture' as const },
    attempt: { id: attemptId, runnerId, ownerVersion: 1, leaseExpiresAt: new Date(Date.now()+30000).toISOString() }, pluginToolBinding: binding };
  const abort = new AbortController(), reports: EventBatch[] = [], phaseKeys: string[] = [], claims: PluginRunnerClaimRequest[] = [];
  let phaseUnknown = false, loseClaim = false, allocated = false, ordinary = false;
  vi.spyOn(FlowClient.prototype, 'runnerIdentity').mockResolvedValue({ protocol: 'flow.runner-claim.v2', runnerId });
  const oldClaim = vi.spyOn(FlowClient.prototype, 'claimOpportunity').mockRejectedValue(new Error('legacy must not run'));
  vi.spyOn(FlowClient.prototype, 'heartbeat').mockResolvedValue({ action: 'continue', remainingLeaseMs: 30000, leaseExpiresAt: new Date(Date.now()+30000).toISOString(), decision: null });
  vi.spyOn(FlowClient.prototype, 'report').mockImplementation(async batch => {
    reports.push(batch); if (batch.events.some(event => event.type === 'completed')) abort.abort();
    return { accepted: batch.events.length, lastSequence: batch.events.at(-1)!.sequence };
  });
  const transport = vi.fn(async (route: string, init: RequestInit): Promise<unknown> => {
    if (route.endsWith('plugin-host')) return { published: true };
    const input = JSON.parse(init.body as string);
    if (route.endsWith('authorize')) {
      phaseKeys.push((init.headers as Record<string,string>)['Idempotency-Key']!);
      if (phaseUnknown) throw new Error('ACK lost');
      return { ...input, protocol: 'flow.plugin-runtime.v1', taskId, runnerId, authorizedRevision: 1, replayed: false };
    }
    claims.push(input);
    if (route.endsWith('/status') && !allocated) return { ...input, state: 'missing' };
    allocated = true; if (loseClaim) { loseClaim = false; throw new Error('claim ACK lost'); }
    const { pluginToolBinding: _, ...plain } = assignment;
    return { ...input, state: 'assigned', assignment: ordinary ? plain : assignment, identity, remainingLeaseMs: 30000 };
  });
  state.checkPersisted = async () => { const saved = JSON.parse(await readFile(join(directory, 'admission.json'), 'utf8')); expect(saved.assignments).toContainEqual(identity); };
  const options: RunnerOptions = { baseUrl, token: 'fixture-only', workingDirectory: path, signal: abort.signal, pollIntervalMs: 1,
    pluginExecution: { store: { root: join(path, 'store'), storeId: 'owned', allowedDigests: ['c'.repeat(64)] },
      transport: () => new PluginRunnerClient(transport) }, adapters: [],
    onNotice: notice => { if (notice.type === 'admission-blocked') abort.abort(); } };
  return { options, abort, directory, binding, qualification, runnerId, identity, reports, phaseKeys, claims, oldClaim, transport,
    ordinary: () => { ordinary = true; }, unknownPhase: () => { phaseUnknown = true; }, loseClaim: () => { loseClaim = true; } };
}
test('v3 claim persists before package dispatch and reports artifact verification completed through the original outbox', async () => {
  const f = await fixture(); await runRunner(f.options);
  expect(state.invokes).toBe(1); expect(f.oldClaim).not.toHaveBeenCalled();
  expect(f.reports.flatMap(batch => batch.events.map(event => event.type))).toEqual(['artifact', 'verification', 'completed']);
  expect(f.reports[0]!.events[0]).toHaveProperty('pluginSource.protocol', 'flow.plugin-artifact.v1');
  expect(new Set(f.phaseKeys).size).toBe(2); expect(f.phaseKeys.every(key => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(false);
});
test('lost claim ACK recovers exactly the durable full request and does not allocate under another key', async () => {
  const f = await fixture(); f.loseClaim(); await runRunner(f.options);
  expect(f.claims).toHaveLength(3); expect(f.claims[1]).toEqual(f.claims[0]); expect(f.claims[2]).toEqual(f.claims[0]); expect(state.invokes).toBe(1);
});
test.each(['phase ACK', 'package outcome'])('unknown %s retains assignment and restart never reinvokes the package', async kind => {
  const f = await fixture(); if (kind === 'phase ACK') f.unknownPhase(); else state.unknown = true;
  await runRunner(f.options); expect(f.reports.flatMap(batch => batch.events)).toEqual([]);
  const before = await readFile(join(f.directory, 'admission.json'), 'utf8'); expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(true);
  f.options.signal = new AbortController().signal;
  const stop = new AbortController(); f.options.signal = stop.signal; f.options.onNotice = notice => { if (notice.type === 'admission-blocked') stop.abort(); };
  await runRunner(f.options); expect(state.invokes).toBe(1); expect(await readFile(join(f.directory, 'admission.json'), 'utf8')).toBe(before);
});
test('persisted v3 with no current port fails before claim or execution and preserves its request', async () => {
  const f = await fixture(), journal = await AdmissionJournal.open(f.directory); await journal.bindRunner(f.runnerId, f.qualification);
  const before = await readFile(join(f.directory, 'admission.json'), 'utf8'); delete f.options.pluginExecution;
  await expect(runRunner(f.options)).rejects.toThrow('admission'); expect(f.oldClaim).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
  expect(state.invokes).toBe(0); expect(await readFile(join(f.directory, 'admission.json'), 'utf8')).toBe(before);
});

test('ordinary v3 assignment still follows the original adapter path', async () => {
  const f = await fixture(); f.ordinary();
  f.options.adapters = [{ name: 'fixture', version: '1', async run(context) { await context.emit({ type: 'message', text: 'ordinary' }); } }];
  await runRunner(f.options); expect(state.invokes).toBe(0);
  expect(f.reports.flatMap(batch => batch.events.map(event => event.type))).toEqual(['message', 'completed']);
});
test('legacy no-port polling uses only the unchanged v2 transport', async () => {
  const f = await fixture(); delete f.options.pluginExecution;
  vi.spyOn(FlowClient.prototype, 'claimOpportunityStatus').mockImplementation(async request => ({ ...request, state: 'missing' }));
  f.oldClaim.mockImplementation(async request => { f.abort.abort(); return { ...request, state: 'empty' }; });
  await runRunner(f.options); expect(f.oldClaim).toHaveBeenCalledTimes(1); expect(f.transport).not.toHaveBeenCalled(); expect(state.invokes).toBe(0);
});

test('store-only runtime opt-in consumes the real FlowClient plugin domain and its bearer request', async () => {
  const f = await fixture(); delete f.options.pluginExecution!.transport;
  const seen: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push(new Headers(init!.headers).get('authorization')!);
    const result = await f.transport(new URL(String(url)).pathname, init!);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  await runRunner(f.options); expect(state.invokes).toBe(1); expect(seen.length).toBeGreaterThanOrEqual(5);
  expect(seen.every(value => value === 'Bearer fixture-only')).toBe(true);
  expect(f.reports.at(-1)!.events.at(-1)!.type).toBe('completed');
});

function pendingPath(f: Awaited<ReturnType<typeof fixture>>) { return join(f.directory, textDigest(f.identity.attemptId), 'pending-events.json'); }
async function restartTerminal(f: Awaited<ReturnType<typeof fixture>>, rejectOwner = false) {
  const stop = new AbortController(); f.options.signal = stop.signal;
  f.options.onNotice = notice => { if (notice.type === 'admission-blocked' || notice.type === 'events-retained') stop.abort(); };
  const replayed: EventBatch[] = [];
  vi.spyOn(FlowClient.prototype, 'report').mockImplementation(async batch => {
    replayed.push(batch);
    if (rejectOwner) throw new FlowApiError(409, 'stale_owner', 'Old owner');
    stop.abort(); return { accepted: 0, lastSequence: batch.events.at(-1)!.sequence };
  });
  await runRunner(f.options); return replayed;
}
async function loseTerminalAck(f: Awaited<ReturnType<typeof fixture>>) {
  vi.spyOn(FlowClient.prototype, 'report').mockImplementation(async batch => {
    expect(batch.events.map(event => event.type)).toEqual(['artifact', 'verification', 'completed']);
    expect(JSON.parse(await readFile(pendingPath(f), 'utf8'))).toEqual(batch);
    f.abort.abort(); throw new Error('Committed ACK lost');
  });
  await runRunner(f.options);
  return await readFile(pendingPath(f), 'utf8');
}
test('terminal ACK loss replays the fixed complete bundle and old pin after a material upgrade without reinvoke', async () => {
  const f = await fixture(), saved = await loseTerminalAck(f);
  f.binding.artifact.version = '1.0.1'; f.binding.artifact.sha256 = 'd'.repeat(64);
  f.options.pluginExecution!.store.allowedDigests = ['d'.repeat(64)];
  const replayed = await restartTerminal(f);
  expect(replayed).toEqual([JSON.parse(saved)]); expect(state.invokes).toBe(1);
  expect(replayed[0]!.events[0]).toHaveProperty('pluginSource.artifactSha256', 'c'.repeat(64));
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(false);
  await expect(lstat(pendingPath(f))).rejects.toHaveProperty('code', 'ENOENT');
});
test('terminal ACK followed by admission persistence failure keeps the bundle until restart completes the journal', async () => {
  const f = await fixture();
  const complete = vi.spyOn(AdmissionJournal.prototype, 'complete').mockRejectedValueOnce(new AdmissionStorageError(new Error('Directory sync unknown')));
  await expect(runRunner(f.options)).rejects.toBeInstanceOf(AdmissionStorageError);
  const saved = await readFile(pendingPath(f), 'utf8');
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(true);
  complete.mockRestore(); expect(await restartTerminal(f)).toEqual([JSON.parse(saved)]);
  expect(state.invokes).toBe(1); expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(false);
});
test('terminal crash after admission completion before unlink replays without leaving an assignment or reinvoking', async () => {
  const f = await fixture(); disk.failPendingUnlink = true; await runRunner(f.options);
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(false);
  const saved = await readFile(pendingPath(f), 'utf8');
  expect(await restartTerminal(f)).toEqual([JSON.parse(saved)]); expect(state.invokes).toBe(1);
  await expect(lstat(pendingPath(f))).rejects.toHaveProperty('code', 'ENOENT');
});
test('terminal owner-fenced replay retains original bytes and admission without repacking ownership or invoking', async () => {
  const f = await fixture(), saved = await loseTerminalAck(f);
  expect(await restartTerminal(f, true)).toEqual([JSON.parse(saved)]);
  expect(await readFile(join(f.directory, textDigest(f.identity.attemptId), 'uncertain-events.json'), 'utf8')).toBe(saved);
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(true); expect(state.invokes).toBe(1);
});

test('trusted direct runtime opt-in selects the process host and closes it after original outbox completion', async () => {
  processState.invokes = 0; processState.closes = 0; processState.roots = [];
  const f = await fixture(); f.options.pluginExecution!.executionMode = 'trusted-process'; await runRunner(f.options);
  expect(processState.invokes).toBe(1); expect(processState.closes).toBe(1);
  expect(processState.roots).toEqual([join(await (await import('node:fs/promises')).realpath(f.directory), 'plugin-process')]);
  expect(f.reports.flatMap(batch => batch.events.map(event => event.type))).toEqual(['artifact', 'verification', 'completed']);
  expect((await AdmissionJournal.open(f.directory)).unresolved(new Set())).toBe(false);
});

// Mocked process host: proves the runtime consumer forwards the safe facts without spawning.
test('process lifecycle notices reach the existing runtime notice consumer unchanged', async () => {
  const f = await fixture(), notices: ProcessObservation[] = [];
  f.options.pluginExecution!.executionMode = 'trusted-process';
  const fact: ProcessObservation = { type: 'plugin-process', stage: 'settled', executionKind: 'tool',
    workerEntry: 'flow.runner.process-worker.v1', taskId: f.binding.taskId, bindingId: f.binding.bindingId,
    invocationId: f.binding.invocationId, attemptId: f.identity.attemptId, ownerVersion: 1, pid: 4242,
    observedAt: '2026-10-08T01:37:54.000Z', launchedAt: '2026-10-08T01:37:53.000Z',
    exitCode: 0, signal: null, protocolEof: true, stdoutEof: true, stderrEof: true, diagnosticBytes: 0,
    processClosed: true, resourceState: 'removed', observerError: null };
  processState.observations = [fact];
  f.options.onNotice = notice => { if (notice.type === 'plugin-process') notices.push(notice); };
  await runRunner(f.options);
  expect(notices).toHaveLength(1); expect(notices[0]).toBe(fact);
  expect(f.reports.at(-1)!.events.at(-1)!.type).toBe('completed');
});
