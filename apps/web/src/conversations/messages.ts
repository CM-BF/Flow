import type { ConversationTurn } from "@flow/contracts";
import type { ThreadMessageLike } from "@assistant-ui/react";

export const userMessageId = (turn: ConversationTurn) => `conversation-user:${turn.id}`;
/** Execution telemetry never enters the assistant message body. */
export function conversationMessages(turns: ConversationTurn[]): ThreadMessageLike[] {
  return turns.flatMap(turn => {
    const user: ThreadMessageLike = { id: userMessageId(turn), role: "user", content: turn.user.text, createdAt: new Date(turn.createdAt) };
    if (turn.assistant.state !== "available") return [user];
    return [user, { id: turn.assistant.messageId, role: "assistant", createdAt: new Date(turn.createdAt),
      content: [{ type: "text", text: turn.assistant.text }, ...(turn.assistant.truncated ? [{ type: "data" as const, name: "flow-reply-detail", data: { turnId: turn.id } }] : [])] }];
  });
}
export function messageTask(turns: ConversationTurn[], messageId: string): string | null {
  return turns.find(turn => userMessageId(turn) === messageId || (turn.assistant.state === "available" && turn.assistant.messageId === messageId))?.task.id ?? null;
}
