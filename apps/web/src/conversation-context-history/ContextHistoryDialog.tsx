import { useRef, useSyncExternalStore } from "react";
import type { ContextHistorySample } from "../../../../packages/contracts/src/context-observation-history.js";
import type { ContextMeasurement } from "../../../../packages/contracts/src/context-transparency.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import type { ContextHistoryController } from "./controller";

function Reading({ name, reading }: { name: string; reading: ContextMeasurement }) {
  return <div><dt className="font-medium">{name}</dt><dd className="mt-1">
    {reading.kind === "unknown" ? <>Unknown · {reading.reason}</> : <>
      {reading.value.toLocaleString()} tokens · estimate
    </>}
  </dd></div>;
}
function Sample({ sample }: { sample: ContextHistorySample }) {
  const { observation, materials } = sample, { identity } = observation;
  return <>
    <p className="text-sm font-medium">{observation.used.kind !== "unknown" || observation.compactionWindow.kind !== "unknown" ? "Last observed · estimate" : "Last observation · values unknown"}</p>
    <p className="text-sm">Observed model: {identity.resolvedModel ?? "unknown"} · <time dateTime={observation.observedAt}>{new Date(observation.observedAt).toLocaleString()}</time></p>
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <Reading name="Last observed use" reading={observation.used} />
      <Reading name="Strategy-window estimate" reading={observation.compactionWindow} />
      <div><dt className="font-medium">Model hard limit</dt><dd>Unknown · not supplied by this history</dd></div>
      <div><dt className="font-medium">Compression</dt><dd>Not observed · this does not mean none occurred</dd></div>
    </dl>
    <p className="text-sm text-muted-foreground">The strategy window is not a model hard limit. These historical readings cannot establish current remaining space.</p>
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Observation identity and source</summary>
      <dl className="mt-3 grid gap-2 break-words [overflow-wrap:anywhere]">
        {[observation.used, observation.compactionWindow].map((reading, index) => reading.kind !== "unknown" && <div key={index}>
          <dt>{index === 0 ? "Use" : "Strategy window"} measurement</dt><dd>{reading.source.name} {reading.source.version} · {reading.measurementMethod} · {reading.coverage} coverage · token basis {reading.tokenBasis}</dd>
        </div>)}
        <div><dt>Requested model at execution</dt><dd>{identity.requestedModel}</dd></div>
        <div><dt>Observed model</dt><dd>{identity.resolvedModel ?? "Unknown · not observed"}</dd></div>
        <div><dt>Observed at (UTC)</dt><dd><time dateTime={observation.observedAt}>{observation.observedAt}</time></dd></div>
        <div><dt>Received at (UTC)</dt><dd><time dateTime={sample.receivedAt}>{sample.receivedAt}</time></dd></div>
        <div><dt>Observation / event</dt><dd>{observation.id} / {sample.eventSequence}</dd></div>
        {identity.subject.kind === "attempt" && <>
          <div><dt>Task / attempt</dt><dd>{identity.subject.taskId} / {identity.subject.attemptId}</dd></div>
          <div><dt>Native session / owner version</dt><dd>{identity.subject.nativeSessionId ?? "Unknown"} / {identity.subject.ownerVersion}</dd></div>
        </>}
        <div><dt>Profile / runner / digest</dt><dd>{identity.profile ? `${identity.profile.id} / ${identity.profile.runnerId} / ${identity.profile.configDigest}` : "Unknown"}</dd></div>
        <div><dt>Execution input digest</dt><dd>{identity.executionInputDigest ?? "Unknown"}</dd></div>
        <div><dt>Material revision digest</dt><dd>{identity.materialRevisionDigest ?? "Unknown"}</dd></div>
        <div><dt>History epoch</dt><dd>{identity.historyEpoch ?? "Unknown"}</dd></div>
      </dl>
    </details>
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Recorded material references</summary>
      {materials.state === "unknown" ? <p className="mt-3">Unknown · material metadata is unavailable, including attachment inventory.</p> : <ul className="mt-3 space-y-3">
        {materials.sources.map((source, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">
          {source.byteLength.toLocaleString()} exact bytes · token count unknown
          <dl><dt>Project / source / version</dt><dd>{source.citation.projectId} / {source.citation.sourceId} / {source.citation.version}</dd>
            <dt>Content digest</dt><dd>{source.citation.contentDigest}</dd><dt>UTF-8 byte locator</dt><dd>{source.citation.locator.start}–{source.citation.locator.end}</dd></dl>
        </li>)}
      </ul>}
      <p className="mt-3 text-muted-foreground">References and byte counts do not prove token cost or current context residency.</p>
    </details>
  </>;
}

/** Existing Radix Dialog; no numeric Context ring, pricing module or model call. */
export function ContextHistoryDialog({ controller }: { controller: ContextHistoryController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const invoker = useRef<HTMLElement | null>(null);
  return <Dialog open={state.open} onOpenChange={open => { if (!open) controller.close(); }}>
    <DialogContent className="max-h-[min(90dvh,48rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl pr-8 motion-reduce:animate-none motion-reduce:transition-none [scrollbar-gutter:stable]"
      onOpenAutoFocus={() => { invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={event => { event.preventDefault(); const button = invoker.current; if (button?.isConnected && !button.closest("[hidden], [inert]") && button.getClientRects().length) button.focus(); }}>
      <DialogHeader><DialogTitle>Context observation</DialogTitle><DialogDescription>Historical evidence for this execution, not the current draft or a live capacity meter.</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">Current use and remaining space are unknown: this endpoint provides history only.</p>
      <button type="button" className="justify-self-start rounded-md border px-3 py-2 text-sm" aria-disabled={state.pending} onClick={() => { if (!state.pending) void controller.refresh(); }}>Refresh observation</button>
      {state.pending && <p role="status" className="text-sm">Reading observation…</p>}
      {state.error && <p role="alert" className="text-sm">Observation read failed{state.error.status ? ` (HTTP ${state.error.status})` : ""}{state.error.code ? ` · ${state.error.code}` : ""}. Refresh explicitly to try again.</p>}
      {state.history && !state.history.latest && <p className="text-sm">{state.history.attemptId === null ? "No current execution attempt was reported." : "No observation was reported for this attempt."} This is not a zero-token reading.</p>}
      {state.history?.latest && <><Sample sample={state.history.latest} />
        <button type="button" className="justify-self-start rounded-md border px-3 py-2 text-sm" aria-disabled={state.pending || state.detail !== null} onClick={() => { if (!state.pending) void controller.readDetail(); }}>Read observation detail</button>
        {state.detail && <section aria-label="Observation detail" className="min-w-0"><h3 className="font-medium">{state.detail.title}</h3><pre className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs">{state.detail.content}</pre></section>}
      </>}
    </DialogContent>
  </Dialog>;
}
