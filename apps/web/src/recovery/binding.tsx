import { useSyncExternalStore } from "react";
import type { PluginDefinition } from "../plugins/types";
import type { AppPluginSession } from "../plugin-integration/session";
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
  owner(viewKey: string): RecoveryOwner | null;
  draft(viewKey: string): Json;
  restore(record: RecoveryRecord): Promise<void>;
  retry(record: CommandRecord): Promise<void>;
}
interface DraftState {
  version: number; serial: number; savedSerial: number; chain: Promise<void>; error?: string;
  handoff?: { data: Json; serial: number }; deferred?: Json;
}
interface RecoverySnapshot { open: boolean; records: readonly RecoveryRecord[]; loading: boolean; error?: string; saving: number }
const message = (error: unknown) => error instanceof Error ? error.message : "Recovery could not complete.";

/** Coordinates checkpoints from the existing view/controller owners; it never sends HTTP. */
export class RecoveryWorkspace {
  private state: RecoverySnapshot = Object.freeze({ open: false, records: [], loading: false, saving: 0 });
  private readonly drafts = new Map<string, DraftState>();
  private readonly listeners = new Set<() => void>();
  private closed = false;
  constructor(private readonly session: AppPluginSession, private readonly host: () => RecoveryHost | undefined) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<RecoverySnapshot>) { if (!this.closed) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); } }
  private current(): { host: RecoveryHost; namespace: RecoveryNamespace } {
    const host = this.host(), namespace = host?.namespace();
    if (this.closed || !host?.authorized() || !namespace) throw new RecoveryError("unavailable", "Read and authorize the current center session before saving or restoring material.");
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
    const state = this.draft(viewKey), serial = ++state.serial;
    const run = async () => {
      const { host, namespace } = this.current(), owner = host.owner(viewKey);
      if (!owner) throw new RecoveryError("unavailable", "The draft no longer belongs to this workspace.");
      const saved = await host.journal.saveDraft(namespace, owner, data, state.version);
      state.version = saved.version; state.savedSerial = serial; state.error = undefined;
    };
    this.publish({ saving: this.state.saving + 1 });
    const flight = state.chain.then(run);
    state.chain = flight.catch(error => { state.error = message(error); this.publish({ error: state.error }); }).finally(() => this.publish({ saving: Math.max(0, this.state.saving - 1) }));
    return flight;
  }
  changed(viewKey: string) {
    if (this.closed || !this.host()?.authorized()) return;
    try {
      const data = this.host()!.draft(viewKey), state = this.draft(viewKey);
      if (state.handoff) { state.deferred = data; return; }
      void this.enqueue(viewKey, data).catch(() => {});
    } catch (error) { this.publish({ error: message(error) }); }
  }
  /** Called before official composer.send can publish its transient empty draft. */
  beginHandoff(viewKey: string) {
    const { host } = this.current(), state = this.draft(viewKey);
    if (state.handoff) throw Error("This draft already has a preparing handoff.");
    const data = host.draft(viewKey);
    state.handoff = { data, serial: state.serial + 1 };
    void this.enqueue(viewKey, data).catch(() => {});
  }
  endHandoff(viewKey: string) {
    const state = this.draft(viewKey);
    state.handoff = undefined;
    const next = state.deferred; state.deferred = undefined;
    if (next !== undefined) void this.enqueue(viewKey, next).catch(() => {});
  }
  commandPort(viewKey: string): CommandRecovery {
    let transfer: { id: string; version: number } | undefined;
    const bound = () => {
      const { host, namespace } = this.current();
      return host.journal.bind(namespace, () => {
        const owner = host.owner(viewKey); if (!owner) throw new RecoveryError("unavailable", "This command view was released."); return owner;
      }, () => {
        const current = this.host(); return !this.closed && current?.authorized() === true && !!current.owner(viewKey) && !!current.namespace() && namespaceKey(current.namespace()!) === namespaceKey(namespace);
      }, () => transfer);
    };
    return {
      prepare: async command => {
        const state = this.draft(viewKey), handoff = state.handoff;
        await state.chain;
        if (state.error) throw new RecoveryError("commit", state.error);
        if (handoff && state.handoff !== handoff) throw new RecoveryError("conflict", "The preparing draft changed before durable handoff.");
        transfer = handoff ? { id: `draft:${viewKey}`, version: state.version } : undefined;
        // Display metadata is retained with the command, but its text already lives in frozen.input/request.
        const display = handoff?.data && typeof handoff.data === "object" && !Array.isArray(handoff.data) ? recoveryValue({ ...handoff.data, text: undefined }) : undefined;
        try {
          await bound().prepare({ ...command, ...(display ? { display } : {}) });
          if (handoff) { state.version = 0; state.savedSerial = state.serial; }
        } finally { transfer = undefined; if (handoff) this.endHandoff(viewKey); }
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
    this.publish({ loading: true, error: undefined });
    try { const { host, namespace } = this.current(); const records = await host.journal.list(namespace); const now = this.current(); if (namespaceKey(now.namespace) !== namespaceKey(namespace) || !this.uiAllowed()) return; this.publish({ records }); }
    catch (error) { this.publish({ records: [], error: message(error) }); }
    finally { this.publish({ loading: false }); }
  }
  async restore(record: RecoveryRecord, retry = false) {
    if (!this.uiAllowed()) return;
    try {
      const { host, namespace } = this.current();
      const live = (await host.journal.list(namespace)).find(item => item.id === record.id && item.version === record.version);
      if (!live || !this.uiAllowed()) throw Error("This recovery record changed. Refresh before acting.");
      if (live.kind === "draft") this.draft(live.owner.viewKey).version = live.version;
      await host.restore(live);
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
  release(viewKey: string) { this.drafts.delete(viewKey); }
  async flush() { await Promise.all([...this.drafts.values()].map(state => state.chain)); if ([...this.drafts.values()].some(state => state.error)) throw Error("Some drafts are still only in this page. Keep it open or explicitly preserve that text before leaving."); }
  dispose() { this.closed = true; this.listeners.clear(); this.drafts.clear(); }
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
