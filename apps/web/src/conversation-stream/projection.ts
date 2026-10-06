import type { AssistantStreamPage, AssistantStreamPatchPage, ConversationTurn } from "@flow/contracts";
import { applyPatchPage, emptyPatchState, readStreamMetadata, validateMetadataPartition, type PatchState } from "./patches";
import { readCanonicalFinal, type CanonicalFinal } from "./messages";

export interface StreamScope { connectionId: string; viewId: string; conversationId: string; turnId: string; taskId: string }
/** Bound by the host to this exact turn/task; clients and credentials stay private. */
export interface StreamPort {
  readMetadata(options: { after?: string; limit: number }, signal: AbortSignal): Promise<AssistantStreamPage>;
  readPatches(options: { attemptId: string; after: number; limit: number }, signal: AbortSignal): Promise<AssistantStreamPatchPage>;
}
export interface StreamHost {
  turn: ConversationTurn; capability: boolean | undefined; protocol: "patch-v1" | undefined;
  visible: boolean; online: boolean; finalContent?: string;
}
export interface StreamState {
  scope: Readonly<StreamScope>; enabled: boolean; visible: boolean; online: boolean; loading: boolean; stale: boolean;
  metadata: AssistantStreamPage | null; patches: PatchState | null; final: CanonicalFinal | null;
  hasMore: boolean; error: string | null; retryAt: number | null;
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Assistant text could not be read.";
function waitFor<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener("abort", abort, { once: true });
    try { read().then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); }); }
    catch (error) { signal.removeEventListener("abort", abort); reject(error); }
  });
}
export class ConversationStreamProjection {
  private state: StreamState;
  private host: StreamHost | null = null;
  private listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private generation = 0;
  private disposed = false;
  private flight: Promise<void> | undefined;
  private scheduled: ReturnType<typeof setTimeout> | undefined;
  private invalidated = false;
  private failures = 0;

  constructor(scope: StreamScope, private readonly port: StreamPort) {
    if ([scope.connectionId, scope.viewId, scope.conversationId, scope.turnId, scope.taskId].some(value => typeof value !== "string" || !value)) throw Error("Stream requires a complete host identity.");
    this.state = { scope: Object.freeze({ ...scope }), enabled: false, visible: false, online: true, loading: false, stale: false,
      metadata: null, patches: null, final: null, hasMore: false, error: null, retryAt: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StreamState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  private readable() { return !this.disposed && this.state.enabled && this.state.visible && this.state.online; }
  private current(generation: number) { return this.readable() && generation === this.generation; }
  updateHost(host: StreamHost) {
    const scope = this.state.scope, turn = host.turn;
    if (turn.id !== scope.turnId || turn.conversationId !== scope.conversationId || turn.task.id !== scope.taskId) throw Error("Stream host does not match its bound turn.");
    if (this.disposed) return;
    const before = this.host, wasReadable = this.readable(); this.host = host;
    const enabled = host.capability === true && host.protocol === "patch-v1";
    this.publish({ enabled, visible: host.visible, online: host.online });
    if (!this.readable()) {
      this.pause();
      if (!enabled) this.publish({ metadata: null, patches: null, final: null, hasMore: false });
      return;
    }
    if (!wasReadable) { void this.refresh(); return; }
    if (!before || before.turn.task.updatedAt !== turn.task.updatedAt || before.turn.task.status !== turn.task.status
      || before.turn.assistant !== turn.assistant || before.finalContent !== host.finalContent) this.invalidate();
  }
  private pause() {
    this.generation++; this.lifetime.abort(); this.lifetime = new AbortController(); this.flight = undefined;
    if (this.scheduled) clearTimeout(this.scheduled); this.scheduled = undefined;
    this.publish({ loading: false, stale: Boolean(this.state.metadata) });
  }
  invalidate() {
    if (this.disposed) return;
    this.invalidated = true; this.publish({ stale: Boolean(this.state.metadata) });
    this.schedule();
  }
  private schedule() {
    if (!this.readable() || this.flight || this.scheduled || this.failures >= 3) return;
    const delay = Math.max(250, (this.state.retryAt ?? 0) - Date.now());
    this.scheduled = setTimeout(() => { this.scheduled = undefined; void this.start(false); }, delay);
  }
  refresh(): Promise<void> { return this.start(true); }
  private start(explicit: boolean): Promise<void> {
    if (!this.readable()) return Promise.resolve();
    if (this.flight) return this.flight;
    if (!explicit && (this.failures >= 3 || (this.state.retryAt ?? 0) > Date.now())) { this.schedule(); return Promise.resolve(); }
    if (explicit) this.failures = 0;
    if (this.scheduled) clearTimeout(this.scheduled); this.scheduled = undefined;
    this.invalidated = false;
    const generation = this.generation, signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15_000)]);
    this.publish({ loading: true, error: null });
    if (!this.current(generation) || signal.aborted) return Promise.resolve();
    const flight = this.read(generation, signal).then(() => {
      if (this.current(generation)) this.failures = 0;
    }).catch(error => {
      if (this.current(generation)) {
        this.failures++; this.publish({ error: errorMessage(error), stale: true, retryAt: Date.now() + Math.min(8000, 500 * 2 ** (this.failures - 1)) });
      }
    }).finally(() => {
      if (this.flight !== flight) return;
      this.flight = undefined; this.publish({ loading: false });
      if (this.invalidated || (this.state.hasMore && !this.state.error)) this.schedule();
    });
    this.flight = flight; return flight;
  }
  private async metadata(signal: AbortSignal): Promise<AssistantStreamPage> {
    let combined: AssistantStreamPage | null = null, after: string | undefined;
    for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
      const page = await readStreamMetadata(await waitFor(() => this.port.readMetadata({ ...(after ? { after } : {}), limit: 100 }, signal), signal), this.state.scope.taskId);
      if (signal.aborted) throw signal.reason;
      if (combined) {
        if (page.attemptId !== combined.attemptId || page.finalMessageId !== combined.finalMessageId
          || JSON.stringify(page.settlement) !== JSON.stringify(combined.settlement)) throw Error("Stream metadata changed during pagination. Refresh to retry.");
        if (page.blocks.some(block => combined!.blocks.some(other => other.id === block.id))
          || (page.blocks[0]?.firstSequence ?? Infinity) <= (combined.blocks.at(-1)?.firstSequence ?? 0)) throw Error("Stream metadata page overlaps its cursor.");
        combined = { ...page, blocks: [...combined.blocks, ...page.blocks] };
      } else combined = page;
      if (combined.blocks.length > 256) throw Error("Stream metadata exceeds its block budget.");
      if (page.nextCursor === null) { validateMetadataPartition(combined); return combined; }
      if (page.nextCursor === after) throw Error("Stream metadata cursor stalled.");
      after = page.nextCursor;
    }
    throw Error("Stream metadata exceeds its page budget.");
  }
  private async read(generation: number, signal: AbortSignal) {
    let metadata = await this.metadata(signal);
    if (!this.current(generation) || signal.aborted) return;
    const previous = this.state.metadata;
    if (previous && Date.parse(metadata.taskUpdatedAt) < Date.parse(previous.taskUpdatedAt)) throw Error("Stream metadata moved backwards.");
    let patches = this.state.patches;
    if (!metadata.attemptId) { this.publish({ metadata, patches: null, final: null, hasMore: false, stale: false }); return; }
    if (!patches || patches.attemptId !== metadata.attemptId) {
      patches = emptyPatchState(metadata.taskId, metadata.attemptId);
      this.publish({ metadata, patches, final: null, hasMore: false });
    }
    let hasMore = false;
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const currentPatches = patches;
      const page = await waitFor(() => this.port.readPatches({ attemptId: currentPatches.attemptId, after: currentPatches.cursor, limit: 8 }, signal), signal);
      if (!this.current(generation) || signal.aborted) return;
      // Metadata and patches are separate snapshots: a newly committed block requires a bounded metadata refresh.
      if (Array.isArray(page?.patches) && page.patches.some(patch => !metadata.blocks.some(block => block.id === patch?.streamId))) {
        const refreshed = await this.metadata(signal);
        if (!this.current(generation) || signal.aborted) return;
        if (refreshed.attemptId !== metadata.attemptId) throw Error("Stream attempt changed while reading patches. Refresh to retry.");
        metadata = refreshed;
      }
      const result = await applyPatchPage(patches, page, patches.cursor, metadata.blocks);
      if (!this.current(generation) || signal.aborted) return;
      patches = result.state; hasMore = result.hasMore;
      const host = this.host;
      if (!host) return;
      const final = await readCanonicalFinal(host.turn, host.finalContent);
      if (!this.current(generation) || signal.aborted) return;
      this.publish({ metadata, patches, final, hasMore, error: null, retryAt: null, stale: false });
      if (!hasMore) {
        if (metadata.blocks.some(reference => (patches!.blocks.find(block => block.streamId === reference.id)?.revision ?? 0) < reference.revision))
          throw Error("Stream patch history has not reached the recorded metadata. Refresh to retry.");
        break;
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.pause(); this.state = { ...this.state, metadata: null, patches: null, final: null, hasMore: false }; this.disposed = true; this.host = null; this.listeners.clear();
  }
}
export const createConversationStreamProjection = (scope: StreamScope, port: StreamPort) => new ConversationStreamProjection(scope, port);
