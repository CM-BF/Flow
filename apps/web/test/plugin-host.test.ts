import { describe, it, expect } from "vitest";
import { createAttachmentPlugin, ATTACHMENT_OWNER, ATTACHMENT_OPEN } from "../src/plugin-integration/attachments";
import { PluginHost } from "../src/plugins/host";
import { validateContext, validateSlot } from "../src/plugins/validation";
import type {
  HostPort,
  PluginContext,
  PluginDefinition,
  PluginManifest,
  PluginModule,
  ResourceContext,
  ThemeSnapshot,
} from "../src/plugins/types";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set(next: T) {
      value = next;
      for (const fn of listeners) fn();
    },
    get size() {
      return listeners.size;
    },
  };
}
function setup() {
  const navigation = store({
    activeTaskId: "A",
    workspaceTab: "files" as const,
    workspaceOpen: true,
  });
  const theme = store<ThemeSnapshot>({
    themeId: "light",
    scheme: "light",
    availableThemes: [
      { id: "light", label: "Light", scheme: "light", tokens: {} },
      { id: "dark", label: "Dark", scheme: "dark", tokens: {} },
    ],
  });
  const calls: { command: string; args: unknown; context: ResourceContext }[] =
    [];
  let allowed = true;
  const port: HostPort = {
    navigation,
    theme,
    getContext: () => ({ kind: "task", taskId: "A" }),
    authorize: () => allowed,
    execute: async (command, args, meta) => {
      calls.push({ command, args, context: meta.context });
      if (command === "flow.theme.set")
        theme.set({
          ...theme.getSnapshot(),
          themeId: (args as { themeId: string }).themeId,
        });
    },
  };
  return {
    host: new PluginHost(port),
    port,
    navigation,
    theme,
    calls,
    deny: () => {
      allowed = false;
    },
  };
}
function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: "test.plugin",
    version: "1.0.0",
    hostApi: 1,
    capabilities: ["ui.navigate"],
    commands: [
      {
        id: "test.plugin.open",
        title: "Open",
        capability: "ui.navigate",
        contexts: ["task"],
      },
    ],
    contributions: [
      {
        kind: "button",
        id: "test.plugin.button",
        title: "Open",
        slot: "sidebar.item.actions",
        commandId: "test.plugin.open",
      },
    ],
    activationEvents: ["command:test.plugin.open"],
    ...overrides,
  };
}
const implement = (context: PluginContext) =>
  context.command("test.plugin.open", {
    parse: (args) => args,
    run: (_args, command) =>
      command.execute("flow.chat.open", {
        taskId:
          "taskId" in command.resource ? command.resource.taskId! : "missing",
      }),
  });
function definition(
  activate: PluginModule["activate"] = implement,
  overrides: Partial<PluginManifest> = {},
): PluginDefinition {
  return { manifest: manifest(overrides), load: async () => ({ activate }) };
}

describe("trusted PluginHost lifecycle and authority", () => {
  it("validates real Arc slot contexts and refuses a bridge redirected away from its original pane", async () => {
    expect(() => validateSlot("chat.tab.actions", { kind: "pane", workspaceId: "workspace", paneId: "pane", viewKey: "view" })).not.toThrow();
    expect(() => validateSlot("chat.tab.actions", { kind: "task", taskId: "A" })).toThrow();
    const malformed = { kind: "pane" as const, workspaceId: "workspace", paneId: "pane", viewKey: "view", taskId: "A" };
    expect(() => validateContext(malformed)).toThrow();
    const s = setup(); s.port.captureLayoutInvocation = () => ({ signal: new AbortController().signal, check() {} });
    s.host.register(definition(context => context.command("test.plugin.open", { parse: args => args,
      run: (_, command) => command.execute("flow.layout.change", { paneId: "other", change: { kind: "resize", share: .5 } }),
    }), { capabilities: ["ui.layout"], contributions: [], commands: [{ id: "test.plugin.open", title: "Resize", capability: "ui.layout", contexts: ["pane"] }] }));
    expect((await s.host.execute("test.plugin.open", undefined, { kind: "pane", workspaceId: "workspace", paneId: "pane", viewKey: "view" })).ok).toBe(false);
    expect(s.calls).toEqual([]); await s.host.dispose();
  });
  it("does not revive a pending Arc command when the plugin is disabled and activated again", async () => {
    const s = setup(), entered = deferred<void>(), gate = deferred<void>();
    s.port.captureLayoutInvocation = () => ({ signal: new AbortController().signal, check() {} });
    s.host.register(definition(context => context.command("test.plugin.open", { parse: () => undefined, run: async (_, command) => {
      entered.resolve(); await gate.promise; await command.execute("flow.conversation.open", { conversationId: "B" });
    } }), { contributions: [], commands: [{ id: "test.plugin.open", title: "Open", capability: "ui.navigate", contexts: ["conversation"] }] }));
    const old = s.host.execute("test.plugin.open", undefined, { kind: "conversation", conversationId: "B" }); await entered.promise;
    await s.host.deactivate("test.plugin"); await s.host.activate("test.plugin"); gate.resolve();
    expect((await old).ok).toBe(false); expect(s.calls).toEqual([]); await s.host.dispose();
  });
  it("allows the declared composer context panel only in a composer and rechecks knowledge authority", async () => {
    const s = setup(); const declaration = manifest({ capabilities: ["knowledge.read"], activationEvents: ["view:chat.composer.context"], commands: [], contributions: [{ kind: "panel", id: "test.plugin.knowledge-panel", slot: "chat.composer.context", title: "Knowledge", capability: "knowledge.read" }] });
    s.host.register({ manifest: declaration, load: async () => ({ activate(context) { context.contribute("test.plugin.knowledge-panel", () => null); } }) });
    await s.host.activate(declaration.id);
    expect(s.host.checkView("test.plugin.knowledge-panel", { kind: "composer", viewId: "draft", isDraft: true }).ok).toBe(true);
    expect(s.host.checkView("test.plugin.knowledge-panel", { kind: "task", taskId: "A" }).ok).toBe(false);
    s.deny(); expect(s.host.checkView("test.plugin.knowledge-panel", { kind: "composer", viewId: "draft", isDraft: true }).ok).toBe(false);
    await s.host.dispose();
  });
  it("validates JSON declarations atomically without running a loader", () => {
    const { host } = setup();
    let loads = 0;
    const plugin = definition();
    host.register({
      ...plugin,
      load: async () => {
        loads++;
        return { activate: implement };
      },
    });
    expect(loads).toBe(0);
    expect(() => host.register(plugin)).toThrow("already registered");
    expect(host.list()).toHaveLength(1);
    expect(() => host.register(definition(undefined, { id: "bad" }))).toThrow(
      "namespaced",
    );
    expect(() =>
      host.register(
        definition(undefined, { id: "test.invalid", hostApi: 2 as 1 }),
      ),
    ).toThrow("API");
    const callback = { ...manifest(), hidden: () => 0 };
    expect(() =>
      new PluginHost(setup().port).register({ ...plugin, manifest: callback }),
    ).toThrow("JSON");
    expect(host.list()).toHaveLength(1);
  });
  it("shares activation for concurrent distinct command requests and binds local B context", async () => {
    const { host, calls } = setup();
    const gate = deferred<PluginModule>();
    let loads = 0;
    host.register({
      manifest: manifest(),
      load: () => {
        loads++;
        return gate.promise;
      },
    });
    const a = host.execute("test.plugin.open", undefined, {
      kind: "task",
      taskId: "B",
    });
    const b = host.execute("test.plugin.open");
    gate.resolve({ activate: implement });
    expect((await a).ok).toBe(true);
    expect((await b).ok).toBe(true);
    expect(loads).toBe(1);
    expect(calls.map((call) => call.args)).toEqual([
      { taskId: "B" },
      { taskId: "A" },
    ]);
    expect(calls[0]!.context).toEqual({ kind: "task", taskId: "B" });
  });
  it("rolls back partial activation and actually reloads on retry", async () => {
    const { host } = setup();
    let loads = 0;
    let disposed = 0;
    host.register({
      manifest: manifest(),
      load: async () => {
        loads++;
        return {
          activate: (context) => {
            implement(context);
            context.own({
              dispose: () => {
                disposed++;
              },
            });
            if (loads === 1) throw Error("activation failed");
          },
        };
      },
    });
    expect((await host.activate("test.plugin")).ok).toBe(false);
    expect(disposed).toBe(1);
    expect(host.list()[0]!.state).toBe("failed");
    expect((await host.execute("test.plugin.open")).ok).toBe(true);
    expect(loads).toBe(2);
    await host.deactivate("test.plugin");
    expect(disposed).toBe(2);
  });
  it("invalidates pending load on disable without reviving or running activation", async () => {
    const { host } = setup();
    const gate = deferred<PluginModule>();
    let activated = 0;
    host.register({ manifest: manifest(), load: () => gate.promise });
    const pending = host.activate("test.plugin");
    await host.deactivate("test.plugin");
    gate.resolve({
      activate: () => {
        activated++;
      },
    });
    expect((await pending).ok).toBe(false);
    expect(activated).toBe(0);
    expect(host.list()[0]!.state).toBe("disabled");
    expect((await host.execute("test.plugin.open")).ok).toBe(false);
  });
  it("disposes late activation return once while preserving the new generation", async () => {
    const { host } = setup();
    const gate = deferred<void>();
    let count = 0;
    let cleaned = 0;
    host.register(
      definition(async (context) => {
        implement(context);
        if (++count === 1) {
          await gate.promise;
          return {
            dispose: () => {
              cleaned++;
            },
          };
        }
      }),
    );
    const old = host.activate("test.plugin");
    await Promise.resolve();
    await host.deactivate("test.plugin");
    expect((await host.activate("test.plugin")).ok).toBe(true);
    gate.resolve();
    expect((await old).ok).toBe(false);
    expect(cleaned).toBe(1);
    expect(host.list()[0]!.state).toBe("active");
  });
  it("continues cleanup after one failure and rejects captured contexts", async () => {
    const { host, navigation } = setup();
    let captured!: PluginContext;
    const order: number[] = [];
    host.register(
      definition((context) => {
        captured = context;
        implement(context);
        context.navigation.subscribe(() => {});
        context.own({
          dispose: () => {
            order.push(1);
          },
        });
        context.own({
          dispose: () => {
            order.push(2);
            throw Error("cleanup");
          },
        });
        context.own({
          dispose: () => {
            order.push(3);
          },
        });
      }),
    );
    await host.activate("test.plugin");
    expect(navigation.size).toBe(1);
    await host.deactivate("test.plugin");
    expect(order).toEqual([3, 2, 1]);
    expect(navigation.size).toBe(0);
    expect(() => captured.navigation.getSnapshot()).toThrow("generation");
    expect(() =>
      captured.command("test.plugin.open", { parse: (x) => x, run: () => 0 }),
    ).toThrow("generation");
    let late = 0;
    expect(() =>
      captured.own({
        dispose: () => {
          late++;
        },
      }),
    ).toThrow("generation");
    expect(late).toBe(1);
    expect(host.getDiagnostics().some((item) => item.phase === "dispose")).toBe(
      true,
    );
  });
  it("rechecks dynamic authorization after asynchronous activation", async () => {
    const { host, deny, calls } = setup();
    const gate = deferred<PluginModule>();
    host.register({ manifest: manifest(), load: () => gate.promise });
    const result = host.execute("test.plugin.open");
    deny();
    gate.resolve({ activate: implement });
    expect((await result).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("catches async handler and bridge failures without unhandled rejection", async () => {
    const { host, port } = setup();
    host.register(
      definition((context) =>
        context.command("test.plugin.open", {
          parse: (x) => x,
          run: async () => {
            await Promise.resolve();
            throw Error("async failure");
          },
        }),
      ),
    );
    expect(await host.execute("test.plugin.open")).toEqual({
      ok: false,
      error: "async failure",
    });
    expect(host.getDiagnostics().at(-1)?.phase).toBe("command");
    const second = new PluginHost({
      ...port,
      execute: async () => {
        throw Error("bridge failed");
      },
    });
    second.register(definition());
    expect(await second.execute("test.plugin.open")).toEqual({
      ok: false,
      error: "bridge failed",
    });
  });
  it("keeps list/slot snapshots stable across navigation and makes narrow copies immutable", async () => {
    const { host, navigation } = setup();
    let captured!: PluginContext;
    host.register(
      definition((context) => {
        captured = context;
        implement(context);
      }),
    );
    await host.activate("test.plugin");
    const list = host.list();
    const slot = host.getSlotSnapshot("sidebar.item.actions");
    const snapshot = captured.navigation.getSnapshot();
    expect(snapshot).toBe(captured.navigation.getSnapshot());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(navigation.getSnapshot())).toBe(false);
    navigation.set({ ...navigation.getSnapshot(), activeTaskId: "B" });
    expect(host.list()).toBe(list);
    expect(host.getSlotSnapshot("sidebar.item.actions")).toBe(slot);
    expect(captured.navigation.getSnapshot().activeTaskId).toBe("B");
  });
  it("rejects wrong task/reference/composer invocation and mismatched semantic slots", async () => {
    const { host, calls } = setup();
    host.register(
      definition(
        (context) =>
          context.command("test.plugin.open", {
            parse: (x) => x,
            run: (_, command) =>
              command.execute("flow.reference.load", {
                taskId: "B",
                referenceId: "r",
              }),
          }),
        {
          capabilities: ["reference.read"],
          commands: [
            {
              id: "test.plugin.open",
              title: "Read",
              capability: "reference.read",
              contexts: ["reference"],
            },
          ],
        },
      ),
    );
    const result = await host.execute("test.plugin.open", undefined, {
      kind: "reference",
      taskId: "A",
      referenceId: "r",
    });
    expect(result).toEqual({
      ok: false,
      error: "Resource task does not match invocation",
    });
    expect(calls).toHaveLength(0);
    expect(() =>
      validateSlot("chat.message.actions", { kind: "task", taskId: "A" }),
    ).toThrow("not valid");
    expect(() =>
      validateContext({ kind: "message", taskId: "A" } as ResourceContext),
    ).toThrow("messageId");
    expect(() =>
      validateContext({ kind: "global", taskId: "A" } as ResourceContext),
    ).toThrow("Unexpected");
  });
  it("falls back from a disabled custom theme without retaining it through App snapshots", async () => {
    const { host, theme, calls } = setup();
    host.register(
      definition(undefined, {
        capabilities: ["ui.navigate", "theme.register"],
        contributions: [
          {
            kind: "theme",
            id: "test.plugin.night",
            theme: {
              id: "test.plugin.night",
              label: "Night",
              scheme: "dark",
              tokens: { background: "#111" },
            },
          },
        ],
      }),
    );
    await host.activate("test.plugin");
    theme.set({
      ...theme.getSnapshot(),
      themeId: "test.plugin.night",
      scheme: "dark",
      availableThemes: host.getThemes(),
    });
    expect(host.getThemes().map((item) => item.id)).toContain(
      "test.plugin.night",
    );
    await host.deactivate("test.plugin");
    expect(calls.at(-1)?.args).toEqual({ themeId: "dark" });
    expect(host.getThemes().map((item) => item.id)).toEqual(["light", "dark"]);
  });
  it("whole-host disposal invalidates pending commands, views and old connection context", async () => {
    const { host, calls } = setup();
    const gate = deferred<void>();
    let captured!: PluginContext;
    host.register(
      definition((context) => {
        captured = context;
        context.command("test.plugin.open", {
          parse: (x) => x,
          run: async (_, command) => {
            await gate.promise;
            return command.execute("flow.chat.open", { taskId: "A" });
          },
        });
      }),
    );
    await host.activate("test.plugin");
    const bound = host.bind("test.plugin.button", {
      kind: "task",
      taskId: "A",
    });
    const pending = bound("test.plugin.open");
    await host.dispose();
    gate.resolve();
    expect((await pending).ok).toBe(false);
    expect((await bound("test.plugin.open")).ok).toBe(false);
    expect(() => captured.theme.getSnapshot()).toThrow("generation");
    expect(calls).toHaveLength(0);
    expect(() => host.register(definition())).toThrow("disposed");
  });
});

it("isolates synchronous and asynchronous subscription failures while continuing fan-out", async () => {
  const { host, navigation } = setup();
  let updates = 0;
  host.register(
    definition((context) => {
      implement(context);
      context.navigation.subscribe(() => {
        throw Error("sync subscriber");
      });
      context.navigation.subscribe(async () => {
        await Promise.resolve();
        throw Error("async subscriber");
      });
    }),
  );
  host.register({
    manifest: {
      id: "test.other",
      version: "1.0.0",
      hostApi: 1,
      capabilities: [],
      activationEvents: [],
      commands: [],
      contributions: [],
    },
    load: async () => ({
      activate: (context) => {
        context.navigation.subscribe(() => {
          updates++;
        });
      },
    }),
  });
  await host.activate("test.plugin");
  await host.activate("test.other");
  expect(() =>
    navigation.set({ ...navigation.getSnapshot(), activeTaskId: "B" }),
  ).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(updates).toBe(1);
  expect(
    host.getDiagnostics().filter((item) => item.phase === "subscription"),
  ).toEqual([
    {
      pluginId: "test.plugin",
      phase: "subscription",
      message: "sync subscriber",
    },
    {
      pluginId: "test.plugin",
      phase: "subscription",
      message: "async subscriber",
    },
  ]);
  await host.deactivate("test.plugin");
  expect(navigation.size).toBe(1);
  navigation.set({ ...navigation.getSnapshot(), activeTaskId: "C" });
  expect(updates).toBe(2);
  await host.dispose();
  expect(navigation.size).toBe(0);
});

it("atomically rejects unknown and prototype slots and activation events", () => {
  for (const invalid of [
    "unknown.slot",
    "toString",
    "constructor",
    "__proto__",
  ]) {
    const { host } = setup();
    const original = manifest();
    expect(() =>
      host.register(
        definition(undefined, {
          contributions: [
            {
              ...original.contributions[0]!,
              slot: invalid,
            } as (typeof original.contributions)[number],
          ],
        }),
      ),
    ).toThrow("slot");
    expect(host.list()).toEqual([]);
    expect(() =>
      host.register(
        definition(undefined, {
          activationEvents: [`view:${invalid}` as "view:workspace.tabs"],
        }),
      ),
    ).toThrow("activation event");
    expect(host.list()).toEqual([]);
    expect(() => host.register(definition())).not.toThrow();
    expect(host.list()).toHaveLength(1);
  }
});

it("checks view resource and current grants synchronously without loading", async () => {
  const { host, deny } = setup();
  let loads = 0;
  const plugin = definition(
    (context) => {
      implement(context);
      context.contribute("test.plugin.panel", () => null);
    },
    {
      contributions: [
        {
          kind: "panel",
          id: "test.plugin.panel",
          slot: "workspace.tabs",
          title: "Panel",
          capability: "ui.navigate",
        },
      ],
      activationEvents: ["view:workspace.tabs"],
    },
  );
  host.register({
    ...plugin,
    load: async (signal) => {
      loads++;
      return plugin.load(signal);
    },
  });
  const resource = { kind: "workspace", taskId: "B", tabId: "files" } as const;
  expect(host.checkView("test.plugin.panel", resource).ok).toBe(false);
  expect(loads).toBe(0);
  await host.show("test.plugin.panel", resource);
  expect(host.checkView("test.plugin.panel", resource).ok).toBe(true);
  expect(
    host.checkView("test.plugin.panel", { kind: "task", taskId: "B" }).ok,
  ).toBe(false);
  deny();
  expect(host.checkView("test.plugin.panel", resource).ok).toBe(false);
  await host.dispose();
  expect(host.checkView("test.plugin.panel", resource).ok).toBe(false);
});

it("accepts the typed message footer and rejects non-message invocations", () => {
  expect(() => validateSlot("chat.message.footer", { kind: "message", taskId: "A", messageId: "m", role: "user" })).not.toThrow();
  expect(() => validateSlot("chat.message.footer", { kind: "task", taskId: "A" })).toThrow();
});


describe("independent assistant stream capability", () => {
  it("accepts the explicit stream read capability but active state does not bypass resource permission", async () => {
    const s=setup();
    s.host.register({manifest:manifest({id:"test.stream",capabilities:["task.assistant-stream.read"],commands:[],activationEvents:["view:chat.message.footer"],
      contributions:[{kind:"panel",id:"test.stream.panel",slot:"chat.message.footer",title:"Stream",capability:"task.assistant-stream.read"}]}),load:async()=>({activate(context){context.contribute("test.stream.panel",()=>null);}})});
    await s.host.activate("test.stream");
    const context:ResourceContext={kind:"message",taskId:"A",messageId:"actual-user",role:"user"};
    expect(s.host.checkView("test.stream.panel",context).ok).toBe(true);s.deny();expect(s.host.checkView("test.stream.panel",context).ok).toBe(false);
    expect(s.host.checkView("test.stream.panel",{kind:"global"}).ok).toBe(false);await s.host.dispose();
  });
});

it("steering read declaration cannot grant write execution, and host policy still gates declared write", async () => {
  const s=setup(); let writes=0;
  const definition:PluginDefinition={manifest:{id:"test.steering",version:"1.0.0",hostApi:1,contributions:[],capabilities:["task.steering.read","task.steering.write"],activationEvents:["command:test.steering.accept"],commands:[{id:"test.steering.accept",title:"Accept",capability:"task.steering.write",contexts:["message"]}]},load:async()=>({activate(context){context.command("test.steering.accept",{parse:value=>value,run:()=>{writes++;}});}})};
  s.port.authorize=(_plugin,capability)=>capability==="task.steering.read";
  s.host.register(definition);
  expect((await s.host.execute("test.steering.accept",{}, {kind:"message",taskId:"A",messageId:"m",role:"user"})).ok).toBe(false);expect(writes).toBe(0);
  s.port.authorize=()=>true;
  expect((await s.host.execute("test.steering.accept",{}, {kind:"message",taskId:"A",messageId:"m",role:"user"})).ok).toBe(true);expect(writes).toBe(1);
  await s.host.dispose();
});


it("validates the attachment builtin in the existing host and rechecks its explicit read authority", async () => {
  const f = setup(); let lookups = 0;
  f.host.register(createAttachmentPlugin(() => { lookups++; return undefined; }));
  f.deny();
  const result = await f.host.execute(ATTACHMENT_OPEN, undefined, { kind: "composer", viewId: "view-a", isDraft: true });
  expect(result.ok).toBe(false); expect(lookups).toBe(0);
  expect(f.host.list().find(plugin => plugin.id === ATTACHMENT_OWNER)?.state).toBe("registered");
  await f.host.dispose();
});
