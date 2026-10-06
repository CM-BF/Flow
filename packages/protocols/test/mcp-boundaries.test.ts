import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import { connectMcp, RemoteOutcomeUncertainError } from '../src/index.js';
const fixture = JSON.parse(await readFile(new URL('./fixtures/mcp-2026.json', import.meta.url), 'utf8'));
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
async function peer(mode: 'taskResult'|'invalidResult'|'protocolError'|'slow'|'large') {
  const methods: string[] = []; const envelopes: Record<string,unknown>[] = []; let disconnected = false;
  let progress!: () => void; const started = new Promise<void>(resolve => { progress=resolve; });
  const server = createServer(async (req,res) => {
    let raw=''; for await (const chunk of req) raw+=chunk.toString(); const body=JSON.parse(raw); methods.push(body.method); envelopes.push(body.params?._meta);
    if(body.method==='tools/call' && mode==='slow') {
      res.writeHead(200, {'Content-Type':'text/event-stream'});
      res.write(`data: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{progressToken:body.params._meta.progressToken,progress:1,total:2}})}\n\n`);
      res.on('close',()=>{ disconnected=true; }); progress(); return;
    }
    const result=body.method==='server/discover'?fixture.discovery:body.method==='tools/list'?fixture.toolList:mode==='large'?{resultType:'complete', content:[{type:'text',text:'x'.repeat(8192)}]}:fixture[mode];
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,...(mode==='protocolError' && body.method==='tools/call'?{error:result}:{result})}));
  });
  servers.push(server); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  return { url:`http://127.0.0.1:${(server.address() as {port:number}).port}/mcp`, methods,envelopes, started, disconnected:()=>disconnected };
}
test('Tasks are detected but not advertised; unsupported result is never accepted as completed', async()=>{
  const remote=await peer('taskResult'); const client=await connectMcp({url:remote.url,allowLoopbackHttp:true,authorizeTool:async()=>true});
  try {
    expect(client.tasks).toEqual({advertised:true,supported:false,reason:'sdk-extension-not-supported'});
    const error=await client.callTool('fixture').catch(error=>error);
    expect(error).toBeInstanceOf(RemoteOutcomeUncertainError); expect(error.cause).toMatchObject({code:'UNSUPPORTED_RESULT_TYPE',data:{resultType:'task'}});
    expect(remote.methods.filter(method=>method==='tools/call')).toHaveLength(1);
    expect(remote.envelopes.every(meta=>!JSON.stringify(meta).includes('io.modelcontextprotocol/tasks'))).toBe(true);
  } finally { await client.close(); }
});
test('HTTP request cancellation closes its stream, sends no legacy cancellation and makes no claim of stopped work', async()=>{
  const remote=await peer('slow'); const client=await connectMcp({url:remote.url,allowLoopbackHttp:true,authorizeTool:async()=>true}); const signal=new AbortController();
  try {
    const pending=client.callTool('fixture',{}, {signal:signal.signal,onprogress:()=>{}}); const rejection=expect(pending).rejects.toBeInstanceOf(RemoteOutcomeUncertainError);
    await remote.started; signal.abort(); await rejection;
    await expect.poll(remote.disconnected).toBe(true);
    expect(remote.methods).not.toContain('notifications/cancelled');
  } finally { await client.close(); }
});
test('malformed and oversized results fail closed, while protocol errors retain their code', async()=>{
  for (const mode of ['invalidResult','large','protocolError'] as const) {
    const remote=await peer(mode); const client=await connectMcp({url:remote.url,allowLoopbackHttp:true,maxResponseBytes:2048,authorizeTool:async()=>true});
    try { const error=await client.callTool('fixture').catch(error=>error); if(mode==='protocolError') expect(error).toMatchObject({code:-32602}); else expect(error).toBeInstanceOf(RemoteOutcomeUncertainError); expect(remote.methods.filter(method=>method==='tools/call')).toHaveLength(1); }
    finally { await client.close(); }
  }
});
