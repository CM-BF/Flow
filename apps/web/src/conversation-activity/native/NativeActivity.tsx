import { useState, useSyncExternalStore } from "react";
import type { NativeActivityReference } from "@flow/contracts";
import { Button } from "../../components/ui/button";
import { ReasoningRoot, ReasoningTrigger, ReasoningContent } from "../../components/assistant-ui/elements/reasoning";
import { Tool, ToolHeader, ToolContent } from "./tool";
import type { NativeActivityProjection } from "./projection";

function NativeBody({ projection, row }: { projection: NativeActivityProjection; row: NativeActivityReference }) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const detail = state.bodies[row.id];
  if (row.phase === "redacted") return <p>Provider redacted this thinking. No body is available.</p>;
  if (!row.detail) return <p>This observation has no readable body.</p>;
  const body = detail?.data?.body;
  let text = body?.content;
  if (body?.mediaType === "application/json" && !body.truncated) { try { text = JSON.stringify(JSON.parse(body.content), null, 2); } catch { /* Non-JSON payload stays literal text. */ } }
  return <>
    {detail?.loading && <p role="status">Loading activity content…</p>}
    {detail?.error && <p role="alert">{detail.error}</p>}
    {!body && !detail?.loading && <Button size="sm" variant="outline" onClick={() => void projection.loadBody(row.id)}>Retry activity content</Button>}
    {body && <><p className="text-xs text-muted-foreground">{body.truncated ? `Truncated UTF-8 prefix · original ${body.originalBytes} bytes. Omitted bytes are not available.` : `${body.originalBytes} bytes · ${body.mediaType}`}</p>
      <pre tabIndex={0} aria-label="Native activity content" className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{text}</pre>
      <details className="text-xs"><summary>Source identity</summary><dl className="break-all"><dt>Attempt</dt><dd>{row.attemptId}</dd><dt>Source</dt><dd>{row.source} · {row.sourceMessageId}</dd><dt>Original content SHA-256 (not prefix verification)</dt><dd>{body.sha256}</dd></dl></details></>}
    {detail?.data && body === null && <p>No body was returned.</p>}
  </>;
}
export function NativeActivity({ projection }: { projection: NativeActivityProjection }) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const page = state.pages[state.index];
  const toggle = (row: NativeActivityReference, open: boolean) => {
    setExpanded(open ? row.id : null); setError(undefined);
    if (open) void projection.loadBody(row.id).catch(error => setError(String(error)));
  };
  return <section aria-label="Native execution activity" className="min-w-0 space-y-2 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><span>Provider observations · page {state.index + 1}{page?.stale && " · may be out of date"}</span><Button size="sm" variant="outline" disabled={state.loading || !state.active} onClick={() => void projection.refresh()}>Refresh tool states</Button></div>
    <p className="text-xs text-muted-foreground">Input ready is not running. Unknown means the center cannot confirm the outcome. These records are not a final reply or verification result.</p>
    {state.loading && <p role="status">Loading native activity…</p>}{(state.error || error) && <p role="alert">{state.error ?? error}</p>}
    {page && !page.activities.length && <p>No native activity was returned. Task events may still be available.</p>}
    {page?.activities.map(row => <div key={row.id} data-native-activity={row.id}>
      {row.kind === "thinking" ? <ReasoningRoot streaming={false} open={expanded === row.id} onOpenChange={open => toggle(row, open)}><ReasoningTrigger active={false} /><p className="text-xs text-muted-foreground">Provider thinking · {row.status}</p><ReasoningContent>{expanded === row.id && <NativeBody projection={projection} row={row} />}</ReasoningContent></ReasoningRoot>
        : row.kind === "tool" ? <Tool open={expanded === row.id} onOpenChange={open => toggle(row, open)}><ToolHeader title={row.toolName ?? "Tool observation"} state={row.status} /><ToolContent>{expanded === row.id && <NativeBody projection={projection} row={row} />}</ToolContent></Tool>
        : <details open={expanded === row.id} onToggle={event => { if (event.currentTarget.open !== (expanded === row.id)) toggle(row, event.currentTarget.open); }}><summary>{row.kind === "unsupported" ? "Unsupported provider observation" : "Provider text observation"} · {row.status}</summary>{expanded === row.id && <NativeBody projection={projection} row={row} />}</details>}
    </div>)}
    <nav aria-label="Native activity pages" className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={state.loading || !state.active || !state.index} onClick={() => { setExpanded(null); void projection.showPage(state.index - 1); }}>Previous activity page</Button><Button size="sm" variant="outline" disabled={state.loading || !state.active || !page?.nextCursor} onClick={() => { setExpanded(null); void projection.showPage(state.index + 1); }}>Next activity page</Button></nav>
  </section>;
}
