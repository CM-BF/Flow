import { ContextHistoryComposer, ContextHistorySurface } from "../plugin-integration/context-history";
import { bindPreparedDraftReturn, restorePreparedDraft, MessageSettingsComposer, MessageSettingsSurface } from "../plugin-integration/message-settings";
import { MessageSettingsSummary } from "../execution-profiles/ExecutionProfilePicker";
import { ATTACHMENT_OWNER, ATTACHMENT_OPEN, type AttachmentSubmission } from "../plugin-integration/attachments";
import { createExistingAttachment } from "../attachments/adapter";
import { ConversationSteering } from "../plugin-integration/react";
import { useContext, useRef, useMemo, useLayoutEffect, useEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { AssistantRuntimeProvider, MessageNotSentError, useExternalStoreRuntime, type ThreadMessage, type ComposerRuntime } from "@assistant-ui/react";
import { TERMINAL_STATUSES, conversationTurnSchema, conversationQueueEnqueueSchema, type ConversationTurn, type ConversationSnapshot, type ConversationCreation } from "@flow/contracts";
import { Thread } from "../components/assistant-ui/elements/thread.aui";
import { SessionContext, AttachmentComposer, ComposerActions, MessageActions, PluginThreadScope, ConversationDataRenderers, ConversationActivities, MessageFooter, ConversationStreams, useConversationStream } from "../plugin-integration/react";
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
      <MessageSettingsSummary value={turn.messageSettings} label="This turn requested" />
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
    <strong>{receipt.locallyBlocked ? "Not sent · local recovery blocked" : receipt.state === "sending" ? (receipt.kind === "creation" ? "Preparing conversation…" : "Sending message…") : receipt.state === "unknown" ? "Receipt unknown" : "Request rejected"}</strong>
    {receipt.kind === "turn" && <MessageSettingsSummary value={receipt.request.messageSettings} label="Frozen request settings" />}
    {receipt.kind === "turn" ? <pre>{receipt.request.text}</pre> : <p>Preparing a conversation without sending a message.</p>}<p>{receipt.error ?? "Waiting for durable acceptance."}</p>
    {receipt.state === "unknown" && <><p>{receipt.locallyBlocked && !receipt.everUnknown ? "This request has not been sent. Resolve local storage and explicitly retry the original receipt." : "The center may have accepted this message. Retry keeps the same request identity; your new draft stays separate."}</p><button className="flow-link" onClick={async () => { const id = await projection.retry(); if (id) onAccepted(id); }}>{receipt.kind === "creation" ? "Retry same preparation" : "Retry same message"}</button></>}
    {receipt.state === "rejected" && <button className="flow-link" onClick={() => projection.outbox.dismiss(receipt.id)}>Dismiss rejected receipt</button>}
  </section>;
}

function ConversationBehavior({ live, recovery, children }: { live: boolean; recovery: boolean; children: ReactNode }) {
  return <section className="flow-conversation-behavior" aria-label="Conversation behavior">
    <h3>Conversation behavior</h3>
    <p>{live ? "Reply drafts update as the center records them. Drafts are not final replies." : "Live reply updates are unavailable or disabled."}</p>
    <p>Use Guide running task at the current turn to check steering availability. Message settings applies only explicitly chosen model, thinking, effort and speed to the next message; tools stay fixed by the conversation profile. Queue next waits for durable center acceptance. {recovery ? "Original request identities are saved before sending. After reconnecting, use Saved drafts and receipts to inspect or explicitly retry; reconnecting never resends automatically. Keep this page open while a local checkpoint is blocked." : "Unresolved receipts are local to this page. Keep the page open until they are confirmed."}</p>
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

export function ConversationThread({ viewKey, viewId, visible, projection, drafts, intent, onIntent, onDraftChange, restoredVersion, profiles, profileSelection, onProfileSelection, onAccepted, onInspect, onCurrentTask, onOpenTask }: {
  viewKey: string; viewId: string; visible: boolean; projection: ConversationProjection; drafts: Map<string, DraftState>;
  intent: "follow-up" | "queue"; onIntent: (intent: "follow-up" | "queue") => void; onDraftChange: () => void; restoredVersion: number;
  profiles: ExecutionProfileCatalog; profileSelection: ProfileSelection; onProfileSelection: (selection: ProfileSelection) => void;
  onAccepted: (id: string) => void; onInspect: (taskId: string) => void; onCurrentTask: (taskId: string) => void; onOpenTask: (taskId: string) => void;
}) {
  const session = useContext(SessionContext)!;
  const contextHistory = useMemo(() => session.contextHistoryBinding(viewKey, projection), [session, viewKey, projection]);
  const settings = useMemo(() => session.messageSettingsBinding(viewKey), [session, viewKey]);
  const knowledge = useMemo(() => session.knowledgeBinding(viewKey, projection), [session, viewKey, projection]);
  useLayoutEffect(() => { knowledge.configure(viewId, visible); return () => knowledge.configure(viewId, false); }, [knowledge, viewId, visible]);
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const attachments = useMemo(() => session.attachmentBinding(viewKey, projection), [session, viewKey, projection, state.snapshot?.conversation.projectId]);
  const attachmentActive = useSyncExternalStore(session.host.subscribe, () => session.host.list().find(plugin => plugin.id === ATTACHMENT_OWNER)?.state === "active");
  const materialState = useSyncExternalStore(attachments?.subscribe ?? (() => () => {}), attachments?.getSnapshot ?? (() => null));
  const mention = useRef<{ text: string; start: number; end: number } | null>(null);
  const pending = useRef<{ intent: "follow-up" | "queue"; text: string; selection: ReturnType<typeof knowledge.capture>; creation?: ConversationCreation; profileSelection: ProfileSelection; material?: AttachmentSubmission; binding: typeof attachments; settings: ReturnType<typeof settings.capture>; nextOwnership: symbol; ids: readonly string[]; entered: boolean; failed?: boolean; returning?: { text: string; ids: readonly string[] } } | null>(null);
  const currentDraftMode = useRef({ intent, profileSelection });
  useLayoutEffect(() => { currentDraftMode.current = { intent, profileSelection }; }, [intent, profileSelection]);
  const profileCatalog = useSyncExternalStore(profiles.subscribe, profiles.getSnapshot);
  const queue = useSyncExternalStore(projection.queue.subscribe, projection.queue.getSnapshot);
  const recoveryState = useSyncExternalStore(session.recovery.subscribe, session.recovery.getSnapshot);
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
  const reason = session.recovery.sendReason() ?? projection.sendDisabledReason(intent) ?? profileReason();
  const last = state.snapshot?.lastTurn;
  useEffect(() => { if (last) onCurrentTask(last.task.id); }, [last?.task.id]);
  const attachmentAdapter = useMemo(() => attachments?.adapter ? { ...attachments.adapter,
    remove: async (attachment: Parameters<NonNullable<typeof attachments.adapter>["remove"]>[0]) => {
      if (pending.current?.returning && pending.current.ids.includes(attachment.id)) return;
      await attachments.adapter!.remove(attachment);
    },
  } : undefined, [attachments]);
  const runtime = useExternalStoreRuntime<ThreadMessage>({ messageRepository: streamState.repository,
    isRunning: Boolean(last && !TERMINAL_STATUSES.includes(last.task.status)), isLoading: state.loading || Boolean(state.error && !state.snapshot), isSendDisabled: Boolean(reason),
    adapters: { attachments: attachmentActive ? attachmentAdapter : undefined },
    onNew: async message => {
      const captured = pending.current;
      if (!captured) throw new MessageNotSentError("Capture this draft before preparing its materials.");
      captured.entered = true;
      let handedOff = false;
      try {
        const blocked = session.recovery.sendReason() ?? projection.sendDisabledReason(captured.intent); if (blocked) throw Error(blocked);
        const ids = (message.attachments ?? []).map(item => item.id);
        if (captured.material) captured.binding!.assertSubmission(captured.material, ids);
        else if (ids.length) throw Error("These files are not bound to an authorized material submission.");
        const previous = captured.intent === "queue" ? projection.queue.commands?.getSnapshot().find(item => item.slot === "enqueue")?.key : projection.outbox.getSnapshot()?.id;
        const operation = captured.intent === "queue"
          ? projection.queue.enqueue(captured.text, captured.selection.knowledge, captured.material?.capture.attachments, captured.settings.value)
          : projection.send(captured.text, captured.creation, captured.selection.knowledge, captured.material?.capture.attachments, captured.settings.value);
        // Consume only after a new local receipt synchronously takes the frozen body.
        // Always handle the Promise, including async rejection before the first await.
        const receipt = captured.intent === "queue" ? projection.queue.commands?.getSnapshot().find(item => item.slot === "enqueue") : projection.outbox.getSnapshot();
        const id = receipt && ("key" in receipt ? receipt.key : receipt.id);
        handedOff = !!id && id !== previous;
        try {
          if (handedOff) {
            if (captured.material) {
              if (!receipt || ("kind" in receipt && receipt.kind !== "turn")) throw Error("A turn receipt is required for captured files.");
              captured.binding!.handoff(captured.material, receipt);
            }
            knowledge.consume(captured.selection);
          }
        } catch (error) { void operation.catch(() => {}); throw error; }
        const conversationId = await operation;
        if (!handedOff) throw Error("The message was not handed to a receipt. Your materials are kept.");
        if (conversationId) onAccepted(conversationId);
      } catch (error) {
        const description = error instanceof Error ? error.message : "Message could not be sent."; setSendError(description);
        if (!handedOff) {
          if (captured.material) captured.binding!.failed(captured.material, error);
          captured.failed = true;
          // The existing capture is held for explicit complete-draft recovery.
          // In particular, settings-only B is not an empty destination for A.
        }
      } finally { if (!handedOff && session.recovery.configured()) session.recovery.cancelHandoff(viewKey); if (handedOff && pending.current === captured) pending.current = null; }
    },
  });
  const draftComposer = useMemo<Pick<ComposerRuntime, "getState" | "subscribe">>(() => ({ subscribe: runtime.thread.composer.subscribe,
    getState: () => {
      const state = runtime.thread.composer.getState(), returning = pending.current?.returning;
      return returning ? { ...state, text: returning.text, attachments: state.attachments.filter(file => returning.ids.includes(file.id)) } : state;
    },
  }), [runtime]);
  useLayoutEffect(() => bindPreparedDraftReturn(runtime.thread.composer, () => pending.current, (capture, error) => {
    if (pending.current !== capture) return;
    capture.failed = true;
    if (capture.material) capture.binding?.failed(capture.material, error ?? Error("Preparation stopped. The next draft was preserved."));
    if (session.recovery.configured()) session.recovery.cancelHandoff(viewKey);
    setSendError(error ? String(error) : "Preparation stopped. Your next draft is unchanged; restore the held complete draft explicitly.");
  }), [runtime, session, viewKey]);
  const restorePrepared = async () => {
    const capture = pending.current, composer = runtime.thread.composer, current = settings.authority();
    if (!capture?.failed || capture.returning || !current?.editable) return;
    try {
      const mode = currentDraftMode.current, selected = knowledge.getSnapshot().controller?.getSnapshot().selected;
      if (mode.intent !== capture.intent || JSON.stringify(mode.profileSelection) !== JSON.stringify(capture.profileSelection)
        || JSON.stringify(knowledge.capture().knowledge) !== JSON.stringify(capture.selection.knowledge))
        throw Error("Restore the original delivery/profile and knowledge selection before restoring the held message.");
      await restorePreparedDraft(capture, { composer, settings,
        assertCurrent: () => {
          if (pending.current !== capture || capture.returning || mode !== currentDraftMode.current
            || selected !== knowledge.getSnapshot().controller?.getSnapshot().selected)
            throw Error("Complete draft ownership or materials changed during restoration.");
        },
        material: id => {
          if (!capture.binding?.input) throw Error("The captured attachment authority is unavailable.");
          return createExistingAttachment(capture.binding.input, id);
        },
      });
      // The complete A is now owned by the visible composer. Retire its failed hold,
      // so a second Restore cannot duplicate IDs and later file removal remains real.
      capture.binding?.discardFailedSubmission();
      pending.current = null; setSendError(null); onDraftChange();
    } catch (error) { setSendError(String(error)); }
  };
  useEffect(() => {
    if (!attachments || !attachmentActive || pending.current) return;
    let current = true;
    // Restore begins unverified. An explicit directory check can make the same
    // item ready without changing this binding or the official runtime.
    void attachments.syncComposerDraft(runtime.thread.composer).catch(error => { if (current) setSendError(String(error)); });
    return () => { current = false; };
  }, [attachments, runtime, materialState, attachmentActive]);
  // A ready-state update must not release the preparation watcher: its cleanup
  // would mark an in-flight capture as failed. Bind only to the actual lifetime.
  useEffect(() => attachments?.bindComposer(draftComposer, (value, error) => {
      if (pending.current?.material === value) { pending.current.failed = true; if (!pending.current.returning && session.recovery.configured()) session.recovery.cancelHandoff(viewKey); setSendError(error.message); }
    }), [attachments, draftComposer, session, viewKey]);
  const submit = () => {
    if (pending.current || runtime.thread.composer.getState().submission) return;
    try {
      const blocked = session.recovery.sendReason() ?? projection.sendDisabledReason(intent) ?? profileReason(); if (blocked) throw Error(blocked);
      const draft = runtime.thread.composer.getState(), selection = knowledge.capture();
      const creation = state.snapshot ? undefined : knowledge.creation(freezeConversationCreation(draft.text.trim().split("\n")[0]!.slice(0, 180), profileSelection));
      const setting = settings.capture();
      const wire = { text: draft.text, knowledge: selection.knowledge, ...(setting.value === undefined ? {} : { messageSettings: setting.value }) };
      if (intent === "queue") conversationQueueEnqueueSchema.parse({ ...wire, expectedQueueRevision: projection.queue.getSnapshot().page?.queueRevision });
      else conversationTurnSchema.parse({ ...wire, expectedRevision: state.snapshot?.conversation.revision ?? 0, mode: "follow-up" });
      const previous = intent === "queue" ? projection.queue.commands?.getSnapshot().find(item => item.slot === "enqueue") ?? null : projection.outbox.getSnapshot();
      if (previous && "kind" in previous && previous.kind !== "turn") throw Error("Wait for conversation preparation to finish.");
      // A zero-chip composer can still have restored, unverified selections.
      // Validate the binding's entire ordered draft before either authority runs.
      const material = attachments?.captureDraft(runtime.thread.composer, { submissionId: crypto.randomUUID(), text: draft.text,
        intent: intent === "queue" ? "queue" : "send", knowledge: selection.knowledge }, previous ?? null);
      if (draft.attachments.length && !material) throw Error("Prepare an authorized project before sending files.");
      // Freeze before official send's synchronous detach/notify and any material await.
      // Rotation is synchronous even if A and the next draft retain equal settings.
      const nextOwnership = settings.detach(setting);
      pending.current = { intent, text: draft.text, selection, creation, profileSelection: structuredClone(profileSelection), material, binding: attachments, settings: setting, nextOwnership, ids: draft.attachments.map(file => file.id), entered: false }; setSendError(null);
      if (session.recovery.configured()) session.recovery.beginHandoff(viewKey, intent === "queue" ? "queue" : "outbox");
      runtime.thread.composer.send({ startRun: intent !== "queue" });
    } catch (error) { const captured = pending.current; pending.current = null; if (captured?.material) captured.binding?.failed(captured.material, error); if (captured && session.recovery.configured()) session.recovery.cancelHandoff(viewKey); setSendError(error instanceof Error ? error.message : "This draft cannot be submitted."); }
  };
  useEffect(() => {
    runtime.thread.composer.setText(drafts.get(viewId)?.text ?? "");
    return runtime.thread.composer.subscribe(() => {
      drafts.set(viewId, { harness: "claude", scenario: "success", text: draftComposer.getState().text });
      onDraftChange();
    });
  }, [runtime, draftComposer, viewId, drafts, restoredVersion]);
  const prepare = async () => {
    try {
      const blocked = session.recovery.sendReason() ?? projection.sendDisabledReason() ?? profileReason(); if (blocked) throw Error(blocked);
      const title = runtime.thread.composer.getState().text.trim().split("\n")[0]!.slice(0, 180) || "New conversation";
      const creation = knowledge.creation(freezeConversationCreation(title, profileSelection));
      if (!creation.projectId) throw Error("Choose a project before preparing knowledge.");
      setSendError(null); const id = await projection.prepare(creation); if (id) onAccepted(id);
    } catch (error) { setSendError(error instanceof Error ? error.message : "Conversation could not be prepared."); }
  };
  return <PluginThreadScope editableComposer viewId={viewId} taskId={last?.task.id ?? null} messageTask={id => streamState.members.get(id)?.taskId ?? null}><AssistantRuntimeProvider runtime={runtime}><ConversationDataRenderers viewId={viewId} projection={projection} visible={visible}>
    <ConversationSteering session={session} viewKey={viewKey} viewId={viewId} projection={projection} visible={visible}><ConversationStreams bindings={stream}><ConversationActivities viewId={viewId} projection={projection} visible={visible}><AttachmentComposer binding={attachments} runtime={runtime} recovery={{ restore: restorePrepared, discard: () => { if (pending.current?.returning) return; attachments?.discardFailedSubmission(); pending.current = null; setSendError(null); } }} onAttached={() => {
      const value = mention.current; mention.current = null;
      if (value && runtime.thread.composer.getState().text === value.text) runtime.thread.composer.setText(value.text.slice(0, value.start) + value.text.slice(value.end));
    }}><ContextHistoryComposer binding={contextHistory} viewId={viewId} visible={visible}><MessageSettingsComposer session={session} viewKey={viewKey} viewId={viewId} visible={visible}><KnowledgeComposer binding={knowledge} session={session} prepare={prepare} reason={reason} error={sendError}><Thread components={components} autoFocus={false} composerPlaceholder="Message Flow…" sendLabel={intent === "queue" ? "Add to queue" : "Send message"}
      composerSubmit={submit}
      composerInputOnKeyDown={event => {
        if (event.key === "Tab" && /@file$/.test(event.currentTarget.value.slice(0, event.currentTarget.selectionStart))) {
          event.preventDefault(); mention.current = { text: event.currentTarget.value, start: event.currentTarget.selectionStart - 5, end: event.currentTarget.selectionStart }; void session.host.execute(ATTACHMENT_OPEN, null, { kind: "composer", viewId, isDraft: true }).then(result => { if (!result.ok) setSendError(result.error); }); return;
        }
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== "Enter") return;
        if ((event.ctrlKey || event.metaKey) && event.shiftKey) { event.preventDefault(); setSendError("Use Guide running task at the current turn for a separate instruction. This shortcut does not send your draft."); return; }
        if (intent === "queue" && last && !TERMINAL_STATUSES.includes(last.task.status) && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); if (!projection.sendDisabledReason(intent)) event.currentTarget.form?.requestSubmit(); }
      }}
      beforeMessages={<>{streamState.evicted && <p className="flow-conversation-notice">Older draft text was removed from this page’s limited cache. Final replies remain available.</p>}{state.error && <p className="flow-conversation-alert" role="alert">{state.error} <button className="flow-link" onClick={() => void projection.refresh()}>Retry conversation</button></p>}{state.nextCursor !== null && <p className="flow-conversation-notice">Some turns are not loaded. <button className="flow-link" disabled={state.loadingMore} onClick={() => void projection.loadMore()}>{state.loadingMore ? "Loading…" : "Load more turns"}</button></p>}</>}
      afterMessages={<><ConversationQueue projection={projection.queue} />{last?.assistant.state === "pending" && <p className="flow-conversation-notice" role="status">Reply pending. You can keep writing below.</p>}{last?.assistant.state === "unavailable" && <p className="flow-conversation-notice" role="status">Reply unavailable · {last.assistant.reason.replaceAll("-", " ")}</p>}<MessageReceipt projection={projection} onAccepted={onAccepted} /></>}
      composerHeader={<><ContextHistorySurface host={session.host} viewId={viewId} /><MessageSettingsSurface session={session} viewId={viewId} /><ComposerConfiguration loading={!lockedProfile && !viewId.startsWith("draft-")} viewId={viewId} intent={intent} queueAvailable={queue.available} onIntent={onIntent}
        profile={{ catalog: profileCatalog, selection: profileSelection, onSelect: onProfileSelection, onRefresh: () => { void profiles.refresh(); }, onLoadMore: () => { void profiles.loadMore(); }, locked: lockedProfile,
          details: navigate => <ConversationBehavior live={streamState.enabled} recovery={session.recovery.configured()}><ExecutionSummary turns={state.turns} requested={state.snapshot?.conversation.requested}
            onInspect={id => navigate(() => onInspect(id))}
            onOpenTask={id => navigate(() => { onOpenTask(id); requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus()); })} /></ConversationBehavior> }} /></>}
      footer={<div className="flow-conversation-footer"><KnowledgeSelectionSummary binding={knowledge} />{!state.snapshot?.conversation.projectId && <p>Use Knowledge to choose and prepare a project before attaching text files.</p>}{materialState?.submission?.state === "preparing" && <p role="status">Preparing captured materials…</p>}{fixtureMode && <p className="flow-conversation-fixture">HTTP fixture · simulated · no model</p>}{recoveryState.error && <p role="alert">{recoveryState.error}</p>}{sendError && <p role="alert">{sendError}</p>}{pending.current?.failed && !pending.current.material && <section aria-label="Unsent complete draft"><pre>{pending.current.text}</pre><MessageSettingsSummary value={pending.current.settings.value} label="Held draft settings" /><button type="button" onClick={() => void restorePrepared()}>Restore complete draft into an empty draft</button><button type="button" onClick={() => { pending.current = null; setSendError(null); }}>Discard held draft</button></section>}{reason && <p role="status">{reason}</p>}</div>}

    />
  </KnowledgeComposer></MessageSettingsComposer></ContextHistoryComposer></AttachmentComposer></ConversationActivities></ConversationStreams></ConversationSteering></ConversationDataRenderers></AssistantRuntimeProvider></PluginThreadScope>;
}
