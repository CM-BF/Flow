import { expect, it } from "vitest";
import { ActivityLayout } from "../src/workspace-feed/ActivityWindow";

it("finds measured variable rows and clamps empty/end offsets", () => {
  const layout = new ActivityLayout(["a", "b", "c"], new Map([["a", 10], ["b", 300], ["c", 45]]));
  expect(layout.height).toBe(355);
  expect([-1, 0, 9.9, 10, 309, 310, 355, 900].map(value => layout.indexAt(value))).toEqual([0, 0, 0, 1, 1, 2, 2, 2]);
  expect(new ActivityLayout([]).window(0, 1000)).toEqual({ start: 0, end: 0 });
  expect(new ActivityLayout([]).anchor(0)).toBeNull();
});
it("restores the same ID and within-row offset after history prepend and height changes", () => {
  const initial = new ActivityLayout(["b", "c"], new Map([["b", 80], ["c", 120]]));
  const anchor = initial.anchor(103)!;
  expect(anchor).toEqual({ id: "c", offset: 23 });
  const changed = new ActivityLayout(["a", "b", "c", "d"], new Map([["a", 40], ["b", 300]]));
  expect(changed.restore(anchor)).toBe(363);
  expect(new ActivityLayout(["a"]).restore(anchor)).toBeNull();
  expect(new ActivityLayout(["c"], new Map([["c", 10]])).restore(anchor)).toBe(9);
});
it("walks every record in a 10040-entry history with bounded overlapping windows", () => {
  const ids = Array.from({ length: 10040 }, (_, index) => `entry-${index}`);
  const heights = new Map(ids.map((id, index) => [id, index % 7 ? 84 : 650]));
  const layout = new ActivityLayout(ids, heights);
  const seen = new Set<string>();
  let maximum = 0;
  for (let top = 0; top <= layout.height + 900; top += 600) {
    const range = layout.window(top, 900);
    maximum = Math.max(maximum, range.end - range.start);
    ids.slice(range.start, range.end).forEach(id => seen.add(id));
  }
  expect(seen.size).toBe(ids.length);
  expect(maximum).toBeLessThan(30);
});
