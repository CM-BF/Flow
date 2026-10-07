import { createContext, useContext, useLayoutEffect, type ComponentProps, type ReactNode } from "react";
import { ContextHistoryDialog } from "../conversation-context-history/ContextHistoryDialog";
import type { ContextHistoryController } from "../conversation-context-history/controller";
import type { ConversationContextHistory } from "../conversation-context-history/binding";
import type { PluginDefinition } from "../plugins/types";
import { PluginView } from "../plugins/react";

export const CONTEXT_HISTORY_OWNER = "flow.context-history";
export const CONTEXT_HISTORY_PANEL = "flow.context-history.panel";
const OPEN = "flow.context-history.open";
const BoundHistory = createContext<ContextHistoryController | null>(null);
function HistoryPanel() {
  const controller = useContext(BoundHistory);
  return controller ? <ContextHistoryDialog controller={controller} /> : null;
}
/** Session owns the controller. Unmount/visibility changes only revoke this view. */
export function ContextHistoryComposer({ binding, viewId, visible, children }: {
  binding: ConversationContextHistory; viewId: string; visible: boolean; children: ReactNode;
}) {
  useLayoutEffect(() => { binding.configure(viewId, visible); });
  useLayoutEffect(() => () => binding.configure(viewId, false), [binding, viewId]);
  return <BoundHistory.Provider value={binding.controller}>{children}</BoundHistory.Provider>;
}
export function ContextHistorySurface({ host, viewId }: { host: ComponentProps<typeof PluginView>["host"]; viewId: string }) {
  return <PluginView host={host} contributionId={CONTEXT_HISTORY_PANEL} context={{ kind: "composer", viewId, isDraft: true }} />;
}
/** ui.layout opens a panel; it grants no reads. Only the private owner port can read. */
export function createContextHistoryPlugin(open: (viewId: string, signal: AbortSignal) => void): PluginDefinition {
  return { manifest: { id: CONTEXT_HISTORY_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["ui.layout"],
    activationEvents: [`command:${OPEN}`, "view:chat.composer.context"],
    commands: [{ id: OPEN, title: "Context", capability: "ui.layout", contexts: ["composer"] }],
    contributions: [{ kind: "button", id: "flow.context-history.button", slot: "chat.composer.actions", title: "Context", commandId: OPEN },
      { kind: "panel", id: CONTEXT_HISTORY_PANEL, slot: "chat.composer.context", title: "Context observation", capability: "ui.layout" }] },
    load: async () => ({ activate(context) {
      context.command(OPEN, { parse: () => null, run: (_, command) => {
        if (command.resource.kind !== "composer") throw Error("A conversation view is required.");
        open(command.resource.viewId, context.signal);
      } });
      context.contribute(CONTEXT_HISTORY_PANEL, HistoryPanel);
    } }) };
}
