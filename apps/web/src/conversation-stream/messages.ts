import type { ThreadMessageLike } from "@assistant-ui/react";
import { idSchema, MAX_DETAIL_BYTES, type ConversationTurn } from "@flow/contracts";
import { conversationMessages } from "../conversations/messages";
import { textDigest, utf8Bytes, type DraftBlock } from "./patches";
import type { StreamState } from "./projection";

export interface CanonicalFinal {
  messageId: string; taskId: string; attemptId: string; nativeSessionId: string; text: string; contentDigest: string;
}
/** A preview is not sufficient evidence to discard a durable draft. Never fetch detail implicitly. */
export async function readCanonicalFinal(turn: ConversationTurn, fullContent?: string): Promise<CanonicalFinal | null> {
  const reply = turn.assistant;
  if (reply.state !== "available" || reply.source.kind !== "assistant-final") return null;
  const source = reply.source, text = reply.truncated ? fullContent : reply.text;
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
  const complete = metadata.blocks.length === patches.blocks.length && metadata.blocks.every(reference => {
    const block = patches.blocks.find(value => value.streamId === reference.id);
    return block && block.revision === reference.revision && block.bytes === reference.bytes && block.prefixDigest === reference.prefixDigest
      && block.nativeSessionId === reference.nativeSessionId && block.lastSequence === reference.lastSequence;
  });
  return complete ? new Set(settlement.replaceStreamIds) : new Set();
}
export const streamMessageId = (turnId: string, block: Pick<DraftBlock, "attemptId" | "streamId">) => `conversation-stream:${encodeURIComponent(turnId)}:${encodeURIComponent(block.attemptId)}:${block.streamId}`;
function draftMessage(turn: ConversationTurn, block: Readonly<DraftBlock>, state: StreamState): ThreadMessageLike {
  const ended = ["succeeded", "failed", "cancelled", "uncertain"].includes(turn.task.status);
  const paused = block.phase === "streaming" && (!state.visible || !state.online || Boolean(state.error));
  const recordedInterrupted = state.metadata?.blocks.some(reference => reference.id === block.streamId && reference.status === "interrupted") ?? false;
  const interrupted = recordedInterrupted || block.phase === "incomplete" || block.phase === "superseded" || ["failed", "cancelled", "uncertain"].includes(turn.task.status) || (ended && block.phase === "streaming");
  return { id: streamMessageId(turn.id, block), role: "assistant", content: [{ type: "text", text: block.content }], createdAt: new Date(block.createdAt),
    status: interrupted || paused ? { type: "incomplete", reason: "other" } : block.phase === "streaming" && state.visible && state.online && !state.error
      ? { type: "running" } : { type: "complete", reason: "unknown" },
    metadata: { custom: { flowStream: { taskId: block.taskId, attemptId: block.attemptId, streamId: block.streamId, phase: block.phase,
      interrupted, observationPaused: paused, truncated: block.truncated, canonical: false, taskStatus: turn.task.status } } } };
}
/** Feed these IDs directly into the existing external-store runtime; do not merge adjacent assistant messages. */
export function streamConversationMessages(turn: ConversationTurn, state: StreamState): ThreadMessageLike[] {
  if (turn.id !== state.scope.turnId || turn.conversationId !== state.scope.conversationId || turn.task.id !== state.scope.taskId) throw Error("Stream messages do not belong to this turn.");
  // Message completion is independent of the task, which may still be running.
  const normal = conversationMessages([turn]).map((message): ThreadMessageLike => message.role === "assistant"
    && turn.assistant.state === "available" && turn.assistant.source.kind === "assistant-final"
    ? { ...message, status: { type: "complete", reason: "unknown" } } : message);
  if (!state.enabled || !state.patches || state.patches.attemptId !== state.metadata?.attemptId) return normal;
  const replaced = replacements(state, turn);
  const drafts = state.patches.blocks.filter(block => !replaced.has(block.streamId) && block.content !== "").map(block => draftMessage(turn, block, state));
  const user = normal[0]; if (!user) return drafts;
  const belongsToAttempt = turn.assistant.state === "available" && turn.assistant.source.attemptId === state.patches.attemptId;
  const canonical = (belongsToAttempt ? normal.slice(1) : []).map(message => finalMatchesTurn(state.final, turn) && state.final.messageId === message.id
    ? { ...message, content: [{ type: "text" as const, text: state.final.text }] } : message);
  return [user, ...drafts, ...canonical];
}
