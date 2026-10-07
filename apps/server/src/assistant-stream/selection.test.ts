import type {FastifyInstance} from 'fastify';
import {registerAssistantStreamRoutes} from './index.js';
import {expect,it} from 'vitest';
import type {Pool} from 'pg';
import {assistantStreamPatches} from './queries.js';
import {canonical,sha256} from '../database.js';
it('filters selected text before LIMIT with matching sentinel and keeps global sequence gaps',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];
 const rows=[1,2,3,4].map(sequence=>{const data={source:'codex.app-server.stream',channel:sequence%2?'reasoning-text':'text',streamId:sequence%2?'r':'t'};return {sequence,data,event_id:'e'+sequence,created_at:new Date(0),payload_digest:sha256(canonical(data))};});
 const client={on(){},removeListener(){},release(){},async query(sql:string,args:unknown[]=[]){calls.push({sql,args});
  if(sql.startsWith('SELECT t.status'))return{rows:[{status:'running',updated_at:new Date(0),completed_at:null,final_id:null}]};
  if(sql.includes('FROM flow.assistant_stream_patches')){
   expect(sql.indexOf('channel')).toBeLessThan(sql.indexOf('LIMIT'));
   return {rows:rows.filter(r=>r.sequence>Number(args[2])&&r.data.channel==='text').slice(0,Number(args[3]))};
  }return{rows:[]};}};
 const pool={connect(cb:Function){cb(null,client);}} as unknown as Pool;
 const first=await assistantStreamPatches(pool,'task','attempt',0,1,'patch-select-v1',{kind:'text'});expect(first).toMatchObject({protocol:'patch-select-v1',selection:{kind:'text'},nextCursor:2,hasMore:true});
 const last=await assistantStreamPatches(pool,'task','attempt',2,1,'patch-select-v1',{kind:'text'});expect(last).toMatchObject({nextCursor:4,hasMore:false});
 expect(first.patches.map(p=>p.sequence)).toEqual([2]);expect(calls[0]!.sql).toContain('REPEATABLE READ READ ONLY');
});
it('binds block selection in SQL and does not change legacy response envelope',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];const client={on(){},removeListener(){},release(){},async query(sql:string,args:unknown[]=[]){calls.push({sql,args});return{rows:sql.startsWith('SELECT t.status')?[{status:'running',updated_at:new Date(0),completed_at:null,final_id:null}]:[]};}};
 const pool={connect(cb:Function){cb(null,client);}} as unknown as Pool;
 const selected=await assistantStreamPatches(pool,'task','attempt',7,8,'patch-select-v1',{kind:'block',streamId:'a'.repeat(64)});
 expect(selected).toMatchObject({selection:{kind:'block',streamId:'a'.repeat(64)},nextCursor:7,hasMore:false});
 const query=calls.find(c=>c.sql.includes('FROM flow.assistant_stream_patches'))!;expect(query.sql).toContain("data->>'streamId'=$6");expect(query.args[5]).toBe('a'.repeat(64));
 const old=await assistantStreamPatches(pool,'task','attempt',7,8,'patch-v2');expect(old).toEqual({taskId:'task',attemptId:'attempt',patches:[],nextCursor:7,hasMore:false});
});

it('rejects selectors under absent, duplicate, unknown and legacy negotiation before database reads',()=>{
 const handlers=new Map<string,(request:{params:{id:string};query:{attemptId:string;selection:string};raw:{rawHeaders:string[]}})=>unknown>();
 const app={get(path:string,handler:(request:{params:{id:string};query:{attemptId:string;selection:string};raw:{rawHeaders:string[]}})=>unknown){handlers.set(path,handler);}};
 const pool={connect(){throw Error('No database read is allowed');}};
 registerAssistantStreamRoutes(app as unknown as FastifyInstance,pool as unknown as Pool);
 const handler=handlers.get('/api/tasks/:id/assistant-stream/patches')!;
 for(const headers of [[],['X-Flow-Assistant-Stream','patch-v1'],['X-Flow-Assistant-Stream','patch-v2'],['X-Flow-Assistant-Stream','unknown'],['X-Flow-Assistant-Stream','patch-select-v1','X-Flow-Assistant-Stream','patch-select-v1']])
  expect(()=>handler({params:{id:'task'},query:{attemptId:'attempt',selection:'text'},raw:{rawHeaders:headers}})).toThrow('explicit negotiation');
});
