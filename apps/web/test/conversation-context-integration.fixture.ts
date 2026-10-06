import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { KnowledgeCitation, KnowledgeSearchHit } from "@flow/contracts";
import { startStreamPreview } from "./conversation-stream-integration.fixture";
export const contextText = "Fixed project knowledge <script>not executable</script> 🙂";
const at = "2026-10-06T08:00:00Z";
export function contextHit(projectId = "project-01", n = 1): KnowledgeSearchHit {
  const id = `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  return { source: { id, projectId, title: `Source ${n}`, currentVersion: 1, createdAt: at, updatedAt: at }, citation: { projectId, sourceId: id, version: 1, contentDigest: createHash("sha256").update(contextText).digest("hex"), locator: { kind: "utf8-bytes", start: 0, end: Buffer.byteLength(contextText) } }, excerpt: { text: "Fixed project", locator: { kind: "utf8-bytes", start: 0, end: 13 } }, matchKind: "literal", rank: 1 };
}
export function contextReceipt(knowledge: readonly KnowledgeCitation[] = []) {
  return { id: "context", contextDigest: "a".repeat(64), executionInputId: "input", executionInputDigest: "b".repeat(64), templateVersion: 1 as const,
    sources: knowledge.map(citation => ({ citation, byteLength: citation.locator.end - citation.locator.start, currentVersionAtFreeze: citation.version, isCurrentAtFreeze: true })) };
}
export async function startContextPreview(production = false) {
  const preview = await startStreamPreview(production);
  const reads: { center: number; kind: string; project?: string }[] = [];
  let loseCreate = false, badAck = false, unsupported = false, delay = 0, empty = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  for (const [center, fixture] of [preview.first,preview.second].entries()) {
    const handler = fixture.server.listeners("request")[0] as (req: IncomingMessage,res: ServerResponse)=>void;
    fixture.server.removeAllListeners("request");
    fixture.server.on("request", async(req,res)=>{
      const url=new URL(req.url??"/","http://fixture");
      const json=(value:unknown,status=200)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*"});res.end(JSON.stringify(value));};
      if(req.method==="GET"&&url.pathname==="/api/projects"){
        reads.push({center,kind:"projects"});const after=url.searchParams.get("after")??"";
        const projects=Array.from({length:42},(_,i)=>({id:`project-${String(i+1).padStart(2,"0")}`,workspaceId:"workspace",title:i<2?"Shared name":`Project ${i+1}`,revision:1,createdAt:at,updatedAt:at})).filter(p=>p.id>after);
        json({projects:empty?[]:projects.slice(0,40),nextCursor:!empty&&projects.length>40?projects[39]!.id:null});return;
      }
      const route=/^\/api\/projects\/([^/]+)\/knowledge\/(search|resolve)$/.exec(url.pathname);
      if(route){
        const project=decodeURIComponent(route[1]!);reads.push({center,kind:route[2]!,project});
        let body="";for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):{};
        const result=route[2]==="search"?{hits:[contextHit(project),contextHit(project,2)],hasMore:false}:{citation:input.citation??input,text:contextText,isCurrent:true,currentVersion:1};
        const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)json(result);},delay);timers.add(timer);return;
      }
      if(url.pathname.startsWith("/api/conversations")){
        const end=res.end.bind(res);
        res.end=((chunk:unknown)=>{
          let value;try{value=JSON.parse(String(chunk));}catch{return end(chunk as string);}
          const key=String(req.headers["idempotency-key"]??"");const request=fixture.requests.findLast(item=>item.key===key&&item.method===req.method);const input=request?.body?JSON.parse(request.body):{};
          if(value.capabilities){value.capabilities.knowledgeContext=!unsupported&&!!value.conversation?.projectId;const chat=fixture.chats.get(value.conversation?.id);if(chat)chat.snapshot.capabilities={...chat.snapshot.capabilities,knowledgeContext:value.capabilities.knowledgeContext};}
          if(req.method==="POST"&&(value.turn||value.item)&&input.knowledge!==undefined){const context=contextReceipt(input.knowledge);if(value.turn){value.turn.context=context;const turn=fixture.chats.get(value.turn.conversationId)?.turns.find(t=>t.id===value.turn.id);if(turn)turn.context=context;}else value.item.context=context;if(badAck){badAck=false;delete(value.turn??value.item).context;}}
          if(req.method==="POST"&&url.pathname==="/api/conversations"&&loseCreate){loseCreate=false;req.socket.destroy();return res;}
          return end(JSON.stringify(value));
        })as typeof res.end;
      }
      handler(req,res);
    });
  }
  return {...preview,reads,loseCreate(){loseCreate=true;},badAck(){badAck=true;},unsupported(value:boolean){unsupported=value;},delay(ms:number){delay=ms;},empty(value:boolean){empty=value;},close:async()=>{timers.forEach(clearTimeout);await preview.close();}};
}
if(process.argv.includes("--context-preview")){const p=await startContextPreview();console.log(`Knowledge UI HTTP fixture · no model/DB: ${p.url}`);console.log(`Centers ${p.centers.join(", ")}; public token flow-fixture-only`);const stop=async()=>{await p.close();process.exit();};process.once("SIGINT",stop);process.once("SIGTERM",stop);}
