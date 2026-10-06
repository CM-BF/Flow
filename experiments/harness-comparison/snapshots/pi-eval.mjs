import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import * as pi from './node_modules/@ai-sdk/harness-pi/node_modules/@earendil-works/pi-coding-agent/dist/index.js';
import { AuthStorage } from './node_modules/@ai-sdk/harness-pi/node_modules/@earendil-works/pi-coding-agent/dist/core/auth-storage.js';
import { createReadToolDefinition } from './node_modules/@ai-sdk/harness-pi/node_modules/@earendil-works/pi-coding-agent/dist/core/tools/read.js';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import { createJustBashNetworkSandboxSession } from '@ai-sdk/sandbox-just-bash';
import { stepCountIs } from 'ai';

const mode = process.argv[2];
const root = '/tmp/flow-pi-eval.yxI5qW';
const fixtureDir = path.join(root, mode, 'fixture');
const agentDir = path.join(root, mode, 'agent');
await fs.mkdir(fixtureDir, {recursive:true});
await fs.mkdir(agentDir, {recursive:true});
await fs.writeFile(path.join(fixtureDir,'fixture.txt'), 'FLOW_FIXTURE_VALUE=17\n');
const authPath = path.join(pi.getAgentDir(), 'auth.json');
process.env.PI_CODING_AGENT_DIR = agentDir;
const discovery = JSON.parse(await fs.readFile(path.join(root,'discovery.json'),'utf8'));
const chosen = discovery.chosen;
const prompt = 'Read fixture.txt and reply with exactly FLOW_OK:17. Do not read any other file or use other tools.';
const resumePrompt = 'Using only this session\'s prior context and without tools, reply with exactly FLOW_RESUME:17.';
const safeError = e => String(e?.message ?? e).replace(/(Bearer\s+|sk-)[A-Za-z0-9_.\-]+/g,'[REDACTED]').slice(0,1000);
const report = {mode, versions:{pi:'0.85.1',harness:'1.0.139',harnessPi:'1.0.141'}, model:chosen, prompt, thinking:'off', turns:[], notes:[]};
const persist = async () => fs.writeFile(path.join(root, `${mode}-result.json`),JSON.stringify(report,null,2));
const hardLimit = setTimeout(async()=>{report.error='90-second path budget exceeded';await persist();process.exit(124);},90000);
let nativeSession, harnessSession, sandbox;
const start = performance.now();
try {
 if (!chosen) throw Error('No authenticated Pi model is available; no login attempted.');
 const credentials = AuthStorage.create(authPath);
 if (mode === 'native') {
   const runtime = await pi.ModelRuntime.create({credentials,modelsPath:null,allowModelNetwork:false});
   const model = runtime.getModel(chosen.provider,chosen.model);
   if (!model || !runtime.hasConfiguredAuth(model.provider)) throw Error('Selected model unavailable in matching Pi version');
   const resourceLoader = {
     getExtensions:()=>({extensions:[],errors:[],runtime:pi.createExtensionRuntime()}),
     getSkills:()=>({skills:[],diagnostics:[]}), getPrompts:()=>({prompts:[],diagnostics:[]}),
     getThemes:()=>({themes:[],diagnostics:[]}),getAgentsFiles:()=>({agentsFiles:[]}),
     getSystemPrompt:()=>undefined,getSystemPromptSource:()=>undefined,
     getAppendSystemPrompt:()=>[],getAppendSystemPromptSources:()=>[],extendResources:()=>{},reload:async()=>{}
   };
   const guard = p => {if (path.resolve(p)!==path.join(fixtureDir,'fixture.txt')) throw Error('Only fixture.txt is allowed');};
   const readTool = createReadToolDefinition(fixtureDir,{operations:{readFile:async p=>{guard(p);return fs.readFile(p);},access:async p=>{guard(p);await fs.access(p);},detectImageMimeType:async()=>null}});
   const manager = pi.SessionManager.create(fixtureDir,path.join(root,mode,'sessions'));
   const common = {cwd:fixtureDir,agentDir,modelRuntime:runtime,model,thinkingLevel:'off',resourceLoader,tools:['read'],customTools:[readTool],settingsManager:pi.SettingsManager.inMemory({compaction:{enabled:false},retry:{enabled:false},cacheWarming:'off'})};
   ({session:nativeSession}=await pi.createAgentSession({...common,sessionManager:manager}));
   report.setupMs = Math.round(performance.now()-start);
   for (let n=0;n<2;n++) {
     if (n===1) {
       const file = manager.getSessionFile();
       nativeSession.dispose();
       ({session:nativeSession}=await pi.createAgentSession({...common,tools:[],sessionManager:pi.SessionManager.open(file)}));
       report.resumeMechanism = 'dispose + SessionManager.open persisted journal + createAgentSession';
     }
     const before = nativeSession.messages.length;
     const events = {};
     let calls = 0;
     const t0=performance.now();
     const unsub = nativeSession.subscribe(event=>{
       const key=event.type+(event.type==='message_update'?`:${event.assistantMessageEvent.type}`:'');
       events[key]=(events[key]??0)+1;
       if(event.type==='tool_execution_start' && ++calls>2) void nativeSession.abort();
     });
     const timer=setTimeout(()=>void nativeSession.abort(),Math.min(60000,85000-(performance.now()-start)));
     try {await nativeSession.prompt(n===0?prompt:resumePrompt);} finally {clearTimeout(timer);unsub();}
     const messages=nativeSession.messages.slice(before);
     const assistant=messages.filter(m=>m.role==='assistant');
     const final=assistant.at(-1);
     report.turns.push({stage:n===0?'initial':'resume',elapsedMs:Math.round(performance.now()-t0),text:final?.content?.filter(c=>c.type==='text').map(c=>c.text).join('')??'',stopReason:final?.stopReason,error:final?.errorMessage?safeError(final.errorMessage):undefined,events,toolCalls:calls,usagePerAssistantMessage:assistant.map(m=>m.usage),toolResultCount:messages.filter(m=>m.role==='toolResult').length});
     await persist();
     if(final?.stopReason==='error'||final?.stopReason==='aborted'||n===0&&report.turns[0].text!=='FLOW_OK:17') break;
   }
 } else if (mode === 'harness') {
   // Privacy-only process-local test shim: this adapter exposes no public
   // noSkills/noContextFiles option. Preserve instructions; skip discovery.
   pi.DefaultResourceLoader.prototype.reload=async function(){
     this.appendSystemPrompt=this.appendSystemPromptOverride?.([])??[];
     this.settingsManager.setCompactionEnabled(false);
     this.settingsManager.setRetryEnabled(false);
   };
   report.notes.push('Process-local resource-loader reload shim prevents all filesystem resource discovery; no package files changed. Native SDK uses explicit empty ResourceLoader.');
   const harness=createPi({credentials,thinkingLevel:'off',reattachInProcess:false});
   const agent=new HarnessAgent({harness,model:`${chosen.provider}/${chosen.model}`,activeTools:['read'],skills:[],stopWhen:stepCountIs(3),sandboxConfig:{workDir:'.'}});
   sandbox=await createJustBashNetworkSandboxSession({cwd:'/work'});
   await sandbox.writeTextFile({path:'/work/fixture.txt',content:'FLOW_FIXTURE_VALUE=17\n'});
   harnessSession=await agent.createSession({sandboxSession:sandbox});
   report.setupMs=Math.round(performance.now()-start);
   for(let n=0;n<2;n++) {
     if(n===1){
       const sessionId=harnessSession.sessionId;
       const resumeFrom=await harnessSession.stop();
       await fs.writeFile(path.join(root,'harness-resume-state.json'),JSON.stringify(resumeFrom,null,2));
       harnessSession=await agent.createSession({sandboxSession:sandbox,sessionId,resumeFrom});
       report.resumeMechanism='stop + createSession(resumeFrom), reattachInProcess=false, same in-memory sandbox retained';
     }
     const t0=performance.now(),events={},tools=[];
     const result=await agent.stream({session:harnessSession,prompt:n===0?prompt:resumePrompt,abortSignal:AbortSignal.timeout(Math.min(60000,Math.max(1000,85000-(performance.now()-start))))});
     for await(const part of result.stream){
       events[part.type]=(events[part.type]??0)+1;
       if(part.type==='tool-call') tools.push({toolName:part.toolName,input:part.input});
       if(part.type==='error') report.streamError=safeError(part.error);
     }
     const text=await result.text;
     report.turns.push({stage:n===0?'initial':'resume',elapsedMs:Math.round(performance.now()-t0),text,finishReason:await result.finishReason,events,tools,usage:await result.usage});
     await persist();
     if(n===0&&text!=='FLOW_OK:17') break;
   }
 } else throw Error('Unknown mode');
} catch(e) {report.error=safeError(e);}
finally {
 try {nativeSession?.dispose();}catch{}
 try {await harnessSession?.destroy();}catch{}
 try {await sandbox?.destroy();}catch{}
 report.totalMs=Math.round(performance.now()-start);
 clearTimeout(hardLimit);await persist();console.log(JSON.stringify(report));process.exit(report.error?1:0);
}
