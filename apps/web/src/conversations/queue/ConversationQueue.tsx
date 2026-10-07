import { MessageSettingsSummary } from "../../execution-profiles/ExecutionProfilePicker";
import { useRef, useState, useSyncExternalStore } from "react";
import { TERMINAL_STATUSES } from "@flow/contracts";
import { Button } from "../../components/ui/button";
import { Queue, QueueSection, QueueSectionTrigger, QueueSectionLabel, QueueSectionContent, QueueItem, QueueItemContent, QueueItemActions, QueueItemAction } from "./queue-elements";
import { queueError } from "./commands";
import type { ConversationQueueProjection } from "./projection";

export function ConversationQueue({ projection }: { projection: ConversationQueueProjection }) {
  const state = useSyncExternalStore(projection.subscribe, projection.getSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const run = async (action: () => Promise<unknown>) => { setError(null); try { await action(); } catch (error) { setError(queueError(error)); } };
  const preserveFocus = async (button: HTMLButtonElement, action: () => Promise<unknown>) => {
    const hadFocus = document.activeElement === button;
    await run(action);
    requestAnimationFrame(() => {
      if (hadFocus && !button.isConnected && document.activeElement === document.body) root.current?.querySelector<HTMLButtonElement>('[data-queue-refresh]')?.focus();
    });
  };
  const revealFocusedControl = (control: EventTarget) => {
    requestAnimationFrame(() => {
      const viewport = root.current?.closest<HTMLElement>('[data-slot="aui_thread-viewport"]');
      const footer = viewport?.querySelector<HTMLElement>(".aui-thread-viewport-footer");
      if (!(control instanceof HTMLElement) || !control.isConnected || !viewport || !footer) return;
      const overlap = control.getBoundingClientRect().bottom - footer.getBoundingClientRect().top;
      if (overlap > 0) viewport.scrollTop += overlap + 8;
    });
  };
  if (!state.available && !state.receipts.length) return null;
  const page = state.page, blocked = projection.actionDisabledReason("control");
  const task = page?.currentTurn, active = Boolean(task && !TERMINAL_STATUSES.includes(task.taskStatus));
  return <section ref={root} onFocusCapture={event => revealFocusedControl(event.target)} aria-label="Conversation queue" className="flow-conversation-queue min-w-0 text-sm">
    <Queue className="gap-0 rounded-lg px-0 py-0 shadow-none">
      <QueueSection defaultOpen={false}>
        <QueueSectionTrigger className="gap-2 bg-transparent px-2 py-1.5 text-xs"><QueueSectionLabel label={page ? `${page.items.length} waiting loaded${page.nextCursor ? "; more available" : ""}` : "Queue"} /><span>{state.loading ? "Refreshing…" : state.stale ? "Needs refresh" : page?.paused ? "Paused" : "Center queue"}</span></QueueSectionTrigger>
        <QueueSectionContent className="px-2 pb-2">
          <p className="my-2 text-xs text-muted-foreground">Accepted messages are stored at the center. Only the center promotes waiting messages into executions.</p>
          <div className="my-2 flex flex-wrap gap-2">
            <Button data-queue-refresh type="button" variant="outline" size="sm" disabled={!state.online || state.loading} onClick={() => void run(() => projection.refresh(true))}>Refresh queue</Button>
            <Button type="button" variant="outline" size="sm" disabled={Boolean(blocked) || page?.paused} onClick={() => void run(() => projection.pause())}>Pause queue</Button>
            <Button type="button" variant="outline" size="sm" disabled={Boolean(blocked) || active || !page || (!page.paused && !page.blocked)} onClick={() => void run(() => projection.resume())}>Continue queue</Button>
          </div>
          {page && <p className="my-2 text-xs">{page.paused ? "Paused: new executions will not start from this queue." : "Queue may advance at the center."} {page.blocked && `Waiting reason: ${page.blocked.replaceAll("-", " ")}.`}</p>}
          {task && <p className="my-2 break-words text-xs">Current execution: {task.taskId} · {task.taskStatus.replaceAll("_", " ")}</p>}
          {page?.paused && active && <Button type="button" variant="outline" size="sm" disabled={Boolean(projection.actionDisabledReason(`task:${task!.taskId}`))} onClick={() => setCancelTarget(task!.taskId)}>Cancel current execution…</Button>}
          {cancelTarget && <div className="my-2 rounded border p-2" role="group" aria-label="Confirm current execution cancellation"><p>Request cancellation of {cancelTarget}? Pausing and cancellation have separate receipts. Work already performed is not undone.</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="destructive" size="sm" onClick={event => void preserveFocus(event.currentTarget, async () => { await projection.cancelCurrentTask(cancelTarget); setCancelTarget(null); })}>Confirm execution cancellation</Button><Button type="button" variant="outline" size="sm" onClick={event => void preserveFocus(event.currentTarget, async () => { setCancelTarget(null); })}>Keep execution</Button></div></div>}
          {!page && !state.error && <p role="status">Queue has not loaded yet.</p>}
          {page && !state.stale && !page.items.length && <p className="my-2">No waiting messages in the last successful snapshot.</p>}
          <ul className="my-2 max-h-64 space-y-1 overflow-y-auto" aria-label="Waiting messages">
            {page?.items.map(item => {
              const detail = state.details[item.id], open = expanded.has(item.id);
              return <QueueItem key={item.id}>
                <QueueItemContent className="line-clamp-2">{item.preview}{item.truncated ? "…" : ""}</QueueItemContent>
                <MessageSettingsSummary value={item.messageSettings} label="Queued request settings" />
                <QueueItemActions>
                  <QueueItemAction aria-expanded={open} onClick={() => { const next = new Set(expanded); if (open) next.delete(item.id); else { next.add(item.id); void projection.loadDetail(item.id); } setExpanded(next); }}>{open ? "Hide message" : "Read full message"}</QueueItemAction>
                  <QueueItemAction disabled={Boolean(projection.actionDisabledReason(`item:${item.id}`))} onClick={event => void preserveFocus(event.currentTarget, () => projection.cancelItem(item.id))}>Cancel waiting message</QueueItemAction>
                </QueueItemActions>
                {open && <div>{!detail && <p>Full message is not cached. <button className="flow-link" onClick={() => void projection.loadDetail(item.id)}>Read message again</button></p>}{detail?.loading && <p role="status">Loading message…</p>}{detail?.error && <p role="alert">{detail.error} <button className="flow-link" onClick={() => void projection.loadDetail(item.id)}>Retry message detail</button></p>}{detail?.data && <pre className="whitespace-pre-wrap break-words text-xs">{detail.data.item.text}</pre>}</div>}
              </QueueItem>;
            })}
          </ul>
          {page?.nextCursor !== null && page && <Button type="button" variant="outline" size="sm" disabled={state.loading || !state.online || state.stale} onClick={() => void run(() => projection.loadMore())}>Load more waiting messages</Button>}
        </QueueSectionContent>
      </QueueSection>
    </Queue>
    {(error || state.error) && <p role="alert" className="flow-queue-warning">{error ?? state.error} Open the queue to refresh or retry.</p>}
    {(blocked || state.stale || page?.paused || page?.blocked) && <p role="status" className="flow-queue-status">{blocked ?? (page?.paused ? "Queue paused. Open to continue or manage the current execution." : page?.blocked ? `Waiting: ${page.blocked.replaceAll("-", " ")}. Open the queue for controls.` : "Queue needs refresh. Open the queue to refresh.")}</p>}
    {state.receipts.map(receipt => <section key={receipt.key} aria-label={`${receipt.command.kind} receipt`} className="my-2 rounded border p-3 text-xs">
      <strong>{receipt.command.kind.replaceAll("-", " ")} · {receipt.state === "unknown" ? "Receipt unknown" : receipt.state}</strong>
      {receipt.command.kind === "enqueue" && <MessageSettingsSummary value={receipt.command.input.messageSettings} label="Frozen queue settings" />}
      {receipt.command.kind === "enqueue" && <pre className="my-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words">{receipt.command.input.text}</pre>}
      <p role={receipt.state === "rejected" || receipt.state === "unknown" ? "alert" : "status"}>{receipt.message}</p>
      {receipt.state === "unknown" && <><p>The center may have accepted this command. Keep this page open until confirmed; reloading loses this local retry identity. Your next draft is separate.</p><Button type="button" variant="outline" size="sm" disabled={!state.online} onClick={() => void run(() => projection.retry(receipt.key))}>Retry same {receipt.command.kind}</Button></>}
      {(receipt.state === "accepted" || receipt.state === "rejected") && <button className="flow-link mt-1" onClick={() => projection.commands?.dismiss(receipt.key)}>Dismiss {receipt.command.kind} receipt</button>}
    </section>)}
  </section>;
}
