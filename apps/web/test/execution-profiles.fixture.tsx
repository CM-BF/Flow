import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { FlowClient } from "@flow/client";
import type { ConversationCreation } from "@flow/contracts";
import { createExecutionProfileCatalog } from "../src/execution-profiles/catalog";
import { ExecutionProfilePicker, type ExecutionProfilePickerProps } from "../src/execution-profiles/ExecutionProfilePicker";
import { freezeConversationCreation, legacyDefaultSelection, type ProfileSelection } from "../src/execution-profiles/selection";
import { Button } from "../src/components/ui/button";
import { applyTheme } from "../src/themes";
import "../src/assistant-ui.css";
import "../src/styles.css";

function Session({ connection }: { connection: number }) {
  const [catalog] = useState(() => createExecutionProfileCatalog(new FlowClient({ baseUrl: `${location.origin}/connection-${connection}`, token: "fixture-only" })));
  const snapshot = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [selection, setSelection] = useState<ProfileSelection>(legacyDefaultSelection);
  const [locked, setLocked] = useState<ExecutionProfilePickerProps["locked"]>();
  const [draft, setDraft] = useState("Unsent fixture draft");
  useEffect(() => { void catalog.refresh(); return () => catalog.dispose(); }, [catalog]);
  const freeze = (reason: "created" | "receipt-pending") => setLocked({ creation: freezeConversationCreation("Fixture conversation", selection) as ConversationCreation, reason });
  return <>
    <ExecutionProfilePicker catalog={snapshot} selection={selection} onSelect={setSelection} onRefresh={() => { void catalog.refresh(); }} onLoadMore={() => { void catalog.loadMore(); }} locked={locked} />
    <label style={{ display: "grid", marginTop: "2rem", gap: ".5rem" }}>Draft<textarea aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: ".5rem", padding: ".75rem", minHeight: "7rem" }} /></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: "1rem" }}>
      <Button type="button" variant="outline" onClick={() => freeze("receipt-pending")} disabled={!!locked}>Freeze pending creation</Button>
      <Button type="button" variant="outline" onClick={() => freeze("created")} disabled={!!locked}>Show created lock</Button>
    </div>
    <details style={{ marginTop: "1rem", fontSize: ".8rem" }}><summary>Fixture diagnostics</summary>
      <output data-testid="selection" style={{ display: "block", overflowWrap: "anywhere" }}>{locked ? JSON.stringify(locked.creation) : selection.kind === "configured" ? selection.profile.reference.id : "legacy-default"}</output>
      <p data-testid="catalog-state">{snapshot.loading ? "loading" : snapshot.stale ? "stale" : "current"}; {snapshot.profiles.length} profiles; connection {connection}</p>
    </details>
    <p style={{ color: "var(--muted-foreground)", fontSize: ".8rem" }}>HTTP fixture only. These controls freeze input locally; no conversation or model is invoked.</p>
  </>;
}
function Fixture() {
  const [connection, setConnection] = useState(1);
  return <main style={{ maxWidth: "46rem", padding: "1.5rem", margin: "1rem auto" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap", marginBottom: "2rem" }}><h1 style={{ fontSize: "1.2rem", fontWeight: 600 }}>New conversation configuration</h1><div style={{ display: "flex", gap: ".5rem" }}><Button variant="ghost" onClick={() => applyTheme("light")}>Light</Button><Button variant="ghost" onClick={() => applyTheme("dark")}>Dark</Button><Button variant="outline" onClick={() => setConnection(value => value + 1)}>New connection</Button></div></header>
    <Session key={connection} connection={connection} />
  </main>;
}
applyTheme("light");
createRoot(document.getElementById("root")!).render(<Fixture />);
