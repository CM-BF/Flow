import { idSchema, MAX_DETAIL_BYTES, type ConversationTurn } from '@flow/contracts';
import { textDigest, utf8Bytes, type DraftBlock } from './patches.js';
import type { StreamState } from './projection.js';

export interface CanonicalFinal {
  messageId: string; taskId: string; attemptId: string; nativeSessionId: string; text: string; contentDigest: string;
}
/** A preview is not sufficient evidence to discard a durable draft. Never fetch detail implicitly. */
export async function readCanonicalFinal(turn: ConversationTurn, fullContent?: string): Promise<CanonicalFinal | null> {
  const reply = turn.assistant;
  if (reply.state !== "available" || reply.source.kind !== "assistant-final") return null;
  const source = reply.source, text = fullContent ?? (reply.truncated ? undefined : reply.text);
  if (text === undefined) return null;
  if (typeof text !== "string" || ![source.taskId, source.attemptId, source.nativeSessionId, source.messageId, source.detailId].every(value => idSchema.safeParse(value).success)) throw Error("Invalid canonical final identity.");
  if (source.taskId !== turn.task.id || source.messageId !== reply.messageId || reply.contentRef.taskId !== source.taskId
    || reply.contentRef.attemptId !== source.attemptId || reply.contentRef.id !== source.detailId || utf8Bytes(text) > MAX_DETAIL_BYTES
    || await textDigest(text) !== source.contentDigest) throw Error("Canonical assistant final does not match its recorded source.");
  return Object.freeze({ messageId: reply.messageId, taskId: source.taskId, attemptId: source.attemptId, nativeSessionId: source.nativeSessionId, text, contentDigest: source.contentDigest });
}
function finalMatchesTurn(final: CanonicalFinal | null, turn: ConversationTurn): final is CanonicalFinal {
  const reply = turn.assistant;
  return Boolean(final && reply.state === "available" && reply.source.kind === "assistant-final" && reply.messageId === final.messageId
    && reply.source.taskId === final.taskId && reply.source.attemptId === final.attemptId && reply.source.nativeSessionId === final.nativeSessionId
    && reply.source.contentDigest === final.contentDigest);
}
function replacements(state: StreamState, turn: ConversationTurn): ReadonlySet<string> {
  const { metadata, patches, final } = state, settlement = metadata?.settlement;
  if (!metadata || !patches || !settlement || !final || state.hasMore || settlement.correlation !== "presentation-policy") return new Set();
  if (final.messageId !== metadata.finalMessageId || final.messageId !== settlement.finalMessageId || final.taskId !== metadata.taskId
    || final.attemptId !== metadata.attemptId || final.attemptId !== patches.attemptId || final.nativeSessionId !== settlement.nativeSessionId) return new Set();
  if (!finalMatchesTurn(final, turn)) return new Set();
  const selected=state.selections!==undefined;
  const required=selected ? metadata.blocks.filter(reference=>settlement.replaceStreamIds.includes(reference.id)) : metadata.blocks;
  if(selected && required.some(reference=>reference.source!=='claude.sdk.stream' && reference.channel!=='text'))return new Set();
  const complete = (selected || metadata.blocks.length === patches.blocks.length) && required.every(reference => {
    const block = patches.blocks.find(value => value.streamId === reference.id);
    return block && block.revision === reference.revision && block.bytes === reference.bytes && block.prefixDigest === reference.prefixDigest
      && block.nativeSessionId === reference.nativeSessionId && block.lastSequence === reference.lastSequence;
  });
  return complete ? new Set(settlement.replaceStreamIds) : new Set();
}
export const streamMessageId = (turnId: string, block: Pick<DraftBlock, "attemptId" | "streamId">) => `conversation-stream:${encodeURIComponent(turnId)}:${encodeURIComponent(block.attemptId)}:${block.streamId}`;
export interface BodySegment {
  id: string; kind: 'draft' | 'final'; text: string; createdAt: string; taskId: string; attemptId: string;
  source: 'claude.sdk.stream' | 'codex.app-server.stream' | 'assistant-final';
  channel: 'text' | 'reasoning-summary' | 'reasoning-text';
  streamId: string | null; phase: DraftBlock['phase'] | 'final'; taskStatus: string;
  interrupted: boolean; observationPaused: boolean; truncated: boolean;
}
function draftSegment(turn: ConversationTurn, block: Readonly<DraftBlock>, state: StreamState): BodySegment {
  const ended = ['succeeded', 'failed', 'cancelled', 'uncertain'].includes(turn.task.status);
  const paused = block.phase === 'streaming' && (!state.visible || !state.online || Boolean(state.error));
  const recordedInterrupted = state.metadata?.blocks.some(reference => reference.id === block.streamId && reference.status === 'interrupted') ?? false;
  const interrupted = recordedInterrupted || block.phase === 'incomplete' || block.phase === 'superseded' || ['failed', 'cancelled', 'uncertain'].includes(turn.task.status) || (ended && block.phase === 'streaming');
  return {id:streamMessageId(turn.id,block),kind:'draft',text:block.content,createdAt:block.createdAt,taskId:block.taskId,attemptId:block.attemptId,
    source:block.source,channel:block.channel??'text',streamId:block.streamId,phase:block.phase,taskStatus:turn.task.status,interrupted,observationPaused:paused,truncated:block.truncated};
}
/** Presentation policy is the center's explicit partition, never inferred from text or last-block order. */
export function projectBodySegments(turn: ConversationTurn, state: StreamState): BodySegment[] {
  if (turn.id !== state.scope.turnId || turn.conversationId !== state.scope.conversationId || turn.task.id !== state.scope.taskId) throw Error('Stream messages do not belong to this turn.');
  const streaming = state.enabled && state.patches && state.patches.attemptId === state.metadata?.attemptId;
  const replaced = streaming ? replacements(state, turn) : new Set<string>();
  const bodies=[...(state.patches?.blocks??[]),...(state.selections?.flatMap(selection=>selection.patches?.blocks??[])??[])];
  const drafts = streaming ? bodies.filter(block => !replaced.has(block.streamId) && block.content !== '').map(block => draftSegment(turn,block,state)) : [];
  const reply = turn.assistant;
  if (reply.state !== 'available' || (streaming && reply.source.attemptId !== state.patches!.attemptId)) return drafts;
  const full = finalMatchesTurn(state.final,turn) ? state.final : null;
  return [...drafts,{id:reply.messageId,kind:'final',text:full?.text ?? reply.text,createdAt:turn.createdAt,taskId:turn.task.id,attemptId:reply.source.attemptId,
    source:'assistant-final',channel:'text',streamId:null,phase:'final',taskStatus:turn.task.status,interrupted:false,observationPaused:false,truncated:full ? false : reply.truncated}];
}
