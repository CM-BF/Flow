import type { KeyboardEvent, ReactNode } from "react";
import { MAX_WORKSPACE_TABS, type ChatGroup, type WorkspaceLayout } from "../workspace-state";

function focusTab(event: KeyboardEvent<HTMLButtonElement>) {
  const list = event.currentTarget.closest('[role="tablist"]');
  const tabs = [...(list?.querySelectorAll<HTMLButtonElement>('button[role="tab"]') ?? [])];
  const index = tabs.indexOf(event.currentTarget);
  const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
    : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
  if (next >= 0) { event.preventDefault(); tabs[next]?.focus(); }
}

/** Navigation owns focus only. App owns layout, views and all business state. */
export function WorkspaceTabs({ layout, onSelect, onAdd, onClose }: {
  layout: WorkspaceLayout; onSelect(id: string): void; onAdd(): void; onClose(id: string): void;
}) {
  return <div className="flow-arc-workspace-tabs">
    <div role="tablist" aria-label="Workspaces">{layout.tabs.map(tab => <span key={tab.id}>
      <button role="tab" id={`workspace-tab-${tab.id}`} aria-controls="workspace-panes"
        aria-selected={layout.activeTabId === tab.id} tabIndex={layout.activeTabId === tab.id ? 0 : -1}
        onKeyDown={event => { if (event.key === "Delete") { event.preventDefault(); onClose(tab.id); } else focusTab(event); }} onClick={() => onSelect(tab.id)}>{tab.title}</button>
      <button type="button" aria-label={`Close ${tab.title}`} onClick={() => onClose(tab.id)}>×</button></span>)}</div>
    <button type="button" onClick={onAdd} disabled={layout.tabs.length >= MAX_WORKSPACE_TABS} aria-label="New workspace">+</button>
  </div>;
}

export function PaneTabs({ pane, focused, position, total, renderTitle, renderClose, renderActions, onSelect, onClose, onMove }: {
  pane: ChatGroup; focused: boolean; position: number; total: number;
  renderTitle(id: string): ReactNode; renderClose(id: string): ReactNode; renderActions(id: string): ReactNode;
  onSelect(id: string): void; onClose(id: string): void; onMove(direction: -1 | 1): void;
}) {
  return <div className={`flow-pane-header ${focused ? "focused" : ""}`} data-pane-id={pane.id}>
    <div className="flow-tabs" role="tablist" aria-label={`Chat pane ${position + 1}`}>{pane.tabs.map(id =>
      <div key={id} className={`flow-tab ${pane.activeId === id ? "selected" : ""}`}>
        <button type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={pane.activeId === id}
          tabIndex={pane.activeId === id ? 0 : -1} onKeyDown={event => {
            if (event.key === "Delete") { event.preventDefault(); onClose(id); } else focusTab(event);
          }} onClick={() => onSelect(id)}>{renderTitle(id)}</button>
        {renderActions(id)}{renderClose(id)}
      </div>)}</div>
    {total > 1 && <div className="flow-pane-order" aria-label={`Move pane ${position + 1}`}>
      <button type="button" aria-label={`Move pane ${position + 1} left`} disabled={!position} onClick={() => onMove(-1)}>←</button>
      <button type="button" aria-label={`Move pane ${position + 1} right`} disabled={position === total - 1} onClick={() => onMove(1)}>→</button>
    </div>}
  </div>;
}
