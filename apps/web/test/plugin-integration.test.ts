import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationProjection } from "../src/conversations/projection";
import { FlowClient } from "@flow/client";
import type { TaskSnapshot, BrowserSessionReady } from "@flow/contracts";
import { ConnectionSession } from "../src/connection/session";
import { namespaceKey } from "../src/recovery/journal";
import type { PluginRuntimeCommand } from "../../../packages/contracts/src/plugin-runtime";
import { messageSettingsDraft } from "../src/plugin-integration/message-settings";
import { AppPluginSession, type AppActions, type CenterRuntimePort } from "../src/plugin-integration/session";
import { themes } from "../src/themes";
import type { PluginDefinition } from "../src/plugins/types";
import { AppLayoutPort, type LayoutActions } from "../src/plugin-integration/layout";
import { addWorkspace, emptyLayout, selectLayoutView } from "../src/workspace-state";

function task(id: string): TaskSnapshot {
  const now = "2026-10-06T03:00:00Z";
  return { id, title: id, prompt: "Task prompt", harness: "fixture", status: "succeeded", verificationStatus: "passed", createdAt: now, updatedAt: now, watermark: 2, hasMore: false, attempt: null, pendingDecision: null,
    usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true },
    entries: [{ id: `${id}-text`, kind: "text", text: `Output ${id}`, cursor: 1, createdAt: now }, { id: `${id}-ref`, kind: "reference", reference: { id: "shared-ref", title: `Artifact ${id}` }, cursor: 2, createdAt: now }] };
}
const sessions: AppPluginSession[] = [];
afterEach(async () => { await Promise.all(sessions.splice(0).map(session => session.dispose())); });
function setup() {
  const tasks = new Map(["A", "B"].map(id => [id, task(id)]));
  const actions: AppActions = { knowsTask: id => tasks.has(id), task: id => tasks.get(id) ?? null, hasDraft: id => id === "draft-one", openTask: vi.fn(), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), loadReference: vi.fn(async () => {}), setTheme: vi.fn(), copy: vi.fn(async () => {}) };
  const session = new AppPluginSession(actions, themes[0]!); sessions.push(session);
  session.publishNavigation({ activeTaskId: "A", workspaceTab: "files", workspaceOpen: true }, { kind: "task", taskId: "A" });
  return { session, actions, tasks };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

function layoutSetup() {
  const base = setup(), port = new AppLayoutPort();
  let layout = selectLayoutView(emptyLayout(), "main", "conversation:A"), authority: string | null = "principal:g1", visible = true, viewKey = "view-A";
  const actions: LayoutActions = { authorityKey: () => authority, layout: () => layout, panesVisible: () => visible,
    viewKey: () => viewKey, knowsConversation: id => ["A", "B"].includes(id),
    openConversation: vi.fn(), closeView: vi.fn(), changePane: vi.fn() };
  const configure = () => port.configure(actions);
  configure(); base.actions.layout = port; base.session.updateActions(base.actions);
  const context = { kind: "pane", workspaceId: "workspace-main", paneId: "main", viewKey: "view-A" } as const;
  return { ...base, port, layoutActions: actions, context, configure,
    hide: () => { visible = false; configure(); }, show: () => { visible = true; configure(); },
    generation: (value: string | null) => { authority = value; configure(); },
    replaceView: (key: string) => { viewKey = key; configure(); },
    awayAndBack: () => { const original = layout; layout = addWorkspace(layout, "other"); configure(); layout = original; configure(); },
  };
}

describe("Arc actual App layout command authority", () => {
  it("opens the original catalog B and changes its explicit pane without following global task selection", async () => {
    const s = layoutSetup();
    expect((await s.session.host.execute("sample.notes.open", undefined, { kind: "conversation", conversationId: "B" })).ok).toBe(true);
    expect(s.layoutActions.openConversation).toHaveBeenCalledWith("B"); expect(s.actions.openTask).not.toHaveBeenCalled();
    expect((await s.session.host.execute("sample.notes.split", undefined, s.context)).ok).toBe(true);
    expect(s.layoutActions.changePane).toHaveBeenCalledWith(s.context, { kind: "split" });
    expect(s.session.navigation.getSnapshot().activeTaskId).toBe("A");
  });
  it("rejects delayed activation after A to B to A and close to reopen even when public route IDs match", async () => {
    for (const change of ["workspace", "view"] as const) {
      const s = layoutSetup(), gate = deferred<void>();
      s.session.host.register({ manifest: { id: "arc.delayed", version: "1.0.0", hostApi: 1, capabilities: ["ui.layout"],
        activationEvents: ["command:arc.delayed.resize"], contributions: [],
        commands: [{ id: "arc.delayed.resize", title: "Resize", capability: "ui.layout", contexts: ["pane"] }] },
        load: async () => { await gate.promise; return { activate(context) { context.command("arc.delayed.resize", { parse: () => undefined,
          run: (_, command) => command.execute("flow.layout.change", { paneId: "main", change: { kind: "resize", share: .6 } }) }); } }; } });
      const result = s.session.host.execute("arc.delayed.resize", undefined, s.context);
      if (change === "workspace") s.awayAndBack(); else { s.replaceView("replacement"); s.replaceView("view-A"); }
      gate.resolve(); expect((await result).ok).toBe(false); expect(s.layoutActions.changePane).not.toHaveBeenCalled();
    }
  });
  it("propagates hide and live authentication revocation through an already running command", async () => {
    for (const revoke of ["hide", "auth"] as const) {
      const s = layoutSetup(), entered = deferred<void>(), gate = deferred<void>(); let signal: AbortSignal | undefined;
      s.session.host.register({ manifest: { id: "arc.pending", version: "1.0.0", hostApi: 1, capabilities: ["ui.navigate"],
        activationEvents: ["command:arc.pending.close"], contributions: [],
        commands: [{ id: "arc.pending.close", title: "Close", capability: "ui.navigate", contexts: ["pane"] }] },
        load: async () => ({ activate(context) { context.command("arc.pending.close", { parse: () => undefined, run: async (_, command) => {
          signal = command.signal; entered.resolve(); await gate.promise; await command.execute("flow.view.close", { viewKey: "view-A" });
        } }); } }) });
      const result = s.session.host.execute("arc.pending.close", undefined, s.context); await entered.promise;
      if (revoke === "hide") { s.hide(); s.show(); } else { s.generation(null); s.generation("principal:g2"); }
      expect(signal?.aborted).toBe(true); gate.resolve(); expect((await result).ok).toBe(false);
      expect(s.layoutActions.closeView).not.toHaveBeenCalled();
      expect((await s.session.host.execute("sample.notes.close-view", undefined, s.context)).ok).toBe(true);
      expect(s.layoutActions.closeView).toHaveBeenCalledTimes(1);
    }
  });
  it("suspends an unmounted private port and accepts only a newly captured lease after remount", () => {
    const s = layoutSetup(), lease = s.port.capture(s.context);
    s.port.suspend(); expect(() => lease.check()).toThrow("expired"); s.configure();
    expect(() => lease.check()).toThrow("expired"); expect(() => s.port.capture(s.context).check()).not.toThrow();
    s.port.dispose(); expect(s.port.allows(s.context)).toBe(false);
  });
  it("keeps a protected close in preparation until confirmation, and revokes old confirmations without rotating the draft", async () => {
    for (const revoke of ["plugin", "layout", "auth"] as const) {
      const s = layoutSetup();
      expect((await s.session.host.execute("sample.notes.close-view", undefined, s.context)).ok).toBe(true);
      const prepared = vi.mocked(s.layoutActions.closeView).mock.calls[0]![1];
      expect(() => prepared.check()).not.toThrow();
      if (revoke === "plugin") { await s.session.host.deactivate("sample.notes"); await s.session.host.activate("sample.notes"); }
      else if (revoke === "layout") s.awayAndBack();
      else { s.generation(null); s.generation("principal:g2"); }
      expect(() => prepared.commit()).toThrow();
      expect(s.actions.openTask).not.toHaveBeenCalled();
      expect((await s.session.host.execute("sample.notes.close-view", undefined, s.context)).ok).toBe(true);
      const fresh = vi.mocked(s.layoutActions.closeView).mock.calls[1]![1];
      expect(() => fresh.commit()).not.toThrow();
      expect(() => fresh.commit()).toThrow();
    }
  });
});

describe("App bridge resource and connection authority", () => {
  it("opens local sidebar B while global selection remains A and rejects unknown tasks", async () => {
    const { session, actions } = setup();
    expect((await session.host.execute("sample.notes.open", undefined, { kind: "task", taskId: "B" })).ok).toBe(true);
    expect(actions.openTask).toHaveBeenCalledWith("B");
    expect(session.navigation.getSnapshot().activeTaskId).toBe("A");
    expect((await session.host.execute("sample.notes.open", undefined, { kind: "task", taskId: "unknown" })).ok).toBe(false);
    expect(actions.openTask).toHaveBeenCalledTimes(1);
  });
  it("checks actual message identity and role, not only active task", async () => {
    const { session, actions } = setup();
    expect((await session.host.execute("flow.task-actions.output", undefined, { kind: "message", taskId: "B", messageId: "B-text", role: "assistant" })).ok).toBe(true);
    expect(actions.openWorkspace).toHaveBeenCalledWith("B", "terminal");
    for (const context of [{ kind: "message", taskId: "A", messageId: "B-text", role: "assistant" }, { kind: "message", taskId: "A", messageId: "A-text", role: "user" }] as const)
      expect((await session.host.execute("flow.task-actions.output", undefined, context)).ok).toBe(false);
    expect(actions.openWorkspace).toHaveBeenCalledTimes(1);
  });
  it("loads an owned reference only on explicit command and propagates errors", async () => {
    const { session, actions } = setup();
    expect(actions.loadReference).not.toHaveBeenCalled();
    expect((await session.host.execute("flow.task-actions.reference", undefined, { kind: "reference", taskId: "B", referenceId: "missing" })).ok).toBe(false);
    expect(actions.loadReference).not.toHaveBeenCalled();
    vi.mocked(actions.loadReference).mockRejectedValueOnce(Error("Center detail unavailable"));
    const result = await session.host.execute("flow.task-actions.reference", undefined, { kind: "reference", taskId: "B", referenceId: "shared-ref" });
    expect(result).toEqual({ ok: false, error: "Center detail unavailable" });
    expect(actions.loadReference).toHaveBeenCalledWith("B", "shared-ref");
  });
  it("reports unsupported composer without modifying draft or reporting success", async () => {
    const { session, actions } = setup();
    const result = await session.host.execute("sample.notes.insert", undefined, { kind: "composer", viewId: "draft-one", isDraft: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not supported");
    expect(actions.openTask).not.toHaveBeenCalled();
    expect((await session.host.execute("sample.notes.insert", undefined, { kind: "composer", viewId: "unknown", isDraft: true })).ok).toBe(false);
  });
  it("uses validated theme descriptor and disable removes custom palette", async () => {
    const { session, actions } = setup();
    expect((await session.host.execute("sample.notes.theme", undefined, { kind: "global" })).ok).toBe(true);
    expect(actions.setTheme).toHaveBeenLastCalledWith(expect.objectContaining({ id: "sample.notes.ocean", tokens: expect.objectContaining({ background: "#132129" }) }));
    expect(session.theme.getSnapshot().themeId).toBe("sample.notes.ocean");
    await session.host.deactivate("sample.notes");
    expect(actions.setTheme).toHaveBeenLastCalledWith(themes[1]);
    expect(session.theme.getSnapshot().themeId).toBe("dark");
  });
  it("keeps snapshots stable and navigation changes do not notify theme listeners", () => {
    const { session } = setup(); const navigation = vi.fn(); const theme = vi.fn();
    session.navigation.subscribe(navigation); session.theme.subscribe(theme);
    const before = session.navigation.getSnapshot();
    session.publishNavigation({ ...before }, { kind: "task", taskId: "A" });
    expect(session.navigation.getSnapshot()).toBe(before); expect(navigation).not.toHaveBeenCalled();
    session.publishNavigation({ ...before, activeTaskId: "B" }, { kind: "task", taskId: "B" });
    expect(navigation).toHaveBeenCalledTimes(1); expect(theme).not.toHaveBeenCalled();
  });
  it("old bound command cannot act on a new connection with identical IDs", async () => {
    const old = setup(); await old.session.host.activate("sample.notes");
    const command = old.session.host.bind("sample.notes.open-button", { kind: "task", taskId: "A" });
    await old.session.dispose(); const next = setup();
    old.session.updateActions(next.actions);
    expect((await command("sample.notes.open")).ok).toBe(false);
    expect(old.actions.openTask).not.toHaveBeenCalled(); expect(next.actions.openTask).not.toHaveBeenCalled();
    expect(next.session.id).not.toBe(old.session.id);
  });
  it("late activation cannot cross a disposed connection", async () => {
    const { session, actions } = setup(); const gate = deferred<void>();
    const plugin: PluginDefinition = { manifest: { id: "test.delayed", version: "1.0.0", hostApi: 1, capabilities: ["ui.navigate"], activationEvents: ["command:test.delayed.open"], commands: [{ id: "test.delayed.open", title: "Open", capability: "ui.navigate", contexts: ["task"] }], contributions: [] }, load: async () => { await gate.promise; return { activate(context) { context.command("test.delayed.open", { parse: () => undefined, run: (_, command) => command.execute("flow.chat.open", { taskId: "A" }) }); } }; } };
    session.host.register(plugin); const pending = session.host.execute("test.delayed.open", undefined, { kind: "task", taskId: "A" });
    await session.dispose(); gate.resolve(); expect((await pending).ok).toBe(false); expect(actions.openTask).not.toHaveBeenCalled();
  });
  it("in-flight reference result after disposal remains failure and cannot reuse new actions", async () => {
    const old = setup(); const gate = deferred<void>(); vi.mocked(old.actions.loadReference).mockReturnValue(gate.promise);
    const pending = old.session.host.execute("flow.task-actions.reference", undefined, { kind: "reference", taskId: "A", referenceId: "shared-ref" });
    await vi.waitFor(() => expect(old.actions.loadReference).toHaveBeenCalledTimes(1));
    await old.session.dispose(); const next = setup(); old.session.updateActions(next.actions); gate.resolve();
    expect((await pending).ok).toBe(false); expect(next.actions.loadReference).not.toHaveBeenCalled();
  });
});


describe("retained view bindings", () => {
  it("protection queries do not allocate and final release unsubscribes the existing knowledge binding", () => {
    const { session } = setup();
    const projection = new ConversationProjection(new FlowClient({ baseUrl: "http://unused.invalid", token: "fixture" }), null);
    const unsubscribe = vi.fn(), hostUnsubscribe = vi.fn();
    const sourceSubscribe = projection.subscribe.bind(projection), hostSubscribe = session.host.subscribe.bind(session.host);
    const subscribe = vi.spyOn(projection, "subscribe").mockImplementation(listener => { const stop = sourceSubscribe(listener); return () => { stop(); unsubscribe(); }; });
    const hostSpy = vi.spyOn(session.host, "subscribe").mockImplementation(listener => { const stop = hostSubscribe(listener); return () => { stop(); hostUnsubscribe(); }; });
    try {
      expect(session.getViewProtection("view")).toEqual([]);
      expect(session.getViewProtection("view")).toEqual([]);
      expect(subscribe).not.toHaveBeenCalled(); expect(hostSpy).not.toHaveBeenCalled();
      const first = session.knowledgeBinding("view", projection);
      expect(subscribe).toHaveBeenCalledTimes(1);
      session.releaseView("view");
      expect(unsubscribe).toHaveBeenCalledTimes(1); expect(hostUnsubscribe).toHaveBeenCalledTimes(1);
      const next = session.knowledgeBinding("view", projection);
      expect(next).not.toBe(first); expect(subscribe).toHaveBeenCalledTimes(2);
      session.releaseView("view"); expect(unsubscribe).toHaveBeenCalledTimes(2);
      session.releaseView("view"); expect(unsubscribe).toHaveBeenCalledTimes(2); expect(hostUnsubscribe).toHaveBeenCalledTimes(2);
    } finally { projection.dispose(); }
  });
});


const connections: ConnectionSession[] = [];
afterEach(() => { connections.splice(0).forEach(connection => connection.dispose()); vi.restoreAllMocks(); });
const runtimeId = "00000000-0000-4000-8000-000000000001";
const runtimeCommand: PluginRuntimeCommand = { expectedRevision: 3, reason: "Stop new bindings", change: { kind: "disable" } };
async function runtimeSetup() {
  let ready: BrowserSessionReady = { protocol: "flow.browser-session.v1", state: "ready", centerId: runtimeId,
    ownerPrincipalId: "00000000-0000-4000-8000-000000000002", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), csrfToken: "a".repeat(64) };
  const connection = new ConnectionSession("http://127.0.0.1:1", () => ({
    browserSession: async () => ready, connectBrowserSession: async () => ready,
    logoutBrowserSession: async () => ({ protocol: "flow.browser-session.v1", state: "unauthenticated" }),
  }));
  connections.push(connection); await connection.read();
  const namespace = connection.getSnapshot().identity!;
  const client = new FlowClient({ baseUrl: namespace.baseUrl, browserSession: { csrfToken: connection.csrfToken } });
  const writer = { commandPluginRuntime: vi.fn<FlowClient["commandPluginRuntime"]>() };
  let active = true;
  const port: CenterRuntimePort = { reader: client, writer, subscribe: connection.subscribe,
    authorityKey: () => active && connection.authorized(namespace) ? JSON.stringify([namespaceKey(namespace), connection.getSnapshot().generation]) : null };
  const { session, actions } = setup();
  session.updateActions({ ...actions, centerRuntime: port });
  return { session, actions, port, writer, connection, client,
    changeReady: (patch: Partial<BrowserSessionReady>) => { ready = { ...ready, ...patch }; },
    setActive(value: boolean) { active = value; session.updateActions({ ...actions, centerRuntime: port }); } };
}

describe("App session center runtime authority", () => {
  it("retains UNKNOWN and exact key/body through observer unmount, local extension changes and unchanged session reads", async () => {
    const current = await runtimeSetup(); const binding = current.session.centerRuntime.getSnapshot()!;
    current.writer.commandPluginRuntime.mockRejectedValue(Error("controlled lost ACK"));
    await binding.commands.submit(runtimeId, runtimeCommand);
    const original = binding.commands.getSnapshot().command!;
    const stop = binding.commands.subscribe(() => {}); stop(); // Settings reading subtree closes.
    const draft = messageSettingsDraft(); const replace = vi.fn();
    const settings: NonNullable<AppActions["messageSettings"]> = { read: () => ({ draft, generation: 1, editable: true, context: { profile: null, capability: null } }),
      replace, profiles: vi.fn() };
    current.session.updateActions({ ...current.actions, centerRuntime: current.port, messageSettings: settings });
    const composer = current.session.messageSettingsBinding("draft-one"); composer.configure("draft-one", true);
    await current.session.host.activate("sample.notes"); await current.session.host.deactivate("sample.notes");
    await current.connection.read(); // Identical cookie authority does not create a new command lifetime.
    expect(current.session.centerRuntime.getSnapshot()).toBe(binding);
    expect(binding.commands.getSnapshot()).toMatchObject({ phase: "unknown", command: original });
    expect(composer.authority()?.draft).toBe(draft); expect(replace).not.toHaveBeenCalled();
    await binding.commands.retryOriginal(original);
    const calls = current.writer.commandPluginRuntime.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.map(call => [call[0], call[1], call[2]])).toEqual([[runtimeId, original.input, original.key], [runtimeId, original.input, original.key]]);
    expect(JSON.stringify(calls[1]![1])).toBe(original.body);
  });

  it("revokes immediately on live auth generation change before a React actions update and rejects late completion", async () => {
    const current = await runtimeSetup(); const old = current.session.centerRuntime.getSnapshot()!;
    const response = deferred<Awaited<ReturnType<FlowClient["commandPluginRuntime"]>>>();
    current.writer.commandPluginRuntime.mockReturnValue(response.promise);
    const pending = old.commands.submit(runtimeId, runtimeCommand);
    const signal = current.writer.commandPluginRuntime.mock.calls[0]![3]!;
    current.changeReady({ csrfToken: "b".repeat(64) }); await current.connection.read();
    expect(signal.aborted).toBe(true); expect(old.commands.getSnapshot().phase).toBe("revoked");
    const next = current.session.centerRuntime.getSnapshot()!;
    expect(next.sessionId).not.toBe(old.sessionId);
    // The controller only observes completion; this deliberately unvalidated value must never publish.
    response.resolve({} as Awaited<ReturnType<FlowClient["commandPluginRuntime"]>>); await pending;
    expect(old.commands.getSnapshot().phase).toBe("revoked"); expect(next.commands.getSnapshot().phase).toBe("idle");
    await old.commands.retryOriginal(old.commands.getSnapshot().command!);
    expect(current.writer.commandPluginRuntime).toHaveBeenCalledTimes(1);
  });

  it("refuses a different principal in the same center and rejects stale runtime reads", async () => {
    const current = await runtimeSetup(); const old = current.session.centerRuntime.getSnapshot()!;
    const result = deferred<Awaited<ReturnType<FlowClient["pluginRuntime"]>>>();
    vi.spyOn(current.client, "pluginRuntime").mockReturnValue(result.promise);
    const read = old.reader.pluginRuntime(runtimeId); const rejected = expect(read).rejects.toThrow("no longer authorized");
    current.changeReady({ ownerPrincipalId: "00000000-0000-4000-8000-000000000003" }); await current.connection.read();
    expect(current.session.centerRuntime.getSnapshot()).toBeNull();
    expect(old.commands.getSnapshot().phase).toBe("revoked");
    result.resolve({} as Awaited<ReturnType<FlowClient["pluginRuntime"]>>); await rejected;
    await old.commands.submit(runtimeId, runtimeCommand); expect(current.writer.commandPluginRuntime).not.toHaveBeenCalled();
  });

  it("inactive workspace and disposal irrevocably revoke without deactivating local extensions or disposing drafts", async () => {
    const current = await runtimeSetup(); await current.session.host.activate("sample.notes");
    const old = current.session.centerRuntime.getSnapshot()!;
    current.setActive(false);
    expect(old.commands.getSnapshot().phase).toBe("revoked"); expect(current.session.signal.aborted).toBe(false);
    expect(current.session.host.list().find(item => item.id === "sample.notes")?.state).toBe("active");
    current.setActive(true); const next = current.session.centerRuntime.getSnapshot()!;
    expect(next.sessionId).not.toBe(old.sessionId); await old.commands.submit(runtimeId, runtimeCommand);
    expect(current.writer.commandPluginRuntime).not.toHaveBeenCalled();
    await current.session.dispose(); expect(next.commands.getSnapshot().phase).toBe("revoked");
    expect(current.session.centerRuntime.getSnapshot()).toBeNull();
    current.changeReady({ csrfToken: "c".repeat(64) }); await current.connection.read();
    current.setActive(true); expect(current.session.centerRuntime.getSnapshot()).toBeNull();
  });
});
