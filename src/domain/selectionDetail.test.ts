import { describe, it, expect } from "vitest";
import { buildSelectionDetail } from "./selectionDetail";

const themes = [{ id: "ai", name: "AI算力", shortName: "AI", color: "#fff" }] as const;
const subThemes = [{ id: "chips", themeId: "ai", name: "AI芯片", shortName: "芯片" }] as const;
const data = {
  themes: themes as any,
  subThemes: subThemes as any,
  byTheme: new Map([["ai", 5e8]]),
  bySubTheme: new Map([["chips", -2e8]]),
};

describe("buildSelectionDetail", () => {
  it("returns null when nothing is selected", () => {
    expect(buildSelectionDetail(undefined, "P1", data)).toBeNull();
  });
  it("P1: theme id → theme detail with byTheme net inflow + direction", () => {
    const d = buildSelectionDetail("ai", "P1", data)!;
    expect(d).toMatchObject({ kind: "theme", name: "AI算力", netInflow: 5e8, direction: "inflow" });
    expect(d.parentThemeName).toBeUndefined();
  });
  it("P2/P3: sub-theme id → sub-theme detail with parent + bySubTheme + outflow", () => {
    const d = buildSelectionDetail("chips", "P2", data)!;
    expect(d).toMatchObject({ kind: "subTheme", name: "AI芯片", parentThemeName: "AI算力", netInflow: -2e8, direction: "outflow" });
    expect(buildSelectionDetail("chips", "P3", data)!.kind).toBe("subTheme");
  });
  it("net 0 → flat; unknown id → null", () => {
    expect(buildSelectionDetail("ai", "P1", { ...data, byTheme: new Map([["ai", 0]]) })!.direction).toBe("flat");
    expect(buildSelectionDetail("ghost", "P1", data)).toBeNull();
    expect(buildSelectionDetail("ghost", "P2", data)).toBeNull();
  });
});
