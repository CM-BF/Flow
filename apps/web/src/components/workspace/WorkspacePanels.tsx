import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FileIcon, FolderTreeIcon, TerminalIcon, XIcon } from "lucide-react";
import type { Reference } from "@flow/contracts";
import { WorkspaceFiles, WorkspaceDetail, WorkspaceTerminal } from "./panels";
import type { WorkspacePanelsProps, WorkspaceTabId } from "./types";
import "./workspace.css";

export type { WorkspacePanelsProps, WorkspaceTabId } from "./types";

/** Task-scoped view state never writes or infers task execution state. */
export function WorkspacePanels(props: WorkspacePanelsProps) {
  return <TaskWorkspace key={props.task?.id ?? "empty"} {...props} />;
}

function TaskWorkspace({
  task, details, onLoadDetail, connection, activeTab: controlledTab,
  onActiveTabChange, onClose, className = "",
}: WorkspacePanelsProps) {
  const prefix = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [localTab, setLocalTab] = useState<WorkspaceTabId>("files");
  const [focusedTab, setFocusedTab] = useState<WorkspaceTabId>("files");
  const [openDetails, setOpenDetails] = useState<string[]>([]);
  const references = [...new Map((task?.entries ?? []).flatMap((entry) =>
    entry.kind === "reference" ? [[entry.reference.id, entry.reference] as const] : [],
  )).values()];
  const activeTab = controlledTab ?? localTab;
  const activeDetailId = activeTab.startsWith("detail:") ? activeTab.slice(7) : null;
  const activeReference = references.find((reference) => reference.id === activeDetailId);
  const detailIds = [...new Set([...openDetails, ...(activeReference ? [activeReference.id] : [])])]
    .filter((id) => references.some((reference) => reference.id === id));
  const tabs: { id: WorkspaceTabId; title: string }[] = [
    { id: "files", title: "Files" },
    { id: "terminal", title: "Terminal" },
    ...detailIds.map((id) => ({
      id: `detail:${id}` as WorkspaceTabId,
      title: references.find((reference) => reference.id === id)!.title,
    })),
  ];
  const visibleTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "files";

  useEffect(() => {
    if (!activeReference) return;
    setOpenDetails((ids) => ids.includes(activeReference.id) ? ids : [...ids, activeReference.id]);
  }, [activeReference?.id]);

  function selectTab(tab: WorkspaceTabId) {
    setLocalTab(tab);
    setFocusedTab(tab);
    onActiveTabChange?.(tab);
  }

  function openReference(reference: Reference) {
    setOpenDetails((ids) => ids.includes(reference.id) ? ids : [...ids, reference.id]);
    selectTab(`detail:${reference.id}`);
  }

  function focusTab(tab: WorkspaceTabId) {
    setFocusedTab(tab);
    const index = tabs.findIndex((item) => item.id === tab);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }

  function closeDetail(id: string) {
    setOpenDetails((ids) => ids.filter((item) => item !== id));
    const index = tabs.findIndex((tab) => tab.id === `detail:${id}`);
    const nextTab = tabs[index - 1]?.id ?? "files";
    if (activeTab === `detail:${id}`) selectTab(nextTab);
    focusTab(nextTab);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, tab: WorkspaceTabId) {
    const index = tabs.findIndex((item) => item.id === tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (event.key === "Delete" && tab.startsWith("detail:")) {
      event.preventDefault();
      closeDetail(tab.slice(7));
      return;
    } else return;
    event.preventDefault();
    focusTab(tabs[next]!.id);
  }

  return (
    <aside className={`flow-workspace ${className}`} aria-label="Task workspace">
      <div className="flow-workspace-tabs-row">
        <div className="flow-workspace-tabs" role="tablist" aria-label="Workspace panels" ref={tabsRef}>
          {tabs.map((tab) => {
            const Icon = tab.id === "files" ? FolderTreeIcon : tab.id === "terminal" ? TerminalIcon : FileIcon;
            const tabKey = encodeURIComponent(tab.id);
            return (
              <div className="flow-workspace-tab-item" key={tab.id} data-active={visibleTab === tab.id}>
                <button type="button" role="tab" id={`${prefix}-tab-${tabKey}`}
                  aria-controls={`${prefix}-panel-${tabKey}`} aria-selected={visibleTab === tab.id}
                  tabIndex={(tabs.some((item) => item.id === focusedTab) ? focusedTab : visibleTab) === tab.id ? 0 : -1} title={tab.title}
                  onKeyDown={(event) => navigateTabs(event, tab.id)} onClick={() => selectTab(tab.id)}>
                  <Icon aria-hidden="true" size={14} /><span>{tab.title}</span>
                </button>
                {tab.id.startsWith("detail:") && (
                  <button type="button" className="flow-workspace-tab-close" aria-label={`Close ${tab.title}`}
                    onClick={() => closeDetail(tab.id.slice(7))}><XIcon size={13} aria-hidden="true" /></button>
                )}
              </div>
            );
          })}
        </div>
        {onClose && <button type="button" className="flow-workspace-close" onClick={onClose}
          aria-label="Close workspace"><XIcon size={16} aria-hidden="true" /></button>}
      </div>
      <section className="flow-workspace-panel" role="tabpanel" tabIndex={0}
        id={`${prefix}-panel-${encodeURIComponent(visibleTab)}`}
        aria-labelledby={`${prefix}-tab-${encodeURIComponent(visibleTab)}`}>
        {!task ? <p className="flow-workspace-empty">Select a chat to see its files and output.</p>
          : visibleTab === "files" ? <WorkspaceFiles references={references} details={details} onOpen={openReference} />
          : visibleTab === "terminal" ? <WorkspaceTerminal task={task} connection={connection} />
          : activeReference ? <WorkspaceDetail key={activeReference.id} reference={activeReference}
              state={details[activeReference.id]} onLoad={onLoadDetail} verification={task.verificationStatus} />
          : <p className="flow-workspace-empty">This reference is no longer in the task snapshot.</p>}
      </section>
    </aside>
  );
}
