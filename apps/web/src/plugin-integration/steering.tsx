import type { CommandRecord } from "../recovery/journal";
import type { CompleteDraft } from "../recovery/binding";
import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { steeringCommandSchema, type SteeringAdmission, type SteeringCommandInput, type SteeringCommandResult, type SteeringState } from "@flow/contracts";
import { createSteeringControl, type SteeringControl as Control, type SteeringSnapshot } from "../conversation-steering/control";
import { SteeringControl } from "../conversation-steering/SteeringControl";
import { Button } from "../components/ui/button";
import { userMessageId } from "../conversations/messages";
import type { ConversationProjection } from "../conversations/projection";
import type { AppPluginSession } from "./session";
import type { PluginDefinition, PluginViewProps, ResourceContext } from "../plugins/types";

export const STEERING_OWNER = "flow.conversation-steering";
export const STEERING_PANEL = "flow.conversation-steering.entry";
export const STEERING_OPEN = "flow.conversation-steering.open";
export const STEERING_ACCEPT = "flow.conversation-steering.accept";
export const MAX_STEERING_BINDINGS = 8;
export interface SteeringIdentity {
  connectionScope: string; viewKey: string; conversationId: string; turnId: string; messageId: string; taskId: string;
}
/** Private host ports. Permission is host policy, never inferred from a manifest or an admission. */
export interface SteeringPorts {
  allowed(identity: SteeringIdentity, mode: "read" | "write"): boolean;
  admission(identity: SteeringIdentity, options: { attemptId?: string }, signal: AbortSignal): Promise<SteeringAdmission>;
  state(identity: SteeringIdentity, options: { attemptId: string; after: number; limit: number }, signal: AbortSignal): Promise<SteeringState>;
  accept(identity: SteeringIdentity, input: SteeringCommandInput, key: string, signal: AbortSignal): Promise<SteeringCommandResult>;
}
interface ViewBinding { viewId: string; projection: ConversationProjection; visible: boolean; unsubscribe: () => void }
export interface SteeringEntry {
  readonly id: string; readonly identity: Readonly<SteeringIdentity>; control: Control;
  open: boolean; visible: boolean; draft: string; returnFocus?: HTMLElement;
}
interface OwnedEntry extends SteeringEntry { raw: Control; unsubscribe: () => void; writable: boolean; current: boolean }
interface PendingWrite { entry: OwnedEntry; input: SteeringCommandInput; key: string; signal: AbortSignal; error?: unknown }
const contextFor = (identity: SteeringIdentity): ResourceContext => ({ kind: "message", taskId: identity.taskId, messageId: identity.messageId, role: "user" });
const sameResource = (identity: SteeringIdentity, context: ResourceContext) => context.kind === "message" && context.role === "user" && context.taskId === identity.taskId && context.messageId === identity.messageId;

/** One bounded, page-local owner; no controllers or HTTP until an explicit open command. */
export class SteeringWorkspace {
  private views = new Map<string, ViewBinding>();
  private entries = new Map<string, OwnedEntry>();
  private pending = new Map<string, PendingWrite>();
  private listeners = new Set<() => void>();
  private snapshot: readonly SteeringEntry[] = Object.freeze([]);
  private closed = false;
  private unsubscribeHost: () => void;
  constructor(private readonly session: AppPluginSession) { this.unsubscribeHost = session.host.subscribe(() => this.sync()); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = Object.freeze([...this.entries.values()]); for (const listener of this.listeners) listener(); }
  configure(viewKey: string, viewId: string, projection: ConversationProjection, visible: boolean) {
    if (this.closed) return;
    const old = this.views.get(viewKey);
    if (old?.projection !== projection) {
      if (old) this.closeView(viewKey);
      this.views.set(viewKey, { viewId, projection, visible, unsubscribe: projection.subscribe(() => this.sync()) });
    } else { old.viewId = viewId; old.visible = visible; }
    this.sync(); if (!old || old.projection !== projection) this.publish();
  }
  hide(viewKey: string) { const view = this.views.get(viewKey); if (view) { view.visible = false; this.sync(); } }
  identity(viewKey: string, messageId: string): Readonly<SteeringIdentity> | null {
    const state = this.views.get(viewKey)?.projection.getSnapshot();
    const turn = state?.turns.find(item => userMessageId(item) === messageId);
    return state?.snapshot && turn ? Object.freeze({ connectionScope: this.session.id, viewKey, conversationId: state.snapshot.conversation.id, turnId: turn.id, messageId, taskId: turn.task.id }) : null;
  }
  private member(identity: SteeringIdentity) {
    const view = this.views.get(identity.viewKey), state = view?.projection.getSnapshot();
    return !this.closed && !this.session.signal.aborted && identity.connectionScope === this.session.id && state?.snapshot?.conversation.id === identity.conversationId
      && state.turns.some(turn => turn.id === identity.turnId && turn.task.id === identity.taskId && userMessageId(turn) === identity.messageId);
  }
  isCurrent(identity: SteeringIdentity) {
    const last = this.views.get(identity.viewKey)?.projection.getSnapshot().snapshot?.lastTurn;
    return this.member(identity) && last?.id === identity.turnId && last.task.id === identity.taskId && last.task.status === "running";
  }
  hasEntry(viewKey: string, messageId: string) { return [...this.entries.values()].some(entry => entry.identity.viewKey === viewKey && entry.identity.messageId === messageId); }
  /** Called by P01's authorize callback. Port calls additionally check their exact bound view. */
  authorize(context: ResourceContext, mode: "read" | "write") {
    return [...this.views.keys()].some(key => {
      const identity = context.kind === "message" ? this.identity(key, context.messageId) : null;
      return identity && sameResource(identity, context) && this.member(identity) && this.session.steeringAllowed(identity, mode);
    });
  }
  private permission(entry: OwnedEntry, mode: "read" | "write") {
    const view = this.views.get(entry.identity.viewKey);
    return this.member(entry.identity) && !!view?.visible && view.projection.getSnapshot().connection === "live" && entry.open
      && this.session.host.list().find(plugin => plugin.id === STEERING_OWNER)?.state === "active"
      && this.session.steeringAllowed(entry.identity, mode);
  }
  private assert(entry: OwnedEntry, mode: "read" | "write", signal: AbortSignal) {
    if (signal.aborted || !this.permission(entry, mode)) throw Error("Steering belongs to a hidden, offline, unauthorized or expired view.");
  }
  private async read<T>(entry: OwnedEntry, signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>) {
    const bound = AbortSignal.any([signal, this.session.signal]); this.assert(entry, "read", bound);
    const value = await operation(bound); this.assert(entry, "read", bound); return value;
  }
  open(viewKey: string, context: ResourceContext, returnFocus?: HTMLElement) {
    const identity = context.kind === "message" ? this.identity(viewKey, context.messageId) : null;
    if (!identity || !sameResource(identity, context) || !this.session.steeringAllowed(identity, "read")) throw Error("This message is not available for steering in this view.");
    const id = JSON.stringify(identity); let entry = this.entries.get(id);
    if (!entry) {
      if (!this.isCurrent(identity)) throw Error("Only the current running turn can start steering.");
      if (this.entries.size >= MAX_STEERING_BINDINGS) throw Error("Eight steering tasks are already open in this connection. Close a chat after resolving its receipts before opening another; unknown receipts are never discarded automatically.");
      entry = this.createEntry(id, identity); this.entries.set(id, entry);
    }
    for (const other of this.entries.values()) if (other !== entry) other.open = false;
    entry.open = true; entry.returnFocus = returnFocus; this.sync(); this.publish();
    void entry.raw.refresh();
  }
  hasRecovery() { return this.session.recovery.configured(); }
  drafts(viewKey: string): CompleteDraft["steering"] { return [...this.entries.values()].filter(entry => entry.identity.viewKey === viewKey && entry.draft).map(entry => ({ taskId: entry.identity.taskId, turnId: entry.identity.turnId, messageId: entry.identity.messageId, text: entry.draft })); }
  setDraft(id: string, text: string) { const entry = this.entries.get(id); if (!entry || entry.draft === text) return; entry.draft = text; this.publish(); this.session.recovery.changed(entry.identity.viewKey); }
  configureRecovery() { if (this.session.recovery.configured()) for (const entry of this.entries.values()) entry.raw.configureRecovery(this.session.recovery.commandPort(entry.identity.viewKey)); }
  private restoredEntry(viewKey: string, taskId: string, turnId?: string, messageId?: string) {
    const state = this.views.get(viewKey)?.projection.getSnapshot(), turn = state?.turns.find(item => item.task.id === taskId);
    if (!turn || (turnId && turn.id !== turnId) || (messageId && userMessageId(turn) !== messageId)) throw Error("Load the original turn before restoring its steering material.");
    const identity = this.identity(viewKey, userMessageId(turn)); if (!identity || !this.session.steeringAllowed(identity, "read")) throw Error("This turn is not authorized for recovery.");
    const id = JSON.stringify(identity); let entry = this.entries.get(id);
    if (!entry) { if (this.entries.size >= MAX_STEERING_BINDINGS) throw Error("Resolve an existing steering view before restoring another."); entry = this.createEntry(id, identity); this.entries.set(id, entry); }
    return entry;
  }
  restoreDrafts(viewKey: string, drafts: CompleteDraft["steering"]) {
    const values = drafts.map(draft => ({ draft, entry: this.restoredEntry(viewKey, draft.taskId, draft.turnId, draft.messageId) }));
    if (values.some(({ entry }) => entry.draft)) throw Error("Keep the current steering draft before restoring another.");
    for (const { entry, draft } of values) entry.draft = draft.text;
    this.publish();
  }
  restoreReceipt(viewKey: string, record: CommandRecord) {
    const value = record.frozen; if (!value || typeof value !== "object" || Array.isArray(value) || !("taskId" in value) || typeof value.taskId !== "string") throw Error("Invalid steering target.");
    const entry = this.restoredEntry(viewKey, value.taskId);
    if (!entry.raw.getSnapshot().receipts.some(receipt => receipt.key === record.id)) entry.raw.restore(record);
    entry.open = true; this.sync(); this.publish();
  }
  retryReceipt(viewKey: string, id: string) { const entry = [...this.entries.values()].find(value => value.identity.viewKey === viewKey && value.raw.getSnapshot().receipts.some(receipt => receipt.key === id)); if (!entry || !entry.control.retry(id)) throw Error("Open the authorized original steering receipt before retrying."); }
  private createEntry(id: string, identity: Readonly<SteeringIdentity>): OwnedEntry {
    const entry = { id, identity, draft: "", open: false, visible: false, writable: false, current: false } as OwnedEntry;
    entry.raw = createSteeringControl({ connectionScope: identity.connectionScope, taskId: identity.taskId }, {
      admission: (options, signal) => this.read(entry, signal, bound => this.session.steeringAdmission(identity, options, bound)),
      state: (options, signal) => this.read(entry, signal, bound => this.session.steeringState(identity, options, bound)),
      accept: (input, key, signal) => this.dispatch(entry, input, key, signal),
    });
    if (this.session.recovery.configured()) entry.raw.configureRecovery(this.session.recovery.commandPort(identity.viewKey));
    let previous: SteeringSnapshot | undefined, cached: SteeringSnapshot | undefined, reason: string | undefined;
    entry.control = {
      getSnapshot: () => {
        const raw = entry.raw.getSnapshot();
        const nextReason = !this.permission(entry, "write") ? "Steering write access is unavailable." : !this.isCurrent(identity) ? "This is a previous or ended turn. Existing uncertain receipts can be retried; new instructions are disabled." : raw.sendDisabledReason;
        if (raw !== previous || nextReason !== reason) { previous = raw; reason = nextReason; cached = Object.freeze({ ...raw, sendDisabledReason: nextReason }); }
        return cached!;
      },
      subscribe: entry.raw.subscribe,
      configureRecovery: recovery => entry.raw.configureRecovery(recovery), restore: record => entry.raw.restore(record),
      submit: async text => {
        if (!this.permission(entry, "write") || !this.isCurrent(identity)) return false;
        if (this.session.recovery.configured()) this.session.recovery.beginHandoff(identity.viewKey, "steering", identity.taskId);
        const handedOff = await entry.raw.submit(text);
        if (!handedOff && this.session.recovery.configured()) this.session.recovery.cancelHandoff(identity.viewKey);
        return handedOff;
      },
      retry: key => this.permission(entry, "write") && entry.raw.retry(key),
      updateGate: gate => entry.raw.updateGate(gate),
      refresh: entry.raw.refresh, loadMore: entry.raw.loadMore, clearResolved: entry.raw.clearResolved, dispose: entry.raw.dispose,
    };
    entry.unsubscribe = entry.raw.subscribe(() => this.publish()); return entry;
  }
  private async dispatch(entry: OwnedEntry, input: SteeringCommandInput, key: string, signal: AbortSignal): Promise<SteeringCommandResult> {
    this.assert(entry, "write", signal);
    const request: PendingWrite = { entry, input, key, signal }; this.pending.set(key, request);
    try {
      const result = await this.session.host.execute(STEERING_ACCEPT, { entryId: entry.id, key }, contextFor(entry.identity));
      if (!result.ok) throw request.error ?? Error(result.error);
      this.assert(entry, "write", signal); return result.value as SteeringCommandResult;
    } finally { if (this.pending.get(key) === request) this.pending.delete(key); }
  }
  /** Only the authorized P01 handler reaches raw HTTP. Never calls the control's accept port. */
  async accept(entryId: string, key: string, context: ResourceContext, commandSignal: AbortSignal) {
    const request = this.pending.get(key);
    if (!request || request.entry.id !== entryId || !sameResource(request.entry.identity, context)) throw Error("No bound steering handoff exists for this command.");
    const signal = AbortSignal.any([request.signal, commandSignal, this.session.signal]);
    try {
      this.assert(request.entry, "write", signal);
      const input = steeringCommandSchema.parse(request.input);
      const value = await this.session.steeringAccept(request.entry.identity, input, key, signal);
      this.assert(request.entry, "write", signal); return value;
    } catch (error) { request.error = error; throw error; }
  }
  sync() {
    if (this.closed) return;
    let changed = false;
    for (const entry of this.entries.values()) {
      const view = this.views.get(entry.identity.viewKey), visible = !!view?.visible && entry.open;
      const writable = this.permission(entry, "write"), authorized = this.permission(entry, "read"), current = this.isCurrent(entry.identity);
      if ((entry.writable && !writable) || (entry.current && !current)) entry.raw.updateGate({ visible: false, online: false, authorized: false });
      if (entry.visible !== visible || entry.writable !== writable || entry.current !== current) changed = true;
      entry.current = current;
      entry.visible = visible; entry.writable = writable;
      entry.raw.updateGate({ visible, online: view?.projection.getSnapshot().connection === "live", authorized });
    }
    if (changed) this.publish();
  }
  closeSurface(id: string) { const entry = this.entries.get(id); if (!entry) return; entry.open = false; this.sync(); this.publish(); if (entry.returnFocus?.isConnected && entry.returnFocus.getClientRects().length) entry.returnFocus.focus(); }
  risks(viewKey?: string) {
    return [...this.entries.values()].filter(entry => !viewKey || entry.identity.viewKey === viewKey).reduce((count, entry) => {
      const state = entry.raw.getSnapshot(); return count + Number(state.preparing) + state.receipts.filter(receipt => receipt.phase === "sending" || receipt.phase === "unknown" || (receipt.phase === "accepted" && !["observed-consumed", "rejected"].includes(receipt.command!.status))).length;
    }, 0);
  }
  closeView(viewKey: string) {
    const view = this.views.get(viewKey); view?.unsubscribe(); this.views.delete(viewKey);
    for (const [id, entry] of this.entries) if (entry.identity.viewKey === viewKey) { entry.unsubscribe(); entry.raw.dispose(); this.entries.delete(id); }
    this.publish();
  }
  dispose() { if (this.closed) return; this.closed = true; this.unsubscribeHost(); this.views.forEach(view => view.unsubscribe()); this.views.clear(); this.entries.forEach(entry => { entry.unsubscribe(); entry.raw.dispose(); }); this.entries.clear(); this.pending.clear(); this.publish(); this.listeners.clear(); }
}
const emptyEntries: readonly SteeringEntry[] = Object.freeze([]);
const emptySnapshot = () => emptyEntries;
const emptySubscribe = () => () => {};
const SteeringScopeContext = createContext<{ workspace: SteeringWorkspace; viewKey: string } | null>(null);
export function ConversationSteering({ session, viewKey, viewId, projection, visible, children }: { session: AppPluginSession; viewKey: string; viewId: string; projection: ConversationProjection; visible: boolean; children: ReactNode }) {
  useLayoutEffect(() => { session.steering.configure(viewKey, viewId, projection, visible); return () => session.steering.hide(viewKey); }, [session, viewKey, viewId, projection, visible]);
  return <SteeringScopeContext.Provider value={{ workspace: session.steering, viewKey }}>{children}</SteeringScopeContext.Provider>;
}
function SteeringEntryPanel({ context, execute }: PluginViewProps) {
  const scope = useContext(SteeringScopeContext);
  const [error, setError] = useState<string>();
  const snapshot = useSyncExternalStore(scope?.workspace.subscribe ?? emptySubscribe, scope?.workspace.getSnapshot ?? emptySnapshot);
  void snapshot;
  const identity = context.kind === "message" && scope ? scope.workspace.identity(scope.viewKey, context.messageId) : null;
  if (!scope || !identity) return null;
  const current = scope.workspace.isCurrent(identity), visited = scope.workspace.hasEntry(scope.viewKey, identity.messageId);
  if (!current && !visited) return null;
  return <div><Button variant="outline" size="sm" onClick={() => {
    setError(undefined);
    void execute(STEERING_OPEN, { viewKey: scope.viewKey }).then(result => { if (!result.ok) setError(result.error); }, () => setError("Unable to open steering in this view."));
  }}>{current ? "Guide running task" : "Steering receipts"}</Button>{error && <p role="alert">{error}</p>}</div>;
}
function SteeringSurface({ entry, workspace }: { entry: SteeringEntry; workspace: SteeringWorkspace }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (entry.visible) heading.current?.focus(); }, [entry.visible]);
  return <section hidden={!entry.visible} aria-label="Running task steering" className="fixed bottom-4 right-4 z-40 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-lg border bg-background p-3 shadow-xl" data-steering-task={entry.identity.taskId}>
    <div className="mb-2 flex items-center justify-between gap-2"><h2 ref={heading} tabIndex={-1} className="font-medium">Running task instruction</h2><Button variant="ghost" size="sm" onClick={() => workspace.closeSurface(entry.id)}>Hide steering</Button></div>
    <p className="mb-2 text-xs text-muted-foreground">Task {entry.identity.taskId} · Separate from Send now and Queue next.</p>
    <SteeringControl control={entry.control} draft={entry.draft} onDraftChange={text => workspace.setDraft(entry.id, text)} durableRecovery={workspace.hasRecovery()} />
  </section>;
}
/** Stable outside movable chat groups. Hidden controls remain mounted to retain their own draft. */
export function SteeringSurfaces({ workspace }: { workspace: SteeringWorkspace }) {
  const entries = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  return <>{entries.map(entry => <SteeringSurface key={entry.id} entry={entry} workspace={workspace} />)}</>;
}
export function createSteeringPlugin(workspace: SteeringWorkspace): PluginDefinition {
  return { manifest: { id: STEERING_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["task.steering.read", "task.steering.write"], activationEvents: ["view:chat.message.footer", `command:${STEERING_OPEN}`, `command:${STEERING_ACCEPT}`],
    commands: [{ id: STEERING_OPEN, title: "Guide running task", capability: "task.steering.read", contexts: ["message"] }, { id: STEERING_ACCEPT, title: "Send bound steering command", capability: "task.steering.write", contexts: ["message"] }],
    contributions: [{ kind: "panel", id: STEERING_PANEL, slot: "chat.message.footer", title: "Running task steering", capability: "task.steering.read" }] },
    load: async () => ({ activate(context) {
      context.contribute(STEERING_PANEL, SteeringEntryPanel);
      context.command(STEERING_OPEN, { parse: value => { const viewKey = (value as { viewKey?: unknown })?.viewKey; if (typeof viewKey !== "string") throw Error("View required."); return viewKey; }, run: (viewKey, command) => workspace.open(viewKey, command.resource, typeof document === "undefined" ? undefined : document.activeElement as HTMLElement) });
      context.command(STEERING_ACCEPT, { parse: value => { const args = value as { entryId?: unknown; key?: unknown }; if (typeof args?.entryId !== "string" || typeof args.key !== "string") throw Error("Bound receipt required."); return { entryId: args.entryId, key: args.key }; }, run: (args, command) => workspace.accept(args.entryId, args.key, command.resource, command.signal) });
    } }) };
}
