import { MAX_DETAIL_BYTES, MAX_PAGE_SIZE, idSchema, type Detail, type EventPage, type TaskSummary, type TimelineEntry } from "@flow/contracts";

export interface ActivityScope {
  connectionId: string;
  viewId: string;
  conversationId: string;
  turnId: string;
  taskId: string;
}
/** The host binds task events and conversation/turn-scoped details, retaining its client/token. */
export interface ActivityPort {
  readEvents(after: number): Promise<EventPage>;
  readDetail(id: string, signal: AbortSignal): Promise<Detail>;
}
interface ActivityDetail { loading?: boolean; data?: Detail; error?: string }
export interface ActivityState {
  scope: Readonly<ActivityScope>;
  task: TaskSummary;
  active: boolean;
  online: boolean;
  loaded: boolean;
  loading: boolean;
  loadedAt: string | null;
  stale: boolean;
  entries: TimelineEntry[];
  cursor: number;
  watermark: number;
  hasMore: boolean;
  error: string | null;
  details: Record<string, ActivityDetail>;
}
const message = (error: unknown) => error instanceof Error ? error.message : "Activity could not be read.";
const cursor = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const validTime = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

function validateTask(task: TaskSummary, taskId: string) {
  if (!task || task.id !== taskId || !validTime(task.updatedAt) || !validTime(task.createdAt)
    || !["queued", "running", "waiting", "cancel_requested", "succeeded", "failed", "cancelled", "uncertain"].includes(task.status)
    || !["pending", "passed", "failed"].includes(task.verificationStatus)) throw Error("Activity does not match the bound task.");
}
function validatePage(page: EventPage, taskId: string, after: number) {
  validateTask(page?.task, taskId);
  if (!Array.isArray(page.entries) || page.entries.length > MAX_PAGE_SIZE || !cursor(page.nextCursor) || !cursor(page.watermark) || typeof page.hasMore !== "boolean"
    || (page.reset !== undefined && typeof page.reset !== "boolean")) throw Error("Invalid activity page cursor.");
  if (page.reset) {
    if (after === 0 || page.entries.length || page.nextCursor !== 0 || page.hasMore) throw Error("Invalid activity reset. Refresh explicitly to retry.");
    return;
  }
  if (page.nextCursor < after || page.nextCursor > page.watermark || (page.hasMore && page.nextCursor <= after)
    || page.hasMore !== (page.nextCursor < page.watermark)) throw Error("Activity cursor did not advance consistently. Refresh to retry.");
  let last = 0;
  for (const entry of page.entries) {
    if (!entry || !idSchema.safeParse(entry.id).success || !cursor(entry.cursor) || entry.cursor < 1 || entry.cursor <= last
      || entry.cursor > page.nextCursor || !validTime(entry.createdAt)
      || (entry.kind === "text" ? typeof entry.text !== "string" : entry.kind !== "reference" || !idSchema.safeParse(entry.reference?.id).success || typeof entry.reference.title !== "string"))
      throw Error("Invalid activity entry identity or order.");
    last = entry.cursor;
  }
  if (page.nextCursor !== Math.max(after, last)) throw Error("Activity cursor does not match the returned entries.");
}
function validateDetail(value: Detail, id: string) {
  if (!value || value.id !== id || typeof value.title !== "string" || typeof value.content !== "string" || typeof value.mediaType !== "string"
    || !["detail", "artifact", "verification", "usage", "session"].includes(value.kind)) throw Error("Detail identity does not match this reference.");
  if (new TextEncoder().encode(value.content).byteLength > MAX_DETAIL_BYTES) throw Error("Detail exceeds the public 1 MiB response limit.");
}
/** Stop awaiting an old lifetime even when the public events method cannot abort its HTTP request. */
function awaitSignal<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener("abort", abort);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    try {
      // Attach both handlers even if the reader synchronously invalidates this lifetime.
      operation().then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    } catch (error) { cleanup(); reject(error); }
  });
}

export class ConversationActivityProjection {
  private state: ActivityState;
  private readonly listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private detailLifetime = new AbortController();
  private detailGeneration = 0;
  private generation = 0;
  private disposed = false;
  private readFlight: Promise<void> | undefined;
  private readonly detailFlights = new Map<string, Promise<void>>();
  private observedTask: TaskSummary | null = null;

  constructor(scope: ActivityScope, task: TaskSummary, private readonly port: ActivityPort) {
    if ([scope.connectionId, scope.viewId, scope.conversationId, scope.turnId, scope.taskId].some(value => typeof value !== "string" || !value)) throw Error("Activity requires a complete host scope.");
    validateTask(task, scope.taskId);
    this.state = { scope: Object.freeze({ ...scope }), task: { ...task }, active: false, online: true,
      loaded: false, loading: false, loadedAt: null, stale: false, entries: [], cursor: 0, watermark: 0, hasMore: false, error: null, details: {} };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ActivityState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  private readable() { return !this.disposed && this.state.active && this.state.online; }
  private current(generation: number) { return this.readable() && generation === this.generation; }
  private behindHost() {
    const observed = this.observedTask, host = this.state.task;
    return Boolean(observed && (Date.parse(host.updatedAt) > Date.parse(observed.updatedAt)
      || (host.updatedAt === observed.updatedAt && (host.status !== observed.status || host.verificationStatus !== observed.verificationStatus))));
  }
  updateTask(task: TaskSummary) {
    validateTask(task, this.state.scope.taskId);
    this.update({ task: { ...task } });
    if (this.state.loaded && this.behindHost()) this.update({ stale: true });
  }
  setActive(active: boolean) {
    if (this.state.active === active || this.disposed) return;
    this.update({ active });
    if (!active) this.invalidate();
    else if (!this.state.loaded || this.state.stale) void this.refresh();
  }
  setOnline(online: boolean) {
    if (this.state.online === online || this.disposed) return;
    this.update({ online });
    if (!online) this.invalidate();
    else if (this.state.active) void this.refresh();
  }
  private invalidate() {
    this.generation++; this.lifetime.abort(); this.lifetime = new AbortController();
    this.readFlight = undefined; this.cancelDetails();
    this.update({ loading: false, stale: this.state.loaded, details: Object.fromEntries(Object.entries(this.state.details).map(([id, value]) => [id, { ...value, loading: false }])) });
  }
  private cancelDetails() {
    this.detailGeneration++; this.detailLifetime.abort(); this.detailLifetime = new AbortController(); this.detailFlights.clear();
  }
  refresh(): Promise<void> {
    if (!this.readable()) return Promise.resolve();
    if (this.readFlight) return this.readFlight;
    const generation = this.generation;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15_000)]);
    this.update({ loading: true, error: null });
    const flight = this.read(this.state.cursor, generation, signal).catch(error => {
      if (this.current(generation)) this.update({ error: message(error), stale: this.state.loaded });
    }).finally(() => {
      if (this.readFlight === flight) { this.readFlight = undefined; this.update({ loading: false }); }
    });
    this.readFlight = flight;
    return flight;
  }
  loadMore(): Promise<void> { return this.state.hasMore ? this.refresh() : Promise.resolve(); }
  private async read(after: number, generation: number, signal: AbortSignal): Promise<void> {
    const page = await awaitSignal(() => this.port.readEvents(after), signal);
    if (!this.current(generation)) return;
    validatePage(page, this.state.scope.taskId, after);
    if (page.reset) {
      this.cancelDetails(); this.observedTask = null;
      this.update({ entries: [], details: {}, cursor: 0, watermark: 0, hasMore: false, loaded: false, loadedAt: null, stale: true });
      // The second request starts at zero; another reset is rejected by validation, never looped.
      await this.read(0, generation, signal); return;
    }
    const entries = new Map(this.state.entries.map(entry => [entry.id, entry]));
    const cursors = new Map(this.state.entries.map(entry => [entry.cursor, entry.id]));
    for (const entry of page.entries) {
      const previous = entries.get(entry.id);
      if ((previous && JSON.stringify(previous) !== JSON.stringify(entry)) || (cursors.has(entry.cursor) && cursors.get(entry.cursor) !== entry.id)
        || (entry.cursor <= after && !previous)) throw Error("Activity entry conflicts with the known cursor. Refresh cannot silently replace it.");
      entries.set(entry.id, previous ?? entry); cursors.set(entry.cursor, entry.id);
    }
    this.observedTask = page.task;
    this.update({ entries: [...entries.values()].sort((a,b) => a.cursor - b.cursor), cursor: page.nextCursor, watermark: page.watermark,
      hasMore: page.hasMore, loaded: true, loadedAt: new Date().toISOString(), stale: this.behindHost(), error: null });
  }
  async loadDetail(id: string): Promise<void> {
    if (!this.readable()) return;
    if (!this.state.entries.some(entry => entry.kind === "reference" && entry.reference.id === id)) throw Error("This reference is not in the bound turn's loaded activity.");
    if (this.state.details[id]?.data) return;
    const existing = this.detailFlights.get(id); if (existing) return existing;
    const generation = this.generation;
    const detailGeneration = this.detailGeneration;
    const signal = AbortSignal.any([this.lifetime.signal, this.detailLifetime.signal, AbortSignal.timeout(15_000)]);
    this.update({ details: { ...this.state.details, [id]: { loading: true } } });
    const request = awaitSignal(() => this.port.readDetail(id, signal), signal).then(data => {
      if (!this.current(generation) || detailGeneration !== this.detailGeneration || !this.state.entries.some(entry => entry.kind === "reference" && entry.reference.id === id)) return;
      validateDetail(data, id);
      this.update({ details: { ...this.state.details, [id]: { data } } });
    }).catch(error => {
      if (this.current(generation) && detailGeneration === this.detailGeneration) this.update({ details: { ...this.state.details, [id]: { error: message(error) } } });
    }).finally(() => { if (this.detailFlights.get(id) === request) this.detailFlights.delete(id); });
    this.detailFlights.set(id, request); return request;
  }
  dispose() {
    if (this.disposed) return;
    this.invalidate(); this.state = { ...this.state, active: false, entries: [], details: {}, loaded: false };
    this.disposed = true; this.lifetime.abort(); this.listeners.clear();
  }
}
export const createConversationActivity = (scope: ActivityScope, task: TaskSummary, port: ActivityPort) => new ConversationActivityProjection(scope, task, port);
