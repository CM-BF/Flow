import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowClient } from "@flow/client";
import { ConversationProjection } from "../src/conversations/projection";
import { createConversationReplyBindings } from "../src/plugin-integration/data-renderers";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { FLOW_REPLY_NAME, FLOW_REPLY_OWNER } from "../src/data-renderers/registry";
import { themes } from "../src/themes";
import { createConversationFixture } from "./conversation.fixture";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())); });
async function setup() {
  const fixture = createConversationFixture(); fixture.addTurn("chat-2", "long second reply", true);
  await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
  const address = fixture.server.address(); if (!address || typeof address === "string") throw Error("Missing fixture");
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: "flow-fixture-only" });
  const projections = ["chat-1", "chat-2"].map(id => new ConversationProjection(client, id, 60_000));
  await Promise.all(projections.map(p => p.refresh()));
  const open = new Set(["pane-a", "pane-b"]);
  const actions: AppActions = { knowsTask: id => fixture.tasks.has(id), task: id => fixture.tasks.get(id) ?? null, hasDraft: id => open.has(id),
    ownsMessage: (task, message, role) => role === "assistant" && projections.some(p => p.getSnapshot().turns.some(t => t.task.id === task && t.assistant.state === "available" && t.assistant.messageId === message)),
    openTask() {}, openWorkspace() {}, closeWorkspace() {}, async loadReference() {}, setTheme() {}, async copy() {},
  };
  const session = new AppPluginSession(actions, themes[0]!);
  const bindings = projections.map((p, i) => createConversationReplyBindings(session, i === 0 ? "pane-a" : "pane-b", p));
  const bind = (i: number) => { const turn = projections[i]!.getSnapshot().turns.at(-1)!; if (turn.assistant.state !== "available") throw Error("Missing reply"); return bindings[i]!.bind(turn.assistant.messageId, turn.id); };
  const reads = () => fixture.requests.filter(r => /\/turns\/[^/]+\/details\//.test(r.path));
  cleanups.push(async () => { bindings.forEach(b => b.setVisible(false)); projections.forEach(p => p.dispose()); await session.dispose(); await fixture.close(); });
  return { fixture, client, projections, actions, session, bindings, bind, reads, open };
}

describe("actual App reply adapter", () => {
  it("registers through P01 without reading, and reads/cache only from an explicit bound reply", async () => {
    const s = await setup(); expect(s.reads()).toHaveLength(0); expect(s.bind(0)).toBeNull();
    s.bindings[0]!.setVisible(true); const port = s.bind(0)!;
    expect((await s.session.host.activate(FLOW_REPLY_OWNER)).ok).toBe(true);
    expect(s.session.dataRenderers.resolve(FLOW_REPLY_NAME, { turnId: port.identity.turnId }).kind).toBe("ready"); expect(s.reads()).toHaveLength(0);
    expect(port.getSnapshot()).toBe(port.getSnapshot()); await port.read(); expect(port.getSnapshot().content).toContain("thoughtful reply");
    await port.read(); expect(s.reads()).toHaveLength(1);
  });
  it("allows both visible split panes regardless of global focus, and rejects foreign message/turn pairs", async () => {
    const s = await setup(); s.bindings.forEach(b => b.setVisible(true));
    const a = s.bind(0)!, b = s.bind(1)!;
    s.session.publishNavigation({ activeTaskId: b.identity.taskId, workspaceTab: "files", workspaceOpen: false }, { kind: "task", taskId: b.identity.taskId });
    expect(s.bindings[0]!.bind(b.identity.messageId, b.identity.turnId)).toBeNull();
    expect(s.bindings[0]!.bind(a.identity.messageId, b.identity.turnId)).toBeNull();
    await a.read(); await b.read(); expect(s.reads()).toHaveLength(2);
  });
  it("native hide/resume invalidates previously captured ports even before their first invocation", async () => {
    const s = await setup(); s.bindings.forEach(b => b.setVisible(true)); const old = s.bind(0)!, other = s.bind(1)!;
    s.bindings[0]!.setVisible(false); expect(s.bind(0)).toBeNull(); expect(other.isCurrent()).toBe(true);
    s.bindings[0]!.setVisible(true); const fresh = s.bind(0)!; expect(fresh).not.toBe(old);
    await expect(old.read()).rejects.toThrow("no longer available"); expect(s.reads()).toHaveLength(0);
    await fresh.read(); s.bindings[0]!.setVisible(false); s.bindings[0]!.setVisible(true);
    expect(s.bind(0)!.getSnapshot().content).toContain("thoughtful reply"); expect(fresh.isCurrent()).toBe(false);
  });
  it("resuming retains authorized projection cache without initiating another GET", async () => {
    const s = await setup(); s.bindings[0]!.setVisible(true); await s.bind(0)!.read(); const content = s.bind(0)!.getSnapshot().content;
    s.bindings[0]!.setVisible(false); s.bindings[0]!.setVisible(true);
    expect(s.bind(0)!.getSnapshot().content).toBe(content); expect(s.reads()).toHaveLength(1);
    await s.bind(0)!.read(); expect(s.reads()).toHaveLength(1);
  });
  it("rechecks actual membership, view authority, and same-revision reply identity", async () => {
    const s = await setup(); s.bindings[0]!.setVisible(true); const port = s.bind(0)!;
    s.open.delete("pane-a"); await expect(port.read()).rejects.toThrow(); expect(s.reads()).toHaveLength(0); s.open.add("pane-a");
    const turn = s.fixture.chats.get("chat-1")!.turns[0]!; if (turn.assistant.state !== "available" || turn.assistant.source.kind !== "assistant-final") throw Error("Missing fixture source");
    turn.assistant = { ...turn.assistant, text: "Changed at the same revision", source: { ...turn.assistant.source, contentDigest: "a".repeat(64) } };
    await s.projections[0]!.refresh(); expect(port.isCurrent()).toBe(false); expect(s.bind(0)!.identity.detailKey).not.toBe(port.identity.detailKey);
    expect(s.reads()).toHaveLength(0);
  });
  it("disable removes enhanced renderer but does not create a second grant or revoke the existing authorized read", async () => {
    const s = await setup(); s.bindings[0]!.setVisible(true); const port = s.bind(0)!;
    await s.session.host.activate(FLOW_REPLY_OWNER); await s.session.host.deactivate(FLOW_REPLY_OWNER);
    s.bindings[0]!.setVisible(false); s.bindings[0]!.setVisible(true);
    expect(s.session.host.list().find(p => p.id === FLOW_REPLY_OWNER)?.state).toBe("disabled");
    expect(s.session.dataRenderers.resolve(FLOW_REPLY_NAME, { turnId: port.identity.turnId }).kind).toBe("unavailable");
    await s.bind(0)!.read(); expect(s.reads()).toHaveLength(1);
  });
  it("session closes all reply ports synchronously before awaiting async host cleanup", async () => {
    const s = await setup(); s.bindings[0]!.setVisible(true); const old = s.bind(0)!;
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const original = s.session.host.dispose.bind(s.session.host); vi.spyOn(s.session.host, "dispose").mockImplementation(async () => { await gate; await original(); });
    const closing = s.session.dispose(); expect(s.session.signal.aborted).toBe(true); expect(old.isCurrent()).toBe(false);
    await expect(old.read()).rejects.toThrow(); expect(s.reads()).toHaveLength(0); release(); await closing;
  });
  it("late old-connection load settles as expired and cannot fill a new same-ID projection", async () => {
    const s = await setup(); s.bindings[0]!.setVisible(true); const port = s.bind(0)!;
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const original = s.client.conversationDetail.bind(s.client); vi.spyOn(s.client, "conversationDetail").mockImplementation(async (...args) => { await gate; return original(...args); });
    const reading = port.read(); const result = reading.catch(e => e.message); await s.session.dispose(); s.projections[0]!.dispose();
    const next = new ConversationProjection(s.client, "chat-1", 60_000); await next.refresh(); release();
    expect(await result).toContain("no longer available"); expect(next.getSnapshot().details).toEqual({}); next.dispose();
  });
});
