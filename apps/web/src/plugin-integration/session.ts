import { ConversationMessageSettings, createMessageSettingsPlugin, type MessageSettingsPort } from "./message-settings";
import type { AppLayoutPort } from "./layout";
import { RecoveryWorkspace, createRecoveryPlugin, type RecoveryHost } from "../recovery/binding";
import { ConversationAttachments, createAttachmentPlugin, type AttachmentClient } from "./attachments";
import type { RecoveryStorage } from "../attachments/recovery";
import { SteeringWorkspace, createSteeringPlugin, type SteeringIdentity, type SteeringPorts } from "./steering";
import { ConversationKnowledge, createKnowledgePlugin, KNOWLEDGE_OWNER, KNOWLEDGE_PANEL, type KnowledgeReaders, type KnowledgeIdentity } from "./knowledge";
import type { ConversationProjection } from "../conversations/projection";
import type { FrozenCitation } from "../conversation-context/selection";
import { StreamConnectionBudget, STREAM_PANEL, type StreamIdentity, type StreamReaders, type StreamAuthority } from "../conversation-stream/host";
import { createAssistantStreamPlugin } from "./react";
import type { TaskSnapshot, Detail, EventPage, NativeActivity, NativeActivityPage } from "@flow/contracts";
import type { FlowClient } from "@flow/client";
import { createRuntimeCommandController, type PluginRuntimeReader, type RuntimeCommandController } from "../plugin-management/runtime-command";
import { PluginHost } from "../plugins/host";
import { createBuiltinPlugins } from "../plugins/builtins";
import { createSamplePlugin } from "../plugins/sample";
import type { Capability, HostPort, NavigationSnapshot, ResourceContext, ThemeDefinition, ThemeSnapshot, WorkspaceDisplay, WorkspaceTabId } from "../plugins/types";
import { themes } from "../themes";
import { createTaskActionsPlugin } from "./task-actions";
import { createDataRendererRegistry } from "../data-renderers/registry";
import { flowReplyDeclaration } from "../data-renderers/flow-reply-detail";
import { createReplyRendererPlugin } from "./data-renderers";
import { createActivityPlugin, ACTIVITY_OWNER, ACTIVITY_PANEL, type ActivityIdentity, type ActivityReaders } from "./activity";

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

/** Private, live connection authority. A render snapshot is not write authority. */
export interface CenterRuntimePort {
  reader: PluginRuntimeReader;
  writer: Pick<FlowClient, "commandPluginRuntime">;
  /** Null when inactive; otherwise includes the complete namespace and auth generation. */
  authorityKey(): string | null;
  subscribe(listener: () => void): () => void;
}
interface CenterRuntimeBinding {
  sessionId: string;
  reader: PluginRuntimeReader;
  commands: RuntimeCommandController;
}

/** Private App capabilities. This object is never supplied to a plugin. */
export interface AppActions {
  layout?: AppLayoutPort;
  knowsTask(id: string): boolean;
  task(id: string): TaskSnapshot | null;
  hasDraft(id: string): boolean;
  recovery?: RecoveryHost;
  messageSettings?: MessageSettingsPort;
  centerRuntime?: CenterRuntimePort;
  activity?: ActivityReaders;
  knowledge?: KnowledgeReaders;
  stream?: StreamReaders;
  steering?: SteeringPorts;
  attachments?: { client: AttachmentClient; storage: RecoveryStorage;
    allowed(viewKey: string, projection: ConversationProjection, projectId: string, mode: "read" | "upload"): boolean };
  ownsMessage?(taskId: string, messageId: string, role: "user" | "assistant"): boolean;
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
  private readonly settingsBindings = new Map<string, ConversationMessageSettings>();
  readonly navigation = createStore<NavigationSnapshot>(initialNavigation);
  readonly theme: ReturnType<typeof createStore<ThemeSnapshot>>;
  readonly workspace = createStore<WorkspaceDisplay>(emptyDisplay);
  readonly centerRuntime = createStore<CenterRuntimeBinding | null>(null);
  private runtimePort: CenterRuntimePort | undefined;
  private runtimeAuthority: string | null = null;
  private stopRuntimeAuthority: (() => void) | undefined;
  private runtimeGeneration = 0;
  readonly host: PluginHost;
  readonly steering: SteeringWorkspace;
  readonly recovery: RecoveryWorkspace;
  readonly streamBudget = new StreamConnectionBudget();
  readonly dataRenderers: ReturnType<typeof createDataRendererRegistry>;
  private readonly attachmentBindings = new Map<string, { binding: ConversationAttachments; stop(): void }>();
  private readonly knowledgeBindings = new Map<string, ConversationKnowledge>();
  private readonly recoverySubscriptions = new Map<string, () => void>();
  recoveryMaterials(viewKey: string) {
    const knowledge = this.knowledgeBindings.get(viewKey)?.getSnapshot();
    return { projectId: knowledge?.projectId ?? null, projectTitle: knowledge?.projectTitle ?? null, knowledge: knowledge?.controller?.getSnapshot().selected ?? [], attachments: this.attachmentBindings.get(viewKey)?.binding.recoveryDraft() ?? [] };
  }
  private readonly lifetime = new AbortController();
  get signal() { return this.lifetime.signal; }
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
      captureLayoutInvocation: context => {
        if (this.closed || !this.actions.layout) throw Error("Layout actions are unavailable in this connection.");
        return this.actions.layout.capture(context);
      },
      authorize: (_plugin, capability, context) => this.authorizeResource(capability, context),
      execute: async (command, args, meta) => {
        this.assertCurrent(meta.signal);
        if (!this.validContext(meta.context)) throw Error("This resource is no longer available in this connection.");
        // The host validates the command's argument shape and invocation identity first.
        if (command === "flow.conversation.open") {
          if (meta.context.kind !== "conversation" || !this.actions.layout) throw Error("Conversation layout is unavailable.");
          this.actions.layout.open(meta.context, meta.signal);
        } else if (command === "flow.view.close") {
          if (meta.context.kind !== "pane" || !this.actions.layout) throw Error("Pane layout is unavailable.");
          this.actions.layout.close(meta.context, meta.signal);
        } else if (command === "flow.layout.change") {
          if (meta.context.kind !== "pane" || !this.actions.layout) throw Error("Pane layout is unavailable.");
          this.actions.layout.change(meta.context, (args as import("../plugins/types").HostCommandArgs["flow.layout.change"]).change, meta.signal);
        } else if (command === "flow.chat.open") {
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
    this.steering = new SteeringWorkspace(this);
    this.recovery = new RecoveryWorkspace(this, () => this.actions.recovery);
    this.host.register(createRecoveryPlugin(this.recovery));
    this.host.register(createSteeringPlugin(this.steering));
    this.dataRenderers = createDataRendererRegistry([flowReplyDeclaration], this.host);
    this.host.register(createReplyRendererPlugin(this.dataRenderers));
    for (const plugin of createBuiltinPlugins({ workspace: this.workspace })) this.host.register(plugin);
    this.host.register(createSamplePlugin());
    this.host.register(createTaskActionsPlugin());
    this.host.register(createActivityPlugin());
    this.host.register(createAssistantStreamPlugin());
    this.host.register(createAttachmentPlugin(viewId => [...this.attachmentBindings.values()].find(({ binding }) => { const context = binding.context(); return context.kind === "composer" && context.viewId === viewId; })?.binding));
    this.host.register(createMessageSettingsPlugin((viewId, signal) => {
      const binding = [...this.settingsBindings.values()].find(item => item.context().viewId === viewId);
      if (!binding) throw Error("This composer has no message settings owner.");
      binding.open(signal);
    }));
    this.host.subscribe(() => this.settingsBindings.forEach(binding => binding.sync()));
    this.host.register(createKnowledgePlugin(viewId => {
      const binding = [...this.knowledgeBindings.values()].find(item => { const context = item.context(); return context.kind === "composer" && context.viewId === viewId; });
      if (!binding) throw Error("Knowledge is not available in this composer.");
      binding.open();
    }));
    this.recovery.sync();
    this.syncCenterRuntime();
  }

  updateActions(actions: AppActions) { if (!this.closed) { this.actions = actions; this.syncCenterRuntime(); this.settingsBindings.forEach(binding => binding.sync()); this.recovery.sync(); this.steering.sync(); this.attachmentBindings.forEach(({ binding }) => binding.sync()); } }
  managementAvailable() {
    const port = this.actions.centerRuntime;
    return !this.closed && (!port || (this.centerRuntime.getSnapshot() !== null && this.runtimeAuthority !== null && port.authorityKey() === this.runtimeAuthority));
  }
  private syncCenterRuntime = () => {
    const port = this.closed ? undefined : this.actions.centerRuntime;
    const authority = port?.authorityKey() ?? null;
    if (port === this.runtimePort && authority === this.runtimeAuthority) return;
    this.centerRuntime.getSnapshot()?.commands.revoke();
    this.centerRuntime.set(null);
    if (port !== this.runtimePort) {
      this.stopRuntimeAuthority?.();
      this.runtimePort = port;
      this.stopRuntimeAuthority = port?.subscribe(this.syncCenterRuntime);
    }
    this.runtimeAuthority = authority;
    if (!port || authority === null) return;
    const sessionId = `${this.id}:runtime:${++this.runtimeGeneration}`;
    const isCurrent = () => !this.closed && this.actions.centerRuntime === port
      && this.runtimeAuthority === authority && port.authorityKey() === authority;
    const requireCurrent = () => { if (!isCurrent()) throw Error("This center connection is no longer authorized."); };
    const reader: PluginRuntimeReader = {
      pluginRuntime: async (id, signal) => { requireCurrent(); const value = await port.reader.pluginRuntime(id, signal); requireCurrent(); return value; },
      pluginMaterialInstalls: async (id, options, signal) => { requireCurrent(); const value = await port.reader.pluginMaterialInstalls(id, options, signal); requireCurrent(); return value; },
    };
    this.centerRuntime.set({ sessionId, reader, commands: createRuntimeCommandController(port.writer, { sessionId, isCurrent }) });
  };
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
  private authorizeResource(capability: Capability, context: ResourceContext) {
    if (this.closed || !this.validContext(context)) return false;
    if (capability === "task.steering.read" || capability === "task.steering.write") return this.steering.authorize(context, capability === "task.steering.read" ? "read" : "write");
    if (capability === "attachment.read" || capability === "attachment.upload") {
      if (context.kind !== "composer") return false;
      const knowledge = [...this.knowledgeBindings.values()].find(item => { const resource = item.context(); return resource.kind === "composer" && resource.viewId === context.viewId; });
      const projectId = knowledge?.projection.getSnapshot().snapshot?.conversation.projectId;
      return !!knowledge && !!projectId && this.actions.attachments?.allowed(knowledge.viewKey, knowledge.projection, projectId, capability === "attachment.read" ? "read" : "upload") === true;
    }
    return true;
  }
  attachmentBinding(viewKey: string, projection: ConversationProjection): ConversationAttachments | null {
    const existing = this.attachmentBindings.get(viewKey); if (existing) return existing.binding;
    const projectId = projection.getSnapshot().snapshot?.conversation.projectId;
    if (this.closed || !projectId || !this.actions.attachments) return null;
    const knowledge = this.knowledgeBinding(viewKey, projection);
    const binding = new ConversationAttachments({ connectionId: this.id, viewKey, projectId }, {
      host: this.host, client: this.actions.attachments.client, signal: this.signal, storage: this.actions.attachments.storage,
      current: () => {
        const state = projection.getSnapshot(), context = knowledge.context();
        if (this.closed || context.kind !== "composer" || state.snapshot?.conversation.projectId !== projectId) return null;
        return { viewId: context.viewId, conversationId: state.snapshot.conversation.id, projectId, visible: knowledge.getSnapshot().visible,
          online: state.connection === "live", attachmentContext: state.snapshot.capabilities.attachmentContext === true,
          canRead: this.actions.attachments?.allowed(viewKey, projection, projectId, "read") === true,
          canUpload: this.actions.attachments?.allowed(viewKey, projection, projectId, "upload") === true };
      },
    });
    const stopProjection = projection.subscribe(() => binding.sync()), stopKnowledge = knowledge.subscribe(() => binding.sync());
    const stopRecovery = binding.subscribe(() => this.recovery.changed(viewKey));
    this.attachmentBindings.set(viewKey, { binding, stop: () => { stopProjection(); stopKnowledge(); stopRecovery(); binding.dispose(); } });
    return binding;
  }
  steeringAllowed(identity: SteeringIdentity, mode: "read" | "write") { return !this.closed && identity.connectionScope === this.id && this.actions.steering?.allowed(identity, mode) === true; }
  steeringAdmission(identity: SteeringIdentity, options: { attemptId?: string }, signal: AbortSignal) { if (!this.steeringAllowed(identity, "read")) throw Error("Steering read denied."); return this.actions.steering!.admission(identity, options, signal); }
  steeringState(identity: SteeringIdentity, options: { attemptId: string; after: number; limit: number }, signal: AbortSignal) { if (!this.steeringAllowed(identity, "read")) throw Error("Steering read denied."); return this.actions.steering!.state(identity, options, signal); }
  steeringAccept(identity: SteeringIdentity, input: Parameters<SteeringPorts["accept"]>[1], key: string, signal: AbortSignal) { if (!this.steeringAllowed(identity, "write")) throw Error("Steering write denied."); return this.actions.steering!.accept(identity, input, key, signal); }
  knowledgeBinding(viewKey: string, projection: ConversationProjection) {
    let binding = this.knowledgeBindings.get(viewKey);
    if (!binding) {
      binding = new ConversationKnowledge(viewKey, projection, this); this.knowledgeBindings.set(viewKey, binding);
      let observed = binding.getSnapshot().controller, stopSelection = observed?.subscribe(() => this.recovery.changed(viewKey));
      const current = binding;
      const stopBinding = binding.subscribe(() => {
        const controller = current.getSnapshot().controller;
        if (controller !== observed) { stopSelection?.(); observed = controller; stopSelection = controller?.subscribe(() => this.recovery.changed(viewKey)); }
        this.recovery.changed(viewKey);
      });
      this.recoverySubscriptions.set(viewKey, () => { stopBinding(); stopSelection?.(); });
    }
    return binding;
  }
  hasProtectedAttachments() { return [...this.attachmentBindings.values()].some(({ binding }) => binding.protection().length > 0); }
  /** Observe existing bindings only; this must not allocate a controller while closing. */
  getViewProtection(viewKey: string): readonly string[] {
    if (this.closed) return ["Connection state unavailable"];
    const binding = this.knowledgeBindings.get(viewKey), state = binding?.getSnapshot();
    return [
      ...this.recovery.protection(viewKey),
      ...(this.attachmentBindings.get(viewKey)?.binding.protection() ?? []),
      ...(state?.controller?.getSnapshot().selected.length ? ["Selected knowledge"] : []),
      ...(state?.projectId && !binding?.locked() ? ["Project selection"] : []),
      ...(this.steering.getSnapshot().some(entry => entry.identity.viewKey === viewKey) ? ["Steering draft or receipt"] : []),
    ];
  }
  /** App is the sole final-release authority. Protected bindings are never silently discarded. */
  closeMessageSettings() { this.settingsBindings.forEach(binding => binding.close()); }
  messageSettingsBinding(viewKey: string) {
    let binding = this.settingsBindings.get(viewKey);
    if (!binding) { binding = new ConversationMessageSettings(viewKey, this, () => this.actions.messageSettings); this.settingsBindings.set(viewKey, binding); }
    return binding;
  }
  releaseView(viewKey: string) {
    if (this.getViewProtection(viewKey).length) throw Error("This view still owns local material.");
    const binding = this.knowledgeBindings.get(viewKey);
    this.recoverySubscriptions.get(viewKey)?.(); this.recoverySubscriptions.delete(viewKey);
    this.knowledgeBindings.delete(viewKey); binding?.dispose();
    this.attachmentBindings.get(viewKey)?.stop(); this.attachmentBindings.delete(viewKey);
    this.steering.closeView(viewKey);
    this.recovery.release(viewKey);
    this.settingsBindings.get(viewKey)?.dispose(); this.settingsBindings.delete(viewKey);
  }
  canReadKnowledge(identity: KnowledgeIdentity, context: ResourceContext, knowledge: boolean) {
    const binding = this.knowledgeBindings.get(identity.viewKey);
    const source = binding?.projection.getSnapshot();
    return !this.closed && identity.connectionId === this.id && !!binding && this.validContext(context)
      && this.actions.knowledge?.current(identity) === true && this.host.checkView(KNOWLEDGE_PANEL, context).ok
      && this.host.list().find(plugin => plugin.id === KNOWLEDGE_OWNER)?.state === "active"
      && this.authorizeResource(knowledge ? "knowledge.read" : "workspace.read", context)
      && (!knowledge || (!!identity.projectId && source?.snapshot?.capabilities.knowledgeContext === true));
  }
  private async readKnowledge<T>(identity: KnowledgeIdentity, context: ResourceContext, signal: AbortSignal, knowledge: boolean, operation: (readers: KnowledgeReaders, signal: AbortSignal) => Promise<T>): Promise<T> {
    signal = AbortSignal.any([signal, this.signal]);
    const current = () => { const binding = this.knowledgeBindings.get(identity.viewKey), state = binding?.getSnapshot(); return !signal.aborted && this.canReadKnowledge(identity, context, knowledge) && state?.open && state.visible && binding?.projection.getSnapshot().connection === "live"; };
    if (!current() || !this.actions.knowledge) throw Error("Knowledge reading is unavailable in this view.");
    const result = await operation(this.actions.knowledge, signal);
    if (!current()) throw Error("Knowledge reading belongs to an expired view.");
    return result;
  }
  readKnowledgeProjects(identity: KnowledgeIdentity, context: ResourceContext, after: string | null, signal: AbortSignal) { return this.readKnowledge(identity, context, signal, false, (readers, bound) => readers.projects(identity, after, bound)); }
  readKnowledgeSearch(identity: KnowledgeIdentity, context: ResourceContext, query: { q: string; limit: number }, signal: AbortSignal) { return this.readKnowledge(identity, context, signal, true, (readers, bound) => readers.search(identity, query, bound)); }
  readKnowledgeBody(identity: KnowledgeIdentity, context: ResourceContext, citation: FrozenCitation, signal: AbortSignal) { return this.readKnowledge(identity, context, signal, true, (readers, bound) => readers.resolve(identity, citation, bound)); }
  canReadActivity(identity: ActivityIdentity) {
    return !this.closed && identity.connectionId === this.id && this.actions.hasDraft(identity.viewId)
      && this.validContext({ kind: "message", taskId: identity.taskId, messageId: identity.messageId, role: "user" });
  }
  readActivity(kind: "events", identity: ActivityIdentity, value: number): Promise<EventPage>;
  readActivity(kind: "detail", identity: ActivityIdentity, value: string, signal: AbortSignal): Promise<Detail>;
  readActivity(kind: "nativePage", identity: ActivityIdentity, value: string | null, signal: AbortSignal): Promise<NativeActivityPage>;
  readActivity(kind: "nativeBody", identity: ActivityIdentity, value: string, signal: AbortSignal): Promise<NativeActivity>;
  async readActivity(kind: keyof ActivityReaders, identity: ActivityIdentity, value: string | number | null, signal = this.signal): Promise<EventPage | Detail | NativeActivityPage | NativeActivity> {
    const context: ResourceContext = { kind: "message", taskId: identity.taskId, messageId: identity.messageId, role: "user" };
    signal = AbortSignal.any([signal, this.signal]);
    const permitted = () => this.canReadActivity(identity) && this.host.checkView(ACTIVITY_PANEL, context).ok && !signal.aborted
      && this.authorizeResource("task.activity.read", context)
      && ((kind !== "detail" && kind !== "nativeBody") || this.authorizeResource("reference.read", context));
    if (!permitted() || !this.actions.activity) throw Error("Activity reading is not authorized in this view.");
    // Only the already-authorized builtin receives these host-owned reads; declaration is not a grant.
    const plugin = this.host.list().find(plugin => plugin.id === ACTIVITY_OWNER);
    if (plugin?.state !== "active") throw Error("Activity extension is not active.");
    const readers = this.actions.activity;
    const result = kind === "events" ? await readers.events(identity, value as number)
      : kind === "detail" ? await readers.detail(identity, value as string, signal)
      : kind === "nativePage" ? await readers.nativePage(identity, value as string | null, signal)
      : await readers.nativeBody(identity, value as string, signal);
    if (!permitted()) throw Error("Activity read belongs to an expired view.");
    return result;
  }
  canReadStream(identity: StreamIdentity) {
    const context: ResourceContext = { kind: "message", taskId: identity.taskId, messageId: identity.messageId, role: "user" };
    return !this.closed && identity.connectionId === this.id && this.actions.hasDraft(identity.viewId)
      && this.validContext(context) && this.host.checkView(STREAM_PANEL, context).ok
      && this.authorizeResource("task.assistant-stream.read", context);
  }
  streamAuthority(): StreamAuthority {
    const read = async <T,>(identity: StreamIdentity, signal: AbortSignal, operation: (readers: StreamReaders, signal: AbortSignal) => Promise<T>) => {
      signal = AbortSignal.any([signal, this.signal]);
      if (signal.aborted || !this.canReadStream(identity) || !this.actions.stream) throw Error("Assistant stream is not authorized in this view.");
      const value = await operation(this.actions.stream, signal);
      if (signal.aborted || !this.canReadStream(identity)) throw Error("Assistant stream belongs to an expired view.");
      return value;
    };
    return { id: this.id, signal: this.signal, allowed: identity => this.canReadStream(identity), subscribe: this.host.subscribe,
      metadata: (identity, options, signal) => read(identity, signal, (readers, signal) => readers.metadata(identity, options, signal)),
      patches: (identity, options, signal) => read(identity, signal, (readers, signal) => readers.patches(identity, options, signal)) };
  }
  ownsStreamMessage(taskId: string, messageId: string, role: "user" | "assistant") { return !this.closed && this.streamBudget.ownsMessage(taskId, messageId, role); }
  canReadReply(viewId: string, taskId: string, messageId: string) {
    return !this.closed && this.actions.hasDraft(viewId) && this.validContext({ kind: "message", taskId, messageId, role: "assistant" });
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
    if (context.kind === "conversation" || context.kind === "pane") return this.actions.layout?.allows(context) === true;
    if (context.kind === "composer") return context.isDraft && this.actions.hasDraft(context.viewId);
    if (context.kind === "workspace" && context.taskId === null) return true;
    if (!context.taskId || !this.actions.knowsTask(context.taskId)) return false;
    if (context.kind === "message") {
      if (this.actions.ownsMessage?.(context.taskId, context.messageId, context.role)) return true;
      const task = this.actions.task(context.taskId);
      return context.role === "user" ? context.messageId === `prompt-${task?.id}` : Boolean(task?.entries.some(entry => entry.id === context.messageId));
    }
    if (context.kind === "reference") return Boolean(this.actions.task(context.taskId)?.entries.some(entry => entry.kind === "reference" && entry.reference.id === context.referenceId));
    return true;
  }
  dispose = async () => {
    if (this.closed) return;
    this.closed = true;
    this.syncCenterRuntime();
    this.lifetime.abort();
    this.settingsBindings.forEach(binding => binding.dispose()); this.settingsBindings.clear();
    this.steering.dispose();
    this.recovery.dispose();
    this.recoverySubscriptions.forEach(stop => stop()); this.recoverySubscriptions.clear();
    this.attachmentBindings.forEach(value => value.stop()); this.attachmentBindings.clear();
    this.knowledgeBindings.forEach(binding => binding.dispose()); this.knowledgeBindings.clear();
    this.dataRenderers.dispose();
    // Clear the old connection's custom palette synchronously, before a new connection can render.
    const active = this.theme.getSnapshot();
    if (!themes.some(theme => theme.id === active.themeId)) {
      const fallback = themes.find(theme => theme.id === active.scheme)!;
      this.actions.setTheme(fallback);
      this.theme.set({ themeId: fallback.id, scheme: fallback.scheme, availableThemes: themes });
    }
    this.workspace.set(emptyDisplay);
    await this.host.dispose();
  };
}
