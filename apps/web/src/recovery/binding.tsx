import { useEffect, useRef, useSyncExternalStore } from "react";
import type { PluginDefinition } from "../plugins/types";
import type { AppPluginSession } from "../plugin-integration/session";
import { configuredSelection, legacyDefaultSelection, readDirectoryProfile, versionedSelection, type ProfileSelection } from "../execution-profiles/selection";
import { freezeCitation } from "../conversation-context/selection";
import type { SelectedContext } from "../conversation-context/controller";
import type { AttachmentItem } from "../attachments/controller";
import { freezeMetadata } from "../attachments/recovery";
import { attachmentMetadataSchema, attachmentNameSchema } from "../../../../packages/contracts/src/attachments";
import { freezeMessageSettings } from "../conversation-context/receipts";
import { idSchema, knowledgeCreateSchema, type ClaudeTurnSettings } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ConversationRecoveryJournal, RecoveryError, recoveryValue, namespaceKey, type Json, type RecoveryNamespace, type RecoveryOwner, type RecoveryRecord, type CommandRecord, type CommandRecovery, type DraftRecord } from "./journal";

export const RECOVERY_OWNER = "flow.conversation-recovery";
export const RECOVERY_PANEL = "flow.conversation-recovery.entry";
const RECOVERY_OPEN = "flow.conversation-recovery.open";
/** One private view operation; the App must check it after reads and before mutation. */
export interface RecoveryRestoreLease {
  check(): void;
  bindView(): void;
  apply(change: () => void): void;
}
export interface RecoveryHost {
  journal: ConversationRecoveryJournal;
  namespace(): RecoveryNamespace | null;
  authorized(): boolean;
  generation(): number;
  owner(viewKey: string): RecoveryOwner | null;
  draft(viewKey: string): Json;
  restore(record: RecoveryRecord, lease: RecoveryRestoreLease): Promise<void>;
  retry(record: CommandRecord): Promise<void>;
}
export interface CompleteDraft {
  messageSettings?: Readonly<ClaudeTurnSettings>;
  text: string; intent: "follow-up" | "queue"; profile: ProfileSelection;
  steering: readonly { taskId: string; turnId: string; messageId: string; text: string }[];
  projectId: string | null; projectTitle: string | null; knowledge: readonly SelectedContext[]; attachments: readonly AttachmentItem[];
}
export function readRecoveryDraft(value: Json): CompleteDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid saved draft.");
  const data = value as Record<string, unknown>;
  if (typeof data.text !== "string" || !["follow-up", "queue"].includes(String(data.intent)) || !Array.isArray(data.knowledge) || !Array.isArray(data.attachments) || data.knowledge.length + data.attachments.length > 4) throw Error("Invalid saved draft fields.");
  const projectId = data.projectId === null ? null : idSchema.parse(data.projectId);
  const projectTitle = data.projectTitle === null ? null : knowledgeCreateSchema.shape.title.parse(data.projectTitle);
  const rawProfile = data.profile as { kind?: unknown; profile?: unknown; entry?: unknown } | null;
  const profile = rawProfile?.kind === "legacy-default" ? legacyDefaultSelection()
    : rawProfile?.kind === "configured" ? configuredSelection(readDirectoryProfile(rawProfile.profile))
    : rawProfile?.kind === "versioned" ? versionedSelection(rawProfile.entry) : null;
  if (!profile) throw Error("Invalid saved execution selection.");
  const knowledge = data.knowledge.map((value: unknown) => {
    if (!value || typeof value !== "object" || !projectId) throw Error("Saved knowledge needs its original project.");
    const item = value as Record<string, unknown>;
    return { title: knowledgeCreateSchema.shape.title.parse(item.title), citation: freezeCitation(item.citation, projectId) };
  });
  const attachments = data.attachments.map((value: unknown): AttachmentItem => {
    if (!value || typeof value !== "object" || !projectId) throw Error("Saved files need their original project.");
    const item = value as Record<string, unknown>, id = idSchema.parse(item.id);
    if (!attachmentNameSchema.safeParse(item.name).success || !["uploading", "unknown", "ready", "error"].includes(String(item.state))) throw Error("Invalid saved attachment metadata.");
    const metadata = item.metadata === undefined ? undefined : freezeMetadata(attachmentMetadataSchema.parse(item.metadata));
    if (metadata && metadata.reference.projectId !== projectId) throw Error("Saved file belongs to another project.");
    const uploadKey = item.uploadKey === undefined ? undefined : idSchema.parse(item.uploadKey);
    return { id, name: attachmentNameSchema.parse(item.name), state: item.state as AttachmentItem["state"], ...(metadata ? { metadata } : {}), ...(uploadKey ? { uploadKey } : {}) };
  });
  if (!Array.isArray(data.steering ?? []) || ((data.steering ?? []) as unknown[]).length > 8) throw Error("Invalid saved steering drafts.");
  const steering = ((data.steering ?? []) as unknown[]).map(value => {
    if (!value || typeof value !== "object") throw Error("Invalid steering draft identity.");
    const item = value as Record<string, unknown>;
    if (typeof item.text !== "string") throw Error("Invalid steering draft text.");
    return { taskId: idSchema.parse(item.taskId), turnId: idSchema.parse(item.turnId), messageId: idSchema.parse(item.messageId), text: item.text };
  });
  const messageSettings = data.messageSettings === undefined ? undefined : freezeMessageSettings(data.messageSettings);
  return { ...(messageSettings === undefined ? {} : { messageSettings }), steering, text: data.text, intent: data.intent as CompleteDraft["intent"], profile, projectId, projectTitle, knowledge, attachments };
}
/** The real App and controlled tests use this same awaited-read / synchronous-apply seam. */
export async function restoreConversationDraft(record: DraftRecord, lease: RecoveryRestoreLease, target: {
  refresh(): Promise<void>;
  prepare(saved: CompleteDraft): () => void;
}) {
  const saved = readRecoveryDraft(record.data);
  lease.bindView(); lease.check();
  await target.refresh();
  lease.check();
  lease.apply(() => { const commit = target.prepare(saved); commit(); });
}
interface RestoreState { changed: boolean; invalidated: boolean; applying: boolean; signature: string | null }
interface DraftState {
  namespace?: string; lastData?: string; version: number; serial: number; savedSerial: number; chain: Promise<void>; error?: string;
  handoff?: { data: Json; serial: number; domain: CommandRecord["domain"]; taskId?: string; commandId?: string }; deferred?: Json;
}
interface RecoverySnapshot { open: boolean; records: readonly RecoveryRecord[]; loading: boolean; error?: string; saving: number }
const message = (error: unknown) => error instanceof Error ? error.message : "Recovery could not complete.";

/** Coordinates checkpoints from the existing view/controller owners; it never sends HTTP. */
export class RecoveryWorkspace {
  private state: RecoverySnapshot = Object.freeze({ open: false, records: [], loading: false, saving: 0 });
  private readonly drafts = new Map<string, DraftState>();
  private readonly listeners = new Set<() => void>();
  private closed = false;
  private readonly restoring = new Map<string, RestoreState>();
  private readonly blockedCommands = new Map<string, Set<string>>();
  private readonly unsubscribeHost: () => void;
  private started = false;
  private synchronized?: string;
  constructor(private readonly session: AppPluginSession, private readonly host: () => RecoveryHost | undefined) {
    this.unsubscribeHost = session.host.subscribe(() => { if (this.started) this.sync(); });
  }
  /** Session actions and host transitions share this entry; edits never enable a plugin. */
  sync() {
    if (this.closed || this.session.signal.aborted) return;
    this.started = true;
    const host = this.host(), namespace = host?.namespace();
    const plugin = this.session.host.list().find(value => value.id === RECOVERY_OWNER);
    if (!host?.authorized() || !namespace || plugin?.state !== "active") {
      this.synchronized = undefined;
      if (this.state.open || this.state.records.length) this.publish({ open: false, records: [] });
      if (host?.authorized() && namespace && plugin?.state === "registered") {
        const key = namespaceKey(namespace), generation = host.generation();
        void this.session.host.activate(RECOVERY_OWNER).then(result => {
          const current = this.host(), now = current?.namespace();
          if (!result.ok && !this.closed && current?.authorized() && now && current.generation() === generation && namespaceKey(now) === key)
            this.publish({ error: result.error });
        }).catch(error => {
          const current = this.host(), now = current?.namespace();
          if (!this.closed && current?.authorized() && now && current.generation() === generation && namespaceKey(now) === key)
            this.publish({ error: message(error) });
        });
      }
      return;
    }
    // Read the current authority again on activation/reauth, never a captured old draft.
    const key = namespaceKey(namespace), identity = JSON.stringify([key, host.generation()]);
    if (this.synchronized === identity) return;
    this.synchronized = identity;
    for (const [viewKey, state] of this.drafts) {
      if (state.namespace !== key) continue;
      state.lastData = undefined; this.changed(viewKey);
    }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<RecoverySnapshot>) { if (!this.closed) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); } }
  configured() { return !!this.host(); }
  protection(viewKey: string): readonly string[] { const state = this.drafts.get(viewKey); return this.restoring.has(viewKey) || this.blockedCommands.get(viewKey)?.size || (state && (state.handoff || state.error || state.serial !== state.savedSerial)) ? ["Draft or command checkpoint pending"] : []; }
  sendReason(): string | null {
    if (!this.configured()) return null;
    try { this.current(); return null; } catch (error) { return message(error); }
  }
  private current(): { host: RecoveryHost; namespace: RecoveryNamespace } {
    const host = this.host(), namespace = host?.namespace();
    if (this.closed || !this.uiAllowed() || !host?.authorized() || !namespace) throw new RecoveryError("unavailable", "Read and authorize the current center session before saving or restoring material.");
    return { host, namespace };
  }
  private uiAllowed() {
    return !this.session.signal.aborted && this.session.host.list().find(plugin => plugin.id === RECOVERY_OWNER)?.state === "active";
  }
  private draft(viewKey: string, namespace?: string) {
    let state = this.drafts.get(viewKey);
    if (!state) { state = { version: 0, serial: 0, savedSerial: 0, chain: Promise.resolve() }; this.drafts.set(viewKey, state); }
    if (namespace) {
      if (state.namespace && state.namespace !== namespace) throw new RecoveryError("conflict", "This view still retains draft state from another authenticated namespace.");
      state.namespace = namespace;
    }
    return state;
  }
  private enqueue(viewKey: string, data: Json): Promise<void> {
    const captured = this.current(), owner = captured.host.owner(viewKey), generation = captured.host.generation();
    if (!owner) throw new RecoveryError("unavailable", "The draft no longer belongs to this workspace.");
    const capturedNamespace = namespaceKey(captured.namespace);
    const state = this.draft(viewKey, capturedNamespace), serial = ++state.serial;
    const current = () => {
      const now = this.current(), currentOwner = now.host.owner(viewKey);
      if (now.host.generation() !== generation || namespaceKey(now.namespace) !== namespaceKey(captured.namespace) || currentOwner?.viewKey !== owner.viewKey || currentOwner.projectId !== owner.projectId)
        throw new RecoveryError("unavailable", "This queued draft belongs to an older connection or project.");
      return now;
    };
    const run = async () => {
      current();
      const saved = await captured.host.journal.saveDraft(captured.namespace, owner, data, state.version);
      // The public namespace may already be null after revocation. This state belongs to the
      // captured namespace, so retain its committed CAS version without restoring authorization.
      if (this.drafts.get(viewKey) === state && state.namespace === capturedNamespace) state.version = saved.version;
      current();
      state.savedSerial = serial; state.error = undefined;
    };
    this.publish({ saving: this.state.saving + 1 });
    const flight = state.chain.then(run);
    state.chain = flight.catch(error => { state.error = message(error); this.publish({ error: state.error }); }).finally(() => this.publish({ saving: Math.max(0, this.state.saving - 1) }));
    return flight;
  }
  changed(viewKey: string) {
    if (this.closed) return;
    const restoring = this.restoring.get(viewKey);
    if (restoring) {
      // Never discard edits while a read is pending. During the one synchronous
      // apply, coalesce owner notifications instead of checkpointing partial material.
      if (!restoring.applying) {
        try { if (this.draftIdentity(viewKey) !== restoring.signature) restoring.changed = restoring.invalidated = true; }
        catch { restoring.changed = restoring.invalidated = true; }
      }
      return;
    }
    if (!this.host()?.authorized()) return;
    try {
      const host = this.host()!, namespace = host.namespace();
      if (!namespace) return;
      const data = host.draft(viewKey), state = this.draft(viewKey, namespaceKey(namespace));
      const encoded = JSON.stringify([this.host()!.owner(viewKey), data]); if (state.lastData === encoded) return; state.lastData = encoded;
      if (state.handoff) { state.deferred = data; return; }
      void this.enqueue(viewKey, data).catch(() => {});
    } catch (error) {
      const state = this.drafts.get(viewKey); if (state) state.error = message(error);
      this.publish({ error: message(error) });
    }
  }
  /** Called before official composer.send can publish its transient empty draft. */
  beginHandoff(viewKey: string, domain: CommandRecord["domain"] = "outbox", taskId?: string) {
    if (this.restoring.has(viewKey)) throw Error("Wait for this view's restore to settle before sending. Your draft is kept.");
    const { host } = this.current(), state = this.draft(viewKey);
    if (state.handoff) throw Error("This draft already has a preparing handoff.");
    const data = host.draft(viewKey);
    state.handoff = { data, serial: state.serial + 1, domain, taskId };
    void this.enqueue(viewKey, data).catch(() => {});
  }
  cancelHandoff(viewKey: string) {
    const state = this.draft(viewKey); state.handoff = undefined; state.deferred = undefined;
    // The official composer/material owner has restored its draft; checkpoint that actual value.
    state.lastData = undefined; this.changed(viewKey);
  }
  endHandoff(viewKey: string) {
    const state = this.draft(viewKey);
    state.handoff = undefined;
    const next = state.deferred; state.deferred = undefined;
    if (next !== undefined) void this.enqueue(viewKey, next).catch(() => {});
  }
  commandPort(viewKey: string): CommandRecovery {
    let transfer: { id: string; version: number } | undefined;
    let port: CommandRecovery | undefined, portNamespace: string | undefined, portGeneration: number | undefined;
    const bound = () => {
      const { host, namespace } = this.current(), generation = host.generation();
      if (port) {
        if (portNamespace !== namespaceKey(namespace) || portGeneration !== generation) throw new RecoveryError("unavailable", "This original command belongs to an older connection generation.");
        return port;
      }
      portNamespace = namespaceKey(namespace); portGeneration = generation;
      port = host.journal.bind(namespace, () => {
        const owner = host.owner(viewKey); if (!owner) throw new RecoveryError("unavailable", "This command view was released."); return owner;
      }, () => {
        const current = this.host(); return !this.closed && current?.authorized() === true && current.generation() === generation && !!current.owner(viewKey) && !!current.namespace() && namespaceKey(current.namespace()!) === namespaceKey(namespace);
      }, () => transfer);
      return port;
    };
    return {
      prepare: async command => {
        try {
          // Bind before any draft-save await. A reauthentication must never adopt and resume this pending send.
          const authority = this.current(), generation = authority.host.generation(), owner = authority.host.owner(viewKey);
          if (!owner) throw new RecoveryError("unavailable", "The command view is no longer available.");
          const check = () => {
            const current = this.current(), nextOwner = current.host.owner(viewKey);
            if (current.host.generation() !== generation || namespaceKey(current.namespace) !== namespaceKey(authority.namespace) || nextOwner?.viewKey !== owner.viewKey || nextOwner.projectId !== owner.projectId)
              throw new RecoveryError("unavailable", "Authentication or project changed during preparation. Explicitly retry the retained original receipt.");
          };
          const commandPort = bound();
          const state = this.draft(viewKey), pending = state.handoff;
          const frozen = command.frozen && typeof command.frozen === "object" && !Array.isArray(command.frozen) ? command.frozen : {};
          const queue = "command" in frozen && frozen.command && typeof frozen.command === "object" && !Array.isArray(frozen.command) ? frozen.command : {};
          const handoff = pending?.domain === command.domain && (command.domain !== "queue" || ("kind" in queue && queue.kind === "enqueue")) && (command.domain !== "steering" || ("taskId" in frozen && frozen.taskId === pending.taskId)) ? pending : undefined;
          if (handoff) {
            if (handoff.commandId && handoff.commandId !== command.id) throw new RecoveryError("conflict", "This source draft already belongs to another original receipt.");
            handoff.commandId = command.id;
            await state.chain; check();
          }
          if (state.error && handoff) { check(); await this.enqueue(viewKey, handoff.data); await state.chain; check(); }
          if (handoff && state.error) throw new RecoveryError("commit", state.error);
          if (handoff && state.handoff !== handoff) throw new RecoveryError("conflict", "The preparing draft changed before durable handoff.");
          transfer = handoff && command.domain !== "steering" ? { id: `draft:${viewKey}`, version: state.version } : undefined;
          // Display metadata is retained with the command, but its text already lives in frozen.input/request.
          const display = handoff?.data && typeof handoff.data === "object" && !Array.isArray(handoff.data) ? recoveryValue({ ...handoff.data, text: undefined, steering: undefined }) : undefined;
          check(); await commandPort.prepare({ ...command, ...(display ? { display } : {}) });
          // The source draft was transferred in this committed transaction even if authorization
          // changes before the continuation. Keep its version bookkeeping, never resume HTTP.
          if (transfer) state.version = 0;
          check();
          this.blockedCommands.get(viewKey)?.delete(command.id);
          if (handoff) { state.savedSerial = state.serial; this.endHandoff(viewKey); }
        } catch (error) {
          const blocked = this.blockedCommands.get(viewKey) ?? new Set<string>(); blocked.add(command.id); this.blockedCommands.set(viewKey, blocked);
          // A transient composer-empty notification must not overwrite a successfully saved source draft when prepare fails.
          this.publish({ error: `${message(error)} The original draft and pending receipt remain retained; a newer draft may still be only in this page.` });
          throw error;
        } finally { transfer = undefined; }
      },
      dispatch: (id, stage) => bound().dispatch(id, stage),
      checkpoint: (id, value) => bound().checkpoint(id, value),
      dismiss: id => bound().dismiss(id),
    };
  }
  /** A modal's external invoker may only regain focus in the same authorized generation. */
  captureFocusPermission(): () => boolean {
    try {
      const { host, namespace } = this.current(), key = namespaceKey(namespace), generation = host.generation();
      return () => {
        try { const now = this.current(); return now.host.generation() === generation && namespaceKey(now.namespace) === key; }
        catch { return false; }
      };
    } catch { return () => false; }
  }
  async open() { if (!this.uiAllowed()) throw Error("Recovery is disabled in this workspace."); this.publish({ open: true }); await this.refresh(); }
  close() { this.publish({ open: false }); }
  async refresh() {
    if (!this.uiAllowed()) return;
    let valid = () => this.uiAllowed();
    this.publish({ loading: true, error: undefined });
    try {
      const { host, namespace } = this.current(), generation = host.generation();
      valid = () => this.uiAllowed() && host.authorized() && this.host()?.generation() === generation && !!this.host()?.namespace() && namespaceKey(this.host()!.namespace()!) === namespaceKey(namespace);
      const records = await host.journal.list(namespace);
      if (valid()) this.publish({ records });
    } catch (error) { if (valid()) this.publish({ records: [], error: message(error) }); }
    finally { if (valid()) this.publish({ loading: false }); }
  }
  async restore(record: RecoveryRecord, retry = false) {
    if (!this.uiAllowed()) return;
    const viewKey = record.owner.viewKey;
    if (this.restoring.has(viewKey)) { this.publish({ error: "This view already has a restore in progress. Keep edits or wait for it to settle." }); return; }
    let restore: RestoreState | undefined, capturedNamespace: string | undefined;
    try {
      const { host, namespace } = this.current(), generation = host.generation();
      if (record.kind === "draft" && this.drafts.get(viewKey)?.handoff) throw Error("Keep the current preparing receipt before restoring another draft.");
      capturedNamespace = namespaceKey(namespace);
      restore = { changed: false, invalidated: false, applying: false, signature: this.draftIdentity(viewKey) };
      this.restoring.set(viewKey, restore);
      const pending = restore;
      const lease: RecoveryRestoreLease = {
        check: () => {
          const now = this.current();
          if (this.restoring.get(viewKey) !== pending || now.host.generation() !== generation || namespaceKey(now.namespace) !== capturedNamespace)
            throw Error("This restore belongs to an older connection.");
          if (record.kind === "draft" && (pending.invalidated || this.draftIdentity(viewKey) !== pending.signature)) {
            pending.changed = pending.invalidated = true;
            throw Error("This complete draft changed while recovery was loading. Your current draft is kept; restore separately.");
          }
        },
        bindView: () => {
          // A saved view may not exist before the App allocates it. Bind once,
          // before refresh; an already observed view can never be rebound.
          if (pending.signature === null && !pending.invalidated) pending.signature = this.draftIdentity(viewKey);
          lease.check();
        },
        apply: change => { lease.check(); pending.applying = true; try { change(); pending.changed = true; } finally { pending.applying = false; } },
      };
      await this.drafts.get(viewKey)?.chain;
      const live = (await host.journal.list(namespace)).find(item => item.id === record.id && item.version === record.version);
      // Remember the known record version even when authorization expires while
      // listing; a retained edit must later save against this version, not zero.
      if (live?.kind === "draft") this.draft(live.owner.viewKey, live.namespace).version = live.version;
      const now = this.current();
      if (!live || !this.uiAllowed() || now.host.generation() !== generation || namespaceKey(now.namespace) !== namespaceKey(namespace)) throw Error("This recovery record changed. Refresh before acting.");
      lease.check();
      await host.restore(live, lease);
      if (live.kind === "draft") pending.changed = true;
      const after = this.current(); if (after.host.generation() !== generation || namespaceKey(after.namespace) !== namespaceKey(namespace)) throw Error("This restore belongs to an older connection.");
      if (live.kind === "command" && ["accepted", "rejected"].includes(live.phase)) {
        // The original controller has now matched the entire saved identity and reconciled it.
        // Clear only this receipt's local blocker; persist, rather than discard, a deferred next draft.
        this.blockedCommands.get(live.owner.viewKey)?.delete(live.id);
        const state = this.drafts.get(live.owner.viewKey);
        if (state?.handoff?.commandId === live.id) { state.error = undefined; state.savedSerial = state.serial; this.endHandoff(live.owner.viewKey); }
      }
      if (retry) { if (live.kind !== "command") throw Error("Only an original command can be retried."); await host.retry(live); }
      await this.refresh();
    } catch (error) { this.publish({ error: message(error) }); }
    finally {
      if (restore && this.restoring.get(viewKey) === restore) {
        this.restoring.delete(viewKey);
        if (restore.changed) {
          const state = this.draft(viewKey, capturedNamespace); state.lastData = undefined;
          state.error = "The current draft still needs its checkpoint.";
          const host = this.host(), namespace = host?.namespace();
          if (host?.authorized() && namespace && namespaceKey(namespace) === capturedNamespace) this.changed(viewKey);
          // Otherwise the same-namespace reauthentication sync will save it.
        }
      }
    }
  }
  private draftIdentity(viewKey: string): string | null {
    const host = this.host(), owner = host?.owner(viewKey);
    if (!host || !owner) return null;
    const data = host.draft(viewKey);
    // Existing conversation projects are immutable center identity, not a draft
    // selection. Their initial display metadata may arrive during refresh; App
    // verifies the project against the saved envelope before applying anything.
    // New-chat project choices and every ordered material reference remain part
    // of the editable fingerprint.
    const editable = owner.routeId.startsWith("conversation:") && data && typeof data === "object" && !Array.isArray(data)
      ? { ...data, projectId: null, projectTitle: null } : data;
    return JSON.stringify([{ viewKey: owner.viewKey, routeId: owner.routeId }, editable]);
  }
  async dismiss(record: RecoveryRecord) {
    if (!this.uiAllowed() || !window.confirm("Remove this saved local record? This does not cancel work at the center.")) return;
    try {
      const { host, namespace } = this.current();
      if (record.kind === "draft") await host.journal.removeDraft(namespace, record.id, record.version);
      else await this.commandPort(record.owner.viewKey).dismiss(record.id);
      await this.refresh();
    } catch (error) { this.publish({ error: message(error) }); }
  }
  adoptDraft(record: DraftRecord) { this.draft(record.owner.viewKey, record.namespace).version = record.version; }
  release(viewKey: string) { if (this.protection(viewKey).length) throw Error("This view still has an incomplete recovery checkpoint."); this.drafts.delete(viewKey); this.blockedCommands.delete(viewKey); }
  async flush() { await Promise.all([...this.drafts.values()].map(state => state.chain)); if ([...this.drafts.keys()].some(key => this.protection(key).length) || [...this.blockedCommands.values()].some(ids => ids.size)) throw Error("Some drafts are still only in this page. Keep it open or explicitly preserve that text before leaving."); }
  dispose() { this.closed = true; this.unsubscribeHost(); this.listeners.clear(); this.drafts.clear(); this.restoring.clear(); this.blockedCommands.clear(); }
}
export function createRecoveryPlugin(workspace: RecoveryWorkspace): PluginDefinition {
  return { manifest: { id: RECOVERY_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["ui.navigate"], activationEvents: ["view:sidebar.footer", `command:${RECOVERY_OPEN}`],
    commands: [{ id: RECOVERY_OPEN, title: "Open saved drafts and receipts", capability: "ui.navigate", contexts: ["global"] }],
    contributions: [{ kind: "button", id: RECOVERY_PANEL, slot: "sidebar.footer", title: "Saved drafts and receipts", commandId: RECOVERY_OPEN }] },
    load: async () => ({ activate(context) { context.command(RECOVERY_OPEN, { parse: () => null, run: () => workspace.open() }); } }) };
}
function draftPreview(value: unknown): string {
  if (typeof value !== "string") return "Draft text unavailable";
  let preview = "", length = 0;
  for (const character of value) {
    if (length === 120) return preview.trim() ? `${preview.trim()}…` : "Blank text preview…";
    preview += /[\s\p{Cc}\p{Cs}]/u.test(character) ? " " : character;
    length++;
  }
  return preview.trim() || "No text";
}
function RecoveryDraftSummary({ record }: { record: DraftRecord }) {
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  const intent = data.intent === "queue" ? "Queue next" : data.intent === "follow-up" ? "Send now" : "Delivery choice unavailable";
  const count = (value: unknown) => Array.isArray(value) && value.length <= 4 ? value.length : "unknown";
  const saved = Number.isSafeInteger(record.updatedAt) && record.updatedAt >= 0 && record.updatedAt <= 8_640_000_000_000_000
    ? new Date(record.updatedAt).toISOString() : null;
  return <div className="space-y-1 text-sm">
    <p className="[overflow-wrap:anywhere]" dir="auto">{draftPreview(data.text)}</p>
    <p>{intent} · Files: {count(data.attachments)} · Knowledge: {count(data.knowledge)}</p>
    <p className="text-muted-foreground">Saved on this device: {saved ? <time dateTime={saved}>{saved.replace("T", " ").replace("Z", " UTC")}</time> : "Time unavailable"}</p>
  </div>;
}
export function RecoverySurface({ workspace }: { workspace: RecoveryWorkspace }) {
  const state = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const invoker = useRef<{ element: HTMLElement; allowed: () => boolean } | null>(null);
  useEffect(() => () => { invoker.current = null; }, [workspace]);
  return <Dialog open={state.open} onOpenChange={open => { if (!open) workspace.close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"
    onOpenAutoFocus={() => {
      const element = document.activeElement;
      invoker.current = element instanceof HTMLElement ? { element, allowed: workspace.captureFocusPermission() } : null;
    }}
    onCloseAutoFocus={event => {
      event.preventDefault();
      if (workspace.getSnapshot().open) return;
      const saved = invoker.current; invoker.current = null;
      if (!saved?.allowed() || !saved.element.isConnected || saved.element.ownerDocument.visibilityState !== "visible") return;
      const element = saved.element;
      if (element.matches(":disabled, [aria-disabled='true']") || element.closest("[hidden], [inert], [aria-hidden='true']") || !element.getClientRects().length || getComputedStyle(element).visibility !== "visible") return;
      element.focus({ preventScroll: true });
    }}><DialogHeader><DialogTitle>Saved drafts and receipts</DialogTitle><DialogDescription>Records belong to this authenticated center and owner. Restoring never sends a command automatically.</DialogDescription></DialogHeader>
    <Button disabled={state.loading} onClick={() => { void workspace.refresh(); }}>Refresh saved records</Button>
    {state.error && <p role="alert">{state.error}</p>}{state.saving > 0 && <p role="status">Saving local drafts…</p>}
    <ul className="space-y-3">{state.records.map(record => <li key={record.id} data-recovery-record-id={record.id} className="min-w-0 space-y-2 rounded border p-3"><p className="[overflow-wrap:anywhere]">{record.kind === "draft" ? "Saved draft" : `${record.domain} receipt · ${record.phase}`} · {record.owner.routeId}</p>
      {record.kind === "draft" ? <RecoveryDraftSummary record={record} /> : null}
      <details className="text-sm"><summary>Local record identity</summary><p className="[overflow-wrap:anywhere]"><code>{record.id}</code></p></details>
      <Button variant="outline" onClick={() => { void workspace.restore(record); }}>Restore without sending</Button>
      {record.kind === "command" && !["accepted", "rejected"].includes(record.phase) && <Button variant="outline" onClick={() => { void workspace.restore(record, true); }}>Retry original request</Button>}
      {(record.kind === "draft" || ["accepted", "rejected"].includes(record.phase)) && <Button variant="ghost" onClick={() => { void workspace.dismiss(record); }}>Remove saved record</Button>}
    </li>)}</ul>{!state.loading && !state.records.length && <p>No saved records for this authenticated center and owner.</p>}
  </DialogContent></Dialog>;
}
