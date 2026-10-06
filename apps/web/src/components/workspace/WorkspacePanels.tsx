import { createContext, useContext, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { FileIcon, FolderTreeIcon, TerminalIcon, XIcon } from "lucide-react";
import type { Reference } from "@flow/contracts";
import { WorkspaceFiles, WorkspaceDetail, WorkspaceTerminal } from "./panels";
import type { WorkspacePanelsProps, WorkspaceTabId } from "./types";
import "./workspace.css";

export type { WorkspacePanelsProps, WorkspaceTabId } from "./types";

export const WorkspaceChromeContext = createContext<{ header?: ReactNode; actions?: ReactNode; artifact?: ReactNode }>({});

interface WorkspaceLayout {
  tab: WorkspaceTabId;
  openDetails: string[];
  expanded: Set<string>;
  selectedPath?: string;
  follow: boolean;
}

/** Task-scoped view state never writes or infers task execution state. */
export function WorkspacePanels(props: WorkspacePanelsProps) {
  const layouts = useRef(new Map<string, WorkspaceLayout>());
  const taskId = props.task?.id ?? "empty";
  let layout = layouts.current.get(taskId);
  if (!layout) {
    layout = { tab: "files", openDetails: [], expanded: new Set(["artifact", "verification", "detail", "usage", "session", "unopened"]), follow: true };
    layouts.current.set(taskId, layout);
  }
  return <TaskWorkspace key={taskId} {...props} layout={layout} />;
}

function TaskWorkspace({
  task, details, onLoadDetail, connection, activeTab: controlledTab,
  onActiveTabChange, onClose, className = "", layout,
}: WorkspacePanelsProps & { layout: WorkspaceLayout }) {
  const chrome = useContext(WorkspaceChromeContext);
  const prefix = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const focusAfterOpen = useRef<WorkspaceTabId | null>(null);
  const [localTab, setLocalTab] = useState<WorkspaceTabId>(layout.tab);
  const [focusedTab, setFocusedTab] = useState<WorkspaceTabId>(controlledTab ?? layout.tab);
  const [openDetails, setOpenDetails] = useState<string[]>(layout.openDetails);
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

  useEffect(() => { if (controlledTab) setFocusedTab(controlledTab); }, [controlledTab]);
  useEffect(() => { layout.tab = activeTab; layout.openDetails = openDetails; }, [layout, activeTab, openDetails]);
  useLayoutEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const reveal = () => {
      if (!container.clientWidth) return;
      const button = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      if (!button) return;
      const tab = button.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      if (tab.right > viewport.right) container.scrollLeft += tab.right - viewport.right;
      else if (tab.left < viewport.left) container.scrollLeft += tab.left - viewport.left;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(container);
    return () => resize.disconnect();
  }, [visibleTab, tabs.length]);
  useLayoutEffect(() => {
    if (!focusAfterOpen.current || visibleTab !== focusAfterOpen.current) return;
    const index = tabs.findIndex((tab) => tab.id === focusAfterOpen.current);
    const button = tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index];
    if (button) { button.focus(); focusAfterOpen.current = null; }
  }, [visibleTab, tabs.length]);

  function selectTab(tab: WorkspaceTabId) {
    setLocalTab(tab);
    setFocusedTab(tab);
    onActiveTabChange?.(tab);
  }

  function openReference(reference: Reference) {
    focusAfterOpen.current = `detail:${reference.id}`;
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
      <div className="flow-workspace-plugin-chrome">{chrome.header}{chrome.actions}</div>
      <div className="flow-workspace-tabs-row" data-extension-slot="workspace.header">
        <div className="flow-workspace-tabs" data-extension-slot="workspace.tabs" role="tablist" aria-label="Workspace panels" ref={tabsRef}>
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
                  <button type="button" tabIndex={-1} className="flow-workspace-tab-close" aria-label={`Close ${tab.title}`}
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
          : visibleTab === "files" ? <WorkspaceFiles references={references} details={details} onOpen={openReference}
              defaultExpanded={layout.expanded} onExpandedChange={(expanded) => { layout.expanded = expanded; }}
              selectedPath={layout.selectedPath} onSelectedPathChange={(path) => { layout.selectedPath = path; }} />
          : visibleTab === "terminal" ? <WorkspaceTerminal task={task} connection={connection}
              defaultFollow={layout.follow} onFollowChange={(follow) => { layout.follow = follow; }} />
          : activeReference ? <><div className="flow-workspace-plugin-chrome">{chrome.artifact}</div><WorkspaceDetail key={activeReference.id} reference={activeReference}
              state={details[activeReference.id]} onLoad={onLoadDetail} verification={task.verificationStatus} /></>
          : <p className="flow-workspace-empty">This reference is no longer in the task snapshot.</p>}
      </section>
    </aside>
  );
}
