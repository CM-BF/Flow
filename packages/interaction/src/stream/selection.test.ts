import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import type {AssistantStreamData,AssistantStreamPatch,AssistantStreamReference,AssistantStreamBlock,AssistantStreamPage,AssistantStreamSelectedPage,AssistantStreamSelectedPatchPage,AssistantStreamSelection} from '../../../contracts/src/assistant-stream.js';
import {assistantStreamIdentity} from '../../../contracts/src/assistant-stream.js';
import type {ConversationTurn} from '@flow/contracts';
import {ConversationStreamProjection,type StreamPort,type StreamHost} from './projection.js';
import {applySelectedPatchPage,emptyPatchState,seedSelectedBlock} from './patches.js';
import {projectBodySegments} from './presentation.js';
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const at='2026-10-07T00:00:00Z';
const scope={connectionId:'center',viewId:'view',conversationId:'chat',turnId:'turn',taskId:'task'};
const turn:ConversationTurn={id:'turn',conversationId:'chat',number:1,createdAt:at,user:{role:'user',text:'Hi'},task:{id:'task',title:'Chat',harness:'codex',status:'running',verificationStatus:'pending',createdAt:at,updatedAt:at},assistant:{state:'pending',reason:'execution-pending'},effective:{model:null,thinking:'unknown',tools:null,source:null},telemetry:{kind:'execution',taskId:'task',title:'Chat'}};
function block(channel:'text'|'reasoning-text',content:string,sequence:number,phase:AssistantStreamData['phase']='streaming') {
 const header={type:'assistant-stream' as const,source:'codex.app-server.stream' as const,nativeSessionId:'session',nativeTurnId:'native-turn',nativeMessageId:channel,channel,blockIndex:0};
 const data:AssistantStreamData={...header,streamId:digest(assistantStreamIdentity(header)),parentToolUseId:null,sourceMessageId:'source',revision:1,fromBytes:0,text:content,prefixDigest:digest(content),phase,reason:null,truncated:false};
 const patch:AssistantStreamPatch={...data,taskId:'task',attemptId:'attempt',eventId:'event'+sequence,sequence,createdAt:at};
 const {type,text,fromBytes,...rest}=data;
 const ref:AssistantStreamReference={...rest,id:data.streamId,taskId:'task',attemptId:'attempt',firstSequence:sequence,lastSequence:sequence,bytes:Buffer.byteLength(content),createdAt:at,updatedAt:at,status:phase};
 return {patch,ref,snapshot:{...ref,content} satisfies AssistantStreamBlock};
}
const host=(t=turn):StreamHost=>({turn:t,protocol:'patch-select-v1',capability:true,visible:true,online:true});
const page=(selection:AssistantStreamSelection,patches:AssistantStreamPatch[],after:number):AssistantStreamSelectedPatchPage=>({taskId:'task',attemptId:'attempt',protocol:'patch-select-v1',selection,patches,nextCursor:patches.at(-1)?.sequence??after,hasMore:false});
function fixture() {
 const reason=block('reasoning-text','公开🙂',1),text=block('text','Answer',3,'block-complete');
 const metadata:AssistantStreamSelectedPage={protocol:'patch-select-v1',taskId:'task',attemptId:'attempt',taskStatus:'running',taskUpdatedAt:at,blocks:[reason.ref,text.ref],nextCursor:null,finalMessageId:null,settlement:null};
 const calls:{selection:AssistantStreamSelection;after:number}[]=[];let gets=0;
 const port:StreamPort={async readMetadata(){return metadata;},async readPatches(){throw Error('Legacy read must not be used');},async readBlock(){gets++;return reason.snapshot;},async readSelectedPatches(options){calls.push({selection:{...options.selection},after:options.after});return page(options.selection,options.selection.kind==='text'&&options.after===0?[text.patch]:[],options.after);}};
 return {reason,text,metadata,port,calls,gets:()=>gets};
}
it('defaults to text only with complete reasoning metadata, and late open has its own cursor',async()=>{
 const f=fixture();const more={...f.reason.patch,text:'续',revision:2,fromBytes:Buffer.byteLength(f.reason.snapshot.content),sequence:4,eventId:'event4',phase:'block-complete' as const,prefixDigest:digest(f.reason.snapshot.content+'续')};
 const read=f.port.readSelectedPatches!;f.port.readSelectedPatches=async o=>o.selection.kind==='block'?(f.calls.push({selection:o.selection,after:o.after}),page(o.selection,o.after===1?[more]:[],o.after)):read(o,new AbortController().signal);
 const p=new ConversationStreamProjection(scope,f.port);
 try{p.updateHost(host());await p.refresh();expect(p.getSnapshot().error).toBeNull();expect(f.gets()).toBe(0);expect(f.calls).toEqual([{selection:{kind:'text'},after:0}]);expect(projectBodySegments(turn,p.getSnapshot()).map(x=>x.text)).toEqual(['Answer']);
 await p.openReasoning(f.reason.ref.id);expect(f.gets()).toBe(1);expect(f.calls.at(-1)?.after).toBe(1);expect(p.getSnapshot().selections?.[0]?.patches?.blocks[0]?.content).toBe('公开🙂续');expect(p.getSnapshot().patches?.cursor).toBe(3);
 p.closeReasoning(f.reason.ref.id);expect(p.getSnapshot().selections).toEqual([]);expect(projectBodySegments(turn,p.getSnapshot()).map(x=>x.text)).toEqual(['Answer']);
 }finally{p.dispose();}
});
it('refuses an old server ignoring capability before any selected/body read',async()=>{
 const f=fixture();const {protocol,...old}=f.metadata;f.port.readMetadata=async()=>old;
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();expect(p.getSnapshot().error).toContain('acknowledged');expect(f.calls).toEqual([]);await expect(p.openReasoning(f.reason.ref.id)).rejects.toThrow();expect(f.gets()).toBe(0);}finally{p.dispose();}
});
it('aborts a close flight, rejects late snapshot and starts a fresh explicit reopen',async()=>{
 const f=fixture();let release!:(b:AssistantStreamBlock)=>void;let reads=0,firstSignal:AbortSignal|undefined;
 f.port.readBlock=async(_id,signal)=>{reads++;if(reads===1){firstSignal=signal;return new Promise(resolve=>{release=resolve;});}return f.reason.snapshot;};
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();const first=p.openReasoning(f.reason.ref.id);p.closeReasoning(f.reason.ref.id);expect(firstSignal?.aborted).toBe(true);release(f.reason.snapshot);await first;expect(p.getSnapshot().selections).toEqual([]);await p.openReasoning(f.reason.ref.id);expect(reads).toBe(2);expect(p.getSnapshot().selections?.[0]?.patches?.blocks[0]?.content).toBe('公开🙂');}finally{p.dispose();}
});
it('rejects selection/source/digest forgery and verifies multibyte snapshot origin',async()=>{
 const f=fixture(),selection={kind:'text'} as const,state=emptyPatchState('task','attempt');
 await expect(applySelectedPatchPage(state,page(selection,[f.reason.patch],0),0,f.metadata.blocks,selection)).rejects.toThrow('selection');
 await expect(applySelectedPatchPage(state,page({kind:'block',streamId:f.reason.ref.id},[f.text.patch],0),0,f.metadata.blocks,selection)).rejects.toThrow('acknowledged');
 await expect(seedSelectedBlock({...f.reason.snapshot,content:'forged'},f.reason.ref)).rejects.toThrow('verification');
 const seeded=await seedSelectedBlock(f.reason.snapshot,f.reason.ref);expect(seeded.cursor).toBe(1);expect(seeded.totalBytes).toBe(Buffer.byteLength('公开🙂'));
});
it('does not let unopened retained reasoning prevent canonical text replacement',async()=>{
 const f=fixture();f.reason.ref.phase='block-complete';f.reason.ref.status='block-complete';f.metadata.finalMessageId='final';f.metadata.settlement={policy:'flow.assistant-draft',policyVersion:'1',correlation:'presentation-policy',unavailableReason:null,taskId:'task',attemptId:'attempt',nativeSessionId:'session',finalMessageId:'final',replaceStreamIds:[f.text.ref.id],retainStreamIds:[f.reason.ref.id]};
 const finalTurn:ConversationTurn={...turn,assistant:{state:'available',role:'assistant',messageId:'final',text:'Answer',truncated:false,contentRef:{id:'detail',title:'Reply',kind:'detail',taskId:'task',attemptId:'attempt'},source:{kind:'assistant-final',source:'claude.sdk.result',taskId:'task',attemptId:'attempt',nativeSessionId:'session',messageId:'final',eventId:'event',sourceMessageId:'source',contentDigest:digest('Answer'),detailId:'detail'}}};
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host(finalTurn));await p.refresh();expect(p.getSnapshot().error).toBeNull();expect(projectBodySegments(finalTurn,p.getSnapshot())).toMatchObject([{kind:'final',text:'Answer'}]);expect(projectBodySegments(finalTurn,p.getSnapshot())).toHaveLength(1);expect(f.gets()).toBe(0);f.port.readBlock=async()=>{throw Error('reasoning offline');};await p.openReasoning(f.reason.ref.id);expect(p.getSnapshot().selections?.[0]?.error).toContain('offline');expect(projectBodySegments(finalTurn,p.getSnapshot())).toHaveLength(1);}finally{p.dispose();}
});
it('rejects delayed disclosure after protocol/attempt lifetime invalidation',async()=>{
 const f=fixture();let release!:(b:AssistantStreamBlock)=>void;f.port.readBlock=async()=>new Promise(resolve=>{release=resolve;});
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();const open=p.openReasoning(f.reason.ref.id);p.updateHost({...host(),visible:false});release(f.reason.snapshot);await open;expect(p.getSnapshot().selections).toEqual([]);expect(p.getSnapshot().visible).toBe(false);}finally{p.dispose();}
});

it('retains sealed replay fingerprints across close/reopen',async()=>{
 const f=fixture();let content='续';
 f.port.readSelectedPatches=async o=>o.selection.kind==='text'?page(o.selection,o.after===0?[f.text.patch]:[],o.after):page(o.selection,[{...f.reason.patch,revision:2,fromBytes:f.reason.ref.bytes,sequence:4,eventId:'event4',text:content,prefixDigest:digest(f.reason.snapshot.content+content)}],o.after);
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();await p.openReasoning(f.reason.ref.id);expect(p.getSnapshot().selections?.[0]?.error).toBeNull();p.closeReasoning(f.reason.ref.id);content='改';await p.openReasoning(f.reason.ref.id);expect(p.getSnapshot().selections?.[0]?.error).toContain('changed across disclosure');}finally{p.dispose();}
});
it('bounds explicit selection count and body bytes while retaining complete metadata',async()=>{
 const f=fixture();const refs=Array.from({length:9},(_,i)=>{const ref={...f.reason.ref,nativeMessageId:'r'+i,sourceMessageId:'s'+i,firstSequence:i+1,lastSequence:i+1};const id=digest(assistantStreamIdentity(ref));return{...ref,id,streamId:id};});
 f.metadata.blocks=refs;f.port.readSelectedPatches=async o=>page(o.selection,[],o.after);f.port.readBlock=async id=>({...refs.find(r=>r.id===id)!,content:f.reason.snapshot.content});
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();for(const ref of refs.slice(0,8))await p.openReasoning(ref.id);await expect(p.openReasoning(refs[8]!.id)).rejects.toThrow('Too many');expect(p.getSnapshot().metadata?.blocks).toHaveLength(9);expect(p.getResidentBytes()).toBe(8*f.reason.ref.bytes);p.closeReasoning(refs[0]!.id);await p.openReasoning(refs[8]!.id);expect(p.getSnapshot().selections).toHaveLength(8);}finally{p.dispose();}
});

it('refreshes newer late-open metadata once and seeds only the verified snapshot cursor',async()=>{
 const f=fixture();let metadataReads=0;
 const newer={...f.reason.snapshot,revision:2,lastSequence:5,bytes:Buffer.byteLength('公开🙂新'),prefixDigest:digest('公开🙂新'),content:'公开🙂新'};
 f.port.readBlock=async()=>newer;
 f.port.readMetadata=async()=>{metadataReads++;return metadataReads===1?f.metadata:{...f.metadata,blocks:[newer,f.text.ref]};};
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();await p.openReasoning(f.reason.ref.id);expect(metadataReads).toBe(2);expect(p.getSnapshot().selections?.[0]?.error).toBeNull();expect(f.calls.at(-1)?.after).toBe(5);expect(p.getSnapshot().patches?.cursor).toBe(3);}finally{p.dispose();}
});

it('keeps text advancing twice while a reasoning read is pending and drops its closed late result',async()=>{
 const f=fixture();f.text.ref.phase='streaming';f.text.ref.status='streaming';f.text.patch.phase='streaming';
 let release!:(value:AssistantStreamBlock)=>void;let signal:AbortSignal|undefined;
 f.port.readBlock=async(_id,s)=>{signal=s;return new Promise(resolve=>{release=resolve;});};
 f.port.readSelectedPatches=async o=>{
  if(o.selection.kind==='block')throw Error('Pending GET cannot advance to patches');
  const revision=o.after===0?1:o.after===3?2:3,content='Answer'+'!'.repeat(revision-1);
  return page(o.selection,[{...f.text.patch,revision,sequence:revision*2+1,eventId:'event'+revision,text:revision===1?'Answer':'!',fromBytes:revision===1?0:Buffer.byteLength(content)-1,prefixDigest:digest(content)}],o.after);
 };
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();const open=p.openReasoning(f.reason.ref.id);const refresh=async()=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([p.refresh(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Text was blocked by optional reasoning')),200);})]);}finally{clearTimeout(timer);}};await refresh();expect(p.getSnapshot().patches?.cursor).toBe(5);await refresh();expect(p.getSnapshot().patches?.cursor).toBe(7);p.closeReasoning(f.reason.ref.id);await open;expect(signal?.aborted).toBe(true);release(f.reason.snapshot);await Promise.resolve();expect(p.getSnapshot().selections).toEqual([]);}finally{p.dispose();}
});
it('marks a retained disclosure deadline as a finite error instead of retrying hasMore',async()=>{
 const controls:AbortController[]=[];const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{const c=new AbortController();controls.push(c);return c.signal;});
 const f=fixture();let blockReads=0;
 f.port.readSelectedPatches=async o=>{if(o.selection.kind==='text')return page(o.selection,o.after===0?[f.text.patch]:[],o.after);blockReads++;if(blockReads>1)return new Promise(()=>{});return {...page(o.selection,[{...f.reason.patch,text:'续',revision:2,fromBytes:f.reason.ref.bytes,sequence:4,eventId:'event4',prefixDigest:digest(f.reason.snapshot.content+'续')}],o.after),hasMore:true};};
 const p=new ConversationStreamProjection(scope,f.port);try{p.updateHost(host());await p.refresh();await p.openReasoning(f.reason.ref.id);const second=p.openReasoning(f.reason.ref.id);controls.at(-1)!.abort(new DOMException('Disclosure deadline','TimeoutError'));await second;expect(p.getSnapshot().selections?.[0]?.error).toContain('deadline');await p.refresh();expect(blockReads).toBe(2);}finally{p.dispose();timeout.mockRestore();}
});
