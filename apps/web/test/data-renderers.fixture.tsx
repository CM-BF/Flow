import { Activity, StrictMode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { AssistantRuntimeProvider, useAuiState, useExternalStoreRuntime } from "@assistant-ui/react";
import { FlowClient } from "@flow/client";
import { PluginHost } from "../src/plugins/host";
import { Thread } from "../src/components/assistant-ui/elements/thread.aui";
import { createDataRendererRegistry, FLOW_REPLY_NAME, FLOW_REPLY_OWNER } from "../src/data-renderers/registry";
import { AssistantDataRenderers } from "../src/data-renderers/react";
import { createReplyPort, FlowReplyDetail, flowReplyDeclaration, flowReplyFallback, ReplyBindingsProvider, type ReplyPort, type ReplySnapshot } from "../src/data-renderers/flow-reply-detail";
import { ConversationProjection, replyDetailKey } from "../src/conversations/projection";
import { conversationMessages } from "../src/conversations/messages";
import { applyTheme } from "../src/themes";
import "../src/assistant-ui.css";
import "../src/styles.css";
import "../src/conversations/conversations.css";

const readable = <T,>(value: T) => ({ getSnapshot: () => value, subscribe: () => () => {} });
function session(epoch: number) {
  const signal = new AbortController();
  const host = new PluginHost({ navigation: readable({ activeTaskId: null, workspaceTab: "files", workspaceOpen: false }), theme: readable({ themeId: "light", scheme: "light", availableThemes: [] }), getContext: () => ({ kind: "global" }), authorize: () => false, execute: async () => { throw Error("No command capability in fixture"); } });
  const registry = createDataRendererRegistry([flowReplyDeclaration], host);
  const projections = ["chat-1", "chat-2"].map(id => new ConversationProjection(new FlowClient({ baseUrl: window.location.origin, token: "flow-fixture-only" }), id, 60_000));
  const config = { throwRenderer: false };
  const Render = ({ data }: { data: unknown }) => { if (config.throwRenderer) throw Error("Simulated trusted renderer failure"); return <FlowReplyDetail data={data} />; };
  host.register({ manifest: { id: FLOW_REPLY_OWNER, version: "1.0.0", hostApi: 1, capabilities: [], activationEvents: [], commands: [], contributions: [] }, load: async () => ({ activate(context) { registry.attach(FLOW_REPLY_OWNER, FLOW_REPLY_NAME, Render, context); } }) });
  return { epoch, signal, host, registry, projections, config,
    dispose() { signal.abort(); projections.forEach(p => p.dispose()); void host.dispose(); registry.dispose(); },
  };
}
type Session = ReturnType<typeof session>;
const initial = session(1);
const empty: ReplySnapshot = Object.freeze({});
function bindings(s: Session, pane: number, projection: ConversationProjection) {
  const ports = new Map<string, ReplyPort>();
  return { connectionId: `connection-${s.epoch}`, viewId: `pane-${pane}`,
    bind(messageId: string, turnId: string) {
      const state = projection.getSnapshot();
      const turn = state.turns.find(t => t.id === turnId && t.assistant.state === "available" && t.assistant.messageId === messageId);
      if (!turn || !state.snapshot) return null;
      const conversationId = state.snapshot.conversation.id, key = replyDetailKey(conversationId, turn)!;
      const cached = ports.get(key); if (cached) return cached;
      let previous: unknown, snapshot = empty;
      const port = createReplyPort({ identity: { connectionId: `connection-${s.epoch}`, viewId: `pane-${pane}`, conversationId, messageId, turnId, taskId: turn.task.id, detailKey: key }, signal: s.signal.signal,
        current: () => {
          const current = projection.getSnapshot(); const actual = current.turns.find(t => t.id === turnId);
          return current.snapshot?.conversation.id === conversationId && actual?.assistant.state === "available" && actual.assistant.messageId === messageId && actual.task.id === turn.task.id && replyDetailKey(conversationId, actual) === key;
        },
        source: { subscribe: projection.subscribe, getSnapshot: () => {
          const detail = projection.getSnapshot().details[key];
          if (previous !== detail) { previous = detail; snapshot = detail ? { loading: detail.loading, error: detail.error, content: detail.data?.content } : empty; }
          return snapshot;
        } }, load: () => projection.loadReply(turnId),
      }); ports.set(key, port); return port;
    },
  };
}
function RegistrationCount() {
  const counts = useAuiState(state => [state.dataRenderers.renderers[FLOW_REPLY_NAME]?.length ?? 0, state.dataRenderers.fallbacks.length].join("/"));
  return <output aria-label="Provider registrations">{counts}</output>;
}
function Pane({ s, index, mode }: { s: Session; index: number; mode: string }) {
  const projection = s.projections[index]!;
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const replyBindings = useMemo(() => bindings(s, index, projection), [s, index, projection]);
  useEffect(() => { projection.setVisible(true); return () => projection.setVisible(false); }, [projection]);
  const messages = useMemo(() => conversationMessages(state.turns).map(message => {
    if (message.role !== "assistant" || typeof message.content === "string") return message;
    return { ...message, content: message.content?.map(part => part.type !== "data" ? part : mode === "unknown" ? { ...part, name: "unsupported-part" } : mode === "version" ? { ...part, data: { ...part.data as object, version: 99 } } : mode === "schema" ? { ...part, data: { turnId: 17 } } : mode === "wrongturn" ? { ...part, data: { turnId: "other-turn" } } : part) };
  }), [state.turns, mode]);
  const runtime = useExternalStoreRuntime({ messages, convertMessage: message => message, isRunning: false, onNew: async () => { throw Error("Fixture does not send messages"); } });
  return <section aria-label={`Pane ${index + 1}`} style={{ minWidth: 0, height: "78vh", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
    <h2 style={{ margin: 8 }}>Conversation {index + 1} · connection {s.epoch}</h2>
    <ReplyBindingsProvider value={replyBindings}><AssistantRuntimeProvider runtime={runtime}>
      <AssistantDataRenderers registry={s.registry} fallback={flowReplyFallback} /><RegistrationCount />
      <div style={{ flex: 1, minHeight: 0 }}><Thread autoFocus={false} composerPlaceholder={`Draft ${index + 1}`} /></div>
    </AssistantRuntimeProvider></ReplyBindingsProvider>
  </section>;
}
function Fixture() {
  const [s, setSession] = useState(initial), [hidden, setHidden] = useState(false), [closed, setClosed] = useState(false), [mode, setMode] = useState("valid");
  const [scheme, setScheme] = useState("light");
  const state = useSyncExternalStore(s.host.subscribe, s.host.list);
  useEffect(() => applyTheme(scheme), [scheme]);
  const toggle = async (broken: boolean) => { await s.host.deactivate(FLOW_REPLY_OWNER); s.config.throwRenderer = broken; await s.host.activate(FLOW_REPLY_OWNER); };
  return <><header style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
    <span>HTTP fixture · no model · {state[0]?.state}</span>
    <button onClick={() => void toggle(false)}>Activate renderer</button><button onClick={() => void s.host.deactivate(FLOW_REPLY_OWNER)}>Disable renderer</button><button onClick={() => void toggle(true)}>Broken renderer</button>
    <button onClick={() => setHidden(!hidden)}>{hidden ? "Show" : "Hide"} first pane</button><button onClick={() => setClosed(!closed)}>{closed ? "Reopen" : "Close"} first pane</button>
    <button onClick={() => { s.dispose(); setSession(session(s.epoch + 1)); }}>Change connection</button><button onClick={() => setScheme(scheme === "light" ? "dark" : "light")}>Change theme</button>
    <label>Data mode <select value={mode} onChange={event => setMode(event.target.value)}>{["valid", "unknown", "version", "schema", "wrongturn"].map(value => <option key={value}>{value}</option>)}</select></label>
  </header><main style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 370px), 1fr))", gap: 8, padding: 8 }}>
    {!closed && <Activity mode={hidden ? "hidden" : "visible"}><Pane key={`${s.epoch}:0`} s={s} index={0} mode={mode} /></Activity>}
    <Pane key={`${s.epoch}:1`} s={s} index={1} mode={mode} />
  </main></>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
