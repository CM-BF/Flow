import { describe, it, expect } from "vitest";
import { createDataRendererRegistry, FLOW_REPLY_NAME, FLOW_REPLY_OWNER, type DataDeclaration } from "../src/data-renderers/registry";
import { createReplyPort, flowReplyDeclaration } from "../src/data-renderers/flow-reply-detail";
import { summarizeData } from "../src/data-renderers/react";
import { PluginHost } from "../src/plugins/host";
import type { HostPort, PluginContext } from "../src/plugins/types";

const render = () => null;
const readable = <T>(value: T) => ({ getSnapshot: () => value, subscribe: () => () => {} });
function setup(declarations = [flowReplyDeclaration]) {
  const port: HostPort = { navigation: readable({ activeTaskId: null, workspaceTab: "files", workspaceOpen: false }), theme: readable({ themeId: "light", scheme: "light", availableThemes: [] }), getContext: () => ({ kind: "global" }), authorize: () => false, execute: async () => { throw Error("No commands in renderer test"); } };
  const host = new PluginHost(port);
  const registry = createDataRendererRegistry(declarations, host);
  let loads = 0, context!: PluginContext;
  host.register({ manifest: { id: FLOW_REPLY_OWNER, version: "1.0.0", hostApi: 1, capabilities: [], activationEvents: [], commands: [], contributions: [] }, load: async () => {
    loads++; return { activate: ctx => { context = ctx; registry.attach(FLOW_REPLY_OWNER, FLOW_REPLY_NAME, render, ctx); } };
  } });
  return { host, registry, get context() { return context; }, get loads() { return loads; } };
}
const input = { turnId: "turn-A" };

describe("trusted data renderer catalogue and P01 lifetime", () => {
  it("validates atomically with deterministic conflicts independent of declaration order", () => {
    const a = { ...flowReplyDeclaration, ownerId: "untrusted.plugin" };
    const results = [[flowReplyDeclaration, a], [a, flowReplyDeclaration]].map(items => {
      try { setup(items); } catch (error) { return String(error); }
    });
    expect(results[0]).toBe(results[1]); expect(results[0]).toContain("Duplicate data name"); expect(results[0]).toContain("Reserved Flow");
  });
  it("isolates subscriber exceptions so host activation and downstream listeners continue", async () => {
    const s = setup(); let notifications = 0;
    s.registry.subscribe(() => { throw Error("broken listener"); }); s.registry.subscribe(() => notifications++);
    expect((await s.host.activate(FLOW_REPLY_OWNER)).ok).toBe(true);
    expect(notifications).toBeGreaterThan(0); expect(s.registry.getDiagnostics()).toContain("broken listener");
  });
  it("rejects reserved namespaces, prototype names and foreign owner prefixes", () => {
    for (const name of ["flow.future", "flow-reply-detail", "constructor", "toString", "other.custom"])
      expect(() => setup([{ ...flowReplyDeclaration, name, ownerId: "example.plugin" }])).toThrow();
  });
  it("supports namespaced versioned data without invoking parsers while declaring", () => {
    let parses = 0;
    const custom: DataDeclaration = { ownerId: "example.plugin", name: "example.plugin.card", version: 2, parse: value => { parses++; return value; } };
    const { registry } = setup([custom]); expect(parses).toBe(0);
    expect(registry.resolve(custom.name, { version: 1 }).kind).toBe("invalid"); expect(parses).toBe(0);
    expect(registry.resolve(custom.name, { version: 2 }).kind).toBe("unavailable"); expect(parses).toBe(1);
  });
  it("does not load on registration; follows existing activation and disable, including fresh reactivation", async () => {
    const s = setup(); expect(s.loads).toBe(0); expect(s.registry.resolve(FLOW_REPLY_NAME, input).kind).toBe("unavailable");
    expect((await s.host.activate(FLOW_REPLY_OWNER)).ok).toBe(true); expect(s.loads).toBe(1);
    const first = s.registry.resolve(FLOW_REPLY_NAME, input); expect(first.kind).toBe("ready");
    await s.host.deactivate(FLOW_REPLY_OWNER); expect(s.registry.resolve(FLOW_REPLY_NAME, input).kind).toBe("unavailable");
    expect(() => s.registry.attach(FLOW_REPLY_OWNER, FLOW_REPLY_NAME, render, s.context)).toThrow("lifetime");
    await s.host.activate(FLOW_REPLY_OWNER); expect(s.loads).toBe(2); expect(s.registry.resolve(FLOW_REPLY_NAME, input)).not.toEqual(first);
  });
  it("cleans only its own attachment and rejects simultaneous duplicate attachment", async () => {
    const s = setup(); await s.host.activate(FLOW_REPLY_OWNER);
    expect(() => s.registry.attach(FLOW_REPLY_OWNER, FLOW_REPLY_NAME, render, s.context)).toThrow("already attached");
    expect(s.registry.resolve(FLOW_REPLY_NAME, input).kind).toBe("ready");
    s.registry.dispose(); expect(s.registry.resolve(FLOW_REPLY_NAME, input).kind).toBe("unavailable");
    await s.host.dispose(); expect(s.registry.resolve(FLOW_REPLY_NAME, input).kind).toBe("unavailable");
  });
  it("never exposes a renderer for unknown version, malformed payload, or unknown data name", async () => {
    const s = setup(); await s.host.activate(FLOW_REPLY_OWNER);
    for (const data of [null, { turnId: 3 }, { turnId: "" }, { turnId: "A", taskId: "other" }, { ...input, version: 2 }]) expect(s.registry.resolve(FLOW_REPLY_NAME, data).kind).toBe("invalid");
    expect(s.registry.resolve("unknown", input).kind).toBe("unknown");
    expect(s.registry.resolve(FLOW_REPLY_NAME, { ...input, version: 1 }).kind).toBe("ready");
  });
  it("activation rollback and late attachment after disable cannot resurrect renderer", async () => {
    const host = setup().host;
    const decl = { ...flowReplyDeclaration, name: "example.plugin.card", ownerId: "example.plugin" };
    const registry = createDataRendererRegistry([decl], host);
    let finish!: () => void, context!: PluginContext;
    host.register({ manifest: { id: decl.ownerId, version: "1.0.0", hostApi: 1, capabilities: [], activationEvents: [], commands: [], contributions: [] }, load: async () => ({ activate: async ctx => {
      context = ctx; registry.attach(decl.ownerId, decl.name, render, ctx); await new Promise<void>(r => { finish = r; }); throw Error("activation failed");
    } }) });
    const pending = host.activate(decl.ownerId); await Promise.resolve(); await Promise.resolve();
    expect(registry.resolve(decl.name, { version: 1, turnId: "A" }).kind).toBe("unavailable");
    await host.deactivate(decl.ownerId); finish(); expect((await pending).ok).toBe(false);
    expect(() => registry.attach(decl.ownerId, decl.name, render, context)).toThrow();
    expect(registry.resolve(decl.name, { version: 1, turnId: "A" }).kind).toBe("unavailable");
  });
});

const identity = { connectionId: "center-A", viewId: "pane-A", conversationId: "conversation-A", messageId: "message-A", turnId: "turn-A", taskId: "task-A", detailKey: "digest-A" };
describe("host bound reply port", () => {
  it("does not read on creation/subscription, retains source cache and freezes full identity", async () => {
    let loads = 0; const source = readable({ content: "already verified detail" }); const controller = new AbortController();
    const port = createReplyPort({ identity, signal: controller.signal, source, current: () => true, load: async () => { loads++; } });
    const off = port.subscribe(() => {}); expect(loads).toBe(0); expect(port.getSnapshot()).toBe(source.getSnapshot()); expect(Object.isFrozen(port.identity)).toBe(true);
    await port.read(); expect(loads).toBe(1); off();
  });
  it("denies stale or unauthorized binding before read and suppresses stale snapshot", async () => {
    let current = true, loads = 0;
    const port = createReplyPort({ identity, signal: new AbortController().signal, source: readable({ content: "A secret" }), current: () => current, load: async () => { loads++; } });
    current = false; await expect(port.read()).rejects.toThrow("no longer available"); expect(loads).toBe(0); expect(port.getSnapshot().content).toBeUndefined();
  });
  it("connection abort notifies subscriber and rejects late completion without new view data", async () => {
    const controller = new AbortController(); let finish!: () => void, notifications = 0;
    const port = createReplyPort({ identity, signal: controller.signal, source: readable({ content: "old content" }), current: () => true, load: () => new Promise<void>(r => { finish = r; }) });
    const off = port.subscribe(() => notifications++); const pending = port.read(); controller.abort(); finish();
    await expect(pending).rejects.toThrow(); expect(notifications).toBe(1); expect(port.getSnapshot().content).toBeUndefined(); off();
  });
  it("rejects incomplete identity rather than making an unbound read capability", () => {
    expect(() => createReplyPort({ identity: { ...identity, taskId: "" }, signal: new AbortController().signal, current: () => true, source: readable({}), load: async () => {} })).toThrow("Incomplete");
  });
});


describe("bounded untrusted fallback and builtin schema", () => {
  it("bounds oversized strings/collections/depth, handles cycles and never invokes getters", () => {
    let gets = 0; const cyclic: Record<string, unknown> = { huge: "x".repeat(100_000) }; cyclic.self = cyclic;
    Object.defineProperty(cyclic, "getter", { enumerable: true, get() { gets++; throw Error("must not execute"); } });
    const preview = summarizeData(cyclic); expect(preview.length).toBeLessThanOrEqual(4112); expect(preview).toContain("circular"); expect(preview).toContain("accessor omitted"); expect(gets).toBe(0);
    expect(summarizeData(new Array(100_000).fill("x"))).toContain("items truncated");
    expect(summarizeData({ a: { b: { c: { d: 1 } } } })).toContain("depth limit");
  });
  it("enforces public id length and detaches/freezes builtin parsed data; custom parser errors are invalid", () => {
    const value = { turnId: "A" }; const parsed = flowReplyDeclaration.parse(value);
    value.turnId = "B"; expect(parsed).toEqual({ turnId: "A", version: 1 }); expect(Object.isFrozen(parsed)).toBe(true);
    expect(() => flowReplyDeclaration.parse({ turnId: "x".repeat(129) })).toThrow();
    const { registry } = setup([{ ownerId: "example.plugin", name: "example.plugin.card", version: 1, parse: () => { throw Error("schema failed"); } }]);
    expect(registry.resolve("example.plugin.card", { version: 1 }).kind).toBe("invalid");
    expect(registry.resolve("example.plugin.card", { get version() { throw Error("bad version"); } }).kind).toBe("invalid");
  });
});
