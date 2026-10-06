import { FlowApiError, type FlowClient } from "@flow/client";
import { executionProfileReferenceSchema, type ExecutionProfilePage } from "@flow/contracts";
import { configuredSelection, type Immutable } from "./selection";

export interface ExecutionProfileCatalogSnapshot {
  readonly profiles: Immutable<ExecutionProfilePage["profiles"]>;
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly canLoadMore: boolean;
}
export interface ExecutionProfileCatalog {
  getSnapshot(): ExecutionProfileCatalogSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  dispose(): void;
}
const empty: ExecutionProfileCatalogSnapshot = Object.freeze({ profiles: Object.freeze([]), nextCursor: null, loading: false, error: null, loaded: false, stale: true, canLoadMore: false });
const limit = 20;

function readPage(page: ExecutionProfilePage, after: string | null) {
  if (!Array.isArray(page?.profiles) || page.profiles.length > limit) throw new Error("Invalid execution profile page");
  const profiles = page.profiles.map(profile => configuredSelection(profile).profile);
  let previous = after;
  for (const profile of profiles) {
    if (previous !== null && profile.reference.id <= previous) throw new Error("Execution profile pagination did not advance");
    previous = profile.reference.id;
  }
  if (page.nextCursor !== null) {
    executionProfileReferenceSchema.shape.id.parse(page.nextCursor);
    if (page.nextCursor !== profiles.at(-1)?.reference.id) throw new Error("Invalid execution profile cursor");
  }
  return { profiles, nextCursor: page.nextCursor };
}

/** One connection owns one catalog. Only explicit refresh/loadMore perform reads. */
export function createExecutionProfileCatalog(port: Pick<FlowClient, "executionProfiles">): ExecutionProfileCatalog {
  let snapshot = empty, generation = 0, disposed = false, canAppend = false;
  let request: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ExecutionProfileCatalogSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  };
  async function load(append: boolean) {
    if (disposed || (append && (!canAppend || snapshot.loading || !snapshot.nextCursor))) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const current = ++generation, after = append ? snapshot.nextCursor : null;
    if (!append) canAppend = false;
    publish({ loading: true, canLoadMore: false, error: null, ...(!append ? { stale: true } : {}) });
    try {
      const page = readPage(await port.executionProfiles({ limit, ...(after ? { after } : {}) }, controller.signal), after);
      if (disposed || current !== generation) return;
      canAppend = true;
      publish({ profiles: Object.freeze(append ? [...snapshot.profiles, ...page.profiles] : page.profiles), nextCursor: page.nextCursor, loaded: true, stale: false, loading: false, canLoadMore: page.nextCursor !== null });
    } catch (error) {
      if (disposed || current !== generation) return;
      publish({ loading: false, stale: true, canLoadMore: canAppend && snapshot.nextCursor !== null, error: error instanceof FlowApiError && error.status === 401 ? "Access expired. Reconnect or refresh with authorized access." : "Execution profiles could not be loaded. Retry the directory request." });
    } finally {
      if (current === generation) request = undefined;
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => load(false),
    loadMore: () => load(true),
    dispose() {
      if (disposed) return;
      disposed = true; generation++; request?.abort(); request = undefined; canAppend = false;
      publish(empty); listeners.clear();
    },
  };
}
