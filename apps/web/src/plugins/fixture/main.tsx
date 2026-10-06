import { createRoot } from "react-dom/client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { TaskSnapshot } from "@flow/contracts";
import { PluginHost } from "../host";
import { createBuiltinPlugins } from "../builtins";
import { createSamplePlugin } from "../sample";
import { ExtensionSlot, PluginTabs, PluginView } from "../react";
import type {
  HostPort,
  NavigationSnapshot,
  ThemeSnapshot,
  WorkspaceDisplay,
} from "../types";
import { themes, applyTheme } from "../../themes";
import "../../assistant-ui.css";
import "../../styles.css";
import "./style.css";
function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
  };
}
function task(id: string): TaskSnapshot {
  const now = "2026-10-06T02:45:00Z";
  return {
    id,
    title: `Task ${id}`,
    prompt: "Fixture task",
    harness: "fixture",
    status: "succeeded",
    verificationStatus: "passed",
    createdAt: now,
    updatedAt: now,
    watermark: 2,
    hasMore: false,
    pendingDecision: null,
    attempt: null,
    usage: {
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      costKind: "unknown",
      incomplete: true,
    },
    entries: [
      {
        id: `${id}-text`,
        cursor: 1,
        createdAt: now,
        kind: "text",
        text: `Task ${id} output\nChecks completed.\n\u001b[32mVerified\u001b[0m`,
      },
      {
        id: `${id}-ref`,
        cursor: 2,
        createdAt: now,
        kind: "reference",
        reference: { id: `${id}-artifact`, title: `${id} report.txt` },
      },
    ],
  };
}
const navigation = store<NavigationSnapshot>({
  activeTaskId: "A",
  workspaceOpen: true,
  workspaceTab: "files",
});
const theme = store<ThemeSnapshot>({
  themeId: "light",
  scheme: "light",
  availableThemes: themes,
});
const workspace = store<WorkspaceDisplay>({
  task: task("A"),
  details: {},
  connection: "live",
});
const draft = store("Unsent draft");
const log = store<string[]>([]);
let denied = false;
let renderError = false;
let failBridge = false;
let appliedTokens: string[] = [];
const port: HostPort = {
  navigation,
  theme,
  getContext: () => ({
    kind: "task",
    taskId: navigation.getSnapshot().activeTaskId!,
  }),
  authorize: () => !denied,
  execute: async (command, args, meta) => {
    if (meta.signal.aborted) throw Error("Old connection");
    if (failBridge) throw Error("Fixture bridge failed");
    log.set([
      ...log.getSnapshot(),
      `${command} ${JSON.stringify(args)} context=${JSON.stringify(meta.context)}`,
    ]);
    if (command === "flow.chat.open") {
      const id = (args as { taskId: string }).taskId;
      if (!["A", "B"].includes(id)) throw Error("Unknown fixture task");
      workspace.set({ task: task(id), details: {}, connection: "live" });
      navigation.set({
        ...navigation.getSnapshot(),
        activeTaskId: id,
        workspaceTab: "files",
      });
    }
    if (command === "flow.workspace.open") {
      const value = args as {
        taskId: string;
        tab: "files" | "terminal" | `detail:${string}`;
      };
      if (value.taskId !== workspace.getSnapshot().task?.id)
        throw Error("Task is not selected");
      navigation.set({
        ...navigation.getSnapshot(),
        workspaceTab: value.tab,
        workspaceOpen: true,
      });
    }
    if (command === "flow.workspace.close")
      navigation.set({ ...navigation.getSnapshot(), workspaceOpen: false });
    if (command === "flow.reference.load") {
      const value = args as { taskId: string; referenceId: string };
      const current = workspace.getSnapshot();
      if (
        current.task?.id !== value.taskId ||
        !current.task.entries.some(
          (entry) =>
            entry.kind === "reference" &&
            entry.reference.id === value.referenceId,
        )
      )
        throw Error("Unknown reference");
      workspace.set({
        ...current,
        details: {
          ...current.details,
          [value.referenceId]: {
            data: {
              id: value.referenceId,
              title: `${value.taskId} report.txt`,
              kind: "artifact",
              content: `Verified report for task ${value.taskId}.`,
              mediaType: "text/plain",
              artifactVersion: "v1",
            },
          },
        },
      });
    }
    if (command === "flow.theme.set") {
      const id = (args as { themeId: string }).themeId;
      const definition = meta.theme ?? themes.find((item) => item.id === id);
      if (!definition) throw Error("Unknown theme");
      for (const key of appliedTokens)
        document.documentElement.style.removeProperty(`--${key}`);
      appliedTokens = Object.keys(definition.tokens);
      applyTheme(definition.scheme);
      document.documentElement.dataset.theme = id;
      for (const [key, value] of Object.entries(definition.tokens))
        document.documentElement.style.setProperty(`--${key}`, value);
      theme.set({
        themeId: id,
        scheme: definition.scheme,
        availableThemes: [
          ...themes,
          ...(id.startsWith("sample.") ? [definition] : []),
        ],
      });
    }
    if (command === "flow.composer.insertText") {
      const value = args as { viewId: string; text: string };
      if (value.viewId !== "draft-one") throw Error("Unknown composer");
      draft.set(`${draft.getSnapshot()} ${value.text}`);
    }
    if (command === "flow.clipboard.copy")
      await navigator.clipboard.writeText((args as { text: string }).text);
  },
};
const host = new PluginHost(port);
for (const plugin of createBuiltinPlugins({ workspace })) host.register(plugin);
host.register(
  createSamplePlugin({
    failFirstLoad: new URLSearchParams(location.search).has("fail-load"),
    throwRender: () => renderError,
  }),
);
function App() {
  const nav = useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
  );
  const currentTheme = useSyncExternalStore(theme.subscribe, theme.getSnapshot);
  const value = useSyncExternalStore(draft.subscribe, draft.getSnapshot);
  const commands = useSyncExternalStore(log.subscribe, log.getSnapshot);
  const registry = useSyncExternalStore(host.subscribe, host.list);
  const [deny, setDeny] = useState(false);
  const [bridgeFailure, setBridgeFailure] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "d") {
        event.preventDefault();
        void host.deactivate("sample.notes");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  return (
    <main className="plugin-fixture">
      <header>
        <h1>Flow extensions</h1>
        <p>
          Isolated trusted host fixture · no center, PTY or filesystem access
        </p>
      </header>
      <div className="fixture-toolbar">
        <ExtensionSlot
          host={host}
          slot="activityBar.bottom"
          context={{ kind: "global" }}
        />
        <button
          type="button"
          onClick={() => {
            void host.deactivate("sample.notes");
          }}
        >
          Disable Notes
        </button>
        <button
          type="button"
          onClick={() => {
            void host.activate("sample.notes");
          }}
        >
          Enable Notes
        </button>
        <label>
          <input
            type="checkbox"
            checked={deny}
            onChange={(event) => {
              denied = event.target.checked;
              setDeny(denied);
            }}
          />
          Deny capabilities
        </label>
        <label>
          <input
            type="checkbox"
            checked={bridgeFailure}
            onChange={(event) => {
              failBridge = event.target.checked;
              setBridgeFailure(failBridge);
            }}
          />
          Fail App bridge
        </label>
        <label>
          <input
            type="checkbox"
            checked={broken}
            onChange={(event) => {
              renderError = event.target.checked;
              setBroken(renderError);
            }}
          />
          Break Notes render
        </label>
      </div>
      <div className="fixture-grid">
        <aside>
          <h2>Chats</h2>
          {["A", "B"].map((id) => (
            <div key={id} className="fixture-chat">
              <span>Task {id}</span>
              <ExtensionSlot
                host={host}
                slot="sidebar.item.actions"
                context={{ kind: "task", taskId: id }}
              />
            </div>
          ))}
          <p>
            Active task:{" "}
            <output data-testid="active-task">{nav.activeTaskId}</output>
          </p>
          <p>
            Theme: <output data-testid="theme">{currentTheme.themeId}</output>
          </p>
          <PluginView
            host={host}
            contributionId="flow.theme.settings"
            context={{ kind: "global" }}
          />
        </aside>
        <section className="fixture-chat-area">
          <h2>Draft stays outside plugins</h2>
          <textarea
            aria-label="Draft"
            value={value}
            onChange={(event) => draft.set(event.target.value)}
          />
          <ExtensionSlot
            host={host}
            slot="chat.composer.actions"
            context={{ kind: "composer", viewId: "draft-one", isDraft: true }}
          />
          <h2>Task workspace</h2>
          {nav.workspaceOpen ? (
            <PluginTabs
              host={host}
              context={{
                kind: "workspace",
                taskId: nav.activeTaskId,
                tabId: nav.workspaceTab,
              }}
            />
          ) : (
            <button
              onClick={() => navigation.set({ ...nav, workspaceOpen: true })}
            >
              Reopen workspace
            </button>
          )}
        </section>
      </div>
      <details>
        <summary>Host diagnostics and command trace</summary>
        <pre data-testid="plugin-states">
          {registry.map((item) => `${item.id}: ${item.state}`).join("\n")}
        </pre>
        <pre data-testid="command-log">{commands.join("\n")}</pre>
      </details>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
