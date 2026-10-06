import { createHash } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { MAX_ACTIVITY_DETAIL_BYTES, nativeActivityDataSchema, type NativeActivityBody, type NativeActivityData } from '../../../../packages/contracts/src/native-activity.js';
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
/** Complete SDK frames only. Provider text is evidence, never interpreted as a command or final reply. */
export function mapNativeActivity(frame: SDKMessage, nativeSessionId: string): NativeActivityData[] {
  if (!['assistant','user','tool_progress'].includes(frame.type)) return [];
  const source = object(frame);
  if (source.isReplay === true) return [];
  // Anonymous/nonconforming frames cannot be attributed or deduplicated. Never invent an ID.
  if (typeof source.uuid !== 'string' || source.uuid.length === 0) return [];
  // SDK prompt/input messages may have neither UUID nor session and are not native observations.
  if (frame.type === 'user' && (!source.uuid || !source.session_id)) return [];
  if (source.session_id !== nativeSessionId) throw new Error('Native activity session does not match this query.');
  const message = object(source.message);
  const common = { type:'native-activity' as const, nativeSessionId, source:'claude.sdk.message' as const,
    sourceMessageId: source.uuid, nativeMessageId: typeof message.id === 'string' ? message.id : null,
    parentToolUseId: source.parent_tool_use_id ?? null };
  const emit = (blockIndex: number, fields: Pick<NativeActivityData,'kind'|'phase'|'toolUseId'|'toolName'|'body'>) => nativeActivityDataSchema.parse({
    ...common, blockIndex, activityId:hash(JSON.stringify([nativeSessionId,source.uuid,blockIndex,fields.kind])), ...fields,
  });
  if (frame.type === 'tool_progress') return [emit(0,{kind:'tool',phase:'running',toolUseId:frame.tool_use_id,toolName:frame.tool_name,body:json({elapsedTimeSeconds:frame.elapsed_time_seconds})})];
  const blocks = Array.isArray(message.content) ? message.content : [];
  return blocks.flatMap((value,blockIndex) => {
    const block = object(value);
    const plain = (kind: 'assistant-text'|'thinking'|'unsupported', content: string) => emit(blockIndex,{kind,phase:'observed',toolUseId:null,toolName:null,body:body(content,'text/plain')});
    if (frame.type === 'user') {
      if (block.type !== 'tool_result') return [];
      const detached = object(source.tool_use_result).detachedToolCall === true;
      return [emit(blockIndex,{kind:'tool',phase:detached?'running':block.is_error===true?'failed':'succeeded',toolUseId:block.tool_use_id as string,toolName:null,
        body:json({content:block.content??null,structured:source.tool_use_result??null})})];
    }
    if (block.type === 'text') return [plain('assistant-text',String(block.text??''))];
    if (block.type === 'thinking') return [plain('thinking',String(block.thinking??''))];
    if (block.type === 'redacted_thinking') return [emit(blockIndex,{kind:'thinking',phase:'redacted',toolUseId:null,toolName:null,body:null})];
    if (block.type === 'tool_use') return [emit(blockIndex,{kind:'tool',phase:'input-ready',toolUseId:block.id as string,toolName:block.name as string,body:json(block.input)})];
    return [plain('unsupported',`Unsupported native content block: ${String(block.type).slice(0,180)}`)];
  });
}
