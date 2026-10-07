import type { ContextHistoryResponse, ContextHistorySample } from "../../../../packages/contracts/src/context-observation-history.js";
import type { Detail } from "../../../../packages/contracts/src/tasks.js";

/** Supplied by the existing session/view owner, never by a plugin or persisted. */
export interface HistoryTarget {
  readonly connectionId: string;
  readonly viewKey: string;
  readonly conversationId: string;
  readonly taskId: string;
  readonly authorityGeneration: number;
  /** Omit when the conversation projection does not expose the current attempt. */
  readonly expectedAttemptId?: string;
}

/** Private, authorized port. history uses FlowClient.contextHistory's decoder. */
export interface ContextHistoryReaders {
  current(target: HistoryTarget): boolean;
  history(target: HistoryTarget, signal: AbortSignal): Promise<ContextHistoryResponse>;
  detail(target: HistoryTarget, sample: ContextHistorySample, signal: AbortSignal): Promise<Detail>;
}
export interface HistoryReadError {
  readonly kind: "http" | "invalid-response" | "read-failed";
  readonly status?: number;
  readonly code?: string;
}
export interface HistoryState {
  readonly target: Readonly<HistoryTarget> | null;
  readonly available: boolean;
  readonly open: boolean;
  readonly pending: boolean;
  readonly history: Readonly<ContextHistoryResponse> | null;
  readonly detail: Readonly<Detail> | null;
  readonly error: HistoryReadError | null;
}

class InvalidHistoryResponse extends Error {}
function publicError(error: unknown): HistoryReadError {
  if (error instanceof InvalidHistoryResponse || error instanceof Error && error.name === "ZodError") return { kind: "invalid-response" };
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
    const code = "code" in error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(error.code) ? error.code : undefined;
    return { kind: "http", status: error.status, ...(code ? { code } : {}) };
  }
  return { kind: "read-failed" };
}
function freezeCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (part: unknown): void => {
    if (part && typeof part === "object") { Object.values(part).forEach(freeze); Object.freeze(part); }
  };
  freeze(copy); return copy;
}
const key = (target: HistoryTarget | null) => target === null ? "" : JSON.stringify([
  target.connectionId, target.viewKey, target.conversationId, target.taskId, target.authorityGeneration, target.expectedAttemptId,
]);

/** One explicit read at a time, with no polling or ownership of drafts/settings. */
export class ContextHistoryController {
  private state: HistoryState = Object.freeze({ target: null, available: false, open: false, pending: false, history: null, detail: null, error: null });
  private readonly listeners = new Set<() => void>();
  private inflight: AbortController | null = null;
  private generation = 0;
  private disposed = false;
  private openingSignal: AbortSignal | null = null;
  private readonly lifetime: AbortSignal;
  private readonly readers: ContextHistoryReaders;

  constructor(readers: ContextHistoryReaders, lifetime: AbortSignal) {
    this.readers = readers; this.lifetime = lifetime;
    lifetime.addEventListener("abort", this.dispose, { once: true });
    if (lifetime.aborted) this.dispose();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<HistoryState>) {
    if (this.disposed) return;
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach(listener => listener());
  }
  /** Call on projection/host changes, including pane hide and plugin disable. */
  configure(target: HistoryTarget | null, visibleAndEnabled: boolean) {
    if (this.disposed) return;
    const available = target !== null && visibleAndEnabled && this.readers.current(target);
    if (key(target) === key(this.state.target) && available === this.state.available) return;
    this.close();
    this.update({ target: target ? Object.freeze({ ...target }) : null, available });
  }
  private allowed(target: HistoryTarget) {
    return !this.disposed && !this.lifetime.aborted && this.state.available && this.state.open
      && key(target) === key(this.state.target) && this.readers.current(target);
  }
  open(signal?: AbortSignal) {
    const target = this.state.target;
    if (!target || !this.state.available || !this.readers.current(target) || this.disposed || signal?.aborted) return;
    if (this.state.open) return;
    this.openingSignal = signal ?? null;
    signal?.addEventListener("abort", this.close, { once: true });
    this.update({ open: true });
    void this.refresh();
  }
  close = () => {
    this.generation++;
    this.inflight?.abort();
    this.openingSignal?.removeEventListener("abort", this.close); this.openingSignal = null;
    this.update({ open: false, history: null, detail: null, error: null });
  };
  private async read(operation: (target: HistoryTarget, signal: AbortSignal) => Promise<Partial<HistoryState>>) {
    const target = this.state.target;
    if (!target || this.inflight || !this.allowed(target)) return;
    const request = new AbortController(), generation = this.generation;
    this.inflight = request;
    this.update({ pending: true, error: null });
    const current = () => !request.signal.aborted && generation === this.generation && this.allowed(target);
    try {
      const patch = await operation(target, AbortSignal.any([request.signal, this.lifetime]));
      if (current()) this.update(patch);
    } catch (error) {
      if (current()) this.update({ error: publicError(error) });
    } finally {
      // An abort-ignoring reader still occupies this one slot until it settles.
      if (this.inflight === request) { this.inflight = null; this.update({ pending: false }); }
    }
  }
  refresh = async () => {
    if (this.inflight || !this.state.open) return;
    this.update({ history: null, detail: null });
    await this.read(async (target, signal) => {
      const history = await this.readers.history(target, signal);
      if (history.taskId !== target.taskId || target.expectedAttemptId !== undefined && history.attemptId !== target.expectedAttemptId) throw new InvalidHistoryResponse();
      return { history: freezeCopy(history) };
    });
  };
  readDetail = async () => {
    const sample = this.state.history?.latest;
    if (!sample || this.state.detail || this.inflight) return;
    await this.read(async (target, signal) => {
      const detail = await this.readers.detail(target, sample, signal);
      if (detail.id !== sample.detailRef.id || typeof detail.content !== "string" || new TextEncoder().encode(detail.content).byteLength > 1_048_576) throw new InvalidHistoryResponse();
      return { detail: freezeCopy(detail) };
    });
  };
  dispose = () => {
    if (this.disposed) return;
    this.close(); this.update({ target: null, available: false });
    this.disposed = true; this.lifetime.removeEventListener("abort", this.dispose); this.listeners.clear();
  };
}
