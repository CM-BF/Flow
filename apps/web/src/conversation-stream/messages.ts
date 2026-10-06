import type { ThreadMessageLike } from '@assistant-ui/react';
import type { ConversationTurn } from '@flow/contracts';
import { projectBodySegments, type StreamState, type BodySegment } from '@flow/interaction/stream';
import { conversationMessages } from '../conversations/messages';
export { readCanonicalFinal, streamMessageId } from '@flow/interaction/stream';
export type { CanonicalFinal } from '@flow/interaction/stream';
function draftMessage(segment: BodySegment): ThreadMessageLike {
  return {id:segment.id,role:'assistant',content:[{type:'text',text:segment.text}],createdAt:new Date(segment.createdAt),
    status:segment.interrupted || segment.observationPaused ? {type:'incomplete',reason:'other'} : segment.phase==='streaming' ? {type:'running'} : {type:'complete',reason:'unknown'},
    metadata:{custom:{flowStream:{taskId:segment.taskId,attemptId:segment.attemptId,streamId:segment.streamId,phase:segment.phase,
      interrupted:segment.interrupted,observationPaused:segment.observationPaused,truncated:segment.truncated,canonical:false,taskStatus:segment.taskStatus}}}};
}
/** UI mapping only. Identity and settlement policy are shared with the terminal. */
export function streamConversationMessages(turn: ConversationTurn, state: StreamState): ThreadMessageLike[] {
  const segments=projectBodySegments(turn,state);
  const normal=conversationMessages([turn]).map((message):ThreadMessageLike=>message.role==='assistant' && turn.assistant.state==='available' && turn.assistant.source.kind==='assistant-final'
    ? {...message,status:{type:'complete',reason:'unknown'}} : message);
  return [...normal.filter(message=>message.role==='user'),...segments.map(segment=>{
    if(segment.kind==='draft')return draftMessage(segment);
    const original=normal.find(message=>message.id===segment.id)!;
    return segment.truncated ? original : {...original,content:[{type:'text' as const,text:segment.text}]};
  })];
}
