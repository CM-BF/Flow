import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FlowClient } from "@flow/client";
import type { TaskSummary } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { Attention, taskStatus } from "./Attention";
import { TaskIndex } from "./TaskIndex";
import { WorkspaceFeedProjection } from "./projection";
import { TaskIndexProjection } from "./task-index";
import "./workspace-feed.css";

interface Anchor { id: string; offset: number }
export function WorkspaceOverview({ client, active, onTaskSummaries, onOpenTask, onOpenReference }: {
  client: FlowClient; active: boolean; onTaskSummaries(tasks: TaskSummary[]): void; onOpenTask(id: string): void; onOpenReference(taskId: string, referenceId: string): void;
}) {
  const [projection] = useState(() => new WorkspaceFeedProjection(client));
  const [index] = useState(() => new TaskIndexProjection(client));
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const [mode, setMode] = useState<"feed" | "index">("feed");
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLUListElement>(null);
  const anchor = useRef<Anchor | null>(null);
  const revision = useRef(state.revision);
  const rememberAnchor = () => {
    const scroller = viewport.current;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    const row = [...scroller.querySelectorAll<HTMLElement>("[data-entry-id]")].find(element => element.getBoundingClientRect().bottom > top + 1);
    if (row) anchor.current = { id: row.dataset.entryId!, offset: row.getBoundingClientRect().top - top };
  };
  const restorePosition = () => {
    const scroller = viewport.current;
    if (!scroller || !active || mode !== "feed") return;
    if (projection.getSnapshot().following) scroller.scrollTop = scroller.scrollHeight;
    else if (anchor.current) {
      const row = [...scroller.querySelectorAll<HTMLElement>("[data-entry-id]")].find(element => element.dataset.entryId === anchor.current?.id);
      if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.current.offset;
    }
  };
  useEffect(() => {
    projection.start(navigator.onLine);
    index.setOnline(navigator.onLine);
    const online = () => { projection.setOnline(true); index.setOnline(true); };
    const offline = () => { projection.setOnline(false); index.setOnline(false); };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); projection.stop(); index.stop(); };
  }, [projection, index]);
  useLayoutEffect(() => {
    if (state.revision !== revision.current) { anchor.current = null; revision.current = state.revision; }
    restorePosition();
  }, [state.entries, state.revision, active, mode]);
  useEffect(() => {
    const observer = new ResizeObserver(restorePosition);
    if (content.current) observer.observe(content.current);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [active, mode]);
  const showIndex = (attention = false) => { setMode("index"); void index.load(false, attention ? "attention" : "all"); };
  const statuses = new Map(state.tasks.map(task => [task.id, task]));
  useEffect(() => { onTaskSummaries(state.tasks); }, [state.tasks, onTaskSummaries]);
  return <section className="wf-overview" hidden={!active} aria-label="Work overview">
    <header className="wf-header">
      <div><h1>Work overview</h1><p>One place for progress across your tasks.</p></div>
      <span role="status" className={`connection ${state.connection}`}>{state.connection === "live" ? "Live" : state.connection === "offline" ? "Offline · tasks continue" : state.connection === "reconnecting" ? "Reconnecting…" : "Connecting…"}</span>
    </header>
    <nav className="wf-navigation" aria-label="Work overview views">
      <Button size="sm" variant={mode === "feed" ? "secondary" : "ghost"} aria-pressed={mode === "feed"} onClick={() => setMode("feed")}>Activity</Button>
      <Button size="sm" variant={mode === "index" ? "secondary" : "ghost"} aria-pressed={mode === "index"} onClick={() => showIndex()}>Task index</Button>
      <Button size="sm" variant="ghost" disabled={state.connection === "offline"} onClick={() => void projection.refresh()}>Refresh activity</Button>
    </nav>
    {state.notice && <p className="wf-notice" role="status">{state.notice}</p>}
    {state.error && <p className="wf-notice wf-error" role="alert">{state.error} <button onClick={() => void projection.refresh()}>Retry</button></p>}
    {mode === "index" ? <TaskIndex index={index} feed={projection} workspace={state} onOpenTask={onOpenTask} /> : <>
      <Attention state={state} projection={projection} onOpenTask={onOpenTask} onOpenIndex={() => showIndex(true)} />
      <div className="wf-section-heading"><h2>Activity</h2><span>{state.catchingUp ? "Catching up with the center…" : "Shared task records"}</span></div>
      {state.tasksTruncated && <p className="wf-muted wf-window-note">Task badges use the latest 100 task summaries. Open the task index for the complete list.</p>}
      <div className="wf-feed" ref={viewport} tabIndex={0} aria-label="Task activity records" onScroll={() => {
        if (!active) return;
        const element = viewport.current!;
        projection.setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight < 32 && state.buffered.length === 0);
        rememberAnchor();
      }}>
        {state.hasEarlier && <Button variant="outline" size="sm" disabled={state.loadingEarlier || state.connection === "offline"} onClick={() => { rememberAnchor(); void projection.loadEarlier(); }}> {state.loadingEarlier ? "Loading earlier records…" : "Load earlier records"} </Button>}
        {state.historyError && <p role="alert" className="wf-error">{state.historyError}</p>}
        {state.loading && <p role="status">Loading workspace…</p>}
        {state.deliveredCursor !== null && !state.entries.length && <p className="wf-muted">No activity in the latest successful snapshot. New tasks appear when the center accepts them.</p>}
        {state.deliveredCursor === null && !state.loading && <p className="wf-muted">Activity has not been loaded. Reconnect or retry to read the center’s state.</p>}
        <ul ref={content} className="wf-records">
          {state.entries.map(item => {
            const summary = statuses.get(item.task.id);
            return <li key={item.cursor} data-entry-id={item.id}><article aria-label={`${item.task.title} record ${item.cursor}`}>
              <div className="wf-record-heading"><button onClick={() => onOpenTask(item.task.id)}>{item.task.title}</button><time dateTime={item.entry.createdAt}>{new Date(item.entry.createdAt).toLocaleTimeString()}</time></div>
              {item.entry.kind === "text" ? <p>{item.entry.text}</p> : <Button size="sm" variant="outline" onClick={() => { if (item.entry.kind === "reference") onOpenReference(item.task.id, item.entry.reference.id); }}>{item.entry.reference.title}</Button>}
              <span className="wf-record-source" title={`Task ${item.task.id} · workspace cursor ${item.cursor}`}>{summary ? `${taskStatus[summary.status]} · verification ${summary.verificationStatus}` : "Current state outside this summary window"} · {item.task.id}</span>
            </article></li>;
          })}
        </ul>
      </div>
      <div className="wf-feed-footer">
        <span role="status">{state.buffered.length ? `${state.buffered.length} new records` : state.following ? "Following latest activity" : "Reading earlier activity"}</span>
        {(!state.following || state.buffered.length > 0) && <Button size="sm" variant="outline" onClick={() => { projection.revealNew(); requestAnimationFrame(restorePosition); }}>Show latest activity{state.buffered.length ? ` (${state.buffered.length})` : ""}</Button>}
      </div>
    </>}
  </section>;
}
