import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, realpath, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
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
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  if (process.env.FLOW_ENG01I_LOCAL_FACTS) await writeFile(process.env.FLOW_ENG01I_LOCAL_FACTS, JSON.stringify(facts));
});
async function setup(mode = 'success', closeMode = 'revoked') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'flow-eng01i-local-'))), identity = await lstat(root);
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
    await project.dispose(); const after = await lstat(root); expect([after.dev, after.ino]).toEqual([identity.dev, identity.ino]); await rm(root, { recursive: true });
    facts.push({ mode, closeMode, peers: peers.length, peersClosed: true, rootRemoved: root, counts });
  });
  return { project, configuration, reference, authority, context, events, counts, workspaces,
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
