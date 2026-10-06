import {
  useEffect,
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
  RefreshCw,
  Settings2,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import {
  WorkspacePanels,
  type WorkspaceTabId,
} from "./components/workspace/WorkspacePanels";
import { TaskProjection } from "./projection";
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
import { applyTheme, initialTheme } from "./themes";
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
      aria-label={`Close ${state.task?.title ?? view.title}`}
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
  return state.task?.title ?? view.title;
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
  );
}
interface View {
  projection: TaskProjection;
  title: string;
}
interface PanelFocusRequest { serial: number; taskId: string; tab: WorkspaceTabId }
function ChatPane({
  viewId,
  view,
  drafts,
  onAccepted,
  onOpenReference,
  onActivate,
}: {
  viewId: string;
  view: View;
  drafts: Map<string, DraftState>;
  onAccepted: (id: string) => void;
  onOpenReference: (id: string) => void;
  onActivate: () => void;
}) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  const [confirm, setConfirm] = useState(false);
  const task = state.task;
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
          data-extension-slot="chat.message.actions"
        >
          <Status status={task.status} />
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
  theme: string;
  onTheme: () => void;
}) {
  const [catalog] = useState(() => new TaskProjection(client));
  const list = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [views] = useState(() => new Map<string, View>());
  const [drafts] = useState(() => new Map<string, DraftState>());
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState("main");
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 800);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const panelContainer = useRef<HTMLDivElement>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<PanelFocusRequest | null>(null);
  const [panelTabs, setPanelTabs] = useState<Record<string, WorkspaceTabId>>(
    {},
  );
  const [loadingList, setLoadingList] = useState(false);
  const [overview, setOverview] = useState(() => !new URLSearchParams(location.hash.slice(1)).has("task"));
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
    if (!view) {
      view = {
        projection: new TaskProjection(client),
        title: id.startsWith("draft-")
          ? "New chat"
          : (list.tasks.find((task) => task.id === id)?.title ?? "Task"),
      };
      views.set(id, view);
      view.projection.setVisible(false);
      view.projection.setOnline(navigator.onLine);
      if (!id.startsWith("draft-")) void view.projection.select(id);
    }
    return view;
  };
  const newChat = () => {
    setOverview(false);
    const id = `draft-${crypto.randomUUID()}`;
    ensureView(id);
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
    history.replaceState(null, "", `#task=${encodeURIComponent(id)}`);
  };
  useEffect(() => {
    void refreshChats();
    const followRoute = () => {
      const id = new URLSearchParams(location.hash.slice(1)).get("task");
      if (id) select(id);
      else setOverview(true);
    };
    followRoute();
    const online = () =>
      views.forEach((view) => view.projection.setOnline(true));
    const offline = () =>
      views.forEach((view) => view.projection.setOnline(false));
    window.addEventListener("hashchange", followRoute);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("hashchange", followRoute);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      views.forEach((view) => view.projection.disconnect());
      catalog.disconnect();
    };
  }, [client]);
  const focused = groups.find((group) => group.id === activeGroup) ?? groups[0];
  const selectedId = focused?.activeId;
  const selected = selectedId ? views.get(selectedId) : null;
  useEffect(() => {
    const visible = new Set(overview || !pageVisible ? [] : groups.map(group => group.activeId));
    views.forEach((view, id) => view.projection.setVisible(visible.has(id)));
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
          : `#task=${encodeURIComponent(selectedId)}`,
      );
  }, [selectedId, overview]);
  const panel = panelTabs[selectedId ?? ""] ?? "files";
  const setPanel = (tab: WorkspaceTabId, id = selectedId) => {
    if (id) setPanelTabs((previous) => ({ ...previous, [id]: tab }));
    if (id && tab.startsWith("detail:")) setPanelFocusRequest(previous => ({ serial: (previous?.serial ?? 0) + 1, taskId: id, tab }));
    setPanelOpen(true);
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
    views.get(id)?.projection.disconnect();
    views.delete(id);
    drafts.delete(id);
    void refreshChats();
  };
  const accepted = (oldId: string, id: string) => {
    void refreshChats();
    const view = views.get(oldId);
    if (!view) return;
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
  return (
    <div className="flow-shell">
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
            label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            onClick={onTheme}
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          </IconButton>
          <IconButton label="Change connection" onClick={onDisconnect}>
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
          <div className="flow-section-label">
            <span>Chats</span>
            <IconButton
              label="Refresh task list"
              onClick={() => void catalog.list()}
            >
              <RefreshCw size={13} />
            </IconButton>
          </div>
          {loadingList && (
            <p className="flow-list-notice" role="status">
              Loading chats…
            </p>
          )}
          {list.error && (
            <div className="flow-list-notice" role="alert">
              {list.error}
              <button className="flow-link" onClick={() => void refreshChats()}>
                Retry chat list
              </button>
            </div>
          )}
          <nav
            className="flow-chat-list"
            data-extension-slot="sidebar.item.actions"
          >
            {list.tasks
              .filter((task) =>
                task.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((task) => (
                <ChatListItem
                  key={task.id}
                  task={task}
                  view={views.get(task.id)}
                  selected={selectedId === task.id}
                  onSelect={() => select(task.id)}
                />
              ))}
          </nav>
          {list.nextListCursor && (
            <button
              className="flow-link"
              onClick={() => void refreshChats(true)}
            >
              Load more chats
            </button>
          )}
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
              onClick={() => setPanelOpen(!panelOpen)}
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
                        key={id}
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
                      key={id}
                    >
                      <ChatPane
                        viewId={id}
                        view={views.get(id)!}
                        drafts={drafts}
                        onAccepted={(taskId) => accepted(id, taskId)}
                        onActivate={() => setActiveGroup(group.id)}
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
            {selected ? (
              <WorkspacePanelMount
                view={selected}
                activeTab={panel}
                onActiveTabChange={(tab) => setPanel(tab)}
                onClose={() => setPanelOpen(false)}
                focusRequest={panelFocusRequest}
                container={panelContainer}
              />
            ) : (
              <p>Select a task to inspect its files and output.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
function WorkspacePanelMount({
  view,
  activeTab,
  onActiveTabChange,
  onClose,
  focusRequest,
  container,
}: {
  view: View;
  activeTab: WorkspaceTabId;
  onActiveTabChange: (id: WorkspaceTabId) => void;
  onClose: () => void;
  focusRequest: PanelFocusRequest | null;
  container: RefObject<HTMLDivElement | null>;
}) {
  const state = useSyncExternalStore(
    view.projection.subscribe,
    view.projection.getSnapshot,
  );
  const focusedRequest = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!focusRequest || focusRequest.serial === focusedRequest.current || focusRequest.taskId !== state.task?.id || activeTab !== focusRequest.tab) return;
    const tab = container.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
    if (!tab?.getAttribute("aria-controls")?.endsWith(encodeURIComponent(activeTab))) return;
    tab.focus();
    focusedRequest.current = focusRequest.serial;
  }, [focusRequest, state.task, activeTab, container]);
  return (
    <WorkspacePanels
      task={state.task}
      details={state.details}
      connection={state.connection}
      onLoadDetail={(id) => view.projection.loadDetail(id)}
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
      onClose={onClose}
    />
  );
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
      <p>The owner token stays in this page’s memory.</p>
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
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
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
        <Button>Connect workspace</Button>
      </form>
    </main>
  );
}
export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [client, setClient] = useState<FlowClient | null>(() =>
    fixtureMode
      ? new FlowClient({ baseUrl: "", token: "flow-fixture-only" })
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
          client={client}
          onDisconnect={() => setClient(null)}
          theme={theme}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      ) : (
        <Connection
          onConnect={(baseUrl, token) =>
            setClient(new FlowClient({ baseUrl, token }))
          }
        />
      )}
    </TooltipProvider>
  );
}
