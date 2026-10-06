import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { nativeActivityDataSchema, MAX_ACTIVITY_DETAIL_BYTES } from '../../../../packages/contracts/src/native-activity.js';
import { mapNativeActivity } from './index.js';
const frame = (value: unknown) => value as SDKMessage;
const assistant = (content: unknown[], extra = {}) => frame({ type: 'assistant', uuid: 'source', session_id: 'session', parent_tool_use_id: null, message: { id: 'message', content }, ...extra });
const user = (content: unknown[], extra = {}) => frame({ type: 'user', uuid: 'result', session_id: 'session', parent_tool_use_id: null, message: { content }, ...extra });
it('maps all complete text, thinking and tool blocks without confusing input completion with execution', () => {
  const events = mapNativeActivity(assistant([{ type:'text',text:'中文 🌱' }, { type:'thinking',thinking:'public reasoning',signature:'OPAQUE' }, { type:'tool_use',id:'tool1',name:'Read',input:{file_path:'/synthetic'} }]), 'session');
  expect(events.map(event => [event.kind,event.phase,event.blockIndex])).toEqual([['assistant-text','observed',0],['thinking','observed',1],['tool','input-ready',2]]);
  expect(events[2]?.body?.content).toBe('{"file_path":"/synthetic"}');
  expect(JSON.stringify(events)).not.toContain('OPAQUE');
  for (const event of events) expect(nativeActivityDataSchema.safeParse(event).success).toBe(true);
});
it('keeps redacted and missing thinking explicit without retaining signatures or opaque unknown payloads', () => {
  expect(mapNativeActivity(assistant([{type:'text',text:'hello'}]), 'session')).toHaveLength(1);
  const events=mapNativeActivity(assistant([{type:'redacted_thinking',data:'SECRET'},{type:'future_block',opaque:'SECRET'}]), 'session');
  expect(events[0]).toMatchObject({kind:'thinking',phase:'redacted',body:null});
  expect(events[1]).toMatchObject({kind:'unsupported',phase:'observed'});
  expect(JSON.stringify(events)).not.toContain('SECRET');
});
it('maps progress, results, failure and detached result independently', () => {
  const progress=mapNativeActivity(frame({type:'tool_progress',uuid:'p',session_id:'session',parent_tool_use_id:'parent',tool_use_id:'tool1',tool_name:'Read',elapsed_time_seconds:1.2}), 'session');
  expect(progress[0]).toMatchObject({phase:'running',parentToolUseId:'parent',toolUseId:'tool1'});
  const ok=mapNativeActivity(user([{type:'tool_result',tool_use_id:'tool1',content:'done'}]),'session');
  expect(ok[0]).toMatchObject({phase:'succeeded',toolUseId:'tool1'});
  expect(mapNativeActivity(user([{type:'tool_result',tool_use_id:'tool1',is_error:true,content:'denied'}]),'session')[0]?.phase).toBe('failed');
  expect(mapNativeActivity(user([{type:'tool_result',tool_use_id:'tool1',content:'detached'}],{tool_use_result:{detachedToolCall:true}}),'session')[0]?.phase).toBe('running');
});
it('uses stable per-block identities, retains parent linkage, rejects crossed sessions and ignores replay/input/partials', () => {
  const input=assistant([{type:'text',text:'a'},{type:'text',text:'b'}],{parent_tool_use_id:'parent'});
  const a=mapNativeActivity(input,'session'); expect(a).toEqual(mapNativeActivity(input,'session')); expect(a[0]?.activityId).not.toBe(a[1]?.activityId);
  expect(a[0]?.parentToolUseId).toBe('parent');
  expect(()=>mapNativeActivity(input,'wrong')).toThrow(/session/i);
  expect(mapNativeActivity(user([{type:'tool_result',tool_use_id:'old',content:'history'}],{isReplay:true}),'session')).toEqual([]);
  expect(mapNativeActivity(user([{type:'text',text:'user prompt'}]),'session')).toEqual([]);
  expect(mapNativeActivity(frame({type:'stream_event'}),'session')).toEqual([]);
  expect(mapNativeActivity(assistant([{type:'text',text:'unattributed'}],{uuid:undefined}),'session')).toEqual([]);
});
it('bounds UTF-8 details with honest full-content digest and truncation metadata', () => {
  const text='🌱'.repeat(MAX_ACTIVITY_DETAIL_BYTES);
  const body=mapNativeActivity(assistant([{type:'text',text}]),'session')[0]?.body;
  expect(body?.originalBytes).toBe(Buffer.byteLength(text)); expect(body?.truncated).toBe(true);
  expect(Buffer.byteLength(body!.content)).toBeLessThanOrEqual(MAX_ACTIVITY_DETAIL_BYTES);
  expect(body!.content).not.toContain('�'); expect(body?.sha256).toBe(createHash('sha256').update(text).digest('hex'));
});
