/** Isolated browser test entry; never imported by the product App. */
import { createRoot } from "react-dom/client";
import { createRef, useState } from "react";
import type { TaskSnapshot } from "@flow/contracts";
import { AppPluginSession } from "./session";
import { PluginProvider, PluginSettings, PluginWorkspace } from "./react";
import type { PluginRegistryReader } from "../plugin-management/PluginManagement";
import type { OperationResult } from "../plugins/types";
import { themes } from "../themes";

export function mountWorkspaceSlotFixture(container: HTMLElement) {
  const now = "2026-10-06T03:00:00Z";
  const task: TaskSnapshot = {
    id: "B", title: "Workspace B", prompt: "Fixture", harness: "fixture", status: "succeeded",
    verificationStatus: "pending", createdAt: now, updatedAt: now, watermark: 0, hasMore: false,
    attempt: null, pendingDecision: null, entries: [],
    usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true },
  };
  const output = document.createElement("output"); output.setAttribute("aria-label", "Slot invocation");
  const session = new AppPluginSession({
    knowsTask: id => id === "A" || id === "B", task: () => task, hasDraft: () => false,
    openTask: () => {}, openWorkspace: () => {}, closeWorkspace: () => {},
    loadReference: async () => {}, setTheme: () => {}, copy: async () => {},
  }, themes[0]!);
  session.publishNavigation({ activeTaskId: "A", workspaceTab: "files", workspaceOpen: true }, { kind: "task", taskId: "A" });
  session.host.register({
    manifest: {
      id: "fixture.tab-actions", version: "1.0.0", hostApi: 1, capabilities: ["ui.layout"],
      activationEvents: ["command:fixture.tab-actions.run"],
      commands: [{ id: "fixture.tab-actions.run", title: "Record local workspace", capability: "ui.layout", contexts: ["workspace"] }],
      contributions: [
        { kind: "button", id: "fixture.tab-actions.button", slot: "workspace.tabs", title: "Workspace button", commandId: "fixture.tab-actions.run", args: "button" },
        { kind: "menu", id: "fixture.tab-actions.menu", slot: "workspace.tabs", title: "Workspace menu action", commandId: "fixture.tab-actions.run", args: "menu" },
      ],
    },
    load: async () => ({ activate(context) {
      context.command("fixture.tab-actions.run", { parse: value => String(value), run: (value, command) => {
        output.textContent = JSON.stringify({ value, resource: command.resource });
      } });
    } }),
  });
  const root = createRoot(container);
  root.render(<PluginProvider session={session}><PluginWorkspace
    state={{ tasks: [], nextListCursor: null, task, connection: "live", error: null, pending: false, olderAvailable: false, details: {} }}
    activeTab="files" focusRequest={null} container={createRef<HTMLDivElement>()} onClose={() => { output.textContent = "closed"; }}
  /></PluginProvider>);
  container.after(output);
  return { disable: () => session.host.deactivate("fixture.tab-actions"), dispose: async () => { root.unmount(); output.remove(); await session.dispose(); } };
}

/** Real session/provider/Settings; synthetic plugin faults only, no center or provider. */
export async function mountPluginDiagnosticsFixture(container: HTMLElement) {
  const session = new AppPluginSession({
    knowsTask: () => false, task: () => null, hasDraft: () => false,
    openTask: () => {}, openWorkspace: () => {}, closeWorkspace: () => {},
    loadReference: async () => {}, setTheme: () => {}, copy: async () => {},
  }, themes[0]!);
  let commandResult: OperationResult | undefined;
  let ancestorRenders = 0; let registryNotifications = 0; let slotNotifications = 0;
  session.host.register({
    manifest: {
      id: "fixture.diagnostics", version: "1.0.0", hostApi: 1, capabilities: ["ui.layout"],
      activationEvents: ["view:settings.sections", "command:fixture.diagnostics.fail"],
      commands: [{ id: "fixture.diagnostics.fail", title: "Fail diagnostic command", capability: "ui.layout", contexts: ["global"] }],
      contributions: [{ kind: "panel", id: "fixture.diagnostics.panel", slot: "settings.sections", title: "Diagnostic fixture", capability: "ui.layout" }],
    },
    load: async () => ({ activate(context) {
      context.command("fixture.diagnostics.fail", { parse: () => undefined, run: () => { throw Error("Fixture command failure"); } });
      context.contribute("fixture.diagnostics.panel", function DiagnosticPanel({ execute }) {
        const [broken, setBroken] = useState(false);
        if (broken) throw Error("Fixture local renderer failure");
        return <section aria-label="Diagnostic fault controls">
          <button type="button" onClick={() => { void execute("fixture.diagnostics.fail").then(result => { commandResult = result; }); }}>Fail diagnostic command</button>
          <button type="button" onClick={() => setBroken(true)}>Fail local renderer</button>
        </section>;
      });
    } }),
  });
  const activation = await session.host.activate("fixture.diagnostics");
  if (!activation.ok) { await session.dispose(); throw Error(activation.error); }
  const registrySnapshot = session.host.list();
  const slotSnapshot = session.host.getSlotSnapshot("settings.sections");
  const stopRegistry = session.host.subscribe(() => { registryNotifications++; });
  const stopSlot = session.host.subscribeSlot("settings.sections", () => { slotNotifications++; });
  const unavailable = async () => { throw Error("Registry is outside the diagnostic fixture"); };
  const registry: PluginRegistryReader = { plugins: unavailable, plugin: unavailable, pluginVersions: unavailable, pluginOperations: unavailable };
  function StableAncestor() {
    ancestorRenders++;
    return <PluginProvider session={session}><PluginSettings registry={registry} /></PluginProvider>;
  }
  const root = createRoot(container);
  root.render(<StableAncestor />);
  return {
    observation: () => ({ ancestorRenders, registryNotifications, slotNotifications,
      registryStable: registrySnapshot === session.host.list(), slotStable: slotSnapshot === session.host.getSlotSnapshot("settings.sections"), commandResult }),
    dispose: async () => { root.unmount(); stopRegistry(); stopSlot(); await session.dispose(); },
  };
}
