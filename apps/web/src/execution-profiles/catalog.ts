import { FlowApiError, type FlowClient } from "@flow/client";
import { claudeMessageSettingsCatalogPageSchema, executionProfileReferenceSchema, type ClaudeMessageSettingsExecutionProfile, type ExecutionProfilePage } from "@flow/contracts";
import { readDirectoryProfile, readMessageSettingsProfile, type DirectoryProfile, type Immutable } from "./selection";

interface CatalogSnapshot<Profile> {
  readonly profiles: readonly Profile[];
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly canLoadMore: boolean;
}
interface Catalog<Profile> {
  getSnapshot(): CatalogSnapshot<Profile>;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  dispose(): void;
}
export type ExecutionProfileCatalogSnapshot = CatalogSnapshot<Immutable<DirectoryProfile>>;
export type ExecutionProfileCatalog = Catalog<Immutable<DirectoryProfile>>;
export type MessageSettingsCatalogSnapshot = CatalogSnapshot<Immutable<ClaudeMessageSettingsExecutionProfile>>;
export type MessageSettingsCatalog = Catalog<Immutable<ClaudeMessageSettingsExecutionProfile>>;
const empty: CatalogSnapshot<never> = Object.freeze({ profiles: Object.freeze([]), nextCursor: null, loading: false, error: null, loaded: false, stale: true, canLoadMore: false });
const limit = 20;

function readPage(page: ExecutionProfilePage, after: string | null) {
  if (!Array.isArray(page?.profiles) || page.profiles.length > limit) throw new Error("Invalid execution profile page");
  const profiles = page.profiles.map(readDirectoryProfile);
  assertAdvancing(profiles, after);
  if (page.nextCursor !== null) {
    executionProfileReferenceSchema.shape.id.parse(page.nextCursor);
    if (page.nextCursor !== profiles.at(-1)?.reference.id) throw new Error("Invalid execution profile cursor");
  }
  return { profiles, nextCursor: page.nextCursor };
}

function assertAdvancing(profiles: readonly { readonly reference: { readonly id: string } }[], after: string | null) {
  let previous = after;
  for (const profile of profiles) {
    if (previous !== null && profile.reference.id <= previous) throw new Error("Execution profile pagination did not advance");
    previous = profile.reference.id;
  }
}

/** One connection owns one catalog. Only explicit refresh/loadMore perform reads. */
export function createExecutionProfileCatalog(port: Pick<FlowClient, "executionProfiles">): ExecutionProfileCatalog {
  return createCatalog((options, signal) => port.executionProfiles(options, signal), readPage);
}

/** Pass a bound client closure. This explicit protocol never falls back to the legacy catalog. */
export function createMessageSettingsCatalog(reader: FlowClient["claudeMessageSettingsProfiles"]): MessageSettingsCatalog {
  return createCatalog(reader, (input, after) => {
    const page = claudeMessageSettingsCatalogPageSchema.parse(input);
    if (page.profiles.length > limit) throw new Error("Message settings page exceeds the requested limit");
    const profiles = page.profiles.map(entry => readMessageSettingsProfile(entry));
    assertAdvancing(profiles, after);
    return { profiles, nextCursor: page.nextCursor };
  });
}

function createCatalog<Page, Profile>(
  reader: (options: { after?: string; limit: number }, signal: AbortSignal) => Promise<Page>,
  read: (page: Page, after: string | null) => { profiles: readonly Profile[]; nextCursor: string | null },
): Catalog<Profile> {
  let snapshot: CatalogSnapshot<Profile> = empty;
  let generation = 0, disposed = false, canAppend = false;
  let request: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<CatalogSnapshot<Profile>>) => {
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
      const page = read(await reader({ limit, ...(after ? { after } : {}) }, controller.signal), after);
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
