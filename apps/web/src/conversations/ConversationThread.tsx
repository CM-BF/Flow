import { useContext, useMemo, useLayoutEffect, useEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { AssistantRuntimeProvider, MessageNotSentError, useExternalStoreRuntime, type ThreadMessage } from "@assistant-ui/react";
import { TERMINAL_STATUSES, conversationTurnSchema, conversationQueueEnqueueSchema, type ConversationTurn, type ConversationSnapshot, type ConversationCreation } from "@flow/contracts";
import { Thread } from "../components/assistant-ui/elements/thread.aui";
import { SessionContext, ComposerActions, MessageActions, PluginThreadScope, ConversationDataRenderers, ConversationActivities, MessageFooter, ConversationStreams, useConversationStream } from "../plugin-integration/react";
import { fixtureMode, type DraftState } from "../TaskThread";
import { ConversationProjection } from "./projection";
import { ExecutionProfilePicker } from "../execution-profiles/ExecutionProfilePicker";
import type { ExecutionProfileCatalog } from "../execution-profiles/catalog";
import { freezeConversationCreation, type ProfileSelection } from "../execution-profiles/selection";
import { KnowledgeComposer, KnowledgeSelectionSummary } from "../plugin-integration/knowledge";
import { ConversationQueue } from "./queue/ConversationQueue";
import "./conversations.css";

const components = { MessageFooter, MessageActions, ComposerActions, Welcome: () => <div className="flow-conversation-welcome"><h1>What’s on your mind?</h1><p>Start a conversation. Keep the next thought in your draft while Flow replies.</p></div> };

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
function ExecutionSummary({ turns, requested, onInspect, onOpenTask }: { turns: readonly ConversationTurn[]; requested: ConversationSnapshot["conversation"]["requested"] | undefined; onInspect: (id: string) => void; onOpenTask: (id: string) => void }) {
  if (!turns.length) return null;
  return <details className="flow-conversation-execution"><summary>Execution history · {turns.length} {turns.length === 1 ? "turn" : "turns"}</summary>{turns.map(turn => <TurnStatus key={turn.id} turn={turn} requested={requested} onInspect={onInspect} onOpenTask={onOpenTask} />)}</details>;
}

function MessageReceipt({ projection, onAccepted }: { projection: ConversationProjection; onAccepted: (id: string) => void }) {
  const receipt = useSyncExternalStore(projection.subscribe, projection.getSnapshot).outbox;
  if (!receipt) return null;
  return <section className="flow-conversation-receipt" aria-label="Message receipt">
    <strong>{receipt.state === "sending" ? (receipt.kind === "creation" ? "Preparing conversation…" : "Sending message…") : receipt.state === "unknown" ? "Receipt unknown" : "Request rejected"}</strong>
    {receipt.kind === "turn" ? <pre>{receipt.request.text}</pre> : <p>Preparing a conversation without sending a message.</p>}<p>{receipt.error ?? "Waiting for durable acceptance."}</p>
    {receipt.state === "unknown" && <><p>The center may have accepted this message. Retry keeps the same request identity; your new draft stays separate.</p><button className="flow-link" onClick={async () => { const id = await projection.retry(); if (id) onAccepted(id); }}>{receipt.kind === "creation" ? "Retry same preparation" : "Retry same message"}</button></>}
    {receipt.state === "rejected" && <button className="flow-link" onClick={() => projection.outbox.dismiss(receipt.id)}>Dismiss rejected receipt</button>}
  </section>;
}

function ConversationBehavior({ live, children }: { live: boolean; children: ReactNode }) {
  return <section className="flow-conversation-behavior" aria-label="Conversation behavior">
    <h3>Conversation behavior</h3>
    <p>{live ? "Reply drafts update as the center records them. Drafts are not final replies." : "Live reply updates are unavailable or disabled."}</p>
    <p>Steering and per-turn model, thinking and tool controls are unavailable. Queue next waits for durable center acceptance; unresolved receipts are local to this page. Keep the page open until they are confirmed.</p>
    {children}
  </section>;
}

function ComposerConfiguration({ loading, profile, viewId, intent, queueAvailable, onIntent }: { loading: boolean; profile: ComponentProps<typeof ExecutionProfilePicker>; viewId: string; intent: "follow-up" | "queue"; queueAvailable: boolean; onIntent: (intent: "follow-up" | "queue") => void }) {
  return <div className="flow-composer-configuration">
    {loading ? <p role="status">Loading conversation configuration…</p> : <ExecutionProfilePicker {...profile} />}
    <fieldset className="flow-message-delivery" aria-label="Message delivery">
      <label><input type="radio" name={`delivery-${viewId}`} checked={intent === "follow-up"} onChange={() => onIntent("follow-up")} /> Send now</label>
      <label><input type="radio" name={`delivery-${viewId}`} checked={intent === "queue"} disabled={!queueAvailable} onChange={() => onIntent("queue")} /> Queue next</label>
    </fieldset>
  </div>;
}

export function ConversationThread({ viewKey, viewId, visible, projection, drafts, profiles, profileSelection, onProfileSelection, onAccepted, onInspect, onCurrentTask, onOpenTask }: {
  viewKey: string; viewId: string; visible: boolean; projection: ConversationProjection; drafts: Map<string, DraftState>;
  profiles: ExecutionProfileCatalog; profileSelection: ProfileSelection; onProfileSelection: (selection: ProfileSelection) => void;
  onAccepted: (id: string) => void; onInspect: (taskId: string) => void; onCurrentTask: (taskId: string) => void; onOpenTask: (taskId: string) => void;
}) {
  const session = useContext(SessionContext)!;
  const knowledge = useMemo(() => session.knowledgeBinding(viewKey, projection), [session, viewKey, projection]);
  useLayoutEffect(() => { knowledge.configure(viewId, visible); return () => knowledge.configure(viewId, false); }, [knowledge, viewId, visible]);
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const profileCatalog = useSyncExternalStore(profiles.subscribe, profiles.getSnapshot);
  const queue = useSyncExternalStore(projection.queue.subscribe, projection.queue.getSnapshot);
  const [intent, setIntent] = useState<"follow-up" | "queue">("follow-up");
  const [sendError, setSendError] = useState<string | null>(null);
  const stream = useConversationStream(viewId, projection, visible);
  const streamState = useSyncExternalStore(stream.subscribe, stream.getSnapshot);
  const lockedProfile = state.snapshot ? { creation: state.snapshot.conversation, reason: "created" as const }
    : state.outbox?.creation && state.outbox.state !== "rejected" ? { creation: state.outbox.creation, reason: "receipt-pending" as const } : undefined;
  const profileReason = () => {
    if (lockedProfile || profileSelection.kind === "legacy-default") return null;
    const catalog = profiles.getSnapshot(), ref = profileSelection.profile.reference;
    return !catalog.loaded || catalog.stale || !catalog.profiles.some(profile => profile.reference.id === ref.id && profile.reference.runnerId === ref.runnerId && profile.reference.configDigest === ref.configDigest)
      ? "Refresh or load more profiles to confirm this selection before creating a conversation. Your draft stays here." : null;
  };
  const reason = projection.sendDisabledReason(intent) ?? profileReason();
  const last = state.snapshot?.lastTurn;
  useEffect(() => { if (last) onCurrentTask(last.task.id); }, [last?.task.id]);
  const runtime = useExternalStoreRuntime<ThreadMessage>({ messageRepository: streamState.repository,
    isRunning: Boolean(last && !TERMINAL_STATUSES.includes(last.task.status)), isLoading: state.loading || Boolean(state.error && !state.snapshot), isSendDisabled: Boolean(reason),
    onNew: async message => {
      const blocked = projection.sendDisabledReason(intent) ?? profileReason();
      if (blocked) throw new MessageNotSentError(blocked);
      const text = message.content.filter(part => part.type === "text").map(part => part.text).join("\n");
      let capture: ReturnType<typeof knowledge.capture>;
      let creation: ConversationCreation | undefined;
      try {
        capture = knowledge.capture();
        if (intent === "queue") { if (!conversationQueueEnqueueSchema.safeParse({ expectedQueueRevision: queue.page?.queueRevision, text, knowledge: capture.knowledge }).success) throw Error("Use a non-empty message up to 16,000 UTF-8 bytes for the queue. Your references are kept."); }
        else {
          if (!conversationTurnSchema.safeParse({ text, expectedRevision: state.snapshot?.conversation.revision ?? 0, mode: "follow-up", knowledge: capture.knowledge }).success) throw Error("Use 1–16,000 characters. Your references are kept.");
          if (!state.snapshot) creation = knowledge.creation(freezeConversationCreation(text.trim().split("\n")[0]!.slice(0, 180), profileSelection));
        }
      } catch (error) { const message = error instanceof Error ? error.message : "This message cannot be submitted."; setSendError(message); throw new MessageNotSentError(message); }
      setSendError(null);
      const previous = intent === "queue" ? projection.queue.commands?.getSnapshot().find(item => item.slot === "enqueue")?.key : projection.outbox.getSnapshot()?.id;
      const operation = intent === "queue" ? projection.queue.enqueue(text, capture.knowledge) : projection.send(text, creation, capture.knowledge);
      // Async methods can reject before their first await. A new local receipt, not a Promise, proves handoff.
      const receipt = intent === "queue" ? projection.queue.commands?.getSnapshot().find(item => item.slot === "enqueue") : projection.outbox.getSnapshot();
      const receiptId = receipt && ("key" in receipt ? receipt.key : receipt.id);
      const handedOff = !!receiptId && receiptId !== previous;
      if (handedOff) knowledge.consume(capture);
      try {
        const id = await operation;
        if (!handedOff) throw Error("The message was not handed to a receipt. Your references are kept.");
        if (id) onAccepted(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Message could not be sent."; setSendError(message);
        if (!handedOff) throw new MessageNotSentError(message);
        // Once a receipt owns the request, its failures must never prepend old text into the next draft.
      }
    },
  });
  useEffect(() => {
    runtime.thread.composer.setText(drafts.get(viewId)?.text ?? "");
    return runtime.thread.composer.subscribe(() => {
      drafts.set(viewId, { harness: "claude", scenario: "success", text: runtime.thread.composer.getState().text });
    });
  }, [runtime, viewId, drafts]);
  const prepare = async () => {
    try {
      const blocked = projection.sendDisabledReason() ?? profileReason(); if (blocked) throw Error(blocked);
      const title = runtime.thread.composer.getState().text.trim().split("\n")[0]!.slice(0, 180) || "New conversation";
      const creation = knowledge.creation(freezeConversationCreation(title, profileSelection));
      if (!creation.projectId) throw Error("Choose a project before preparing knowledge.");
      setSendError(null); const id = await projection.prepare(creation); if (id) onAccepted(id);
    } catch (error) { setSendError(error instanceof Error ? error.message : "Conversation could not be prepared."); }
  };
  return <PluginThreadScope editableComposer viewId={viewId} taskId={last?.task.id ?? null} messageTask={id => streamState.members.get(id)?.taskId ?? null}><AssistantRuntimeProvider runtime={runtime}><ConversationDataRenderers viewId={viewId} projection={projection} visible={visible}>
    <ConversationStreams bindings={stream}><ConversationActivities viewId={viewId} projection={projection} visible={visible}><KnowledgeComposer binding={knowledge} session={session} prepare={prepare} reason={reason} error={sendError}><Thread components={components} autoFocus={false} composerPlaceholder="Message Flow…" sendLabel={intent === "queue" ? "Add to queue" : "Send message"}
      composerSubmit={intent === "queue" ? () => { if (!projection.sendDisabledReason("queue")) runtime.thread.composer.send({ startRun: false }); } : undefined}
      composerInputOnKeyDown={event => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== "Enter") return;
        if ((event.ctrlKey || event.metaKey) && event.shiftKey) { event.preventDefault(); setSendError("Steering is not supported. Choose Queue next to save a message without interrupting execution."); return; }
        if (intent === "queue" && last && !TERMINAL_STATUSES.includes(last.task.status) && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); if (!projection.sendDisabledReason(intent)) event.currentTarget.form?.requestSubmit(); }
      }}
      beforeMessages={<>{streamState.evicted && <p className="flow-conversation-notice">Older draft text was removed from this page’s limited cache. Final replies remain available.</p>}{state.error && <p className="flow-conversation-alert" role="alert">{state.error} <button className="flow-link" onClick={() => void projection.refresh()}>Retry conversation</button></p>}{state.nextCursor !== null && <p className="flow-conversation-notice">Some turns are not loaded. <button className="flow-link" disabled={state.loadingMore} onClick={() => void projection.loadMore()}>{state.loadingMore ? "Loading…" : "Load more turns"}</button></p>}</>}
      afterMessages={<><ConversationQueue projection={projection.queue} />{last?.assistant.state === "pending" && <p className="flow-conversation-notice" role="status">Reply pending. You can keep writing below.</p>}{last?.assistant.state === "unavailable" && <p className="flow-conversation-notice" role="status">Reply unavailable · {last.assistant.reason.replaceAll("-", " ")}</p>}<MessageReceipt projection={projection} onAccepted={onAccepted} /></>}
      composerHeader={<ComposerConfiguration loading={!lockedProfile && !viewId.startsWith("draft-")} viewId={viewId} intent={intent} queueAvailable={queue.available} onIntent={setIntent}
        profile={{ catalog: profileCatalog, selection: profileSelection, onSelect: onProfileSelection, onRefresh: () => { void profiles.refresh(); }, onLoadMore: () => { void profiles.loadMore(); }, locked: lockedProfile,
          details: navigate => <ConversationBehavior live={streamState.enabled}><ExecutionSummary turns={state.turns} requested={state.snapshot?.conversation.requested}
            onInspect={id => navigate(() => onInspect(id))}
            onOpenTask={id => navigate(() => { onOpenTask(id); requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus()); })} /></ConversationBehavior> }} />}
      footer={<div className="flow-conversation-footer"><KnowledgeSelectionSummary binding={knowledge} />{fixtureMode && <p className="flow-conversation-fixture">HTTP fixture · simulated · no model</p>}{sendError && <p role="alert">{sendError}</p>}{reason && <p role="status">{reason}</p>}</div>}

    />
  </KnowledgeComposer></ConversationActivities></ConversationStreams></ConversationDataRenderers></AssistantRuntimeProvider></PluginThreadScope>;
}
