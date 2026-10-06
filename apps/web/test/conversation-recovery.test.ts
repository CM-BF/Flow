import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowClient } from "@flow/client";
import type { BrowserSessionReady, ConversationSnapshot } from "@flow/contracts";
import { ConnectionSession, type SessionClientFactory } from "../src/connection/session";
import { ConversationRecoveryJournal, RecoveryError, namespaceKey, recoveryAddress, recoveryValue, type CommandRecord, type Json, type RecoveryNamespace, type RecoveryRecord } from "../src/recovery/journal";
import { RecoveryWorkspace, RECOVERY_OWNER, readRecoveryDraft } from "../src/recovery/binding";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { QueueCommands } from "../src/conversations/queue/commands";
import { ConversationOutbox, frozenOutbox, restoreOutbox } from "../src/conversations/outbox";
import { ConversationProjection } from "../src/conversations/projection";
import { createContextSelection } from "../src/conversation-context/controller";
import { themes } from "../src/themes";
import type { CompleteAttachment, ComposerRuntime } from "@assistant-ui/react";
import type { AttachmentCapabilities, AttachmentMetadata } from "@flow/contracts";
import { ConversationAttachments, createAttachmentPlugin, ATTACHMENT_OWNER, type AttachmentClient, type AttachmentView } from "../src/plugin-integration/attachments";
import { PluginHost } from "../src/plugins/host";
import type { HostPort, PluginDefinition } from "../src/plugins/types";
import { observeRecoveryRecords } from "./conversation-recovery.fixture";

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
  let data = draft("original"), identity = ns, generation = 1, authorized = true;
  const restore = vi.fn(async (_record: RecoveryRecord) => {});
  const session = new AppPluginSession(actions({ journal: value, namespace: () => authorized ? identity : null, authorized: () => authorized, generation: () => generation, owner: () => owner, draft: () => data, restore, retry: async () => {} }), themes[0]!);
  cleanup.push(() => session.dispose()); await session.host.activate(RECOVERY_OWNER);
  return { workspace: session.recovery, restore, setDraft: (next: Json) => { data = next; }, revoke: () => { authorized = false; generation++; }, reauthenticate: () => { authorized = true; generation++; }, switchCenter: () => { identity = { ...ns, centerId: uuid(20) }; generation++; } };
}

/** Actual session startup and host states; no explicit Saved drafts command/activation. */
function lifecycle(options: { authorized?: boolean; configured?: boolean; gate?: Promise<void> } = {}) {
  const { port, journal: store } = journal();
  let authorized = options.authorized ?? true, configured = options.configured ?? true, identity = ns, generation = 1, data = draft("initial material");
  const recovery: NonNullable<AppActions["recovery"]> = { journal: store, namespace: () => authorized ? identity : null,
    authorized: () => authorized, generation: () => generation, owner: () => owner, draft: () => data, restore: async () => {}, retry: async () => {} };
  const original = PluginHost.prototype.register;
  const registration = vi.spyOn(PluginHost.prototype, "register").mockImplementation(function(this: PluginHost, definition: PluginDefinition) {
    return original.call(this, definition.manifest.id === RECOVERY_OWNER && options.gate
      ? { ...definition, load: async signal => { await options.gate; return definition.load(signal); } } : definition);
  });
  let session: AppPluginSession;
  try { session = new AppPluginSession(actions(configured ? recovery : undefined), themes[0]!); }
  finally { registration.mockRestore(); }
  cleanup.push(() => session.dispose());
  const update = () => session.updateActions(actions(configured ? recovery : undefined));
  return { port, store, session, update, state: () => session.host.list().find(item => item.id === RECOVERY_OWNER)?.state,
    edit: (text: string) => { data = draft(text); session.recovery.changed(owner.viewKey); },
    auth: (next: boolean) => { authorized = next; generation++; update(); },
    configure: () => { configured = true; update(); },
    switchCenter: () => { identity = { ...ns, centerId: uuid(20) }; generation++; update(); } };
}

describe("default Recovery lifecycle (actual private session and host, controlled IDB)", () => {
  it("checkpoints a normal edit without opening Saved drafts or explicitly activating the host", async () => {
    const gate = deferred<void>(), f = lifecycle({ gate: gate.promise });
    f.edit("complete original material"); expect(f.session.recovery.protection(owner.viewKey)).not.toEqual([]);
    expect(f.port.writes).toEqual([]); gate.resolve();
    await vi.waitFor(() => expect(f.state()).toBe("active")); await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ data: draft("complete original material") }]);
    expect(f.session.recovery.getSnapshot().open).toBe(false);
    const writes = f.port.writes.length; f.update(); f.update(); await f.session.recovery.flush(); expect(f.port.writes).toHaveLength(writes);
  });
  it("requires both configuration and authorization before default activation", async () => {
    const f = lifecycle({ configured: false, authorized: false }); f.edit("not authorized");
    f.configure(); expect(f.state()).toBe("registered"); expect(f.port.writes).toEqual([]);
    f.auth(true); await vi.waitFor(() => expect(f.state()).toBe("active")); f.edit("authorized draft"); await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ data: draft("authorized draft") }]);
  });
  it("does not write after pending activation loses auth, then replays on same-namespace reauth while already active", async () => {
    const gate = deferred<void>(), f = lifecycle({ gate: gate.promise }); f.edit("retained original");
    f.auth(false); gate.resolve(); await vi.waitFor(() => expect(f.state()).toBe("active")); expect(f.port.writes).toEqual([]);
    expect(f.session.recovery.sendReason()).not.toBeNull(); f.auth(true); await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ data: draft("retained original") }]);
  });
  it("never moves an activation-pending draft to a different namespace and closes on dispose", async () => {
    const gate = deferred<void>(), f = lifecycle({ gate: gate.promise }); f.edit("A only"); f.switchCenter();
    gate.resolve(); await vi.waitFor(() => expect(f.state()).toBe("active")); expect(f.port.writes).toEqual([]);
    f.edit("still the protected A view"); expect(f.port.writes).toEqual([]); expect(f.session.recovery.protection(owner.viewKey)).not.toEqual([]);
    const stopped = deferred<void>(), g = lifecycle({ gate: stopped.promise }); g.edit("disposed draft"); await g.session.dispose();
    stopped.resolve(); await Promise.resolve(); await Promise.resolve(); expect(g.port.writes).toEqual([]);
  });
  it("does not automatically restart disabled or failed entries on actions or edits", async () => {
    const f = lifecycle(); await vi.waitFor(() => expect(f.state()).toBe("active"));
    await f.session.host.deactivate(RECOVERY_OWNER); f.edit("disabled original"); f.update(); f.auth(false); f.auth(true);
    expect(f.state()).toBe("disabled"); expect(f.port.writes).toEqual([]);
    await f.session.host.activate(RECOVERY_OWNER); await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ data: draft("disabled original") }]);
    const gate = deferred<void>(), g = lifecycle({ gate: gate.promise }); gate.reject(Error("Activation unavailable"));
    await vi.waitFor(() => expect(g.state()).toBe("failed")); g.edit("failed original"); g.update(); g.auth(false); g.auth(true);
    expect(g.state()).toBe("failed"); expect(g.port.writes).toEqual([]);
  });
});

function observationPort() {
  const read = { result: [{ id: "saved", kind: "draft", version: 1, owner }] };
  const transaction = { oncomplete: null as (() => void) | null, onabort: null as (() => void) | null, onerror: null as (() => void) | null,
    abort: vi.fn(), objectStore: vi.fn(() => ({ getAll: () => read })) };
  const database = { close: vi.fn(), objectStoreNames: { contains: vi.fn(() => true) }, transaction: vi.fn(() => transaction) };
  const upgrade = { abort: vi.fn() };
  const request = { result: database, transaction: upgrade, onsuccess: null as (() => void) | null, onblocked: null as (() => void) | null,
    onerror: null as ((event: { preventDefault(): void }) => void) | null, onupgradeneeded: null as ((event: { oldVersion: number }) => void) | null };
  const factory = { open: vi.fn(() => request) } as unknown as IDBFactory;
  return { read, transaction, database, request, upgrade, factory,
    observe: (timeoutMs = 1000) => observeRecoveryRecords({ name: "flow.conversation-recovery.v1", version: 1, timeoutMs }, factory) };
}

describe("same serialized journal observer (controlled opening events, no schema mutation)", () => {
  it("aborts a missing-database upgrade and returns pending without reading or creating stores", async () => {
    const f = observationPort(), pending = f.observe(); f.request.onupgradeneeded?.({ oldVersion: 0 });
    await expect(pending).resolves.toEqual({ state: "pending", records: [] });
    expect(f.upgrade.abort).toHaveBeenCalledTimes(1); expect(f.database.transaction).not.toHaveBeenCalled(); expect(f.database.close).toHaveBeenCalledTimes(1);
    const preventDefault = vi.fn(); f.request.onerror?.({ preventDefault }); expect(preventDefault).toHaveBeenCalledTimes(1);
  });
  it("rejects an existing incompatible version and missing stores without repairing either", async () => {
    const f = observationPort(), pending = f.observe(), rejected = expect(pending).rejects.toThrow("schema version");
    f.request.onupgradeneeded?.({ oldVersion: 1 }); await rejected; expect(f.upgrade.abort).toHaveBeenCalledTimes(1);
    const g = observationPort(); g.database.objectStoreNames.contains.mockReturnValue(false);
    const malformed = g.observe(), failed = expect(malformed).rejects.toThrow("invalid schema"); g.request.onsuccess?.(); await failed;
    expect(g.database.transaction).not.toHaveBeenCalled(); expect(g.database.close).toHaveBeenCalledTimes(1);
  });
  it.each(["transaction", "store"] as const)("settles and closes a synchronous %s failure", stage => {
    const f = observationPort();
    if (stage === "transaction") f.database.transaction.mockImplementation(() => { throw Error("bad transaction"); });
    else f.transaction.objectStore.mockImplementation(() => { throw Error("missing store"); });
    const pending = f.observe(), rejected = expect(pending).rejects.toThrow("invalid schema or transaction");
    f.request.onsuccess?.(); expect(f.database.close).toHaveBeenCalledTimes(1); return rejected;
  });
  it("waits for read transaction completion and rejects an abort instead of hanging", async () => {
    const f = observationPort(); let settled = false; const pending = f.observe().then(value => { settled = true; return value; });
    f.request.onsuccess?.(); await Promise.resolve(); expect(settled).toBe(false); f.transaction.oncomplete?.();
    await expect(pending).resolves.toEqual({ state: "ready", records: f.read.result }); expect(f.database.close).toHaveBeenCalledTimes(1);
    const g = observationPort(), aborted = g.observe(), rejected = expect(aborted).rejects.toThrow("aborted");
    g.request.onsuccess?.(); g.transaction.onabort?.(); await rejected; expect(g.database.close).toHaveBeenCalledTimes(1);
  });
  it("rejects blocked or timed-out opens and closes late success or aborts late creation", async () => {
    const f = observationPort(), blocked = f.observe(), rejected = expect(blocked).rejects.toThrow("blocked");
    f.request.onblocked?.(); await rejected; f.request.onsuccess?.(); expect(f.database.close).toHaveBeenCalledTimes(1); expect(f.database.transaction).not.toHaveBeenCalled();
    vi.useFakeTimers();
    try {
      const g = observationPort(), timed = g.observe(10), expired = expect(timed).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(10); await expired; g.request.onupgradeneeded?.({ oldVersion: 0 });
      expect(g.upgrade.abort).toHaveBeenCalledTimes(1); expect(g.database.close).toHaveBeenCalledTimes(1); expect(g.database.transaction).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});

/** Real input/private binding with authorized metadata ports; the composer is a
 * controlled public-state port, not evidence that React or browser IDB ran. */
async function restoredMaterials() {
  const resource = (n: number): AttachmentMetadata => ({ reference: { kind: "upload", projectId: "project", resourceId: uuid(n), version: 1, contentDigest: "a".repeat(64) }, name: `saved-${n}.txt`, mediaType: "text/plain", byteLength: 1, createdAt: "2026-10-06T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", state: "ready", retained: false });
  const cap: AttachmentCapabilities = { protocol: "text-v1", recoveryScopeId: uuid(30), projectId: "project", requiresProject: true, mediaTypes: ["text/plain"], extensions: [".txt"], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: "knowledge-then-attachments", unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 };
  let view: AttachmentView = { viewId: owner.routeId, conversationId: "chat", projectId: "project", visible: true, online: true, canRead: true, canUpload: true, attachmentContext: true };
  const constant = <T,>(value: T) => ({ getSnapshot: () => value, subscribe: () => () => {} });
  const port: HostPort = { navigation: constant({ activeTaskId: null, workspaceTab: "files", workspaceOpen: false }), theme: constant({ themeId: "light", scheme: "light", availableThemes: [] }), getContext: () => ({ kind: "global" }), authorize: (_plugin, _capability, context) => view.canRead && context.kind === "composer" && context.viewId === view.viewId, execute: async () => {} };
  const host = new PluginHost(port), signal = new AbortController(); let binding: ConversationAttachments;
  host.register(createAttachmentPlugin(() => binding));
  const forbidden = async () => { throw Error("No upload, body or receipt read in this recovery check."); };
  let page = [resource(11), resource(12)];
  const client: AttachmentClient = { attachmentCapabilities: async () => cap, attachments: async () => ({ resources: page, nextCursor: null }), attachment: forbidden, attachmentContent: forbidden, attachmentUploadReceipt: forbidden, uploadAttachment: forbidden };
  binding = new ConversationAttachments({ connectionId: "connection", viewKey: owner.viewKey, projectId: "project" }, { host, client, signal: signal.signal, current: () => view, storage: { read: () => null, write() {} } });
  cleanup.push(() => host.dispose(), () => binding.dispose()); await host.activate(ATTACHMENT_OWNER);
  const items = [11, 12].map(n => ({ id: uuid(n + 10), name: resource(n).name, metadata: resource(n), state: "ready" as const })); binding.restoreDraft(items);
  let files: CompleteAttachment[] = [], settle: Promise<void> = Promise.resolve(); const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  const composer: Pick<ComposerRuntime, "getState" | "subscribe" | "addAttachment"> = {
    getState: () => ({ type: "thread", canCancel: false, canSend: false, isEditing: false, isEmpty: !files.length, text: "next draft", role: "user", attachments: files, runConfig: {}, attachmentAccept: ".txt", dictation: undefined, quote: undefined, queue: [], submission: undefined, inTransit: [] }),
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    addAttachment: vi.fn<ComposerRuntime["addAttachment"]>(async value => { if (!("content" in value) || !value.id) throw Error("Only existing complete metadata is allowed."); files = [...files, { ...value, id: value.id, type: value.type ?? "file", status: { type: "complete" } }]; emit(); await settle; }),
  };
  return { binding, composer, items, host, page: (ids: number[]) => { page = ids.map(resource); }, pause: (promise: Promise<void>) => { settle = promise; }, clearComposer: () => { files = []; emit(); }, configure: (patch: Partial<AttachmentView>) => { view = { ...view, ...patch }; binding.sync(); } };
}

describe("restored attachment draft synchronization (controlled composer port)", () => {
  it.each(["send", "queue"] as const)("blocks %s before receipt/HTTP for unverified or partial selections; explicit removal is intentional", async intent => {
    const f = await restoredMaterials(), outbox = new ConversationOutbox();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw Error("ACK deliberately lost"); }); vi.stubGlobal("fetch", fetch);
    const client = new FlowClient({ baseUrl: "https://center.invalid", token: "fixture-only" }), queue = new QueueCommands(client, async () => {});
    cleanup.push(() => queue.dispose());
    // Same private submission seam used by Thread, before original receipt owners.
    const submit = async () => {
      const material = f.binding.captureDraft(f.composer, { submissionId: uuid(41), intent, text: "next draft" }, null);
      const attachments = material?.capture.attachments;
      if (intent === "queue") await queue.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 0, text: "next draft", attachments } });
      else { const receipt = outbox.begin({ conversationId: "chat", expectedRevision: 0, text: "next draft", attachments }); await client.submitConversationTurn("chat", receipt.request, receipt.turnKey).catch(() => {}); }
    };
    await expect(submit()).rejects.toThrow("Verify every selected file");
    f.page([12]); await f.binding.input!.browse("B"); await f.binding.syncComposerDraft(f.composer);
    expect(f.binding.input!.getSnapshot().items.map(item => item.state)).toEqual(["error", "ready"]);
    expect(f.composer.getState().attachments).toHaveLength(0); await expect(submit()).rejects.toThrow("Verify every selected file");
    expect(outbox.getSnapshot()).toBeNull(); expect(queue.getSnapshot()).toEqual([]); expect(fetch).not.toHaveBeenCalled();
    expect(f.composer.getState().text).toBe("next draft"); expect(f.binding.input!.getSnapshot().items.map(item => item.id)).toEqual(f.items.map(item => item.id));
    f.binding.input!.remove(f.items[0]!.id); await f.binding.syncComposerDraft(f.composer); await submit();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).attachments).toEqual([f.items[1]!.metadata.reference]);
  });
  it("retains A,B order when B is verified before A and rejects incomplete or reordered composer handoff", async () => {
    const f = await restoredMaterials(); f.page([12]); await f.binding.input!.browse("B"); await f.binding.syncComposerDraft(f.composer);
    expect(f.composer.addAttachment).not.toHaveBeenCalled();
    f.page([11]); await f.binding.input!.browse("A");
    const pendingAdd = deferred<void>(); f.pause(pendingAdd.promise); const syncing = f.binding.syncComposerDraft(f.composer);
    expect(f.composer.getState().attachments.map(item => item.id)).toEqual([f.items[0]!.id]);
    const request = { submissionId: uuid(42), intent: "send" as const, text: "next draft" };
    expect(() => f.binding.captureDraft(f.composer, request, null)).toThrow("not synchronized");
    pendingAdd.resolve(); await syncing; await f.binding.syncComposerDraft(f.composer);
    expect(f.composer.getState().attachments.map(item => item.id)).toEqual(f.items.map(item => item.id)); expect(f.composer.addAttachment).toHaveBeenCalledTimes(2);
    const reversed = { getState: () => ({ ...f.composer.getState(), attachments: [...f.composer.getState().attachments].reverse() }) };
    expect(() => f.binding.captureDraft(reversed, request, null)).toThrow("original order");
    const value = f.binding.captureDraft(f.composer, request, null)!;
    expect(value.capture.attachments).toEqual(f.items.map(item => item.metadata.reference)); expect(value.ids).toEqual(f.items.map(item => item.id));
    const receipt = new ConversationOutbox().begin({ conversationId: "chat", expectedRevision: 0, text: "next draft", attachments: value.capture.attachments });
    f.binding.handoff(value, receipt); f.clearComposer(); await f.binding.syncComposerDraft(f.composer);
    expect(f.binding.captureDraft(f.composer, { ...request, submissionId: uuid(43) }, null)).toBeUndefined(); expect(f.binding.input!.getSnapshot().items).toHaveLength(0);
  });
  it("adds the same verified IDs once and removes explicit deletions without re-binding preparation", async () => {
    const f = await restoredMaterials(); const failure = vi.fn(), unbind = f.binding.bindComposer(f.composer, failure); cleanup.push(unbind);
    await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(0);
    await f.binding.input!.browse(); await f.binding.syncComposerDraft(f.composer); await f.binding.syncComposerDraft(f.composer);
    expect(f.composer.getState().attachments.map(item => item.id)).toEqual(f.items.map(item => item.id)); expect(f.composer.addAttachment).toHaveBeenCalledTimes(2);
    f.clearComposer(); await Promise.resolve(); await f.binding.syncComposerDraft(f.composer);
    expect(f.binding.input!.getSnapshot().items).toHaveLength(0); expect(f.composer.getState().attachments).toHaveLength(0); expect(failure).not.toHaveBeenCalled();
  });
  it("does not finish an old sync after visibility/permission revoke and does not append held material to a new draft", async () => {
    const f = await restoredMaterials(); await f.binding.input!.browse(); const pendingAdd = deferred<void>(); f.pause(pendingAdd.promise);
    const adding = f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(1);
    f.configure({ visible: false }); f.configure({ visible: true }); pendingAdd.resolve(); await adding;
    expect(f.composer.getState().attachments).toHaveLength(1); // The old lease cannot resume the second add.
    await f.host.deactivate(ATTACHMENT_OWNER); await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(1);
    await f.host.activate(ATTACHMENT_OWNER); await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(1);
    await f.binding.input!.browse(); await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(2);
    const inTransit = { getState: () => ({ ...f.composer.getState(), attachments: [], inTransit: [{ id: uuid(45), role: "user" as const, text: "old captured draft", quote: undefined, attachments: f.composer.getState().attachments }] }), addAttachment: f.composer.addAttachment };
    const adds = vi.mocked(f.composer.addAttachment).mock.calls.length;
    await f.binding.syncComposerDraft(inTransit);
    expect(f.binding.captureDraft(inTransit, { submissionId: uuid(46), intent: "send", text: "next draft" }, null)).toBeUndefined();
    expect(f.composer.addAttachment).toHaveBeenCalledTimes(adds); expect(f.binding.input!.getSnapshot().items).toHaveLength(2);
    const held = f.binding.capture({ ids: f.items.map(item => item.id), submissionId: uuid(40), intent: "send", text: "old captured draft" }, null);
    f.clearComposer(); await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(0);
    f.binding.failed(held, Error("Original preparation stopped")); await f.binding.syncComposerDraft(f.composer); expect(f.composer.getState().attachments).toHaveLength(0);
    expect(f.binding.getSnapshot().submission?.value).toBe(held);
    expect(f.binding.captureDraft(f.composer, { submissionId: uuid(44), intent: "send", text: "next draft" }, null)).toBeUndefined();
    expect(f.composer.getState().text).toBe("next draft");
  });
});

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
    await a.prepare(command); await b.prepare({ ...command, expectedVersion: 1 }); await a.dispatch(command.id);
    await expect(b.dispatch(command.id)).rejects.toThrow("Another tab");
    await a.checkpoint(command.id, { phase: "accepted", data: { conversationId: "chat", queueRevision: 1 } });
    await expect(b.checkpoint(command.id, { phase: "unknown" })).rejects.toThrow("Another tab");
    expect((await store.list(ns))[0]).toMatchObject({ phase: "accepted", version: 3 });
    await expect(b.prepare(command)).rejects.toThrow("already has a durable accepted");
  });
  it("rejects a delayed restored prepare after another port dispatches or binds CREATE", async () => {
    const { journal: store } = journal(), a = store.bind(ns, () => owner, () => true), b = store.bind(ns, () => owner, () => true);
    await a.prepare(command); await a.dispatch(command.id);
    await expect(b.prepare({ ...command, expectedVersion: 1 })).rejects.toThrow("advanced");
    await expect(b.prepare(command)).rejects.toThrow("advanced");
    await a.checkpoint(command.id, { phase: "prepared", stage: "submit", slot: "queue:new-chat:enqueue", data: { conversationId: "new-chat" } });
    await expect(b.prepare({ ...command, expectedVersion: 2 })).rejects.toThrow("advanced");
    expect((await store.list(ns))[0]).toMatchObject({ version: 3, checkpoint: { conversationId: "new-chat" } });
  });
  it("does not automatically rebind a waiting handoff after same-namespace reauthentication", async () => {
    const { port, journal: store } = journal(), { workspace: binding, reauthenticate } = await workspace(store);
    port.holdNextCommit = true; binding.beginHandoff(owner.viewKey, "queue");
    const preparing = binding.commandPort(owner.viewKey).prepare(command);
    const outcome = expect(preparing).rejects.toThrow(/Authentication|older connection/);
    await vi.waitFor(() => expect(port.releases).toHaveLength(1)); reauthenticate(); port.releases.shift()!(); await outcome;
    expect((await store.list(ns)).filter(record => record.kind === "command")).toEqual([]);
    expect(port.writes.filter(write => write.store === "records")).toHaveLength(1);
    // A later explicit action may persist again using the completed draft's actual version.
    await binding.commandPort(owner.viewKey).prepare({ ...command, explicitRetry: true });
    expect((await store.list(ns)).filter(record => record.kind === "command")).toHaveLength(1);
  });
  it("an explicit retry can open storage after a failed open, without an automatic retry loop", async () => {
    const port = new TransactionPort(); let calls = 0;
    const factory = { open: () => { if (++calls > 1) return port.factory.open("fixture"); const request = { onerror: null as (() => void) | null }; queueMicrotask(() => request.onerror?.()); return request; } } as unknown as IDBFactory;
    const store = new ConversationRecoveryJournal(factory); cleanup.push(() => store.close());
    await expect(store.list(ns)).rejects.toThrow("could not be opened"); expect(calls).toBe(1);
    expect(await store.list(ns)).toEqual([]); expect(calls).toBe(2);
  });
  it("remembers a committed draft version while the revoked public namespace is null, without resuming its send", async () => {
    const { port, journal: store } = journal(), { workspace: binding, revoke, reauthenticate } = await workspace(store);
    port.holdNextCommit = true; binding.beginHandoff(owner.viewKey, "queue");
    const oldPort = binding.commandPort(owner.viewKey), preparing = oldPort.prepare(command);
    const stopped = expect(preparing).rejects.toThrow(/authorize|Authentication|older connection/);
    await vi.waitFor(() => expect(port.releases).toHaveLength(1)); revoke(); port.releases.shift()!(); await stopped;
    expect(await store.list(ns)).toMatchObject([{ kind: "draft", version: 1, data: draft("original") }]);
    reauthenticate(); await expect(oldPort.prepare({ ...command, explicitRetry: true })).rejects.toThrow("older connection");
    expect((await store.list(ns)).filter(record => record.kind === "command")).toEqual([]);
    await binding.commandPort(owner.viewKey).prepare({ ...command, explicitRetry: true });
    expect((await store.list(ns)).filter(record => record.kind === "command")).toHaveLength(1);
  });
  it("closes abandoned blocked-open late success without replacing the newer database", async () => {
    const port = new TransactionPort(), close = vi.fn(); let calls = 0;
    const old = { onblocked: null as (() => void) | null, onsuccess: null as (() => void) | null, result: { close } };
    const factory = { open: () => { if (++calls > 1) return port.factory.open("fixture"); queueMicrotask(() => old.onblocked?.()); return old; } } as unknown as IDBFactory;
    const store = new ConversationRecoveryJournal(factory); cleanup.push(() => store.close());
    await expect(store.list(ns)).rejects.toThrow("blocking"); expect(await store.list(ns)).toEqual([]);
    old.onsuccess?.(); expect(close).toHaveBeenCalledTimes(1); expect(await store.list(ns)).toEqual([]); expect(calls).toBe(2);
  });
  it("clears only a reconciled terminal handoff blocker and persists the deferred next draft", async () => {
    const { port, journal: store } = journal(), { workspace: binding, setDraft, revoke, reauthenticate, restore } = await workspace(store);
    binding.beginHandoff(owner.viewKey, "queue"); await binding.flush().catch(() => {});
    port.holdNextCommit = true;
    const preparing = binding.commandPort(owner.viewKey).prepare(command);
    const stopped = expect(preparing).rejects.toThrow(/authorize|Authentication|older connection/);
    await vi.waitFor(() => expect(port.releases).toHaveLength(1)); revoke(); port.releases.shift()!(); await stopped;
    reauthenticate(); setDraft(draft("independent next draft")); binding.changed(owner.viewKey);
    const other = store.bind(ns, () => owner, () => true); await other.prepare({ ...command, expectedVersion: 1 }); await other.dispatch(command.id); await other.checkpoint(command.id, { phase: "accepted", data: { conversationId: "chat", queueRevision: 1 } });
    const terminal = (await store.list(ns)).find(record => record.id === command.id)!;
    restore.mockRejectedValueOnce(Error("Original identity did not match")); await binding.restore(terminal); expect(binding.protection(owner.viewKey)).not.toEqual([]);
    await binding.restore(terminal); await binding.flush(); expect(restore).toHaveBeenLastCalledWith(terminal); expect(binding.protection(owner.viewKey)).toEqual([]);
    expect((await store.list(ns)).find(record => record.kind === "draft")).toMatchObject({ data: draft("independent next draft") });
    expect((await store.list(ns)).find(record => record.id === command.id)).toMatchObject({ phase: "accepted", version: 3 });
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
  it("reconciles the same original unknown outbox identity to accepted without touching a separate draft", () => {
    const outbox = new ConversationOutbox(() => uuid(4)); const entry = outbox.begin({ conversationId: "chat", expectedRevision: 0, text: "original" });
    outbox.fail(entry.id, "lost ACK", false);
    const record: CommandRecord = { schema: 1, kind: "command", id: entry.id, namespace: namespaceKey(ns), owner, version: 4, updatedAt: 1, domain: "outbox", slot: "turn:chat", frozen: frozenOutbox(entry), display: null, phase: "accepted", stage: "submit", checkpoint: { conversationId: "chat", revision: 1, turnId: "turn", turnNumber: 1, taskId: "task" }, initialBytes: 1024, reserveBytes: 32768 };
    const separate = draft("next draft"); expect(outbox.matchSaved(record).request).toEqual(entry.request); outbox.restore(record); expect(outbox.getSnapshot()).toBeNull(); expect(separate).toEqual(draft("next draft"));
  });
  it("binds a durable accepted CREATE before the original in-memory projection was bound, with zero POST", async () => {
    const creation = { title: "New", harness: "claude" as const, requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const } };
    const snapshot: ConversationSnapshot = { conversation: { ...creation, id: "created-chat", revision: 0, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" }, nativeSession: null, lastTurn: null,
      capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } };
    const post = vi.fn(async () => { throw Error("No POST expected"); });
    const client = { conversation: vi.fn(async () => snapshot), conversationTurns: vi.fn(async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null })), createConversation: post, submitConversationTurn: post, conversationDetail: post };
    const projection = new ConversationProjection(client, null); cleanup.push(() => projection.dispose());
    const entry = projection.outbox.beginCreation(creation); projection.outbox.fail(entry.id, "local checkpoint returned too late", false);
    const record: CommandRecord = { schema: 1, kind: "command", id: entry.id, namespace: namespaceKey(ns), owner, version: 3, updatedAt: 1, domain: "outbox", slot: "turn:created-chat", frozen: frozenOutbox(entry), display: null, phase: "accepted", stage: "create", checkpoint: { conversationId: "created-chat", revision: 0 }, initialBytes: 1024, reserveBytes: 32768 };
    expect(await projection.reconcileReceipt(record)).toBe("created-chat"); expect(projection.getSnapshot().snapshot?.conversation.id).toBe("created-chat"); expect(projection.outbox.getSnapshot()).toBeNull(); expect(post).not.toHaveBeenCalled();
    client.conversation.mockRejectedValueOnce(Error("authorization changed"));
    await expect(projection.reconcileReceipt(record)).rejects.toThrow("did not confirm"); expect(post).not.toHaveBeenCalled();
  });
  it("reconciles an existing unknown queue key to its durable accepted identity without resending", async () => {
    const client = new FlowClient({ baseUrl: "https://center.invalid", token: "fixture-only" }), queue = new QueueCommands(client, async () => {});
    cleanup.push(() => queue.dispose()); const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw Error("ACK lost"); }); vi.stubGlobal("fetch", fetch);
    await queue.execute({ kind: "pause", conversationId: "chat", input: { expectedQueueRevision: 0 } });
    const entry = queue.getSnapshot()[0]!;
    const record: CommandRecord = { schema: 1, kind: "command", id: entry.key, namespace: namespaceKey(ns), owner, version: 3, updatedAt: 1, domain: "queue", slot: "queue:chat:pause", frozen: recoveryValue({ key: entry.key, command: entry.command }), display: null, phase: "accepted", stage: "submit", checkpoint: { conversationId: "chat", queueRevision: 1 }, initialBytes: 1024, reserveBytes: 32768 };
    queue.restore(record); expect(queue.getSnapshot()[0]).toMatchObject({ key: entry.key, state: "accepted" }); expect(fetch).toHaveBeenCalledTimes(1);
    expect(() => queue.restore({ ...record, checkpoint: { conversationId: "other", queueRevision: 1 } })).toThrow("identity"); expect(fetch).toHaveBeenCalledTimes(1);
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
    controller.remove(citation); controller.restore([{ title: "Source", citation }]); await controller.expand(citation); expect(resolve).toHaveBeenCalledTimes(2); expect(controller.freeze()).toEqual([citation]);
  });
});
