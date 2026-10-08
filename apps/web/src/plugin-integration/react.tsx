import { ConversationAttachments, AttachmentSurfaceProvider, ATTACHMENT_OWNER, ATTACHMENT_PANEL } from "./attachments";
import { createExistingAttachment } from "../attachments/adapter";
import type { AssistantRuntime } from "@assistant-ui/react";
import { ConversationStreamHost, STREAM_OWNER, STREAM_PANEL } from "../conversation-stream/host";
import type { PluginDefinition, PluginViewProps } from "../plugins/types";
import { Activity, createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode, type RefObject } from "react";
import { useAuiState } from "@assistant-ui/react";
import { Puzzle, SlidersHorizontal } from "lucide-react";
import { ExtensionSlot, PluginView } from "../plugins/react";
import type { ResourceContext, SlotId, WorkspaceTabId } from "../plugins/types";
import { WorkspaceChromeContext } from "../components/workspace/WorkspacePanels";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import type { ProjectionState } from "../projection";
import type { AppPluginSession } from "./session";
import type { PluginManagementProps, PluginRegistryReader } from "../plugin-management/PluginManagement";
import "./integration.css";
import { AssistantDataRenderers } from "../data-renderers/react";
import { ReplyBindingsProvider, flowReplyFallback } from "../data-renderers/flow-reply-detail";
import { FLOW_REPLY_OWNER } from "../data-renderers/registry";
import { createConversationReplyBindings } from "./data-renderers";
import { createConversationActivityBindings, ActivityBindingsContext } from "./activity";
import type { ConversationProjection } from "../conversations/projection";

const StreamBindingsContext = createContext<ConversationStreamHost | null>(null);
export const SessionContext = createContext<AppPluginSession | null>(null);
const ThreadScope = createContext<{ viewId: string; taskId: string | null; editableComposer?: boolean; messageTask?: (id: string) => string | null }>({ viewId: "", taskId: null });
const globalContext: ResourceContext = { kind: "global" };
export function PluginProvider({ session, children }: { session: AppPluginSession; children: ReactNode }) {
  return <SessionContext.Provider key={session.id} value={session}>{children}</SessionContext.Provider>;
}
export function PluginThreadScope({ viewId, taskId, messageTask, editableComposer, children }: { viewId: string; taskId: string | null; editableComposer?: boolean; messageTask?: (id: string) => string | null; children: ReactNode }) {
  return <ThreadScope.Provider value={{ viewId, taskId, messageTask, editableComposer }}>{children}</ThreadScope.Provider>;
}
/** Explicit native-hidden visibility, independent of which split pane owns keyboard focus. */
export function ConversationDataRenderers({ viewId, projection, visible, children }: { viewId: string; projection: ConversationProjection; visible: boolean; children: ReactNode }) {
  const session = useContext(SessionContext)!;
  const bindings = useMemo(() => createConversationReplyBindings(session, viewId, projection), [session, viewId, projection]);
  const [ready, setReady] = useState<typeof bindings | null>(null);
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const hasReplyDetail = state.turns.some(turn => turn.assistant.state === "available" && turn.assistant.truncated);
  useLayoutEffect(() => {
    bindings.setVisible(visible); setReady(visible ? bindings : null);
    return () => bindings.setVisible(false);
  }, [bindings, visible]);
  useEffect(() => {
    // A disabled/failed owner remains disabled/failed; only untouched registration is lazy activated.
    if (visible && hasReplyDetail && session.host.list().find(plugin => plugin.id === FLOW_REPLY_OWNER)?.state === "registered")
      void session.host.activate(FLOW_REPLY_OWNER);
  }, [session, visible, hasReplyDetail]);
  return <ReplyBindingsProvider value={bindings}>
    {visible && ready === bindings && <AssistantDataRenderers registry={session.dataRenderers} fallback={flowReplyFallback} />}
    {children}
  </ReplyBindingsProvider>;
}
export function ConversationActivities({ viewId, projection, visible, children }: { viewId: string; projection: ConversationProjection; visible: boolean; children: ReactNode }) {
  const session = useContext(SessionContext)!;
  const bindings = useMemo(() => createConversationActivityBindings(session, viewId, projection), [session, viewId, projection]);
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  useLayoutEffect(() => { bindings.setVisible(visible); return () => bindings.setVisible(false); }, [bindings, visible]);
  useLayoutEffect(() => { bindings.sync(); }, [bindings, state.turns, state.connection]);
  useEffect(() => { const close = () => bindings.dispose(); session.signal.addEventListener("abort", close, { once: true }); return () => { session.signal.removeEventListener("abort", close); bindings.setVisible(false); }; }, [session, bindings]);
  return <ActivityBindingsContext.Provider value={bindings}>{children}</ActivityBindingsContext.Provider>;
}
export function useConversationStream(viewId: string, projection: ConversationProjection, visible: boolean) {
  const session = useContext(SessionContext)!;
  const bindings = useMemo(() => new ConversationStreamHost(viewId, projection, session.streamAuthority(), session.streamBudget), [session, viewId, projection]);
  const source = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  useLayoutEffect(() => bindings.attach(), [bindings]);
  useLayoutEffect(() => { bindings.setVisible(visible); return () => bindings.setVisible(false); }, [bindings, visible]);
  useEffect(() => {
    if (visible && source.snapshot?.capabilities.liveAssistantText === true && session.host.list().find(plugin => plugin.id === STREAM_OWNER)?.state === "registered") void session.host.activate(STREAM_OWNER);
  }, [session, visible, source.snapshot?.capabilities.liveAssistantText]);
  return bindings;
}
export function ConversationStreams({ bindings, children }: { bindings: ConversationStreamHost; children: ReactNode }) { return <StreamBindingsContext.Provider value={bindings}>{children}</StreamBindingsContext.Provider>; }
function StreamStatusPanel({ context }: PluginViewProps) {
  const bindings = useContext(StreamBindingsContext);
  const state = useSyncExternalStore(bindings?.subscribe ?? (() => () => {}), () => bindings?.getSnapshot());
  const member = context.kind === "message" ? state?.members.get(context.messageId) : null;
  const current = member && state?.states.get(member.turnId);
  return current?.error ? <p role="alert">Reply updates paused: {current.error} <button className="flow-link" onClick={() => bindings?.retry(member!.turnId)}>Retry reply updates</button></p> : null;
}
export function createAssistantStreamPlugin(): PluginDefinition {
  return { manifest: { id: STREAM_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["task.assistant-stream.read"], activationEvents: ["view:chat.message.footer"], commands: [],
    contributions: [{ kind: "panel", id: STREAM_PANEL, slot: "chat.message.footer", title: "Live assistant text", capability: "task.assistant-stream.read" }] },
    load: async () => ({ activate(context) { context.contribute(STREAM_PANEL, StreamStatusPanel); } }) };
}
export function MessageFooter() {
  const session = useContext(SessionContext)!;
  const scope = useContext(ThreadScope);
  const stream = useContext(StreamBindingsContext);
  const messageId = useAuiState(state => state.message.id);
  const role = useAuiState(state => state.message.role);
  const taskId = scope.messageTask?.(messageId);
  const panels = useSyncExternalStore(listener => session.host.subscribeSlot("chat.message.footer", listener), () => session.host.getSlotSnapshot("chat.message.footer"));
  const custom = useAuiState(state => state.message.metadata.custom);
  if (taskId && role === "assistant" && stream?.getSnapshot().members.get(messageId)?.draft) {
    const fact = custom.flowStream as { interrupted?: boolean; observationPaused?: boolean; truncated?: boolean; phase?: string } | undefined;
    return <p className="mt-1 text-xs text-muted-foreground" data-stream-status={messageId}>{fact?.interrupted ? "Interrupted draft" : fact?.observationPaused ? "Draft · updates paused" : fact?.phase === "block-complete" ? "Draft · block complete" : "Draft · generating"}{fact?.truncated ? " · truncated" : ""} · not the final reply</p>;
  }
  if (!taskId || role !== "user") return null;
  const context: ResourceContext = { kind: "message", taskId, messageId, role };
  return <div className="my-2 w-full min-w-0 space-y-2" data-extension-slot="chat.message.footer">
    {panels.filter(item => item.declaration.kind === "panel").map(item => <PluginView key={item.declaration.id} host={session.host} contributionId={item.declaration.id} context={context} />)}
    <AppSlot slot="chat.message.footer" context={context} />
  </div>;
}
export function AppSlot({ slot, context = globalContext, className = "" }: { slot: SlotId; context?: ResourceContext; className?: string }) {
  const session = useContext(SessionContext);
  return session ? <ExtensionSlot host={session.host} slot={slot} context={context} className={`flow-plugin-slot ${className}`} /> : null;
}
export function MessageActions() {
  const scope = useContext(ThreadScope);
  const messageId = useAuiState(state => state.message.id);
  const role = useAuiState(state => state.message.role);
  const taskId = scope.messageTask ? scope.messageTask(messageId) : scope.taskId;
  if (!taskId || (role !== "user" && role !== "assistant")) return null;
  return <AppSlot slot="chat.message.actions" context={{ kind: "message", taskId, messageId, role }} className="flow-message-extensions" />;
}
export function ComposerActions() {
  const { viewId, taskId, editableComposer } = useContext(ThreadScope);
  return <span data-composer-view={viewId}><AppSlot slot="chat.composer.actions" context={{ kind: "composer", viewId, isDraft: editableComposer ?? (!taskId && viewId.startsWith("draft-")) }} /></span>;
}

/** The rail stays 48px wide; text-based contributed actions live in an accessible popover. */
export function PluginRail() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className="flow-plugin-rail" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button className="flow-icon" ref={trigger} aria-label="Extension actions" title="Extension actions" aria-expanded={open} onClick={() => setOpen(value => !value)}><Puzzle size={18} /></button>
    {open && <div className="flow-plugin-popover" aria-label="Extension actions">
      <AppSlot slot="activityBar.primary" />
      <AppSlot slot="activityBar.bottom" />
    </div>}
  </div>;
}

/** Only mounted for the explicit disclosure; failed chunks cannot tear down the chat. */
function RegistryManagement({ registry }: { registry: PluginRegistryReader }) {
  const session = useContext(SessionContext)!;
  const centerRuntime = useSyncExternalStore(session.centerRuntime.subscribe, session.centerRuntime.getSnapshot);
  const [View, setView] = useState<ComponentType<PluginManagementProps>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    setFailed(false);
    void import("../plugin-management/PluginManagement").then(
      module => { if (current) setView(() => module.PluginManagement); },
      () => { if (current) setFailed(true); },
    );
    return () => { current = false; };
  }, []);
  if (View) return <View open sessionId={centerRuntime?.sessionId ?? session.id} registry={registry} runtime={session.host} centerRuntime={centerRuntime ?? undefined} />;
  return failed
    ? <p role="alert">Plugin management could not load. You can keep chatting. Copy unsent text before you reload this page to try again.</p>
    : <p role="status">Loading plugin management…</p>;
}

export function PluginSettings({ registry }: { registry: PluginRegistryReader }) {
  const session = useContext(SessionContext)!;
  const centerRuntime = useSyncExternalStore(session.centerRuntime.subscribe, session.centerRuntime.getSnapshot);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string>();
  const [managementExpanded, setManagementExpanded] = useState(false);
  useLayoutEffect(() => {
    if (!session.managementAvailable()) { setOpen(false); setManagementExpanded(false); }
  }, [session, centerRuntime]);
  const plugins = useSyncExternalStore(session.host.subscribe, session.host.list);
  const diagnostics = useSyncExternalStore(session.host.subscribeDiagnostics, session.host.getDiagnostics);
  const sections = useSyncExternalStore(listener => session.host.subscribeSlot("settings.sections", listener), () => session.host.getSlotSnapshot("settings.sections"));
  return <>
    <button className="flow-icon" ref={trigger} aria-label="Extensions and appearance" title="Extensions and appearance" onClick={() => { if (session.managementAvailable()) setOpen(true); }}><SlidersHorizontal size={18} /></button>
    <Dialog open={open} onOpenChange={value => setOpen(value && session.managementAvailable())}><DialogContent className="flow-plugin-settings" onCloseAutoFocus={event => {
      event.preventDefault(); const button = trigger.current;
      if (session.managementAvailable() && button?.isConnected && !button.disabled && button.getClientRects().length) button.focus();
    }}><DialogHeader><DialogTitle>Extensions and appearance</DialogTitle><DialogDescription>Manage trusted browser extensions and inspect this center’s plugin registry. Turning an extension off does not cancel your tasks.</DialogDescription></DialogHeader>
      <section className="flow-local-extension-controls" aria-label="Local extension controls">
      {error && <p role="alert">{error}</p>}
      <ul>{plugins.map(plugin => <li key={plugin.id}><div><strong>{plugin.id}</strong><small>{plugin.version} · {plugin.state}</small></div><button type="button" className="flow-view-action" onClick={async () => {
        setError(undefined);
        const result = await (plugin.state === "disabled" ? session.host.activate(plugin.id) : session.host.deactivate(plugin.id));
        if (!result.ok) setError(result.error);
      }}>{plugin.state === "disabled" ? "Enable" : "Disable"} {plugin.id}</button></li>)}</ul>
      {sections.filter(section => section.declaration.kind === "panel").map(section => <PluginView key={section.declaration.id} host={session.host} contributionId={section.declaration.id} context={globalContext} />)}
      <AppSlot slot="settings.sections" />
      <details><summary>Extension diagnostics ({diagnostics.length})</summary>{diagnostics.length ? <ul>{diagnostics.map((entry, index) => <li key={index}>{entry.pluginId} · {entry.phase}: {entry.message}</li>)}</ul> : <p>No extension errors reported.</p>}</details>
      </section>
      <details className="flow-plugin-management-disclosure" open={managementExpanded} onToggle={event => setManagementExpanded(event.currentTarget.open)}>
        <summary>Plugin management</summary>
        {open && managementExpanded && <RegistryManagement registry={registry} />}
      </details>
    </DialogContent></Dialog>
  </>;
}

function WorkspaceContributions({ context, request, onClose }: { context: ResourceContext; request: number | undefined; onClose: () => void }) {
  const session = useContext(SessionContext)!;
  const items = useSyncExternalStore(listener => session.host.subscribeSlot("workspace.tabs", listener), () => session.host.getSlotSnapshot("workspace.tabs")).filter(item => item.declaration.kind === "panel");
  const [selected, setSelected] = useState("flow.workspace.panel");
  const [visited, setVisited] = useState(() => new Set(["flow.workspace.panel"]));
  const active = items.some(item => item.declaration.id === selected) ? selected : items[0]?.declaration.id;
  const ids = items.map(item => item.declaration.id).join("|");
  const prefix = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const focusedId = useRef<string | null>(null);
  useEffect(() => { if (request !== undefined) setSelected("flow.workspace.panel"); }, [request]);
  useEffect(() => {
    setVisited(previous => new Set([...previous, ...(active ? [active] : [])].filter(id => items.some(item => item.declaration.id === id))));
    if (focusedId.current && !items.some(item => item.declaration.id === focusedId.current)) {
      const next = tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      next?.focus(); focusedId.current = next?.dataset.contribution ?? null;
    }
  }, [active, ids]);
  return <section aria-label="Extensions"><div className="flow-plugin-workspace-bar"><div role="tablist" aria-label="Extension panels" ref={tabs}>
    {items.map((item, index) => <button key={item.declaration.id} type="button" role="tab" data-contribution={item.declaration.id}
      id={`${prefix}-tab-${item.declaration.id}`} aria-controls={`${prefix}-panel-${item.declaration.id}`} aria-selected={item.declaration.id === active} tabIndex={item.declaration.id === active ? 0 : -1}
      onFocus={() => { focusedId.current = item.declaration.id; }} onBlur={event => { if (event.relatedTarget && !tabs.current?.contains(event.relatedTarget)) focusedId.current = null; }}
      onClick={() => setSelected(item.declaration.id)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); setSelected(items[next]!.declaration.id);
        tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>{item.declaration.title}</button>)}
  </div><AppSlot slot="workspace.tabs" context={context} className="flow-workspace-extension-actions" />
    <button type="button" onClick={onClose}>Close extensions</button>
  </div>{items.filter(item => visited.has(item.declaration.id)).map(item => <Activity key={item.declaration.id} mode={active === item.declaration.id ? "visible" : "hidden"}>
    <div role="tabpanel" id={`${prefix}-panel-${item.declaration.id}`} aria-labelledby={`${prefix}-tab-${item.declaration.id}`}>
      <PluginView host={session.host} contributionId={item.declaration.id} context={context} />
    </div>
  </Activity>)}</section>;
}

export function PluginWorkspace({ state, activeTab, focusRequest, container, onClose }: {
  state: ProjectionState;
  activeTab: WorkspaceTabId;
  focusRequest: { serial: number; taskId: string; tab: WorkspaceTabId } | null;
  container: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const session = useContext(SessionContext)!;
  useLayoutEffect(() => session.publishWorkspace({ task: state.task, details: state.details, connection: state.connection }), [session, state.task, state.details, state.connection]);
  const context: ResourceContext = { kind: "workspace", taskId: state.task?.id ?? null, tabId: activeTab };
  const referenceId = activeTab.startsWith("detail:") ? activeTab.slice(7) : null;
  const reference = state.task?.entries.find(entry => entry.kind === "reference" && entry.reference.id === referenceId);
  const focused = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequest || focusRequest.taskId !== state.task?.id || focusRequest.tab !== activeTab || focused.current === focusRequest.serial) return;
    const focus = () => {
      const tab = container.current?.querySelector<HTMLButtonElement>('.flow-workspace-tabs [role="tab"][aria-selected="true"]');
      if (!tab || tab.offsetParent === null || !tab.getAttribute("aria-controls")?.endsWith(encodeURIComponent(activeTab))) return false;
      tab.focus(); focused.current = focusRequest.serial; return true;
    };
    if (focus() || !container.current) return;
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
    observer.observe(container.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected", "style"] });
    return () => observer.disconnect();
  }, [focusRequest, state.task?.id, activeTab, container]);
  return <WorkspaceChromeContext.Provider value={{
    header: <AppSlot slot="workspace.header" context={context} />,
    actions: <AppSlot slot="workspace.actions" context={context} />,
    artifact: state.task && reference && referenceId ? <AppSlot slot="artifact.actions" context={{ kind: "reference", taskId: state.task.id, referenceId }} /> : null,
  }}><div className="flow-plugin-workspace" key={session.id}>
    <WorkspaceContributions context={context} request={focusRequest?.serial} onClose={onClose} />
  </div></WorkspaceChromeContext.Provider>;
}

export { ConversationSteering } from "./steering";

/** Uses the existing P01 panel and Dialog. Closing this disclosure never disposes draft material. */
export function AttachmentComposer({ binding, runtime, onAttached, recovery, children }: { binding: ConversationAttachments | null; runtime: AssistantRuntime; onAttached?(): void; recovery?: { restore(): void | Promise<void>; discard(): void }; children: React.ReactNode }) {
  const session = useContext(SessionContext)!;
  const state = useSyncExternalStore(binding?.subscribe ?? (() => () => {}), binding?.getSnapshot ?? (() => null));
  const hasSubmission = useSyncExternalStore(listener => runtime.thread.composer.subscribe(listener), () => runtime.thread.composer.getState().submission !== undefined);
  const active = useSyncExternalStore(session.host.subscribe, () => session.host.list().find(plugin => plugin.id === ATTACHMENT_OWNER)?.state === "active");
  if (!binding) return <>{children}</>;
  const add = async (id: string) => { if (!binding.input) throw Error("Attachment input is unavailable."); await runtime.thread.composer.addAttachment(createExistingAttachment(binding.input, id)); onAttached?.(); };
  const remove = async (id: string) => {
    const index = runtime.thread.composer.getState().attachments.findIndex(item => item.id === id);
    if (index >= 0) await runtime.thread.composer.getAttachmentByIndex(index).remove();
    binding.input?.remove(id);
  };
  const restore = async () => {
    if (recovery) { await recovery.restore(); return; }
    const held = state?.submission?.value; if (!held || runtime.thread.composer.getState().text || runtime.thread.composer.getState().attachments.length) return;
    runtime.thread.composer.setText(held.capture.text);
    for (const id of held.ids) { if (binding.input?.getSnapshot().items.some(item => item.id === id)) await add(id); }
  };
  return <AttachmentSurfaceProvider value={{ binding, onAttach: add, onRemove: remove }}>{children}
    {state?.error && <p role="alert">{state.error}</p>}
    {recovery && state?.submission?.state === "preparing" && hasSubmission && <button className="flow-link" type="button"
      onClick={() => { if (binding.getSnapshot().submission?.state === "preparing" && runtime.thread.composer.getState().submission) runtime.thread.composer.cancel(); }}>Cancel material preparation</button>}
    {state?.submission?.state === "failed" && <section className="flow-conversation-receipt" aria-label="Unsent material recovery"><strong>Materials were not handed to a message receipt</strong><p>{state.submission.error}</p><pre>{state.submission.value.capture.text}</pre>
      <button className="flow-link" type="button" onClick={() => void restore()}>Restore into an empty draft</button>{" "}
      <button className="flow-link" type="button" onClick={() => { if (recovery) recovery.discard(); else binding.discardFailedSubmission(); }}>Discard held submission (keep draft files)</button>
    </section>}
    <Dialog open={!!state?.open && active && binding.input?.getSnapshot().readiness.visible !== false} onOpenChange={open => { if (!open) binding.close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" onCloseAutoFocus={event => {
      event.preventDefault(); const context = binding.context(); if (context.kind === "composer") [...document.querySelectorAll<HTMLButtonElement>(`[data-composer-view="${CSS.escape(context.viewId)}"] button`)].find(button => button.textContent === "Files")?.focus();
    }}><DialogHeader><DialogTitle>Project text files</DialogTitle><DialogDescription>Upload a small text file or choose @file from this project. Preview content only when needed.</DialogDescription></DialogHeader>
      <PluginView host={session.host} contributionId={ATTACHMENT_PANEL} context={binding.context()} />
    </DialogContent></Dialog>
  </AttachmentSurfaceProvider>;
}
