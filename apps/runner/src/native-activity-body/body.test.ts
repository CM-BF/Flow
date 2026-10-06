import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { FlowApiError } from '@flow/client';
import { eventBatchSchema, MAX_BATCH_BYTES, type EventBatch } from '@flow/contracts';
import type { NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import { ActivityBodySpool, BodyStorageError } from './spool.js';
import { bodyBatches, bodyDigest, planBody } from './plan.js';
import { EventOutbox, EventStorageError, replayPending } from '../outbox.js';

const ownership = {attemptId:'body-attempt',ownerVersion:3};
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0)) await rm(root,{recursive:true,force:true});});
async function setup() {
  const root=await mkdtemp(join(tmpdir(),'flow-chat05p01-')); roots.push(root);
  const path=join(root,'a'.repeat(64));await mkdir(path,{mode:0o700});
  return {root,path,spool:new ActivityBodySpool(path)};
}
function input(bytes=80_000, id='source'):NativeActivityBodyInput {
  const content=Buffer.from('x'.repeat(bytes));
  return {content,activity:{type:'native-activity',activityId:bodyDigest(Buffer.from(id)),nativeSessionId:'session',source:'claude.sdk.message',sourceMessageId:id,
    nativeMessageId:'message',blockIndex:0,parentToolUseId:null,kind:'tool',phase:'input-ready',toolUseId:`tool-${id}`,toolName:'Read',
    body:{content:content.subarray(0,65_536).toString(),mediaType:'text/plain',originalBytes:bytes,truncated:bytes>65_536,sha256:bodyDigest(content)}}};
}
function deferred() {let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
it('durably freezes a >2MiB material before first send and transmits every byte under the unchanged batch cap',async()=>{
  const {path,spool}=await setup(), material=input(2*1024*1024+123),batches:EventBatch[]=[];
  const outbox=new EventOutbox(path,ownership,async batch=>{
    const [job]=await spool.jobs();expect(job).toBeDefined();expect(await spool.content(job!)).toEqual(material.content);
    batches.push(batch);expect(Buffer.byteLength(JSON.stringify(batch))).toBeLessThanOrEqual(MAX_BATCH_BYTES);
    expect(batch.events.length).toBeLessThanOrEqual(8);
  });
  await outbox.publishActivityBody(material);
  const chunks=batches.flatMap(batch=>batch.events).filter(event=>event.type==='native-activity-body'&&event.action==='chunk');
  expect(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk.base64,'base64')))).toEqual(material.content);
  const [job]=await spool.jobs();expect(await spool.acknowledged(job!)).toBe(true);
  await expect(readFile(join(path,'activity-bodies',material.activity.activityId,'content.bin'))).rejects.toMatchObject({code:'ENOENT'});
  expect(batches.flatMap(batch=>batch.events).map(event=>event.sequence)).toEqual(Array.from({length:job!.eventIds.length},(_,i)=>i+1));
  console.log(JSON.stringify({case:'large-material',bytes:material.content.length,batches:batches.length,events:job!.eventIds.length,maxBatchBytes:Math.max(...batches.map(batch=>Buffer.byteLength(JSON.stringify(batch))))}));
});
it('recovers lost ACK with only the original frozen IDs, body and owner fence',async()=>{
  const {path,root,spool}=await setup(),material=input(),sent:EventBatch[]=[];
  const outbox=new EventOutbox(path,ownership,async batch=>{sent.push(batch);throw new Error('ACK lost after admission');});
  await expect(outbox.publishActivityBody(material)).rejects.toThrow('ACK lost');
  await expect(outbox.emit({type:'completed',outcome:'succeeded'})).rejects.toThrow('ACK lost');
  const [job]=await spool.jobs();const planned=[...bodyBatches(job!,await spool.content(job!))];const replayed:EventBatch[]=[];
  await replayPending(root,async batch=>{replayed.push(batch);},()=>{throw new Error('Unexpected retention');});
  expect(replayed[0]).toEqual(sent[0]);expect(replayed.slice(1)).toEqual(planned);
  expect(await spool.acknowledged(job!)).toBe(true);
  await replayPending(root,async()=>{throw new Error('Confirmed job resent');},()=>{});
});
it('keeps later completion behind the last material ACK',async()=>{
  const {path}=await setup(),entered=deferred(),release=deferred(),seen:string[]=[];
  const outbox=new EventOutbox(path,ownership,async batch=>{
    for(const event of batch.events) seen.push(event.type==='native-activity-body'?event.action:event.type);
    if(batch.events.some(event=>event.type==='native-activity-body'&&event.action==='seal')) {entered.resolve();await release.promise;}
  });
  const transfer=outbox.publishActivityBody(input());await entered.promise;
  const complete=outbox.emit({type:'completed',outcome:'succeeded'});
  expect(seen).not.toContain('completed');release.resolve();await transfer;await complete;
  expect(seen.slice(-2)).toEqual(['seal','completed']);
});
it('deduplicates a confirmed source and rejects changed bytes under that source identity',async()=>{
  const {path}=await setup();let reports=0;const outbox=new EventOutbox(path,ownership,async()=>{reports++;});
  await outbox.publishActivityBody(input());const original=reports;await outbox.publishActivityBody(input());expect(reports).toBe(original);
  await expect(outbox.publishActivityBody(input(80_001))).rejects.toBeInstanceOf(EventStorageError);expect(reports).toBe(original);
});
it('retains corrupt complete material and does not send a guessed recovery',async()=>{
  const {path,root,spool}=await setup();const material=input();await spool.stage(material,ownership,1);
  const file=join(path,'activity-bodies',material.activity.activityId,'content.bin');await writeFile(file,'corrupt');let reports=0;
  await expect(replayPending(root,async()=>{reports++;},()=>{})).rejects.toBeInstanceOf(EventStorageError);
  expect(reports).toBe(0);expect(await readFile(file,'utf8')).toBe('corrupt');
});
it('retains incomplete staging and symlink material as unknown',async()=>{
  const {path,spool}=await setup();const material=input();const job=await spool.stage(material,ownership,1);
  const file=join(path,'activity-bodies',material.activity.activityId,'content.bin');await rm(file);await symlink('/dev/null',file);
  await expect(spool.content(job)).rejects.toBeInstanceOf(BodyStorageError);expect((await lstat(file)).isSymbolicLink()).toBe(true);
  await mkdir(join(path,'activity-bodies','incomplete.tmp'));await expect(spool.jobs()).rejects.toBeInstanceOf(BodyStorageError);
});
it('does not recover a body across a rejected owner fence or erase its source',async()=>{
  const {root,path,spool}=await setup();const job=await spool.stage(input(),ownership,1);const retained:string[]=[];
  await replayPending(root,async()=>{throw new FlowApiError(409,'stale_owner','Expired');},id=>retained.push(id));
  expect(retained).toEqual([ownership.attemptId]);expect(await spool.content(job)).toHaveLength(80_000);
  await replayPending(root,async()=>{throw new Error('Rejected body resent');},id=>retained.push(id));expect(retained).toHaveLength(2);
  expect(await readdir(path)).toContain('uncertain-events.json');
});
it('rejects oversized body or mutated prefix before allocating durable job envelopes',async()=>{
  const {spool,path}=await setup();const huge=input(8*1024*1024+1);
  await expect(spool.stage(huge,ownership,1)).rejects.toBeInstanceOf(BodyStorageError);
  expect(await readdir(path)).toEqual([]);const mismatch=input();mismatch.activity.body!.content='wrong';
  expect(()=>planBody(mismatch,ownership,1)).toThrow(/prefix/);
});
it('keeps empty material explicit and still rejects an oversized legacy single batch',async()=>{
  const material=input(0),job=planBody(material,ownership,1),batches=[...bodyBatches(job,material.content)];
  expect(batches[0]!.events.map(e=>e.type==='native-activity-body'?e.action:e.type)).toEqual(['native-activity','open','seal']);
  expect(eventBatchSchema.safeParse({...ownership,events:Array.from({length:3},(_,i)=>({id:randomUUID(),sequence:i+1,type:'detail',title:'large',content:'x'.repeat(1_000_000),mediaType:'text/plain'}))}).success).toBe(false);
});
