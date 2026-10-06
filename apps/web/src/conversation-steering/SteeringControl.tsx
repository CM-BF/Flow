import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "../components/ui/button";
import type { SteeringControl as SteeringController, LocalSteeringReceipt } from "./control";
import "./steering.css";

export interface SteeringControlProps { control: SteeringController }
const phase = { accepted: "Accepted by center", received: "Received by runner", "observed-consumed": "Consumption observed", rejected: "Rejected by runner", unknown: "Delivery unknown" };
function Receipt({ receipt, control, disabled }: { receipt: LocalSteeringReceipt; control: SteeringController; disabled: boolean }) {
  return <li className="steer-receipt" aria-label="Steering receipt">
    <p role="status"><strong>{receipt.phase === "unknown" ? "Acceptance unknown" : receipt.phase === "sending" ? "Sending to center…" : receipt.phase === "rejected" ? "Submission rejected" : phase[receipt.command!.status]}</strong></p>
    {receipt.error && <p role="alert">{receipt.error}</p>}
    <details><summary>Submitted text</summary><pre>{receipt.input.text}</pre><p>{receipt.bytes} UTF-8 bytes · attempt {receipt.input.attemptId}</p></details>
    {receipt.phase === "unknown" && <Button variant="outline" disabled={disabled} onClick={() => control.retry(receipt.key)}>Retry original command</Button>}
  </li>;
}
export function SteeringControl({ control }: SteeringControlProps) {
  const state = useSyncExternalStore(control.subscribe, control.getSnapshot, control.getSnapshot);
  const [draft, setDraft] = useState(""), revision = useRef(0), label = useId();
  const [localError, setLocalError] = useState<string>();
  const submit = (event: FormEvent) => {
    event.preventDefault(); const version = revision.current; setLocalError(undefined);
    void control.submit(draft).then(submitted => { if (submitted && version === revision.current) { revision.current++; setDraft(""); } }, () => setLocalError("The local handoff failed. Your draft is retained."));
  };
  if (!state.visible) return null;
  if (!state.authorized) return <section className="steer-control" aria-label="Active steering"><p role="status">Steering access is unavailable in this view. Any command already sent is not cancelled.</p></section>;
  const pending = state.preparing || state.receipts.some(receipt => receipt.phase === "sending");
  const canRead = state.online && !state.loading;
  return <section className="steer-control" aria-label="Active steering">
    <header><h2>Guide this running task</h2><Button variant="outline" disabled={!canRead} onClick={() => { void control.refresh(); }}>{state.loading ? "Refreshing…" : "Refresh steering"}</Button></header>
    <p className="steer-muted">Send a separate instruction to the current attempt. This does not queue another conversation turn.</p>
    {state.error && <p role="alert">{state.error}</p>}
    {state.stale && <p role="status">Availability is stale. Refresh before a new submission; an original uncertain command can still be retried.</p>}
    {!state.online && <p role="status">Offline. Commands already sent may continue at the center.</p>}
    {state.sendDisabledReason && <p className="steer-notice" role="status">{state.sendDisabledReason}</p>}
    <form onSubmit={submit}>
      <label htmlFor={label}>Additional instruction</label>
      <textarea id={label} value={draft} rows={3} onChange={event => { revision.current++; setDraft(event.target.value); }}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.defaultPrevented && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
      <div className="steer-actions"><span className="steer-muted">Enter sends · Shift+Enter adds a line</span><Button type="submit" disabled={!!state.sendDisabledReason || !draft.trim()}>Send steering</Button></div>
      {localError && <p role="alert">{localError}</p>}
    </form>
    {!!state.receipts.length && <><h3>Command receipts</h3><ul className="steer-receipts">{state.receipts.map(receipt => <Receipt key={receipt.key} receipt={receipt} control={control} disabled={!state.online || pending} />)}</ul></>}
    <details className="steer-history"><summary>Loaded command history · {state.commands.length}</summary>
      <ul>{state.commands.map(command => <li key={command.id}>{phase[command.status]} · attempt {command.attemptId} · command {command.revision} · receipt {command.receiptRevision}</li>)}</ul>
      {state.nextCursor !== null && <Button variant="outline" disabled={!canRead} onClick={() => { void control.loadMore(); }}>Load more commands</Button>}
      <Button variant="outline" disabled={pending} onClick={control.clearResolved}>Clear resolved local history</Button>
      {state.loadedAt && <p className="steer-muted">Last refreshed {new Date(state.loadedAt).toLocaleTimeString()}</p>}
    </details>
    <details><summary>What these receipts mean</summary><p>Accepted means the center saved the command. Received and consumption observed are authenticated runner observations; neither proves that a model followed the instruction.</p><p>Unconfirmed keys and submitted text live only in this page. Keep it open to retry the original command. Reloading or replacing the connection loses that local recovery record. Hidden or disconnected views do not cancel center work.</p></details>
  </section>;
}
