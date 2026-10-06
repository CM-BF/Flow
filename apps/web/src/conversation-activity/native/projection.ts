import { parseNativeActivityPage as validatePage, parseNativeActivityBody as validateBody } from '@flow/interaction/activity';
import { type NativeActivity, type NativeActivityPage, type TaskSummary } from "@flow/contracts";
import type { ActivityScope } from "../projection";

export interface NativeActivityPort {
  readPage(after: string | null, signal: AbortSignal): Promise<NativeActivityPage>;
  readBody(id: string, signal: AbortSignal): Promise<NativeActivity>;
}
interface Page extends NativeActivityPage { after: string | null; stale: boolean }
export interface NativeActivityState {
  scope: Readonly<ActivityScope>;
  task: TaskSummary;
  active: boolean;
  pages: readonly Page[];
  index: number;
  loading: boolean;
  error: string | null;
  bodies: Readonly<Record<string, { data?: NativeActivity; loading?: boolean; error?: string }>>;
}
const stamp = (task: TaskSummary) => `${task.updatedAt}|${task.status}|${task.verificationStatus}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Native activity could not be read.";
function readWithSignal<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { if (signal.aborted) throw signal.reason; return read(); }).then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}

/** Owns only a bounded displayed page refresh; pagination is always a user action. */
export class NativeActivityProjection {
  private state: NativeActivityState;
  private listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private generation = 0;
  private disposed = false;
  private flight: Promise<void> | undefined;
  private bodyFlights = new Map<string, Promise<void>>();
  private refreshQueued = false;
  constructor(scope: ActivityScope, task: TaskSummary, private port: NativeActivityPort) {
    if (task.id !== scope.taskId || Object.values(scope).some(value => !value)) throw Error("Native activity requires a complete scope.");
    this.state = { scope: Object.freeze({ ...scope }), task: { ...task }, active: false, pages: [], index: 0, loading: false, error: null, bodies: {} };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<NativeActivityState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  private current(generation: number) { return !this.disposed && this.state.active && generation === this.generation; }
  updateTask(task: TaskSummary) {
    if (task.id !== this.state.scope.taskId) throw Error("Native activity task changed.");
    const changed = stamp(task) !== stamp(this.state.task);
    this.update({ task: { ...task }, ...(changed ? { pages: this.state.pages.map(page => ({ ...page, stale: true })) } : {}) });
    if (changed && this.state.active) this.queueRefresh();
  }
  private queueRefresh() {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    queueMicrotask(() => { this.refreshQueued = false; if (this.state.active) void this.refresh(); });
  }
  setActive(active: boolean) {
    if (this.disposed || this.state.active === active) return;
    this.update({ active });
    if (!active) this.invalidate();
    else if (!this.state.pages[this.state.index] || this.state.pages[this.state.index]?.stale) void this.refresh();
  }
  private invalidate() {
    this.generation++; this.lifetime.abort(); this.lifetime = new AbortController(); this.flight = undefined; this.bodyFlights.clear();
    this.update({ loading: false, bodies: Object.fromEntries(Object.entries(this.state.bodies).map(([id, body]) => [id, { ...body, loading: false }])) });
  }
  refresh(): Promise<void> {
    if (!this.state.active || this.disposed) return Promise.resolve();
    if (this.flight) return this.flight;
    const generation = this.generation, index = this.state.index;
    const after = this.state.pages[index]?.after ?? (index ? this.state.pages[index - 1]?.nextCursor : null) ?? null;
    const observedStamp = stamp(this.state.task);
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15_000)]);
    this.update({ loading: true, error: null });
    const flight = readWithSignal(() => this.port.readPage(after, signal), signal).then(raw => {
      if (!this.current(generation)) return;
      validatePage(raw, this.state.scope.taskId, after);
      const page = structuredClone(raw);
      const known = new Map(this.state.pages.flatMap(page => page.activities.map(row => [row.id, row] as const)));
      for (const row of page.activities) if (known.has(row.id) && identity(known.get(row.id)!) !== identity(row)) throw Error("Native activity observation changed identity.");
      const oldPage = this.state.pages[index];
      if (oldPage?.activities.some((row, offset) => page.activities[offset]?.id !== row.id)) throw Error("Native activity page changed its immutable order.");
      const otherIds = new Set(this.state.pages.flatMap((old, offset) => offset === index ? [] : old.activities.map(row => row.id)));
      if (page.activities.some(row => otherIds.has(row.id))) throw Error("Native activity pages overlap.");
      const pages = [...this.state.pages];
      pages[index] = { ...page, after, stale: stamp(this.state.task) !== observedStamp };
      // A formerly terminal page may acquire new rows; downstream pages are only created explicitly.
      this.update({ pages, error: null });
    }).catch(error => { if (this.current(generation)) this.update({ error: errorMessage(error) }); }).finally(() => {
      if (this.flight !== flight) return;
      this.flight = undefined; this.update({ loading: false });
      if (this.current(generation) && stamp(this.state.task) !== observedStamp) this.queueRefresh();
    });
    this.flight = flight; return flight;
  }
  async showPage(index: number) {
    if (!Number.isInteger(index) || index < 0 || index > this.state.pages.length || (index === this.state.pages.length && !this.state.pages.at(-1)?.nextCursor)) return;
    if (index !== this.state.index) { this.invalidate(); this.update({ index, error: null }); }
    if (!this.state.pages[index] || this.state.pages[index]?.stale) await this.refresh();
  }
  loadBody(id: string): Promise<void> {
    if (!this.state.active || this.disposed) return Promise.resolve();
    const header = this.state.pages[this.state.index]?.activities.find(row => row.id === id);
    if (!header) return Promise.reject(Error("Native activity is not in the displayed page."));
    if (header.phase === "redacted" || !header.detail) return Promise.resolve();
    if (this.state.bodies[id]?.data) return Promise.resolve();
    const existing = this.bodyFlights.get(id); if (existing) return existing;
    const generation = this.generation;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15_000)]);
    this.update({ bodies: { ...this.state.bodies, [id]: { loading: true } } });
    const flight = readWithSignal(() => this.port.readBody(id, signal), signal).then(data => {
      if (!this.current(generation)) return;
      validateBody(data, header);
      this.update({ bodies: { ...this.state.bodies, [id]: { data: structuredClone(data) } } });
    }).catch(error => { if (this.current(generation)) this.update({ bodies: { ...this.state.bodies, [id]: { error: errorMessage(error) } } }); });
    this.bodyFlights.set(id, flight);
    void flight.finally(() => { if (this.bodyFlights.get(id) === flight) this.bodyFlights.delete(id); });
    return flight;
  }
  dispose() { if (this.disposed) return; this.setActive(false); this.disposed = true; this.lifetime.abort(); this.listeners.clear(); }
}
