import type { FlowClient } from "@flow/client";
import type { TaskStatus, TaskSummary } from "@flow/contracts";
import { errorMessage } from "./projection";

export interface TaskIndexState {
  tasks: TaskSummary[]; total: number | null; nextCursor: string | null;
  filter: "all" | "attention" | TaskStatus; loading: boolean; error: string | null;
  receivedAt: string | null;
}
export class TaskIndexProjection {
  private state: TaskIndexState = { tasks: [], total: null, nextCursor: null, filter: "all", loading: false, error: null, receivedAt: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller = new AbortController();
  private online = true;
  constructor(private readonly client: Pick<FlowClient, "queryTasks">) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<TaskIndexState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  stop() { this.generation++; this.controller.abort(); this.controller = new AbortController(); this.update({ loading: false }); }
  setOnline(online: boolean) { this.online = online; if (!online) this.stop(); }
  async load(more = false, filter = this.state.filter) {
    if (!this.online || (more && (this.state.loading || !this.state.nextCursor))) return;
    if (!more) this.stop();
    const generation = this.generation;
    const cursor = more ? this.state.nextCursor! : undefined;
    this.update({ loading: true, error: null, filter, ...(!more ? { tasks: [], total: null, nextCursor: null } : {}) });
    try {
      const page = await this.client.queryTasks({ limit: 40, ...(cursor ? { cursor } : {}), ...(filter === "all" ? {} : { statuses: filter === "attention" ? ["waiting", "uncertain"] : [filter] }) }, AbortSignal.any([this.controller.signal, AbortSignal.timeout(15_000)]));
      if (generation !== this.generation) return;
      const tasks = new Map((more ? this.state.tasks : []).map(task => [task.id, task]));
      page.tasks.forEach(task => tasks.set(task.id, task));
      this.update({ tasks: [...tasks.values()], total: page.totalSize, nextCursor: page.nextCursor, receivedAt: new Date().toISOString() });
    } catch (error) { if (generation === this.generation) this.update({ error: errorMessage(error) }); }
    finally { if (generation === this.generation) this.update({ loading: false }); }
  }
}
