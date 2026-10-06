import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowClient } from "@flow/client";
import type { BrowserSessionReady } from "@flow/contracts";
import { ConnectionSession, type SessionClientFactory } from "../src/connection/session";
import { ConversationRecoveryJournal, RecoveryError, namespaceKey, recoveryAddress, recoveryValue, type CommandRecord, type Json, type RecoveryNamespace } from "../src/recovery/journal";
import { RecoveryWorkspace, RECOVERY_OWNER, readRecoveryDraft } from "../src/recovery/binding";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { QueueCommands } from "../src/conversations/queue/commands";
import { ConversationOutbox, frozenOutbox, restoreOutbox } from "../src/conversations/outbox";
import { createContextSelection } from "../src/conversation-context/controller";
import { themes } from "../src/themes";

const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ns: RecoveryNamespace = { baseUrl: "https://center.example/proxy", centerId: uuid(1), ownerPrincipalId: uuid(2) };
const owner = { viewKey: uuid(3), routeId: "conversation:chat" };
const command = { id: uuid(4), domain: "queue" as const, slot: "queue:chat:enqueue", frozen: recoveryValue({ key: uuid(4), command: { kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 0, text: "原稿\n\u0001" } } }) };
const draft = (text: string): Json => ({ text, intent: "follow-up", profile: { kind: "legacy-default" }, projectId: null, projectTitle: null, knowledge: [], attachments: [], steering: [] });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

/** Deterministic IDB event port, not a browser implementation. It can abort AFTER successful put requests.
 * Real IndexedDB, persistence across browser restarts and cookie/SSE are separate App fixture gates. */
class TransactionPort {
  records = new Map<IDBValidKey, unknown>(); manifest = new Map<IDBValidKey, unknown>();
  writes: { store: string; key: IDBValidKey }[] = []; durability: (IDBTransactionDurability | undefined)[] = [];
  failNextCommit = false; holdNextCommit = false; releases: (() => void)[] = [];
  private tail = Promise.resolve();
  readonly factory = { open: () => {
    const request: { result: unknown; onsuccess?: () => void } = { result: this.database };
    queueMicrotask(() => request.onsuccess?.()); return request;
  } } as unknown as IDBFactory;
  private database = {
    close() {}, onversionchange: null,
    transaction: (_names: string[], mode: IDBTransactionMode, options?: IDBTransactionOptions) => {
      this.durability.push(options?.durability);
      let aborted = false;
      const reads: (() => void)[] = [], staged = new Map<string, Map<IDBValidKey, unknown>>();
      const request = (read: () => unknown) => { const value: { result?: unknown; onsuccess?: () => void } = {}; reads.push(() => { value.result = structuredClone(read()); value.onsuccess?.(); }); return value; };
      const tx = {
        oncomplete: null as (() => void) | null, onabort: null as (() => void) | null, onerror: null,
        abort: () => { aborted = true; },
        objectStore: (name: string) => ({
          getAll: () => request(() => [...staged.get(name)!.values()]), get: (key: IDBValidKey) => request(() => staged.get(name)!.get(key)),
          put: (value: unknown, key: IDBValidKey) => { this.writes.push({ store: name, key }); staged.get(name)!.set(key, structuredClone(value)); return {}; },
          delete: (key: IDBValidKey) => { staged.get(name)!.delete(key); return {}; },
        }),
      };
      this.tail = this.tail.then(() => new Promise<void>(done => {
        staged.set("records", new Map(this.records)); staged.set("manifest", new Map(this.manifest));
        reads.forEach(read => read());
        const finish = () => {
          if (mode === "readwrite" && this.failNextCommit) { this.failNextCommit = false; aborted = true; }
          if (aborted) tx.onabort?.();
          else { if (mode === "readwrite") { this.records = staged.get("records")!; this.manifest = staged.get("manifest")!; } tx.oncomplete?.(); }
          done();
        };
        if (mode === "readwrite" && this.holdNextCommit) { this.holdNextCommit = false; this.releases.push(finish); }
        else queueMicrotask(finish);
      }));
      return tx;
    },
  };
}
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllGlobals(); });
function journal() { const port = new TransactionPort(), value = new ConversationRecoveryJournal(port.factory); cleanup.push(() => value.close()); return { port, journal: value }; }
function actions(recovery: AppActions["recovery"]): AppActions {
  return { recovery, knowsTask: () => false, task: () => null, hasDraft: () => true, openTask() {}, openWorkspace() {}, closeWorkspace() {}, loadReference: async () => {}, setTheme() {}, copy: async () => {} };
}
async function workspace(value: ConversationRecoveryJournal) {
  let data = draft("original"), identity = ns, generation = 1;
  const session = new AppPluginSession(actions({ journal: value, namespace: () => identity, authorized: () => true, generation: () => generation, owner: () => owner, draft: () => data, restore: async () => {}, retry: async () => {} }), themes[0]!);
  cleanup.push(() => session.dispose()); await session.host.activate(RECOVERY_OWNER);
  return { workspace: session.recovery, setDraft: (next: Json) => { data = next; }, switchCenter: () => { identity = { ...ns, centerId: uuid(20) }; generation++; } };
}

describe("recovery storage barriers (controlled IDB event port)", () => {
  it("waits for strict transaction completion, including put-success followed by commit abort", async () => {
    const { port, journal: store } = journal(); const bound = store.bind(ns, () => owner, () => true);
    port.holdNextCommit = true; let completed = false;
    const writing = bound.prepare(command).then(() => { completed = true; });
    await vi.waitFor(() => expect(port.releases).toHaveLength(1)); expect(completed).toBe(false); expect(port.records.size).toBe(0);
    port.failNextCommit = true; port.releases.shift()!(); await expect(writing).rejects.toThrow("did not commit"); expect(port.records.size).toBe(0);
    expect(port.writes.some(write => write.store === "records")).toBe(true); expect(port.durability[0]).toBe("strict");
  });
  it("uses actual version CAS across two ports and cannot downgrade accepted with a stale checkpoint", async () => {
    const { journal: store } = journal(), a = store.bind(ns, () => owner, () => true), b = store.bind(ns, () => owner, () => true);
    await a.prepare(command); await b.prepare(command); await a.dispatch(command.id);
    await expect(b.dispatch(command.id)).rejects.toThrow("Another tab");
    await a.checkpoint(command.id, { phase: "accepted", data: { conversationId: "chat", queueRevision: 1 } });
    await expect(b.checkpoint(command.id, { phase: "unknown" })).rejects.toThrow("Another tab");
    expect((await store.list(ns))[0]).toMatchObject({ phase: "accepted", version: 3 });
    await expect(b.prepare(command)).rejects.toThrow("already has a durable accepted");
  });
  it("prevents a different command replacing the unresolved slot and retains full cancel-task target", async () => {
    const { journal: store } = journal(), bound = store.bind(ns, () => owner, () => true);
    await bound.prepare(command);
    await expect(bound.prepare({ ...command, id: uuid(5) })).rejects.toThrow("unresolved command");
    const cancel = { ...command, id: uuid(6), slot: "queue:chat:cancel-task:task-original", frozen: recoveryValue({ key: uuid(6), command: { kind: "cancel-task", conversationId: "chat", taskId: "task-original" } }) };
    await bound.prepare(cancel); expect((await store.list(ns)).find(item => item.id === uuid(6))).toMatchObject({ frozen: cancel.frozen });
  });
  it("keeps the source draft when prepare fails and official transient empty is deferred", async () => {
    const { port, journal: store } = journal(), { workspace: binding, setDraft } = await workspace(store);
    binding.beginHandoff(owner.viewKey, "queue"); await binding.flush().catch(() => {});
    expect((await store.list(ns))[0]).toMatchObject({ data: draft("original") });
    setDraft(draft("")); binding.changed(owner.viewKey); port.failNextCommit = true;
    await expect(binding.commandPort(owner.viewKey).prepare(command)).rejects.toThrow();
    expect(await store.list(ns)).toHaveLength(1); expect((await store.list(ns))[0]).toMatchObject({ kind: "draft", data: draft("original") });
    await expect(binding.flush()).rejects.toThrow("only in this page");
  });
  it("does not queue center A draft into B when the namespace changes before the async write", async () => {
    const { journal: store } = journal(), { workspace: binding, switchCenter } = await workspace(store);
    binding.changed(owner.viewKey); switchCenter(); await binding.flush().catch(() => {});
    expect(await store.list(ns)).toEqual([]); expect(await store.list({ ...ns, centerId: uuid(20) })).toEqual([]);
  });
  it("updates only draft A, while charging and preserving unrelated B in the same manifest transaction", async () => {
    const { port, journal: store } = journal();
    const a = await store.saveDraft(ns, owner, draft("A"), 0);
    await store.saveDraft(ns, { ...owner, viewKey: uuid(9) }, draft("B"), 0); port.writes = [];
    await store.saveDraft(ns, owner, draft("A next"), a.version);
    expect(port.writes.filter(write => write.store === "records")).toHaveLength(1);
    expect(await store.list(ns)).toHaveLength(2); expect(port.writes.filter(write => write.store === "manifest")).toHaveLength(1);
  });
  it("blocks HTTP on failed preparation and retries the exact queue key/body after storage recovers", async () => {
    const { port, journal: store } = journal(), calls: { key: string | null; body: string }[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_url, options) => { calls.push({ key: new Headers(options?.headers).get("Idempotency-Key"), body: String(options?.body) }); throw Error("ACK lost"); }));
    const client = new FlowClient({ baseUrl: "https://center.invalid", token: "fixture-only" }), queue = new QueueCommands(client, async () => {});
    cleanup.push(() => queue.dispose()); queue.configureRecovery(store.bind(ns, () => owner, () => true)); port.failNextCommit = true;
    await queue.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 0, text: "original" } });
    const blocked = queue.getSnapshot()[0]!; expect(blocked).toMatchObject({ state: "unknown", everUnknown: false }); expect(calls).toEqual([]);
    await expect(queue.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 0, text: "next draft" } })).rejects.toThrow("unresolved");
    await queue.retry(blocked.key); await queue.retry(blocked.key);
    expect(calls).toHaveLength(2); expect(calls[0]).toEqual(calls[1]); expect(calls[0]!.key).toBe(blocked.key);
  });
});

describe("connection and original authority consumers", () => {
  it("keeps safe API base paths without persisting credentials or doubling the public /api prefix", () => {
    expect(recoveryAddress("", "https://web.example/app")).toBe("https://web.example");
    expect(recoveryAddress("https://web.example/center-proxy/")).toBe("https://web.example/center-proxy");
    for (const value of ["https://u:p@center.example", "https://center.example/?token=x", "https://center.example/#secret"]) expect(() => recoveryAddress(value)).toThrow();
  });
  it("revokes public business authorization synchronously while one logout uses the captured CSRF", async () => {
    const final = deferred<void>(), tokens: (string | undefined)[] = [];
    const ready: BrowserSessionReady = { protocol: "flow.browser-session.v1", state: "ready", centerId: ns.centerId, ownerPrincipalId: ns.ownerPrincipalId, expiresAt: "2099-01-01T00:00:00Z", csrfToken: "a".repeat(64) };
    const factory: SessionClientFactory = (_address, csrf) => ({ browserSession: async () => ready, connectBrowserSession: async () => ready, logoutBrowserSession: async () => { tokens.push(csrf()); await final.promise; return { protocol: "flow.browser-session.v1", state: "unauthenticated" }; } });
    const session = new ConnectionSession(ns.baseUrl, factory); cleanup.push(() => session.dispose()); await session.read();
    const logout = session.logout(); expect(session.authorized(ns)).toBe(false); expect(session.csrfToken()).toBeUndefined(); expect(tokens).toEqual([ready.csrfToken]); final.resolve(); await logout;
    expect(session.getSnapshot().phase).toBe("unauthenticated");
  });
  it("recovers a lost connect ACK using cookie-only GET without another login POST", async () => {
    const ready: BrowserSessionReady = { protocol: "flow.browser-session.v1", state: "ready", centerId: ns.centerId, ownerPrincipalId: ns.ownerPrincipalId, expiresAt: "2099-01-01T00:00:00Z", csrfToken: "b".repeat(64) };
    const post = vi.fn(async () => { throw Error("response lost"); }), read = vi.fn(async () => ready);
    const session = new ConnectionSession(ns.baseUrl, () => ({ browserSession: read, connectBrowserSession: post, logoutBrowserSession: async () => ({ protocol: "flow.browser-session.v1", state: "unauthenticated" }) })); cleanup.push(() => session.dispose());
    await session.connect("fixture-only"); expect(post).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1); expect(session.getSnapshot().identity).toEqual(ns);
  });
  it("retains both CREATE keys and payloads, restores rejected as rejected and never makes accepted resendable", () => {
    const outbox = new ConversationOutbox(() => uuid(4)); const entry = outbox.begin({ conversationId: null, expectedRevision: 0, text: "original", creation: { title: "new", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" } } });
    const frozen = frozenOutbox(entry), record: CommandRecord = { schema: 1, kind: "command", id: entry.id, namespace: namespaceKey(ns), owner, version: 1, updatedAt: 1, domain: "outbox", slot: "turn:chat", frozen, display: null, phase: "prepared", stage: "submit", checkpoint: { conversationId: "chat" }, initialBytes: 1024, reserveBytes: 32768 };
    expect(restoreOutbox(record)).toMatchObject({ conversationId: "chat", creationKey: entry.creationKey, turnKey: entry.turnKey, request: entry.request });
    expect(restoreOutbox({ ...record, phase: "rejected" }).state).toBe("rejected"); expect(() => restoreOutbox({ ...record, phase: "accepted" })).toThrow("already accepted");
  });
  it("restores a public 255 ASCII filename as metadata and rejects altered project identity", () => {
    const value = draft("new") as Record<string, Json>; const name = "a".repeat(251) + ".txt";
    const metadata = { reference: { kind: "upload", projectId: "project", resourceId: uuid(11), version: 1, contentDigest: "a".repeat(64) }, name, mediaType: "text/plain", byteLength: 1, createdAt: "2026-10-06T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", state: "ready", retained: false };
    const restored = readRecoveryDraft(recoveryValue({ ...value, projectId: "project", projectTitle: "P", attachments: [{ id: uuid(12), name, metadata, state: "ready" }] })); expect(restored.attachments[0]!.name).toHaveLength(255);
    expect(() => readRecoveryDraft(recoveryValue({ ...value, projectId: "other", projectTitle: "P", attachments: [{ id: uuid(12), name, metadata, state: "ready" }] }))).toThrow("another project");
  });
  it("explicitly resolving an old restored knowledge version verifies it even when search omits it", async () => {
    const citation = { projectId: "project", sourceId: uuid(10), version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes" as const, start: 0, end: 3 } };
    const resolve = vi.fn(async () => ({ citation, text: "old", isCurrent: false, currentVersion: 2 }));
    const controller = createContextSelection({ binding: { connectionKey: "connection", viewId: owner.viewKey, projectId: "project" }, readiness: { visible: true, online: true, authorized: true, knowledgeContext: true }, port: { search: async () => ({ hits: [], hasMore: false }), resolve } }); cleanup.push(() => controller.dispose());
    controller.restore([{ title: "Source", citation }]); expect(() => controller.freeze()).toThrow("Verify restored"); await controller.expand(citation); expect(controller.freeze()).toEqual([citation]); expect(resolve).toHaveBeenCalledTimes(1);
  });
});
