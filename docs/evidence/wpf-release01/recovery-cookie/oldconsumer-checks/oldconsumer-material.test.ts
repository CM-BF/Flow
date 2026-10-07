// Same single controlled membership scenario from fixed c848; all production imports resolve to this 7272-based consumer.
// The deterministic IDB port is a test port, not real browser/IDB evidence.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationSnapshot, AttachmentMetadata } from "@flow/contracts";
import { ConversationRecoveryJournal, recoveryValue, type Json, type RecoveryNamespace } from "@release-source/recovery/journal";
import { RECOVERY_OWNER, readRecoveryDraft } from "@release-source/recovery/binding";
import { AppPluginSession, type AppActions } from "@release-source/plugin-integration/session";
import { ConversationProjection } from "@release-source/conversations/projection";
import { themes } from "@release-source/themes";
import type { CompleteAttachment, ComposerRuntime } from "@assistant-ui/react";
import { ATTACHMENT_OWNER, type AttachmentClient } from "@release-source/plugin-integration/attachments";
import { createExistingAttachment } from "@release-source/attachments/adapter";
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ns: RecoveryNamespace = { baseUrl: "https://center.example/proxy", centerId: uuid(1), ownerPrincipalId: uuid(2) };
const owner = { viewKey: uuid(3), routeId: "conversation:chat" };
const draft = (text: string): Json => ({ text, intent: "follow-up", profile: { kind: "legacy-default" }, projectId: null, projectTitle: null, knowledge: [], attachments: [], steering: [] });
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
describe("RELEASE01 old consumer material membership", () => {
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

