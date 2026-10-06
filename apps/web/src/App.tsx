import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { FlowClient } from "@flow/client";
import {
  taskFixtures,
  TERMINAL_STATUSES,
  type TaskSnapshot,
  type TaskStatus,
  type TaskSubmission,
} from "@flow/contracts";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  CircleHelp,
  CircleStop,
  Layers3,
  Link2,
  Moon,
  Plus,
  RefreshCw,
  Sun,
  Waves,
} from "lucide-react";
import { TaskProjection } from "./projection";
import { TaskThread } from "./TaskThread";
import { applyTheme, initialTheme, themes } from "./themes";

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
const fixtureChoices = Object.entries(taskFixtures) as [
  keyof typeof taskFixtures,
  TaskSubmission,
][];
const isFixture = import.meta.env.VITE_FLOW_FIXTURE === "true";
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="status-dot" />
      {statusLabels[status]}
    </span>
  );
}

function NewTask({
  projection,
  onCreated,
  onClose,
  pending,
}: {
  projection: TaskProjection;
  onCreated: (id: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [harness, setHarness] = useState<"fixture" | "claude">(
    isFixture ? "fixture" : "claude",
  );
  const [scenario, setScenario] =
    useState<keyof typeof taskFixtures>("success");
  const [expected, setExpected] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const base =
      harness === "fixture"
        ? taskFixtures[scenario]
        : { harness: "claude" as const };
    const id = await projection.submit({
      ...base,
      title: title.trim(),
      prompt,
      ...(expected
        ? { verification: { kind: "contains" as const, expected } }
        : {}),
    });
    if (id) onCreated(id);
  };
  return (
    <section className="new-task">
      <button className="text-button back" onClick={onClose}>
        <ChevronLeft size={16} />
        Back to workspace
      </button>
      <h1>What would you like to do?</h1>
      <p className="lead">Give Flow a task. Come back when it needs you.</p>
      <form onSubmit={submit}>
        <label>
          Task title
          <input
            autoFocus
            required
            maxLength={180}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A clear name for this task"
          />
        </label>
        <label>
          Instructions
          <textarea
            required
            maxLength={16000}
            rows={6}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the outcome, constraints, and what a good result looks like."
          />
        </label>
        <div className="form-row">
          <label>
            Execution backend
            <select
              value={harness}
              onChange={(event) =>
                setHarness(event.target.value as "fixture" | "claude")
              }
            >
              <option value="claude">Claude runner</option>
              <option value="fixture">Contract fixture</option>
            </select>
          </label>
          <label>
            Acceptance text (optional)
            <input
              maxLength={500}
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              placeholder="Text the artifact must contain"
            />
          </label>
        </div>
        {harness === "fixture" && (
          <label>
            Fixture scenario
            <select
              value={scenario}
              onChange={(event) => {
                const name = event.target.value as keyof typeof taskFixtures;
                setScenario(name);
                setTitle(taskFixtures[name].title);
                setPrompt(taskFixtures[name].prompt);
              }}
            >
              {fixtureChoices.map(([name, fixture]) => (
                <option key={name} value={name}>
                  {fixture.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-footer">
          <p>
            Accepted tasks live at the center. Closing this page does not cancel
            them.
          </p>
          <button className="primary" disabled={pending}>
            {pending ? "Waiting for acceptance…" : "Create task"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

function TaskFacts({ task }: { task: TaskSnapshot }) {
  const costLabel = {
    sdk_estimate: "SDK estimate",
    provider_actual: "Provider actual",
    mixed: "Mixed sources",
    unknown: "Unknown source",
  }[task.usage.costKind];
  return (
    <aside className="task-facts" aria-label="Task details">
      <h2>Task details</h2>
      <dl>
        <dt>Execution</dt>
        <dd>
          <StatusBadge status={task.status} />
        </dd>
        <dt>Artifact acceptance</dt>
        <dd>
          <span className={`badge verification-${task.verificationStatus}`}>
            {task.verificationStatus === "passed"
              ? "Verified"
              : task.verificationStatus === "failed"
                ? "Verification failed"
                : "Verification pending"}
          </span>
        </dd>
        <dt>Backend</dt>
        <dd>
          {task.harness === "fixture" ? "Contract fixture" : "Claude runner"}
        </dd>
        <dt>Last updated</dt>
        <dd>{formatDate(task.updatedAt)}</dd>
        <dt>Task ID</dt>
        <dd className="identifier">{task.id}</dd>
      </dl>
      <div className="usage">
        <h2>Usage</h2>
        <dl>
          <dt>Input tokens</dt>
          <dd>{task.usage.inputTokens?.toLocaleString() ?? "Unknown"}</dd>
          <dt>Output tokens</dt>
          <dd>{task.usage.outputTokens?.toLocaleString() ?? "Unknown"}</dd>
          <dt>Cost</dt>
          <dd>
            {task.usage.costUsd === null
              ? "Unknown"
              : `$${task.usage.costUsd.toFixed(4)}`}
            <small>{costLabel}</small>
          </dd>
        </dl>
        {task.usage.incomplete && (
          <p className="muted">Some usage is still unknown.</p>
        )}
      </div>
      <p className="quiet-note">
        <Layers3 size={17} />
        Full details stay folded until you open them.
      </p>
    </aside>
  );
}

function Workspace({
  projection,
  onDisconnect,
}: {
  projection: TaskProjection;
  onDisconnect: () => void;
}) {
  const state = useSyncExternalStore(
    projection.subscribe,
    projection.getSnapshot,
  );
  const [newTask, setNewTask] = useState(false);
  const [query, setQuery] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const select = (id: string) => {
    setNewTask(false);
    setCancelConfirm(false);
    history.replaceState(null, "", `#task=${encodeURIComponent(id)}`);
    void projection.select(id);
  };
  useEffect(() => {
    void projection.list();
    const followRoute = () => {
      const id = new URLSearchParams(location.hash.slice(1)).get("task");
      setNewTask(false);
      setCancelConfirm(false);
      if (id) void projection.select(id);
      else projection.clearSelection();
    };
    followRoute();
    const offline = () => projection.setOnline(false);
    const online = () => projection.setOnline(true);
    window.addEventListener("hashchange", followRoute);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("hashchange", followRoute);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      projection.disconnect();
    };
  }, [projection]);
  const task = state.task;
  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="Tasks">
        <div className="workspace-name">
          <span className="workspace-icon">P</span>
          <div>
            Personal workspace<small>Your tasks, in one place</small>
          </div>
        </div>
        <button
          className="primary new-button"
          onClick={() => {
            setNewTask(true);
            projection.clearError();
          }}
        >
          <Plus size={17} />
          New task
        </button>
        <label className="search-label">
          <span className="sr-only">Find tasks</span>
          <input
            placeholder="Find a task…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="list-heading">
          <h2>Tasks</h2>
          <button
            className="icon-button"
            aria-label="Refresh task list"
            onClick={() => void projection.list()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <nav className="task-list">
          {state.tasks
            .filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <button
                key={item.id}
                className={`task-item ${!newTask && task?.id === item.id ? "selected" : ""}`}
                onClick={() => select(item.id)}
                aria-current={
                  !newTask && task?.id === item.id ? "page" : undefined
                }
              >
                <span>{item.title}</span>
                <StatusBadge status={item.status} />
              </button>
            ))}
          {state.tasks.length === 0 && (
            <p className="empty-list">
              No tasks yet. Create your first task to get started.
            </p>
          )}
        </nav>
        {state.nextListCursor && (
          <button
            className="text-button"
            onClick={() => void projection.list(true)}
          >
            Load more tasks
          </button>
        )}
        <button className="center-link" onClick={onDisconnect}>
          <Link2 size={15} />
          Change connection
        </button>
      </aside>
      <main tabIndex={-1} id="main" className="main-panel">
        {isFixture && (
          <div className="fixture-banner">
            HTTP fixture preview{" "}
            <span>Simulated tasks · no live model or production center</span>
          </div>
        )}
        {state.error && (
          <div className="notice error" role="alert">
            <span>{state.error}</span>
            <button
              className="text-button"
              onClick={() => projection.clearError()}
            >
              Dismiss
            </button>
          </div>
        )}
        {newTask ? (
          <NewTask
            projection={projection}
            pending={state.pending}
            onClose={() => setNewTask(false)}
            onCreated={(id) => {
              history.replaceState(null, "", `#task=${encodeURIComponent(id)}`);
              setNewTask(false);
            }}
          />
        ) : task ? (
          <>
            <header className="task-header">
              <div>
                <div className="breadcrumb">Workspace / Task</div>
                <h1>{task.title}</h1>
                <div className="task-subtitle">
                  <StatusBadge status={task.status} />
                  <span
                    className={`connection ${state.connection}`}
                    role="status"
                  >
                    <span className="status-dot" />
                    {state.connection === "live"
                      ? "Live updates"
                      : state.connection === "reconnecting"
                        ? "Reconnecting · task continues"
                        : state.connection === "disconnected"
                          ? "Disconnected · task continues"
                          : "Connecting"}
                  </span>
                </div>
              </div>
              {!TERMINAL_STATUSES.includes(task.status) &&
                task.status !== "cancel_requested" && (
                  <button
                    className="secondary cancel-trigger"
                    onClick={() => setCancelConfirm(true)}
                  >
                    <CircleStop size={16} />
                    Cancel task
                  </button>
                )}
            </header>
            {cancelConfirm && (
              <div className="notice" role="alert">
                <span>
                  Request the runner to stop this task? Work already completed
                  will be kept.
                </span>
                <button
                  className="danger-button"
                  disabled={state.pending}
                  onClick={() => {
                    setCancelConfirm(false);
                    void projection.cancel();
                  }}
                >
                  Confirm cancellation
                </button>
                <button onClick={() => setCancelConfirm(false)}>
                  Keep running
                </button>
              </div>
            )}
            <div className="task-layout">
              <section className="activity" aria-label="Task activity">
                <div className="activity-heading">
                  <h2>Activity</h2>
                  <span>Saved by the center</span>
                </div>
                {state.olderAvailable && (
                  <button
                    className="earlier"
                    onClick={() => void projection.loadEarlier()}
                  >
                    Load earlier activity
                  </button>
                )}
                <TaskThread
                  key={task.id}
                  task={task}
                  projection={projection}
                  details={state.details}
                />
                {task.pendingDecision && (
                  <section className="decision" aria-label="Decision required">
                    <div className="decision-icon">
                      <CircleHelp size={22} />
                    </div>
                    <div>
                      <h2>Your decision is needed</h2>
                      <p>{task.pendingDecision.prompt}</p>
                      <div className="decision-actions">
                        <button
                          className="primary"
                          disabled={state.pending}
                          onClick={() => void projection.decide("approve")}
                        >
                          <Check size={16} />
                          Approve
                        </button>
                        <button
                          className="secondary"
                          disabled={state.pending}
                          onClick={() => void projection.decide("reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                {task.status === "uncertain" && (
                  <div className="notice">
                    Runner ownership was lost. The center requires
                    reconciliation; work may already have taken effect.
                  </div>
                )}
                {task.status === "cancel_requested" && (
                  <div className="notice">
                    Cancellation requested. Waiting for the runner to
                    acknowledge that it stopped.
                  </div>
                )}
                {task.verificationStatus === "failed" && (
                  <div className="notice error">
                    Artifact verification failed. The execution result and its
                    evidence are retained above.
                  </div>
                )}
                <p className="activity-footnote">
                  You can leave this page. Accepted work continues at the
                  center.
                </p>
              </section>
              <TaskFacts task={task} />
            </div>
          </>
        ) : (
          <section className="welcome">
            <div className="welcome-mark">
              <Waves size={40} />
            </div>
            <h1>Make room for focused work.</h1>
            <p>
              Give Flow an outcome. Follow the work, weigh in when needed, and
              inspect the result.
            </p>
            <button className="primary" onClick={() => setNewTask(true)}>
              <Plus size={18} />
              Create a task
            </button>
            <span className="muted">Or choose a task from your workspace.</span>
          </section>
        )}
      </main>
    </div>
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
    <main tabIndex={-1} id="main" className="connection-screen">
      <Waves size={36} />
      <h1>Connect your workspace</h1>
      <p>
        Use your Flow center and owner token. The token stays in this page’s
        memory.
      </p>
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
            placeholder="Same origin (development proxy)"
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
        <button className="primary">Connect workspace</button>
      </form>
    </main>
  );
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [projection, setProjection] = useState<TaskProjection | null>(() =>
    isFixture
      ? new TaskProjection(
          new FlowClient({ baseUrl: "", token: "flow-fixture-only" }),
        )
      : null,
  );
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => event.preventDefault()}
        >
          <Waves size={27} />
          Flow
        </a>
        <span className="header-tagline">Work that keeps moving</span>
        <div className="header-actions">
          <span className="private-label">Personal workspace</span>
          <label className="theme-picker">
            {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            <span className="sr-only">Color theme</span>
            <select
              aria-label="Color theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              {themes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {projection ? (
        <Workspace
          projection={projection}
          onDisconnect={() => {
            projection.disconnect();
            setProjection(null);
          }}
        />
      ) : (
        <Connection
          onConnect={(baseUrl, token) =>
            setProjection(
              new TaskProjection(new FlowClient({ baseUrl, token })),
            )
          }
        />
      )}
    </>
  );
}
