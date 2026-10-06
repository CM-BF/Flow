import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { conversationCreationSchema, conversationTurnSchema } from './packages/contracts/src/conversations.ts';
import { conversationQueueEnqueueSchema, conversationQueueCancelSchema, conversationQueuePauseSchema, conversationQueueResumeSchema } from './packages/contracts/src/conversation-queue.ts';
import { steeringCommandSchema } from './packages/contracts/src/active-steering.ts';
import { conversationContextTemplate } from './packages/contracts/src/conversation-context.ts';
const C = '\u0001'; // valid, non-whitespace, 1 UTF8 byte and 6 bytes in JSON.stringify
const id = C.repeat(128), key = '\\'.repeat(200), digest = 'a'.repeat(64);
const uuid = n => `12345678-1234-4234-8234-${String(n).padStart(12,'0')}`;
const knowledge = Array.from({length:4},(_,i)=>({projectId:id,sourceId:uuid(i+1),version:16,contentDigest:digest,locator:{kind:'utf8-bytes',start:260096,end:262144}}));
const attachments = Array.from({length:4},(_,i)=>({kind:'upload',projectId:id,resourceId:uuid(i+10),version:1,contentDigest:digest}));
const creation={title:C.repeat(180),harness:'claude',executionProfile:{id:uuid(20),runnerId:uuid(21),configDigest:digest},projectId:id,requested:{model:C.repeat(180),thinking:'disabled',tools:'configured-readonly'}};
const results=[];
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
function check(name,schema,body,note){const parsed=schema.parse(body);assert.deepEqual(parsed,body);const raw=JSON.stringify(body);const result={name,utf8JSONBytes:bytes(body),sha256:createHash('sha256').update(raw).digest('hex'),schemaValid:true,note};results.push(result);return body;}
check('create-schema-upper',conversationCreationSchema,creation,'Schema-valid upper bound; control-char model cannot match supported catalog model, so not claimed server-admissible.');
const actualModelCreation={...creation,requested:{...creation.requested,model:'m'.repeat(180)}};
check('create-catalog-model-upper',conversationCreationSchema,actualModelCreation,'Model constrained to actual ASCII catalog syntax; existence/profile/project authorization not asserted.');
const turn=(k,a)=>({expectedRevision:2147483646,text:C.repeat(16000),mode:'follow-up',knowledge:knowledge.slice(0,k),attachments:attachments.slice(0,a)});
const queue=(k,a)=>({expectedQueueRevision:2147483646,knowledge:knowledge.slice(0,k),attachments:attachments.slice(0,a),text:C.repeat(16000)});
for(let k=0;k<=4;k++){const a=4-k;conversationContextTemplate(knowledge.slice(0,k),attachments.slice(0,a));check(`turn-joint4-k${k}-a${a}`,conversationTurnSchema,turn(k,a),'Joint reference count valid, JSON ceiling conservative: execution input + material text/metadata may reject max text before admission.');check(`enqueue-joint4-k${k}-a${a}`,conversationQueueEnqueueSchema,queue(k,a),'Same conservative ceiling, queue raw text also exactly16000 UTF8 bytes.');}
check('turn-dto8-upper',conversationTurnSchema,turn(4,4),'DTO parser accepts4+4 but joint context helper rejects; NOT a valid combined admission. Included as defensive parser-only ceiling.');
assert.throws(()=>conversationContextTemplate(knowledge,attachments));
check('enqueue-dto8-upper',conversationQueueEnqueueSchema,queue(4,4),'Parser-only ceiling; not admitted by joint4 limit.');
check('queue-cancel-item',conversationQueueCancelSchema,{expectedQueueRevision:2147483646},'Route also needs immutable conversationId/itemId and original key.');
check('queue-pause',conversationQueuePauseSchema,{expectedQueueRevision:2147483646},'Stop flow requires separate cancel-task original key/target, not reuse this key.');
check('queue-resume',conversationQueueResumeSchema,{expectedQueueRevision:2147483646,expectedTaskId:id},'Freeze expectedTaskId, including null shape, never replace by current task when retrying.');
check('steer',steeringCommandSchema,{attemptId:id,ownerVersion:Number.MAX_SAFE_INTEGER,expectedRevision:2147483647,text:C.repeat(16384)},'Public zod int() uses safe-integer maximum; Web admission narrows ownerVersion to2147483647. No task/attempt authority claimed.');
results.push({name:'cancel-task',utf8JSONBytes:bytes({}),note:'FlowClient.cancel sends {}, but immutable target taskId and original key must persist.'});
const maxTurn=turn(4,0), maxQueue=queue(4,0);
const twoStep={schemaVersion:1,logicalId:id,kind:'create-then-turn',connectionScope:id,viewKey:id,conversationId:null,creationKey:key,turnKey:key,creation,request:maxTurn,state:'unknown',everUnknown:true};
const twoStepRaw={...twoStep,creation:JSON.stringify(creation),request:JSON.stringify(maxTurn)};
const commandEnvelopes={
 createThenTurn_structuredBodies:bytes(twoStep),
 createThenTurn_jsonBodyStrings:bytes(twoStepRaw),
 createThenTurn_structured_afterBind:bytes({...twoStep,conversationId:id}),
 createThenTurn_jsonStrings_afterBind:bytes({...twoStepRaw,conversationId:id}),
 queueEnqueue_structured:bytes({schemaVersion:1,logicalId:id,connectionScope:id,viewKey:id,key,command:{kind:'enqueue',conversationId:id,input:maxQueue},state:'unknown',everUnknown:true}),
 cancelTask_structured:bytes({schemaVersion:1,logicalId:id,connectionScope:id,viewKey:id,key,command:{kind:'cancel-task',conversationId:id,taskId:id},state:'unknown',everUnknown:true}),
};
const accepted={conversation:{conversationId:id,revision:2147483647},turn:{conversationId:id,turnId:id,taskId:id,number:2147483647,revision:2147483647},queue:{conversationId:id,itemId:id,sequence:2147483647,queueRevision:2147483647},steer:{taskId:id,attemptId:id,commandId:id,nativeSessionId:id,ownerVersion:Number.MAX_SAFE_INTEGER,revision:2147483647,receiptRevision:2147483647,userMessageUuid:uuid(30),inputDigest:digest,inputBytes:16384}};
const report={fixedBase:'cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd',at:new Date().toISOString(),runtime:process.version,unit:'bytes = UTF-8 byteLength of compact JSON.stringify. KiB=1024, MiB=1048576.',limits:{commandInitialBytes:131072,commandReserveBytes:32768,draftBytes:131072,globalBytes:4194304,maxDrafts:32,maxLogicalCommands:128},requestResults:results,components:{id128_JSONStringBytes:bytes(id),controlText16000_JSONStringBytes:bytes(C.repeat(16000)),key200_visibleASCIIescaped_JSONStringBytes:bytes(key),key200_schemaOnlyCeiling_JSONStringBytes:bytes(C.repeat(200)),knowledgeCitation_JSONBytes:bytes(knowledge[0]),attachmentReference_JSONBytes:bytes(attachments[0]),twoBody_sum:bytes(creation)+bytes(maxTurn)},illustrativeEnvelopes:commandEnvelopes,illustrativeEnvelopeWarning:'These field lists/length bounds are explicitly illustrative, not a finalized journal schema or a journal capacity proof. A body is stored once; JSON-string nesting has its own escaping cost. No full ACK/error/draft duplicate retained.',acceptedMinimalIdentityCandidateBytes:Object.fromEntries(Object.entries(accepted).map(([k,v])=>[k,bytes(v)])),globalArithmetic:{onlyWorstReservations:128*32768,maxSize32Drafts:32*131072,maxSizeCommandWithReserve:131072+32768,floorMaxSizedCommandsBeforeAnyOtherStorage:Math.floor(4194304/(131072+32768))},sideEffects:{http:0,pg:0,browser:0,provider:0,projectWrites:0,installs:0}};
fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
