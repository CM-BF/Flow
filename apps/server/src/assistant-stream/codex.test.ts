import { expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { CodexAssistantStream } from '../../../runner/src/native-harness/codex/stream.js';
import { saveAssistantStream } from './store.js';
import { readAssistantStream } from './queries.js';
import { settleAssistantStream } from './settlement.js';
const task={id:'task',submission:{harness:'codex'}} as TaskRecord, attempt={id:'attempt',runner_id:'runner',native_session_id:'thread'} as AttemptRecord;
const input={kind:'text' as const,threadId:'thread',turnId:'turn',itemId:'item',index:null,delta:'中文🙂'};
it('requires source/session/harness before accepting a durable patch, including replay', async () => {
  const data=new CodexAssistantStream().accept(input)[0]!; const calls:{sql:string;args:unknown[]}[]=[];
  const client={async query(sql:string,args:unknown[]=[]){calls.push({sql,args});if(sql.includes('flow.sessions'))return {rowCount:1,rows:[]};
    if(sql.includes('payload_digest'))return {rows:[{attempt_id:'attempt',payload_digest:(await import('../database.js')).sha256((await import('../database.js')).canonical(data))}]};throw Error('unexpected query');}} as unknown as PoolClient;
  const event={...data,id:'event',sequence:1};
  await expect(saveAssistantStream(client,{...task,submission:{...task.submission,harness:'claude'}},attempt,event)).rejects.toMatchObject({code:'stream_session'});
  await expect(saveAssistantStream(client,task,{...attempt,native_session_id:'other'},event)).rejects.toMatchObject({code:'stream_session'});
  expect(calls).toHaveLength(0);
  await expect(saveAssistantStream(client,task,attempt,event)).resolves.toBeNull();
  expect(calls[0]!.sql).toContain('harness=$4');expect(calls[0]!.args).toEqual(['thread','runner','task','codex']);
  await expect(saveAssistantStream(client,task,attempt,{...event,nativeTurnId:'wrong'})).rejects.toMatchObject({code:'stream_identity'});
});
it('selects compatible metadata before LIMIT and rejects a cursor hidden from the old reader', async () => {
  const calls:{sql:string;args:unknown[]}[]=[];
  const rows=[{id:'a',header:{source:'codex.app-server.stream'},first_sequence:1},{id:'b',header:{source:'claude.sdk.stream'},first_sequence:2},{id:'c',header:{source:'claude.sdk.stream'},first_sequence:3}]
    .map(row=>({...row,task_id:'task',attempt_id:'attempt',last_sequence:row.first_sequence,bytes:0,created_at:new Date(0),updated_at:new Date(0)}));
  const client={async query(sql:string,args:unknown[]=[]){calls.push({sql,args});
    if(sql.startsWith('SELECT current_attempt'))return {rows:[{current_attempt_id:'attempt',status:'running',updated_at:new Date(0)}]};
    if(sql.startsWith('SELECT t.status'))return {rows:[{status:'running',completed_at:null,final_id:null}]};
    if(sql.startsWith('SELECT first_sequence'))return {rows:[]};
    if(sql.startsWith('SELECT * FROM flow.assistant_stream_blocks')){expect(sql.indexOf("header->>'source'")).toBeLessThan(sql.indexOf('LIMIT'));return {rows:rows.filter(x=>(args[4] as string[]).includes(x.header.source)).slice(0,Number(args[3]))};}
    if(sql.startsWith('SELECT data FROM'))return {rows:[]};throw Error('unexpected query');}} as unknown as PoolClient;
  const old=await readAssistantStream(client,'task',1);expect(old.blocks.map(x=>x.id)).toEqual(['b']);expect(old.nextCursor).toBe('b');
  const next=await readAssistantStream(client,'task',1,undefined,'patch-v2');expect(next.blocks.map(x=>x.id)).toEqual(['a']);expect(next.nextCursor).toBe('a');
  await expect(readAssistantStream(client,'task',1,'a')).rejects.toMatchObject({code:'stream_cursor'});
  expect(calls.at(-1)!.args[3]).toEqual(['claude.sdk.stream']);
});
it('replaces only the exact final text item and retains published reasoning and earlier messages', async () => {
  const blocks=[['final','text','item'],['earlier','text','earlier'],['reasoning','reasoning-summary','reasoning']].map(([id,channel,item])=>({id,first_sequence:1,header:{source:'codex.app-server.stream',nativeTurnId:'turn',nativeMessageId:item,channel,phase:'block-complete'}}));
  let settlement:unknown;
  const client={async query(sql:string,args:unknown[]=[]){
    if(sql.startsWith('SELECT * FROM flow.assistant_stream_blocks'))return {rows:blocks};
    if(sql.startsWith('SELECT sequence')||sql.startsWith('SELECT tool_use_id'))return {rows:[]};
    if(sql.startsWith('SELECT native_source_identity'))return {rows:[{native_source_identity:{turnId:'turn',itemId:'item'}}]};
    if(sql.startsWith('INSERT')){settlement=args[3];return {rows:[]};}throw Error('unexpected query');}} as unknown as PoolClient;
  await settleAssistantStream(client,task,attempt,'final-message');
  expect(settlement).toMatchObject({replaceStreamIds:['final'],retainStreamIds:['earlier','reasoning']});
});
