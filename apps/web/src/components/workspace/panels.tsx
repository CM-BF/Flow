import { useEffect, useState } from "react";
import type { Detail, Reference, TaskSnapshot, VerificationStatus } from "@flow/contracts";
import { FileTree, FileTreeFile, FileTreeFolder } from "./ai-elements/file-tree";
import { Terminal, TerminalActions, TerminalContent, TerminalCopyButton, TerminalHeader,
  TerminalStatus, TerminalTitle } from "./ai-elements/terminal";
import type { WorkspaceDetailState, WorkspacePanelsProps } from "./types";

const groupLabels: Record<Detail["kind"] | "unopened", string> = {
  artifact: "Artifacts", verification: "Verification", detail: "Details",
  usage: "Usage", session: "Sessions", unopened: "Unopened references",
};
export function WorkspaceFiles({ references, details, onOpen, defaultExpanded, onExpandedChange, selectedPath, onSelectedPathChange }: {
  references: Reference[];
  details: Record<string, WorkspaceDetailState>;
  onOpen: (reference: Reference) => void;
  defaultExpanded: Set<string>;
  onExpandedChange: (expanded: Set<string>) => void;
  selectedPath?: string;
  onSelectedPathChange: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => {
    const next = new Set(defaultExpanded);
    const selectedId = selectedPath?.startsWith("reference:") ? selectedPath.slice(10) : null;
    if (selectedId) next.add(details[selectedId]?.data?.kind ?? "unopened");
    return next;
  });
  const groups = Object.entries(groupLabels).map(([kind, label]) => ({
    kind, label, references: references.filter((reference) =>
      (details[reference.id]?.data?.kind ?? "unopened") === kind),
  })).filter((group) => group.references.length > 0);

  return (
    <div className="flow-workspace-files">
      <p className="flow-workspace-caption">Task artifacts and references</p>
      {!references.length ? <p className="flow-workspace-empty">No files or references have been returned yet.</p> : (
        <FileTree className="flow-workspace-tree" aria-label="Task artifacts and references" expanded={expanded}
          selectedPath={selectedPath} onExpandedChange={(next) => { setExpanded(next); onExpandedChange(next); }}
          onSelect={(path) => {
            onSelectedPathChange(path);
            const reference = references.find((item) => `reference:${item.id}` === path);
            if (reference) onOpen(reference);
          }}>
          {groups.map((group) => (
            <FileTreeFolder path={group.kind} name={group.label} key={group.kind}>
              {group.references.map((reference) => <FileTreeFile path={`reference:${reference.id}`}
                name={reference.title} key={reference.id} title={reference.title} />)}
            </FileTreeFolder>
          ))}
        </FileTree>
      )}
      <p className="flow-workspace-footnote">Only references returned by this task appear here. Workspace browsing is not connected.</p>
    </div>
  );
}

export function WorkspaceTerminal({ task, connection, defaultFollow, onFollowChange }: {
  task: TaskSnapshot; connection: WorkspacePanelsProps["connection"];
  defaultFollow: boolean;
  onFollowChange: (follow: boolean) => void;
}) {
  const [follow, setFollowState] = useState(defaultFollow);
  function setFollow(value: boolean) { setFollowState(value); onFollowChange(value); }
  const [copyMessage, setCopyMessage] = useState("");
  const output = task.entries.flatMap((entry) => entry.kind === "text" ? [entry.text] : []).join("\n\n");
  const streaming = connection === "live" && task.status === "running";
  return (
    <div className="flow-workspace-output">
      <Terminal output={output} isStreaming={streaming} autoScroll={follow} className="flow-workspace-terminal">
        <TerminalHeader>
          <TerminalTitle>Task output</TerminalTitle>
          <TerminalActions>
            <TerminalStatus aria-label="Output is live">Live</TerminalStatus>
            <TerminalCopyButton disabled={!output} onError={() => setCopyMessage("Copy failed. Select the output and copy it manually.")}
              onCopy={() => setCopyMessage("Output copied.")} />
          </TerminalActions>
        </TerminalHeader>
        <TerminalContent tabIndex={0} aria-label="Read-only task output"
          onScroll={(event) => {
            const viewport = event.currentTarget;
            setFollow(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 24);
          }}>
          {!output ? <p className="flow-workspace-empty">No text output has arrived yet.</p> : undefined}
        </TerminalContent>
      </Terminal>
      {!follow && <button type="button" className="flow-workspace-follow" onClick={() => setFollow(true)}>Follow latest output</button>}
      <p className="flow-workspace-footnote">Read-only task text. An interactive shell is not connected.</p>
      <p className="flow-workspace-copy-feedback" role="status" aria-label="Clipboard feedback">{copyMessage}</p>
    </div>
  );
}

export function WorkspaceDetail({ reference, state, onLoad, verification }: {
  reference: Reference;
  state: WorkspaceDetailState | undefined;
  onLoad: (id: string) => void | Promise<void>;
  verification: VerificationStatus;
}) {
  const [requestError, setRequestError] = useState<string | null>(null);
  async function load() {
    setRequestError(null);
    try { await onLoad(reference.id); }
    catch (error) { setRequestError(error instanceof Error ? error.message : String(error)); }
  }
  useEffect(() => {
    if (!state?.data && !state?.loading && !state?.error) void load();
    // The projection owns caching and errors. Load once when a reference tab opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference.id]);

  const error = requestError ?? state?.error;
  if (error) return <div className="flow-workspace-detail"><p role="alert">{error}</p>
    <button type="button" className="flow-workspace-follow" onClick={() => void load()}>Retry detail</button></div>;
  if (!state?.data) return <p className="flow-workspace-empty" role="status">Loading {reference.title}…</p>;
  const detail = state.data;
  const textMedia = /^(text\/|application\/(?:json|[^;]+\+json)(?:;|$))/i.test(detail.mediaType);
  return <article className="flow-workspace-detail">
    <header><h3>{detail.title}</h3><p>{groupLabels[detail.kind]} <span>{detail.mediaType}</span></p></header>
    {detail.kind === "artifact" && <dl className="flow-workspace-artifact-meta">
      <div><dt>Version</dt><dd>{detail.artifactVersion ?? "Not provided"}</dd></div>
      <div><dt>Task verification</dt><dd data-verification={verification}>{verification}</dd></div>
    </dl>}
    {textMedia ? <pre className="flow-workspace-detail-content" tabIndex={0}>{detail.content}</pre>
      : <p className="flow-workspace-empty">Preview unavailable for this media type. The center returned a text payload; it has not been decoded or opened.</p>}
  </article>;
}
