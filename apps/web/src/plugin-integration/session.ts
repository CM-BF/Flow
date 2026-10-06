import type { TaskSnapshot } from "@flow/contracts";
import { PluginHost } from "../plugins/host";
import { createBuiltinPlugins } from "../plugins/builtins";
import { createSamplePlugin } from "../plugins/sample";
import type { HostPort, NavigationSnapshot, ResourceContext, ThemeDefinition, ThemeSnapshot, WorkspaceDisplay, WorkspaceTabId } from "../plugins/types";
import { themes } from "../themes";
import { createTaskActionsPlugin } from "./task-actions";

export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: T) {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach(listener => listener());
    },
  };
}

/** Private App capabilities. This object is never supplied to a plugin. */
export interface AppActions {
  knowsTask(id: string): boolean;
  task(id: string): TaskSnapshot | null;
  hasDraft(id: string): boolean;
  openTask(id: string): void;
  openWorkspace(id: string, tab: WorkspaceTabId): void;
  closeWorkspace(): void;
  loadReference(taskId: string, referenceId: string): Promise<void>;
  setTheme(theme: ThemeDefinition): void;
  copy(text: string): Promise<void>;
}
const emptyDisplay: WorkspaceDisplay = { task: null, details: {}, connection: "disconnected" };
const initialNavigation: NavigationSnapshot = { activeTaskId: null, workspaceTab: "files", workspaceOpen: false };

/** One host lifetime per center connection; navigation does not create a new lifetime. */
export class AppPluginSession {
  readonly id = crypto.randomUUID();
  readonly navigation = createStore<NavigationSnapshot>(initialNavigation);
  readonly theme: ReturnType<typeof createStore<ThemeSnapshot>>;
  readonly workspace = createStore<WorkspaceDisplay>(emptyDisplay);
  readonly host: PluginHost;
  private closed = false;
  private context: ResourceContext = { kind: "global" };
  private actions: AppActions;

  constructor(actions: AppActions, theme: ThemeDefinition) {
    this.actions = actions;
    this.theme = createStore<ThemeSnapshot>({ themeId: theme.id, scheme: theme.scheme, availableThemes: themes });
    const port: HostPort = {
      navigation: this.navigation,
      theme: this.theme,
      getContext: () => this.context,
      authorize: (_plugin, _capability, context) => !this.closed && this.validContext(context),
      execute: async (command, args, meta) => {
        this.assertCurrent(meta.signal);
        if (!this.validContext(meta.context)) throw Error("This resource is no longer available in this connection.");
        // The host validates the command's argument shape and invocation identity first.
        if (command === "flow.chat.open") {
          const { taskId } = args as { taskId: string };
          if (!this.actions.knowsTask(taskId)) throw Error("This task is not known to this connection.");
          this.actions.openTask(taskId);
        } else if (command === "flow.workspace.open") {
          const { taskId, tab } = args as { taskId: string; tab: WorkspaceTabId };
          if (!this.actions.knowsTask(taskId)) throw Error("This task is not known to this connection.");
          if (tab.startsWith("detail:")) this.assertReference(taskId, tab.slice(7));
          this.actions.openWorkspace(taskId, tab);
        } else if (command === "flow.workspace.close") {
          this.actions.closeWorkspace();
        } else if (command === "flow.reference.load") {
          const { taskId, referenceId } = args as { taskId: string; referenceId: string };
          this.assertReference(taskId, referenceId);
          await this.actions.loadReference(taskId, referenceId);
          this.assertCurrent(meta.signal);
        } else if (command === "flow.theme.set") {
          const { themeId } = args as { themeId: string };
          const selected = meta.theme ?? themes.find(theme => theme.id === themeId);
          if (!selected || selected.id !== themeId) throw Error("This theme is unavailable.");
          this.actions.setTheme(selected);
          this.publishTheme(selected);
        } else if (command === "flow.clipboard.copy") {
          await this.actions.copy((args as { text: string }).text);
          this.assertCurrent(meta.signal);
        } else {
          throw Error("Composer insertion is not supported in this workspace. Your draft was not changed.");
        }
      },
    };
    this.host = new PluginHost(port);
    for (const plugin of createBuiltinPlugins({ workspace: this.workspace })) this.host.register(plugin);
    this.host.register(createSamplePlugin());
    this.host.register(createTaskActionsPlugin());
  }

  updateActions(actions: AppActions) { if (!this.closed) this.actions = actions; }
  publishNavigation(next: NavigationSnapshot, context: ResourceContext) {
    if (this.closed) return;
    this.context = context;
    const old = this.navigation.getSnapshot();
    if (old.activeTaskId !== next.activeTaskId || old.workspaceTab !== next.workspaceTab || old.workspaceOpen !== next.workspaceOpen)
      this.navigation.set(Object.freeze({ ...next }));
  }
  publishWorkspace(next: WorkspaceDisplay) {
    if (this.closed) return;
    const old = this.workspace.getSnapshot();
    if (old.task !== next.task || old.details !== next.details || old.connection !== next.connection)
      this.workspace.set({ ...next });
  }
  publishTheme(theme: ThemeDefinition) {
    if (this.closed) return;
    const old = this.theme.getSnapshot();
    if (old.themeId !== theme.id || old.scheme !== theme.scheme)
      this.theme.set({ themeId: theme.id, scheme: theme.scheme, availableThemes: [...themes, ...(themes.some(item => item.id === theme.id) ? [] : [theme])] });
  }
  private assertCurrent(signal: AbortSignal) {
    if (this.closed || signal.aborted) throw Error("This extension belongs to a closed connection.");
  }
  private assertReference(taskId: string, referenceId: string) {
    if (!this.actions.task(taskId)?.entries.some(entry => entry.kind === "reference" && entry.reference.id === referenceId))
      throw Error("This reference does not belong to the selected task.");
  }
  private validContext(context: ResourceContext) {
    if (context.kind === "global") return true;
    if (context.kind === "composer") return context.isDraft && this.actions.hasDraft(context.viewId);
    if (context.kind === "workspace" && context.taskId === null) return true;
    if (!context.taskId || !this.actions.knowsTask(context.taskId)) return false;
    if (context.kind === "message") {
      const task = this.actions.task(context.taskId);
      return context.role === "user" ? context.messageId === `prompt-${task?.id}` : Boolean(task?.entries.some(entry => entry.id === context.messageId));
    }
    if (context.kind === "reference") return Boolean(this.actions.task(context.taskId)?.entries.some(entry => entry.kind === "reference" && entry.reference.id === context.referenceId));
    return true;
  }
  dispose = async () => {
    if (this.closed) return;
    // Clear the old connection's custom palette synchronously, before a new connection can render.
    const active = this.theme.getSnapshot();
    if (!themes.some(theme => theme.id === active.themeId)) {
      const fallback = themes.find(theme => theme.id === active.scheme)!;
      this.actions.setTheme(fallback);
      this.publishTheme(fallback);
    }
    this.closed = true;
    this.workspace.set(emptyDisplay);
    await this.host.dispose();
  };
}
