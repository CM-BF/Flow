import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { createCodexTransport } from '../codex/index.js';
import type { CodexTransport } from '../codex/types.js';
import { createCodexEngineeringWriter, type NativeWriteAuthority, type NativeWriteBinding } from './native-writer.js';
import { createSyntheticProject } from './workspace.js';
import { executeEngineeringWriter } from './writer.js';
import { captureCalculatorWorkspace } from './calculator-capture.js';

// Self-owned Node protocol peer, not Codex/model execution. Only this fixed peer writes the synthetic file.
const peerCode = String.raw`
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
const mode=process.argv[2], threadId='thread', turnId='turn';
const send=x=>process.stdout.write(JSON.stringify(x)+'\n'), result=(id,value)=>send({id,result:value});
const notify=(method,params)=>send({method,params});
const final={type:'agentMessage',id:'final',text:'File updated',phase:'final_answer',delivery:null,questions:null};
const file={type:'fileChange',id:'patch',status:'inProgress',changes:[{path:'calculator.mjs',kind:{type:'update',move_path:null},diff:'-a-b\n+a+b'}]};
const turn=(status,items)=>({id:turnId,status,items,itemsView:'full',error:status==='failed'?{}:null});
for await (const line of createInterface({input:process.stdin})) {
 const m=JSON.parse(line);
 if(m.method==='initialize') result(m.id,{userAgent:'eng01g-synthetic',platformFamily:'unix',platformOs:'test',codexHome:'/synthetic-private'});
 else if(m.method==='initialized') {}
 else if(m.method==='thread/start') {
  notify('thread/started',{thread:{id:threadId}});
  result(m.id,{thread:{id:threadId},model:mode==='wrong-model'?'unknown':m.params.model,approvalPolicy:'untrusted',sandbox:{type:'workspaceWrite',writableRoots:[process.cwd()],networkAccess:false,excludeTmpdirEnvVar:true,excludeSlashTmp:true}});
 } else if(m.method==='turn/start') {
  result(m.id,{turn:turn('inProgress',[])});
  setTimeout(()=>{
   if(mode==='reroute') { notify('model/rerouted',{threadId,turnId,fromModel:m.params.model,toModel:'unknown'});return; }
   notify('item/started',{threadId,turnId,item:file});
   send({id:'approval',method:mode==='command'?'item/commandExecution/requestApproval':'item/fileChange/requestApproval',params:{threadId:mode==='wrong-thread'?'other':threadId,turnId,itemId:'patch',startedAtMs:1}});
  },10);
 } else if(m.id==='approval') {
  if(m.result?.decision!=='accept') { notify('item/completed',{threadId,turnId,completedAtMs:1,item:final});notify('turn/completed',{threadId,turn:turn('completed',[final])});continue; }
  await writeFile('calculator.mjs','export const add = (a, b) => a + b;\nexport const subtract = (a, b) => a - b;\n');
  if(mode==='eof') process.exit(0);
  if(mode==='hang') continue;
  const done={...file,status:'completed'};
  if(mode==='changed') done.changes=[{...file.changes[0],diff:'Changed after approval'}];
  if(mode!=='incomplete') notify('item/completed',{threadId,turnId,completedAtMs:1,item:done});
  notify('item/completed',{threadId,turnId,completedAtMs:1,item:final});
  const items=mode==='incomplete'?[final]:[done,final];
  if(mode==='terminal-tool') items.push({type:'commandExecution',id:'hidden'});
  notify('turn/completed',{threadId,turn:turn(mode==='failed'?'failed':'completed',items)});
 }
}
`;
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const identity = { taskId: 'assigned-task', attemptId: 'assigned-attempt', runnerId: 'assigned-runner', ownerVersion: 3 };
function context(signal = new AbortController().signal) { return { executionIdentity: { ...identity }, signal, async assertOwnership() {} }; }
async function setup(mode = 'success', closeMode = 'revoked', owned?: { directory: string; leaseId: string; baseCommit: string }) {
  const directory = owned?.directory ?? await realpath(await mkdtemp(join(tmpdir(), 'flow-eng01g-writer-')));
  const script = join(await mkdtemp(join(tmpdir(), 'flow-eng01g-peer-')), 'peer.mjs'); await writeFile(script, peerCode);
  const calls: string[] = []; const peers: CodexTransport[] = [], grants: NativeWriteBinding[] = []; let opens = 0, closes = 0, factories = 0;
  cleanup.push(async () => { for (const peer of peers) expect((await peer.close()).child).toBe('confirmed-exited'); await rm(join(script, '..'), { recursive: true, force: true }); if (!owned) await rm(directory, { recursive: true, force: true }); });
  const authority: NativeWriteAuthority = {
    async open(binding, signal) {
      opens++; grants.push(binding);
      if (mode === 'open-fails') throw Error('Private authority diagnostic');
      return { binding: mode === 'bad-grant' ? { ...binding, leaseId: randomUUID() } : binding, policy: 'calculator-file-only-v1', modelAssurance: 'locked-no-fallback',
        createTransport(options) {
          factories++;
          const peer = createCodexTransport({ spawn: { executable: process.execPath, args: [script, mode], cwd: options.workingDirectory, environment: { LANG: 'C' } },
            initialize: { clientInfo: { name: 'eng01g-owned-peer', title: null, version: '1' }, capabilities: null }, signal: AbortSignal.any([signal, options.signal]),
            limits: { initializeTimeoutMs: 1000, requestTimeoutMs: 500, terminateMs: 50, killMs: 50 } }); peers.push(peer); return { ...peer, request(method, params, options) { calls.push(method); return peer.request(method, params, options); } };
        } };
    },
    async close(binding) {
      closes++; for (const peer of peers) await peer.close();
      if (closeMode === 'throw') throw Error('Private close diagnostic');
      return { binding: closeMode === 'wrong' ? { ...binding, identity: { ...binding.identity, attemptId: 'other' } } : binding,
        writeAccess: closeMode === 'unknown' ? 'unknown' : 'revoked' };
    },
  };
  const ctx = context(); const writer = createCodexEngineeringWriter(ctx, 'gpt-6-astra', authority, mode === 'hang' ? 300 : 2000);
  const input = { directory, leaseId: owned?.leaseId ?? randomUUID(), baseCommit: owned?.baseCommit ?? 'a'.repeat(40), prompt: 'Fix the calculator using the allowed file tool', signal: ctx.signal, async assertOwnership() {} };
  return { writer, input, ctx, directory, grants, calls, counts: () => ({ opens, closes, factories }), peers };
}
it('refuses missing authority, missing assignment and unknown models before any transport can exist', () => {
  expect(() => createCodexEngineeringWriter(context(), 'gpt-6-astra')).toThrow(/unavailable/);
  const authority = { async open() { throw Error('Must not open'); }, async close() { throw Error('Must not close'); } };
  expect(() => createCodexEngineeringWriter({ ...context(), executionIdentity: undefined }, 'gpt-6-astra', authority)).toThrow();
  expect(() => createCodexEngineeringWriter(context(), 'unknown' as any, authority)).toThrow();
});
it('composes the native-file consumer with the same full host snapshot and independent checker after injected revocation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-eng01g-git-'));
  const project = await createSyntheticProject(root, 'native-peer-project', { 'calculator.mjs': 'export const add = (a, b) => a - b;\nexport const subtract = (a, b) => a - b;\n' });
  const workspace = await project.acquire(); cleanup.push(async () => { await workspace.release(); await project.dispose(); await rm(root, { recursive: true, force: true }); });
  const api = await setup('success', 'revoked', { directory: workspace.directory, leaseId: workspace.leaseId, baseCommit: project.baseCommit });
  api.ctx.executionIdentity.taskId = 'caller-mutation';
  const outcome = await executeEngineeringWriter(api.writer.execute, api.input); expect(outcome).toEqual({ leaseId: workspace.leaseId, settlement: 'stopped', outcome: 'completed' });
  expect(api.grants[0]!.identity).toEqual(identity); expect(Object.isFrozen(api.grants[0]!.identity)).toBe(true);
  const capture = await captureCalculatorWorkspace(workspace, context());
  expect(capture).toMatchObject({ state: 'recorded', receipt: { writerSettlement: 'not-attested', identity, report: { result: 'passed' } } });
  expect(api.counts()).toEqual({ opens: 1, closes: 1, factories: 1 }); expect(await readFile(join(workspace.directory, 'calculator.mjs'), 'utf8')).toContain('a + b');
  await expect(project.acquire()).rejects.toThrow(); // Writer/capture do not release the host lease.
});
it.each(['unknown', 'wrong', 'throw'])('cannot convert a completed final and child exit into stopped when revocation is %s', async mode => {
  const api = await setup('success', mode); expect(await api.writer.execute(api.input)).toEqual({ leaseId: api.input.leaseId, settlement: 'unknown' });
  expect(api.counts().closes).toBe(1); expect(api.peers[0]!.snapshot().state).toBe('closed');
});
it.each(['wrong-model', 'wrong-thread', 'command', 'terminal-tool', 'changed', 'incomplete', 'reroute', 'eof', 'hang'])('preserves %s as unknown even with an injected revoked receipt', async mode => {
  const api = await setup(mode); expect(await api.writer.execute(api.input)).toEqual({ leaseId: api.input.leaseId, settlement: 'unknown' }); expect(api.counts().closes).toBe(1); expect(api.calls).toEqual(mode === 'wrong-model' ? ['thread/start'] : ['thread/start', 'turn/start']);
});
it.each(['open-fails', 'bad-grant'])('closes an ambiguous %s authority without creating a transport', async mode => {
  const api = await setup(mode); expect(await api.writer.execute(api.input)).toEqual({ leaseId: api.input.leaseId, settlement: 'unknown' }); expect(api.counts()).toEqual({ opens: 1, closes: 1, factories: 0 });
});
it('maps a native settled failure only after the separately injected whole-write revocation', async () => {
  const api = await setup('failed'); expect(await api.writer.execute(api.input)).toEqual({ leaseId: api.input.leaseId, settlement: 'stopped', outcome: 'failed' });
});
it('does not promote pre-dispatch ownership loss or cancellation', async () => {
  const api = await setup(); api.input.assertOwnership = async () => { throw Error('Lost'); };
  expect((await api.writer.execute(api.input)).settlement).toBe('unknown'); expect(api.counts()).toEqual({ opens: 0, closes: 1, factories: 0 });
});
it('bounds an unresponsive authority without claiming its pending work stopped', async () => {
  let closes = 0;
  const writer = createCodexEngineeringWriter(context(), 'gpt-6-astra', { open: () => new Promise(() => {}), close: () => { closes++; return new Promise(() => {}); } }, 15);
  const result = await writer.execute({ directory: '/unused', leaseId: randomUUID(), baseCommit: 'a'.repeat(40), prompt: 'Unused', signal: new AbortController().signal, async assertOwnership() {} });
  expect(result.settlement).toBe('unknown'); expect(closes).toBe(1);
});

it('bounds a stalled ownership check without opening or promoting a writer', async () => {
  let opens = 0, closes = 0;
  const ctx = { ...context(), assertOwnership: () => new Promise<void>(() => {}) };
  const writer = createCodexEngineeringWriter(ctx, 'gpt-6-astra', {
    async open() { opens++; throw Error('Must not open'); },
    async close(binding) { closes++; return { binding, writeAccess: 'revoked' }; },
  }, 15);
  expect((await writer.execute({ directory: '/unused', leaseId: randomUUID(), baseCommit: 'a'.repeat(40), prompt: 'Unused', signal: ctx.signal, async assertOwnership() {} })).settlement).toBe('unknown');
  expect(opens).toBe(0); expect(closes).toBe(1);
});

it('never reopens the same assignment writer after an unknown first invocation', async () => {
  let opens = 0, closes = 0;
  const writer = createCodexEngineeringWriter(context(), 'gpt-6-astra', {
    async open() { opens++; throw Error('Ambiguous open'); },
    async close(binding) { closes++; return { binding, writeAccess: 'unknown' }; },
  });
  const input = { directory: '/unused', leaseId: randomUUID(), baseCommit: 'a'.repeat(40), prompt: 'Unused', signal: new AbortController().signal, async assertOwnership() {} };
  expect((await writer.execute(input)).settlement).toBe('unknown');
  expect((await writer.execute(input)).settlement).toBe('unknown'); expect(opens).toBe(1); expect(closes).toBe(1);
});
