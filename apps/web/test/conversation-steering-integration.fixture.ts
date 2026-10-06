import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { steeringCommandSchema, type SteeringCommandReference, type SteeringCommandResult } from "@flow/contracts";
import { startStreamPreview } from "./conversation-stream-integration.fixture";

/** Adds only public steering HTTP to the existing real App/queue/stream fixture. No provider runs. */
export async function startSteeringIntegration(production=false) {
  const preview=await startStreamPreview(production);
  const calls:{center:number;taskId:string;method:string;path:string;body:string;key:string}[]=[];
  const rows=new Map<string,SteeringCommandReference[]>(),saved=new Map<string,{body:string;result:SteeringCommandResult}>();
  let lose=false,disabled=false,hold=false,rejectRetries=false;let releases:(()=>void)[]=[];
  for(const [center,fixture] of [preview.first,preview.second].entries()){
    preview.streams[center]!.seed(fixture.chats.get("chat-3")!.turns[0]!);
    const handler=fixture.server.listeners("request")[0] as (req:IncomingMessage,res:ServerResponse)=>void;
    fixture.server.removeAllListeners("request");fixture.server.on("request",async(req,res)=>{
      const url=new URL(req.url??"/","http://fixture"),match=/^\/api\/tasks\/([^/]+)\/steering(\/admission)?$/.exec(url.pathname);
      if(!match){handler(req,res);return;}
      res.setHeader("access-control-allow-origin","*");res.setHeader("access-control-allow-methods","GET,POST,OPTIONS");res.setHeader("access-control-allow-headers","authorization,content-type,idempotency-key");if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
      const json=(value:unknown,status=200)=>{if(!res.destroyed){res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(value));}};
      const error=(message:string,status=409)=>json({error:{code:"steering_fixture",message}},status);
      if(req.headers.authorization!=="Bearer flow-fixture-only"){error("Public fixture token required",401);return;}
      const taskId=decodeURIComponent(match[1]!),taskKey=`${center}:${taskId}`,attemptId=`${taskId}-attempt`;
      let body="";for await(const chunk of req)body+=chunk;const key=String(req.headers["idempotency-key"]??"");calls.push({center,taskId,method:req.method!,path:url.pathname+url.search,body,key});
      if(!rows.has(taskKey))rows.set(taskKey,[]);const commands=rows.get(taskKey)!;
      if(match[2]){const pending=commands.some(row=>["accepted","received","unknown"].includes(row.status));const ended=fixture.tasks.get(taskId)?.status!=="running";json({taskId,attemptId,ownerVersion:1,revision:commands.length,state:disabled||pending||ended?"unavailable":"ready",reason:disabled?"disabled":ended?"not-running":pending?"pending":"ready"});return;}
      if(req.method==="GET"){const after=Number(url.searchParams.get("after")??0),limit=Number(url.searchParams.get("limit")??20),page=commands.filter(row=>row.revision>after);json({taskId,attemptId,revision:commands.length,sealed:false,attemptAvailable:true,commands:page.slice(0,limit),nextCursor:page.length>limit?page[limit-1]!.revision:null});return;}
      const prior=saved.get(`${center}:${key}`);if(rejectRetries){error("Attempt no longer available");return;}
      if(prior){if(prior.body!==body){error("Request changed");return;}json({...prior.result,replayed:true},202);return;}
      let input;try{input=steeringCommandSchema.parse(JSON.parse(body));}catch{error("Invalid command",400);return;}
      if(disabled||input.attemptId!==attemptId||input.ownerVersion!==1||input.expectedRevision!==commands.length||commands.some(row=>["accepted","received","unknown"].includes(row.status))){error("Refresh authoritative admission");return;}
      const at=new Date().toISOString(),command:SteeringCommandReference={id:randomUUID(),taskId,attemptId,ownerVersion:1,nativeSessionId:`center-${center}-native`,revision:commands.length+1,userMessageUuid:randomUUID(),status:"accepted",receiptRevision:0,input:{bytes:Buffer.byteLength(input.text),digest:createHash("sha256").update(input.text).digest("hex")},createdAt:at,updatedAt:at};
      const result={command,replayed:false};commands.push(command);saved.set(`${center}:${key}`,{body,result});
      if(lose){lose=false;error("Fixture response lost after durable acceptance",503);return;}
      if(hold){hold=false;releases.push(()=>json(result,202));return;}json(result,202);
    });
  }
  return{...preview,calls,loseNext(){lose=true;},holdNext(){hold=true;},release(){releases.splice(0).forEach(fn=>fn());},disable(value:boolean){disabled=value;},rejectRetries(value:boolean){rejectRetries=value;},
    consume(taskId:string,center=0){const key=`${center}:${taskId}`;rows.set(key,(rows.get(key)??[]).map(row=>({...row,status:"observed-consumed",receiptRevision:2})));},
    close:async()=>{releases=[];await preview.close();}};
}
if(process.argv.includes("--steering-app-preview")){const p=await startSteeringIntegration(process.argv.includes("--production"));console.log(`Steering actual App HTTP fixture (no model/DB): ${p.url}`);console.log(`Centers ${p.centers.join(", ")}; public token flow-fixture-only`);const stop=async()=>{await p.close();process.exit();};process.once("SIGINT",stop);process.once("SIGTERM",stop);}
