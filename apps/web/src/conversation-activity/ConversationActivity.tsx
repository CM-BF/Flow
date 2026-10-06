import { useState, useSyncExternalStore } from "react";
import { Button } from "../components/ui/button";
import type { ConversationActivityProjection } from "./projection";
import "./activity.css";

const ROWS = 25;
const BODY_CHARS = 8192;
function bodySlice(text: string, page: number) {
  const boundary = (offset: number) => offset > 0 && /[\uDC00-\uDFFF]/.test(text.charAt(offset)) ? offset - 1 : offset;
  return text.slice(boundary(page * BODY_CHARS), boundary((page + 1) * BODY_CHARS));
}
function BodyPages({ text }: { text: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(text.length / BODY_CHARS));
  const current = Math.min(page, pages - 1);
  return <div className="flow-activity-body">
    <pre tabIndex={0} aria-label="Detail text">{bodySlice(text, current)}</pre>
    {pages > 1 && <nav aria-label="Detail text pages"><span>Text page {current + 1} of {pages}. Display is paged; the full response is retained.</span>
      <Button type="button" variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous text</Button>
      <Button type="button" variant="outline" size="sm" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next text</Button></nav>}
  </div>;
}

/** Content only: the host owns the single disclosure and a connection/turn-scoped projection. */
export function ConversationActivity({ projection }: { projection: ConversationActivityProjection }) {
  return <ActivityContent key={JSON.stringify(projection.getSnapshot().scope)} projection={projection} />;
}
function ActivityContent({ projection }: { projection: ConversationActivityProjection }) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadDetail = (id: string) => {
    setActionError(null);
    void projection.loadDetail(id).catch(error => setActionError(error instanceof Error ? error.message : "This reference is no longer available."));
  };
  const pages = Math.max(1, Math.ceil(state.entries.length / ROWS));
  const current = Math.min(page, pages - 1);
  if (!state.active) return null;
  return <section className="flow-activity" aria-label="Execution activity">
    <header><strong>{state.task.status.replaceAll("_", " ")}</strong><span>Verification: {state.task.verificationStatus}</span>
      <Button type="button" variant="outline" size="sm" disabled={state.loading || !state.online} onClick={() => void projection.refresh()}>Refresh activity</Button></header>
    <p className="flow-activity-source">Task activity from the center{state.loadedAt && <> · Read <time dateTime={state.loadedAt}>{new Date(state.loadedAt).toLocaleTimeString()}</time></>}{state.stale && " · May be out of date"}</p>
    {!state.online && <p role="status">Offline. Loaded activity stays available; execution is not cancelled.</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {state.loading && <p role="status">Loading activity…</p>}
    {!state.loaded && !state.loading && <p>Activity has not been loaded.</p>}
    {state.loaded && state.entries.length === 0 && !state.error && <p>No activity was returned in this snapshot.</p>}
    <ol className="flow-activity-list" aria-label="Activity entries" tabIndex={0} start={current * ROWS + 1}>
      {state.entries.slice(current * ROWS, (current + 1) * ROWS).map(entry => {
        const open = expanded === entry.id;
        const detail = entry.kind === "reference" ? state.details[entry.reference.id] : undefined;
        return <li key={entry.id} data-activity-entry={entry.id}>
          <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleTimeString()}</time>
          {entry.kind === "text" ? <><p>{entry.text.slice(0, 1200)}{entry.text.length > 1200 && "…"}</p>
            {entry.text.length > 1200 && <Button type="button" variant="link" size="sm" aria-expanded={open} onClick={() => setExpanded(open ? null : entry.id)}>{open ? "Hide full entry" : "Read full entry"}</Button>}
            {open && <BodyPages text={entry.text} />}</> : <>
            <Button type="button" variant="link" size="sm" aria-expanded={open} disabled={!state.online && !detail?.data} onClick={() => {
              setExpanded(open ? null : entry.id);
              if (!open) loadDetail(entry.reference.id);
            }}>{entry.reference.title}</Button>
            {open && <div className="flow-activity-detail" aria-label={`Detail: ${entry.reference.title}`}>
              {detail?.loading && <p role="status">Loading detail…</p>}
              {detail?.error && <p role="alert">{detail.error}</p>}
              {!detail?.loading && !detail?.data && <Button type="button" variant="outline" size="sm" disabled={!state.online} onClick={() => loadDetail(entry.reference.id)}>Retry detail</Button>}
              {detail?.data && <><p className="flow-activity-source">{detail.data.kind} · {detail.data.mediaType}{detail.data.artifactVersion && ` · Version ${detail.data.artifactVersion}`}</p><BodyPages text={detail.data.content} /></>}
            </div>}
          </>}
        </li>;
      })}
    </ol>
    {state.entries.length > 0 && <nav aria-label="Activity pages"><span>{state.entries.length} entries loaded · Page {current + 1} of {pages}</span>
      <Button type="button" variant="outline" size="sm" disabled={current === 0} onClick={() => { setPage(current - 1); setExpanded(null); }}>Previous entries</Button>
      <Button type="button" variant="outline" size="sm" disabled={current + 1 === pages} onClick={() => { setPage(current + 1); setExpanded(null); }}>Next entries</Button></nav>}
    {state.hasMore && <Button type="button" variant="outline" size="sm" disabled={state.loading || !state.online} onClick={() => void projection.loadMore()}>Load more activity</Button>}
  </section>;
}
