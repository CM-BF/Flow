import { describe, expect, it } from "vitest";
import {
  addWorkspace, activeWorkspace, closeLayoutView, emptyLayout, layoutGroups, MAX_OPEN_VIEWS,
  mergeChats, readLayout, removeWorkspace, reorderPane, resizePanes, selectLayoutView, splitChat, updateWorkspace,
} from "../src/workspace-state";

function populated() {
  let layout = emptyLayout();
  for (const route of ["conversation:A", "conversation:B", "conversation:C", "conversation:D"])
    layout = selectLayoutView(layout, "main", route);
  return layout;
}

describe("Arc bounded workspace references", () => {
  it("splits three panes, rejects a fourth and merges without replacing route identities", () => {
    const source = populated();
    let panes = splitChat(activeWorkspace(source).panes, "main", "right");
    panes = splitChat(panes, "main", "middle");
    expect(panes).toHaveLength(3);
    expect(splitChat(panes, "main", "fourth")).toBe(panes);
    expect(panes.flatMap(pane => pane.tabs).sort()).toEqual(["conversation:A", "conversation:B", "conversation:C", "conversation:D"]);
    expect(mergeChats(panes, "conversation:C")).toEqual([{ id: "main", tabs: panes.flatMap(pane => pane.tabs), activeId: "conversation:C" }]);
  });
  it("moves references across pane order and clamps pointer and keyboard ratios through one operation", () => {
    const panes = splitChat(activeWorkspace(populated()).panes, "main", "right");
    const swapped = reorderPane(panes, "right", -1);
    expect(swapped[0]).toBe(panes[1]); expect(swapped[1]).toBe(panes[0]);
    for (const [input, expected] of [[-1, .15], [.4, .4], [2, .85]]) {
      const result = resizePanes(panes, "main", input!);
      expect(result[0]!.weight! / (result[0]!.weight! + result[1]!.weight!)).toBeCloseTo(expected!);
      expect(result.map(pane => pane.tabs)).toEqual(panes.map(pane => pane.tabs));
    }
    expect(resizePanes(panes, "main", NaN)).toBe(panes);
  });
  it("closes the active tab to its right neighbour then left, and represents the empty workspace", () => {
    let layout = selectLayoutView(populated(), "main", "conversation:B");
    layout = closeLayoutView(layout, "conversation:B");
    expect(activeWorkspace(layout).panes[0]!.activeId).toBe("conversation:C");
    layout = selectLayoutView(layout, "main", "conversation:D");
    layout = closeLayoutView(layout, "conversation:D");
    expect(activeWorkspace(layout).panes[0]!.activeId).toBe("conversation:C");
    layout = closeLayoutView(closeLayoutView(layout, "conversation:A"), "conversation:C");
    expect(activeWorkspace(layout).panes).toEqual([]);
    expect(activeWorkspace(selectLayoutView(layout, "main", "draft-new")).panes[0]!.activeId).toBe("draft-new");
  });
  it("keeps one owner per route across workspace tabs and closes to the adjacent workspace", () => {
    let layout = addWorkspace(populated(), "second");
    layout = selectLayoutView(layout, "pane-second", "conversation:E");
    const same = selectLayoutView(layout, "pane-second", "conversation:A");
    expect(same.activeTabId).toBe("workspace-main");
    expect(layoutGroups(same).flatMap(pane => pane.tabs).filter(id => id === "conversation:A")).toHaveLength(1);
    expect(removeWorkspace(same, "workspace-main").activeTabId).toBe("second");
    expect(removeWorkspace(removeWorkspace(same, "workspace-main"), "second")).toEqual(emptyLayout());
  });
  it("caps total open references while retaining eight bounded workspace tabs", () => {
    let layout = emptyLayout();
    for (let index = 0; index < MAX_OPEN_VIEWS; index++) layout = selectLayoutView(layout, "main", `draft-${index}`);
    expect(selectLayoutView(layout, "main", "draft-extra")).toBe(layout);
    for (let index = 1; index < 8; index++) layout = addWorkspace(layout, `workspace-${index}`);
    expect(addWorkspace(layout, "ninth")).toBe(layout);
  });
  it("parses only bounded references, rejects duplicates and strips draft-like extra fields", () => {
    const source = updateWorkspace(populated(), tab => ({ ...tab, panes: splitChat(tab.panes, "main", "right") }));
    expect(readLayout(JSON.parse(JSON.stringify(source)))).toEqual(source);
    const extra = { ...source, draft: { text: "not layout authority" } };
    expect(readLayout(extra)).not.toHaveProperty("draft");
    const duplicate = structuredClone(source); duplicate.tabs[0]!.panes[1]!.tabs.push("conversation:A");
    expect(readLayout(duplicate)).toBeNull();
    expect(readLayout({ ...source, activeTabId: "missing" })).toBeNull();
    expect(readLayout({ ...source, version: 2 })).toBeNull();
    expect(readLayout({ ...source, tabs: [{ ...source.tabs[0], panes: Array(4).fill(source.tabs[0]!.panes[0]) }] })).toBeNull();
  });
});
