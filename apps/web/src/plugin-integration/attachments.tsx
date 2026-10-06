import { createContext, useContext, useSyncExternalStore } from "react";
import { FlowApiError, type FlowClient } from "@flow/client";
import { attachmentAcceptedSchema, attachmentUploadSchema, attachmentUploadKeySchema, attachmentReferenceKey, type AttachmentAccepted, type AttachmentUpload } from "@flow/contracts";
import type { ComposerRuntime } from "@assistant-ui/react";
import { createAttachmentInput, type AttachmentInput, type AttachmentCapture, type AttachmentReadiness, type AttachmentItem } from "../attachments/controller";
import { bindAttachmentComposer, createAttachmentAdapter, createExistingAttachment } from "../attachments/adapter";
import { createRecoveryJournal, type RecoveryStorage } from "../attachments/recovery";
import { AttachmentPicker } from "../attachments/AttachmentPicker";
import type { TurnReceipt } from "../conversations/outbox";
import type { QueueReceipt } from "../conversations/queue/commands";
import type { PluginHost } from "../plugins/host";
import type { PluginDefinition, ResourceContext } from "../plugins/types";

export const ATTACHMENT_OWNER = "flow.conversation-attachments";
export const ATTACHMENT_PANEL = "flow.conversation-attachments.panel";
export const ATTACHMENT_OPEN = "flow.conversation-attachments.open";
const UPLOAD_COMMAND = "flow.conversation-attachments.upload";
export type AttachmentClient = Pick<FlowClient, "attachmentCapabilities" | "attachments" | "attachment" | "attachmentContent" | "attachmentUploadReceipt" | "uploadAttachment">;
/** App owns this lookup: the stable view/projection must still belong to this connection.
 * Route aliases may change after CREATE; a replaced projection must return null. */
export interface AttachmentView {
  readonly viewId: string;
  readonly conversationId: string | null;
  readonly projectId: string;
  readonly visible: boolean;
  readonly online: boolean;
  readonly canRead: boolean;
  readonly canUpload: boolean;
  readonly attachmentContext: boolean;
}
type LocalReceipt = TurnReceipt | QueueReceipt;
const receiptId = (receipt: LocalReceipt | null) => receipt && ("kind" in receipt ? receipt.id : receipt.key);
export interface AttachmentSubmission {
  readonly capture: AttachmentCapture;
  readonly ids: readonly string[];
  readonly conversationId: string | null;
  readonly previousReceiptId: string | null;
}
interface BindingSnapshot {
  readonly open: boolean;
  readonly error: string | null;
  readonly submission: { readonly value: AttachmentSubmission; readonly state: "preparing" | "failed"; readonly error: string | null } | null;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : "Attachment operation failed.";

/** One project-bound input per stable App view, not per route or Dialog mount.
 * This class receives private host authority, never supplies a client to plugins. */
export class ConversationAttachments {
  readonly input: AttachmentInput | null;
  readonly adapter;
  private state: BindingSnapshot = Object.freeze({ open: false, error: null, submission: null });
  private readonly listeners = new Set<() => void>();
  private readonly lifetime = new AbortController();
  private lease = new AbortController();
  private readonly unsubscribeHost: () => void;
  private readonly unsubscribeInput: () => void;
  private readonly unbind = new Set<() => void>();
  private readonly ownedUploadKeys = new Set<string>();
  private readonly restoredDraftIds = new Set<string>();
  private lastReadable = false;
  private lastWritable = false;
  private readonly reconciliationInput: AttachmentInput | null;
  constructor(readonly identity: { readonly connectionId: string; readonly viewKey: string; readonly projectId: string }, private readonly options: {
    host: PluginHost; client: AttachmentClient; signal: AbortSignal; current(): AttachmentView | null; storage: RecoveryStorage;
  }) {
    this.identity = Object.freeze({ ...identity });
    let input: AttachmentInput | null = null;
    try {
      const journal = createRecoveryJournal(options.storage);
      // The persistent journal is a recovery directory, not this view's draft.
      // Ownership starts only when this input prepares an upload, even if its
      // chip is later removed. Other views may browse/recover the same directory.
      const ownedJournal = { ...journal, begin: (identity: Parameters<typeof journal.begin>[0]) => {
        const record = journal.begin(identity); this.ownedUploadKeys.add(record.key); return record;
      } };
      input = createAttachmentInput({ binding: { connectionKey: identity.connectionId, viewId: identity.viewKey, projectId: identity.projectId },
        readiness: this.readiness(), journal: ownedJournal, ports: {
          capabilities: signal => this.read(signal, bound => options.client.attachmentCapabilities(identity.projectId, bound)),
          list: (query, signal) => this.read(signal, bound => options.client.attachments(identity.projectId, query, bound)),
          content: (ref, signal) => this.read(signal, bound => options.client.attachmentContent(identity.projectId, ref.resourceId, ref.version, ref.contentDigest, bound)),
          lookup: (scope, key, signal) => this.read(signal, async bound => {
            try { return await options.client.attachmentUploadReceipt(identity.projectId, { scope, key }, bound); }
            catch (error) { if (error instanceof FlowApiError && error.status === 404 && error.code === "attachment_upload_receipt_not_found") return null; throw error; }
          }),
          upload: async (request, key, signal) => {
            this.assertAllowed(true); const result = await options.host.execute(UPLOAD_COMMAND, { request, key, signal }, this.context());
            if (signal.aborted) throw signal.reason;
            if (!result.ok) throw Error(result.error);
            return attachmentAcceptedSchema.parse(result.value);
          },
        } });
    } catch (error) {
      this.state = Object.freeze({ ...this.state, error: `Attachment recovery is unavailable: ${errorText(error)}. Stored records were not erased. Plain text is still available.` });
    }
    this.input = input;
    this.adapter = input ? createAttachmentAdapter(input) : undefined;
    // Complete attachments temporarily disappear before an async rejection restores
    // them. Only automatic reconciliation is held; explicit draft removal is real.
    this.reconciliationInput = input ? { ...input, remove: id => {
      const held = this.state.submission;
      if (!held?.value.ids.includes(id) || (held.state === "failed" && this.restoredDraftIds.has(id))) input.remove(id);
    } } : null;
    this.unsubscribeInput = input?.subscribe(() => this.update({})) ?? (() => {});
    this.unsubscribeHost = options.host.subscribe(() => this.sync());
    options.signal.addEventListener("abort", this.dispose, { once: true });
    if (options.signal.aborted) this.dispose(); else this.sync();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  private update(patch: Partial<BindingSnapshot>) { this.state = Object.freeze({ ...this.state, ...patch }); this.emit(); }
  context(): ResourceContext {
    const view = this.options.current();
    return { kind: "composer", viewId: view?.viewId ?? "closed", isDraft: true };
  }
  private readable() {
    const view = this.options.current();
    return !this.lifetime.signal.aborted && !this.options.signal.aborted && !!view && view.projectId === this.identity.projectId
      && view.canRead && this.options.host.checkView(ATTACHMENT_PANEL, this.context()).ok;
  }
  private readiness(): AttachmentReadiness {
    const view = this.options.current();
    return { visible: view?.visible === true, online: view?.online === true, canRead: this.readable(), canUpload: view?.canUpload === true && this.readable() };
  }
  sync() {
    if (this.lifetime.signal.aborted) return;
    const next = this.readiness(), readable = next.visible && next.online && next.canRead, writable = readable && next.canUpload;
    if ((this.lastReadable && !readable) || (this.lastWritable && !writable)) {
      this.lease.abort(Error("Attachment display or authorization changed.")); this.lease = new AbortController();
    }
    this.lastReadable = readable; this.lastWritable = writable;
    // Clear cached capability on reconnect, without dropping selected material.
    if (!next.online) this.input?.setReadiness({ ...next, canRead: false, canUpload: false });
    else this.input?.setReadiness(next);
  }
  /** Explicit user retry after a service upgrade; does not fetch or change selection. */
  refreshCapabilities() {
    this.assertAllowed(); const ready = this.readiness();
    this.input?.setReadiness({ ...ready, canRead: false, canUpload: false });
    this.input?.setReadiness(ready);
  }
  private assertAllowed(write = false) {
    const ready = this.readiness();
    if (!ready.visible || !ready.online || !ready.canRead || (write && !ready.canUpload)) throw Error("Attachment access is unavailable in this composer. Your materials are kept.");
  }
  private async read<T>(signal: AbortSignal, operation: (bound: AbortSignal) => Promise<T>): Promise<T> {
    this.assertAllowed(); const lease = this.lease;
    const bound = AbortSignal.any([signal, lease.signal, this.lifetime.signal, this.options.signal]);
    if (bound.aborted) throw bound.reason;
    const result = await operation(bound);
    this.assertAllowed(); if (bound.aborted || lease !== this.lease) throw Error("Late attachment read belongs to an expired view.");
    return result;
  }
  /** Called only by the P01 upload command; never dispatches that command again. */
  async uploadFromCommand(request: AttachmentUpload, key: string, signal: AbortSignal): Promise<AttachmentAccepted> {
    this.assertAllowed(true); const lease = this.lease;
    const bound = AbortSignal.any([signal, lease.signal, this.lifetime.signal, this.options.signal]);
    if (bound.aborted) throw bound.reason;
    const result = await this.options.client.uploadAttachment(this.identity.projectId, request, key, bound);
    this.assertAllowed(true); if (bound.aborted || lease !== this.lease) throw Error("Upload receipt belongs to an expired view. Recover its original key.");
    return result;
  }
  open() { this.assertAllowed(); this.update({ open: true }); }
  close() { this.update({ open: false }); } // Closing a Dialog is not hiding the composer.
  async syncComposerDraft(composer: Pick<ComposerRuntime, "getState" | "addAttachment">): Promise<void> {
    const input = this.input, lease = this.lease;
    if (!input) return;
    for (const item of input.getSnapshot().items) {
      if (lease !== this.lease || lease.signal.aborted) return;
      const ready = this.readiness(), state = composer.getState();
      if (!ready.visible || !ready.online || !ready.canRead || input.getSnapshot().capable !== true || state.submission) return;
      // Recheck the immutable item after any prior add settles. Held/consumed or
      // explicitly removed material must never be appended to the next draft.
      if (item.state !== "ready" || !input.getSnapshot().items.includes(item)
        || this.state.submission?.value.ids.includes(item.id)
        || state.attachments.some(file => file.id === item.id)
        || state.inTransit?.some(message => message.attachments.some(file => file.id === item.id))) continue;
      // Installed core's CompleteAttachment branch publishes synchronously; its
      // Promise settles later. A repeated sync sees the original ID immediately.
      await composer.addAttachment(createExistingAttachment(input, item.id));
    }
  }
  bindComposer(composer: Pick<ComposerRuntime, "getState" | "subscribe">, onPreparationFailed?: (value: AttachmentSubmission, error: Error) => void): () => void {
    if (!this.reconciliationInput) return () => {};
    const stop = bindAttachmentComposer(this.reconciliationInput, composer);
    let preparing: AttachmentSubmission | null = null, active = true;
    const watch = composer.subscribe(() => {
      const held = this.state.submission, state = composer.getState();
      // Core publishes the restored draft before our queued failure transition.
      // Observe that return while this exact preparation is still marked active.
      if (held && (held.state === "failed" || (preparing === held.value && !state.submission)))
        for (const item of state.attachments) if (held.value.ids.includes(item.id)) this.restoredDraftIds.add(item.id);
      if (held?.state === "preparing" && state.submission) preparing = held.value;
      const observed = preparing;
      queueMicrotask(() => {
        if (!active || !observed || observed !== preparing || this.state.submission?.value !== observed || this.state.submission.state !== "preparing") return;
        const current = composer.getState();
        if (current.submission || current.inTransit?.some(item => item.attachments.some(file => observed.ids.includes(file.id)))) return;
        // Successful preparation dispatches synchronously before this microtask and
        // handoff clears the hold. Failure/cancel bypasses onNew entirely.
        preparing = null; const error = Error("Attachment preparation stopped before a receipt took ownership. Your draft and files are kept.");
        this.failed(observed, error); onPreparationFailed?.(observed, error);
      });
    });
    const release = () => {
      active = false; watch(); stop(); this.unbind.delete(release);
      const held = this.state.submission;
      if (held?.state === "preparing") { const error = Error("Composer changed before material handoff. Recover the original draft explicitly."); this.failed(held.value, error); onPreparationFailed?.(held.value, error); }
    };
    this.unbind.add(release); return release;
  }
  restoreDraft(items: readonly AttachmentItem[]) {
    if (!this.input || this.state.submission) throw Error("This view cannot replace its current material handoff.");
    this.input.restore(items); this.sync();
  }
  capture(input: Omit<Parameters<AttachmentInput["capture"]>[0], "conversationProjectId" | "attachmentContext">, previous: LocalReceipt | null): AttachmentSubmission {
    if (!this.input) throw Error(this.state.error ?? "Attachment input is unavailable.");
    if (this.state.submission?.state === "preparing") throw Error("A material submission is already preparing.");
    const failed = this.state.submission?.value;
    if (failed && (failed.ids.length !== input.ids.length || failed.ids.some((id, index) => input.ids[index] !== id)))
      throw Error("Recover or explicitly discard the earlier material preparation before sending different files.");
    const view = this.options.current(); this.assertAllowed();
    const capture = this.input.capture({ ...input, conversationProjectId: view?.projectId, attachmentContext: view?.attachmentContext });
    const value = Object.freeze({ capture, ids: Object.freeze([...input.ids]), conversationId: view?.conversationId ?? null, previousReceiptId: receiptId(previous) });
    this.restoredDraftIds.clear(); this.update({ submission: Object.freeze({ value, state: "preparing", error: null }) }); return value;
  }
  assertSubmission(value: AttachmentSubmission, preparedIds?: readonly string[]) {
    if (this.state.submission?.value !== value || this.state.submission.state !== "preparing") throw Error("This material submission is no longer preparing.");
    this.assertAllowed(); this.input!.assertCapture(value.capture, preparedIds);
    if (this.options.current()?.conversationId !== value.conversationId) throw Error("Conversation changed before material handoff.");
  }
  /** Caller reads the actual local Outbox/Queue receipt synchronously after dispatch,
   * then calls this before awaiting network. A Promise alone is not a handoff. */
  handoff(value: AttachmentSubmission, receipt: LocalReceipt | null) {
    this.assertSubmission(value);
    if (!receipt || receiptId(receipt) === value.previousReceiptId) throw Error("No new local material receipt took ownership.");
    const turn = "kind" in receipt;
    const request = turn ? receipt.request : receipt.command.kind === "enqueue" ? receipt.command.input : null;
    const conversationId = turn ? receipt.conversationId : receipt.command.conversationId;
    if (!request || (turn ? "send" : "queue") !== value.capture.intent || conversationId !== value.conversationId || request.text !== value.capture.text
      || JSON.stringify(request.knowledge ?? []) !== JSON.stringify(value.capture.knowledge)
      || (request.attachments?.length ?? 0) !== value.capture.attachments.length
      || request.attachments?.some((ref, index) => attachmentReferenceKey(ref) !== attachmentReferenceKey(value.capture.attachments[index]!)))
      throw Error("The local receipt does not own the captured materials.");
    this.input!.consume(value.capture); this.restoredDraftIds.clear(); this.update({ submission: null });
  }
  failed(value: AttachmentSubmission, error: unknown) {
    if (this.state.submission?.value === value) this.update({ submission: Object.freeze({ value, state: "failed", error: errorText(error) }) });
  }
  discardFailedSubmission() {
    if (this.state.submission?.state === "preparing") throw Error("Wait for the material preparation to finish.");
    this.restoredDraftIds.clear(); this.update({ submission: null });
  }
  protection(): readonly string[] {
    const snapshot = this.input?.getSnapshot();
    return [...(snapshot?.items.length ? ["Attachment draft"] : []), ...(snapshot?.recovery.some(item => item.state === "unknown" && this.ownedUploadKeys.has(item.key)) ? ["Unknown upload receipt"] : []),
      ...(this.state.submission ? ["Material submission or recovery"] : []), ...(this.state.error ? ["Attachment recovery storage error"] : [])];
  }
  /** Terminal only: App must first confirm protected materials may be discarded. */
  dispose = () => {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort(); this.lease.abort(); this.options.signal.removeEventListener("abort", this.dispose);
    this.unsubscribeHost?.(); this.unsubscribeInput?.(); for (const stop of this.unbind) stop();
    this.input?.dispose(); this.listeners.clear();
  };
}

const SurfaceContext = createContext<{ binding: ConversationAttachments; onAttach(id: string): void | Promise<void>; onRemove(id: string): void | Promise<void> } | null>(null);
export const AttachmentSurfaceProvider = SurfaceContext.Provider;
function AttachmentPanel() {
  const surface = useContext(SurfaceContext), binding = surface?.binding;
  const state = useSyncExternalStore(binding?.subscribe ?? (() => () => {}), binding?.getSnapshot ?? (() => null));
  if (!surface || !state?.open) return null;
  return <section aria-label="Conversation attachments">{state.error ? <p role="alert">{state.error}</p>
    : binding?.input && <AttachmentPicker input={binding.input} onAttach={surface.onAttach} onRemove={surface.onRemove} />}</section>;
}
export function createAttachmentPlugin(find: (viewId: string) => ConversationAttachments | undefined): PluginDefinition {
  const binding = (resource: ResourceContext) => {
    if (resource.kind !== "composer") throw Error("An attachment composer is required.");
    const value = find(resource.viewId);
    const current = value?.context();
    if (!value || current?.kind !== "composer" || current.viewId !== resource.viewId) throw Error("Prepare a supported project conversation using Knowledge before attaching files.");
    return value;
  };
  return { manifest: { id: ATTACHMENT_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["attachment.read", "attachment.upload"],
    activationEvents: [`command:${ATTACHMENT_OPEN}`, "view:chat.composer.context"],
    commands: [{ id: ATTACHMENT_OPEN, title: "Files", capability: "attachment.read", contexts: ["composer"] },
      { id: UPLOAD_COMMAND, title: "Upload text file", capability: "attachment.upload", contexts: ["composer"] }],
    contributions: [{ kind: "button", id: "flow.conversation-attachments.button", slot: "chat.composer.actions", title: "Files", commandId: ATTACHMENT_OPEN },
      { kind: "panel", id: ATTACHMENT_PANEL, slot: "chat.composer.context", title: "Project text files", capability: "attachment.read" }] },
    load: async () => ({ activate(context) {
      context.command(ATTACHMENT_OPEN, { parse: () => null, run: (_, command) => binding(command.resource).open() });
      context.command(UPLOAD_COMMAND, { parse(args) {
        if (!args || typeof args !== "object" || !("request" in args) || !("key" in args) || !("signal" in args) || !(args.signal instanceof AbortSignal)) throw Error("Upload request and original key are required.");
        return { request: attachmentUploadSchema.parse(args.request), key: attachmentUploadKeySchema.parse(args.key), signal: args.signal };
      }, run: (args, command) => binding(command.resource).uploadFromCommand(args.request, args.key, AbortSignal.any([command.signal, args.signal])) });
      context.contribute(ATTACHMENT_PANEL, AttachmentPanel);
    } }) };
}
