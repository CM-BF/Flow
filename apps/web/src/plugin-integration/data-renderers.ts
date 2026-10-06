import { createReplyPort, FlowReplyDetail, type ReplyBindings, type ReplyPort, type ReplySnapshot } from "../data-renderers/flow-reply-detail";
import { FLOW_REPLY_NAME, FLOW_REPLY_OWNER, type DataRendererRegistry } from "../data-renderers/registry";
import { replyDetailKey, type ConversationProjection } from "../conversations/projection";
import type { PluginDefinition } from "../plugins/types";

export function createReplyRendererPlugin(registry: DataRendererRegistry): PluginDefinition {
  return {
    manifest: { id: FLOW_REPLY_OWNER, version: "1.0.0", hostApi: 1, capabilities: [], activationEvents: [], commands: [], contributions: [] },
    load: async () => ({ activate(context) { registry.attach(FLOW_REPLY_OWNER, FLOW_REPLY_NAME, FlowReplyDetail, context); } }),
  };
}

interface ReplySession {
  readonly id: string;
  readonly signal: AbortSignal;
  canReadReply(viewId: string, taskId: string, messageId: string): boolean;
}
const empty: ReplySnapshot = Object.freeze({});
/** Per mounted pane: native hidden and Activity cleanup both end the current display lease. */
export function createConversationReplyBindings(session: ReplySession, viewId: string, projection: ConversationProjection): ReplyBindings & { setVisible(visible: boolean): void } {
  let visible = false;
  let lifetime = new AbortController();
  const ports = new Map<string, ReplyPort>();
  const bindings = {
    connectionId: session.id, viewId,
    setVisible(next: boolean) {
      if (visible === next) return;
      visible = next;
      lifetime.abort(); lifetime = new AbortController(); ports.clear();
    },
    bind(messageId: string, turnId: string): ReplyPort | null {
      if (!visible || session.signal.aborted) return null;
      const state = projection.getSnapshot();
      const turn = state.turns.find(turn => turn.id === turnId && turn.assistant.state === "available" && turn.assistant.messageId === messageId);
      if (!state.snapshot || !turn || !session.canReadReply(viewId, turn.task.id, messageId)) return null;
      const conversationId = state.snapshot.conversation.id, taskId = turn.task.id;
      const detailKey = replyDetailKey(conversationId, turn)!;
      const existing = ports.get(detailKey); if (existing) return existing;
      const signal = AbortSignal.any([lifetime.signal, session.signal]);
      let previous: unknown, snapshot = empty;
      const port = createReplyPort({
        identity: { connectionId: session.id, viewId, conversationId, messageId, turnId, taskId, detailKey }, signal,
        current: () => {
          const current = projection.getSnapshot();
          const actual = current.turns.find(turn => turn.id === turnId);
          return visible && session.canReadReply(viewId, taskId, messageId) && current.snapshot?.conversation.id === conversationId
            && actual?.task.id === taskId && actual.assistant.state === "available" && actual.assistant.messageId === messageId
            && replyDetailKey(conversationId, actual) === detailKey;
        },
        source: { subscribe: projection.subscribe, getSnapshot: () => {
          const detail = projection.getSnapshot().details[detailKey];
          if (previous !== detail) { previous = detail; snapshot = detail ? { loading: detail.loading, error: detail.error, content: detail.data?.content } : empty; }
          return snapshot;
        } },
        load: () => projection.loadReply(turnId),
      });
      ports.set(detailKey, port); return port;
    },
  };
  return bindings;
}
