import type { FlowClient } from "@flow/client";
import { ContextHistoryController, type ContextHistoryReaders, type HistoryTarget } from "./controller.ts";

export interface ContextHistoryPort extends ContextHistoryReaders {
  /** The App's live view identity, not a plugin-supplied resource. */
  target(viewKey: string): HistoryTarget | null;
}
export function sameHistoryTarget(a: HistoryTarget | null, b: HistoryTarget | null) {
  return a !== null && b !== null && a.connectionId === b.connectionId && a.viewKey === b.viewKey
    && a.conversationId === b.conversationId && a.taskId === b.taskId
    && a.authorityGeneration === b.authorityGeneration && a.expectedAttemptId === b.expectedAttemptId;
}
/** Only the trusted App constructs this port. ui.layout is not a data grant. */
export function createContextHistoryPort(client: Pick<FlowClient, "contextHistory" | "detail">,
  target: ContextHistoryPort["target"], authorized: (target: HistoryTarget) => boolean): ContextHistoryPort {
  const current = (value: HistoryTarget) => sameHistoryTarget(target(value.viewKey), value) && authorized(value);
  const requireCurrent = (value: HistoryTarget, signal: AbortSignal) => {
    if (signal.aborted || !current(value)) throw Error("This context observation belongs to an unavailable view.");
  };
  return {
    target, current,
    async history(value, signal) {
      requireCurrent(value, signal);
      const response = await client.contextHistory(value.taskId, signal);
      requireCurrent(value, signal);
      return response;
    },
    async detail(value, sample, signal) {
      requireCurrent(value, signal);
      const subject = sample.observation.identity.subject;
      if (subject.kind !== "attempt" || subject.taskId !== value.taskId
        || value.expectedAttemptId !== undefined && subject.attemptId !== value.expectedAttemptId)
        throw Error("This observation detail belongs to another execution.");
      const response = await client.detail(sample.detailRef.id, signal);
      requireCurrent(value, signal);
      return response;
    },
  };
}
interface HistoryHost {
  connectionId: string;
  signal: AbortSignal;
  enabled(viewId: string): boolean;
}
/** Session-owned read lifetime. React only configures the mounted view's visibility. */
export class ConversationContextHistory {
  readonly controller: ContextHistoryController;
  readonly viewKey: string;
  private readonly host: HistoryHost;
  private readonly port: () => ContextHistoryPort | undefined;
  private visible = false;
  private viewId = "";
  private closed = false;
  constructor(viewKey: string, host: HistoryHost, port: () => ContextHistoryPort | undefined) {
    this.viewKey = viewKey; this.host = host; this.port = port;
    const current = (target: HistoryTarget) => !this.closed && this.visible && !host.signal.aborted
      && target.connectionId === host.connectionId && target.viewKey === viewKey
      && host.enabled(this.viewId) && port()?.current(target) === true;
    this.controller = new ContextHistoryController({
      current,
      history: (target, signal) => {
        if (!current(target)) throw Error("Context history is unavailable in this view.");
        return this.port()!.history(target, signal);
      },
      detail: (target, sample, signal) => {
        if (!current(target)) throw Error("Context history is unavailable in this view.");
        return this.port()!.detail(target, sample, signal);
      },
    }, host.signal);
  }
  context() { return { kind: "composer" as const, viewId: this.viewId, isDraft: true }; }
  configure(viewId: string, visible: boolean) { this.viewId = viewId; this.visible = visible; this.sync(); }
  sync = () => {
    const target = this.port()?.target(this.viewKey) ?? null;
    this.controller.configure(target, !this.closed && this.visible && this.host.enabled(this.viewId));
  };
  open(signal: AbortSignal) {
    this.sync();
    if (!this.controller.getSnapshot().target) throw Error("No execution observation is available yet. Send a message before opening Context.");
    if (!this.controller.getSnapshot().available) throw Error("Show this authorized conversation before reading Context.");
    this.controller.open(signal);
  }
  dispose() { this.closed = true; this.controller.dispose(); }
}
