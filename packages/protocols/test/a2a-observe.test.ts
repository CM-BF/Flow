import { createServer } from 'node:http';
import { expect, test } from 'vitest';
import { AgentCard, Task } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler, ServerCallContext } from '@a2a-js/sdk/server';
import { connectA2A } from '../src/index.js';

for (const initiallyTerminal of [true,false]) test(`official peer observe reconciles ${initiallyTerminal?'already terminal snapshot':'GET/subscribe terminal race'}`,async()=>{
  const methods:string[]=[];const snapshots:Record<string,unknown>[]=[];const store=new InMemoryTaskStore();const context=new ServerCallContext({requestedVersion:'1.0'});
  const history=[{messageId:'prior',role:'ROLE_AGENT',parts:[{text:'Keep default observation history.'}]}];
  const task=(state:string)=>Task.fromJSON({id:'t1',contextId:'c1',status:{state},history});
  await store.save(task(initiallyTerminal?'TASK_STATE_COMPLETED':'TASK_STATE_WORKING'),context);
  let transport:JsonRpcTransportHandler;let card:AgentCard;
  const server=createServer(async(req,res)=>{
    if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(AgentCard.toJSON(card)));return;}
    let raw='';for await(const chunk of req)raw+=chunk.toString();const body=JSON.parse(raw);methods.push(body.method);
    if(body.method==='GetTask')snapshots.push(body.params);
    if(body.method==='SubscribeToTask')await store.save(task('TASK_STATE_COMPLETED'),context);
    const result=await transport.handle(raw,context);
    if(Symbol.asyncIterator in result){res.setHeader('Content-Type','text/event-stream');try{for await(const item of result)res.write(`data: ${JSON.stringify(item)}\n\n`);}catch(error){res.write(`data: ${JSON.stringify({jsonrpc:'2.0',id:body.id,error:JsonRpcTransportHandler.mapToJSONRPCError(error)})}\n\n`);}res.end();}
    else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  card=AgentCard.fromJSON({name:'official-terminal-peer',version:'1.3.0',capabilities:{streaming:true},supportedInterfaces:[{url:`${url}/a2a`,protocolBinding:'JSONRPC',protocolVersion:'1.0'}]});
  transport=new JsonRpcTransportHandler(new DefaultRequestHandler(card,store,{async execute(){throw new Error('No execution expected');},async cancelTask(){throw new Error('No cancellation expected');}}));
  try{
    const client=await connectA2A({url,allowLoopbackHttp:true});const events=[];for await(const event of client.observe('t1'))events.push(event);
    expect(events.at(-1)?.payload).toMatchObject({$case:'task',value:{status:{state:3}}});
    expect(methods).toEqual(initiallyTerminal?['GetTask']:['GetTask','SubscribeToTask','GetTask']);
    expect(snapshots).toEqual(initiallyTerminal?[{id:'t1'}]:[{id:'t1'},{id:'t1'}]);
    for(const event of events)if(event.payload?.$case==='task')expect(event.payload.value.history).toEqual(task('TASK_STATE_COMPLETED').history);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
