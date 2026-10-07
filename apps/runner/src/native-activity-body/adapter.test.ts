import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach,expect,it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessContext,RunnerEventData } from '@flow/contracts';
import type { NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import { createClaudeAdapter,type ClaudeQuery } from '../claude.js';
const directories:string[]=[];
afterEach(async()=>{for(const path of directories.splice(0))await rm(path,{recursive:true,force:true});});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
it.each([false,true])('uses only the optional host body port when enabled=%s, and waits before final delivery',async enabled=>{
  const directory=await mkdtemp(join(tmpdir(),'flow-chat05p01-adapter-'));directories.push(directory);
  const events:RunnerEventData[]=[],materials:number[]=[];const entered=deferred(),release=deferred();let closed=false,calls=0;
  // Inject only public SDK fields consumed by this adapter; no provider is constructed.
  const query:ClaudeQuery=()=>{calls++;return Object.assign((async function*(){
    yield {type:'assistant',uuid:'input',session_id:'session',parent_tool_use_id:null,message:{id:'input-message',content:[{type:'tool_use',id:'tool',name:'Read',input:{text:'x'.repeat(90_000)}}]}} as unknown as SDKMessage;
    yield {type:'user',uuid:'output',session_id:'session',parent_tool_use_id:null,message:{content:[{type:'tool_result',tool_use_id:'tool',content:'y'.repeat(70_000)}]}} as unknown as SDKMessage;
    yield {type:'result',subtype:'success',is_error:false,uuid:'result',session_id:'session',result:'Synthetic final',modelUsage:{},total_cost_usd:0,permission_denials:[],num_turns:2,duration_ms:1} as unknown as SDKMessage;
  })(),{close(){closed=true;}});};
  const context:HarnessContext={task:{title:'Synthetic body adapter',prompt:'No provider',harness:'claude'},workingDirectory:directory,signal:new AbortController().signal,
    async assertOwnership(){},async waitForDecision(){return'approve';},async emit(event){events.push(event);},
    ...(enabled?{activityBodies:{protocol:'native-activity-body-v1' as const,async publish(input:NativeActivityBodyInput){materials.push(input.content.length);if(materials.length===1){entered.resolve();await release.promise;}}}}:{}),
  };
  const run=createClaudeAdapter({materialFiles:[],allowRead:false,query,timeoutMs:5000}).run(context);
  if(enabled){await entered.promise;expect(events.some(event=>event.type==='assistant-final')).toBe(false);release.resolve();}
  await run;expect(calls).toBe(1);expect(closed).toBe(true);expect(events.some(event=>event.type==='assistant-final')).toBe(true);
  expect(materials.length).toBe(enabled?2:0);expect(events.filter(event=>event.type==='native-activity')).toHaveLength(enabled?0:2);
  if(enabled)expect(materials.every(bytes=>bytes>65_536)).toBe(true);
});
