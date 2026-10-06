import { useSyncExternalStore } from "react";
import type { PluginDefinition } from "../plugins/types";
import type { AppPluginSession } from "../plugin-integration/session";
import { configuredSelection, legacyDefaultSelection, readDirectoryProfile, type ProfileSelection } from "../execution-profiles/selection";
import { freezeCitation } from "../conversation-context/selection";
import type { SelectedContext } from "../conversation-context/controller";
import type { AttachmentItem } from "../attachments/controller";
import { freezeMetadata } from "../attachments/recovery";
import { attachmentMetadataSchema, attachmentNameSchema } from "../../../../packages/contracts/src/attachments";
import { idSchema, knowledgeCreateSchema } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ConversationRecoveryJournal, RecoveryError, recoveryValue, namespaceKey, type Json, type RecoveryNamespace, type RecoveryOwner, type RecoveryRecord, type CommandRecord, type CommandRecovery, type DraftRecord } from "./journal";

export const RECOVERY_OWNER = "flow.conversation-recovery";
export const RECOVERY_PANEL = "flow.conversation-recovery.entry";
const RECOVERY_OPEN = "flow.conversation-recovery.open";
export interface RecoveryHost {
  journal: ConversationRecoveryJournal;
  namespace(): RecoveryNamespace | null;
  authorized(): boolean;
  generation(): number;
  owner(viewKey: string): RecoveryOwner | null;
  draft(viewKey: string): Json;
  restore(record: RecoveryRecord): Promise<void>;
  retry(record: CommandRecord): Promise<void>;
}
export interface CompleteDraft {
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
  const rawProfile = data.profile as { kind?: unknown; profile?: unknown } | null;
  const profile = rawProfile?.kind === "legacy-default" ? legacyDefaultSelection() : rawProfile?.kind === "configured" ? configuredSelection(readDirectoryProfile(rawProfile.profile)) : null;
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
  return { steering, text: data.text, intent: data.intent as CompleteDraft["intent"], profile, projectId, projectTitle, knowledge, attachments };
}
interface DraftState {
  lastData?: string; version: number; serial: number; savedSerial: number; chain: Promise<void>; error?: string;
  handoff?: { data: Json; serial: number; domain: CommandRecord["domain"]; taskId?: string }; deferred?: Json;
}
interface RecoverySnapshot { open: boolean; records: readonly RecoveryRecord[]; loading: boolean; error?: string; saving: number }
const message = (error: unknown) => error instanceof Error ? error.message : "Recovery could not complete.";

/** Coordinates checkpoints from the existing view/controller owners; it never sends HTTP. */
export class RecoveryWorkspace {
  private state: RecoverySnapshot = Object.freeze({ open: false, records: [], loading: false, saving: 0 });
  private readonly drafts = new Map<string, DraftState>();
  private readonly listeners = new Set<() => void>();
  private closed = false;
  private readonly restoring = new Set<string>();
  private readonly blockedCommands = new Map<string, Set<string>>();
  private readonly unsubscribeHost: () => void;
  constructor(private readonly session: AppPluginSession, private readonly host: () => RecoveryHost | undefined) {
    let enabled = this.uiAllowed();
    this.unsubscribeHost = session.host.subscribe(() => {
      const next = this.uiAllowed(); if (next === enabled) return; enabled = next;
      if (!next) this.publish({ open: false, records: [] });
      else for (const key of this.drafts.keys()) { this.draft(key).lastData = undefined; this.changed(key); }
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<RecoverySnapshot>) { if (!this.closed) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); } }
  configured() { return !!this.host(); }
  protection(viewKey: string): readonly string[] { const state = this.drafts.get(viewKey); return this.blockedCommands.get(viewKey)?.size || (state && (state.handoff || state.error || state.serial !== state.savedSerial)) ? ["Draft or command checkpoint pending"] : []; }
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
  private draft(viewKey: string) {
    let state = this.drafts.get(viewKey);
    if (!state) { state = { version: 0, serial: 0, savedSerial: 0, chain: Promise.resolve() }; this.drafts.set(viewKey, state); }
    return state;
  }
  private enqueue(viewKey: string, data: Json): Promise<void> {
    const captured = this.current(), owner = captured.host.owner(viewKey), generation = captured.host.generation();
    if (!owner) throw new RecoveryError("unavailable", "The draft no longer belongs to this workspace.");
    const state = this.draft(viewKey), serial = ++state.serial;
    const current = () => {
      const now = this.current(), currentOwner = now.host.owner(viewKey);
      if (now.host.generation() !== generation || namespaceKey(now.namespace) !== namespaceKey(captured.namespace) || currentOwner?.viewKey !== owner.viewKey || currentOwner.projectId !== owner.projectId)
        throw new RecoveryError("unavailable", "This queued draft belongs to an older connection or project.");
      return now;
    };
    const run = async () => {
      current();
      const saved = await captured.host.journal.saveDraft(captured.namespace, owner, data, state.version);
      // Commit can finish just before reauthentication. Remember its version only for this same
      // namespace/view so a later explicit retry does not use the pre-commit CAS value.
      const now = this.host(), identity = now?.namespace(), currentOwner = now?.owner(viewKey);
      if (identity && namespaceKey(identity) === namespaceKey(captured.namespace) && currentOwner?.viewKey === owner.viewKey && currentOwner.projectId === owner.projectId) state.version = saved.version;
      current();
      state.savedSerial = serial; state.error = undefined;
    };
    this.publish({ saving: this.state.saving + 1 });
    const flight = state.chain.then(run);
    state.chain = flight.catch(error => { state.error = message(error); this.publish({ error: state.error }); }).finally(() => this.publish({ saving: Math.max(0, this.state.saving - 1) }));
    return flight;
  }
  changed(viewKey: string) {
    if (this.closed || this.restoring.has(viewKey) || !this.host()?.authorized()) return;
    try {
      const data = this.host()!.draft(viewKey), state = this.draft(viewKey);
      const encoded = JSON.stringify([this.host()!.owner(viewKey), data]); if (state.lastData === encoded) return; state.lastData = encoded;
      if (state.handoff) { state.deferred = data; return; }
      void this.enqueue(viewKey, data).catch(() => {});
    } catch (error) { this.publish({ error: message(error) }); }
  }
  /** Called before official composer.send can publish its transient empty draft. */
  beginHandoff(viewKey: string, domain: CommandRecord["domain"] = "outbox", taskId?: string) {
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
          if (handoff) { await state.chain; check(); }
          if (state.error && handoff) { check(); await this.enqueue(viewKey, handoff.data); await state.chain; check(); }
          if (handoff && state.error) throw new RecoveryError("commit", state.error);
          if (handoff && state.handoff !== handoff) throw new RecoveryError("conflict", "The preparing draft changed before durable handoff.");
          transfer = handoff && command.domain !== "steering" ? { id: `draft:${viewKey}`, version: state.version } : undefined;
          // Display metadata is retained with the command, but its text already lives in frozen.input/request.
          const display = handoff?.data && typeof handoff.data === "object" && !Array.isArray(handoff.data) ? recoveryValue({ ...handoff.data, text: undefined, steering: undefined }) : undefined;
          check(); await commandPort.prepare({ ...command, ...(display ? { display } : {}) }); check();
          this.blockedCommands.get(viewKey)?.delete(command.id);
          if (handoff) { if (transfer) state.version = 0; state.savedSerial = state.serial; this.endHandoff(viewKey); }
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
    try {
      const { host, namespace } = this.current(), generation = host.generation();
      const live = (await host.journal.list(namespace)).find(item => item.id === record.id && item.version === record.version);
      const now = this.current();
      if (!live || !this.uiAllowed() || now.host.generation() !== generation || namespaceKey(now.namespace) !== namespaceKey(namespace)) throw Error("This recovery record changed. Refresh before acting.");
      if (live.kind === "draft") this.draft(live.owner.viewKey).version = live.version;
      this.restoring.add(live.owner.viewKey);
      try { await host.restore(live); } finally { this.restoring.delete(live.owner.viewKey); }
      const after = this.current(); if (after.host.generation() !== generation || namespaceKey(after.namespace) !== namespaceKey(namespace)) throw Error("This restore belongs to an older connection.");
      if (retry) { if (live.kind !== "command") throw Error("Only an original command can be retried."); await host.retry(live); }
      await this.refresh();
    } catch (error) { this.publish({ error: message(error) }); }
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
  adoptDraft(record: DraftRecord) { this.draft(record.owner.viewKey).version = record.version; }
  release(viewKey: string) { if (this.protection(viewKey).length) throw Error("This view still has an incomplete recovery checkpoint."); this.drafts.delete(viewKey); this.blockedCommands.delete(viewKey); }
  async flush() { await Promise.all([...this.drafts.values()].map(state => state.chain)); if ([...this.drafts.keys()].some(key => this.protection(key).length) || [...this.blockedCommands.values()].some(ids => ids.size)) throw Error("Some drafts are still only in this page. Keep it open or explicitly preserve that text before leaving."); }
  dispose() { this.closed = true; this.unsubscribeHost(); this.listeners.clear(); this.drafts.clear(); this.blockedCommands.clear(); }
}
export function createRecoveryPlugin(workspace: RecoveryWorkspace): PluginDefinition {
  return { manifest: { id: RECOVERY_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["ui.navigate"], activationEvents: ["view:sidebar.footer", `command:${RECOVERY_OPEN}`],
    commands: [{ id: RECOVERY_OPEN, title: "Open saved drafts and receipts", capability: "ui.navigate", contexts: ["global"] }],
    contributions: [{ kind: "button", id: RECOVERY_PANEL, slot: "sidebar.footer", title: "Saved drafts and receipts", commandId: RECOVERY_OPEN }] },
    load: async () => ({ activate(context) { context.command(RECOVERY_OPEN, { parse: () => null, run: () => workspace.open() }); } }) };
}
export function RecoverySurface({ workspace }: { workspace: RecoveryWorkspace }) {
  const state = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  return <Dialog open={state.open} onOpenChange={open => { if (!open) workspace.close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Saved drafts and receipts</DialogTitle><DialogDescription>Records belong to this authenticated center and owner. Restoring never sends a command automatically.</DialogDescription></DialogHeader>
    <Button disabled={state.loading} onClick={() => { void workspace.refresh(); }}>Refresh saved records</Button>
    {state.error && <p role="alert">{state.error}</p>}{state.saving > 0 && <p role="status">Saving local drafts…</p>}
    <ul className="space-y-3">{state.records.map(record => <li key={record.id} className="rounded border p-3"><p>{record.kind === "draft" ? "Saved draft" : `${record.domain} receipt · ${record.phase}`} · {record.owner.routeId}</p>
      <Button variant="outline" onClick={() => { void workspace.restore(record); }}>Restore without sending</Button>
      {record.kind === "command" && !["accepted", "rejected"].includes(record.phase) && <Button variant="outline" onClick={() => { void workspace.restore(record, true); }}>Retry original request</Button>}
      {(record.kind === "draft" || ["accepted", "rejected"].includes(record.phase)) && <Button variant="ghost" onClick={() => { void workspace.dismiss(record); }}>Remove saved record</Button>}
    </li>)}</ul>{!state.loading && !state.records.length && <p>No saved records for this authenticated center and owner.</p>}
  </DialogContent></Dialog>;
}
