import { memo, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { TaskSummary, WorkspaceEntry } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { taskStatus } from "./Attention";

const ESTIMATED_HEIGHT = 126;
const OVERSCAN = 5;
interface ReadingAnchor { id: string; offset: number }

/** Geometry is independent of React and the center. Unknown heights are estimates, never dropped rows. */
export class ActivityLayout {
  private offsets: Float64Array;
  private indices = new Map<string, number>();
  constructor(readonly ids: readonly string[], heights: ReadonlyMap<string, number> = new Map()) {
    this.offsets = new Float64Array(ids.length + 1);
    ids.forEach((id, index) => {
      this.indices.set(id, index);
      this.offsets[index + 1] = this.offsets[index]! + Math.max(1, heights.get(id) ?? ESTIMATED_HEIGHT);
    });
  }
  get height() { return this.offsets[this.ids.length]!; }
  offset(index: number) { return this.offsets[Math.max(0, Math.min(index, this.ids.length))]!; }
  indexOf(id: string) { return this.indices.get(id); }
  indexAt(offset: number) {
    let low = 0, high = this.ids.length;
    while (low < high) { const mid = (low + high) >>> 1; if (this.offsets[mid + 1]! <= offset) low = mid + 1; else high = mid; }
    return Math.min(low, Math.max(0, this.ids.length - 1));
  }
  window(top: number, height: number) {
    if (!this.ids.length) return { start: 0, end: 0 };
    return { start: Math.max(0, this.indexAt(Math.max(0, top)) - OVERSCAN), end: Math.min(this.ids.length, this.indexAt(Math.max(0, top) + height) + OVERSCAN + 1) };
  }
  anchor(top: number): ReadingAnchor | null {
    if (!this.ids.length) return null;
    const index = this.indexAt(Math.max(0, top));
    return { id: this.ids[index]!, offset: top - this.offset(index) };
  }
  restore(anchor: ReadingAnchor) {
    const index = this.indexOf(anchor.id);
    return index === undefined ? null : this.offset(index) + Math.min(anchor.offset, this.offset(index + 1) - this.offset(index) - 1);
  }
}

interface ActivityWindowProps {
  entries: readonly WorkspaceEntry[];
  summaries: ReadonlyMap<string, TaskSummary>;
  active: boolean;
  following: boolean;
  canFollow: boolean;
  header: ReactNode;
  onFollowingChange(following: boolean): void;
  onOpenTask(taskId: string): void;
  onOpenReference(taskId: string, referenceId: string): void;
}

/** Only visible rows plus one focused row mount; every retained entry remains reachable by scroll or Tab. */
export function ActivityWindow({ entries, summaries, active, following, canFollow, header, onFollowingChange, onOpenTask, onOpenReference }: ActivityWindowProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const headingHeight = useRef(0);
  const heights = useRef(new Map<string, number>());
  const anchor = useRef<ReadingAnchor | null>(null);
  const [measurement, setMeasurement] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, height: 600 });
  const [focused, setFocused] = useState<string | null>(null);
  const pendingFocus = useRef<{ id: string; last: boolean } | null>(null);
  const programmedTop = useRef<number | null>(null);
  const width = useRef(0);
  const layout = useMemo(() => new ActivityLayout(entries.map(entry => entry.id), heights.current), [entries, measurement]);
  const range = layout.window(following ? Math.max(0, layout.height - scroll.height) : scroll.top, scroll.height);
  const rendered = Array.from({ length: range.end - range.start }, (_, index) => range.start + index);
  const focusedIndex = focused ? layout.indexOf(focused) : undefined;
  if (focusedIndex !== undefined && !rendered.includes(focusedIndex)) rendered.push(focusedIndex);
  rendered.sort((a, b) => a - b);

  const listTop = () => list.current!.getBoundingClientRect().top - viewport.current!.getBoundingClientRect().top + viewport.current!.scrollTop;
  const readScroll = () => {
    const element = viewport.current!;
    const top = element.scrollTop - listTop();
    setScroll(previous => previous.top === top && previous.height === element.clientHeight ? previous : { top, height: element.clientHeight });
    return top;
  };
  const setTop = (top: number) => {
    const element = viewport.current!;
    element.scrollTop = Math.max(0, top);
    programmedTop.current = element.scrollTop;
    readScroll();
  };

  useLayoutEffect(() => {
    if (!active || !viewport.current || !list.current) return;
    if (following) setTop(viewport.current.scrollHeight);
    else if (anchor.current) {
      const top = layout.restore(anchor.current);
      if (top !== null) setTop(listTop() + top);
      else anchor.current = layout.anchor(readScroll());
    } else anchor.current = layout.anchor(readScroll());
    const target = pendingFocus.current;
    if (target) {
      const row = [...list.current.querySelectorAll<HTMLElement>("[data-entry-id]")].find(element => element.dataset.entryId === target.id);
      const buttons = row?.querySelectorAll<HTMLButtonElement>("button");
      const button = target.last ? buttons?.[buttons.length - 1] : buttons?.[0];
      if (button) { pendingFocus.current = null; button.focus({ preventScroll: true }); }
    }
  }, [layout, active, following, focused]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!active || !element || !list.current) return;
    const measure = () => {
      if (!element.clientWidth) return;
      let changed = false;
      const nextHeadingHeight = heading.current?.getBoundingClientRect().height ?? 0;
      if (nextHeadingHeight !== headingHeight.current) { headingHeight.current = nextHeadingHeight; changed = true; }
      if (width.current !== element.clientWidth) { width.current = element.clientWidth; heights.current.clear(); changed = true; }
      for (const row of list.current!.querySelectorAll<HTMLElement>("[data-entry-id]")) {
        const height = row.getBoundingClientRect().height;
        if (height > 0 && Math.abs((heights.current.get(row.dataset.entryId!) ?? 0) - height) > 0.5) { heights.current.set(row.dataset.entryId!, height); changed = true; }
      }
      if (changed) setMeasurement(value => value + 1);
      readScroll();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (heading.current) observer.observe(heading.current);
    for (const row of list.current.querySelectorAll<HTMLElement>("[data-entry-id]")) observer.observe(row);
    return () => observer.disconnect();
  }, [active, entries, range.start, range.end, focused]);

  const moveTo = (index: number, focus = false, last = false) => {
    const id = entries[index]?.id;
    if (!id) return;
    onFollowingChange(false);
    anchor.current = { id, offset: 0 };
    if (focus) { pendingFocus.current = { id, last }; setFocused(id); }
    setTop(listTop() + layout.offset(index));
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-entry-id]");
    if (!row) return;
    const buttons = row.querySelectorAll("button");
    const boundary = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
    if (boundary !== event.target) return;
    const index = layout.indexOf(row.dataset.entryId!)! + (event.shiftKey ? -1 : 1);
    if (index < 0 || index >= entries.length) return;
    event.preventDefault(); moveTo(index, true, event.shiftKey);
  };
  const rows: ReactNode[] = [];
  let previousEnd = 0;
  for (const index of rendered) {
    if (index > previousEnd) rows.push(<li key={`gap-${previousEnd}`} className="wf-window-spacer" role="presentation" aria-hidden="true" style={{ height: layout.offset(index) - layout.offset(previousEnd) }} />);
    const item = entries[index]!;
    rows.push(<ActivityRow key={item.id} item={item} summary={summaries.get(item.task.id)} position={index + 1} size={entries.length} onOpenTask={onOpenTask} onOpenReference={onOpenReference} />);
    previousEnd = index + 1;
  }
  if (previousEnd < entries.length) rows.push(<li key={`gap-${previousEnd}`} className="wf-window-spacer" role="presentation" aria-hidden="true" style={{ height: layout.height - layout.offset(previousEnd) }} />);
  return <>
    <div className="wf-window-navigation" hidden={!active}>
      <span id="activity-window-range">Records {entries.length ? range.start + 1 : 0}–{range.end} of {entries.length} loaded</span>
      <button disabled={range.start === 0} onClick={() => moveTo(Math.max(0, range.start - (range.end - range.start)))}>Earlier records</button>
      <button disabled={range.end === entries.length} onClick={() => moveTo(range.end)}>Later records</button>
    </div>
    <div className="wf-feed" hidden={!active} ref={viewport} tabIndex={0} aria-label="Task activity records" aria-describedby="activity-window-range" onKeyDown={navigate}
      onFocusCapture={event => { const row = (event.target as HTMLElement).closest<HTMLElement>("[data-entry-id]"); if (row) setFocused(row.dataset.entryId!); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null); }}
      onScroll={() => {
        if (!active) return;
        const element = viewport.current!;
        const top = readScroll();
        if (programmedTop.current !== null && Math.abs(programmedTop.current - element.scrollTop) < 1) { programmedTop.current = null; return; }
        programmedTop.current = null;
        anchor.current = layout.anchor(top);
        onFollowingChange(canFollow && element.scrollHeight - element.scrollTop - element.clientHeight < 32);
      }}>
      <div ref={heading}>{header}</div>
      <ul ref={list} className="wf-records" data-total-records={entries.length} data-first-cursor={entries[0]?.cursor} data-last-cursor={entries.at(-1)?.cursor}>{rows}</ul>
    </div>
  </>;
}

const ActivityRow = memo(function ActivityRow({ item, summary, position, size, onOpenTask, onOpenReference }: {
  item: WorkspaceEntry; summary?: TaskSummary; position: number; size: number;
  onOpenTask(id: string): void; onOpenReference(taskId: string, referenceId: string): void;
}) {
  return <li data-entry-id={item.id} data-cursor={item.cursor} aria-posinset={position} aria-setsize={size}><article aria-label={`${item.task.title} record ${item.cursor}`}>
    <div className="wf-record-heading"><button onClick={() => onOpenTask(item.task.id)}>{item.task.title}</button><time dateTime={item.entry.createdAt}>{new Date(item.entry.createdAt).toLocaleTimeString()}</time></div>
    {item.entry.kind === "text" ? <p>{item.entry.text}</p> : <Button size="sm" variant="outline" onClick={() => { if (item.entry.kind === "reference") onOpenReference(item.task.id, item.entry.reference.id); }}>{item.entry.reference.title}</Button>}
    <span className="wf-record-source" title={`Task ${item.task.id} · workspace cursor ${item.cursor}`}>{summary ? `${taskStatus[summary.status]} · verification ${summary.verificationStatus}` : "Current state outside this summary window"} · {item.task.id}</span>
  </article></li>;
});
