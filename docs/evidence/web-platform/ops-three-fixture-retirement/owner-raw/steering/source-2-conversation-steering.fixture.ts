import { createServer as httpServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, createServer, preview, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { steeringCommandSchema, type SteeringCommandReference, type SteeringCommandResult } from "@flow/contracts";

export function steeringCenter(label: string) {
  const at="2026-10-06T08:00:00Z", rows:SteeringCommandReference[]=[], saved=new Map<string,{body:string;result:SteeringCommandResult}>();
  const calls:{method:string;path:string;body?:string;key?:string}[]=[];
  let lose=false, disabled=false, rejectRetry=false, failRead=false, hold=false;
  let releases:(()=>void)[]=[];
  const server=httpServer(async(request,response)=>{
    response.setHeader("access-control-allow-origin","*");response.setHeader("access-control-allow-headers","authorization,content-type,idempotency-key");
    if(request.method==="OPTIONS"){response.writeHead(204);response.end();return;}
    const url=new URL(request.url??"/","http://127.0.0.1"), json=(data:unknown,status=200)=>{if(!response.destroyed){response.writeHead(status,{"content-type":"application/json"});response.end(JSON.stringify(data));}};
    const failure=(code:string,message:string,status=409)=>json({error:{code,message}},status);
    if(request.headers.authorization!=="Bearer flow-fixture-only"){failure("unauthorized","Public fixture token required",401);return;}
    const body=await new Promise<string>((resolve,reject)=>{let text="";request.on("data",chunk=>{text+=chunk;});request.on("end",()=>resolve(text));request.on("error",reject);}).catch(()=>"");
    calls.push({method:request.method??"GET",path:url.pathname+url.search,body:body||undefined,key:typeof request.headers["idempotency-key"]==="string"?request.headers["idempotency-key"]:undefined});
    if(request.method==="GET"&&failRead){failure("unavailable","Simulated read failure",503);return;}
    if(url.pathname==="/api/tasks/task/steering/admission"){
      const pending=rows.some(row=>["accepted","received","unknown"].includes(row.status));
      json({taskId:"task",attemptId:"attempt",ownerVersion:1,revision:rows.length,state:disabled||pending?"unavailable":"ready",reason:disabled?"disabled":pending?"pending":"ready"});return;
    }
    if(url.pathname==="/api/tasks/task/steering"&&request.method==="GET"){
      const after=Number(url.searchParams.get("after")??0),limit=Number(url.searchParams.get("limit")??20),selected=rows.filter(row=>row.revision>after);
      json({taskId:"task",attemptId:"attempt",revision:rows.length,sealed:false,attemptAvailable:true,commands:selected.slice(0,limit),nextCursor:selected.length>limit?selected[limit-1]!.revision:null});return;
    }
    if(url.pathname==="/api/tasks/task/steering"&&request.method==="POST"){
      const key=request.headers["idempotency-key"];
      if(typeof key!=="string"){failure("idempotency_key","Key required",400);return;}
      if(rejectRetry){failure("steering_unavailable","Attempt no longer available");return;}
      const replay=saved.get(key);
      if(replay){if(replay.body!==body){failure("idempotency_conflict","Different payload");return;}json({...replay.result,replayed:true},202);return;}
      let parsed;try{parsed=steeringCommandSchema.safeParse(JSON.parse(body));}catch{failure("steering_input","Invalid JSON",400);return;}
      if(!parsed.success){failure("steering_input","Invalid command",400);return;}
      if(disabled||rows.some(row=>["accepted","received","unknown"].includes(row.status))||parsed.data.expectedRevision!==rows.length){failure("steering_revision","Refresh authoritative state");return;}
      const command:SteeringCommandReference={id:randomUUID(),taskId:"task",attemptId:parsed.data.attemptId,ownerVersion:parsed.data.ownerVersion,nativeSessionId:`${label}-session`,revision:rows.length+1,userMessageUuid:randomUUID(),status:"accepted",receiptRevision:0,input:{bytes:Buffer.byteLength(parsed.data.text),digest:createHash("sha256").update(parsed.data.text).digest("hex")},createdAt:at,updatedAt:at};
      const result={command,replayed:false};rows.push(command);saved.set(key,{body,result});
      if(lose){lose=false;failure("response_lost","Simulated unavailable response after durable acceptance",503);return;}if(hold){hold=false;releases.push(()=>json(result,202));return;}json(result,202);return;
    }
    failure("not_found","Unknown fixture request",404);
  });
  return{server,calls,loseNext(){lose=true;},rejectRetries(value:boolean){rejectRetry=value;},disable(value:boolean){disabled=value;},failReads(value:boolean){failRead=value;},holdNext(){hold=true;},release(){releases.splice(0).forEach(fn=>fn());},
    consume(){for(let i=0;i<rows.length;i++)rows[i]={...rows[i]!,status:"observed-consumed",receiptRevision:2};},
    seed(count:number){for(let i=rows.length;i<count;i++)rows.push({id:`seed-${i}`,taskId:"task",attemptId:"attempt",ownerVersion:1,nativeSessionId:`${label}-session`,revision:i+1,userMessageUuid:randomUUID(),status:"observed-consumed",receiptRevision:2,input:{bytes:1,digest:createHash("sha256").update("x").digest("hex")},createdAt:at,updatedAt:at});},
    async close(){releases=[];server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
function code(centers:string[]) {return `import React,{useState,useMemo,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';import{FlowClient}from'@flow/client';
import{createSteeringControl}from'/src/conversation-steering/control.ts';import{SteeringControl}from'/src/conversation-steering/SteeringControl.tsx';import'/src/assistant-ui.css';
const h=React.createElement,centers=${JSON.stringify(centers)};
function Fixture(){const[center,setCenter]=useState(0),[open,setOpen]=useState(false),[online,setOnline]=useState(true),[authorized,setAuthorized]=useState(true),[dark,setDark]=useState(false);const authority=useRef({center,authorized});authority.current={center,authorized};
const control=useMemo(()=>{const client=new FlowClient({baseUrl:centers[center%2],token:'flow-fixture-only'});const permitted=()=>{if(authority.current.center!==center||!authority.current.authorized)throw Error('Host authority revoked');};
return createSteeringControl({connectionScope:'fixture-'+center,taskId:'task'},{admission:(options,signal)=>{permitted();return client.steeringAdmission('task',options,signal)},state:(options,signal)=>{permitted();return client.steering('task',options,signal)},accept:(input,key,signal)=>{permitted();return client.acceptSteering('task',input,key,signal)}})},[center]);
useEffect(()=>()=>control.dispose(),[control]);useEffect(()=>{control.updateGate({visible:open,online,authorized});if(open&&online&&authorized)void control.refresh()},[control,open,online,authorized]);
useEffect(()=>{document.documentElement.classList.toggle('dark',dark)},[dark]);
return h('main',{style:{maxWidth:720,margin:'24px auto',padding:16}},h('h1',null,'Steering control'),h('p',null,'Independent HTTP fixture · simulated · no model · not attached to product App'),h('div',{style:{display:'flex',flexWrap:'wrap',gap:8,margin:'16px 0'}},
h('button',{onClick:()=>setOpen(!open),'aria-expanded':open},open?'Hide steering':'Show steering'),h('button',{onClick:()=>setOnline(!online)},online?'Go offline':'Go online'),h('button',{onClick:()=>setAuthorized(!authorized)},authorized?'Revoke access':'Grant access'),h('button',{onClick:()=>setCenter(center+1)},'Switch center'),h('button',{onClick:()=>setDark(!dark)},dark?'Light theme':'Dark theme')),
h('p',null,'Center '+(center%2?'B':'A')),h(SteeringControl,{key:center,control}));}createRoot(document.getElementById('root')).render(h(Fixture));`}
function fixturePlugin(moduleCode:string):Plugin {
  const id="\0steering-fixture",html=(script:string,styles="")=>`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<title>Steering fixture</title></head><body><div id="root"></div><script type="module" src="${script}"></script></body></html>`;
  return{name:"steering-fixture",resolveId(source){if(source==="/steering-fixture.js")return id;},load(source){if(source===id)return moduleCode;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=="/"){next();return;}res.setHeader("content-type","text/html");res.end(await server.transformIndexHtml("/",html("/steering-fixture.js")));});},generateBundle(_,bundle){const entry=Object.values(bundle).find(item=>item.type==="chunk"&&item.isEntry);const styles=Object.values(bundle).filter(item=>item.fileName.endsWith(".css")).map(item=>`<link rel="stylesheet" href="/${item.fileName}">`).join("");if(entry)this.emitFile({type:"asset",fileName:"index.html",source:html(`/${entry.fileName}`,styles)});}};
}
export async function startSteeringFixture(production=false){
  const first=steeringCenter("A"),second=steeringCenter("B"),centers:string[]=[];
  for(const center of[first,second]){await new Promise<void>(resolve=>center.server.listen(0,"127.0.0.1",resolve));const address=center.server.address();if(!address||typeof address==="string")throw Error("No center address");centers.push(`http://127.0.0.1:${address.port}`);}
  const root=fileURLToPath(new URL("..",import.meta.url)),plugins=[react(),tailwindcss(),fixturePlugin(code(centers))],outDir=production?await mkdtemp(join(tmpdir(),"flow-steering-")):undefined;
  if(production)await build({root,configFile:false,plugins,build:{outDir,emptyOutDir:true,rollupOptions:{input:"/steering-fixture.js"}}});
  const server=production?await preview({root,configFile:false,build:{outDir},preview:{host:"127.0.0.1",port:0}}):await createServer({root,configFile:false,plugins,server:{host:"127.0.0.1",port:0}});
  if("listen"in server)await server.listen();const address=server.httpServer!.address();if(!address||typeof address==="string")throw Error("No preview address");
  return{first,second,centers,url:`http://127.0.0.1:${address.port}`,async close(){await server.close();await Promise.all([first.close(),second.close()]);if(outDir)await rm(outDir,{recursive:true,force:true});}};
}
if(process.argv.includes("--steering-preview")){const fixture=await startSteeringFixture();console.log(`Independent steering HTTP fixture ·0model/DB: ${fixture.url}`);const stop=async()=>{await fixture.close();process.exit();};process.once("SIGINT",stop);process.once("SIGTERM",stop);}
