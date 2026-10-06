import { createHash } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { MAX_ACTIVITY_DETAIL_BYTES, nativeActivityDataSchema, type NativeActivityBody, type NativeActivityData } from '../../../../packages/contracts/src/native-activity.js';
import { NATIVE_ACTIVITY_BODY_LIMITS, type NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' ? value as ObjectValue : {};
function body(content: string, mediaType: NativeActivityBody['mediaType']): NativeActivityBody {
  const bytes = Buffer.from(content);
  let end = Math.min(bytes.length, MAX_ACTIVITY_DETAIL_BYTES);
  // Never retain a partial UTF-8 code point at the byte boundary.
  while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
  return { content: bytes.subarray(0,end).toString('utf8'), mediaType, originalBytes: bytes.length, truncated: end < bytes.length, sha256: hash(content) };
}
function json(value: unknown) { return body(JSON.stringify(value ?? null), 'application/json'); }
export interface NativeActivityObservation { activity: NativeActivityData; material?: NativeActivityBodyInput }
/** Legacy callers retain exactly the old bounded representation. */
export function mapNativeActivity(frame: SDKMessage, nativeSessionId: string): NativeActivityData[] {
  return Array.from(nativeActivityObservations(frame, nativeSessionId), observation => observation.activity);
}
/** Complete SDK frames only; yield one material at a time for awaited backpressure.
 * Retention is an explicit host opt-in, never inferred from SDK/runner versions. */
export function* nativeActivityObservations(frame: SDKMessage, nativeSessionId: string, retainToolBodies = false): Generator<NativeActivityObservation> {
  if (!['assistant','user','tool_progress'].includes(frame.type)) return;
  const source = object(frame);
  if (source.isReplay === true) return;
  if (typeof source.uuid !== 'string' || source.uuid.length === 0) return;
  if (frame.type === 'user' && (!source.uuid || !source.session_id)) return;
  if (source.session_id !== nativeSessionId) throw new Error('Native activity session does not match this query.');
  const message = object(source.message);
  const common = { type:'native-activity' as const, nativeSessionId, source:'claude.sdk.message' as const,
    sourceMessageId: source.uuid, nativeMessageId: typeof message.id === 'string' ? message.id : null,
    parentToolUseId: source.parent_tool_use_id ?? null };
  const emit = (blockIndex: number, fields: Pick<NativeActivityData,'kind'|'phase'|'toolUseId'|'toolName'|'body'>) => nativeActivityDataSchema.parse({
    ...common, blockIndex, activityId:hash(JSON.stringify([nativeSessionId,source.uuid,blockIndex,fields.kind])), ...fields,
  });
  const tool = (blockIndex: number, fields: Pick<NativeActivityData,'phase'|'toolUseId'|'toolName'>, value: unknown): NativeActivityObservation => {
    const content = JSON.stringify(value ?? null);
    if (retainToolBodies && Buffer.byteLength(content) > NATIVE_ACTIVITY_BODY_LIMITS.bodyBytes) throw new Error('Native tool material exceeds the declared body limit.');
    const activity = emit(blockIndex, { kind:'tool', ...fields, body:body(content,'application/json') });
    return retainToolBodies ? { activity, material:{ activity, content:Buffer.from(content) } } : { activity };
  };
  if (frame.type === 'tool_progress') {
    yield {activity:emit(0,{kind:'tool',phase:'running',toolUseId:frame.tool_use_id,toolName:frame.tool_name,body:json({elapsedTimeSeconds:frame.elapsed_time_seconds})})};
    return;
  }
  const blocks = Array.isArray(message.content) ? message.content : [];
  for (const [blockIndex, value] of blocks.entries()) {
    const block = object(value);
    const plain = (kind: 'assistant-text'|'thinking'|'unsupported', content: string) => ({activity:emit(blockIndex,{kind,phase:'observed',toolUseId:null,toolName:null,body:body(content,'text/plain')})});
    if (frame.type === 'user') {
      if (block.type !== 'tool_result') continue;
      const detached = object(source.tool_use_result).detachedToolCall === true;
      yield tool(blockIndex,{phase:detached?'running':block.is_error===true?'failed':'succeeded',toolUseId:block.tool_use_id as string,toolName:null},
        {content:block.content??null,structured:source.tool_use_result??null});
    } else if (block.type === 'text') yield plain('assistant-text',String(block.text??''));
    else if (block.type === 'thinking') yield plain('thinking',String(block.thinking??''));
    else if (block.type === 'redacted_thinking') yield {activity:emit(blockIndex,{kind:'thinking',phase:'redacted',toolUseId:null,toolName:null,body:null})};
    else if (block.type === 'tool_use') yield tool(blockIndex,{phase:'input-ready',toolUseId:block.id as string,toolName:block.name as string},block.input);
    else yield plain('unsupported',`Unsupported native content block: ${String(block.type).slice(0,180)}`);
  }
}
