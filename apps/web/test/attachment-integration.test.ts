import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { FlowApiError, FlowClient } from "@flow/client";
import { MessageNotSentError, type ComposerRuntime } from "@assistant-ui/react";
import type { AttachmentCapabilities, AttachmentMetadata, AttachmentUpload } from "@flow/contracts";
import { ConversationAttachments, createAttachmentPlugin, ATTACHMENT_OWNER, ATTACHMENT_OPEN, type AttachmentClient, type AttachmentView } from "../src/plugin-integration/attachments";
import { createExistingAttachment } from "../src/attachments/adapter";
import { PluginHost } from "../src/plugins/host";
import type { HostPort } from "../src/plugins/types";
import { ConversationOutbox } from "../src/conversations/outbox";
import { QueueCommands } from "../src/conversations/queue/commands";

const scope = "10000000-0000-4000-8000-000000000001";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const meta = (n = 1): AttachmentMetadata => ({ reference: { kind: "upload", projectId: "project-a", resourceId: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`, version: 1, contentDigest: hash("hello") }, name: `note-${n}.txt`, mediaType: "text/plain", byteLength: 5,
  state: "ready", retained: false, createdAt: "2026-10-06T00:00:00Z", expiresAt: "2099-10-07T00:00:00Z" });
const cap: AttachmentCapabilities = { protocol: "text-v1", recoveryScopeId: scope, projectId: "project-a", requiresProject: true, mediaTypes: ["text/plain"], extensions: [".txt"], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: "knowledge-then-attachments", unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const disposables: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const dispose of disposables.splice(0).reverse()) await dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup(storage = { read: (): string | null => null, write: (_value: string) => {} }) {
  let view: AttachmentView | null = { viewId: "draft-route", conversationId: null, projectId: "project-a", visible: true, online: true, canRead: true, canUpload: true, attachmentContext: false };
  const lifetime = new AbortController(); let binding: ConversationAttachments;
  const constant = <T,>(value: T) => ({ getSnapshot: () => value, subscribe: () => () => {} });
  const grants = { read: true, upload: true };
  const port: HostPort = { navigation: constant({ activeTaskId: "other-pane", workspaceTab: "files", workspaceOpen: false }), theme: constant({ themeId: "light", scheme: "light", availableThemes: [] }),
    getContext: () => ({ kind: "global" }), authorize: (_plugin, capability, context) => context.kind === "composer" && context.viewId === view?.viewId && (capability === "attachment.upload" ? grants.upload : grants.read), execute: async () => {} };
  const host = new PluginHost(port);
  const client = {
    attachmentCapabilities: vi.fn<AttachmentClient["attachmentCapabilities"]>(async () => cap),
    attachments: vi.fn<AttachmentClient["attachments"]>(async () => ({ resources: [meta(), meta(2)], nextCursor: null })),
    attachment: vi.fn<AttachmentClient["attachment"]>(async () => meta()),
    attachmentContent: vi.fn<AttachmentClient["attachmentContent"]>(async () => ({ reference: meta().reference, name: meta().name, mediaType: "text/plain", byteLength: 5, text: "hello" })),
    attachmentUploadReceipt: vi.fn<AttachmentClient["attachmentUploadReceipt"]>(async () => { throw new FlowApiError(404, "attachment_upload_receipt_not_found", "not visible"); }),
    uploadAttachment: vi.fn<AttachmentClient["uploadAttachment"]>(async (_project, request, key) => ({ replayed: false, uploadKey: key, recoveryScopeId: request.recoveryScopeId, requestDigest: "a".repeat(64), resource: { ...meta(), name: request.name, byteLength: request.byteLength, reference: { ...meta().reference, contentDigest: request.contentDigest } } })),
  };
  host.register(createAttachmentPlugin(route => view?.viewId === route ? binding : undefined));
  binding = new ConversationAttachments({ connectionId: "connection-a", viewKey: "stable-view", projectId: "project-a" }, { host, client, signal: lifetime.signal, current: () => view, storage });
  disposables.push(() => host.dispose(), () => binding.dispose());
  return { binding, host, client, grants, lifetime, configure(patch: Partial<AttachmentView>) { view = { ...view!, ...patch }; binding.sync(); },
    async ready() { const result = await host.execute(ATTACHMENT_OPEN, undefined, binding.context()); expect(result.ok).toBe(true); await binding.input!.browse(); },
    closeIdentity() { view = null; binding.sync(); } };
}
function capture(binding: ConversationAttachments, ids: string[], previous = null) {
  return binding.capture({ ids, submissionId: crypto.randomUUID(), intent: "send", text: "original text" }, previous);
}

describe("private attachment host binding", () => {
  it("is lazy, uses stable view identity across CREATE aliases, and closes only its Dialog", async () => {
    const f = setup(); expect(f.client.attachmentCapabilities).not.toHaveBeenCalled(); await f.ready();
    const id = f.binding.input!.select(meta()); f.configure({ viewId: "created-route", conversationId: "chat", attachmentContext: true });
    f.binding.close(); const value = capture(f.binding, [id]);
    expect(value.capture.binding.viewId).toBe("stable-view"); expect(value.capture.attachments).toEqual([meta().reference]);
    expect(f.binding.getSnapshot().open).toBe(false); expect(f.client.attachmentCapabilities).toHaveBeenCalledTimes(1);
    expect((await f.host.execute(ATTACHMENT_OPEN, undefined, { kind: "composer", viewId: "draft-route", isDraft: true })).ok).toBe(false);
    f.binding.failed(value, Error("not dispatched"));
  });
  it("checks distinct P01 upload grant, never recurses into its own port, and never borrows global focus", async () => {
    const f = setup(); await f.ready(); f.grants.upload = false;
    const denied = await f.binding.input!.upload(new File(["hello"], "note.txt", { type: "text/plain" }));
    expect(denied.state).toBe("unknown"); expect(f.client.uploadAttachment).not.toHaveBeenCalled();
    f.binding.input!.remove(denied.id); f.grants.upload = true;
    const ready = await f.binding.input!.upload(new File(["hello"], "note.txt", { type: "text/plain" }));
    expect(ready.state).toBe("ready"); expect(f.client.uploadAttachment).toHaveBeenCalledTimes(1);
  });
  it("revokes hidden/offline/disabled reads, rejects late data and rechecks capability on resume", async () => {
    const f = setup(); await f.ready(); const slow = deferred<Awaited<ReturnType<AttachmentClient["attachments"]>>>();
    f.client.attachments.mockReturnValueOnce(slow.promise); const loading = f.binding.input!.browse();
    await vi.waitFor(() => expect(f.client.attachments).toHaveBeenCalledTimes(2));
    f.configure({ online: false }); slow.resolve({ resources: [meta(2)], nextCursor: null }); await loading;
    await f.binding.input!.browse(); expect(f.client.attachments).toHaveBeenCalledTimes(2); expect(f.binding.input!.getSnapshot().page).toEqual([meta(), meta(2)]);
    f.configure({ online: true }); await f.binding.input!.browse(); expect(f.client.attachmentCapabilities).toHaveBeenCalledTimes(2);
    await f.host.deactivate(ATTACHMENT_OWNER); await f.binding.input!.browse(); expect(f.client.attachments).toHaveBeenCalledTimes(3);
  });
  it("keeps storage errors local without erasing unknown bytes or constructing an input", async () => {
    const write = vi.fn(); const f = setup({ read: () => "corrupt unknown record", write });
    expect(f.binding.input).toBeNull(); expect(f.binding.getSnapshot().error).toMatch(/not erased.*Plain text/);
    expect(write).not.toHaveBeenCalled(); expect(f.binding.protection()).toContain("Attachment recovery storage error");
    expect(f.client.attachmentCapabilities).not.toHaveBeenCalled();
  });
  it("only maps the documented absent upload receipt, not denied or malformed responses", async () => {
    let raw: string | null = null; const f = setup({ read: () => raw, write: value => { raw = value; } }); await f.ready();
    f.client.uploadAttachment.mockRejectedValueOnce(Error("lost"));
    const item = await f.binding.input!.upload(new File(["hello"], "note.txt", { type: "text/plain" }));
    await f.binding.input!.recover(item.uploadKey!); expect(f.binding.input!.getSnapshot().error).toMatch(/No committed receipt/);
    f.client.attachmentUploadReceipt.mockRejectedValueOnce(new FlowApiError(403, "forbidden", "Denied explicitly"));
    await f.binding.input!.recover(item.uploadKey!); expect(f.binding.input!.getSnapshot().error).toBe("Denied explicitly");
    expect(f.binding.input!.getSnapshot().recovery[0]?.state).toBe("unknown");
    f.closeIdentity(); await f.binding.input!.recover(item.uploadKey!); expect(f.client.attachmentUploadReceipt).toHaveBeenCalledTimes(2);
  });
  it("propagates local upload cancellation through the P01 command to the real private client", async () => {
    const f = setup(); await f.ready(); const pending = deferred<Awaited<ReturnType<AttachmentClient["uploadAttachment"]>>>();
    f.client.uploadAttachment.mockReturnValueOnce(pending.promise);
    const uploading = f.binding.input!.upload(new File(["hello"], "note.txt", { type: "text/plain" }));
    await vi.waitFor(() => expect(f.client.uploadAttachment).toHaveBeenCalledTimes(1));
    const call = f.client.uploadAttachment.mock.calls[0]!; expect(call[3]?.aborted).toBe(false);
    f.configure({ visible: false }); expect(call[3]?.aborted).toBe(true); await uploading;
    expect(f.binding.input!.getSnapshot().items[0]?.state).toBe("unknown");
    pending.resolve({ replayed: false, uploadKey: call[2], recoveryScopeId: scope, requestDigest: "a".repeat(64), resource: meta() });
    await Promise.resolve(); expect(f.binding.input!.getSnapshot().items[0]?.state).toBe("unknown");
  });
  it("preserves unknown recovery on bad 200 and expired namespace instead of treating either as absence", async () => {
    let raw: string | null = null; const f = setup({ read: () => raw, write: value => { raw = value; } }); await f.ready();
    f.client.uploadAttachment.mockRejectedValueOnce(Error("lost")); const item = await f.binding.input!.upload(new File(["hello"], "note.txt", { type: "text/plain" }));
    f.client.attachmentUploadReceipt.mockResolvedValueOnce(JSON.parse('{"receipt":{}}'));
    await f.binding.input!.recover(item.uploadKey!); expect(f.binding.input!.getSnapshot().error).not.toMatch(/No committed receipt/);
    f.configure({ online: false }); f.client.attachmentCapabilities.mockResolvedValueOnce({ ...cap, recoveryScopeId: "30000000-0000-4000-8000-000000000001" }); f.configure({ online: true });
    await f.binding.input!.recover(item.uploadKey!); expect(f.binding.input!.getSnapshot().error).toMatch(/another center namespace/);
    expect(f.client.attachmentUploadReceipt).toHaveBeenCalledTimes(1); expect(f.binding.input!.getSnapshot().recovery[0]?.state).toBe("unknown");
  });
  it("requires a new matching real local Outbox receipt, then consumes before network and leaves the next draft", async () => {
    const f = setup(); await f.ready(); f.configure({ conversationId: "chat", attachmentContext: true });
    const id = f.binding.input!.select(meta()), token = capture(f.binding, [id]);
    f.binding.input!.remove(id); expect(f.binding.protection()).toContain("Material submission or recovery");
    expect(() => f.binding.handoff(token, null)).toThrow(/No new local/);
    const next = f.binding.input!.select(meta(2)); const box = new ConversationOutbox();
    const receipt = box.begin({ conversationId: "chat", expectedRevision: 0, text: token.capture.text, knowledge: token.capture.knowledge, attachments: token.capture.attachments });
    f.binding.handoff(token, receipt);
    expect(box.getSnapshot()?.state).toBe("sending"); expect(f.binding.input!.getSnapshot().items.map(item => item.id)).toEqual([next]);
    box.fail(receipt.id, "lost ACK", false); expect(box.retry(receipt.id)?.request?.attachments).toEqual([meta().reference]);
    expect(f.binding.getSnapshot().submission).toBeNull();
  });
  it("fails before local handoff on hidden capture, preserving held recovery after items are removed", async () => {
    const f = setup(); await f.ready(); f.configure({ conversationId: "chat", attachmentContext: true }); const id = f.binding.input!.select(meta());
    const token = capture(f.binding, [id]); f.binding.input!.remove(id); f.configure({ visible: false });
    expect(() => f.binding.assertSubmission(token, [id])).toThrow(); f.binding.failed(token, Error("view hidden"));
    expect(f.binding.getSnapshot().submission?.value.capture.text).toBe("original text");
    expect(f.binding.protection()).toContain("Material submission or recovery");
    f.configure({ visible: true }); expect(() => f.binding.assertSubmission(token, [id])).toThrow();
    f.binding.discardFailedSubmission(); expect(f.binding.protection()).not.toContain("Material submission or recovery");
  });
});

it("real QueueCommands + FlowClient retains ordered v2 materials after a malformed ACK and retries original bytes/key", async () => {
  const calls: { body: string; key: string | null }[] = []; const refs = [meta(2).reference, meta().reference];
  const context = { id: "ctx", contextDigest: "a".repeat(64), executionInputId: "input", executionInputDigest: "b".repeat(64), templateVersion: 2, order: "knowledge-then-attachments", sources: [], attachments: [meta(2), meta()].map(({ reference, name, mediaType, byteLength }) => ({ reference, name, mediaType, byteLength })) };
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_url, init) => {
    calls.push({ body: String(init?.body), key: new Headers(init?.headers).get("Idempotency-Key") });
    return Response.json({ conversationId: "chat", queueRevision: 1, replayed: calls.length > 1, item: { id: "item", conversationId: "chat", sequence: 1, state: "waiting", preview: "queued", truncated: false, promoted: null, createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z", ...(calls.length > 1 ? { context } : {}) } });
  }));
  const commands = new QueueCommands(new FlowClient({ baseUrl: "http://unit.invalid", token: "unit-only" }), async () => {}); disposables.push(() => commands.dispose());
  const sending = commands.execute({ kind: "enqueue", conversationId: "chat", input: { expectedQueueRevision: 0, text: "queued", attachments: refs } });
  const local = commands.getSnapshot()[0]!; expect(local.state).toBe("sending"); refs.reverse(); refs[0]!.contentDigest = "f".repeat(64);
  await sending; expect(commands.getSnapshot()[0]?.state).toBe("unknown"); await commands.retry(local.key);
  expect(commands.getSnapshot()[0]?.state).toBe("accepted"); expect(calls[1]).toEqual(calls[0]);
  expect(JSON.parse(calls[0]!.body).attachments).toEqual([meta(2).reference, meta().reference]);
});

// Actual installed core0.3.22 send/restore, not a copied composer implementation.
const require = createRequire(import.meta.url), reactRequire = createRequire(require.resolve("@assistant-ui/react"));
const { BaseComposerRuntimeCore } = await import(pathToFileURL(reactRequire.resolve("@assistant-ui/core/internal")).href);
for (const kind of ["complete", "requires-action"] as const) it(`official ${kind} async rejection restores controller ownership and supports a fresh captured retry`, async () => {
  const f = setup(); await f.ready(); f.configure({ conversationId: "chat", attachmentContext: true });
  let token: ReturnType<typeof capture>;
  class Composer extends BaseComposerRuntimeCore {
    get canSend() { return !this.isEmpty && !this.isSubmitting; }
    get canCancel() { return false; }
    getAttachmentAdapter() { return f.binding.adapter; }
    getDictationAdapter() { return undefined; }
    threadMessageIds() { return []; }
    async handleSend() { const error = new MessageNotSentError("No receipt created"); f.binding.failed(token, error); throw error; }
    handleCancel() {}
  }
  const composer = new Composer(); disposables.push(() => composer.__internal_dispose());
  const port: Pick<ComposerRuntime, "getState" | "subscribe"> = { subscribe: listener => composer.subscribe(listener), getState: () => ({ type: "thread", canCancel: false, canSend: composer.canSend, isEditing: false, isEmpty: composer.isEmpty,
    text: composer.text, role: "user", attachments: composer.attachments, runConfig: {}, attachmentAccept: ".txt", dictation: undefined, quote: undefined, queue: [], submission: composer.submission, inTransit: composer.inTransit }) };
  if (kind === "complete") { const id = f.binding.input!.select(meta()); await composer.addAttachment(createExistingAttachment(f.binding.input!, id)); }
  else await composer.addAttachment(new File(["hello"], "upload.txt", { type: "text/plain" }));
  const unbind = f.binding.bindComposer(port); disposables.push(unbind); composer.setText("original text");
  const ids = port.getState().attachments.map(item => item.id); token = capture(f.binding, ids);
  await composer.send(); await new Promise<void>(done => setImmediate(done));
  expect(composer.text).toBe("original text"); expect(composer.attachments).toHaveLength(1); expect(f.binding.input!.getSnapshot().items).toHaveLength(1);
  expect(() => capture(f.binding, ids)).not.toThrow();
});
