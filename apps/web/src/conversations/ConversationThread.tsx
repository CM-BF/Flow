import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AssistantRuntimeProvider, makeAssistantDataUI, MessageNotSentError, useExternalStoreRuntime } from "@assistant-ui/react";
import { TERMINAL_STATUSES, conversationTurnSchema, type ConversationTurn, type ConversationSnapshot, type ConversationCreation } from "@flow/contracts";
import { Thread } from "../components/assistant-ui/elements/thread.aui";
import { ComposerActions, MessageActions, PluginThreadScope } from "../plugin-integration/react";
import { fixtureMode, type DraftState } from "../TaskThread";
import { conversationMessages, messageTask } from "./messages";
import { ConversationProjection, replyDetailKey } from "./projection";
import { ExecutionProfilePicker } from "../execution-profiles/ExecutionProfilePicker";
import type { ExecutionProfileCatalog } from "../execution-profiles/catalog";
import { freezeConversationCreation, type ProfileSelection } from "../execution-profiles/selection";
import "./conversations.css";

const ReplyContext = createContext<ConversationProjection | null>(null);
const ReplyDetail = makeAssistantDataUI<{ turnId: string }>({ name: "flow-reply-detail", render: ({ data }) => {
  const projection = useContext(ReplyContext)!;
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const turn = state.turns.find(turn => turn.id === data.turnId);
  const key = turn && state.snapshot && replyDetailKey(state.snapshot.conversation.id, turn);
  const detail = key ? state.details[key] : undefined;
  return <div className="flow-reply-detail"><p>This reply is shortened.</p>
    <button className="flow-link" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); if (!expanded) void projection.loadReply(data.turnId); }}>{expanded ? "Hide full reply" : "Read full reply"}</button>
    {expanded && <div>{detail?.loading && <p role="status">Loading full reply…</p>}{detail?.error && <p role="alert">{detail.error} <button className="flow-link" onClick={() => void projection.loadReply(data.turnId)}>Retry reply</button></p>}{detail?.data && <pre>{detail.data.content}</pre>}</div>}
  </div>;
} });
const components = { MessageActions, ComposerActions, Welcome: () => <div className="flow-conversation-welcome"><h1>What’s on your mind?</h1><p>Start a conversation. Keep the next thought in your draft while Flow replies.</p></div> };

function TurnStatus({ turn, requested, onInspect, onOpenTask }: { turn: ConversationTurn; requested: ConversationSnapshot["conversation"]["requested"] | undefined; onInspect: (id: string) => void; onOpenTask: (id: string) => void }) {
  return <div className="flow-conversation-turn-status">
    {turn.assistant.state !== "available" && <p role="status">{turn.assistant.state === "pending" ? `Reply pending · ${turn.task.status.replaceAll("_", " ")}` : `Reply unavailable · ${turn.assistant.reason.replaceAll("-", " ")}`}</p>}
    <details><summary>Execution · turn {turn.number}</summary><p>{turn.task.status.replaceAll("_", " ")} · verification {turn.task.verificationStatus}</p>
      <button className="flow-link" onClick={() => onInspect(turn.task.id)}>Inspect turn {turn.number}</button> <button className="flow-link" onClick={() => onOpenTask(turn.task.id)}>Open task controls</button>
      <h4>Conversation requested</h4><dl><dt>Model</dt><dd>{requested?.model ?? "Unknown"}</dd><dt>Thinking</dt><dd>{requested?.thinking ?? "Unknown"}</dd><dt>Tools</dt><dd>{requested?.tools ?? "Unknown"}</dd></dl>
      {turn.effective.runnerRequested && <><h4>Runner requested</h4><dl><dt>Model</dt><dd>{turn.effective.runnerRequested.model}</dd><dt>Thinking</dt><dd>{turn.effective.runnerRequested.thinking}</dd><dt>Permission mode</dt><dd>{turn.effective.runnerRequested.permissionMode}</dd></dl></>}
      <h4>Effective settings reported by the adapter</h4><dl><dt>Effective model</dt><dd>{turn.effective.model ?? "Unknown"}</dd><dt>Effective thinking</dt><dd>{turn.effective.thinking}</dd><dt>Available tools reported by the adapter</dt><dd>{Array.isArray(turn.effective.tools) ? turn.effective.tools.join(", ") || "None (0 tools)" : turn.effective.tools ?? "Unknown"}</dd><dt>Permission mode</dt><dd>{turn.effective.permissionMode ?? "Unknown"}</dd><dt>Settings source</dt><dd>{turn.effective.source?.kind ?? "Unknown"}</dd><dt>Conversation-wide usage</dt><dd>Unknown</dd></dl>
    </details>
  </div>;
}
export function ConversationThread({ viewId, projection, drafts, profiles, profileSelection, onProfileSelection, onAccepted, onInspect, onCurrentTask, onOpenTask }: {
  viewId: string; projection: ConversationProjection; drafts: Map<string, DraftState>;
  profiles: ExecutionProfileCatalog; profileSelection: ProfileSelection; onProfileSelection: (selection: ProfileSelection) => void;
  onAccepted: (id: string) => void; onInspect: (taskId: string) => void; onCurrentTask: (taskId: string) => void; onOpenTask: (taskId: string) => void;
}) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const profileCatalog = useSyncExternalStore(profiles.subscribe, profiles.getSnapshot);
  const [sendError, setSendError] = useState<string | null>(null);
  const messages = useMemo(() => conversationMessages(state.turns), [state.turns]);
  const lockedProfile = state.snapshot ? { creation: state.snapshot.conversation, reason: "created" as const }
    : state.outbox?.creation && state.outbox.state !== "rejected" ? { creation: state.outbox.creation, reason: "receipt-pending" as const } : undefined;
  const profileReason = () => {
    if (lockedProfile || profileSelection.kind === "legacy-default") return null;
    const catalog = profiles.getSnapshot(), ref = profileSelection.profile.reference;
    return !catalog.loaded || catalog.stale || !catalog.profiles.some(profile => profile.reference.id === ref.id && profile.reference.runnerId === ref.runnerId && profile.reference.configDigest === ref.configDigest)
      ? "Refresh or load more profiles to confirm this selection before creating a conversation. Your draft stays here." : null;
  };
  const reason = projection.sendDisabledReason() ?? profileReason();
  const last = state.snapshot?.lastTurn;
  useEffect(() => { if (last) onCurrentTask(last.task.id); }, [last?.task.id]);
  const runtime = useExternalStoreRuntime({ messages, convertMessage: message => message,
    isRunning: Boolean(last && !TERMINAL_STATUSES.includes(last.task.status)), isLoading: state.loading || Boolean(state.error && !state.snapshot), isSendDisabled: Boolean(reason),
    onNew: async message => {
      const blocked = projection.sendDisabledReason() ?? profileReason();
      if (blocked) throw new MessageNotSentError(blocked);
      const text = message.content.filter(part => part.type === "text").map(part => part.text).join("\n");
      const valid = conversationTurnSchema.safeParse({ text, expectedRevision: state.snapshot?.conversation.revision ?? 0, mode: "follow-up" });
      if (!valid.success) { const error = "Use 1–16,000 characters. This message was not sent."; setSendError(error); throw new MessageNotSentError(error); }
      let creation: ConversationCreation | undefined;
      if (!state.snapshot) {
        try { creation = freezeConversationCreation(text.trim().split("\n")[0]!.slice(0, 180), profileSelection); }
        catch (error) { const message = error instanceof Error ? error.message : "This profile cannot be used for ordinary chat."; setSendError(message); throw new MessageNotSentError(message); }
      }
      setSendError(null);
      const id = await projection.send(text, creation);
      if (id) onAccepted(id);
    },
  });
  useEffect(() => {
    runtime.thread.composer.setText(drafts.get(viewId)?.text ?? "");
    return runtime.thread.composer.subscribe(() => {
      drafts.set(viewId, { harness: "claude", scenario: "success", text: runtime.thread.composer.getState().text });
    });
  }, [runtime, viewId, drafts]);
  return <PluginThreadScope editableComposer viewId={viewId} taskId={last?.task.id ?? null} messageTask={id => messageTask(state.turns, id)}><ReplyContext.Provider value={projection}><AssistantRuntimeProvider runtime={runtime}>
    <ReplyDetail />
    <Thread components={components} autoFocus={false} composerPlaceholder="Message Flow…" sendLabel="Send message"
      beforeMessages={<>{state.error && <p className="flow-conversation-alert" role="alert">{state.error} <button className="flow-link" onClick={() => void projection.refresh()}>Retry conversation</button></p>}{state.nextCursor !== null && <p className="flow-conversation-notice">Some turns are not loaded. <button className="flow-link" disabled={state.loadingMore} onClick={() => void projection.loadMore()}>{state.loadingMore ? "Loading…" : "Load more turns"}</button></p>}</>}
      afterMessages={<>{last?.assistant.state === "pending" && <p className="flow-conversation-notice" role="status">Reply pending. You can keep writing below.</p>}{last?.assistant.state === "unavailable" && <p className="flow-conversation-notice" role="status">Reply unavailable · {last.assistant.reason.replaceAll("-", " ")}</p>}{state.turns.length > 0 && <details className="flow-conversation-execution"><summary>Execution details · {state.turns.length} {state.turns.length === 1 ? "turn" : "turns"}</summary>{state.turns.map(turn => <TurnStatus key={turn.id} turn={turn} requested={state.snapshot?.conversation.requested} onInspect={onInspect} onOpenTask={onOpenTask} />)}</details>}{state.outbox && <section className="flow-conversation-receipt" aria-label="Message receipt"><strong>{state.outbox.state === "sending" ? "Sending message…" : state.outbox.state === "unknown" ? "Receipt unknown" : "Message rejected"}</strong><pre>{state.outbox.request.text}</pre><p>{state.outbox.error ?? "Waiting for durable acceptance."}</p>{state.outbox.state === "unknown" && <><p>The center may have accepted this message. Retry keeps the same request identity; your new draft stays separate.</p><button className="flow-link" onClick={async () => { const id = await projection.retry(); if (id) onAccepted(id); }}>Retry same message</button></>}{state.outbox.state === "rejected" && <button className="flow-link" onClick={() => projection.outbox.dismiss(state.outbox!.id)}>Dismiss rejected receipt</button>}</section>}</>}
      composerHeader={<>{!lockedProfile && !viewId.startsWith("draft-") ? <p role="status">Loading conversation configuration…</p> : <ExecutionProfilePicker catalog={profileCatalog} selection={profileSelection} onSelect={onProfileSelection} onRefresh={() => { void profiles.refresh(); }} onLoadMore={() => { void profiles.loadMore(); }} locked={lockedProfile} />}<div className="flow-conversation-controls" aria-label="Conversation capabilities"><button disabled title="Per-turn thinking controls are unavailable">Thinking</button><button disabled title="Per-turn tool controls are unavailable">Tools</button><button disabled title="Queue controls are not available in this Web version">Queue</button><button disabled title="Steering is not available in this Web version">Steer</button></div></>}
      footer={<div className="flow-conversation-footer">{fixtureMode && <p className="flow-conversation-fixture">HTTP fixture · simulated · no model</p>}{sendError && <p role="alert">{sendError}</p>}<p role="status">{reason ?? (state.snapshot ? "Continue this conversation." : "Your message starts a new conversation.")}</p><span>Replies appear when complete. Queue, steering and per-turn controls are not available in this Web version.</span></div>}
    />
  </AssistantRuntimeProvider></ReplyContext.Provider></PluginThreadScope>;
}
