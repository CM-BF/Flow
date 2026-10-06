import { createServer } from 'node:http';
import { expect, test } from 'vitest';
import { AgentCard, Message, SendMessageRequest } from '@a2a-js/sdk';
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
