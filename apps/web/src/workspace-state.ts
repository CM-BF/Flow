export interface ChatGroup {
  id: string;
  tabs: string[];
  activeId: string;
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
  if (groups.length >= 2) return groups;
  const source = groups.find((group) => group.id === groupId);
  if (!source || source.tabs.length < 2) return groups;
  const tabs = source.tabs.filter((id) => id !== source.activeId);
  return [
    ...groups.map((group) =>
      group.id === groupId ? { ...group, tabs, activeId: tabs.at(-1)! } : group,
    ),
    { id: newGroupId, tabs: [source.activeId], activeId: source.activeId },
  ];
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
  return groups
    .map((group) => {
      const tabs = group.tabs.filter((id) => id !== viewId);
      return {
        ...group,
        tabs,
        activeId:
          group.activeId === viewId ? (tabs.at(-1) ?? "") : group.activeId,
      };
    })
    .filter((group) => group.tabs.length);
}
