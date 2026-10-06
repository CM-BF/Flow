import { StrictMode, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { FlowClient } from "@flow/client";
import { createContextSelection, type ContextSelection } from "../src/conversation-context/controller";
import { ContextPicker } from "../src/conversation-context/ContextPicker";
import { applyTheme } from "../src/themes";
import "../src/assistant-ui.css";
import "../src/styles.css";

function Session({ connection, projectId }: { connection: number; projectId: string }) {
  const [controller, setController] = useState<ContextSelection | null>(null);
  const [visible, setVisible] = useState(true), [online, setOnline] = useState(true), [authorized, setAuthorized] = useState(true), [capable, setCapable] = useState(true);
  const [draft, setDraft] = useState("Unsent message"), [frozen, setFrozen] = useState("[]"), [error, setError] = useState("");
  useEffect(() => {
    const client = new FlowClient({ baseUrl: `${location.origin}/connection-${connection}`, token: "fixture-only" });
    const instance = createContextSelection({ binding: { connectionKey: `connection-${connection}`, viewId: "fixture-view", projectId }, readiness: { visible: true, online: true, authorized: true, knowledgeContext: true },
      port: { search: (query, signal) => client.searchKnowledge(projectId, query, signal), resolve: (citation, signal) => client.resolveKnowledge(projectId, citation, signal) } });
    setController(instance); return () => instance.dispose();
  }, [connection, projectId]);
  useLayoutEffect(() => controller?.setReadiness({ visible, online, authorized, knowledgeContext: capable }), [controller, visible, online, authorized, capable]);
  if (!controller) return <p>Preparing fixture…</p>;
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <button onClick={() => setVisible(value => !value)}>{visible ? "Hide picker" : "Show picker"}</button>
      <button onClick={() => setOnline(value => !value)}>{online ? "Go offline" : "Reconnect"}</button>
      <button onClick={() => setAuthorized(value => !value)}>{authorized ? "Revoke access" : "Authorize access"}</button>
      <button onClick={() => setCapable(value => !value)}>{capable ? "Disable knowledge capability" : "Enable knowledge capability"}</button>
    </div>
    <div hidden={!visible}><ContextPicker key={`${connection}:${projectId}`} controller={controller} /></div>
    <label style={{ display: "grid", marginTop: 16 }}>Draft<textarea aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} style={{ minHeight: 80, background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", padding: 8 }} /></label>
    <button style={{ marginTop: 8 }} onClick={() => { try { setFrozen(JSON.stringify(controller.freeze())); setError(""); } catch (failure) { setError((failure as Error).message); } }}>Freeze references locally</button>
    {error && <p role="alert">{error}</p>}
    <details><summary>Fixture diagnostics</summary><output data-testid="frozen" style={{ overflowWrap: "anywhere" }}>{frozen}</output><Diagnostics controller={controller} /></details>
    <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>HTTP fixture only. Freezing is local. Send, Queue, models and real project knowledge are not connected.</p>
  </>;
}
function Diagnostics({ controller }: { controller: ContextSelection }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return <output data-testid="state" style={{ display: "block", overflowWrap: "anywhere" }}>{JSON.stringify({ project: state.binding.projectId, hits: state.hits.length, selected: state.selected.length, bodyCount: Object.keys(state.bodies).length, loading: state.loading })}</output>;
}
function Fixture() {
  const [connection, setConnection] = useState(1), [projectId, setProject] = useState("project-a");
  return <main style={{ maxWidth: 720, padding: 12, margin: "12px auto", color: "var(--foreground)", background: "var(--background)" }}>
    <header style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}><h1 style={{ fontSize: 18, margin: "0 12px 0 0" }}>Message knowledge fixture</h1>
      <button onClick={() => applyTheme("light")}>Light</button><button onClick={() => applyTheme("dark")}>Dark</button><button onClick={() => setConnection(value => value + 1)}>New connection</button><button onClick={() => setProject(value => value === "project-a" ? "project-b" : "project-a")}>Other project</button></header>
    <Session key={`${connection}:${projectId}`} connection={connection} projectId={projectId} />
  </main>;
}
applyTheme("light");
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
