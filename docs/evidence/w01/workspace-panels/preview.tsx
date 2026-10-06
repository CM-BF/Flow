import { createRoot } from "react-dom/client";
import { useState } from "react";
import type { Detail, TaskSnapshot } from "@flow/contracts";
import { WorkspacePanels } from "../../../../apps/web/src/components/workspace/WorkspacePanels";
import type { WorkspaceDetailState, WorkspaceTabId } from "../../../../apps/web/src/components/workspace/types";
import "./preview.css";

const task: TaskSnapshot = {
  id: "panel-fixture", title: "Review workspace", prompt: "Inspect outputs", harness: "fixture",
  status: "running", verificationStatus: "passed", createdAt: "2026-10-06T03:00:00Z", updatedAt: "2026-10-06T03:00:00Z",
  watermark: 4, hasMore: false, pendingDecision: null, attempt: null,
  usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: "unknown", incomplete: true },
  entries: [
    { id: "line", cursor: 1, createdAt: "2026-10-06T03:00:00Z", kind: "text", text: Array.from({ length: 80 }, (_, i) => `Processing output ${i + 1}`).join("\n") },
    { id: "ref1", cursor: 2, createdAt: "2026-10-06T03:00:00Z", kind: "reference", reference: { id: "report", title: "report.md" } },
    { id: "ref2", cursor: 3, createdAt: "2026-10-06T03:00:00Z", kind: "reference", reference: { id: "verification", title: "Verification results" } },
    { id: "ref3", cursor: 4, createdAt: "2026-10-06T03:00:00Z", kind: "reference", reference: { id: "failed", title: "Unavailable reference" } },
  ],
};
const content: Record<string, Detail> = {
  report: { id: "report", title: "report.md", kind: "artifact", mediaType: "text/markdown", artifactVersion: "v1", content: "# Workspace review\n\nThese bytes came from the component fixture, not a live center.\n\n<script>window.injected = true</script>" },
  verification: { id: "verification", title: "Verification results", kind: "verification", mediaType: "text/plain", content: "Required content found.\nArtifact verification passed." },
};
function Preview() {
  const [dark, setDark] = useState(false);
  const [detailsByTask, setDetailsByTask] = useState<Record<string, Record<string, WorkspaceDetailState>>>({});
  const [calls, setCalls] = useState(0);
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(task);
  const [tabsByTask, setTabsByTask] = useState<Record<string, WorkspaceTabId>>({});
  const taskId = snapshot?.id ?? "empty";
  const details = detailsByTask[taskId] ?? {};
  const activeTab = tabsByTask[taskId] ?? "files";
  function setActiveTab(tab: WorkspaceTabId) { setTabsByTask((previous) => ({ ...previous, [taskId]: tab })); }
  function load(id: string) {
    setCalls((count) => count + 1);
    setDetailsByTask((previous) => ({ ...previous, [taskId]: { ...previous[taskId], [id]: { loading: true } } }));
    const data = content[id] ? { ...content[id], content: taskId === "panel-fixture-b" ? "Task B reference bytes" : content[id].content } : null;
    window.setTimeout(() => setDetailsByTask((previous) => ({ ...previous, [taskId]: { ...previous[taskId], [id]: data ? { data } : { error: "Reference unavailable" } } })), 150);
  }
  return <main data-theme={dark ? "dark" : "light"} className={dark ? "dark" : ""}>
    <header className="fixture-controls"><strong>Component fixture</strong>
      <button onClick={() => setDark(!dark)}>Toggle theme</button>
      <button onClick={() => setSnapshot(snapshot ? null : task)}>Toggle task</button>
      <button onClick={() => setSnapshot((previous) => previous?.id === task.id ? { ...task, id: "panel-fixture-b" } : task)}>Switch task</button>
      <button onClick={() => setSnapshot((previous) => previous ? { ...previous, entries: [...previous.entries,
        { id: `new-${previous.entries.length}`, cursor: previous.entries.length + 1, createdAt: "2026-10-06T03:00:00Z", kind: "text", text: "New output arrived" }] } : previous)}>Append output</button>
      <output aria-label="Detail requests">{calls}</output>
    </header>
    <div className="fixture-panel"><WorkspacePanels task={snapshot} details={details} onLoadDetail={load} connection="live" activeTab={activeTab} onActiveTabChange={setActiveTab} /></div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
