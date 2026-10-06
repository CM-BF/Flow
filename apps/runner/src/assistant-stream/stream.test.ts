import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { AssistantTextAccumulator } from './index.js';
const frame = (event: object, parent_tool_use_id: string | null = null): SDKMessage => ({ type:'stream_event',event,uuid:randomUUID(),session_id:'session-stream',parent_tool_use_id } as unknown as SDKMessage);
const begin = (id: string) => frame({type:'message_start',message:{id,content:[]}});
const block = (index=0) => frame({type:'content_block_start',index,content_block:{type:'text',text:''}});
const delta = (text:string,index=0) => frame({type:'content_block_delta',index,delta:{type:'text_delta',text}});
test('root text survives full single-block frames arriving before stop without double append', () => {
  const stream=new AssistantTextAccumulator();
  stream.observe(begin('native-message')); stream.observe(block()); stream.observe(delta('你好🙂'));
  const patches=stream.flush();
  expect(patches).toHaveLength(1); expect(patches[0]).toMatchObject({text:'你好🙂',fromBytes:0,revision:1,phase:'streaming',nativeMessageId:'native-message'});
  expect(stream.observe({type:'assistant',uuid:'full-wire',session_id:'session-stream',parent_tool_use_id:null,message:{id:'native-message',content:[{type:'text',text:'你好🙂'}]}} as unknown as SDKMessage)).toEqual([]);
  const ended=stream.observe(frame({type:'content_block_stop',index:0}));
  expect(ended).toHaveLength(1); expect(ended[0]).toMatchObject({text:'',fromBytes:10,revision:2,phase:'block-complete'});
});

test('preserves text before tools, later root messages and multiple text block indexes; excludes children/thinking',()=>{
  const stream=new AssistantTextAccumulator();const output=[];
  for(const id of ['before-tool','after-tool']){
    output.push(...stream.observe(begin(id)));
    for(const index of [1,3]){
      stream.observe(block(index));stream.observe(delta(`${id}:${index}`,index));
      output.push(...stream.observe(frame({type:'content_block_stop',index})));
    }
    output.push(...stream.observe(frame({type:'message_stop'})));
  }
  stream.observe(frame({type:'message_start',message:{id:'child',content:[]}},'tool-parent'));
  stream.observe(frame({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'HIDDEN_CHILD'}},'tool-parent'));
  stream.observe(begin('hidden'));stream.observe(frame({type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}}));
  stream.observe(frame({type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'HIDDEN_THINKING'}}));
  output.push(...stream.finish());
  expect(output.map(patch=>patch.text)).toEqual(['before-tool:1','before-tool:3','after-tool:1','after-tool:3']);
  expect(new Set(output.map(patch=>patch.streamId)).size).toBe(4);
});

test('handles duplicate wire identity, abort and superseded complete blocks without declaring turn success',()=>{
  const stream=new AssistantTextAccumulator();stream.observe(begin('first'));stream.observe(block());
  const same=delta('unfinished');stream.observe(same);stream.observe(same);
  const full={type:'assistant',uuid:'first-wire',session_id:'session-stream',parent_tool_use_id:null,message:{id:'first',content:[{type:'text',text:'unfinished'}]},aborted:true} as unknown as SDKMessage;
  const abort=stream.observe(full);expect(abort).toHaveLength(1);expect(abort[0]).toMatchObject({text:'unfinished',phase:'incomplete',reason:'aborted'});
  expect(stream.observe(frame({type:'content_block_stop',index:0}))).toEqual([]);
  stream.observe(begin('replacement'));stream.observe(block());stream.observe(delta('replacement'));
  const replacement={type:'assistant',uuid:'replacement-wire',session_id:'session-stream',parent_tool_use_id:null,supersedes:['first-wire','tool-result-wire'],message:{id:'replacement',content:[{type:'text',text:'replacement'}]}} as unknown as SDKMessage;
  const replaced=stream.observe(replacement);expect(replaced[0]).toMatchObject({text:'',phase:'superseded',reason:'superseded',nativeMessageId:'first'});
  expect(stream.observe(replacement)).toEqual([]);
});

test('bounds sealed UTF-8 patches and attempt content, with explicit truncation',()=>{
  const stream=new AssistantTextAccumulator();stream.observe(begin('large'));stream.observe(block());
  const patches=stream.observe(delta('🙂'.repeat(300000)));
  expect(patches.length).toBe(128);expect(patches.every(patch=>Buffer.byteLength(patch.text)<=8192 && !patch.text.includes('�'))).toBe(true);
  expect(patches.reduce((sum,patch)=>sum+Buffer.byteLength(patch.text),0)).toBe(1048576);
  expect(patches.at(-1)).toMatchObject({phase:'incomplete',reason:'truncated',truncated:true});
});

test('missing start and a conflicting full block fail closed without inventing source identity',()=>{
  const stream=new AssistantTextAccumulator();expect(stream.observe(delta('missing'))).toEqual([]);
  stream.observe(begin('known'));stream.observe(block());stream.observe(delta('prefix'));
  const mismatch=stream.observe({type:'assistant',uuid:'different',session_id:'session-stream',parent_tool_use_id:null,message:{id:'known',content:[{type:'text',text:'a different final block'}]}} as unknown as SDKMessage);
  expect(mismatch[0]).toMatchObject({text:'prefix',phase:'incomplete',reason:'source-mismatch'});
});

import { coalesceAssistantStream } from './index.js';
import { setTimeout as sleep } from 'node:timers/promises';
test('timer emits text while SDK next is pending, and keeps only one provider read outstanding',async()=>{
  let release=()=>{};const hold=new Promise<void>(resolve=>release=resolve);let reads=0;
  async function* source(){yield begin('timed');yield block();yield delta('visible now');reads++;await hold;yield frame({type:'content_block_stop',index:0});}
  const iterator=coalesceAssistantStream(source(),new AbortController().signal);
  let patch;
  try{for(let index=0;index<5;index++){const next=await iterator.next();if(next.value?.kind==='patch'){patch=next.value.patch;break;}}}
  finally{release();await iterator.return(undefined);}
  expect(patch).toMatchObject({text:'visible now',phase:'streaming'});expect(reads).toBe(1);
});
test('normal close and ordinary failure flush known text as incomplete; cancellation returns promptly',async()=>{
  for(const failure of [false,true]){
    async function* source(){yield begin(`close-${failure}`);yield block();yield delta('retained');if(failure)throw new Error('synthetic failure');}
    const output=[];try{for await(const item of coalesceAssistantStream(source(),new AbortController().signal))if(item.kind==='patch')output.push(item.patch);}catch(error){expect(String(error)).toContain('synthetic failure');}
    expect(output[0]).toMatchObject({text:'retained',phase:'incomplete',reason:'stream-ended'});
  }
  const controller=new AbortController();let resolvePending=()=>{};
  const pending=new Promise<IteratorResult<SDKMessage>>(resolve=>resolvePending=()=>resolve({done:true,value:undefined}));
  const source={ [Symbol.asyncIterator](){return {next:()=>pending};} };
  const reading=coalesceAssistantStream(source,controller.signal).next();controller.abort(new Error('cancelled'));
  await expect(reading).rejects.toThrow('cancelled');resolvePending();
});

test('seals buffered text before the actual root tool boundary and leaves child tools out',async()=>{
  const tool={type:'assistant',uuid:'tool-wire',session_id:'session-stream',parent_tool_use_id:null,message:{id:'tool-message',content:[{type:'tool_use',id:'tool-order',name:'Read',input:{}}]}} as unknown as SDKMessage;
  async function* source(){yield begin('before-tool');yield block();yield delta('buffered prefix');yield tool;}
  const output=[];for await(const item of coalesceAssistantStream(source(),new AbortController().signal))output.push(item);
  const patch=output.findIndex(item=>item.kind==='patch'&&item.patch.text==='buffered prefix');
  const marker=output.findIndex(item=>item.kind==='marker'&&item.patch.kind==='tool-boundary');
  const original=output.findIndex(item=>item.kind==='frame'&&String(item.frame.uuid)==='tool-wire');
  expect(patch).toBeGreaterThan(-1);expect(marker).toBeGreaterThan(patch);expect(original).toBeGreaterThan(marker);
});

test('late aborted complete frame makes a uniquely identified stopped block incomplete',()=>{
  const stream=new AssistantTextAccumulator();stream.observe(begin('late-abort'));stream.observe(block());stream.observe(delta('partial'));
  stream.observe(frame({type:'content_block_stop',index:0}));
  const observed=stream.observe({type:'assistant',uuid:randomUUID(),session_id:'session-stream',parent_tool_use_id:null,aborted:true,message:{id:'late-abort',content:[{type:'text',text:'partial'}]}} as unknown as SDKMessage);
  expect(observed[0]).toMatchObject({phase:'incomplete',reason:'aborted',text:''});
});
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
test('contract rejects contradictory block completion flags and non-scalar/NUL text before storage',()=>{
  const stream=new AssistantTextAccumulator();stream.observe(begin('schema'));stream.observe(block());stream.observe(delta('text'));
  const patch={...stream.flush()[0],id:randomUUID(),sequence:1};
  expect(runnerEventSchema.safeParse({...patch,phase:'block-complete',reason:'aborted'}).success).toBe(false);
  expect(runnerEventSchema.safeParse({...patch,text:'\u0000'}).success).toBe(false);
  expect(runnerEventSchema.safeParse({...patch,text:'\ud800'}).success).toBe(false);
});
test('a missing complete block frame cannot silently certify a possibly gapped prefix',()=>{
  const stream=new AssistantTextAccumulator();stream.observe(begin('missing-complete'));stream.observe(block());stream.observe(delta('observed'));
  const stopped=stream.observe(frame({type:'content_block_stop',index:0}));
  expect(stopped[0]).toMatchObject({phase:'incomplete',reason:'source-gap',text:'observed'});
});
