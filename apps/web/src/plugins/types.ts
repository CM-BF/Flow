import type { ComponentType } from "react";
import type {
  WorkspacePanelsProps,
  WorkspaceTabId,
} from "../components/workspace/types";
export type { WorkspaceTabId };
export type LayoutResource =
  | { readonly kind: "conversation"; readonly conversationId: string }
  | { readonly kind: "pane"; readonly workspaceId: string; readonly paneId: string; readonly viewKey: string };
export type LayoutChange = { kind: "split" } | { kind: "merge" } | { kind: "swap"; direction: -1 | 1 } | { kind: "resize"; share: number };
/** Host-private proof captured before activation; never exposed to a plugin handler. */
export interface LayoutInvocation { readonly signal: AbortSignal; check(): void }
export type ResourceContext =
  | LayoutResource
  | { readonly kind: "global" }
  | { readonly kind: "task"; readonly taskId: string }
  | {
      readonly kind: "message";
      readonly taskId: string;
      readonly messageId: string;
      readonly role: "user" | "assistant";
    }
  | {
      readonly kind: "composer";
      readonly viewId: string;
      readonly isDraft: boolean;
    }
  | {
      readonly kind: "workspace";
      readonly taskId: string | null;
      readonly tabId: WorkspaceTabId;
    }
  | {
      readonly kind: "reference";
      readonly taskId: string;
      readonly referenceId: string;
    };
export type ContextKind = ResourceContext["kind"];
export type Capability =
  | "ui.navigate"
  | "ui.layout"
  | "task.steering.read"
  | "task.steering.write"
  | "task.activity.read"
  | "task.assistant-stream.read"
  | "reference.read"
  | "theme.write"
  | "theme.register"
  | "attachment.read"
  | "attachment.upload"
  | "knowledge.read"
  | "workspace.read"
  | "composer.write"
  | "clipboard.write";
export type SlotId =
  | "activityBar.primary"
  | "activityBar.bottom"
  | "sidebar.header"
  | "sidebar.item.actions"
  | "sidebar.footer"
  | "chat.header"
  | "chat.tab.actions"
  | "chat.task.actions"
  | "chat.message.actions"
  | "chat.message.footer"
  | "chat.composer.actions"
  | "chat.composer.context"
  | "workspace.header"
  | "workspace.tabs"
  | "workspace.actions"
  | "artifact.actions"
  | "settings.sections";
export interface Readable<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}
export interface NavigationSnapshot {
  readonly activeTaskId: string | null;
  readonly workspaceTab: WorkspaceTabId;
  readonly workspaceOpen: boolean;
}
export interface ThemeDefinition {
  readonly id: string;
  readonly label: string;
  readonly scheme: "light" | "dark";
  readonly tokens: Readonly<Record<string, string>>;
}
export interface ThemeSnapshot {
  readonly themeId: string;
  readonly scheme: "light" | "dark";
  readonly availableThemes: readonly ThemeDefinition[];
}
export interface HostCommandArgs {
  "flow.conversation.open": { conversationId: string };
  "flow.view.close": { viewKey: string };
  "flow.layout.change": { paneId: string; change: LayoutChange };
  "flow.chat.open": { taskId: string };
  "flow.workspace.open": { taskId: string; tab: WorkspaceTabId };
  "flow.workspace.close": Record<string, never>;
  "flow.reference.load": { taskId: string; referenceId: string };
  "flow.theme.set": { themeId: string };
  "flow.composer.insertText": { viewId: string; text: string };
  "flow.clipboard.copy": { text: string };
}
export type HostCommandId = keyof HostCommandArgs;
export interface HostPort {
  readonly navigation: Readable<Readonly<NavigationSnapshot>>;
  readonly theme: Readable<Readonly<ThemeSnapshot>>;
  getContext(): ResourceContext;
  captureLayoutInvocation?(context: LayoutResource): LayoutInvocation;
  authorize(
    pluginId: string,
    capability: Capability,
    context: ResourceContext,
  ): boolean;
  execute<K extends HostCommandId>(
    command: K,
    args: HostCommandArgs[K],
    meta: {
      pluginId: string;
      context: ResourceContext;
      signal: AbortSignal;
      theme?: ThemeDefinition;
    },
  ): Promise<void>;
}
export type OperationResult<T = unknown> =
  | { readonly ok: true; readonly value?: T }
  | { readonly ok: false; readonly error: string };
export interface Disposable {
  dispose(): void;
}
export interface CommandDeclaration {
  readonly id: string;
  readonly title: string;
  readonly capability: Capability;
  readonly contexts: readonly ContextKind[];
}
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type ContributionDeclaration =
  | {
      readonly kind: "button" | "menu";
      readonly id: string;
      readonly slot: SlotId;
      readonly title: string;
      readonly commandId: string;
      readonly args?: JsonValue;
    }
  | {
      readonly kind: "panel";
      readonly id: string;
      readonly slot: "workspace.tabs" | "settings.sections" | "chat.message.footer" | "chat.composer.context";
      readonly title: string;
      readonly capability: Capability;
    }
  | {
      readonly kind: "theme";
      readonly id: string;
      readonly theme: ThemeDefinition;
    };
export interface PluginManifest {
  readonly id: string;
  readonly version: string;
  readonly hostApi: 1;
  readonly capabilities: readonly Capability[];
  readonly activationEvents: readonly (
    | `command:${string}`
    | `view:${SlotId}`
  )[];
  readonly commands: readonly CommandDeclaration[];
  readonly contributions: readonly ContributionDeclaration[];
}
export interface PluginDefinition {
  readonly manifest: PluginManifest;
  readonly load: (signal: AbortSignal) => Promise<PluginModule>;
}
export interface PluginModule {
  activate(
    context: PluginContext,
  ): void | Disposable | Promise<void | Disposable>;
}
export interface CommandContext {
  readonly signal: AbortSignal;
  readonly resource: ResourceContext;
  readonly navigation: Readable<Readonly<NavigationSnapshot>>;
  readonly theme: Readable<Readonly<ThemeSnapshot>>;
  execute<K extends HostCommandId>(
    command: K,
    args: HostCommandArgs[K],
  ): Promise<void>;
}
export interface CommandHandler<T = unknown> {
  parse(args: unknown): T;
  run(args: T, context: CommandContext): unknown | Promise<unknown>;
}
export interface PluginViewProps {
  readonly context: ResourceContext;
  execute: (commandId: string, args?: unknown) => Promise<OperationResult>;
}
export type PluginRenderer = ComponentType<PluginViewProps>;
export interface PluginContext {
  readonly signal: AbortSignal;
  command<T>(id: string, handler: CommandHandler<T>): Disposable;
  contribute(id: string, renderer: PluginRenderer): Disposable;
  own(disposable: Disposable): Disposable;
  readonly navigation: Readable<Readonly<NavigationSnapshot>>;
  readonly theme: Readable<Readonly<ThemeSnapshot>>;
}
export type PluginState =
  | "registered"
  | "activating"
  | "active"
  | "disabled"
  | "failed";
export interface PluginSummary {
  readonly id: string;
  readonly version: string;
  readonly state: PluginState;
  readonly error?: string;
}
export interface ContributionView {
  readonly pluginId: string;
  readonly declaration: Exclude<ContributionDeclaration, { kind: "theme" }>;
  readonly state: PluginState;
  readonly error?: string;
}
export interface PluginDiagnostic {
  readonly pluginId: string;
  readonly phase:
    | "activate"
    | "command"
    | "dispose"
    | "render"
    | "register"
    | "subscription";
  readonly message: string;
}
export type WorkspaceDisplay = Readonly<
  Pick<WorkspacePanelsProps, "task" | "details" | "connection">
>;
export interface BuiltinPorts {
  workspace: Readable<WorkspaceDisplay>;
}
