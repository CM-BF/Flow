import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import type { NativeActivity, NativeActivityReference } from "@flow/contracts";
import { startQueuePreview } from "./conversation-queue.fixture";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const output=root+"docs/evidence/wpf-activity-i01/";
const production=process.argv.includes("--production"),label=production?"production":"development";
const preview=await startQueuePreview(production);
const sourcePaths=(JSON.parse(await readFile(output+"take-receipt.json","utf8")).claim.scope as string[]).filter(p=>p.startsWith("apps/"));
sourcePaths.push("apps/web/src/conversation-activity/projection.ts","apps/web/test/conversation-activity.test.ts");
const sourceFiles=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,createHash("sha256").update(await readFile(root+p)).digest("hex")])));
const sourceCommit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const reads:{center:number;kind:string;taskId?:string;id?:string;after?:string|null}[]=[];
const rows=new Map<string,NativeActivityReference[]>();
const bodies=new Map<string,NativeActivity>();
let bodyDelay=0;
for(const [center,fixture] of [preview.first,preview.second].entries()){
 for(const chat of fixture.chats.values())for(const turn of chat.turns){
  const list:NativeActivityReference[]=[];
  for(let n=0;n<23;n++){
   const id=createHash("sha256").update(`${center}:${turn.task.id}:${n}`).digest("hex");
   const kind=n===1||n===2?"thinking":n===3?"unsupported":"tool";
   const row:NativeActivityReference={id,activityId:id,taskId:turn.task.id,attemptId:n>20?"retry-attempt":"attempt",eventId:`event-${n}`,sequence:n>20?n-21:n,createdAt:turn.task.createdAt,nativeSessionId:`native-${center}`,source:"claude.sdk.message",sourceMessageId:`source-${n}`,nativeMessageId:null,blockIndex:n,parentToolUseId:null,kind,phase:n===2?"redacted":kind==="tool"?"input-ready":"observed",toolUseId:kind==="tool"?`tool-${n}`:null,toolName:kind==="tool"?`Read ${n}`:null,detail:n===2?null:{id:`native-detail-${n}`,title:`Native ${n}`},status:kind==="tool"?"input-ready":n===2?"redacted":"observed"};
   list.push(row);const content=n===1?`Provider thinking from center ${center}`:n===4?'{"truncated":':JSON.stringify({path:`center-${center}/file-${n}.txt`});
   bodies.set(id,{...row,body:n===2?null:{content,mediaType:n===1?"text/plain":"application/json",originalBytes:n===4?70000:Buffer.byteLength(content),truncated:n===4,sha256:createHash("sha256").update(n===4?content+"x".repeat(70000-Buffer.byteLength(content)):content).digest("hex")}});
  }
  rows.set(`${center}:${turn.task.id}`,list);
 }
 const original=fixture.server.listeners("request")[0] as (req:IncomingMessage,res:ServerResponse)=>void;fixture.server.removeAllListeners("request");
 fixture.server.on("request",(req,res)=>{
  const url=new URL(req.url??"/","http://fixture"),list=/^\/api\/tasks\/([^/]+)\/native-activities$/.exec(url.pathname),detail=/^\/api\/native-activities\/([^/]+)$/.exec(url.pathname);
  if(!list&&!detail){if(url.pathname.endsWith("/events"))reads.push({center,kind:"events"});original(req,res);return;}
  res.setHeader("access-control-allow-origin","*");res.setHeader("access-control-allow-headers","authorization,content-type");if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
  const json=(value:unknown)=>{res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(value));};
  if(list){const taskId=decodeURIComponent(list[1]!),after=url.searchParams.get("after"),all=rows.get(`${center}:${taskId}`)??[],start=after?all.findIndex(r=>r.id===after)+1:0,items=all.slice(start,start+20);reads.push({center,kind:"native",taskId,after});json({activities:items,nextCursor:start+20<all.length?items.at(-1)?.id:null});}
  else{const id=detail![1]!;reads.push({center,kind:"body",id});const value=structuredClone(bodies.get(id));setTimeout(()=>json(value),bodyDelay);}
 });
}
if(process.argv.includes("--serve")){console.log(`Activity HTTP fixture (0 models/DB): ${preview.url}`);console.log(`Centers: ${preview.centers.join(", ")}`);await new Promise<void>(resolve=>{process.once("SIGTERM",resolve);process.once("SIGINT",resolve);});await preview.close();process.exit();}
async function lifetimePreview() {
 const code=`import React,{Activity,StrictMode,useState}from'react';import{createRoot}from'react-dom/client';import{AssistantRuntimeProvider,useExternalStoreRuntime}from'@assistant-ui/react';import{FlowClient}from'@flow/client';import{ConversationProjection}from'/src/conversations/projection.ts';import{conversationMessages,messageTask}from'/src/conversations/messages.ts';import{AppPluginSession}from'/src/plugin-integration/session.ts';import{PluginProvider,PluginThreadScope,ConversationActivities,MessageFooter}from'/src/plugin-integration/react.tsx';import{Thread}from'/src/components/assistant-ui/elements/thread.aui.tsx';import{themes}from'/src/themes.ts';import'/src/assistant-ui.css';import'/src/styles.css';
const c=new FlowClient({baseUrl:'',token:'flow-fixture-only'}),p=new ConversationProjection(c,'chat-3',60000);await p.refresh();const state=p.getSnapshot();const session=new AppPluginSession({knowsTask:()=>true,task:()=>null,hasDraft:()=>true,ownsMessage:()=>true,activity:{events:(i,a)=>c.events(i.taskId,a),detail:(i,id,s)=>c.conversationDetail(i.conversationId,i.turnId,id,s),nativePage:(i,a,s)=>c.nativeActivities(i.taskId,{after:a??undefined,limit:20},s),nativeBody:(i,id,s)=>c.nativeActivity(id,s)},openTask(){},openWorkspace(){},closeWorkspace(){},async loadReference(){},setTheme(){},async copy(){}},themes[0]);const h=React.createElement,components={MessageFooter},messages=conversationMessages(state.turns),convert=m=>m;
function ThreadView(){const rt=useExternalStoreRuntime({messages,convertMessage:convert,isRunning:false,onNew:async()=>{}});return h(AssistantRuntimeProvider,{runtime:rt},h(PluginThreadScope,{viewId:'strict',taskId:state.turns[0].task.id,messageTask:id=>messageTask(state.turns,id)},h(ConversationActivities,{viewId:'strict',projection:p,visible:true},h(Thread,{components,autoFocus:false}))));}
function App(){const[hidden,setHidden]=useState(false);return h(PluginProvider,{session},h('button',{onClick:()=>setHidden(!hidden)},hidden?'Restore Activity':'Hide Activity'),h(Activity,{mode:hidden?'hidden':'visible'},h('section',{style:{height:'85vh',display:'flex',flexDirection:'column'}},h(ThreadView))));}createRoot(document.getElementById('root')).render(h(StrictMode,null,h(App)));`;
 const server=await createServer({root:root+'apps/web',server:{host:'127.0.0.1',port:0,proxy:{'/api':preview.centers[0]!}},plugins:[{name:'activity-consumer',resolveId(id){if(id==='/activity-consumer.tsx')return '\0activity-consumer.tsx';},load(id){if(id==='\0activity-consumer.tsx')return code;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/lifetime')return next();res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/lifetime','<!doctype html><html><body><div id="root"></div><script type="module" src="/activity-consumer.tsx"></script></body></html>'));});}}]});await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('lifetime address');return{server,url:`http://127.0.0.1:${address.port}/lifetime`};
}
const browser=await chromium.launch({channel:"chrome",headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce",permissions:["clipboard-read","clipboard-write"]});const page=await context.newPage();page.setDefaultTimeout(8000);
const errors:string[]=[],checks:string[]=[];let failure:string|undefined;page.on("pageerror",error=>errors.push(error.message));
const pane=(n:number)=>page.locator(`[id="panel-conversation:chat-${n}"]`),input=(n:number)=>pane(n).getByRole("textbox",{name:"Message input",exact:true});
const activity=(n:number)=>pane(n).locator("details[data-conversation-activity]").first();
const open=async(n:number)=>{await page.getByRole("navigation",{name:"Conversations",exact:true}).getByRole("button",{name:`Conversation ${n}`,exact:true}).click();await expect(input(n)).toBeVisible();};
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
try{
 await page.goto(preview.url);if(production){await page.getByLabel("Owner token").fill("flow-fixture-only");await page.getByRole("button",{name:"Connect workspace"}).click();}
 await check("pending/running user anchor is visible, initial and folded native/events/body reads are zero",async()=>{await open(2);await expect(activity(2).locator("summary").first()).toContainText("running");expect(reads).toEqual([]);await input(2).fill("Preserve my next draft");});
 await check("Enter expands current native page only, actual Tool and Reasoning lazy bodies cache",async()=>{
  await activity(2).locator("summary").first().focus();await page.keyboard.press("Enter");await expect(activity(2).locator("[data-native-activity]")).toHaveCount(20);expect(reads.filter(r=>r.kind==="native")).toHaveLength(1);expect(reads.filter(r=>r.kind==="body")).toHaveLength(0);
  await activity(2).getByRole("button",{name:"Read 0 input ready",exact:true}).click();
  await expect(activity(2).getByLabel("Native activity content")).toContainText("file-0.txt");expect(reads.filter(r=>r.kind==="body")).toHaveLength(1);
  await activity(2).getByRole("button",{name:"Read 0 input ready",exact:true}).click();await activity(2).getByRole("button",{name:"Read 0 input ready",exact:true}).click();expect(reads.filter(r=>r.kind==="body")).toHaveLength(1);
  await activity(2).getByRole("button",{name:"Reasoning",exact:true}).first().click();await expect(activity(2).getByLabel("Native activity content")).toContainText("Provider thinking");expect(reads.filter(r=>r.kind==="body")).toHaveLength(2);
 });
 await check("TaskSummary update refreshes displayed metadata without body requests or automatic history drain",async()=>{
  const taskId=preview.first.chats.get("chat-2")!.turns[0]!.task.id;rows.get(`0:${taskId}`)![0]!.status="unknown";preview.first.setCurrentStatus("chat-2","failed");
  await expect(activity(2).getByRole("button",{name:"Read 0 unknown",exact:true})).toBeVisible();expect(reads.filter(r=>r.kind==="native"&&r.after!==null)).toHaveLength(0);expect(reads.filter(r=>r.kind==="body")).toHaveLength(2);
  await activity(2).getByRole("button",{name:"Next activity page"}).click();await expect(activity(2).locator("[data-native-activity]")).toHaveCount(3);await activity(2).getByRole("button",{name:"Previous activity page"}).click();await expect(activity(2).locator("[data-native-activity]")).toHaveCount(20);
 });
 await check("native hidden resume retains disclosure and draft with zero extra activity reads",async()=>{const before=reads.length;await open(1);await expect(pane(2)).toHaveAttribute("hidden","");await open(2);await expect(activity(2)).toHaveAttribute("open","");await expect(input(2)).toHaveValue("Preserve my next draft");expect(reads).toHaveLength(before);});
 await check("split panes use local message context; generic source reads only on explicit selection",async()=>{
  await open(1);await page.getByRole("button",{name:"Split chat",exact:true}).click();await expect(input(2)).toBeVisible();await expect(input(1)).toBeVisible();await activity(1).locator("summary").first().click();await expect(activity(1).locator("[data-native-activity]")).toHaveCount(20);
  await activity(1).getByRole("radio",{name:"Task events",exact:true}).check();await expect(activity(1).getByRole("list",{name:"Activity entries"})).toContainText("Runner accepted");expect(reads.filter(r=>r.kind==="events")).toHaveLength(1);
 });
 await check("footer menu and button are real plugin actions; disable removes activity without cancelling",async()=>{
  await pane(2).locator('[data-extension-slot="chat.message.footer"]').getByRole("button",{name:"More actions",exact:true}).click();await expect(pane(2).getByRole("menuitem",{name:"Copy task ID"})).toBeVisible();await page.keyboard.press("Enter");expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(preview.first.chats.get("chat-2")!.turns[0]!.task.id);
  await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();await page.getByRole("button",{name:`Disable flow.conversation-activity`,exact:true}).click();await page.keyboard.press("Escape");await expect(activity(2)).toHaveCount(0);expect(preview.first.requests.filter(r=>r.path.endsWith("/cancel"))).toHaveLength(0);
  await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();await page.getByRole("button",{name:`Enable flow.conversation-activity`,exact:true}).click();await page.keyboard.press("Escape");await expect(activity(2)).toBeVisible();
 });
 await check("light/dark narrow keyboard geometry keeps footer in full message row",async()=>{
  await page.getByRole("button",{name:"Merge tabs",exact:true}).click();await open(2);await activity(2).locator("summary").first().click();await expect(activity(2).locator("[data-native-activity]")).toHaveCount(20);
  await page.screenshot({path:output+`${label}-light.png`,fullPage:true});await page.getByRole("button",{name:"Use dark theme",exact:true}).click();await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Hide chat list",exact:true}).click();
  await expect(activity(2).locator("summary").first()).toBeVisible();const geometry=await activity(2).evaluate(el=>({width:el.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,viewport:innerWidth}));expect(geometry.width).toBeGreaterThan(250);expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport+1);
  await activity(2).locator("summary").first().focus();await page.keyboard.press("Space");await expect(activity(2)).not.toHaveAttribute("open","");await page.keyboard.press("Enter");await expect(activity(2)).toHaveAttribute("open","");await expect(input(2)).toHaveValue("Preserve my next draft");await page.screenshot({path:output+`${label}-dark-390.png`,fullPage:true});
 });
 await check("redacted thinking reads no body and truncated JSON displays an honest prefix",async()=>{
  const before=reads.filter(r=>r.kind==="body").length;await activity(2).getByRole("button",{name:"Reasoning",exact:true}).nth(1).click();await expect(activity(2).getByText("Provider redacted this thinking. No body is available.")).toBeVisible();expect(reads.filter(r=>r.kind==="body")).toHaveLength(before);
  await activity(2).getByRole("button",{name:"Read 4 input ready",exact:true}).click();await expect(activity(2).getByLabel("Native activity content")).toContainText('{"truncated":');await expect(activity(2).getByText(/Truncated UTF-8 prefix/)).toBeVisible();
 });
 await check("footer button opens the bound task; queue Enter/button retain delivery intent and draft",async()=>{
  await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Chats',exact:true}).click();
  await pane(2).locator('[data-extension-slot="chat.message.footer"]').getByRole('button',{name:'Open task controls',exact:true}).click();await expect(page).toHaveURL(new RegExp(preview.first.chats.get('chat-2')!.turns[0]!.task.id));
  preview.first.setCurrentStatus('chat-4','running');await open(4);await pane(4).getByRole('radio',{name:'Queue next',exact:true}).check();await input(4).fill('Queue Enter with activity');await input(4).press('Enter');await expect.poll(()=>preview.first.requests.filter(r=>r.method==='POST'&&r.path==='/api/conversations/chat-4/queue').length).toBe(1);
  await input(4).fill('Queue button with activity');await pane(4).getByRole('button',{name:'Add to queue',exact:true}).click();await expect.poll(()=>preview.first.requests.filter(r=>r.method==='POST'&&r.path==='/api/conversations/chat-4/queue').length).toBe(2);await pane(4).getByRole('radio',{name:'Send now',exact:true}).check();await input(4).fill('Keep new draft');await expect(pane(4).getByRole('button',{name:'Send message',exact:true})).toBeDisabled();
 });
 await check("old center delayed body cannot populate new same-ID conversation",async()=>{
  await open(1);const a=activity(1);if(await a.getAttribute('open')===null)await a.locator('summary').first().click();await a.getByRole('radio',{name:'Tools and thinking',exact:true}).check();
  let release!:()=>void,received!:()=>void;const gate=new Promise<void>(r=>{release=r;}),arrived=new Promise<void>(r=>{received=r;});await page.route(url=>url.pathname.startsWith('/api/native-activities/'),async route=>{const response=await route.fetch();received();await gate;try{await route.fulfill({response});}catch{/* old view aborted */}},{times:1});
  await a.getByRole('button',{name:'Read 0 input ready',exact:true}).click();await arrived;await page.getByRole('button',{name:'Change connection',exact:true}).click();await page.getByLabel('Center URL').fill(preview.centers[1]!);await page.getByLabel('Owner token').fill('flow-fixture-only');await page.getByRole('button',{name:'Connect workspace',exact:true}).click();await open(1);release();await activity(1).locator('summary').first().click();await activity(1).getByRole('button',{name:'Read 0 input ready',exact:true}).click();await expect(activity(1).getByLabel('Native activity content')).toContainText('center-1/file-0');await expect(activity(1)).not.toContainText('center-0/file-0');expect(preview.first.requests.filter(r=>r.path.endsWith('/cancel'))).toHaveLength(0);
 });
 if(!production)await check("direct dev StrictMode and React.Activity cleanup/resume retain draft and loaded body without new reads",async()=>{
  const fixture=await lifetimePreview();try{await page.goto(fixture.url);const disclosure=page.locator('details[data-conversation-activity]').first();await expect(disclosure).toBeVisible();await disclosure.locator('summary').first().click();await disclosure.getByRole('button',{name:'Read 0 input ready',exact:true}).click();await expect(disclosure.getByLabel('Native activity content')).toContainText('file-0');await page.getByRole('textbox',{name:'Message input'}).fill('Strict draft');const before=reads.length;await page.getByRole('button',{name:'Hide Activity',exact:true}).click();await expect(disclosure).not.toBeVisible();await page.getByRole('button',{name:'Restore Activity',exact:true}).click();await expect(disclosure.getByLabel('Native activity content')).toContainText('file-0');await expect(page.getByRole('textbox',{name:'Message input'})).toHaveValue('Strict draft');expect(reads).toHaveLength(before);}finally{await fixture.server.close();}
 });
}catch(error){failure=String(error);console.error(error);await page.screenshot({path:output+`${label}-failure.png`,fullPage:true});}
finally{await writeFile(output+`${label}-browser.json`,JSON.stringify({at:new Date().toISOString(),sourceCommit,sourceFiles,production,url:preview.url,checks,errors,reads,failure},null,2)+"\n");await browser.close();await preview.close();}
if(failure||errors.length)process.exitCode=1;
