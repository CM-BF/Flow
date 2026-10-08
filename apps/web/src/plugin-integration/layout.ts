import type { LayoutChange, LayoutInvocation, LayoutResource } from "../plugins/types";
import { activeWorkspace, layoutGroups, type WorkspaceLayout } from "../workspace-state";

/** App's private capabilities; there is no editable layout or draft copy here. */
export interface LayoutCloseAuthorization {
  check(): void;
  commit(): void;
}
export interface LayoutActions {
  authorityKey(): string | null;
  layout(): WorkspaceLayout;
  panesVisible(): boolean;
  viewKey(route: string): string | undefined;
  knowsConversation(id: string): boolean;
  openConversation(id: string): void;
  closeView(viewKey: string, authorization: LayoutCloseAuthorization): void;
  changePane(context: Extract<LayoutResource, { kind: "pane" }>, change: LayoutChange): void;
}
export class AppLayoutPort {
  private actions: LayoutActions | undefined;
  private signature = "";
  private authority: string | null = null;
  private lifetime = new AbortController();
  private closed = false;
  configure(actions: LayoutActions) {
    if (this.closed) return;
    const authority = actions.authorityKey(), layout = actions.layout();
    const signature = JSON.stringify([authority, actions.panesVisible(), layout, layoutGroups(layout).flatMap(pane => pane.tabs.map(route => [route, actions.viewKey(route)]))]);
    if (signature !== this.signature) { this.lifetime.abort(); this.lifetime = new AbortController(); this.signature = signature; }
    this.authority = authority; this.actions = actions;
  }
  allows(context: LayoutResource) {
    const actions = this.actions;
    if (this.closed || !actions || this.authority === null || actions.authorityKey() !== this.authority) return false;
    if (context.kind === "conversation") return actions.knowsConversation(context.conversationId);
    if (!actions.panesVisible()) return false;
    const workspace = activeWorkspace(actions.layout());
    return workspace.id === context.workspaceId && workspace.panes.some(pane => pane.id === context.paneId && pane.tabs.some(route => actions.viewKey(route) === context.viewKey));
  }
  capture(context: LayoutResource): LayoutInvocation {
    const signal = this.lifetime.signal;
    const check = () => { if (signal.aborted || !this.allows(context)) throw Error("This layout action belongs to an expired view or connection."); };
    check(); return { signal, check };
  }
  open(context: Extract<LayoutResource, { kind: "conversation" }>, signal: AbortSignal) {
    this.commit(context, signal, actions => actions.openConversation(context.conversationId));
  }
  close(context: Extract<LayoutResource, { kind: "pane" }>, signal: AbortSignal) {
    const invocation = this.capture(context);
    let committed = false;
    const check = () => {
      if (committed || signal.aborted) throw Error("Layout close was cancelled or already committed.");
      invocation.check();
    };
    check();
    // Opening a confirmation is preparation. Consume the lease only when App
    // synchronously commits that confirmed close, with the plugin still live.
    this.actions!.closeView(context.viewKey, { check, commit: () => {
      check(); committed = true; this.consume();
    } });
  }
  change(context: Extract<LayoutResource, { kind: "pane" }>, change: LayoutChange, signal: AbortSignal) {
    this.commit(context, signal, actions => actions.changePane(context, change));
  }
  private commit(context: LayoutResource, signal: AbortSignal, operation: (actions: LayoutActions) => void) {
    if (signal.aborted) throw Error("Layout command was cancelled.");
    this.capture(context).check();
    // A committed command consumes the old invocation without rotating the business draft.
    this.consume();
    operation(this.actions!);
  }
  private consume() { this.lifetime.abort(); this.lifetime = new AbortController(); }
  suspend() { this.lifetime.abort(); this.lifetime = new AbortController(); this.authority = null; this.signature = ""; this.actions = undefined; }
  dispose() { this.closed = true; this.lifetime.abort(); this.actions = undefined; }
}
