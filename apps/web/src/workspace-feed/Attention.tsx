import { useState } from "react";
import { TERMINAL_STATUSES, type TaskSnapshot, type TaskSummary, type WorkspaceTask } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { WorkspaceFeedProjection, type WorkspaceState } from "./projection";

export const taskStatus: Record<TaskSummary["status"], string> = {
  queued: "Queued", running: "Running", waiting: "Needs your decision", uncertain: "Needs reconciliation",
  cancel_requested: "Cancellation requested", succeeded: "Completed", failed: "Failed", cancelled: "Cancelled",
};
export function TaskActions({ task, projection, state, onOpenTask }: {
  task: WorkspaceTask | TaskSnapshot; projection: WorkspaceFeedProjection; state: WorkspaceState; onOpenTask(id: string): void;
}) {
  const [confirm, setConfirm] = useState(false);
  const action = state.actions[task.id];
  const disabled = action?.pending || state.connection === "offline";
  const decision = task.status === "waiting" ? task.pendingDecision : null;
  return <div className="wf-task-actions">
    {decision && <>
      <p>{decision.prompt}</p>
      <Button size="sm" disabled={disabled} onClick={() => void projection.decide(task.id, decision.id, "approve")}>Approve</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void projection.decide(task.id, decision.id, "reject")}>Reject</Button>
    </>}
    {task.status === "uncertain" && <p>The runner’s outcome needs reconciliation. No decision is assumed.</p>}
    {!TERMINAL_STATUSES.includes(task.status) && task.status !== "cancel_requested" && !confirm &&
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setConfirm(true)}>Cancel task</Button>}
    {confirm && <div className="wf-cancel" role="group" aria-label={`Confirm cancellation of ${task.title}`}>
      <span>Ask the runner to stop this task?</span>
      <Button size="sm" disabled={disabled} onClick={() => { setConfirm(false); void projection.cancel(task.id); }}>Confirm cancellation</Button>
      <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>Keep running</Button>
    </div>}
    <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>Open chat</Button>
    {action?.pending && <span role="status">Waiting for the center…</span>}
    {action?.error && <p className="wf-error" role="alert">{action.error}</p>}
  </div>;
}
export function Attention({ state, projection, onOpenTask, onOpenIndex }: {
  state: WorkspaceState; projection: WorkspaceFeedProjection; onOpenTask(id: string): void; onOpenIndex(): void;
}) {
  return <section className="wf-attention" aria-labelledby="attention-heading">
    <div className="wf-section-heading"><h2 id="attention-heading">Needs your attention</h2>
      <span>{state.attentionTruncated ? "Latest 100 · more in task index" : `${state.attention.length} tasks`}</span>
    </div>
    {state.attentionTruncated && <Button size="sm" variant="outline" onClick={onOpenIndex}>Show all attention tasks</Button>}
    {state.deliveredCursor !== null && !state.attention.length && <p className="wf-muted">No tasks needed your attention at the latest successful refresh.</p>}
    {state.deliveredCursor === null && !state.loading && <p className="wf-muted">Attention state has not been loaded.</p>}
    <ul className="wf-attention-list">
      {state.attention.map(current => {
        const reviewed = state.reviewed[current.id];
        const task = reviewed && reviewed.updatedAt >= current.updatedAt ? reviewed : current;
        return <li key={task.id}><article aria-label={`Attention: ${task.title}`}>
          <div className="wf-task-heading"><h3>{task.title}</h3><span>{taskStatus[task.status]}</span></div>
          <TaskActions task={task} state={state} projection={projection} onOpenTask={onOpenTask} />
        </article></li>;
      })}
    </ul>
  </section>;
}
