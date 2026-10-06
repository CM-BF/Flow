import { conversationContextResponseSchema, type ConversationTurn } from "@flow/contracts";
import type { ThreadMessageLike } from "@assistant-ui/react";

export const userMessageId = (turn: ConversationTurn) => `conversation-user:${turn.id}`;
const messagesByTurn = new WeakMap<ConversationTurn, readonly ThreadMessageLike[]>();

/** Treat turn snapshots and returned messages as immutable; execution telemetry stays outside the body. */
export function conversationMessages(turns: ConversationTurn[]): ThreadMessageLike[] {
  return turns.flatMap(turn => {
    const cached = messagesByTurn.get(turn);
    if (cached) return cached;
    let user: ThreadMessageLike = { id: userMessageId(turn), role: "user", content: turn.user.text, createdAt: new Date(turn.createdAt) };
    const context = conversationContextResponseSchema.safeParse(turn.context);
    if (context.success && context.data.templateVersion === 2) user = { ...user, attachments: context.data.attachments.map(item => ({
      id: `${item.reference.resourceId}:${item.reference.version}`, type: "file", name: `${item.name} · v${item.reference.version}`,
      contentType: item.mediaType, status: { type: "complete" }, content: [],
    })) };
    const messages: ThreadMessageLike[] = [user];
    if (turn.assistant.state === "available") messages.push({ id: turn.assistant.messageId, role: "assistant", createdAt: new Date(turn.createdAt),
      content: [{ type: "text", text: turn.assistant.text }, ...(turn.assistant.truncated ? [{ type: "data" as const, name: "flow-reply-detail", data: { turnId: turn.id } }] : [])] });
    messagesByTurn.set(turn, messages);
    return messages;
  });
}
export function messageTask(turns: ConversationTurn[], messageId: string): string | null {
  return turns.find(turn => userMessageId(turn) === messageId || (turn.assistant.state === "available" && turn.assistant.messageId === messageId))?.task.id ?? null;
}
