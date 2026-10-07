import { messageSettingsDraft, type MessageSettingsDraft } from "./plugin-integration/message-settings";
import { ConnectionSession } from "./connection/session";
import { ConversationRecoveryJournal, recoveryAddress, namespaceKey, recoveryValue, type RecoveryNamespace, type RecoveryRecord, type CommandRecord } from "./recovery/journal";
import { RecoverySurface, readRecoveryDraft, restoreConversationDraft, type RecoveryHost } from "./recovery/binding";
import { canOpenConversation, retentionReasons, MAX_RESIDENT_CONVERSATIONS } from "./workspace-retention";
import { SteeringSurfaces, type SteeringIdentity } from "./plugin-integration/steering";
import {
  Activity,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  type CSSProperties,
} from "react";
import { FlowClient } from "@flow/client";
import type { PluginRegistryReader } from "./plugin-management/PluginManagement";
import {
  idSchema,
  TERMINAL_STATUSES,
  type TaskStatus,
  type TaskSummary,
} from "@flow/contracts";
import {
  Columns2,
  LayoutDashboard,
  Files,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelRight,
  Plus,
  Settings2,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import {
  type WorkspaceTabId,
} from "./components/workspace/WorkspacePanels";
import { TaskProjection } from "./projection";
import { ConversationProjection, ConversationCatalog } from "./conversations/projection";
import { restoreOutbox } from "./conversations/outbox";
import { ConversationThread } from "./conversations/ConversationThread";
import { ConversationList } from "./conversations/ConversationList";
import { createExecutionProfileCatalog, type ExecutionProfileCatalog } from "./execution-profiles/catalog";
import { legacyDefaultSelection, type ProfileSelection } from "./execution-profiles/selection";
import { userMessageId } from "./conversations/messages";
import { WorkspaceOverview } from "./workspace-feed/WorkspaceOverview";
import { TaskThread, fixtureMode, type DraftState } from "./TaskThread";
import { Button } from "./components/ui/button";
import { TooltipProvider } from "./components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { applyTheme, initialTheme, themes, type Theme } from "./themes";
import { AppPluginSession, type AppActions } from "./plugin-integration/session";
import { PluginProvider, AppSlot, PluginRail, PluginSettings, PluginWorkspace } from "./plugin-integration/react";
import {
  mergeChats, splitChat, MAX_VISIBLE_PANES, MAX_OPEN_VIEWS,
  emptyLayout, activeWorkspace, layoutGroups, updateWorkspace, addWorkspace, removeWorkspace, selectLayoutView,
  renameLayoutView, closeLayoutView, reorderPane, resizePanes, readLayout,
  type ChatGroup, type WorkspaceLayout,
} from "./workspace-state";
import { AppLayoutPort, type LayoutCloseAuthorization } from "./plugin-integration/layout";
import { WorkspaceTabs, PaneTabs } from "./workspace-layout/WorkspaceTabs";
import "./workspace-layout/layout.css";

const statusLabels: Record<TaskStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Needs your decision",
  cancel_requested: "Cancellation requested",
  succeeded: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  uncertain: "Needs reconciliation",
};
function Status({ status }: { status: TaskStatus }) {
  return (
    <span className={`flow-status status-${status}`}>
      <i aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`flow-icon ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function CloseChatButton({
  view,
  onClose,
}: {
  view: View;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  return (
    <button
      aria-label={`Close ${view.conversation?.getSnapshot().snapshot?.conversation.title ?? state.task?.title ?? view.title}`}
      tabIndex={-1}
      onClick={onClose}
    >
      <X size={12} />
    </button>
  );
}
function ChatTitle({ view }: { view: View }) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  const conversation = useSyncExternalStore(view.conversation?.subscribe ?? noSubscription, view.conversation?.getSnapshot ?? noSnapshot);
  return conversation?.snapshot?.conversation.title ?? state.task?.title ?? view.title;
}
const noSubscription = () => () => undefined;
const noSnapshot = () => null;
function ChatListItem({
  task,
  view,
  selected,
  onSelect,
}: {
  task: TaskSummary;
  view?: View;
  selected: boolean;
  onSelect: () => void;
}) {
  const snapshot = useSyncExternalStore(
    view?.projection.subscribe ?? noSubscription,
    view ? () => view.projection.getSnapshot().task : noSnapshot,
  );
  const latest = snapshot ?? task;
  return (
    <div className={`flow-chat-row ${selected ? "selected" : ""}`}>
    <button
      title={latest.title}
      className={selected ? "selected" : ""}
      onClick={onSelect}
    >
      <i
        className={`status-dot status-${latest.status}`}
        aria-label={statusLabels[latest.status]}
      />
      <span>{latest.title}</span>
    </button>
    <AppSlot slot="sidebar.item.actions" context={{ kind: "task", taskId: task.id }} />
    </div>
  );
}
interface View {
  readonly key: string;
  projection: TaskProjection;
  title: string;
  conversation?: ConversationProjection;
  intent?: "follow-up" | "queue";
  restoredVersion?: number;
  settings: MessageSettingsDraft;
}
interface PanelFocusRequest { serial: number; taskId: string; tab: WorkspaceTabId }
function ChatPane({
  viewId,
  visible,
  view,
  drafts,
  profiles,
  profileSelection,
  onProfileSelection,
  onDraftChange,
  onIntent,
  onAccepted,
  onOpenReference,
  onActivate,
  onInspect,
  onOpenTask,
}: {
  viewId: string;
  visible: boolean;
  view: View;
  drafts: Map<string, DraftState>;
  profiles: ExecutionProfileCatalog;
  profileSelection: ProfileSelection;
  onProfileSelection: (selection: ProfileSelection) => void;
  onDraftChange: () => void;
  onIntent: (intent: "follow-up" | "queue") => void;
  onAccepted: (id: string) => void;
  onOpenReference: (id: string) => void;
  onActivate: () => void;
  onInspect: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  const [confirm, setConfirm] = useState(false);
  const task = state.task;
  if (view.conversation) return <section className="flow-chat-pane" onFocusCapture={onActivate} onPointerDown={onActivate} aria-label={view.conversation.getSnapshot().snapshot?.conversation.title ?? "New conversation"}><div className="flow-thread"><ConversationThread viewKey={view.key} viewId={viewId} visible={visible} projection={view.conversation} drafts={drafts} profiles={profiles} profileSelection={profileSelection} onProfileSelection={onProfileSelection} intent={view.intent ?? "follow-up"} onIntent={onIntent} onDraftChange={onDraftChange} restoredVersion={view.restoredVersion ?? 0} onAccepted={onAccepted} onInspect={onInspect} onOpenTask={onOpenTask} onCurrentTask={id => { if (view.projection.getSnapshot().task?.id !== id) void view.projection.select(id); }} /></div></section>;
  if (!task && !viewId.startsWith("draft-")) return <section className="flow-no-chat" aria-label="Task loading state">
    {state.error ? <><p role="alert">Could not load this task: {state.error}</p><Button variant="outline" onClick={() => void view.projection.select(viewId)}>Retry task</Button></> : <p role="status">{state.connection === "disconnected" ? "Task is not loaded. Reconnect to the center or retry." : "Loading task…"}</p>}
    {!state.error && state.connection === "disconnected" && <Button variant="outline" onClick={() => void view.projection.select(viewId)}>Retry task</Button>}
  </section>;
  return (
    <section
      className="flow-chat-pane"
      onFocusCapture={onActivate}
      onPointerDown={onActivate}
      aria-label={task?.title ?? "New chat"}
    >
      {task && (
        <div
          className="flow-task-bar"
          data-extension-slot="chat.task.actions"
        >
          <Status status={task.status} />
          <AppSlot slot="chat.task.actions" context={{ kind: "task", taskId: task.id }} />
          <span className={`verification-${task.verificationStatus}`}>
            {task.verificationStatus === "passed"
              ? "Verified"
              : task.verificationStatus === "failed"
                ? "Verification failed"
                : "Verification pending"}
          </span>
          <details className="flow-usage">
            <summary>Usage</summary>
            <dl>
              <dt>Input tokens</dt>
              <dd>{task.usage.inputTokens ?? "Unknown"}</dd>
              <dt>Output tokens</dt>
              <dd>{task.usage.outputTokens ?? "Unknown"}</dd>
              <dt>Cost</dt>
              <dd>
                {task.usage.costUsd === null
                  ? "Unknown"
                  : `$${task.usage.costUsd.toFixed(4)}`}{" "}
                · {task.usage.costKind}
              </dd>
              <dt>Coverage</dt>
              <dd>{task.usage.incomplete ? "Incomplete" : "Complete"}</dd>
              <dt>Task ID</dt>
              <dd>{task.id}</dd>
            </dl>
          </details>
          <span className={`connection ${state.connection}`} role="status">
            {state.connection === "live"
              ? "Live"
              : state.connection === "disconnected"
                ? "Offline · task continues"
                : state.connection === "reconnecting"
                  ? "Reconnecting…"
                  : "Connecting…"}
          </span>
          {!TERMINAL_STATUSES.includes(task.status) &&
            task.status !== "cancel_requested" && (
              <button className="flow-link" onClick={() => setConfirm(true)}>
                Cancel task
              </button>
            )}
        </div>
      )}
      {state.error && (
        <div className="flow-notice" role="alert">
          {state.error}
          <button
            className="flow-link"
            onClick={() => view.projection.clearError()}
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flow-thread">
        <TaskThread
          viewId={viewId}
          state={state}
          projection={view.projection}
          drafts={drafts}
          onAccepted={onAccepted}
          onOpenReference={onOpenReference}
        />
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this task?</DialogTitle>
            <DialogDescription>
              The runner will be asked to stop. Work already completed will be
              kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Keep running
            </Button>
            <Button
              disabled={state.pending}
              onClick={() => {
                setConfirm(false);
                void view.projection.cancel();
              }}
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
interface RecoveryEnvironment { session: ConnectionSession; namespace: RecoveryNamespace; journal: ConversationRecoveryJournal }
function Workspace({
  client,
  recovery,
  active = true,
  onDisconnect,
  onRecoveryGuard,
  theme,
  onTheme,
}: {
  client: FlowClient;
  recovery?: RecoveryEnvironment;
  active?: boolean;
  onDisconnect: () => void;
  onRecoveryGuard?: (guard: (() => Promise<void>) | null) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  const connectionState = useSyncExternalStore(recovery?.session.subscribe ?? noSubscription, recovery?.session.getSnapshot ?? noSnapshot);
  const authorized = !recovery || (active && recovery.session.authorized(recovery.namespace));
  const authorizedRef = useRef(authorized); authorizedRef.current = authorized;
  const activeRuntimeWorkspace = useRef(active);
  useLayoutEffect(() => { activeRuntimeWorkspace.current = active; }, [active]);
  const centerRuntime = useMemo<AppActions["centerRuntime"]>(() => recovery ? {
    reader: client,
    writer: client,
    subscribe: recovery.session.subscribe,
    authorityKey: () => activeRuntimeWorkspace.current && recovery.session.authorized(recovery.namespace)
      ? JSON.stringify([namespaceKey(recovery.namespace), recovery.session.getSnapshot().generation]) : null,
  } : undefined, [client, recovery?.session, recovery?.namespace]);
  const profileRef = useRef<Record<string, ProfileSelection>>({});
  const [recoveryError, setRecoveryError] = useState<string>();
  const registry = useMemo<PluginRegistryReader>(() => ({
    plugins: (options, signal) => client.plugins(options, signal),
    plugin: (id, revision, signal) => client.plugin(id, revision, signal),
    pluginVersions: (id, options, signal) => client.pluginVersions(id, options, signal),
    pluginOperations: (id, options, signal) => client.pluginOperations(id, options, signal),
  }), [client]);
  const [catalog] = useState(() => new TaskProjection(client));
  const [conversations] = useState(() => new ConversationCatalog(client));
  const [profiles] = useState(() => createExecutionProfileCatalog({ executionProfiles: (options, signal) => client.executionProfiles(options, signal) }));
  const [profileSelections, setProfileSelections] = useState<Record<string, ProfileSelection>>({});
  profileRef.current = profileSelections;
  const [defaultProfileSelection] = useState(legacyDefaultSelection);
  const list = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [views] = useState(() => new Map<string, View>());
  const [drafts] = useState(() => new Map<string, DraftState>());
  const [layout, setLayout] = useState<WorkspaceLayout>(emptyLayout);
  const [layoutPort] = useState(() => new AppLayoutPort());
  useLayoutEffect(() => () => layoutPort.suspend(), [layoutPort]);
  const workspace = activeWorkspace(layout), groups = workspace.panes, activeGroup = workspace.activePaneId;
  const currentLayout = useRef(layout);
  const currentGroups = useRef(layoutGroups(layout));
  const visibleGroups = useRef(groups);
  useLayoutEffect(() => { currentLayout.current = layout; currentGroups.current = layoutGroups(layout); visibleGroups.current = groups; }, [layout, groups]);
  const setGroups = (update: SetStateAction<ChatGroup[]>) => setLayout(previous => updateWorkspace(previous, tab => ({
    ...tab, panes: typeof update === "function" ? update(tab.panes) : update,
  })));
  const setActiveGroup = (id: string) => setLayout(previous => {
    const owner = previous.tabs.find(tab => tab.panes.some(pane => pane.id === id));
    return owner ? { ...previous, activeTabId: owner.id, tabs: previous.tabs.map(tab => tab === owner ? { ...tab, activePaneId: id } : tab) } : previous;
  });
  const [retainedOpen, setRetainedOpen] = useState(false);
  const [capacityBlocked, setCapacityBlocked] = useState(false);
  const retainedInvoker = useRef<HTMLElement | null>(null);
  const retainedDestination = useRef<string | null>(null);
  const showRetained = (full: boolean) => { retainedInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; retainedDestination.current = null; setCapacityBlocked(full); setRetainedOpen(true); };
  const lastRoute = useRef(location.hash);
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 800);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelVisited, setPanelVisited] = useState(false);
  const panelContainer = useRef<HTMLDivElement>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<PanelFocusRequest | null>(null);
  const [panelTabs, setPanelTabs] = useState<Record<string, WorkspaceTabId>>(
    {},
  );
  const [loadingList, setLoadingList] = useState(false);
  const [overview, setOverview] = useState(() => location.hash === "#workspace");
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const changed = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  const refreshChats = async (more = false) => {
    setLoadingList(true);
    catalog.clearError();
    await catalog.list(more);
    setLoadingList(false);
  };
  const residentCount = () => new Set([...views.values()].filter(view => view.conversation)).size;
  const ensureView = (id: string, restoredKey?: string): View | null => {
    let view = views.get(id);
    if (restoredKey && view && view.key !== restoredKey) throw Error("This conversation is already open with another local draft. Close its empty view before restoring the saved identity.");
    if (!view && id.startsWith("conversation:")) {
      const cached = [...views.entries()].find(([, item]) => item.conversation?.getSnapshot().snapshot?.conversation.id === id.slice(13));
      if (cached) {
        if (restoredKey && cached[1].key !== restoredKey) throw Error("This conversation already has another local draft identity. Keep that draft before restoring this record.");
        const [oldId, existing] = cached; view = existing; views.delete(oldId); views.set(id, existing);
        const draft = drafts.get(oldId); if (draft) { drafts.set(id, draft); drafts.delete(oldId); }
        setPanelTabs(previous => { const next = { ...previous }; if (next[oldId]) { next[id] = next[oldId]!; delete next[oldId]; } return next; });
        setLayout(previous => renameLayoutView(previous, oldId, id));
        session?.recovery.changed(existing.key);
      }
    }
    if (!view && (id.startsWith("draft-") || id.startsWith("conversation:")) && !canOpenConversation(residentCount(), false)) {
      showRetained(true); return null;
    }
    if (!view) {
      view = {
        key: restoredKey ?? crypto.randomUUID(),
        settings: messageSettingsDraft(),
        projection: new TaskProjection(client),
        ...((id.startsWith("draft-") || id.startsWith("conversation:")) ? { conversation: new ConversationProjection(client, id.startsWith("conversation:") ? id.slice(13) : null) } : {}),
        title: id.startsWith("draft-")
          ? "New chat"
          : (list.tasks.find((task) => task.id === id)?.title ?? "Task"),
      };
      views.set(id, view);
      view.projection.setVisible(false);
      view.projection.setOnline(navigator.onLine && authorizedRef.current);
      view.conversation?.setOnline(navigator.onLine && authorizedRef.current);
      if (recovery && session && view.conversation) view.conversation.configureRecovery(session.recovery.commandPort(view.key));
      // Selecting a legacy task performs HTTP work. Defer it until this view is visible.
    }
    return view;
  };
  const newChat = () => {
    session?.closeMessageSettings();
    if (currentGroups.current.reduce((count, pane) => count + pane.tabs.length, 0) >= MAX_OPEN_VIEWS) { setRecoveryError("Close an open chat before opening another workspace view."); return; }
    if (!canOpenConversation(residentCount(), false)) { showRetained(true); return; }
    const id = `draft-${crypto.randomUUID()}`;
    if (!ensureView(id)) return;
    setCapacityBlocked(false); setOverview(false);
    if (!profiles.getSnapshot().loaded && !profiles.getSnapshot().loading) void profiles.refresh();
    if (window.innerWidth <= 800) setSidebar(false);
    setLayout(previous => selectLayoutView(previous, activeGroup, id));
  };
  const select = (id: string) => {
    session?.closeMessageSettings();
    const openRoutes = currentGroups.current.flatMap(pane => pane.tabs);
    if (!openRoutes.includes(id) && openRoutes.length >= MAX_OPEN_VIEWS) { setRecoveryError("Close an open chat before opening another workspace view."); return; }
    if (!ensureView(id)) { history.replaceState(null, "", lastRoute.current || location.pathname + location.search); return; }
    setCapacityBlocked(false); setOverview(false);
    if (window.innerWidth <= 800) setSidebar(false);
    setLayout(previous => selectLayoutView(previous, activeGroup, id));
    history.replaceState(null, "", id.startsWith("conversation:") ? `#conversation=${encodeURIComponent(id.slice(13))}` : `#task=${encodeURIComponent(id)}`);
  };
  const hideSettings = () => session?.closeMessageSettings();
  const routeActions = useRef({ select, newChat, hideSettings });
  const initialRoute = useRef(location.hash);
  const routeInitialized = useRef(false);
  useLayoutEffect(() => {
    // Route listeners outlive renders; dispatch through the last committed session/actions.
    routeActions.current = { select, newChat, hideSettings };
  });
  useEffect(() => {
    void refreshChats();
    void conversations.refresh();
    const followRoute = () => {
      if (!routeInitialized.current) { initialRoute.current = location.hash; return; }
      const params = new URLSearchParams(location.hash.slice(1));
      const conversation = params.get("conversation");
      const id = params.get("task");
      if (conversation) routeActions.current.select(`conversation:${conversation}`);
      else if (id) routeActions.current.select(id);
      else if (location.hash === "#workspace") { routeActions.current.hideSettings(); setOverview(true); }
      else routeActions.current.newChat();
    };
    const online = () =>
      views.forEach((view) => { view.projection.setOnline(authorizedRef.current); view.conversation?.setOnline(authorizedRef.current); });
    const offline = () =>
      views.forEach((view) => { view.projection.setOnline(false); view.conversation?.setOnline(false); });
    window.addEventListener("hashchange", followRoute);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("hashchange", followRoute);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      views.forEach((view) => { view.projection.disconnect(); view.conversation?.dispose(); });
      conversations.dispose();
      profiles.dispose();
      catalog.disconnect();
    };
  }, [client]);
  const focused = groups.find((group) => group.id === activeGroup) ?? groups[0];
  const selectedId = focused?.activeId;
  const selected = selectedId ? views.get(selectedId) : null;
  const selectedTask = useSyncExternalStore(selected?.projection.subscribe ?? noSubscription, selected ? () => selected.projection.getSnapshot().task : noSnapshot);
  const selectedTaskId = selectedTask?.id ?? null;
  useEffect(() => {
    const visible = new Set(overview || !pageVisible || !authorized ? [] : groups.map(group => group.activeId));
    views.forEach((view, id) => {
      const shown = visible.has(id);
      view.projection.setVisible(shown); view.conversation?.setVisible(shown);
      if (shown && !view.conversation && view.projection.getSnapshot().task?.id !== id && view.projection.getSnapshot().connection !== "connecting")
        void view.projection.select(id);
    });
  }, [groups, overview, pageVisible, views, authorized]);
  const syncWorkspaceSummaries = useCallback((tasks: TaskSummary[]) => {
    tasks.forEach(task => { catalog.syncSummary(task); views.get(task.id)?.projection.syncSummary(task); });
  }, [catalog, views]);
  useEffect(() => {
    lastRoute.current = overview ? "#workspace" : selectedId?.startsWith("conversation:") ? `#conversation=${encodeURIComponent(selectedId.slice(13))}` : selectedId?.startsWith("draft-") ? "" : selectedId ? `#task=${encodeURIComponent(selectedId)}` : "";
    if (selectedId && !overview)
      history.replaceState(
        null,
        "",
        selectedId.startsWith("draft-")
          ? location.pathname + location.search
          : selectedId.startsWith("conversation:") ? `#conversation=${encodeURIComponent(selectedId.slice(13))}` : `#task=${encodeURIComponent(selectedId)}`,
      );
  }, [selectedId, overview]);
  const panel = panelTabs[selectedId ?? ""] ?? "files";
  const setPanel = (tab: WorkspaceTabId, id = selectedId) => {
    setPanelVisited(true);
    if (id) setPanelTabs((previous) => ({ ...previous, [id]: tab }));
    if (id) setPanelFocusRequest(previous => ({ serial: (previous?.serial ?? 0) + 1, taskId: views.get(id)?.projection.getSnapshot().task?.id ?? id, tab }));
    setPanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.flow-workspace-bar button[aria-label="Toggle workspace panel"]')?.focus());
  };
  const [leaving, setLeaving] = useState<{ kind: "view"; id: string; key: string; authorization?: LayoutCloseAuthorization } | { kind: "workspace"; id: string; keys: string[] } | { kind: "connection" } | null>(null);
  const protectedReasons = (id: string, view: View) => retentionReasons({
    text: drafts.get(id)?.text ?? "",
    unsubmittedProfile: !!view.conversation && !view.conversation.getSnapshot().snapshot && Object.hasOwn(profileSelections, view.key),
    hasOutbox: !!view.conversation?.getSnapshot().outbox,
    queueReceipts: view.conversation?.queue.getSnapshot().receipts.length ?? 0,
    host: [...(session?.getViewProtection(view.key) ?? ["Host state unavailable"]), ...(view.settings.value ? ["Message settings draft"] : [])],
  });
  const releaseConversation = (view: View) => {
    session?.releaseView(view.key);
    const aliases = [...views].filter(([, candidate]) => candidate.key === view.key).map(([id]) => id);
    aliases.forEach(id => { views.delete(id); drafts.delete(id); });
    const selections = { ...profileRef.current }; delete selections[view.key]; profileRef.current = selections; setProfileSelections(selections);
    setPanelTabs(previous => { const next = { ...previous }; aliases.forEach(id => { delete next[id]; }); return next; });
    const taskId = view.projection.getSnapshot().task?.id;
    setPanelFocusRequest(previous => previous?.taskId === taskId ? null : previous);
    view.conversation?.dispose(); view.projection.disconnect();
  };
  const retainOrRelease = (id: string, discardSteering = false) => {
    const closing = views.get(id);
    if (closing && discardSteering) session?.steering.closeView(closing.key);
    if (closing?.conversation) {
      const reasons = protectedReasons(id, closing);
      closing.conversation.setVisible(false); closing.projection.setVisible(false);
      closing.conversation.clearReadCache(); session?.steering.hide(closing.key);
      if (!reasons.length) releaseConversation(closing);
    }
    else { if (closing) session?.steering.closeView(closing.key); closing?.projection.disconnect(); views.delete(id); drafts.delete(id); }
  };
  const closeNow = (id: string, discardSteering = false) => {
    session?.closeMessageSettings();
    const next = closeLayoutView(layout, id);
    setLayout(next);
    const remaining = activeWorkspace(next).panes;
    const targetGroup = remaining.find(group => group.id === activeGroup) ?? remaining[0];
    if (targetGroup) setActiveGroup(targetGroup.id);
    else history.replaceState(null,"",location.pathname+location.search);
    requestAnimationFrame(() => {
      const target = targetGroup
        ? document.getElementById(`tab-${targetGroup.activeId}`)
        : document.querySelector<HTMLButtonElement>(
            '.flow-workspace-bar button[aria-label="New chat"]',
          );
      target?.focus();
    });
    retainOrRelease(id, discardSteering);
    void refreshChats();
  };
  const close = (id: string, authorization?: LayoutCloseAuthorization) => {
    authorization?.check();
    const view = views.get(id);
    if (view && (session?.steering.risks(view.key) || session?.getViewProtection(view.key).length))
      setLeaving({ kind: "view", id, key: view.key, authorization });
    else { authorization?.commit(); closeNow(id); }
  };
  const confirmLeave = () => {
    const destination = leaving; setLeaving(null);
    try {
      if (destination?.kind === "view") {
        if (views.get(destination.id)?.key !== destination.key) throw Error("The original view changed. Confirm its current identity before closing.");
        destination.authorization?.commit(); closeNow(destination.id, true);
      } else if (destination?.kind === "workspace") void closeWorkspaceNow(destination.id, destination.keys, true);
      else if (destination) void disconnectNow();
    } catch (error) { setRecoveryError(error instanceof Error ? error.message : "This close belongs to an expired layout action."); }
  };
  const closeWorkspaceNow = async (id: string, keys: string[], confirmed = false) => {
    const generation = recovery?.session.getSnapshot().generation;
    try {
      if (recovery) await session?.recovery.flush();
      if (!authorizedRef.current || session?.signal.aborted || (recovery && (!recovery.session.authorized(recovery.namespace) || recovery.session.getSnapshot().generation !== generation)))
        throw Error("Authorize the original connection before closing these workspace views.");
      const current = currentLayout.current, tab = current.tabs.find(item => item.id === id);
      const routes = tab?.panes.flatMap(pane => pane.tabs) ?? [], currentKeys = routes.map(route => views.get(route)?.key);
      if (!tab || keys.length !== currentKeys.length || keys.some(key => !currentKeys.includes(key)))
        throw Error("This workspace changed while confirmation was open. Check its current chats before closing it.");
      if (!confirmed && routes.some(route => protectedReasons(route, views.get(route)!).length)) { setLeaving({ kind: "workspace", id, keys }); return; }
      session?.closeMessageSettings();
      const next = removeWorkspace(current, id); setLayout(next);
      routes.forEach(route => retainOrRelease(route, true));
      requestAnimationFrame(() => document.getElementById(`workspace-tab-${next.activeTabId}`)?.focus());
      void refreshChats();
    } catch (error) { setRecoveryError(error instanceof Error ? error.message : "The workspace draft checkpoint did not finish."); }
  };
  const closeWorkspace = (id: string) => {
    const routes = layout.tabs.find(tab => tab.id === id)?.panes.flatMap(pane => pane.tabs) ?? [];
    const keys = routes.map(route => views.get(route)!.key);
    if (routes.some(route => protectedReasons(route, views.get(route)!).length)) setLeaving({ kind: "workspace", id, keys });
    else void closeWorkspaceNow(id, keys);
  };
  const accepted = (oldId: string, id: string) => {
    void refreshChats();
    const view = views.get(oldId);
    if (!view) return;
    if (view.conversation) {
      const nextId = `conversation:${id}`;
      const stillOpen = currentGroups.current.some(group => group.tabs.includes(oldId) || group.tabs.includes(nextId));
      if (oldId === nextId) {
        if (!stillOpen && !protectedReasons(nextId, view).length) releaseConversation(view);
        void conversations.refresh(); return;
      }
      views.delete(oldId); views.set(nextId, view);
      const draft = drafts.get(oldId); if (draft) { drafts.set(nextId, draft); drafts.delete(oldId); }
      setPanelTabs(previous => { const next = { ...previous }; if (next[oldId]) { next[nextId] = next[oldId]!; delete next[oldId]; } return next; });
      setLayout(previous => renameLayoutView(previous, oldId, nextId));
      session?.recovery.changed(view.key);
      if (!stillOpen && !protectedReasons(nextId, view).length) releaseConversation(view);
      void conversations.refresh(); return;
    }
    views.delete(oldId);
    view.title = view.projection.getSnapshot().task?.title ?? "Task";
    views.set(id, view);
    setLayout(previous => renameLayoutView(previous, oldId, id));
  };
  const taskView = (taskId: string) => [...views.entries()].find(([, view]) => view.projection.getSnapshot().task?.id === taskId);
  const conversationOwnsTask = (taskId: string) => [...views.values()].some(view => view.conversation?.getSnapshot().turns.some(turn => turn.task.id === taskId));
  const inspect = async (viewId: string, taskId: string, tab: WorkspaceTabId = "terminal") => {
    const view = views.get(viewId); if (!view) return;
    if (view.projection.getSnapshot().task?.id !== taskId) await view.projection.select(taskId);
    if (views.get(viewId) !== view || session?.signal.aborted) return;
    setPanel(tab, viewId);
  };
  const assertActivity = (identity: import("./plugin-integration/activity").ActivityIdentity) => {
    if (!authorizedRef.current) throw Error("Reconnect this center before reading activity.");
    const view = views.get(identity.viewId), state = view?.conversation?.getSnapshot();
    const turn = state?.turns.find(turn => turn.id === identity.turnId);
    if (state?.snapshot?.conversation.id !== identity.conversationId || turn?.task.id !== identity.taskId || userMessageId(turn) !== identity.messageId)
      throw Error("This activity does not belong to the bound conversation view.");
  };
  const ownsSteering = (identity: SteeringIdentity) => {
    const view = [...views.values()].find(item => item.key === identity.viewKey), state = view?.conversation?.getSnapshot();
    return authorizedRef.current && state?.snapshot?.conversation.id === identity.conversationId && state.turns.some(turn => turn.id === identity.turnId && turn.task.id === identity.taskId && userMessageId(turn) === identity.messageId);
  };
  const viewEntry = (key: string) => [...views.entries()].find(([, view]) => view.key === key);
  const recoveryHost: RecoveryHost | undefined = recovery ? {
    journal: recovery.journal,
    namespace: () => recovery.session.authorized(recovery.namespace) ? recovery.namespace : null,
    authorized: () => authorizedRef.current,
    generation: () => recovery.session.getSnapshot().generation,
    owner: key => { const entry = viewEntry(key); if (!entry?.[1].conversation) return null; const projectId = entry[1].conversation.getSnapshot().snapshot?.conversation.projectId ?? session?.recoveryMaterials(key).projectId; return { viewKey: key, routeId: entry[0], ...(projectId ? { projectId } : {}) }; },
    draft: key => {
      const entry = viewEntry(key); if (!entry?.[1].conversation || !session) throw Error("This draft has no current conversation owner.");
      const material = session.recoveryMaterials(key);
      return recoveryValue({ messageSettings: entry[1].settings.value, text: drafts.get(entry[0])?.text ?? "", intent: entry[1].intent ?? "follow-up", profile: profileRef.current[key] ?? defaultProfileSelection,
        ...material, attachments: material.attachments.map(item => ({ id: item.id, name: item.name, state: item.state, metadata: item.metadata, uploadKey: item.uploadKey })), steering: session.steering.drafts(key) });
    },
    restore: async (record, lease) => {
      if (!authorizedRef.current || !session || record.namespace !== namespaceKey(recovery.namespace)) throw Error("Authorize this exact center and owner before restoring.");
      const generation = recovery.session.getSnapshot().generation;
      const current = () => { lease.check(); if (!authorizedRef.current || !recovery.session.authorized(recovery.namespace) || generation !== recovery.session.getSnapshot().generation || session.signal.aborted) throw Error("Recovery belongs to an older authenticated connection."); };
      const saved = record.kind === "draft" ? readRecoveryDraft(record.data) : null;
      const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid saved command identity."); return value as Record<string, unknown>; };
      let route = record.owner.routeId;
      if (record.kind === "command") {
        const frozen = object(record.frozen), checkpoint = record.checkpoint === null ? {} : object(record.checkpoint);
        const conversationId = record.domain === "outbox" ? checkpoint.conversationId ?? frozen.conversationId : record.domain === "queue" ? object(frozen.command).conversationId : undefined;
        if (conversationId !== undefined && conversationId !== null) route = `conversation:${idSchema.parse(conversationId)}`;
        if (record.domain === "outbox" && record.phase !== "accepted") restoreOutbox(record); // Validate all frozen wire fields before touching a view.
      }
      if (!route.startsWith("draft-") && !route.startsWith("conversation:")) throw Error("Saved material has no valid conversation route.");
      let existing = viewEntry(record.owner.viewKey);
      if (existing && saved) {
        const material = session.recoveryMaterials(record.owner.viewKey);
        if (existing[1].settings.value || drafts.get(existing[0])?.text || material.knowledge.length || material.attachments.length || session.steering.drafts(record.owner.viewKey).length ||
          (existing[1].intent ?? "follow-up") !== "follow-up" || JSON.stringify(profileRef.current[existing[1].key] ?? defaultProfileSelection) !== JSON.stringify(defaultProfileSelection) ||
          (!existing[1].conversation?.getSnapshot().snapshot && material.projectId))
          throw Error("Keep the complete current draft separately before restoring this one.");
      }
      const placeholder = !existing ? views.get(route) : undefined;
      if (placeholder && placeholder.key !== record.owner.viewKey) {
        if (protectedReasons(route, placeholder).length) throw Error("Keep the current local material before restoring another saved identity in this conversation.");
        // A reload may already have opened this route with a fresh, empty view. Restore the saved stable identity, not a second alias.
        releaseConversation(placeholder);
      }
      const view = existing?.[1] ?? ensureView(route, record.owner.viewKey); if (!view?.conversation) throw Error("Free an empty chat before restoring.");
      const projection = view.conversation;
      projection.configureRecovery(session.recovery.commandPort(view.key));
      if (record.kind === "draft") {
        return restoreConversationDraft(record, lease, {
          refresh: async () => {
            if (route.startsWith("conversation:")) {
              await projection.refresh(); current();
              if (projection.getSnapshot().snapshot?.conversation.id !== route.slice(13)) throw Error("The center did not confirm this conversation.");
              if ((projection.getSnapshot().snapshot?.conversation.projectId ?? null) !== (record.owner.projectId ?? null)) throw Error("The original conversation project does not match this saved record.");
            }
          },
          prepare: restored => {
            if ((restored.projectId ?? undefined) !== record.owner.projectId) throw Error("Saved project metadata does not match its envelope.");
            const targetRoute = existing?.[0] ?? route;
            session.steering.configure(view.key, targetRoute, projection, true);
            const knowledge = session.knowledgeBinding(view.key, projection); knowledge.configure(targetRoute, true);
            // All owners validate before the first selected material or editor field changes.
            const commitKnowledge = knowledge.prepareRestore(restored.projectId, restored.projectTitle, restored.knowledge);
            const attachments = restored.attachments.length ? session.attachmentBinding(view.key, projection) : null;
            if (restored.attachments.length && !attachments) throw Error("Original attachment metadata cannot be restored in this project view.");
            const commitAttachments = attachments?.prepareRestoreDraft(restored.attachments);
            const commitSteering = session.steering.prepareRestoreDrafts(view.key, restored.steering);
            return () => {
              commitSteering(); commitKnowledge(); commitAttachments?.();
              drafts.set(targetRoute, { harness: "claude", scenario: "success", text: restored.text });
              profileRef.current = { ...profileRef.current, [view.key]: restored.profile }; setProfileSelections(profileRef.current);
              view.settings = messageSettingsDraft(restored.messageSettings);
              view.intent = restored.intent; view.restoredVersion = (view.restoredVersion ?? 0) + 1;
              select(targetRoute); setGroups(previous => [...previous]);
            };
          },
        });
      }
      if (record.kind === "command" && record.domain === "outbox") {
        if (record.phase === "accepted") { const id = await projection.reconcileReceipt(record); current(); if (existing) accepted(existing[0], id); existing = viewEntry(record.owner.viewKey); }
        else projection.restoreReceipt(record);
      }
      if (route.startsWith("conversation:")) { await projection.refresh(); current(); if (projection.getSnapshot().snapshot?.conversation.id !== route.slice(13)) throw Error("The center did not confirm this conversation."); }
      const projectId = projection.getSnapshot().snapshot?.conversation.projectId ?? projection.outbox.getSnapshot()?.creation?.projectId;
      if ((projectId ?? null) !== (record.owner.projectId ?? null) && (route.startsWith("conversation:") || record.kind === "command")) throw Error("The original conversation project does not match this saved record.");
      current(); select(existing?.[0] ?? route);
      session.steering.configure(view.key, existing?.[0] ?? route, projection, true);
      const knowledge = session.knowledgeBinding(view.key, projection); knowledge.configure(existing?.[0] ?? route, true);
      if (record.kind === "command" && record.domain === "queue") {
        const commands = projection.queue.commands; if (!commands) throw Error("Queue commands are unavailable in this center.");
        commands.restore(record);
      } else if (record.kind === "command" && record.domain === "steering") session.steering.restoreReceipt(view.key, record);
    },
    retry: async record => {
      if (!authorizedRef.current || !session) throw Error("Reconnect before retrying the original request.");
      const entry = viewEntry(record.owner.viewKey); if (!entry?.[1].conversation) throw Error("Restore this original view first.");
      if (record.domain === "outbox") { const id = await entry[1].conversation.retry(); if (id) accepted(entry[0], id); }
      else if (record.domain === "queue") await entry[1].conversation.queue.commands?.retry(record.id);
      else session.steering.retryReceipt(entry[1].key, record.id);
    },
  } : undefined;
  const actions: AppActions = {
    layout: layoutPort,
    ...(recoveryHost ? { recovery: recoveryHost } : {}),
    ...(centerRuntime ? { centerRuntime } : {}),
    messageSettings: {
      read: key => {
        const entry = viewEntry(key), view = entry?.[1], snapshot = view?.conversation?.getSnapshot();
        if (!entry || !view?.conversation) return null;
        return { draft: view.settings, generation: recovery?.session.getSnapshot().generation ?? 0,
          context: { profile: snapshot?.snapshot?.conversation.executionProfile ?? null, capability: snapshot?.snapshot?.capabilities.messageSettings ?? null },
          editable: authorizedRef.current && (!recovery || recovery.session.authorized(recovery.namespace))
            && !overview && document.visibilityState === "visible" && visibleGroups.current.some(group => group.activeId === entry[0])
            && snapshot?.connection === "live" };
      },
      replace: (key, expected, value) => {
        const entry = viewEntry(key);
        if (!entry || entry[1].settings.ownership !== expected || !authorizedRef.current || (recovery && !recovery.session.authorized(recovery.namespace)))
          throw Error("This message draft belongs to an expired owner.");
        const next = messageSettingsDraft(value); entry[1].settings = next;
        session?.recovery.changed(key); setGroups(previous => [...previous]);
        return next;
      },
      profiles: (options, signal) => client.claudeMessageSettingsProfiles(options, signal),
    },
    knowsTask: id => Boolean(taskView(id)) || conversationOwnsTask(id) || catalog.getSnapshot().tasks.some(task => task.id === id),
    task: id => taskView(id)?.[1].projection.getSnapshot().task ?? null,
    hasDraft: id => Boolean(views.get(id)?.conversation) || (id.startsWith("draft-") && views.has(id)),
    steering: {
      // Explicit trusted owner-connection policy. Server admission/POST still decides capability and attempt authority.
      allowed: identity => ownsSteering(identity),
      admission: (identity, options, signal) => { if (!ownsSteering(identity)) throw Error("Expired steering view."); return client.steeringAdmission(identity.taskId, options, signal); },
      state: (identity, options, signal) => { if (!ownsSteering(identity)) throw Error("Expired steering view."); return client.steering(identity.taskId, options, signal); },
      accept: (identity, input, key, signal) => { if (!ownsSteering(identity)) throw Error("Expired steering view."); return client.acceptSteering(identity.taskId, input, key, signal); },
    },
    attachments: {
      client,
      // Journal contains only bounded upload identities, never credentials or file bodies.
      storage: { read: () => localStorage.getItem("flow.attachment-recovery.v1"), write: value => localStorage.setItem("flow.attachment-recovery.v1", value) },
      allowed: (viewKey, projection, projectId, mode) => {
        const view = [...views.values()].find(item => item.key === viewKey);
        // Explicit private owner policy for both capabilities; the center still authorizes every HTTP request.
        return authorizedRef.current && (mode === "read" || mode === "upload") && view?.conversation === projection
          && projection.getSnapshot().snapshot?.conversation.projectId === projectId;
      },
    },
    knowledge: {
      current: identity => {
        const view = [...views.values()].find(view => view.key === identity.viewKey);
        const conversation = view?.conversation?.getSnapshot().snapshot?.conversation;
        return authorizedRef.current && !!view?.conversation && (conversation?.id ?? null) === identity.conversationId && (conversation?.projectId ?? null) === identity.projectId;
      },
      projects: (_identity, after, signal) => client.projects({ limit: 40, ...(after ? { after } : {}) }, signal),
      search: (identity, query, signal) => client.searchKnowledge(identity.projectId!, query, signal),
      resolve: (identity, citation, signal) => client.resolveKnowledge(identity.projectId!, citation, signal),
    },
    activity: {
      events: (identity, after) => { assertActivity(identity); return client.events(identity.taskId, after); },
      detail: (identity, id, signal) => { assertActivity(identity); return client.conversationDetail(identity.conversationId, identity.turnId, id, signal); },
      nativePage: (identity, after, signal) => { assertActivity(identity); return client.nativeActivities(identity.taskId, { ...(after ? { after } : {}), limit: 20 }, signal); },
      nativeBody: (identity, id, signal) => { assertActivity(identity); return client.nativeActivity(id, signal); },
    },
    stream: {
      metadata: (identity, options, signal) => { assertActivity(identity); return client.assistantStream(identity.taskId, options, signal); },
      patches: (identity, options, signal) => { assertActivity(identity); return client.assistantStreamPatches(identity.taskId, options, signal); },
    },
    ownsMessage: (taskId, id, role) => session?.ownsStreamMessage(taskId, id, role) || [...views.values()].some(view => view.conversation?.getSnapshot().turns.some(turn => turn.task.id === taskId && (role === "user" ? userMessageId(turn) === id : turn.assistant.state === "available" && turn.assistant.messageId === id))),
    openTask: select,
    openWorkspace: (id, tab) => {
      const owner = taskView(id) ?? [...views.entries()].find(([, view]) => view.conversation?.getSnapshot().turns.some(turn => turn.task.id === id));
      if (owner) { select(owner[0]); void inspect(owner[0], id, tab); }
      else { select(id); setPanel(tab, id); }
    },
    closeWorkspace: closePanel,
    loadReference: async (id, referenceId) => {
      const projection = taskView(id)?.[1].projection;
      if (!projection) throw Error("Open this task before loading its reference.");
      await projection.loadDetail(referenceId);
      const result = projection.getSnapshot().details[referenceId];
      if (result?.error) throw Error(result.error);
    },
    setTheme: onTheme,
    copy: text => navigator.clipboard.writeText(text),
  };
  const [session, setSession] = useState<AppPluginSession | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  useLayoutEffect(() => {
    const created = new AppPluginSession(actionsRef.current, theme);
    setSession(created);
    return () => { void created.dispose(); };
  }, [client]);
  useLayoutEffect(() => {
    session?.updateActions(actions);
    session?.publishNavigation({ activeTaskId: selectedTaskId, workspaceTab: panel, workspaceOpen: panelOpen },
      selectedTaskId ? { kind: "task", taskId: selectedTaskId } : selectedId ? { kind: "composer", viewId: selectedId, isDraft: true } : { kind: "global" });
    session?.publishTheme(theme);
  });
  useLayoutEffect(() => {
    views.forEach(view => {
      view.projection.setOnline(navigator.onLine && authorized);
      view.conversation?.setOnline(navigator.onLine && authorized);
      if (recovery && session && view.conversation) view.conversation.configureRecovery(session.recovery.commandPort(view.key));
    });
    session?.steering.configureRecovery();
  }, [session, authorized, connectionState?.generation]);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (session?.steering.risks() || session?.hasProtectedAttachments() || [...views.values()].some(view => session?.recovery.protection(view.key).length)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", preventLoss); return () => window.removeEventListener("beforeunload", preventLoss);
  }, [session]);
  useLayoutEffect(() => {
    onRecoveryGuard?.(session ? () => session.recovery.flush() : async () => { throw Error("The previous workspace is still opening."); });
    return () => onRecoveryGuard?.(null);
  }, [session, onRecoveryGuard]);
  const disconnectNow = async () => {
    try { if (recovery) await session?.recovery.flush(); onDisconnect(); }
    catch (error) { setRecoveryError(error instanceof Error ? error.message : "Local recovery has not finished. Keep this page open."); }
  };
  useLayoutEffect(() => {
    layoutPort.configure({
      authorityKey: () => !session || session.signal.aborted || !activeRuntimeWorkspace.current || !authorizedRef.current || document.visibilityState !== "visible" || (recovery && !recovery.session.authorized(recovery.namespace))
        ? null : `${session.id}:${recovery?.session.getSnapshot().generation ?? 0}`,
      layout: () => layout,
      panesVisible: () => !overview && document.visibilityState === "visible",
      viewKey: route => views.get(route)?.key,
      knowsConversation: id => conversations.getSnapshot().items.some(item => item.id === id)
        || [...views.values()].some(view => view.conversation?.getSnapshot().snapshot?.conversation.id === id),
      openConversation: id => select(`conversation:${id}`),
      closeView: (key, authorization) => { const entry = viewEntry(key); if (!entry) throw Error("The original view is closed."); close(entry[0], authorization); },
      changePane: (context, change) => {
        const tab = activeWorkspace(layout), pane = tab.panes.find(item => item.id === context.paneId);
        const route = pane?.tabs.find(id => views.get(id)?.key === context.viewKey);
        if (tab.id !== context.workspaceId || !pane || !route) throw Error("The original pane has changed.");
        if (change.kind === "split" && (pane.tabs.length < 2 || tab.panes.length >= MAX_VISIBLE_PANES)) throw Error("Split needs another chat and supports at most three visible panes.");
        session?.closeMessageSettings();
        setLayout(previous => updateWorkspace(previous, current => {
          if (current.id !== context.workspaceId || !current.panes.some(item => item.id === pane.id && item.tabs.includes(route))) return current;
          if (change.kind === "split") {
            const id = `pane-${crypto.randomUUID()}`;
            const panes = splitChat(current.panes.map(item => item.id === pane.id ? { ...item, activeId: route } : item), pane.id, id);
            return { ...current, panes, activePaneId: id };
          }
          if (change.kind === "merge") return { ...current, panes: mergeChats(current.panes, route), activePaneId: current.panes[0]!.id };
          return { ...current, panes: change.kind === "swap" ? reorderPane(current.panes, pane.id, change.direction) : resizePanes(current.panes, pane.id, change.share) };
        }));
      },
    });
  });
  const storageKey = recovery ? `flow.workspace-layout.v1:${namespaceKey(recovery.namespace)}` : null;
  const [loadedLayoutKey, setLoadedLayoutKey] = useState<string | null>(null);
  useEffect(() => {
    if (!session || !authorized || loadedLayoutKey === (storageKey ?? session.id)) return;
    let restored: WorkspaceLayout | null = null;
    try {
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      if (raw && raw.length <= 65536) {
        restored = readLayout(JSON.parse(raw));
        if (restored) {
          const routes = layoutGroups(restored).flatMap(pane => pane.tabs);
          const missing = routes.filter(route => !views.has(route) && (route.startsWith("draft-") || route.startsWith("conversation:"))
            && ![...views.values()].some(view => route === `conversation:${view.conversation?.getSnapshot().snapshot?.conversation.id}`));
          // Preflight all capacity before creating any view; hidden references never read bodies.
          if (residentCount() + missing.length > MAX_RESIDENT_CONVERSATIONS) throw Error("Saved layout exceeds the available local view capacity.");
          for (const route of routes) if (!ensureView(route)) throw Error("The saved layout could not open every view.");
        }
      }
    } catch { restored = null; setRecoveryError("The saved workspace layout could not be read. Chat recovery records are unchanged."); }
    routeInitialized.current = true;
    const params = new URLSearchParams(initialRoute.current.slice(1)), conversation = params.get("conversation"), task = params.get("task");
    const route = conversation ? `conversation:${conversation}` : task;
    let next = restored ?? currentLayout.current;
    if (route && (layoutGroups(next).some(pane => pane.tabs.includes(route)) || layoutGroups(next).reduce((sum, pane) => sum + pane.tabs.length, 0) < MAX_OPEN_VIEWS) && ensureView(route))
      next = selectLayoutView(next, activeWorkspace(next).activePaneId, route);
    setLayout(next);
    if (initialRoute.current === "#workspace") setOverview(true);
    else if (!route && !restored) routeActions.current.newChat();
    setLoadedLayoutKey(storageKey ?? session.id);
  }, [session, authorized, storageKey, loadedLayoutKey]);
  useEffect(() => {
    if (!authorized || !storageKey || loadedLayoutKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(layout)); }
    catch { setRecoveryError("The workspace layout could not be saved on this device."); }
  }, [layout, authorized, storageKey, loadedLayoutKey]);
  if (!session) return <p role="status">Opening workspace…</p>;
  return (
    <PluginProvider session={session}><SteeringSurfaces workspace={session.steering} />{recovery && <RecoverySurface workspace={session.recovery} />}{recoveryError && <p role="alert">{recoveryError}</p>}
    <Dialog open={!!leaving} onOpenChange={open => { if (!open) setLeaving(null); }}><DialogContent><DialogHeader><DialogTitle>{leaving?.kind === "workspace" ? "Close workspace tabs?" : session.hasProtectedAttachments() && !session.steering.risks() ? "Leave attachment drafts?" : "Leave unconfirmed steering receipts?"}</DialogTitle><DialogDescription>Closing or changing the displayed center does not cancel work or delete saved recovery records. A command may already be accepted. Keep this page open while a draft checkpoint is blocked; original file bytes are not saved. Restoring a saved receipt never sends it automatically.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setLeaving(null)}>Keep this page</Button><Button onClick={confirmLeave}>{leaving?.kind === "workspace" ? "Close workspace and retain saved records" : "Leave view and retain saved records"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={retainedOpen} onOpenChange={setRetainedOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); const destination = retainedDestination.current; requestAnimationFrame(() => { const target = destination ? document.getElementById(`tab-${destination}`) : retainedInvoker.current; if (target?.isConnected) target.focus(); }); }}><DialogHeader><DialogTitle>Retained chats</DialogTitle><DialogDescription>{residentCount()} / {MAX_RESIDENT_CONVERSATIONS} conversation views in this connection. Close an empty chat to free a place. Drafts and receipts are kept until you resolve them.</DialogDescription></DialogHeader>
      {capacityBlocked && <p role="alert">No place for another chat. Your current tabs, route and drafts were kept.</p>}
      <ul className="max-h-64 space-y-2 overflow-y-auto">{[...views].filter(([, view]) => view.conversation).map(([id, view]) => {
        const open = layoutGroups(layout).some(group => group.tabs.includes(id)), reasons = protectedReasons(id, view);
        return <li key={view.key}><Button variant="outline" onClick={() => { retainedDestination.current = id; select(id); setRetainedOpen(false); }}>{view.conversation?.getSnapshot().snapshot?.conversation.title ?? "New chat"}</Button><p className="text-xs">{open ? "Open" : "Closed, retained"}{reasons.length ? ` · ${reasons.join(", ")}` : " · No local material"}</p></li>;
      })}</ul><DialogFooter><Button onClick={() => setRetainedOpen(false)}>Close retained chats</Button></DialogFooter></DialogContent></Dialog>
    <div className="flow-shell">
      <nav
        data-extension-slot="activityBar.primary"
        className="flow-rail"
        aria-label="Workspace tools"
      >
        <span className="flow-mark">F</span>
        <IconButton label="Work overview" active={overview} onClick={() => {
          session?.closeMessageSettings(); setOverview(true);
          if (window.innerWidth <= 800) setSidebar(false);
          history.replaceState(null, "", "#workspace");
        }}><LayoutDashboard size={18} /></IconButton>
        <IconButton
          label="Chats"
          active={sidebar}
          onClick={() => { setOverview(false); setSidebar(!sidebar); }}
        >
          <MessageSquare size={18} />
        </IconButton>
        <IconButton
          label="Files"
          active={panelOpen && panel === "files"}
          onClick={() => {
            setOverview(false);
            panelOpen && panel === "files"
              ? setPanelOpen(false)
              : setPanel("files");
          }}
        >
          <Files size={18} />
        </IconButton>
        <IconButton
          label="Terminal"
          active={panelOpen && panel === "terminal"}
          onClick={() => {
            setOverview(false);
            panelOpen && panel === "terminal"
              ? setPanelOpen(false)
              : setPanel("terminal");
          }}
        >
          <Terminal size={18} />
        </IconButton>
        <div
          data-extension-slot="activityBar.bottom"
          className="flow-rail-bottom"
        >
          <IconButton
            label={theme.scheme === "dark" ? "Use light theme" : "Use dark theme"}
            onClick={() => onTheme(themes.find(item => item.id === (theme.scheme === "dark" ? "light" : "dark"))!)}
          >
            {theme.scheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          </IconButton>
          <PluginRail />
          <PluginSettings registry={registry} />
          <IconButton label="Change connection" onClick={() => { if (session.steering.risks() || session.hasProtectedAttachments()) setLeaving({ kind: "connection" }); else disconnectNow(); }}>
            <Settings2 size={18} />
          </IconButton>
        </div>
      </nav>
      {sidebar && (
        <aside className="flow-sidebar" aria-label="Chats">
          <div
            data-extension-slot="sidebar.header"
            className="flow-sidebar-heading"
          >
            <span>Personal</span>
            <AppSlot slot="sidebar.header" />
            <IconButton
              label="Hide chat list"
              onClick={() => setSidebar(false)}
            >
              <PanelLeftClose size={15} />
            </IconButton>
          </div>
          <button className="flow-new-chat" onClick={newChat}>
            <Plus size={15} />
            New chat
          </button>
          <input
            aria-label="Find chats"
            placeholder="Find a chat"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ConversationList catalog={conversations} selectedId={selectedId?.startsWith("conversation:") ? selectedId.slice(13) : undefined} query={query} onSelect={id => select(`conversation:${id}`)} renderActions={id => <AppSlot slot="sidebar.item.actions" context={{ kind: "conversation", conversationId: id }} />} />
          {overview && <details className="flow-legacy-tasks"><summary>Execution tasks</summary>
            {loadingList && <p role="status">Loading tasks…</p>}
            {list.error && <p role="alert">{list.error}</p>}
            <nav className="flow-chat-list">{list.tasks.filter(task => task.title.toLowerCase().includes(query.toLowerCase())).map(task => <ChatListItem key={task.id} task={task} view={views.get(task.id)} selected={selectedId === task.id} onSelect={() => select(task.id)} />)}</nav>
            {list.nextListCursor && <button className="flow-link" onClick={() => void refreshChats(true)}>More tasks</button>}
          </details>}
          <AppSlot slot="sidebar.footer" />
          {fixtureMode && (
            <p
              className="flow-fixture-label"
              data-extension-slot="sidebar.footer"
            >
              HTTP fixture · simulated
            </p>
          )}
        </aside>
      )}
      <main id="main" tabIndex={-1} className="flow-main">
        <header
          className="flow-workspace-bar"
          data-extension-slot="chat.header"
          hidden={overview}
        >
          <span>Flow</span>
          <AppSlot slot="chat.header" context={selectedTaskId ? { kind: "task", taskId: selectedTaskId } : selectedId ? { kind: "composer", viewId: selectedId, isDraft: true } : { kind: "global" }} />
          {fixtureMode && (
            <span className="flow-fixture-inline">Fixture preview</span>
          )}
          <div>
            <IconButton label="New chat" onClick={newChat}>
              <Plus size={16} />
            </IconButton>
            <button
              className="flow-view-action"
              disabled={
                !focused || focused.tabs.length < 2 || groups.length >= MAX_VISIBLE_PANES
              }
              onClick={() => {
                const id = `group-${crypto.randomUUID()}`;
                session.closeMessageSettings();
                setLayout(previous => updateWorkspace(previous, tab => {
                  const panes = splitChat(tab.panes, tab.activePaneId, id);
                  return panes === tab.panes ? tab : { ...tab, panes, activePaneId: id };
                }));
              }}
            >
              <Columns2 size={15} />
              Split chat
            </button>
            {groups.length > 1 && (
              <button
                className="flow-view-action"
                onClick={() => {
                  session.closeMessageSettings();
                  setLayout(previous => updateWorkspace(previous, tab => ({ ...tab, panes: mergeChats(tab.panes, selectedId!), activePaneId: tab.panes[0]!.id })));
                }}
              >
                Merge tabs
              </button>
            )}
            <IconButton
              label="Toggle workspace panel"
              active={panelOpen}
              onClick={() => { setPanelVisited(true); setPanelOpen(!panelOpen); }}
            >
              <PanelRight size={16} />
            </IconButton>
          </div>
        </header>
        <button className="flow-link self-start px-3 text-xs" type="button" onClick={() => showRetained(false)}>Retained chats</button>
        {authorized && <WorkspaceOverview client={client} active={overview} onTaskSummaries={syncWorkspaceSummaries} onOpenTask={select} onOpenReference={(taskId, referenceId) => {
          select(taskId);
          setPanel(`detail:${referenceId}`, taskId);
          void ensureView(taskId)?.projection.loadDetail(referenceId);
        }} />}
        {!overview && <><WorkspaceTabs layout={layout} onSelect={id => { session.closeMessageSettings(); setLayout(previous => previous.tabs.some(tab => tab.id === id) ? { ...previous, activeTabId: id } : previous); }}
          onAdd={() => { session.closeMessageSettings(); setLayout(previous => addWorkspace(previous, `workspace-${crypto.randomUUID()}`)); }} onClose={closeWorkspace} />
          {groups.length > 1 && <div className="flow-pane-ratios">{groups.slice(0, -1).map((pane, index) => <label key={pane.id}>
            <span>Pane {index + 1} / {index + 2}</span><input type="range" aria-label={`Resize panes ${index + 1} and ${index + 2}`} min={15} max={85}
              value={Math.round(100 * (pane.weight ?? 1) / ((pane.weight ?? 1) + (groups[index + 1]!.weight ?? 1)))}
              onChange={event => { const value = Number(event.target.value) / 100; setGroups(previous => resizePanes(previous, pane.id, value)); }} /></label>)}</div>}</>}
        <div className="flow-work-area" hidden={overview}>
          <div id="workspace-panes" role="tabpanel" aria-labelledby={`workspace-tab-${workspace.id}`}
            className="flow-chat-groups flow-arc-panes"
            style={{ gridTemplateColumns: groups.length ? groups.map(pane => `minmax(0, ${pane.weight ?? 1}fr)`).join(" ") : "minmax(0, 1fr)" }}>
            {!groups.length && <div className="flow-no-chat"><Button variant="outline" onClick={newChat}>New chat</Button></div>}
            {groups.map((pane, position) => <div key={`header-${pane.id}`}
              style={{ gridColumn: position + 1, gridRow: 1, "--pane-stack-row": position * 2 + 1 } as CSSProperties}>
              <PaneTabs pane={pane} position={position} total={groups.length} focused={focused?.id === pane.id}
                renderTitle={id => <ChatTitle view={views.get(id)!} />}
                renderClose={id => <CloseChatButton view={views.get(id)!} onClose={() => close(id)} />}
                renderActions={id => <AppSlot slot="chat.tab.actions" context={{ kind: "pane", workspaceId: workspace.id, paneId: pane.id, viewKey: views.get(id)!.key }} />}
                onSelect={id => { session.closeMessageSettings(); setLayout(previous => updateWorkspace(previous, tab => ({ ...tab, activePaneId: pane.id,
                  panes: tab.panes.map(item => item.id === pane.id ? { ...item, activeId: id } : item) }))); }}
                onClose={close} onMove={direction => { session.closeMessageSettings(); setGroups(previous => reorderPane(previous, pane.id, direction)); }} />
            </div>)}
            {/* A pane move changes placement only: every open composer keeps this parent and view.key. */}
            {layoutGroups(layout).flatMap(pane => pane.tabs.map(id => ({ pane, id }))).map(({ pane, id }) => {
              const view = views.get(id); if (!view) return null;
              const position = groups.findIndex(item => item.id === pane.id), shown = position >= 0 && pane.activeId === id;
              return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="flow-tab-body"
                data-composer-view={view.key} data-pane-id={pane.id} hidden={!shown} key={view.key}
                style={{ gridColumn: position + 1, gridRow: 2, "--pane-stack-row": position * 2 + 2 } as CSSProperties}
                onFocusCapture={() => setActiveGroup(pane.id)}>
                <ChatPane viewId={id} visible={authorized && !overview && pageVisible && shown} view={view} drafts={drafts}
                  profiles={profiles} profileSelection={profileSelections[view.key] ?? defaultProfileSelection}
                  onProfileSelection={selection => { session.closeMessageSettings(); view.settings = messageSettingsDraft(view.settings.value); const key = view.key;
                    profileRef.current = { ...profileRef.current, [key]: selection }; setProfileSelections(profileRef.current); session.recovery.changed(key); }}
                  onDraftChange={() => session.recovery.changed(view.key)}
                  onIntent={intent => { session.closeMessageSettings(); view.settings = messageSettingsDraft(view.settings.value); view.intent = intent;
                    setGroups(previous => [...previous]); session.recovery.changed(view.key); }}
                  onAccepted={taskId => accepted(id, taskId)} onActivate={() => setActiveGroup(pane.id)}
                  onInspect={taskId => { setActiveGroup(pane.id); void inspect(id, taskId); }} onOpenTask={select}
                  onOpenReference={referenceId => { setActiveGroup(pane.id); setPanel(`detail:${referenceId}`, id); void view.projection.loadDetail(referenceId); }} />
              </div>;
            })}
          </div>
          <div className="flow-panel-mount" hidden={!panelOpen} ref={panelContainer}>
            {selected && (panelOpen || panelVisited) ? (
              <Activity mode={panelOpen ? "visible" : "hidden"}><WorkspacePanelMount
                view={selected}
                activeTab={panel}
                onClose={closePanel}
                focusRequest={panelFocusRequest}
                container={panelContainer}
              /></Activity>
            ) : (
              <p>Select a task to inspect its files and output.</p>
            )}
          </div>
        </div>
      </main>
    </div></PluginProvider>
  );
}
function WorkspacePanelMount({
  view,
  activeTab,
  onClose,
  focusRequest,
  container,
}: {
  view: View;
  activeTab: WorkspaceTabId;
  onClose: () => void;
  focusRequest: PanelFocusRequest | null;
  container: RefObject<HTMLDivElement | null>;
}) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  return <PluginWorkspace state={state} activeTab={activeTab} focusRequest={focusRequest} container={container} onClose={onClose} />;
}
function Connection({ onConnect, address = "", phase, error, onRead, onLogout, onDiscardRetained }: {
  onConnect: (url: string, token: string) => void; address?: string; phase?: string; error?: string; onRead?: () => void; onLogout?: () => void; onDiscardRetained?: () => void;
}) {
  const [url, setUrl] = useState(address);
  const [token, setToken] = useState("");
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flow-connect"
      data-extension-slot="settings.sections"
    >
      <h1>Connect to Flow</h1>
      <p>Your owner token is used only for this explicit connection. A supported center can retain an HttpOnly browser session; saved drafts appear only after that center confirms your identity.</p>
      {phase && <p role="status">{phase === "unauthenticated" ? "Reconnect to this center." : phase === "unsupported" ? "This center has not enabled browser sessions. Ask its operator to configure them." : phase === "offline" ? "Offline. Drafts and pending commands have not been cancelled." : phase === "forbidden" ? "This center denied this browser connection." : phase === "checking" ? "Checking the center session…" : phase === "ready" ? "This browser session is ready." : "Read or connect this center session."}</p>}
      {error && <p role="alert">{error}</p>}
      {onRead && <Button variant="outline" onClick={onRead}>Check existing browser session</Button>}
      {onLogout && <Button variant="outline" onClick={onLogout}>Sign out of this center</Button>}
      {onDiscardRetained && <Button variant="outline" onClick={onDiscardRetained}>Discard previous page-only work</Button>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const supplied = token; setToken(""); onConnect(url, supplied);
        }}
      >
        <label>
          Center URL
          <input
            type="url"
            value={url}
            placeholder="Same-origin proxy"
            aria-describedby="center-url-help"
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <small id="center-url-help">Leave blank for this Web app’s configured /api proxy, or enter the center URL supplied by your administrator.</small>
        <label>
          Owner token
          <input
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <details className="text-sm">
          <summary>Where do I get the owner token?</summary>
          <p>For your local personal preview, run <code>node tools/personal-preview/cli.mjs status --directory "&lt;your-private-preview-directory&gt;"</code>. It reports a credentialsFile path without printing the token. Read that private file’s ownerToken yourself and enter it here. This is a Flow token, not a Claude or Pi login token.</p>
          <p><a href="https://github.com/CM-BF/Flow/blob/6426b44cd32d10216141af13ecfa83b8879025fb/tools/personal-preview/README.md" target="_blank" rel="noreferrer">Personal preview setup</a> · <a href="https://github.com/CM-BF/Flow/blob/6426b44cd32d10216141af13ecfa83b8879025fb/apps/web/README.md" target="_blank" rel="noreferrer">Web connection setup</a></p>
        </details>
        <Button>Connect workspace</Button>
      </form>
    </main>
  );
}
const CENTER_CHOICE = "flow.browser-center.v1";
function savedCenter(): string {
  try { return recoveryAddress(localStorage.getItem(CENTER_CHOICE) ?? "", location.href); }
  catch { return recoveryAddress("", location.href); }
}
function BrowserWorkspace({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const [connection, setConnection] = useState(() => new ConnectionSession(savedCenter()));
  const state = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
  const [journal] = useState(() => new ConversationRecoveryJournal());
  const [retained, setRetained] = useState<{ namespace: RecoveryNamespace; session: ConnectionSession; client: FlowClient } | null>(null);
  const retainedGuard = useRef<(() => Promise<void>) | null>(null), connections = useRef(new Set([connection]));
  const registerGuard = useCallback((guard: (() => Promise<void>) | null) => { retainedGuard.current = guard; }, []);
  const [retentionBlocked, setRetentionBlocked] = useState(false);
  const [selecting, setSelecting] = useState(false), [error, setError] = useState<string>();
  const channel = useRef<BroadcastChannel | null>(null);
  const selectionRevision = useRef(0);
  const connectIntent = useRef<{ session: ConnectionSession; token: string; revision: number } | null>(null);
  const client = useMemo(() => new FlowClient({ baseUrl: connection.getSnapshot().address, browserSession: { csrfToken: connection.csrfToken }, assistantStreamProtocol: "patch-v1" }), [connection]);
  useEffect(() => {
    const online = () => connection.setOnline(navigator.onLine);
    const wake = () => { if (document.visibilityState === "visible") void connection.read(); };
    let current = true;
    online();
    const explicit = connectIntent.current;
    if (explicit?.session === connection) {
      connectIntent.current = null;
      void connection.connect(explicit.token).then(() => {
        if (current && explicit.revision === selectionRevision.current && connection.getSnapshot().phase === "ready") setSelecting(false);
      }).finally(() => channel.current?.postMessage(connection.getSnapshot().address)).catch(failure => { if (current && explicit.revision === selectionRevision.current) setError(String(failure)); });
    }
    else void connection.read();
    window.addEventListener("online", online); window.addEventListener("offline", online); window.addEventListener("pageshow", wake); window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    if (typeof BroadcastChannel !== "undefined") { const bus = new BroadcastChannel("flow.browser-session-observation.v1"); channel.current = bus; bus.onmessage = event => { if (event.data === connection.getSnapshot().address) void connection.read(); }; }
    return () => { current = false; window.removeEventListener("online", online); window.removeEventListener("offline", online); window.removeEventListener("pageshow", wake); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); channel.current?.close(); channel.current = null; connection.setOnline(false); };
  }, [connection]);
  useEffect(() => {
    if (state.phase !== "ready" || !state.identity) return;
    let current = true;
    const identity = state.identity;
    void (async () => {
      if (retained && namespaceKey(retained.namespace) !== namespaceKey(identity)) {
        if (!retainedGuard.current) throw Error("The previous workspace is still opening.");
        await retainedGuard.current();
      }
      if (!current || !connection.authorized(identity)) return;
      setRetained(previous => previous && namespaceKey(previous.namespace) === namespaceKey(identity) ? previous : { namespace: identity, session: connection, client });
      setRetentionBlocked(false);
    })().catch(() => { if (current) { setRetentionBlocked(true); setError("Previous page-only work is retained but hidden. Reconnect its original center to resolve saving, or explicitly discard that unsaved work. Saved journal records are not removed."); } });
    return () => { current = false; };
  }, [state.phase, state.identity, connection, client, retained]);
  useEffect(() => { for (const old of connections.current) if (old !== connection && old !== retained?.session) { old.dispose(); connections.current.delete(old); } }, [connection, retained]);
  useEffect(() => () => { for (const value of connections.current) value.dispose(); void journal.close(); }, [journal]);
  const ready = !!retained && state.phase === "ready" && !!state.identity && retained.session === connection && namespaceKey(state.identity) === namespaceKey(retained.namespace) && !selecting;
  const connect = async (address: string, token: string) => {
    const revision = ++selectionRevision.current;
    setError(undefined);
    try {
      const canonical = recoveryAddress(address, location.href);
      localStorage.setItem(CENTER_CHOICE, canonical); // URL only, never token, principal, CSRF or body.
      let target = connection;
      if (canonical !== state.address) { target = retained?.session.getSnapshot().address === canonical ? retained.session : new ConnectionSession(canonical); connections.current.add(target); connectIntent.current = { session: target, token, revision }; setConnection(target); return; }
      await target.connect(token); channel.current?.postMessage(canonical);
      if (revision === selectionRevision.current && target.getSnapshot().phase === "ready") setSelecting(false);
    } catch (failure) { if (revision === selectionRevision.current) setError(failure instanceof Error ? failure.message : "The connection could not be opened."); }
  };
  const readSelected = async () => {
    const revision = ++selectionRevision.current;
    await connection.read();
    if (revision === selectionRevision.current && connection.getSnapshot().phase === "ready") setSelecting(false);
  };
  return <>
    {!ready && <Connection key={state.address} address={state.address} phase={state.phase} error={error ?? state.error} onConnect={(address, token) => { void connect(address, token); }} onRead={() => { void readSelected(); }}
      {...(state.phase === "ready" ? { onLogout: () => { void connection.logout().finally(() => channel.current?.postMessage(state.address)).catch(failure => setError(String(failure))); } } : {})}
      {...(retentionBlocked ? { onDiscardRetained: () => { if (window.confirm("Discard the previous workspace's unsaved page-only drafts and local state? Its saved journal records stay intact. This does not cancel any center task.")) { setRetained(null); setRetentionBlocked(false); setError(undefined); } } } : {})} />}
    {retained && <div hidden={!ready}><Workspace key={namespaceKey(retained.namespace)} client={retained.client} recovery={{ session: retained.session, namespace: retained.namespace, journal }} active={ready} onRecoveryGuard={registerGuard} onDisconnect={() => { selectionRevision.current++; setSelecting(true); }} theme={theme} onTheme={onTheme} /></div>}
  </>;
}
function FixtureWorkspace({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const [client, setClient] = useState<FlowClient | null>(() => new FlowClient({ baseUrl: "", token: "flow-fixture-only", assistantStreamProtocol: "patch-v1" }));
  return client ? <Workspace client={client} onDisconnect={() => setClient(null)} theme={theme} onTheme={onTheme} /> : <Connection onConnect={(baseUrl, token) => setClient(new FlowClient({ baseUrl, token, assistantStreamProtocol: "patch-v1" }))} />;
}
export default function App() {
  const [theme, setTheme] = useState(() => themes.find(item => item.id === initialTheme())!);
  useEffect(() => applyTheme(theme), [theme]);
  return <TooltipProvider><a className="flow-skip" href="#main" onClick={event => { event.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to main content</a>
    {fixtureMode && !new URLSearchParams(location.search).has("recovery") ? <FixtureWorkspace theme={theme} onTheme={setTheme} /> : <BrowserWorkspace theme={theme} onTheme={setTheme} />}
  </TooltipProvider>;
}
