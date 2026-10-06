import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import getPort from 'get-port';
import { HarnessAgent } from '/tmp/flow-harness-eval.iq7BzZ/node_modules/@ai-sdk/harness/dist/agent/index.js';
import { createClaudeCode } from '/tmp/flow-harness-eval.iq7BzZ/node_modules/@ai-sdk/harness-claude-code/dist/index.js';
import { createDockerSandbox } from './package/dist/index.js';

// Force the official adapter's existing local subscription resolver. Never read,
// serialize, or print credential values in this script.
for (const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN']) delete process.env[key];
const output = new URL('./harness-result.json', import.meta.url);
const data = { status:'starting', versions:{harness:'1.0.139',adapter:'1.0.143',bridgeSdk:'0.3.281',bridgeCli:'2.1.281',pnpm:'10.32.1'}, image:'flow-claude-eval-pnpm:10.32.1', modelRequested:'sonnet', modelLimitMs:90000, turns:[], warnings:0, timingsMs:{}, credentials:{resolution:'official adapter native subscription',copiedToFileByScript:false,homeMount:false}, runtimeIsolation:{homeUnchanged:true,claudeConfigDir:'/tmp/flow-claude-config',skills:[],activeTools:['read'],thinking:'disabled',maxTurns:3} };
const persist=()=>writeFile(output,JSON.stringify(data,null,2)+'\n');
const safeError=(e)=>({name:e?.name??'Error',message:String(e?.message??e).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/(?:Bearer\s+)[^\s"']+/gi,'Bearer [REDACTED]').slice(0,1500)});
console.warn=()=>{data.warnings++};
console.error=()=>{data.warnings++};
let sandbox,session;
const port=await getPort();
data.port=port;
const agent=new HarnessAgent({
  harness:createClaudeCode({auth:'direct',maxTurns:3,thinking:{type:'disabled'},port,portEndpoint:{url:`ws://127.0.0.1:${port}`},startupTimeoutMs:60000,env:{CLAUDE_CONFIG_DIR:'/tmp/flow-claude-config',CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_AUTOUPDATER:'1'}}),
  id:'flow-claude-eval',model:'sonnet',activeTools:['read'],tools:{},skills:[],permissionMode:'allow-reads',
  sandboxConfig:{workDir:'.',onSession:async({session,sessionWorkDir})=>{await session.writeTextFile({path:`${sessionWorkDir}/fixture.txt`,content:'FLOW_FIXTURE_VALUE=17\n'});}}
});
async function turn(prompt,expected){
  const row={prompt,expected,events:[],startedAt:new Date().toISOString()};data.turns.push(row);await persist();
  const start=performance.now();
  try {
    const result=await agent.stream({session,prompt,abortSignal:AbortSignal.timeout(90000)});
    for await (const event of result.fullStream){
      const selected={type:event.type,atMs:Math.round(performance.now()-start)};
      if(typeof event.toolName==='string')selected.toolName=event.toolName;
      if(event.type==='tool-call' && event.toolName==='read')selected.readPath=event.input?.file_path ?? event.input?.path;
      if(event.response?.modelId)selected.modelId=event.response.modelId;
      if(typeof event.text==='string')selected.text=event.text;
      if(event.usage)selected.usage=event.usage;
      if(event.totalUsage)selected.totalUsage=event.totalUsage;
      if(event.type==='error')selected.error=safeError(event.error);
      row.events.push(selected);
    }
    row.text=await result.text;
    row.usage=await result.usage;
    row.totalUsage=await result.totalUsage;
    row.finishReason=await result.finishReason;
    row.actualModel=(await result.response)?.modelId;
    const metadata=await result.providerMetadata;
    row.costUsd=metadata?.['claude-code']?.costUsd;
    row.ok=row.text.trim()===expected;
  }catch(e){row.error=safeError(e);row.ok=false;}
  row.durationMs=Math.round(performance.now()-start);await persist();return row.ok;
}
try{
  let start=performance.now();
  sandbox=await createDockerSandbox({image:data.image,ports:[port]}).createSession({abortSignal:AbortSignal.timeout(30000)});
  data.timingsMs.containerCreate=Math.round(performance.now()-start);data.sandboxId=sandbox.id;
  start=performance.now();
  const template=await agent.getSandboxTemplate();
  await template.prepare({session:sandbox.restricted(),abortSignal:AbortSignal.timeout(90000)});
  data.timingsMs.templatePrepare=Math.round(performance.now()-start);data.status='sandbox-prepared';await persist();
  start=performance.now();
  session=await agent.createSession({sandboxSession:sandbox,abortSignal:AbortSignal.timeout(60000)});
  data.timingsMs.sessionCreate=Math.round(performance.now()-start);data.status='session-created';await persist();
  const ok=await turn('Read fixture.txt and reply with exactly FLOW_OK:17. Do not read any other file or use other tools.','FLOW_OK:17');
  if(ok)await turn('Reply with exactly FLOW_RESUME:17 using the value from the previous turn.','FLOW_RESUME:17');
  data.status=data.turns.every(t=>t.ok)?'passed':'model-task-failed';
}catch(e){data.status='setup-failed';data.error=safeError(e);}
finally{
  if(session)try{await session.destroy();}catch(e){data.cleanupSessionError=safeError(e);}
  if(sandbox)try{await sandbox.destroy();data.containerDestroyed=true;}catch(e){data.cleanupSandboxError=safeError(e);}
  await persist();
}
process.stdout.write(JSON.stringify({status:data.status,turns:data.turns.map(({text,actualModel,durationMs,ok,error})=>({text,actualModel,durationMs,ok,error})),error:data.error,timingsMs:data.timingsMs,output:output.pathname})+'\n');
