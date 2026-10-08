import { versionedSelection, freezeConversationCreation, messageSettingsSubmissionEligibility } from "../src/execution-profiles/selection";
import { bindPreparedDraftReturn, restorePreparedDraft, messageSettingsDraft, MESSAGE_SETTINGS_OWNER, type MessageSettingsDraft, type MessageSettingsPort } from "../src/plugin-integration/message-settings";
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeMessageSettingsCatalogEntrySchema, type ClaudeTurnSettings } from "@flow/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createSteeringControl, type SteeringPort } from "../src/conversation-steering/control";
import { FlowClient } from "@flow/client";
import type { BrowserSessionReady, ConversationSnapshot, ConversationCreation } from "@flow/contracts";
import { ConnectionSession, type SessionClientFactory } from "../src/connection/session";
import { ConversationRecoveryJournal, RecoveryError, namespaceKey, recoveryAddress, recoveryValue, type CommandRecord, type Json, type RecoveryNamespace, type RecoveryRecord } from "../src/recovery/journal";
import { RecoveryWorkspace, RECOVERY_OWNER, readRecoveryDraft, restoreConversationDraft, type CompleteDraft } from "../src/recovery/binding";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { QueueCommands } from "../src/conversations/queue/commands";
import { ConversationOutbox, frozenOutbox, restoreOutbox } from "../src/conversations/outbox";
import { ConversationProjection } from "../src/conversations/projection";
import { createContextSelection } from "../src/conversation-context/controller";
import { themes } from "../src/themes";
import { INTERNAL, type CompleteAttachment, type ComposerRuntime } from "@assistant-ui/react";
import type { AttachmentCapabilities, AttachmentMetadata } from "@flow/contracts";
import { ConversationAttachments, createAttachmentPlugin, ATTACHMENT_OWNER, type AttachmentClient, type AttachmentView } from "../src/plugin-integration/attachments";
import { PluginHost } from "../src/plugins/host";
import type { HostPort, PluginDefinition } from "../src/plugins/types";
import { observeRecoveryRecords } from "./conversation-recovery.fixture";
import { createExistingAttachment } from "../src/attachments/adapter";

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


/** Real App owner seam + actual projection.refresh and private session/lease.
 * Only HTTP results and editor setters are controlled; host.restore is not mocked. */
async function restoringOwner(savedChange: Partial<CompleteDraft> = {}, routeId = owner.routeId) {
  const { journal: store } = journal(), read = deferred<ConversationSnapshot>();
  const snapshot: ConversationSnapshot = { conversation: { title: "Existing", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, projectId: "project",
    id: "chat", revision: 0, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" }, nativeSession: null, lastTurn: null,
    capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } };
  const post = vi.fn(async () => { throw Error("Restore never posts"); });
  const client = { conversation: vi.fn(async () => snapshot), conversationTurns: vi.fn(async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null })), createConversation: post, submitConversationTurn: post, conversationDetail: post };
  const projection = new ConversationProjection(client, "chat"); cleanup.push(() => projection.dispose());
  await projection.refresh(); client.conversation.mockImplementation(() => read.promise);
  const owned = { ...owner, routeId, projectId: "project" };
  let data = recoveryValue({ ...(draft("") as Record<string, Json>), projectId: "project", projectTitle: "Project" });
  const saved = await store.saveDraft(ns, owned, recoveryValue({ ...(draft("saved old text") as Record<string, Json>), projectId: "project", projectTitle: "Project", ...savedChange }), 0);
  let authorized = true, generation = 1, applications = 0;
  const recovery: NonNullable<AppActions["recovery"]> = { journal: store, namespace: () => authorized ? ns : null, authorized: () => authorized, generation: () => generation,
    owner: () => routeId.startsWith("draft-") ? { ...owned, projectId: String((data as Record<string, Json>).projectId) } : owned, draft: () => data,
    restore: async (record, lease) => {
      if (record.kind !== "draft") throw Error("Draft expected");
      return restoreConversationDraft(record, lease, {
        refresh: () => projection.refresh(),
        prepare: restored => {
          // Actual steering owner preflight, as used before App editor/material writes.
          session.steering.configure(owner.viewKey, owned.routeId, projection, true);
          const steering = session.steering.prepareRestoreDrafts(owner.viewKey, restored.steering);
          return () => { steering(); data = recoveryValue(restored); applications++; session.recovery.changed(owner.viewKey); };
        },
      });
    }, retry: async () => { throw Error("Restore must not retry"); } };
  const session = new AppPluginSession(actions(recovery), themes[0]!); cleanup.push(() => session.dispose());
  await session.host.activate(RECOVERY_OWNER);
  return { store, saved, session, post, read, client, snapshot, data: () => data, applications: () => applications,
    edit: (patch: Record<string, Json>) => { data = recoveryValue({ ...(data as Record<string, Json>), ...patch }); session.recovery.changed(owner.viewKey); },
    auth: (value: boolean) => { authorized = value; generation++; session.updateActions(actions(recovery)); } };
}

const changedProfile: Json = { kind: "configured", profile: {
  reference: { id: uuid(50), runnerId: uuid(51), configDigest: "a".repeat(64) },
  configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "configured-alias", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "b".repeat(64), limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 } },
  source: "runner-configured", availability: "not-probed", model: { value: "configured-alias", resolvedModel: null, displayName: "Configured alias", description: "Fixture declaration", providerCapabilities: "unknown" },
  controls: { model: "select-configured-profile", thinking: "fixed-disabled", effort: "unsupported", access: "configured-policy", queue: false, steer: false }, createdAt: "2026-10-06T04:00:00Z",
} };
describe("App restore owner seam with deferred real projection refresh", () => {
  it.each([
    ["text", { text: "newer text" }],
    ["intent only", { intent: "queue" }],
    ["profile only", { profile: changedProfile }],
    ["knowledge", { knowledge: [{ title: "Source", citation: { projectId: "project", sourceId: uuid(52), version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes", start: 0, end: 3 } } }] }],
    ["attachment", { attachments: [{ id: uuid(53), name: "new.txt", state: "unknown", uploadKey: uuid(54) }] }],
    ["steering", { steering: [{ taskId: "task", turnId: "turn", messageId: "message", text: "new instruction" }] }],
  ] satisfies [string, Record<string, Json>][])( "keeps and checkpoints %s edited after Restore started, with zero POST", async (_label, patch) => {
    const f = await restoringOwner(), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    f.session.recovery.close(); f.edit(patch); const newer = f.data();
    expect(f.session.recovery.protection(owner.viewKey)).not.toEqual([]);
    f.read.resolve(f.snapshot); await pending;
    expect(f.applications()).toBe(0); expect(f.data()).toEqual(newer); expect(f.session.recovery.getSnapshot().error).toContain("complete draft changed");
    await f.session.recovery.flush();
    // Normal current-draft CAS updates the one stable slot; Restore itself never deletes it or forks its identity.
    expect(await f.store.list(ns)).toMatchObject([{ id: f.saved.id, owner: f.saved.owner, version: f.saved.version + 1, data: newer }]);
    expect(f.post).not.toHaveBeenCalled();
  });
  it("keeps a new-chat project edit made while the original record is being read", async () => {
    const f = await restoringOwner({}, "draft-original"), listing = deferred<RecoveryRecord[]>(), started = deferred<void>();
    const list = f.store.list.bind(f.store);
    vi.spyOn(f.store, "list").mockImplementationOnce(() => { started.resolve(); return listing.promise; });
    const pending = f.session.recovery.restore(f.saved); await started.promise;
    f.edit({ projectId: "other-project", projectTitle: "Other" }); listing.resolve([f.saved]); await pending; await f.session.recovery.flush();
    expect(f.applications()).toBe(0); expect(f.data()).toMatchObject({ projectId: "other-project", projectTitle: "Other" });
    expect(await list(ns)).toMatchObject([{ data: f.data() }]); expect(f.post).not.toHaveBeenCalled();
  });
  it("detects edit then revert by the lease even when the final full value equals the initial draft", async () => {
    const f = await restoringOwner(), original = f.data(), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    f.edit({ intent: "queue" }); f.edit({ intent: "follow-up" }); f.read.resolve(f.snapshot); await pending; await f.session.recovery.flush();
    expect(f.data()).toEqual(original); expect(f.applications()).toBe(0); expect(f.post).not.toHaveBeenCalled();
  });
  it("applies an unchanged full draft once despite benign initialization notifications", async () => {
    const f = await restoringOwner(), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    f.session.recovery.changed(owner.viewKey); f.read.resolve(f.snapshot); await pending; await f.session.recovery.flush();
    expect(f.data()).toEqual(f.saved.data); expect(f.applications()).toBe(1); expect(f.post).not.toHaveBeenCalled();
    expect(f.session.recovery.protection(owner.viewKey)).toEqual([]);
  });
  it("rejects a second same-view Restore and a new send handoff while the first read is pending", async () => {
    const f = await restoringOwner(), first = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    await f.session.recovery.restore(f.saved);
    expect(f.session.recovery.getSnapshot().error).toContain("already has a restore");
    expect(() => f.session.recovery.beginHandoff(owner.viewKey)).toThrow("Wait for this view");
    f.read.resolve(f.snapshot); await first; await f.session.recovery.flush();
    expect(f.client.conversation).toHaveBeenCalledTimes(2); expect(f.applications()).toBe(1); expect(f.post).not.toHaveBeenCalled();
  });
  it("retains changes across public namespace=null and checkpoints on same-namespace reauthentication", async () => {
    const f = await restoringOwner(), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    f.auth(false); f.edit({ text: "retained offline", intent: "queue" }); f.read.resolve(f.snapshot); await pending;
    expect(f.applications()).toBe(0); expect(f.session.recovery.protection(owner.viewKey)).not.toEqual([]);
    expect(await f.store.list(ns)).toMatchObject([{ version: f.saved.version, data: f.saved.data }]);
    f.auth(true); await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ version: f.saved.version + 1, data: f.data() }]); expect(f.post).not.toHaveBeenCalled();
  });
  it("preflights the actual steering owner before applying any restored editor field", async () => {
    const f = await restoringOwner({ steering: [{ taskId: "missing", turnId: "turn", messageId: "message", text: "saved steering" }] });
    const original = f.data(), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2)); f.read.resolve(f.snapshot); await pending;
    expect(f.session.recovery.getSnapshot().error).toContain("original turn"); expect(f.data()).toEqual(original); expect(f.applications()).toBe(0);
    expect(await f.store.list(ns)).toMatchObject([{ version: f.saved.version, data: f.saved.data }]); expect(f.post).not.toHaveBeenCalled();
  });
});

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

describe("MSG03 recovery material membership", () => {
  it("persists only B while holding A, but keeps current returns, unverified order and explicit A restoration", async () => {
    const { journal: store } = journal();
    const resources: AttachmentMetadata[] = [61, 62, 63].map(n => ({ reference: { kind: "upload", projectId: "project", resourceId: uuid(n), version: 1, contentDigest: "a".repeat(64) }, name: `file-${n}.txt`, mediaType: "text/plain", byteLength: 1, createdAt: "2026-10-06T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", state: "ready", retained: false }));
    const forbidden = vi.fn(async () => { throw Error("No body, upload or business request in this controlled check."); });
    const client: AttachmentClient = { attachmentCapabilities: async () => ({ protocol: "text-v1", recoveryScopeId: uuid(60), projectId: "project", requiresProject: true, mediaTypes: ["text/plain"], extensions: [".txt"], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: "knowledge-then-attachments", unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 }), attachments: async () => ({ resources, nextCursor: null }), attachment: forbidden, attachmentContent: forbidden, attachmentUploadReceipt: forbidden, uploadAttachment: forbidden };
    const snapshot: ConversationSnapshot = { conversation: { id: "chat", title: "Existing", harness: "claude", requested: { model: "default", thinking: "disabled", tools: "configured-readonly" }, projectId: "project", revision: 0, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" }, nativeSession: null, lastTurn: null,
      capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false, attachmentContext: true } };
    const projection = new ConversationProjection({ conversation: async () => snapshot, conversationTurns: async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null }), createConversation: forbidden, submitConversationTurn: forbidden, conversationDetail: forbidden }, "chat");
    cleanup.push(() => projection.dispose()); await projection.refresh();
    const session: AppPluginSession = new AppPluginSession({ ...actions({ journal: store, namespace: () => ns, authorized: () => true, generation: () => 1, owner: () => owner,
      draft: () => recoveryValue({ ...(draft("B") as Record<string, Json>), ...session.recoveryMaterials(owner.viewKey) }), restore: async () => {}, retry: forbidden }),
      attachments: { client, storage: { read: () => null, write() {} }, allowed: () => true } }, themes[0]!);
    cleanup.push(() => session.dispose()); session.knowledgeBinding(owner.viewKey, projection).configure(owner.routeId, true);
    const binding = session.attachmentBinding(owner.viewKey, projection)!;
    await session.host.activate(ATTACHMENT_OWNER); await session.host.activate(RECOVERY_OWNER);
    const original = resources.slice(0, 2).map((metadata, index) => ({ id: uuid(71 + index), name: metadata.name, metadata, state: "ready" as const }));
    binding.restoreDraft(original);
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => [item.id, item.state])).toEqual(original.map(item => [item.id, "error"]));
    await binding.input!.browse();
    let files: CompleteAttachment[] = [], transit: ReturnType<ComposerRuntime["getState"]>["inTransit"] = [];
    const listeners = new Set<() => void>(), emit = () => { for (const listener of listeners) listener(); };
    const composer: Pick<ComposerRuntime, "getState" | "subscribe" | "addAttachment"> = {
      getState: () => ({ type: "thread", canCancel: false, canSend: false, isEditing: false, isEmpty: !files.length, text: "B", role: "user", attachments: files, runConfig: {}, attachmentAccept: ".txt", dictation: undefined, quote: undefined, queue: [], submission: undefined, inTransit: transit }),
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      addAttachment: async value => { if (!("content" in value) || !value.id) throw Error("Complete metadata required"); files = [...files, { ...value, id: value.id, type: value.type ?? "file", status: { type: "complete" } }]; emit(); },
    };
    let unbind = binding.bindComposer(composer); cleanup.push(() => unbind());
    await binding.syncComposerDraft(composer);
    const held = binding.captureDraft(composer, { submissionId: uuid(74), intent: "send", text: "A" }, null)!;
    const capturedFiles = files; files = []; emit(); binding.failed(held, Error("Cancelled before dispatch"));
    const b = binding.input!.select(resources[2]!); await binding.syncComposerDraft(composer);
    expect(files.map(item => item.id)).toEqual([b]);
    await session.recovery.flush();
    const saved = (await store.list(ns)).find(record => record.kind === "draft")!;
    expect(readRecoveryDraft(saved.data).attachments.map(item => item.id)).toEqual([b]);
    expect(binding.input!.getSnapshot().items.map(item => item.id)).toEqual([...held.ids, b]);
    expect(binding.getSnapshot().submission?.value).toBe(held);
    // A rejected local file remains an ordered draft selection even without a chip.
    const invalid = await binding.input!.upload(new File([], "empty.txt", { type: "text/plain" }));
    expect(invalid.state).toBe("error");
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual([b, invalid.id]);
    binding.input!.remove(invalid.id); binding.input!.remove(b); files = []; emit();
    // A current core return/partial explicit restore wins over its held identity.
    await composer.addAttachment(createExistingAttachment(binding.input!, held.ids[0]!));
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual([held.ids[0]]);
    unbind();
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual([held.ids[0]]);
    unbind = binding.bindComposer(composer);
    await composer.addAttachment(createExistingAttachment(binding.input!, held.ids[1]!));
    unbind();
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual(held.ids);
    unbind = binding.bindComposer(composer);
    binding.discardFailedSubmission(); session.recovery.changed(owner.viewKey); await session.recovery.flush();
    const restored = (await store.list(ns)).find(record => record.kind === "draft")!;
    expect(readRecoveryDraft(restored.data).attachments.map(item => item.id)).toEqual(held.ids);
    // The same original selector also excludes detached in-transit A, not current A.
    transit = [{ id: uuid(75), role: "user", text: "A", quote: undefined, attachments: capturedFiles }]; files = [];
    expect(session.recoveryMaterials(owner.viewKey).attachments).toEqual([]);
    files = [capturedFiles[0]!]; expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual([held.ids[0]]);
    let attached = true;
    const replacement = binding.bindComposer({ ...composer, getState: () => {
      if (!attached) throw Error("An unmounted composer must not be read");
      return { ...composer.getState(), attachments: [capturedFiles[1]!] };
    } });
    unbind(); // A late cleanup from the old port must not remove the replacement.
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual([held.ids[1]]);
    replacement(); attached = false;
    expect(session.recoveryMaterials(owner.viewKey).attachments.map(item => item.id)).toEqual(held.ids);
    expect(forbidden).not.toHaveBeenCalled();
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
    await binding.restore(terminal); await binding.flush(); expect(restore).toHaveBeenLastCalledWith(terminal, expect.objectContaining({ check: expect.any(Function), apply: expect.any(Function) })); expect(binding.protection(owner.viewKey)).toEqual([]);
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
  it("blocks a bound late-view turn at the durable barrier and releases its next draft only after explicit retry", async () => {
    const { port, journal: store } = journal(), { workspace: binding, setDraft } = await workspace(store);
    const snapshot: ConversationSnapshot = { conversation: { id: "chat", title: "Late view", harness: "claude", revision: 0,
      requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" },
      nativeSession: null, lastTurn: null, capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } };
    const post = vi.fn(async () => { throw Error("ACK lost"); });
    const client = { conversation: async () => snapshot, conversationTurns: async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null }),
      createConversation: post, submitConversationTurn: post, conversationDetail: post };
    const projection = new ConversationProjection(client, "chat"); cleanup.push(() => projection.dispose());
    projection.configureRecovery(binding.commandPort(owner.viewKey)); await projection.refresh();
    binding.beginHandoff(owner.viewKey);
    await expect(binding.flush()).rejects.toThrow("Some drafts are still only in this page");
    expect(await store.list(ns)).toMatchObject([{ kind: "draft", data: draft("original") }]);
    setDraft(draft("")); binding.changed(owner.viewKey);
    port.holdNextCommit = true; port.failNextCommit = true;
    const sending = projection.send("original");
    await vi.waitFor(() => expect(port.releases).toHaveLength(1)); expect(post).not.toHaveBeenCalled();
    port.releases.shift()!(); await sending;
    const blocked = projection.getSnapshot().outbox!;
    expect(blocked).toMatchObject({ state: "unknown", locallyBlocked: true, everUnknown: false });
    expect(post).not.toHaveBeenCalled(); expect(await store.list(ns)).toMatchObject([{ kind: "draft", data: draft("original") }]);
    const next = { ...(draft("") as Record<string, Json>), steering: [{ taskId: "task", turnId: "turn", messageId: "message", text: "next steering draft" }] };
    setDraft(next); binding.changed(owner.viewKey);
    await projection.retry(); await binding.flush();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("chat", blocked.request, blocked.turnKey, expect.any(AbortSignal));
    const saved = await store.list(ns);
    expect(saved.find(record => record.kind === "command")).toMatchObject({ id: blocked.id, domain: "outbox", frozen: frozenOutbox(blocked) });
    expect(saved.find(record => record.kind === "draft")).toMatchObject({ data: next });
  });
});

describe("second-center controlled principal and generation boundaries", () => {
  it("isolates a changed principal with the same center and address through the real session, journal and recovery boundary", async () => {
    const { journal: store } = journal(), principalB = { ...ns, ownerPrincipalId: uuid(91) };
    const readyA: BrowserSessionReady = { protocol: "flow.browser-session.v1", state: "ready", centerId: ns.centerId, ownerPrincipalId: ns.ownerPrincipalId, expiresAt: "2099-01-01T00:00:00Z", csrfToken: "a".repeat(64) };
    let ready = readyA;
    const connection = new ConnectionSession(ns.baseUrl, () => ({ browserSession: async () => ready, connectBrowserSession: async () => ready,
      logoutBrowserSession: async () => ({ protocol: "flow.browser-session.v1", state: "unauthenticated" }) }));
    cleanup.push(() => connection.dispose()); await connection.read();
    const makeWorkspace = async (identity: RecoveryNamespace, view: typeof owner, value: Json) => {
      const restore = vi.fn(async (_record: RecoveryRecord) => {}), retry = vi.fn(async () => {});
      const host = new AppPluginSession(actions({ journal: store, namespace: () => identity,
        authorized: () => connection.authorized(identity), generation: () => connection.getSnapshot().generation,
        owner: () => view, draft: () => value, restore, retry }), themes[0]!);
      cleanup.push(() => host.dispose()); await host.host.activate(RECOVERY_OWNER);
      host.recovery.changed(view.viewKey); await host.recovery.flush();
      return { host, restore, retry };
    };
    const a = await makeWorkspace(ns, owner, draft("A private draft")), original = (await store.list(ns))[0]!;
    const oldPort = store.bind(ns, () => owner, () => connection.authorized(ns));
    ready = { ...readyA, ownerPrincipalId: principalB.ownerPrincipalId, csrfToken: "b".repeat(64) }; await connection.read();
    expect(connection.getSnapshot().identity).toEqual(principalB); expect(connection.authorized(ns)).toBe(false);
    expect(await store.list(principalB)).toEqual([]);
    await expect(oldPort.prepare(command)).rejects.toThrow();
    await a.host.recovery.restore(original); expect(a.restore).not.toHaveBeenCalled();
    const b = await makeWorkspace(principalB, { ...owner, viewKey: uuid(92) }, draft("B private draft"));
    await b.host.recovery.open(); expect(b.host.recovery.getSnapshot().records).toEqual(await store.list(principalB));
    expect(b.host.recovery.getSnapshot().records.some(record => record.namespace === namespaceKey(ns))).toBe(false);
    await b.host.recovery.restore(original); expect(b.restore).not.toHaveBeenCalled(); expect(b.retry).not.toHaveBeenCalled();
    expect(await store.list(ns)).toEqual([original]); const savedB = await store.list(principalB);
    ready = readyA; await connection.read(); await a.host.recovery.restore(original);
    expect(a.restore).toHaveBeenCalledTimes(1); expect(a.restore.mock.calls[0]![0]).toEqual(original); expect(a.retry).not.toHaveBeenCalled();
    expect(await store.list(principalB)).toEqual(savedB);
  });
  it("rejects ready completions that ignore abort across A to B and B back to A without replacing current authority", async () => {
    const readyA: BrowserSessionReady = { protocol: "flow.browser-session.v1", state: "ready", centerId: ns.centerId, ownerPrincipalId: ns.ownerPrincipalId, expiresAt: "2099-01-01T00:00:00Z", csrfToken: "a".repeat(64) };
    const readyB = { ...readyA, ownerPrincipalId: uuid(93), csrfToken: "b".repeat(64) }, lateA = deferred<BrowserSessionReady>(), lateB = deferred<BrowserSessionReady>();
    const signals: AbortSignal[] = [], responses = [Promise.resolve(readyA), lateA.promise, Promise.resolve(readyB), lateB.promise, Promise.resolve({ ...readyA, csrfToken: "c".repeat(64) })];
    const session = new ConnectionSession(ns.baseUrl, () => ({ browserSession: async signal => { signals.push(signal!); return await responses.shift()!; },
      connectBrowserSession: async () => readyA, logoutBrowserSession: async () => ({ protocol: "flow.browser-session.v1", state: "unauthenticated" }) }));
    cleanup.push(() => session.dispose()); await session.read();
    const oldA = session.read(); await session.connect("controlled-B"); const currentB = session.getSnapshot();
    expect(signals[1]!.aborted).toBe(true); lateA.resolve(readyA); await oldA;
    expect(session.getSnapshot()).toBe(currentB); expect(session.csrfToken()).toBe(readyB.csrfToken);
    const oldB = session.read(); await session.connect("controlled-A"); const currentA = session.getSnapshot();
    expect(signals[3]!.aborted).toBe(true); lateB.resolve(readyB); await oldB;
    expect(session.getSnapshot()).toBe(currentA); expect(session.getSnapshot().identity).toEqual(ns); expect(session.csrfToken()).toBe("c".repeat(64));
    expect(responses).toEqual([]);
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


/** Current-generation deadlines with actual control + journal; only storage completion and HTTP are controlled. */
async function steeringDeadline(stage: "prepare" | "dispatch" | "accepted") {
  const { journal: store } = journal(), entered = deferred<void>(), release = deferred<void>();
  const durable = store.bind(ns, () => owner, () => true), deadline = new AbortController();
  const port: SteeringPort = {
    admission: vi.fn<SteeringPort["admission"]>(async () => ({ taskId: "task", attemptId: "attempt", ownerVersion: 1, revision: 0, state: "ready", reason: "ready" })),
    state: vi.fn<SteeringPort["state"]>(async () => ({ taskId: "task", attemptId: "attempt", revision: 0, sealed: false, attemptAvailable: true, commands: [], nextCursor: null })),
    accept: vi.fn<SteeringPort["accept"]>(async input => ({ replayed: false, command: {
      id: "command", taskId: "task", attemptId: input.attemptId, ownerVersion: input.ownerVersion, nativeSessionId: "native", revision: input.expectedRevision + 1,
      userMessageUuid: uuid(80), status: "accepted", receiptRevision: 0, input: { bytes: Buffer.byteLength(input.text), digest: createHash("sha256").update(input.text).digest("hex") },
      createdAt: "2026-10-07T06:00:00Z", updatedAt: "2026-10-07T06:00:00Z",
    } })),
  };
  const control = createSteeringControl({ connectionScope: "owned-center", taskId: "task" }, port);
  cleanup.push(() => control.dispose());
  let held = false;
  const hold = async (point: typeof stage) => { if (point === stage && !held) { held = true; entered.resolve(); await release.promise; } };
  control.configureRecovery({
    prepare: async value => { await durable.prepare(value); await hold("prepare"); },
    dispatch: async (key, step) => { await durable.dispatch(key, step); await hold("dispatch"); },
    checkpoint: async (key, value) => { await durable.checkpoint(key, value); if (value.phase === "accepted") await hold("accepted"); },
    dismiss: durable.dismiss,
  });
  control.updateGate({ visible: true, online: true, authorized: true }); await control.refresh();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementationOnce(() => deadline.signal); cleanup.push(() => { timeout.mockRestore(); });
  expect(await control.submit("原 steering instruction 中文🙂")).toBe(true); await entered.promise;
  const receipt = control.getSnapshot().receipts[0]!;
  const record = async () => (await store.list(ns)).find(value => value.kind === "command") as CommandRecord;
  return { control, port, release, receipt, record, expire: () => deadline.abort(new DOMException("Steering deadline elapsed", "TimeoutError")) };
}
describe("Recovery P2 steering durable deadline", () => {
  it.each(["prepare", "dispatch"] as const)("settles a %s deadline as not sent and explicitly retries the exact key/input", async stage => {
    const f = await steeringDeadline(stage); f.expire(); f.release.resolve();
    await vi.waitFor(async () => expect(await f.record()).toMatchObject({ phase: "unknown" }));
    await vi.waitFor(() => expect(f.control.getSnapshot()).toMatchObject({ loading: false, receipts: [{ key: f.receipt.key, input: f.receipt.input, phase: "unknown", locallyBlocked: true }] }));
    expect(f.port.accept).not.toHaveBeenCalled();
    expect(f.control.retry(f.receipt.key)).toBe(true);
    await vi.waitFor(() => expect(f.control.getSnapshot().receipts[0]?.phase).toBe("accepted"));
    expect(f.port.accept).toHaveBeenCalledTimes(1);
    expect(vi.mocked(f.port.accept).mock.calls[0]!.slice(0, 2)).toEqual([f.receipt.input, f.receipt.key]);
    expect(await f.record()).toMatchObject({ id: f.receipt.key, phase: "accepted", frozen: { key: f.receipt.key, input: f.receipt.input } });
  });
  it("keeps a committed accepted checkpoint after its deadline without downgrading or resending", async () => {
    const f = await steeringDeadline("accepted"), accepted = await f.record();
    expect(accepted.phase).toBe("accepted"); f.expire(); f.release.resolve();
    await vi.waitFor(() => expect(f.control.getSnapshot().receipts[0]).toMatchObject({ key: f.receipt.key, phase: "accepted", command: accepted.checkpoint }));
    expect(await f.record()).toEqual(accepted); expect(f.control.retry(f.receipt.key)).toBe(false);
    f.control.restore(accepted); expect(f.port.accept).toHaveBeenCalledTimes(1);
  });
  it("ignores a late accepted continuation after revocation and reconciles only on explicit same-key Restore", async () => {
    const f = await steeringDeadline("accepted"), accepted = await f.record();
    f.control.updateGate({ visible: true, online: true, authorized: false }); f.release.resolve();
    await vi.waitFor(() => expect(f.control.getSnapshot().receipts[0]?.phase).toBe("unknown"));
    expect(f.control.retry(f.receipt.key)).toBe(false); expect(await f.record()).toEqual(accepted);
    expect(f.control.getSnapshot().receipts[0]?.phase).toBe("unknown");
    f.control.updateGate({ visible: true, online: true, authorized: true }); f.control.restore(accepted);
    expect(f.control.getSnapshot().receipts[0]).toMatchObject({ key: f.receipt.key, phase: "accepted", command: accepted.checkpoint });
    expect(f.port.accept).toHaveBeenCalledTimes(1);
  });
});

// MSG03 checks actual host/receipt/journal seams; mounted App and native keyboard remain a separate gate.
describe("MSG03 real App seams", () => {
  const reference = { id: uuid(801), runnerId: uuid(802), configDigest: "a".repeat(64) };
  const choice = (model: string): ClaudeTurnSettings => ({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference,
    requested: { model, thinking: "adaptive", effort: { kind: "level", value: "high" }, speed: "standard" } });
  const a = choice("model-A"), b = choice("model-B"), c = choice("model-C");
  const entry = claudeMessageSettingsCatalogEntrySchema.parse({ profile: {
    reference, configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "base", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false,
      materialScopeDigest: "b".repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 1, timeoutMs: 90000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [a.requested, b.requested, c.requested] } },
    source: "runner-configured", availability: "not-probed", model: { value: "base", resolvedModel: null, displayName: "base", description: "Synthetic declarations", providerCapabilities: "unknown" },
    controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } }, createdAt: "2026-10-07T00:00:00Z",
  }, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" } });
  async function host() {
    vi.stubGlobal("HTMLElement", class {}); vi.stubGlobal("document", { activeElement: null });
    let draftValue: MessageSettingsDraft = messageSettingsDraft(), generation = 1, editable = true;
    const port: MessageSettingsPort = {
      read: () => ({ draft: draftValue, generation, editable, context: { profile: reference, capability: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: "execution-profile" } } }),
      replace: (_key, expected, value) => { if (expected !== draftValue.ownership) throw Error("stale"); return draftValue = messageSettingsDraft(value); },
      profiles: async () => ({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: [entry], nextCursor: null }),
    };
    const session = new AppPluginSession({ ...actions(undefined), messageSettings: port }, themes[0]!); cleanup.push(() => session.dispose());
    const binding = session.messageSettingsBinding(owner.viewKey); binding.configure(owner.routeId, true);
    const open = async () => { const result = await session.host.execute("flow.message-settings.open", null, { kind: "composer", viewId: owner.routeId, isDraft: true }); expect(result.ok).toBe(true); await binding.catalog.refresh(); };
    await open();
    return { session, binding, open, read: () => draftValue, port, revoke: () => { editable = false; generation++; }, reauth: () => { editable = true; generation++; } };
  }
  it("freezes A before material await, rotates equal-value ownership, and preserves B through original-key retry", async () => {
    const f = await host(); expect(f.binding.commit(a, f.read().ownership)).toEqual({ status: "applied" });
    const captured = f.binding.capture(), next = f.binding.detach(captured), prepared = deferred<void>();
    expect(next).not.toBe(captured.ownership); expect(f.read().value).toEqual(a);
    expect(f.binding.commit(undefined, captured.ownership)).toEqual({ status: "stale" });
    expect(f.binding.commit(b, f.read().ownership)).toEqual({ status: "applied" });
    const outbox = new ConversationOutbox(() => uuid(810)); cleanup.push(() => outbox.dispose());
    const pending = prepared.promise.then(() => outbox.begin({ conversationId: "chat", expectedRevision: 0, text: "same text", messageSettings: captured.value }));
    prepared.resolve(); const receipt = await pending;
    expect(receipt.request.messageSettings).toEqual(a); expect(Object.isFrozen(receipt.request.messageSettings!.requested.effort)).toBe(true);
    outbox.fail(receipt.id, "ACK lost", false); const original = frozenOutbox(outbox.getSnapshot()!);
    expect(f.read().value).toEqual(b); expect(f.binding.isCurrent(next)).toBe(false);
    const retried = outbox.retry(receipt.id)!; expect(frozenOutbox(retried)).toEqual(original); expect(f.read().value).toEqual(b);
  });
  it("checks live authority for omit and cannot revive an opening after disable/re-enable", async () => {
    const f = await host(), first = f.read().ownership;
    f.revoke(); expect(f.binding.commit(undefined, first)).toEqual({ status: "unavailable" });
    f.reauth(); f.binding.sync(); await f.session.host.deactivate(MESSAGE_SETTINGS_OWNER); await f.session.host.activate(MESSAGE_SETTINGS_OWNER);
    expect(f.binding.commit(a, first)).toEqual({ status: "unavailable" }); expect(f.read().value).toBeUndefined();
    await f.open(); expect(f.binding.commit(a, first)).toEqual({ status: "applied" });
    const captured = f.binding.capture(), next = f.binding.detach(captured);
    f.revoke(); f.reauth();
    expect(() => f.binding.restoreCaptured(captured, { ownership: next, generation: captured.generation })).toThrow("draft changed");
    const stale = f.read().ownership; f.port.replace(owner.viewKey, stale, a);
    expect(f.binding.commit(undefined, stale)).toEqual({ status: "stale" });
  });
  it("revokes the old opening on hide and aborts its directory read without replacing C", async () => {
    const f = await host(); f.binding.commit(a, f.read().ownership); const before = f.read(), wait = deferred<ReturnType<typeof entryPage>>();
    function entryPage(): Awaited<ReturnType<MessageSettingsPort["profiles"]>> { return { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles: [entry], nextCursor: null }; }
    let requestSignal: AbortSignal | undefined;
    f.port.profiles = async (_options, signal) => { requestSignal = signal; return wait.promise; };
    const pending = f.binding.catalog.refresh(); f.binding.configure(owner.routeId, false);
    expect(requestSignal?.aborted).toBe(true); wait.resolve(entryPage()); await pending;
    expect(f.binding.catalog.getSnapshot().stale).toBe(true); expect(f.read()).toBe(before);
    expect(f.binding.commit(undefined, before.ownership)).toEqual({ status: "unavailable" });
  });
  it("keeps legacy absent drafts but rejects malformed settings and freezes valid settings-only drafts", () => {
    expect(readRecoveryDraft(draft("")).messageSettings).toBeUndefined();
    const saved = readRecoveryDraft(recoveryValue({ ...(draft("") as object), messageSettings: a }));
    expect(saved.text).toBe(""); expect(saved.messageSettings).toEqual(a); expect(Object.isFrozen(saved.messageSettings!.profile)).toBe(true);
    expect(() => readRecoveryDraft(recoveryValue({ ...(draft("") as object), messageSettings: { ...a, requested: { ...a.requested, speed: "invented" } } }))).toThrow();
  });
  it.each(["settings", "omit", "ABA"])("keeps current complete draft when %s changes during real projection refresh", async kind => {
    const f = await restoringOwner({ messageSettings: a }), pending = f.session.recovery.restore(f.saved);
    await vi.waitFor(() => expect(f.client.conversation).toHaveBeenCalledTimes(2));
    f.edit({ messageSettings: recoveryValue(b) });
    if (kind === "omit") f.edit({ messageSettings: undefined as unknown as Json });
    if (kind === "ABA") f.edit({ messageSettings: recoveryValue(a) });
    const current = f.data(); f.read.resolve(f.snapshot); await pending;
    expect(f.session.recovery.getSnapshot().error).toContain("complete draft changed");
    await f.session.recovery.flush();
    expect(await f.store.list(ns)).toMatchObject([{ id: f.saved.id, data: current }]);
    expect(f.data()).toEqual(current); expect(f.applications()).toBe(0); expect(f.post).not.toHaveBeenCalled();
  });
  it.each(["failure", "cancel"] as const)("preserves B through the real installed core material %s return, keeping A explicit", async outcome => {
    const f = await host(), prepared = deferred<CompleteAttachment>();
    f.binding.commit(a, f.read().ownership);
    const frozen = f.binding.capture(), next = f.binding.detach(frozen);
    const captured = { text: "same text", ids: ["file-a"], entered: false, returning: undefined as { text: string; ids: readonly string[] } | undefined };
    const removed = vi.fn(), delivered = vi.fn(), returned = vi.fn();
    const core = new INTERNAL.DefaultThreadComposerRuntimeCore({ messages: [], isSendDisabled: false, capabilities: { cancel: false },
      subscribe: () => () => {}, append: delivered,
      adapters: { attachments: { accept: "text/plain", async *add() { yield { id: "file-a", type: "file", name: "a.txt", contentType: "text/plain", status: { type: "requires-action", reason: "composer-send" } }; },
        send: () => prepared.promise, remove: async () => { if (!captured.returning) removed(); } } },
    } as unknown as ConstructorParameters<typeof INTERNAL.DefaultThreadComposerRuntimeCore>[0]);
    cleanup.push(() => core.__internal_dispose());
    const composer = { getState: () => ({ text: core.text, attachments: core.attachments, submission: core.submission, inTransit: core.inTransit }),
      subscribe: (listener: () => void) => core.subscribe(listener), setText: (value: string) => core.setText(value),
      addAttachment: (value: Parameters<typeof core.addAttachment>[0]) => core.addAttachment(value),
      getAttachmentByIndex: (index: number) => ({ remove: () => core.removeAttachment(core.attachments[index]!.id) }),
    } as unknown as ComposerRuntime;
    cleanup.push(bindPreparedDraftReturn(composer, () => captured, returned));
    await core.addAttachment(new File(["a"], "a.txt", { type: "text/plain" })); core.setText(captured.text);
    const sending = core.send(); expect(core.submission?.text).toBe(captured.text); expect(core.text).toBe("");
    f.binding.commit(b, f.read().ownership); core.setText(outcome === "failure" ? captured.text : "");
    const nextText = core.text;
    if (outcome === "cancel") core.cancel(); else prepared.reject(Error("material unavailable"));
    await vi.waitFor(() => expect(returned).toHaveBeenCalledTimes(1));
    expect(returned.mock.calls[0]![1]).toBeUndefined(); expect(core.text).toBe(nextText); expect(core.attachments).toEqual([]);
    expect(f.read().value).toEqual(b); expect(f.binding.isCurrent(next)).toBe(false);
    expect(frozen.value).toEqual(a); expect(captured.text).toBe("same text"); expect(removed).not.toHaveBeenCalled(); expect(delivered).not.toHaveBeenCalled();
    if (outcome === "cancel") prepared.resolve({ id: "file-a", type: "file", name: "a.txt", contentType: "text/plain", content: [], status: { type: "complete" } });
    await sending;
    const held = { ...captured, settings: frozen, nextOwnership: next };
    const destination = { composer, settings: f.binding, assertCurrent: () => {},
      material: (id: string) => ({ id, type: "file" as const, name: "a.txt", contentType: "text/plain", content: [] }) };
    await expect(restorePreparedDraft(held, destination)).rejects.toThrow("next complete draft");
    expect(f.read().value).toEqual(b); expect(core.text).toBe(nextText);
    // The user explicitly clears B/omits C; reconnect must not permanently lock held A.
    f.port.replace(owner.viewKey, f.read().ownership, undefined); core.setText(""); f.revoke(); f.reauth();
    await restorePreparedDraft(held, destination);
    expect(core.text).toBe(captured.text); expect(core.attachments.map(file => file.id)).toEqual(["file-a"]);
    expect(f.read().value).toEqual(a); expect(f.read().ownership).not.toBe(next); expect(delivered).not.toHaveBeenCalled();
  });
  it("rejects late explicit restore after B changes during an attachment await without overwriting B", async () => {
    const f = await host(); f.binding.commit(a, f.read().ownership); const frozen = f.binding.capture(), next = f.binding.detach(frozen);
    f.port.replace(owner.viewKey, f.read().ownership, undefined);
    let text = "", files: { id: string }[] = []; const listeners = new Set<() => void>(), wait = deferred<void>();
    const emit = () => listeners.forEach(listener => listener());
    const composer = { getState: () => ({ text, attachments: files }), subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
      setText: (value: string) => { text = value; emit(); },
      addAttachment: async (value: { id: string }) => { files.push(value); emit(); await wait.promise; },
    } as unknown as ComposerRuntime;
    const restoring = restorePreparedDraft({ text: "A", ids: ["a", "a2"], entered: false, settings: frozen, nextOwnership: next }, {
      composer, settings: f.binding, assertCurrent: () => {}, material: id => ({ id, type: "file", name: id, contentType: "text/plain", content: [] }),
    });
    expect(text).toBe("A"); f.port.replace(owner.viewKey, f.read().ownership, b); composer.setText("B"); wait.resolve();
    await expect(restoring).rejects.toThrow("complete draft changed");
    expect(text).toBe("B"); expect(f.read().value).toEqual(b); expect(files.map(file => file.id)).toEqual(["a"]); expect(listeners.size).toBe(0);
  });
  it("retains exact Queue B across unknown acknowledgement and C changes", async () => {
    const requests: { body: unknown; key: string }[] = [];
    const port = { enqueueConversationTurn: async (_id: string, body: unknown, key: string) => { requests.push({ body: structuredClone(body), key }); throw Error("ACK lost"); } } as unknown as ConstructorParameters<typeof QueueCommands>[0];
    const commands = new QueueCommands(port, async () => {}); cleanup.push(() => commands.dispose());
    const input = structuredClone(b); await commands.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 3, text: "same text", messageSettings: input } });
    input.requested.model = "mutated"; const receipt = commands.getSnapshot()[0]!; expect(receipt.state).toBe("unknown");
    const current = messageSettingsDraft(c); await commands.retry(receipt.key);
    expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect((requests[0]!.body as { messageSettings: unknown }).messageSettings).toEqual(b); expect(current.value).toEqual(c);
    const omitted = new ConversationOutbox(); cleanup.push(() => omitted.dispose());
    expect(omitted.begin({ conversationId: "chat", text: "legacy", expectedRevision: 0 }).request).not.toHaveProperty("messageSettings");
  });
});


describe("versioned creation recovery invariants", () => {
  const reference = { id: uuid(901), runnerId: uuid(902), configDigest: "a".repeat(64) };
  const requested = { model: "explicit-A", thinking: "adaptive" as const, effort: { kind: "level" as const, value: "high" as const }, speed: "fast" as const };
  function selection() {
    return versionedSelection({ profile: {
      reference, configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "base", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false,
        materialScopeDigest: "b".repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 1, timeoutMs: 90000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [requested] } },
      source: "runner-configured", availability: "not-probed", model: { value: "base", resolvedModel: null, displayName: "base", description: "Synthetic declaration", providerCapabilities: "unknown" },
      controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: "configuration.turnSettings.choices" } }, createdAt: "2026-10-08T00:00:00Z",
    }, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" } });
  }
  it("restores the explicit versioned branch with exact frozen reference and an editable omitted tuple", () => {
    const selected = selection();
    const saved = readRecoveryDraft(recoveryValue({ ...(draft("kept body") as object), profile: selected }));
    expect(saved.profile).toEqual(selected); expect(saved.messageSettings).toBeUndefined(); expect(saved.text).toBe("kept body");
    expect(saved.projectId).toBeNull(); expect(Object.isFrozen(saved.profile)).toBe(true);
    expect(readRecoveryDraft(draft("legacy")).profile).toEqual({ kind: "legacy-default" });
    const corrupted = { kind: "versioned", entry: claudeMessageSettingsCatalogEntrySchema.parse(selected.entry) }; corrupted.entry.profile.reference.configDigest = "invalid";
    expect(() => readRecoveryDraft(recoveryValue({ ...(draft("") as object), profile: corrupted }))).toThrow();
    expect(() => readRecoveryDraft(recoveryValue({ ...(draft("") as object), profile: { kind: "configured", profile: selected.entry.profile } }))).toThrow();
  });
  it("preserves stale saved identity without turning a current catalog into permission", () => {
    const selected = selection(), value = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested };
    const saved = readRecoveryDraft(recoveryValue({ ...(draft("next") as object), profile: selected, messageSettings: value }));
    const current = structuredClone(reference); current.configDigest = "c".repeat(64);
    const catalog = { profiles: [selected.entry.profile], nextCursor: null, loading: false, error: null, loaded: true, stale: false, canLoadMore: false };
    expect(messageSettingsSubmissionEligibility(saved.messageSettings, catalog, { profile: current, capability: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: current, choices: "execution-profile" } }, saved.profile).allowed).toBe(false);
    expect(saved.profile).toEqual(selected); expect(saved.messageSettings).toEqual(value);
  });
  it("keeps UNKNOWN CREATE on its original key and body while a separate complete draft stays intact", async () => {
    const selected = selection(), creation = freezeConversationCreation("Prepared", selected), calls: { key: string; body: unknown }[] = [];
    const snapshot: ConversationSnapshot = { conversation: { ...creation, id: "prepared-chat", revision: 0, createdAt: "2026-10-08T00:00:00Z", updatedAt: "2026-10-08T00:00:00Z" }, nativeSession: null, lastTurn: null,
      capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false,
        messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: "execution-profile" } } };
    const submit = vi.fn(async () => { throw Error("No turn before explicit submission"); });
    const client = { conversation: vi.fn(async () => snapshot), conversationTurns: vi.fn(async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null })),
      createConversation: vi.fn(async (body: ConversationCreation, key = "") => { calls.push({ key, body: structuredClone(body) }); if (calls.length === 1) throw Error("ACK lost"); return { conversation: snapshot.conversation, capabilities: snapshot.capabilities }; }),
      submitConversationTurn: submit, conversationDetail: submit };
    const projection = new ConversationProjection(client, null); cleanup.push(() => projection.dispose());
    const independent = readRecoveryDraft(recoveryValue({ ...(draft("next untouched body") as object), profile: selected }));
    const before = structuredClone(independent);
    await projection.prepare(creation); expect(projection.outbox.getSnapshot()).toMatchObject({ kind: "creation", state: "unknown", request: null });
    expect(client.conversation).not.toHaveBeenCalled();
    await expect(projection.prepare({ ...creation, title: "must not replace" })).rejects.toThrow("unresolved");
    expect(calls).toHaveLength(1);
    await projection.retry(); await projection.refresh();
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]); expect(projection.outbox.getSnapshot()).toBeNull();
    expect(independent).toEqual(before); expect(submit).not.toHaveBeenCalled();
    const catalog = { profiles: [selected.entry.profile], nextCursor: null, loading: false, error: null, loaded: true, stale: false, canLoadMore: false };
    const context = { profile: snapshot.conversation.executionProfile!, capability: snapshot.capabilities.messageSettings! };
    expect(messageSettingsSubmissionEligibility(undefined, catalog, context, selected).allowed).toBe(false);
    expect(messageSettingsSubmissionEligibility({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested }, catalog, context, selected).allowed).toBe(true);
  });
});
