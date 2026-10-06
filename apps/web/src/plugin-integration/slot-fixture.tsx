/** Isolated browser test entry; never imported by the product App. */
import { createRoot } from "react-dom/client";
import { createRef } from "react";
import type { TaskSnapshot } from "@flow/contracts";
import { AppPluginSession } from "./session";
import { PluginProvider, PluginWorkspace } from "./react";
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
