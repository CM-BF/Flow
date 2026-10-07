import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, realpath, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { HarnessContext, RunnerEventData, ExecutionProfileReference } from '@flow/contracts';
import { nativeEngineeringProfileConfigurationJson, nativeEngineeringReceiptSchema, nativeEngineeringVerificationInput, type NativeEngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-native.js';
import { createCodexTransport } from '../codex/index.js';
import type { CodexTransport } from '../codex/types.js';
import { createNativeEngineeringAdapter } from './native-adapter.js';
import type { NativeWriteAuthority } from './native-writer.js';
import { createSyntheticProject, restoreSyntheticProject, type EngineeringWorkspace } from './workspace.js';
import { calculatorReceiptJson } from './calculator-receipt.js';
import { digest } from './resources.js';

const source = 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n';
// Fixed self-owned JSONL peer exercises the real G exchange. No provider binary or SDK is launched.
const peer = String.raw`
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
const mode=process.argv[2], send=x=>process.stdout.write(JSON.stringify(x)+'\n'), result=(id,value)=>send({id,result:value});
const notify=(method,params)=>send({method,params}), file={type:'fileChange',id:'patch',status:'inProgress',changes:[{path:'calculator.mjs',kind:{type:'update',move_path:null},diff:'calculator arithmetic'}]};
const final={type:'agentMessage',id:'final',text:'Changed file',phase:'final_answer',delivery:null,questions:null};
const turn=(status,items)=>({id:'turn',status,items,itemsView:'full',error:status==='failed'?{}:null});
for await(const line of createInterface({input:process.stdin})) {
 const m=JSON.parse(line);
 if(m.method==='initialize') result(m.id,{userAgent:'eng01i-synthetic',platformFamily:'unix',platformOs:'test',codexHome:'/synthetic-private'});
 else if(m.method==='thread/start') { notify('thread/started',{thread:{id:'thread'}}); result(m.id,{thread:{id:'thread'},model:m.params.model,approvalPolicy:'untrusted',sandbox:{type:'workspaceWrite',writableRoots:[process.cwd()],networkAccess:false,excludeTmpdirEnvVar:true,excludeSlashTmp:true}}); }
 else if(m.method==='turn/start') { result(m.id,{turn:turn('inProgress',[])}); setTimeout(()=>{notify('item/started',{threadId:'thread',turnId:'turn',item:file});send({id:'approval',method:'item/fileChange/requestApproval',params:{threadId:'thread',turnId:'turn',itemId:'patch',startedAtMs:1}});},5); }
 else if(m.id==='approval') {
  if(m.result?.decision!=='accept') process.exit(3);
  await writeFile('calculator.mjs','export const add=(a,b)=>a'+(mode==='wrong'?'-':'+')+'b;\nexport const subtract=(a,b)=>a-b;\n');
  if(mode==='extra') await writeFile('extra.txt','unsupported');
  if(mode==='eof') process.exit(0);
  const done={...file,status:'completed'}; notify('item/completed',{threadId:'thread',turnId:'turn',completedAtMs:1,item:done});
  notify('item/completed',{threadId:'thread',turnId:'turn',completedAtMs:1,item:final}); notify('turn/completed',{threadId:'thread',turn:turn(mode==='failed'?'failed':'completed',[done,final])});
 }
}
`;
const cleanup: (() => Promise<void>)[] = [];
const facts: unknown[] = [];
let pgFixture: import('../../../../docs/evidence/eng01i/pg/fixture.js').NativeHostCenter | undefined;
afterEach(async () => {
  try { for (const close of cleanup.splice(0).reverse()) await close(); }
  catch (error) { pgFixture?.errors.push('case-cleanup-unknown'); throw error; }
  if (process.env.FLOW_ENG01I_LOCAL_FACTS) await writeFile(process.env.FLOW_ENG01I_LOCAL_FACTS, JSON.stringify(facts));
});
async function setup(mode = 'success', closeMode = 'revoked') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'flow-eng01i-local-'))), identity = await lstat(root);
  await pgFixture?.checkpoint('workspace-reserved', { root, dev: identity.dev, ino: identity.ino });
  const project = await createSyntheticProject(root, 'native-host-project', { 'calculator.mjs': source.replace('a+b', 'a-b') });
  const script = join(root, 'peer.mjs'); await writeFile(script, peer);
  const peers: CodexTransport[] = [], events: RunnerEventData[] = [], controller = new AbortController();
  const counts = { opens: 0, closes: 0, snapshots: 0, releases: 0 }, workspaces: EngineeringWorkspace[] = [];
  let changedDuringCapture = false, failRelease = false;
  const wrapped = { ...project, async acquire() {
    const workspace = await project.acquire(); workspaces.push(workspace);
    return { ...workspace, async snapshot() { counts.snapshots++; if (changedDuringCapture && counts.snapshots === 2) await writeFile(join(workspace.directory, 'calculator.mjs'), source.replace('a+b', 'a-b')); return workspace.snapshot(); },
      async release() { counts.releases++; if (failRelease) throw Error('Unknown release'); await workspace.release(); } };
  } };
  const configuration: NativeEngineeringProfileConfiguration = { protocol: 'flow.engineering-profile.v2', harness: 'codex', adapterVersion: 'engineering-codex-1', purpose: 'engineering-native', recipe: 'calculator-arithmetic-v1',
    project: { id: project.id, baseCommit: project.baseCommit }, checker: { id: 'calculator-arithmetic', version: '1', sourcePolicy: 'flow.calculator-source.v1' }, model: 'gpt-6-astra',
    authority: { policy: 'calculator-file-only-v1', qualificationDigest: 'a'.repeat(64) }, limits: { writerTimeoutMs: 1000 } };
  const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: digest(nativeEngineeringProfileConfigurationJson(configuration)) };
  const authority: NativeWriteAuthority = {
    async open(binding, signal) {
      counts.opens++;
      return { binding, policy: 'calculator-file-only-v1', modelAssurance: 'locked-no-fallback', createTransport(options) {
        const transport = createCodexTransport({ spawn: { executable: process.execPath, args: [script, mode], cwd: options.workingDirectory, environment: { LANG: 'C' } },
          initialize: { clientInfo: { name: 'eng01i-owned-peer', title: null, version: '1' }, capabilities: null }, signal: AbortSignal.any([signal, options.signal]),
          limits: { initializeTimeoutMs: 500, requestTimeoutMs: 500, terminateMs: 50, killMs: 50 } }); peers.push(transport); return transport;
      } };
    },
    async close(binding) {
      counts.closes++; for (const transport of peers) expect((await transport.close()).child).toBe('confirmed-exited');
      if (closeMode === 'abort') controller.abort();
      return { binding: closeMode === 'wrong' ? { ...binding, leaseId: randomUUID() } : binding, writeAccess: closeMode === 'unknown' ? 'unknown' : 'revoked' };
    },
  };
  const executionIdentity = { taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 3, runnerId: reference.runnerId };
  const context: HarnessContext = { executionIdentity, task: { title: 'Synthetic native engineering', prompt: 'Fix both arithmetic functions', harness: 'codex',
    engineering: { protocol: 'flow.engineering.v2', targetRunnerId: reference.runnerId, projectId: project.id, baseCommit: project.baseCommit, checker: configuration.checker, profile: reference } },
    workingDirectory: root, signal: controller.signal, async assertOwnership() {}, async emit(event) { events.push(event); }, async waitForDecision() { throw Error('Not a decision fixture'); } };
  cleanup.push(async () => {
    for (const transport of peers) expect((await transport.close()).child).toBe('confirmed-exited');
    // Extra test knowledge: all delegated writers were these fixed owned peers. Production never uses this cleanup permission.
    for (const workspace of workspaces) await workspace.release();
    await pgFixture?.checkpoint('before-workspace-cleanup', { root, dev: identity.dev, ino: identity.ino, peers: peers.length, peersClosed: true, counts });
    await project.dispose(); const after = await lstat(root); expect([after.dev, after.ino]).toEqual([identity.dev, identity.ino]); await rm(root, { recursive: true });
    facts.push({ mode, closeMode, peers: peers.length, peersClosed: true, rootRemoved: root, counts });
  });
  return { project, configuration, reference, authority, context, events, counts, workspaces, root,
    bind: (profile: ExecutionProfileReference) => createNativeEngineeringAdapter({ project: wrapped, configuration, reference: profile, authority }),
    adapter: createNativeEngineeringAdapter({ project: wrapped, configuration, reference, authority }),
    changeDuringCapture() { changedDuringCapture = true; }, failRelease() { failRelease = true; } };
}

it('rejects absent authority, false configuration digest and different project before writer creation', async () => {
  const api = await setup();
  expect(() => createNativeEngineeringAdapter({ ...api, authority: undefined as never })).toThrow();
  expect(() => createNativeEngineeringAdapter({ ...api, reference: { ...api.reference, configDigest: 'b'.repeat(64) } })).toThrow();
  expect(() => createNativeEngineeringAdapter({ ...api, project: { ...api.project, id: 'other' } })).toThrow();
  expect(api.counts.opens).toBe(0);
});
it.each(['ordinary', 'pin', 'runner', 'checker'])('rejects %s assignment before acquire/open', async mode => {
  const api = await setup();
  if (mode === 'ordinary') delete api.context.task.engineering;
  else if (mode === 'pin') api.context.task.engineering!.profile = { ...api.reference, id: randomUUID() };
  else if (mode === 'runner') Object.defineProperty(api.context, 'executionIdentity', { value: { ...api.context.executionIdentity!, runnerId: randomUUID() } });
  else api.context.task.engineering!.checker = { ...api.configuration.checker, id: 'other' } as never;
  await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'settled' });
  expect(api.workspaces).toHaveLength(0); expect(api.counts.opens).toBe(0);
});
it('retains an acquired lease when acquisition acknowledgement is unknown without starting a writer', async () => {
  const api = await setup(); let acquisitions = 0;
  const adapter = createNativeEngineeringAdapter({ ...api, project: { ...api.project, async acquire() {
    acquisitions++; const workspace = await api.project.acquire(); api.workspaces.push(workspace);
    throw Error('Acquired lease but response is unknown.');
  } } });
  await expect(adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  await expect(adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  await expect(api.project.acquire()).rejects.toThrow();
  expect(acquisitions).toBe(1); expect(api.counts).toEqual({ opens: 0, closes: 0, snapshots: 0, releases: 0 });
  expect(api.events).toHaveLength(0);
});
it('publishes the exact shared native receipt only after writer revocation and a full stable capture', async () => {
  const api = await setup(); await api.adapter.run(api.context);
  const artifact = api.events.find(event => event.type === 'artifact')!;
  if (artifact.type !== 'artifact') throw Error('Missing artifact');
  const receipt = nativeEngineeringReceiptSchema.parse(JSON.parse(artifact.content));
  expect(receipt).toMatchObject({ result: 'passed', writer: { identity: api.context.executionIdentity, profile: api.reference, writeAccess: 'revoked' }, check: { writerSettlement: 'not-attested' } });
  expect(JSON.parse(calculatorReceiptJson(receipt.check))).toEqual(receipt.check);
  expect(api.events[1]).toMatchObject({ type: 'verification', artifactId: artifact.artifactId, artifactVersion: artifact.version, result: 'passed', inputDigest: digest(nativeEngineeringVerificationInput(artifact.version, receipt.intent)) });
  expect(api.events).toHaveLength(2); expect(api.counts).toEqual({ opens: 1, closes: 1, snapshots: 2, releases: 1 });
});
it.each(['wrong', 'extra'])('records a failed check for %s content after confirmed writer stop', async mode => {
  const api = await setup(mode); await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'settled' });
  expect(api.events[1]).toMatchObject({ type: 'verification', result: 'failed' }); expect(api.counts.releases).toBe(1);
});
it.each(['eof', 'unknown-close', 'wrong-close', 'abort'])('retains %s without checking or releasing', async mode => {
  const api = await setup(mode === 'eof' ? 'eof' : 'success', mode === 'unknown-close' ? 'unknown' : mode === 'wrong-close' ? 'wrong' : mode === 'abort' ? 'abort' : 'revoked');
  await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.counts.snapshots).toBe(0); expect(api.counts.releases).toBe(0); expect(api.events).toHaveLength(0);
  const restored = await restoreSyntheticProject(api.project.rootDirectory, { id: api.project.id, baseCommit: api.project.baseCommit });
  await expect(restored.acquire()).rejects.toThrow();
  await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' }); expect(api.counts.opens).toBe(1);
});
it.each(['artifact', 'verification'])('retains the lease and original event on a lost %s ACK', async kind => {
  const api = await setup(); api.context.emit = async event => { api.events.push(event); if (event.type === kind) throw Error('ACK unknown'); };
  await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' }); expect(api.counts.releases).toBe(0);
  const original = JSON.stringify(api.events); await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  expect(JSON.stringify(api.events)).toBe(original); expect(api.counts.opens).toBe(1);
});
it('retains an unstable full capture without publishing', async () => {
  const api = await setup(); api.changeDuringCapture(); await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.events).toHaveLength(0); expect(api.counts.releases).toBe(0);
});
it('releases a natively failed but revoked writer without checking or completing', async () => {
  const api = await setup('failed'); await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'settled' });
  expect(api.counts.snapshots).toBe(0); expect(api.counts.releases).toBe(1); expect(api.events).toHaveLength(0);
});
it('does not turn an unknown release into success after publication', async () => {
  const api = await setup(); api.failRelease(); await expect(api.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.events[1]).toMatchObject({ result: 'passed' }); expect(api.counts.releases).toBe(1);
  await expect(api.project.acquire()).rejects.toThrow();
});


describe.runIf(process.env.FLOW_ENG01I_PG === 'reviewed')('public native host PG journey', () => {
  let center: import('../../../../docs/evidence/eng01i/pg/fixture.js').NativeHostCenter;
  beforeAll(async () => {
    const { NativeHostCenter } = await import('../../../../docs/evidence/eng01i/pg/fixture.js');
    center = new NativeHostCenter(); pgFixture = center; await center.start();
  }, 30000);
  afterAll(async () => { try { await center?.close(); } finally { pgFixture = undefined; } }, 30000);
  async function eventually(predicate: () => Promise<boolean> | boolean) {
    const until = Date.now() + 8000;
    while (!await predicate()) { if (Date.now() >= until) throw Error('Public host behavior did not arrive.'); await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  async function checkpointCase(stage: string, detail: unknown, failed: boolean) {
    try { await center.checkpoint(stage, detail); }
    catch (error) { center.errors.push('case-checkpoint-unknown'); if (!failed) throw error; }
  }
  async function scenario() {
    const api = await setup();
    const registration = await center.owner.registerRunner({ name: 'ENG01I owned peer host', harnesses: ['codex'], capacity: 1 });
    const published = await center.runner(registration.token).publishNativeEngineeringProfile({ configuration: api.configuration });
    const reference = published.profile.reference;
    const intent = { ...api.context.task.engineering!, targetRunnerId: registration.runnerId, profile: reference };
    const task = (await center.owner.submit({ ...api.context.task, engineering: intent }, randomUUID())).task;
    await center.pool!.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
    const { runRunner } = await import('../runtime.js');
    const notices: import('../runtime.js').RunnerNotice[] = [];
    const runs: { controller: AbortController; promise: Promise<void> }[] = [];
    const directory = join(api.root, 'host');
    function start() {
      const controller = new AbortController();
      // A new adapter instance on every host run prevents an in-memory invoked Set masking a recovery bug.
      const promise = runRunner({ baseUrl: center.baseUrl, token: registration.token, workingDirectory: directory, adapters: [api.bind(reference)], signal: controller.signal,
        pollIntervalMs: 20, heartbeatIntervalMs: 100, requestTimeoutMs: 1500, onNotice: notice => notices.push(notice) });
      void promise.catch(() => undefined); const run = { controller, promise }; runs.push(run); return run;
    }
    cleanup.push(async () => {
      for (const run of runs) run.controller.abort();
      await Promise.all(runs.map(run => run.promise));
      await center.checkpoint('runtime-stopped', { taskId: task.id, starts: runs.length, counts: api.counts });
    });
    return { ...api, task, reference, start, notices, admission: async () => JSON.parse(await readFile(join(directory, digest(center.baseUrl), 'admission.json'), 'utf8')) };
  }
  it('accepts the stopped writer and complete checked snapshot through real runtime/outbox/public readback', async () => {
    const api = await scenario(), run = api.start(); let failed = false;
    try {
      await eventually(async () => (await center.owner.show(api.task.id)).status === 'succeeded');
      await eventually(async () => (await api.admission()).assignments.length === 0);
      run.controller.abort(); await run.promise;
      const task = await center.owner.show(api.task.id); expect(task.verificationStatus).toBe('passed');
      const entry = task.entries.find(entry => entry.kind === 'reference');
      if (entry?.kind !== 'reference') throw Error('Missing engineering artifact.');
      const detail = await center.owner.detail(entry.reference.id), receipt = nativeEngineeringReceiptSchema.parse(JSON.parse(detail.content));
      expect(receipt.writer.profile).toEqual(api.reference); expect(receipt.check.identity.taskId).toBe(api.task.id);
      expect(receipt.check.workspace.beforeDigest).toBe(receipt.check.workspace.afterDigest);
      expect(receipt.result).toBe('passed'); expect(api.counts).toEqual({ opens: 1, closes: 1, snapshots: 2, releases: 1 });
      expect((await center.owner.reconciliation(api.task.id)).reservationHeld).toBe(false);
      center.samples.push({ kind: 'success', taskId: api.task.id, status: task.status, verification: task.verificationStatus, counts: api.counts, bytes: Buffer.byteLength(detail.content) });
    } catch (error) { failed = true; center.samples.push({ kind: 'success-case-failure', name: error instanceof Error ? error.name : 'unknown' }); throw error; }
    finally { await checkpointCase('success-case-observation', { taskId: api.task.id, counts: api.counts }, failed); }
  }, 15000);
  it('retains the original committed artifact after lost ACK and restarts without another writer or claim', async () => {
    const api = await scenario(), realFetch = globalThis.fetch, bodies: string[] = [];
    let lost = false, failed = false;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const response = await realFetch(input, init);
      if (String(input) === `${center.baseUrl}/api/runner/events` && response.status === 200) {
        bodies.push(String(init?.body));
        if (!lost) { lost = true; await response.arrayBuffer(); throw new TypeError('Injected ACK loss after center commit.'); }
      }
      return response;
    });
    try {
      const run = api.start(); await eventually(() => api.notices.some(notice => notice.type === 'admission-blocked'));
      run.controller.abort(); await run.promise; expect(lost).toBe(true);
      const task = await center.owner.show(api.task.id); expect(task.verificationStatus).toBe('pending');
      const entry = task.entries.find(entry => entry.kind === 'reference');
      if (entry?.kind !== 'reference') throw Error('Committed artifact must remain readable.');
      const content = (await center.owner.detail(entry.reference.id)).content;
      expect(nativeEngineeringReceiptSchema.parse(JSON.parse(content)).result).toBe('passed');
      const count = api.notices.length, restarted = api.start();
      await eventually(() => api.notices.slice(count).some(notice => notice.type === 'admission-blocked'));
      restarted.controller.abort(); await restarted.promise;
      expect(bodies.length).toBeGreaterThanOrEqual(2); expect(new Set(bodies).size).toBe(1);
      expect((await api.admission()).assignments).toHaveLength(1);
      expect(api.counts).toEqual({ opens: 1, closes: 1, snapshots: 2, releases: 0 });
      await expect(api.project.acquire()).rejects.toThrow();
      expect((await center.pool!.query('SELECT count(*)::int AS n FROM flow.attempts WHERE task_id=$1', [api.task.id])).rows[0].n).toBe(1);
      expect((await center.pool!.query('SELECT count(*)::int AS n FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=$1', [api.task.id])).rows[0].n).toBe(1);
      expect((await center.owner.detail(entry.reference.id)).content).toBe(content);
      expect((await center.owner.show(api.task.id)).verificationStatus).toBe('pending');
      expect((await center.owner.reconciliation(api.task.id)).reservationHeld).toBe(true);
      center.samples.push({ kind: 'lost-ack-restart', taskId: api.task.id, counts: api.counts, identicalBatches: bodies.length, attempts: 1, committedEvents: 1, verification: 'pending' });
    } catch (error) { failed = true; center.samples.push({ kind: 'lost-ack-case-failure', name: error instanceof Error ? error.name : 'unknown' }); throw error; }
    finally { spy.mockRestore(); await checkpointCase('lost-ack-case-observation', { taskId: api.task.id, lost, counts: api.counts }, failed); }
  }, 15000);
});
