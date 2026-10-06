import { useId } from "react";
import type { ConversationCreation } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import type { ExecutionProfileCatalogSnapshot } from "./catalog";
import { configuredSelection, isChatAccess, legacyDefaultSelection, type ProfileSelection } from "./selection";
import "./execution-profiles.css";

export interface ExecutionProfilePickerProps {
  catalog: ExecutionProfileCatalogSnapshot;
  selection: ProfileSelection;
  onSelect(selection: ProfileSelection): void;
  onRefresh(): void;
  onLoadMore(): void;
  locked?: { creation: ConversationCreation; reason: "created" | "receipt-pending" };
}

export function ExecutionProfilePicker({ catalog, selection, onSelect, onRefresh, onLoadMore, locked }: ExecutionProfilePickerProps) {
  const groupId = useId();
  if (locked) return <FrozenConfiguration creation={locked.creation} pending={locked.reason === "receipt-pending"} />;
  const selected = selection.kind === "configured" ? selection.profile : null;
  const missing = selected && catalog.loaded && !catalog.profiles.some(profile => profile.reference.id === selected.reference.id && profile.reference.configDigest === selected.reference.configDigest && profile.reference.runnerId === selected.reference.runnerId);
  return <div className="ep-picker">
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="outline" className="ep-trigger">Execution profile: {selected?.configuration.model ?? "Runner default"}</Button></DialogTrigger>
      <DialogContent className="ep-dialog">
        <DialogTitle>Execution profile</DialogTitle>
        <DialogDescription>Choose a complete configured profile for a new conversation. The choice locks when creation is submitted.</DialogDescription>
        <div className="ep-directory-actions"><Button type="button" variant="outline" onClick={onRefresh} disabled={catalog.loading}>{catalog.loading ? "Loading profiles…" : "Refresh profiles"}</Button><span role="status">{catalog.loaded ? `${catalog.profiles.length} profiles loaded${catalog.nextCursor ? "; more available" : ""}` : "Directory not loaded"}</span></div>
        {catalog.error && <p role="alert" className="ep-error">{catalog.error}</p>}
        {catalog.stale && catalog.loaded && <p className="ep-notice">Directory is stale. Refresh before choosing a configured profile.</p>}
        {missing && <p className="ep-notice">Your selection is not in the loaded directory. It stays selected; the center will validate availability when you create.</p>}
        <fieldset className="ep-options" disabled={catalog.loading}>
          <legend className="sr-only">Configured execution profiles</legend>
          <label className="ep-option"><input type="radio" name={groupId} checked={!selected} onChange={() => onSelect(legacyDefaultSelection())} /><span><strong>Runner default</strong><span>Legacy compatibility · no pinned profile</span><small>Thinking disabled · configured read-only access</small></span></label>
          {catalog.profiles.map(profile => <label className="ep-option" key={profile.reference.id}>
            <input type="radio" name={groupId} checked={selected?.reference.id === profile.reference.id} disabled={catalog.stale || !isChatAccess(profile.configuration.access)} onChange={() => onSelect(configuredSelection(profile))} />
            <span><strong>{profile.model.displayName || profile.configuration.model}</strong><span>Requested model: {profile.configuration.model}</span><small>Runner {profile.reference.runnerId}</small><small>Profile {profile.reference.id}</small><span>{profile.configuration.access === "none" ? "No tools" : profile.configuration.access === "configured-readonly" ? "Configured read-only access" : `Access declaration: ${profile.configuration.access}`}{profile.configuration.requireReadApproval ? " · read approval required" : ""}</span>{!isChatAccess(profile.configuration.access) && <strong>Cannot be used for ordinary chat</strong>}<small>Thinking disabled · effort unsupported</small><small>Provider availability not checked · actual model unknown</small><details><summary>Configuration details</summary><span>Adapter {profile.configuration.adapterVersion}</span><span>Permission mode {profile.configuration.permissionMode}</span><span>Limits: {profile.configuration.limits.maxTurns} turns, ${profile.configuration.limits.maxBudgetUsd}, {profile.configuration.limits.timeoutMs / 1000}s</span><small>Configuration digest {profile.reference.configDigest}</small><small>Material scope digest {profile.configuration.materialScopeDigest}</small></details></span>
          </label>)}
        </fieldset>
        {!catalog.loading && catalog.loaded && !catalog.profiles.length && <p>No configured profiles were returned. Runner default remains an explicit compatibility choice.</p>}
        {catalog.nextCursor && <Button type="button" variant="outline" disabled={!catalog.canLoadMore} onClick={onLoadMore}>Load more profiles</Button>}
        <p className="ep-footnote">This is a paged directory, not a global model search. A profile declares configuration; it does not attest that a runner or provider is online.</p>
      </DialogContent>
    </Dialog>
    <p className="ep-summary">{selected ? `Requested: ${selected.configuration.model} · ${selected.configuration.access}` : "Requested: runner-default · configured-readonly"}. Thinking disabled. Actual settings are reported by execution.</p>
  </div>;
}

function FrozenConfiguration({ creation, pending }: { creation: ConversationCreation; pending: boolean }) {
  const access = creation.requested.tools === "none" ? "No tools" : creation.requested.tools === "configured-readonly" ? "Read-only access" : `Access: ${creation.requested.tools}`;
  const thinking = creation.requested.thinking === "disabled" ? "Thinking off" : `Thinking: ${creation.requested.thinking}`;
  return <section className="ep-locked" aria-label="Locked execution profile">
    <div className="ep-locked-heading"><strong>Requested: {creation.requested.model}</strong><span>{pending ? "Creation receipt pending" : "Conversation profile locked"}</span></div>
    <p className="ep-locked-summary">{access} · {thinking}{!creation.executionProfile && " · Unpinned legacy default"}</p>
    <details className="ep-locked-details">
      <summary>Execution details <span>Requested only · actual settings unknown</span></summary>
      <p>{pending ? "Retry uses the same frozen creation configuration. Configuration cannot change while the receipt is pending." : "Start a new conversation to choose another configuration."}</p>
      <dl><dt>Requested model</dt><dd>{creation.requested.model}</dd><dt>Thinking</dt><dd>{creation.requested.thinking}</dd><dt>Access</dt><dd>{creation.requested.tools}</dd><dt>Profile</dt><dd>{creation.executionProfile?.id ?? "Unpinned legacy default"}</dd>{creation.executionProfile && <><dt>Runner</dt><dd>{creation.executionProfile.runnerId}</dd><dt>Configuration digest</dt><dd>{creation.executionProfile.configDigest}</dd></>}</dl>
      <p className="ep-footnote">Requested configuration only. Actual model, tools and provider availability remain unknown until execution reports them.</p>
    </details>
  </section>;
}
