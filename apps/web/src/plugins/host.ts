import { isBuiltinTheme } from "../themes";
import type {
  Capability,
  CommandContext,
  CommandHandler,
  ContributionView,
  Disposable,
  HostCommandArgs,
  HostCommandId,
  HostPort,
  LayoutInvocation,
  OperationResult,
  PluginContext,
  PluginDefinition,
  PluginDiagnostic,
  PluginManifest,
  PluginRenderer,
  PluginState,
  PluginSummary,
  Readable,
  ResourceContext,
  SlotId,
  ThemeDefinition,
} from "./types";
import {
  assert,
  immutable,
  validateContext,
  validateManifest,
  validateSlot,
} from "./validation";

type Session = {
  controller: AbortController;
  owned: Set<Disposable>;
  commands: Map<string, CommandHandler>;
  renderers: Map<string, PluginRenderer>;
  pending?: Promise<OperationResult>;
};
type Entry = {
  manifest: PluginManifest;
  load: PluginDefinition["load"];
  state: PluginState;
  error?: string;
  session?: Session;
};
const bridgeCapabilities: Record<HostCommandId, Capability> = {
  "flow.conversation.open": "ui.navigate",
  "flow.view.close": "ui.navigate",
  "flow.layout.change": "ui.layout",
  "flow.chat.open": "ui.navigate",
  "flow.workspace.open": "ui.layout",
  "flow.workspace.close": "ui.layout",
  "flow.reference.load": "reference.read",
  "flow.theme.set": "theme.write",
  "flow.composer.insertText": "composer.write",
  "flow.clipboard.copy": "clipboard.write",
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const empty: readonly ContributionView[] = Object.freeze([]);
const success: OperationResult<void> = Object.freeze({ ok: true });

/** Trusted, same-realm host. The App remains the authority for resource membership. */
export class PluginHost {
  private entries = new Map<string, Entry>();
  private ids = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private diagnosticListeners = new Set<() => void>();
  private slotListeners = new Map<SlotId, Set<() => void>>();
  private snapshot: readonly PluginSummary[] = Object.freeze([]);
  private slotSnapshots = new Map<SlotId, readonly ContributionView[]>();
  private diagnostics: readonly PluginDiagnostic[] = Object.freeze([]);
  private disposed = false;
  constructor(private readonly port: HostPort) {}
  list = () => this.snapshot;
  getDiagnostics = () => this.diagnostics;
  subscribeDiagnostics = (listener: () => void) => {
    if (!this.disposed) this.diagnosticListeners.add(listener);
    return () => { this.diagnosticListeners.delete(listener); };
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSlotSnapshot = (slot: SlotId) => this.slotSnapshots.get(slot) ?? empty;
  subscribeSlot = (slot: SlotId, listener: () => void) => {
    const set = this.slotListeners.get(slot) ?? new Set();
    this.slotListeners.set(slot, set);
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };

  register(definition: PluginDefinition): Disposable {
    assert(!this.disposed, "Host is disposed");
    const manifest = validateManifest(definition.manifest);
    assert(
      typeof definition.load === "function",
      "Plugin requires a trusted load entry",
    );
    assert(
      !this.entries.has(manifest.id),
      `Plugin already registered: ${manifest.id}`,
    );
    const declared = [...manifest.commands, ...manifest.contributions];
    for (const declaration of declared)
      assert(
        !this.ids.has(declaration.id),
        `ID already registered: ${declaration.id}`,
      );
    const entry: Entry = {
      manifest,
      load: definition.load,
      state: "registered",
    };
    this.entries.set(manifest.id, entry);
    for (const declaration of declared) this.ids.set(declaration.id, entry);
    this.publish(entry);
    let removed = false;
    return {
      dispose: () => {
        if (removed) return;
        removed = true;
        this.stop(entry);
        this.entries.delete(manifest.id);
        for (const declaration of declared) this.ids.delete(declaration.id);
        this.publish(entry);
        void this.fallbackTheme(entry);
      },
    };
  }

  activate = async (pluginId: string): Promise<OperationResult> => {
    const entry = this.entries.get(pluginId);
    if (this.disposed || !entry)
      return { ok: false, error: "Plugin host or registration is unavailable" };
    if (entry.state === "active") return success;
    if (entry.session?.pending) return entry.session.pending;
    const session: Session = {
      controller: new AbortController(),
      owned: new Set(),
      commands: new Map(),
      renderers: new Map(),
    };
    entry.session = session;
    entry.state = "activating";
    delete entry.error;
    this.publish(entry);
    const pending = this.load(entry, session);
    session.pending = pending;
    return pending;
  };
  private async load(entry: Entry, session: Session): Promise<OperationResult> {
    try {
      const module = await entry.load(session.controller.signal);
      this.current(entry, session);
      const cleanup = await module.activate(this.context(entry, session));
      if (cleanup) this.own(entry, session, cleanup);
      this.current(entry, session);
      for (const command of entry.manifest.commands)
        assert(
          session.commands.has(command.id),
          `Missing command implementation: ${command.id}`,
        );
      for (const contribution of entry.manifest.contributions)
        if (contribution.kind === "panel")
          assert(
            session.renderers.has(contribution.id),
            `Missing panel implementation: ${contribution.id}`,
          );
      entry.state = "active";
      session.pending = undefined;
      this.publish(entry);
      return success;
    } catch (error) {
      const message = errorText(error);
      if (entry.session === session) {
        this.stop(entry);
        entry.state = "failed";
        entry.error = message;
        this.record(entry, "activate", message);
        this.publish(entry);
      }
      return { ok: false, error: message };
    }
  }
  deactivate = async (pluginId: string): Promise<OperationResult> => {
    const entry = this.entries.get(pluginId);
    if (!entry) return { ok: false, error: "Plugin is not registered" };
    this.stop(entry);
    this.publish(entry);
    return this.fallbackTheme(entry);
  };
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.diagnosticListeners.clear();
    const entries = [...this.entries.values()];
    for (const entry of entries) this.stop(entry);
    for (const entry of entries) this.publish(entry);
    await Promise.all(entries.map((entry) => this.fallbackTheme(entry)));
    this.listeners.clear();
    this.slotListeners.clear();
  }
  private stop(entry: Entry) {
    const session = entry.session;
    entry.session = undefined;
    entry.state = "disabled";
    if (!session) return;
    session.controller.abort();
    for (const disposable of [...session.owned].reverse()) disposable.dispose();
    session.commands.clear();
    session.renderers.clear();
  }
  private current(entry: Entry, session: Session) {
    assert(
      !this.disposed &&
        entry.session === session &&
        !session.controller.signal.aborted,
      "Plugin generation is no longer active",
    );
  }
  private own(
    entry: Entry,
    session: Session,
    resource: Disposable,
  ): Disposable {
    assert(
      resource && typeof resource.dispose === "function",
      "Invalid disposable",
    );
    let disposed = false;
    const wrapper = {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        session.owned.delete(wrapper);
        try {
          resource.dispose();
        } catch (error) {
          this.record(entry, "dispose", errorText(error));
        }
      },
    };
    if (
      this.disposed ||
      entry.session !== session ||
      session.controller.signal.aborted
    ) {
      wrapper.dispose();
      throw new Error("Plugin generation is no longer active");
    }
    session.owned.add(wrapper);
    return wrapper;
  }
  private readable<T>(
    entry: Entry,
    session: Session,
    source: Readable<T>,
  ): Readable<T> {
    let previous: T;
    let copy: T;
    return Object.freeze({
      getSnapshot: () => {
        this.current(entry, session);
        const next = source.getSnapshot();
        if (next !== previous) {
          previous = next;
          copy = immutable(structuredClone(next));
        }
        return copy;
      },
      subscribe: (listener: () => void) => {
        this.current(entry, session);
        const unsubscribe = source.subscribe(() => {
          if (entry.session !== session || session.controller.signal.aborted)
            return;
          try {
            // A plugin subscriber must not interrupt the App store's fan-out.
            Promise.resolve(listener()).catch((error) =>
              this.record(entry, "subscription", errorText(error)),
            );
          } catch (error) {
            this.record(entry, "subscription", errorText(error));
          }
        });
        const disposable = this.own(entry, session, { dispose: unsubscribe });
        return () => disposable.dispose();
      },
    });
  }
  private context(entry: Entry, session: Session): PluginContext {
    return Object.freeze({
      signal: session.controller.signal,
      navigation: this.readable(entry, session, this.port.navigation),
      theme: this.readable(entry, session, this.port.theme),
      own: (resource: Disposable) => this.own(entry, session, resource),
      command: <T>(id: string, handler: CommandHandler<T>) => {
        this.current(entry, session);
        assert(
          entry.manifest.commands.some((command) => command.id === id),
          "Command was not declared",
        );
        assert(!session.commands.has(id), "Command already implemented");
        assert(
          typeof handler.parse === "function" &&
            typeof handler.run === "function",
          "Invalid command implementation",
        );
        session.commands.set(id, handler as CommandHandler);
        return this.own(entry, session, {
          dispose: () => session.commands.delete(id),
        });
      },
      contribute: (id: string, renderer: PluginRenderer) => {
        this.current(entry, session);
        assert(
          entry.manifest.contributions.some(
            (item) => item.id === id && item.kind === "panel",
          ),
          "Panel was not declared",
        );
        assert(!session.renderers.has(id), "Panel already implemented");
        session.renderers.set(id, renderer);
        return this.own(entry, session, {
          dispose: () => session.renderers.delete(id),
        });
      },
    });
  }

  execute = async (
    commandId: string,
    args?: unknown,
    invocation?: ResourceContext,
  ): Promise<OperationResult> => {
    const entry = this.ids.get(commandId);
    if (this.disposed || !entry || entry.state === "disabled")
      return { ok: false, error: "Command is unavailable" };
    try {
      const declaration = entry.manifest.commands.find(
        (command) => command.id === commandId,
      );
      assert(declaration, "Command is not declared");
      const resource = validateContext(invocation ?? this.port.getContext());
      assert(
        declaration.contexts.includes(resource.kind),
        "Command does not accept this context",
      );
      this.authorize(entry, declaration.capability, resource);
      const layoutInvocation = resource.kind === "pane" || resource.kind === "conversation"
        ? this.port.captureLayoutInvocation?.(resource) : undefined;
      assert((resource.kind !== "pane" && resource.kind !== "conversation") || layoutInvocation, "Layout invocation authority is unavailable");
      layoutInvocation?.check();
      if (entry.state !== "active") {
        assert(
          entry.manifest.activationEvents.includes(`command:${commandId}`),
          "Command has no activation event",
        );
        const result = await this.activate(entry.manifest.id);
        assert(result.ok, result.ok ? "" : result.error);
      }
      const session = entry.session;
      assert(session, "Command has no active session");
      this.current(entry, session);
      layoutInvocation?.check();
      this.authorize(entry, declaration.capability, resource);
      const handler = session.commands.get(commandId);
      assert(handler, "Command implementation is unavailable");
      const context: CommandContext = Object.freeze({
        signal: layoutInvocation ? AbortSignal.any([session.controller.signal, layoutInvocation.signal]) : session.controller.signal,
        resource,
        navigation: this.readable(entry, session, this.port.navigation),
        theme: this.readable(entry, session, this.port.theme),
        execute: <K extends HostCommandId>(
          command: K,
          parameters: HostCommandArgs[K],
        ) => this.bridge(entry, session, resource, command, parameters, layoutInvocation),
      });
      const value = await handler.run(handler.parse(args), context);
      this.current(entry, session);
      return { ok: true, value };
    } catch (error) {
      const message = errorText(error);
      this.record(entry, "command", message);
      return { ok: false, error: message };
    }
  };
  private authorize(
    entry: Entry,
    capability: Capability,
    context: ResourceContext,
  ) {
    assert(
      entry.manifest.capabilities.includes(capability),
      "Plugin did not declare required capability",
    );
    assert(
      this.port.authorize(entry.manifest.id, capability, context),
      `Permission denied: ${capability}`,
    );
  }
  private async bridge<K extends HostCommandId>(
    entry: Entry,
    session: Session,
    resource: ResourceContext,
    command: K,
    args: HostCommandArgs[K],
    layoutInvocation?: LayoutInvocation,
  ): Promise<void> {
    try {
      this.current(entry, session);
      layoutInvocation?.check();
      assert(
        Object.hasOwn(bridgeCapabilities, command),
        "Unknown host command",
      );
      this.authorize(entry, bridgeCapabilities[command], resource);
      const safe = immutable(structuredClone(args));
      this.validateBridge(command, safe, resource);
      let theme: ThemeDefinition | undefined;
      if (command === "flow.theme.set") {
        const id = (safe as HostCommandArgs["flow.theme.set"]).themeId;
        theme = this.getThemes().find((item) => item.id === id);
        assert(theme, "Theme is unavailable");
      }
      await this.port.execute(command, safe, {
        pluginId: entry.manifest.id,
        context: resource,
        signal: layoutInvocation ? AbortSignal.any([session.controller.signal, layoutInvocation.signal]) : session.controller.signal,
        ...(theme ? { theme } : {}),
      });
      this.current(entry, session);
    } catch (error) {
      throw new Error(errorText(error));
    }
  }
  private validateBridge(
    command: HostCommandId,
    args: HostCommandArgs[HostCommandId],
    context: ResourceContext,
  ) {
    assert(
      args && typeof args === "object" && !Array.isArray(args),
      "Command arguments must be an object",
    );
    const value = args as Record<string, unknown>;
    const exact = (keys: string[]) => assert(Object.keys(value).every(key => keys.includes(key)), "Unexpected layout command argument");
    const nonempty = (key: string) =>
      assert(
        typeof value[key] === "string" &&
          (value[key] as string).trim().length > 0,
        `Invalid ${key}`,
      );
    if (command === "flow.chat.open") nonempty("taskId");
    if (command === "flow.conversation.open") {
      exact(["conversationId"]); nonempty("conversationId");
      assert(context.kind === "conversation" && context.conversationId === value.conversationId, "Conversation does not match invocation");
    }
    if (command === "flow.view.close") {
      exact(["viewKey"]); nonempty("viewKey");
      assert(context.kind === "pane" && context.viewKey === value.viewKey, "View does not match invocation");
    }
    if (command === "flow.layout.change") {
      exact(["paneId", "change"]); nonempty("paneId");
      assert(context.kind === "pane" && context.paneId === value.paneId, "Pane does not match invocation");
      assert(value.change && typeof value.change === "object" && !Array.isArray(value.change), "Invalid layout change");
      const change = value.change as Record<string, unknown>;
      assert(["split", "merge", "swap", "resize"].includes(change.kind as string), "Unknown layout change");
      const fields = change.kind === "swap" ? ["kind", "direction"] : change.kind === "resize" ? ["kind", "share"] : ["kind"];
      assert(Object.keys(change).every(key => fields.includes(key)), "Unexpected layout change field");
      if (change.kind === "swap") assert(change.direction === -1 || change.direction === 1, "Invalid pane direction");
      if (change.kind === "resize") assert(typeof change.share === "number" && Number.isFinite(change.share) && change.share >= .15 && change.share <= .85, "Pane share is outside its bounds");
    }
    if (
      command === "flow.workspace.open" ||
      command === "flow.reference.load"
    ) {
      nonempty("taskId");
      assert(
        "taskId" in context && context.taskId === value.taskId,
        "Resource task does not match invocation",
      );
      if (command === "flow.reference.load") {
        nonempty("referenceId");
        if (context.kind === "reference")
          assert(
            context.referenceId === value.referenceId,
            "Reference does not match invocation",
          );
      } else
        validateContext({
          kind: "workspace",
          taskId: value.taskId as string,
          tabId: value.tab as HostCommandArgs["flow.workspace.open"]["tab"],
        });
    }
    if (command === "flow.composer.insertText") {
      nonempty("viewId");
      assert(
        context.kind === "composer" && context.viewId === value.viewId,
        "Composer does not match invocation",
      );
      assert(typeof value.text === "string", "Invalid text");
    }
    if (command === "flow.clipboard.copy")
      assert(typeof value.text === "string", "Invalid text");
    if (command === "flow.theme.set") nonempty("themeId");
  }
  getThemes = (): readonly ThemeDefinition[] => {
    const core = this.port.theme
      .getSnapshot()
      .availableThemes.filter((theme) => isBuiltinTheme(theme.id));
    const contributed = [...this.entries.values()].flatMap((entry) =>
      entry.state === "active"
        ? entry.manifest.contributions.flatMap((item) =>
            item.kind === "theme" ? [item.theme] : [],
          )
        : [],
    );
    return immutable(structuredClone([...core, ...contributed]));
  };
  private async fallbackTheme(entry: Entry): Promise<OperationResult<void>> {
    const active = this.port.theme.getSnapshot();
    if (
      !entry.manifest.contributions.some(
        (item) => item.kind === "theme" && item.theme.id === active.themeId,
      )
    )
      return success;
    try {
      await this.port.execute(
        "flow.theme.set",
        { themeId: active.scheme },
        {
          pluginId: "flow.host",
          context: { kind: "global" },
          signal: new AbortController().signal,
        },
      );
      return success;
    } catch (error) {
      const message = errorText(error);
      this.record(entry, "dispose", message);
      return { ok: false, error: message };
    }
  }
  getRenderer(contributionId: string): PluginRenderer | undefined {
    const entry = this.ids.get(contributionId);
    return entry?.state === "active"
      ? entry.session?.renderers.get(contributionId)
      : undefined;
  }
  findContribution(contributionId: string): ContributionView | undefined {
    for (const snapshot of this.slotSnapshots.values()) {
      const item = snapshot.find(
        (item) => item.declaration.id === contributionId,
      );
      if (item) return item;
    }
    return undefined;
  }
  checkView(
    contributionId: string,
    context: ResourceContext,
  ): OperationResult<void> {
    try {
      const item = this.findContribution(contributionId);
      assert(item && item.declaration.kind === "panel", "Panel is unavailable");
      validateSlot(item.declaration.slot, context);
      const entry = this.entries.get(item.pluginId)!;
      assert(entry.state === "active", "Plugin is not active");
      this.authorize(entry, item.declaration.capability, context);
      return success;
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  }
  async show(
    contributionId: string,
    context: ResourceContext,
  ): Promise<OperationResult> {
    const item = this.findContribution(contributionId);
    if (!item || item.declaration.kind !== "panel")
      return { ok: false, error: "Panel is unavailable" };
    try {
      validateSlot(item.declaration.slot, context);
      const entry = this.entries.get(item.pluginId)!;
      assert(entry.state !== "disabled", "Plugin is disabled");
      this.authorize(entry, item.declaration.capability, context);
      if (entry.state !== "active")
        assert(
          entry.manifest.activationEvents.includes(
            `view:${item.declaration.slot}`,
          ),
          "Panel has no activation event",
        );
      const result = await this.activate(item.pluginId);
      if (result.ok)
        this.authorize(entry, item.declaration.capability, context);
      return result;
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  }
  bind(
    contributionId: string,
    context: ResourceContext,
  ): (commandId: string, args?: unknown) => Promise<OperationResult> {
    const entry = this.ids.get(contributionId);
    const session = entry?.session;
    const resource = validateContext(context);
    return (commandId, args) => {
      if (
        !entry ||
        !session ||
        entry.session !== session ||
        !entry.manifest.commands.some((command) => command.id === commandId)
      )
        return Promise.resolve({
          ok: false,
          error: "Plugin view is no longer active",
        });
      return this.execute(commandId, args, resource);
    };
  }
  reportRenderError(pluginId: string, error: unknown) {
    const entry = this.entries.get(pluginId);
    if (entry) this.record(entry, "render", errorText(error));
  }
  private record(
    entry: Entry,
    phase: PluginDiagnostic["phase"],
    message: string,
  ) {
    this.diagnostics = Object.freeze([
      ...this.diagnostics.slice(-99),
      Object.freeze({ pluginId: entry.manifest.id, phase, message }),
    ]);
    for (const listener of [...this.diagnosticListeners]) {
      if (!this.diagnosticListeners.has(listener)) continue;
      try {
        // A diagnostic observer must not replace the original error or record itself.
        Promise.resolve(listener()).catch(() => {});
      } catch { /* Keep notifying other diagnostic observers without recursion. */ }
    }
  }
  private publish(entry: Entry) {
    this.snapshot = immutable(
      [...this.entries.values()].map((item) => ({
        id: item.manifest.id,
        version: item.manifest.version,
        state: item.state,
        ...(item.error ? { error: item.error } : {}),
      })),
    );
    const changed = new Set(
      entry.manifest.contributions.flatMap((item) =>
        item.kind === "theme" ? [] : [item.slot],
      ),
    );
    for (const slot of changed) {
      const items = [...this.entries.values()].flatMap((item) =>
        item.state === "disabled"
          ? []
          : item.manifest.contributions.flatMap((declaration) =>
              declaration.kind !== "theme" && declaration.slot === slot
                ? [
                    {
                      pluginId: item.manifest.id,
                      declaration,
                      state: item.state,
                      ...(item.error ? { error: item.error } : {}),
                    },
                  ]
                : [],
            ),
      );
      this.slotSnapshots.set(slot, immutable(items));
      for (const listener of this.slotListeners.get(slot) ?? []) listener();
    }
    for (const listener of this.listeners) listener();
  }
}
