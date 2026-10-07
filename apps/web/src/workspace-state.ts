export interface ChatGroup {
  id: string;
  tabs: string[];
  activeId: string;
  weight?: number;
}
export const MAX_VISIBLE_PANES = 3;
export const MAX_WORKSPACE_TABS = 8;
export const MAX_OPEN_VIEWS = 32;
export interface WorkspaceTab { id: string; title: string; panes: ChatGroup[]; activePaneId: string }
export interface WorkspaceLayout { version: 1; tabs: WorkspaceTab[]; activeTabId: string }
export const emptyLayout = (): WorkspaceLayout => ({ version: 1, tabs: [{ id: "workspace-main", title: "Workspace 1", panes: [], activePaneId: "main" }], activeTabId: "workspace-main" });
export const activeWorkspace = (layout: WorkspaceLayout) => layout.tabs.find(tab => tab.id === layout.activeTabId)!;
export const layoutGroups = (layout: WorkspaceLayout) => layout.tabs.flatMap(tab => tab.panes);
function normalizeWeights(panes: ChatGroup[]) {
  const weights = panes.map(pane => pane.weight !== undefined && Number.isFinite(pane.weight) && pane.weight > 0 ? pane.weight : 1), total = weights.reduce((sum, weight) => sum + weight, 0);
  return panes.map((pane, index) => ({ ...pane, weight: weights[index]! / total }));
}
export function updateWorkspace(layout: WorkspaceLayout, update: (tab: WorkspaceTab) => WorkspaceTab): WorkspaceLayout {
  return { ...layout, tabs: layout.tabs.map(tab => tab.id === layout.activeTabId ? update(tab) : tab) };
}
export function addWorkspace(layout: WorkspaceLayout, id: string): WorkspaceLayout {
  if (layout.tabs.length >= MAX_WORKSPACE_TABS || layout.tabs.some(tab => tab.id === id)) return layout;
  return { ...layout, activeTabId: id, tabs: [...layout.tabs, { id, title: `Workspace ${layout.tabs.length + 1}`, panes: [], activePaneId: `pane-${id}` }] };
}
export function removeWorkspace(layout: WorkspaceLayout, id: string): WorkspaceLayout {
  const index = layout.tabs.findIndex(tab => tab.id === id);
  if (index < 0) return layout;
  const tabs = layout.tabs.filter(tab => tab.id !== id);
  return tabs.length ? { ...layout, tabs, activeTabId: layout.activeTabId === id ? tabs[Math.min(index, tabs.length - 1)]!.id : layout.activeTabId } : emptyLayout();
}
export function selectLayoutView(layout: WorkspaceLayout, groupId: string, viewId: string): WorkspaceLayout {
  const owner = layout.tabs.find(tab => tab.panes.some(pane => pane.tabs.includes(viewId))) ?? activeWorkspace(layout);
  if (!layoutGroups(layout).some(pane => pane.tabs.includes(viewId)) && layoutGroups(layout).reduce((sum, pane) => sum + pane.tabs.length, 0) >= MAX_OPEN_VIEWS) return layout;
  const pane = owner.panes.find(pane => pane.tabs.includes(viewId)) ?? owner.panes.find(pane => pane.id === groupId) ?? owner.panes[0];
  const panes = owner.panes.length ? openChat(owner.panes, pane!.id, viewId) : [{ id: owner.activePaneId, tabs: [viewId], activeId: viewId }];
  return { ...layout, activeTabId: owner.id, tabs: layout.tabs.map(tab => tab === owner ? { ...tab, panes, activePaneId: pane?.id ?? owner.activePaneId } : tab) };
}
export function renameLayoutView(layout: WorkspaceLayout, before: string, after: string): WorkspaceLayout {
  return { ...layout, tabs: layout.tabs.map(tab => ({ ...tab, panes: tab.panes.map(pane => ({ ...pane, tabs: pane.tabs.map(id => id === before ? after : id), activeId: pane.activeId === before ? after : pane.activeId })) })) };
}
export function closeLayoutView(layout: WorkspaceLayout, viewId: string): WorkspaceLayout {
  return { ...layout, tabs: layout.tabs.map(tab => {
    const panes = closeChat(tab.panes, viewId);
    return { ...tab, panes, activePaneId: panes.some(pane => pane.id === tab.activePaneId) ? tab.activePaneId : panes[0]?.id ?? tab.activePaneId };
  }) };
}
export function reorderPane(panes: ChatGroup[], id: string, direction: -1 | 1): ChatGroup[] {
  const at = panes.findIndex(pane => pane.id === id), target = at + direction;
  if (at < 0 || target < 0 || target >= panes.length) return panes;
  const next = [...panes]; [next[at], next[target]] = [next[target]!, next[at]!]; return next;
}
export function resizePanes(panes: ChatGroup[], leftId: string, share: number): ChatGroup[] {
  const at = panes.findIndex(pane => pane.id === leftId), left = panes[at], right = panes[at + 1];
  if (!left || !right || !Number.isFinite(share)) return panes;
  const total = (left.weight ?? 1) + (right.weight ?? 1), ratio = Math.max(.15, Math.min(.85, share));
  return normalizeWeights(panes.map((pane, index) => index === at ? { ...pane, weight: total * ratio } : index === at + 1 ? { ...pane, weight: total * (1 - ratio) } : pane));
}
/** Untrusted local layout contains bounded references, never draft or controller state. */
export function readLayout(value: unknown): WorkspaceLayout | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Partial<WorkspaceLayout>;
  if (root.version !== 1 || !Array.isArray(root.tabs) || !root.tabs.length || root.tabs.length > MAX_WORKSPACE_TABS) return null;
  const ids = new Set<string>(), routes = new Set<string>();
  const label = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 180 && !/[\x00-\x1f]/.test(id);
  const unique = (id: unknown): id is string => label(id) && !ids.has(id) && !!ids.add(id);
  for (const tab of root.tabs) {
    if (!tab || !unique(tab.id) || !label(tab.title) || !Array.isArray(tab.panes) || tab.panes.length > MAX_VISIBLE_PANES || !label(tab.activePaneId)) return null;
    for (const pane of tab.panes) {
      if (!pane || !unique(pane.id) || !Array.isArray(pane.tabs) || !pane.tabs.length || pane.tabs.length > MAX_OPEN_VIEWS || !pane.tabs.includes(pane.activeId)) return null;
      if (pane.weight !== undefined && (!Number.isFinite(pane.weight) || pane.weight <= 0 || pane.weight > MAX_VISIBLE_PANES)) return null;
      for (const route of pane.tabs) {
        if (!label(route) || routes.has(route) || !/^(conversation:[A-Za-z0-9_-]+|draft-[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)$/.test(route)) return null;
        routes.add(route);
      }
    }
    if (tab.panes.length && !tab.panes.some(pane => pane.id === tab.activePaneId)) return null;
  }
  if (routes.size > MAX_OPEN_VIEWS || !root.tabs.some(tab => tab.id === root.activeTabId)) return null;
  return { version: 1, activeTabId: root.activeTabId!, tabs: root.tabs.map(tab => ({ id: tab.id, title: tab.title, activePaneId: tab.activePaneId, panes: tab.panes.map(pane => ({ id: pane.id, activeId: pane.activeId, tabs: [...pane.tabs], weight: pane.weight ?? 1 })) })) };
}
export function openChat(
  groups: ChatGroup[],
  groupId: string,
  viewId: string,
): ChatGroup[] {
  const existing = groups.find((group) => group.tabs.includes(viewId));
  return groups.map((group) =>
    group.id ===
    (existing?.id ??
      groups.find((group) => group.id === groupId)?.id ??
      groups[0]?.id)
      ? {
          ...group,
          tabs: group.tabs.includes(viewId)
            ? group.tabs
            : [...group.tabs, viewId],
          activeId: viewId,
        }
      : group,
  );
}
export function splitChat(
  groups: ChatGroup[],
  groupId: string,
  newGroupId: string,
): ChatGroup[] {
  if (groups.length >= MAX_VISIBLE_PANES || groups.some(group => group.id === newGroupId)) return groups;
  const source = groups.find((group) => group.id === groupId);
  if (!source || source.tabs.length < 2) return groups;
  const tabs = source.tabs.filter((id) => id !== source.activeId);
  return normalizeWeights([
    ...groups.map((group) =>
      group.id === groupId ? { ...group, tabs, activeId: tabs.at(-1)! } : group,
    ),
    { id: newGroupId, tabs: [source.activeId], activeId: source.activeId },
  ]);
}
export function mergeChats(groups: ChatGroup[], activeId: string): ChatGroup[] {
  if (!groups.length) return groups;
  return [
    {
      id: groups[0]!.id,
      tabs: [...new Set(groups.flatMap((group) => group.tabs))],
      activeId,
    },
  ];
}
export function closeChat(groups: ChatGroup[], viewId: string): ChatGroup[] {
  return normalizeWeights(groups
    .map((group) => {
      const tabs = group.tabs.filter((id) => id !== viewId);
      return {
        ...group,
        tabs,
        activeId: group.activeId === viewId ? (tabs[Math.min(group.tabs.indexOf(viewId), tabs.length - 1)] ?? "") : group.activeId,
      };
    })
    .filter((group) => group.tabs.length));
}
