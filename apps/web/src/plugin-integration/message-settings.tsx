import { createContext, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { ClaudeTurnSettings } from "@flow/contracts";
import type { FlowClient } from "@flow/client";
import { createMessageSettingsCatalog } from "../execution-profiles/catalog";
import { captureMessageSettings, type Immutable, type MessageSettingsContext } from "../execution-profiles/selection";
import { commitMessageSettingsChange, MessageSettingsPicker, MessageSettingsSummary, type MessageSettingsCommitResult } from "../execution-profiles/ExecutionProfilePicker";
import { freezeMessageSettings } from "../conversation-context/receipts";
import { PluginView } from "../plugins/react";
import type { PluginDefinition } from "../plugins/types";
import type { AppPluginSession } from "./session";

export const MESSAGE_SETTINGS_OWNER = "flow.message-settings";
export const MESSAGE_SETTINGS_PANEL = "flow.message-settings.panel";
const OPEN = "flow.message-settings.open";
export interface MessageSettingsDraft {
  readonly ownership: symbol;
  readonly value?: Immutable<ClaudeTurnSettings>;
}
/** App owns this value. A new draft always gets new ownership, even when C is retained. */
export function messageSettingsDraft(value?: Immutable<ClaudeTurnSettings>): MessageSettingsDraft {
  return Object.freeze({ ownership: Symbol("message draft"), ...(value === undefined ? {} : { value: freezeMessageSettings(value) }) });
}
export interface MessageSettingsAuthority {
  draft: MessageSettingsDraft;
  context: MessageSettingsContext;
  generation: number;
  editable: boolean;
}
/** Private App port, never exposed to arbitrary plugins or persisted. */
export interface MessageSettingsPort {
  read(viewKey: string): MessageSettingsAuthority | null;
  replace(viewKey: string, expected: symbol, value: Immutable<ClaudeTurnSettings> | undefined): MessageSettingsDraft;
  profiles: FlowClient["claudeMessageSettingsProfiles"];
}

/** Only catalog and opening lifetime live here; applied C always comes from App.read. */
export class ConversationMessageSettings {
  private visible = false;
  private viewId = "";
  private closed = false;
  private opening: { token: symbol; signal: AbortSignal; generation: number; invoker: HTMLElement | null; read: AbortController } | null = null;
  private returnOpening: ConversationMessageSettings["opening"] = null;
  private version = 0;
  private catalogGeneration: number | null = null;
  private observed = "";
  private observedDraft: MessageSettingsDraft | undefined;
  private listeners = new Set<() => void>();
  readonly catalog = createMessageSettingsCatalog(async (options, signal) => {
    const opening = this.opening;
    const current = () => opening !== null && this.opening === opening && this.allowed() && !opening.signal.aborted
      && this.authority()?.generation === opening.generation;
    if (!current()) throw Error("Open an authorized message settings view before reading its directory.");
    const value = await this.port()!.profiles(options, AbortSignal.any([...(signal ? [signal] : []), opening!.read.signal, opening!.signal, this.session.signal]));
    if (!current()) throw Error("This settings directory belongs to a closed opening.");
    this.catalogGeneration = opening!.generation;
    return value;
  });
  constructor(readonly viewKey: string, private readonly session: AppPluginSession, private readonly port: () => MessageSettingsPort | undefined) {}
  getSnapshot = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.version++; this.listeners.forEach(listener => listener()); }
  context() { return { kind: "composer" as const, viewId: this.viewId, isDraft: true }; }
  authority() { return this.closed ? null : this.port()?.read(this.viewKey) ?? null; }
  allowed() {
    return !this.closed && this.visible && this.authority()?.editable === true && !this.session.signal.aborted
      && this.session.host.list().some(item => item.id === MESSAGE_SETTINGS_OWNER && item.state === "active")
      && this.session.host.checkView(MESSAGE_SETTINGS_PANEL, this.context()).ok;
  }
  configure(viewId: string, visible: boolean) { this.viewId = viewId; this.visible = visible; this.sync(); }
  sync() {
    const authority = this.authority();
    if (this.opening && (!this.allowed() || this.opening.signal.aborted || authority?.generation !== this.opening.generation)) this.close();
    const key = JSON.stringify([this.viewId, this.visible, authority?.editable, authority?.generation, authority?.context]);
    if (key !== this.observed || authority?.draft !== this.observedDraft) {
      this.observed = key; this.observedDraft = authority?.draft; this.emit();
    }
  }
  open(signal: AbortSignal) {
    if (!this.allowed() || signal.aborted) throw Error("Show this authorized conversation before editing its message settings.");
    this.close();
    const opening = { token: Symbol("settings opening"), signal, generation: this.authority()!.generation,
      invoker: document.activeElement instanceof HTMLElement ? document.activeElement : null, read: new AbortController() };
    this.returnOpening = null; this.opening = opening;
    signal.addEventListener("abort", this.close, { once: true });
    this.emit();
    void this.catalog.refresh();
  }
  close = () => {
    const previous = this.opening; this.opening = null;
    if (!previous) return;
    this.returnOpening = previous;
    previous.signal.removeEventListener("abort", this.close); previous.read.abort(); this.emit();
  };
  presentation() {
    const opening = this.opening, returning = opening ?? this.returnOpening;
    return { opening: opening?.token ?? null, close: this.close,
      invoker: () => this.allowed() && returning && !returning.signal.aborted && this.authority()?.generation === returning.generation ? returning.invoker : null };
  }
  commit(value: Immutable<ClaudeTurnSettings> | undefined, ownership: symbol): MessageSettingsCommitResult {
    const opening = this.opening;
    const authority = this.authority();
    if (!opening || !authority) return { status: "unavailable" };
    return commitMessageSettingsChange(value, ownership, () => {
      const current = this.authority();
      return { ownership: current?.draft.ownership ?? Symbol(), editable: this.allowed() && this.opening === opening
        && !opening.signal.aborted && current?.generation === opening.generation
        && (value === undefined || this.catalogGeneration === current.generation),
        context: current?.context ?? { profile: null, capability: null }, catalog: this.catalog.getSnapshot() };
    }, next => { this.port()!.replace(this.viewKey, ownership, next); this.sync(); });
  }
  capture() {
    const current = this.authority();
    if (!current?.editable) throw Error("This message draft is not editable.");
    if (current.draft.value !== undefined && this.catalogGeneration !== current.generation) throw Error("Refresh the message settings directory before sending this retained selection.");
    return { ownership: current.draft.ownership, generation: current.generation, value: captureMessageSettings(current.draft.value, this.catalog.getSnapshot(), current.context) };
  }
  /** Called synchronously immediately before the official composer detaches A. */
  detach(captured: ReturnType<ConversationMessageSettings["capture"]>) {
    const current = this.authority();
    if (!current?.editable || current.generation !== captured.generation || current.draft.ownership !== captured.ownership) throw Error("The draft changed before submission.");
    const next = this.port()!.replace(this.viewKey, captured.ownership, captured.value);
    this.sync(); return next.ownership;
  }
  restoreCaptured(value: ReturnType<ConversationMessageSettings["capture"]>, expected: symbol) {
    const current = this.authority();
    if (!current?.editable || current.generation !== value.generation || current.draft.ownership !== expected) throw Error("The draft changed before restoring its settings.");
    const next = this.port()!.replace(this.viewKey, expected, value.value); this.sync(); return next.ownership;
  }
  isCurrent(ownership: symbol, generation?: number) { const current = this.authority(); return current?.draft.ownership === ownership && current.editable === true && (generation === undefined || current.generation === generation); }
  dispose() { if (this.closed) return; this.close(); this.closed = true; this.returnOpening = null; this.catalog.dispose(); this.listeners.clear(); }
}

const BoundSettings = createContext<ConversationMessageSettings | null>(null);
function SettingsPanel() {
  const binding = useContext(BoundSettings)!;
  useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const catalog = useSyncExternalStore(binding.catalog.subscribe, binding.catalog.getSnapshot);
  const authority = binding.authority();
  if (!authority) return null;
  return <><MessageSettingsSummary value={authority.draft.value} label="下一条消息设置" /><MessageSettingsPicker catalog={catalog} context={authority.context} value={authority.draft.value}
    draftOwnership={authority.draft.ownership} editable={binding.allowed()} hostControl={binding.presentation()}
    onChange={(value, owner) => binding.commit(value, owner)} onRefresh={() => void binding.catalog.refresh()} onLoadMore={() => void binding.catalog.loadMore()} /></>;
}
export function MessageSettingsComposer({ session, viewKey, viewId, visible, children }: {
  session: AppPluginSession; viewKey: string; viewId: string; visible: boolean; children: ReactNode;
}) {
  const binding = useMemo(() => session.messageSettingsBinding(viewKey), [session, viewKey]);
  useLayoutEffect(() => { binding.configure(viewId, visible); return () => binding.configure(viewId, false); }, [binding, viewId, visible]);
  return <BoundSettings.Provider value={binding}>{children}</BoundSettings.Provider>;
}
export function MessageSettingsSurface({ session, viewId }: { session: AppPluginSession; viewId: string }) {
  return <PluginView host={session.host} contributionId={MESSAGE_SETTINGS_PANEL} context={{ kind: "composer", viewId, isDraft: true }} />;
}
export function createMessageSettingsPlugin(open: (viewId: string, signal: AbortSignal) => void): PluginDefinition {
  return { manifest: { id: MESSAGE_SETTINGS_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["ui.layout", "workspace.read"],
    activationEvents: [`command:${OPEN}`, "view:chat.composer.context"],
    commands: [{ id: OPEN, title: "消息设置", capability: "ui.layout", contexts: ["composer"] }],
    contributions: [{ kind: "button", id: "flow.message-settings.button", slot: "chat.composer.actions", title: "消息设置", commandId: OPEN },
      { kind: "panel", id: MESSAGE_SETTINGS_PANEL, slot: "chat.composer.context", title: "下一条消息设置", capability: "ui.layout" }] },
    load: async () => ({ activate(context) {
      context.command(OPEN, { parse: () => null, run: (_, command) => {
        if (command.resource.kind !== "composer") throw Error("A conversation composer is required.");
        open(command.resource.viewId, context.signal);
      } });
      context.contribute(MESSAGE_SETTINGS_PANEL, SettingsPanel);
    } }) };
}

export interface PreparedDraftReturn {
  readonly text: string;
  readonly ids: readonly string[];
  entered: boolean;
  returning?: { text: string; ids: readonly string[] };
}
/** Observe the installed core's public submission transition. Only its automatic
 * material return is undone; the current App C is never copied into this guard. */
export function bindPreparedDraftReturn<T extends PreparedDraftReturn>(composer: import("@assistant-ui/react").ComposerRuntime,
  pending: () => T | null, returned: (capture: T, error?: unknown) => void): () => void {
  let active = true;
  let observed: { capture: T; id: string; text: string; ids: readonly string[] } | null = null;
  const unsubscribe = composer.subscribe(() => {
    const capture = pending(), state = composer.getState();
    if (!capture || capture.returning) return;
    if (state.submission) {
      observed = { capture, id: state.submission.id, text: state.text, ids: state.attachments.map(file => file.id) }; return;
    }
    if (!observed || observed.capture !== capture) return;
    const before = observed; observed = null;
    if (capture.entered || state.inTransit?.some(value => value.id === before.id)) return;
    capture.returning = { text: before.text, ids: before.ids };
    // setText publishes synchronously; private subscribers read the guarded B.
    composer.setText(before.text);
    const remove = state.attachments.filter(file => capture.ids.includes(file.id) && !before.ids.includes(file.id))
      .map(async file => composer.getAttachmentByIndex(composer.getState().attachments.findIndex(value => value.id === file.id)).remove());
    void Promise.allSettled(remove).then(results => {
      const failure = results.find(result => result.status === "rejected");
      if (!active || pending() !== capture) return;
      returned(capture, failure?.status === "rejected" ? failure.reason : undefined);
      if (!failure) capture.returning = undefined;
    });
  });
  return () => { active = false; observed = null; unsubscribe(); };
}
