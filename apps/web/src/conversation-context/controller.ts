import { idSchema, knowledgeCreateSchema, knowledgeLocatorSchema, knowledgeSearchSchema, type KnowledgeResolved, type KnowledgeSearchHit, type KnowledgeSearchResult } from "@flow/contracts";
import { CONTEXT_BUDGET, citationBytes, citationKey, freezeCitation, freezeContextSelection, utf8Length, type FrozenCitation, type Immutable } from "./selection";

export interface ContextBinding { readonly connectionKey: string; readonly viewId: string; readonly projectId: string }
export interface ContextReadiness { readonly visible: boolean; readonly online: boolean; readonly authorized: boolean; readonly knowledgeContext: boolean }
export interface ContextReadPort {
  search(query: { q: string; limit: number }, signal: AbortSignal): Promise<KnowledgeSearchResult>;
  resolve(citation: FrozenCitation, signal: AbortSignal): Promise<KnowledgeResolved>;
}
export interface SelectedContext { readonly title: string; readonly citation: FrozenCitation }
export interface ContextBody { readonly loading: boolean; readonly error: string | null; readonly data?: Immutable<KnowledgeResolved>; readonly observedAt?: string }
export interface ContextSnapshot {
  readonly binding: ContextBinding;
  readonly readiness: ContextReadiness;
  readonly disabledReason: string | null;
  readonly hits: readonly Immutable<KnowledgeSearchHit>[];
  readonly searched: boolean;
  readonly query: string;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selected: readonly SelectedContext[];
  readonly selectedBytes: number;
  readonly bodies: Readonly<Record<string, ContextBody>>;
}
export interface ContextSelection {
  getSnapshot(): ContextSnapshot;
  subscribe(listener: () => void): () => void;
  setReadiness(value: ContextReadiness): void;
  search(query: string): Promise<void>;
  add(citation: FrozenCitation): void;
  restore(values: readonly SelectedContext[]): void;
  remove(citation: FrozenCitation): void;
  expand(citation: FrozenCitation, options?: { refresh?: boolean }): Promise<void>;
  freeze(): readonly FrozenCitation[];
  dispose(): void;
}
const emptyBodies = Object.freeze({});
const emptyList = Object.freeze([]);
function reason(readiness: ContextReadiness, disposed: boolean) {
  if (disposed) return "This knowledge view is closed.";
  if (!readiness.authorized) return "Knowledge access is unavailable for this view.";
  if (!readiness.knowledgeContext) return "This center does not support knowledge context.";
  if (!readiness.visible) return "Show this view before reading knowledge.";
  if (!readiness.online) return "Reconnect to search or read knowledge. Your selection is kept.";
  return null;
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function validUtf8(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max && !value.includes("\0") && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value) && utf8Length(value) <= max;
}
function readHit(value: unknown, projectId: string): Immutable<KnowledgeSearchHit> {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.excerpt)) throw Error("Invalid knowledge search result.");
  const citation = freezeCitation(value.citation, projectId), source = value.source;
  const title = knowledgeCreateSchema.shape.title.parse(source.title);
  if (source.projectId !== projectId || source.id !== citation.sourceId || source.currentVersion !== citation.version
    || typeof source.createdAt !== "string" || !Number.isFinite(Date.parse(source.createdAt))
    || typeof source.updatedAt !== "string" || !Number.isFinite(Date.parse(source.updatedAt))) throw Error("Invalid knowledge source identity.");
  const locator = knowledgeLocatorSchema.parse(value.excerpt.locator), text = value.excerpt.text;
  if (!validUtf8(text, 512) || utf8Length(text) !== locator.end - locator.start || locator.start < citation.locator.start || locator.end > citation.locator.end
    || (value.matchKind !== "literal" && value.matchKind !== "fts") || typeof value.rank !== "number" || !Number.isFinite(value.rank)) throw Error("Invalid knowledge preview.");
  return Object.freeze({ citation, source: Object.freeze({ projectId, id: citation.sourceId, title, currentVersion: citation.version, createdAt: source.createdAt, updatedAt: source.updatedAt }),
    excerpt: Object.freeze({ text, locator: Object.freeze(locator) }), matchKind: value.matchKind, rank: value.rank });
}
function readSearch(value: KnowledgeSearchResult, projectId: string) {
  if (!value || !Array.isArray(value.hits) || value.hits.length > CONTEXT_BUDGET.hits || typeof value.hasMore !== "boolean") throw Error("Invalid knowledge search page.");
  const hits = value.hits.map(hit => readHit(hit, projectId));
  if (new Set(hits.map(hit => hit.source.id)).size !== hits.length) throw Error("Duplicate knowledge source in search results.");
  return { hits: Object.freeze(hits), hasMore: value.hasMore };
}
function readBody(value: KnowledgeResolved, citation: FrozenCitation): Immutable<KnowledgeResolved> {
  const returned = freezeCitation(value?.citation, citation.projectId);
  if (citationKey(returned) !== citationKey(citation) || !validUtf8(value.text, CONTEXT_BUDGET.bodyBytes)
    || utf8Length(value.text) !== citationBytes(citation) || !Number.isInteger(value.currentVersion) || value.currentVersion < citation.version
    || value.currentVersion > 16 || typeof value.isCurrent !== "boolean" || value.isCurrent !== (value.currentVersion === citation.version)) throw Error("Knowledge content does not match the selected reference.");
  // contentDigest identifies the whole source version; it is not a digest of this chunk.
  return Object.freeze({ citation: returned, text: value.text, isCurrent: value.isCurrent, currentVersion: value.currentVersion });
}

/** Settle local state even when a trusted adapter ignores AbortSignal. */
function readWithDeadline<T>(controller: AbortController, read: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: { ok: true; value: T } | { ok: false; error: unknown }) => {
      if (settled) return;
      settled = true; clearTimeout(timer); controller.signal.removeEventListener("abort", aborted);
      if (result.ok) resolve(result.value); else reject(result.error);
    };
    const aborted = () => finish({ ok: false, error: controller.signal.reason ?? Error("Knowledge read cancelled.") });
    if (controller.signal.aborted) { aborted(); return; }
    controller.signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(() => controller.abort(new DOMException("Knowledge read timed out.", "TimeoutError")), CONTEXT_BUDGET.requestTimeoutMs);
    // Install both settlement handlers before calling the port; late throws/rejections stay handled.
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return read();
    }).then(value => finish({ ok: true, value }), error => finish({ ok: false, error }));
  });
}
const timedOut = (error: unknown) => error instanceof Error && error.name === "TimeoutError";

/** One host-authorized project/view/connection. No polling or automatic reads, including resume. */
export function createContextSelection(options: { binding: ContextBinding; readiness: ContextReadiness; port: ContextReadPort }): ContextSelection {
  const binding = Object.freeze({ ...options.binding, projectId: idSchema.parse(options.binding.projectId) });
  if (!binding.connectionKey || !binding.viewId) throw Error("A connection and view binding are required.");
  const port = options.port, listeners = new Set<() => void>();
  let disposed = false, epoch = 0, searchRequest: AbortController | undefined;
  const bodyRequests = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  const bodies = new Map<string, ContextBody>();
  const unverified = new Set<string>();
  const readiness = Object.freeze({ ...options.readiness });
  let snapshot: ContextSnapshot = Object.freeze({ binding, readiness, disabledReason: reason(readiness, false), hits: emptyList, searched: false, query: "", hasMore: false, loading: false, error: null, selected: emptyList, selectedBytes: 0, bodies: emptyBodies });
  function publish(patch: Partial<ContextSnapshot>) {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  }
  function requireReady() { if (snapshot.disabledReason) throw Error(snapshot.disabledReason); }
  function known(ref: FrozenCitation): SelectedContext | undefined {
    const key = citationKey(ref);
    const selected = snapshot.selected.find(item => citationKey(item.citation) === key);
    if (selected) return selected;
    const hit = snapshot.hits.find(item => citationKey(item.citation) === key);
    return hit && { title: hit.source.title, citation: hit.citation };
  }
  function updateBody(key: string, value: ContextBody) {
    bodies.delete(key); bodies.set(key, Object.freeze(value));
    while (bodies.size > CONTEXT_BUDGET.cacheEntries) {
      const oldest = [...bodies.keys()].find(candidate => !bodyRequests.has(candidate) && candidate !== key);
      if (!oldest) break;
      bodies.delete(oldest);
    }
    publish({ bodies: Object.freeze(Object.fromEntries(bodies)) });
  }
  function cancelReads() {
    epoch++; searchRequest?.abort(); searchRequest = undefined;
    for (const { controller } of bodyRequests.values()) controller.abort();
    bodyRequests.clear();
    for (const [key, body] of bodies) if (body.loading) bodies.set(key, Object.freeze({ ...body, loading: false, error: body.data ? null : "Reading stopped. Expand or retry when this view is ready." }));
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    setReadiness(value) {
      if (disposed || (Object.keys(snapshot.readiness) as (keyof ContextReadiness)[]).every(key => value[key] === snapshot.readiness[key])) return;
      const next = Object.freeze({ ...value }), disabledReason = reason(next, false);
      if (disabledReason) cancelReads();
      publish({ readiness: next, disabledReason, ...(disabledReason ? { loading: false, bodies: Object.freeze(Object.fromEntries(bodies)) } : {}) });
    },
    async search(query) {
      if (snapshot.disabledReason) return;
      let parsed;
      try { parsed = knowledgeSearchSchema.parse({ q: query, limit: CONTEXT_BUDGET.hits }); }
      catch { publish({ error: "Enter a non-empty search of at most 256 UTF-8 bytes." }); return; }
      searchRequest?.abort();
      const controller = new AbortController(), currentEpoch = epoch;
      searchRequest = controller;
      publish({ loading: true, error: null });
      try {
        const result = await readWithDeadline(controller, () => port.search(parsed, controller.signal));
        if (disposed || currentEpoch !== epoch || searchRequest !== controller) return;
        const page = readSearch(result, binding.projectId);
        for (const hit of page.hits) unverified.delete(citationKey(hit.citation));
        publish({ ...page, searched: true, query, loading: false, error: unverified.size ? "Restored references require explicit verification before a new message." : null });
      } catch (error) {
        if (!disposed && currentEpoch === epoch && searchRequest === controller) publish({ loading: false, error: timedOut(error)
          ? "Knowledge search timed out. Your previous results and selection are kept. Retry the search."
          : "Knowledge search failed. Your previous results and selection are kept. Retry the search." });
      } finally { if (searchRequest === controller) searchRequest = undefined; }
    },
    restore(values) {
      if (disposed || snapshot.selected.length) throw Error("Keep the current selection before restoring another draft.");
      const refs = freezeContextSelection(values.map(value => value.citation), binding.projectId);
      const selected = refs.map((citation, index) => Object.freeze({ title: knowledgeCreateSchema.shape.title.parse(values[index]?.title), citation }));
      for (const item of selected) unverified.add(citationKey(item.citation));
      publish({ selected: Object.freeze(selected), selectedBytes: refs.reduce((sum, ref) => sum + citationBytes(ref), 0), error: selected.length ? "Restored references are unverified. Search or explicitly read each reference before a new message." : null });
    },
    add(ref) {
      requireReady();
      const item = known(freezeCitation(ref, binding.projectId));
      if (!item) throw Error("Search this project before selecting a reference.");
      if (snapshot.selected.some(selected => citationKey(selected.citation) === citationKey(item.citation))) return;
      const frozen = freezeContextSelection([...snapshot.selected.map(selected => selected.citation), item.citation], binding.projectId);
      publish({ selected: Object.freeze([...snapshot.selected, Object.freeze(item)]), selectedBytes: frozen.reduce((sum, citation) => sum + citationBytes(citation), 0) });
    },
    remove(ref) {
      if (disposed) return;
      const selected = snapshot.selected.filter(item => citationKey(item.citation) !== citationKey(ref));
      if (selected.length === snapshot.selected.length) return;
      unverified.delete(citationKey(ref));
      publish({ selected: Object.freeze(selected), selectedBytes: selected.reduce((sum, item) => sum + citationBytes(item.citation), 0) });
    },
    expand(ref, { refresh = false } = {}) {
      if (snapshot.disabledReason) return Promise.resolve();
      let citation: FrozenCitation;
      try {
        citation = freezeCitation(ref, binding.projectId);
        if (!known(citation)) throw Error("Reference not in this knowledge view.");
      } catch { return Promise.resolve(); }
      const key = citationKey(citation), pending = bodyRequests.get(key), cached = bodies.get(key);
      if (pending) return pending.promise;
      if (cached?.data && !refresh) { bodies.delete(key); bodies.set(key, cached); return Promise.resolve(); }
      if (bodyRequests.size >= CONTEXT_BUDGET.bodyRequests) {
        updateBody(key, { ...cached, loading: false, error: "Two knowledge reads are in progress. Try again when one finishes." }); return Promise.resolve();
      }
      const controller = new AbortController(), currentEpoch = epoch;
      // Defer invocation until the flight is registered, including synchronous throwing adapters.
      const promise = Promise.resolve().then(async () => {
        try {
          if (controller.signal.aborted) return;
          const result = await readWithDeadline(controller, () => port.resolve(citation, controller.signal));
          if (disposed || currentEpoch !== epoch || controller.signal.aborted) return;
          const validated = readBody(result, citation); unverified.delete(key);
          if (!unverified.size) publish({ error: null });
          updateBody(key, { data: validated, observedAt: new Date().toISOString(), loading: false, error: null });
        } catch (error) {
          if (!disposed && currentEpoch === epoch && bodyRequests.get(key)?.controller === controller) updateBody(key, { ...cached, loading: false, error: timedOut(error)
            ? "Knowledge content timed out. Your cached content is kept. Retry the read."
            : "Knowledge content could not be verified against this reference. Retry the read." });
        } finally { if (bodyRequests.get(key)?.controller === controller) bodyRequests.delete(key); }
      });
      bodyRequests.set(key, { controller, promise });
      updateBody(key, { ...cached, loading: true, error: null });
      return promise;
    },
    freeze() {
      if (unverified.size) throw Error("Verify restored knowledge references before sending a new message. Original receipt retries keep their fixed references.");
      if (disposed) throw Error("This knowledge view is closed.");
      if (snapshot.selected.length && (disposed || !snapshot.readiness.authorized || !snapshot.readiness.knowledgeContext))
        throw Error("This view is not authorized to freeze knowledge context.");
      return freezeContextSelection(snapshot.selected.map(item => item.citation), binding.projectId);
    },
    dispose() {
      if (disposed) return;
      disposed = true; cancelReads(); bodies.clear();
      publish({ hits: emptyList, selected: emptyList, selectedBytes: 0, bodies: emptyBodies, loading: false, disabledReason: reason(snapshot.readiness, true) }); listeners.clear();
    },
  };
}
