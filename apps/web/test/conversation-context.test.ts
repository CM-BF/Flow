import { describe, expect, it, vi } from "vitest";
import type { KnowledgeCitation, KnowledgeResolved, KnowledgeSearchHit, KnowledgeSearchResult } from "@flow/contracts";
import { createContextSelection, type ContextReadiness } from "../src/conversation-context/controller";
import { citationKey, freezeContextSelection, utf8Length } from "../src/conversation-context/selection";
const ready: ContextReadiness = { visible: true, online: true, authorized: true, knowledgeContext: true };
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function hit(n = 1, text = "原文🙂", projectId = "project-a"): KnowledgeSearchHit {
  return { source: { projectId, id: uuid(n), title: `Source ${n}`, currentVersion: 1, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" },
    citation: { projectId, sourceId: uuid(n), version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes", start: 0, end: utf8Length(text) } },
    excerpt: { text: text.slice(0, 1), locator: { kind: "utf8-bytes", start: 0, end: utf8Length(text.slice(0, 1)) } }, matchKind: "literal", rank: 1 };
}
const resolved = (item: KnowledgeSearchHit, text = "原文🙂"): KnowledgeResolved => ({ citation: structuredClone(item.citation), text, isCurrent: true, currentVersion: 1 });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup(items = [hit()], readiness = ready) {
  const search = vi.fn(async (_query: { q: string; limit: number }, _signal: AbortSignal): Promise<KnowledgeSearchResult> => ({ hits: items, hasMore: false }));
  const resolve = vi.fn(async (ref: KnowledgeCitation, _signal: AbortSignal) => resolved(items.find(item => citationKey(item.citation) === citationKey(ref))!));
  const controller = createContextSelection({ binding: { connectionKey: "connection-a", viewId: "view-a", projectId: "project-a" }, readiness, port: { search, resolve } });
  return { controller, search, resolve };
}
describe("knowledge context selection", () => {
  it("selects whole citations without resolving; freezes detached deep values and preserves order", async () => {
    const items = [hit(1), hit(2)], { controller, resolve } = setup(items);
    await controller.search("原"); controller.add(items[1]!.citation); controller.add(items[0]!.citation);
    const frozen = controller.freeze();
    expect(frozen.map(ref => ref.sourceId)).toEqual([uuid(2), uuid(1)]); expect(frozen[0]!.locator.end).toBe(10);
    expect(resolve).not.toHaveBeenCalled(); controller.remove(items[1]!.citation);
    expect(frozen).toHaveLength(2); expect(Object.isFrozen(frozen[0]!.locator)).toBe(true);
    expect(() => { (frozen[0]!.locator as { end: number }).end = 1; }).toThrow();
    items[0]!.citation.locator.end = 1; expect(controller.freeze()[0]!.locator.end).toBe(10);
  });
  it("enforces four refs, exact duplicate tuples and aggregate bytes without normalizing text", () => {
    const refs = Array.from({ length: 5 }, (_, i) => hit(i + 1).citation);
    expect(() => freezeContextSelection(refs, "project-a")).toThrow();
    expect(() => freezeContextSelection([refs[0]!, refs[0]!], "project-a")).toThrow();
    const ranges = [0, 1, 2].map(i => ({ ...refs[i]!, locator: { kind: "utf8-bytes" as const, start: 0, end: 4096 } }));
    expect(freezeContextSelection(ranges.slice(0, 2), "project-a")).toHaveLength(2);
    expect(() => freezeContextSelection(ranges, "project-a")).toThrow("8192");
    expect(() => freezeContextSelection([refs[0]!], "other-project")).toThrow("different project");
  });
  it("same source at distinct version/range is not an exact duplicate", () => {
    const ref = hit().citation;
    const variants = [ref, { ...ref, version: 2 }, { ...ref, locator: { ...ref.locator, start: 1 } }];
    expect(freezeContextSelection(variants, "project-a")).toHaveLength(3);
  });
  it("has stable immutable snapshots/subscriptions and no-op readiness emits nothing", () => {
    const { controller } = setup(), snapshot = controller.getSnapshot(), listener = vi.fn(), subscribe = controller.subscribe;
    const unsubscribe = controller.subscribe(listener); controller.setReadiness({ ...ready });
    expect(controller.getSnapshot()).toBe(snapshot); expect(controller.subscribe).toBe(subscribe); expect(listener).not.toHaveBeenCalled();
    expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot.readiness)).toBe(true);
    unsubscribe(); controller.setReadiness({ ...ready, online: false }); expect(listener).not.toHaveBeenCalled();
    controller.dispose(); const disposed = controller.getSnapshot(); controller.dispose(); expect(controller.getSnapshot()).toBe(disposed);
  });
  it("validates UTF8 query budget without trimming or changing the query", async () => {
    const { controller, search } = setup();
    await controller.search("🙂".repeat(65)); expect(search).not.toHaveBeenCalled();
    await controller.search("  原文  "); expect(search.mock.calls[0]![0].q).toBe("  原文  ");
    await controller.search(" "); expect(search).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed/mismatched search pages atomically and retains previous selection", async () => {
    const { controller, search } = setup(); await controller.search("old"); controller.add(hit().citation);
    for (const mutation of [
      (item: KnowledgeSearchHit) => { item.citation.projectId = "other"; },
      (item: KnowledgeSearchHit) => { item.excerpt.locator.end = 9; },
      (item: KnowledgeSearchHit) => { item.source.currentVersion = 2; },
      (item: KnowledgeSearchHit) => { item.rank = Infinity; },
    ]) {
      const invalid = hit(2); mutation(invalid); search.mockResolvedValueOnce({ hits: [hit(), invalid], hasMore: false });
      await controller.search("bad"); expect(controller.getSnapshot().hits).toHaveLength(1); expect(controller.getSnapshot().error).toBeTruthy(); expect(controller.freeze()).toHaveLength(1);
    }
  });
  it("supersedes search and discards late old results, with only latest query retained", async () => {
    const { controller, search } = setup(), old = deferred<KnowledgeSearchResult>(); search.mockReturnValueOnce(old.promise);
    const pending = controller.search("old"); const signal = search.mock.calls[0]![1]; await controller.search("new");
    expect(signal.aborted).toBe(true); old.resolve({ hits: [hit(2)], hasMore: true }); await pending;
    expect(controller.getSnapshot().query).toBe("new"); expect(controller.getSnapshot().hits[0]!.source.id).toBe(uuid(1));
  });
  it("explicit expansion shares a flight, caches, and refreshes current-version observation without changing pin", async () => {
    const { controller, resolve } = setup(), pending = deferred<KnowledgeResolved>(); await controller.search("x");
    resolve.mockReturnValueOnce(pending.promise); const first = controller.expand(hit().citation), second = controller.expand(hit().citation);
    expect(first).toBe(second); await Promise.resolve(); expect(resolve).toHaveBeenCalledTimes(1);
    pending.resolve(resolved(hit())); await first; await controller.expand(hit().citation); expect(resolve).toHaveBeenCalledTimes(1);
    resolve.mockResolvedValueOnce({ ...resolved(hit()), currentVersion: 2, isCurrent: false }); await controller.expand(hit().citation, { refresh: true });
    const body = controller.getSnapshot().bodies[citationKey(hit().citation)]!;
    expect(body.data!.citation.version).toBe(1); expect(body.data!.currentVersion).toBe(2); expect(body.observedAt).toBeTruthy();
  });
  it("rejects body identity/byte mismatches and accepts literal source text without chunk-digest fiction", async () => {
    const text = " e\u0301\n🙂 ", item = hit(1, text), { controller, resolve } = setup([item]); await controller.search("x");
    resolve.mockResolvedValueOnce({ ...resolved(item, text), citation: hit(2, text).citation }); await controller.expand(item.citation);
    expect(controller.getSnapshot().bodies[citationKey(item.citation)]!.data).toBeUndefined();
    resolve.mockResolvedValueOnce(resolved(item, "wrong")); await controller.expand(item.citation);
    expect(controller.getSnapshot().bodies[citationKey(item.citation)]!.error).toBeTruthy();
    resolve.mockResolvedValueOnce(resolved(item, text)); await controller.expand(item.citation);
    expect(controller.getSnapshot().bodies[citationKey(item.citation)]!.data!.text).toBe(text);
  });
  it.each(["visible", "online", "authorized", "knowledgeContext"] as const)("%s=false cancels reads and drops late results; resume is not a fetch", async field => {
    const { controller, search, resolve } = setup(), pending = deferred<KnowledgeResolved>(); await controller.search("x"); controller.add(hit().citation);
    resolve.mockReturnValueOnce(pending.promise); const flight = controller.expand(hit().citation); await Promise.resolve(); const signal = resolve.mock.calls[0]![1];
    controller.setReadiness({ ...ready, [field]: false }); expect(signal.aborted).toBe(true);
    await controller.search("hidden"); await controller.expand(hit().citation); expect(search).toHaveBeenCalledTimes(1); expect(resolve).toHaveBeenCalledTimes(1);
    pending.resolve(resolved(hit())); await flight; expect(controller.getSnapshot().bodies[citationKey(hit().citation)]!.data).toBeUndefined();
    if (field === "visible" || field === "online") expect(controller.freeze()).toHaveLength(1); else expect(() => controller.freeze()).toThrow();
    controller.setReadiness(ready); expect(resolve).toHaveBeenCalledTimes(1); await controller.expand(hit().citation); expect(resolve).toHaveBeenCalledTimes(2);
  });
  it("caps active body requests at two and retains at most eight cached records", async () => {
    const items = Array.from({ length: 12 }, (_, i) => hit(i + 1)), { controller, resolve } = setup(items), a = deferred<KnowledgeResolved>(), b = deferred<KnowledgeResolved>();
    await controller.search("x"); resolve.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const first = controller.expand(items[0]!.citation), second = controller.expand(items[1]!.citation); await Promise.resolve();
    await controller.expand(items[2]!.citation); expect(resolve).toHaveBeenCalledTimes(2);
    a.resolve(resolved(items[0]!)); b.resolve(resolved(items[1]!)); await Promise.all([first, second]);
    for (const item of items.slice(2)) await controller.expand(item.citation);
    expect(Object.keys(controller.getSnapshot().bodies)).toHaveLength(8);
    expect(controller.getSnapshot().bodies[citationKey(items[0]!.citation)]).toBeUndefined();
  });
  it("cannot resolve arbitrary IDs; disposed connection cannot publish into its replacement", async () => {
    const { controller, resolve } = setup(), pending = deferred<KnowledgeResolved>(); await controller.search("x");
    await controller.expand(hit(9).citation); expect(resolve).not.toHaveBeenCalled();
    resolve.mockReturnValueOnce(pending.promise); const flight = controller.expand(hit().citation); await Promise.resolve(); controller.dispose();
    const replacement = setup(); pending.resolve(resolved(hit())); await flight;
    expect(Object.keys(controller.getSnapshot().bodies)).toHaveLength(0); expect(replacement.controller.getSnapshot().hits).toHaveLength(0); expect(() => controller.freeze()).toThrow("closed");
  });
  it("empty unsupported selection can freeze for plain text; revoked selected references are kept", async () => {
    const { controller } = setup([], { ...ready, knowledgeContext: false }); expect(controller.freeze()).toEqual([]);
    const selected = setup(); await selected.controller.search("x"); selected.controller.add(hit().citation);
    selected.controller.setReadiness({ ...ready, knowledgeContext: false }); expect(() => selected.controller.freeze()).toThrow(); expect(selected.controller.getSnapshot().selected).toHaveLength(1);
  });
});
