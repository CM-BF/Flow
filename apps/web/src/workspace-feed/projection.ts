import { FlowApiError, type FlowClient } from "@flow/client";
import type { TaskSnapshot, WorkspaceEntry, WorkspacePage, WorkspaceTask } from "@flow/contracts";

type WorkspaceClient = Pick<FlowClient, "workspace" | "show" | "decide" | "cancel">;
export interface WorkspaceState {
  entries: WorkspaceEntry[];
  buffered: WorkspaceEntry[];
  tasks: WorkspaceTask[];
  attention: WorkspaceTask[];
  tasksTruncated: boolean;
  attentionTruncated: boolean;
  deliveredCursor: number | null;
  previousCursor: number;
  watermark: number;
  hasEarlier: boolean;
  catchingUp: boolean;
  following: boolean;
  loading: boolean;
  loadingEarlier: boolean;
  connection: "connecting" | "live" | "reconnecting" | "offline";
  error: string | null;
  historyError: string | null;
  notice: string | null;
  revision: number;
  reviewed: Record<string, TaskSnapshot>;
  actions: Record<string, { pending: boolean; error?: string }>;
}
const initial = (): WorkspaceState => ({
  entries: [], buffered: [], tasks: [], attention: [], tasksTruncated: false,
  attentionTruncated: false, deliveredCursor: null, previousCursor: 0,
  watermark: 0, hasEarlier: false, catchingUp: false, following: true,
  loading: true, loadingEarlier: false, connection: "connecting", error: null,
  historyError: null, notice: null, revision: 0, reviewed: {}, actions: {},
});
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "The center could not be reached.";
function mergeEntries(...pages: WorkspaceEntry[][]): WorkspaceEntry[] {
  const entries = new Map<number, WorkspaceEntry>();
  pages.flat().forEach(entry => entries.set(entry.cursor, entry));
  return [...entries.values()].sort((a, b) => a.cursor - b.cursor);
}

/** One cursor for live delivery, another for history; no detail payloads are read here. */
export class WorkspaceFeedProjection {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private online = true;
  private refreshing = false;
  private failures = 0;
  private keys = new Map<string, string>();
  constructor(private readonly client: WorkspaceClient, private readonly pollMs = 2500) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<WorkspaceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private signal() { return AbortSignal.any([this.controller.signal, AbortSignal.timeout(15_000)]); }
  private current(generation: number) { return generation === this.generation && !this.controller.signal.aborted; }
  private invalidate() {
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
    clearTimeout(this.timer);
    this.refreshing = false;
    this.update({ actions: Object.fromEntries(Object.entries(this.state.actions).map(([id, action]) => [id, { ...action, pending: false }])) });
  }
  start(online = true) {
    this.running = true;
    this.online = online;
    if (online) void this.refresh();
    else this.update({ connection: "offline", loading: false });
  }
  stop() { this.running = false; this.invalidate(); }
  setOnline(online: boolean) {
    if (this.online === online) return;
    this.online = online;
    this.invalidate();
    this.update({ connection: online ? "reconnecting" : "offline", loadingEarlier: false, loading: false });
    if (online && this.running) void this.refresh();
  }
  setFollowing(following: boolean) { if (following !== this.state.following) this.update({ following }); }
  revealNew() {
    this.update({ entries: mergeEntries(this.state.entries, this.state.buffered), buffered: [], following: true });
  }
  private accept(page: WorkspacePage, snapshot: boolean) {
    const known = new Set([...this.state.entries, ...this.state.buffered].map(entry => entry.cursor));
    const arrived = page.entries.filter(entry => !known.has(entry.cursor));
    this.update({
      entries: snapshot ? mergeEntries(page.entries) : this.state.following ? mergeEntries(this.state.entries, this.state.buffered, arrived) : this.state.entries,
      buffered: snapshot || this.state.following ? [] : mergeEntries(this.state.buffered, arrived),
      deliveredCursor: page.nextCursor,
      previousCursor: snapshot ? page.previousCursor : this.state.previousCursor,
      hasEarlier: snapshot ? page.hasEarlier : this.state.hasEarlier,
      watermark: page.watermark, tasks: page.tasks, attention: page.attention,
      tasksTruncated: page.tasksTruncated, attentionTruncated: page.attentionTruncated,
      catchingUp: page.hasMore || page.projectionPending,
      loading: false, connection: "live", error: null,
    });
  }
  async refresh() {
    if (!this.online || this.refreshing) return;
    clearTimeout(this.timer);
    this.refreshing = true;
    const generation = this.generation;
    let delay = this.pollMs;
    try {
      // Bound immediate catch-up to three requests; a pending projection must yield.
      for (let batch = 0; batch < 3; batch++) {
        const snapshot = this.state.deliveredCursor === null;
        const page = await this.client.workspace(snapshot ? {} : { after: this.state.deliveredCursor! }, this.signal());
        if (!this.current(generation)) return;
        this.accept(page, snapshot);
        this.failures = 0;
        if (!page.hasMore) { delay = page.projectionPending ? 1000 : this.pollMs; break; }
        delay = 250;
      }
    } catch (error) {
      if (!this.current(generation)) return;
      if (error instanceof FlowApiError && error.status === 409 && error.code === "workspace_cursor_reset") {
        // Invalidate an in-flight history page too; its cursor belongs to the old projection.
        this.invalidate();
        this.update({ ...initial(), revision: this.state.revision + 1, notice: "The center rebuilt its workspace history. Showing a fresh snapshot; the previous reading position is no longer available." });
        if (this.running) this.timer = setTimeout(() => void this.refresh(), 0);
        return;
      }
      delay = Math.min(30_000, this.pollMs * 2 ** Math.min(++this.failures, 4));
      this.update({ loading: false, connection: "reconnecting", error: errorMessage(error) });
    } finally {
      if (this.current(generation)) {
        this.refreshing = false;
        if (this.running && this.online) this.timer = setTimeout(() => void this.refresh(), delay);
      }
    }
  }
  async loadEarlier() {
    if (!this.online || this.state.loadingEarlier || !this.state.hasEarlier) return;
    const generation = this.generation;
    this.update({ loadingEarlier: true, historyError: null, following: false });
    try {
      const page = await this.client.workspace({ before: this.state.previousCursor }, this.signal());
      if (!this.current(generation)) return;
      // An older page cannot replace the live cursor or current task/attention snapshot.
      this.update({ entries: mergeEntries(page.entries, this.state.entries), previousCursor: page.previousCursor, hasEarlier: page.hasEarlier });
    } catch (error) {
      if (this.current(generation)) this.update({ historyError: errorMessage(error) });
    } finally {
      if (this.current(generation)) this.update({ loadingEarlier: false });
    }
  }
  private action(taskId: string, patch: { pending: boolean; error?: string }) {
    this.update({ actions: { ...this.state.actions, [taskId]: patch } });
  }
  async reviewTask(taskId: string) {
    if (!this.online || this.state.actions[taskId]?.pending) return;
    const generation = this.generation;
    this.action(taskId, { pending: true });
    try {
      const task = await this.client.show(taskId, this.signal());
      if (this.current(generation)) this.update({ reviewed: { ...this.state.reviewed, [taskId]: task } });
    } catch (error) {
      if (this.current(generation)) this.action(taskId, { pending: false, error: errorMessage(error) });
    } finally {
      if (this.current(generation)) this.action(taskId, { ...this.state.actions[taskId], pending: false });
    }
  }
  decide(taskId: string, decisionId: string, answer: "approve" | "reject") {
    return this.command(taskId, `decision:${taskId}:${decisionId}:${answer}`, key => this.client.decide(taskId, { decisionId, answer }, key));
  }
  cancel(taskId: string) { return this.command(taskId, `cancel:${taskId}`, key => this.client.cancel(taskId, key)); }
  private async command(taskId: string, identity: string, execute: (key: string) => Promise<unknown>) {
    if (!this.online || this.state.actions[taskId]?.pending) return;
    const generation = this.generation;
    const key = this.keys.get(identity) ?? crypto.randomUUID();
    this.keys.set(identity, key);
    this.action(taskId, { pending: true });
    try {
      await execute(key);
      this.keys.delete(identity);
      if (!this.current(generation)) return;
      this.action(taskId, { pending: false });
      await this.reviewTask(taskId);
      await this.refresh();
    } catch (error) {
      if (!this.current(generation)) return;
      const conflict = error instanceof FlowApiError && error.status === 409;
      if (conflict) this.keys.delete(identity);
      this.action(taskId, { pending: false });
      if (conflict) {
        await this.reviewTask(taskId);
        await this.refresh();
        if (this.current(generation)) this.update({ notice: `The action for task ${taskId} is no longer current. Its state was refreshed; no replacement decision was automatically answered.` });
      }
      if (this.current(generation)) this.action(taskId, { pending: false, error: conflict
        ? "This action is no longer current. The task has been refreshed. Review its current state before choosing again; nothing was automatically resubmitted."
        : `${errorMessage(error)} Retry the same action if its response was lost; its request key is preserved.` });
    }
  }
}
