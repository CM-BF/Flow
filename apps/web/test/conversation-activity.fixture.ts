import { createServer as httpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, createServer, preview, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Detail, EventPage, TaskSummary, TimelineEntry } from "@flow/contracts";

export function activityCenter(label: string) {
  const at = "2026-10-06T06:00:00Z";
  const task: TaskSummary = { id: "task", title: "Activity fixture", harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at };
  let entries: TimelineEntry[] = Array.from({ length: 61 }, (_, index) => ({ id: `event-${index + 1}`, cursor: index + 1, createdAt: at,
    ...(index === 0 ? { kind: "reference" as const, reference: { id: "detail-1", title: `${label} execution reference` } } : { kind: "text" as const, text: `${label} activity ${index + 1}` }) }));
  const reads: string[] = [];
  let fail = false, holdEvent = false, holdDetail = false, released: (() => void)[] = [];
  const server = httpServer((request, response) => {
    response.setHeader("access-control-allow-origin", "*"); response.setHeader("access-control-allow-headers", "authorization,content-type");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    const url = new URL(request.url ?? "/", "http://127.0.0.1"); reads.push(url.pathname + url.search);
    const json = (body: unknown, status = 200) => { if (!response.destroyed) { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); } };
    if (request.headers.authorization !== "Bearer flow-fixture-only") { json({ error: { code: "unauthorized", message: "Public fixture token required" } }, 401); return; }
    if (fail) { json({ error: { code: "unavailable", message: "Simulated activity failure" } }, 503); return; }
    if (url.pathname === "/api/tasks/task/events") {
      const after = Number(url.searchParams.get("after") ?? 0), reset = after > entries.length;
      const chunk = reset ? [] : entries.filter(entry => entry.cursor > after).slice(0, 30);
      const nextCursor = reset ? 0 : chunk.at(-1)?.cursor ?? after;
      const page: EventPage = { entries: chunk, task, nextCursor, watermark: entries.length, hasMore: !reset && nextCursor < entries.length,
        pendingDecision: null, usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true }, ...(reset ? { reset: true } : {}) };
      if (holdEvent) { holdEvent = false; released.push(() => json(page)); } else json(page); return;
    }
    if (url.pathname === "/api/conversations/chat/turns/turn/details/detail-1") {
      const detail: Detail = { id: "detail-1", title: "Returned execution reference", kind: "detail", mediaType: "text/plain", content: `${label} detail <script>not executed</script>\n` + "x".repeat(90_000) };
      if (holdDetail) { holdDetail = false; released.push(() => json(detail)); } else json(detail); return;
    }
    json({ error: { code: "not_found", message: "Unrecognized read-only fixture request" } }, 404);
  });
  return { server, reads, task, fail(value: boolean) { fail = value; }, holdNextEvent() { holdEvent = true; }, holdNextDetail() { holdDetail = true; },
    release() { released.splice(0).forEach(send => send()); }, reset() { entries = entries.slice(0, 1).map(value => ({ ...value, id: "reset-event" })); },
    async close() { released = []; server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
function fixtureCode(centers: string[]) {
  return `import React,{useState,useEffect,useMemo} from 'react';
import{createRoot}from'react-dom/client';
import{FlowClient}from'@flow/client';
import{createConversationActivity}from'/src/conversation-activity/projection.ts';
import{ConversationActivity}from'/src/conversation-activity/ConversationActivity.tsx';
import'/src/assistant-ui.css';
import'/src/styles.css';
const h=React.createElement;const centers=${JSON.stringify(centers)};
const baseTask={id:'task',title:'Activity fixture',harness:'claude',status:'running',verificationStatus:'pending',createdAt:'2026-10-06T06:00:00Z',updatedAt:'2026-10-06T06:00:00Z'};
function Fixture(){const[connection,setConnection]=useState(0),[open,setOpen]=useState(false),[online,setOnline]=useState(true),[dark,setDark]=useState(false),[done,setDone]=useState(false);
const projection=useMemo(()=>{const client=new FlowClient({baseUrl:centers[connection%2],token:'flow-fixture-only'});return createConversationActivity({connectionId:String(connection),viewId:'view',conversationId:'chat',turnId:'turn',taskId:'task'},baseTask,{readEvents:after=>client.events('task',after),readDetail:(id,signal)=>client.conversationDetail('chat','turn',id,signal)});},[connection]);
useEffect(()=>()=>projection.dispose(),[projection]);useEffect(()=>projection.setActive(open),[projection,open]);useEffect(()=>projection.setOnline(online),[projection,online]);
useEffect(()=>projection.updateTask(done?{...baseTask,status:'succeeded',updatedAt:'2026-10-06T06:01:00Z'}:baseTask),[projection,done]);
useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark)},[dark]);
return h('main',{style:{maxWidth:'780px',margin:'40px auto',padding:'18px'}},h('h1',null,'Execution activity'),h('p',null,'Independent HTTP fixture · simulated · no model · not connected to product App'),
h('div',{style:{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'20px'}},h('button',{onClick:()=>setDark(!dark)},dark?'Light theme':'Dark theme'),h('button',{onClick:()=>setOnline(!online)},online?'Go offline':'Go online'),h('button',{onClick:()=>{setConnection(connection+1);setDone(false)}},'Switch center'),h('button',{onClick:()=>setDone(true)},'Host completes task')),
h('button',{'aria-expanded':open,onClick:()=>setOpen(!open)},open?'Hide activity':'Show activity'),h(ConversationActivity,{key:connection,projection}));}
createRoot(document.getElementById('root')).render(h(Fixture));`;
}
function fixturePlugin(code: string): Plugin {
  const id = "\0activity-fixture";
  const html = (script: string, styles = "") => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<title>Execution activity · fixture</title></head><body><div id="root"></div><script type="module" src="${script}"></script></body></html>`;
  return { name: "activity-fixture", resolveId(source) { if (source === "/activity-fixture.js") return id; }, load(source) { if (source === id) return code; },
    configureServer(server) { server.middlewares.use(async (request, response, next) => { if (request.url !== "/") { next(); return; }
      response.setHeader("content-type", "text/html"); response.end(await server.transformIndexHtml("/", html("/activity-fixture.js"))); }); },
    generateBundle(_, bundle) { const entry = Object.values(bundle).find(item => item.type === "chunk" && item.isEntry);
      const styles = Object.values(bundle).filter(item => item.fileName.endsWith(".css")).map(item => `<link rel="stylesheet" href="/${item.fileName}">`).join("");
      if (entry) this.emitFile({ type: "asset", fileName: "index.html", source: html(`/${entry.fileName}`, styles) }); } };
}
export async function startActivityFixture(production = false) {
  const first = activityCenter("A"), second = activityCenter("B"), centers: string[] = [];
  for (const center of [first, second]) { await new Promise<void>(resolve => center.server.listen(0, "127.0.0.1", resolve)); const address = center.server.address(); if (!address || typeof address === "string") throw Error("No center address"); centers.push(`http://127.0.0.1:${address.port}`); }
  const root = fileURLToPath(new URL("..", import.meta.url)); const plugins = [react(), tailwindcss(), fixturePlugin(fixtureCode(centers))];
  const outDir = production ? await mkdtemp(join(tmpdir(), "flow-activity-")) : undefined;
  if (production) await build({ root, configFile: false, plugins, build: { outDir, emptyOutDir: true, rollupOptions: { input: "/activity-fixture.js" } } });
  const server = production ? await preview({ root, configFile: false, build: { outDir }, preview: { host: "127.0.0.1", port: 0 } })
    : await createServer({ root, configFile: false, plugins, server: { host: "127.0.0.1", port: 0 } });
  if ("listen" in server) await server.listen();
  const address = server.httpServer!.address(); if (!address || typeof address === "string") throw Error("No fixture address");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, async close() { await server.close(); await Promise.all([first.close(), second.close()]); if (outDir) await rm(outDir, { recursive: true, force: true }); } };
}
if (process.argv.includes("--activity-preview")) { const fixture = await startActivityFixture(); console.log(`Activity standalone · HTTP fixture only · no model: ${fixture.url}`);
  const close = async () => { await fixture.close(); process.exit(); }; process.once("SIGINT", close); process.once("SIGTERM", close); }
