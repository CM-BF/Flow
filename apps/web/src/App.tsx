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
  type KeyboardEvent,
  type RefObject,
} from "react";
import { FlowClient } from "@flow/client";
import type { PluginRegistryReader } from "./plugin-management/PluginManagement";
import {
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
  closeChat,
  mergeChats,
  openChat,
  splitChat,
  type ChatGroup,
} from "./workspace-state";

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
function navigateChatTabs(
  event: KeyboardEvent<HTMLButtonElement>,
  group: ChatGroup,
  id: string,
  activate: (id: string) => void,
  close: (id: string) => void,
) {
  const index = group.tabs.indexOf(id);
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % group.tabs.length;
  else if (event.key === "ArrowLeft")
    next = (index - 1 + group.tabs.length) % group.tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = group.tabs.length - 1;
  else if (event.key === "Delete") {
    event.preventDefault();
    close(id);
    return;
  } else return;
  event.preventDefault();
  const target = group.tabs[next]!;
  activate(target);
  document.getElementById(`tab-${target}`)?.focus();
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
  if (view.conversation) return <section className="flow-chat-pane" onFocusCapture={onActivate} onPointerDown={onActivate} aria-label={view.conversation.getSnapshot().snapshot?.conversation.title ?? "New conversation"}><div className="flow-thread"><ConversationThread viewId={viewId} visible={visible} projection={view.conversation} drafts={drafts} profiles={profiles} profileSelection={profileSelection} onProfileSelection={onProfileSelection} onAccepted={onAccepted} onInspect={onInspect} onOpenTask={onOpenTask} onCurrentTask={id => { if (view.projection.getSnapshot().task?.id !== id) void view.projection.select(id); }} /></div></section>;
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
function Workspace({
  client,
  onDisconnect,
  theme,
  onTheme,
}: {
  client: FlowClient;
  onDisconnect: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
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
  const [defaultProfileSelection] = useState(legacyDefaultSelection);
  const list = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [views] = useState(() => new Map<string, View>());
  const [drafts] = useState(() => new Map<string, DraftState>());
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState("main");
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
  const ensureView = (id: string): View => {
    let view = views.get(id);
    if (!view && id.startsWith("conversation:")) {
      const cached = [...views.entries()].find(([, item]) => item.conversation?.getSnapshot().snapshot?.conversation.id === id.slice(13));
      if (cached) {
        const [oldId, existing] = cached; view = existing; views.delete(oldId); views.set(id, existing);
        const draft = drafts.get(oldId); if (draft) { drafts.set(id, draft); drafts.delete(oldId); }
        setGroups(previous => previous.map(group => ({ ...group, tabs: group.tabs.map(tab => tab === oldId ? id : tab), activeId: group.activeId === oldId ? id : group.activeId })));
      }
    }
    if (!view) {
      view = {
        key: crypto.randomUUID(),
        projection: new TaskProjection(client),
        ...((id.startsWith("draft-") || id.startsWith("conversation:")) ? { conversation: new ConversationProjection(client, id.startsWith("conversation:") ? id.slice(13) : null) } : {}),
        title: id.startsWith("draft-")
          ? "New chat"
          : (list.tasks.find((task) => task.id === id)?.title ?? "Task"),
      };
      views.set(id, view);
      view.projection.setVisible(false);
      view.projection.setOnline(navigator.onLine);
      view.conversation?.setOnline(navigator.onLine);
      if (!id.startsWith("draft-") && !view.conversation) void view.projection.select(id);
    }
    return view;
  };
  const newChat = () => {
    setOverview(false);
    const id = `draft-${crypto.randomUUID()}`;
    ensureView(id);
    if (!profiles.getSnapshot().loaded && !profiles.getSnapshot().loading) void profiles.refresh();
    if (window.innerWidth <= 800) setSidebar(false);
    setGroups((previous) =>
      previous.length
        ? openChat(previous, activeGroup, id)
        : [{ id: "main", tabs: [id], activeId: id }],
    );
  };
  const select = (id: string) => {
    setOverview(false);
    ensureView(id);
    if (window.innerWidth <= 800) setSidebar(false);
    setGroups((previous) => {
      const group = previous.find((item) => item.tabs.includes(id));
      if (group) setActiveGroup(group.id);
      return previous.length
        ? openChat(previous, activeGroup, id)
        : [{ id: "main", tabs: [id], activeId: id }];
    });
    history.replaceState(null, "", id.startsWith("conversation:") ? `#conversation=${encodeURIComponent(id.slice(13))}` : `#task=${encodeURIComponent(id)}`);
  };
  useEffect(() => {
    void refreshChats();
    void conversations.refresh();
    const followRoute = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      const conversation = params.get("conversation");
      const id = params.get("task");
      if (conversation) select(`conversation:${conversation}`);
      else if (id) select(id);
      else if (location.hash === "#workspace") setOverview(true);
      else newChat();
    };
    followRoute();
    const online = () =>
      views.forEach((view) => { view.projection.setOnline(true); view.conversation?.setOnline(true); });
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
    const visible = new Set(overview || !pageVisible ? [] : groups.map(group => group.activeId));
    views.forEach((view, id) => { view.projection.setVisible(visible.has(id)); view.conversation?.setVisible(visible.has(id)); });
  }, [groups, overview, pageVisible, views]);
  const syncWorkspaceSummaries = useCallback((tasks: TaskSummary[]) => {
    tasks.forEach(task => { catalog.syncSummary(task); views.get(task.id)?.projection.syncSummary(task); });
  }, [catalog, views]);
  useEffect(() => {
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
  const close = (id: string) => {
    const next = closeChat(groups, id);
    setGroups(next);
    const targetGroup =
      next.find((group) => group.id === activeGroup) ?? next[0];
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
    const closing = views.get(id);
    if (closing?.conversation) { closing.conversation.setVisible(false); closing.projection.setVisible(false); }
    else { closing?.projection.disconnect(); views.delete(id); drafts.delete(id); }
    void refreshChats();
  };
  const accepted = (oldId: string, id: string) => {
    void refreshChats();
    const view = views.get(oldId);
    if (!view) return;
    if (view.conversation) {
      const nextId = `conversation:${id}`;
      if (oldId === nextId) { void conversations.refresh(); return; }
      views.delete(oldId); views.set(nextId, view);
      const draft = drafts.get(oldId); if (draft) { drafts.set(nextId, draft); drafts.delete(oldId); }
      setGroups(previous => previous.map(group => ({ ...group, tabs: group.tabs.map(tab => tab === oldId ? nextId : tab), activeId: group.activeId === oldId ? nextId : group.activeId })));
      void conversations.refresh(); return;
    }
    views.delete(oldId);
    view.title = view.projection.getSnapshot().task?.title ?? "Task";
    views.set(id, view);
    setGroups((previous) =>
      previous.map((group) => ({
        ...group,
        tabs: group.tabs.map((tab) => (tab === oldId ? id : tab)),
        activeId: group.activeId === oldId ? id : group.activeId,
      })),
    );
  };
  const taskView = (taskId: string) => [...views.entries()].find(([, view]) => view.projection.getSnapshot().task?.id === taskId);
  const conversationOwnsTask = (taskId: string) => [...views.values()].some(view => view.conversation?.getSnapshot().turns.some(turn => turn.task.id === taskId));
  const inspect = async (viewId: string, taskId: string, tab: WorkspaceTabId = "terminal") => {
    const view = views.get(viewId); if (!view) return;
    if (view.projection.getSnapshot().task?.id !== taskId) await view.projection.select(taskId);
    setPanel(tab, viewId);
  };
  const assertActivity = (identity: import("./plugin-integration/activity").ActivityIdentity) => {
    const view = views.get(identity.viewId), state = view?.conversation?.getSnapshot();
    const turn = state?.turns.find(turn => turn.id === identity.turnId);
    if (state?.snapshot?.conversation.id !== identity.conversationId || turn?.task.id !== identity.taskId || userMessageId(turn) !== identity.messageId)
      throw Error("This activity does not belong to the bound conversation view.");
  };
  const actions: AppActions = {
    knowsTask: id => Boolean(taskView(id)) || conversationOwnsTask(id) || catalog.getSnapshot().tasks.some(task => task.id === id),
    task: id => taskView(id)?.[1].projection.getSnapshot().task ?? null,
    hasDraft: id => Boolean(views.get(id)?.conversation) || (id.startsWith("draft-") && views.has(id)),
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
  if (!session) return <p role="status">Opening workspace…</p>;
  return (
    <PluginProvider session={session}><div className="flow-shell">
      <nav
        data-extension-slot="activityBar.primary"
        className="flow-rail"
        aria-label="Workspace tools"
      >
        <span className="flow-mark">F</span>
        <IconButton label="Work overview" active={overview} onClick={() => {
          setOverview(true);
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
          <IconButton label="Change connection" onClick={() => { void session.dispose(); onDisconnect(); }}>
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
          <ConversationList catalog={conversations} selectedId={selectedId?.startsWith("conversation:") ? selectedId.slice(13) : undefined} query={query} onSelect={id => select(`conversation:${id}`)} />
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
                !focused || focused.tabs.length < 2 || groups.length > 1
              }
              onClick={() => {
                const id = `group-${crypto.randomUUID()}`;
                setGroups((previous) => splitChat(previous, activeGroup, id));
                setActiveGroup(id);
              }}
            >
              <Columns2 size={15} />
              Split chat
            </button>
            {groups.length > 1 && (
              <button
                className="flow-view-action"
                onClick={() => {
                  setGroups((previous) => mergeChats(previous, selectedId!));
                  setActiveGroup(groups[0]!.id);
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
        <WorkspaceOverview client={client} active={overview} onTaskSummaries={syncWorkspaceSummaries} onOpenTask={select} onOpenReference={(taskId, referenceId) => {
          select(taskId);
          setPanel(`detail:${referenceId}`, taskId);
          void ensureView(taskId).projection.loadDetail(referenceId);
        }} />
        <div className="flow-work-area" hidden={overview}>
          <div
            className={`flow-chat-groups ${groups.length > 1 ? "split" : ""}`}
          >
            {groups.length === 0 ? (
              <div className="flow-no-chat">
                <Button variant="outline" onClick={newChat}>
                  New chat
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  className={`flow-chat-group ${focused?.id === group.id ? "focused" : ""}`}
                  key={group.id}
                  onFocusCapture={() => setActiveGroup(group.id)}
                >
                  <div
                    className="flow-tabs"
                    role="tablist"
                    aria-label={`Chat group ${group.id}`}
                  >
                    {group.tabs.map((id) => (
                      <div
                        key={views.get(id)!.key}
                        className={`flow-tab ${group.activeId === id ? "selected" : ""}`}
                      >
                        <button
                          role="tab"
                          id={`tab-${id}`}
                          aria-controls={`panel-${id}`}
                          tabIndex={group.activeId === id ? 0 : -1}
                          onKeyDown={(event) =>
                            navigateChatTabs(
                              event,
                              group,
                              id,
                              (next) => {
                                setActiveGroup(group.id);
                                setGroups((previous) =>
                                  previous.map((item) =>
                                    item.id === group.id
                                      ? { ...item, activeId: next }
                                      : item,
                                  ),
                                );
                              },
                              close,
                            )
                          }
                          aria-selected={group.activeId === id}
                          onClick={() => {
                            setActiveGroup(group.id);
                            setGroups((previous) =>
                              previous.map((item) =>
                                item.id === group.id
                                  ? { ...item, activeId: id }
                                  : item,
                              ),
                            );
                          }}
                        >
                          <ChatTitle view={views.get(id)!} />
                        </button>
                        <CloseChatButton
                          view={views.get(id)!}
                          onClose={() => close(id)}
                        />
                      </div>
                    ))}
                  </div>
                  {group.tabs.map((id) => (
                    <div
                      role="tabpanel"
                      id={`panel-${id}`}
                      aria-labelledby={`tab-${id}`}
                      className="flow-tab-body"
                      hidden={group.activeId !== id}
                      key={views.get(id)!.key}
                    >
                      <ChatPane
                        viewId={id}
                        visible={!overview && pageVisible && group.activeId === id}
                        view={views.get(id)!}
                        drafts={drafts}
                        profiles={profiles}
                        profileSelection={profileSelections[views.get(id)!.key] ?? defaultProfileSelection}
                        onProfileSelection={selection => setProfileSelections(previous => ({ ...previous, [views.get(id)!.key]: selection }))}
                        onAccepted={(taskId) => accepted(id, taskId)}
                        onActivate={() => setActiveGroup(group.id)}
                        onInspect={taskId => { setActiveGroup(group.id); void inspect(id, taskId); }}
                        onOpenTask={select}
                        onOpenReference={(referenceId) => {
                          setActiveGroup(group.id);
                          setPanel(`detail:${referenceId}`, id);
                          void views
                            .get(id)!
                            .projection.loadDetail(referenceId);
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
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
function Connection({
  onConnect,
}: {
  onConnect: (url: string, token: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flow-connect"
      data-extension-slot="settings.sections"
    >
      <h1>Connect to Flow</h1>
      <p>The owner token stays in this page’s memory. Reloading requires reconnection.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConnect(url, token);
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
export default function App() {
  const [theme, setTheme] = useState(() => themes.find(item => item.id === initialTheme())!);
  const [connectionScope, setConnectionScope] = useState(() => crypto.randomUUID());
  const [client, setClient] = useState<FlowClient | null>(() =>
    fixtureMode
      ? new FlowClient({ baseUrl: "", token: "flow-fixture-only", assistantStreamProtocol: "patch-v1" })
      : null,
  );
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <TooltipProvider>
      <a
        className="flow-skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to main content
      </a>
      {client ? (
        <Workspace
          key={connectionScope}
          client={client}
          onDisconnect={() => setClient(null)}
          theme={theme}
          onTheme={setTheme}
        />
      ) : (
        <Connection
          onConnect={(baseUrl, token) => {
            setConnectionScope(crypto.randomUUID());
            setClient(new FlowClient({ baseUrl, token, assistantStreamProtocol: "patch-v1" }));
          }}
        />
      )}
    </TooltipProvider>
  );
}
