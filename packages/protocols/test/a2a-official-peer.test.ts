import { createServer } from 'node:http';
import { expect, test } from 'vitest';
import { AgentCard, Message, SendMessageRequest, Task } from '@a2a-js/sdk';
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler, ServerCallContext } from '@a2a-js/sdk/server';
import { connectA2A } from '../src/index.js';

test('outbound client exchanges direct and streaming messages with the official SDK request handler', async () => {
  let transport: JsonRpcTransportHandler;
  let card: AgentCard;
  const server = createServer(async (req,res) => {
    if(req.method==='GET') { res.setHeader('Content-Type','application/json');res.end(JSON.stringify(AgentCard.toJSON(card)));return; }
    let body='';for await(const chunk of req)body+=chunk.toString();
    const result=await transport.handle(body,new ServerCallContext({requestedVersion:'1.0'}));
    if(Symbol.asyncIterator in result) { res.setHeader('Content-Type','text/event-stream');for await(const item of result)res.write(`data: ${JSON.stringify(item)}\n\n`);res.end(); }
    else { res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result)); }
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  card=AgentCard.fromJSON({name:'official peer',version:'1.3.0',capabilities:{streaming:true},supportedInterfaces:[{url:`${url}/a2a`,protocolBinding:'JSONRPC',protocolVersion:'1.0'}]});
  transport=new JsonRpcTransportHandler(new DefaultRequestHandler(card,new InMemoryTaskStore(),{
    async execute(context,bus) { bus.publish(AgentEvent.message(Message.fromJSON({messageId:'response',contextId:context.contextId,role:'ROLE_AGENT',parts:[{text:'official reply'}]}))); bus.finished(); },
    async cancelTask() { throw new Error('Direct messages have no running task.'); },
  }));
  try {
    const client=await connectA2A({url,allowLoopbackHttp:true});
    const request=SendMessageRequest.fromJSON({message:{messageId:'input',role:'ROLE_USER',parts:[{text:'say reply'}]}});
    const result=await client.send(request);
    expect(result).toMatchObject({messageId:'response',parts:[{content:{$case:'text',value:'official reply'}}]});
    const events=[];for await(const event of client.sendStream(request))events.push(event);
    expect(events).toHaveLength(1);expect(events[0]?.payload?.$case).toBe('message');
  } finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

test('explicit history selection preserves optional zero on HTTP and leaves status and artifacts complete', async () => {
  const store = new InMemoryTaskStore();
  const context = new ServerCallContext({ requestedVersion: '1.0' });
  const exchanges: { params: Record<string, unknown>; responseBytes: number; hasHistory: boolean }[] = [];
  let transport: JsonRpcTransportHandler;
  let card: AgentCard;
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') { response.end(JSON.stringify(AgentCard.toJSON(card))); return; }
    let raw = ''; for await (const chunk of request) raw += chunk.toString();
    const body = JSON.parse(raw);
    const result = await transport.handle(raw, context);
    const serialized = JSON.stringify(result);
    exchanges.push({ params: body.params, responseBytes: Buffer.byteLength(serialized, 'utf8'), hasHistory: Object.hasOwn(JSON.parse(serialized).result ?? {}, 'history') });
    response.end(serialized);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  card = AgentCard.fromJSON({ name: 'history selection peer', version: '1.3.0', capabilities: { streaming: false }, supportedInterfaces: [{ url: `${url}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }] });
  transport = new JsonRpcTransportHandler(new DefaultRequestHandler(card, store, {
    async execute() { throw new Error('This test only reads stored tasks.'); },
    async cancelTask() { throw new Error('This test does not cancel tasks.'); },
  }));
  try {
    const peer = await connectA2A({ url, allowLoopbackHttp: true });
    const metrics = [];
    for (const historyCount of [1, 1024]) {
      const task = Task.fromJSON({ id: 'history-task', contextId: 'history-context', status: { state: 'TASK_STATE_COMPLETED' },
        history: Array.from({ length: historyCount }, (_, index) => ({ messageId: `message-${index}`, role: 'ROLE_AGENT', parts: [{ text: '历史内容🙂'.repeat(128) }] })),
        artifacts: [{ artifactId: 'complete-result', parts: [{ text: '完整材料🙂'.repeat(1024) }] }] });
      await store.save(task, context);
      const full = await peer.snapshot(task.id);
      const fullExchange = exchanges.at(-1)!;
      const selected = await peer.snapshot({ id: task.id, historyLength: 0 });
      const zeroExchange = exchanges.at(-1)!;
      const recent = await peer.snapshot({ id: task.id, historyLength: 2 });
      expect(full.history).toEqual(task.history);
      expect(fullExchange.params).toEqual({ id: task.id });
      expect(zeroExchange.params).toEqual({ id: task.id, historyLength: 0 });
      expect(zeroExchange.hasHistory).toBe(false);
      expect(selected.history).toEqual([]);
      expect({ ...selected, history: full.history }).toEqual(full);
      expect(selected.artifacts).toEqual(task.artifacts);
      expect(recent.history).toEqual(task.history.slice(-2));
      expect(exchanges.at(-1)!.params).toEqual({ id: task.id, historyLength: 2 });
      expect(zeroExchange.responseBytes).toBeLessThan(fullExchange.responseBytes);
      metrics.push({ historyCount, fullBytes: fullExchange.responseBytes, zeroBytes: zeroExchange.responseBytes });
    }
    expect(metrics[1]!.zeroBytes).toBe(metrics[0]!.zeroBytes);
    console.info('P03_OFFICIAL_HISTORY_BYTES', JSON.stringify(metrics));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
