import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { ConversationTurn, AssistantStreamPage, AssistantStreamPatchPage } from '@flow/contracts';
import { ConversationStreamProjection, type StreamHost } from './projection.js';
import { projectBodySegments } from './presentation.js';
import { CodexAssistantStream } from '../../../../apps/runner/src/native-harness/codex/stream.js';
import { applyPatchPage, emptyPatchState, readStreamMetadata, validateMetadataPartition } from './patches.js';
it('decodes public Codex patches with their channel and rejects stale/source/turn forgery', async () => {
  const stream = new CodexAssistantStream(), value={kind:'reasoning-summary' as const,threadId:'thread',turnId:'turn',itemId:'item',index:0,delta:'公开🙂'};
  const first=stream.accept(value)[0]!, last=stream.accept({...value,delta:'',completedText:value.delta})[0]!;
  const {type,text,fromBytes,...header}=last;
  const ref={...header,id:last.streamId,taskId:'task',attemptId:'attempt',firstSequence:1,lastSequence:2,bytes:Buffer.byteLength(value.delta),createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',status:'block-complete'};
  const metadata=await readStreamMetadata({taskId:'task',attemptId:'attempt',taskStatus:'running',taskUpdatedAt:ref.updatedAt,blocks:[ref],nextCursor:null,finalMessageId:null,settlement:null},'task');
  validateMetadataPartition(metadata);
  const patches=[first,last].map((p,i)=>({...p,taskId:'task',attemptId:'attempt',eventId:'event'+i,sequence:i+1,createdAt:ref.createdAt}));
  const page={taskId:'task',attemptId:'attempt',patches,nextCursor:2,hasMore:false};
  const state=(await applyPatchPage(emptyPatchState('task','attempt'),page,0,metadata.blocks)).state;
  expect(state.blocks[0]).toMatchObject({content:value.delta,channel:'reasoning-summary',nativeTurnId:'turn'});
  expect(state.blocks[0]!.prefixDigest).toBe(createHash('sha256').update(value.delta).digest('hex'));
  for(const delta of [{attemptId:'old'},{source:'claude.sdk.stream'},{nativeTurnId:'foreign'},{channel:'text'}])
    await expect(applyPatchPage(emptyPatchState('task','attempt'),{...page,patches:[{...patches[0],...delta},patches[1]]},0,metadata.blocks)).rejects.toThrow();
});

const scope = {connectionId:'center',viewId:'view',conversationId:'conversation',turnId:'turn',taskId:'task'};
const at='2026-10-07T00:00:00Z';
const turn: ConversationTurn = {id:'turn',conversationId:'conversation',number:1,createdAt:at,user:{role:'user',text:'Fixture'},
  task:{id:'task',title:'Fixture',harness:'codex',status:'running',verificationStatus:'pending',createdAt:at,updatedAt:at},
  assistant:{state:'pending',reason:'execution-pending'},effective:{model:null,thinking:'unknown',tools:null,source:null},telemetry:{kind:'execution',taskId:'task',title:'Fixture'}};
async function fixturePages() {
  const stream=new CodexAssistantStream(), delta={kind:'reasoning-summary' as const,threadId:'thread',turnId:'native-turn',itemId:'reasoning',index:0,delta:'公开摘要🙂'};
  const raw=[...stream.accept(delta),...stream.accept({...delta,delta:'',completedText:delta.delta})];
  const {type,text,fromBytes,...header}=raw.at(-1)!;
  const metadata=await readStreamMetadata({taskId:'task',attemptId:'attempt',taskStatus:'running',taskUpdatedAt:at,blocks:[{...header,id:header.streamId,taskId:'task',attemptId:'attempt',firstSequence:1,lastSequence:2,bytes:Buffer.byteLength(delta.delta),createdAt:at,updatedAt:at,status:'block-complete'}],nextCursor:null,finalMessageId:null,settlement:null},'task');
  const page:AssistantStreamPatchPage={taskId:'task',attemptId:'attempt',patches:raw.map((p,i)=>({...p,taskId:'task',attemptId:'attempt',eventId:'event'+i,sequence:i+1,createdAt:at})),nextCursor:2,hasMore:false};
  return {metadata,page};
}
const host=(protocol:StreamHost['protocol']):StreamHost=>({turn,protocol,capability:true,visible:true,online:true});
it('enables the actual v2 Host and preserves published reasoning as a separate body segment', async () => {
  const {metadata,page}=await fixturePages(); let metadataCalls=0,patchCalls=0;
  const projection=new ConversationStreamProjection(scope,{async readMetadata(){metadataCalls++;return metadata;},async readPatches(){patchCalls++;return page;}});
  try {
    projection.updateHost(host('patch-v2'));await projection.refresh();
    expect(projection.getSnapshot()).toMatchObject({enabled:true,error:null,hasMore:false});
    expect(projectBodySegments(turn,projection.getSnapshot())).toMatchObject([{source:'codex.app-server.stream',channel:'reasoning-summary',text:'公开摘要🙂'}]);
    expect([metadataCalls,patchCalls]).toEqual([1,1]);
    projection.updateHost({...host('patch-v2'),protocol:'patch-v3' as 'patch-v2'});
    expect(projection.getSnapshot()).toMatchObject({enabled:false,metadata:null,patches:null});
  } finally {projection.dispose();}
});
it('keeps legacy Host opt-in but rejects a Codex page on v1 without reading its patches', async () => {
  const {metadata,page}=await fixturePages();let patchCalls=0;
  const projection=new ConversationStreamProjection(scope,{async readMetadata(){return metadata;},async readPatches(){patchCalls++;return page;}});
  try {projection.updateHost(host('patch-v1'));await projection.refresh();expect(projection.getSnapshot().enabled).toBe(true);
    expect(projection.getSnapshot().error).toContain('negotiated protocol');expect(projection.getSnapshot().patches).toBeNull();expect(patchCalls).toBe(0);
  } finally {projection.dispose();}
});
it('invalidates an in-flight v2 response before a Host protocol downgrade', async () => {
  const {metadata,page}=await fixturePages();let release!:(page:AssistantStreamPage)=>void,reads=0,patchCalls=0;
  const waiting=new Promise<AssistantStreamPage>(resolve=>{release=resolve;});
  const empty={...metadata,blocks:[],attemptId:null};
  const projection=new ConversationStreamProjection(scope,{async readMetadata(){return ++reads===1?waiting:empty;},async readPatches(){patchCalls++;return page;}});
  try {
    projection.updateHost(host('patch-v2'));const first=projection.refresh();
    projection.updateHost(host('patch-v1'));await projection.refresh();release(metadata);await first;
    expect(reads).toBe(2);expect(patchCalls).toBe(0);expect(projection.getSnapshot()).toMatchObject({enabled:true,error:null,metadata:{blocks:[],attemptId:null},patches:null});
  } finally {release(metadata);projection.dispose();}
});
