import { FlowClient } from "@flow/client";
import type {
  Detail,
  EventPage,
  TaskSnapshot,
  TaskSubmission,
  TaskSummary,
} from "@flow/contracts";

export interface ProjectionState {
  tasks: TaskSummary[];
  nextListCursor: string | null;
  task: TaskSnapshot | null;
  connection: "connecting" | "live" | "reconnecting" | "disconnected";
  error: string | null;
  pending: boolean;
  olderAvailable: boolean;
  details: Record<string, { data?: Detail; loading?: boolean; error?: string }>;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const mergeEntries = (
  first: TaskSnapshot["entries"],
  second: TaskSnapshot["entries"],
) =>
  [
    ...new Map(
      [...first, ...second].map((entry) => [entry.id, entry]),
    ).values(),
  ].sort((a, b) => a.cursor - b.cursor);

/** A disposable browser projection. Only HTTP responses may change task facts. */
export class TaskProjection {
  private state: ProjectionState = {
    tasks: [],
    nextListCursor: null,
    task: null,
    connection: "disconnected",
    error: null,
    pending: false,
    olderAvailable: false,
    details: {},
  };
  private readonly listeners = new Set<() => void>();
  private readonly commandKeys = new Map<string, string>();
  private readonly detailRequests = new Map<string, Promise<void>>();
  private observer?: AbortController;
  private generation = 0;
  private online = true;
  private selectedId: string | null = null;
  private historyCursor = 0;
  private historyEnd = 0;
  private deliveredCursor = 0;

  constructor(
    private readonly client: FlowClient,
    private readonly reconnectMs = 1500,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ProjectionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  clearError() {
    this.update({ error: null });
  }

  async list(more = false) {
    try {
      const page = await this.client.list(
        more && this.state.nextListCursor
          ? { before: this.state.nextListCursor }
          : {},
      );
      this.update({
        tasks: more
          ? [
              ...new Map(
                [...this.state.tasks, ...page.tasks].map((task) => [
                  task.id,
                  task,
                ]),
              ).values(),
            ]
          : page.tasks,
        nextListCursor: page.nextCursor,
      });
    } catch (error) {
      this.update({ error: message(error) });
    }
  }

  async select(id: string) {
    this.disconnect();
    this.selectedId = id;
    const generation = this.generation;
    this.update({
      task: null,
      details: {},
      olderAvailable: false,
      connection: this.online ? "connecting" : "disconnected",
      error: null,
    });
    try {
      const snapshot = await this.client.show(id);
      if (generation !== this.generation) return;
      this.applySnapshot(snapshot);
      if (this.online) {
        this.observer = new AbortController();
        void this.observe(id, generation, this.observer.signal);
      }
    } catch (error) {
      if (generation === this.generation)
        this.update({ connection: "disconnected", error: message(error) });
    }
  }

  setOnline(online: boolean) {
    this.online = online;
    if (!online) {
      // Offline pauses observation without invalidating the selected task or its reads.
      this.observer?.abort();
      this.update({ connection: "disconnected" });
      return;
    }
    const id = this.state.task?.id;
    if (!id) {
      if (this.selectedId) void this.select(this.selectedId);
      return;
    }
    this.observer?.abort();
    this.observer = new AbortController();
    this.update({ connection: "reconnecting" });
    void this.observe(id, this.generation, this.observer.signal);
  }

  clearSelection() {
    this.selectedId = null;
    this.disconnect();
    this.update({ task: null, details: {}, olderAvailable: false });
  }

  disconnect() {
    this.generation += 1;
    this.observer?.abort();
    this.detailRequests.clear();
    this.update({ connection: "disconnected" });
  }

  private applySnapshot(task: TaskSnapshot) {
    this.deliveredCursor = task.entries.at(-1)?.cursor ?? 0;
    this.historyCursor = 0;
    this.historyEnd = task.entries[0]?.cursor ?? 0;
    this.update({
      task,
      olderAvailable: task.hasMore,
      connection: this.online ? "live" : "disconnected",
    });
    this.updateSummary(task);
  }

  private updateSummary(task: TaskSummary) {
    const tasks = this.state.tasks.some((item) => item.id === task.id)
      ? this.state.tasks.map((item) => (item.id === task.id ? task : item))
      : [task, ...this.state.tasks];
    this.update({
      tasks,
      ...(this.state.task?.id === task.id
        ? { task: { ...this.state.task, ...task } }
        : {}),
    });
  }

  private applyPage(page: EventPage) {
    if (!this.state.task) return;
    this.deliveredCursor = page.nextCursor;
    this.update({
      task: {
        ...this.state.task,
        ...page.task,
        entries: mergeEntries(this.state.task.entries, page.entries),
        pendingDecision: page.pendingDecision,
        usage: page.usage,
        watermark: page.watermark,
      },
      connection: "live",
    });
    this.updateSummary(page.task);
  }

  private async observe(id: string, generation: number, signal: AbortSignal) {
    while (!signal.aborted && generation === this.generation) {
      try {
        for await (const page of this.client.watch(
          id,
          this.deliveredCursor,
          signal,
        )) {
          if (signal.aborted || generation !== this.generation) return;
          if (page.reset) {
            const snapshot = await this.client.show(id);
            if (signal.aborted || generation !== this.generation) return;
            this.applySnapshot(snapshot);
            break;
          }
          this.applyPage(page);
        }
      } catch (error) {
        if (signal.aborted) return;
        // A transport failure changes observation only; task lifecycle stays at the center.
        this.update({ connection: "reconnecting" });
      }
      if (signal.aborted) return;
      this.update({ connection: "reconnecting" });
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, this.reconnectMs);
        signal.addEventListener("abort", finish, { once: true });
      });
    }
  }

  async loadEarlier() {
    const id = this.state.task?.id;
    if (!id || !this.state.olderAvailable) return;
    const generation = this.generation;
    try {
      const page = await this.client.events(id, this.historyCursor);
      if (generation !== this.generation || !this.state.task) return;
      this.historyCursor = page.nextCursor;
      this.update({
        task: {
          ...this.state.task,
          entries: mergeEntries(page.entries, this.state.task.entries),
        },
        olderAvailable: page.hasMore && page.nextCursor < this.historyEnd - 1,
      });
    } catch (error) {
      if (generation === this.generation)
        this.update({ error: message(error) });
    }
  }

  loadDetail(id: string): Promise<void> {
    if (this.state.details[id]?.data) return Promise.resolve();
    const existing = this.detailRequests.get(id);
    if (existing) return existing;
    const generation = this.generation;
    this.update({
      details: { ...this.state.details, [id]: { loading: true } },
    });
    const request = this.client
      .detail(id)
      .then((data) => {
        if (generation === this.generation)
          this.update({ details: { ...this.state.details, [id]: { data } } });
      })
      .catch((error) => {
        if (generation === this.generation)
          this.update({
            details: { ...this.state.details, [id]: { error: message(error) } },
          });
      })
      .finally(() => {
        if (this.detailRequests.get(id) === request)
          this.detailRequests.delete(id);
      });
    this.detailRequests.set(id, request);
    return request;
  }

  private async command<T>(
    identity: string,
    execute: (key: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (this.state.pending) return;
    const key = this.commandKeys.get(identity) ?? crypto.randomUUID();
    this.commandKeys.set(identity, key);
    this.update({ pending: true, error: null });
    try {
      const result = await execute(key);
      this.commandKeys.delete(identity);
      return result;
    } catch (error) {
      this.update({
        error: `${message(error)}. If the response was lost, retry the same action; its request key is preserved.`,
      });
    } finally {
      this.update({ pending: false });
    }
  }

  async submit(input: TaskSubmission): Promise<string | undefined> {
    const result = await this.command(
      `submit:${JSON.stringify(input)}`,
      (key) => this.client.submit(input, key),
    );
    if (!result) return;
    this.updateSummary(result.task);
    await this.select(result.task.id);
    return result.task.id;
  }

  async decide(answer: "approve" | "reject") {
    const task = this.state.task;
    if (!task?.pendingDecision) return;
    const decisionId = task.pendingDecision.id;
    const result = await this.command(
      `decision:${task.id}:${decisionId}:${answer}`,
      (key) => this.client.decide(task.id, { decisionId, answer }, key),
    );
    if (result && this.state.task?.id === task.id) this.updateSummary(result);
  }

  async cancel() {
    const id = this.state.task?.id;
    if (!id) return;
    const result = await this.command(`cancel:${id}`, (key) =>
      this.client.cancel(id, key),
    );
    if (result && this.state.task?.id === id) this.updateSummary(result);
  }
}
