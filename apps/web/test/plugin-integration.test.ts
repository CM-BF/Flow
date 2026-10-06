import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationProjection } from "../src/conversations/projection";
import { FlowClient } from "@flow/client";
import type { TaskSnapshot } from "@flow/contracts";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { themes } from "../src/themes";
import type { PluginDefinition } from "../src/plugins/types";

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
