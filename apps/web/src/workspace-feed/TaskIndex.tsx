import { useSyncExternalStore } from "react";
import { Button } from "../components/ui/button";
import { TaskActions, taskStatus } from "./Attention";
import type { WorkspaceFeedProjection, WorkspaceState } from "./projection";
import type { TaskIndexProjection, TaskIndexState } from "./task-index";

export function TaskIndex({ index, feed, workspace, onOpenTask }: {
  index: TaskIndexProjection; feed: WorkspaceFeedProjection; workspace: WorkspaceState; onOpenTask(id: string): void;
}) {
  const state = useSyncExternalStore(index.subscribe, index.getSnapshot);
  return <section className="wf-index" aria-label="Complete task index">
    <div className="wf-index-controls">
      <label>Show <select value={state.filter} onChange={event => void index.load(false, event.target.value as TaskIndexState["filter"])}>
        <option value="all">All tasks</option><option value="attention">Needs attention</option>
        {Object.entries(taskStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <Button variant="outline" size="sm" disabled={state.loading || workspace.connection === "offline"} onClick={() => void index.load()}>Refresh task index</Button>
    </div>
    <p role="status">{state.total === null ? "Task count not loaded" : `${state.tasks.length} loaded · ${state.total} matching tasks`}</p>
    <p className="wf-muted">Count is authoritative at the latest page request. Tasks may change while you browse.</p>
    {state.receivedAt && <p className="wf-muted">Updated <time dateTime={state.receivedAt}>{new Date(state.receivedAt).toLocaleTimeString()}</time></p>}
    {state.error && <p role="alert" className="wf-error">{state.error}</p>}
    <ul className="wf-index-list">
      {state.tasks.map(summary => {
        const snapshot = workspace.reviewed[summary.id];
        const reviewed = snapshot && snapshot.updatedAt >= summary.updatedAt ? snapshot : undefined;
        const task = reviewed ?? summary;
        const action = workspace.actions[task.id];
        return <li key={task.id}><article aria-label={`Task: ${task.title}`}>
          <div className="wf-task-heading"><button onClick={() => onOpenTask(task.id)}>{task.title}</button><span>{taskStatus[task.status]}</span></div>
          <p className="wf-muted">{task.harness} · Verification {task.verificationStatus} · <time dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleString()}</time></p>
          {reviewed ? <TaskActions task={reviewed} state={workspace} projection={feed} onOpenTask={onOpenTask} /> : <>
            <Button variant="ghost" size="sm" disabled={action?.pending || workspace.connection === "offline"} onClick={() => void feed.reviewTask(task.id)}>Review current state</Button>
            {action?.error && <p role="alert" className="wf-error">{action.error}</p>}
          </>}
        </article></li>;
      })}
    </ul>
    {state.loading && <p role="status">Loading task index…</p>}
    {!state.loading && state.total === 0 && <p>No matching tasks.</p>}
    {state.nextCursor && <Button variant="outline" disabled={state.loading || workspace.connection === "offline"} onClick={() => void index.load(true)}>Load more tasks</Button>}
  </section>;
}
