import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { conversationCreationSchema, conversationTurnSchema } from '/tmp/recovery01-request-bounds/packages/contracts/src/conversations.ts';
import { conversationQueueEnqueueSchema } from '/tmp/recovery01-request-bounds/packages/contracts/src/conversation-queue.ts';
import { steeringCommandSchema } from '/tmp/recovery01-request-bounds/packages/contracts/src/active-steering.ts';
import { attachmentNameSchema } from '/tmp/recovery01-request-bounds/packages/contracts/src/attachments.ts';
const C='\u0001', id=C.repeat(128), key='\\'.repeat(200), digest='a'.repeat(64);
const uuid=n=>`12345678-1234-4234-8234-${String(n).padStart(12,'0')}`;
const bytes=o=>Buffer.byteLength(JSON.stringify(o),'utf8'), hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const MAX=Number.MAX_SAFE_INTEGER, REV=2147483647;
const title='界'.repeat(166)+'"'.repeat(14);
const name='界'.repeat(128)+'"'.repeat(123)+'.txt'; attachmentNameSchema.parse(name);
const refsK=Array.from({length:4},(_,i)=>({projectId:id,sourceId:uuid(i+1),version:16,contentDigest:digest,locator:{kind:'utf8-bytes',start:260096,end:262144}}));
const refsA=Array.from({length:4},(_,i)=>({kind:'upload',projectId:id,resourceId:uuid(i+10),version:1,contentDigest:digest}));
const creation=conversationCreationSchema.parse({title:C.repeat(180),harness:'claude',executionProfile:{id:uuid(20),runnerId:uuid(21),configDigest:digest},projectId:id,requested:{model:C.repeat(180),thinking:'disabled',tools:'configured-readonly'}});
const phase=()=>({state:'prepared',everUnknown:false});
function materials(k,a){return [...Array.from({length:k},(_,index)=>({kind:'knowledge',index,title,currentVersion:16,verified:false})),...Array.from({length:a},(_,index)=>({kind:'attachment',index,localItemId:uuid(100+index),name,mediaType:'text/plain',byteLength:2048,createdAt:'2026-10-06T00:00:00.000Z',expiresAt:'2026-10-07T00:00:00.000Z',state:'ready',retained:false,verified:false}))];}
function envelope(kind,command,k=0,a=0){return {schemaVersion:1,recordId:uuid(30),namespaceId:uuid(31),viewKey:uuid(32),view:{originalRouteId:C.repeat(192),projectId:id,...(kind==='steer'?{conversationId:id,turnId:id}:{})},command,materials:materials(k,a),requestDigest:digest,checkpoint:{primary:phase(),...(kind==='create-turn'?{secondary:phase()}:{}),errorCode:null},recordVersion:MAX,createdAtMs:MAX,updatedAtMs:MAX};}
// Explicit wire objects occur once only. Display rows refer to the corresponding immutable array index.
const context=(k,a)=>({id,executionInputId:id,contextDigest:digest,executionInputDigest:digest,templateVersion:a?2:1,...(a?{order:'knowledge-then-attachments'}:{}),sources:Array.from({length:k},(_,index)=>({index,byteLength:2048,currentVersionAtFreeze:16,isCurrentAtFreeze:true})),...(a?{attachments:Array.from({length:a},(_,index)=>({index,name,mediaType:'text/plain',byteLength:2048}))}:{})});
const currentTurn={taskId:id,taskStatus:'cancel_requested',turnId:id,turnNumber:REV,queueItemId:id};
const item={id,conversationId:id,sequence:REV,state:'promoted',promoted:{taskId:id,turnId:id,turnNumber:REV}};
const ack={
 create:{conversationId:id,revision:0},
 turn:(k,a)=>({conversationId:id,turnId:id,taskId:id,number:REV,revision:REV,context:context(k,a)}),
 enqueue:(k,a)=>({conversationId:id,queueRevision:REV,item:{id,sequence:REV,state:'waiting'},context:context(k,a)}),
 cancelItem:{conversationId:id,queueRevision:REV,item,outcome:'already-promoted'},
 pause:{conversationId:id,queueRevision:REV,paused:true,currentTurn},
 resume:{conversationId:id,queueRevision:REV,paused:false,currentTurn,promoted:item},
 cancelTask:{taskId:id,status:'cancel_requested'},
 steer:{id,taskId:id,attemptId:id,ownerVersion:MAX,nativeSessionId:id,revision:REV,userMessageUuid:uuid(34),status:'observed-consumed',receiptRevision:REV,input:{bytes:16384,digest},createdAt:'2026-10-06T00:00:00.000Z',updatedAt:'2026-10-06T00:00:00.000Z'}
};
const ns={schemaVersion:1,namespaceId:uuid(31),baseUrl:'https://example.test/'+'p'.repeat(4096-'https://example.test/'.length),centerId:id,principalId:id,commandRefs:128,draftRefs:32};
assert.equal(Buffer.byteLength(ns.baseUrl),4096);
const manifest={schemaVersion:1,generation:MAX,totalChargedBytes:4194304,commandCount:128,draftCount:32,namespaceCount:160};
function slot(domain,entity,lane){return {schemaVersion:1,key:[uuid(31),domain,entity,lane],recordId:uuid(30),generation:MAX};}
const originalSlot=slot('draft',uuid(32),'create'); const boundSlot=slot('conversation',id,'turn');
const index={schemaVersion:1,recordId:uuid(30),namespaceId:uuid(31),kind:'command',initialRecordBytes:131072,initialAuxBytes:131072,reservedGrowthBytes:32768,recordVersion:MAX};
const summaries=[]; let largest=null;
for(let k=0;k<=4;k++){
 const a=4-k;
 const body=conversationTurnSchema.parse({expectedRevision:2147483646,text:C.repeat(16000),mode:'follow-up',knowledge:refsK.slice(0,k),attachments:refsA.slice(0,a)});
 const cmd={kind:'create-turn',create:{key,body:creation},turn:{key,body}};
 const initial=envelope('create-turn',cmd,k,a);
 const completed={...initial,checkpoint:{primary:{state:'acknowledged',everUnknown:true,ack:ack.create},secondary:{state:'acknowledged',everUnknown:true,ack:ack.turn(k,a)},errorCode:'checkpoint_unavailable'}};
 const initialAux=bytes(originalSlot)+bytes(index);
 const completedAux=bytes(originalSlot)+bytes(boundSlot)+bytes(index);
 const row={case:`create-turn-k${k}-a${a}`,initialRecordBytes:bytes(initial),initialAuxBytes:initialAux,initialWithAux:bytes(initial)+initialAux,initialWithAllNamespaceAndManifest:bytes(initial)+initialAux+bytes(ns)+bytes(manifest),checkpointRecordBytes:bytes(completed),growthIncludingBoundSlot:bytes(completed)+completedAux-bytes(initial)-initialAux,chargedWithReserveAndNamespace:bytes(initial)+initialAux+32768+bytes(ns)+bytes(manifest)};
 summaries.push(row); if(!largest||row.initialWithAllNamespaceAndManifest>largest.row.initialWithAllNamespaceAndManifest)largest={row,initial,completed};
 const queued=envelope('enqueue',{kind:'enqueue',conversationId:id,key,body:conversationQueueEnqueueSchema.parse({expectedQueueRevision:2147483646,text:C.repeat(16000),knowledge:refsK.slice(0,k),attachments:refsA.slice(0,a)})},k,a);
 summaries.push({case:`enqueue-k${k}-a${a}`,initialRecordBytes:bytes(queued),initialWithAux:bytes(queued)+bytes(slot('conversation',id,'enqueue'))+bytes(index),ackIdentityBytes:bytes(ack.enqueue(k,a))});
}
const steering=envelope('steer',{kind:'steer',taskId:id,key,body:steeringCommandSchema.parse({attemptId:id,ownerVersion:MAX,expectedRevision:REV,text:C.repeat(16384)})});
const cancelTask=envelope('cancel-task',{kind:'cancel-task',conversationId:id,taskId:id,key,body:{}});
summaries.push({case:'steer',initialRecordBytes:bytes(steering),initialWithAux:bytes(steering)+bytes(slot('task',id,'steer'))+bytes(index),ackIdentityBytes:bytes(ack.steer)});
summaries.push({case:'cancel-task',initialRecordBytes:bytes(cancelTask),originalTargetPreserved:cancelTask.command.taskId===id,bodyBytes:bytes(cancelTask.command.body),initialWithAux:bytes(cancelTask)+bytes(slot('task',id,'cancel'))+bytes(index),ackIdentityBytes:bytes(ack.cancelTask)});
for(const [kind,command,receipt,domain,lane] of [
 ['create-only',{kind:'create-only',create:{key,body:creation}},ack.create,'draft','create'],
 ['pause',{kind:'pause',conversationId:id,key,body:{expectedQueueRevision:2147483646}},ack.pause,'conversation','control'],
 ['resume',{kind:'resume',conversationId:id,key,body:{expectedQueueRevision:2147483646,expectedTaskId:id}},ack.resume,'conversation','control'],
 ['cancel-item',{kind:'cancel-item',conversationId:id,itemId:id,key,body:{expectedQueueRevision:2147483646}},ack.cancelItem,'queue-item','cancel'],
 ]) { const candidate=envelope(kind,command); summaries.push({case:kind,initialRecordBytes:bytes(candidate),initialWithAux:bytes(candidate)+bytes(slot(domain,id,lane))+bytes(index),ackIdentityBytes:bytes(receipt)}); }
const doubled=structuredClone(largest.initial);doubled.command.create.body=JSON.stringify(doubled.command.create.body);doubled.command.turn.body=JSON.stringify(doubled.command.turn.body);
const ackSizes=Object.fromEntries(Object.entries(ack).map(([k,v])=>[k,typeof v==='function'?Math.max(...Array.from({length:5},(_,i)=>bytes(v(i,4-i)))):bytes(v)]));
const sameBodyIdentity=hash(largest.initial.command.turn.body)===hash(JSON.parse(JSON.stringify(largest.initial)).command.turn.body);assert(sameBodyIdentity);
// Conservative structural ceiling for display and timestamps. This is deliberately NOT a legal public DTO sample.
const ceiling=structuredClone(largest.initial);
ceiling.materials=Array.from({length:4},(_,index)=>({kind:'attachment',index,localItemId:uuid(100+index),name:C.repeat(255),title:C.repeat(180),mediaType:'text/plain',byteLength:8192,createdAt:C.repeat(80),expiresAt:C.repeat(80),state:'expired',retained:true,verified:false}));
ceiling.command.create.key=C.repeat(200);ceiling.command.turn.key=C.repeat(200);
const structural=bytes(ceiling)+bytes(originalSlot)+bytes(index)+bytes(ns)+bytes(manifest);
const result={at:new Date().toISOString(),fixedBase:'cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd',runtime:process.version,kind:'pure-memory candidate-envelope design; not journal implementation or IDB/runtime proof',units:'UTF8(compact JSON.stringify)',samples:summaries,maxFullInitialIncludingAuxNamespaceManifest:largest.row,structuralOverestimateAllMetadataFields:structural,structuralOverestimateWarning:'Includes both title and name plus invalid control-character name/date/key maxima; upper-bound byte accounting only, not schema-valid admission.',ackIdentityBytes:ackSizes,namespaceBytes:bytes(ns),manifestBytes:bytes(manifest),indexBytes:bytes(index),originalSlotBytes:bytes(originalSlot),boundSlotBytes:bytes(boundSlot),maxStructuredBodyObjectBytes:bytes(largest.initial),sameEnvelopeWithJSONBodyStringsBytes:bytes(doubled),roundTripPreservesBodyIdentity:sameBodyIdentity,limits:{initialUnitCandidate:131072,growthReservation:32768,global:4194304,maxDrafts:32,maxLogicalCommands:128},nonProofs:['No IndexedDB storage, transaction, quota, durability, CAS or runtime test','No full public decoder ACK samples executed; identity projections are proposed after existing validation','Request maxima are schema-valid but not evidence of simultaneous server admission','4096B base URL bound is a proposed local persistence policy, not public HTTP limit','Namespace center/principal fields conservatively id128; final center DTO integration pending','CreatedAt/updatedAt raw80 bound is journal policy where current Queue/Steer validation lacks such bound'],sideEffects:{http:0,pg:0,browser:0,provider:0,projectWrites:0,installs:0}};
for(const [n,v]of Object.entries({'results.json':result,'max-initial-sample.json':largest.initial,'max-checkpoint-sample.json':largest.completed,'namespace-sample.json':ns}))fs.writeFileSync(new URL(n,import.meta.url),JSON.stringify(v,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
