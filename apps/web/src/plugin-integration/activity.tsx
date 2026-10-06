import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { ConversationTurn, Detail, EventPage, NativeActivity as NativeActivityDetail, NativeActivityPage } from "@flow/contracts";
import { createConversationActivity, type ActivityScope, type ConversationActivityProjection } from "../conversation-activity/projection";
import { ConversationActivity } from "../conversation-activity/ConversationActivity";
import { NativeActivityProjection } from "../conversation-activity/native/projection";
import { NativeActivity } from "../conversation-activity/native/NativeActivity";
import { userMessageId } from "../conversations/messages";
import type { ConversationProjection } from "../conversations/projection";
import type { AppPluginSession } from "./session";
import type { PluginDefinition, PluginViewProps } from "../plugins/types";

export const ACTIVITY_OWNER = "flow.conversation-activity";
export const ACTIVITY_PANEL = "flow.conversation-activity.panel";
export interface ActivityIdentity extends ActivityScope { messageId: string }
export interface ActivityReaders {
  events(identity: ActivityIdentity, after: number): Promise<EventPage>;
  detail(identity: ActivityIdentity, id: string, signal: AbortSignal): Promise<Detail>;
  nativePage(identity: ActivityIdentity, after: string | null, signal: AbortSignal): Promise<NativeActivityPage>;
  nativeBody(identity: ActivityIdentity, id: string, signal: AbortSignal): Promise<NativeActivityDetail>;
}
export interface BoundActivity {
  identity: Readonly<ActivityIdentity>;
  native: NativeActivityProjection;
  generic: ConversationActivityProjection;
  setDisplay(open: boolean, mode: "native" | "events"): void;
}
/** Host-owned per-pane cache. Merely creating/attaching it never reads a list or body. */
export function createConversationActivityBindings(session: AppPluginSession, viewId: string, projection: ConversationProjection) {
  let visible = false;
  const entries = new Map<string, BoundActivity & { sync(turn: ConversationTurn): void }>();
  const current = (identity: ActivityIdentity) => {
    const snapshot = projection.getSnapshot();
    return visible && snapshot.connection === "live" && !session.signal.aborted && snapshot.snapshot?.conversation.id === identity.conversationId
      && snapshot.turns.some(turn => turn.id === identity.turnId && turn.task.id === identity.taskId && userMessageId(turn) === identity.messageId)
      && session.canReadActivity(identity);
  };
  const bind = (messageId: string) => {
    const state = projection.getSnapshot(), turn = state.turns.find(turn => userMessageId(turn) === messageId);
    if (!state.snapshot || !turn) return null;
    const identity = Object.freeze({ connectionId: session.id, viewId, conversationId: state.snapshot.conversation.id, turnId: turn.id, taskId: turn.task.id, messageId });
    const key = JSON.stringify(identity);
    const previous = entries.get(key); if (previous) return previous;
    const assert = () => { if (!current(identity)) throw Error("This activity belongs to a hidden, closed, or different conversation."); };
    const read = async <T,>(operation: () => Promise<T>) => { assert(); const result = await operation(); assert(); return result; };
    const native = new NativeActivityProjection(identity, turn.task, {
      readPage: (after, signal) => read(() => session.readActivity("nativePage", identity, after, signal)),
      readBody: (id, signal) => read(() => session.readActivity("nativeBody", identity, id, signal)),
    });
    const generic = createConversationActivity(identity, turn.task, {
      readEvents: after => read(() => session.readActivity("events", identity, after)),
      readDetail: (id, signal) => read(() => session.readActivity("detail", identity, id, signal)),
    });
    let open = false, mode: "native" | "events" = "native";
    const setActive = () => {
      const online = projection.getSnapshot().connection === "live";
      const active = open && current(identity);
      // Deactivate before restoring online: setOnline(true) may refresh an active generic reader.
      native.setActive(active && mode === "native");
      if (!active || mode !== "events") generic.setActive(false);
      generic.setOnline(online);
      generic.setActive(active && mode === "events");
    };
    const entry = { identity, native, generic,
      setDisplay(next: boolean, selected: "native" | "events") { open = next; mode = selected; setActive(); },
      sync(next: ConversationTurn) {
        setActive(); native.updateTask(next.task); generic.updateTask(next.task);
        const state = generic.getSnapshot();
        // Generic refresh consumes the next event page: never auto-drain unfinished history.
        if (state.active && state.stale && !state.hasMore && !state.loading && !state.error) void generic.refresh();
      },
    };
    entries.set(key, entry); return entry;
  };
  return {
    bind,
    sync() { for (const [key, entry] of entries) { const turn = projection.getSnapshot().turns.find(turn => turn.id === entry.identity.turnId && turn.task.id === entry.identity.taskId); if (turn) entry.sync(turn); else { entry.native.dispose(); entry.generic.dispose(); entries.delete(key); } } },
    setVisible(next: boolean) { visible = next; for (const entry of entries.values()) { if (!next) { entry.native.setActive(false); entry.generic.setActive(false); } } if (next) this.sync(); },
    dispose() { visible = false; for (const entry of entries.values()) { entry.native.dispose(); entry.generic.dispose(); } entries.clear(); },
  };
}
export type ConversationActivityBindings = ReturnType<typeof createConversationActivityBindings>;
export const ActivityBindingsContext = createContext<ConversationActivityBindings | null>(null);
function ActivityPanel({ context }: PluginViewProps) {
  const bindings = useContext(ActivityBindingsContext);
  const entry = context.kind === "message" && context.role === "user" ? bindings?.bind(context.messageId) : null;
  return entry ? <BoundActivityPanel key={JSON.stringify(entry.identity)} entry={entry} /> : <p>Activity is not available for this message.</p>;
}
function BoundActivityPanel({ entry }: { entry: BoundActivity }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"native" | "events">("native");
  const state = useSyncExternalStore(entry.native.subscribe, entry.native.getSnapshot);
  useEffect(() => { entry.setDisplay(open, mode); return () => entry.setDisplay(false, mode); }, [entry, open, mode]);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="w-full min-w-0 rounded-md border px-3 py-2 text-left text-sm" data-conversation-activity={entry.identity.turnId}>
    <summary className="cursor-pointer">Activity · {state.task.status.replaceAll("_", " ")}</summary>
    {open && <div className="mt-3 space-y-3"><fieldset className="flex flex-wrap gap-3" aria-label="Activity source"><label><input type="radio" name={`activity-${entry.identity.viewId}-${entry.identity.turnId}`} checked={mode === "native"} onChange={() => setMode("native")} /> Tools and thinking</label><label><input type="radio" name={`activity-${entry.identity.viewId}-${entry.identity.turnId}`} checked={mode === "events"} onChange={() => setMode("events")} /> Task events</label></fieldset>
      {!entry.generic.getSnapshot().online && <p role="status">Activity reading is paused while this view is offline or reconnecting. Loaded content stays available.</p>}<div hidden={mode !== "native"}><NativeActivity projection={entry.native} /></div><div hidden={mode !== "events"}><ConversationActivity projection={entry.generic} /></div></div>}
  </details>;
}
export function createActivityPlugin(): PluginDefinition {
  return { manifest: { id: ACTIVITY_OWNER, version: "1.0.0", hostApi: 1,
    capabilities: ["task.activity.read", "reference.read", "ui.navigate", "clipboard.write"],
    activationEvents: ["view:chat.message.footer", "command:flow.conversation-activity.open", "command:flow.conversation-activity.copy"],
    commands: [
      { id: "flow.conversation-activity.open", title: "Open task controls", capability: "ui.navigate", contexts: ["message"] },
      { id: "flow.conversation-activity.copy", title: "Copy task ID", capability: "clipboard.write", contexts: ["message"] },
    ], contributions: [
      { kind: "panel", id: ACTIVITY_PANEL, slot: "chat.message.footer", title: "Turn activity", capability: "task.activity.read" },
      { kind: "button", id: "flow.conversation-activity.controls", slot: "chat.message.footer", title: "Open task controls", commandId: "flow.conversation-activity.open" },
      { kind: "menu", id: "flow.conversation-activity.copy-id", slot: "chat.message.footer", title: "Copy task ID", commandId: "flow.conversation-activity.copy" },
    ] }, load: async () => ({ activate(context) {
      context.contribute(ACTIVITY_PANEL, ActivityPanel);
      context.command("flow.conversation-activity.open", { parse: () => undefined, run: async (_, command) => { if (command.resource.kind !== "message") throw Error("Message required."); await command.execute("flow.chat.open", { taskId: command.resource.taskId }); } });
      context.command("flow.conversation-activity.copy", { parse: () => undefined, run: async (_, command) => { if (command.resource.kind !== "message") throw Error("Message required."); await command.execute("flow.clipboard.copy", { text: command.resource.taskId }); } });
    } }) };
}
