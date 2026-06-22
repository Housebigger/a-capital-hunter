import { describe, it, expect } from "vitest";
import { selectTopLabelsPerGroup, selectTopLabels } from "./labelDensity";

describe("selectTopLabelsPerGroup", () => {
  const cands = [
    { id: "a1", subThemeId: "A", weight: 5 },
    { id: "a2", subThemeId: "A", weight: 9 },
    { id: "a3", subThemeId: "A", weight: 1 },
    { id: "b1", subThemeId: "B", weight: 4 },
  ];
  it("keeps the top-N by weight within each group", () => {
    const ids = selectTopLabelsPerGroup(cands, 1);
    expect(ids.has("a2")).toBe(true);   // A's biggest
    expect(ids.has("a1")).toBe(false);
    expect(ids.has("b1")).toBe(true);   // B's only
    expect(ids.size).toBe(2);
  });
  it("perGroup 0 selects nothing", () => {
    expect(selectTopLabelsPerGroup(cands, 0).size).toBe(0);
  });
});

describe("selectTopLabels", () => {
  it("keeps the global top-N by weight", () => {
    const ids = selectTopLabels(
      [{ id: "x", weight: 1 }, { id: "y", weight: 9 }, { id: "z", weight: 5 }],
      2
    );
    expect([...ids].sort()).toEqual(["y", "z"]);
  });
});
