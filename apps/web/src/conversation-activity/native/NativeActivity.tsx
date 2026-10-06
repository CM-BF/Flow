import { useState, useSyncExternalStore } from "react";
import type { NativeActivityReference } from "@flow/contracts";
import { Button } from "../../components/ui/button";
import { ReasoningRoot, ReasoningTrigger, ReasoningContent } from "../../components/assistant-ui/elements/reasoning";
import { Tool, ToolHeader, ToolContent } from "./tool";
import type { NativeActivityProjection } from "./projection";

function NativeBody({ projection, row }: { projection: NativeActivityProjection; row: NativeActivityReference }) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const detail = state.bodies[row.id];
  if (row.phase === "redacted") return <p>This reasoning was not shared. No content is available.</p>;
  if (!row.detail) return <p>No content is available for this activity.</p>;
  const body = detail?.data?.body;
  let text = body?.content;
  if (body?.mediaType === "application/json" && !body.truncated) { try { text = JSON.stringify(JSON.parse(body.content), null, 2); } catch { /* Non-JSON payload stays literal text. */ } }
  return <>
    {detail?.loading && <p role="status">Loading content…</p>}
    {detail?.error && <p role="alert">{detail.error}</p>}
    {!detail?.data && !detail?.loading && <Button size="sm" variant="outline" disabled={!state.active} onClick={() => void projection.loadBody(row.id)}>Retry activity content</Button>}
    {body && <>{body.truncated && <p className="text-xs text-muted-foreground">Content is shortened. The remaining text is unavailable.</p>}
      <pre tabIndex={0} aria-label="Native activity content" className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{text}</pre>
      <details className="text-xs"><summary>Content details</summary><dl className="break-all"><dt>Recorded state</dt><dd>{row.status}</dd><dt>Format</dt><dd>{body.mediaType}</dd><dt>Original bytes</dt><dd>{body.originalBytes}</dd><dt>Attempt</dt><dd>{row.attemptId}</dd><dt>Source</dt><dd>{row.source} · {row.sourceMessageId}</dd><dt>Original content SHA-256 (not prefix verification)</dt><dd>{body.sha256}</dd></dl></details></>}
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
    <div className="flex flex-wrap items-center justify-between gap-2"><span>Activity</span><Button size="sm" variant="outline" disabled={state.loading || !state.active} onClick={() => void projection.refresh()}>Refresh activity</Button></div>
    {page?.stale && <p role="status" className="text-xs text-muted-foreground">May be out of date. Refresh to check for changes.</p>}
    {state.loading && <p role="status">Loading activity…</p>}{(state.error || error) && <p role="alert">{state.error ?? error}</p>}
    {page && !page.activities.length && <p>No activity was recorded here. You can also check Task events.</p>}
    {page?.activities.map(row => <div key={row.id} data-native-activity={row.id}>
      {row.kind === "thinking" ? <ReasoningRoot streaming={false} open={expanded === row.id} onOpenChange={open => toggle(row, open)}><ReasoningTrigger active={false} /><p className="text-xs text-muted-foreground">{row.phase === "redacted" ? "Reasoning not shared" : "Recorded reasoning"}</p><ReasoningContent>{expanded === row.id && <NativeBody projection={projection} row={row} />}</ReasoningContent></ReasoningRoot>
        : row.kind === "tool" ? <Tool open={expanded === row.id} onOpenChange={open => toggle(row, open)}><ToolHeader title={row.toolName ?? "Tool observation"} state={row.status} /><ToolContent>{expanded === row.id && <NativeBody projection={projection} row={row} />}</ToolContent></Tool>
        : <details open={expanded === row.id} onToggle={event => { if (event.currentTarget.open !== (expanded === row.id)) toggle(row, event.currentTarget.open); }}><summary>{row.kind === "unsupported" ? "Unsupported activity" : "Recorded text"} · {row.status}</summary>{expanded === row.id && <NativeBody projection={projection} row={row} />}</details>}
    </div>)}
    {(state.index > 0 || page?.nextCursor) && <nav aria-label="Native activity pages" className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={state.loading || !state.active || !state.index} onClick={() => { setExpanded(null); void projection.showPage(state.index - 1); }}>Previous activity page</Button><Button size="sm" variant="outline" disabled={state.loading || !state.active || !page?.nextCursor} onClick={() => { setExpanded(null); void projection.showPage(state.index + 1); }}>Next activity page</Button></nav>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">About activity</summary><div className="space-y-1 pt-2">
      <p>These are recorded execution updates, not the final reply or its verification result.</p>
      <p>Input ready means the input is prepared; it does not confirm execution has started. Outcome unknown means no result has been confirmed.</p>
      {page && <p>Showing page {state.index + 1} · {page.activities.length} records on this page{page.nextCursor ? "; more available" : ""}. This is not a total count.</p>}
    </div></details>
  </section>;
}
