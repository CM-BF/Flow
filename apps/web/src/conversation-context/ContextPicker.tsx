import { useId, useState, useSyncExternalStore } from "react";
import type { ContextSelection, ContextSnapshot, SelectedContext } from "./controller";
import { citationBytes, citationKey } from "./selection";
import "./context-picker.css";

/** Content only: the host owns any popover/dialog and the text draft. */
export function ContextPicker({ controller }: { controller: ContextSelection }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [query, setQuery] = useState("");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const labelId = useId(), helpId = useId();
  function select(item: SelectedContext, checked: boolean) {
    try { checked ? controller.add(item.citation) : controller.remove(item.citation); setSelectionError(null); }
    catch { setSelectionError("Select no more than 4 references and 8192 bytes. Your current selection is kept."); }
  }
  const resultKeys = new Set(snapshot.hits.map(hit => citationKey(hit.citation)));
  const retained = snapshot.selected.filter(item => !resultKeys.has(citationKey(item.citation)));
  return <section className="context-picker" aria-label="Knowledge context">
    <header><h2>Knowledge</h2><span>{snapshot.selected.length} / 4 · {snapshot.selectedBytes} / 8192 bytes</span></header>
    <p id={helpId} className="context-hint">Choose fixed source versions for a message. Full content loads only when opened.</p>
    {snapshot.disabledReason && <p className="context-notice">{snapshot.disabledReason}</p>}
    <form onSubmit={event => { event.preventDefault(); void controller.search(query); }}>
      <label htmlFor={labelId}>Search project knowledge</label>
      <div className="context-search"><input id={labelId} value={query} onChange={event => setQuery(event.target.value)} aria-describedby={helpId} disabled={!!snapshot.disabledReason} />
        <button type="submit" disabled={!!snapshot.disabledReason || snapshot.loading}>{snapshot.loading ? "Searching…" : "Search"}</button></div>
    </form>
    <p className="context-hint" role="status" aria-live="polite">{snapshot.loading ? "Searching knowledge." : snapshot.searched ? `${snapshot.hits.length} results. ${snapshot.selected.length} selected.` : "Search to find references."}</p>
    {snapshot.error && <p role="alert">{snapshot.error}</p>}
    {selectionError && <p role="alert">{selectionError}</p>}
    {!!snapshot.selected.length && <div className="context-selected" aria-label="Selected references">{snapshot.selected.map(item => <button key={citationKey(item.citation)} type="button" onClick={() => { controller.remove(item.citation); setSelectionError(null); }} aria-label={`Remove ${item.title}, version ${item.citation.version}`}>
      {item.title} · v{item.citation.version}<span aria-hidden="true"> ×</span>
    </button>)}</div>}
    {retained.length > 0 && <div><h3>Selected from earlier results</h3>{retained.map(item => <ReferenceRow key={citationKey(item.citation)} item={item} snapshot={snapshot} controller={controller} onSelect={checked => select(item, checked)} />)}</div>}
    <ul className="context-results" aria-label="Knowledge search results">{snapshot.hits.map(hit => <li key={citationKey(hit.citation)}>
      <ReferenceRow item={{ title: hit.source.title, citation: hit.citation }} preview={hit.excerpt.text} snapshot={snapshot} controller={controller} onSelect={checked => select({ title: hit.source.title, citation: hit.citation }, checked)} />
    </li>)}</ul>
    {snapshot.hasMore && <p className="context-hint">More sources match. Narrow your search to find other results.</p>}
    <p className="context-hint">The center checks the full message budget when sent. A selection does not guarantee acceptance.</p>
  </section>;
}
function ReferenceRow({ item, preview, snapshot, controller, onSelect }: {
  item: SelectedContext; preview?: string; snapshot: ContextSnapshot; controller: ContextSelection; onSelect(checked: boolean): void;
}) {
  const key = citationKey(item.citation), body = snapshot.bodies[key];
  const selected = snapshot.selected.some(value => citationKey(value.citation) === key);
  return <article className="context-reference">
    <label className="context-choice"><input type="checkbox" checked={selected} disabled={!!snapshot.disabledReason} onChange={event => onSelect(event.target.checked)} />
      <span><strong>{item.title}</strong><span className="context-hint">Version {item.citation.version} · {citationBytes(item.citation)} bytes · Source {item.citation.sourceId}</span></span></label>
    {preview !== undefined && <p className="context-excerpt">{preview}</p>}
    <details onToggle={event => { if (event.target === event.currentTarget && event.currentTarget.open) void controller.expand(item.citation); }}>
      <summary>Read {item.title}, version {item.citation.version}</summary>
      {snapshot.disabledReason ? <p className="context-hint">{snapshot.disabledReason}</p> : <>
        {body?.loading && <p>Loading content…</p>}
        {body?.error && <p role="alert">{body.error}</p>}
        {body?.data && <>
          <p className="context-hint">{body.data.isCurrent ? "Current version at last read" : `A newer version existed at last read (v${body.data.currentVersion})`}. This reference remains v{item.citation.version}.</p>
          <pre className="context-body">{body.data.text}</pre>
        </>}
        {!body?.loading && <button type="button" onClick={() => void controller.expand(item.citation, { refresh: true })}>{body?.data ? "Check this reference again" : "Read content"}</button>}
      </>}
      <details className="context-identity"><summary>Reference identity</summary><dl><dt>Project</dt><dd>{item.citation.projectId}</dd><dt>Source version digest</dt><dd>{item.citation.contentDigest}</dd><dt>UTF-8 byte range</dt><dd>{item.citation.locator.start}–{item.citation.locator.end}</dd></dl><p className="context-hint">Digest identifies the whole source version, not this displayed chunk.</p></details>
    </details>
  </article>;
}
