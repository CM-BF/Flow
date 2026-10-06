import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import type {AssistantStreamPatch,AssistantStreamReference,AssistantStreamPage,ConversationTurn,NativeActivity,ConversationSummary} from '@flow/contracts';
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const at='2026-10-06T10:00:00Z';
/** Synthetic HTTP center only: no database, runner, auth material or provider. */
export async function streamCenter() {
  const conversation: ConversationSummary={id:randomUUID(),title:'Streaming fixture',harness:'claude',requested:{model:'runner-default',thinking:'disabled',tools:'configured-readonly'},revision:1,createdAt:at,updatedAt:at};
  const taskId=randomUUID(),attemptId=randomUUID(),session=randomUUID();
  const turn:ConversationTurn={id:randomUUID(),conversationId:conversation.id,number:1,createdAt:at,user:{role:'user',text:'Synthetic read only'},
    task:{id:taskId,title:conversation.title,harness:'claude',status:'running',verificationStatus:'pending',createdAt:at,updatedAt:at},
    assistant:{state:'pending',reason:'execution-pending'},effective:{model:null,thinking:'unknown',tools:null,source:null},telemetry:{kind:'execution',taskId,title:'Execution'}};
  const patches:AssistantStreamPatch[]=[]; const blocks:AssistantStreamReference[]=[]; let currentText='';
  const meta:AssistantStreamPage={taskId,attemptId,taskStatus:'running',taskUpdatedAt:at,blocks,nextCursor:null,finalMessageId:null,settlement:null};
  const activities:NativeActivity[]=Array.from({length:6},(_,index)=>{const activityId=digest(`activity-${index}`);return {
    id:activityId,activityId,taskId,attemptId,eventId:randomUUID(),sequence:index+100,createdAt:at,nativeSessionId:session,source:'claude.sdk.message',sourceMessageId:randomUUID(),nativeMessageId:'native-tool',blockIndex:index,parentToolUseId:null,
    kind:'tool',phase:'input-ready',status:'input-ready',toolUseId:`tool-${index}`,toolName:'Read',detail:{id:randomUUID(),title:'Tool input'},
    body:{content:index===0?'\u001b]52;c;UNTRUSTED\u0007 {"path":"synthetic"':'body-'+index,mediaType:'application/json',truncated:index===0,sha256:digest('full synthetic payload'),originalBytes:index===0?100:6},
  } as NativeActivity;});
  activities[1]={...activities[1]!,kind:'thinking',phase:'redacted',status:'redacted',toolName:null,toolUseId:null,detail:null,body:null};
  const calls:{method:string;url:string;protocol:string|undefined}[]=[]; let capability=true; let breakPatches=false; let badBody=false; let badReply=false;
  let releaseBody:(()=>void)|null=null; let bodyWait:Promise<void>|null=null;
  let content='';
  function append(text:string,phase:AssistantStreamPatch['phase']='streaming') {
    const previous=blocks.at(-1); currentText+=text; const sequence=patches.length+1;
    const patch:AssistantStreamPatch={type:'assistant-stream',streamId:previous?.id??digest(JSON.stringify([session,'native-message',0])),nativeSessionId:session,nativeMessageId:'native-message',parentToolUseId:null,source:'claude.sdk.stream',sourceMessageId:randomUUID(),blockIndex:0,
      revision:(previous?.revision??0)+1,fromBytes:Buffer.byteLength(currentText)-Buffer.byteLength(text),text,prefixDigest:digest(currentText),phase,reason:null,truncated:false,taskId,attemptId,eventId:randomUUID(),sequence,createdAt:at};
    patches.push(patch);
    const {type:_type,text:_text,fromBytes:_bytes,eventId:_event,sequence:_seq,...ref}=patch;
    blocks[0]={...ref,id:patch.streamId,firstSequence:1,lastSequence:sequence,bytes:Buffer.byteLength(currentText),updatedAt:at,status:phase};
    turn.task.updatedAt=new Date(Date.parse(at)+sequence*1000).toISOString();meta.taskUpdatedAt=turn.task.updatedAt;
  }
  function finish(text='Canonical final') {
    append('','block-complete');content=text;const id=randomUUID(),detailId=randomUUID();turn.task.status='succeeded';turn.task.verificationStatus='passed';meta.taskStatus='succeeded';
    turn.assistant={state:'available',role:'assistant',messageId:id,text,truncated:false,contentRef:{id:detailId,title:'Final',kind:'detail',taskId,attemptId},source:{kind:'assistant-final',source:'claude.sdk.result',taskId,attemptId,nativeSessionId:session,messageId:id,eventId:randomUUID(),sourceMessageId:randomUUID(),contentDigest:digest(text),detailId}};
    meta.finalMessageId=id;meta.settlement={policy:'flow.assistant-draft',policyVersion:'1',correlation:'presentation-policy',unavailableReason:null,taskId,attemptId,nativeSessionId:session,finalMessageId:id,replaceStreamIds:blocks.map(b=>b.id),retainStreamIds:[]};
  }
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url!,'http://fixture'); calls.push({method:req.method!,url:url.pathname+url.search,protocol:req.headers['x-flow-assistant-stream'] as string|undefined});
    let value:unknown;
    if(req.method==='POST'&&url.pathname==='/fixture/advance'){append(' 中文🙂 second');value={ok:true};}
    else if(req.method==='POST'&&url.pathname==='/fixture/final'){finish();value={ok:true};}
    else if(url.pathname.endsWith('/assistant-stream/patches')){const after=Number(url.searchParams.get('after')??0);const selected=breakPatches?[]:patches.filter(p=>p.sequence>after).slice(0,8);value={taskId,attemptId,patches:selected,nextCursor:selected.at(-1)?.sequence??after,hasMore:false};}
    else if(url.pathname.endsWith('/assistant-stream')) value=meta;
    else if(url.pathname.endsWith('/native-activities')) value={activities:activities.map(({body:_body,...ref})=>ref),nextCursor:null};
    else if(url.pathname.includes('/native-activities/')){if(bodyWait)await bodyWait;const body=activities.find(a=>url.pathname.endsWith(a.id));value=badBody&&body?{...body,attemptId:'other-attempt'}:body;}
    else if(url.pathname.includes('/details/'))value={id:badReply?'other':turn.assistant.state==='available'?turn.assistant.contentRef.id:'none',title:'Final',kind:'detail',content,mediaType:'text/plain'};
    else if(url.pathname.endsWith('/turns'))value={conversation,turns:[turn],nextCursor:null};
    else value={conversation,capabilities:{followUp:true,queue:false,steer:false,perTurnModel:false,perTurnThinking:false,perTurnTools:false,liveAssistantText:capability},nativeSession:null,lastTurn:turn};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value));
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done)); const address=server.address();if(!address||typeof address==='string')throw Error('No fixture port');
  return {url:`http://127.0.0.1:${address.port}`,conversation,turn,meta,patches,activities,calls,append,finish,
    setCapability(value:boolean){capability=value;},setBrokenPatches(value:boolean){breakPatches=value;},setBadBody(value:boolean){badBody=value;},setBadReply(value:boolean){badReply=value;},
    holdBody(){bodyWait=new Promise<void>(done=>{releaseBody=done;});},releaseBody(){releaseBody?.();bodyWait=null;},
    async close(){releaseBody?.();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}};
}
